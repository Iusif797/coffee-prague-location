export interface FramePack {
  file: string;
  start: number;
  count: number;
  offsets: number[];
  lengths: number[];
}

export interface FrameManifest {
  count: number;
  first: number;
  last: number;
  frames: string[];
  packs?: FramePack[];
}

export type RenderableFrame = ImageBitmap | HTMLImageElement;

type ProgressCallback = (settled: number, total: number, failed: number) => void;

interface WorkerDecodeRequest {
  resolve: (frame: ImageBitmap | null) => void;
}

type DecoderMessage =
  | { type: 'frame'; requestId: number; bitmap: ImageBitmap }
  | { type: 'decode-error'; requestId: number }
  | { type: 'progress'; settled: number; total: number; failed: number }
  | { type: 'preload-complete' }
  | { type: 'fatal' };

const usesMobileProfile = (): boolean => (
  window.innerWidth < 820 || window.matchMedia('(pointer: coarse)').matches
);

export async function loadFrameManifest(): Promise<{
  manifest: FrameManifest;
  manifestUrl: string;
}> {
  const manifestUrl = new URL(`${import.meta.env.BASE_URL}frames/manifest.json`, document.baseURI).href;
  const response = await fetch(manifestUrl, { cache: 'no-cache' });

  if (!response.ok) {
    throw new Error(`Manifest request failed with ${response.status}`);
  }

  const manifest = (await response.json()) as FrameManifest;
  if (!manifest.frames?.length || manifest.count !== manifest.frames.length) {
    throw new Error('Frame manifest is empty or inconsistent');
  }

  return { manifest, manifestUrl };
}

export class FrameStore {
  private readonly cache = new Map<number, RenderableFrame>();
  private readonly blobs: Array<Blob | null>;
  private readonly pendingDecodes = new Map<number, Promise<RenderableFrame | null>>();
  private readonly pendingIndividuals = new Map<number, Promise<Blob | null>>();
  private readonly pendingPacks = new Map<number, Promise<void>>();
  private readonly packIndexByFrame: Int16Array;
  private readonly status: Uint8Array;
  private readonly workerRequests = new Map<number, WorkerDecodeRequest>();
  private decoderWorker: Worker | null = null;
  private nextWorkerRequestId = 1;
  private preloadPromise: Promise<void> | null = null;
  private resolvePreload: (() => void) | null = null;
  private focusIndex = 0;
  private focusDirection = 1;
  private focusInitialized = false;
  private warmGeneration = 0;
  private warming = false;
  private workerDecodeFailures = 0;
  private active = true;
  private settled = 0;
  private failed = 0;
  private frameWidth = 1280;
  private frameHeight = 720;

  onProgress: ProgressCallback | null = null;
  onFrameReady: (() => void) | null = null;

  constructor(
    private readonly manifest: FrameManifest,
    private readonly manifestUrl: string,
  ) {
    this.blobs = Array.from({ length: manifest.count }, () => null);
    this.status = new Uint8Array(manifest.count);
    this.packIndexByFrame = new Int16Array(manifest.count);
    this.packIndexByFrame.fill(-1);

    manifest.packs?.forEach((pack, packIndex) => {
      for (let offset = 0; offset < pack.count; offset += 1) {
        this.packIndexByFrame[pack.start + offset] = packIndex;
      }
    });

    this.initializeWorker();
  }

  get count(): number {
    return this.manifest.count;
  }

  get sourceWidth(): number {
    return this.frameWidth;
  }

  get sourceHeight(): number {
    return this.frameHeight;
  }

  async load(index: number): Promise<RenderableFrame | null> {
    const safeIndex = this.clampIndex(index);
    const cached = this.cache.get(safeIndex);
    if (cached) return cached;

    const inFlight = this.pendingDecodes.get(safeIndex);
    if (inFlight) return inFlight;

    const promise = this.decodeFrame(safeIndex);
    this.pendingDecodes.set(safeIndex, promise);

    try {
      const frame = await promise;
      if (frame) {
        if (!this.active) {
          if ('close' in frame && typeof frame.close === 'function') frame.close();
          return null;
        }
        this.captureDimensions(frame);
        this.cache.set(safeIndex, frame);
        this.prune();
        this.onFrameReady?.();
      }
      return frame;
    } finally {
      this.pendingDecodes.delete(safeIndex);
    }
  }

  async loadBatch(indices: number[], concurrency = 2): Promise<void> {
    if (indices.length === 0) return;
    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (cursor < indices.length) {
        const index = indices[cursor];
        cursor += 1;
        await this.load(index);
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, indices.length) }, worker));
  }

  async preloadAll(): Promise<void> {
    if (this.decoderWorker) {
      if (this.preloadPromise) return this.preloadPromise;
      this.preloadPromise = new Promise<void>((resolve) => {
        this.resolvePreload = resolve;
      });
      this.decoderWorker.postMessage({ type: 'preload' });
      return this.preloadPromise;
    }

    const packs = this.manifest.packs ?? [];
    for (let packIndex = 0; packIndex < packs.length; packIndex += 1) {
      await this.ensurePack(packIndex);
    }
  }

  warmAround(index: number, direction: number): void {
    if (!this.active) return;
    const nextIndex = this.clampIndex(index);
    const nextDirection = direction === 0 ? this.focusDirection : direction > 0 ? 1 : -1;
    if (
      this.focusInitialized
      && nextIndex === this.focusIndex
      && nextDirection === this.focusDirection
    ) return;

    this.focusInitialized = true;
    this.focusIndex = nextIndex;
    this.focusDirection = nextDirection;
    this.warmGeneration += 1;
    this.prune();
    this.prefetchAhead();

    if (!this.warming) void this.runWarmer();
  }

  setActive(active: boolean): void {
    if (active === this.active) return;
    this.active = active;
    this.warmGeneration += 1;

    if (active) {
      this.focusInitialized = false;
      return;
    }

    for (const frame of this.cache.values()) {
      if ('close' in frame && typeof frame.close === 'function') frame.close();
    }
    this.cache.clear();
  }

  nearest(index: number): { image: RenderableFrame; index: number } | null {
    const safeIndex = this.clampIndex(index);
    const exact = this.cache.get(safeIndex);
    if (exact) return { image: exact, index: safeIndex };

    let nearestImage: RenderableFrame | null = null;
    let nearestIndex = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const [loadedIndex, image] of this.cache) {
      const distance = Math.abs(loadedIndex - safeIndex);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestImage = image;
        nearestIndex = loadedIndex;
      }
    }

    return nearestImage ? { image: nearestImage, index: nearestIndex } : null;
  }

  private initializeWorker(): void {
    if (!('Worker' in window) || !('createImageBitmap' in window)) return;

    try {
      this.decoderWorker = new Worker(
        new URL('./frame-decoder.worker.ts', import.meta.url),
        { type: 'module' },
      );
      this.decoderWorker.onmessage = this.handleWorkerMessage;
      this.decoderWorker.onerror = () => this.disableWorker();
      this.decoderWorker.postMessage({
        type: 'init',
        manifest: this.manifest,
        manifestUrl: this.manifestUrl,
      });
    } catch (error) {
      console.warn('Frame decoder worker is unavailable; using the browser fallback.', error);
      this.disableWorker();
    }
  }

  private readonly handleWorkerMessage = (event: MessageEvent<DecoderMessage>): void => {
    const message = event.data;
    if (message.type === 'fatal') {
      this.disableWorker();
      return;
    }

    if (message.type === 'progress') {
      this.settled = message.settled;
      this.failed = message.failed;
      this.onProgress?.(message.settled, message.total, message.failed);
      return;
    }

    if (message.type === 'preload-complete') {
      this.resolvePreload?.();
      this.resolvePreload = null;
      return;
    }

    const request = this.workerRequests.get(message.requestId);
    if (!request) {
      if (message.type === 'frame') message.bitmap.close();
      return;
    }

    this.workerRequests.delete(message.requestId);
    if (message.type === 'frame') {
      this.workerDecodeFailures = 0;
      request.resolve(message.bitmap);
      return;
    }

    this.workerDecodeFailures += 1;
    request.resolve(null);
    if (this.workerDecodeFailures >= 2) this.disableWorker();
  };

  private disableWorker(): void {
    this.decoderWorker?.terminate();
    this.decoderWorker = null;
    for (const request of this.workerRequests.values()) request.resolve(null);
    this.workerRequests.clear();
    this.resolvePreload?.();
    this.resolvePreload = null;
  }

  private async runWarmer(): Promise<void> {
    this.warming = true;
    try {
      while (this.active) {
        const generation = this.warmGeneration;
        const indices = this.warmIndices();

        const batchSize = usesMobileProfile() ? 1 : 2;
        for (let cursor = 0; cursor < indices.length; cursor += batchSize) {
          if (generation !== this.warmGeneration) break;
          await Promise.all(indices.slice(cursor, cursor + batchSize).map((index) => this.load(index)));
        }

        if (generation === this.warmGeneration) break;
      }
    } finally {
      this.warming = false;
    }
  }

  private warmIndices(): number[] {
    const mobile = usesMobileProfile();
    const ahead = mobile ? 5 : 10;
    const behind = mobile ? 2 : 5;
    const center = this.focusIndex;
    const indices = [center];

    for (let offset = 1; offset <= Math.max(ahead, behind); offset += 1) {
      if (offset <= ahead) {
        const forward = center + offset * this.focusDirection;
        if (forward >= 0 && forward < this.count) indices.push(forward);
      }
      if (offset <= behind) {
        const backward = center - offset * this.focusDirection;
        if (backward >= 0 && backward < this.count) indices.push(backward);
      }
    }

    return indices;
  }

  private prefetchAhead(): void {
    const lookAhead = usesMobileProfile() ? 18 : 28;
    const index = this.clampIndex(this.focusIndex + lookAhead * this.focusDirection);

    if (this.decoderWorker) {
      this.decoderWorker.postMessage({ type: 'prefetch', index });
      return;
    }

    const packIndex = this.packIndexByFrame[index];
    if (packIndex >= 0) void this.ensurePack(packIndex);
  }

  private async decodeFrame(index: number): Promise<RenderableFrame | null> {
    if (this.decoderWorker) {
      const decoded = await this.decodeInWorker(index);
      if (decoded) return decoded;
    }

    const blob = await this.fetchFrame(index);
    if (!blob) return null;

    if ('createImageBitmap' in window) {
      try {
        return await createImageBitmap(blob);
      } catch (error) {
        console.warn('ImageBitmap decode failed; using image fallback.', error);
      }
    }

    return this.decodeWithImage(blob);
  }

  private decodeInWorker(index: number): Promise<ImageBitmap | null> {
    const worker = this.decoderWorker;
    if (!worker) return Promise.resolve(null);

    const requestId = this.nextWorkerRequestId;
    this.nextWorkerRequestId += 1;
    return new Promise<ImageBitmap | null>((resolve) => {
      this.workerRequests.set(requestId, { resolve });
      worker.postMessage({ type: 'decode', requestId, index });
    });
  }

  private async fetchFrame(index: number): Promise<Blob | null> {
    const cached = this.blobs[index];
    if (cached) return cached;

    if (index === 0) return this.fetchIndividual(index);

    const packIndex = this.packIndexByFrame[index];
    if (packIndex >= 0) {
      await this.ensurePack(packIndex);
      if (this.blobs[index]) return this.blobs[index];
    }

    return this.fetchIndividual(index);
  }

  private async ensurePack(packIndex: number): Promise<void> {
    const existing = this.pendingPacks.get(packIndex);
    if (existing) return existing;

    const pack = this.manifest.packs?.[packIndex];
    if (!pack) return;
    if (this.blobs[pack.start]) return;

    const promise = this.downloadPack(pack);
    this.pendingPacks.set(packIndex, promise);
    try {
      await promise;
    } finally {
      this.pendingPacks.delete(packIndex);
    }
  }

  private async downloadPack(pack: FramePack): Promise<void> {
    const url = new URL(pack.file, this.manifestUrl).href;
    try {
      const response = await fetch(url, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`Pack request failed with ${response.status}: ${url}`);
      const packedBlob = await response.blob();

      for (let localIndex = 0; localIndex < pack.count; localIndex += 1) {
        const frameIndex = pack.start + localIndex;
        const offset = pack.offsets[localIndex];
        const length = pack.lengths[localIndex];
        this.blobs[frameIndex] = packedBlob.slice(offset, offset + length, 'image/jpeg');
        this.markSettled(frameIndex, false, false);
      }
      this.emitProgress();
    } catch (error) {
      console.warn(error);
      for (let localIndex = 0; localIndex < pack.count; localIndex += 1) {
        this.markSettled(pack.start + localIndex, true, false);
      }
      this.emitProgress();
    }
  }

  private async fetchIndividual(index: number): Promise<Blob | null> {
    const cached = this.blobs[index];
    if (cached) return cached;

    const existing = this.pendingIndividuals.get(index);
    if (existing) return existing;

    const promise = this.downloadIndividual(index);
    this.pendingIndividuals.set(index, promise);
    try {
      return await promise;
    } finally {
      this.pendingIndividuals.delete(index);
    }
  }

  private async downloadIndividual(index: number): Promise<Blob | null> {
    const url = new URL(this.manifest.frames[index], this.manifestUrl).href;
    try {
      const response = await fetch(url, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`Frame request failed with ${response.status}: ${url}`);
      const blob = await response.blob();
      this.blobs[index] = blob;
      this.markSettled(index, false);
      return blob;
    } catch (error) {
      console.warn(error);
      this.markSettled(index, true);
      return null;
    }
  }

  private async decodeWithImage(blob: Blob): Promise<HTMLImageElement | null> {
    const image = new Image();
    image.decoding = 'async';
    const objectUrl = URL.createObjectURL(blob);
    image.src = objectUrl;

    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Unable to decode cached frame'));
      });
      await image.decode().catch(() => undefined);
      return image;
    } catch (error) {
      console.warn(error);
      return null;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  private captureDimensions(frame: RenderableFrame): void {
    this.frameWidth = frame instanceof HTMLImageElement ? frame.naturalWidth : frame.width;
    this.frameHeight = frame instanceof HTMLImageElement ? frame.naturalHeight : frame.height;
  }

  private markSettled(index: number, failed: boolean, emit = true): void {
    if (this.status[index] !== 0) {
      if (!failed && this.status[index] === 2) {
        this.status[index] = 1;
        this.failed -= 1;
        if (emit) this.emitProgress();
      }
      return;
    }

    this.status[index] = failed ? 2 : 1;
    this.settled += 1;
    if (failed) this.failed += 1;
    if (emit) this.emitProgress();
  }

  private emitProgress(): void {
    this.onProgress?.(this.settled, this.count, this.failed);
  }

  private prune(): void {
    const mobile = usesMobileProfile();
    const ahead = mobile ? 5 : 10;
    const behind = mobile ? 2 : 5;
    let fallbackIndex = -1;
    let fallbackDistance = Number.POSITIVE_INFINITY;

    for (const index of this.cache.keys()) {
      const distance = Math.abs(index - this.focusIndex);
      if (distance < fallbackDistance) {
        fallbackDistance = distance;
        fallbackIndex = index;
      }
    }

    for (const [index, frame] of this.cache) {
      const distanceInDirection = (index - this.focusIndex) * this.focusDirection;
      const isNearFocus = distanceInDirection >= -behind && distanceInDirection <= ahead;
      if (index !== fallbackIndex && !isNearFocus) {
        if ('close' in frame && typeof frame.close === 'function') frame.close();
        this.cache.delete(index);
      }
    }
  }

  private clampIndex(index: number): number {
    return Math.max(0, Math.min(this.count - 1, Math.round(index)));
  }
}

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
  private readonly anchorStep: number;
  private focusIndex = 0;
  private focusDirection = 1;
  private warmGeneration = 0;
  private warming = false;
  private settled = 0;
  private failed = 0;

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
    this.anchorStep = manifest.count > 160 ? 12 : 8;

    manifest.packs?.forEach((pack, packIndex) => {
      for (let offset = 0; offset < pack.count; offset += 1) {
        this.packIndexByFrame[pack.start + offset] = packIndex;
      }
    });
  }

  get count(): number {
    return this.manifest.count;
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
        this.cache.set(safeIndex, frame);
        this.onFrameReady?.();
      }
      return frame;
    } finally {
      this.pendingDecodes.delete(safeIndex);
      this.prune();
    }
  }

  async loadBatch(indices: number[], concurrency = 4): Promise<void> {
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

  async prepareCoverage(): Promise<void> {
    const anchors: number[] = [];
    for (let index = 0; index < this.count; index += this.anchorStep) anchors.push(index);
    if (anchors.at(-1) !== this.count - 1) anchors.push(this.count - 1);
    await this.loadBatch(anchors, 3);
  }

  async preloadAll(): Promise<void> {
    const packs = this.manifest.packs ?? [];
    if (packs.length > 0) {
      let packCursor = 0;
      const packWorker = async (): Promise<void> => {
        while (packCursor < packs.length) {
          const packIndex = packCursor;
          packCursor += 1;
          await this.ensurePack(packIndex);
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, packs.length) }, packWorker));
    }

    const missing: number[] = [];
    for (let index = 0; index < this.count; index += 1) {
      if (!this.blobs[index]) missing.push(index);
    }
    await this.fetchIndividualBatch(missing, 3);
  }

  warmAround(index: number, direction: number): void {
    this.focusIndex = this.clampIndex(index);
    if (direction !== 0) this.focusDirection = direction > 0 ? 1 : -1;
    this.warmGeneration += 1;
    this.prune();

    if (!this.warming) void this.runWarmer();
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

  private async runWarmer(): Promise<void> {
    this.warming = true;
    try {
      while (true) {
        const generation = this.warmGeneration;
        const indices = this.warmIndices();

        for (let cursor = 0; cursor < indices.length; cursor += 4) {
          if (generation !== this.warmGeneration) break;
          await Promise.all(indices.slice(cursor, cursor + 4).map((index) => this.load(index)));
        }

        if (generation === this.warmGeneration) break;
      }
    } finally {
      this.warming = false;
    }
  }

  private warmIndices(): number[] {
    const mobile = window.innerWidth < 700;
    const ahead = mobile ? 18 : 26;
    const behind = mobile ? 8 : 12;
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

  private async fetchFrame(index: number): Promise<Blob | null> {
    const cached = this.blobs[index];
    if (cached) return cached;

    // The first frame remains a small standalone request for the fastest first paint.
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
    let complete = true;
    for (let offset = 0; offset < pack.count; offset += 1) {
      if (!this.blobs[pack.start + offset]) {
        complete = false;
        break;
      }
    }
    if (complete) return;

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
        this.markSettled(frameIndex, false);
      }
    } catch (error) {
      console.warn(error);
      for (let localIndex = 0; localIndex < pack.count; localIndex += 1) {
        this.markSettled(pack.start + localIndex, true);
      }
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

  private async fetchIndividualBatch(indices: number[], concurrency: number): Promise<void> {
    if (indices.length === 0) return;
    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (cursor < indices.length) {
        const index = indices[cursor];
        cursor += 1;
        await this.fetchIndividual(index);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, indices.length) }, worker));
  }

  private async decodeFrame(index: number): Promise<RenderableFrame | null> {
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

  private markSettled(index: number, failed: boolean): void {
    if (this.status[index] !== 0) {
      if (!failed && this.status[index] === 2) {
        this.status[index] = 1;
        this.failed -= 1;
        this.onProgress?.(this.settled, this.count, this.failed);
      }
      return;
    }

    this.status[index] = failed ? 2 : 1;
    this.settled += 1;
    if (failed) this.failed += 1;
    this.onProgress?.(this.settled, this.count, this.failed);
  }

  private prune(): void {
    const mobile = window.innerWidth < 700;
    const ahead = mobile ? 18 : 26;
    const behind = mobile ? 8 : 12;

    for (const [index, frame] of this.cache) {
      const distanceInDirection = (index - this.focusIndex) * this.focusDirection;
      const isAnchor = index % this.anchorStep === 0 || index === this.count - 1;
      const isNearFocus = distanceInDirection >= -behind && distanceInDirection <= ahead;
      if (!isAnchor && !isNearFocus) {
        if ('close' in frame && typeof frame.close === 'function') frame.close();
        this.cache.delete(index);
      }
    }
  }

  private clampIndex(index: number): number {
    return Math.max(0, Math.min(this.count - 1, Math.round(index)));
  }
}

export interface FrameManifest {
  count: number;
  first: number;
  last: number;
  frames: string[];
}

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
  private readonly cache = new Map<number, HTMLImageElement>();
  private readonly pending = new Map<number, Promise<HTMLImageElement | null>>();
  private readonly status: Uint8Array;
  private readonly anchorStep: number;
  private focusIndex = 0;
  private settled = 0;
  private failed = 0;

  onProgress: ProgressCallback | null = null;
  onFrameReady: (() => void) | null = null;

  constructor(
    private readonly manifest: FrameManifest,
    private readonly manifestUrl: string,
  ) {
    this.status = new Uint8Array(manifest.count);
    this.anchorStep = manifest.count > 160 ? 12 : 8;
  }

  get count(): number {
    return this.manifest.count;
  }

  get allSettled(): boolean {
    return this.settled === this.count;
  }

  setFocus(index: number): void {
    this.focusIndex = this.clampIndex(index);
    this.prune();
  }

  async load(index: number): Promise<HTMLImageElement | null> {
    const safeIndex = this.clampIndex(index);
    const cached = this.cache.get(safeIndex);
    if (cached) return cached;

    const inFlight = this.pending.get(safeIndex);
    if (inFlight) return inFlight;

    const promise = this.createImage(safeIndex);
    this.pending.set(safeIndex, promise);

    try {
      const image = await promise;
      if (image) {
        this.cache.set(safeIndex, image);
        this.onFrameReady?.();
      }
      return image;
    } finally {
      this.pending.delete(safeIndex);
      this.prune();
    }
  }

  async loadBatch(indices: number[], concurrency = 5): Promise<void> {
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

  async loadAround(index: number, radius = 6): Promise<void> {
    const safeIndex = this.clampIndex(index);
    const indices: number[] = [safeIndex];

    for (let offset = 1; offset <= radius; offset += 1) {
      if (safeIndex + offset < this.count) indices.push(safeIndex + offset);
      if (safeIndex - offset >= 0) indices.push(safeIndex - offset);
    }

    await this.loadBatch(indices, 4);
  }

  async preloadAll(): Promise<void> {
    const coverage: number[] = [];
    const remainder: number[] = [];

    // Sparse coverage first means a large scroll jump always has a nearby frame.
    for (let index = 0; index < this.count; index += 1) {
      if (index % this.anchorStep === 0 || index === this.count - 1) coverage.push(index);
      else remainder.push(index);
    }

    await this.loadBatch(coverage, 5);
    await this.loadBatch(remainder, 5);
  }

  nearest(index: number): { image: HTMLImageElement; index: number } | null {
    const safeIndex = this.clampIndex(index);
    const exact = this.cache.get(safeIndex);
    if (exact) return { image: exact, index: safeIndex };

    let nearestImage: HTMLImageElement | null = null;
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

  private async createImage(index: number): Promise<HTMLImageElement | null> {
    const image = new Image();
    image.decoding = 'async';
    image.src = new URL(this.manifest.frames[index], this.manifestUrl).href;

    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error(`Unable to load ${image.src}`));
      });

      if ('decode' in image) {
        await image.decode().catch(() => undefined);
      }

      this.markSettled(index, false);
      return image;
    } catch (error) {
      console.warn(error);
      this.markSettled(index, true);
      return null;
    }
  }

  private markSettled(index: number, failed: boolean): void {
    if (this.status[index] !== 0) return;
    this.status[index] = failed ? 2 : 1;
    this.settled += 1;
    if (failed) this.failed += 1;
    this.onProgress?.(this.settled, this.count, this.failed);
  }

  private prune(): void {
    const windowRadius = window.innerWidth < 700 ? 10 : 16;
    for (const index of this.cache.keys()) {
      const isAnchor = index % this.anchorStep === 0 || index === this.count - 1;
      const isNearFocus = Math.abs(index - this.focusIndex) <= windowRadius;
      if (!isAnchor && !isNearFocus) this.cache.delete(index);
    }
  }

  private clampIndex(index: number): number {
    return Math.max(0, Math.min(this.count - 1, Math.round(index)));
  }
}

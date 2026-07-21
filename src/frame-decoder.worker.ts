import type { FrameManifest, FramePack } from './frame-store';

type DecoderRequest =
  | { type: 'init'; manifest: FrameManifest; manifestUrl: string }
  | { type: 'decode'; requestId: number; index: number }
  | { type: 'preload' };

type DecoderResponse =
  | { type: 'frame'; requestId: number; index: number; bitmap: ImageBitmap }
  | { type: 'decode-error'; requestId: number; index: number }
  | { type: 'progress'; settled: number; total: number; failed: number }
  | { type: 'preload-complete' };

interface WorkerScope {
  onmessage: ((event: MessageEvent<DecoderRequest>) => void) | null;
  postMessage: (message: DecoderResponse, transfer?: Transferable[]) => void;
}

const scope = self as unknown as WorkerScope;
let manifest: FrameManifest | null = null;
let manifestUrl = '';
let blobs: Array<Blob | null> = [];
let packIndexByFrame = new Int16Array(0);
let status = new Uint8Array(0);
let settled = 0;
let failed = 0;
const pendingPacks = new Map<number, Promise<void>>();
const pendingIndividuals = new Map<number, Promise<Blob | null>>();

const emitProgress = (): void => {
  scope.postMessage({
    type: 'progress',
    settled,
    total: manifest?.count ?? 0,
    failed,
  });
};

const markSettled = (index: number, didFail: boolean, emit = true): void => {
  if (status[index] !== 0) {
    if (!didFail && status[index] === 2) {
      status[index] = 1;
      failed -= 1;
      if (emit) emitProgress();
    }
    return;
  }

  status[index] = didFail ? 2 : 1;
  settled += 1;
  if (didFail) failed += 1;
  if (emit) emitProgress();
};

const downloadPack = async (pack: FramePack): Promise<void> => {
  try {
    const url = new URL(pack.file, manifestUrl).href;
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`Pack request failed with ${response.status}: ${url}`);
    const packedBlob = await response.blob();

    for (let localIndex = 0; localIndex < pack.count; localIndex += 1) {
      const frameIndex = pack.start + localIndex;
      const offset = pack.offsets[localIndex];
      const length = pack.lengths[localIndex];
      blobs[frameIndex] = packedBlob.slice(offset, offset + length, 'image/jpeg');
      markSettled(frameIndex, false, false);
    }
    emitProgress();
  } catch (error) {
    console.warn(error);
    for (let localIndex = 0; localIndex < pack.count; localIndex += 1) {
      markSettled(pack.start + localIndex, true, false);
    }
    emitProgress();
  }
};

const ensurePack = async (packIndex: number): Promise<void> => {
  const existing = pendingPacks.get(packIndex);
  if (existing) return existing;

  const pack = manifest?.packs?.[packIndex];
  if (!pack || blobs[pack.start]) return;

  const promise = downloadPack(pack);
  pendingPacks.set(packIndex, promise);
  try {
    await promise;
  } finally {
    pendingPacks.delete(packIndex);
  }
};

const downloadIndividual = async (index: number): Promise<Blob | null> => {
  const frameManifest = manifest;
  if (!frameManifest) return null;

  try {
    const url = new URL(frameManifest.frames[index], manifestUrl).href;
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`Frame request failed with ${response.status}: ${url}`);
    const blob = await response.blob();
    blobs[index] = blob;
    markSettled(index, false);
    return blob;
  } catch (error) {
    console.warn(error);
    markSettled(index, true);
    return null;
  }
};

const fetchIndividual = async (index: number): Promise<Blob | null> => {
  if (blobs[index]) return blobs[index];
  const existing = pendingIndividuals.get(index);
  if (existing) return existing;

  const promise = downloadIndividual(index);
  pendingIndividuals.set(index, promise);
  try {
    return await promise;
  } finally {
    pendingIndividuals.delete(index);
  }
};

const fetchFrame = async (index: number): Promise<Blob | null> => {
  if (blobs[index]) return blobs[index];
  if (index === 0) return fetchIndividual(index);

  const packIndex = packIndexByFrame[index];
  if (packIndex >= 0) {
    await ensurePack(packIndex);
    if (blobs[index]) return blobs[index];
  }

  return fetchIndividual(index);
};

const decodeFrame = async (requestId: number, index: number): Promise<void> => {
  try {
    const blob = await fetchFrame(index);
    if (!blob) throw new Error(`Frame ${index} is unavailable`);
    const bitmap = await createImageBitmap(blob);
    scope.postMessage({ type: 'frame', requestId, index, bitmap }, [bitmap]);
  } catch (error) {
    console.warn(error);
    scope.postMessage({ type: 'decode-error', requestId, index });
  }
};

const preload = async (): Promise<void> => {
  const packs = manifest?.packs ?? [];
  for (let packIndex = 0; packIndex < packs.length; packIndex += 1) {
    await ensurePack(packIndex);
  }
  scope.postMessage({ type: 'preload-complete' });
};

scope.onmessage = (event): void => {
  const message = event.data;
  if (message.type === 'init') {
    manifest = message.manifest;
    manifestUrl = message.manifestUrl;
    blobs = Array.from({ length: manifest.count }, () => null);
    status = new Uint8Array(manifest.count);
    packIndexByFrame = new Int16Array(manifest.count);
    packIndexByFrame.fill(-1);
    manifest.packs?.forEach((pack, packIndex) => {
      for (let offset = 0; offset < pack.count; offset += 1) {
        packIndexByFrame[pack.start + offset] = packIndex;
      }
    });
    return;
  }

  if (message.type === 'decode') {
    void decodeFrame(message.requestId, message.index);
    return;
  }

  void preload();
};

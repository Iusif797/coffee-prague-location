import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const framesDirectory = resolve('public/frames');
const packsDirectory = resolve(framesDirectory, 'packs');
const framePattern = /^frame_(\d{5})\.jpg$/;
const framesPerPack = 24;
const files = (await readdir(framesDirectory))
  .filter((file) => framePattern.test(file))
  .sort((a, b) => a.localeCompare(b));

if (files.length === 0) {
  throw new Error(`No frame_XXXXX.jpg files found in ${framesDirectory}`);
}

const numbers = files.map((file) => Number(file.match(framePattern)?.[1]));
const missing = [];

for (let number = numbers[0]; number <= numbers.at(-1); number += 1) {
  if (!numbers.includes(number)) missing.push(number);
}

if (missing.length > 0) {
  throw new Error(`Missing frame numbers: ${missing.join(', ')}`);
}

await rm(packsDirectory, { recursive: true, force: true });
await mkdir(packsDirectory, { recursive: true });

const packs = [];
let packedBytes = 0;

for (let start = 0; start < files.length; start += framesPerPack) {
  const packFiles = files.slice(start, start + framesPerPack);
  const buffers = await Promise.all(
    packFiles.map((file) => readFile(resolve(framesDirectory, file))),
  );
  const offsets = [];
  const lengths = [];
  let offset = 0;

  buffers.forEach((buffer) => {
    offsets.push(offset);
    lengths.push(buffer.byteLength);
    offset += buffer.byteLength;
  });

  const packedBuffer = Buffer.concat(buffers);
  const contentHash = createHash('sha256').update(packedBuffer).digest('hex').slice(0, 12);
  const packName = `pack_${String(packs.length).padStart(3, '0')}-${contentHash}.bin`;
  await writeFile(resolve(packsDirectory, packName), packedBuffer);
  packedBytes += offset;
  packs.push({
    file: `packs/${packName}`,
    start,
    count: packFiles.length,
    offsets,
    lengths,
  });
}

const manifest = {
  count: files.length,
  first: numbers[0],
  last: numbers.at(-1),
  frames: files,
  packs,
};

await writeFile(
  resolve(framesDirectory, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

console.log(`Frames found: ${files.length}`);
console.log(`Sequence verified: ${files[0]} — ${files.at(-1)}`);
console.log(`Network packs: ${packs.length} (${(packedBytes / 1024 / 1024).toFixed(1)} MB, original JPEG bytes preserved)`);

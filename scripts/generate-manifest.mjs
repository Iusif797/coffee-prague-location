import { readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const framesDirectory = resolve('public/frames');
const framePattern = /^frame_(\d{5})\.jpg$/;
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

const manifest = {
  count: files.length,
  first: numbers[0],
  last: numbers.at(-1),
  frames: files,
};

await writeFile(
  resolve(framesDirectory, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

console.log(`Frames found: ${files.length}`);
console.log(`Sequence verified: ${files[0]} — ${files.at(-1)}`);

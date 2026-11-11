import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const assetRoots = ['assets', 'src/assets'];
const isWebp = (buf) =>
  buf.length >= 12 &&
  buf.toString('ascii', 0, 4) === 'RIFF' &&
  buf.toString('ascii', 8, 12) === 'WEBP';

async function* walk(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }

  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(target);
    else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.webp') {
      yield target;
    }
  }
}

let repaired = 0;
let alreadyWebp = 0;
for (const root of assetRoots) {
  for await (const file of walk(root)) {
    const input = await readFile(file);
    if (isWebp(input)) {
      alreadyWebp += 1;
      continue;
    }
    const metadata = await sharp(input, { failOnError: true }).metadata();
    if (!['png', 'jpeg'].includes(metadata.format)) {
      throw new Error(`Unsupported image format in ${file}: ${metadata.format}`);
    }
    // Keep translucency and details in official category artwork.
    const output = await sharp(input)
      .webp({ lossless: true, effort: 4 })
      .toBuffer();
    if (!isWebp(output)) throw new Error(`Conversion did not produce WebP: ${file}`);
    await writeFile(file, output);
    repaired += 1;
    console.log(`Re-encoded ${file} (${metadata.format} -> webp)`);
  }
}

console.log(`Image repair finished: ${repaired} converted, ${alreadyWebp} already valid.`);

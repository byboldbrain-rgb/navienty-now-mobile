import { Buffer } from 'node:buffer';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOTS = ['assets', 'src/assets'];
const EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function detectFormat(bytes) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png';
  }

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'jpeg';
  }

  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }

  return 'unknown';
}

function expectedFormat(extension) {
  if (extension === '.png') return 'png';
  if (extension === '.jpg' || extension === '.jpeg') return 'jpeg';
  if (extension === '.webp') return 'webp';
  return null;
}

async function collectFiles(directory, output) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(fullPath, output);
      continue;
    }

    if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      output.push(fullPath);
    }
  }
}

const files = [];
for (const root of ROOTS) {
  await collectFiles(root, files);
}

const failures = [];
for (const file of files.sort()) {
  const extension = path.extname(file).toLowerCase();
  const expected = expectedFormat(extension);
  const handle = await fs.open(file, 'r');
  try {
    const header = Buffer.alloc(16);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const detected = detectFormat(header.subarray(0, bytesRead));
    if (detected !== expected) {
      failures.push(`${file}: extension expects ${expected}, detected ${detected}`);
    }
  } finally {
    await handle.close();
  }
}

if (failures.length > 0) {
  console.error('Image asset validation failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Image asset validation passed (${files.length} files checked).`);

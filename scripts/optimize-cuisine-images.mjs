import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const ROOT = process.cwd();
const CUISINES_DIR = path.join(
  ROOT,
  'src',
  'assets',
  'cuisines',
);

const MAX_SIZE = 256;
const WEBP_QUALITY = 82;
const SOURCE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
]);

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(2)} MB`;
}

async function ensureDirectoryExists() {
  try {
    const stat = await fs.stat(CUISINES_DIR);

    if (!stat.isDirectory()) {
      throw new Error(
        `${CUISINES_DIR} is not a directory.`,
      );
    }
  } catch (error) {
    console.error(
      '\nCould not find the cuisine images folder:',
    );
    console.error(CUISINES_DIR);
    console.error(
      '\nRun this script from the project root.',
    );
    throw error;
  }
}

async function optimizeFile(fileName) {
  const extension = path.extname(fileName).toLowerCase();

  if (!SOURCE_EXTENSIONS.has(extension)) {
    return null;
  }

  const sourcePath = path.join(CUISINES_DIR, fileName);
  const baseName = path.basename(fileName, extension);
  const outputPath = path.join(
    CUISINES_DIR,
    `${baseName}.webp`,
  );

  const before = await fs.stat(sourcePath);

  await sharp(sourcePath)
    .rotate()
    .resize({
      width: MAX_SIZE,
      height: MAX_SIZE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({
      quality: WEBP_QUALITY,
      effort: 4,
      smartSubsample: true,
    })
    .toFile(outputPath);

  const after = await fs.stat(outputPath);

  return {
    fileName,
    outputName: `${baseName}.webp`,
    beforeBytes: before.size,
    afterBytes: after.size,
  };
}

async function main() {
  await ensureDirectoryExists();

  const entries = await fs.readdir(
    CUISINES_DIR,
    { withFileTypes: true },
  );

  const sourceFiles = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        SOURCE_EXTENSIONS.has(
          path.extname(entry.name).toLowerCase(),
        ),
    )
    .map((entry) => entry.name)
    .sort();

  if (sourceFiles.length === 0) {
    console.log('No PNG/JPG cuisine images found.');
    return;
  }

  console.log(
    `\nOptimizing ${sourceFiles.length} cuisine images...`,
  );
  console.log(`Max dimensions: ${MAX_SIZE}x${MAX_SIZE}`);
  console.log(`WebP quality: ${WEBP_QUALITY}\n`);

  let totalBefore = 0;
  let totalAfter = 0;

  for (const fileName of sourceFiles) {
    const result = await optimizeFile(fileName);

    if (!result) {
      continue;
    }

    totalBefore += result.beforeBytes;
    totalAfter += result.afterBytes;

    const saving =
      result.beforeBytes > 0
        ? (
            100 -
            (result.afterBytes / result.beforeBytes) * 100
          ).toFixed(1)
        : '0.0';

    console.log(result.fileName);
    console.log(
      `  ${formatBytes(result.beforeBytes)} -> ${formatBytes(result.afterBytes)}  (${saving}% smaller)`,
    );
  }

  const totalSaving =
    totalBefore > 0
      ? (
          100 -
          (totalAfter / totalBefore) * 100
        ).toFixed(1)
      : '0.0';

  console.log('\nDone.');
  console.log(
    `Total: ${formatBytes(totalBefore)} -> ${formatBytes(totalAfter)}`,
  );
  console.log(`Saved: ${totalSaving}%`);
  console.log(
    '\nOriginal PNG/JPG files were NOT deleted.',
  );
  console.log(
    'The optimized .webp files are beside them in src/assets/cuisines.',
  );
}

main().catch((error) => {
  console.error('\nCuisine image optimization failed.');
  console.error(error);
  process.exitCode = 1;
});

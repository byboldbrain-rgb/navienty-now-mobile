import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();

const SOURCE_EXTENSIONS =
  new Set([
    '.png',
    '.jpg',
    '.jpeg',
  ]);

const CODE_EXTENSIONS =
  new Set([
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
  ]);

const TEXT_ROOTS = [
  path.join(ROOT, 'src'),
];

const ASSET_ROOTS = [
  path.join(ROOT, 'assets'),
  path.join(
    ROOT,
    'src',
    'assets',
  ),
];

const NATIVE_ASSET_NAMES =
  new Set([
    'icon.png',
    'splash-icon.png',
    'native-splash-transparent.png',
    'navienty-now-splash.png',
    'favicon.png',
    'android-icon-background.png',
    'android-icon-foreground.png',
    'android-icon-monochrome.png',
  ]);

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function walk(directory) {
  const result = [];

  if (!(await exists(directory))) {
    return result;
  }

  const entries =
    await fs.readdir(
      directory,
      {
        withFileTypes: true,
      },
    );

  for (const entry of entries) {
    const fullPath =
      path.join(
        directory,
        entry.name,
      );

    if (entry.isDirectory()) {
      result.push(
        ...(await walk(fullPath)),
      );
      continue;
    }

    if (entry.isFile()) {
      result.push(fullPath);
    }
  }

  return result;
}

function normalizePath(filePath) {
  return filePath.replaceAll(
    path.sep,
    '/',
  );
}

function isOptimizableAsset(
  filePath,
) {
  const extension =
    path
      .extname(filePath)
      .toLowerCase();

  if (
    !SOURCE_EXTENSIONS.has(
      extension,
    )
  ) {
    return false;
  }

  const relative =
    normalizePath(
      path.relative(
        ROOT,
        filePath,
      ),
    );

  const baseName =
    path.basename(filePath);

  if (
    NATIVE_ASSET_NAMES.has(
      baseName,
    )
  ) {
    return false;
  }

  if (
    relative.startsWith(
      'assets/expo.icon/',
    )
  ) {
    return false;
  }

  return (
    relative.includes(
      '/categories/',
    ) ||
    relative.includes(
      '-categories/',
    ) ||
    relative.includes(
      '/subcategories/',
    ) ||
    relative.includes(
      '-subcategories/',
    ) ||
    relative.includes(
      '/cuisines/',
    ) ||
    relative.startsWith(
      'assets/payment-methods/',
    )
  );
}

function getProfile(
  filePath,
) {
  const relative =
    normalizePath(
      path.relative(
        ROOT,
        filePath,
      ),
    );

  if (
    relative.startsWith(
      'assets/payment-methods/',
    )
  ) {
    return {
      maxSize: 320,
      quality: 88,
    };
  }

  return {
    maxSize: 320,
    quality: 82,
  };
}

async function getSharp() {
  try {
    const imported =
      await import('sharp');

    return imported.default;
  } catch {
    console.error(
      '\nThe image optimizer requires sharp.',
    );
    console.error(
      'Install it once with:',
    );
    console.error(
      '  npm install --save-dev sharp',
    );

    process.exitCode = 1;
    return null;
  }
}

async function updateReferences(
  replacements,
) {
  const textFiles = (
    await Promise.all(
      TEXT_ROOTS.map(walk),
    )
  )
    .flat()
    .filter((filePath) =>
      CODE_EXTENSIONS.has(
        path
          .extname(filePath)
          .toLowerCase(),
      ),
    );

  let changedFiles = 0;
  let changedReferences = 0;

  for (
    const filePath of textFiles
  ) {
    const original =
      await fs.readFile(
        filePath,
        'utf8',
      );

    let next = original;

    for (
      const replacement of
        replacements
    ) {
      for (
        const [
          sourceNeedle,
          outputNeedle,
        ] of replacement.needles
      ) {
        if (
          !next.includes(
            sourceNeedle,
          )
        ) {
          continue;
        }

        const occurrences =
          next.split(
            sourceNeedle,
          ).length - 1;

        next =
          next.split(
            sourceNeedle,
          ).join(
            outputNeedle,
          );

        changedReferences +=
          occurrences;
      }
    }

    if (next === original) {
      continue;
    }

    await fs.writeFile(
      filePath,
      next,
      'utf8',
    );

    changedFiles += 1;
  }

  return {
    changedFiles,
    changedReferences,
  };
}

async function main() {
  const sharp =
    await getSharp();

  if (!sharp) {
    return;
  }

  const allAssetFiles = (
    await Promise.all(
      ASSET_ROOTS.map(walk),
    )
  ).flat();

  const sourceFiles =
    allAssetFiles
      .filter(
        isOptimizableAsset,
      )
      .sort();

  if (
    sourceFiles.length === 0
  ) {
    console.log(
      'No optimizable local image assets found.',
    );
    return;
  }

  console.log(
    `\nOptimizing ${sourceFiles.length} local image assets...`,
  );
  console.log(
    'Original files are preserved.',
  );
  console.log(
    'Only generated WebP files that are smaller are adopted.\n',
  );

  const replacements = [];

  let totalBefore = 0;
  let totalAfter = 0;
  let converted = 0;
  let skipped = 0;

  for (
    const sourcePath of
      sourceFiles
  ) {
    const extension =
      path
        .extname(sourcePath)
        .toLowerCase();

    const outputPath =
      sourcePath.slice(
        0,
        -extension.length,
      ) + '.webp';

    const {
      maxSize,
      quality,
    } = getProfile(
      sourcePath,
    );

    const before =
      await fs.stat(
        sourcePath,
      );

    const sourceMetadata =
      await sharp(
        sourcePath,
      ).metadata();

    await sharp(
      sourcePath,
    )
      .rotate()
      .resize({
        width: maxSize,
        height: maxSize,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({
        quality,
        effort: 5,
        smartSubsample: true,
      })
      .toFile(
        outputPath,
      );

    const after =
      await fs.stat(
        outputPath,
      );

    const wasResized =
      (
        sourceMetadata.width ??
        0
      ) > maxSize ||
      (
        sourceMetadata.height ??
        0
      ) > maxSize;

    const worthUsing =
      after.size <
        before.size * 0.98 ||
      wasResized;

    if (!worthUsing) {
      await fs.rm(
        outputPath,
        {
          force: true,
        },
      );

      skipped += 1;
      continue;
    }

    converted += 1;
    totalBefore +=
      before.size;
    totalAfter +=
      after.size;

    const sourceRelative =
      normalizePath(
        path.relative(
          ROOT,
          sourcePath,
        ),
      );

    const outputRelative =
      normalizePath(
        path.relative(
          ROOT,
          outputPath,
        ),
      );

    const needles = [
      [
        sourceRelative,
        outputRelative,
      ],
    ];

    if (
      sourceRelative.startsWith(
        'src/',
      )
    ) {
      needles.push([
        sourceRelative.slice(
          'src/'.length,
        ),
        outputRelative.slice(
          'src/'.length,
        ),
      ]);
    }

    replacements.push({
      sourceRelative,
      outputRelative,
      needles,
    });

    const saving =
      before.size > 0
        ? (
            100 -
            (
              after.size /
              before.size
            ) *
              100
          ).toFixed(1)
        : '0.0';

    console.log(
      `${sourceRelative}`,
    );
    console.log(
      `  ${formatBytes(before.size)} -> ${formatBytes(after.size)} (${saving}% smaller)`,
    );
  }

  const referenceResult =
    await updateReferences(
      replacements,
    );

  const totalSaving =
    totalBefore > 0
      ? (
          100 -
          (
            totalAfter /
            totalBefore
          ) *
            100
        ).toFixed(1)
      : '0.0';

  console.log(
    '\nOptimization complete.',
  );
  console.log(
    `Converted: ${converted}`,
  );
  console.log(
    `Skipped:   ${skipped}`,
  );
  console.log(
    `Rewritten source files: ${referenceResult.changedFiles}`,
  );
  console.log(
    `Rewritten image references: ${referenceResult.changedReferences}`,
  );

  if (
    converted > 0
  ) {
    console.log(
      `Selected assets: ${formatBytes(totalBefore)} -> ${formatBytes(totalAfter)}`,
    );
    console.log(
      `Saved: ${totalSaving}%`,
    );
  }

  console.log(
    '\nOriginal PNG/JPG files were NOT deleted.',
  );
  console.log(
    'After verifying the app, they can be removed in a separate cleanup commit.',
  );
}

main().catch((error) => {
  console.error(
    '\nLocal image optimization failed.',
  );
  console.error(error);
  process.exitCode = 1;
});

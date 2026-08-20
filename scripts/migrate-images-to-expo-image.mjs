import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const APP_IMAGE_PATH = path.join(
  SRC_DIR,
  'components',
  'ui',
  'app-image',
);

const SOURCE_EXTENSIONS = new Set([
  '.tsx',
  '.jsx',
]);

const REACT_NATIVE_IMPORT =
  /import\s*{([\s\S]*?)}\s*from\s*['"]react-native['"];/g;

async function walk(directory) {
  const entries = await fs.readdir(
    directory,
    { withFileTypes: true },
  );

  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(
      directory,
      entry.name,
    );

    if (entry.isDirectory()) {
      files.push(
        ...(await walk(fullPath)),
      );
      continue;
    }

    if (
      entry.isFile() &&
      SOURCE_EXTENSIONS.has(
        path
          .extname(entry.name)
          .toLowerCase(),
      )
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function getAppImageImportPath(
  filePath,
) {
  let relative = path
    .relative(
      path.dirname(filePath),
      APP_IMAGE_PATH,
    )
    .replaceAll(path.sep, '/');

  if (!relative.startsWith('.')) {
    relative = `./${relative}`;
  }

  return relative;
}

function removeReactNativeImageImport(
  source,
) {
  let foundImageImport = false;

  const nextSource = source.replace(
    REACT_NATIVE_IMPORT,
    (fullMatch, specifierBlock) => {
      const specifiers = String(
        specifierBlock,
      )
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      if (!specifiers.includes('Image')) {
        return fullMatch;
      }

      foundImageImport = true;

      const remaining =
        specifiers.filter(
          (item) => item !== 'Image',
        );

      if (remaining.length === 0) {
        return '';
      }

      return [
        'import {',
        ...remaining.map(
          (item) => `  ${item},`,
        ),
        "} from 'react-native';",
      ].join('\n');
    },
  );

  return {
    foundImageImport,
    source: nextSource,
  };
}

function containsUnsupportedStaticImageUse(
  source,
) {
  return /\bImage\s*\./.test(
    source,
  );
}

async function migrateFile(filePath) {
  const original = await fs.readFile(
    filePath,
    'utf8',
  );

  if (
    !original.includes(
      "from 'react-native'",
    ) &&
    !original.includes(
      'from "react-native"',
    )
  ) {
    return {
      changed: false,
      skipped: false,
    };
  }

  if (!/<Image\b/.test(original)) {
    return {
      changed: false,
      skipped: false,
    };
  }

  if (
    containsUnsupportedStaticImageUse(
      original,
    )
  ) {
    console.log(
      `SKIP static Image API: ${path.relative(ROOT, filePath)}`,
    );

    return {
      changed: false,
      skipped: true,
    };
  }

  const importResult =
    removeReactNativeImageImport(
      original,
    );

  if (!importResult.foundImageImport) {
    return {
      changed: false,
      skipped: false,
    };
  }

  let next = importResult.source
    .replace(/<Image\b/g, '<AppImage')
    .replace(/<\/Image>/g, '</AppImage>');

  if (
    !/import\s+AppImage\s+from\s+['"][^'"]+['"]/.test(
      next,
    )
  ) {
    const importPath =
      getAppImageImportPath(
        filePath,
      );

    next =
      `import AppImage from '${importPath}';\n` +
      next;
  }

  if (next === original) {
    return {
      changed: false,
      skipped: false,
    };
  }

  await fs.writeFile(
    filePath,
    next,
    'utf8',
  );

  console.log(
    `MIGRATED ${path.relative(ROOT, filePath)}`,
  );

  return {
    changed: true,
    skipped: false,
  };
}

async function main() {
  const files = await walk(
    SRC_DIR,
  );

  let changedFiles = 0;
  let skippedFiles = 0;

  for (const filePath of files) {
    if (
      path.normalize(filePath) ===
      path.normalize(
        `${APP_IMAGE_PATH}.tsx`,
      )
    ) {
      continue;
    }

    const result =
      await migrateFile(filePath);

    if (result.changed) {
      changedFiles += 1;
    }

    if (result.skipped) {
      skippedFiles += 1;
    }
  }

  console.log('\nExpo Image migration complete.');
  console.log(
    `Changed files: ${changedFiles}`,
  );
  console.log(
    `Skipped static Image API files: ${skippedFiles}`,
  );
  console.log(
    'Remote HTTP images now use AppImage with memory-disk caching.',
  );
}

main().catch((error) => {
  console.error(
    '\nExpo Image migration failed.',
  );
  console.error(error);
  process.exitCode = 1;
});

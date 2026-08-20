import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';

const ROOT = process.cwd();

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.avif',
]);

const ROOTS = [
  path.join(ROOT, 'assets'),
  path.join(ROOT, 'src', 'assets'),
];

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

  const entries = await fs.readdir(
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

    if (!entry.isFile()) {
      continue;
    }

    const extension =
      path
        .extname(entry.name)
        .toLowerCase();

    if (
      IMAGE_EXTENSIONS.has(
        extension,
      )
    ) {
      result.push(fullPath);
    }
  }

  return result;
}

async function getSharp() {
  try {
    const imported =
      await import('sharp');

    return imported.default;
  } catch {
    return null;
  }
}

async function getHash(filePath) {
  const buffer =
    await fs.readFile(filePath);

  return crypto
    .createHash('sha1')
    .update(buffer)
    .digest('hex');
}

async function main() {
  const sharp =
    await getSharp();

  const files = (
    await Promise.all(
      ROOTS.map(walk),
    )
  )
    .flat()
    .filter(
      (
        filePath,
        index,
        all,
      ) =>
        all.indexOf(filePath) ===
        index,
    );

  const rows = [];

  for (const filePath of files) {
    const stat =
      await fs.stat(filePath);

    let metadata = null;

    if (sharp) {
      try {
        metadata =
          await sharp(
            filePath,
          ).metadata();
      } catch {
        metadata = null;
      }
    }

    rows.push({
      path: path
        .relative(
          ROOT,
          filePath,
        )
        .replaceAll(
          path.sep,
          '/',
        ),
      extension:
        path
          .extname(filePath)
          .toLowerCase(),
      sizeBytes: stat.size,
      width:
        metadata?.width ??
        null,
      height:
        metadata?.height ??
        null,
      format:
        metadata?.format ??
        null,
      hash:
        await getHash(
          filePath,
        ),
    });
  }

  rows.sort(
    (a, b) =>
      b.sizeBytes -
      a.sizeBytes,
  );

  const totalBytes =
    rows.reduce(
      (sum, row) =>
        sum + row.sizeBytes,
      0,
    );

  const byExtension =
    new Map();

  for (const row of rows) {
    const current =
      byExtension.get(
        row.extension,
      ) ?? {
        count: 0,
        bytes: 0,
      };

    current.count += 1;
    current.bytes +=
      row.sizeBytes;

    byExtension.set(
      row.extension,
      current,
    );
  }

  const byHash =
    new Map();

  for (const row of rows) {
    const current =
      byHash.get(row.hash) ??
      [];

    current.push(row);

    byHash.set(
      row.hash,
      current,
    );
  }

  const duplicateGroups =
    Array.from(
      byHash.values(),
    )
      .filter(
        (group) =>
          group.length > 1,
      )
      .sort(
        (a, b) =>
          (
            b[0].sizeBytes *
            (b.length - 1)
          ) -
          (
            a[0].sizeBytes *
            (a.length - 1)
          ),
      );

  const duplicateBytes =
    duplicateGroups.reduce(
      (sum, group) =>
        sum +
        group[0].sizeBytes *
          (group.length - 1),
      0,
    );

  console.log(
    '\nNavienty Now image audit',
  );
  console.log(
    '========================',
  );
  console.log(
    `Images: ${rows.length}`,
  );
  console.log(
    `Total:  ${formatBytes(totalBytes)}`,
  );
  console.log(
    `Duplicate bytes: ${formatBytes(duplicateBytes)}`,
  );
  console.log(
    `Sharp metadata: ${sharp ? 'enabled' : 'not installed (size audit still complete)'}`,
  );

  console.log(
    '\nBy extension',
  );
  console.log(
    '------------',
  );

  for (
    const [
      extension,
      summary,
    ] of Array.from(
      byExtension.entries(),
    ).sort(
      (a, b) =>
        b[1].bytes -
        a[1].bytes,
    )
  ) {
    console.log(
      `${extension.padEnd(7)} ${String(summary.count).padStart(4)}  ${formatBytes(summary.bytes)}`,
    );
  }

  console.log(
    '\nLargest 40 images',
  );
  console.log(
    '-----------------',
  );

  for (
    const row of rows.slice(
      0,
      40,
    )
  ) {
    const dimensions =
      row.width &&
      row.height
        ? `  ${row.width}x${row.height}`
        : '';

    console.log(
      `${formatBytes(row.sizeBytes).padStart(10)}${dimensions.padEnd(14)}  ${row.path}`,
    );
  }

  if (
    duplicateGroups.length >
    0
  ) {
    console.log(
      '\nLargest duplicate groups',
    );
    console.log(
      '------------------------',
    );

    for (
      const group of
        duplicateGroups.slice(
          0,
          15,
        )
    ) {
      console.log(
        `\n${formatBytes(group[0].sizeBytes)} × ${group.length}`,
      );

      for (
        const row of group
      ) {
        console.log(
          `  ${row.path}`,
        );
      }
    }
  }

  const report = {
    generatedAt:
      new Date().toISOString(),
    imageCount: rows.length,
    totalBytes,
    duplicateBytes,
    sharpMetadataAvailable:
      Boolean(sharp),
    byExtension:
      Object.fromEntries(
        byExtension,
      ),
    largestImages:
      rows.slice(0, 100),
    duplicateGroups:
      duplicateGroups.map(
        (group) => ({
          sizeBytes:
            group[0].sizeBytes,
          paths:
            group.map(
              (row) => row.path,
            ),
        }),
      ),
  };

  await fs.writeFile(
    path.join(
      ROOT,
      '.image-audit.json',
    ),
    `${JSON.stringify(
      report,
      null,
      2,
    )}\n`,
    'utf8',
  );

  console.log(
    '\nWrote .image-audit.json',
  );
}

main().catch((error) => {
  console.error(
    '\nImage audit failed.',
  );
  console.error(error);
  process.exitCode = 1;
});

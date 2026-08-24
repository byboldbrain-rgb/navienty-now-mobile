import {
  access,
  readdir,
  readFile,
} from 'node:fs/promises';
import path from 'node:path';

const removedFeaturePaths = [
  'src/app/category/pharmacy.tsx',
  'src/app/pharmacy-category/[slug].tsx',
  'src/services/pharmacy-banner-service.ts',
  'src/services/prescription-service.ts',
  'src/data/stores.ts',
];

const activeSourceMarkers = [
  'pharmacy',
  'pharmacies',
  'prescription',
  'medicine',
  'medicines',
  'صيدل',
  'روشت',
  'دواء',
  'أدوية',
];

const sourceExtensions = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.ts',
  '.tsx',
]);

const scopeGuardPath =
  'src/config/v1-release-scope.ts';

const backendScopeMigrationPath =
  'supabase/migrations/20260824194322_disable_removed_v1_scope.sql';

const requiredGuards = new Map([
  [
    'src/services/bootstrap-service.ts',
    'isV1PublicCategorySlug',
  ],
  [
    'src/services/catalog-service.ts',
    'isV1PublicCategorySlug',
  ],
  [
    'src/services/home-banners-service.ts',
    'isV1PublicPromotion',
  ],
  [
    'src/services/promo-action-service.ts',
    'isV1PublicPromotion',
  ],
  [
    'src/store/cart-store.ts',
    'isV1PublicCategorySlug',
  ],
  [
    'src/app/category/[id].tsx',
    'isV1PublicCategorySlug',
  ],
  [
    'src/app/checkout.tsx',
    'isV1PublicCategorySlug',
  ],
]);

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listSourceFiles(
  directory,
) {
  const entries = await readdir(
    directory,
    {
      withFileTypes: true,
    },
  );

  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(
      directory,
      entry.name,
    );

    if (entry.isDirectory()) {
      files.push(
        ...(await listSourceFiles(
          entryPath,
        )),
      );
      continue;
    }

    if (
      entry.isFile() &&
      sourceExtensions.has(
        path.extname(entry.name),
      )
    ) {
      files.push(entryPath);
    }
  }

  return files;
}

const failures = [];

for (const removedPath of removedFeaturePaths) {
  if (await exists(removedPath)) {
    failures.push(
      `removed v1 feature path still exists: ${removedPath}`,
    );
  }
}

const sourceFiles = await listSourceFiles(
  'src',
);

for (const sourceFile of sourceFiles) {
  if (sourceFile === scopeGuardPath) {
    continue;
  }

  const source = (
    await readFile(sourceFile, 'utf8')
  ).toLowerCase();

  for (const marker of activeSourceMarkers) {
    if (source.includes(marker)) {
      failures.push(
        `active source contains removed v1 marker "${marker}": ${sourceFile}`,
      );
    }
  }
}

for (
  const [guardedFile, requiredGuard] of
  requiredGuards
) {
  const source = await readFile(
    guardedFile,
    'utf8',
  );

  if (!source.includes(requiredGuard)) {
    failures.push(
      `${guardedFile} is missing ${requiredGuard}`,
    );
  }
}

const categoryIcons = await readFile(
  'src/config/category-icons.ts',
  'utf8',
);

if (
  categoryIcons.includes(
    'pharmacy.webp',
  )
) {
  failures.push(
    'the removed category icon is still imported by the public client',
  );
}

const backendScopeMigration =
  await readFile(
    backendScopeMigrationPath,
    'utf8',
  );

for (const requiredStatement of [
  'update now.store_categories',
  'update now.stores',
  'update now.products',
  'update now.home_banners',
  'revoke execute on function now.create_prescription_submission',
  'drop policy if exists customer_insert_own_prescription',
]) {
  if (
    !backendScopeMigration.includes(
      requiredStatement,
    )
  ) {
    failures.push(
      `${backendScopeMigrationPath} is missing: ${requiredStatement}`,
    );
  }
}

if (failures.length > 0) {
  console.error(
    'v1 public-scope validation failed:',
  );

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log(
  'v1 public-scope validation passed.',
);

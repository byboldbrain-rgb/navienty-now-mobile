import { publicSupabase } from '../lib/supabase';

export type StorefrontCategorySurface =
  | 'home'
  | 'supermarket'
  | 'bookstore'
  | 'personal-care';

export type StorefrontCategoryTileKind =
  | 'catalog'
  | 'virtual'
  | 'merged'
  | 'offers';

export type StorefrontCategoryTile = {
  id: string;
  surface: StorefrontCategorySurface;

  key: string;

  labelAr: string;
  labelEn: string | null;

  kind: StorefrontCategoryTileKind;

  routeSlug: string;

  sourceSlugs: string[];

  imageUrl: string | null;

  sortOrder: number;
};

type RawStorefrontCategoryTile = {
  id: string;
  surface: StorefrontCategorySurface;

  key: string;

  label_ar: string;
  label_en: string | null;

  kind: StorefrontCategoryTileKind;

  route_slug: string;

  source_slugs: string[] | null;

  image_url: string | null;

  sort_order: number | string | null;
};

function toSortOrder(
  value: number | string | null,
) {
  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function normalizeStorefrontIdentifier(
  value: string | null | undefined,
): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function isStorefrontCategorySurface(
  value: unknown,
): value is StorefrontCategorySurface {
  return (
    value === 'home' ||
    value === 'supermarket' ||
    value === 'bookstore' ||
    value === 'personal-care'
  );
}

function isStorefrontCategoryTileKind(
  value: unknown,
): value is StorefrontCategoryTileKind {
  return (
    value === 'catalog' ||
    value === 'virtual' ||
    value === 'merged' ||
    value === 'offers'
  );
}

function isRawStorefrontCategoryTile(
  value: unknown,
): value is RawStorefrontCategoryTile {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return false;
  }

  const row = value as Record<
    string,
    unknown
  >;

  return (
    typeof row.id === 'string' &&
    isStorefrontCategorySurface(
      row.surface,
    ) &&
    typeof row.key === 'string' &&
    typeof row.label_ar === 'string' &&
    (
      row.label_en === null ||
      typeof row.label_en === 'string'
    ) &&
    isStorefrontCategoryTileKind(
      row.kind,
    ) &&
    typeof row.route_slug === 'string' &&
    (
      row.source_slugs === null ||
      Array.isArray(row.source_slugs)
    ) &&
    (
      row.image_url === null ||
      typeof row.image_url === 'string'
    ) &&
    (
      row.sort_order === null ||
      typeof row.sort_order === 'number' ||
      typeof row.sort_order === 'string'
    )
  );
}

function mapStorefrontCategoryTile(
  row: RawStorefrontCategoryTile,
): StorefrontCategoryTile {
  return {
    id: row.id,
    surface: row.surface,

    key: row.key,

    labelAr: row.label_ar,
    labelEn: row.label_en,

    kind: row.kind,

    routeSlug: row.route_slug,

    sourceSlugs:
      Array.isArray(row.source_slugs)
        ? row.source_slugs
            .filter(
              (slug): slug is string =>
                typeof slug === 'string',
            )
            .map((slug) => slug.trim())
            .filter(Boolean)
        : [],

    imageUrl:
      row.image_url?.trim() ||
      null,

    sortOrder:
      toSortOrder(row.sort_order),
  };
}

/**
 * Resolve one configured tile from the identifiers already exposed by the
 * storefront-category contract. Matching is deliberately limited to key,
 * routeSlug and sourceSlugs so this helper does not depend on hidden backend
 * fields or on presentation labels.
 */
export function findStorefrontCategoryTile(
  tiles: readonly StorefrontCategoryTile[],
  aliases: readonly string[],
): StorefrontCategoryTile | null {
  const normalizedAliases =
    new Set(
      aliases
        .map(
          normalizeStorefrontIdentifier,
        )
        .filter(Boolean),
    );

  if (normalizedAliases.size === 0) {
    return null;
  }

  return (
    tiles.find((tile) => {
      const identifiers = [
        tile.key,
        tile.routeSlug,
        ...tile.sourceSlugs,
      ];

      return identifiers.some(
        (identifier) =>
          normalizedAliases.has(
            normalizeStorefrontIdentifier(
              identifier,
            ),
          ),
      );
    }) ?? null
  );
}

/**
 * The verified storefront_category_tiles contract currently exposes only one
 * primary image URL. Deep-category image maps are not part of the selected
 * schema, so callers must keep using their bundled image fallbacks until the
 * backend contract explicitly provides those maps.
 */
export function getStorefrontTileCategoryImages(
  _tile: StorefrontCategoryTile | null | undefined,
): Record<string, string> {
  return {};
}

/**
 * Screen-specific artwork uses the same compatibility behavior as category
 * images. Returning an empty map preserves the existing bundled hero/detail
 * artwork instead of guessing database columns that are not in this service.
 */
export function getStorefrontTileScreenImages(
  _tile: StorefrontCategoryTile | null | undefined,
): Record<string, string> {
  return {};
}

/**
 * Remote category tiles for Home and the three catalog landing screens.
 *
 * Important:
 * - An empty array is a valid configuration. It means the admin intentionally
 *   hid every tile for that surface.
 * - Errors are thrown so each screen can fall back to its bundled definitions
 *   instead of breaking the storefront.
 */
export async function listStorefrontCategoryTiles(
  surface: StorefrontCategorySurface,
): Promise<StorefrontCategoryTile[]> {
  const {
    data,
    error,
  } = await publicSupabase
    .from('storefront_category_tiles')
    .select(
      [
        'id',
        'surface',
        'key',
        'label_ar',
        'label_en',
        'kind',
        'route_slug',
        'source_slugs',
        'image_url',
        'sort_order',
      ].join(','),
    )
    .eq('surface', surface)
    .eq('is_active', true)
    .order(
      'sort_order',
      {
        ascending: true,
      },
    )
    .order(
      'created_at',
      {
        ascending: true,
      },
    );

  if (error) {
    throw new Error(
      `Loading storefront categories failed: ${error.message}`,
    );
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return (data as unknown[])
    .filter(
      isRawStorefrontCategoryTile,
    )
    .map(
      mapStorefrontCategoryTile,
    );
}

export default listStorefrontCategoryTiles;

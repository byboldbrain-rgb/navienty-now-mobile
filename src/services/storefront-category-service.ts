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

  return (
    data as RawStorefrontCategoryTile[]
  ).map(
    mapStorefrontCategoryTile,
  );
}

export default listStorefrontCategoryTiles;

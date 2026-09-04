import { publicSupabase } from '../lib/supabase';
import {
  recordStartupTimingOnce,
} from './startup-performance-service';

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

export type StorefrontCategoryTileMetadata =
  Record<string, unknown>;

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

  metadata: StorefrontCategoryTileMetadata;

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

  metadata: unknown;

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

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

function normalizeMetadata(
  value: unknown,
): StorefrontCategoryTileMetadata {
  return isRecord(value)
    ? value
    : {};
}

function getRemoteImageMap(
  value: unknown,
): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  const images: Record<string, string> = {};

  for (const [key, rawValue] of
    Object.entries(value)) {
    if (typeof rawValue !== 'string') {
      continue;
    }

    const normalizedKey = key.trim();
    const normalizedUrl = rawValue.trim();

    if (
      !normalizedKey ||
      !/^https?:\/\//i.test(normalizedUrl)
    ) {
      continue;
    }

    images[normalizedKey] =
      normalizedUrl;
  }

  return images;
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
      row.metadata === null ||
      row.metadata === undefined ||
      isRecord(row.metadata)
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

    metadata:
      normalizeMetadata(row.metadata),

    sortOrder:
      toSortOrder(row.sort_order),
  };
}

/**
 * Resolve one configured tile from the identifiers already exposed by the
 * storefront-category contract. Matching is deliberately limited to key,
 * routeSlug and sourceSlugs so this helper does not depend on presentation
 * labels or private backend fields.
 */
export function findStorefrontCategoryTile(
  tiles: readonly StorefrontCategoryTile[],
  aliases: readonly (
    | string
    | null
    | undefined
  )[],
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
 * Optional deep-category artwork contract.
 *
 * Admins can set:
 * metadata.category_images = {
 *   "category-or-subcategory-key": "https://..."
 * }
 *
 * Only http(s) URLs are accepted. Invalid values are ignored, preserving the
 * existing bundled image fallback in every caller.
 */
export function getStorefrontTileCategoryImages(
  tile: StorefrontCategoryTile | null | undefined,
): Record<string, string> {
  return getRemoteImageMap(
    tile?.metadata?.category_images,
  );
}

/**
 * Optional screen-specific artwork contract.
 *
 * Admins can set:
 * metadata.screen_images = {
 *   "hero": "https://...",
 *   "detail_02": "https://..."
 * }
 *
 * Callers already use bundled images as fallbacks, so an empty or malformed
 * configuration cannot remove the current artwork.
 */
export function getStorefrontTileScreenImages(
  tile: StorefrontCategoryTile | null | undefined,
): Record<string, string> {
  return getRemoteImageMap(
    tile?.metadata?.screen_images,
  );
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
  const startedAt = Date.now();
  const shouldMeasureHome =
    surface === 'home';

  if (shouldMeasureHome) {
    recordStartupTimingOnce(
      'home-category-tiles-started',
      0,
    );
  }

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
        'metadata',
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
    if (shouldMeasureHome) {
      recordStartupTimingOnce(
        'home-category-tiles-total',
        Date.now() - startedAt,
        {
          outcome: 'error',
          tileCount: 0,
        },
      );
    }

    throw new Error(
      `Loading storefront categories failed: ${error.message}`,
    );
  }

  if (!Array.isArray(data)) {
    if (shouldMeasureHome) {
      recordStartupTimingOnce(
        'home-category-tiles-total',
        Date.now() - startedAt,
        {
          outcome: 'success',
          tileCount: 0,
        },
      );
    }

    return [];
  }

  const tiles = (data as unknown[])
    .filter(
      isRawStorefrontCategoryTile,
    )
    .map(
      mapStorefrontCategoryTile,
    );

  if (shouldMeasureHome) {
    recordStartupTimingOnce(
      'home-category-tiles-total',
      Date.now() - startedAt,
      {
        outcome: 'success',
        tileCount: tiles.length,
      },
    );
  }

  return tiles;
}

export default listStorefrontCategoryTiles;

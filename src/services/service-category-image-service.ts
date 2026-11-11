import { publicSupabase } from '../lib/supabase';

/**
 * Multiple images can belong to the same service category.
 *
 * A placement identifies the screen (home, login, category/supermarket, ...),
 * while a slot identifies a particular artwork position on that screen.
 * The first active image by sort_order is used for single-image cards.
 */
export type ServiceCategoryImage = {
  id: string;
  categoryKey: string;
  placement: string;
  slot: string;
  imageUrl: string;
  sortOrder: number;
};

type RawServiceCategoryImage = {
  id: string;
  category_key: string;
  placement: string;
  slot: string;
  image_url: string;
  sort_order: number | string | null;
};

type CachedImages = {
  images: ServiceCategoryImage[];
  expiresAt: number;
};

const CACHE_TTL_MS = 30_000;

const cache = new Map<string, CachedImages>();
const inFlight = new Map<
  string,
  Promise<ServiceCategoryImage[]>
>();

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');
}

export function canonicalServiceCategoryKey(value: string): string {
  const key = normalize(value);

  if (['restaurant', 'restaurants', 'food'].includes(key)) {
    return 'restaurants';
  }
  if (['supermarket', 'supermarkets', 'market', 'grocery'].includes(key)) {
    return 'supermarket';
  }
  if (['bookstore', 'bookstores', 'book-store', 'library', 'books', 'stationery'].includes(key)) {
    return 'bookstore';
  }
  if (['personal-care', 'personalcare', 'beauty', 'beauty-care', 'health-beauty', 'care'].includes(key)) {
    return 'personal-care';
  }
  if (['request-anything', 'anything', 'special-request', 'other'].includes(key)) {
    return 'request-anything';
  }

  return key;
}

function isImageUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^https?:\/\/\S+$/i.test(value.trim())
  );
}

export function getCachedServiceCategoryImages(
  placement: string,
): ServiceCategoryImage[] | null {
  const cached = cache.get(normalize(placement));

  if (!cached || cached.expiresAt <= Date.now()) {
    return null;
  }

  return cached.images;
}

/**
 * Non-blocking public lookup for the named screen and its default fallback.
 * Only active records are readable under the corresponding database RLS
 * policy. Failed requests are never cached.
 */
export async function listServiceCategoryImages(
  placement: string,
): Promise<ServiceCategoryImage[]> {
  const normalizedPlacement = normalize(placement);
  const cached = getCachedServiceCategoryImages(normalizedPlacement);

  if (cached) {
    return cached;
  }

  const existing = inFlight.get(normalizedPlacement);

  if (existing) {
    return existing;
  }

  const request = (async () => {
    const placements = Array.from(
      new Set(['default', normalizedPlacement]),
    );

    const { data, error } = await publicSupabase
      .from('service_category_images')
      .select('id,category_key,placement,slot,image_url,sort_order')
      .in('placement', placements)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      throw error;
    }

    const images: ServiceCategoryImage[] = (
      Array.isArray(data) ? data : []
    ).flatMap((row): ServiceCategoryImage[] => {
      const item = row as RawServiceCategoryImage;

      if (
        !item ||
        typeof item.id !== 'string' ||
        typeof item.category_key !== 'string' ||
        typeof item.placement !== 'string' ||
        typeof item.slot !== 'string' ||
        !isImageUrl(item.image_url)
      ) {
        return [];
      }

      const parsedOrder = Number(item.sort_order);

      return [{
        id: item.id,
        categoryKey: canonicalServiceCategoryKey(item.category_key),
        placement: normalize(item.placement),
        slot: normalize(item.slot),
        imageUrl: item.image_url.trim(),
        sortOrder: Number.isFinite(parsedOrder) ? parsedOrder : 0,
      }];
    });

    cache.set(normalizedPlacement, {
      images,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return images;
  })();

  inFlight.set(normalizedPlacement, request);

  try {
    return await request;
  } finally {
    if (inFlight.get(normalizedPlacement) === request) {
      inFlight.delete(normalizedPlacement);
    }
  }
}

/**
 * Returns all images for a category on a given screen/slot, in display order.
 * Screen-specific images win over the generic "default" set. Consumers can
 * use the first URL for a tile, or the whole array for a carousel.
 */
export function getServiceCategoryImageUrls(
  images: readonly ServiceCategoryImage[],
  categoryKey: string,
  placement: string,
  slot = 'primary',
): string[] {
  const canonicalKey = canonicalServiceCategoryKey(categoryKey);
  const normalizedPlacement = normalize(placement);
  const normalizedSlot = normalize(slot);

  const matches = (screen: string) =>
    images
      .filter((item) =>
        item.categoryKey === canonicalKey &&
        item.placement === screen &&
        item.slot === normalizedSlot
      )
      .sort((a, b) =>
        a.sortOrder - b.sortOrder ||
        a.id.localeCompare(b.id)
      )
      .map((item) => item.imageUrl);

  const specific = matches(normalizedPlacement);

  return specific.length > 0 ? specific : matches('default');
}

export function getServiceCategoryImageUrl(
  images: readonly ServiceCategoryImage[],
  categoryKey: string,
  placement: string,
  slot = 'primary',
): string | null {
  return getServiceCategoryImageUrls(
    images,
    categoryKey,
    placement,
    slot,
  )[0] ?? null;
}

import type { StoreSummary } from '../../services/catalog-service';
import type { Order } from '../../store/orders-store';

/** Destination of a service-style repeat-order card (or null for normal stores). */
export type RecentOrderCategory =
  | 'supermarket'
  | 'bookstore'
  | 'personal-care'
  | 'request-anything'
  | null;

type RepeatOrderStore = Pick<StoreSummary, 'name' | 'categorySlug'>;

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[_\s]+/g, '-');
}

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ڤ/g, 'ف')
    .replace(/ـ/g, '')
    .replace(/\s+/g, ' ');
}

const marketSlugs = new Set(['supermarket', 'supermarkets', 'market', 'grocery']);
const bookstoreSlugs = new Set([
  'bookstore', 'bookstores', 'book-store', 'library', 'books', 'stationery',
]);
const careSlugs = new Set([
  'personal-care', 'personalcare', 'beauty', 'beauty-care',
  'health-beauty', 'care',
]);
const requestSlugs = new Set([
  'request-anything', 'anything', 'special-request', 'other',
]);

function classifyName(value: string): RecentOrderCategory {
  const name = normalizeName(value);
  if (!name) return null;

  if (
    name.includes('اطلب اي حاجه') ||
    name === 'اي حاجه' ||
    name.includes('request anything')
  ) {
    return 'request-anything';
  }

  if (
    (name.includes('ماركت') && name.includes('نافينتي')) ||
    (name.includes('market') && name.includes('navienty'))
  ) {
    return 'supermarket';
  }

  if (
    (name.includes('مكتبه') && name.includes('نافينتي')) ||
    (name.includes('bookstore') && name.includes('navienty'))
  ) {
    return 'bookstore';
  }

  if (
    (name.includes('عنايه') && name.includes('نافينتي')) ||
    (name.includes('care') && name.includes('navienty'))
  ) {
    return 'personal-care';
  }

  return null;
}

/**
 * Resolve Navienty managed services by their category slug when available,
 * or their recognizable name when the order's store is not in the store list.
 * Return null for restaurant and other independent store orders.
 */
export function getRecentOrderCategory(
  order: Pick<Order, 'storeName'>,
  store: RepeatOrderStore | null,
): RecentOrderCategory {
  const names = [order.storeName, store?.name ?? ''];
  // Service request orders must never appear in Home > "اطلب تاني".
  if (names.some((name) => classifyName(name) === 'request-anything')) {
    return 'request-anything';
  }

  const categorySlug = normalizeSlug(store?.categorySlug ?? '');
  if (requestSlugs.has(categorySlug)) return 'request-anything';
  if (marketSlugs.has(categorySlug)) return 'supermarket';
  if (bookstoreSlugs.has(categorySlug)) return 'bookstore';
  if (careSlugs.has(categorySlug)) return 'personal-care';

  for (const name of names) {
    const category = classifyName(name);
    if (category) return category;
  }

  return null;
}

/**
 * Identifies the top-level service category used to choose an image.
 *
 * This differs from navigation: restaurant cards still open their original
 * store pages, but their category image can be configured independently.
 */
export type OrderArtworkCategory =
  | Exclude<RecentOrderCategory, null>
  | 'restaurants';

export function getOrderArtworkCategory(
  order: Pick<Order, 'storeName'>,
  store: RepeatOrderStore | null,
): OrderArtworkCategory | null {
  const serviceCategory = getRecentOrderCategory(order, store);
  if (serviceCategory) return serviceCategory;

  const storeCategory = normalizeSlug(store?.categorySlug ?? '');
  if (
    storeCategory === 'restaurants' ||
    storeCategory === 'restaurant' ||
    storeCategory === 'food'
  ) {
    return 'restaurants';
  }

  return null;
}

/**
 * Canonical landing routes for Navienty-managed storefronts.
 * Both Home's "اطلب تاني" and "ممكن تحتاج دلوقتي" use these
 * paths rather than opening legacy store or subcategory screens.
 */
export type ManagedCategoryRoute =
  | '/category/supermarket'
  | '/category/bookstore'
  | '/category/personal-care';

export function getManagedCategoryRoute(
  category: string | null | undefined,
): ManagedCategoryRoute | null {
  const key = (category ?? '').trim().toLowerCase().replace(/_/g, '-');

  switch (key) {
    case 'supermarket':
      return '/category/supermarket';
    case 'bookstore':
      return '/category/bookstore';
    case 'personal-care':
      return '/category/personal-care';
    default:
      return null;
  }
}

/** Translate personalized discovery tiles to their parent service page. */
export function getManagedDiscoveryRoute(
  type: string,
): ManagedCategoryRoute | null {
  switch (type) {
    case 'supermarket-category':
      return '/category/supermarket';
    case 'bookstore-category':
      return '/category/bookstore';
    case 'personal-care-category':
      return '/category/personal-care';
    default:
      return null;
  }
}

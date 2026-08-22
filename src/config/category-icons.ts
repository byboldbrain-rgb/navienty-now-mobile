import type {
    ImageSourcePropType,
} from 'react-native';

const DEFAULT_CATEGORY_ICON =
  require(
    '../assets/icons/categories/default.webp',
  );

const CATEGORY_ICONS: Record<
  string,
  ImageSourcePropType
> = {
  // المطاعم
  restaurant: require(
    '../assets/icons/categories/restaurant.webp',
  ),
  restaurants: require(
    '../assets/icons/categories/restaurant.webp',
  ),

  // السوبرماركت
  supermarket: require(
    '../assets/icons/categories/supermarket.webp',
  ),
  supermarkets: require(
    '../assets/icons/categories/supermarket.webp',
  ),

  // الصيدليات
  pharmacy: require(
    '../assets/icons/categories/pharmacy.webp',
  ),
  pharmacies: require(
    '../assets/icons/categories/pharmacy.webp',
  ),

  // المكتبات
  bookstore: require(
    '../assets/icons/categories/bookstore.webp',
  ),
  bookstores: require(
    '../assets/icons/categories/bookstore.webp',
  ),
};

export function getCategoryIcon(
  slug?: string | null,
): ImageSourcePropType {
  if (!slug) {
    return DEFAULT_CATEGORY_ICON;
  }

  const normalizedSlug =
    slug.trim().toLowerCase();

  return (
    CATEGORY_ICONS[normalizedSlug] ??
    DEFAULT_CATEGORY_ICON
  );
}
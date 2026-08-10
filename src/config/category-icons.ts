import type {
    ImageSourcePropType,
} from 'react-native';

const DEFAULT_CATEGORY_ICON =
  require(
    '../assets/icons/categories/default.png',
  );

const CATEGORY_ICONS: Record<
  string,
  ImageSourcePropType
> = {
  // المطاعم
  restaurant: require(
    '../assets/icons/categories/restaurant.png',
  ),
  restaurants: require(
    '../assets/icons/categories/restaurant.png',
  ),

  // السوبرماركت
  supermarket: require(
    '../assets/icons/categories/supermarket.png',
  ),
  supermarkets: require(
    '../assets/icons/categories/supermarket.png',
  ),

  // الصيدليات
  pharmacy: require(
    '../assets/icons/categories/pharmacy.png',
  ),
  pharmacies: require(
    '../assets/icons/categories/pharmacy.png',
  ),

  // المكتبات
  bookstore: require(
    '../assets/icons/categories/bookstore.png',
  ),
  bookstores: require(
    '../assets/icons/categories/bookstore.png',
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
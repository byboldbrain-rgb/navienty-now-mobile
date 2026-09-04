import type { ImageSourcePropType } from 'react-native';

import type { StoreSummary } from '../../services/catalog-service';

export const RESTAURANTS_SLUG = 'restaurants';

export type CuisineKey =
  | 'arabic'
  | 'arabic-sweets'
  | 'bakery'
  | 'beverages'
  | 'breakfast'
  | 'burgers'
  | 'cakes'
  | 'chicken'
  | 'chocolate'
  | 'coffee'
  | 'crepes'
  | 'desserts'
  | 'egyptian'
  | 'fast-food'
  | 'foul-falafel'
  | 'fried-chicken'
  | 'grills'
  | 'healthy'
  | 'koshary'
  | 'pasta'
  | 'pies'
  | 'pizza'
  | 'sandwiches'
  | 'seafood'
  | 'shawarma';

export type CuisineItem = {
  key: CuisineKey;
  label: string;
  image: ImageSourcePropType;
  keywords: readonly string[];
};

export type StoreRatingInfo = {
  hasRatings: boolean;
  rating: number | null;
};

export const CUISINES: readonly CuisineItem[] = [
  {
    key: 'arabic',
    label: 'أكل عربي',
    image: require('../../assets/cuisines/arabic.webp'),
    keywords: ['عربي', 'شامي', 'سوري', 'لبناني'],
  },
  {
    key: 'arabic-sweets',
    label: 'حلويات شرقية',
    image: require('../../assets/cuisines/arabic-sweets.webp'),
    keywords: ['حلويات شرقية', 'بقلاوة', 'كنافة'],
  },
  {
    key: 'bakery',
    label: 'مخبوزات',
    image: require('../../assets/cuisines/bakery.webp'),
    keywords: ['مخبوزات', 'مخبز', 'باتيه', 'كرواسون'],
  },
  {
    key: 'beverages',
    label: 'مشروبات',
    image: require('../../assets/cuisines/beverages.webp'),
    keywords: ['مشروبات', 'عصير', 'كوكتيل'],
  },
  {
    key: 'breakfast',
    label: 'فطار',
    image: require('../../assets/cuisines/breakfast.webp'),
    keywords: ['فطار', 'إفطار', 'بيض'],
  },
  {
    key: 'burgers',
    label: 'برجر',
    image: require('../../assets/cuisines/burgers.webp'),
    keywords: ['برجر', 'burger'],
  },
  {
    key: 'cakes',
    label: 'كيك',
    image: require('../../assets/cuisines/cakes.webp'),
    keywords: ['كيك', 'تورتة', 'cake'],
  },
  {
    key: 'chicken',
    label: 'فراخ',
    image: require('../../assets/cuisines/chicken.webp'),
    keywords: ['فراخ', 'دجاج', 'chicken'],
  },
  {
    key: 'chocolate',
    label: 'شوكولاتة',
    image: require('../../assets/cuisines/chocolate.webp'),
    keywords: ['شوكولاتة', 'chocolate'],
  },
  {
    key: 'coffee',
    label: 'قهوة وشاي',
    image: require('../../assets/cuisines/coffee.webp'),
    keywords: ['قهوة', 'شاي', 'كافيه', 'coffee'],
  },
  {
    key: 'crepes',
    label: 'كريب',
    image: require('../../assets/cuisines/crepes.webp'),
    keywords: ['كريب', 'crepe'],
  },
  {
    key: 'desserts',
    label: 'حلويات',
    image: require('../../assets/cuisines/desserts.webp'),
    keywords: ['حلويات', 'ديسرت', 'dessert'],
  },
  {
    key: 'egyptian',
    label: 'أكل مصري',
    image: require('../../assets/cuisines/egyptian.webp'),
    keywords: ['مصري', 'طواجن', 'محشي'],
  },
  {
    key: 'fast-food',
    label: 'وجبات سريعة',
    image: require('../../assets/cuisines/fast-food.webp'),
    keywords: ['وجبات سريعة', 'fast food'],
  },
  {
    key: 'foul-falafel',
    label: 'فول وطعمية',
    image: require('../../assets/cuisines/foul-falafel.webp'),
    keywords: ['فول', 'طعمية', 'فلافل'],
  },
  {
    key: 'fried-chicken',
    label: 'فراخ مقلية',
    image: require('../../assets/cuisines/fried-chicken.webp'),
    keywords: ['فراخ مقلية', 'بروست', 'fried chicken'],
  },
  {
    key: 'grills',
    label: 'مشويات',
    image: require('../../assets/cuisines/grills.webp'),
    keywords: ['مشويات', 'كباب', 'كفتة', 'grill'],
  },
  {
    key: 'healthy',
    label: 'أكل صحي',
    image: require('../../assets/cuisines/healthy.webp'),
    keywords: ['صحي', 'دايت', 'سلطة', 'healthy'],
  },
  {
    key: 'koshary',
    label: 'كشري',
    image: require('../../assets/cuisines/koshary.webp'),
    keywords: ['كشري', 'koshary'],
  },
  {
    key: 'pasta',
    label: 'مكرونة',
    image: require('../../assets/cuisines/pasta.webp'),
    keywords: ['مكرونة', 'باستا', 'pasta'],
  },
  {
    key: 'pies',
    label: 'فطير',
    image: require('../../assets/cuisines/pies.webp'),
    keywords: ['فطير', 'فطائر', 'pie'],
  },
  {
    key: 'pizza',
    label: 'بيتزا',
    image: require('../../assets/cuisines/pizza.webp'),
    keywords: ['بيتزا', 'pizza'],
  },
  {
    key: 'sandwiches',
    label: 'ساندوتشات',
    image: require('../../assets/cuisines/sandwiches.webp'),
    keywords: ['ساندوتش', 'سندوتش', 'sandwich'],
  },
  {
    key: 'seafood',
    label: 'مأكولات بحرية',
    image: require('../../assets/cuisines/seafood.webp'),
    keywords: ['سمك', 'سي فود', 'مأكولات بحرية', 'seafood'],
  },
  {
    key: 'shawarma',
    label: 'شاورما',
    image: require('../../assets/cuisines/shawarma.webp'),
    keywords: ['شاورما', 'shawarma'],
  },
];

const PREVIEW_CUISINE_KEYS: readonly CuisineKey[] = [
  'pizza',
  'crepes',
  'grills',
  'sandwiches',
  'desserts',
];

const CUISINE_BY_KEY = new Map<CuisineKey, CuisineItem>(
  CUISINES.map(
    (cuisine): [CuisineKey, CuisineItem] => [cuisine.key, cuisine],
  ),
);

export const PREVIEW_CUISINES: readonly CuisineItem[] =
  PREVIEW_CUISINE_KEYS.flatMap((key) => {
    const cuisine = CUISINE_BY_KEY.get(key);
    return cuisine ? [cuisine] : [];
  });

export const VIEW_ALL_CUISINE = {
  key: 'view-all',
  label: 'عرض الكل',
  image: require('../../assets/cuisines/view-all.webp'),
} as const;

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase('ar');
}

function getStoreSearchText(store: StoreSummary): string {
  return [store.name, store.description]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('ar');
}

export function getCuisineKeyFromRouteParam(
  cuisineParam: string | string[] | undefined,
): CuisineKey | null {
  const rawValue = Array.isArray(cuisineParam)
    ? cuisineParam[0]
    : cuisineParam;

  if (!rawValue) {
    return null;
  }

  const normalizedCuisine = normalizeSearchText(rawValue) as CuisineKey;
  return CUISINE_BY_KEY.has(normalizedCuisine)
    ? normalizedCuisine
    : null;
}

export function getVisibleRestaurants(
  stores: readonly StoreSummary[],
  selectedCuisineKey: CuisineKey | null,
): StoreSummary[] {
  const selectedCuisine = selectedCuisineKey
    ? CUISINE_BY_KEY.get(selectedCuisineKey) ?? null
    : null;

  const filteredStores = selectedCuisine
    ? stores.filter((store) => {
        const storeSearchText = getStoreSearchText(store);

        return selectedCuisine.keywords.some((keyword) =>
          storeSearchText.includes(normalizeSearchText(keyword)),
        );
      })
    : stores;

  return [...filteredStores].sort((first, second) => {
    if (first.isManuallyClosed !== second.isManuallyClosed) {
      return first.isManuallyClosed ? 1 : -1;
    }

    if (first.isFeatured !== second.isFeatured) {
      return first.isFeatured ? -1 : 1;
    }

    return first.name.localeCompare(second.name, 'ar');
  });
}

export function getRestaurantSearchSuggestions(
  stores: readonly StoreSummary[],
): string[] {
  return stores.map((store) => store.name);
}

export function getStoreRatingInfo(
  store: StoreSummary,
): StoreRatingInfo {
  const hasRealRating =
    Number.isFinite(store.rating) &&
    store.rating > 0 &&
    store.rating <= 5 &&
    Number.isFinite(store.ratingCount) &&
    store.ratingCount > 0;

  return hasRealRating
    ? {
        hasRatings: true,
        rating: store.rating,
      }
    : {
        hasRatings: false,
        rating: null,
      };
}

export function getStoreLogoUrl(
  store: StoreSummary,
): string | null {
  return store.logoUrl;
}

export function getStoreCoverUrl(
  store: StoreSummary,
): string | null {
  return store.coverImageUrl;
}

export function getStoreInitial(store: StoreSummary): string {
  const source = (store.name || '').trim();
  return source ? source.charAt(0) : '•';
}

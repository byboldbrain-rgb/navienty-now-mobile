import { Ionicons } from '@expo/vector-icons';
import type { ImageSourcePropType } from 'react-native';

import type { AppBootstrap } from '../../services/bootstrap-service';
import type { CatalogProduct, StoreCatalog } from '../../services/catalog-service';
import type { StorefrontCategoryTile } from '../../services/storefront-category-service';

const personalCareCategoryIcon = require('../../assets/icons/categories/personal-care.webp');
const laundryCategoryIcon = require('../../assets/icons/categories/laundry.webp');
const requestAnythingCategoryIcon = require('../../assets/icons/categories/request-anything.webp');

export type BootstrapCategory =
  AppBootstrap['store_categories'][number] & {
    subtitle_ar?: string | null;
    subtitle_en?: string | null;
  };

export type HomeCategory = {
  id: string;
  slug: string;
  name_ar: string;
  image_url?: string | null;
  localArtwork?: ImageSourcePropType;
  configuredArtworkSlug?: string;
  fallbackIcon: keyof typeof Ionicons.glyphMap;
};

export type HomeCategoryDefinition = {
  slug: string;
  nameAr: string;
  slugAliases: readonly string[];
  nameAliases: readonly string[];
  localArtwork?: ImageSourcePropType;
  useConfiguredArtwork?: boolean;
  fallbackIcon: keyof typeof Ionicons.glyphMap;
};

export type RecentlyViewedItem = {
  id: string;
  kind: string;
  storeId: string;
  title: string;
  icon?: string | null;
  imageUrl?: string | null;
  storeCategorySlug?: string | null;
};

export type ForYouRecommendation = {
  id: string;
  reason: string | null;
  score: number;
  result: {
    id: string;
    kind: string;
    title: string;
    icon?: string | null;
    imageUrl?: string | null;
    storeId: string;
    productId: string;
    sectionId: string | null;
    storeCategorySlug?: string | null;
  };
};

const HOME_CATEGORY_DEFINITIONS: readonly HomeCategoryDefinition[] = [
  {
    slug: 'restaurants',
    nameAr: 'المطاعم',
    slugAliases: [
      'restaurants',
      'restaurant',
      'food',
    ],
    nameAliases: ['المطاعم', 'مطاعم'],
    useConfiguredArtwork: true,
    fallbackIcon: 'restaurant-outline',
  },
  {
    slug: 'supermarket',
    nameAr: 'الماركت',
    slugAliases: [
      'supermarket',
      'supermarkets',
      'market',
      'grocery',
    ],
    nameAliases: [
      'الماركت',
      'السوبر ماركت',
      'سوبر ماركت',
    ],
    useConfiguredArtwork: true,
    fallbackIcon: 'basket-outline',
  },
  {
    slug: 'bookstore',
    nameAr: 'المكتبة',
    slugAliases: [
      'bookstore',
      'bookstores',
      'book-store',
      'library',
      'books',
      'stationery',
    ],
    nameAliases: [
      'المكتبة',
      'المكتبات',
      'مكتبة',
    ],
    useConfiguredArtwork: true,
    fallbackIcon: 'book-outline',
  },
  {
    slug: 'personal-care',
    nameAr: 'العناية',
    slugAliases: [
      'personal-care',
      'personal_care',
      'beauty',
      'beauty-care',
      'health-beauty',
    ],
    nameAliases: [
      'العناية',
      'العناية والتجميل',
      'الجمال والعناية',
    ],
    localArtwork: personalCareCategoryIcon,
    fallbackIcon: 'sparkles-outline',
  },
  {
    slug: 'laundry',
    nameAr: 'الغسيل والكي',
    slugAliases: [
      'laundry',
      'laundry-ironing',
      'wash-and-iron',
      'washing-ironing',
    ],
    nameAliases: [
      'الغسيل والكي',
      'الغسيل والكي',
      'غسيل وكي',
    ],
    localArtwork: laundryCategoryIcon,
    fallbackIcon: 'shirt-outline',
  },
  {
    slug: 'request-anything',
    nameAr: 'اطلب أي حاجة',
    slugAliases: [
      'request-anything',
      'anything',
      'other',
      'special-request',
    ],
    nameAliases: [
      'اطلب أي حاجة',
      'اطلب اي حاجة',
      'أي حاجة',
      'اي حاجة',
    ],
    localArtwork: requestAnythingCategoryIcon,
    fallbackIcon: 'bag-handle-outline',
  },
];

function normalizeCategoryValue(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
}

function findHomeCategoryDefinition(
  candidateSlugs: readonly string[],
): HomeCategoryDefinition | null {
  const normalizedCandidates =
    new Set(
      candidateSlugs
        .map(normalizeCategoryValue)
        .filter(Boolean),
    );

  return (
    HOME_CATEGORY_DEFINITIONS.find(
      (definition) => {
        if (
          normalizedCandidates.has(
            normalizeCategoryValue(
              definition.slug,
            ),
          )
        ) {
          return true;
        }

        return definition.slugAliases.some(
          (alias) =>
            normalizedCandidates.has(
              normalizeCategoryValue(alias),
            ),
        );
      },
    ) ?? null
  );
}

function findBootstrapCategoryForTile(
  tile: StorefrontCategoryTile,
  availableCategories: BootstrapCategory[],
): BootstrapCategory | null {
  const candidateSlugs = [
    tile.routeSlug,
    tile.key,
    ...tile.sourceSlugs,
  ]
    .map(normalizeCategoryValue)
    .filter(Boolean);

  const candidateSet =
    new Set(candidateSlugs);

  return (
    availableCategories.find(
      (category) =>
        candidateSet.has(
          normalizeCategoryValue(
            category.slug,
          ),
        ),
    ) ?? null
  );
}

function buildBundledHomeCategories(
  availableCategories: BootstrapCategory[],
): HomeCategory[] {
  return HOME_CATEGORY_DEFINITIONS.map(
    (definition) => {
      const matchedCategory =
        availableCategories.find(
          (category) => {
            const normalizedSlug =
              normalizeCategoryValue(
                category.slug,
              );
            const normalizedName =
              category.name_ar.trim();

            return (
              definition.slugAliases.some(
                (alias) =>
                  normalizeCategoryValue(
                    alias,
                  ) === normalizedSlug,
              ) ||
              definition.nameAliases.includes(
                normalizedName,
              )
            );
          },
        );

      return {
        id:
          matchedCategory?.id ??
          `home-category-${definition.slug}`,
        slug:
          matchedCategory?.slug ??
          definition.slug,
        name_ar: definition.nameAr,
        image_url:
          matchedCategory?.image_url ?? null,
        localArtwork:
          definition.localArtwork,
        configuredArtworkSlug:
          definition.useConfiguredArtwork
            ? matchedCategory?.slug ??
              definition.slug
            : undefined,
        fallbackIcon:
          definition.fallbackIcon,
      };
    },
  );
}

function buildRemoteHomeCategories(
  availableCategories: BootstrapCategory[],
  remoteTiles: StorefrontCategoryTile[],
): HomeCategory[] {
  return remoteTiles.flatMap(
    (tile): HomeCategory[] => {
      const matchedCategory =
        findBootstrapCategoryForTile(
          tile,
          availableCategories,
        );

      /*
       * Catalog-backed Home tiles must resolve to an active Store Category
       * returned by bootstrap. This prevents an admin typo or a disabled
       * service from creating a broken Home shortcut.
       *
       * Virtual tiles are allowed without a Store Category because they can
       * point to an app-owned route.
       */
      if (
        tile.kind === 'catalog' &&
        !matchedCategory
      ) {
        return [];
      }

      const compatibilityDefinition =
        findHomeCategoryDefinition([
          tile.routeSlug,
          tile.key,
          ...tile.sourceSlugs,
          matchedCategory?.slug ?? '',
        ]);

      return [
        {
          id: tile.id,
          slug: tile.routeSlug,
          name_ar: tile.labelAr,
          image_url:
            tile.imageUrl ??
            matchedCategory?.image_url ??
            null,
          localArtwork:
            compatibilityDefinition
              ?.localArtwork,
          configuredArtworkSlug:
            compatibilityDefinition
              ?.useConfiguredArtwork
              ? matchedCategory?.slug ??
                tile.routeSlug
              : undefined,
          fallbackIcon:
            compatibilityDefinition
              ?.fallbackIcon ??
            'grid-outline',
        },
      ];
    },
  );
}

export function buildHomeCategories(
  availableCategories: BootstrapCategory[],
  remoteTiles: StorefrontCategoryTile[] | null,
): HomeCategory[] {
  /*
   * null = remote configuration failed, so keep the bundled categories as
   * a safety fallback.
   *
   * [] = a valid remote configuration where the admin intentionally hid
   * every Home category. Do not replace an intentional empty state.
   */
  if (remoteTiles === null) {
    return buildBundledHomeCategories(
      availableCategories,
    );
  }

  return buildRemoteHomeCategories(
    availableCategories,
    remoteTiles,
  );
}

export type HomeDiscoveryDestination =
  | {
      type: 'restaurant-cuisine';
      cuisineKey: string;
    }
  | {
      type: 'supermarket-category';
      slug: string;
    }
  | {
      type: 'bookstore-category';
      slug: string;
    }
  | {
      type: 'personal-care-category';
      slug: string;
    };

export type HomeDiscoveryItem = {
  key: string;
  label: string;
  image: ImageSourcePropType;
  destination: HomeDiscoveryDestination;
};

export type HomeDiscoveryCatalogKey =
  | 'breakfast'
  | 'bakery'
  | 'coffee-tea'
  | 'beverages'
  | 'sandwiches'
  | 'pizza'
  | 'crepes'
  | 'desserts'
  | 'snacks-chocolate'
  | 'notebooks'
  | 'face-care';

export type HomeDiscoveryContext = {
  subtitle: string;
  items: readonly HomeDiscoveryItem[];
};

const HOME_DISCOVERY_CATALOG: Record<
  HomeDiscoveryCatalogKey,
  HomeDiscoveryItem
> = {
  breakfast: {
    key: 'breakfast',
    label: 'فطار',
    image: require('../../assets/cuisines/breakfast.webp'),
    destination: {
      type: 'restaurant-cuisine',
      cuisineKey: 'breakfast',
    },
  },

  bakery: {
    key: 'bakery',
    label: 'مخبوزات',
    image: require('../../assets/cuisines/bakery.webp'),
    destination: {
      type: 'restaurant-cuisine',
      cuisineKey: 'bakery',
    },
  },

  'coffee-tea': {
    key: 'coffee-tea',
    label: 'قهوة وشاي',
    image: require('../../../assets/images/supermarket-categories/coffee-tea.webp'),
    destination: {
      type: 'supermarket-category',
      slug: 'coffee-tea',
    },
  },

  beverages: {
    key: 'beverages',
    label: 'مشروبات',
    image: require('../../../assets/images/supermarket-categories/beverages.webp'),
    destination: {
      type: 'supermarket-category',
      slug: 'beverages',
    },
  },

  sandwiches: {
    key: 'sandwiches',
    label: 'ساندوتشات',
    image: require('../../assets/cuisines/sandwiches.webp'),
    destination: {
      type: 'restaurant-cuisine',
      cuisineKey: 'sandwiches',
    },
  },

  pizza: {
    key: 'pizza',
    label: 'بيتزا',
    image: require('../../assets/cuisines/pizza.webp'),
    destination: {
      type: 'restaurant-cuisine',
      cuisineKey: 'pizza',
    },
  },

  crepes: {
    key: 'crepes',
    label: 'كريب',
    image: require('../../assets/cuisines/crepes.webp'),
    destination: {
      type: 'restaurant-cuisine',
      cuisineKey: 'crepes',
    },
  },

  desserts: {
    key: 'desserts',
    label: 'حلويات',
    image: require('../../assets/cuisines/desserts.webp'),
    destination: {
      type: 'restaurant-cuisine',
      cuisineKey: 'desserts',
    },
  },

  'snacks-chocolate': {
    key: 'snacks-chocolate',
    label: 'شيكولاتة وسناكس',
    image: require('../../../assets/images/supermarket-categories/snacks-chocolate.webp'),
    destination: {
      type: 'supermarket-category',
      slug: 'snacks-chocolate',
    },
  },

  notebooks: {
    key: 'notebooks',
    label: 'كراسات ونوت بوك',
    image: require('../../../assets/images/bookstore-categories/notebooks.webp'),
    destination: {
      type: 'bookstore-category',
      slug: 'notebooks',
    },
  },

  'face-care': {
    key: 'face-care',
    label: 'العناية بالوجه',
    image: require('../../../assets/images/personal-care-categories/face-care.webp'),
    destination: {
      type: 'personal-care-category',
      slug: 'face-care',
    },
  },
};

export function getCairoHour(
  date = new Date(),
): number {
  try {
    const cairoHourText =
      new Intl.DateTimeFormat(
        'en-US',
        {
          hour: '2-digit',
          hour12: false,
          timeZone: 'Africa/Cairo',
        },
      ).format(date);

    const parsedHour =
      Number.parseInt(
        cairoHourText,
        10,
      );

    if (Number.isFinite(parsedHour)) {
      return parsedHour % 24;
    }
  } catch {
    /*
     * Older runtimes may not support named time zones in Intl.
     * Falling back to the device hour keeps discovery functional.
     */
  }

  return date.getHours();
}

export function getHomeDiscoveryContext(
  cairoHour: number,
): HomeDiscoveryContext {
  if (
    cairoHour >= 6 &&
    cairoHour < 11
  ) {
    return {
      subtitle:
        'اختيارات مناسبة لبداية يومك',
      items: [
        HOME_DISCOVERY_CATALOG.breakfast,
        HOME_DISCOVERY_CATALOG['coffee-tea'],
        HOME_DISCOVERY_CATALOG.bakery,
        HOME_DISCOVERY_CATALOG.beverages,
        HOME_DISCOVERY_CATALOG.notebooks,
        HOME_DISCOVERY_CATALOG['face-care'],
      ],
    };
  }

  if (
    cairoHour >= 11 &&
    cairoHour < 17
  ) {
    return {
      subtitle:
        'اختيارات سريعة لوسط اليوم',
      items: [
        HOME_DISCOVERY_CATALOG.sandwiches,
        HOME_DISCOVERY_CATALOG.pizza,
        HOME_DISCOVERY_CATALOG.beverages,
        HOME_DISCOVERY_CATALOG['snacks-chocolate'],
        HOME_DISCOVERY_CATALOG.notebooks,
        HOME_DISCOVERY_CATALOG['face-care'],
      ],
    };
  }

  if (
    cairoHour >= 17 &&
    cairoHour < 22
  ) {
    return {
      subtitle:
        'اختيارات مناسبة للمساء',
      items: [
        HOME_DISCOVERY_CATALOG.pizza,
        HOME_DISCOVERY_CATALOG.crepes,
        HOME_DISCOVERY_CATALOG.desserts,
        HOME_DISCOVERY_CATALOG.beverages,
        HOME_DISCOVERY_CATALOG['snacks-chocolate'],
        HOME_DISCOVERY_CATALOG['coffee-tea'],
      ],
    };
  }

  return {
    subtitle:
      'اختيارات لآخر اليوم',
    items: [
      HOME_DISCOVERY_CATALOG.pizza,
      HOME_DISCOVERY_CATALOG.sandwiches,
      HOME_DISCOVERY_CATALOG['snacks-chocolate'],
      HOME_DISCOVERY_CATALOG.beverages,
      HOME_DISCOVERY_CATALOG.desserts,
      HOME_DISCOVERY_CATALOG['coffee-tea'],
    ],
  };
}

export const FOR_YOU_PRODUCT_STORE_CATEGORIES =
  new Set([
    'supermarket',
    'supermarkets',
    'market',
    'grocery',
    'bookstore',
    'bookstores',
    'book-store',
    'library',
    'books',
    'stationery',
    'personal-care',
    'personalcare',
    'beauty',
    'beauty-care',
    'health-beauty',
    'care',
  ]);

export function normalizeForYouCategorySlug(
  value: string | null | undefined,
): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');
}

export function isEligibleForYouProduct(
  recommendation:
    ForYouRecommendation,
): boolean {
  const result =
    recommendation.result;

  if (result.kind !== 'product') {
    return false;
  }

  return FOR_YOU_PRODUCT_STORE_CATEGORIES.has(
    normalizeForYouCategorySlug(
      result.storeCategorySlug,
    ),
  );
}

export function getCatalogProductMap(
  catalog: StoreCatalog,
): Map<string, CatalogProduct> {
  const productsById =
    new Map<string, CatalogProduct>();

  catalog.sections.forEach(
    (section) => {
      section.products.forEach(
        (product) => {
          if (
            product.id &&
            !productsById.has(
              product.id,
            )
          ) {
            productsById.set(
              product.id,
              product,
            );
          }
        },
      );
    },
  );

  return productsById;
}

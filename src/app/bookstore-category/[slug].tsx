import { Ionicons } from '@expo/vector-icons';
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CategoryCartDock, {
  useCartDockScrollBehavior,
} from '../../components/cart/category-cart-dock';
import { ProductGridScreenSkeleton } from '../../components/ui/loading-skeleton';
import {
  getBookstoreCategoryImage,
} from '../../config/bookstore-category-images';
import getAppBootstrap from '../../services/bootstrap-service';
import {
  type CatalogProduct,
  type CatalogSection,
  findCatalogSectionBySlug,
  getCatalogSectionOffers,
  getCatalogSectionProducts,
  getStoreCatalog,
  listStores,
  type StoreCatalog,
} from '../../services/catalog-service';
import {
  findStorefrontCategoryTile,
  getStorefrontTileCategoryImages,
  listStorefrontCategoryTiles,
} from '../../services/storefront-category-service';
import { useCartStore } from '../../store/cart-store';
import { useCustomerStore } from '../../store/customer-store';

/* ============================================================
 * CONSTANTS
 * ============================================================
 */

const PAGE_MAX_WIDTH = 560;
const HORIZONTAL_PADDING = 16;
const PRODUCT_GAP = 10;

const NAVIENTY_NOW_GREEN =
  '#00B14F';

const NAVIENTY_NOW_GREEN_DARK =
  '#009245';

type ProductFilterKey =
  | 'all'
  | 'offers'
  | string;

type ProductCardMode =
  | 'category'
  | 'offers';

/* ============================================================
 * BOOKSTORE CATEGORY IMAGES
 * ============================================================
 */

/*
 * Bookstore Subcategory images live locally in:
 *
 * assets/images/bookstore-subcategories/
 *
 * The keys below are the real catalog category slugs from Supabase.
 */

/* ============================================================
 * BOOKSTORE ROOT CATEGORY IMAGES
 *
 * IMPORTANT:
 * These are the exact same local images used by
 * src/app/category/bookstore.tsx.
 *
 * We keep them here too because Expo/Metro requires static
 * require(...) calls. Route params cannot safely carry a local
 * ImageSourcePropType returned by require(...).
 * ============================================================
 */

const BOOKSTORE_ROOT_CATEGORY_IMAGES: Partial<
  Record<string, ImageSourcePropType>
> = {
  'writing-tools': require(
    '../../../assets/images/bookstore-categories/writing-tools.webp',
  ),
  notebooks: require(
    '../../../assets/images/bookstore-categories/notebooks.webp',
  ),
  'printing-paper': require(
    '../../../assets/images/bookstore-categories/printing-paper.webp',
  ),
  'files-organization': require(
    '../../../assets/images/bookstore-categories/files-organization.webp',
  ),
  'study-supplies': require(
    '../../../assets/images/bookstore-categories/study-supplies.webp',
  ),
  'geometry-tools': require(
    '../../../assets/images/bookstore-categories/geometry-tools.webp',
  ),
  'art-supplies': require(
    '../../../assets/images/bookstore-categories/art-supplies.webp',
  ),
  calculators: require(
    '../../../assets/images/bookstore-categories/calculators.webp',
  ),
  'pencil-cases-bags': require(
    '../../../assets/images/bookstore-categories/pencil-cases-bags.webp',
  ),
  'cups-cans': require(
    '../../../assets/images/bookstore-categories/cups-cans.webp',
  ),
  flowers: require(
    '../../../assets/images/bookstore-categories/flowers.webp',
  ),
};

const BOOKSTORE_SUBCATEGORY_IMAGES: Record<
  string,
  ImageSourcePropType
> = {
  /* أقلام وأدوات الكتابة */
  'writing-tools-ballpoint-pens': require(
    '../../../assets/images/bookstore-subcategories/ballpoint-pens.webp',
  ),
  'writing-tools-pencils-leads': require(
    '../../../assets/images/bookstore-subcategories/pencils-and-leads.webp',
  ),
  'writing-tools-markers-highlighters': require(
    '../../../assets/images/bookstore-subcategories/markers-and-highlighters.webp',
  ),
  'writing-tools-calligraphy-design-pens': require(
    '../../../assets/images/bookstore-subcategories/calligraphy-and-design-pens.webp',
  ),
  'writing-tools-erasers': require(
    '../../../assets/images/bookstore-subcategories/erasers.webp',
  ),
  'writing-tools-sharpeners': require(
    '../../../assets/images/bookstore-subcategories/sharpeners.webp',
  ),

  /* ملفات وتنظيم الأوراق */
  'files-organization-files-paper-holders': require(
    '../../../assets/images/bookstore-subcategories/files-and-document-holders.webp',
  ),
  'files-organization-archive-files': require(
    '../../../assets/images/bookstore-subcategories/archive-files.webp',
  ),

  /* رسم وفنون */
  'art-supplies-colors-materials': require(
    '../../../assets/images/bookstore-subcategories/colors-and-art-materials.webp',
  ),
  'art-supplies-drawing-surfaces-canvases': require(
    '../../../assets/images/bookstore-subcategories/drawing-surfaces-and-canvases.webp',
  ),
  'art-supplies-drawing-shading-pencils': require(
    '../../../assets/images/bookstore-subcategories/drawing-and-shading-pencils.webp',
  ),
  'art-supplies-brushes-coloring-tools': require(
    '../../../assets/images/bookstore-subcategories/brushes-and-coloring-tools.webp',
  ),

  /* كراسات ونوت بوك */
  'notebooks-school-exercise-books': require(
    '../../../assets/images/bookstore-subcategories/school-notebooks.webp',
  ),
  'notebooks-personal-journals': require(
    '../../../assets/images/bookstore-subcategories/notebooks-and-journals.webp',
  ),
  'notebooks-planners-time-management': require(
    '../../../assets/images/bookstore-subcategories/planners-and-agendas.webp',
  ),
  'notebooks-paper-blocks-note-pads': require(
    '../../../assets/images/bookstore-subcategories/notepads-and-note-paper.webp',
  ),
  'notebooks-custom-inner-papers-shapes': require(
    '../../../assets/images/bookstore-subcategories/refill-and-specialty-inserts.webp',
  ),

  /* مستلزمات المذاكرة */
  'study-supplies-highlighting-learning': require(
    '../../../assets/images/bookstore-subcategories/highlighting-and-marking.webp',
  ),
  'study-supplies-organization-review-tools': require(
    '../../../assets/images/bookstore-subcategories/study-organization-and-review.webp',
  ),

  /* آلات حاسبة */
  'calculators-scientific': require(
    '../../../assets/images/bookstore-subcategories/scientific-calculators.webp',
  ),

  /* ورق ومستلزمات الطباعة */
  'printing-paper-printing-service': require(
    '../../../assets/images/bookstore-subcategories/paper-printing.webp',
  ),
  'printing-paper-binding-lamination-supplies': require(
    '../../../assets/images/bookstore-subcategories/binding-and-lamination-supplies.webp',
  ),

  /* مساطر وأدوات هندسية */
  'geometry-tools-rulers': require(
    '../../../assets/images/bookstore-subcategories/rulers.webp',
  ),
  'geometry-tools-compasses': require(
    '../../../assets/images/bookstore-subcategories/compasses-and-dividers.webp',
  ),
  'geometry-tools-triangles-protractors': require(
    '../../../assets/images/bookstore-subcategories/set-squares-and-protractors.webp',
  ),

  /* مقالم وشنط */
  'pencil-cases-bags-pencil-cases-pen-pouches': require(
    '../../../assets/images/bookstore-subcategories/pencil-cases-and-pen-pouches.webp',
  ),
  'pencil-cases-bags-laptop-university-bags': require(
    '../../../assets/images/bookstore-subcategories/laptop-and-university-bags.webp',
  ),

  /* أكواب ومعلبات */
  'cups-cans-bottles': require(
    '../../../assets/images/bookstore-subcategories/bottles.webp',
  ),
  'cups-cans-mugs': require(
    '../../../assets/images/bookstore-subcategories/mugs.webp',
  ),
  'cups-cans-boxes': require(
    '../../../assets/images/bookstore-subcategories/boxes.webp',
  ),

  /* ورد */
  'flowers-red': require(
    '../../../assets/images/bookstore-subcategories/red-flowers.webp',
  ),
  'flowers-white': require(
    '../../../assets/images/bookstore-subcategories/white-flowers.webp',
  ),
  'flowers-mixed': require(
    '../../../assets/images/bookstore-subcategories/mixed-flowers.webp',
  ),
  'flowers-wrapping': require(
    '../../../assets/images/bookstore-subcategories/wrapping.webp',
  ),
};

type BookstoreVirtualSubcategory = {
  key: string;
  label: string;
  aliases: readonly string[];
  productKeywords: readonly string[];
  icon: string;
};

type BookstoreFallbackCategory = {
  key: string;
  label: string;
  aliases: readonly string[];
  productKeywords: readonly string[];
  virtualSubcategories?: readonly BookstoreVirtualSubcategory[];
};

/**
 * Categories that may be shown by bookstore.tsx before a matching
 * root CatalogSection is added to the store catalog.
 *
 * If a matching section exists under a different slug or as a nested
 * section, the resolver below will still find it. If it does not exist
 * yet, the page remains usable and shows matching products (or the
 * regular empty state) instead of the "category unavailable" screen.
 */
const BOOKSTORE_FALLBACK_CATEGORIES:
  readonly BookstoreFallbackCategory[] = [
    {
      key: 'cups-cans',
      label: 'أكواب ومعلبات',
      aliases: [
        'cups-cans',
        'cups-and-cans',
        'mugs-cans',
        'mugs-and-cans',
        'drinkware',
        'cups',
        'mugs',
        'أكواب ومعلبات',
        'اكواب ومعلبات',
        'أكواب',
        'اكواب',
        'مجات',
        'معلبات',
      ],
      productKeywords: [
        'cup',
        'cups',
        'mug',
        'mugs',
        'tumbler',
        'drinkware',
        'bottle',
        'bottles',
        'box',
        'boxes',
        'container',
        'containers',
        'canned',
        'cans',
        'tin',
        'tins',
        'كوب',
        'أكواب',
        'اكواب',
        'مج',
        'مجات',
        'زجاجة',
        'زجاجات',
        'قارورة',
        'قوارير',
        'علبة',
        'علب',
        'معلبات',
      ],
      virtualSubcategories: [
        {
          key: 'cups-cans-bottles',
          label: 'زجاجة',
          aliases: [
            'bottle',
            'bottles',
            'water-bottle',
            'water-bottles',
            'flask',
            'flasks',
            'زجاجة',
            'زجاجات',
            'قارورة',
            'قوارير',
          ],
          productKeywords: [
            'bottle',
            'bottles',
            'water bottle',
            'water-bottle',
            'flask',
            'زجاجة',
            'زجاجات',
            'قارورة',
            'قوارير',
          ],
          icon: '🧴',
        },
        {
          key: 'cups-cans-mugs',
          label: 'مج',
          aliases: [
            'mug',
            'mugs',
            'coffee-mug',
            'coffee-mugs',
            'مج',
            'مجات',
          ],
          productKeywords: [
            'mug',
            'mugs',
            'coffee mug',
            'coffee-mug',
            'مج',
            'مجات',
          ],
          icon: '☕',
        },
        {
          key: 'cups-cans-boxes',
          label: 'علب',
          aliases: [
            'box',
            'boxes',
            'container',
            'containers',
            'can',
            'cans',
            'tin',
            'tins',
            'علبة',
            'علب',
            'معلبات',
          ],
          productKeywords: [
            'box',
            'boxes',
            'container',
            'containers',
            'can',
            'cans',
            'tin',
            'tins',
            'علبة',
            'علب',
            'معلبات',
          ],
          icon: '📦',
        },
      ],
    },
    {
      key: 'pencil-cases-bags',
      label: 'مقالم وشنط',
      aliases: [
        'pencil-cases-bags',
        'pencil-cases-and-bags',
        'pencil-cases',
        'school-bags',
        'bags',
        'مقالم وشنط',
        'المقالم والشنط',
        'مقالم',
        'شنط',
        'حقائب',
      ],
      productKeywords: [
        'pencil-case',
        'pencil-cases',
        'pen-pouch',
        'school-bag',
        'university-bag',
        'laptop-bag',
        'مقلمة',
        'مقالم',
        'شنطة',
        'شنط',
        'حقيبة',
        'حقائب',
      ],
    },
    {
      key: 'flowers',
      label: 'ورد',
      aliases: [
        'flowers',
        'flower',
        'roses',
        'rose',
        'bouquets',
        'ورد',
        'ورود',
        'زهور',
        'بوكيهات',
      ],
      productKeywords: [
        'flower',
        'flowers',
        'rose',
        'roses',
        'bouquet',
        'bouquets',
        'red rose',
        'red roses',
        'white rose',
        'white roses',
        'mixed flowers',
        'mixed bouquet',
        'ورد',
        'ورود',
        'زهور',
        'بوكيه',
        'بوكيهات',
        'ورد احمر',
        'ورد أحمر',
        'ورد ابيض',
        'ورد أبيض',
        'ورد مشكل',
        'تغليف',
        'تغليف ورد',
        'تغليف هدايا',
        'wrapping',
        'flower wrapping',
        'gift wrapping',
      ],
      virtualSubcategories: [
        {
          key: 'flowers-red',
          label: 'ورد احمر',
          aliases: [
            'red-flower',
            'red-flowers',
            'red-rose',
            'red-roses',
            'ورد احمر',
            'ورد أحمر',
            'ورود حمراء',
          ],
          productKeywords: [
            'red flower',
            'red flowers',
            'red rose',
            'red roses',
            'ورد احمر',
            'ورد أحمر',
            'ورود حمراء',
          ],
          icon: '🌹',
        },
        {
          key: 'flowers-white',
          label: 'ورد ابيض',
          aliases: [
            'white-flower',
            'white-flowers',
            'white-rose',
            'white-roses',
            'ورد ابيض',
            'ورد أبيض',
            'ورود بيضاء',
          ],
          productKeywords: [
            'white flower',
            'white flowers',
            'white rose',
            'white roses',
            'ورد ابيض',
            'ورد أبيض',
            'ورود بيضاء',
          ],
          icon: '🤍',
        },
        {
          key: 'flowers-mixed',
          label: 'ورد مشكل',
          aliases: [
            'mixed-flower',
            'mixed-flowers',
            'mixed-bouquet',
            'mixed-bouquets',
            'assorted-flowers',
            'ورد مشكل',
            'ورود مشكلة',
            'بوكيه مشكل',
          ],
          productKeywords: [
            'mixed flower',
            'mixed flowers',
            'mixed bouquet',
            'mixed bouquets',
            'assorted flowers',
            'ورد مشكل',
            'ورود مشكلة',
            'بوكيه مشكل',
          ],
          icon: '💐',
        },
        {
          key: 'flowers-wrapping',
          label: 'التغليف',
          aliases: [
            'wrapping',
            'flower-wrapping',
            'gift-wrapping',
            'bouquet-wrapping',
            'packaging',
            'تغليف',
            'التغليف',
            'تغليف ورد',
            'تغليف الورود',
            'تغليف هدايا',
          ],
          productKeywords: [
            'wrapping',
            'flower wrapping',
            'gift wrapping',
            'bouquet wrapping',
            'packaging',
            'wrap',
            'تغليف',
            'التغليف',
            'تغليف ورد',
            'تغليف الورود',
            'تغليف هدايا',
          ],
          icon: '🎁',
        },
      ],
    },
  ];

/* ============================================================
 * HELPERS
 * ============================================================
 */

function getSingleParam(
  value:
    | string
    | string[]
    | undefined,
) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function normalizeSearchText(
  value: string | null | undefined,
) {
  return (value ?? '')
    .trim()
    .toLowerCase();
}

function normalizeSlug(
  value: string | null | undefined,
) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeCategoryMatchValue(
  value: string | null | undefined,
) {
  return (value ?? '')
    .trim()
    .toLocaleLowerCase('ar')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/&/g, 'and')
    .replace(
      /[^a-z0-9\u0600-\u06ff]+/g,
      '-',
    )
    .replace(/^-+|-+$/g, '');
}

function categoryValuesMatch(
  firstValue: string,
  secondValue: string,
) {
  if (
    !firstValue ||
    !secondValue
  ) {
    return false;
  }

  if (firstValue === secondValue) {
    return true;
  }

  return (
    firstValue.startsWith(
      `${secondValue}-`,
    ) ||
    firstValue.endsWith(
      `-${secondValue}`,
    ) ||
    firstValue.includes(
      `-${secondValue}-`,
    ) ||
    secondValue.startsWith(
      `${firstValue}-`,
    ) ||
    secondValue.endsWith(
      `-${firstValue}`,
    ) ||
    secondValue.includes(
      `-${firstValue}-`,
    )
  );
}

function getBookstoreFallbackCategory(
  sectionSlug: string,
  categoryKey: string | undefined,
  label: string | undefined,
) {
  const requestedValues = [
    sectionSlug,
    categoryKey,
    label,
  ]
    .map(normalizeCategoryMatchValue)
    .filter(Boolean);

  return (
    BOOKSTORE_FALLBACK_CATEGORIES.find(
      (definition) => {
        const acceptedValues = [
          definition.key,
          definition.label,
          ...definition.aliases,
        ].map(
          normalizeCategoryMatchValue,
        );

        return requestedValues.some(
          (requestedValue) =>
            acceptedValues.some(
              (acceptedValue) =>
                categoryValuesMatch(
                  requestedValue,
                  acceptedValue,
                ),
            ),
        );
      },
    ) ?? null
  );
}

function getProductImage(
  product: CatalogProduct,
): string | null {
  if (product.imageUrl) {
    return product.imageUrl;
  }

  const coverImage =
    product.images.find(
      (image) => image.isCover,
    );

  if (coverImage) {
    return coverImage.imageUrl;
  }

  return (
    product.images[0]?.imageUrl ??
    null
  );
}

function getDiscountPercent(
  product: CatalogProduct,
): number | null {
  if (
    product.compareAtPrice === null ||
    product.compareAtPrice <=
      product.price ||
    product.compareAtPrice <= 0
  ) {
    return null;
  }

  return Math.round(
    ((product.compareAtPrice -
      product.price) /
      product.compareAtPrice) *
      100,
  );
}

function isOfferProduct(
  product: CatalogProduct,
) {
  return (
    product.compareAtPrice !== null &&
    product.compareAtPrice >
      product.price &&
    product.compareAtPrice > 0
  );
}

function formatMoney(
  value: number,
  currencyCode: string,
) {
  const currencyLabel =
    currencyCode
      .trim()
      .toUpperCase() === 'EGP'
      ? 'ج.م'
      : currencyCode;

  return `${value.toFixed(
    2,
  )} ${currencyLabel}`;
}

function deduplicateProducts(
  products: CatalogProduct[],
) {
  const productsMap =
    new Map<
      string,
      CatalogProduct
    >();

  for (const product of products) {
    productsMap.set(
      product.id,
      product,
    );
  }

  return Array.from(
    productsMap.values(),
  );
}

function getOfferPageRootCategories(
  catalog: StoreCatalog,
): CatalogSection[] {
  /*
   * Primary source:
   * categoryTree contains the real root categories.
   */
  const treeRoots =
    catalog.categoryTree.filter(
      (section) =>
        section.parentId === null ||
        section.depth === 0,
    );

  /*
   * Defensive fallback:
   * لو categoryTree رجعت فاضية لأي سبب،
   * نستخدم الـFlat sections ونجيب الـRoot categories.
   */
  const fallbackRoots =
    catalog.sections.filter(
      (section) =>
        section.parentId === null,
    );

  const source =
    treeRoots.length > 0
      ? treeRoots
      : fallbackRoots.length > 0
        ? fallbackRoots
        : catalog.sections.filter(
            (section) =>
              section.depth === 0,
          );

  const uniqueRoots =
    new Map<
      string,
      CatalogSection
    >();

  for (const section of source) {
    uniqueRoots.set(
      section.id,
      section,
    );
  }

  return Array.from(
    uniqueRoots.values(),
  ).sort(
    (
      first,
      second,
    ) => {
      if (
        first.sortOrder !==
        second.sortOrder
      ) {
        return (
          first.sortOrder -
          second.sortOrder
        );
      }

      return first.name.localeCompare(
        second.name,
        'ar',
      );
    },
  );
}

function getAllCatalogOffers(
  catalog: StoreCatalog,
) {
  const products: CatalogProduct[] =
    [];

  for (
    const rootCategory of
    getOfferPageRootCategories(
      catalog,
    )
  ) {
    products.push(
      ...getCatalogSectionOffers(
        rootCategory,
      ),
    );
  }

  /*
   * Final defensive fallback:
   * لو hierarchy مش مكتملة، نجمع أي منتج عليه خصم
   * من كل sections بدل ما صفحة العروض تظهر فاضية.
   */
  if (products.length === 0) {
    for (
      const section of
      catalog.sections
    ) {
      for (
        const product of
        section.products
      ) {
        if (
          isOfferProduct(
            product,
          )
        ) {
          products.push(
            product,
          );
        }
      }
    }
  }

  return deduplicateProducts(
    products,
  );
}

function findCatalogSectionByCategoryKey(
  catalog: StoreCatalog,
  categoryKey: string | undefined,
): CatalogSection | null {
  const rawCategoryKey =
    (categoryKey ?? '').trim();

  if (!rawCategoryKey) {
    return null;
  }

  /*
   * bookstore.tsx sends categoryKey as section.id.
   * Older/deep links may still send the slug.
   * Support both so the "الكل" item can always
   * resolve the exact category that opened the page.
   */
  const sectionById =
    catalog.sections.find(
      (section) =>
        section.id === rawCategoryKey,
    ) ??
    catalog.categoryTree.find(
      (section) =>
        section.id === rawCategoryKey,
    );

  if (sectionById) {
    return sectionById;
  }

  const normalizedCategoryKey =
    normalizeSlug(rawCategoryKey);

  if (!normalizedCategoryKey) {
    return null;
  }

  return (
    catalog.sections.find(
      (section) =>
        normalizeSlug(section.slug) ===
        normalizedCategoryKey,
    ) ??
    catalog.categoryTree.find(
      (section) =>
        normalizeSlug(section.slug) ===
        normalizedCategoryKey,
    ) ??
    null
  );
}

function findCatalogSectionByRouteParams(
  catalog: StoreCatalog,
  sectionSlug: string,
  categoryKey: string | undefined,
  label: string | undefined,
) {
  const sectionBySlug =
    findCatalogSectionBySlug(
      catalog,
      sectionSlug,
    );

  /*
   * Child-category routes keep the root categoryKey for artwork,
   * so the requested slug must always take priority.
   */
  if (sectionBySlug) {
    return sectionBySlug;
  }

  const sectionByCategoryKey =
    findCatalogSectionByCategoryKey(
      catalog,
      categoryKey,
    );

  if (sectionByCategoryKey) {
    return sectionByCategoryKey;
  }

  const fallbackCategory =
    getBookstoreFallbackCategory(
      sectionSlug,
      categoryKey,
      label,
    );

  const requestedValues = [
    sectionSlug,
    categoryKey,
    label,
    fallbackCategory?.key,
    fallbackCategory?.label,
    ...(fallbackCategory?.aliases ?? []),
  ]
    .map(normalizeCategoryMatchValue)
    .filter(Boolean);

  if (requestedValues.length === 0) {
    return null;
  }

  const uniqueSections =
    new Map<string, CatalogSection>();

  for (
    const section of [
      ...catalog.sections,
      ...catalog.categoryTree,
    ]
  ) {
    uniqueSections.set(
      section.id,
      section,
    );
  }

  const sections = Array.from(
    uniqueSections.values(),
  ).sort((first, second) => {
    const firstIsRoot =
      first.parentId === null ||
      first.depth === 0;
    const secondIsRoot =
      second.parentId === null ||
      second.depth === 0;

    return Number(secondIsRoot) -
      Number(firstIsRoot);
  });

  const getSectionValues = (
    section: CatalogSection,
  ) =>
    [
      section.slug,
      section.name,
      section.nameEn,
    ]
      .map(normalizeCategoryMatchValue)
      .filter(Boolean);

  const exactSection = sections.find(
    (section) =>
      getSectionValues(section).some(
        (sectionValue) =>
          requestedValues.includes(
            sectionValue,
          ),
      ),
  );

  if (exactSection) {
    return exactSection;
  }

  return (
    sections.find((section) =>
      getSectionValues(section).some(
        (sectionValue) =>
          requestedValues.some(
            (requestedValue) =>
              categoryValuesMatch(
                sectionValue,
                requestedValue,
              ),
          ),
      ),
    ) ?? null
  );
}

function getFallbackCategoryProducts(
  catalog: StoreCatalog,
  category: BookstoreFallbackCategory,
) {
  const categoryValues = [
    category.key,
    category.label,
    ...category.aliases,
  ]
    .map(normalizeCategoryMatchValue)
    .filter(Boolean);

  const productKeywords =
    category.productKeywords
      .map(normalizeCategoryMatchValue)
      .filter(Boolean);

  const products: CatalogProduct[] = [];

  for (const section of catalog.sections) {
    const sectionValues = [
      section.slug,
      section.name,
      section.nameEn,
    ]
      .map(normalizeCategoryMatchValue)
      .filter(Boolean);

    const sectionMatches =
      sectionValues.some(
        (sectionValue) =>
          categoryValues.some(
            (categoryValue) =>
              categoryValuesMatch(
                sectionValue,
                categoryValue,
              ),
          ),
      );

    if (sectionMatches) {
      products.push(
        ...getCatalogSectionProducts(
          section,
          true,
        ),
      );
      continue;
    }

    for (const product of section.products) {
      const searchableProductValue =
        normalizeCategoryMatchValue(
          [
            product.name,
            product.nameEn,
            product.description,
            product.descriptionEn,
            product.sku,
            product.unitLabelAr,
            product.unitLabelEn,
          ]
            .filter(Boolean)
            .join(' '),
        );

      if (
        productKeywords.some(
          (keyword) =>
            categoryValuesMatch(
              searchableProductValue,
              keyword,
            ),
        )
      ) {
        products.push(product);
      }
    }
  }

  return deduplicateProducts(products);
}


function getProductsMatchingKeywords(
  products: CatalogProduct[],
  keywords: readonly string[],
) {
  const normalizedKeywords = keywords
    .map(normalizeCategoryMatchValue)
    .filter(Boolean);

  if (normalizedKeywords.length === 0) {
    return [];
  }

  return products.filter((product) => {
    const searchableProductValue =
      normalizeCategoryMatchValue(
        [
          product.name,
          product.nameEn,
          product.description,
          product.descriptionEn,
          product.sku,
          product.barcode,
          product.unitLabelAr,
          product.unitLabelEn,
        ]
          .filter(Boolean)
          .join(' '),
      );

    return normalizedKeywords.some(
      (keyword) =>
        categoryValuesMatch(
          searchableProductValue,
          keyword,
        ),
    );
  });
}

function getVirtualSubcategoryProducts(
  baseProducts: CatalogProduct[],
  subcategory: BookstoreVirtualSubcategory,
) {
  return deduplicateProducts(
    getProductsMatchingKeywords(
      baseProducts,
      subcategory.productKeywords,
    ),
  );
}

/* ============================================================
 * CATEGORY VISUAL
 * ============================================================
 */

function CategoryFilterVisual({
  section,
  fallbackKey,
  remoteImageUrl,
}: {
  section: CatalogSection;
  fallbackKey?: string;
  remoteImageUrl?: string | null;
}) {
  if (remoteImageUrl) {
    return (
      <Image
        source={{
          uri: remoteImageUrl,
        }}
        style={
          styles.filterCategoryImage
        }
        resizeMode="cover"
      />
    );
  }

  if (section.imageUrl) {
    return (
      <Image
        source={{
          uri: section.imageUrl,
        }}
        style={
          styles.filterCategoryImage
        }
        resizeMode="cover"
      />
    );
  }
  const normalizedSectionSlug =
    normalizeSlug(section.slug);

  const localSubcategoryImage =
    BOOKSTORE_SUBCATEGORY_IMAGES[
      normalizedSectionSlug
    ];

  /*
   * Local Subcategory artwork.
   */
  if (localSubcategoryImage) {
    return (
      <Image
        source={localSubcategoryImage}
        style={
          styles.filterCategoryImage
        }
        resizeMode="cover"
      />
    );
  }

  /*
   * IMPORTANT:
   * The "الكل" item receives the original/root CatalogSection.
   * Use the exact same bundled artwork that bookstore.tsx uses
   * for that root category.
   */
  const localRootCategoryImage =
    BOOKSTORE_ROOT_CATEGORY_IMAGES[
      normalizedSectionSlug
    ];

  if (localRootCategoryImage) {
    return (
      <Image
        source={localRootCategoryImage}
        style={
          styles.filterCategoryImage
        }
        resizeMode="cover"
      />
    );
  }

  /*
   * Existing config fallback.
   */
  const mainCategoryImage =
    getBookstoreCategoryImage(
      section.slug,
    );

  if (mainCategoryImage) {
    return (
      <Image
        source={mainCategoryImage}
        style={
          styles.filterCategoryImage
        }
        resizeMode="cover"
      />
    );
  }

  const normalizedFallbackKey =
    normalizeSlug(
      fallbackKey,
    );

  const fallbackRootCategoryImage =
    normalizedFallbackKey
      ? BOOKSTORE_ROOT_CATEGORY_IMAGES[
          normalizedFallbackKey
        ]
      : undefined;

  if (fallbackRootCategoryImage) {
    return (
      <Image
        source={
          fallbackRootCategoryImage
        }
        style={
          styles.filterCategoryImage
        }
        resizeMode="cover"
      />
    );
  }

  const fallbackLocalImage =
    normalizedFallbackKey
      ? BOOKSTORE_SUBCATEGORY_IMAGES[
          normalizedFallbackKey
        ]
      : undefined;

  if (fallbackLocalImage) {
    return (
      <Image
        source={fallbackLocalImage}
        style={
          styles.filterCategoryImage
        }
        resizeMode="cover"
      />
    );
  }

  const fallbackMainCategoryImage =
    fallbackKey
      ? getBookstoreCategoryImage(
          fallbackKey,
        )
      : null;

  if (fallbackMainCategoryImage) {
    return (
      <Image
        source={
          fallbackMainCategoryImage
        }
        style={
          styles.filterCategoryImage
        }
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={
        styles.filterImagePlaceholder
      }
    />
  );
}

function VirtualCategoryFilterVisual({
  subcategory,
  remoteImageUrl,
}: {
  subcategory: BookstoreVirtualSubcategory;
  remoteImageUrl?: string | null;
}) {
  if (remoteImageUrl) {
    return (
      <Image
        source={{
          uri: remoteImageUrl,
        }}
        style={styles.filterCategoryImage}
        resizeMode="cover"
      />
    );
  }
  const localSubcategoryImage =
    BOOKSTORE_SUBCATEGORY_IMAGES[
      normalizeSlug(subcategory.key)
    ];

  if (localSubcategoryImage) {
    return (
      <Image
        source={localSubcategoryImage}
        style={styles.filterCategoryImage}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={
        styles.filterImagePlaceholder
      }
    />
  );
}

/* ============================================================
 * PRODUCT CARD
 * ============================================================
 */

type ProductCardProps = {
  product: CatalogProduct;

  cardWidth: number;

  currencyCode: string;

  quantity: number;

  isStoreClosed: boolean;

  mode: ProductCardMode;

  onAdd: () => void;

  onIncrease: () => void;

  onDecrease: () => void;
};

function ProductCard({
  product,
  cardWidth,
  currencyCode,
  quantity,
  isStoreClosed,
  mode,
  onAdd,
  onIncrease,
  onDecrease,
}: ProductCardProps) {
  const imageUrl =
    getProductImage(product);

  const discount =
    getDiscountPercent(product);

  const isOffersMode =
    mode === 'offers';

  const hasOldPrice =
    product.compareAtPrice !== null &&
    product.compareAtPrice >
      product.price;

  return (
    <View
      style={[
        styles.productCard,
        isOffersMode &&
          styles.offersProductCard,
        {
          width: cardWidth,
        },
      ]}
    >
      <View
        style={[
          styles.productImageBox,
          isOffersMode &&
            styles.offersProductImageBox,
          {
            height: cardWidth,
          },
        ]}
      >
        {imageUrl ? (
          <Image
            source={{
              uri: imageUrl,
            }}
            style={
              styles.productImage
            }
            resizeMode="contain"
          />
        ) : (
          <Text
            style={
              styles.productFallback
            }
          >
            {product.icon || '📚'}
          </Text>
        )}

        {discount !== null && (
          <View
            style={[
              styles.discountBadgeBase,

              isOffersMode
                ? styles.offersDiscountBadge
                : styles.categoryDiscountBadge,
            ]}
          >
            <Text
              style={[
                styles.discountText,

                isOffersMode &&
                  styles.offersDiscountText,
              ]}
              numberOfLines={1}
            >
              {isOffersMode
                ? `وفر ${discount}%`
                : `خصم ${discount}%`}
            </Text>
          </View>
        )}

        {quantity === 0 ? (
          <Pressable
            disabled={isStoreClosed}
            hitSlop={4}
            onPress={onAdd}
            style={({ pressed }) => [
              styles.addButton,

              isOffersMode &&
                styles.offersAddButton,

              isStoreClosed &&
                styles.disabledButton,

              pressed &&
                !isStoreClosed &&
                styles.addButtonPressed,
            ]}
          >
            <Text
              style={[
                styles.addButtonText,

                isOffersMode &&
                  styles.offersAddButtonText,
              ]}
            >
              +
            </Text>
          </Pressable>
        ) : (
          <View
            style={[
              styles.quantityPill,

              isOffersMode &&
                styles.offersQuantityPill,
            ]}
          >
            <Pressable
              hitSlop={4}
              style={
                styles.quantityAction
              }
              onPress={onDecrease}
            >
              <Text
                style={
                  styles.quantityActionText
                }
              >
                −
              </Text>
            </Pressable>

            <Text
              style={
                styles.quantityText
              }
            >
              {quantity}
            </Text>

            <Pressable
              disabled={isStoreClosed}
              hitSlop={4}
              style={
                styles.quantityAction
              }
              onPress={onIncrease}
            >
              <Text
                style={
                  styles.quantityActionText
                }
              >
                +
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <Text
        style={[
          styles.productName,

          isOffersMode &&
            styles.offersProductName,
        ]}
        numberOfLines={
          isOffersMode ? 2 : 3
        }
      >
        {product.name}
      </Text>

      {product.unitLabelAr ? (
        <Text
          style={[
            styles.productUnitLabel,

            isOffersMode &&
              styles.offersProductUnitLabel,
          ]}
          numberOfLines={1}
        >
          {product.unitLabelAr}
        </Text>
      ) : null}

      {isOffersMode ? (
        <View
          style={
            styles.offersPriceRow
          }
        >
          <View
            style={
              styles.offersCurrentPriceUnderline
            }
          >
            <Text
              style={
                styles.offersCurrentPrice
              }
              numberOfLines={1}
            >
              {formatMoney(
                product.price,
                currencyCode,
              )}
            </Text>
          </View>

          {hasOldPrice && (
            <Text
              style={
                styles.offersOldPrice
              }
              numberOfLines={1}
            >
              {formatMoney(
                product.compareAtPrice!,
                currencyCode,
              )}
            </Text>
          )}
        </View>
      ) : (
        <View
          style={
            styles.priceColumn
          }
        >
          <Text
            style={
              styles.currentPrice
            }
          >
            {formatMoney(
              product.price,
              currencyCode,
            )}
          </Text>

          {hasOldPrice && (
            <Text
              style={
                styles.oldPrice
              }
            >
              {formatMoney(
                product.compareAtPrice!,
                currencyCode,
              )}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

/* ============================================================
 * SCREEN
 * ============================================================
 */

export default function BookstoreCategoryScreen() {
  const router = useRouter();

  const {
    isScrollingDown: isCartDockScrollingDown,
    onScroll: handleCartDockScroll,
  } = useCartDockScrollBehavior();

  const offersTabsScrollRef =
    useRef<ScrollView | null>(
      null,
    );

  const hasPositionedOffersTabsRef =
    useRef(false);

  /*
   * Normal category/subcategory rail.
   *
   * Expo Router may keep this screen mounted when navigating
   * between nested categories. Without explicitly resetting the
   * horizontal position, React Native can preserve the previous
   * ScrollView offset and make the next category open in the middle
   * of its subcategories.
   */
  const filtersScrollRef =
    useRef<ScrollView | null>(
      null,
    );

  const hasPositionedFiltersRef =
    useRef(false);

  const {
    width: windowWidth,
  } = useWindowDimensions();

  const savedServiceAreaId =
    useCustomerStore(
      (state) =>
        state.locationServiceAreaId,
    );

  const params =
    useLocalSearchParams<{
      slug?:
        | string
        | string[];

      storeId?:
        | string
        | string[];

      categoryKey?:
        | string
        | string[];

      label?:
        | string
        | string[];
    }>();

  const sectionSlug =
    getSingleParam(
      params.slug,
    ) ?? '';

  const requestedStoreId =
    getSingleParam(
      params.storeId,
    );

  const passedCategoryKey =
    getSingleParam(
      params.categoryKey,
    );

  const passedLabel =
    getSingleParam(
      params.label,
    );

  const isOffersPage =
    normalizeSlug(sectionSlug) ===
    'offers';

  const fallbackCategory =
    getBookstoreFallbackCategory(
      sectionSlug,
      passedCategoryKey,
      passedLabel,
    );

  /* ==========================================================
   * STATE
   * ==========================================================
   */

  const [
    catalog,
    setCatalog,
  ] =
    useState<StoreCatalog | null>(
      null,
    );

  const [
    selectedSection,
    setSelectedSection,
  ] =
    useState<CatalogSection | null>(
      null,
    );

  const [
    currencyCode,
    setCurrencyCode,
  ] =
    useState('EGP');

  const [
    selectedFilterKey,
    setSelectedFilterKey,
  ] =
    useState<ProductFilterKey>(
      'all',
    );

  const [
    isSearchVisible,
    setIsSearchVisible,
  ] =
    useState(false);

  const [
    searchQuery,
    setSearchQuery,
  ] =
    useState('');

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<string | null>(
      null,
    );

  const [
    rootCategoryImageUrl,
    setRootCategoryImageUrl,
  ] =
    useState<string | null>(
      null,
    );

  const [
    categoryImageOverrides,
    setCategoryImageOverrides,
  ] =
    useState<Record<string, string>>(
      {},
    );

  /* ==========================================================
   * CART
   * ==========================================================
   */

  const carts =
    useCartStore(
      (state) => state.carts,
    );

  const addItem =
    useCartStore(
      (state) =>
        state.addItem,
    );

  const increaseStoreItem =
    useCartStore(
      (state) =>
        state.increaseStoreItem,
    );

  const decreaseStoreItem =
    useCartStore(
      (state) =>
        state.decreaseStoreItem,
    );

  const setActiveCart =
    useCartStore(
      (state) =>
        state.setActiveCart,
    );

  /* ==========================================================
   * LOAD
   * ==========================================================
   */

  async function loadCategory() {
    try {
      setIsLoading(true);

      setErrorMessage(null);

      const bootstrap =
        await getAppBootstrap();

      let remoteRootImageUrl:
        string | null =
        null;

      let remoteCategoryImages:
        Record<string, string> =
        {};

      try {
        const remoteTiles =
          await listStorefrontCategoryTiles(
            'bookstore',
          );

        const remoteTile =
          findStorefrontCategoryTile(
            remoteTiles,
            [
              passedCategoryKey,
              sectionSlug,
              fallbackCategory?.key,
            ],
          );

        remoteRootImageUrl =
          remoteTile?.imageUrl ??
          null;

        remoteCategoryImages =
          getStorefrontTileCategoryImages(
            remoteTile,
          );
      } catch {
        /*
         * Remote artwork configuration is optional.
         * Catalog/local images remain the fallback.
         */
      }

      setRootCategoryImageUrl(
        remoteRootImageUrl,
      );

      setCategoryImageOverrides(
        remoteCategoryImages,
      );

      const serviceAreaId =
        savedServiceAreaId ??
        bootstrap.settings
          .default_service_area_id ??
        undefined;

      let storeId =
        requestedStoreId;

      if (!storeId) {
        const bookstores =
          await listStores({
            categorySlug:
              'bookstores',

            serviceAreaId,
          });

        if (
          bookstores.length ===
          0
        ) {
          throw new Error(
            'لا توجد مكتبة متاحة حاليًا.',
          );
        }

        const bookstore =
          bookstores.find(
            (store) =>
              store.isFeatured &&
              !store.isManuallyClosed,
          ) ??
          bookstores.find(
            (store) =>
              !store.isManuallyClosed,
          ) ??
          bookstores[0];

        storeId =
          bookstore.id;
      }

      const loadedCatalog =
        await getStoreCatalog(
          storeId,
          serviceAreaId,
        );

      /*
       * العروض ليست Category حقيقية.
       *
       * هي صفحة Virtual تجمع المنتجات
       * التي عليها compareAtPrice > price
       * من كل أقسام المكتبة.
       */
      if (isOffersPage) {
        setCatalog(
          loadedCatalog,
        );

        setSelectedSection(
          null,
        );

        setCurrencyCode(
          bootstrap.settings
            .currency_code ||
            'EGP',
        );

        setSelectedFilterKey(
          'all',
        );

        setSearchQuery('');

        return;
      }

      const section =
        findCatalogSectionByRouteParams(
          loadedCatalog,
          sectionSlug,
          passedCategoryKey,
          passedLabel,
        );

      if (
        !section &&
        !fallbackCategory
      ) {
        throw new Error(
          'لم يتم العثور على فئة المكتبة المطلوبة.',
        );
      }

      setCatalog(
        loadedCatalog,
      );

      setSelectedSection(
        section,
      );

      setCurrencyCode(
        bootstrap.settings
          .currency_code ||
          'EGP',
      );

      setSelectedFilterKey(
        'all',
      );

      setSearchQuery('');
    } catch (error) {
      setCatalog(null);

      setRootCategoryImageUrl(
        null,
      );

      setCategoryImageOverrides(
        {},
      );

      setSelectedSection(
        null,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر تحميل هذه الفئة.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    hasPositionedOffersTabsRef.current =
      false;

    hasPositionedFiltersRef.current =
      false;

    void loadCategory();
  }, [
    requestedStoreId,
    sectionSlug,
    passedCategoryKey,
    passedLabel,
    savedServiceAreaId,
  ]);

  /* ==========================================================
   * NORMAL CATEGORY CHILDREN
   * ==========================================================
   */

  const childCategories =
    useMemo(() => {
      if (!selectedSection) {
        return [];
      }

      return [
        ...selectedSection.children,
      ].sort(
        (
          first,
          second,
        ) => {
          if (
            first.sortOrder !==
            second.sortOrder
          ) {
            return (
              first.sortOrder -
              second.sortOrder
            );
          }

          return first.name.localeCompare(
            second.name,
            'ar',
          );
        },
      );
    }, [selectedSection]);

  const virtualSubcategories =
    useMemo(() => {
      const configured =
        fallbackCategory
          ?.virtualSubcategories ??
        [];

      if (configured.length === 0) {
        return [];
      }

      const realChildValues =
        new Set(
          childCategories.flatMap(
            (child) =>
              [
                child.slug,
                child.name,
                child.nameEn,
              ]
                .map(
                  normalizeCategoryMatchValue,
                )
                .filter(Boolean),
          ),
        );

      return configured.filter(
        (subcategory) => {
          const acceptedValues = [
            subcategory.key,
            subcategory.label,
            ...subcategory.aliases,
          ]
            .map(
              normalizeCategoryMatchValue,
            )
            .filter(Boolean);

          return !acceptedValues.some(
            (value) =>
              realChildValues.has(
                value,
              ),
          );
        },
      );
    }, [
      childCategories,
      fallbackCategory?.key,
    ]);

  /*
   * We render the normal filter rail using a regular row instead of
   * row-reverse. To keep the Arabic visual order:
   *
   * Right edge:
   *   الكل → العروض → أول Subcategory → ...
   *
   * the child categories are reversed only for display.
   */
  const childCategoriesForDisplay =
    useMemo(
      () => [
        ...childCategories,
      ].reverse(),
      [childCategories],
    );

  const virtualSubcategoriesForDisplay =
    useMemo(
      () => [
        ...virtualSubcategories,
      ].reverse(),
      [virtualSubcategories],
    );

  /*
   * Reset the normal subcategory rail whenever the actual category
   * changes. This is important because Expo Router can reuse the same
   * screen instance and preserve the old horizontal ScrollView offset.
   *
   * Two animation frames give React Native enough time to lay out the
   * new rail before we move it to its Arabic "start" (the right edge).
   */
  useEffect(() => {
    if (
      isOffersPage ||
      (!selectedSection &&
        !fallbackCategory)
    ) {
      return;
    }

    hasPositionedFiltersRef.current =
      false;

    requestAnimationFrame(
      () => {
        requestAnimationFrame(
          () => {
            filtersScrollRef.current?.scrollToEnd(
              {
                animated:
                  false,
              },
            );

            hasPositionedFiltersRef.current =
              true;
          },
        );
      },
    );
  }, [
    isOffersPage,
    selectedSection?.id,
    fallbackCategory?.key,
  ]);

  /* ==========================================================
   * OFFER PAGE CATEGORY TABS
   * ==========================================================
   */

  const offerCategoryTabs =
    useMemo(() => {
      if (!catalog) {
        return [];
      }

      /*
       * بنعرض كل Main Categories في صفحة العروض،
       * حتى لو Category معينة مفيهاش عروض حالياً.
       *
       * قبل كده كان فيه filter بيخفي أي Category
       * مفيهاش منتج compareAtPrice > price.
       */
      return getOfferPageRootCategories(
        catalog,
      );
    }, [catalog]);

  /*
   * Horizontal ScrollView + row-reverse ممكن يخلي العناصر
   * تبدأ خارج الـviewport على بعض الأجهزة.
   *
   * لذلك نعرض Row عادي، نعكس الـCategories بصرياً،
   * ونضع "الكل" في أقصى اليمين.
   */
  const offerCategoryTabsForDisplay =
    useMemo(
      () => [
        ...offerCategoryTabs,
      ].reverse(),
      [offerCategoryTabs],
    );

  /* ==========================================================
   * PRODUCTS
   * ==========================================================
   */

  const filteredProducts =
    useMemo(() => {
      if (!catalog) {
        return [];
      }

      let products:
        CatalogProduct[] = [];

      /*
       * =====================================
       * OFFERS PAGE
       * =====================================
       */
      if (isOffersPage) {
        if (
          selectedFilterKey ===
          'all'
        ) {
          products =
            getAllCatalogOffers(
              catalog,
            );
        } else {
          const selectedOfferCategory =
            offerCategoryTabs.find(
              (category) =>
                category.id ===
                selectedFilterKey,
            );

          if (
            selectedOfferCategory
          ) {
            products =
              getCatalogSectionOffers(
                selectedOfferCategory,
              );
          }
        }
      }

      /*
       * =====================================
       * NORMAL CATEGORY PAGE
       * =====================================
       */
      else if (selectedSection) {
        const baseCategoryProducts =
          getCatalogSectionProducts(
            selectedSection,
            true,
          );

        if (
          selectedFilterKey ===
          'all'
        ) {
          products =
            baseCategoryProducts;
        } else {
          const selectedChild =
            childCategories.find(
              (category) =>
                category.id ===
                selectedFilterKey,
            );

          if (selectedChild) {
            products =
              getCatalogSectionProducts(
                selectedChild,
                true,
              );
          } else {
            const selectedVirtualSubcategory =
              virtualSubcategories.find(
                (subcategory) =>
                  subcategory.key ===
                  selectedFilterKey,
              );

            if (
              selectedVirtualSubcategory
            ) {
              products =
                getVirtualSubcategoryProducts(
                  baseCategoryProducts,
                  selectedVirtualSubcategory,
                );
            }
          }
        }
      }

      /*
       * A newly added UI category can be opened before its root
       * CatalogSection is created. In that case, collect matching
       * products from the existing catalog instead of failing the
       * whole route.
       */
      else if (fallbackCategory) {
        const baseFallbackProducts =
          getFallbackCategoryProducts(
            catalog,
            fallbackCategory,
          );

        if (
          selectedFilterKey ===
          'all'
        ) {
          products =
            baseFallbackProducts;
        } else {
          const selectedVirtualSubcategory =
            virtualSubcategories.find(
              (subcategory) =>
                subcategory.key ===
                selectedFilterKey,
            );

          if (
            selectedVirtualSubcategory
          ) {
            products =
              getVirtualSubcategoryProducts(
                baseFallbackProducts,
                selectedVirtualSubcategory,
              );
          }
        }
      }

      /*
       * Search.
       */
      const normalizedQuery =
        normalizeSearchText(
          searchQuery,
        );

      if (normalizedQuery) {
        products =
          products.filter(
            (product) => {
              const searchableText =
                [
                  product.name,
                  product.nameEn,
                  product.description,
                  product.descriptionEn,
                  product.sku,
                  product.barcode,
                  product.unitLabelAr,
                  product.unitLabelEn,
                ]
                  .filter(Boolean)
                  .join(' ')
                  .toLowerCase();

              return searchableText.includes(
                normalizedQuery,
              );
            },
          );
      }

      /*
       * Safety:
       *
       * صفحة العروض مستحيل تعرض
       * منتج بدون خصم.
       */
      if (isOffersPage) {
        products =
          products.filter(
            isOfferProduct,
          );
      }

      return deduplicateProducts(
        products,
      );
    }, [
      catalog,
      isOffersPage,
      selectedFilterKey,
      searchQuery,
      selectedSection,
      childCategories,
      virtualSubcategories,
      offerCategoryTabs,
      fallbackCategory?.key,
    ]);

  /* ==========================================================
   * LOADING
   * ==========================================================
   */

  if (isLoading) {
    return (
      <ProductGridScreenSkeleton />
    );
  }

  /* ==========================================================
   * ERROR
   * ==========================================================
   */

  if (
    !catalog ||
    errorMessage ||
    (!isOffersPage &&
      !selectedSection &&
      !fallbackCategory)
  ) {
    return (
      <SafeAreaView
        style={styles.stateScreen}
      >
        <StatusBar
          style="dark"
        />

        <Text
          style={
            styles.stateEmoji
          }
        >
          📚
        </Text>

        <Text
          style={
            styles.stateTitle
          }
        >
          الفئة غير متاحة
        </Text>

        <Text
          style={
            styles.stateDescription
          }
        >
          {errorMessage ??
            'تعذر تحميل هذه الفئة.'}
        </Text>

        <Pressable
          style={
            styles.retryButton
          }
          onPress={() => {
            void loadCategory();
          }}
        >
          <Text
            style={
              styles.retryButtonText
            }
          >
            إعادة المحاولة
          </Text>
        </Pressable>

        <Pressable
          style={
            styles.backErrorButton
          }
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.backErrorButtonText
            }
          >
            رجوع
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  /* ==========================================================
   * STORE
   * ==========================================================
   */

  const currentStore =
    catalog.store;

  const delivery =
    catalog.delivery;

  const isStoreClosed =
    currentStore.isManuallyClosed;

  const currentCart =
    carts[currentStore.id] ??
    null;

  const cartItems =
    currentCart?.items ??
    [];

  const currentStoreSubtotal =
    cartItems.reduce(
      (total, item) =>
        total +
        item.price *
          item.quantity,
      0,
    );

  const currentStoreItemCount =
    cartItems.reduce(
      (total, item) =>
        total +
        item.quantity,
      0,
    );

  const minimumOrder =
    delivery.minimumOrder;

  const amountRemaining =
    Math.max(
      minimumOrder -
        currentStoreSubtotal,
      0,
    );

  const orderProgress =
    minimumOrder <= 0
      ? currentStoreItemCount >
        0
        ? 1
        : 0
      : Math.min(
          currentStoreSubtotal /
            minimumOrder,
          1,
        );

  /* ==========================================================
   * LAYOUT
   * ==========================================================
   */

  const pageWidth =
    Math.min(
      windowWidth,
      PAGE_MAX_WIDTH,
    );

  const productCardWidth =
    (pageWidth -
      HORIZONTAL_PADDING * 2 -
      PRODUCT_GAP) /
    2;

  /*
   * The "الكل" item must always use the same artwork as the
   * category that opened this screen.
   *
   * For nested categories we intentionally keep the original
   * categoryKey instead of replacing it with the child slug.
   * This prevents the "الكل" circle from losing its image when
   * a child category does not have its own root-category artwork.
   */
  const categoryImageSection =
    findCatalogSectionByCategoryKey(
      catalog,
      passedCategoryKey,
    ) ??
    selectedSection;

  const categoryKey =
    passedCategoryKey ??
    categoryImageSection?.slug ??
    selectedSection?.slug ??
    '';

  const pageTitle =
    isOffersPage
      ? 'العروض'
      : selectedSection?.name ||
        fallbackCategory?.label ||
        passedLabel ||
        '';

  const shouldShowNormalCartDock =
    !isOffersPage &&
    currentStoreItemCount > 0;

  /* ==========================================================
   * NORMAL CATEGORY NAVIGATION
   * ==========================================================
   */

  function openChildCategory(
    child: CatalogSection,
  ) {
    if (
      child.children.length > 0
    ) {
      router.push({
        pathname:
          '/bookstore-category/[slug]',

        params: {
          slug:
            child.slug,

          storeId:
            currentStore.id,

          categoryKey:
            categoryKey,

          label:
            child.name,
        },
      });

      return;
    }

    setSelectedFilterKey(
      child.id,
    );

    setSearchQuery('');
  }

  /* ==========================================================
   * CART
   * ==========================================================
   */

  function addProduct(
    product: CatalogProduct,
  ) {
    if (isStoreClosed) {
      return;
    }

    addItem(
      {
        id:
          currentStore.id,

        name:
          currentStore.name,

        icon:
          currentStore.icon,

        categorySlug:
          currentStore.categorySlug,

        deliveryFee:
          delivery.deliveryFee,

        minimumOrder:
          delivery.minimumOrder,
      },
      {
        id:
          product.id,

        name:
          product.name,

        description:
          product.description,

        price:
          product.price,

        icon:
          product.icon,

        variantId:
          null,

        variantName:
          null,

      },
    );
  }

  function increaseProduct(
    product: CatalogProduct,
  ) {
    if (isStoreClosed) {
      return;
    }

    const itemExists =
      cartItems.some(
        (item) =>
          item.id ===
            product.id &&
          item.variantId ===
            null,
      );

    if (itemExists) {
      increaseStoreItem(
        currentStore.id,
        product.id,
        null,
      );

      return;
    }

    addProduct(
      product,
    );
  }

  function decreaseProduct(
    productId: string,
  ) {
    decreaseStoreItem(
      currentStore.id,
      productId,
      null,
    );
  }

  function getProductQuantity(
    productId: string,
  ) {
    return (
      cartItems.find(
        (item) =>
          item.id ===
            productId &&
          item.variantId ===
            null,
      )?.quantity ?? 0
    );
  }

  function openCart() {
    if (
      currentStoreItemCount <= 0
    ) {
      return;
    }

    setActiveCart(
      currentStore.id,
    );

    router.push({
      pathname:
        '/cart',

      params: {
        storeId:
          currentStore.id,
      },
    });
  }

  function getCartMessage() {
    if (
      minimumOrder <= 0 ||
      amountRemaining <= 0
    ) {
      return 'الطلب جاهز للإكمال';
    }

    return `أضف ${formatMoney(
      amountRemaining,
      currencyCode,
    )} لإتمام الحد الأدنى للطلب`;
  }

  function getEmptyMessage() {
    if (
      searchQuery.trim()
    ) {
      return 'لم نجد منتجاً مطابقاً لبحثك.';
    }

    if (isOffersPage) {
      if (
        selectedFilterKey !==
        'all'
      ) {
        return 'لا توجد عروض متاحة حالياً داخل هذه الفئة.';
      }

      return 'لا توجد عروض متاحة حالياً.';
    }

    if (
      selectedFilterKey !==
      'all'
    ) {
      return 'لا توجد منتجات متاحة داخل هذا القسم حالياً.';
    }

    return 'لا توجد منتجات متاحة داخل هذه الفئة حالياً.';
  }

  /* ==========================================================
   * UI
   * ==========================================================
   */

  return (
    <SafeAreaView
      style={styles.screen}
      edges={[
        'top',
        'bottom',
      ]}
    >
      <StatusBar
        style="dark"
      />

      <View
        style={
          styles.pageShell
        }
      >
        {/* =====================================================
         * HEADER
         * =====================================================
         */}

        <View
          style={
            styles.header
          }
        >
          {isSearchVisible ? (
            <View
              style={
                styles.searchInputContainer
              }
            >
              <Ionicons
                name="search-outline"
                size={18}
                color="#222222"
              />

              <TextInput
                autoFocus
                value={searchQuery}
                onChangeText={
                  setSearchQuery
                }
                placeholder={
                  isOffersPage
                    ? 'ابحث في العروض'
                    : 'ابحث في الفئة'
                }
                placeholderTextColor="#999999"
                style={
                  styles.searchInput
                }
                textAlign="right"
              />

              <Pressable
                hitSlop={12}
                onPress={() => {
                  setSearchQuery('');

                  setIsSearchVisible(
                    false,
                  );
                }}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color="#222222"
                />
              </Pressable>
            </View>
          ) : (
            <>
              {/* Back button stays on the LEFT side. */}
              <Pressable
                style={({
                  pressed,
                }) => [
                  styles.headerCircleButton,

                  pressed &&
                    styles.pressed,
                ]}
                onPress={() =>
                  router.back()
                }
              >
                <Ionicons
                  name="arrow-back"
                  size={22}
                  color="#202020"
                />
              </Pressable>

              <View
                style={
                  styles.headerTitleGroup
                }
              >
                <Text
                  style={
                    styles.headerTitle
                  }
                  numberOfLines={1}
                >
                  {pageTitle}
                </Text>
              </View>

              {/* Search button stays on the RIGHT side. */}
              <Pressable
                style={({
                  pressed,
                }) => [
                  styles.headerCircleButton,

                  pressed &&
                    styles.pressed,
                ]}
                onPress={() => {
                  setIsSearchVisible(
                    true,
                  );
                }}
              >
                <Ionicons
                  name="search-outline"
                  size={21}
                  color="#202020"
                />
              </Pressable>
            </>
          )}
        </View>

        {/* =====================================================
         * OFFERS CATEGORY TABS
         * =====================================================
         */}

        {isOffersPage && (
          <View
            style={
              styles.offersTabsContainer
            }
          >
            <ScrollView
              ref={
                offersTabsScrollRef
              }
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              directionalLockEnabled
              contentContainerStyle={
                styles.offersTabsRail
              }
              style={
                styles.offersTabsScroll
              }
              onContentSizeChange={() => {
                if (
                  hasPositionedOffersTabsRef.current
                ) {
                  return;
                }

                hasPositionedOffersTabsRef.current =
                  true;

                requestAnimationFrame(
                  () => {
                    offersTabsScrollRef.current?.scrollToEnd(
                      {
                        animated:
                          false,
                      },
                    );
                  },
                );
              }}
            >
              {offerCategoryTabsForDisplay.map(
                (category) => {
                  const isSelected =
                    selectedFilterKey ===
                    category.id;

                  return (
                    <Pressable
                      key={
                        category.id
                      }
                      style={
                        styles.offersTab
                      }
                      onPress={() => {
                        setSelectedFilterKey(
                          category.id,
                        );

                        setSearchQuery(
                          '',
                        );
                      }}
                    >
                      <Text
                        style={[
                          styles.offersTabText,

                          isSelected &&
                            styles.offersTabTextSelected,
                        ]}
                        numberOfLines={
                          1
                        }
                      >
                        {
                          category.name
                        }
                      </Text>

                      {isSelected && (
                        <View
                          style={
                            styles.offersTabUnderline
                          }
                        />
                      )}
                    </Pressable>
                  );
                },
              )}

              <Pressable
                style={
                  styles.offersTab
                }
                onPress={() => {
                  setSelectedFilterKey(
                    'all',
                  );

                  setSearchQuery('');
                }}
              >
                <Text
                  style={[
                    styles.offersTabText,

                    selectedFilterKey ===
                      'all' &&
                      styles.offersTabTextSelected,
                  ]}
                  numberOfLines={1}
                >
                  الكل
                </Text>

                {selectedFilterKey ===
                  'all' && (
                  <View
                    style={
                      styles.offersTabUnderline
                    }
                  />
                )}
              </Pressable>
            </ScrollView>
          </View>
        )}

        {/* =====================================================
         * CONTENT
         * =====================================================
         */}

        <ScrollView
          style={
            styles.scrollView
          }
          contentContainerStyle={[
            styles.scrollContent,

            {
              paddingBottom:
                shouldShowNormalCartDock
                  ? 180
                  : 30,
            },
          ]}
          onScroll={handleCartDockScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
        >
          {/* ===================================================
           * NORMAL CATEGORY FILTERS
           * ===================================================
           */}

          {!isOffersPage &&
            (selectedSection ||
              fallbackCategory) && (
            <>
              <ScrollView
                ref={
                  filtersScrollRef
                }
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                directionalLockEnabled
                contentContainerStyle={
                  styles.filtersRail
                }
                style={
                  styles.filtersScroll
                }
                onContentSizeChange={() => {
                  /*
                   * When the route changes to another category,
                   * React Native can retain the old x offset.
                   * Position once after the new content is measured.
                   */
                  if (
                    hasPositionedFiltersRef.current
                  ) {
                    return;
                  }

                  requestAnimationFrame(
                    () => {
                      filtersScrollRef.current?.scrollToEnd(
                        {
                          animated:
                            false,
                        },
                      );

                      hasPositionedFiltersRef.current =
                        true;
                    },
                  );
                }}
              >
                {/* CHILD CATEGORIES
                 *
                 * Reversed only for display because this ScrollView
                 * uses a normal row. They come before OFFERS in the
                 * underlying LTR row so the visible Arabic order starts:
                 * الكل → العروض → أول Subcategory → ثاني Subcategory → ...
                 */}

                {childCategoriesForDisplay.map(
                  (child) => {
                    const isSelected =
                      selectedFilterKey ===
                      child.id;

                    return (
                      <Pressable
                        key={
                          child.id
                        }
                        style={
                          styles.filterItem
                        }
                        onPress={() =>
                          openChildCategory(
                            child,
                          )
                        }
                      >
                        <View
                          style={[
                            styles.filterImageCircle,

                            isSelected &&
                              styles.filterImageCircleSelected,
                          ]}
                        >
                          <CategoryFilterVisual
                            section={
                              child
                            }
                          />

                          {child
                            .children
                            .length >
                            0 && (
                            <View
                              style={
                                styles.hasChildrenBadge
                              }
                            >
                              <Ionicons
                                name="chevron-forward"
                                size={
                                  10
                                }
                                color="#FFFFFF"
                              />
                            </View>
                          )}
                        </View>

                        <Text
                          style={[
                            styles.filterLabel,

                            isSelected &&
                              styles.filterLabelSelected,
                          ]}
                          numberOfLines={
                            2
                          }
                        >
                          {
                            child.name
                          }
                        </Text>
                      </Pressable>
                    );
                  },
                )}

                {virtualSubcategoriesForDisplay.map(
                  (subcategory) => {
                    const isSelected =
                      selectedFilterKey ===
                      subcategory.key;

                    return (
                      <Pressable
                        key={
                          subcategory.key
                        }
                        style={
                          styles.filterItem
                        }
                        onPress={() => {
                          setSelectedFilterKey(
                            subcategory.key,
                          );

                          setSearchQuery(
                            '',
                          );
                        }}
                      >
                        <View
                          style={[
                            styles.filterImageCircle,

                            isSelected &&
                              styles.filterImageCircleSelected,
                          ]}
                        >
                          <VirtualCategoryFilterVisual
                            subcategory={
                              subcategory
                            }
                            remoteImageUrl={
                              categoryImageOverrides[
                                normalizeSlug(
                                  subcategory.key,
                                )
                              ] ??
                              null
                            }
                          />
                        </View>

                        <Text
                          style={[
                            styles.filterLabel,

                            isSelected &&
                              styles.filterLabelSelected,
                          ]}
                          numberOfLines={
                            2
                          }
                        >
                          {
                            subcategory.label
                          }
                        </Text>
                      </Pressable>
                    );
                  },
                )}


                {/* ALL — rightmost / selected by default */}

                <Pressable
                  style={
                    styles.filterItem
                  }
                  onPress={() => {
                    setSelectedFilterKey(
                      'all',
                    );

                    setSearchQuery(
                      '',
                    );
                  }}
                >
                  <View
                    style={[
                      styles.filterImageCircle,

                      selectedFilterKey ===
                        'all' &&
                        styles.filterImageCircleSelected,
                    ]}
                  >
                    {categoryImageSection ??
                    selectedSection ? (
                      <CategoryFilterVisual
                        section={
                          categoryImageSection ??
                          selectedSection!
                        }
                        fallbackKey={
                          categoryKey ||
                          fallbackCategory?.key
                        }
                        remoteImageUrl={
                          rootCategoryImageUrl
                        }
                      />
                    ) : fallbackCategory ? (
                      <Image
                        source={
                          rootCategoryImageUrl
                            ? {
                                uri:
                                  rootCategoryImageUrl,
                              }
                            : BOOKSTORE_ROOT_CATEGORY_IMAGES[
                                fallbackCategory.key
                              ]
                        }
                        style={
                          styles.filterCategoryImage
                        }
                        resizeMode="cover"
                      />
                    ) : null}
                  </View>

                  <Text
                    style={[
                      styles.filterLabel,

                      selectedFilterKey ===
                        'all' &&
                        styles.filterLabelSelected,
                    ]}
                    numberOfLines={2}
                  >
                    الكل
                  </Text>
                </Pressable>
              </ScrollView>

              <View
                style={
                  styles.sectionDivider
                }
              />
            </>
          )}

          {/* ===================================================
           * CLOSED
           * ===================================================
           */}

          {isStoreClosed && (
            <View
              style={
                styles.closedBox
              }
            >
              <Text
                style={
                  styles.closedText
                }
              >
                {currentStore.manualClosedNote ??
                  'المكتبة مغلقة حالياً'}
              </Text>
            </View>
          )}

          {/* ===================================================
           * NORMAL PAGE RESULTS COUNT
           * ===================================================
           */}

          {!isOffersPage &&
            filteredProducts.length >
              0 && (
              <View
                style={
                  styles.productsHeader
                }
              >
                <Text
                  style={
                    styles.productsCount
                  }
                >
                  {
                    filteredProducts.length
                  }{' '}
                  منتج
                </Text>
              </View>
            )}

          {/* ===================================================
           * PRODUCTS
           * ===================================================
           */}

          {filteredProducts.length >
          0 ? (
            <View
              style={[
                styles.productsGrid,

                isOffersPage &&
                  styles.offersProductsGrid,
              ]}
            >
              {filteredProducts.map(
                (product) => (
                  <ProductCard
                    key={
                      product.id
                    }
                    product={
                      product
                    }
                    cardWidth={
                      productCardWidth
                    }
                    currencyCode={
                      currencyCode
                    }
                    quantity={getProductQuantity(
                      product.id,
                    )}
                    isStoreClosed={
                      isStoreClosed
                    }
                    mode={
                      isOffersPage
                        ? 'offers'
                        : 'category'
                    }
                    onAdd={() =>
                      addProduct(
                        product,
                      )
                    }
                    onIncrease={() =>
                      increaseProduct(
                        product,
                      )
                    }
                    onDecrease={() =>
                      decreaseProduct(
                        product.id,
                      )
                    }
                  />
                ),
              )}
            </View>
          ) : (
            <View
              style={
                styles.emptyState
              }
            >
              <Text
                style={
                  styles.emptyStateEmoji
                }
              >
                🛍️
              </Text>

              <Text
                style={
                  styles.emptyStateTitle
                }
              >
                لا توجد منتجات
              </Text>

              <Text
                style={
                  styles.emptyStateDescription
                }
              >
                {getEmptyMessage()}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* =====================================================
         * NORMAL CATEGORY CART
         * =====================================================
         */}
        <CategoryCartDock
          itemCount={
            shouldShowNormalCartDock
              ? currentStoreItemCount
              : 0
          }
          subtotal={currentStoreSubtotal}
          minimumOrder={minimumOrder}
          currencyCode={currencyCode}
          accentColor={NAVIENTY_NOW_GREEN}
          accentDarkColor={NAVIENTY_NOW_GREEN_DARK}
          isScrollingDown={isCartDockScrollingDown}
          onPress={openCart}
        />
      </View>
    </SafeAreaView>
  );
}

/* ============================================================
 * STYLES
 * ============================================================
 */

const styles =
  StyleSheet.create({
    screen: {
      backgroundColor:
        '#FFFFFF',

      flex: 1,
    },

    pageShell: {
      alignSelf:
        'center',

      backgroundColor:
        '#FFFFFF',

      flex: 1,

      maxWidth:
        PAGE_MAX_WIDTH,

      position:
        'relative',

      width: '100%',
    },

    /* ========================================================
     * HEADER
     * ========================================================
     */

    header: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      flexDirection:
        'row',

      justifyContent:
        'space-between',

      minHeight: 68,

      paddingHorizontal:
        18,

      paddingVertical:
        10,
    },

    headerCircleButton: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderColor:
        '#E1E1E1',

      borderRadius: 24,

      borderWidth: 1,

      height: 48,

      justifyContent:
        'center',

      width: 48,
    },

    headerTitleGroup: {
      alignItems:
        'center',

      flex: 1,

      justifyContent:
        'center',

      paddingHorizontal:
        12,
    },

    headerTitle: {
      color:
        '#171717',

      flexShrink: 1,

      fontSize: 20,

      fontWeight:
        '700',

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    pressed: {
      backgroundColor:
        '#F6F6F6',

      transform: [
        {
          scale:
            0.97,
        },
      ],
    },

    /* ========================================================
     * SEARCH
     * ========================================================
     */

    searchInputContainer: {
      alignItems:
        'center',

      backgroundColor:
        '#F6F6F6',

      borderColor:
        '#EAEAEA',

      borderRadius: 23,

      borderWidth: 1,

      flex: 1,

      flexDirection:
        'row',

      gap: 7,

      minHeight: 46,

      paddingHorizontal:
        16,
    },

    searchInput: {
      color:
        '#202020',

      flex: 1,

      fontSize: 14,

      minHeight: 44,

      writingDirection:
        'rtl',
    },

    /* ========================================================
     * OFFERS TEXT TABS
     * ========================================================
     */

    offersTabsContainer: {
      backgroundColor:
        '#FFFFFF',

      borderBottomColor:
        '#E8E8E8',

      borderBottomWidth:
        StyleSheet.hairlineWidth,
    },

    offersTabsScroll: {
      flexGrow: 0,
    },

    offersTabsRail: {
      alignItems:
        'stretch',

      flexDirection:
        'row',

      flexGrow: 1,

      gap: 22,

      justifyContent:
        'flex-end',

      paddingHorizontal:
        18,
    },

    offersTab: {
      alignItems:
        'center',

      justifyContent:
        'center',

      minHeight: 50,

      paddingHorizontal:
        1,

      position:
        'relative',
    },

    offersTabText: {
      color:
        '#777777',

      fontSize: 14,

      fontWeight:
        '400',

      lineHeight: 19,

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    offersTabTextSelected: {
      color:
        '#171717',

      fontWeight:
        '700',
    },

    offersTabUnderline: {
      backgroundColor:
        '#202020',

      bottom: 0,

      height: 2,

      left: 0,

      position:
        'absolute',

      right: 0,
    },

    /* ========================================================
     * SCROLL
     * ========================================================
     */

    scrollView: {
      flex: 1,
    },

    scrollContent: {
      backgroundColor:
        '#FFFFFF',
    },

    /* ========================================================
     * NORMAL CATEGORY FILTERS
     * ========================================================
     */

    filtersScroll: {
      flexGrow: 0,
    },

    filtersRail: {
      /*
       * Avoid row-reverse here. On horizontal ScrollViews it can
       * produce inconsistent initial offsets between iOS/Android and
       * when Expo Router reuses the screen.
       *
       * Items are explicitly arranged in the JSX and we scroll to the
       * right edge when a category opens.
       */
      flexDirection:
        'row',

      flexGrow: 1,

      gap: 17,

      justifyContent:
        'flex-end',

      paddingBottom:
        17,

      paddingHorizontal:
        18,

      paddingTop: 7,
    },

    filterItem: {
      alignItems:
        'center',

      width: 79,
    },

    filterImageCircle: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderColor:
        'transparent',

      borderRadius: 39,

      borderWidth: 2.4,

      height: 78,

      justifyContent:
        'center',

      overflow:
        'hidden',

      position:
        'relative',

      width: 78,
    },

    filterImageCircleSelected: {
      borderColor:
        '#202020',
    },

    filterCategoryImage: {
      height: '100%',

      width: '100%',
    },

    filterImagePlaceholder: {
      backgroundColor:
        '#F3F3F3',

      height: '100%',

      width: '100%',
    },

    filterLabel: {
      color:
        '#666666',

      fontSize: 12.5,

      lineHeight: 17,

      marginTop: 6,

      minHeight: 34,

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    filterLabelSelected: {
      color:
        '#1D1D1D',

      fontWeight:
        '700',
    },

    hasChildrenBadge: {
      alignItems:
        'center',

      backgroundColor:
        '#202020',

      borderColor:
        '#FFFFFF',

      borderRadius: 9,

      borderWidth: 2,

      bottom: 1,

      height: 18,

      justifyContent:
        'center',

      position:
        'absolute',

      right: 0,

      width: 18,
    },

    sectionDivider: {
      backgroundColor:
        '#F0F0F0',

      elevation: 2,

      height: 7,

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: 2,
      },

      shadowOpacity:
        0.04,

      shadowRadius: 3,
    },

    /* ========================================================
     * CLOSED
     * ========================================================
     */

    closedBox: {
      backgroundColor:
        '#222222',

      borderRadius: 8,

      marginHorizontal:
        16,

      marginTop: 14,

      paddingHorizontal:
        14,

      paddingVertical:
        10,
    },

    closedText: {
      color:
        '#FFFFFF',

      fontSize: 12,

      fontWeight:
        '600',

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    /* ========================================================
     * PRODUCTS HEADER
     * ========================================================
     */

    productsHeader: {
      alignItems:
        'flex-end',

      paddingHorizontal:
        16,

      paddingTop: 15,
    },

    productsCount: {
      color:
        '#8A8A8A',

      fontSize: 12,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    /* ========================================================
     * PRODUCT GRID
     * ========================================================
     */

    productsGrid: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap:
        PRODUCT_GAP,

      paddingHorizontal:
        HORIZONTAL_PADDING,

      paddingTop: 11,
    },

    /*
     * أول Product في صفحة العروض
     * يظهر يمين الشاشة مثل الصورة.
     */
    offersProductsGrid: {
      flexDirection:
        'row-reverse',

      paddingTop: 12,
    },

    productCard: {
      backgroundColor:
        '#FFFFFF',

      marginBottom: 16,
    },

    offersProductCard: {
      marginBottom: 13,
    },

    productImageBox: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderColor:
        '#E1E1E1',

      borderRadius: 20,

      borderWidth: 1,

      justifyContent:
        'center',

      overflow:
        'hidden',

      position:
        'relative',

      width: '100%',
    },

    offersProductImageBox: {
      backgroundColor:
        '#FFFFFF',

      borderColor:
        '#DEDEDE',

      borderRadius: 20,
    },

    /*
     * Book covers keep their full aspect ratio, but now live inside
     * the same white product shell used across the catalog.
     */
    productImage: {
      height: '88%',

      width: '88%',
    },

    productFallback: {
      fontSize: 44,
    },

    /* ========================================================
     * DISCOUNT BADGES
     * ========================================================
     */

    discountBadgeBase: {
      alignItems:
        'center',

      borderRadius: 4,

      justifyContent:
        'center',

      minHeight: 22,

      paddingHorizontal:
        7,

      paddingVertical:
        3,

      position:
        'absolute',

      top: 7,

      zIndex: 5,
    },

    categoryDiscountBadge: {
      backgroundColor:
        '#FFF1B7',

      left: 8,
    },

    offersDiscountBadge: {
      backgroundColor:
        '#C7FF00',

      right: 8,
    },

    discountText: {
      color:
        '#8B6813',

      fontSize: 10,

      fontWeight:
        '700',

      lineHeight: 13,
    },

    offersDiscountText: {
      color:
        '#181818',

      fontSize: 11,

      fontWeight:
        '700',
    },

    /* ========================================================
     * ADD BUTTON
     * ========================================================
     */

    addButton: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderColor:
        '#E1E1E1',

      borderRadius: 21,

      borderWidth: 1,

      bottom: 8,

      elevation: 3,

      height: 42,

      justifyContent:
        'center',

      position:
        'absolute',

      right: 8,

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 42,
        height: 2,
      },

      shadowOpacity:
        0.08,

      shadowRadius: 5,

      width: 50,

      zIndex: 7,
    },

    offersAddButton: {
      borderRadius: 20,

      bottom: 8,

      height: 40,

      right: 8,

      width: 40,
    },

    addButtonPressed: {
      backgroundColor:
        '#F7F7F7',

      transform: [
        {
          scale: 0.95,
        },
      ],
    },

    disabledButton: {
      opacity: 0.45,
    },

    addButtonText: {
      color:
        NAVIENTY_NOW_GREEN,

      fontSize: 31,

      fontWeight:
        '300',

      lineHeight: 33,

      marginTop: -3,
    },

    offersAddButtonText: {
      fontSize: 29,

      lineHeight: 31,
    },

    /* ========================================================
     * QUANTITY
     * ========================================================
     */

    quantityPill: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderColor:
        '#E1E1E1',

      borderRadius: 21,

      borderWidth: 1,

      bottom: 8,

      elevation: 3,

      flexDirection:
        'row',

      height: 42,

      position:
        'absolute',

      right: 8,

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: 2,
      },

      shadowOpacity:
        0.08,

      shadowRadius: 5,

      zIndex: 7,
    },

    offersQuantityPill: {
      borderRadius: 20,

      height: 40,
    },

    quantityAction: {
      alignItems:
        'center',

      height: 40,

      justifyContent:
        'center',

      width: 28,
    },

    quantityActionText: {
      color:
        NAVIENTY_NOW_GREEN,

      fontSize: 19,

      fontWeight:
        '500',
    },

    quantityText: {
      color:
        '#202020',

      fontSize: 12,

      fontWeight:
        '700',

      minWidth: 16,

      textAlign:
        'center',
    },

    /* ========================================================
     * PRODUCT TEXT
     * ========================================================
     */

    productName: {
      color:
        '#202020',

      fontSize: 14,

      fontWeight:
        '500',

      lineHeight: 19,

      marginTop: 8,

      minHeight: 38,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    offersProductName: {
      fontSize: 13.5,

      fontWeight:
        '500',

      lineHeight: 18,

      marginTop: 8,

      minHeight: 36,
    },

    productUnitLabel: {
      color:
        '#999999',

      fontSize: 11.5,

      marginTop: 2,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    offersProductUnitLabel: {
      color:
        '#969696',

      fontSize: 11.5,

      minHeight: 15,
    },

    /* ========================================================
     * NORMAL PRICE
     * ========================================================
     */

    priceColumn: {
      alignItems:
        'flex-end',

      marginTop: 7,
    },

    currentPrice: {
      color:
        '#202020',

      fontSize: 14,

      fontWeight:
        '600',

      textAlign:
        'right',
    },

    oldPrice: {
      color:
        '#969696',

      fontSize: 11.5,

      marginTop: 3,

      textDecorationLine:
        'line-through',
    },

    /* ========================================================
     * OFFERS PRICE — SAME LOOK AS SCREENSHOT
     * ========================================================
     */

    offersPriceRow: {
      alignItems:
        'center',

      flexDirection:
        'row-reverse',

      flexWrap:
        'wrap',

      gap: 5,

      justifyContent:
        'flex-start',

      marginTop: 6,

      minHeight: 20,
    },

    offersCurrentPriceUnderline: {
      borderBottomColor:
        '#C7FF00',

      borderBottomWidth: 2,

      paddingBottom: 0,
    },

    offersCurrentPrice: {
      color:
        '#181818',

      fontSize: 14,

      fontWeight:
        '700',

      lineHeight: 18,

      writingDirection:
        'rtl',
    },

    offersOldPrice: {
      color:
        '#8D8D8D',

      fontSize: 11.5,

      fontWeight:
        '400',

      lineHeight: 18,

      textDecorationLine:
        'line-through',

      writingDirection:
        'rtl',
    },

    /* ========================================================
     * EMPTY
     * ========================================================
     */

    emptyState: {
      alignItems:
        'center',

      paddingHorizontal:
        30,

      paddingTop: 70,
    },

    emptyStateEmoji: {
      fontSize: 40,
    },

    emptyStateTitle: {
      color:
        '#202020',

      fontSize: 17,

      fontWeight:
        '700',

      marginTop: 15,
    },

    emptyStateDescription: {
      color:
        '#777777',

      fontSize: 13,

      lineHeight: 20,

      marginTop: 7,

      maxWidth: 300,

      textAlign:
        'center',
    },

    /* ========================================================
     * NORMAL CART DOCK
     * ========================================================
     */

    cartDock: {
      backgroundColor:
        '#FFFFFF',

      borderTopColor:
        '#EEEEEE',

      borderTopWidth:
        StyleSheet.hairlineWidth,

      bottom: 0,

      elevation: 12,

      left: 0,

      paddingBottom: 12,

      paddingHorizontal:
        16,

      paddingTop: 11,

      position:
        'absolute',

      right: 0,

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: -2,
      },

      shadowOpacity:
        0.08,

      shadowRadius: 8,
    },

    cartMessage: {
      color:
        '#242424',

      fontSize: 12.5,

      fontWeight:
        '500',

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    progressTrack: {
      backgroundColor:
        '#E7E7E7',

      borderRadius: 4,

      height: 4,

      marginTop: 10,

      overflow:
        'hidden',
    },

    progressValue: {
      backgroundColor:
        '#202020',

      borderRadius: 4,

      height: 4,
    },

    basketButton: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_GREEN,

      borderRadius: 28,

      flexDirection:
        'row',

      height: 56,

      justifyContent:
        'space-between',

      marginTop: 11,

      paddingHorizontal:
        18,
    },

    basketButtonPressed: {
      opacity: 0.9,

      transform: [
        {
          scale:
            0.985,
        },
      ],
    },

    basketTotal: {
      color:
        '#FFFFFF',

      fontSize: 14,

      fontWeight:
        '700',

      minWidth: 78,
    },

    basketButtonTitle: {
      color:
        '#FFFFFF',

      fontSize: 17,

      fontWeight:
        '700',
    },

    basketCount: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_GREEN_DARK,

      borderRadius: 21,

      height: 42,

      justifyContent:
        'center',

      width: 42,
    },

    basketCountText: {
      color:
        '#FFFFFF',

      fontSize: 15,

      fontWeight:
        '700',
    },

    /* ========================================================
     * STATE
     * ========================================================
     */

    stateScreen: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      flex: 1,

      justifyContent:
        'center',

      paddingHorizontal:
        28,
    },

    stateEmoji: {
      fontSize: 40,
    },

    stateTitle: {
      color:
        '#202020',

      fontSize: 18,

      fontWeight:
        '800',

      marginTop: 14,

      textAlign:
        'center',
    },

    stateDescription: {
      color:
        '#777777',

      fontSize: 13,

      lineHeight: 20,

      marginTop: 8,

      maxWidth: 330,

      textAlign:
        'center',
    },

    retryButton: {
      backgroundColor:
        '#222222',

      borderRadius: 14,

      marginTop: 20,

      minWidth: 160,

      paddingHorizontal:
        20,

      paddingVertical:
        13,
    },

    retryButtonText: {
      color:
        '#FFFFFF',

      fontSize: 13,

      fontWeight:
        '700',

      textAlign:
        'center',
    },

    backErrorButton: {
      borderColor:
        '#E0E0E0',

      borderRadius: 14,

      borderWidth: 1,

      marginTop: 10,

      minWidth: 160,

      paddingHorizontal:
        20,

      paddingVertical:
        12,
    },

    backErrorButtonText: {
      color:
        '#222222',

      fontSize: 13,

      fontWeight:
        '600',

      textAlign:
        'center',
    },
  });

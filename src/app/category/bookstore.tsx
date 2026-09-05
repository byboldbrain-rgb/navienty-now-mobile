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
  Animated,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PrintingJobBuilder from '../../components/bookstore/printing-job-builder';
import CategoryCartDock, {
  useCartDockScrollBehavior,
} from '../../components/cart/category-cart-dock';
import CategorySearchEntry from '../../components/search/category-search-entry';
import Image from '../../components/ui/app-image';
import { CatalogHomeScreenSkeleton } from '../../components/ui/loading-skeleton';
import {
  type BookstorePromotionBanner,
  listBookstorePromotionBanners,
} from '../../services/bookstore-banner-service';
import getAppBootstrap from '../../services/bootstrap-service';
import {
  type CatalogProduct,
  type CatalogSection,
  getCatalogSectionProducts,
  getStoreCatalog,
  listStores,
  type StoreBusinessHour,
  type StoreCatalog,
} from '../../services/catalog-service';
import {
  listStorefrontCategoryTiles,
  type StorefrontCategoryTile,
} from '../../services/storefront-category-service';
import { useCartStore } from '../../store/cart-store';
import { useCustomerStore } from '../../store/customer-store';
import { NAVIENTY_NOW_COLORS } from '../../theme/navienty-now-theme';

const CATEGORY_COLUMNS_PER_ROW = 4;
const CATEGORY_HORIZONTAL_PADDING = 16;
const CATEGORY_COLUMN_GAP = 7;

const PRINTING_SERVICE_SLUG =
  'printing-paper-printing-service';

/**
 * Local bookstore category artwork.
 *
 * Put your category images inside:
 * assets/images/bookstore-categories/
 *
 * Keep each filename exactly the same as its category slug below.
 * Metro requires static require(...) paths, so do not convert these
 * paths to a dynamic template string.
 */
const BOOKSTORE_CATEGORY_IMAGES: Partial<
  Record<string, ImageSourcePropType>
> = {
  offers: require(
    '../../../assets/images/supermarket-categories/offers.webp',
  ),
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

type BookstoreCategoryDefinition = {
  key: string;
  label: string;
  aliases: string[];
  isOffers?: boolean;
};

/**
 * The exact order shown in the bookstore category rail.
 * The first item is positioned at the far-right edge.
 */
const BOOKSTORE_CATEGORIES: BookstoreCategoryDefinition[] = [
  {
    key: 'offers',
    label: 'عروض',
    aliases: [
      'offers',
      'offer',
      'deals',
      'deal',
      'discounts',
      'discount',
      'promotions',
      'promotion',
      'sale',
      'sales',
      'special-offers',
      'special-offer',
      'special-deals',
      'special-deal',
      'discounted-products',
      'discounted',
    ],
    isOffers: true,
  },
  {
    key: 'writing-tools',
    label: 'أدوات الكتابة',
    aliases: [
      'writing-tools',
      'pens-writing-tools',
      'pens-and-writing-tools',
      'أدوات الكتابة',
      'ادوات الكتابة',
      'أقلام وادوات كتابة',
      'اقلام وادوات كتابة',
    ],
  },
  {
    key: 'art-supplies',
    label: 'رسم وفنون',
    aliases: [
      'art-supplies',
      'drawing-art',
      'drawing-and-art',
      'art-drawing',
      'رسم وفنون',
      'الرسم والفنون',
    ],
  },
  {
    key: 'notebooks',
    label: 'كراسات ونوت بوك',
    aliases: [
      'notebooks',
      'notebooks-copybooks',
      'notebooks-and-copybooks',
      'copybooks-notebooks',
      'كراسات ونوت بوك',
      'الكراسات والنوت بوك',
    ],
  },
  {
    key: 'geometry-tools',
    label: 'أدوات هندسية',
    aliases: [
      'geometry-tools',
      'geometric-tools',
      'engineering-tools',
      'geometry-and-engineering-tools',
      'أدوات هندسية',
      'ادوات هندسية',
      'الأدوات الهندسية',
    ],
  },
  {
    key: 'printing-paper',
    label: 'طباعة أوراق',
    aliases: [
      'printing-paper',
      'paper-printing',
      'printing-and-paper',
      'printing-papers',
      'طباعة أوراق',
      'طباعة اوراق',
      'الطباعة والأوراق',
    ],
  },
  {
    key: 'cups-cans',
    label: 'أكواب ومعلبات',
    aliases: [
      'cups-cans',
      'cups-and-cans',
      'mugs-cans',
      'mugs-and-cans',
      'cups',
      'mugs',
      'أكواب ومعلبات',
      'اكواب ومعلبات',
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
      'مقالم وشنط',
      'المقالم والشنط',
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
      'ورد',
      'زهور',
    ],
  },
];

type CategoryDisplayItem = {
  key: string;
  slug: string;
  label: string;
  imageSource: ImageSourcePropType | null;
  imageUrl: string | null;
  section: CatalogSection | null;
  isOffers: boolean;
};

type ResolvedPromotionBanner =
  BookstorePromotionBanner & {
    products: CatalogProduct[];
  };

type FeaturedProductCardProps = {
  product: CatalogProduct;
  currencyCode: string;
  cardWidth: number;
  quantity: number;
  isStoreClosed: boolean;
  onAdd: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
};

function getProductImage(
  product: CatalogProduct,
): string | null {
  if (product.imageUrl) {
    return product.imageUrl;
  }

  const coverImage = product.images.find(
    (image) => image.isCover,
  );

  if (coverImage) {
    return coverImage.imageUrl;
  }

  return product.images[0]?.imageUrl ?? null;
}

function getDiscountPercent(
  product: CatalogProduct,
): number | null {
  const compareAtPrice = product.compareAtPrice;

  if (
    compareAtPrice === null ||
    compareAtPrice <= product.price ||
    compareAtPrice <= 0
  ) {
    return null;
  }

  return Math.round(
    ((compareAtPrice - product.price) /
      compareAtPrice) *
      100,
  );
}

function formatMoney(
  amount: number,
  currencyCode: string,
) {
  return `${getArabicCurrencyLabel(
    currencyCode,
  )} ${amount.toFixed(2)}`;
}

function getArabicCurrencyLabel(
  currencyCode: string,
) {
  if (
    currencyCode.trim().toUpperCase() === 'EGP'
  ) {
    return 'ج.م';
  }

  return currencyCode;
}

function formatCartMoney(
  amount: number,
  currencyCode: string,
) {
  return `${getArabicCurrencyLabel(
    currencyCode,
  )} ${amount.toFixed(2)}`;
}

function makeCategoryColumns(
  categories: CategoryDisplayItem[],
) {
  const rowCount = Math.ceil(
    categories.length /
      CATEGORY_COLUMNS_PER_ROW,
  );
  const columns: CategoryDisplayItem[][] = [];

  for (
    let columnIndex = 0;
    columnIndex < CATEGORY_COLUMNS_PER_ROW;
    columnIndex += 1
  ) {
    const column: CategoryDisplayItem[] = [];

    for (
      let rowIndex = 0;
      rowIndex < rowCount;
      rowIndex += 1
    ) {
      const item =
        categories[
          rowIndex *
            CATEGORY_COLUMNS_PER_ROW +
            columnIndex
        ];

      if (item) {
        column.push(item);
      }
    }

    if (column.length > 0) {
      columns.push(column);
    }
  }

  return columns;
}

function normalizeCategoryValue(
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

function getSingleRouteParam(
  value:
    | string
    | string[]
    | undefined,
) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

function isPrintingCategoryItem(
  item: CategoryDisplayItem,
) {
  const values = [
    item.key,
    item.slug,
    item.label,
    item.section?.slug,
    item.section?.name,
    item.section?.nameEn,
  ]
    .filter(
      (
        value,
      ): value is string =>
        Boolean(value),
    )
    .map(normalizeCategoryValue);

  return values.some(
    (value) =>
      value ===
        normalizeCategoryValue(
          'printing-paper',
        ) ||
      value ===
        normalizeCategoryValue(
          PRINTING_SERVICE_SLUG,
        ) ||
      value ===
        normalizeCategoryValue(
          'طباعة أوراق',
        ),
  );
}

function findPrintingServiceSection(
  catalog: StoreCatalog,
  rootSection:
    | CatalogSection
    | null,
) {
  const normalizedPrintingSlug =
    normalizeCategoryValue(
      PRINTING_SERVICE_SLUG,
    );

  const candidates = [
    ...(rootSection?.children ?? []),
    ...catalog.sections,
    ...catalog.categoryTree,
  ];

  const exactChild =
    candidates.find(
      (section) =>
        normalizeCategoryValue(
          section.slug,
        ) ===
          normalizedPrintingSlug &&
        (
          !rootSection ||
          section.parentId ===
            rootSection.id
        ),
    );

  if (exactChild) {
    return exactChild;
  }

  return (
    candidates.find(
      (section) =>
        normalizeCategoryValue(
          section.slug,
        ) ===
        normalizedPrintingSlug,
    ) ?? null
  );
}

function findBookstoreCategorySection(
  definition: BookstoreCategoryDefinition,
  sections: CatalogSection[],
) {
  const acceptedValues = new Set(
    [
      definition.key,
      definition.label,
      ...definition.aliases,
    ].map(normalizeCategoryValue),
  );

  return (
    sections.find((section) =>
      [
        section.slug,
        section.name,
        section.nameEn,
      ].some((value) =>
        acceptedValues.has(
          normalizeCategoryValue(value),
        ),
      ),
    ) ?? null
  );
}

function findBookstoreStorefrontSection(
  tile: StorefrontCategoryTile,
  sections: CatalogSection[],
): CatalogSection | null {
  const acceptedValues = new Set(
    [
      tile.key,
      tile.routeSlug,
      tile.labelAr,
      ...tile.sourceSlugs,
    ].map(normalizeCategoryValue),
  );

  return (
    sections.find((section) =>
      [
        section.slug,
        section.name,
        section.nameEn,
      ].some((value) =>
        acceptedValues.has(
          normalizeCategoryValue(value),
        ),
      ),
    ) ?? null
  );
}

function getBookstoreCategoryFallbackIcon(
  item: CategoryDisplayItem,
) {
  const searchableValue = [
    item.key,
    item.slug,
    item.label,
    item.section?.slug ?? '',
    item.section?.name ?? '',
    item.section?.nameEn ?? '',
  ]
    .join(' ')
    .toLowerCase();

  const rules: Array<[string[], string]> = [
    [
      [
        'flower',
        'flowers',
        'rose',
        'roses',
        'ورد',
        'زهور',
      ],
      '💐',
    ],
    [
      [
        'cup',
        'cups',
        'mug',
        'mugs',
        'can',
        'cans',
        'كوب',
        'أكواب',
        'اكواب',
        'معلبات',
      ],
      '☕',
    ],
    [
      [
        'pencil-case',
        'pencil-cases',
        'school-bag',
        'school-bags',
        'مقلمة',
        'مقالم',
        'شنطة',
        'شنط',
      ],
      '🎒',
    ],
    [
      [
        'geometry',
        'geometric',
        'engineering-tools',
        'هندسية',
        'هندسيه',
      ],
      '📐',
    ],
    [
      [
        'book',
        'books',
        'textbook',
        'textbooks',
        'كتاب',
        'كتب',
        'مراجع',
      ],
      '📚',
    ],
    [
      [
        'notebook',
        'notebooks',
        'copybook',
        'كشكول',
        'كشاكيل',
        'دفتر',
        'دفاتر',
      ],
      '📓',
    ],
    [
      [
        'pen',
        'pens',
        'pencil',
        'pencils',
        'writing',
        'قلم',
        'اقلام',
        'أقلام',
      ],
      '✏️',
    ],
    [
      [
        'stationery',
        'school-supplies',
        'school supplies',
        'ادوات مكتبية',
        'أدوات مكتبية',
        'ادوات مدرسية',
        'أدوات مدرسية',
      ],
      '🖇️',
    ],
    [
      [
        'art',
        'drawing',
        'painting',
        'color',
        'colors',
        'رسم',
        'الوان',
        'ألوان',
      ],
      '🎨',
    ],
    [
      [
        'paper',
        'papers',
        'ورق',
        'اوراق',
        'أوراق',
      ],
      '📄',
    ],
    [
      [
        'file',
        'files',
        'folder',
        'folders',
        'ملف',
        'ملفات',
      ],
      '📁',
    ],
    [
      [
        'calculator',
        'calculators',
        'آلة حاسبة',
        'اله حاسبة',
      ],
      '🧮',
    ],
    [
      [
        'office',
        'desk',
        'مكتب',
        'مكتبية',
      ],
      '🗂️',
    ],
    [
      [
        'gift',
        'gifts',
        'هدية',
        'هدايا',
      ],
      '🎁',
    ],
  ];

  for (const [keywords, icon] of rules) {
    if (
      keywords.some((keyword) =>
        searchableValue.includes(keyword),
      )
    ) {
      return icon;
    }
  }

  return '📚';
}

function BackArrowIcon() {
  return (
    <View style={styles.backArrowCanvas}>
      <View style={styles.backArrowStem} />
      <View
        style={[
          styles.backArrowDiagonal,
          styles.backArrowTop,
        ]}
      />
      <View
        style={[
          styles.backArrowDiagonal,
          styles.backArrowBottom,
        ]}
      />
    </View>
  );
}

const ARABIC_WEEK_DAYS = [
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

function parseBusinessTime(
  value: string | null,
): {
  hours: number;
  minutes: number;
} | null {
  if (!value) {
    return null;
  }

  const parts = value.split(':');

  const hours = Number(parts[0]);
  const minutes = Number(parts[1] ?? 0);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return {
    hours,
    minutes,
  };
}

function getBusinessMinutes(
  value: string | null,
): number | null {
  const parsed = parseBusinessTime(value);

  if (!parsed) {
    return null;
  }

  return parsed.hours * 60 + parsed.minutes;
}

function formatBusinessTime(
  value: string | null,
): string | null {
  const parsed = parseBusinessTime(value);

  if (!parsed) {
    return null;
  }

  const period =
    parsed.hours >= 12 ? 'م' : 'ص';

  let displayHours = parsed.hours % 12;

  if (displayHours === 0) {
    displayHours = 12;
  }

  return `${displayHours}:${String(
    parsed.minutes,
  ).padStart(2, '0')} ${period}`;
}

function isStoreOpenByBusinessHours(
  businessHours: StoreBusinessHour[],
  now = new Date(),
): boolean {
  /*
   * لو مفيش مواعيد مسجلة، نحافظ
   * على السلوك الحالي ولا نقفل
   * المكتبة تلقائيًا.
   */
  if (businessHours.length === 0) {
    return true;
  }

  const currentDay = now.getDay();
  const previousDay = (currentDay + 6) % 7;

  const currentMinutes =
    now.getHours() * 60 +
    now.getMinutes();

  const todayHours = businessHours.find(
    (item) =>
      item.dayOfWeek === currentDay,
  );

  if (todayHours?.isOpen) {
    const openMinutes =
      getBusinessMinutes(
        todayHours.openTime,
      );

    const closeMinutes =
      getBusinessMinutes(
        todayHours.closeTime,
      );

    if (
      openMinutes !== null &&
      closeMinutes !== null
    ) {
      if (closeMinutes > openMinutes) {
        if (
          currentMinutes >= openMinutes &&
          currentMinutes < closeMinutes
        ) {
          return true;
        }
      } else if (
        closeMinutes < openMinutes
      ) {
        /*
         * مثال:
         * 20:00 → 02:00
         */
        if (
          currentMinutes >= openMinutes
        ) {
          return true;
        }
      } else {
        /*
         * نفس وقت الفتح والإغلاق
         * نعتبره 24 ساعة.
         */
        return true;
      }
    }
  }

  /*
   * دعم المواعيد الممتدة
   * بعد منتصف الليل.
   */
  const previousHours =
    businessHours.find(
      (item) =>
        item.dayOfWeek === previousDay,
    );

  if (previousHours?.isOpen) {
    const previousOpenMinutes =
      getBusinessMinutes(
        previousHours.openTime,
      );

    const previousCloseMinutes =
      getBusinessMinutes(
        previousHours.closeTime,
      );

    if (
      previousOpenMinutes !== null &&
      previousCloseMinutes !== null &&
      previousCloseMinutes <
        previousOpenMinutes &&
      currentMinutes <
        previousCloseMinutes
    ) {
      return true;
    }
  }

  return false;
}

function getNextOpeningLabel(
  businessHours: StoreBusinessHour[],
  now = new Date(),
): string | null {
  if (businessHours.length === 0) {
    return null;
  }

  const currentDay = now.getDay();

  for (
    let dayOffset = 0;
    dayOffset <= 7;
    dayOffset += 1
  ) {
    const targetDay =
      (currentDay + dayOffset) % 7;

    const schedule =
      businessHours.find(
        (item) =>
          item.dayOfWeek === targetDay &&
          item.isOpen,
      );

    if (
      !schedule ||
      !schedule.openTime
    ) {
      continue;
    }

    const parsedOpenTime =
      parseBusinessTime(
        schedule.openTime,
      );

    const displayTime =
      formatBusinessTime(
        schedule.openTime,
      );

    if (
      !parsedOpenTime ||
      !displayTime
    ) {
      continue;
    }

    const openingDate = new Date(now);

    openingDate.setDate(
      now.getDate() + dayOffset,
    );

    openingDate.setHours(
      parsedOpenTime.hours,
      parsedOpenTime.minutes,
      0,
      0,
    );

    if (
      openingDate.getTime() <=
      now.getTime()
    ) {
      continue;
    }

    if (dayOffset === 0) {
      return `تفتح اليوم الساعة ${displayTime}`;
    }

    if (dayOffset === 1) {
      return `تفتح بكرة الساعة ${displayTime}`;
    }

    return `تفتح يوم ${ARABIC_WEEK_DAYS[targetDay]} الساعة ${displayTime}`;
  }

  return null;
}

function ClosedBookstoreBackArrowIcon() {
  return (
    <View
      style={
        styles.closedBookstoreBackArrowCanvas
      }
    >
      <View
        style={
          styles.closedBookstoreBackArrowStem
        }
      />

      <View
        style={[
          styles.closedBookstoreBackArrowDiagonal,
          styles.closedBookstoreBackArrowTop,
        ]}
      />

      <View
        style={[
          styles.closedBookstoreBackArrowDiagonal,
          styles.closedBookstoreBackArrowBottom,
        ]}
      />
    </View>
  );
}

function ClosedBookstoreExperience({
  nextOpeningLabel,
}: {
  nextOpeningLabel: string | null;
}) {
  const floatY = useRef(
    new Animated.Value(0),
  ).current;

  const pulse = useRef(
    new Animated.Value(0),
  ).current;

  const pencilX = useRef(
    new Animated.Value(0),
  ).current;

  useEffect(() => {
    const floatAnimation =
      Animated.loop(
        Animated.sequence([
          Animated.timing(
            floatY,
            {
              toValue: -5,
              duration: 1600,
              useNativeDriver: true,
            },
          ),
          Animated.timing(
            floatY,
            {
              toValue: 0,
              duration: 1600,
              useNativeDriver: true,
            },
          ),
        ]),
      );

    const pulseAnimation =
      Animated.loop(
        Animated.sequence([
          Animated.timing(
            pulse,
            {
              toValue: 1,
              duration: 1800,
              useNativeDriver: true,
            },
          ),
          Animated.timing(
            pulse,
            {
              toValue: 0,
              duration: 1800,
              useNativeDriver: true,
            },
          ),
        ]),
      );

    const pencilAnimation =
      Animated.loop(
        Animated.sequence([
          Animated.timing(
            pencilX,
            {
              toValue: 9,
              duration: 1750,
              useNativeDriver: true,
            },
          ),
          Animated.timing(
            pencilX,
            {
              toValue: 0,
              duration: 1750,
              useNativeDriver: true,
            },
          ),
        ]),
      );

    floatAnimation.start();
    pulseAnimation.start();
    pencilAnimation.start();

    return () => {
      floatAnimation.stop();
      pulseAnimation.stop();
      pencilAnimation.stop();
    };
  }, [
    floatY,
    pencilX,
    pulse,
  ]);

  const glowOpacity =
    pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [
        0.13,
        0.28,
      ],
    });

  const starOpacity =
    pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [
        0.42,
        0.94,
      ],
    });

  return (
    <View
      style={
        styles.closedBookstoreExperience
      }
    >
      <Animated.View
        style={[
          styles.closedBookstoreGlow,
          {
            opacity:
              glowOpacity,
          },
        ]}
      />

      <View
        style={
          styles.closedBookstoreMoon
        }
      >
        <View
          style={
            styles.closedBookstoreMoonCutout
          }
        />
      </View>

      <Animated.View
        style={[
          styles.closedBookstoreStar,
          styles.closedBookstoreStarOne,
          {
            opacity:
              starOpacity,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.closedBookstoreStar,
          styles.closedBookstoreStarTwo,
          {
            opacity:
              starOpacity,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.closedBookstoreStar,
          styles.closedBookstoreStarThree,
          {
            opacity:
              starOpacity,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.closedBookstoreStore,
          {
            transform: [
              {
                translateY:
                  floatY,
              },
            ],
          },
        ]}
      >
        <View
          style={
            styles.closedBookstoreRoof
          }
        />

        <View
          style={
            styles.closedBookstoreAwning
          }
        >
          {[
            '#263B75',
            '#F5E7B7',
            '#263B75',
            '#F5E7B7',
            '#263B75',
          ].map(
            (
              color,
              index,
            ) => (
              <View
                key={`closed-bookstore-awning-${index}`}
                style={[
                  styles.closedBookstoreAwningStripe,
                  {
                    backgroundColor:
                      color,
                  },
                ]}
              />
            ),
          )}
        </View>

        <View
          style={
            styles.closedBookstoreBuilding
          }
        >
          <View
            style={
              styles.closedBookstoreWindow
            }
          >
            <View
              style={
                styles.closedBookstoreShelfTop
              }
            >
              <View
                style={[
                  styles.closedBookstoreBookTall,
                  styles.closedBookstoreBookBlue,
                ]}
              />
              <View
                style={[
                  styles.closedBookstoreBookShort,
                  styles.closedBookstoreBookYellow,
                ]}
              />
              <View
                style={[
                  styles.closedBookstoreBookTall,
                  styles.closedBookstoreBookGreen,
                ]}
              />
              <View
                style={[
                  styles.closedBookstoreBookMedium,
                  styles.closedBookstoreBookCream,
                ]}
              />
            </View>

            <View
              style={
                styles.closedBookstoreShelfBottom
              }
            >
              <View
                style={[
                  styles.closedBookstoreBookMedium,
                  styles.closedBookstoreBookCream,
                ]}
              />
              <View
                style={[
                  styles.closedBookstoreBookTall,
                  styles.closedBookstoreBookYellow,
                ]}
              />
              <View
                style={[
                  styles.closedBookstoreBookShort,
                  styles.closedBookstoreBookBlue,
                ]}
              />
              <View
                style={[
                  styles.closedBookstoreBookMedium,
                  styles.closedBookstoreBookGreen,
                ]}
              />
            </View>

            <View
              style={
                styles.closedBookstoreShutter
              }
            >
              {Array.from({
                length: 8,
              }).map(
                (
                  _,
                  index,
                ) => (
                  <View
                    key={`closed-bookstore-shutter-${index}`}
                    style={
                      styles.closedBookstoreShutterLine
                    }
                  />
                ),
              )}
            </View>
          </View>

          <View
            style={
              styles.closedBookstoreDoorBase
            }
          >
            <View
              style={
                styles.closedBookstoreLock
              }
            >
              <View
                style={
                  styles.closedBookstoreLockDot
                }
              />
            </View>
          </View>
        </View>

        <View
          style={
            styles.closedBookstoreGroundShadow
          }
        />
      </Animated.View>

      <View
        style={
          styles.closedBookstoreOpenBook
        }
      >
        <View
          style={
            styles.closedBookstoreBookLeftPage
          }
        >
          <View
            style={
              styles.closedBookstorePageLineOne
            }
          />
          <View
            style={
              styles.closedBookstorePageLineTwo
            }
          />
        </View>

        <View
          style={
            styles.closedBookstoreBookRightPage
          }
        >
          <View
            style={
              styles.closedBookstorePageLineOne
            }
          />
          <View
            style={
              styles.closedBookstorePageLineTwo
            }
          />
        </View>

        <View
          style={
            styles.closedBookstoreBookSpine
          }
        />
      </View>

      <Animated.View
        style={[
          styles.closedBookstorePencil,
          {
            transform: [
              {
                translateX:
                  pencilX,
              },
              {
                rotate:
                  '-28deg',
              },
            ],
          },
        ]}
      >
        <View
          style={
            styles.closedBookstorePencilBody
          }
        />
        <View
          style={
            styles.closedBookstorePencilBand
          }
        />
        <View
          style={
            styles.closedBookstorePencilEraser
          }
        />
        <View
          style={
            styles.closedBookstorePencilTip
          }
        />
      </Animated.View>

      <View
        style={
          styles.closedBookstoreCopy
        }
      >
        <Text
          style={
            styles.closedBookstoreTitle
          }
        >
          المكتبة مغلقة
        </Text>

        {nextOpeningLabel ? (
          <View
            style={
              styles.closedBookstoreOpeningPill
            }
          >
            <Text
              style={
                styles.closedBookstoreOpeningText
              }
            >
              {nextOpeningLabel}
            </Text>
          </View>
        ) : (
          <Text
            style={
              styles.closedBookstoreOpeningFallback
            }
          >
            هنرجع نستقبل طلباتك قريب
          </Text>
        )}
      </View>
    </View>
  );
}

function CategoryVisual({
  item,
  size,
}: {
  item: CategoryDisplayItem;
  size: number;
}) {
  return (
    <View
      style={[
        styles.categoryImageBox,
        {
          borderRadius: Math.round(
            size * 0.16,
          ),
          height: size,
          width: size,
        },
      ]}
    >
      {item.imageUrl ? (
        <Image
          source={{
            uri: item.imageUrl,
          }}
          style={styles.categoryImage}
          resizeMode="cover"
        />
      ) : item.imageSource ? (
        <Image
          source={item.imageSource}
          style={styles.categoryImage}
          resizeMode="cover"
        />
      ) : (
        <Text style={styles.categoryFallbackIcon}>
          {getBookstoreCategoryFallbackIcon(
            item,
          )}
        </Text>
      )}
    </View>
  );
}

function FeaturedProductCard({
  product,
  currencyCode,
  cardWidth,
  quantity,
  isStoreClosed,
  onAdd,
  onIncrease,
  onDecrease,
}: FeaturedProductCardProps) {
  const imageUrl =
    getProductImage(product);

  const discount =
    getDiscountPercent(product);

  return (
    <View
      style={[
        styles.featuredProductCard,
        {
          width: cardWidth,
        },
      ]}
    >
      <View
        style={[
          styles.featuredProductImageBox,
          {
            width: cardWidth,
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
              styles.featuredProductImage
            }
            resizeMode="cover"
          />
        ) : (
          <Text
            style={
              styles.featuredProductFallback
            }
          >
            {product.icon ||
              '🛒'}
          </Text>
        )}

        {discount !== null && (
          <View
            style={
              styles.featuredDiscountBadge
            }
          >
            <Text
              style={
                styles.featuredDiscountText
              }
              numberOfLines={1}
            >
              وفر {discount}%
            </Text>
          </View>
        )}

        {quantity === 0 ? (
          <Pressable
            disabled={
              isStoreClosed
            }
            hitSlop={5}
            style={({
              pressed,
            }) => [
              styles.featuredAddButton,

              isStoreClosed &&
                styles.featuredAddButtonDisabled,

              pressed &&
                !isStoreClosed &&
                styles.featuredAddButtonPressed,
            ]}
            onPress={onAdd}
          >
            <Text
              style={
                styles.featuredAddButtonText
              }
            >
              +
            </Text>
          </Pressable>
        ) : (
          <View
            style={
              styles.featuredQuantityPill
            }
          >
            <Pressable
              hitSlop={4}
              style={
                styles.featuredQuantityButton
              }
              onPress={
                onDecrease
              }
            >
              <Text
                style={
                  styles.featuredQuantityButtonText
                }
              >
                −
              </Text>
            </Pressable>

            <Text
              style={
                styles.featuredQuantityValue
              }
            >
              {quantity}
            </Text>

            <Pressable
              disabled={
                isStoreClosed
              }
              hitSlop={4}
              style={
                styles.featuredQuantityButton
              }
              onPress={
                onIncrease
              }
            >
              <Text
                style={
                  styles.featuredQuantityButtonText
                }
              >
                +
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <Text
        style={
          styles.featuredProductName
        }
        numberOfLines={2}
      >
        {product.nameEn?.trim() ||
          product.name}
      </Text>

      <View
        style={styles.featuredPriceRow}
      >
        <View
          style={
            styles.featuredCurrentPriceWrap
          }
        >
          <Text
            style={
              styles.featuredCurrentPrice
            }
            numberOfLines={1}
          >
            {formatMoney(
              product.price,
              currencyCode,
            )}
          </Text>
        </View>

        {product.compareAtPrice !==
          null &&
          product.compareAtPrice >
            product.price && (
            <Text
              style={
                styles.featuredOldPrice
              }
              numberOfLines={1}
            >
              {formatMoney(
                product.compareAtPrice,
                currencyCode,
              )}
            </Text>
          )}
      </View>
    </View>
  );
}

export default function BookstoreScreen() {
  const router = useRouter();

  const routeParams =
    useLocalSearchParams<{
      printingSectionId?:
        | string
        | string[];
      storeId?:
        | string
        | string[];
    }>();

  const requestedPrintingSectionId =
    getSingleRouteParam(
      routeParams.printingSectionId,
    );

  const requestedStoreId =
    getSingleRouteParam(
      routeParams.storeId,
    );

  const {
    isScrollingDown: isCartDockScrollingDown,
    onScroll: handleCartDockScroll,
  } = useCartDockScrollBehavior();
  const { width: windowWidth } =
    useWindowDimensions();

  const categoryScrollRef =
    useRef<ScrollView | null>(null);

  const [catalog, setCatalog] =
    useState<StoreCatalog | null>(null);

  const [
    promotionBanners,
    setPromotionBanners,
  ] = useState<BookstorePromotionBanner[]>([]);

  const [
    storefrontCategoryTiles,
    setStorefrontCategoryTiles,
  ] = useState<
    StorefrontCategoryTile[] | null
  >(null);

  const [currencyCode, setCurrencyCode] =
    useState('EGP');

  const [isLoading, setIsLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const savedServiceAreaId =
    useCustomerStore(
      (state) =>
        state.locationServiceAreaId,
    );

  const carts = useCartStore(
    (state) => state.carts,
  );

  const addItem = useCartStore(
    (state) => state.addItem,
  );

  const increaseStoreItem = useCartStore(
    (state) => state.increaseStoreItem,
  );

  const decreaseStoreItem = useCartStore(
    (state) => state.decreaseStoreItem,
  );

  const setActiveCart = useCartStore(
    (state) => state.setActiveCart,
  );

  async function loadBookstore() {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const bootstrap = await getAppBootstrap();

      const defaultServiceAreaId =
        savedServiceAreaId ??
        bootstrap.settings.default_service_area_id ??
        undefined;

      const bookstoreStores = await listStores({
        categorySlug: 'bookstores',
        serviceAreaId: defaultServiceAreaId,
      });

      if (bookstoreStores.length === 0) {
        throw new Error(
          'No bookstore is currently available.',
        );
      }

      const requestedBookstore =
        requestedStoreId
          ? bookstoreStores.find(
              (store) =>
                store.id ===
                requestedStoreId,
            ) ?? null
          : null;

      const bookstore =
        requestedBookstore ??
        bookstoreStores.find(
          (store) =>
            store.isFeatured &&
            !store.isManuallyClosed,
        ) ??
        bookstoreStores.find(
          (store) =>
            !store.isManuallyClosed,
        ) ??
        bookstoreStores[0];

      const [
        loadedCatalog,
        loadedPromotionBanners,
        loadedStorefrontCategoryTiles,
      ] = await Promise.all([
        getStoreCatalog(
          bookstore.id,
          defaultServiceAreaId,
        ),
        listBookstorePromotionBanners({
          storeId: bookstore.id,
        }).catch((bannerError) => {
          console.warn(
            'Unable to load bookstore banners:',
            bannerError,
          );
          return [];
        }),

        listStorefrontCategoryTiles(
          'bookstore',
        ).catch((categoryError) => {
          console.warn(
            'Unable to load bookstore category configuration:',
            categoryError,
          );
          return null;
        }),
      ]);

      setCatalog(loadedCatalog);
      setPromotionBanners(
        loadedPromotionBanners,
      );
      setStorefrontCategoryTiles(
        loadedStorefrontCategoryTiles,
      );
      setCurrencyCode(
        bootstrap.settings.currency_code || 'EGP',
      );
    } catch (error) {
      setCatalog(null);
      setPromotionBanners([]);
      setStorefrontCategoryTiles(
        null,
      );
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load the bookstore.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadBookstore();
  }, [
    savedServiceAreaId,
    requestedStoreId,
  ]);

  const categories = useMemo<
    CategoryDisplayItem[]
  >(() => {
    if (!catalog) {
      return [];
    }

    const rootSections =
      catalog.categoryTree.length > 0
        ? catalog.categoryTree
        : catalog.sections.filter(
            (section) =>
              section.parentId === null,
          );

    const hasOffers =
      catalog.sections.some(
        (section) =>
          section.products.some(
            (product) =>
              getDiscountPercent(
                product,
              ) !== null,
          ),
      );

    if (
      storefrontCategoryTiles !== null
    ) {
      return storefrontCategoryTiles
        .map(
          (
            tile,
          ): CategoryDisplayItem | null => {
            const isOffers =
              tile.kind === 'offers';

            if (
              isOffers &&
              !hasOffers
            ) {
              return null;
            }

            const section =
              isOffers
                ? null
                : findBookstoreStorefrontSection(
                    tile,
                    rootSections,
                  );

            if (
              (tile.kind === 'catalog' ||
                tile.kind === 'merged') &&
              !section
            ) {
              return null;
            }

            return {
              key: tile.key,
              slug: tile.routeSlug,
              label: tile.labelAr,
              imageSource:
                BOOKSTORE_CATEGORY_IMAGES[
                  tile.key
                ] ??
                BOOKSTORE_CATEGORY_IMAGES[
                  section?.slug ?? ''
                ] ??
                null,
              imageUrl:
                tile.imageUrl ??
                section?.imageUrl ??
                null,
              section,
              isOffers,
            };
          },
        )
        .filter(
          (
            item,
          ): item is CategoryDisplayItem =>
            item !== null,
        );
    }

    return BOOKSTORE_CATEGORIES
      .filter(
        (definition) =>
          !definition.isOffers ||
          hasOffers,
      )
      .map((definition) => {
        const isOffers =
          definition.isOffers === true;

        const section =
          isOffers
            ? null
            : findBookstoreCategorySection(
                definition,
                rootSections,
              );

        return {
          key:
            section?.id ??
            definition.key,
          slug:
            isOffers
              ? 'offers'
              : section?.slug ??
                definition.key,
          label: definition.label,
          imageSource:
            BOOKSTORE_CATEGORY_IMAGES[
              definition.key
            ] ??
            BOOKSTORE_CATEGORY_IMAGES[
              section?.slug ?? ''
            ] ??
            null,
          imageUrl: null,
          section,
          isOffers,
        };
      });
  }, [
    catalog,
    storefrontCategoryTiles,
  ]);

  const categoryColumns = useMemo(
    () =>
      makeCategoryColumns(
        categories,
      ).reverse(),
    [categories],
  );

  const searchSuggestions = useMemo(
    () =>
      categories.map(
        (item) => item.label,
      ),
    [categories],
  );

  const activePrintingSection =
    useMemo(() => {
      if (
        !catalog ||
        !requestedPrintingSectionId
      ) {
        return null;
      }

      return (
        catalog.sections.find(
          (section) =>
            section.id ===
            requestedPrintingSectionId,
        ) ??
        catalog.categoryTree.find(
          (section) =>
            section.id ===
            requestedPrintingSectionId,
        ) ??
        catalog.sections.find(
          (section) =>
            normalizeCategoryValue(
              section.slug,
            ) ===
            normalizeCategoryValue(
              PRINTING_SERVICE_SLUG,
            ),
        ) ??
        null
      );
    }, [
      catalog,
      requestedPrintingSectionId,
    ]);

  const catalogProductsById = useMemo(() => {
    const productsById =
      new Map<string, CatalogProduct>();

    for (const section of catalog?.sections ?? []) {
      const sectionProducts =
        getCatalogSectionProducts(
          section,
          true,
        );

      for (const product of sectionProducts) {
        productsById.set(product.id, product);
      }

      for (const product of section.products) {
        productsById.set(product.id, product);
      }
    }

    return productsById;
  }, [catalog]);

  const resolvedPromotionBanners = useMemo<
    ResolvedPromotionBanner[]
  >(() => {
    return promotionBanners
      .map((banner) => ({
        ...banner,
        products: banner.productIds
          .map((productId) =>
            catalogProductsById.get(productId),
          )
          .filter(
            (
              product,
            ): product is CatalogProduct =>
              Boolean(product),
          ),
      }))
      .filter((banner) =>
        Boolean(banner.imageUrl.trim()),
      );
  }, [
    catalogProductsById,
    promotionBanners,
  ]);

  const pageWidth = Math.min(
    windowWidth,
    560,
  );

  const categoryColumnWidth = Math.max(
    1,
    (pageWidth -
      CATEGORY_HORIZONTAL_PADDING * 2 -
      CATEGORY_COLUMN_GAP *
        (CATEGORY_COLUMNS_PER_ROW - 1)) /
      CATEGORY_COLUMNS_PER_ROW,
  );

  const categoryImageSize = Math.max(
    54,
    Math.min(80, categoryColumnWidth - 5),
  );

  const featuredCardWidth = Math.min(
    116,
    Math.max(92, pageWidth * 0.3),
  );

  const promotionBannerWidth = Math.max(
    pageWidth,
    1,
  );

  const promotionBannerHeight = Math.round(
    promotionBannerWidth * 0.64,
  );

  const promotionProductsOverlap = Math.round(
    promotionBannerHeight * 0.49,
  );

  if (isLoading) {
    return (
      <>
        <StatusBar style="dark" />
        <CatalogHomeScreenSkeleton />
      </>
    );
  }

  if (!catalog || errorMessage) {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <StatusBar style="dark" />

        <Text style={styles.stateEmoji}>📚</Text>
        <Text style={styles.stateTitle}>
          المكتبة غير متاحة
        </Text>
        <Text style={styles.stateDescription}>
          {errorMessage ??
            'تعذر تحميل المكتبة.'}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.generalPressed,
          ]}
          onPress={() => {
            void loadBookstore();
          }}
        >
          <Text style={styles.retryButtonText}>
            إعادة المحاولة
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.errorBackButton,
            pressed && styles.generalPressed,
          ]}
          onPress={() => router.back()}
        >
          <Text style={styles.errorBackButtonText}>
            رجوع
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const currentStore = catalog.store;
  const delivery = catalog.delivery;

  const currentCart =
    carts[currentStore.id] ?? null;
  const cartItems = currentCart?.items ?? [];

  const isStoreClosed =
    currentStore.isManuallyClosed ||
    !isStoreOpenByBusinessHours(
      catalog.businessHours,
    );

  const nextOpeningLabel =
    getNextOpeningLabel(
      catalog.businessHours,
    );

  const currentStoreItemCount =
    cartItems.reduce(
      (total, item) => total + item.quantity,
      0,
    );

  const currentStoreSubtotal = cartItems.reduce(
    (total, item) =>
      total + item.price * item.quantity,
    0,
  );

  const shouldShowCartBar =
    currentStoreItemCount > 0;

  function openCategory(
    item: CategoryDisplayItem,
  ) {
    if (
      isPrintingCategoryItem(
        item,
      )
    ) {
      const printingSection =
        findPrintingServiceSection(
          catalog,
          item.section,
        );

      if (printingSection) {
        router.push({
          pathname:
            '/category/bookstore',
          params: {
            storeId:
              currentStore.id,
            printingSectionId:
              printingSection.id,
          },
        });
        return;
      }
    }

    if (item.isOffers) {
      router.push({
        pathname:
          '/supermarket-category/[slug]',
        params: {
          slug: 'offers',
          storeId: currentStore.id,
          categoryKey: item.key,
          label: item.label,
        },
      });
      return;
    }

    router.push({
      pathname: '/bookstore-category/[slug]',
      params: {
        slug: item.slug,
        storeId: currentStore.id,
        categoryKey: item.key,
        label: item.label,
      },
    });
  }

  function addFeaturedProduct(
    product: CatalogProduct,
  ) {
    if (isStoreClosed) {
      return;
    }

    addItem(
      {
        id: currentStore.id,
        name: currentStore.name,
        icon: currentStore.icon,
        categorySlug: currentStore.categorySlug,
        deliveryFee: delivery.deliveryFee,
        minimumOrder: delivery.minimumOrder,
      },
      {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        icon: product.icon,
        variantId: null,
        variantName: null,
      },
    );
  }

  function increaseFeaturedProduct(
    product: CatalogProduct,
  ) {
    if (isStoreClosed) {
      return;
    }

    const existingItem = cartItems.find(
      (item) =>
        item.id === product.id &&
        item.variantId === null,
    );

    if (existingItem) {
      increaseStoreItem(
        currentStore.id,
        product.id,
        null,
      );
      return;
    }

    addFeaturedProduct(product);
  }

  function decreaseFeaturedProduct(
    productId: string,
  ) {
    const existingItem = cartItems.find(
      (item) =>
        item.id === productId &&
        item.variantId === null,
    );

    if (!existingItem) {
      return;
    }

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
          item.id === productId &&
          item.variantId === null,
      )?.quantity ?? 0
    );
  }

  function openCart() {
    setActiveCart(currentStore.id);

    router.push({
      pathname: '/cart',
      params: {
        storeId: currentStore.id,
      },
    });
  }

  if (isStoreClosed) {
    return (
      <SafeAreaView
        style={
          styles.closedBookstoreStateScreen
        }
        edges={[
          'top',
          'bottom',
        ]}
      >
        <StatusBar style="light" />

        <View
          style={
            styles.closedBookstoreStateHeader
          }
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="رجوع"
            style={({ pressed }) => [
              styles.closedBookstoreBackButton,
              pressed &&
                styles.closedBookstoreBackButtonPressed,
            ]}
            onPress={() =>
              router.back()
            }
          >
            <ClosedBookstoreBackArrowIcon />
          </Pressable>
        </View>

        <ClosedBookstoreExperience
          nextOpeningLabel={
            nextOpeningLabel
          }
        />
      </SafeAreaView>
    );
  }

  if (
    requestedPrintingSectionId &&
    activePrintingSection
  ) {
    return (
      <PrintingJobBuilder
        catalog={catalog}
        section={
          activePrintingSection
        }
        currencyCode={
          currencyCode
        }
      />
    );
  }

  return (
    <SafeAreaView
      style={styles.screen}
      edges={['top']}
    >
      <StatusBar style="dark" />

      <View style={styles.pageShell}>
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed &&
                styles.headerButtonPressed,
            ]}
            onPress={() => router.back()}
          >
            <BackArrowIcon />
          </Pressable>
        </View>

        <ScrollView
          style={styles.mainScrollView}
          contentContainerStyle={[
            styles.mainContent,
            shouldShowCartBar &&
              styles.mainContentWithCart,
          ]}
          onScroll={handleCartDockScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <CategorySearchEntry
            scope="bookstore"
            suggestions={searchSuggestions}
          />

          <View style={styles.categoriesSection}>
            <Text style={styles.categoriesTitle}>
              تسوق حسب الفئة
            </Text>

            {categoryColumns.length > 0 ? (
              <ScrollView
                horizontal
                key="bookstore-categories-supermarket-style"
                ref={categoryScrollRef}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={
                  styles.categoriesRail
                }
                style={styles.categoriesScroll}
                onContentSizeChange={() => {
                  requestAnimationFrame(() => {
                    categoryScrollRef.current?.scrollToEnd(
                      {
                        animated: false,
                      },
                    );
                  });
                }}
              >
                {categoryColumns.map(
                  (column, columnIndex) => (
                    <View
                      key={`bookstore-category-column-${columnIndex}`}
                      style={[
                        styles.categoryColumn,
                        {
                          width:
                            categoryColumnWidth,
                        },
                      ]}
                    >
                      {column.map((item) => (
                        <Pressable
                          key={item.key}
                          style={({ pressed }) => [
                            styles.categoryItem,
                            {
                              width:
                                categoryColumnWidth,
                            },
                            pressed &&
                              styles.categoryItemPressed,
                          ]}
                          onPress={() =>
                            openCategory(item)
                          }
                        >
                          <CategoryVisual
                            item={item}
                            size={categoryImageSize}
                          />
                          <Text
                            style={[
                              styles.categoryLabel,
                              {
                                width:
                                  categoryColumnWidth,
                              },
                            ]}
                            numberOfLines={2}
                          >
                            {item.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ),
                )}
              </ScrollView>
            ) : (
              <View style={styles.emptyCategories}>
                <Text
                  style={styles.emptyCategoriesIcon}
                >
                  📚
                </Text>
                <Text
                  style={
                    styles.emptyCategoriesTitle
                  }
                >
                  لا توجد فئات متاحة حاليًا
                </Text>
              </View>
            )}
          </View>

          {resolvedPromotionBanners.map(
            (banner, bannerIndex) => (
              <View
                key={banner.id}
                style={[
                  styles.promotionSection,
                  bannerIndex ===
                    resolvedPromotionBanners.length -
                      1 &&
                    styles.promotionSectionLast,
                ]}
              >
                <View
                  style={styles.promotionBannerFrame}
                >
                  <Image
                    source={{ uri: banner.imageUrl }}
                    style={[
                      styles.promotionBanner,
                      {
                        height:
                          promotionBannerHeight,
                      },
                    ]}
                    resizeMode="cover"
                    accessibilityLabel={
                      banner.altTextAr ??
                      banner.adminLabel
                    }
                  />
                </View>

                {banner.products.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    directionalLockEnabled
                    contentContainerStyle={
                      styles.promotionProductsRail
                    }
                    style={[
                      styles.promotionProductsScroll,
                      {
                        marginTop:
                          -promotionProductsOverlap,
                      },
                    ]}
                  >
                    {banner.products.map(
                      (product) => (
                        <FeaturedProductCard
                          key={`${banner.id}-${product.id}`}
                          product={product}
                          currencyCode={currencyCode}
                          cardWidth={featuredCardWidth}
                          quantity={getProductQuantity(
                            product.id,
                          )}
                          isStoreClosed={
                            isStoreClosed
                          }
                          onAdd={() =>
                            addFeaturedProduct(
                              product,
                            )
                          }
                          onIncrease={() =>
                            increaseFeaturedProduct(
                              product,
                            )
                          }
                          onDecrease={() =>
                            decreaseFeaturedProduct(
                              product.id,
                            )
                          }
                        />
                      ),
                    )}
                  </ScrollView>
                )}
              </View>
            ),
          )}
        </ScrollView>

        <CategoryCartDock
          itemCount={
            shouldShowCartBar
              ? currentStoreItemCount
              : 0
          }
          subtotal={currentStoreSubtotal}
          minimumOrder={delivery.minimumOrder}
          currencyCode={currencyCode}
          accentColor="#00B956"
          accentDarkColor="#009D49"
          isScrollingDown={isCartDockScrollingDown}
          onPress={openCart}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  pageShell: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    maxWidth: 560,
    position: 'relative',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    zIndex: 10,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E1E1',
    borderRadius: 24,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  headerButtonPressed: {
    backgroundColor: '#F7F7F7',
    transform: [{ scale: 0.97 }],
  },
  backArrowCanvas: {
    height: 23,
    position: 'relative',
    width: 24,
  },
  backArrowStem: {
    backgroundColor: '#242424',
    borderRadius: 2,
    height: 2.2,
    left: 3,
    position: 'absolute',
    top: 10.3,
    width: 19,
  },
  backArrowDiagonal: {
    backgroundColor: '#242424',
    borderRadius: 2,
    height: 2.2,
    left: 2,
    position: 'absolute',
    width: 10,
  },
  backArrowTop: {
    top: 7,
    transform: [{ rotate: '-42deg' }],
  },
  backArrowBottom: {
    top: 14,
    transform: [{ rotate: '42deg' }],
  },
  mainScrollView: {
    flex: 1,
  },
  mainContent: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 30,
  },
  mainContentWithCart: {
    paddingBottom: 180,
  },
  categoriesSection: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 22,
    paddingTop: 1,
  },
  categoriesTitle: {
    color: '#202020',
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.45,
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  categoriesScroll: {
    direction: 'ltr',
  },
  categoriesRail: {
    direction: 'ltr',
    flexDirection: 'row',
    flexGrow: 1,
    gap: CATEGORY_COLUMN_GAP,
    justifyContent: 'flex-end',
    paddingHorizontal:
      CATEGORY_HORIZONTAL_PADDING,
  },
  categoryColumn: {
    alignItems: 'center',
    gap: 15,
  },
  categoryItem: {
    alignItems: 'center',
  },
  categoryItemPressed: {
    opacity: 0.68,
    transform: [{ scale: 0.97 }],
  },
  categoryImageBox: {
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  categoryImage: {
    height: '100%',
    width: '100%',
  },
  categoryFallbackIcon: {
    fontSize: 39,
  },
  categoryLabel: {
    color: '#202020',
    fontSize: 13.5,
    fontWeight: '400',
    letterSpacing: -0.2,
    lineHeight: 18,
    marginTop: 8,
    minHeight: 36,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  emptyCategories: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 28,
  },
  emptyCategoriesIcon: {
    fontSize: 42,
  },
  emptyCategoriesTitle: {
    color: '#202020',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  promotionSection: {
    backgroundColor: '#FFFFFF',
    marginBottom: 22,
    overflow: 'visible',
    width: '100%',
  },
  promotionSectionLast: {
    marginBottom: 0,
  },
  promotionBannerFrame: {
    marginHorizontal: 0,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
    zIndex: 1,
  },
  promotionBanner: {
    backgroundColor: '#F4F4F4',
    width: '100%',
  },
  promotionProductsScroll: {
    elevation: 10,
    overflow: 'visible',
    position: 'relative',
    zIndex: 10,
  },
  promotionProductsRail: {
    alignItems: 'flex-start',
    gap: 7,
    paddingBottom: 7,
    paddingHorizontal: 21,
    paddingTop: 0,
  },
  featuredProductCard: {
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  featuredProductImageBox: {
    alignItems: 'center',
    backgroundColor: '#F4F4F4',
    borderColor: '#E8E8E8',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  featuredProductImage: {
    height: '100%',
    width: '100%',
  },
  featuredProductFallback: {
    fontSize: 34,
  },
  featuredDiscountBadge: {
    alignItems: 'center',
    backgroundColor: '#BFFF00',
    borderRadius: 3,
    justifyContent: 'center',
    left: 6,
    minHeight: 17,
    paddingHorizontal: 4,
    paddingVertical: 2,
    position: 'absolute',
    top: 6,
    zIndex: 5,
  },
  featuredDiscountText: {
    color: '#111111',
    fontSize: 8.5,
    fontWeight: '500',
    lineHeight: 11,
  },
  featuredAddButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E7',
    borderRadius: 18,
    borderWidth: 1,
    bottom: 6,
    elevation: 2,
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    right: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    width: 34,
    zIndex: 8,
  },
  featuredAddButtonPressed: {
    backgroundColor: '#F8F8F8',
    transform: [{ scale: 0.94 }],
  },
  featuredAddButtonDisabled: {
    opacity: 0.45,
  },
  featuredAddButtonText: {
    color: NAVIENTY_NOW_COLORS.primary,
    fontSize: 25,
    fontWeight: '300',
    lineHeight: 27,
    marginTop: -2,
  },
  featuredQuantityPill: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E7E7',
    borderRadius: 18,
    borderWidth: 1,
    bottom: 6,
    elevation: 2,
    flexDirection: 'row',
    height: 34,
    position: 'absolute',
    right: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    zIndex: 8,
  },
  featuredQuantityButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 25,
  },
  featuredQuantityButtonText: {
    color: NAVIENTY_NOW_COLORS.primary,
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 20,
  },
  featuredQuantityValue: {
    color: '#202020',
    fontSize: 10,
    fontWeight: '700',
    minWidth: 14,
    textAlign: 'center',
  },
  featuredProductName: {
    color: '#202020',
    fontSize: 12.5,
    fontWeight: '500',
    letterSpacing: -0.15,
    lineHeight: 15,
    marginTop: 6,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  featuredPriceRow: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    marginTop: 1,
  },
  featuredCurrentPriceWrap: {
    alignSelf: 'flex-start',
    borderBottomColor: '#BFFF00',
    borderBottomWidth: 2,
  },
  featuredCurrentPrice: {
    color: '#202020',
    fontSize: 10.5,
    fontWeight: '500',
    lineHeight: 13,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  featuredOldPrice: {
    color: '#858585',
    fontSize: 9,
    lineHeight: 11,
    textAlign: 'left',
    textDecorationLine: 'line-through',
    writingDirection: 'ltr',
  },
  cartBarFloatingWrapper: {
    bottom: 12,
    left: 18,
    position: 'absolute',
    right: 18,
    zIndex: 999,
  },
  cartBar: {
    alignItems: 'center',
    backgroundColor: '#00B956',
    borderRadius: 34,
    elevation: 20,
    flexDirection: 'row',
    height: 64,
    justifyContent: 'space-between',
    paddingHorizontal: 9,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    width: '100%',
  },
  cartBarPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  cartCountBadge: {
    alignItems: 'center',
    backgroundColor: '#009D49',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  cartCountText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  cartBarRight: {
    alignItems: 'flex-end',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  cartBarText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  /* ========================================================
   * CLOSED BOOKSTORE — FULL SCREEN EXPERIENCE
   * ========================================================
   */

  closedBookstoreStateScreen: {
    backgroundColor:
      '#101827',
    flex: 1,
  },

  closedBookstoreStateHeader: {
    alignItems:
      'flex-start',
    height: 62,
    justifyContent:
      'center',
    paddingHorizontal:
      16,
    zIndex: 20,
  },

  closedBookstoreBackButton: {
    alignItems:
      'center',
    backgroundColor:
      'rgba(255, 255, 255, 0.09)',
    borderColor:
      'rgba(255, 255, 255, 0.16)',
    borderRadius:
      24,
    borderWidth:
      1,
    height:
      46,
    justifyContent:
      'center',
    width:
      46,
  },

  closedBookstoreBackButtonPressed: {
    backgroundColor:
      'rgba(255, 255, 255, 0.15)',
    transform: [
      {
        scale: 0.97,
      },
    ],
  },

  closedBookstoreBackArrowCanvas: {
    height:
      23,
    position:
      'relative',
    width:
      24,
  },

  closedBookstoreBackArrowStem: {
    backgroundColor:
      '#FFFFFF',
    borderRadius:
      2,
    height:
      2.2,
    left:
      3,
    position:
      'absolute',
    top:
      10.3,
    width:
      19,
  },

  closedBookstoreBackArrowDiagonal: {
    backgroundColor:
      '#FFFFFF',
    borderRadius:
      2,
    height:
      2.2,
    left:
      2,
    position:
      'absolute',
    width:
      10,
  },

  closedBookstoreBackArrowTop: {
    top:
      7,
    transform: [
      {
        rotate:
          '-42deg',
      },
    ],
  },

  closedBookstoreBackArrowBottom: {
    top:
      14,
    transform: [
      {
        rotate:
          '42deg',
      },
    ],
  },

  closedBookstoreExperience: {
    alignItems:
      'center',
    flex:
      1,
    justifyContent:
      'center',
    overflow:
      'hidden',
    paddingBottom:
      44,
    position:
      'relative',
    width:
      '100%',
  },

  closedBookstoreGlow: {
    backgroundColor:
      '#F4C95D',
    borderRadius:
      999,
    height:
      430,
    position:
      'absolute',
    top:
      24,
    width:
      430,
  },

  closedBookstoreMoon: {
    backgroundColor:
      '#FFF5C9',
    borderRadius:
      999,
    height:
      52,
    position:
      'absolute',
    right:
      34,
    top:
      36,
    width:
      52,
  },

  closedBookstoreMoonCutout: {
    backgroundColor:
      '#101827',
    borderRadius:
      999,
    height:
      48,
    left:
      18,
    position:
      'absolute',
    top:
      -3,
    width:
      48,
  },

  closedBookstoreStar: {
    backgroundColor:
      '#FFF5C9',
    borderRadius:
      999,
    height:
      4,
    position:
      'absolute',
    width:
      4,
  },

  closedBookstoreStarOne: {
    right:
      104,
    top:
      67,
  },

  closedBookstoreStarTwo: {
    height:
      3,
    right:
      76,
    top:
      113,
    width:
      3,
  },

  closedBookstoreStarThree: {
    height:
      3,
    left:
      47,
    top:
      119,
    width:
      3,
  },

  closedBookstoreStore: {
    height:
      260,
    marginTop:
      -60,
    position:
      'relative',
    width:
      270,
  },

  closedBookstoreRoof: {
    backgroundColor:
      '#F7F1E2',
    borderRadius:
      18,
    height:
      34,
    left:
      22,
    position:
      'absolute',
    right:
      22,
    top:
      7,
  },

  closedBookstoreAwning: {
    borderBottomLeftRadius:
      18,
    borderBottomRightRadius:
      18,
    flexDirection:
      'row',
    height:
      54,
    left:
      8,
    overflow:
      'hidden',
    position:
      'absolute',
    right:
      8,
    top:
      31,
  },

  closedBookstoreAwningStripe: {
    flex:
      1,
  },

  closedBookstoreBuilding: {
    backgroundColor:
      '#F7F1E2',
    borderBottomLeftRadius:
      28,
    borderBottomRightRadius:
      28,
    bottom:
      24,
    left:
      19,
    overflow:
      'hidden',
    position:
      'absolute',
    right:
      19,
    top:
      75,
  },

  closedBookstoreWindow: {
    backgroundColor:
      '#17213D',
    borderRadius:
      16,
    height:
      102,
    left:
      23,
    overflow:
      'hidden',
    position:
      'absolute',
    right:
      23,
    top:
      22,
  },

  closedBookstoreShelfTop: {
    alignItems:
      'flex-end',
    bottom:
      54,
    flexDirection:
      'row',
    gap:
      7,
    left:
      14,
    position:
      'absolute',
    right:
      14,
  },

  closedBookstoreShelfBottom: {
    alignItems:
      'flex-end',
    bottom:
      15,
    flexDirection:
      'row',
    gap:
      7,
    left:
      14,
    position:
      'absolute',
    right:
      14,
  },

  closedBookstoreBookTall: {
    borderRadius:
      3,
    height:
      29,
    width:
      16,
  },

  closedBookstoreBookMedium: {
    borderRadius:
      3,
    height:
      23,
    width:
      19,
  },

  closedBookstoreBookShort: {
    borderRadius:
      3,
    height:
      18,
    width:
      20,
  },

  closedBookstoreBookBlue: {
    backgroundColor:
      '#5770B9',
  },

  closedBookstoreBookYellow: {
    backgroundColor:
      '#F4C95D',
  },

  closedBookstoreBookGreen: {
    backgroundColor:
      '#69C78F',
  },

  closedBookstoreBookCream: {
    backgroundColor:
      '#F2E7C9',
  },

  closedBookstoreShutter: {
    backgroundColor:
      '#AEB5B2',
    bottom:
      0,
    left:
      0,
    position:
      'absolute',
    right:
      0,
    top:
      17,
    zIndex:
      5,
  },

  closedBookstoreShutterLine: {
    backgroundColor:
      'rgba(255, 255, 255, 0.42)',
    height:
      2,
    marginTop:
      10,
  },

  closedBookstoreDoorBase: {
    alignItems:
      'center',
    bottom:
      7,
    height:
      28,
    justifyContent:
      'center',
    left:
      0,
    position:
      'absolute',
    right:
      0,
  },

  closedBookstoreLock: {
    alignItems:
      'center',
    backgroundColor:
      '#263B75',
    borderRadius:
      12,
    height:
      25,
    justifyContent:
      'center',
    width:
      25,
  },

  closedBookstoreLockDot: {
    backgroundColor:
      '#FFFFFF',
    borderRadius:
      999,
    height:
      5,
    width:
      5,
  },

  closedBookstoreGroundShadow: {
    backgroundColor:
      'rgba(0, 0, 0, 0.22)',
    borderRadius:
      999,
    bottom:
      3,
    height:
      18,
    left:
      34,
    position:
      'absolute',
    right:
      34,
    transform: [
      {
        scaleX:
          0.88,
      },
    ],
  },

  closedBookstoreOpenBook: {
    bottom:
      '29%',
    height:
      68,
    left:
      23,
    position:
      'absolute',
    transform: [
      {
        rotate:
          '-8deg',
      },
    ],
    width:
      104,
  },

  closedBookstoreBookLeftPage: {
    backgroundColor:
      '#FFF8E6',
    borderBottomLeftRadius:
      12,
    borderTopLeftRadius:
      12,
    height:
      64,
    left:
      0,
    position:
      'absolute',
    top:
      2,
    transform: [
      {
        rotate:
          '4deg',
      },
    ],
    width:
      53,
  },

  closedBookstoreBookRightPage: {
    backgroundColor:
      '#FFF4D6',
    borderBottomRightRadius:
      12,
    borderTopRightRadius:
      12,
    height:
      64,
    position:
      'absolute',
    right:
      0,
    top:
      2,
    transform: [
      {
        rotate:
          '-4deg',
      },
    ],
    width:
      53,
  },

  closedBookstoreBookSpine: {
    backgroundColor:
      '#263B75',
    borderRadius:
      999,
    height:
      58,
    left:
      50,
    position:
      'absolute',
    top:
      5,
    width:
      4,
  },

  closedBookstorePageLineOne: {
    backgroundColor:
      'rgba(38, 59, 117, 0.22)',
    borderRadius:
      2,
    height:
      3,
    left:
      10,
    position:
      'absolute',
    right:
      10,
    top:
      23,
  },

  closedBookstorePageLineTwo: {
    backgroundColor:
      'rgba(38, 59, 117, 0.18)',
    borderRadius:
      2,
    height:
      3,
    left:
      12,
    position:
      'absolute',
    right:
      12,
    top:
      34,
  },

  closedBookstorePencil: {
    bottom:
      '31%',
    height:
      24,
    position:
      'absolute',
    right:
      25,
    width:
      92,
  },

  closedBookstorePencilBody: {
    backgroundColor:
      '#F4C95D',
    height:
      18,
    left:
      16,
    position:
      'absolute',
    top:
      3,
    width:
      57,
  },

  closedBookstorePencilBand: {
    backgroundColor:
      '#D49F42',
    height:
      18,
    left:
      11,
    position:
      'absolute',
    top:
      3,
    width:
      8,
  },

  closedBookstorePencilEraser: {
    backgroundColor:
      '#F1A6A6',
    borderBottomLeftRadius:
      8,
    borderTopLeftRadius:
      8,
    height:
      18,
    left:
      0,
    position:
      'absolute',
    top:
      3,
    width:
      13,
  },

  closedBookstorePencilTip: {
    borderBottomWidth:
      9,
    borderColor:
      'transparent',
    borderLeftColor:
      '#E8D1A5',
    borderTopWidth:
      9,
    height:
      0,
    position:
      'absolute',
    right:
      0,
    top:
      3,
    width:
      0,
  },

  closedBookstoreCopy: {
    alignItems:
      'center',
    marginTop:
      18,
    paddingHorizontal:
      28,
    width:
      '100%',
  },

  closedBookstoreTitle: {
    color:
      '#FFFFFF',
    fontSize:
      28,
    fontWeight:
      '900',
    lineHeight:
      38,
    textAlign:
      'center',
    writingDirection:
      'rtl',
  },

  closedBookstoreOpeningPill: {
    alignItems:
      'center',
    backgroundColor:
      'rgba(255, 255, 255, 0.10)',
    borderColor:
      'rgba(255, 255, 255, 0.15)',
    borderRadius:
      999,
    borderWidth:
      1,
    marginTop:
      18,
    minHeight:
      46,
    paddingHorizontal:
      18,
    paddingVertical:
      10,
  },

  closedBookstoreOpeningText: {
    color:
      '#FFFFFF',
    fontSize:
      14,
    fontWeight:
      '800',
    textAlign:
      'center',
    writingDirection:
      'rtl',
  },

  closedBookstoreOpeningFallback: {
    color:
      '#FFF0B5',
    fontSize:
      13,
    fontWeight:
      '700',
    marginTop:
      17,
    textAlign:
      'center',
    writingDirection:
      'rtl',
  },

  stateScreen: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  stateEmoji: {
    fontSize: 50,
  },
  stateTitle: {
    color: '#202020',
    fontSize: 21,
    fontWeight: '800',
    marginTop: 15,
    textAlign: 'center',
  },
  stateDescription: {
    color: '#777777',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 330,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#222222',
    borderRadius: 14,
    marginTop: 22,
    minWidth: 150,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorBackButton: {
    borderColor: '#E0E0E0',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 10,
    minWidth: 150,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  errorBackButtonText: {
    color: '#222222',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  generalPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
});

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useCallback,
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

import CategoryCartDock, {
  useCartDockScrollBehavior,
} from '../../components/cart/category-cart-dock';
import CategorySearchEntry from '../../components/search/category-search-entry';
import Image from '../../components/ui/app-image';
import { CatalogHomeScreenSkeleton } from '../../components/ui/loading-skeleton';
import { supabase } from '../../lib/supabase';
import loadAppBootstrap from '../../services/bootstrap-service';
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
const PAGE_MAX_WIDTH = 560;

/*
 * الفئات النهائية:
 *
 * 1. العناية بالوجه
 * 2. العناية بالشعر
 * 3. العناية بالجسم
 * 4. العناية بالأسنان
 * 5. تجميل الوجه
 * 6. تجميل العيون والحواجب
 * 7. تجميل الشفاه
 * 8. أدوات التجميل
 * 9. العناية بالعين والشفاه
 * 10. العناية بالمرأة
 * 11. العناية بالرجل
 *
 * تم حذف:
 * hands-feet-care
 *
 * وتم دمج:
 * lip-care + eye-care
 *
 * الصور موجودة داخل:
 * assets/images/personal-care-categories/
 */

const PERSONAL_CARE_CATEGORY_IMAGES: Partial<
  Record<string, ImageSourcePropType>
> = {
  offers: require(
    '../../../assets/images/supermarket-categories/offers.webp',
  ),

  'face-care': require(
    '../../../assets/images/personal-care-categories/face-care.webp',
  ),

  'hair-care': require(
    '../../../assets/images/personal-care-categories/hair-care.webp',
  ),

  'body-care': require(
    '../../../assets/images/personal-care-categories/body-care.webp',
  ),

  'dental-care': require(
    '../../../assets/images/personal-care-categories/dental-care.webp',
  ),

  'face-makeup': require(
    '../../../assets/images/personal-care-categories/face-makeup.webp',
  ),

  'eye-brow-makeup': require(
    '../../../assets/images/personal-care-categories/eye-brow-makeup.webp',
  ),

  'lip-makeup': require(
    '../../../assets/images/personal-care-categories/lip-makeup.webp',
  ),

  'makeup-tools': require(
    '../../../assets/images/personal-care-categories/makeup-tools.webp',
  ),

  /*
   * القسم المدمج:
   * العناية بالعين والشفاه
   *
   * نستخدم حاليًا صورة eye-care.webp
   * حتى لا نحتاج Asset جديد.
   */
  'eye-lip-care': require(
    '../../../assets/images/personal-care-categories/eye-care.webp',
  ),

  'women-care': require(
    '../../../assets/images/personal-care-categories/women-care.webp',
  ),

  'men-care': require(
    '../../../assets/images/personal-care-categories/men-care.webp',
  ),
};

/*
 * Warm the local category images while the catalog is loading.
 *
 * The supermarket screen already reaches its category image sources through
 * a very direct path. Personal care does more catalog/category resolution
 * before those images are mounted, which can make large WebP files visibly
 * pop in a little later on a cold start.
 *
 * Keeping these exact local sources mounted invisibly during the skeleton
 * lets the native image pipeline decode/cache them in parallel with the API
 * calls, without adding a new package or changing the visible design.
 */
const PERSONAL_CARE_CATEGORY_IMAGE_SOURCES =
  Object.values(
    PERSONAL_CARE_CATEGORY_IMAGES,
  ).filter(
    (
      source,
    ): source is ImageSourcePropType =>
      Boolean(source),
  );

type PersonalCareCategoryDefinition = {
  key: string;
  label: string;
  aliases: string[];
  isOffers?: boolean;

  /*
   * تستخدم عندما تكون الفئة الظاهرة في الواجهة
   * مبنية من أكثر من Category في الـcatalog.
   */
  sourceSlugs?: string[];
};

const PERSONAL_CARE_CATEGORIES: PersonalCareCategoryDefinition[] = [
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
    key: 'face-care',
    label: 'العناية بالوجه',
    aliases: [
      'face-care',
      'skincare',
      'skin-care',
      'skin',
      'العناية بالوجه',
      'البشرة',
      'العناية بالبشرة',
    ],
  },

  {
    key: 'hair-care',
    label: 'العناية بالشعر',
    aliases: [
      'hair-care',
      'hair-scalp-care',
      'hair',
      'الشعر',
      'العناية بالشعر',
      'العناية بالشعر وفروة الرأس',
    ],
  },

  {
    key: 'body-care',
    label: 'العناية بالجسم',
    aliases: [
      'body-care',
      'personal-care-hygiene',
      'bath-body',
      'bath-and-body',
      'body',
      'الجسم',
      'العناية بالجسم',
      'العناية الشخصية والنظافة',
    ],
  },

  {
    key: 'dental-care',
    label: 'العناية بالأسنان',
    aliases: [
      'dental-care',
      'oral-dental-care',
      'oral-care',
      'teeth-care',
      'teeth',
      'الأسنان',
      'الاسنان',
      'العناية بالفم والأسنان',
    ],
  },

  {
    key: 'face-makeup',
    label: 'تجميل الوجه',
    aliases: [
      'face-makeup',
      'cosmetics-face-makeup',
      'cosmetics',
      'face-cosmetics',
      'makeup-face',
      'تجميل الوجه',
      'مكياج الوجه',
      'مستحضرات التجميل',
    ],
  },

  {
    key: 'eye-brow-makeup',
    label: 'تجميل العيون والحواجب',
    aliases: [
      'eye-brow-makeup',
      'eyes-brows-makeup',
      'eye-brow-cosmetics',
      'cosmetics-eye-brow-makeup',
      'تجميل العيون والحواجب',
      'مكياج العيون والحواجب',
    ],
  },

  {
    key: 'lip-makeup',
    label: 'تجميل الشفاه',
    aliases: [
      'lip-makeup',
      'lips-makeup',
      'cosmetics-lip-makeup',
      'تجميل الشفاه',
      'مكياج الشفاه',
    ],
  },

  {
    key: 'makeup-tools',
    label: 'أدوات التجميل',
    aliases: [
      'makeup-tools',
      'cosmetics-makeup-tools-accessories',
      'makeup-tools-accessories',
      'beauty-tools',
      'ادوات التجميل',
      'أدوات التجميل',
      'أدوات المكياج',
    ],
  },

  /*
   * lip-care + eye-care
   * أصبحا Category واحدة في الواجهة.
   */
  {
    key: 'eye-lip-care',
    label: 'العناية بالعين والشفاه',
    sourceSlugs: [
      'lip-care',
      'eye-care',
    ],
    aliases: [
      'lip-care',
      'lips-care',
      'lip-treatment',
      'العناية بالشفاه',

      'eye-care',
      'eyes-care',
      'eye-area-care',
      'skincare-eye-area-care',
      'العناية بالعين',
      'العناية بمنطقة العين',

      'eye-lip-care',
      'eye-and-lip-care',
      'eyes-lips-care',
      'العناية بالعين والشفاه',
    ],
  },

  {
    key: 'women-care',
    label: 'العناية بالمرأة',
    aliases: [
      'women-care',
      'womens-care',
      'female-care',
      'العناية بالمرأة',
      'العناية بالمراه',
    ],
  },

  {
    key: 'men-care',
    label: 'العناية بالرجل',
    aliases: [
      'men-care',
      'mens-care',
      'male-care',
      'العناية بالرجل',
    ],
  },
];

type CategoryDisplayItem = {
  key: string;

  /*
   * الـkey الثابت الخاص بتعريف الفئة في الواجهة.
   */
  categoryKey: string;

  slug: string;
  label: string;

  imageSource: ImageSourcePropType | null;
  imageUrl: string | null;

  /*
   * أول Section مطابق.
   */
  section: CatalogSection | null;

  /*
   * كل الـslugs الحقيقية التي تمثل الفئة.
   */
  sourceSlugs: string[];

  isOffers: boolean;
};

type BannerAudience =
  | 'all'
  | 'signed_out'
  | 'signed_in';

type PersonalCareHomeBannerRow = {
  id: string;
  admin_label: string;
  image_url: string;
  storage_path: string | null;
  alt_text_ar: string | null;
  alt_text_en: string | null;
  link_url: string | null;
  audience: BannerAudience;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
};

type PersonalCareHomeBannerProductRow = {
  banner_id: string;
  product_id: string;
  sort_order: number;
};

type PersonalCarePromotionBanner = {
  id: string;
  adminLabel: string;
  imageUrl: string;
  storagePath: string | null;
  altTextAr: string | null;
  altTextEn: string | null;
  linkUrl: string | null;
  sortOrder: number;
  productIds: string[];
};

type ResolvedPromotionBanner =
  PersonalCarePromotionBanner & {
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

const ARABIC_WEEK_DAYS = [
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

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

function findPersonalCareCategorySections(
  definition: PersonalCareCategoryDefinition,
  sections: CatalogSection[],
) {
  const acceptedValues = new Set(
    [
      definition.key,
      definition.label,
      ...(definition.sourceSlugs ?? []),
      ...definition.aliases,
    ].map(normalizeCategoryValue),
  );

  return sections.filter((section) =>
    [
      section.slug,
      section.name,
      section.nameEn,
    ].some((value) =>
      acceptedValues.has(
        normalizeCategoryValue(value),
      ),
    ),
  );
}

function findPersonalCareStorefrontSections(
  tile: StorefrontCategoryTile,
  sections: CatalogSection[],
): CatalogSection[] {
  const acceptedValues = new Set(
    [
      tile.key,
      tile.routeSlug,
      tile.labelAr,
      ...tile.sourceSlugs,
    ].map(normalizeCategoryValue),
  );

  return sections.filter((section) =>
    [
      section.slug,
      section.name,
      section.nameEn,
    ].some((value) =>
      acceptedValues.has(
        normalizeCategoryValue(value),
      ),
    ),
  );
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

function getCategoryFallbackIcon(
  item: CategoryDisplayItem,
) {
  const searchableValue = [
    item.categoryKey,
    item.key,
    item.slug,
    item.label,
    ...item.sourceSlugs,
    item.section?.slug ?? '',
    item.section?.name ?? '',
    item.section?.nameEn ?? '',
  ]
    .join(' ')
    .toLocaleLowerCase('ar');

  const rules: [string[], string][] = [
    [
      [
        'eye-lip-care',
        'eye-care',
        'lip-care',
        'العناية بالعين والشفاه',
        'العناية بالعين',
        'العناية بالشفاه',
      ],
      '✨',
    ],

    [
      [
        'face-makeup',
        'cosmetic',
        'beauty',
        'makeup-face',
        'تجميل الوجه',
        'مكياج الوجه',
      ],
      '💄',
    ],

    [
      [
        'eye-brow-makeup',
        'eye-brow',
        'eyes-brows',
        'تجميل العيون',
        'الحواجب',
      ],
      '👁️',
    ],

    [
      [
        'lip-makeup',
        'lips-makeup',
        'تجميل الشفاه',
        'مكياج الشفاه',
      ],
      '💄',
    ],

    [
      [
        'makeup-tools',
        'beauty-tools',
        'أدوات التجميل',
        'ادوات التجميل',
      ],
      '🖌️',
    ],

    [
      [
        'face-care',
        'skincare',
        'skin-care',
        'البشرة',
        'العناية بالوجه',
      ],
      '✨',
    ],

    [
      [
        'hair',
        'scalp',
        'الشعر',
      ],
      '🧴',
    ],

    [
      [
        'body',
        'hygiene',
        'الجسم',
        'النظافة',
      ],
      '🧼',
    ],

    [
      [
        'oral',
        'dental',
        'teeth',
        'الأسنان',
        'الاسنان',
      ],
      '🦷',
    ],

    [
      [
        'women',
        'female',
        'المرأة',
        'المراه',
      ],
      '🌸',
    ],

    [
      [
        'men',
        'male',
        'الرجل',
      ],
      '🪒',
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

  return '🧴';
}

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
  const compareAtPrice =
    product.compareAtPrice;

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

function isPersonalCareBannerVisibleNow(
  banner: PersonalCareHomeBannerRow,
  now: number,
) {
  if (
    banner.starts_at &&
    new Date(banner.starts_at).getTime() > now
  ) {
    return false;
  }

  if (
    banner.ends_at &&
    new Date(banner.ends_at).getTime() < now
  ) {
    return false;
  }

  return true;
}

async function listPersonalCarePromotionBanners({
  storeId,
}: {
  storeId: string;
}): Promise<PersonalCarePromotionBanner[]> {
  const { data: sessionData } =
    await supabase.auth.getSession();

  const allowedAudiences: BannerAudience[] =
    sessionData.session
      ? ['all', 'signed_in']
      : ['all', 'signed_out'];

  const { data, error } = await supabase
    .schema('now')
    .from('home_banners')
    .select(
      `
        id,
        admin_label,
        image_url,
        storage_path,
        alt_text_ar,
        alt_text_en,
        link_url,
        audience,
        sort_order,
        starts_at,
        ends_at
      `,
    )
    .eq('placement', 'personal-care')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .in('audience', allowedAudiences)
    .order('sort_order', {
      ascending: true,
    })
    .order('created_at', {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  const now = Date.now();

  const visibleBanners = (
    (data ?? []) as PersonalCareHomeBannerRow[]
  ).filter((banner) =>
    isPersonalCareBannerVisibleNow(
      banner,
      now,
    ),
  );

  if (visibleBanners.length === 0) {
    return [];
  }

  const bannerIds = visibleBanners.map(
    (banner) => banner.id,
  );

  const {
    data: bannerProductsData,
    error: bannerProductsError,
  } = await supabase
    .schema('now')
    .from('home_banner_products')
    .select(
      `
        banner_id,
        product_id,
        sort_order
      `,
    )
    .in('banner_id', bannerIds)
    .eq('is_active', true)
    .order('sort_order', {
      ascending: true,
    })
    .order('created_at', {
      ascending: true,
    });

  if (bannerProductsError) {
    throw bannerProductsError;
  }

  const bannerProducts = (
    bannerProductsData ?? []
  ) as PersonalCareHomeBannerProductRow[];

  const productIdsByBanner =
    new Map<string, string[]>();

  for (const row of bannerProducts) {
    const productIds =
      productIdsByBanner.get(row.banner_id) ?? [];

    productIds.push(row.product_id);

    productIdsByBanner.set(
      row.banner_id,
      productIds,
    );
  }

  return visibleBanners.map((banner) => ({
    id: banner.id,
    adminLabel: banner.admin_label,
    imageUrl: banner.image_url,
    storagePath: banner.storage_path,
    altTextAr: banner.alt_text_ar,
    altTextEn: banner.alt_text_en,
    linkUrl: banner.link_url,
    sortOrder: banner.sort_order,
    productIds:
      productIdsByBanner.get(banner.id) ?? [],
  }));
}

function getArabicCurrencyLabel(
  currencyCode: string,
) {
  if (
    currencyCode.trim().toUpperCase() ===
    'EGP'
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

function parseBusinessTime(
  value: string | null,
): {
  hours: number;
  minutes: number;
} | null {
  if (!value) {
    return null;
  }

  const [hoursValue, minutesValue] =
    value.split(':');

  const hours = Number(hoursValue);

  const minutes = Number(
    minutesValue ?? 0,
  );

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
) {
  const parsed =
    parseBusinessTime(value);

  if (!parsed) {
    return null;
  }

  return (
    parsed.hours * 60 +
    parsed.minutes
  );
}

function formatBusinessTime(
  value: string | null,
) {
  const parsed =
    parseBusinessTime(value);

  if (!parsed) {
    return null;
  }

  const period =
    parsed.hours >= 12 ? 'م' : 'ص';

  let displayHours =
    parsed.hours % 12;

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
) {
  if (businessHours.length === 0) {
    return true;
  }

  const currentDay = now.getDay();

  const previousDay =
    (currentDay + 6) % 7;

  const currentMinutes =
    now.getHours() * 60 +
    now.getMinutes();

  const todayHours =
    businessHours.find(
      (item) =>
        item.dayOfWeek ===
        currentDay,
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
      if (
        closeMinutes >
        openMinutes
      ) {
        if (
          currentMinutes >=
            openMinutes &&
          currentMinutes <
            closeMinutes
        ) {
          return true;
        }
      } else if (
        closeMinutes <
        openMinutes
      ) {
        if (
          currentMinutes >=
          openMinutes
        ) {
          return true;
        }
      } else {
        return true;
      }
    }
  }

  const previousHours =
    businessHours.find(
      (item) =>
        item.dayOfWeek ===
        previousDay,
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
) {
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
          item.dayOfWeek ===
            targetDay &&
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

    const openingDate =
      new Date(now);

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
      return `يفتح اليوم الساعة ${displayTime}`;
    }

    if (dayOffset === 1) {
      return `يفتح غدًا الساعة ${displayTime}`;
    }

    return `يفتح يوم ${ARABIC_WEEK_DAYS[targetDay]} الساعة ${displayTime}`;
  }

  return null;
}

function BackArrowIcon({
  color = '#242424',
}: {
  color?: string;
}) {
  return (
    <View style={styles.backArrowCanvas}>
      <View
        style={[
          styles.backArrowStem,
          {
            backgroundColor: color,
          },
        ]}
      />

      <View
        style={[
          styles.backArrowDiagonal,
          styles.backArrowTop,
          {
            backgroundColor: color,
          },
        ]}
      />

      <View
        style={[
          styles.backArrowDiagonal,
          styles.backArrowBottom,
          {
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

function PersonalCareCategoryImagePreloader() {
  return (
    <View
      pointerEvents="none"
      collapsable={false}
      style={
        styles.categoryImagePreloader
      }
    >
      {PERSONAL_CARE_CATEGORY_IMAGE_SOURCES.map(
        (source, index) => (
          <Image
            key={`personal-care-category-preload-${index}`}
            source={source}
            style={
              styles.categoryPreloadImage
            }
            resizeMode="cover"
          />
        ),
      )}
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
        <Text
          style={
            styles.categoryFallbackIcon
          }
        >
          {getCategoryFallbackIcon(item)}
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

/*
 * ==========================================================
 * CLOSED PERSONAL CARE EXPERIENCE
 * ==========================================================
 *
 * نفس مستوى تجربة المكتبة المغلقة:
 * - Full screen illustrated state
 * - Floating store animation
 * - Ambient glow
 * - Decorative beauty objects
 * - Opening time pill
 *
 * لكن بهوية مستقلة خاصة بالعناية.
 */

function ClosedPersonalCareExperience({
  nextOpeningLabel,
  onBack,
}: {
  nextOpeningLabel: string | null;
  onBack: () => void;
}) {
  const floatY = useRef(
    new Animated.Value(0),
  ).current;

  const pulse = useRef(
    new Animated.Value(0),
  ).current;

  const brushX = useRef(
    new Animated.Value(0),
  ).current;

  const bottleY = useRef(
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

    const brushAnimation =
      Animated.loop(
        Animated.sequence([
          Animated.timing(
            brushX,
            {
              toValue: 8,
              duration: 1750,
              useNativeDriver: true,
            },
          ),
          Animated.timing(
            brushX,
            {
              toValue: 0,
              duration: 1750,
              useNativeDriver: true,
            },
          ),
        ]),
      );

    const bottleAnimation =
      Animated.loop(
        Animated.sequence([
          Animated.timing(
            bottleY,
            {
              toValue: -4,
              duration: 2000,
              useNativeDriver: true,
            },
          ),
          Animated.timing(
            bottleY,
            {
              toValue: 0,
              duration: 2000,
              useNativeDriver: true,
            },
          ),
        ]),
      );

    floatAnimation.start();
    pulseAnimation.start();
    brushAnimation.start();
    bottleAnimation.start();

    return () => {
      floatAnimation.stop();
      pulseAnimation.stop();
      brushAnimation.stop();
      bottleAnimation.stop();
    };
  }, [
    bottleY,
    brushX,
    floatY,
    pulse,
  ]);

  const glowOpacity =
    pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [
        0.11,
        0.25,
      ],
    });

  const sparkleOpacity =
    pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [
        0.38,
        0.95,
      ],
    });

  const haloScale =
    pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [
        0.96,
        1.04,
      ],
    });

  return (
    <SafeAreaView
      style={
        styles.closedPersonalCareStateScreen
      }
      edges={['top', 'bottom']}
    >
      <StatusBar style="light" />

      <View
        style={
          styles.closedPersonalCareStateHeader
        }
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="رجوع"
          style={({ pressed }) => [
            styles.closedPersonalCareBackButton,
            pressed &&
              styles.closedPersonalCareBackButtonPressed,
          ]}
          onPress={onBack}
        >
          <BackArrowIcon color="#FFFFFF" />
        </Pressable>
      </View>

      <View
        style={
          styles.closedPersonalCareExperience
        }
      >
        <Animated.View
          style={[
            styles.closedPersonalCareGlow,
            {
              opacity:
                glowOpacity,
              transform: [
                {
                  scale:
                    haloScale,
                },
              ],
            },
          ]}
        />

        <View
          style={
            styles.closedPersonalCareOrbLarge
          }
        />

        <View
          style={
            styles.closedPersonalCareOrbSmall
          }
        />

        <Animated.View
          style={[
            styles.closedPersonalCareSparkle,
            styles.closedPersonalCareSparkleOne,
            {
              opacity:
                sparkleOpacity,
            },
          ]}
        />

        <Animated.View
          style={[
            styles.closedPersonalCareSparkle,
            styles.closedPersonalCareSparkleTwo,
            {
              opacity:
                sparkleOpacity,
            },
          ]}
        />

        <Animated.View
          style={[
            styles.closedPersonalCareSparkle,
            styles.closedPersonalCareSparkleThree,
            {
              opacity:
                sparkleOpacity,
            },
          ]}
        />

        <Animated.View
          style={[
            styles.closedPersonalCareSparkle,
            styles.closedPersonalCareSparkleFour,
            {
              opacity:
                sparkleOpacity,
            },
          ]}
        />

        <Animated.View
          style={[
            styles.closedPersonalCareStore,
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
              styles.closedPersonalCareRoof
            }
          />

          <View
            style={
              styles.closedPersonalCareAwning
            }
          >
            {[
              '#79375F',
              '#FFE7EE',
              '#79375F',
              '#FFE7EE',
              '#79375F',
            ].map(
              (
                color,
                index,
              ) => (
                <View
                  key={`closed-personal-care-awning-${index}`}
                  style={[
                    styles.closedPersonalCareAwningStripe,
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
              styles.closedPersonalCareBuilding
            }
          >
            <View
              style={
                styles.closedPersonalCareWindow
              }
            >
              <View
                style={
                  styles.closedPersonalCareShelfTop
                }
              >
                <View
                  style={[
                    styles.closedPersonalCareBottleTall,
                    styles.closedPersonalCareProductPink,
                  ]}
                >
                  <View
                    style={
                      styles.closedPersonalCareBottleCap
                    }
                  />
                </View>

                <View
                  style={[
                    styles.closedPersonalCareJar,
                    styles.closedPersonalCareProductCream,
                  ]}
                />

                <View
                  style={[
                    styles.closedPersonalCareTube,
                    styles.closedPersonalCareProductLavender,
                  ]}
                />

                <View
                  style={[
                    styles.closedPersonalCareBottleShort,
                    styles.closedPersonalCareProductRose,
                  ]}
                >
                  <View
                    style={
                      styles.closedPersonalCareBottleCapSmall
                    }
                  />
                </View>
              </View>

              <View
                style={
                  styles.closedPersonalCareShelfBottom
                }
              >
                <View
                  style={[
                    styles.closedPersonalCareTube,
                    styles.closedPersonalCareProductCream,
                  ]}
                />

                <View
                  style={[
                    styles.closedPersonalCareBottleTall,
                    styles.closedPersonalCareProductLavender,
                  ]}
                >
                  <View
                    style={
                      styles.closedPersonalCareBottleCap
                    }
                  />
                </View>

                <View
                  style={[
                    styles.closedPersonalCareJar,
                    styles.closedPersonalCareProductPink,
                  ]}
                />

                <View
                  style={[
                    styles.closedPersonalCareBottleShort,
                    styles.closedPersonalCareProductRose,
                  ]}
                >
                  <View
                    style={
                      styles.closedPersonalCareBottleCapSmall
                    }
                  />
                </View>
              </View>

              <View
                style={
                  styles.closedPersonalCareShutter
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
                      key={`closed-personal-care-shutter-${index}`}
                      style={
                        styles.closedPersonalCareShutterLine
                      }
                    />
                  ),
                )}
              </View>
            </View>

            <View
              style={
                styles.closedPersonalCareDoorBase
              }
            >
              <View
                style={
                  styles.closedPersonalCareLock
                }
              >
                <View
                  style={
                    styles.closedPersonalCareLockTop
                  }
                />

                <View
                  style={
                    styles.closedPersonalCareLockBody
                  }
                >
                  <View
                    style={
                      styles.closedPersonalCareLockDot
                    }
                  />
                </View>
              </View>
            </View>
          </View>

          <View
            style={
              styles.closedPersonalCareGroundShadow
            }
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.closedPersonalCareSerum,
            {
              transform: [
                {
                  translateY:
                    bottleY,
                },
                {
                  rotate:
                    '-9deg',
                },
              ],
            },
          ]}
        >
          <View
            style={
              styles.closedPersonalCareSerumDropper
            }
          >
            <View
              style={
                styles.closedPersonalCareSerumDropperTip
              }
            />
          </View>

          <View
            style={
              styles.closedPersonalCareSerumNeck
            }
          />

          <View
            style={
              styles.closedPersonalCareSerumBottle
            }
          >
            <View
              style={
                styles.closedPersonalCareSerumLabel
              }
            />
          </View>
        </Animated.View>

        <View
          style={
            styles.closedPersonalCareCompact
          }
        >
          <View
            style={
              styles.closedPersonalCareCompactMirror
            }
          >
            <View
              style={
                styles.closedPersonalCareCompactShine
              }
            />
          </View>

          <View
            style={
              styles.closedPersonalCareCompactBase
            }
          >
            <View
              style={
                styles.closedPersonalCareCompactPowder
              }
            />
          </View>

          <View
            style={
              styles.closedPersonalCareCompactHinge
            }
          />
        </View>

        <Animated.View
          style={[
            styles.closedPersonalCareBrush,
            {
              transform: [
                {
                  translateX:
                    brushX,
                },
                {
                  rotate:
                    '-29deg',
                },
              ],
            },
          ]}
        >
          <View
            style={
              styles.closedPersonalCareBrushHandle
            }
          />

          <View
            style={
              styles.closedPersonalCareBrushBand
            }
          />

          <View
            style={
              styles.closedPersonalCareBrushHead
            }
          />
        </Animated.View>

        <View
          style={
            styles.closedPersonalCareCopy
          }
        >
          <Text
            style={
              styles.closedPersonalCareTitle
            }
          >
            قسم العناية مغلق
          </Text>

          {nextOpeningLabel ? (
            <View
              style={
                styles.closedPersonalCareOpeningPill
              }
            >
              <View
                style={
                  styles.closedPersonalCareOpeningDot
                }
              />

              <Text
                style={
                  styles.closedPersonalCareOpeningText
                }
              >
                {nextOpeningLabel}
              </Text>
            </View>
          ) : (
            <Text
              style={
                styles.closedPersonalCareOpeningFallback
              }
            >
              هنرجع نستقبل طلباتك قريب
            </Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function PersonalCareScreen() {
  const router = useRouter();

  const {
    isScrollingDown: isCartDockScrollingDown,
    onScroll: handleCartDockScroll,
  } = useCartDockScrollBehavior();

  const { width: windowWidth } =
    useWindowDimensions();

  const categoryScrollRef =
    useRef<ScrollView | null>(null);

  const loadRequestIdRef =
    useRef(0);

  const [catalog, setCatalog] =
    useState<StoreCatalog | null>(null);

  const [
    promotionBanners,
    setPromotionBanners,
  ] = useState<
    PersonalCarePromotionBanner[]
  >([]);

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

  const loadPersonalCare =
    useCallback(async () => {
      const requestId =
        loadRequestIdRef.current + 1;

      loadRequestIdRef.current =
        requestId;

      try {
        setIsLoading(true);
        setErrorMessage(null);

        const bootstrap =
          await loadAppBootstrap();

        const serviceAreaId =
          savedServiceAreaId ??
          bootstrap.settings
            .default_service_area_id ??
          undefined;

        const personalCareStores =
          await listStores({
            categorySlug:
              'personal-care',
            serviceAreaId,
          });

        if (
          personalCareStores.length ===
          0
        ) {
          throw new Error(
            'لا يوجد متجر عناية متاح في منطقتك حاليًا.',
          );
        }

        const selectedStore =
          personalCareStores.find(
            (store) =>
              store.isFeatured &&
              !store.isManuallyClosed,
          ) ??
          personalCareStores.find(
            (store) =>
              !store.isManuallyClosed,
          ) ??
          personalCareStores[0];

        const [
          loadedCatalog,
          loadedPromotionBanners,
          loadedStorefrontCategoryTiles,
        ] = await Promise.all([
          getStoreCatalog(
            selectedStore.id,
            serviceAreaId,
          ),

          listPersonalCarePromotionBanners({
            storeId: selectedStore.id,
          }).catch((bannerError) => {
            console.warn(
              'Unable to load personal-care banners:',
              bannerError,
            );
            return [];
          }),

          listStorefrontCategoryTiles(
            'personal-care',
          ).catch((categoryError) => {
            console.warn(
              'Unable to load personal-care category configuration:',
              categoryError,
            );
            return null;
          }),
        ]);

        if (
          loadRequestIdRef.current !==
          requestId
        ) {
          return;
        }

        setCatalog(loadedCatalog);

        setPromotionBanners(
          loadedPromotionBanners,
        );

        setStorefrontCategoryTiles(
          loadedStorefrontCategoryTiles,
        );

        setCurrencyCode(
          bootstrap.settings
            .currency_code ||
            'EGP',
        );
      } catch (error) {
        if (
          loadRequestIdRef.current !==
          requestId
        ) {
          return;
        }

        setCatalog(null);

        setPromotionBanners([]);

        setStorefrontCategoryTiles(
          null,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'تعذر تحميل قسم العناية.',
        );
      } finally {
        if (
          loadRequestIdRef.current ===
          requestId
        ) {
          setIsLoading(false);
        }
      }
    }, [savedServiceAreaId]);

  useEffect(() => {
    void loadPersonalCare();

    return () => {
      loadRequestIdRef.current += 1;
    };
  }, [loadPersonalCare]);

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
              section.parentId ===
              null,
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

            const matchingSections =
              isOffers
                ? []
                : findPersonalCareStorefrontSections(
                    tile,
                    rootSections,
                  );

            const section =
              matchingSections[0] ??
              null;

            if (
              tile.kind === 'catalog' &&
              !section
            ) {
              return null;
            }

            if (
              tile.kind === 'merged' &&
              matchingSections.length ===
                0
            ) {
              return null;
            }

            const matchedSourceSlugs =
              matchingSections
                .map(
                  (matchedSection) =>
                    matchedSection.slug,
                )
                .filter(Boolean);

            const sourceSlugs =
              tile.sourceSlugs.length >
              0
                ? tile.sourceSlugs
                : matchedSourceSlugs.length >
                    0
                  ? matchedSourceSlugs
                  : [tile.routeSlug];

            return {
              key: tile.key,

              categoryKey:
                tile.key,

              slug:
                tile.routeSlug,

              label:
                tile.labelAr,

              imageSource:
                PERSONAL_CARE_CATEGORY_IMAGES[
                  tile.key
                ] ??
                PERSONAL_CARE_CATEGORY_IMAGES[
                  section?.slug ?? ''
                ] ??
                null,

              imageUrl:
                tile.imageUrl ??
                section?.imageUrl ??
                null,

              section,

              sourceSlugs,

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

    return PERSONAL_CARE_CATEGORIES
      .filter(
        (definition) =>
          !definition.isOffers ||
          hasOffers,
      )
      .map((definition) => {
        const isOffers =
          definition.isOffers === true;

        const matchingSections =
          isOffers
            ? []
            : findPersonalCareCategorySections(
                definition,
                rootSections,
              );

        const section =
          matchingSections[0] ??
          null;

        const matchedSourceSlugs =
          matchingSections
            .map(
              (matchedSection) =>
                matchedSection.slug,
            )
            .filter(
              (
                slug,
              ): slug is string =>
                Boolean(slug),
            );

        const sourceSlugs =
          isOffers
            ? ['offers']
            : matchedSourceSlugs.length > 0
              ? matchedSourceSlugs
              : definition.sourceSlugs ??
                [
                  section?.slug ??
                    definition.key,
                ];

        const routeSlug =
          isOffers
            ? 'offers'
            : section?.slug ??
              definition.sourceSlugs?.[0] ??
              definition.key;

        return {
          key:
            section?.id ??
            definition.key,

          categoryKey:
            definition.key,

          slug: routeSlug,

          label:
            definition.label,

          imageSource:
            PERSONAL_CARE_CATEGORY_IMAGES[
              definition.key
            ] ??
            PERSONAL_CARE_CATEGORY_IMAGES[
              section?.slug ?? ''
            ] ??
            null,

          imageUrl: null,

          section,

          sourceSlugs,

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
    PAGE_MAX_WIDTH,
  );

  const categoryColumnWidth =
    Math.max(
      1,
      (pageWidth -
        CATEGORY_HORIZONTAL_PADDING *
          2 -
        CATEGORY_COLUMN_GAP *
          (CATEGORY_COLUMNS_PER_ROW -
            1)) /
        CATEGORY_COLUMNS_PER_ROW,
    );

  const categoryImageSize =
    Math.max(
      54,
      Math.min(
        80,
        categoryColumnWidth - 5,
      ),
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
      <View style={styles.loadingScreen}>
        <StatusBar style="dark" />

        <PersonalCareCategoryImagePreloader />

        <CatalogHomeScreenSkeleton />
      </View>
    );
  }

  if (!catalog || errorMessage) {
    return (
      <SafeAreaView
        style={styles.stateScreen}
      >
        <StatusBar style="dark" />

        <Text style={styles.stateEmoji}>
          🧴
        </Text>

        <Text style={styles.stateTitle}>
          العناية غير متاحة
        </Text>

        <Text
          style={styles.stateDescription}
        >
          {errorMessage ??
            'تعذر تحميل قسم العناية.'}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            pressed &&
              styles.generalPressed,
          ]}
          onPress={() => {
            void loadPersonalCare();
          }}
        >
          <Text
            style={styles.retryButtonText}
          >
            إعادة المحاولة
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.errorBackButton,
            pressed &&
              styles.generalPressed,
          ]}
          onPress={() => router.back()}
        >
          <Text
            style={
              styles.errorBackButtonText
            }
          >
            رجوع
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const {
    store: currentStore,
    delivery,
    businessHours,
  } = catalog;

  const currentCart =
    carts[currentStore.id] ?? null;

  const cartItems =
    currentCart?.items ?? [];

  const isStoreClosed =
    currentStore.isManuallyClosed ||
    !isStoreOpenByBusinessHours(
      businessHours,
    );

  const nextOpeningLabel =
    getNextOpeningLabel(
      businessHours,
    );

  const currentStoreItemCount =
    cartItems.reduce(
      (total, item) =>
        total + item.quantity,
      0,
    );

  const currentStoreSubtotal =
    cartItems.reduce(
      (total, item) =>
        total +
        item.price * item.quantity,
      0,
    );

  const shouldShowCartBar =
    currentStoreItemCount > 0;

  function openCategory(
    item: CategoryDisplayItem,
  ) {
    if (item.isOffers) {
      router.push({
        pathname:
          '/supermarket-category/[slug]',

        params: {
          slug: 'offers',

          storeId:
            currentStore.id,

          categoryKey:
            item.categoryKey,

          label:
            item.label,
        },
      });
      return;
    }

    router.push({
      pathname:
        '/personal-care-category/[slug]',

      params: {
        slug: item.slug,

        storeId:
          currentStore.id,

        categoryKey:
          item.categoryKey,

        label:
          item.label,

        sourceCategorySlugs:
          item.sourceSlugs.join(','),
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
        deliveryFee:
          delivery.deliveryFee,
        minimumOrder:
          delivery.minimumOrder,
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
      <ClosedPersonalCareExperience
        nextOpeningLabel={
          nextOpeningLabel
        }
        onBack={() => router.back()}
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
            accessibilityRole="button"
            accessibilityLabel="رجوع"
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
          showsVerticalScrollIndicator={
            false
          }
        >
          <CategorySearchEntry
            scope="personal-care"
            suggestions={searchSuggestions}
          />

          <View
            style={
              styles.categoriesSection
            }
          >
            <Text
              style={
                styles.categoriesTitle
              }
            >
              تسوق حسب الفئة
            </Text>

            {categoryColumns.length >
            0 ? (
              <ScrollView
                horizontal
                ref={categoryScrollRef}
                showsHorizontalScrollIndicator={
                  false
                }
                contentContainerStyle={
                  styles.categoriesRail
                }
                style={
                  styles.categoriesScroll
                }
                onContentSizeChange={() => {
                  requestAnimationFrame(
                    () => {
                      categoryScrollRef.current?.scrollToEnd(
                        {
                          animated:
                            false,
                        },
                      );
                    },
                  );
                }}
              >
                {categoryColumns.map(
                  (
                    column,
                    columnIndex,
                  ) => (
                    <View
                      key={`personal-care-category-column-${columnIndex}`}
                      style={[
                        styles.categoryColumn,
                        {
                          width:
                            categoryColumnWidth,
                        },
                      ]}
                    >
                      {column.map(
                        (item) => (
                          <Pressable
                            key={
                              item.categoryKey
                            }
                            accessibilityRole="button"
                            accessibilityLabel={`فتح قسم ${item.label}`}
                            style={( {
                              pressed,
                            }) => [
                              styles.categoryItem,
                              {
                                width:
                                  categoryColumnWidth,
                              },
                              pressed &&
                                styles.categoryItemPressed,
                            ]}
                            onPress={() =>
                              openCategory(
                                item,
                              )
                            }
                          >
                            <CategoryVisual
                              item={item}
                              size={
                                categoryImageSize
                              }
                            />

                            <Text
                              style={[
                                styles.categoryLabel,
                                {
                                  width:
                                    categoryColumnWidth,
                                },
                              ]}
                              numberOfLines={
                                2
                              }
                            >
                              {item.label}
                            </Text>
                          </Pressable>
                        ),
                      )}
                    </View>
                  ),
                )}
              </ScrollView>
            ) : (
              <View
                style={
                  styles.emptyCategories
                }
              >
                <Text
                  style={
                    styles.emptyCategoriesIcon
                  }
                >
                  🧴
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
                  pointerEvents="none"
                  style={
                    styles.promotionBannerFrame
                  }
                >
                  <Image
                    source={{
                      uri: banner.imageUrl,
                    }}
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
                    nestedScrollEnabled
                    showsHorizontalScrollIndicator={
                      false
                    }
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
                          currencyCode={
                            currencyCode
                          }
                          cardWidth={
                            featuredCardWidth
                          }
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

  loadingScreen: {
    backgroundColor: '#FFFFFF',
    flex: 1,
    position: 'relative',
  },

  categoryImagePreloader: {
    height: 80,
    left: 0,
    opacity: 0.001,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    width: 80,
  },

  categoryPreloadImage: {
    height: 80,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 80,
  },

  pageShell: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    maxWidth: PAGE_MAX_WIDTH,
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
    transform: [
      {
        scale: 0.97,
      },
    ],
  },

  backArrowCanvas: {
    height: 23,
    position: 'relative',
    width: 24,
  },

  backArrowStem: {
    borderRadius: 2,
    height: 2.2,
    left: 3,
    position: 'absolute',
    top: 10.3,
    width: 19,
  },

  backArrowDiagonal: {
    borderRadius: 2,
    height: 2.2,
    left: 2,
    position: 'absolute',
    width: 10,
  },

  backArrowTop: {
    top: 7,
    transform: [
      {
        rotate: '-42deg',
      },
    ],
  },

  backArrowBottom: {
    top: 14,
    transform: [
      {
        rotate: '42deg',
      },
    ],
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
    transform: [
      {
        scale: 0.97,
      },
    ],
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
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    width: 34,
    zIndex: 8,
  },

  featuredAddButtonPressed: {
    backgroundColor: '#F8F8F8',
    transform: [
      {
        scale: 0.94,
      },
    ],
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
    shadowOffset: {
      width: 0,
      height: 1,
    },
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
    justifyContent:
      'space-between',
    paddingHorizontal: 9,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    width: '100%',
  },

  cartBarPressed: {
    opacity: 0.92,
    transform: [
      {
        scale: 0.985,
      },
    ],
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

  stateScreen: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },

  stateEmoji: {
    fontSize: 54,
  },

  stateTitle: {
    color: '#202020',
    fontSize: 23,
    fontWeight: '800',
    marginTop: 14,
    textAlign: 'center',
  },

  stateDescription: {
    color: '#757575',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 9,
    maxWidth: 360,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  retryButton: {
    alignItems: 'center',
    backgroundColor: '#00B956',
    borderRadius: 22,
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 46,
    minWidth: 170,
    paddingHorizontal: 24,
  },

  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  errorBackButton: {
    alignItems: 'center',
    borderColor: '#E2E2E2',
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 46,
    minWidth: 170,
    paddingHorizontal: 24,
  },

  errorBackButtonText: {
    color: '#303030',
    fontSize: 14,
    fontWeight: '700',
  },

  generalPressed: {
    opacity: 0.78,
    transform: [
      {
        scale: 0.98,
      },
    ],
  },

  /*
   * ==========================================================
   * CLOSED PERSONAL CARE — FULL SCREEN EXPERIENCE
   * ==========================================================
   */

  closedPersonalCareStateScreen: {
    backgroundColor: '#1B111D',
    flex: 1,
  },

  closedPersonalCareStateHeader: {
    alignItems: 'flex-start',
    height: 62,
    justifyContent: 'center',
    paddingHorizontal: 16,
    zIndex: 20,
  },

  closedPersonalCareBackButton: {
    alignItems: 'center',
    backgroundColor:
      'rgba(255,255,255,0.08)',
    borderColor:
      'rgba(255,255,255,0.14)',
    borderRadius: 24,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },

  closedPersonalCareBackButtonPressed: {
    backgroundColor:
      'rgba(255,255,255,0.15)',
    transform: [
      {
        scale: 0.97,
      },
    ],
  },

  closedPersonalCareExperience: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingBottom: 44,
    position: 'relative',
    width: '100%',
  },

  closedPersonalCareGlow: {
    backgroundColor: '#E76B9B',
    borderRadius: 999,
    height: 430,
    position: 'absolute',
    top: 24,
    width: 430,
  },

  closedPersonalCareOrbLarge: {
    backgroundColor:
      'rgba(255, 212, 227, 0.13)',
    borderColor:
      'rgba(255, 221, 232, 0.18)',
    borderRadius: 999,
    borderWidth: 1,
    height: 60,
    position: 'absolute',
    right: 28,
    top: 42,
    width: 60,
  },

  closedPersonalCareOrbSmall: {
    backgroundColor:
      'rgba(190, 140, 203, 0.15)',
    borderRadius: 999,
    height: 22,
    left: 43,
    position: 'absolute',
    top: 93,
    width: 22,
  },

  closedPersonalCareSparkle: {
    backgroundColor: '#FFE7EF',
    borderRadius: 999,
    height: 4,
    position: 'absolute',
    width: 4,
  },

  closedPersonalCareSparkleOne: {
    right: 107,
    top: 68,
  },

  closedPersonalCareSparkleTwo: {
    height: 3,
    right: 77,
    top: 121,
    width: 3,
  },

  closedPersonalCareSparkleThree: {
    height: 3,
    left: 68,
    top: 68,
    width: 3,
  },

  closedPersonalCareSparkleFour: {
    height: 5,
    left: 41,
    top: 139,
    width: 5,
  },

  closedPersonalCareStore: {
    height: 260,
    marginTop: -60,
    position: 'relative',
    width: 270,
  },

  closedPersonalCareRoof: {
    backgroundColor: '#FFF1F5',
    borderRadius: 18,
    height: 34,
    left: 22,
    position: 'absolute',
    right: 22,
    top: 7,
  },

  closedPersonalCareAwning: {
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    flexDirection: 'row',
    height: 54,
    left: 8,
    overflow: 'hidden',
    position: 'absolute',
    right: 8,
    top: 31,
  },

  closedPersonalCareAwningStripe: {
    flex: 1,
  },

  closedPersonalCareBuilding: {
    backgroundColor: '#FFF1F5',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    bottom: 24,
    left: 19,
    overflow: 'hidden',
    position: 'absolute',
    right: 19,
    top: 75,
  },

  closedPersonalCareWindow: {
    backgroundColor: '#261728',
    borderColor:
      'rgba(121,55,95,0.14)',
    borderRadius: 16,
    borderWidth: 1,
    height: 102,
    left: 23,
    overflow: 'hidden',
    position: 'absolute',
    right: 23,
    top: 22,
  },

  closedPersonalCareShelfTop: {
    alignItems: 'flex-end',
    bottom: 54,
    flexDirection: 'row',
    gap: 8,
    justifyContent:
      'space-around',
    left: 13,
    position: 'absolute',
    right: 13,
  },

  closedPersonalCareShelfBottom: {
    alignItems: 'flex-end',
    bottom: 11,
    flexDirection: 'row',
    gap: 8,
    justifyContent:
      'space-around',
    left: 13,
    position: 'absolute',
    right: 13,
  },

  closedPersonalCareBottleTall: {
    borderRadius: 5,
    height: 31,
    position: 'relative',
    width: 16,
  },

  closedPersonalCareBottleShort: {
    borderRadius: 5,
    height: 23,
    position: 'relative',
    width: 18,
  },

  closedPersonalCareBottleCap: {
    backgroundColor: '#F7DAE3',
    borderRadius: 2,
    height: 5,
    left: 3,
    position: 'absolute',
    right: 3,
    top: -5,
  },

  closedPersonalCareBottleCapSmall: {
    backgroundColor: '#F7DAE3',
    borderRadius: 2,
    height: 4,
    left: 4,
    position: 'absolute',
    right: 4,
    top: -4,
  },

  closedPersonalCareJar: {
    borderRadius: 7,
    height: 17,
    width: 25,
  },

  closedPersonalCareTube: {
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    height: 28,
    width: 17,
  },

  closedPersonalCareProductPink: {
    backgroundColor: '#EE8FB2',
  },

  closedPersonalCareProductCream: {
    backgroundColor: '#F5E1D6',
  },

  closedPersonalCareProductLavender: {
    backgroundColor: '#A98BC2',
  },

  closedPersonalCareProductRose: {
    backgroundColor: '#C25D82',
  },

  closedPersonalCareShutter: {
    backgroundColor: '#AFA6AE',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 17,
    zIndex: 5,
  },

  closedPersonalCareShutterLine: {
    backgroundColor:
      'rgba(255,255,255,0.38)',
    height: 2,
    marginTop: 10,
  },

  closedPersonalCareDoorBase: {
    alignItems: 'center',
    bottom: 6,
    height: 30,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },

  closedPersonalCareLock: {
    alignItems: 'center',
    height: 31,
    justifyContent: 'flex-end',
    position: 'relative',
    width: 27,
  },

  closedPersonalCareLockTop: {
    borderColor: '#79375F',
    borderRadius: 10,
    borderWidth: 3,
    height: 17,
    position: 'absolute',
    top: 0,
    width: 17,
  },

  closedPersonalCareLockBody: {
    alignItems: 'center',
    backgroundColor: '#79375F',
    borderRadius: 7,
    bottom: 0,
    height: 21,
    justifyContent: 'center',
    position: 'absolute',
    width: 27,
  },

  closedPersonalCareLockDot: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    height: 5,
    width: 5,
  },

  closedPersonalCareGroundShadow: {
    backgroundColor:
      'rgba(0,0,0,0.24)',
    borderRadius: 999,
    bottom: 3,
    height: 18,
    left: 34,
    position: 'absolute',
    right: 34,
    transform: [
      {
        scaleX: 0.88,
      },
    ],
  },

  /*
   * Decorative serum bottle
   */

  closedPersonalCareSerum: {
    bottom: '28%',
    height: 98,
    left: 27,
    position: 'absolute',
    width: 55,
  },

  closedPersonalCareSerumDropper: {
    alignItems: 'center',
    backgroundColor: '#79375F',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    height: 26,
    justifyContent: 'flex-end',
    left: 14,
    position: 'absolute',
    top: 0,
    width: 27,
  },

  closedPersonalCareSerumDropperTip: {
    backgroundColor: '#D7BEC8',
    height: 8,
    width: 5,
  },

  closedPersonalCareSerumNeck: {
    backgroundColor: '#EBD3DC',
    borderRadius: 4,
    height: 12,
    left: 18,
    position: 'absolute',
    top: 23,
    width: 19,
  },

  closedPersonalCareSerumBottle: {
    alignItems: 'center',
    backgroundColor:
      'rgba(245,194,211,0.94)',
    borderColor:
      'rgba(255,255,255,0.55)',
    borderRadius: 14,
    borderWidth: 1,
    bottom: 0,
    height: 67,
    justifyContent: 'center',
    left: 6,
    overflow: 'hidden',
    position: 'absolute',
    width: 43,
  },

  closedPersonalCareSerumLabel: {
    backgroundColor:
      'rgba(255,255,255,0.64)',
    borderRadius: 4,
    height: 21,
    width: 25,
  },

  /*
   * Decorative compact mirror
   */

  closedPersonalCareCompact: {
    bottom: '27%',
    height: 96,
    left: 92,
    position: 'absolute',
    transform: [
      {
        rotate: '8deg',
      },
    ],
    width: 89,
  },

  closedPersonalCareCompactMirror: {
    alignItems: 'center',
    backgroundColor: '#79375F',
    borderRadius: 999,
    height: 66,
    justifyContent: 'center',
    left: 11,
    position: 'absolute',
    top: 0,
    width: 66,
  },

  closedPersonalCareCompactShine: {
    backgroundColor: '#FBE6ED',
    borderColor:
      'rgba(255,255,255,0.55)',
    borderRadius: 999,
    borderWidth: 2,
    height: 52,
    position: 'relative',
    width: 52,
  },

  closedPersonalCareCompactBase: {
    alignItems: 'center',
    backgroundColor: '#6D2F55',
    borderRadius: 999,
    bottom: 0,
    height: 55,
    justifyContent: 'center',
    left: 17,
    position: 'absolute',
    width: 55,
  },

  closedPersonalCareCompactPowder: {
    backgroundColor: '#E9A1B5',
    borderColor:
      'rgba(255,255,255,0.18)',
    borderRadius: 999,
    borderWidth: 1,
    height: 41,
    width: 41,
  },

  closedPersonalCareCompactHinge: {
    backgroundColor: '#C48AA5',
    borderRadius: 3,
    height: 8,
    left: 41,
    position: 'absolute',
    top: 55,
    width: 9,
  },

  /*
   * Decorative makeup brush
   */

  closedPersonalCareBrush: {
    bottom: '30%',
    height: 32,
    position: 'absolute',
    right: 21,
    width: 111,
  },

  closedPersonalCareBrushHandle: {
    backgroundColor: '#F2B9C9',
    borderBottomLeftRadius: 11,
    borderTopLeftRadius: 11,
    height: 14,
    left: 0,
    position: 'absolute',
    top: 9,
    width: 69,
  },

  closedPersonalCareBrushBand: {
    backgroundColor: '#C7A3B1',
    height: 18,
    left: 64,
    position: 'absolute',
    top: 7,
    width: 16,
  },

  closedPersonalCareBrushHead: {
    backgroundColor: '#6A4357',
    borderBottomRightRadius: 24,
    borderTopRightRadius: 24,
    height: 29,
    position: 'absolute',
    right: 0,
    top: 1,
    width: 36,
  },

  /*
   * Closed-state copy
   */

  closedPersonalCareCopy: {
    alignItems: 'center',
    marginTop: 18,
    paddingHorizontal: 28,
    width: '100%',
  },

  closedPersonalCareTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 38,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  closedPersonalCareOpeningPill: {
    alignItems: 'center',
    backgroundColor:
      'rgba(255,255,255,0.09)',
    borderColor:
      'rgba(255,255,255,0.14)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 18,
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },

  closedPersonalCareOpeningDot: {
    backgroundColor: '#F39ABB',
    borderRadius: 999,
    height: 7,
    shadowColor: '#F39ABB',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.65,
    shadowRadius: 5,
    width: 7,
  },

  closedPersonalCareOpeningText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  closedPersonalCareOpeningFallback: {
    color: '#F3B8CE',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 17,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
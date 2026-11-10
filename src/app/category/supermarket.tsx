import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  FlatList,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import CategoryCartDock, {
  useCartDockScrollBehavior,
} from '../../components/cart/category-cart-dock';
import CategorySearchEntry from '../../components/search/category-search-entry';
import Image from '../../components/ui/app-image';
import { CatalogHomeScreenSkeleton } from '../../components/ui/loading-skeleton';
import { supabase } from '../../lib/supabase';
import {
  type CatalogProduct,
  type CatalogSection,
  type StoreBusinessHour,
} from '../../services/catalog-service';
import {
  useSupermarketHomePreviewProductsQuery,
  useSupermarketHomeQuery,
} from '../../hooks/use-supermarket-queries';
import {
  getSupermarketBannerProductPage,
  listSupermarketHomeBanners,
  type SupermarketHomeBanner,
} from '../../services/supermarket-home-service';
import { getMyOrders } from '../../services/order-service';
import {
  listStorefrontCategoryTiles,
  type StorefrontCategoryTile,
} from '../../services/storefront-category-service';

import {
  listSupermarketBrandBanners,
  type SupermarketBrandBanner,
} from '../../services/supermarket-brand-banner-service';
import {
  listSupermarketMediaCards,
  type SupermarketMediaCard,
} from '../../services/supermarket-campaign-service';
import { useCartStore } from '../../store/cart-store';
import { useCustomerStore } from '../../store/customer-store';
import { NAVIENTY_NOW_COLORS } from '../../theme/navienty-now-theme';

// Match the card dimensions in supermarket-category/[slug].tsx.
// Display 3 category cards VERTICALLY per column and swipe for more columns.
const CATEGORY_COLUMNS_VISIBLE = 3;
const CATEGORY_ROWS = 3;
const CATEGORY_HORIZONTAL_PADDING = 16;
const CATEGORY_CARD_GAP = 9;
const CATEGORY_CARD_ASPECT_RATIO = 3 / 4;
const CATEGORY_INDICATOR_TRACK_WIDTH = 84;
const CATEGORY_INDICATOR_THUMB_WIDTH = 30;

/**
 * 16:9 cards above "تسوق حسب الفئة".
 * All slide media/ordering/visibility comes from now.supermarket_media_cards.
 * There are intentionally NO local promo images or hard-coded video URLs.
 */
const MEDIA_CARD_GAP = 10;
const MEDIA_CARD_SIDE_INSET = 21;
const MEDIA_CARD_ASPECT_RATIO = 16 / 9;
const MEDIA_AUTO_SWIPE_MS = 3000;
const MEDIA_LOOP_RESET_FALLBACK_MS = 750;

const PROMOTION_PRODUCT_GAP = 7;
const PROMOTION_PRODUCT_HORIZONTAL_PADDING = 8;

// Horizontal preview. "عرض الكل" opens a dedicated full-screen product grid.
const REORDER_PREVIEW_COUNT = 8;
const EMPTY_PROMOTIONS: SupermarketHomeBanner[] = [];
const EMPTY_MEDIA_CARDS: SupermarketMediaCard[] = [];
const EMPTY_BRAND_BANNERS: SupermarketBrandBanner[] = [];

/**
 * Independent promotional spotlight BELOW the personal reorder row.
 * Media, copy, visibility and CTA are fetched from Supabase.
 */
type SupermarketSpotlight = {
  id: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  posterUrl: string | null;
  eyebrowAr: string | null;
  titleAr: string;
  buttonLabelAr: string;
  categoryKey: string;
};

async function getSupermarketSpotlight(storeId: string): Promise<SupermarketSpotlight | null> {
  const { data, error } = await supabase
    .from('supermarket_spotlight_cards')
    .select('id,media_type,media_url,poster_url,eyebrow_ar,title_ar,button_label_ar,category_key')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) throw error;
  const row = data?.[0];
  if (!row || !row.media_url || !['image', 'video'].includes(row.media_type)) return null;

  return {
    id: row.id,
    mediaType: row.media_type as 'image' | 'video',
    mediaUrl: row.media_url,
    posterUrl: row.poster_url ?? null,
    eyebrowAr: row.eyebrow_ar ?? null,
    titleAr: row.title_ar || 'عروض الماركت',
    buttonLabelAr: row.button_label_ar || 'تسوق الآن',
    categoryKey: row.category_key || 'offers',
  };
}

type SupermarketCategoryDefinition = {
  key: string;
  label: string;
  aliases: string[];
  imageSource: ImageSourcePropType;
  isOffers?: boolean;
};

type CategoryDisplayItem = {
  key: string;
  label: string;
  imageSource: ImageSourcePropType | null;
  imageUrl: string | null;
  section: CatalogSection | null;
  isOffers: boolean;
};

type FeaturedProductCardProps = {
  product: CatalogProduct;
  currencyCode: string;
  cardWidth: number;
  quantity: number;
  isStoreClosed: boolean;
  onOpen: () => void;
  onAdd: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
};

const SUPERMARKET_CATEGORIES: SupermarketCategoryDefinition[] = [
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
    imageSource: require('../../../assets/images/supermarket-categories/offers.webp'),
    isOffers: true,
  },
  {
    key: 'fruit-veg',
    label: 'الفواكه والخضروات',
    aliases: [
      'fruit-veg',
      'fruit-and-veg',
      'fruits-vegetables',
      'fruits-and-vegetables',
      'fruit-vegetables',
      'fruit-and-vegetables',
      'fruits-veg',
      'fresh-fruit-vegetables',
      'fresh-fruits-vegetables',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/fruit-veg.webp'),
  },
  {
    key: 'bakery',
    label: 'المخبوزات',
    aliases: [
      'bakery',
      'bread-bakery',
      'bread-and-bakery',
      'baked-goods',
      'breads',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/bakery.webp'),
  },
  {
    key: 'poultry-meat-seafood',
    label: 'دواجن ولحوم ومأكولات بحرية',
    aliases: [
      'poultry-meat-seafood',
      'poultry-meat-and-seafood',
      'poultry-and-meat-and-seafood',
      'meat-seafood',
      'meat-and-seafood',
      'poultry-meat',
      'meat-poultry-seafood',
      'meat-poultry-and-seafood',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/poultry-meat-seafood.webp'),
  },
  {
    key: 'coffee-tea',
    label: 'القهوة والشاي',
    aliases: [
      'coffee-tea',
      'coffee-and-tea',
      'tea-coffee',
      'tea-and-coffee',
      'coffee',
      'tea',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/coffee-tea.webp'),
  },
  {
    key: 'cooking-baking',
    label: 'الطهي والخبز',
    aliases: [
      'cooking-baking',
      'cooking-and-baking',
      'cooking',
      'baking',
      'cooking-essentials',
      'baking-essentials',
      'cooking-and-baking-essentials',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/cooking-baking.webp'),
  },
  {
    key: 'fresh-food',
    label: 'أطعمة طازجة',
    aliases: [
      'fresh-food',
      'fresh-foods',
      'fresh',
      'fresh-products',
      'fresh-groceries',
      'fresh-grocery',
      'fresh-counter',
      'fresh-deli',
      'cold-cuts-deli',
      'cold-cuts-and-deli',
      'deli',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/fresh-food.webp'),
  },
  {
    key: 'ready-to-eat',
    label: 'جاهز للأكل',
    aliases: [
      'ready-to-eat',
      'ready-to-eat-food',
      'ready-to-eat-foods',
      'ready-meals',
      'ready-meal',
      'prepared-food',
      'prepared-foods',
      'prepared-meals',
      'prepared-meal',
      'ready-food',
      'ready-foods',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/ready-to-eat.webp'),
  },
  {
    key: 'frozen-food',
    label: 'الأطعمة المجمدة',
    aliases: [
      'frozen-food',
      'frozen-foods',
      'frozen',
      'frozen-products',
      'frozen-groceries',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/frozen-food.webp'),
  },
  {
    key: 'dairy-eggs',
    label: 'الألبان والبيض',
    aliases: [
      'dairy-eggs',
      'dairy-and-eggs',
      'dairy',
      'milk-eggs',
      'milk-and-eggs',
      'dairy-products',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/dairy-eggs.webp'),
  },
  {
    key: 'breakfast-food',
    label: 'طعام الافطار',
    aliases: [
      'breakfast-food',
      'breakfast-foods',
      'breakfast',
      'breakfast-products',
      'breakfast-essentials',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/breakfast-food.webp'),
  },
  {
    key: 'canned-jarred',
    label: 'معلبات',
    aliases: [
      'canned-jarred',
      'canned-and-jarred',
      'canned-food',
      'canned-foods',
      'canned',
      'cans-jars',
      'cans-and-jars',
      'jarred-food',
      'jarred-foods',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/canned-jarred.webp'),
  },
  {
    key: 'household-essentials',
    label: 'مستلزمات منزلية',
    aliases: [
      'household-essentials',
      'household',
      'home-essentials',
      'home-supplies',
      'household-supplies',
      'household-products',
      'paper-plastic',
      'paper-and-plastic',
      'paper-products',
      'cleaning-laundry',
      'cleaning-and-laundry',
      'cleaning',
      'laundry',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/household-essentials.webp'),
  },
  {
    key: 'beverages',
    label: 'المشروبات',
    aliases: [
      'beverages',
      'beverage',
      'drinks',
      'soft-drinks',
      'cold-drinks',
      'juices',
      'juice',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/beverages.webp'),
  },
  {
    key: 'snacks-chocolate',
    label: 'شيكولاتة وسناكس',
    aliases: [
      'snacks-chocolate',
      'snacks-and-chocolate',
      'snacks-chocolates',
      'snacks-and-chocolates',
      'snacks',
      'chocolate',
      'chocolates',
      'chocolate-snacks',
      'chocolate-and-snacks',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/snacks-chocolate.webp'),
  },
  {
    key: 'condiments',
    label: 'التوابل',
    aliases: [
      'condiments',
      'spices',
      'spice',
      'seasoning',
      'seasonings',
      'spices-seasonings',
      'spices-and-seasonings',
      'herbs-spices',
      'herbs-and-spices',
      'sauces',
      'sauces-condiments',
      'sauces-and-condiments',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/condiments.webp'),
  },
];

function normalizeValue(
  value: string | null | undefined,
) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(
      /[^a-z0-9\u0600-\u06ff]+/g,
      '-',
    )
    .replace(/^-+|-+$/g, '');
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
  return `${amount.toFixed(
    2,
  )} ${getArabicCurrencyLabel(
    currencyCode,
  )}`;
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

function findSectionForCategory(
  definition: SupermarketCategoryDefinition,
  sections: CatalogSection[],
): CatalogSection | null {
  const normalizedAliases =
    definition.aliases.map(normalizeValue);

  const exactSlugMatch = sections.find(
    (section) =>
      normalizedAliases.includes(
        normalizeValue(section.slug),
      ),
  );

  if (exactSlugMatch) {
    return exactSlugMatch;
  }

  const exactEnglishNameMatch =
    sections.find((section) =>
      normalizedAliases.includes(
        normalizeValue(section.nameEn),
      ),
    );

  if (exactEnglishNameMatch) {
    return exactEnglishNameMatch;
  }

  const normalizedLabel =
    normalizeValue(definition.label);

  return (
    sections.find(
      (section) =>
        normalizeValue(section.nameEn) ===
          normalizedLabel ||
        normalizeValue(section.name) ===
          normalizedLabel,
    ) ?? null
  );
}

function findSectionForStorefrontTile(
  tile: StorefrontCategoryTile,
  sections: CatalogSection[],
): CatalogSection | null {
  const acceptedValues = new Set(
    [
      tile.key,
      tile.routeSlug,
      ...tile.sourceSlugs,
    ].map(normalizeValue),
  );

  return (
    sections.find((section) =>
      [
        section.slug,
        section.name,
        section.nameEn,
      ].some((value) =>
        acceptedValues.has(
          normalizeValue(value),
        ),
      ),
    ) ?? null
  );
}

// Group categories in columns of three, preserving their order.
function makeCategoryColumns(
  categories: CategoryDisplayItem[],
): CategoryDisplayItem[][] {
  const columns: CategoryDisplayItem[][] = [];

  for (let index = 0; index < categories.length; index += CATEGORY_ROWS) {
    columns.push(categories.slice(index, index + CATEGORY_ROWS));
  }

  return columns;
}

function BackArrowIcon() {
  return (
    <Ionicons
      color={
        NAVIENTY_NOW_COLORS.text
      }
      name="arrow-back-outline"
      size={20}
    />
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

  const parts =
    value.split(':');

  const hours =
    Number(parts[0]);

  const minutes =
    Number(parts[1] ?? 0);

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
): string | null {
  const parsed =
    parseBusinessTime(value);

  if (!parsed) {
    return null;
  }

  const period =
    parsed.hours >= 12
      ? 'م'
      : 'ص';

  let displayHours =
    parsed.hours % 12;

  if (
    displayHours === 0
  ) {
    displayHours = 12;
  }

  return `${displayHours}:${String(
    parsed.minutes,
  ).padStart(2, '0')} ${period}`;
}

function isStoreOpenByBusinessHours(
  businessHours:
    StoreBusinessHour[],
  now = new Date(),
): boolean {
  /*
   * حفاظًا على السلوك الحالي:
   * لو المتجر ليس له مواعيد مسجلة،
   * لا نعتبره مغلقًا تلقائيًا.
   */
  if (
    businessHours.length === 0
  ) {
    return true;
  }

  const currentDay =
    now.getDay();

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

  if (
    todayHours?.isOpen
  ) {
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
        /*
         * مثال:
         * 08:00 → 01:00
         *
         * الجزء بعد 08:00 وحتى منتصف الليل.
         */
        if (
          currentMinutes >=
          openMinutes
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
   * الجزء الممتد بعد منتصف الليل
   * يأتي من جدول اليوم السابق.
   *
   * مثال:
   * أمس 08:00 → اليوم 01:00.
   */
  const previousHours =
    businessHours.find(
      (item) =>
        item.dayOfWeek ===
        previousDay,
    );

  if (
    previousHours?.isOpen
  ) {
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
  businessHours:
    StoreBusinessHour[],
  now = new Date(),
): string | null {
  if (
    businessHours.length === 0
  ) {
    return null;
  }

  const currentDay =
    now.getDay();

  for (
    let dayOffset = 0;
    dayOffset <= 7;
    dayOffset += 1
  ) {
    const targetDay =
      (currentDay +
        dayOffset) %
      7;

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
      now.getDate() +
        dayOffset,
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

    if (
      dayOffset === 0
    ) {
      return `يفتح اليوم الساعة ${displayTime}`;
    }

    if (
      dayOffset === 1
    ) {
      return `يفتح بكرة الساعة ${displayTime}`;
    }

    return `يفتح يوم ${ARABIC_WEEK_DAYS[targetDay]} الساعة ${displayTime}`;
  }

  return null;
}

function ClosedBackArrowIcon() {
  return (
    <View
      style={
        styles.closedBackArrowCanvas
      }
    >
      <View
        style={
          styles.closedBackArrowStem
        }
      />

      <View
        style={[
          styles.closedBackArrowDiagonal,
          styles.closedBackArrowTop,
        ]}
      />

      <View
        style={[
          styles.closedBackArrowDiagonal,
          styles.closedBackArrowBottom,
        ]}
      />
    </View>
  );
}

function ClosedSupermarketExperience({
  nextOpeningLabel,
}: {
  nextOpeningLabel: string | null;
}) {
  const floatY =
    useRef(
      new Animated.Value(0),
    ).current;

  const pulse =
    useRef(
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

    floatAnimation.start();
    pulseAnimation.start();

    return () => {
      floatAnimation.stop();
      pulseAnimation.stop();
    };
  }, [
    floatY,
    pulse,
  ]);

  const glowOpacity =
    pulse.interpolate({
      inputRange: [
        0,
        1,
      ],

      outputRange: [
        0.13,
        0.28,
      ],
    });

  const starOpacity =
    pulse.interpolate({
      inputRange: [
        0,
        1,
      ],

      outputRange: [
        0.38,
        0.92,
      ],
    });

  return (
    <View
      style={
        styles.closedExperience
      }
    >
      <Animated.View
        style={[
          styles.closedExperienceGlow,

          {
            opacity:
              glowOpacity,
          },
        ]}
      />

      <View
        style={
          styles.closedExperienceMoon
        }
      >
        <View
          style={
            styles.closedExperienceMoonCutout
          }
        />
      </View>

      <Animated.View
        style={[
          styles.closedExperienceStar,
          styles.closedExperienceStarOne,

          {
            opacity:
              starOpacity,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.closedExperienceStar,
          styles.closedExperienceStarTwo,

          {
            opacity:
              starOpacity,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.closedExperienceStar,
          styles.closedExperienceStarThree,

          {
            opacity:
              starOpacity,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.closedExperienceStore,

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
            styles.closedStoreRoof
          }
        />

        <View
          style={
            styles.closedStoreAwning
          }
        >
          {[
            '#00B956',
            '#E7F8ED',
            '#00B956',
            '#E7F8ED',
            '#00B956',
          ].map(
            (
              color,
              index,
            ) => (
              <View
                key={`closed-store-awning-${index}`}
                style={[
                  styles.closedStoreAwningStripe,

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
            styles.closedStoreBuilding
          }
        >
          <View
            style={
              styles.closedStoreWindow
            }
          >
            <View
              style={
                styles.closedStoreProductsTop
              }
            >
              <View
                style={[
                  styles.closedStoreProduct,
                  styles.closedStoreProductGreen,
                ]}
              />

              <View
                style={[
                  styles.closedStoreProduct,
                  styles.closedStoreProductCream,
                ]}
              />

              <View
                style={[
                  styles.closedStoreProduct,
                  styles.closedStoreProductOrange,
                ]}
              />
            </View>

            <View
              style={
                styles.closedStoreProductsBottom
              }
            >
              <View
                style={[
                  styles.closedStoreProductSmall,
                  styles.closedStoreProductCream,
                ]}
              />

              <View
                style={[
                  styles.closedStoreProductSmall,
                  styles.closedStoreProductGreen,
                ]}
              />

              <View
                style={[
                  styles.closedStoreProductSmall,
                  styles.closedStoreProductOrange,
                ]}
              />

              <View
                style={[
                  styles.closedStoreProductSmall,
                  styles.closedStoreProductCream,
                ]}
              />
            </View>

            <View
              style={
                styles.closedStoreShutter
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
                    key={`closed-store-shutter-${index}`}
                    style={
                      styles.closedStoreShutterLine
                    }
                  />
                ),
              )}
            </View>
          </View>

          <View
            style={
              styles.closedStoreDoorBase
            }
          >
            <View
              style={
                styles.closedStoreLock
              }
            >
              <View
                style={
                  styles.closedStoreLockDot
                }
              />
            </View>
          </View>
        </View>

        <View
          style={
            styles.closedStoreGroundShadow
          }
        />
      </Animated.View>

      <View
        style={
          styles.closedExperienceBag
        }
      >
        <View
          style={
            styles.closedExperienceBagHandle
          }
        />

        <View
          style={
            styles.closedExperienceBagMark
          }
        />
      </View>

      <View
        style={
          styles.closedExperienceCopy
        }
      >
        <Text
          style={
            styles.closedExperienceTitle
          }
        >
          السوبر ماركت مغلق
        </Text>

        {nextOpeningLabel ? (
          <View
            style={
              styles.closedOpeningPill
            }
          >
            <Text
              style={
                styles.closedOpeningText
              }
            >
              {nextOpeningLabel}
            </Text>
          </View>
        ) : (
          <Text
            style={
              styles.closedOpeningFallback
            }
          >
            هنرجع نستقبل طلباتك قريب
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * Video banners never render a separate poster image or play icon.
 * The active video and its immediate neighbours stay mounted: expo-video
 * buffers neighbouring sources ahead of a swipe, without playing them.
 * A neutral loading layer stays visible until the native view has rendered
 * its first real video frame, preventing a poster-to-video visual jump.
 */
function BannerMediaVideo({
  uri,
  isActive,
}: {
  uri: string;
  isActive: boolean;
}) {
  const [hasFirstFrame, setHasFirstFrame] = useState(false);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);

  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    if (isActive) videoPlayer.play();
  });

  useEffect(() => {
    const subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'error') {
        setHasPlaybackError(true);
      } else if (status === 'readyToPlay') {
        setHasPlaybackError(false);
        if (isActive) player.play();
      }
    });

    if (isActive) {
      if (player.status !== 'error') player.play();
    } else {
      // Pause off-screen videos while retaining their buffered source.
      player.pause();
    }

    // Never call pause() from cleanup: the native player may be disposed.
    return () => subscription.remove();
  }, [player, isActive]);

  return (
    <View pointerEvents="none" style={styles.topMediaVideoFill}>
      <VideoView
        player={player}
        style={[
          styles.topMediaVideo,
          !hasFirstFrame && styles.topMediaVideoHidden,
        ]}
        contentFit="cover"
        nativeControls={false}
        surfaceType="textureView"
        onFirstFrameRender={() => setHasFirstFrame(true)}
      />
      {(!hasFirstFrame || hasPlaybackError) && (
        <View style={styles.topMediaVideoPlaceholder}>
          {!hasPlaybackError && isActive ? (
            <ActivityIndicator size="small" color="#00B14F" />
          ) : null}
        </View>
      )}
    </View>
  );
}

/**
 * Spotlight videos must not depend on fragile ScrollView window measurements.
 * This screen renders only one spotlight card. Preload/play while the route and
 * app are active; pause on navigation/background. This also fixes the black card
 * where 'readyToPlay' was treated as a rendered frame and the loading UI hid.
 */
function SpotlightVideo({
  uri,
  posterUrl,
}: {
  uri: string;
  posterUrl: string | null;
}) {
  const [hasFirstFrame, setHasFirstFrame] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [isRouteFocused, setIsRouteFocused] = useState(true);
  const [isAppActive, setIsAppActive] = useState(
    AppState.currentState !== 'background',
  );

  // Start playback in the player setup, same as the working top banner.
  // statusChange provides a second attempt when network buffering completes.
  const player = useVideoPlayer(uri, video => {
    video.loop = true;
    video.muted = true;
    video.play();
  });

  useFocusEffect(useCallback(() => {
    setIsRouteFocused(true);
    return () => setIsRouteFocused(false);
  }, []));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      setIsAppActive(nextState === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const subscription = player.addListener('statusChange', event => {
      if (event.status === 'error') {
        setHasError(true);
        console.warn('Spotlight video failed to load:', event.error?.message ?? uri);
      } else if (event.status === 'readyToPlay') {
        setHasError(false);
        if (isRouteFocused && isAppActive) player.play();
      }
    });

    if (isRouteFocused && isAppActive && player.status !== 'error') {
      player.play();
    } else if (!isRouteFocused || !isAppActive) {
      player.pause();
    }

    return () => subscription.remove();
  }, [player, uri, isRouteFocused, isAppActive]);

  // Do not leave the customer staring at an empty, dark surface indefinitely.
  // A poster is a *fallback*, never shown over an actual decoded frame.
  useEffect(() => {
    if (hasFirstFrame || hasError || !isRouteFocused || !isAppActive) return;
    const timeout = setTimeout(() => setHasTimedOut(true), 6500);
    return () => clearTimeout(timeout);
  }, [hasFirstFrame, hasError, isRouteFocused, isAppActive, uri]);

  const showFallback = !hasFirstFrame && (hasError || hasTimedOut);

  return (
    <View pointerEvents="none" style={styles.spotlightMedia}>
      <VideoView
        player={player}
        nativeControls={false}
        contentFit="cover"
        surfaceType="textureView"
        style={styles.spotlightVideoView}
        onFirstFrameRender={() => {
          setHasFirstFrame(true);
          setHasTimedOut(false);
          setHasError(false);
        }}
      />
      {!hasFirstFrame && !showFallback ? (
        <View style={styles.spotlightVideoLoading}>
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      ) : null}
      {showFallback ? (
        <View style={styles.spotlightVideoFallback}>
          {posterUrl ? (
            <Image
              source={{ uri: posterUrl }}
              style={styles.spotlightMedia}
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="videocam-off-outline" size={28} color="#FFFFFF" />
          )}
        </View>
      ) : null}
    </View>
  );
}

function SupermarketSpotlightCard({
  card,
  onPress,
}: {
  card: SupermarketSpotlight;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${card.titleAr}، ${card.buttonLabelAr}`}
      onPress={onPress}
      style={({ pressed }) => [styles.spotlightCard, pressed && styles.spotlightPressed]}
    >
      {card.mediaType === 'video' ? (
        <SpotlightVideo uri={card.mediaUrl} posterUrl={card.posterUrl} />
      ) : (
        <Image
          source={{ uri: card.mediaUrl }}
          style={styles.spotlightMedia}
          resizeMode="cover"
        />
      )}
      <Svg pointerEvents="none" style={styles.spotlightGradient} width="100%" height="100%">
        <Defs>
          <LinearGradient id="spotlight-shade" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#111111" stopOpacity={0.55} />
            <Stop offset="40%" stopColor="#111111" stopOpacity={0.05} />
            <Stop offset="68%" stopColor="#111111" stopOpacity={0.04} />
            <Stop offset="100%" stopColor="#111111" stopOpacity={0.44} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#spotlight-shade)" />
      </Svg>
      <View pointerEvents="none" style={styles.spotlightCopy}>
        {card.eyebrowAr ? (
          <Text numberOfLines={2} style={styles.spotlightEyebrow}>{card.eyebrowAr}</Text>
        ) : null}
        <Text numberOfLines={2} adjustsFontSizeToFit style={styles.spotlightTitle}>
          {card.titleAr}
        </Text>
      </View>
      <View pointerEvents="none" style={styles.spotlightButton}>
        <Text numberOfLines={1} style={styles.spotlightButtonText}>{card.buttonLabelAr}</Text>
      </View>
    </Pressable>
  );
}

type MediaCarouselProps = {
  cards: SupermarketMediaCard[];
  viewportWidth: number;
  onCardPress: (card: SupermarketMediaCard) => void;
};

/**
 * Prefer the explicit database ordering when the campaign service includes
 * sortOrder / sort_order. If it doesn't expose that field, preserve the order
 * returned by listSupermarketMediaCards (which should query sort_order ASC).
 * Do not move campaign cards to the beginning or impose a client-side priority.
 */
function getBannerSortOrder(card: SupermarketMediaCard): number | null {
  const orderedCard = card as SupermarketMediaCard & {
    sortOrder?: number | null;
    sort_order?: number | null;
  };
  const value = orderedCard.sortOrder ?? orderedCard.sort_order;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function SupermarketMediaCarousel({
  cards,
  viewportWidth,
  onCardPress,
}: MediaCarouselProps) {
  const orderedCards = useMemo(() => {
    // Stable sorting also preserves database order between equal sort_order values.
    if (!cards.every(card => getBannerSortOrder(card) !== null)) return cards;
    return [...cards].sort(
      (first, second) => getBannerSortOrder(first)! - getBannerSortOrder(second)!,
    );
  }, [cards]);

  const cardCount = orderedCards.length;
  // One copy of the first card at the end makes the last-to-first swipe seamless.
  const carouselCards = useMemo(
    () => cardCount > 1 ? [...orderedCards, orderedCards[0]] : orderedCards,
    [orderedCards, cardCount],
  );
  const cardSequence = orderedCards.map(card => card.id).join('|');

  // Physical index includes the duplicate first slide at index cardCount.
  const [activeSlide, setActiveSlide] = useState(0);
  const activeSlideRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const scrollRef = useRef<ScrollView | null>(null);

  const cardWidth = Math.max(1, viewportWidth - MEDIA_CARD_SIDE_INSET * 2);
  const cardHeight = Math.round(cardWidth / MEDIA_CARD_ASPECT_RATIO);
  const snapInterval = cardWidth + MEDIA_CARD_GAP;

  // Always start on the first item in database order, not the first campaign.
  // Reset only when the set/order of cards changes.
  useEffect(() => {
    activeSlideRef.current = 0;
    setActiveSlide(0);
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: 0, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [cardSequence]);

  // Preserve the correct card when the viewport changes size / orientation.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        x: activeSlideRef.current * snapInterval,
        animated: false,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [snapInterval]);

  // Move one banner forward every 3 seconds. Manual dragging pauses the timer
  // and restarting after release gives the user a full 3 seconds to read.
  useEffect(() => {
    if (cardCount < 2 || isDragging || activeSlide >= cardCount) return;
    const timer = setTimeout(() => {
      if (isDraggingRef.current) return;
      const nextIndex = Math.min(activeSlideRef.current + 1, cardCount);
      activeSlideRef.current = nextIndex;
      setActiveSlide(nextIndex);
      scrollRef.current?.scrollTo({
        x: nextIndex * snapInterval,
        animated: true,
      });
    }, MEDIA_AUTO_SWIPE_MS);
    return () => clearTimeout(timer);
  }, [cardCount, activeSlide, isDragging, snapInterval, cardSequence]);

  // Programmatic scrollTo(animated:true) doesn't consistently emit
  // onMomentumScrollEnd on all RN versions: this is a safe fallback for the
  // duplicated first slide. The normal path resets on momentum end instead.
  useEffect(() => {
    if (cardCount < 2 || activeSlide !== cardCount || isDragging) return;
    const timer = setTimeout(() => {
      if (isDraggingRef.current) return;
      scrollRef.current?.scrollTo({ x: 0, animated: false });
      activeSlideRef.current = 0;
      setActiveSlide(0);
    }, MEDIA_LOOP_RESET_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [activeSlide, cardCount, isDragging]);

  const updateActiveSlide = (offset: number, hasFinishedMomentum = true) => {
    if (cardCount === 0) return;
    const index = Math.min(
      cardCount > 1 ? cardCount : cardCount - 1,
      Math.max(0, Math.round(offset / snapInterval)),
    );
    if (cardCount > 1 && index === cardCount) {
      if (!hasFinishedMomentum) {
        // Don't force a jump while the user's swipe is still decelerating.
        // onMomentumScrollEnd resets it; the fallback timer covers no momentum.
        activeSlideRef.current = cardCount;
        setActiveSlide(cardCount);
        return;
      }
      // At the copy of the first slide. Jump to the real first slide at the
      // identical visual position, without an animated backwards journey.
      scrollRef.current?.scrollTo({ x: 0, animated: false });
      activeSlideRef.current = 0;
      setActiveSlide(0);
      return;
    }
    activeSlideRef.current = index;
    setActiveSlide(index);
  };

  if (cardCount === 0) return null;

  return (
    <View style={styles.topMediaSection}>
      <ScrollView
        ref={scrollRef}
        horizontal
        directionalLockEnabled
        decelerationRate="fast"
        snapToInterval={snapInterval}
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        style={styles.topMediaScroll}
        contentContainerStyle={[
          styles.topMediaRail,
          { paddingHorizontal: MEDIA_CARD_SIDE_INSET },
        ]}
        onContentSizeChange={() => {
          scrollRef.current?.scrollTo({
            x: activeSlideRef.current * snapInterval,
            animated: false,
          });
        }}
        onScrollBeginDrag={() => {
          isDraggingRef.current = true;
          setIsDragging(true);
        }}
        onScrollEndDrag={event => {
          isDraggingRef.current = false;
          setIsDragging(false);
          // Also handle very short manual swipes with no momentum event.
          updateActiveSlide(event.nativeEvent.contentOffset.x, false);
        }}
        onMomentumScrollEnd={event => {
          isDraggingRef.current = false;
          setIsDragging(false);
          updateActiveSlide(event.nativeEvent.contentOffset.x);
        }}
      >
        {carouselCards.map((card, index) => {
          const isCurrent = index === activeSlide;
          const isVideoCard = card.mediaType === 'video';
          // Keep the active and adjacent video sources prepared, including the
          // duplicate first slide when wrapping from the final banner.
          const shouldPrepareVideo =
            isVideoCard &&
            Boolean(card.videoUrl) &&
            Math.abs(index - activeSlide) <= 1;
          const hasAction = card.hasCampaignProducts || Boolean(card.categoryKey);
          return (
            <Pressable
              key={`${card.id}-${index === cardCount ? 'loop' : 'item'}`}
              accessibilityRole={hasAction ? 'button' : 'image'}
              accessibilityLabel={card.title || `عرض ${index + 1}`}
              disabled={!hasAction}
              onPress={() => onCardPress(card)}
              style={({ pressed }) => [
                styles.topMediaCard,
                { width: cardWidth, height: cardHeight },
                pressed && hasAction && styles.topMediaCardPressed,
              ]}
            >
              {isVideoCard ? (
                shouldPrepareVideo && card.videoUrl ? (
                  <BannerMediaVideo
                    key={`${card.id}-${index}-${card.videoUrl}`}
                    uri={card.videoUrl}
                    isActive={isCurrent}
                  />
                ) : (
                  <View style={styles.topMediaVideoPlaceholder} />
                )
              ) : card.imageUrl ? (
                <Image
                  source={{ uri: card.imageUrl }}
                  style={styles.topMediaImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.topMediaFallback}>
                  <Ionicons name="image-outline" size={38} color="#8B958E" />
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
      {/* No pagination dots beneath the banner. */}
    </View>
  );
}

/**
 * Brand banners are fully data-driven. A logo is always presented as a brand
 * image inside the white circle; never render the brand name as awkward text.
 * If the remote asset is missing, show a subtle neutral placeholder instead.
 */
function BrandBannerCard({
  banner,
  width,
  onPress,
}: {
  banner: SupermarketBrandBanner;
  width: number;
  onPress: () => void;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const logoDiameter = Math.min(90, Math.max(68, width * 0.71));
  const totalHeight = Math.round(width * 1.65) + 43;

  // Let freshly edited Supabase logo URLs retry without remounting the screen.
  useEffect(() => {
    setLogoFailed(false);
  }, [banner.logoUrl]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`عرض منتجات ${banner.title}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.brandBannerCard,
        { width, height: totalHeight },
        pressed && styles.brandBannerPressed,
      ]}
    >
      <View
        style={[
          styles.brandBannerPanel,
          { backgroundColor: banner.backgroundColor },
        ]}
      >
        <View style={styles.brandBannerGlow} pointerEvents="none" />
        <Image
          source={{ uri: banner.heroImageUrl }}
          style={styles.brandBannerHeroImage}
          resizeMode="cover"
          accessibilityLabel={banner.title}
        />
      </View>
      <View
        style={[
          styles.brandBannerCircle,
          {
            width: logoDiameter,
            height: logoDiameter,
            borderRadius: logoDiameter / 2,
            left: (width - logoDiameter) / 2,
          },
        ]}
      >
        {banner.logoUrl && !logoFailed ? (
          <Image
            source={{ uri: banner.logoUrl }}
            style={styles.brandBannerLogo}
            resizeMode="cover"
            onError={() => setLogoFailed(true)}
            accessibilityLabel={`شعار ${banner.title}`}
          />
        ) : (
          <View
            style={styles.brandBannerLogoPlaceholder}
            accessibilityLabel={`صورة ${banner.title} غير متاحة`}
          >
            <Ionicons
              name="storefront-outline"
              size={Math.round(logoDiameter * 0.37)}
              color="#B8BEC0"
            />
          </View>
        )}
      </View>
    </Pressable>
  );
}

function SupermarketBrandBanners({
  banners,
  pageWidth,
  onBannerPress,
}: {
  banners: SupermarketBrandBanner[];
  pageWidth: number;
  onBannerPress: (banner: SupermarketBrandBanner) => void;
}) {
  if (banners.length === 0) return null;
  const cardWidth = Math.max(104, Math.min(176, (pageWidth - 32 - 20) / 3));

  return (
    <View style={styles.brandBannersSection}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.brandBannersScroll}
        contentContainerStyle={styles.brandBannersRail}
      >
        {banners.map(banner => (
          <BrandBannerCard
            key={banner.id}
            banner={banner}
            width={cardWidth}
            onPress={() => onBannerPress(banner)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function CategoryVisual({
  item,
}: {
  item: CategoryDisplayItem;
}) {
  return (
    <View style={styles.categoryImageBox}>
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
          style={styles.categoryFallbackIcon}
        >
          🛒
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
  onOpen,
  onAdd,
  onIncrease,
  onDecrease,
}: FeaturedProductCardProps) {
  const imageUrl =
    getProductImage(product);

  const discount =
    getDiscountPercent(product);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`عرض تفاصيل ${product.name}`}
      onPress={onOpen}
      style={({ pressed }) => [
        styles.featuredProductCard,
        { width: cardWidth },
        pressed && styles.featuredProductCardPressed,
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
            onPress={(event) => { event.stopPropagation(); onAdd(); }}
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
              onPress={(event) => { event.stopPropagation(); onDecrease(); }}
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
              onPress={(event) => { event.stopPropagation(); onIncrease(); }}
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
        {product.name?.trim() ||
          product.nameEn?.trim() ||
          ''}
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
    </Pressable>
  );
}


/**
 * Each banner owns its own product pagination. The home page never truncates
 * the union of all promo products to a global limit. FlatList virtualizes
 * rendered cards and loads subsequent pages only when the customer swipes.
 */
function PromotionBannerProductRail({
  banner,
  storeId,
  serviceAreaId,
  shouldLoad,
  currencyCode,
  cardWidth,
  overlap,
  isStoreClosed,
  cartItems,
  onOpen,
  onAdd,
  onIncrease,
  onDecrease,
}: {
  banner: SupermarketHomeBanner;
  storeId: string;
  serviceAreaId: string | null;
  shouldLoad: boolean;
  currencyCode: string;
  cardWidth: number;
  overlap: number;
  isStoreClosed: boolean;
  cartItems: ReadonlyArray<{ id: string; quantity: number }>;
  onOpen: (product: CatalogProduct) => void;
  onAdd: (product: CatalogProduct) => void;
  onIncrease: (product: CatalogProduct) => void;
  onDecrease: (productId: string) => void;
}) {
  const query = useInfiniteQuery({
    queryKey: [
      'public', 'supermarket', 'banner-products-v3',
      storeId, serviceAreaId ?? '*', banner.id,
    ],
    enabled: shouldLoad && Boolean(storeId),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      getSupermarketBannerProductPage(
        storeId, banner.id, serviceAreaId, pageParam,
      ),
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore
        ? pages.reduce((total, page) => total + page.items.length, 0)
        : undefined,
    staleTime: 60_000,
    gcTime: 15 * 60_000,
    retry: 1,
    meta: { persist: false },
  });

  const products = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  // A banner may have no linked products (branding only), or every linked
  // product may have since become inactive. Neither case is a network error.
  if (!shouldLoad) return null;

  if (query.isPending) {
    return (
      <View style={[styles.promotionRailStatus, { marginTop: -overlap }]}>
        <ActivityIndicator color="#00B956" size="small" />
      </View>
    );
  }

  if (query.isError && products.length === 0) {
    return (
      <Pressable
        accessibilityRole="button"
        style={[styles.promotionRailStatus, { marginTop: -overlap }]}
        onPress={() => { void query.refetch(); }}
      >
        <Text style={styles.promotionRailStatusText}>
          تعذر تحميل المنتجات — اضغط لإعادة المحاولة
        </Text>
      </Pressable>
    );
  }

  if (products.length === 0) return null;

  return (
    <FlatList
      horizontal
      nestedScrollEnabled
      data={products}
      extraData={cartItems}
      keyExtractor={(product) => `${banner.id}-${product.id}`}
      renderItem={({ item: product }) => (
        <FeaturedProductCard
          product={product}
          currencyCode={currencyCode}
          cardWidth={cardWidth}
          quantity={cartItems.find((item) => item.id === product.id)?.quantity ?? 0}
          isStoreClosed={isStoreClosed}
          onOpen={() => onOpen(product)}
          onAdd={() => onAdd(product)}
          onIncrease={() => onIncrease(product)}
          onDecrease={() => onDecrease(product.id)}
        />
      )}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError) {
          void query.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.9}
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <View style={styles.promotionRailPageStatus}>
            <ActivityIndicator color="#00B956" size="small" />
          </View>
        ) : query.isFetchNextPageError ? (
          <Pressable
            accessibilityRole="button"
            style={styles.promotionRailPageStatus}
            onPress={() => { void query.fetchNextPage(); }}
          >
            <Text style={styles.promotionRailStatusText}>إعادة التحميل</Text>
          </Pressable>
        ) : null
      }
      initialNumToRender={4}
      maxToRenderPerBatch={6}
      updateCellsBatchingPeriod={50}
      windowSize={5}
      getItemLayout={(_data, index) => ({
        length: cardWidth + PROMOTION_PRODUCT_GAP,
        offset: PROMOTION_PRODUCT_HORIZONTAL_PADDING +
          (cardWidth + PROMOTION_PRODUCT_GAP) * index,
        index,
      })}
      showsHorizontalScrollIndicator={false}
      directionalLockEnabled
      contentContainerStyle={styles.promotionProductsRail}
      style={[
        styles.promotionProductsScroll,
        { marginTop: -overlap },
      ]}
    />
  );
}

export default function SupermarketScreen() {
  const router = useRouter();

  const {
    isScrollingDown: isCartDockScrollingDown,
    onScroll: handleCartDockScroll,
  } = useCartDockScrollBehavior();

  const { width: windowWidth } =
    useWindowDimensions();

  const categoryScrollX = useRef(new Animated.Value(0)).current;
  const categoryScrollRef = useRef<ScrollView | null>(null);
  const reorderScrollRef = useRef<ScrollView | null>(null);
  const promoScrollY = useRef(0);
  const promoViewportHeight = useRef(800);
  const promoBannerRects = useRef(new Map<string, { top: number; bottom: number }>());
  const prefetchedBannerIdsRef = useRef(new Set<string>());
  const [prefetchedBannerIds, setPrefetchedBannerIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // Spotlight and media are independent, cached queries (not part of the loading gate).
  const [categoryViewportWidth, setCategoryViewportWidth] = useState(0);
  const [categoryContentWidth, setCategoryContentWidth] = useState(0);

  const [reorderedProductIds, setReorderedProductIds] = useState<string[]>([]);
  const [isReorderLoading, setIsReorderLoading] = useState(false);
  const [reorderError, setReorderError] = useState(false);
  const [reorderRetryKey, setReorderRetryKey] = useState(0);

  const savedServiceAreaId = useCustomerStore(
    (state) => state.locationServiceAreaId,
  );

  /**
   * Critical path: ~45 KB cached metadata (not a 4.5 MB product catalog).
   * Optional widgets render independently and never gate the whole screen.
   */
  const homeQuery = useSupermarketHomeQuery(savedServiceAreaId);
  const catalog = homeQuery.data?.catalog ?? null;
  const currencyCode = homeQuery.data?.currencyCode ?? 'EGP';
  const hasOffers = homeQuery.data?.hasOffers === true;
  const homeStoreId = catalog?.store.id ?? null;
  const isLoading = homeQuery.isPending && !catalog;
  const errorMessage = homeQuery.isError && !catalog
    ? 'حصلت مشكلة مؤقتة في تحميل بيانات الماركت. اتأكد من الإنترنت واضغط إعادة المحاولة.'
    : null;

  const promotionQuery = useQuery({
    queryKey: ['public', 'supermarket', 'home-promotions-v2', homeStoreId],
    queryFn: () => listSupermarketHomeBanners(homeStoreId!),
    enabled: Boolean(homeStoreId),
    staleTime: 120_000,
    retry: 1,
    meta: { persist: true },
  });
  const tilesQuery = useQuery({
    queryKey: ['public', 'supermarket', 'home-tiles-v2', homeStoreId],
    queryFn: () => listStorefrontCategoryTiles('supermarket'),
    enabled: Boolean(homeStoreId),
    staleTime: 120_000,
    retry: 1,
    meta: { persist: true },
  });
  const mediaQuery = useQuery({
    queryKey: ['public', 'supermarket', 'home-media-v2', homeStoreId],
    queryFn: () => listSupermarketMediaCards(homeStoreId!),
    enabled: Boolean(homeStoreId),
    staleTime: 120_000,
    retry: 1,
    meta: { persist: true },
  });
  const spotlightQuery = useQuery({
    queryKey: ['public', 'supermarket', 'home-spotlight-v2', homeStoreId],
    queryFn: () => getSupermarketSpotlight(homeStoreId!),
    enabled: Boolean(homeStoreId),
    staleTime: 120_000,
    retry: 1,
    meta: { persist: true },
  });
  const brandQuery = useQuery({
    queryKey: ['public', 'supermarket', 'home-brands-v2', homeStoreId],
    queryFn: () => listSupermarketBrandBanners(homeStoreId!),
    enabled: Boolean(homeStoreId),
    staleTime: 120_000,
    retry: 1,
    meta: { persist: true },
  });

  const promotionBanners = promotionQuery.data ?? EMPTY_PROMOTIONS;
  const storefrontCategoryTiles = tilesQuery.data ?? null;
  const mediaCards = mediaQuery.data ?? EMPTY_MEDIA_CARDS;
  const spotlightCard = spotlightQuery.data ?? null;
  const brandBanners = brandQuery.data ?? EMPTY_BRAND_BANNERS;

  const carts =
    useCartStore(
      (state) => state.carts,
    );

  const addItem =
    useCartStore(
      (state) => state.addItem,
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

  // Home data is managed by TanStack Query and background refresh.

  // Reorder is personalized: read the customer's real accepted past orders,
  // then resolve product IDs against this store's CURRENT active catalog.
  // Never show an arbitrary product as though the customer bought it.
  useEffect(() => {
    const activeStoreId = catalog?.store.id;
    if (!activeStoreId) return;
    let alive = true;
    setIsReorderLoading(true);
    setReorderError(false);
    setReorderedProductIds([]);

    void getMyOrders()
      .then((orders) => {
        if (!alive) return;
        const seen = new Set<string>();
        const ids: string[] = [];
        const sorted = [...orders].sort(
          (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
        );
        for (const order of sorted) {
          if (order.storeId !== activeStoreId) continue;
          // Exclude cancelled/unconfirmed orders from repeat purchases.
          if (!['confirmed', 'preparing', 'out-for-delivery', 'delivered'].includes(order.status)) continue;
          for (const item of order.items) {
            const id = item.productId;
            if (id && !seen.has(id)) {
              seen.add(id);
              ids.push(id);
            }
          }
        }
        setReorderedProductIds(ids);
      })
      .catch(() => {
        if (alive) setReorderError(true);
      })
      .finally(() => {
        if (alive) setIsReorderLoading(false);
      });

    return () => { alive = false; };
  }, [catalog?.store.id, reorderRetryKey]);

  const categories =
    useMemo<
      CategoryDisplayItem[]
    >(() => {
      const sections =
        catalog?.sections ??
        [];


      if (
        storefrontCategoryTiles !==
        null
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
                  : findSectionForStorefrontTile(
                      tile,
                      sections,
                    );

              if (
                (tile.kind ===
                  'catalog' ||
                  tile.kind ===
                    'merged') &&
                !section
              ) {
                return null;
              }

              const localDefinition =
                SUPERMARKET_CATEGORIES.find(
                  (definition) =>
                    definition.key ===
                      tile.key ||
                    definition.key ===
                      tile.routeSlug,
                );

              return {
                key: tile.key,

                label:
                  tile.labelAr,

                imageSource:
                  localDefinition
                    ?.imageSource ??
                  null,

                imageUrl:
                  tile.imageUrl ??
                  section?.imageUrl ??
                  null,

                isOffers,

                section,
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

      return SUPERMARKET_CATEGORIES
        .filter(
          (definition) =>
            !definition.isOffers ||
            hasOffers,
        )
        .map(
          (definition) => ({
            key:
              definition.key,

            label:
              definition.label,

            imageSource:
              definition.imageSource,

            imageUrl: null,

            isOffers:
              definition.isOffers ===
              true,

            section:
              findSectionForCategory(
                definition,
                sections,
              ),
          }),
        );
    }, [
      catalog,
      hasOffers,
      storefrontCategoryTiles,
    ]);

  // The first three categories stay on the right (Arabic layout),
  // followed by more columns revealed when swiping horizontally.
  const categoryColumns = useMemo(
    () => makeCategoryColumns(categories).reverse(),
    [categories],
  );

  const searchSuggestions =
    useMemo(
      () =>
        categories.map(
          (item) => item.label,
        ),
      [categories],
    );

  const categoryMaxScroll = Math.max(
    categoryContentWidth - categoryViewportWidth,
    1,
  );
  const categoryIndicatorTranslateX = categoryScrollX.interpolate({
    inputRange: [0, categoryMaxScroll],
    outputRange: [
      0,
      CATEGORY_INDICATOR_TRACK_WIDTH - CATEGORY_INDICATOR_THUMB_WIDTH,
    ],
    extrapolate: 'clamp',
  });

  // Reorder preview is independent: promo banner products have their
  // own per-banner infinite queries, with no global product cap.
  const previewIds = useMemo(
    () => Array.from(
      new Set(reorderedProductIds.slice(0, REORDER_PREVIEW_COUNT)),
    ),
    [reorderedProductIds],
  );
  const previewQuery = useSupermarketHomePreviewProductsQuery(
    homeStoreId,
    previewIds,
  );
  const catalogProductsById = useMemo(
    () => new Map<string, CatalogProduct>(
      (previewQuery.data ?? []).map((product) => [product.id, product]),
    ),
    [previewQuery.data],
  );

  const reorderProducts = useMemo(
    () => reorderedProductIds
      .map(id => catalogProductsById.get(id))
      .filter((product): product is CatalogProduct => Boolean(product)),
    [reorderedProductIds, catalogProductsById],
  );

  const visiblePromotionBanners = useMemo(
    () => promotionBanners.filter((banner) => Boolean(banner.imageUrl.trim())),
    [promotionBanners],
  );

  const pageWidth =
    Math.min(
      windowWidth,
      560,
    );

  // Identical dimensions to [slug].tsx, but laid out in scrolling columns.
  const categoryCardWidth =
    (pageWidth -
      CATEGORY_HORIZONTAL_PADDING * 2 -
      CATEGORY_CARD_GAP * (CATEGORY_COLUMNS_VISIBLE - 1)) /
    CATEGORY_COLUMNS_VISIBLE;

  const categoryCardHeight =
    categoryCardWidth / CATEGORY_CARD_ASPECT_RATIO;

  /*
   * Larger promotional product cards to match the
   * reference layout: roughly three large cards fill
   * the viewport, with the outer card allowed to crop
   * slightly at the edge like the target design.
   */
  const featuredCardWidth =
    Math.min(
      136,
      Math.max(
        108,
        pageWidth * 0.34,
      ),
    );

  /*
   * Banner becomes edge-to-edge.
   *
   * Previously:
   * pageWidth - 18
   *
   * That intentionally left 9px
   * on the left and 9px on the right.
   */
  const promotionBannerWidth =
    Math.max(
      pageWidth,
      1,
    );

  /*
   * Slightly taller banner plus a deeper product-card
   * overlap. This keeps the banner feeling large while
   * letting the bigger cards sit inside its lower area,
   * like the first reference screenshot.
   */
  const promotionBannerHeight =
    Math.round(
      promotionBannerWidth *
        0.66,
    );

  const promotionProductsOverlap =
    Math.round(
      promotionBannerHeight *
        0.55,
    );


  // Only start each banner's query when it approaches the visible scroll
  // region. The Set grows as a customer browses; scroll position stays in
  // refs to avoid expensive state updates on every scroll frame.
  function prefetchNearbyBannerRails() {
    const top = Math.max(0, promoScrollY.current - 400);
    const bottom = promoScrollY.current + promoViewportHeight.current + 650;
    let changed = false;

    for (const [id, rect] of promoBannerRects.current.entries()) {
      if (
        rect.top <= bottom &&
        rect.bottom >= top &&
        !prefetchedBannerIdsRef.current.has(id)
      ) {
        prefetchedBannerIdsRef.current.add(id);
        changed = true;
      }
    }

    if (changed) {
      setPrefetchedBannerIds(new Set(prefetchedBannerIdsRef.current));
    }
  }

  if (isLoading) {
    return (
      <CatalogHomeScreenSkeleton />
    );
  }

  if (
    !catalog ||
    errorMessage
  ) {
    return (
      <SafeAreaView
        style={
          styles.stateScreen
        }
      >
        <StatusBar
          style="dark"
        />

        <Text
          style={
            styles.stateEmoji
          }
        >
          🛒
        </Text>

        <Text
          style={
            styles.stateTitle
          }
        >
          تعذر تحميل السوبر ماركت
        </Text>

        <Text
          style={
            styles.stateDescription
          }
        >
          {errorMessage ??
            'تعذر تحميل السوبر ماركت.'}
        </Text>

        <Pressable
          style={({
            pressed,
          }) => [
            styles.retryButton,

            pressed &&
              styles.generalPressed,
          ]}
          onPress={() => {
            void homeQuery.refetch();
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
          style={({
            pressed,
          }) => [
            styles.errorBackButton,

            pressed &&
              styles.generalPressed,
          ]}
          onPress={() =>
            router.back()
          }
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

  const currentStore =
    catalog.store;

  const delivery =
    catalog.delivery;

  /*
   * IMPORTANT:
   *
   * cart-store is multi-cart now. The supermarket screen subscribes
   * only to the carts slice and always reads the current store cart.
   * This avoids subscribing the whole screen to unrelated store state.
   */
  const cartItems =
    carts[
      currentStore.id
    ]?.items ?? [];

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
      (
        total,
        item,
      ) =>
        total +
        item.quantity,
      0,
    );

  const currentStoreSubtotal =
    cartItems.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.price *
          item.quantity,
      0,
    );

  const shouldShowCartBar =
    currentStoreItemCount >
    0;

  function openCart() {
    setActiveCart(
      currentStore.id,
    );

    router.push({
      pathname: '/cart',
      params: {
        storeId:
          currentStore.id,
      },
    });
  }

  function openCategory(
    item: CategoryDisplayItem,
  ) {
    const categorySlug =
      item.isOffers
        ? 'offers'
        : item.section
              ?.slug ??
          item.key;

    router.push({
      pathname:
        '/supermarket-category/[slug]',

      params: {
        slug:
          categorySlug,

        storeId:
          currentStore.id,

        categoryKey:
          item.key,

        label:
          item.label,
      },
    });
  }

  function openSpotlight() {
    if (!spotlightCard) return;
    const key = spotlightCard.categoryKey;
    const category = categories.find(item =>
      item.key === key || item.section?.slug === key,
    );
    if (category) {
      openCategory(category);
      return;
    }
    // Offers can be hidden from the category rail when no discount exists,
    // but the campaign CTA should still navigate to the offers screen.
    if (key === 'offers') {
      router.push({
        pathname: '/supermarket-category/[slug]',
        params: {
          slug: 'offers',
          storeId: currentStore.id,
          categoryKey: 'offers',
          label: 'عروض',
        },
      });
    }
  }

  function openMediaCard(card: SupermarketMediaCard) {
    if (card.hasCampaignProducts) {
      router.push({
        pathname: '/supermarket-campaign/[id]',
        params: { id: card.id, storeId: currentStore.id },
      });
      return;
    }
    if (!card.categoryKey) return;
    const matchingCategory = categories.find(
      (category) =>
        category.key === card.categoryKey ||
        category.section?.slug === card.categoryKey,
    );
    if (matchingCategory) openCategory(matchingCategory);
  }

  function openBrandBanner(banner: SupermarketBrandBanner) {
    // The destination uses now.get_supermarket_brand_products, which returns
    // only active/available products with the exact canonical brand_id.
    router.push({
      pathname: '/supermarket-campaign/[id]',
      params: {
        id: banner.brandId,
        storeId: currentStore.id,
        view: 'catalog-brand',
      },
    });
  }

  // Open a full product experience while preserving one-tap add on the card.
  function openProductDetails(product: CatalogProduct) {
    router.push({
      pathname: '/supermarket-product/[id]',
      params: {
        id: product.id,
        storeId: currentStore.id,
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
        id:
          currentStore.id,

        name:
          currentStore.name,

        icon:
          currentStore.icon,

        categorySlug:
          'supermarket',

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
      },
    );
  }

  function increaseFeaturedProduct(
    product: CatalogProduct,
  ) {
    if (isStoreClosed) {
      return;
    }

    const existingItem =
      cartItems.find(
        (item) =>
          item.id ===
          product.id,
      );

    if (existingItem) {
      increaseStoreItem(
        currentStore.id,
        product.id,
      );

      return;
    }

    addFeaturedProduct(
      product,
    );
  }

  function decreaseFeaturedProduct(
    productId: string,
  ) {
    const existingItem =
      cartItems.find(
        (item) =>
          item.id ===
          productId,
      );

    if (!existingItem) {
      return;
    }

    decreaseStoreItem(
      currentStore.id,
      productId,
    );
  }

  function getProductQuantity(
    productId: string,
  ) {
    return (
      cartItems.find(
        (item) =>
          item.id ===
          productId,
      )?.quantity ?? 0
    );
  }

  function renderReorderProduct(product: CatalogProduct) {
    return (
      <FeaturedProductCard
        key={`reorder-${product.id}`}
        product={product}
        currencyCode={currencyCode}
        cardWidth={featuredCardWidth}
        quantity={getProductQuantity(product.id)}
        isStoreClosed={isStoreClosed}
        onOpen={() => openProductDetails(product)}
        onAdd={() => addFeaturedProduct(product)}
        onIncrease={() => increaseFeaturedProduct(product)}
        onDecrease={() => decreaseFeaturedProduct(product.id)}
      />
    );
  }

  if (isStoreClosed) {
    return (
      <SafeAreaView
        style={
          styles.closedStateScreen
        }
        edges={[
          'top',
          'bottom',
        ]}
      >
        <StatusBar
          style="light"
        />

        <View
          style={
            styles.closedStateHeader
          }
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="رجوع"
            style={({
              pressed,
            }) => [
              styles.closedBackButton,

              pressed &&
                styles.closedBackButtonPressed,
            ]}
            onPress={() =>
              router.back()
            }
          >
            <ClosedBackArrowIcon />
          </Pressable>
        </View>

        <ClosedSupermarketExperience
          nextOpeningLabel={
            nextOpeningLabel
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.screen}
      edges={['top']}
    >
      <StatusBar
        style="dark"
      />

      <View
        style={
          styles.pageShell
        }
      >
        <View
          style={styles.header}
        >
          <Pressable
            style={({
              pressed,
            }) => [
              styles.backButton,

              pressed &&
                styles.headerButtonPressed,
            ]}
            onPress={() =>
              router.back()
            }
          >
            <BackArrowIcon />
          </Pressable>

          <CategorySearchEntry
            scope="supermarket"
            storeId={currentStore.id}
            suggestions={searchSuggestions}
            style={styles.headerSearchEntry}
          />
        </View>

        <ScrollView
          style={
            styles.mainScrollView
          }
          contentContainerStyle={[
            styles.mainContent,

            shouldShowCartBar &&
              styles.mainContentWithCart,
          ]}
          onScroll={(event) => {
            handleCartDockScroll(event);
            promoScrollY.current = event.nativeEvent.contentOffset.y;
            prefetchNearbyBannerRails();
          }}
          onLayout={(event) => {
            promoViewportHeight.current = event.nativeEvent.layout.height;
            prefetchNearbyBannerRails();
          }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={
            false
          }
        >
          {mediaCards.length > 0 ? (
            <SupermarketMediaCarousel
              cards={mediaCards}
              viewportWidth={pageWidth}
              onCardPress={openMediaCard}
            />
          ) : null}

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

            <Animated.ScrollView
              key="supermarket-categories-three-rows"
              horizontal
              ref={categoryScrollRef}
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              style={styles.categoriesScroll}
              contentContainerStyle={styles.categoriesRail}
              onLayout={(event) => {
                setCategoryViewportWidth(event.nativeEvent.layout.width);
              }}
              onContentSizeChange={(width) => {
                setCategoryContentWidth(width);
                // Keep the initial three categories on the right, as before.
                requestAnimationFrame(() => {
                  categoryScrollRef.current?.scrollToEnd({ animated: false });
                });
              }}
              onScroll={Animated.event(
                [
                  {
                    nativeEvent: {
                      contentOffset: { x: categoryScrollX },
                    },
                  },
                ],
                { useNativeDriver: true },
              )}
            >
              {categoryColumns.map((column, columnIndex) => (
                <View
                  key={`category-column-${columnIndex}`}
                  style={[
                    styles.categoryColumn,
                    { width: categoryCardWidth },
                  ]}
                >
                  {column.map((item) => (
                    <Pressable
                      key={item.key}
                      accessibilityRole="button"
                      accessibilityLabel={item.label}
                      style={({ pressed }) => [
                        styles.categoryItem,
                        {
                          width: categoryCardWidth,
                          height: categoryCardHeight,
                        },
                        pressed && styles.categoryItemPressed,
                      ]}
                      onPress={() => openCategory(item)}
                    >
                      <CategoryVisual item={item} />
                      <Text
                        style={styles.categoryLabel}
                        numberOfLines={2}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </Animated.ScrollView>

            <View style={styles.categoryPagination}>
              <Animated.View
                style={[
                  styles.categoryPaginationActive,
                  {
                    transform: [{ translateX: categoryIndicatorTranslateX }],
                  },
                ]}
              />
            </View>
          </View>

          {/* Brand Banners: dedicated DB table; not a replacement for the top
              16:9 media carousel or the existing promo cards below. */}
          {brandBanners.length > 0 ? (
            <SupermarketBrandBanners
              banners={brandBanners}
              pageWidth={pageWidth}
              onBannerPress={openBrandBanner}
            />
          ) : null}

          {/* Personalized reorder preview: "عرض الكل" opens its own screen. */}
          <View style={styles.reorderSection}>
            <View style={styles.reorderHeader}>
              {reorderProducts.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="عرض كل المنتجات التي طلبتها سابقًا"
                  hitSlop={10}
                  onPress={() => router.push({
                    pathname: '/supermarket-reorder',
                    params: { storeId: currentStore.id },
                  })}
                  style={({ pressed }) => [styles.reorderAllButton, pressed && styles.generalPressed]}
                >
                  <Text style={styles.reorderAllText}>عرض الكل</Text>
                </Pressable>
              ) : <View />}
              <Text style={styles.reorderTitle}>اطلب من جديد</Text>
            </View>

            {isReorderLoading || (reorderedProductIds.length > 0 && previewQuery.isPending) ? (
              <ActivityIndicator style={styles.reorderLoading} size="small" color="#00B14F" />
            ) : reorderError || (reorderedProductIds.length > 0 && previewQuery.isError) ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (reorderError) setReorderRetryKey(value => value + 1);
                  else void previewQuery.refetch();
                }}
                style={styles.reorderMessageContainer}
              >
                <Text style={styles.reorderMessage}>مش قادرين نعرض المنتجات اللي طلبتها دلوقتي — اضغط لإعادة المحاولة</Text>
              </Pressable>
            ) : reorderProducts.length === 0 ? (
              <View style={styles.reorderMessageContainer}>
                <Text style={styles.reorderMessage}>أول ما تطلب من الماركت، المنتجات اللي طلبتها هتظهر هنا.</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                nestedScrollEnabled
                directionalLockEnabled
                showsHorizontalScrollIndicator={false}
                style={styles.reorderScroll}
                contentContainerStyle={styles.reorderRail}
                onContentSizeChange={() => {
                  reorderScrollRef.current?.scrollToEnd({ animated: false });
                }}
                ref={reorderScrollRef}
              >
                {[...reorderProducts.slice(0, REORDER_PREVIEW_COUNT)]
                  .reverse()
                  .map(renderReorderProduct)}
              </ScrollView>
            )}
          </View>

          {spotlightCard ? (
            <View
              style={styles.spotlightSection}
            >
              <SupermarketSpotlightCard
                key={spotlightCard.id}
                card={spotlightCard}
                onPress={openSpotlight}
              />
            </View>
          ) : null}

          {visiblePromotionBanners.map(
            (
              banner,
              bannerIndex,
            ) => (
              <View
                key={
                  banner.id
                }
                style={[
                  styles.promotionSection,

                  bannerIndex ===
                    visiblePromotionBanners.length -
                      1 &&
                    styles.promotionSectionLast,
                ]}
                onLayout={(event) => {
                  const { y, height } = event.nativeEvent.layout;
                  promoBannerRects.current.set(banner.id, { top: y, bottom: y + height });
                  prefetchNearbyBannerRails();
                }}
              >
                <View
                  pointerEvents="none"
                  style={
                    styles.promotionBannerFrame
                  }
                >
                  <Image
                    source={{
                      uri:
                        banner.imageUrl,
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

                <PromotionBannerProductRail
                  banner={banner}
                  storeId={currentStore.id}
                  serviceAreaId={delivery.serviceAreaId}
                  shouldLoad={prefetchedBannerIds.has(banner.id)}
                  currencyCode={currencyCode}
                  cardWidth={featuredCardWidth}
                  overlap={promotionProductsOverlap}
                  isStoreClosed={isStoreClosed}
                  cartItems={cartItems}
                  onOpen={openProductDetails}
                  onAdd={addFeaturedProduct}
                  onIncrease={increaseFeaturedProduct}
                  onDecrease={decreaseFeaturedProduct}
                />
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

      maxWidth: 560,

      position:
        'relative',

      width: '100%',
    },

    header: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      /*
       * Header layout:
       * Back button stays at the FAR LEFT.
       * Search fills the remaining space immediately to its RIGHT.
       */
      flexDirection:
        'row',

      gap: 10,

      paddingBottom:
        10,

      paddingHorizontal:
        16,

      paddingTop: 10,

      zIndex: 10,
    },

    headerSearchEntry: {
      flex: 1,

      /*
       * CategorySearchEntry has page-level margins by default.
       * Remove them here because it now lives inside the header row.
       */
      marginBottom: 0,

      marginHorizontal: 0,

      marginTop: 0,
    },

    backButton: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderColor:
        '#E6E6E6',

      borderRadius: 999,

      borderWidth:
        StyleSheet.hairlineWidth,

      height: 40,

      justifyContent:
        'center',

      width: 40,
    },

    headerButtonPressed: {
      backgroundColor:
        '#F7F7F7',

      transform: [
        {
          scale: 0.97,
        },
      ],
    },






    mainScrollView: {
      flex: 1,
    },

    mainContent: {
      backgroundColor:
        '#FFFFFF',

      paddingBottom:
        30,
    },

    mainContentWithCart: {
      paddingBottom:
        180,
    },

    /* Featured 16:9 media cards above "تسوق حسب الفئة". */
    topMediaSection: {
      backgroundColor: '#FFFFFF',
      marginBottom: 17,
      paddingTop: 5,
      width: '100%',
    },

    topMediaScroll: {
      direction: 'ltr',
      width: '100%',
    },

    topMediaRail: {
      direction: 'ltr',
      alignItems: 'center',
      flexDirection: 'row',
      gap: MEDIA_CARD_GAP,
    },

    topMediaCard: {
      backgroundColor: '#F5F0E8',
      borderRadius: 20,
      overflow: 'hidden',
      position: 'relative',
    },

    topMediaCardPressed: {
      opacity: 0.94,
    },

    topMediaImage: {
      width: '100%',
      height: '100%',
    },

    topMediaFallback: {
      alignItems: 'center',
      backgroundColor: '#E6EDE7',
      height: '100%',
      justifyContent: 'center',
      width: '100%',
    },

    topMediaVideoFill: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },

    topMediaVideo: {
      height: '100%',
      width: '100%',
    },

    topMediaVideoHidden: {
      opacity: 0,
    },

    topMediaVideoPlaceholder: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      backgroundColor: '#F5F0E8',
      justifyContent: 'center',
    },

    categoriesSection: {
      backgroundColor:
        '#FFFFFF',

      paddingTop: 1,
    },

    categoriesTitle: {
      color:
        '#202020',

      fontSize: 21,

      fontWeight:
        '800',

      letterSpacing:
        -0.45,

      marginBottom:
        14,

      paddingHorizontal:
        16,

      /*
       * Force the Arabic section title to the RIGHT regardless
       * of the device/layout direction.
       */
      textAlign:
        'right',

      writingDirection:
        'rtl',

      width: '100%',
    },

    // Horizontal carousel of columns; each column contains exactly 3 cards.
    categoriesScroll: {
      direction: 'ltr',
    },

    categoriesRail: {
      direction: 'ltr',
      flexDirection: 'row',
      gap: CATEGORY_CARD_GAP,
      paddingHorizontal: CATEGORY_HORIZONTAL_PADDING,
    },

    categoryColumn: {
      gap: CATEGORY_CARD_GAP,
    },

    categoryPagination: {
      alignSelf: 'center',
      backgroundColor: '#E6E6E6',
      borderRadius: 3,
      height: 5,
      marginBottom: 22,
      marginTop: 18,
      overflow: 'hidden',
      position: 'relative',
      width: CATEGORY_INDICATOR_TRACK_WIDTH,
    },

    categoryPaginationActive: {
      backgroundColor: '#151515',
      borderRadius: 3,
      height: 5,
      left: 0,
      position: 'absolute',
      top: 0,
      width: CATEGORY_INDICATOR_THUMB_WIDTH,
    },

    /* Brand banners: 3 portrait cards on wide phones; swipe on narrower screens.
       The circular logo overlaps the coloured artwork, matching the reference. */
    brandBannersSection: {
      width: '100%',
      backgroundColor: '#FFFFFF',
      marginTop: 3,
      marginBottom: 25,
    },
    brandBannersScroll: {
      direction: 'ltr',
      width: '100%',
      overflow: 'visible',
    },
    brandBannersRail: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 5,
      paddingBottom: 6,
    },
    brandBannerCard: {
      flexShrink: 0,
      position: 'relative',
      overflow: 'visible',
    },
    brandBannerPressed: {
      opacity: 0.86,
      transform: [{ scale: 0.98 }],
    },
    brandBannerPanel: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      top: 43,
      borderRadius: 23,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
    },
    brandBannerGlow: {
      backgroundColor: 'rgba(255,255,255,0.12)',
      width: '135%',
      height: '72%',
      borderRadius: 200,
      position: 'absolute',
      top: '3%',
      left: '-17.5%',
    },
    brandBannerHeroImage: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%',
    },
    brandBannerCircle: {
      position: 'absolute',
      top: 0,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      zIndex: 2,
      elevation: 2,
      shadowColor: '#111111',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.11,
      shadowRadius: 4,
    },
    brandBannerLogo: {
      width: '100%',
      height: '100%',
    },
    brandBannerLogoPlaceholder: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
    },

    // Reuses FeaturedProductCard: dimensions, image, badge, quantity + price
    // stay identical to existing supermarket promotional product cards.
    reorderSection: {
      backgroundColor: '#FFFFFF',
      marginBottom: 24,
      paddingTop: 3,
    },
    reorderHeader: {
      direction: 'ltr',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 14,
      minHeight: 31,
    },
    reorderTitle: {
      color: '#202020',
      fontSize: 21,
      fontWeight: '800',
      letterSpacing: -0.45,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    reorderAllButton: {
      minHeight: 35,
      justifyContent: 'center',
      paddingRight: 12,
    },
    reorderAllText: {
      color: '#202020',
      fontSize: 14,
      fontWeight: '600',
      writingDirection: 'rtl',
    },
    reorderScroll: {
      direction: 'ltr',
      width: '100%',
    },
    reorderRail: {
      direction: 'ltr',
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: PROMOTION_PRODUCT_GAP,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    reorderLoading: { marginVertical: 22 },
    reorderMessageContainer: {
      backgroundColor: '#F8F8F8',
      borderRadius: 13,
      paddingVertical: 18,
      paddingHorizontal: 18,
      marginHorizontal: 16,
    },
    reorderMessage: {
      color: '#777777',
      fontSize: 13,
      lineHeight: 21,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    // Independent DB-driven spotlight card below the reorder section.
    spotlightSection: {
      marginHorizontal: 16,
      marginBottom: 26,
    },
    spotlightCard: {
      width: '100%',
      // Slightly taller than a square while keeping the same card width.
      aspectRatio: 0.92,
      borderRadius: 23,
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: '#1F2421',
    },
    spotlightPressed: { opacity: 0.96 },
    spotlightMedia: { ...StyleSheet.absoluteFill },
    spotlightVideoView: { width: '100%', height: '100%' },
    spotlightVideoLoading: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    spotlightVideoFallback: {
      ...StyleSheet.absoluteFill,
      backgroundColor: '#1F2421',
      alignItems: 'center',
      justifyContent: 'center',
    },
    spotlightGradient: { ...StyleSheet.absoluteFill },
    spotlightCopy: {
      position: 'absolute',
      top: 28,
      right: 23,
      left: 23,
      alignItems: 'flex-end',
    },
    spotlightEyebrow: {
      color: '#FFFFFF',
      fontSize: 19,
      fontWeight: '600',
      lineHeight: 26,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    spotlightTitle: {
      color: '#FFFFFF',
      fontSize: 40,
      fontWeight: '900',
      lineHeight: 49,
      textAlign: 'right',
      writingDirection: 'rtl',
      maxWidth: '100%',
    },
    spotlightButton: {
      position: 'absolute',
      left: 18,
      bottom: 18,
      backgroundColor: NAVIENTY_NOW_COLORS.primary,
      paddingHorizontal: 26,
      minHeight: 52,
      borderRadius: 27,
      alignItems: 'center',
      justifyContent: 'center',
    },
    spotlightButtonText: {
      color: '#FFFFFF',
      fontWeight: '800',
      fontSize: 18,
      writingDirection: 'rtl',
    },

    // Same surface and corner radius as [slug].tsx filterImageCircle.
    categoryItem: {
      backgroundColor: '#F5F0E9',
      borderColor: '#ECE9E5',
      borderRadius: 15,
      borderWidth: StyleSheet.hairlineWidth,
      flexShrink: 0,
      overflow: 'hidden',
      position: 'relative',
      shadowColor: '#111111',
      shadowOffset: { height: 1, width: 0 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
    },

    categoryItemPressed: {
      opacity: 0.75,
      transform: [{ scale: 0.97 }],
    },

    // Full-bleed image: [slug].tsx filterCategoryImage is 100% x 100%.
    // Previously this image container was just 67% of the card height.
    categoryImageBox: {
      alignItems: 'center',
      bottom: 0,
      height: '100%',
      justifyContent: 'center',
      left: 0,
      overflow: 'hidden',
      position: 'absolute',
      right: 0,
      top: 0,
      width: '100%',
    },

    categoryFallbackIcon: {
      fontSize: 32,
      marginBottom: 14,
    },

    categoryImage: {
      height: '100%',
      width: '100%',
    },

    // Same title typography/offset as [slug].tsx filterLabel/filterTitleArea.
    categoryLabel: {
      color: '#171717',
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 15,
      textAlign: 'center',
      writingDirection: 'rtl',
      position: 'absolute',
      left: 5,
      right: 5,
      top: 8,
      zIndex: 2,
    },

    /* ========================================================
     * PROMOTION BANNER
     * ========================================================
     */

    promotionSection: {
      backgroundColor:
        '#FFFFFF',

      marginBottom:
        22,

      overflow:
        'visible',

      width: '100%',
    },

    promotionSectionLast: {
      marginBottom: 0,
    },

    /*
     * IMPORTANT:
     *
     * Removed marginHorizontal: 9.
     *
     * Banner now touches both
     * sides of the page.
     */
    promotionBannerFrame: {
      marginHorizontal:
        0,

      overflow:
        'hidden',

      position:
        'relative',

      width:
        '100%',

      zIndex:
        1,
    },

    promotionBanner: {
      backgroundColor:
        '#F4F4F4',

      width: '100%',
    },

    promotionProductsScroll: {
      elevation:
        10,

      overflow:
        'visible',

      position:
        'relative',

      zIndex:
        10,
    },

    promotionRailStatus: {
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      minHeight: 74,
      justifyContent: 'center',
      marginHorizontal: 12,
      paddingHorizontal: 18,
      position: 'relative',
      width: '85%',
      zIndex: 10,
    },

    promotionRailPageStatus: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 86,
      paddingHorizontal: 12,
    },

    promotionRailStatusText: {
      color: '#606060',
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
      writingDirection: 'rtl',
    },

    promotionProductsRail: {
      alignItems:
        'flex-start',

      gap:
        PROMOTION_PRODUCT_GAP,

      paddingBottom: 7,

      paddingHorizontal:
        PROMOTION_PRODUCT_HORIZONTAL_PADDING,

      paddingTop: 0,
    },

    featuredProductCard: {
      backgroundColor:
        'transparent',

      overflow:
        'visible',
    },

    featuredProductCardPressed: {
      opacity: 0.92,
    },

    featuredProductImageBox: {
      alignItems:
        'center',

      backgroundColor:
        '#F7F7F7',

      borderColor:
        '#E8E8E8',

      borderRadius:
        14,

      borderWidth:
        1,

      justifyContent:
        'center',

      overflow:
        'hidden',

      position:
        'relative',
    },

    featuredProductImage: {
      height:
        '100%',

      width:
        '100%',
    },

    featuredProductFallback: {
      fontSize: 34,
    },

    featuredDiscountBadge: {
      alignItems:
        'center',

      backgroundColor:
        '#BFFF00',

      borderRadius: 3,

      justifyContent:
        'center',

      left: 6,

      minHeight: 17,

      paddingHorizontal:
        4,

      paddingVertical:
        2,

      position:
        'absolute',

      top: 6,

      zIndex: 5,
    },

    featuredDiscountText: {
      color:
        '#111111',

      fontSize: 8.5,

      fontWeight:
        '500',

      lineHeight: 11,
    },

    featuredAddButton: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderColor:
        '#E7E7E7',

      borderRadius:
        20,

      borderWidth:
        1,

      bottom:
        8,

      elevation:
        2,

      height:
        38,

      justifyContent:
        'center',

      position:
        'absolute',

      right:
        8,

      shadowColor:
        '#000000',

      shadowOffset: {
        width:
          0,

        height:
          1,
      },

      shadowOpacity:
        0.08,

      shadowRadius:
        2,

      width:
        38,

      zIndex:
        8,
    },

    featuredAddButtonPressed: {
      backgroundColor:
        '#F8F8F8',

      transform: [
        {
          scale:
            0.94,
        },
      ],
    },

    featuredAddButtonDisabled: {
      opacity: 0.45,
    },

    featuredAddButtonText: {
      color:
        NAVIENTY_NOW_COLORS.primary,

      fontSize:
        27,

      fontWeight:
        '300',

      lineHeight:
        29,

      marginTop:
        -2,
    },

    featuredQuantityPill: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderColor:
        '#E7E7E7',

      borderRadius:
        20,

      borderWidth:
        1,

      bottom:
        8,

      elevation:
        2,

      flexDirection:
        'row',

      height:
        38,

      position:
        'absolute',

      right:
        8,

      shadowColor:
        '#000000',

      shadowOffset: {
        width:
          0,

        height:
          1,
      },

      shadowOpacity:
        0.08,

      shadowRadius:
        2,

      zIndex:
        8,
    },

    featuredQuantityButton: {
      alignItems:
        'center',

      height:
        36,

      justifyContent:
        'center',

      width:
        28,
    },

    featuredQuantityButtonText: {
      color:
        NAVIENTY_NOW_COLORS.primary,

      fontSize:
        20,

      fontWeight:
        '500',

      lineHeight:
        22,
    },

    featuredQuantityValue: {
      color:
        '#202020',

      fontSize:
        11,

      fontWeight:
        '700',

      minWidth:
        16,

      textAlign:
        'center',
    },

    featuredProductName: {
      color:
        '#202020',

      fontSize:
        13.5,

      fontWeight:
        '500',

      letterSpacing:
        -0.1,

      lineHeight:
        17,

      marginTop:
        8,

      minHeight:
        34,

      paddingHorizontal:
        2,

      textAlign:
        'center',

      width: '100%',

      writingDirection:
        'rtl',
    },

    featuredPriceRow: {
      alignItems:
        'center',

      alignSelf:
        'center',

      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap:
        4,

      justifyContent:
        'center',

      marginTop:
        4,

      width: '100%',
    },


    featuredCurrentPriceWrap: {
      alignSelf:
        'center',

      borderBottomColor:
        '#BFFF00',

      borderBottomWidth:
        2,
    },


    featuredCurrentPrice: {
      color:
        '#202020',

      fontSize:
        11.5,

      fontWeight:
        '500',

      lineHeight:
        14,

      textAlign:
        'center',

      writingDirection:
        'ltr',
    },


    featuredOldPrice: {
      color:
        '#858585',

      fontSize:
        9.5,

      lineHeight:
        12,

      textAlign:
        'center',

      textDecorationLine:
        'line-through',

      writingDirection:
        'ltr',
    },







    cartBarFloatingWrapper: {
      bottom: 12,

      left: 18,

      position:
        'absolute',

      right: 18,

      zIndex: 999,
    },

    cartBar: {
      alignItems:
        'center',

      backgroundColor:
        '#00B956',

      borderRadius: 34,

      elevation: 20,

      flexDirection:
        'row',

      height: 64,

      justifyContent:
        'space-between',

      paddingHorizontal:
        9,

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: 3,
      },

      shadowOpacity:
        0.16,

      shadowRadius: 8,

      width: '100%',
    },

    cartBarPressed: {
      opacity: 0.92,

      transform: [
        {
          scale:
            0.985,
        },
      ],
    },

    cartCountBadge: {
      alignItems:
        'center',

      backgroundColor:
        '#009D49',

      borderRadius: 24,

      height: 48,

      justifyContent:
        'center',

      width: 48,
    },

    cartCountText: {
      color:
        '#FFFFFF',

      fontSize: 17,

      fontWeight:
        '800',

      textAlign:
        'center',
    },

    cartBarRight: {
      alignItems:
        'flex-end',

      flex: 1,

      justifyContent:
        'center',

      paddingHorizontal:
        16,
    },

    cartBarText: {
      color:
        '#FFFFFF',

      fontSize: 15.5,

      fontWeight:
        '800',

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    /* ========================================================
     * CLOSED SUPERMARKET — FULL SCREEN EXPERIENCE
     * ========================================================
     */

    closedStateScreen: {
      backgroundColor:
        '#102019',

      flex: 1,
    },

    closedStateHeader: {
      alignItems:
        'flex-start',

      height:
        62,

      justifyContent:
        'center',

      paddingHorizontal:
        16,

      zIndex:
        20,
    },

    closedBackButton: {
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

    closedBackButtonPressed: {
      backgroundColor:
        'rgba(255, 255, 255, 0.15)',

      transform: [
        {
          scale:
            0.97,
        },
      ],
    },

    closedBackArrowCanvas: {
      height:
        23,

      position:
        'relative',

      width:
        24,
    },

    closedBackArrowStem: {
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

    closedBackArrowDiagonal: {
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

    closedBackArrowTop: {
      top:
        7,

      transform: [
        {
          rotate:
            '-42deg',
        },
      ],
    },

    closedBackArrowBottom: {
      top:
        14,

      transform: [
        {
          rotate:
            '42deg',
        },
      ],
    },

    closedExperience: {
      alignItems:
        'center',

      flex:
        1,

      justifyContent:
        'center',

      overflow:
        'hidden',

      paddingBottom:
        42,

      position:
        'relative',

      width:
        '100%',
    },

    closedExperienceGlow: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.primary,

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

    closedExperienceMoon: {
      backgroundColor:
        '#DFF9E8',

      borderRadius:
        999,

      height:
        54,

      position:
        'absolute',

      right:
        36,

      top:
        34,

      width:
        54,
    },

    closedExperienceMoonCutout: {
      backgroundColor:
        '#102019',

      borderRadius:
        999,

      height:
        49,

      left:
        18,

      position:
        'absolute',

      top:
        -3,

      width:
        49,
    },

    closedExperienceStar: {
      backgroundColor:
        '#DFF9E8',

      borderRadius:
        999,

      height:
        5,

      position:
        'absolute',

      width:
        5,
    },

    closedExperienceStarOne: {
      right:
        109,

      top:
        61,
    },

    closedExperienceStarTwo: {
      height:
        3,

      right:
        76,

      top:
        111,

      width:
        3,
    },

    closedExperienceStarThree: {
      height:
        4,

      left:
        44,

      top:
        116,

      width:
        4,
    },

    closedExperienceStore: {
      height:
        260,

      marginTop:
        -58,

      position:
        'relative',

      width:
        270,
    },

    closedStoreRoof: {
      backgroundColor:
        '#F5F0E7',

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

    closedStoreAwning: {
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

    closedStoreAwningStripe: {
      flex:
        1,
    },

    closedStoreBuilding: {
      backgroundColor:
        '#F5F0E7',

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

    closedStoreWindow: {
      backgroundColor:
        '#1A2D24',

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

    closedStoreProductsTop: {
      alignItems:
        'flex-end',

      bottom:
        52,

      flexDirection:
        'row',

      gap:
        9,

      left:
        14,

      position:
        'absolute',

      right:
        14,
    },

    closedStoreProductsBottom: {
      alignItems:
        'flex-end',

      bottom:
        15,

      flexDirection:
        'row',

      gap:
        8,

      left:
        14,

      position:
        'absolute',

      right:
        14,
    },

    closedStoreProduct: {
      borderRadius:
        5,

      height:
        24,

      width:
        28,
    },

    closedStoreProductSmall: {
      borderRadius:
        4,

      height:
        18,

      width:
        21,
    },

    closedStoreProductGreen: {
      backgroundColor:
        '#7ED29F',
    },

    closedStoreProductCream: {
      backgroundColor:
        '#F2DFB6',
    },

    closedStoreProductOrange: {
      backgroundColor:
        '#F2A06A',
    },

    closedStoreShutter: {
      backgroundColor:
        '#AEB5B1',

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

    closedStoreShutterLine: {
      backgroundColor:
        'rgba(255, 255, 255, 0.42)',

      height:
        2,

      marginTop:
        10,
    },

    closedStoreDoorBase: {
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

    closedStoreLock: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_COLORS.primary,

      borderRadius:
        12,

      height:
        25,

      justifyContent:
        'center',

      width:
        25,
    },

    closedStoreLockDot: {
      backgroundColor:
        '#FFFFFF',

      borderRadius:
        999,

      height:
        5,

      width:
        5,
    },

    closedStoreGroundShadow: {
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

    closedExperienceBag: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.primary,

      borderRadius:
        18,

      height:
        76,

      left:
        28,

      position:
        'absolute',

      top:
        '45%',

      transform: [
        {
          rotate:
            '-10deg',
        },
      ],

      width:
        62,
    },

    closedExperienceBagHandle: {
      borderBottomWidth:
        0,

      borderColor:
        '#DFF9E8',

      borderRadius:
        15,

      borderWidth:
        4,

      height:
        24,

      left:
        16,

      position:
        'absolute',

      top:
        -12,

      width:
        30,
    },

    closedExperienceBagMark: {
      backgroundColor:
        '#DFF9E8',

      borderRadius:
        999,

      height:
        15,

      left:
        23.5,

      position:
        'absolute',

      top:
        31,

      width:
        15,
    },

    closedExperienceCopy: {
      alignItems:
        'center',

      marginTop:
        18,

      paddingHorizontal:
        28,

      width:
        '100%',
    },

    closedExperienceTitle: {
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

    closedOpeningPill: {
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

      flexDirection:
        'row-reverse',

      marginTop:
        18,

      minHeight:
        46,

      paddingHorizontal:
        18,

      paddingVertical:
        10,
    },

    closedOpeningText: {
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

    closedOpeningFallback: {
      color:
        '#DFF9E8',

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
      fontSize: 50,
    },

    stateTitle: {
      color:
        '#202020',

      fontSize: 21,

      fontWeight:
        '800',

      marginTop: 15,

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

      marginTop: 22,

      minWidth: 150,

      paddingHorizontal:
        20,

      paddingVertical:
        13,
    },

    retryButtonText: {
      color:
        '#FFFFFF',

      fontSize: 14,

      fontWeight:
        '700',

      textAlign:
        'center',
    },

    errorBackButton: {
      borderColor:
        '#E0E0E0',

      borderRadius: 14,

      borderWidth: 1,

      marginTop: 10,

      minWidth: 150,

      paddingHorizontal:
        20,

      paddingVertical:
        12,
    },

    errorBackButtonText: {
      color:
        '#222222',

      fontSize: 14,

      fontWeight:
        '600',

      textAlign:
        'center',
    },

    generalPressed: {
      opacity: 0.72,

      transform: [
        {
          scale: 0.98,
        },
      ],
    },
  });

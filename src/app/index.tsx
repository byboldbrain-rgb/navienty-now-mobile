import { Ionicons } from '@expo/vector-icons';
// SEARCH_PREMIUM_V3_2026_08_29
// NAVIENTY_BIKE_HEADER_V8_24H_JOURNEY_2026_08_11
import { Image as ExpoImage } from 'expo-image';
import {
  useFocusEffect,
  useRouter,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  Linking,
  Modal,
  type NativeScrollEvent,
  StatusBar as NativeStatusBar,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import AppBottomNavigation from '../category/app-bottom-navigation';
import { getCategoryIcon } from '../config/category-icons';
import { useAuthSession } from '../hooks/use-auth-session';
import { publicSupabase } from '../lib/supabase';
import getAppBootstrap, {
  type AppBootstrap,
  type City,
  type ServiceArea,
} from '../services/bootstrap-service';
import {
  type CatalogProduct,
  getStoreCatalog,
  listStores,
  type StoreCatalog,
  type StoreSummary,
} from '../services/catalog-service';
import {
  type HomeBanner,
  type HomeBannerAudience,
  type HomeBannerPlacement,
  listHomeBanners,
} from '../services/home-banners-service';
import {
  getMyOrders,
  getOrderByToken,
} from '../services/order-service';
import { useCartStore } from '../store/cart-store';
import { useCustomerStore } from '../store/customer-store';
import {
  type Order,
  type OrderStatus,
  useOrdersStore,
} from '../store/orders-store';
import {
  NAVIENTY_NOW_COLORS,
  NAVIENTY_NOW_LAYOUT,
} from '../theme/navienty-now-theme';

const navientyNowLogo = require('../assets/images/navienty-now-logo.jpg');
const navientyDeliveryBike = require('../assets/images/navienty-now-delivery-bike-transparent.png');
const navienty24hMoodBackground = require('../assets/images/navienty-now-24h-mood-background.png');
const navientyHadabaAsyutUpHero = require('../assets/images/navienty-now-hadaba-asyut-up.png');

let hasShownCampusUpdateModalThisSession = false;

const personalCareCategoryIcon = require('../assets/icons/categories/personal-care.webp');
const laundryCategoryIcon = require('../assets/icons/categories/laundry.webp');
const requestAnythingCategoryIcon = require('../assets/icons/categories/request-anything.webp');

const HOME_ORDER_POLL_INTERVAL_MS = 8000;
const HOME_BANNER_HEIGHT_SCALE = 1.1;
const HOME_BANNER_ASPECT_RATIO =
  (16 / 9) / HOME_BANNER_HEIGHT_SCALE;
const SUPERMARKET_PROMOTION_BANNER_HEIGHT_RATIO =
  0.64;
const HOME_SEARCH_PLACEHOLDER_ROTATION_MS = 1800;
const HOME_SEARCH_CATALOG_CONCURRENCY = 4;

type BootstrapCategory =
  AppBootstrap['store_categories'][number] & {
    subtitle_ar?: string | null;
    subtitle_en?: string | null;
  };

type HomeCategory = {
  id: string;
  slug: string;
  name_ar: string;
  image_url?: string | null;
  localArtwork?: ImageSourcePropType;
  configuredArtworkSlug?: string;
  fallbackIcon: keyof typeof Ionicons.glyphMap;
};

type HomeCategoryDefinition = {
  slug: string;
  nameAr: string;
  slugAliases: readonly string[];
  nameAliases: readonly string[];
  localArtwork?: ImageSourcePropType;
  useConfiguredArtwork?: boolean;
  fallbackIcon: keyof typeof Ionicons.glyphMap;
};


/* ---------------------------------- */
/* RELEASE WORKSPACE COMPATIBILITY    */
/* ---------------------------------- */

/*
 * This release workspace does not include the newer Home personalization
 * service files yet. Keep the Home screen safe and compilable without
 * importing modules that are not present in this branch. The rails below
 * simply stay hidden until those services are restored to the workspace.
 */
type RecentlyViewedItem = {
  id: string;
  kind: string;
  storeId: string;
  title: string;
  icon?: string | null;
  imageUrl?: string | null;
  storeCategorySlug?: string | null;
};

type ForYouRecommendation = {
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

type PromoHomeContext =
  | 'morning'
  | 'midday'
  | 'evening'
  | 'late_night'
  | 'month_end'
  | 'all';

type BehaviorEventInput = {
  eventName: string;
  serviceAreaId?: string | null;
  properties?: Record<string, unknown>;
};

function trackBehaviorEvent(
  _event: BehaviorEventInput,
): Promise<void> {
  // Analytics service is not bundled in this release workspace.
  return Promise.resolve();
}

function getForYouRecommendations(
  _input: {
    serviceAreaId?: string | null;
    orders: readonly Order[];
  },
): Promise<ForYouRecommendation[]> {
  return Promise.resolve([]);
}

function getRecentlyViewedItems(
  _limit: number,
): Promise<RecentlyViewedItem[]> {
  return Promise.resolve([]);
}

function subscribeRecentlyViewed(
  _listener: (
    items: RecentlyViewedItem[],
  ) => void,
): () => void {
  return () => undefined;
}

function clearSearchAttribution(): Promise<void> {
  // Search attribution service is not bundled in this release workspace.
  return Promise.resolve();
}

function getBannerHomeContext(
  banner: HomeBanner,
): PromoHomeContext {
  const content =
    banner.content as unknown as {
      homeContext?: PromoHomeContext | null;
    };

  return content.homeContext ?? 'all';
}

async function openHomeBannerActionCompat({
  banner,
  router,
  fallbackWhatsAppNumber,
}: {
  banner: HomeBanner;
  router: ReturnType<typeof useRouter>;
  fallbackWhatsAppNumber?: string | null;
}): Promise<boolean> {
  const linkUrl =
    banner.linkUrl?.trim() ?? '';

  if (linkUrl) {
    if (linkUrl.startsWith('/')) {
      router.push(linkUrl as never);
      return true;
    }

    if (!linkUrl.includes('://')) {
      router.push(
        `/${linkUrl}` as never,
      );
      return true;
    }

    try {
      const canOpen =
        await Linking.canOpenURL(
          linkUrl,
        );

      if (canOpen) {
        await Linking.openURL(linkUrl);
        return true;
      }
    } catch (error) {
      console.warn(
        'Unable to open Home banner link.',
        linkUrl,
        error,
      );
    }
  }

  const normalizedActionType =
    String(
      banner.actionType ?? 'none',
    )
      .trim()
      .toLowerCase();

  if (
    fallbackWhatsAppNumber &&
    normalizedActionType.includes(
      'whatsapp',
    )
  ) {
    const whatsappNumber =
      fallbackWhatsAppNumber.replace(
        /\D/g,
        '',
      );

    if (whatsappNumber) {
      const whatsappUrl =
        `https://wa.me/${whatsappNumber}`;

      try {
        await Linking.openURL(
          whatsappUrl,
        );
        return true;
      } catch (error) {
        console.warn(
          'Unable to open WhatsApp banner action.',
          error,
        );
      }
    }
  }

  return false;
}

/*
 * The Home categories are intentionally defined here instead of relying on
 * the order returned by Supabase. This keeps the six primary services in the
 * exact product order requested, while still reusing each category's remote
 * image and real backend slug whenever that category already exists.
 */
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

function buildHomeCategories(
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

type ResolvedLocation = {
  areaId: string | null;
  cityId: string | null;
  cityName: string;
  areaName: string;
  fullName: string;
};

type PromoCard = {
  key: string;
  eyebrow: string;
  title: string;
  description: string;
  backgroundColor: string;
  foregroundColor: string;
  secondaryColor: string;
  decoration: 'logo' | 'bags' | 'route';
};

type HomeDiscoveryDestination =
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

type HomeDiscoveryItem = {
  key: string;
  label: string;
  image: ImageSourcePropType;
  destination: HomeDiscoveryDestination;
};

/*
 * Keep Home banner rendering independent from the exact promo-action-service
 * version bundled by Metro. Some release workspaces may still have an older
 * promo-action module that does not export canOpenHomeBanner at runtime.
 *
 * This mirrors the intended rule:
 * - detail_screen is always openable
 * - any non-none action is openable
 * - a legacy linkUrl is openable
 */
function canOpenHomeBannerSafely(
  banner: HomeBanner,
): boolean {
  return (
    banner.presentationType ===
      'detail_screen' ||
    banner.actionType !== 'none' ||
    Boolean(banner.linkUrl)
  );
}

/*
 * Discovery is product navigation, not marketing.
 *
 * The rail changes with Cairo time so Home feels context-aware without
 * pretending to have an ML recommendation system. Every card still deep-links
 * into a real cuisine/category screen, while home_banners remain reserved for
 * time-bound campaigns and editorial moments.
 */
type HomeDiscoveryCatalogKey =
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

type HomeDiscoveryContext = {
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
    image: require('../assets/cuisines/breakfast.webp'),
    destination: {
      type: 'restaurant-cuisine',
      cuisineKey: 'breakfast',
    },
  },

  bakery: {
    key: 'bakery',
    label: 'مخبوزات',
    image: require('../assets/cuisines/bakery.webp'),
    destination: {
      type: 'restaurant-cuisine',
      cuisineKey: 'bakery',
    },
  },

  'coffee-tea': {
    key: 'coffee-tea',
    label: 'قهوة وشاي',
    image: require('../../assets/images/supermarket-categories/coffee-tea.webp'),
    destination: {
      type: 'supermarket-category',
      slug: 'coffee-tea',
    },
  },

  beverages: {
    key: 'beverages',
    label: 'مشروبات',
    image: require('../../assets/images/supermarket-categories/beverages.webp'),
    destination: {
      type: 'supermarket-category',
      slug: 'beverages',
    },
  },

  sandwiches: {
    key: 'sandwiches',
    label: 'ساندوتشات',
    image: require('../assets/cuisines/sandwiches.webp'),
    destination: {
      type: 'restaurant-cuisine',
      cuisineKey: 'sandwiches',
    },
  },

  pizza: {
    key: 'pizza',
    label: 'بيتزا',
    image: require('../assets/cuisines/pizza.webp'),
    destination: {
      type: 'restaurant-cuisine',
      cuisineKey: 'pizza',
    },
  },

  crepes: {
    key: 'crepes',
    label: 'كريب',
    image: require('../assets/cuisines/crepes.webp'),
    destination: {
      type: 'restaurant-cuisine',
      cuisineKey: 'crepes',
    },
  },

  desserts: {
    key: 'desserts',
    label: 'حلويات',
    image: require('../assets/cuisines/desserts.webp'),
    destination: {
      type: 'restaurant-cuisine',
      cuisineKey: 'desserts',
    },
  },

  'snacks-chocolate': {
    key: 'snacks-chocolate',
    label: 'شيكولاتة وسناكس',
    image: require('../../assets/images/supermarket-categories/snacks-chocolate.webp'),
    destination: {
      type: 'supermarket-category',
      slug: 'snacks-chocolate',
    },
  },

  notebooks: {
    key: 'notebooks',
    label: 'كراسات ونوت بوك',
    image: require('../../assets/images/bookstore-categories/notebooks.webp'),
    destination: {
      type: 'bookstore-category',
      slug: 'notebooks',
    },
  },

  'face-care': {
    key: 'face-care',
    label: 'العناية بالوجه',
    image: require('../../assets/images/personal-care-categories/face-care.webp'),
    destination: {
      type: 'personal-care-category',
      slug: 'face-care',
    },
  },
};

function getCairoHour(
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

type HomeTimeContext =
  | 'morning'
  | 'midday'
  | 'evening'
  | 'late_night';

type CairoCalendarParts = {
  day: number;
  month: number;
  year: number;
};

function getHomeTimeContext(
  cairoHour: number,
): HomeTimeContext {
  if (
    cairoHour >= 6 &&
    cairoHour < 11
  ) {
    return 'morning';
  }

  if (
    cairoHour >= 11 &&
    cairoHour < 17
  ) {
    return 'midday';
  }

  if (
    cairoHour >= 17 &&
    cairoHour < 22
  ) {
    return 'evening';
  }

  return 'late_night';
}

function getCairoCalendarParts(
  date = new Date(),
): CairoCalendarParts {
  try {
    const formatter =
      new Intl.DateTimeFormat(
        'en-CA',
        {
          day: '2-digit',
          month: '2-digit',
          timeZone: 'Africa/Cairo',
          year: 'numeric',
        },
      );

    const parts =
      formatter.formatToParts(date);

    const day = Number.parseInt(
      parts.find(
        (part) => part.type === 'day',
      )?.value ?? '',
      10,
    );

    const month = Number.parseInt(
      parts.find(
        (part) => part.type === 'month',
      )?.value ?? '',
      10,
    );

    const year = Number.parseInt(
      parts.find(
        (part) => part.type === 'year',
      )?.value ?? '',
      10,
    );

    if (
      Number.isFinite(day) &&
      Number.isFinite(month) &&
      Number.isFinite(year)
    ) {
      return {
        day,
        month,
        year,
      };
    }
  } catch {
    /*
     * Keep Home usable on runtimes with limited Intl time-zone support.
     */
  }

  return {
    day: date.getDate(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
}

function isCairoMonthEnd(
  date = new Date(),
): boolean {
  const { day } =
    getCairoCalendarParts(date);

  return day >= 25;
}

function getPreferredHeroContexts(
  cairoHour: number,
  date = new Date(),
): readonly PromoHomeContext[] {
  const timeContext =
    getHomeTimeContext(
      cairoHour,
    );

  return isCairoMonthEnd(date)
    ? [
        'month_end',
        timeContext,
        'all',
      ]
    : [
        timeContext,
        'all',
      ];
}

function selectContextualHomeHero(
  banners: readonly HomeBanner[],
  preferredContexts: readonly PromoHomeContext[],
): HomeBanner | null {
  if (banners.length === 0) {
    return null;
  }

  for (
    const context of preferredContexts
  ) {
    const matchedBanner =
      banners.find(
        (candidate) =>
          getBannerHomeContext(
            candidate,
          ) === context,
      );

    if (matchedBanner) {
      return matchedBanner;
    }
  }

  /*
   * Defensive fallback for data created by older or partially migrated admin
   * screens. listHomeBanners already returns banners in sort_order order.
   */
  return banners[0] ?? null;
}

function getHomeDiscoveryContext(
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


const HOME_PROMO_CARDS: PromoCard[] = [
  {
    key: 'everyday-needs',
    eyebrow: 'Navienty Now',
    title: 'كل احتياجاتك أقرب',
    description:
      'مطاعم، سوبرماركت، مكتبات والمزيد من خلال تجربة واحدة سهلة.',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryDark,
    foregroundColor:
      NAVIENTY_NOW_COLORS.white,
    secondaryColor: '#CFF5DE',
    decoration: 'logo',
  },
  {
    key: 'nearby-stores',
    eyebrow: 'أماكن قريبة منك',
    title: 'اختار المكان المناسب',
    description:
      'تصفّح الأماكن المتاحة فعليًا في منطقة التوصيل الحالية.',
    backgroundColor: '#EAF8F0',
    foregroundColor:
      NAVIENTY_NOW_COLORS.text,
    secondaryColor:
      NAVIENTY_NOW_COLORS.primaryDark,
    decoration: 'bags',
  },
  {
    key: 'clear-ordering',
    eyebrow: 'طلب واضح من البداية',
    title: 'اختار، راجع، واطلب',
    description:
      'راجع السلة وتفاصيل التوصيل قبل إرسال طلبك للتأكيد.',
    backgroundColor: '#151F1A',
    foregroundColor:
      NAVIENTY_NOW_COLORS.white,
    secondaryColor: '#A8E9C0',
    decoration: 'route',
  },
];

function resolveDefaultLocation(
  bootstrap: AppBootstrap,
): ResolvedLocation {
  const defaultAreaId =
    bootstrap.settings
      .default_service_area_id;

  for (const city of bootstrap.cities) {
    const area = city.areas.find(
      (currentArea) =>
        currentArea.id === defaultAreaId,
    );

    if (area) {
      return locationFromArea(city, area);
    }
  }

  const firstCity = bootstrap.cities[0];
  const firstArea = firstCity?.areas[0];

  if (firstCity && firstArea) {
    return locationFromArea(
      firstCity,
      firstArea,
    );
  }

  if (firstCity) {
    return {
      areaId: null,
      cityId: firstCity.id,
      cityName: firstCity.name_ar,
      areaName: firstCity.name_ar,
      fullName: firstCity.name_ar,
    };
  }

  return {
    areaId: null,
    cityId: null,
    cityName: '',
    areaName: 'منطقتك',
    fullName: 'منطقة التوصيل غير محددة',
  };
}

function locationFromArea(
  city: City,
  area: ServiceArea,
): ResolvedLocation {
  return {
    areaId: area.id,
    cityId: city.id,
    cityName: city.name_ar,
    areaName: area.name_ar,
    fullName:
      `${area.name_ar}، ${city.name_ar}`,
  };
}

function resolveLocationByAreaId(
  bootstrap: AppBootstrap,
  areaId: string | null,
): ResolvedLocation | null {
  if (!areaId) {
    return null;
  }

  for (const city of bootstrap.cities) {
    const area = city.areas.find(
      (currentArea) =>
        currentArea.id === areaId,
    );

    if (area) {
      return locationFromArea(city, area);
    }
  }

  return null;
}

function isLocationStillAvailable(
  bootstrap: AppBootstrap,
  location: ResolvedLocation,
): boolean {
  if (!location.areaId) {
    return false;
  }

  return bootstrap.cities.some((city) =>
    city.areas.some(
      (area) => area.id === location.areaId,
    ),
  );
}

function getUserDisplayName(
  authState: ReturnType<
    typeof useAuthSession
  >,
): string | null {
  if (authState.status !== 'signedIn') {
    return null;
  }

  const metadata =
    authState.session.user.user_metadata as Record<
      string,
      unknown
    >;

  const candidates = [
    metadata.full_name,
    metadata.name,
    metadata.display_name,
  ];

  for (const candidate of candidates) {
    if (
      typeof candidate === 'string' &&
      candidate.trim().length > 0
    ) {
      return candidate.trim();
    }
  }

  const email =
    authState.session.user.email;

  if (email) {
    const emailPrefix = email.split('@')[0];

    if (emailPrefix.trim()) {
      return emailPrefix.trim();
    }
  }

  return null;
}

function CategoryArtwork({
  category,
  size,
}: {
  category: HomeCategory;
  size: number;
}) {
  const [remoteImageFailed, setRemoteImageFailed] =
    useState(false);

  useEffect(() => {
    setRemoteImageFailed(false);
  }, [category.image_url]);

  const remoteImageUrl =
    category.image_url?.trim() ?? '';

  const canShowRemoteImage =
    remoteImageUrl.length > 0 &&
    !remoteImageFailed;

  const shouldShowRemoteImage =
    !category.localArtwork &&
    canShowRemoteImage;

  const imageSource =
    category.localArtwork ??
    (shouldShowRemoteImage
      ? { uri: remoteImageUrl }
      : category.configuredArtworkSlug
        ? getCategoryIcon(
            category.configuredArtworkSlug,
          )
        : null);

  return (
    <View
      style={[
        styles.categoryArtwork,
        {
          borderRadius: Math.round(
            size * 0.24,
          ),
          height: size,
          width: size,
        },
      ]}
    >
      {imageSource ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={
            `أيقونة قسم ${category.name_ar}`
          }
          resizeMode="contain"
          source={imageSource}
          style={styles.categoryImage}
          onError={() => {
            if (shouldShowRemoteImage) {
              setRemoteImageFailed(true);
            }
          }}
        />
      ) : (
        <Ionicons
          accessibilityLabel={
            `أيقونة قسم ${category.name_ar}`
          }
          color={
            NAVIENTY_NOW_COLORS.primaryDark
          }
          name={category.fallbackIcon}
          size={Math.round(size * 0.48)}
        />
      )}
    </View>
  );
}

// 24/7 Journey: the courier crosses the complete header in one direction,
// passing through night, morning, daytime, and sunset without ever reversing.
// The reset happens only while the bike is fully off-screen, so the loop feels
// like a continuous delivery route rather than a ping-pong animation.
function IosDeliveryBikeHero() {
  const { width: viewportWidth } = useWindowDimensions();
  const rideX = useRef(new Animated.Value(0)).current;
  const bounceY = useRef(new Animated.Value(0)).current;
  const bikeLean = useRef(new Animated.Value(0)).current;

  const leanRotation = bikeLean.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-0.55deg', '0deg', '0.55deg'],
  });

  useEffect(() => {
    rideX.setValue(0);
    bounceY.setValue(0);
    bikeLean.setValue(0);

    const travelDistance = Math.max(
      620,
      viewportWidth + 360,
    );

    const rideAnimation = Animated.loop(
      Animated.sequence([
        Animated.delay(420),

        Animated.parallel([
          Animated.timing(rideX, {
            toValue: -travelDistance,
            duration: 9000,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(bikeLean, {
              toValue: -0.38,
              duration: 720,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(bikeLean, {
              toValue: 0,
              duration: 1250,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.delay(4750),
            Animated.timing(bikeLean, {
              toValue: 0.22,
              duration: 650,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(bikeLean, {
              toValue: 0,
              duration: 900,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]),

        Animated.timing(rideX, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    const bounceAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceY, {
          toValue: -1.45,
          duration: 260,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bounceY, {
          toValue: 0.65,
          duration: 300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bounceY, {
          toValue: 0,
          duration: 250,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    rideAnimation.start();
    bounceAnimation.start();

    return () => {
      rideAnimation.stop();
      bounceAnimation.stop();
    };
  }, [
    bikeLean,
    bounceY,
    rideX,
    viewportWidth,
  ]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.deliveryBikeTrack,
        {
          transform: [{ translateX: rideX }],
        },
      ]}
    >
      <Animated.View
        style={{
          transform: [
            { translateY: bounceY },
            { rotate: leanRotation },
          ],
        }}
      >
        <View style={styles.deliveryBikeShadow} />
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={navientyDeliveryBike}
          style={styles.deliveryBikeImage}
        />
      </Animated.View>
    </Animated.View>
  );
}

const ANDROID_BIKE_WIDTH = 166;
const IOS_BIKE_RIGHT_OFFSET = 10;

function AndroidDeliveryBikeHero() {
  const { width: viewportWidth } =
    useWindowDimensions();

  /*
   * Match the iOS physical journey exactly.
   *
   * iOS uses:
   *   right: -176
   *   width: 166
   *
   * which means the bike's physical starting X is:
   *   viewportWidth + 10
   *
   * The same iOS travel distance then moves the bike fully beyond
   * the left edge before the invisible reset.
   */
  const startX =
    viewportWidth + IOS_BIKE_RIGHT_OFFSET;

  const travelDistance = Math.max(
    620,
    viewportWidth + 360,
  );

  const endX =
    startX - travelDistance;

  const rideX = useRef(
    new Animated.Value(startX),
  ).current;

  const bounceY = useRef(
    new Animated.Value(0),
  ).current;

  const bikeLean = useRef(
    new Animated.Value(0),
  ).current;

  const leanRotation = bikeLean.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [
      '-0.55deg',
      '0deg',
      '0.55deg',
    ],
  });

  useEffect(() => {
    rideX.setValue(startX);
    bounceY.setValue(0);
    bikeLean.setValue(0);

    const rideAnimation = Animated.loop(
      Animated.sequence([
        Animated.delay(420),

        Animated.parallel([
          Animated.timing(rideX, {
            toValue: endX,
            duration: 9000,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
            isInteraction: false,
          }),

          Animated.sequence([
            Animated.timing(bikeLean, {
              toValue: -0.38,
              duration: 720,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
              isInteraction: false,
            }),
            Animated.timing(bikeLean, {
              toValue: 0,
              duration: 1250,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
              isInteraction: false,
            }),
            Animated.delay(4750),
            Animated.timing(bikeLean, {
              toValue: 0.22,
              duration: 650,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
              isInteraction: false,
            }),
            Animated.timing(bikeLean, {
              toValue: 0,
              duration: 900,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
              isInteraction: false,
            }),
          ]),
        ]),

        /*
         * Reset only after the bike is completely outside the left edge.
         * Because the next position is also completely outside the right
         * edge, the reset itself is never visible.
         */
        Animated.timing(rideX, {
          toValue: startX,
          duration: 0,
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );

    const bounceAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceY, {
          toValue: -1.45,
          duration: 260,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(bounceY, {
          toValue: 0.65,
          duration: 300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(bounceY, {
          toValue: 0,
          duration: 250,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );

    rideAnimation.start();
    bounceAnimation.start();

    return () => {
      rideAnimation.stop();
      bounceAnimation.stop();
    };
  }, [
    bikeLean,
    bounceY,
    endX,
    rideX,
    startX,
  ]);

  return (
    <View
      collapsable={false}
      pointerEvents="none"
      style={styles.androidBikeLayer}
    >
      <Animated.View
        collapsable={false}
        renderToHardwareTextureAndroid
        style={[
          styles.androidBikeTrack,
          {
            transform: [
              { translateX: rideX },
            ],
          },
        ]}
      >
        <Animated.View
          style={{
            transform: [
              { translateY: bounceY },
              { rotate: leanRotation },
            ],
          }}
        >
          <View style={styles.deliveryBikeShadow} />

          <ExpoImage
            accessibilityLabel="Navienty delivery motorcycle"
            contentFit="contain"
            source={navientyDeliveryBike}
            style={styles.deliveryBikeImage}
            transition={0}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function DeliveryBikeHero() {
  return Platform.OS === 'android'
    ? <AndroidDeliveryBikeHero />
    : <IosDeliveryBikeHero />;
}

// One panoramic 24/7 world lives behind the same road at the same time.
// Left = night, then morning, then the bright brand-green daytime centre,
// and the far right finishes with a restrained warm sunset.
function HeaderTimeMoods() {
  return (
    <View
      pointerEvents="none"
      style={styles.headerTimeMoodLayer}
    >
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="stretch"
        source={navienty24hMoodBackground}
        style={styles.headerTimeMoodBackground}
      />

      <View style={styles.nightMoon}>
        <View style={styles.nightMoonCutout} />
      </View>
      <View
        style={[
          styles.nightStar,
          styles.nightStarOne,
        ]}
      />
      <View
        style={[
          styles.nightStar,
          styles.nightStarTwo,
        ]}
      />
      <View
        style={[
          styles.nightStar,
          styles.nightStarThree,
        ]}
      />

      <View style={styles.morningGlow} />
      <View style={styles.morningSun} />

      <View style={styles.dayGlow} />

      <View style={styles.sunsetGlow} />
      <View style={styles.sunsetSun} />

      <View style={styles.moodHorizonVeil} />
    </View>
  );
}

// A restrained abstract road keeps the delivery story clear without turning
// the hero into a literal street illustration. The lane markers move in one
// direction forever, so the courier feels like it is continuously travelling.
function HeaderRoad() {
  const roadOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    roadOffset.setValue(0);

    // The dash pattern repeats every 96 px. Ending each cycle on a multiple
    // of that spacing makes the reset visually seamless.
    const roadAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(roadOffset, {
          toValue: 96,
          duration: 1350,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(roadOffset, {
          toValue: 192,
          duration: 1120,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(roadOffset, {
          toValue: 288,
          duration: 1280,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    );

    roadAnimation.start();

    return () => {
      roadAnimation.stop();
    };
  }, [roadOffset]);

  return (
    <View
      pointerEvents="none"
      style={styles.headerRoadLayer}
    >
      <View style={styles.headerRoadSurface} />
      <View style={styles.headerRoadHighlight} />

      <Animated.View
        style={[
          styles.headerRoadDashTrack,
          {
            transform: [{ translateX: roadOffset }],
          },
        ]}
      >
        {Array.from({ length: 14 }).map((_, index) => (
          <View
            key={`road-dash-${index}`}
            style={styles.headerRoadDash}
          />
        ))}
      </Animated.View>
    </View>
  );
}

// Keep the hero's lower edge perfectly straight.
// The previous organic white cut is intentionally disabled so the green
// background/road finishes as one clean horizontal line across the header.
function HeaderWave() {
  return null;
}

function HomeHeader() {
  const topInset =
    Platform.OS === 'android'
      ? (NativeStatusBar.currentHeight ?? 0)
      : Platform.OS === 'ios'
        ? 18
        : 12;

  return (
    <View
      style={[
        styles.header,
        {
          minHeight: topInset + 158,
        },
      ]}
    >
      <HeaderTimeMoods />
      <HeaderRoad />
      <DeliveryBikeHero />
      <HeaderWave />
    </View>
  );
}

function CategoryStrip({
  categories,
  onPressCategory,
}: {
  categories: HomeCategory[];
  onPressCategory: (
    categorySlug: string,
  ) => void;
}) {
  const { width: viewportWidth } =
    useWindowDimensions();

  const categoryScrollRef =
    useRef<ScrollView | null>(null);
  const hasPositionedInitialScroll =
    useRef(false);

  const positionAtFirstCategories =
    useCallback(() => {
      if (
        hasPositionedInitialScroll.current
      ) {
        return;
      }

      hasPositionedInitialScroll.current =
        true;

      categoryScrollRef.current?.scrollToEnd({
        animated: false,
      });
    }, []);

  if (categories.length === 0) {
    return (
      <View style={styles.compactEmptyCard}>
        <Text style={styles.compactEmptyTitle}>
          لا توجد أقسام متاحة حاليًا
        </Text>
        <Text
          style={styles.compactEmptyDescription}
        >
          ستظهر الأقسام هنا فور تفعيلها.
        </Text>
      </View>
    );
  }

  /*
   * Show three complete categories and exactly half of the fourth category.
   * The partial fourth item makes the horizontal interaction immediately
   * obvious while giving every category more visual presence. The width is
   * calculated from the live viewport, including the three visible gaps, so
   * the 3.5-item composition remains consistent across phone sizes.
   */
  const stripWidth = Math.min(
    viewportWidth,
    NAVIENTY_NOW_LAYOUT.contentMaxWidth,
  );

  const visibleSlots = Math.min(
    3.5,
    Math.max(1, categories.length),
  );

  const categoryGap = 8;
  const visibleGapCount = Math.max(
    0,
    Math.ceil(visibleSlots) - 1,
  );
  const horizontalPadding =
    NAVIENTY_NOW_LAYOUT.pageGutter;

  const availableWidth = Math.max(
    1,
    stripWidth - horizontalPadding * 2,
  );

  const categoryItemWidth = Math.max(
    1,
    Math.floor(
      (availableWidth -
        categoryGap * visibleGapCount) /
        visibleSlots,
    ),
  );

  const categoryArtworkSize = Math.min(
    104,
    categoryItemWidth,
  );

  return (
    <ScrollView
      ref={categoryScrollRef}
      horizontal
      alwaysBounceHorizontal={false}
      bounces={false}
      contentContainerStyle={
        styles.categoryListContent
      }
      directionalLockEnabled
      overScrollMode="never"
      showsHorizontalScrollIndicator={false}
      style={styles.categoryList}
      onContentSizeChange={
        positionAtFirstCategories
      }
    >
      {categories.map((category) => (
        <Pressable
          key={category.id}
          accessibilityLabel={
            `فتح قسم ${category.name_ar}`
          }
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.categoryItem,
            {
              width: categoryItemWidth,
            },
            pressed &&
              styles.categoryItemPressed,
          ]}
          onPress={() => {
            onPressCategory(category.slug);
          }}
        >
          <CategoryArtwork
            category={category}
            size={categoryArtworkSize}
          />

          <Text
            numberOfLines={2}
            style={styles.categoryLabel}
          >
            {category.name_ar}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}


type HomeSearchCatalogCategoryRow = {
  id: string;
  parent_id: string | null;
  name_ar: string | null;
};

async function loadHomeSearchSuggestionNames(
  stores: readonly StoreSummary[],
  _serviceAreaId: string | null,
): Promise<string[]> {
  if (stores.length === 0) {
    return [];
  }

  /*
   * IMPORTANT:
   *
   * Do not build Home search suggestions from `catalog.sections`.
   * `getStoreCatalog()` can keep legacy RPC sections as a defensive
   * fallback, and those legacy sections may include catalog categories
   * whose `is_active` flag is false. That is why inactive subcategories
   * were still rotating inside the Home Search Bar.
   *
   * Search suggestions now come directly from now.catalog_categories
   * with `is_active = true`, so an inactive category can never leak into
   * the placeholder rotation.
   */
  const categoryRowsByStore =
    new Array<
      HomeSearchCatalogCategoryRow[] | null
    >(stores.length).fill(null);

  let nextStoreIndex = 0;

  async function worker() {
    while (true) {
      const storeIndex =
        nextStoreIndex;

      nextStoreIndex += 1;

      if (
        storeIndex >= stores.length
      ) {
        return;
      }

      const store =
        stores[storeIndex];

      if (!store) {
        continue;
      }

      try {
        const nowClient =
          (publicSupabase as any).schema(
            'now',
          );

        const { data, error } =
          await nowClient
            .from('catalog_categories')
            .select(
              'id,parent_id,name_ar,sort_order,created_at',
            )
            .eq(
              'store_id',
              store.id,
            )
            .eq(
              'is_active',
              true,
            )
            .order(
              'sort_order',
              { ascending: true },
            )
            .order(
              'created_at',
              { ascending: true },
            );

        if (error) {
          throw error;
        }

        categoryRowsByStore[storeIndex] =
          Array.isArray(data)
            ? (data as HomeSearchCatalogCategoryRow[])
            : [];
      } catch (error) {
        categoryRowsByStore[storeIndex] =
          [];

        if (__DEV__) {
          console.warn(
            'Unable to load active Home search suggestion categories.',
            store.id,
            error,
          );
        }
      }
    }
  }

  const workerCount = Math.min(
    HOME_SEARCH_CATALOG_CONCURRENCY,
    stores.length,
  );

  await Promise.all(
    Array.from(
      { length: workerCount },
      () => worker(),
    ),
  );

  const names: string[] = [];
  const seenNames = new Set<string>();

  for (const categoryRows of categoryRowsByStore) {
    if (
      !categoryRows ||
      categoryRows.length === 0
    ) {
      continue;
    }

    const categoryById = new Map(
      categoryRows.map(
        (category) => [
          category.id,
          category,
        ] as const,
      ),
    );

    /*
     * Because the query above already contains `is_active = true`, every
     * row here is active itself. We additionally require every ancestor
     * to exist in the same active result set. This prevents an active child
     * from appearing when its parent category has been switched off.
     */
    const effectivelyActiveMemo =
      new Map<string, boolean>();

    const isEffectivelyActive = (
      category: HomeSearchCatalogCategoryRow,
      visited = new Set<string>(),
    ): boolean => {
      const cached =
        effectivelyActiveMemo.get(
          category.id,
        );

      if (cached !== undefined) {
        return cached;
      }

      if (!category.parent_id) {
        effectivelyActiveMemo.set(
          category.id,
          true,
        );
        return true;
      }

      if (visited.has(category.id)) {
        effectivelyActiveMemo.set(
          category.id,
          false,
        );
        return false;
      }

      const parent = categoryById.get(
        category.parent_id,
      );

      if (!parent) {
        effectivelyActiveMemo.set(
          category.id,
          false,
        );
        return false;
      }

      const nextVisited =
        new Set(visited);
      nextVisited.add(category.id);

      const result =
        isEffectivelyActive(
          parent,
          nextVisited,
        );

      effectivelyActiveMemo.set(
        category.id,
        result,
      );

      return result;
    };

    const effectiveCategories =
      categoryRows.filter(
        (category) =>
          isEffectivelyActive(
            category,
          ),
      );

    /*
     * Prefer active nested Subcategories. For legacy/flat restaurant
     * catalogs that genuinely have no nested categories, keep active
     * root categories as a fallback so the Search Bar still has useful
     * examples.
     */
    const activeNestedCategories =
      effectiveCategories.filter(
        (category) =>
          category.parent_id !== null,
      );

    const sourceCategories =
      activeNestedCategories.length > 0
        ? activeNestedCategories
        : effectiveCategories;

    for (const category of sourceCategories) {
      const name =
        category.name_ar?.trim() ?? '';

      if (!name) {
        continue;
      }

      const normalizedName =
        name.toLocaleLowerCase('ar');

      if (
        seenNames.has(normalizedName)
      ) {
        continue;
      }

      seenNames.add(normalizedName);
      names.push(name);
    }
  }

  return names;
}

function HomeGlobalSearchEntry({
  suggestions,
  onPress,
}: {
  suggestions: readonly string[];
  onPress: () => void;
}) {
  const [activeSuggestionIndex, setActiveSuggestionIndex] =
    useState(0);

  useEffect(() => {
    setActiveSuggestionIndex(0);

    if (suggestions.length <= 1) {
      return;
    }

    const timer = setInterval(() => {
      setActiveSuggestionIndex(
        (currentIndex) =>
          (currentIndex + 1) %
          suggestions.length,
      );
    }, HOME_SEARCH_PLACEHOLDER_ROTATION_MS);

    return () => {
      clearInterval(timer);
    };
  }, [suggestions]);

  const activeSuggestion =
    suggestions[
      activeSuggestionIndex %
        Math.max(1, suggestions.length)
    ] ?? 'منتج';

  return (
    <Pressable
      accessibilityLabel={
        `فتح البحث. ابحث عن ${activeSuggestion}`
      }
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.homeSearchEntry,
        pressed &&
          styles.homeSearchEntryPressed,
      ]}
      onPress={onPress}
    >
      <View
        style={
          styles.homeSearchIconWrap
        }
      >
        <Ionicons
          color="#8C8C8C"
          name="search-outline"
          size={19}
        />
      </View>

      <Text
        numberOfLines={1}
        style={
          styles.homeSearchPlaceholder
        }
      >
        <Text
          style={styles.homeSearchFixedText}
        >
          ابحث عن{' '}
        </Text>
        <Text
          style={styles.homeSearchDynamicText}
        >
          {activeSuggestion}
        </Text>
      </Text>
    </Pressable>
  );
}

function RecentlyViewedCard({
  item,
  store,
  cardWidth,
  onPress,
}: {
  item: RecentlyViewedItem;
  store: StoreSummary | null;
  cardWidth: number;
  onPress: () => void;
}) {
  const initialLogoUrl =
    store?.logoUrl?.trim() ?? '';

  const initialCoverImageUrl =
    store?.coverImageUrl?.trim() ?? '';

  const [
    resolvedArtwork,
    setResolvedArtwork,
  ] = useState({
    logoUrl: initialLogoUrl,
    coverImageUrl:
      initialCoverImageUrl,
  });

  const [imageFailed, setImageFailed] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    setImageFailed(false);

    if (initialLogoUrl) {
      setResolvedArtwork({
        logoUrl: initialLogoUrl,
        coverImageUrl:
          initialCoverImageUrl,
      });

      return () => {
        cancelled = true;
      };
    }

    setResolvedArtwork({
      logoUrl: initialLogoUrl,
      coverImageUrl:
        initialCoverImageUrl,
    });

    async function resolveVisitedStoreLogo() {
      try {
        const {
          data,
          error,
        } =
          await publicSupabase.rpc(
            'get_store_catalog',
            {
              p_store_id:
                item.storeId,
            },
          );

        if (cancelled) {
          return;
        }

        if (error) {
          throw error;
        }

        const rawCatalog =
          data as
            | {
                store?: {
                  logo_url?:
                    string | null;
                  cover_image_url?:
                    string | null;
                } | null;
              }
            | null;

        setResolvedArtwork({
          logoUrl:
            rawCatalog?.store
              ?.logo_url
              ?.trim() ??
            initialLogoUrl,
          coverImageUrl:
            rawCatalog?.store
              ?.cover_image_url
              ?.trim() ??
            initialCoverImageUrl,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.warn(
          'Unable to resolve recently viewed store logo.',
          item.storeId,
          error,
        );
      }
    }

    void resolveVisitedStoreLogo();

    return () => {
      cancelled = true;
    };
  }, [
    initialCoverImageUrl,
    initialLogoUrl,
    item.storeId,
  ]);

  const logoUrl =
    resolvedArtwork.logoUrl;

  const fallbackStoreImageUrl =
    resolvedArtwork.coverImageUrl ||
    item.imageUrl?.trim() ||
    '';

  const imageUrl =
    logoUrl || fallbackStoreImageUrl;

  const canShowImage =
    imageUrl.length > 0 &&
    !imageFailed;

  return (
    <Pressable
      accessibilityLabel={
        `فتح متجر ${item.title}`
      }
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.recentlyViewedCard,
        {
          height: cardWidth,
          width: cardWidth,
        },
        pressed &&
          styles.recentlyViewedCardPressed,
      ]}
      onPress={onPress}
    >
      <View
        style={
          styles.recentlyViewedArtwork
        }
      >
        {canShowImage ? (
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel={
              `شعار ${item.title}`
            }
            resizeMode={
              logoUrl
                ? 'contain'
                : 'cover'
            }
            source={{
              uri: imageUrl,
            }}
            style={
              styles.recentlyViewedImage
            }
            onError={() => {
              setImageFailed(true);
            }}
          />
        ) : (
          <Text
            style={
              styles.recentlyViewedFallback
            }
          >
            {item.icon || '🏪'}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function RecentlyViewedRail({
  items,
  stores,
  cardWidth,
  onPressItem,
}: {
  items: readonly RecentlyViewedItem[];
  stores: readonly StoreSummary[];
  cardWidth: number;
  onPressItem: (
    item: RecentlyViewedItem,
  ) => void;
}) {
  /*
   * "شوفتها قبل كده" is now a store-history rail only.
   *
   * Product/category visits stay in the recommendation engine, but Home
   * deliberately shows one simple logo tile for each store the user opened.
   */
  const seenStoreIds =
    new Set<string>();

  const storeVisits =
    items.filter((item) => {
      if (item.kind !== 'store') {
        return false;
      }

      const storeId =
        item.storeId?.trim() ?? '';

      if (
        !storeId ||
        seenStoreIds.has(storeId)
      ) {
        return false;
      }

      seenStoreIds.add(storeId);
      return true;
    });

  if (storeVisits.length === 0) {
    return null;
  }

  return (
    <View
      style={
        styles.recentlyViewedSection
      }
    >
      <Text
        style={
          styles.recentlyViewedSectionTitle
        }
      >
        شوفتها قبل كده
      </Text>

      <ScrollView
        horizontal
        alwaysBounceHorizontal={false}
        bounces={false}
        contentContainerStyle={
          styles.recentlyViewedRailContent
        }
        decelerationRate="fast"
        directionalLockEnabled
        nestedScrollEnabled
        overScrollMode="never"
        showsHorizontalScrollIndicator={
          false
        }
        snapToAlignment="start"
        snapToInterval={
          cardWidth + 10
        }
        style={
          styles.recentlyViewedRail
        }
      >
        {storeVisits.map((item) => {
          const store =
            stores.find(
              (candidate) =>
                candidate.id ===
                item.storeId,
            ) ?? null;

          return (
            <RecentlyViewedCard
              key={
                item.storeId ||
                item.id
              }
              cardWidth={cardWidth}
              item={item}
              store={store}
              onPress={() => {
                onPressItem(item);
              }}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const FOR_YOU_PRODUCT_STORE_CATEGORIES =
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

function normalizeForYouCategorySlug(
  value: string | null | undefined,
): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');
}

function isEligibleForYouProduct(
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

function ForYouCard({
  recommendation,
  cardWidth,
  isAdding,
  onPress,
}: {
  recommendation:
    ForYouRecommendation;
  cardWidth: number;
  isAdding: boolean;
  onPress: () => void;
}) {
  const [imageFailed, setImageFailed] =
    useState(false);

  const result =
    recommendation.result;

  const imageUrl =
    result.kind === 'product'
      ? result.imageUrl?.trim() ?? ''
      : '';

  const canShowImage =
    imageUrl.length > 0 &&
    !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  if (result.kind !== 'product') {
    return null;
  }

  return (
    <Pressable
      accessibilityHint="يضيف المنتج للسلة ويفتح السلة"
      accessibilityLabel={
        `أضف ${result.title} للسلة`
      }
      accessibilityRole="button"
      disabled={isAdding}
      style={({ pressed }) => [
        styles.forYouCard,
        {
          height: cardWidth,
          width: cardWidth,
        },
        pressed &&
          !isAdding &&
          styles.forYouCardPressed,
        isAdding &&
          styles.forYouCardDisabled,
      ]}
      onPress={onPress}
    >
      <View
        style={
          styles.forYouArtwork
        }
      >
        {canShowImage ? (
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel={
              `صورة ${result.title}`
            }
            resizeMode="contain"
            source={{
              uri: imageUrl,
            }}
            style={
              styles.forYouImage
            }
            onError={() => {
              setImageFailed(true);
            }}
          />
        ) : (
          <Text
            style={
              styles.forYouFallback
            }
          >
            {result.icon || '📦'}
          </Text>
        )}
      </View>

      {isAdding ? (
        <View
          pointerEvents="none"
          style={
            styles.forYouLoadingOverlay
          }
        >
          <ActivityIndicator
            color={
              NAVIENTY_NOW_COLORS.primaryDark
            }
            size="small"
          />
        </View>
      ) : null}
    </Pressable>
  );
}

function ForYouRail({
  items,
  cardWidth,
  addingRecommendationId,
  onPressItem,
}: {
  items:
    readonly ForYouRecommendation[];
  cardWidth: number;
  addingRecommendationId:
    string | null;
  onPressItem: (
    item: ForYouRecommendation,
  ) => void;
}) {
  const seenProductKeys =
    new Set<string>();

  const productItems =
    items.filter((item) => {
      if (
        !isEligibleForYouProduct(
          item,
        )
      ) {
        return false;
      }

      const result =
        item.result;

      if (result.kind !== 'product') {
        return false;
      }

      const productKey =
        `${result.storeId}:${result.productId}`;

      if (
        seenProductKeys.has(
          productKey,
        )
      ) {
        return false;
      }

      seenProductKeys.add(
        productKey,
      );

      return true;
    });

  if (productItems.length === 0) {
    return null;
  }

  return (
    <View
      style={
        styles.forYouSection
      }
    >
      <Text
        style={
          styles.forYouSectionTitle
        }
      >
        اخترنالك
      </Text>

      <ScrollView
        horizontal
        alwaysBounceHorizontal={false}
        bounces={false}
        contentContainerStyle={
          styles.forYouRailContent
        }
        decelerationRate="fast"
        directionalLockEnabled
        nestedScrollEnabled
        overScrollMode="never"
        showsHorizontalScrollIndicator={
          false
        }
        snapToAlignment="start"
        snapToInterval={
          cardWidth + 10
        }
        style={
          styles.forYouRail
        }
      >
        {productItems.map(
          (item) => (
            <ForYouCard
              key={item.id}
              cardWidth={
                cardWidth
              }
              isAdding={
                addingRecommendationId ===
                item.id
              }
              recommendation={
                item
              }
              onPress={() => {
                onPressItem(item);
              }}
            />
          ),
        )}
      </ScrollView>
    </View>
  );
}

function HomeDiscoveryRail({
  items,
  onPressItem,
}: {
  items: readonly HomeDiscoveryItem[];
  onPressItem: (
    item: HomeDiscoveryItem,
  ) => void;
}) {
  const { width: viewportWidth } =
    useWindowDimensions();

  const scrollRef =
    useRef<ScrollView | null>(null);

  const railWidth = Math.min(
    viewportWidth,
    NAVIENTY_NOW_LAYOUT.contentMaxWidth,
  );

  const availableWidth = Math.max(
    1,
    railWidth -
      NAVIENTY_NOW_LAYOUT.pageGutter * 2,
  );

  /*
   * Match the compact visual language used by "اطلب تاني",
   * "شوفتها قبل كده" and "مختار ليك": four square tiles.
   */
  const cardWidth = Math.min(
    96,
    Math.max(
      80,
      Math.floor(
        (availableWidth - 30) / 4,
      ),
    ),
  );

  return (
    <View
      style={
        styles.discoverySection
      }
    >
      <Text
        style={
          styles.discoveryTitle
        }
      >
        ممكن تحتاج دلوقتي
      </Text>

      <ScrollView
        horizontal
        ref={scrollRef}
        alwaysBounceHorizontal={false}
        bounces={false}
        contentContainerStyle={
          styles.discoveryRailContent
        }
        directionalLockEnabled
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        style={
          styles.discoveryRail
        }
        onContentSizeChange={() => {
          requestAnimationFrame(
            () => {
              scrollRef.current?.scrollToEnd({
                animated: false,
              });
            },
          );
        }}
      >
        {items.map((item) => (
          <Pressable
            key={item.key}
            accessibilityLabel={
              `فتح ${item.label}`
            }
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.discoveryCard,
              {
                height: cardWidth,
                width: cardWidth,
              },
              pressed &&
                styles.discoveryCardPressed,
            ]}
            onPress={() => {
              onPressItem(item);
            }}
          >
            <Image
              accessibilityIgnoresInvertColors
              resizeMode="cover"
              source={item.image}
              style={
                styles.discoveryImage
              }
            />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function RecentOrderArtwork({
  order,
  store,
}: {
  order: Order;
  store: StoreSummary | null;
}) {
  const initialLogoUrl =
    store?.logoUrl?.trim() ?? '';

  const initialCoverImageUrl =
    store?.coverImageUrl?.trim() ?? '';

  const initialCategorySlug =
    store?.categorySlug?.trim() ?? '';

  const [
    resolvedArtwork,
    setResolvedArtwork,
  ] =
    useState<ActiveOrderStoreArtworkState>({
      logoUrl: initialLogoUrl,
      coverImageUrl:
        initialCoverImageUrl,
      categorySlug:
        initialCategorySlug,
    });

  const [
    isResolvingArtwork,
    setIsResolvingArtwork,
  ] =
    useState(
      !initialLogoUrl &&
        !initialCoverImageUrl,
    );

  const [imageFailed, setImageFailed] =
    useState(false);

  const orderItemImageUrl =
    order.items
      .map(
        (item) =>
          item.imageUrl?.trim() ?? '',
      )
      .find(
        (candidate) =>
          candidate.length > 0,
      ) ?? '';

  useEffect(() => {
    let cancelled = false;

    setImageFailed(false);

    if (
      initialLogoUrl ||
      initialCoverImageUrl
    ) {
      setResolvedArtwork({
        logoUrl: initialLogoUrl,
        coverImageUrl:
          initialCoverImageUrl,
        categorySlug:
          initialCategorySlug,
      });

      setIsResolvingArtwork(false);

      return () => {
        cancelled = true;
      };
    }

    setResolvedArtwork({
      logoUrl: initialLogoUrl,
      coverImageUrl:
        initialCoverImageUrl,
      categorySlug:
        initialCategorySlug,
    });

    setIsResolvingArtwork(true);

    async function resolveStoreArtwork() {
      try {
        const {
          data,
          error,
        } =
          await publicSupabase.rpc(
            'get_store_catalog',
            {
              p_store_id:
                order.storeId,
            },
          );

        if (cancelled) {
          return;
        }

        if (error) {
          throw error;
        }

        const rawCatalog =
          data as
            | RawActiveOrderStoreCatalog
            | null;

        const rawStore =
          rawCatalog?.store;

        setResolvedArtwork({
          logoUrl:
            rawStore?.logo_url?.trim() ??
            initialLogoUrl,
          coverImageUrl:
            rawStore
              ?.cover_image_url
              ?.trim() ??
            initialCoverImageUrl,
          categorySlug:
            rawStore
              ?.category_slug
              ?.trim() ??
            initialCategorySlug,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.warn(
          'Unable to resolve repeat-order store artwork.',
          order.storeId,
          error,
        );
      } finally {
        if (!cancelled) {
          setIsResolvingArtwork(false);
        }
      }
    }

    void resolveStoreArtwork();

    return () => {
      cancelled = true;
    };
  }, [
    initialCategorySlug,
    initialCoverImageUrl,
    initialLogoUrl,
    order.storeId,
  ]);

  const logoUrl =
    resolvedArtwork.logoUrl;

  const coverImageUrl =
    resolvedArtwork.coverImageUrl;

  const remoteStoreImageUrl =
    logoUrl ||
    coverImageUrl;

  const categoryArtwork =
    getActiveOrderCategoryArtwork(
      resolvedArtwork.categorySlug,
    );

  const remoteImageUrl =
    remoteStoreImageUrl ||
    orderItemImageUrl;

  const canShowRemoteImage =
    remoteImageUrl.length > 0 &&
    !imageFailed;

  const localImageSource =
    !canShowRemoteImage
      ? categoryArtwork
      : null;

  return (
    <View
      style={
        styles.recentOrderArtwork
      }
    >
      {canShowRemoteImage ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={
            `شعار ${order.storeName}`
          }
          resizeMode={
            logoUrl
              ? 'contain'
              : 'cover'
          }
          source={{
            uri: remoteImageUrl,
          }}
          style={
            styles.recentOrderArtworkImage
          }
          onError={() => {
            setImageFailed(true);
          }}
        />
      ) : localImageSource ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={
            `صورة ${order.storeName}`
          }
          resizeMode="contain"
          source={localImageSource}
          style={
            styles.recentOrderArtworkImage
          }
        />
      ) : isResolvingArtwork ? (
        <View
          style={
            styles.recentOrderArtworkLoading
          }
        />
      ) : (
        <Text
          style={
            styles.recentOrderArtworkFallback
          }
        >
          {order.storeIcon || '🏪'}
        </Text>
      )}
    </View>
  );
}

function getCatalogProductMap(
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

function RecentOrderCard({
  order,
  store,
  cardWidth,
  onPressStore,
}: {
  order: Order;
  store: StoreSummary | null;
  cardWidth: number;
  onPressStore: () => void;
}) {
  return (
    <Pressable
      accessibilityHint="يفتح صفحة المتجر"
      accessibilityLabel={
        `فتح متجر ${order.storeName}`
      }
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.recentOrderCard,
        {
          height: cardWidth,
          width: cardWidth,
        },
        pressed &&
          styles.recentOrderCardPressed,
      ]}
      onPress={onPressStore}
    >
      <RecentOrderArtwork
        order={order}
        store={store}
      />
    </Pressable>
  );
}

function RecentOrdersRail({
  orders,
  stores,
  cardWidth,
  onPressStore,
}: {
  orders: readonly Order[];
  stores: readonly StoreSummary[];
  cardWidth: number;
  onPressStore: (
    order: Order,
  ) => void;
}) {
  if (orders.length === 0) {
    return null;
  }

  /*
   * One tile per store. The newest delivered order is only used to
   * identify the store and resolve its logo; tapping never rebuilds a cart.
   */
  const seenStoreIds =
    new Set<string>();

  const repeatableOrders =
    orders.filter((order) => {
      const storeKey =
        order.storeId?.trim() ||
        order.storeName.trim();

      if (
        !storeKey ||
        seenStoreIds.has(storeKey)
      ) {
        return false;
      }

      seenStoreIds.add(storeKey);
      return true;
    });

  if (repeatableOrders.length === 0) {
    return null;
  }

  return (
    <View
      style={
        styles.recentOrdersSection
      }
    >
      <Text
        style={
          styles.recentOrdersTitle
        }
      >
        اطلب تاني
      </Text>

      <ScrollView
        horizontal
        alwaysBounceHorizontal={false}
        bounces={false}
        contentContainerStyle={
          styles.recentOrdersRailContent
        }
        decelerationRate="fast"
        directionalLockEnabled
        nestedScrollEnabled
        overScrollMode="never"
        showsHorizontalScrollIndicator={
          false
        }
        snapToAlignment="start"
        snapToInterval={
          cardWidth + 10
        }
        style={
          styles.recentOrdersRail
        }
      >
        {repeatableOrders.map(
          (order) => {
            const orderStore =
              stores.find(
                (store) =>
                  store.id ===
                  order.storeId,
              ) ?? null;

            return (
              <RecentOrderCard
                key={
                  order.storeId ||
                  order.id
                }
                cardWidth={
                  cardWidth
                }
                order={order}
                store={orderStore}
                onPressStore={() => {
                  onPressStore(order);
                }}
              />
            );
          },
        )}
      </ScrollView>
    </View>
  );
}

function HomeHeroCampaign({
  width,
  audience,
  preferredContexts,
  serviceAreaId,
  fallbackWhatsAppNumber,
}: {
  width: number;
  audience: Exclude<
    HomeBannerAudience,
    'all'
  >;
  preferredContexts: readonly PromoHomeContext[];
  serviceAreaId?: string | null;
  fallbackWhatsAppNumber?: string | null;
}) {
  const router = useRouter();

  const [banner, setBanner] =
    useState<HomeBanner | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const heroWidth = Math.max(
    1,
    width,
  );

  const heroHeight = Math.round(
    heroWidth *
      SUPERMARKET_PROMOTION_BANNER_HEIGHT_RATIO,
  );

  useEffect(() => {
    let isCancelled = false;

    async function loadHero() {
      try {
        setIsLoading(true);

        const banners =
          await listHomeBanners(
            audience,
            'main',
            serviceAreaId,
          );

        if (!isCancelled) {
          /*
           * Home intentionally renders one campaign only.
           *
           * Priority:
           * 1) month_end when applicable
           * 2) current Cairo time context
           * 3) all / legacy campaigns
           * 4) first active banner as a defensive fallback
           *
           * listHomeBanners already keeps each group ordered by sort_order.
           */
          setBanner(
            selectContextualHomeHero(
              banners,
              preferredContexts,
            ),
          );
        }
      } catch (error) {
        if (!isCancelled) {
          setBanner(null);

          console.warn(
            'Unable to load Home hero campaign.',
            error,
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadHero();

    return () => {
      isCancelled = true;
    };
  }, [
    audience,
    preferredContexts,
    serviceAreaId,
  ]);

  async function openHero() {
    if (
      !banner ||
      !canOpenHomeBannerSafely(banner)
    ) {
      return;
    }

    if (
      banner.presentationType ===
      'detail_screen'
    ) {
      router.push({
        pathname: '/promo/[id]',
        params: {
          id: banner.id,
        },
      });

      return;
    }

    try {
      const opened =
        await openHomeBannerActionCompat({
          banner,
          router,
          fallbackWhatsAppNumber,
        });

      if (!opened) {
        console.warn(
          'Home hero has no valid action.',
          banner.id,
        );
      }
    } catch (error) {
      console.warn(
        'Unable to open Home hero action.',
        error,
      );
    }
  }

  if (isLoading) {
    return (
      <View
        style={[
          styles.heroCampaignLoading,
          {
            height: heroHeight,
            width: heroWidth,
          },
        ]}
      />
    );
  }

  if (!banner) {
    return null;
  }

  const isInteractive =
    canOpenHomeBannerSafely(banner);

  return (
    <Pressable
      accessibilityLabel={
        banner.altTextAr ||
        banner.altTextEn ||
        'حملة Navienty Now'
      }
      accessibilityRole={
        isInteractive
          ? 'link'
          : 'image'
      }
      disabled={!isInteractive}
      style={({ pressed }) => [
        styles.heroCampaign,
        {
          height: heroHeight,
          width: heroWidth,
        },
        pressed &&
          isInteractive &&
          styles.heroCampaignPressed,
      ]}
      onPress={() => {
        void openHero();
      }}
    >
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="cover"
        source={{
          uri: banner.imageUrl,
        }}
        style={
          styles.heroCampaignImage
        }
        onError={(event) => {
          console.warn(
            'Unable to load Home hero image.',
            banner.imageUrl,
            event.nativeEvent.error,
          );
        }}
      />
    </Pressable>
  );
}

function HomeBannerCarousel({
  width,
  audience,
  placement,
  title,
  serviceAreaId,
  fallbackWhatsAppNumber,
}: {
  width: number;
  audience: Exclude<
    HomeBannerAudience,
    'all'
  >;
  placement: HomeBannerPlacement;
  title?: string;
  serviceAreaId?: string | null;
  fallbackWhatsAppNumber?: string | null;
}) {
  const router = useRouter();
  const scrollViewRef =
    useRef<ScrollView | null>(null);
  const activeIndexRef = useRef(0);
  const physicalIndexRef = useRef(0);
  const [banners, setBanners] =
    useState<HomeBanner[]>([]);
  const [activeIndex, setActiveIndex] =
    useState(0);
  const [isLoading, setIsLoading] =
    useState(true);
  const [isUserInteracting, setIsUserInteracting] =
    useState(false);

  const carouselWidth = Math.max(1, width);

  /*
   * The main Home banner uses the complete available content width.
   * Exclusive offers also use full-width cards so their presentation
   * matches the promotion banner in the supermarket screen.
   */
  const isMainPlacement = placement === 'main';
  const isExclusiveOffersPlacement =
    placement === 'exclusive_offers';
  const usesFullWidthCards =
    isMainPlacement ||
    isExclusiveOffersPlacement;

  const bannerPeekWidth =
    !usesFullWidthCards && banners.length > 1
      ? 28
      : 0;

  const bannerGap =
    !usesFullWidthCards && banners.length > 1
      ? 10
      : 0;

  const bannerCardWidth = Math.max(
    1,
    carouselWidth -
      bannerPeekWidth -
      bannerGap,
  );
  const bannerSnapInterval =
    bannerCardWidth + bannerGap;
  const bannerHeight = Math.round(
    bannerCardWidth *
      (isExclusiveOffersPlacement
        ? SUPERMARKET_PROMOTION_BANNER_HEIGHT_RATIO
        : (9 / 16) *
          HOME_BANNER_HEIGHT_SCALE),
  );

  const carouselItems = useMemo(() => {
    if (banners.length <= 1) {
      return banners;
    }

    // The extra second item at the end keeps the "next banner" preview
    // visible even while the infinite carousel is sitting on its cloned
    // first slide just before the invisible reset.
    return [
      banners[banners.length - 1]!,
      ...banners,
      banners[0]!,
      banners[1] ?? banners[0]!,
    ];
  }, [banners]);

  const setLogicalIndex = useCallback(
    (nextIndex: number) => {
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
    },
    [],
  );

  const scrollToPhysicalIndex = useCallback(
    (
      nextPhysicalIndex: number,
      animated: boolean,
    ) => {
      physicalIndexRef.current = nextPhysicalIndex;

      scrollViewRef.current?.scrollTo({
        animated,
        x:
          nextPhysicalIndex *
          bannerSnapInterval,
        y: 0,
      });
    },
    [bannerSnapInterval],
  );

  const syncActiveDotWithScroll = useCallback(
    (offsetX: number) => {
      if (banners.length <= 1) {
        if (activeIndexRef.current !== 0) {
          setLogicalIndex(0);
        }
        return;
      }

      const nearestPhysicalIndex = Math.round(
        offsetX / bannerSnapInterval,
      );

      let nextLogicalIndex: number;

      if (nearestPhysicalIndex <= 0) {
        nextLogicalIndex = banners.length - 1;
      } else {
        nextLogicalIndex =
          (nearestPhysicalIndex - 1) %
          banners.length;
      }

      if (
        nextLogicalIndex !==
        activeIndexRef.current
      ) {
        setLogicalIndex(nextLogicalIndex);
      }
    },
    [
      banners.length,
      bannerSnapInterval,
      setLogicalIndex,
    ],
  );

  useEffect(() => {
    let isCancelled = false;

    async function loadBanners() {
      try {
        setIsLoading(true);

        const loadedBanners =
          await listHomeBanners(
            audience,
            placement,
            serviceAreaId,
          );

        if (!isCancelled) {
          activeIndexRef.current = 0;
          physicalIndexRef.current =
            loadedBanners.length > 1 ? 1 : 0;
          setBanners(loadedBanners);
          setActiveIndex(0);
        }
      } catch (error) {
        if (!isCancelled) {
          activeIndexRef.current = 0;
          physicalIndexRef.current = 0;
          setBanners([]);
          setActiveIndex(0);

          console.warn(
            `Unable to load ${placement} home banners.`,
            error,
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadBanners();

    return () => {
      isCancelled = true;
    };
  }, [
    audience,
    placement,
    serviceAreaId,
  ]);

  useEffect(() => {
    if (banners.length === 0) {
      return;
    }

    const nextPhysicalIndex =
      banners.length > 1
        ? activeIndexRef.current + 1
        : 0;

    const positionTimer = setTimeout(() => {
      scrollToPhysicalIndex(
        nextPhysicalIndex,
        false,
      );
    }, 0);

    return () => {
      clearTimeout(positionTimer);
    };
  }, [
    banners.length,
    bannerSnapInterval,
    scrollToPhysicalIndex,
  ]);

  useEffect(() => {
    if (
      banners.length <= 1 ||
      isUserInteracting
    ) {
      return;
    }

    const autoPlayTimer = setTimeout(() => {
      const nextPhysicalIndex =
        physicalIndexRef.current + 1;

      // Do not move the dot before the banner starts moving.
      // onScroll keeps the indicator synchronized with the
      // banner that is actually visible on screen.
      scrollToPhysicalIndex(
        nextPhysicalIndex,
        true,
      );
    }, 5000);

    return () => {
      clearTimeout(autoPlayTimer);
    };
  }, [
    activeIndex,
    banners.length,
    isUserInteracting,
    scrollToPhysicalIndex,
  ]);

  function handleScroll(
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) {
    syncActiveDotWithScroll(
      event.nativeEvent.contentOffset.x,
    );
  }

  function handleScrollEnd(
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) {
    if (banners.length <= 1) {
      physicalIndexRef.current = 0;
      setLogicalIndex(0);
      setIsUserInteracting(false);
      return;
    }

    const rawPhysicalIndex = Math.round(
      event.nativeEvent.contentOffset.x /
        bannerSnapInterval,
    );

    if (rawPhysicalIndex <= 0) {
      const lastLogicalIndex =
        banners.length - 1;

      setLogicalIndex(lastLogicalIndex);
      scrollToPhysicalIndex(
        banners.length,
        false,
      );
    } else if (
      rawPhysicalIndex >=
      banners.length + 1
    ) {
      const wrappedLogicalIndex =
        (rawPhysicalIndex - 1) %
        banners.length;

      setLogicalIndex(wrappedLogicalIndex);
      scrollToPhysicalIndex(
        wrappedLogicalIndex + 1,
        false,
      );
    } else {
      physicalIndexRef.current =
        rawPhysicalIndex;
      setLogicalIndex(
        rawPhysicalIndex - 1,
      );
    }

    setIsUserInteracting(false);
  }

  async function openBanner(
    banner: HomeBanner,
  ) {
    if (!canOpenHomeBannerSafely(banner)) {
      return;
    }

    if (
      banner.presentationType ===
      'detail_screen'
    ) {
      router.push({
        pathname: '/promo/[id]',
        params: {
          id: banner.id,
        },
      });
      return;
    }

    try {
      const opened =
        await openHomeBannerActionCompat({
          banner,
          router,
          fallbackWhatsAppNumber,
        });

      if (!opened) {
        console.warn(
          'Home banner has no valid action.',
          banner.id,
        );
      }
    } catch (error) {
      console.warn(
        'Unable to open home banner action.',
        error,
      );
    }
  }

  const sectionStyle = title
    ? styles.exclusiveOffersSection
    : styles.homeBannerSection;

  if (isLoading) {
    return (
      <View
        style={[
          sectionStyle,
          {
            width: carouselWidth,
          },
        ]}
      >
        {title ? (
          <View
            style={
              isExclusiveOffersPlacement
                ? styles.exclusiveOffersHeader
                : undefined
            }
          >
            <SectionHeader title={title} />
          </View>
        ) : null}

        <View
          style={[
            styles.homeBannerLoadingCard,
            isExclusiveOffersPlacement &&
              styles.exclusiveOffersBannerFrame,
            {
              height: bannerHeight,
              width: bannerCardWidth,
            },
          ]}
        />
      </View>
    );
  }

  if (banners.length === 0) {
    return null;
  }

  return (
    <View
      style={[
        sectionStyle,
        {
          width: carouselWidth,
        },
      ]}
    >
      {title ? (
        <View
          style={
            isExclusiveOffersPlacement
              ? styles.exclusiveOffersHeader
              : undefined
          }
        >
          <SectionHeader title={title} />
        </View>
      ) : null}

      <ScrollView
        ref={scrollViewRef}
        horizontal
        accessibilityLabel={
          title ||
          'لوحة إعلانات Navienty Now'
        }
        alwaysBounceHorizontal={false}
        bounces={false}
        contentContainerStyle={{
          direction: 'ltr',
          flexDirection: 'row',
          height: bannerHeight,
        }}
        contentOffset={{
          x:
            banners.length > 1
              ? bannerSnapInterval
              : 0,
          y: 0,
        }}
        decelerationRate="fast"
        disableIntervalMomentum
        nestedScrollEnabled
        overScrollMode="never"
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={bannerSnapInterval}
        style={[
          styles.homeBannerScroll,
          {
            direction: 'ltr',
            height: bannerHeight,
            width: carouselWidth,
          },
        ]}
        onMomentumScrollEnd={handleScrollEnd}
        onScroll={handleScroll}
        onScrollBeginDrag={() => {
          setIsUserInteracting(true);
        }}
        onScrollEndDrag={() => {
          setIsUserInteracting(false);
        }}
      >
        {carouselItems.map(
          (banner, renderIndex) => (
            <Pressable
              key={`${banner.id}-${renderIndex}`}
              accessibilityLabel={
                banner.altTextAr ||
                banner.altTextEn ||
                title ||
                'إعلان Navienty Now'
              }
              accessibilityRole={
                canOpenHomeBannerSafely(banner)
                  ? 'link'
                  : 'image'
              }
              disabled={!canOpenHomeBannerSafely(banner)}
              style={({ pressed }) => [
                styles.homeBannerCard,
                isExclusiveOffersPlacement &&
                  styles.exclusiveOffersBannerFrame,
                {
                  height: bannerHeight,
                  marginRight: bannerGap,
                  width: bannerCardWidth,
                },
                pressed &&
                  canOpenHomeBannerSafely(banner) &&
                  styles.homeBannerPressed,
              ]}
              onPress={() => {
                void openBanner(banner);
              }}
            >
              <Image
                accessibilityIgnoresInvertColors
                resizeMode="cover"
                source={{
                  uri: banner.imageUrl,
                }}
                style={[
                  styles.homeBannerImage,
                  {
                    height: bannerHeight,
                    width: bannerCardWidth,
                  },
                ]}
                onError={(event) => {
                  console.warn(
                    'Unable to load home banner image.',
                    banner.imageUrl,
                    event.nativeEvent.error,
                  );
                }}
              />
            </Pressable>
          ),
        )}
      </ScrollView>

      {banners.length > 1 && (
        <View style={styles.homeBannerDots}>
          {banners.map((banner, index) => (
            <View
              key={banner.id}
              style={[
                styles.homeBannerDot,
                index === activeIndex &&
                  styles.homeBannerDotActive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function PromoDecoration({
  type,
}: {
  type: PromoCard['decoration'];
}) {
  if (type === 'logo') {
    return (
      <View style={styles.promoLogoFrame}>
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={navientyNowLogo}
          style={styles.promoLogoImage}
        />
      </View>
    );
  }

  if (type === 'bags') {
    return (
      <View style={styles.bagsArtwork}>
        <View
          style={[
            styles.bagShape,
            styles.bagShapeBack,
          ]}
        >
          <View style={styles.bagHandle} />
        </View>
        <View
          style={[
            styles.bagShape,
            styles.bagShapeFront,
          ]}
        >
          <View style={styles.bagHandle} />
          <Text style={styles.bagMark}>
            now
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.routeArtwork}>
      <View
        style={[
          styles.routePoint,
          styles.routePointTop,
        ]}
      />
      <View style={styles.routeLineOne} />
      <View style={styles.routeLineTwo} />
      <View
        style={[
          styles.routePoint,
          styles.routePointBottom,
        ]}
      />
      <View style={styles.routePackage}>
        <Text style={styles.routePackageText}>
          ✓
        </Text>
      </View>
    </View>
  );
}

function PromoCarousel({
  locationName,
}: {
  locationName: string;
}) {
  const [activeIndex, setActiveIndex] =
    useState(0);
  const [carouselWidth, setCarouselWidth] =
    useState(0);

  function handleLayout(
    event: LayoutChangeEvent,
  ) {
    const nextWidth =
      event.nativeEvent.layout.width;

    if (
      nextWidth > 0 &&
      nextWidth !== carouselWidth
    ) {
      setCarouselWidth(nextWidth);
    }
  }

  function handleScrollEnd(
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) {
    if (carouselWidth <= 0) {
      return;
    }

    const nextIndex = Math.round(
      event.nativeEvent.contentOffset.x /
        carouselWidth,
    );

    setActiveIndex(
      Math.max(
        0,
        Math.min(
          nextIndex,
          HOME_PROMO_CARDS.length - 1,
        ),
      ),
    );
  }

  return (
    <View
      style={styles.carouselSection}
      onLayout={handleLayout}
    >
      {carouselWidth > 0 && (
        <ScrollView
          horizontal
          accessibilityLabel="عروض ومزايا Navienty Now"
          decelerationRate="fast"
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={carouselWidth}
          onMomentumScrollEnd={handleScrollEnd}
        >
          {HOME_PROMO_CARDS.map(
            (card, index) => (
              <View
                key={card.key}
                accessible
                accessibilityLabel={
                  `${card.title}. ${card.description}`
                }
                style={[
                  styles.promoCard,
                  {
                    backgroundColor:
                      card.backgroundColor,
                    width: carouselWidth,
                  },
                ]}
              >
                <View
                  style={styles.promoCardCopy}
                >
                  <Text
                    style={[
                      styles.promoEyebrow,
                      {
                        color:
                          card.secondaryColor,
                      },
                    ]}
                  >
                    {index === 1
                      ? `${card.eyebrow} في ${locationName}`
                      : card.eyebrow}
                  </Text>

                  <Text
                    style={[
                      styles.promoTitle,
                      {
                        color:
                          card.foregroundColor,
                      },
                    ]}
                  >
                    {card.title}
                  </Text>

                  <Text
                    style={[
                      styles.promoDescription,
                      {
                        color:
                          card.foregroundColor,
                      },
                    ]}
                  >
                    {card.description}
                  </Text>
                </View>

                <PromoDecoration
                  type={card.decoration}
                />
              </View>
            ),
          )}
        </ScrollView>
      )}

      {HOME_PROMO_CARDS.length > 1 && (
        <View style={styles.carouselDots}>
          {HOME_PROMO_CARDS.map(
            (card, index) => (
              <View
                key={card.key}
                style={[
                  styles.carouselDot,
                  index === activeIndex &&
                    styles.carouselDotActive,
                ]}
              />
            ),
          )}
        </View>
      )}
    </View>
  );
}

type HomeOrderTrackingStep = {
  key:
    | 'confirmation'
    | 'preparing'
    | 'delivery'
    | 'delivered';
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const HOME_ORDER_TRACKING_STEPS:
  HomeOrderTrackingStep[] = [
  {
    key: 'confirmation',
    title: 'يتم تأكيد طلبك',
    icon: 'checkmark',
  },
  {
    key: 'preparing',
    title: 'يتم تحضير طلبك',
    icon: 'cart-outline',
  },
  {
    key: 'delivery',
    title: 'طلبك في الطريق',
    icon: 'bicycle-outline',
  },
  {
    key: 'delivered',
    title: 'تم توصيل طلبك',
    icon: 'location-outline',
  },
];


function getHomeOrderTrackingStage(
  status: OrderStatus,
): number {
  switch (status) {
    case 'awaiting-whatsapp-send':
    case 'waiting-confirmation':
      return 0;

    case 'confirmed':
    case 'preparing':
      return 1;

    case 'out-for-delivery':
      return 2;

    case 'delivered':
      return 3;

    case 'cancelled':
      return -1;

    default:
      return 0;
  }
}

type ActiveOrderStoreArtworkState = {
  logoUrl: string;
  coverImageUrl: string;
  categorySlug: string;
};

type RawActiveOrderStoreCatalog = {
  store?: {
    id?: string | null;
    category_slug?: string | null;
    logo_url?: string | null;
    cover_image_url?: string | null;
  } | null;
};

function normalizeActiveOrderCategorySlug(
  value: string | null | undefined,
) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');
}

function getActiveOrderCategoryArtwork(
  categorySlug: string,
): ImageSourcePropType | null {
  const normalizedSlug =
    normalizeActiveOrderCategorySlug(
      categorySlug,
    );

  if (
    normalizedSlug ===
      'laundry' ||
    normalizedSlug ===
      'laundry-ironing' ||
    normalizedSlug ===
      'wash-and-iron' ||
    normalizedSlug ===
      'washing-ironing'
  ) {
    return laundryCategoryIcon;
  }

  if (
    normalizedSlug ===
      'personal-care' ||
    normalizedSlug ===
      'personalcare' ||
    normalizedSlug ===
      'beauty' ||
    normalizedSlug ===
      'beauty-care' ||
    normalizedSlug ===
      'health-beauty'
  ) {
    return personalCareCategoryIcon;
  }

  if (
    normalizedSlug ===
      'request-anything' ||
    normalizedSlug ===
      'anything' ||
    normalizedSlug ===
      'other' ||
    normalizedSlug ===
      'special-request'
  ) {
    return requestAnythingCategoryIcon;
  }

  /*
   * Restaurants / supermarket / bookstore already use
   * the configured category artwork helper elsewhere in Home.
   *
   * Reuse the same source as a visual fallback when a particular
   * store has no uploaded logo/cover.
   */
  if (
    normalizedSlug ===
      'restaurants' ||
    normalizedSlug ===
      'restaurant' ||
    normalizedSlug ===
      'food' ||
    normalizedSlug ===
      'supermarket' ||
    normalizedSlug ===
      'supermarkets' ||
    normalizedSlug ===
      'market' ||
    normalizedSlug ===
      'grocery' ||
    normalizedSlug ===
      'bookstore' ||
    normalizedSlug ===
      'bookstores' ||
    normalizedSlug ===
      'book-store' ||
    normalizedSlug ===
      'library' ||
    normalizedSlug ===
      'books' ||
    normalizedSlug ===
      'stationery'
  ) {
    return getCategoryIcon(
      normalizedSlug,
    );
  }

  return null;
}

function ActiveOrderStoreArtwork({
  order,
  store,
}: {
  order: Order;
  store: StoreSummary | null;
}) {
  const initialLogoUrl =
    store?.logoUrl?.trim() ?? '';

  const initialCoverImageUrl =
    store?.coverImageUrl?.trim() ?? '';

  const initialCategorySlug =
    store?.categorySlug?.trim() ?? '';

  const [
    resolvedArtwork,
    setResolvedArtwork,
  ] =
    useState<ActiveOrderStoreArtworkState>({
      logoUrl:
        initialLogoUrl,

      coverImageUrl:
        initialCoverImageUrl,

      categorySlug:
        initialCategorySlug,
    });

  const [
    imageFailed,
    setImageFailed,
  ] =
    useState(false);

  const [
    isResolvingArtwork,
    setIsResolvingArtwork,
  ] =
    useState(
      !initialLogoUrl &&
      !initialCoverImageUrl &&
      !initialCategorySlug,
    );

  const orderItemImageUrl =
    order.items
      .map(
        (item) =>
          item.imageUrl
            ?.trim() ??
          '',
      )
      .find(
        (imageUrl) =>
          imageUrl.length >
          0,
      ) ?? '';

  useEffect(() => {
    let cancelled = false;

    setImageFailed(
      false,
    );

    /*
     * If Home already knows the store, use that data instantly.
     *
     * We still resolve the RPC when the store has no real image,
     * because Home's `listStores()` service intentionally filters
     * some categories from the public v1 catalog.
     */
    if (
      initialLogoUrl ||
      initialCoverImageUrl
    ) {
      setResolvedArtwork({
        logoUrl:
          initialLogoUrl,

        coverImageUrl:
          initialCoverImageUrl,

        categorySlug:
          initialCategorySlug,
      });

      setIsResolvingArtwork(
        false,
      );

      return () => {
        cancelled = true;
      };
    }

    setResolvedArtwork({
      logoUrl:
        initialLogoUrl,

      coverImageUrl:
        initialCoverImageUrl,

      categorySlug:
        initialCategorySlug,
    });

    setIsResolvingArtwork(
      true,
    );

    async function resolveStoreArtworkDirectly() {
      try {
        /*
         * IMPORTANT:
         *
         * Do NOT call getStoreCatalog() here.
         *
         * catalog-service applies the public-v1 category gate after
         * receiving the RPC response. That means active orders from
         * service/internal categories can incorrectly fail even though
         * the store itself exists.
         *
         * Calling the existing Supabase RPC directly gives us the
         * store snapshot without changing the public catalog scope.
         */
        const {
          data,
          error,
        } =
          await publicSupabase.rpc(
            'get_store_catalog',
            {
              p_store_id:
                order.storeId,
            },
          );

        if (cancelled) {
          return;
        }

        if (error) {
          throw error;
        }

        const rawCatalog =
          data as
            | RawActiveOrderStoreCatalog
            | null;

        const rawStore =
          rawCatalog?.store;

        setResolvedArtwork({
          logoUrl:
            rawStore
              ?.logo_url
              ?.trim() ??
            initialLogoUrl,

          coverImageUrl:
            rawStore
              ?.cover_image_url
              ?.trim() ??
            initialCoverImageUrl,

          categorySlug:
            rawStore
              ?.category_slug
              ?.trim() ??
            initialCategorySlug,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.warn(
          'Unable to resolve active-order store artwork directly.',
          order.storeId,
          error,
        );
      } finally {
        if (!cancelled) {
          setIsResolvingArtwork(
            false,
          );
        }
      }
    }

    void resolveStoreArtworkDirectly();

    return () => {
      cancelled = true;
    };
  }, [
    initialCategorySlug,
    initialCoverImageUrl,
    initialLogoUrl,
    order.storeId,
  ]);

  const logoUrl =
    resolvedArtwork.logoUrl;

  const coverImageUrl =
    resolvedArtwork.coverImageUrl;

  const remoteStoreImageUrl =
    logoUrl ||
    coverImageUrl;

  const categoryArtwork =
    getActiveOrderCategoryArtwork(
      resolvedArtwork.categorySlug,
    );

  /*
   * Priority:
   *
   * 1. Real uploaded store logo.
   * 2. Real uploaded store cover.
   * 3. Product/order snapshot image.
   * 4. Category artwork already bundled in the app.
   * 5. Emoji only as a true final fallback.
   */
  const remoteImageUrl =
    remoteStoreImageUrl ||
    orderItemImageUrl;

  const canShowRemoteImage =
    remoteImageUrl.length >
      0 &&
    !imageFailed;

  const localImageSource =
    !canShowRemoteImage
      ? categoryArtwork
      : null;

  return (
    <View
      style={
        styles.activeOrderStoreArtwork
      }
    >
      {canShowRemoteImage ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={
            `صورة ${order.storeName}`
          }
          resizeMode={
            logoUrl
              ? 'contain'
              : 'cover'
          }
          source={{
            uri:
              remoteImageUrl,
          }}
          style={
            styles.activeOrderStoreImage
          }
          onError={() => {
            setImageFailed(
              true,
            );
          }}
        />
      ) : localImageSource ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={
            `صورة ${order.storeName}`
          }
          resizeMode="contain"
          source={
            localImageSource
          }
          style={
            styles.activeOrderStoreImage
          }
        />
      ) : isResolvingArtwork ? (
        <View
          style={
            styles.activeOrderStoreImageLoading
          }
        />
      ) : (
        <Text
          style={
            styles.activeOrderStoreFallback
          }
        >
          {order.storeIcon ||
            '🏪'}
        </Text>
      )}
    </View>
  );
}

function ActiveOrderTrackingCard({
  order,
  store,
  cardWidth,
  onPress,
}: {
  order: Order;
  store: StoreSummary | null;
  cardWidth: number;
  onPress: () => void;
}) {
  const currentStage = Math.max(
    0,
    getHomeOrderTrackingStage(
      order.status,
    ),
  );

  const currentStep =
    HOME_ORDER_TRACKING_STEPS[
      currentStage
    ] ?? HOME_ORDER_TRACKING_STEPS[0];

  const cardEntrance = useRef(
    new Animated.Value(0),
  ).current;

  const activePulse = useRef(
    new Animated.Value(0),
  ).current;

  const routePulse = useRef(
    new Animated.Value(0),
  ).current;

  useEffect(() => {
    cardEntrance.setValue(0);

    const entranceAnimation =
      Animated.timing(
        cardEntrance,
        {
          toValue: 1,
          duration: 420,
          easing:
            Easing.out(
              Easing.cubic,
            ),
          useNativeDriver: true,
          isInteraction: false,
        },
      );

    entranceAnimation.start();

    return () => {
      entranceAnimation.stop();
    };
  }, [cardEntrance]);

  useEffect(() => {
    activePulse.setValue(0);
    routePulse.setValue(0);

    const activePulseAnimation =
      Animated.loop(
        Animated.sequence([
          Animated.timing(
            activePulse,
            {
              toValue: 1,
              duration: 760,
              easing:
                Easing.inOut(
                  Easing.sin,
                ),
              useNativeDriver: true,
              isInteraction: false,
            },
          ),
          Animated.timing(
            activePulse,
            {
              toValue: 0,
              duration: 760,
              easing:
                Easing.inOut(
                  Easing.sin,
                ),
              useNativeDriver: true,
              isInteraction: false,
            },
          ),
        ]),
      );

    const routePulseAnimation =
      Animated.loop(
        Animated.sequence([
          Animated.timing(
            routePulse,
            {
              toValue: 1,
              duration: 920,
              easing:
                Easing.inOut(
                  Easing.quad,
                ),
              useNativeDriver: true,
              isInteraction: false,
            },
          ),
          Animated.timing(
            routePulse,
            {
              toValue: 0,
              duration: 920,
              easing:
                Easing.inOut(
                  Easing.quad,
                ),
              useNativeDriver: true,
              isInteraction: false,
            },
          ),
        ]),
      );

    activePulseAnimation.start();
    routePulseAnimation.start();

    return () => {
      activePulseAnimation.stop();
      routePulseAnimation.stop();
    };
  }, [
    activePulse,
    currentStage,
    routePulse,
  ]);

  const cardTranslateY =
    cardEntrance.interpolate({
      inputRange: [0, 1],
      outputRange: [12, 0],
    });

  const activeScale =
    activePulse.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.105],
    });

  const activeHaloOpacity =
    activePulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.08, 0.24],
    });

  const routePulseOpacity =
    routePulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.48, 1],
    });

  return (
    <Animated.View
      style={[
        styles.activeOrderCardShell,
        {
          opacity: cardEntrance,
          transform: [
            {
              translateY:
                cardTranslateY,
            },
          ],
          width: cardWidth,
        },
      ]}
    >
      <Pressable
        accessibilityLabel={`${currentStep.title}. متابعة الطلب الحالي من ${order.storeName}`}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.activeOrderCard,
          pressed &&
            styles.activeOrderCardPressed,
        ]}
        onPress={onPress}
      >
        <View
          style={styles.activeOrderTopRow}
        >
          <ActiveOrderStoreArtwork
            order={order}
            store={store}
          />

          <View
            style={styles.activeOrderStoreNameWrap}
          >
            <Text
              numberOfLines={2}
              style={styles.activeOrderStoreName}
            >
              {order.storeName}
            </Text>
          </View>
        </View>

        <View
          style={styles.activeOrderFlow}
        >
          <View
            style={styles.activeOrderFlowRow}
          >
            {HOME_ORDER_TRACKING_STEPS.map(
              (step, index) => {
                const completed =
                  currentStage > index;

                const active =
                  currentStage === index;

                const reached =
                  currentStage >= index;

                const isConfirmation =
                  step.key ===
                  'confirmation';

                const iconSize =
                  step.key === 'preparing'
                    ? 29
                    : step.key ===
                        'delivery'
                      ? 27
                      : step.key ===
                          'delivered'
                        ? 29
                        : 19;

                const iconColor =
                  isConfirmation
                    ? reached
                      ? NAVIENTY_NOW_COLORS.white
                      : '#C9CDCB'
                    : reached
                      ? NAVIENTY_NOW_COLORS.primary
                      : '#D3D6D4';

                return (
                  <Fragment
                    key={step.key}
                  >
                    <View
                      style={
                        styles.activeOrderFlowStep
                      }
                    >
                      <Animated.View
                        style={[
                          styles.activeOrderStepIconWrap,
                          isConfirmation &&
                            styles.activeOrderConfirmationIcon,
                          isConfirmation &&
                            reached &&
                            styles.activeOrderConfirmationIconReached,
                          active && {
                            transform: [
                              {
                                scale:
                                  activeScale,
                              },
                            ],
                          },
                        ]}
                      >
                        {active ? (
                          <Animated.View
                            pointerEvents="none"
                            style={[
                              styles.activeOrderActiveHalo,
                              {
                                opacity:
                                  activeHaloOpacity,
                              },
                            ]}
                          />
                        ) : null}

                        <Ionicons
                          color={
                            iconColor
                          }
                          name={step.icon}
                          size={iconSize}
                        />
                      </Animated.View>
                    </View>

                    {index <
                    HOME_ORDER_TRACKING_STEPS.length -
                      1 ? (
                      <View
                        style={
                          styles.activeOrderConnector
                        }
                      >
                        {completed ? (
                          <View
                            style={
                              styles.activeOrderConnectorFill
                            }
                          />
                        ) : active ? (
                          <Animated.View
                            style={[
                              styles.activeOrderConnectorCurrentFill,
                              {
                                opacity:
                                  routePulseOpacity,
                              },
                            ]}
                          />
                        ) : null}
                      </View>
                    ) : null}
                  </Fragment>
                );
              },
            )}
          </View>

          <Text
            style={
              styles.activeOrderCurrentStatus
            }
          >
            {currentStep.title}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function SignedInWelcomeBanner({
  userName,
  ordersCount,
  onPressOrders,
}: {
  userName: string | null;
  ordersCount: number;
  onPressOrders: () => void;
}) {
  const title = userName
    ? `أهلاً ${userName}`
    : 'أهلاً بك في Navienty Now';

  return (
    <Pressable
      accessibilityLabel={
        ordersCount > 0
          ? `لديك ${ordersCount} طلبات محفوظة. فتح طلباتي.`
          : 'ابدأ طلبك الأول من الأماكن القريبة.'
      }
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.welcomeBanner,
        pressed && styles.cardPressed,
      ]}
      onPress={onPressOrders}
    >
      <View style={styles.welcomeBannerIcon}>
        <View style={styles.welcomeBag}>
          <View
            style={styles.welcomeBagHandle}
          />
          <Text
            style={styles.welcomeBagText}
          >
            n
          </Text>
        </View>
      </View>

      <View style={styles.welcomeBannerCopy}>
        <Text style={styles.welcomeBannerTitle}>
          {title}
        </Text>

        <Text
          style={styles.welcomeBannerDescription}
        >
          {ordersCount > 0
            ? `طلباتك المحفوظة: ${ordersCount}. تابعها من صفحة طلباتي.`
            : 'اختار قسمًا أو مكانًا قريبًا وابدأ طلبك بسهولة.'}
        </Text>
      </View>

      <View style={styles.welcomeBannerArrow}>
        <Text
          style={styles.welcomeBannerArrowText}
        >
          ‹
        </Text>
      </View>
    </Pressable>
  );
}

function SectionHeader({
  title,
  actionLabel,
  onPressAction,
}: {
  title: string;
  actionLabel?: string;
  onPressAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      {actionLabel && onPressAction ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [
            styles.sectionAction,
            pressed &&
              styles.sectionActionPressed,
          ]}
          onPress={onPressAction}
        >
          <Text
            style={styles.sectionActionText}
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : (
        <View />
      )}

      <Text style={styles.sectionTitle}>
        {title}
      </Text>
    </View>
  );
}

function HomeLoadingSkeleton() {
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={
          styles.loadingPageContent
        }
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.loadingHeader}>
          <HeaderWave />
        </View>

        <View style={styles.contentShell}>
          <View style={styles.loadingCategories}>
            {[0, 1, 2, 3].map((index) => (
              <View
                key={index}
                style={styles.loadingCategoryItem}
              >
                <View
                  style={
                    styles.loadingCategoryTile
                  }
                />
                <View
                  style={
                    styles.loadingCategoryLabel
                  }
                />
              </View>
            ))}
          </View>

          <View style={styles.loadingMainCard} />

          <View
            style={styles.loadingSectionTitle}
          />

          <View
            style={styles.loadingExclusiveBanner}
          />
        </View>
      </ScrollView>

      <AppBottomNavigation
        activeTab="home"
        isSignedIn={false}
      />
    </View>
  );
}

function HomeFatalError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={
          styles.errorPageContent
        }
        showsVerticalScrollIndicator={false}
      >
        <HomeHeader />

        <View style={styles.errorContentShell}>
          <View style={styles.fatalErrorIcon}>
            <Text
              style={styles.fatalErrorIconText}
            >
              !
            </Text>
          </View>

          <Text style={styles.fatalErrorTitle}>
            تعذر تحميل Navienty Now
          </Text>

          <Text
            style={styles.fatalErrorDescription}
          >
            {message}
          </Text>

          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.fatalRetryButton,
              pressed &&
                styles.primaryButtonPressed,
            ]}
            onPress={onRetry}
          >
            <Text
              style={styles.fatalRetryButtonText}
            >
              إعادة المحاولة
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <AppBottomNavigation
        activeTab="home"
        isSignedIn={false}
      />
    </View>
  );
}


function CampusUpdateWelcomeModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const {
    height: viewportHeight,
    width: viewportWidth,
  } = useWindowDimensions();

  const cardWidth = Math.min(
    356,
    Math.max(286, viewportWidth - 32),
  );

  const heroHeight = Math.min(
    282,
    Math.max(
      218,
      Math.round(cardWidth * 0.73),
    ),
  );

  const modalVerticalPadding =
    viewportHeight < 720 ? 16 : 28;

  const [
    isHeroImageReady,
    setIsHeroImageReady,
  ] = useState(false);

  const cardEntrance = useRef(
    new Animated.Value(0),
  ).current;

  const backdropOpacity = useRef(
    new Animated.Value(0),
  ).current;

  /*
   * Keep the full welcome card hidden until the local hero image has
   * finished decoding. This prevents the headline/button from flashing
   * before the campaign visual is ready.
   */
  useEffect(() => {
    if (!visible) {
      setIsHeroImageReady(false);
      cardEntrance.setValue(0);
      backdropOpacity.setValue(0);
      return;
    }

    const backdropAnimation =
      Animated.timing(
        backdropOpacity,
        {
          toValue: 1,
          duration: 180,
          easing: Easing.out(
            Easing.quad,
          ),
          useNativeDriver: true,
        },
      );

    backdropAnimation.start();

    return () => {
      backdropAnimation.stop();
    };
  }, [
    backdropOpacity,
    cardEntrance,
    visible,
  ]);

  useEffect(() => {
    if (
      !visible ||
      !isHeroImageReady
    ) {
      return;
    }

    cardEntrance.setValue(0);

    const cardAnimation =
      Animated.spring(
        cardEntrance,
        {
          toValue: 1,
          damping: 18,
          stiffness: 190,
          mass: 0.78,
          useNativeDriver: true,
        },
      );

    cardAnimation.start();

    return () => {
      cardAnimation.stop();
    };
  }, [
    cardEntrance,
    isHeroImageReady,
    visible,
  ]);

  const cardTranslateY =
    cardEntrance.interpolate({
      inputRange: [0, 1],
      outputRange: [34, 0],
    });

  const cardScale =
    cardEntrance.interpolate({
      inputRange: [0, 1],
      outputRange: [0.96, 1],
    });

  return (
    <Modal
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      visible={visible}
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.campusUpdateModalRoot,
          {
            paddingVertical:
              modalVerticalPadding,
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.campusUpdateBackdrop,
            {
              opacity:
                backdropOpacity,
            },
          ]}
        />

        <Animated.View
          style={[
            styles.campusUpdateCard,
            {
              opacity:
                isHeroImageReady
                  ? cardEntrance
                  : 0,
              width: cardWidth,
              transform: [
                {
                  translateY:
                    cardTranslateY,
                },
                {
                  scale: cardScale,
                },
              ],
            },
          ]}
        >
          <View
            style={
              styles.campusUpdateCardSurface
            }
          >
            <View
              style={[
                styles.campusUpdateHeroWrap,
                {
                  height: heroHeight,
                },
              ]}
            >
              <Image
                accessibilityIgnoresInvertColors
                accessibilityLabel="شارع في الهضبة ولافتة أسيوط بسهم لأعلى"
                fadeDuration={0}
                resizeMode="cover"
                source={navientyHadabaAsyutUpHero}
                style={
                  styles.campusUpdateHeroImage
                }
                onError={() => {
                  /*
                   * Keep the modal usable even if the local asset fails
                   * to decode unexpectedly.
                   */
                  setIsHeroImageReady(true);
                }}
                onLoad={() => {
                  setIsHeroImageReady(true);
                }}
              />

              <View
                pointerEvents="none"
                style={
                  styles.campusUpdateHeroShade
                }
              />
            </View>

            <Pressable
              accessibilityLabel="إغلاق رسالة الترحيب"
              accessibilityRole="button"
              hitSlop={12}
              style={({ pressed }) => [
                styles.campusUpdateCloseButton,
                pressed &&
                  styles.campusUpdateCloseButtonPressed,
              ]}
              onPress={onClose}
            >
              <Ionicons
                color="#075B2A"
                name="close"
                size={25}
              />
            </Pressable>

            <View
              style={
                styles.campusUpdateContent
              }
            >
              <View
                style={
                  styles.campusUpdateCopy
                }
              >
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                  numberOfLines={1}
                  style={
                    styles.campusUpdateHeadline
                  }
                >
                  تحت طلع فوق
                </Text>

                <Text
                  style={
                    styles.campusUpdateDescription
                  }
                >
                  من النهاردة تحت مش مشوار
                </Text>
              </View>

              <Pressable
                accessibilityLabel="خلّيه يطلعلك"
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.campusUpdatePrimaryButton,
                  pressed &&
                    styles.campusUpdatePrimaryButtonPressed,
                ]}
                onPress={onClose}
              >
                <Text
                  style={
                    styles.campusUpdatePrimaryButtonText
                  }
                >
                  خلّيه يطلعلك
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { width: windowWidth } =
    useWindowDimensions();
  const authState = useAuthSession();

  const [
    discoveryHour,
    setDiscoveryHour,
  ] = useState(
    () => getCairoHour(),
  );

  const [
    recentlyViewedItems,
    setRecentlyViewedItems,
  ] = useState<RecentlyViewedItem[]>(
    [],
  );

  const [
    forYouRecommendations,
    setForYouRecommendations,
  ] = useState<
    ForYouRecommendation[]
  >([]);

  const [
    addingForYouRecommendationId,
    setAddingForYouRecommendationId,
  ] = useState<string | null>(null);

  const [
    isCampusUpdateModalVisible,
    setIsCampusUpdateModalVisible,
  ] = useState(
    () =>
      !hasShownCampusUpdateModalThisSession,
  );

  useEffect(() => {
    if (
      isCampusUpdateModalVisible
    ) {
      hasShownCampusUpdateModalThisSession =
        true;
    }
  }, [
    isCampusUpdateModalVisible,
  ]);

  const savedServiceAreaId =
    useCustomerStore(
      (state) =>
        state.locationServiceAreaId,
    );

  const isMountedRef = useRef(true);

  const [bootstrap, setBootstrap] =
    useState<AppBootstrap | null>(null);
  const [isBootstrapLoading, setIsBootstrapLoading] =
    useState(true);
  const [bootstrapError, setBootstrapError] =
    useState<string | null>(null);

  const [selectedLocation, setSelectedLocation] =
    useState<ResolvedLocation | null>(null);
  const [stores, setStores] =
    useState<StoreSummary[]>([]);

  const [
    homeSearchSuggestions,
    setHomeSearchSuggestions,
  ] = useState<string[]>([]);

  const orders = useOrdersStore(
    (state) => state.orders,
  );

  const pendingOrder = useOrdersStore(
    (state) => state.pendingOrder,
  );

  const ordersHasHydrated =
    useOrdersStore(
      (state) => state.hasHydrated,
    );

  const currentUserId =
    authState.status === 'anonymous' ||
    authState.status === 'signedIn'
      ? authState.session.user.id
      : null;

  const activeOrders = useMemo(() => {
    /*
     * Keep every active order visible on Home.
     *
     * A pending order may also exist in the persisted orders array
     * after a server refresh, so a Map prevents the same order from
     * being rendered twice.
     */
    const uniqueOrders =
      new Map<string, Order>();

    orders.forEach((order) => {
      uniqueOrders.set(
        order.id,
        order,
      );
    });

    if (pendingOrder) {
      uniqueOrders.set(
        pendingOrder.id,
        pendingOrder,
      );
    }

    return Array.from(
      uniqueOrders.values(),
    )
      .filter(
        (order) =>
          order.status !== 'delivered' &&
          order.status !== 'cancelled',
      )
      .sort(
        (firstOrder, secondOrder) =>
          new Date(
            secondOrder.createdAt,
          ).getTime() -
          new Date(
            firstOrder.createdAt,
          ).getTime(),
      );
  }, [orders, pendingOrder]);

  const recentDeliveredOrders =
    useMemo(
      () =>
        orders
          .filter(
            (order) =>
              order.status ===
              'delivered',
          )
          .sort(
            (
              firstOrder,
              secondOrder,
            ) => {
              const firstTimestamp =
                new Date(
                  firstOrder
                    .deliveredAt ??
                    firstOrder.updatedAt ??
                    firstOrder.createdAt,
                ).getTime();

              const secondTimestamp =
                new Date(
                  secondOrder
                    .deliveredAt ??
                    secondOrder.updatedAt ??
                    secondOrder.createdAt,
                ).getTime();

              return (
                secondTimestamp -
                firstTimestamp
              );
            },
          )
          .slice(0, 4),
      [orders],
    );

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadBootstrap = useCallback(
    async () => {
      try {
        setIsBootstrapLoading(true);
        setBootstrapError(null);

        const loadedBootstrap =
          await getAppBootstrap();

        if (!isMountedRef.current) {
          return;
        }

        setBootstrap(loadedBootstrap);
        setSelectedLocation(
          (currentLocation) => {
            const savedLocation =
              resolveLocationByAreaId(
                loadedBootstrap,
                savedServiceAreaId,
              );

            if (savedLocation) {
              return savedLocation;
            }

            if (
              currentLocation &&
              isLocationStillAvailable(
                loadedBootstrap,
                currentLocation,
              )
            ) {
              return currentLocation;
            }

            return resolveDefaultLocation(
              loadedBootstrap,
            );
          },
        );
      } catch (error) {
        if (!isMountedRef.current) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : 'تعذر تحميل بيانات التطبيق.';

        setBootstrap(null);
        setBootstrapError(message);
      } finally {
        if (isMountedRef.current) {
          setIsBootstrapLoading(false);
        }
      }
    },
    [savedServiceAreaId],
  );

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  const loadStores = useCallback(
    async () => {
      if (!selectedLocation) {
        return;
      }

      try {
        const loadedStores = await listStores({
          serviceAreaId:
            selectedLocation.areaId ??
            undefined,
        });

        if (!isMountedRef.current) {
          return;
        }

        setStores(loadedStores);
      } catch (error) {
        if (!isMountedRef.current) {
          return;
        }

        setStores([]);
        console.warn(
          'Unable to load Home stores.',
          error,
        );
      }
    },
    [selectedLocation],
  );

  useEffect(() => {
    void loadStores();
  }, [loadStores]);

  useEffect(() => {
    let cancelled = false;

    if (stores.length === 0) {
      setHomeSearchSuggestions([]);
      return;
    }

    async function loadSearchSuggestions() {
      const suggestions =
        await loadHomeSearchSuggestionNames(
          stores,
          selectedLocation?.areaId ??
            null,
        );

      if (
        cancelled ||
        !isMountedRef.current
      ) {
        return;
      }

      setHomeSearchSuggestions(
        suggestions,
      );
    }

    void loadSearchSuggestions();

    return () => {
      cancelled = true;
    };
  }, [
    selectedLocation?.areaId,
    stores,
  ]);

  const refreshActiveOrders =
    useCallback(async () => {
      const currentState =
        useOrdersStore.getState();

      const uniqueOrders =
        new Map<string, Order>();

      currentState.orders.forEach(
        (order) => {
          uniqueOrders.set(
            order.id,
            order,
          );
        },
      );

      if (
        currentState.pendingOrder
      ) {
        uniqueOrders.set(
          currentState.pendingOrder.id,
          currentState.pendingOrder,
        );
      }

      const ordersToRefresh =
        Array.from(
          uniqueOrders.values(),
        ).filter(
          (order) =>
            order.status !==
              'delivered' &&
            order.status !==
              'cancelled',
        );

      if (
        ordersToRefresh.length === 0
      ) {
        return;
      }

      /*
       * Refresh every active order independently.
       *
       * Promise.allSettled is intentional: a temporary failure while
       * refreshing one order must not prevent the remaining active
       * orders from receiving their latest Supabase status.
       */
      const results =
        await Promise.allSettled(
          ordersToRefresh.map(
            (order) =>
              getOrderByToken(
                order.accessToken,
              ),
          ),
        );

      results.forEach(
        (
          result,
          index,
        ) => {
          if (
            result.status ===
            'rejected'
          ) {
            console.warn(
              'Unable to refresh active home order.',
              ordersToRefresh[
                index
              ]?.id,
              result.reason,
            );

            return;
          }

          const latestOrder =
            result.value;

          const orderStore =
            useOrdersStore.getState();

          if (
            orderStore
              .pendingOrder
              ?.id ===
            latestOrder.id
          ) {
            if (
              latestOrder.status ===
              'awaiting-whatsapp-send'
            ) {
              orderStore.setPendingOrder(
                latestOrder,
              );
            } else {
              orderStore.confirmPendingOrder(
                latestOrder,
              );
            }

            return;
          }

          orderStore.upsertOrder(
            latestOrder,
          );
        },
      );
    }, []);

  /*
   * Refresh the discovery context when Home becomes active and while it
   * remains visible. The state only changes when the Cairo hour changes,
   * so the one-minute check does not cause unnecessary Home re-renders.
   */
  useFocusEffect(
    useCallback(() => {
      let active = true;

      const syncRecentlyViewed =
        async () => {
          const items =
            await getRecentlyViewedItems(
              6,
            );

          if (active) {
            setRecentlyViewedItems(
              items,
            );
          }
        };

      void syncRecentlyViewed();

      const unsubscribe =
        subscribeRecentlyViewed(
          (items) => {
            if (active) {
              setRecentlyViewedItems(
                items.slice(0, 6),
              );
            }
          },
        );

      return () => {
        active = false;
        unsubscribe();
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      const syncDiscoveryHour = () => {
        const nextHour =
          getCairoHour();

        setDiscoveryHour(
          (currentHour) =>
            currentHour === nextHour
              ? currentHour
              : nextHour,
        );
      };

      syncDiscoveryHour();

      const timer =
        setInterval(
          syncDiscoveryHour,
          60 * 1000,
        );

      return () => {
        clearInterval(timer);
      };
    }, []),
  );

  /*
   * Keep the Home order cache server-authoritative.
   *
   * Previously Home only refreshed orders that were already present in the
   * local Zustand cache. That meant a customer could have delivered orders in
   * Supabase while Home still had an empty cache, so "اطلبها تاني" stayed
   * hidden until another screen loaded the full order history.
   *
   * On every Home focus:
   * - bind the local order cache to the current Supabase identity
   * - fetch the complete order history from now.get_my_orders()
   * - replace the local cache with the server result
   *
   * If the network request fails, the existing local cache remains untouched.
   */
  useFocusEffect(
    useCallback(() => {
      if (
        !ordersHasHydrated ||
        !currentUserId
      ) {
        return;
      }

      let active = true;

      const syncOrdersFromServer =
        async () => {
          const orderStore =
            useOrdersStore.getState();

          orderStore.prepareForUser(
            currentUserId,
          );

          try {
            const serverOrders =
              await getMyOrders();

            if (!active) {
              return;
            }

            useOrdersStore
              .getState()
              .replaceOrdersFromServer(
                currentUserId,
                serverOrders,
              );
          } catch (error) {
            if (__DEV__) {
              console.warn(
                'Unable to sync Home orders from Supabase.',
                error,
              );
            }
          }
        };

      void syncOrdersFromServer();

      return () => {
        active = false;
      };
    }, [
      currentUserId,
      ordersHasHydrated,
    ]),
  );

  /*
   * Keep every compact Home order flow synchronized with Supabase.
   * There is deliberately no manual refresh button: all active orders
   * are refreshed immediately and then every 8 seconds.
   */
  useFocusEffect(
    useCallback(() => {
      if (
        activeOrders.length === 0
      ) {
        return;
      }

      void refreshActiveOrders();

      const timer =
        setInterval(() => {
          void refreshActiveOrders();
        }, HOME_ORDER_POLL_INTERVAL_MS);

      return () => {
        clearInterval(timer);
      };
    }, [
      activeOrders.length,
      refreshActiveOrders,
    ]),
  );

  /**
   * isSignedIn means a permanent linked account only.
   * Anonymous sessions can still use the shopping flow.
   */
  const isSignedIn =
    authState.status === 'signedIn';

  const categories = useMemo(
    () =>
      buildHomeCategories(
        (bootstrap?.store_categories ?? []) as BootstrapCategory[],
      ),
    [bootstrap],
  );

  const discoveryContext =
    useMemo(
      () =>
        getHomeDiscoveryContext(
          discoveryHour,
        ),
      [discoveryHour],
    );

  const contentWidth = Math.min(
    windowWidth,
    NAVIENTY_NOW_LAYOUT.contentMaxWidth,
  );

  const bannerContentWidth = Math.max(
    1,
    contentWidth -
      NAVIENTY_NOW_LAYOUT.pageGutter * 2,
  );

  /*
   * Active order tracking mirrors the full-width reference card.
   * Multiple active orders still live in the horizontal rail and can
   * be swiped between, but each card now fills the usable Home width.
   */
  const activeOrderCardWidth =
    Math.min(
      420,
      Math.max(
        1,
        bannerContentWidth,
      ),
    );

  /*
   * "اطلب مجددًا" mirrors the compact reference treatment:
   * four square place tiles fit across common phone widths.
   */
  const recentOrderCardWidth =
    Math.min(
      96,
      Math.max(
        80,
        Math.floor(
          (bannerContentWidth - 30) /
            4,
        ),
      ),
    );

  /*
   * Keep "شوفتها قبل كده" as simple as "اطلب تاني":
   * four square tiles fit across common phone widths.
   */
  const recentlyViewedCardWidth =
    Math.min(
      96,
      Math.max(
        80,
        Math.floor(
          (bannerContentWidth - 30) /
            4,
        ),
      ),
    );

  /*
   * "مختار ليك" uses the same four-square rhythm as the other compact rails.
   */
  const forYouCardWidth =
    Math.min(
      96,
      Math.max(
        80,
        Math.floor(
          (bannerContentWidth - 30) /
            4,
        ),
      ),
    );

  const effectiveLocation =
    selectedLocation ??
    (bootstrap
      ? resolveDefaultLocation(bootstrap)
      : null);

  /*
   * Keep the focus callback dependent on the primitive service-area ID
   * instead of the whole effectiveLocation object. This lets React Compiler
   * preserve the manual useCallback memoization without re-running the focus
   * effect just because a new equivalent location object was created.
   */
  const effectiveServiceAreaId =
    effectiveLocation?.areaId ??
    savedServiceAreaId ??
    null;

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadForYou =
        async () => {
          try {
            const recommendations =
              await getForYouRecommendations({
                serviceAreaId:
                  effectiveServiceAreaId,
                orders,
              });

            if (active) {
              setForYouRecommendations(
                recommendations
                  .filter(
                    isEligibleForYouProduct,
                  )
                  .slice(0, 12),
              );
            }
          } catch (error) {
            if (active) {
              setForYouRecommendations(
                [],
              );
            }

            console.warn(
              'Unable to load Home For You recommendations.',
              error,
            );
          }
        };

      void loadForYou();

      return () => {
        active = false;
      };
    }, [
      effectiveServiceAreaId,
      orders,
    ]),
  );

  function openCategory(
    categorySlug: string,
  ) {
    const normalizedSlug = categorySlug
      .trim()
      .toLowerCase()
      .replace(/_/g, '-');

    if (normalizedSlug === 'supermarket') {
      router.push('/category/supermarket');
      return;
    }

    if (
      normalizedSlug === 'bookstore' ||
      normalizedSlug === 'bookstores' ||
      normalizedSlug === 'book-store' ||
      normalizedSlug === 'library' ||
      normalizedSlug === 'books' ||
      normalizedSlug === 'stationery'
    ) {
      router.push('/category/bookstore');
      return;
    }

    if (
      normalizedSlug === 'personal-care' ||
      normalizedSlug === 'personalcare' ||
      normalizedSlug === 'beauty' ||
      normalizedSlug === 'beauty-care' ||
      normalizedSlug === 'health-beauty' ||
      normalizedSlug === 'care'
    ) {
      router.push(
        '/category/personal-care',
      );
      return;
    }

    if (
      normalizedSlug === 'laundry' ||
      normalizedSlug === 'laundry-ironing' ||
      normalizedSlug === 'wash-and-iron' ||
      normalizedSlug === 'washing-ironing'
    ) {
      router.push(
        '/category/laundry',
      );
      return;
    }

    if (
      normalizedSlug === 'request-anything' ||
      normalizedSlug === 'anything' ||
      normalizedSlug === 'other' ||
      normalizedSlug === 'special-request'
    ) {
      router.push(
        '/category/request-anything',
      );
      return;
    }

    router.push({
      pathname: '/category/[id]',
      params: {
        id: categorySlug,
      },
    });
  }

  function openDiscoveryItem(
    item: HomeDiscoveryItem,
  ) {
    const destination =
      item.destination;

    switch (destination.type) {
      case 'restaurant-cuisine': {
        router.push({
          pathname:
            '/category/restaurants',
          params: {
            cuisine:
              destination.cuisineKey,
          },
        });

        return;
      }

      case 'supermarket-category': {
        router.push({
          pathname:
            '/supermarket-category/[slug]',
          params: {
            slug:
              destination.slug,
            categoryKey:
              destination.slug,
            label:
              item.label,
          },
        });

        return;
      }

      case 'bookstore-category': {
        router.push({
          pathname:
            '/bookstore-category/[slug]',
          params: {
            slug:
              destination.slug,
            categoryKey:
              destination.slug,
            label:
              item.label,
          },
        });

        return;
      }

      case 'personal-care-category': {
        router.push({
          pathname:
            '/personal-care-category/[slug]',
          params: {
            slug:
              destination.slug,
            categoryKey:
              destination.slug,
            label:
              item.label,
          },
        });

        return;
      }
    }
  }

  function showClosedStoreAlert(
    storeName?: string | null,
    note?: string | null,
    source: 'store' | 'product' = 'store',
  ) {
    const normalizedStoreName =
      storeName?.trim() ?? '';

    const fallbackMessage =
      source === 'product'
        ? normalizedStoreName
          ? `المنتج موجود في ${normalizedStoreName}، لكن المتجر مغلق حاليًا ومش متاح للطلب.`
          : 'المنتج موجود، لكن المتجر مغلق حاليًا ومش متاح للطلب.'
        : normalizedStoreName
          ? `${normalizedStoreName} مغلق حاليًا ومش متاح للطلب.`
          : 'المتجر مغلق حاليًا ومش متاح للطلب.';

    Alert.alert(
      'المتجر مغلق حاليًا',
      note?.trim() || fallbackMessage,
    );
  }

  function openStore(storeId: string) {
    router.push({
      pathname: '/store/[id]',
      params: {
        id: storeId,
      },
    });
  }

  function openRecentOrderStore(
    order: Order,
  ) {
    const orderStore =
      stores.find(
        (store) =>
          store.id === order.storeId,
      ) ?? null;

    if (orderStore?.isManuallyClosed) {
      showClosedStoreAlert(
        orderStore.name || order.storeName,
        orderStore.manualClosedNote,
      );
      return;
    }

    openStore(order.storeId);
  }


  function openActiveOrder(
    orderId: string,
  ) {
    router.push({
      pathname: '/order-success',
      params: {
        id: orderId,
      },
    });
  }

  async function addForYouProductToCart(
    recommendation:
      ForYouRecommendation,
  ) {
    if (
      addingForYouRecommendationId !==
      null
    ) {
      return;
    }

    const result =
      recommendation.result;

    if (
      result.kind !== 'product' ||
      !isEligibleForYouProduct(
        recommendation,
      )
    ) {
      return;
    }

    const recommendationStore =
      stores.find(
        (store) =>
          store.id === result.storeId,
      ) ?? null;

    if (recommendationStore?.isManuallyClosed) {
      showClosedStoreAlert(
        recommendationStore.name,
        recommendationStore.manualClosedNote,
        'product',
      );
      return;
    }

    const currentServiceAreaId =
      effectiveLocation?.areaId ??
      undefined;

    try {
      setAddingForYouRecommendationId(
        recommendation.id,
      );

      void trackBehaviorEvent({
        eventName:
          'for_you_clicked',
        serviceAreaId:
          effectiveLocation?.areaId ??
          savedServiceAreaId ??
          null,
        properties: {
          action:
            'quick_add_to_cart',
          recommendation_id:
            recommendation.id,
          result_id:
            result.id,
          result_type:
            result.kind,
          reason:
            recommendation.reason,
          score:
            recommendation.score,
          store_id:
            result.storeId,
          product_id:
            result.productId,
          section_id:
            result.sectionId,
        },
      });

      /*
       * Always resolve the live catalog before adding.
       * Recommendation prices/images can be cached, while Cart must use
       * the currently available product, price, restrictions and delivery rules.
       */
      const catalog =
        await getStoreCatalog(
          result.storeId,
          currentServiceAreaId,
        );

      if (
        !FOR_YOU_PRODUCT_STORE_CATEGORIES.has(
          normalizeForYouCategorySlug(
            catalog.store.categorySlug,
          ),
        )
      ) {
        return;
      }

      if (
        catalog.store.isManuallyClosed
      ) {
        showClosedStoreAlert(
          catalog.store.name,
          catalog.store.manualClosedNote,
          'product',
        );
        return;
      }

      const product =
        getCatalogProductMap(
          catalog,
        ).get(
          result.productId,
        );

      if (!product) {
        Alert.alert(
          'المنتج مش متاح دلوقتي',
          'المنتج اتغير أو اتشال من المتجر. هنحدّث اختياراتك تلقائيًا المرة الجاية.',
        );
        return;
      }

      const variants =
        product.variants ?? [];

      /*
       * Home quick-add is intentionally one tap.
       * A product with multiple choices needs a real selection, so do not
       * silently choose a size/type on the customer's behalf.
       */
      if (variants.length > 1) {
        Alert.alert(
          'اختار النوع من المتجر',
          'المنتج ده له أكتر من اختيار. افتح المتجر وحدد النوع المناسب قبل إضافته للسلة.',
          [
            {
              text: 'إلغاء',
              style: 'cancel',
            },
            {
              text: 'فتح المتجر',
              onPress: () => {
                openStore(
                  result.storeId,
                );
              },
            },
          ],
        );
        return;
      }

      const onlyVariant =
        variants[0] ?? null;

      const currentPrice =
        Number(
          onlyVariant?.price ??
          product.price ??
          0,
        );

      const storeInformation = {
        id: catalog.store.id,
        name: catalog.store.name,
        icon:
          catalog.store.icon || '🏪',
        categorySlug:
          catalog.store.categorySlug,
        deliveryFee:
          Number(
            catalog.delivery.deliveryFee ??
              0,
          ),
        minimumOrder:
          Number(
            catalog.delivery.minimumOrder ??
              0,
          ),
      };

      const cartProduct = {
        id: product.id,
        name: product.name,
        description:
          product.description || '',
        price: currentPrice,
        icon:
          product.icon || '📦',
        variantId:
          onlyVariant?.id ?? null,
        variantName:
          onlyVariant?.name ?? null,
        requiresPrescription:
          'requiresPrescription' in
            product &&
          product
            .requiresPrescription ===
            true,
        isAgeRestricted:
          product.isAgeRestricted ===
          true,
      };

      /*
       * This is a Home recommendation action, not an old search click.
       */
      await clearSearchAttribution();

      const addResult =
        useCartStore
          .getState()
          .addItem(
            storeInformation,
            cartProduct,
          );

      if (addResult !== 'added') {
        Alert.alert(
          'تعذر إضافة المنتج',
          'مقدرناش نضيف المنتج للسلة الحالية. جرّب فتح المتجر وإضافته من هناك.',
          [
            {
              text: 'إلغاء',
              style: 'cancel',
            },
            {
              text: 'فتح المتجر',
              onPress: () => {
                openStore(
                  result.storeId,
                );
              },
            },
          ],
        );
        return;
      }

      useCartStore
        .getState()
        .setActiveCart(
          catalog.store.id,
        );

      router.push({
        pathname: '/cart',
        params: {
          storeId:
            catalog.store.id,
        },
      });
    } catch (error) {
      console.warn(
        'Unable to quick-add For You product.',
        recommendation.id,
        error,
      );

      Alert.alert(
        'تعذر إضافة المنتج',
        'مقدرناش نراجع المنتج ونضيفه للسلة دلوقتي. جرّب مرة تانية.',
      );
    } finally {
      if (isMountedRef.current) {
        setAddingForYouRecommendationId(
          null,
        );
      }
    }
  }

  function openRecentlyViewedItem(
    item: RecentlyViewedItem,
  ) {
    if (item.kind !== 'store') {
      return;
    }

    void trackBehaviorEvent({
      eventName:
        'recently_viewed_clicked',
      serviceAreaId:
        effectiveLocation?.areaId ??
        savedServiceAreaId ??
        null,
      properties: {
        item_id:
          item.id,
        item_type:
          item.kind,
        store_id:
          item.storeId,
        store_category_slug:
          item.storeCategorySlug,
      },
    });

    openStore(item.storeId);
  }

  function openSearch() {
    router.push('/search');
  }

  if (isBootstrapLoading) {
    return <HomeLoadingSkeleton />;
  }

  if (
    !bootstrap ||
    !effectiveLocation ||
    bootstrapError
  ) {
    return (
      <HomeFatalError
        message={
          bootstrapError ??
          'لم تصل بيانات التطبيق من Supabase.'
        }
        onRetry={() => {
          void loadBootstrap();
        }}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={
          styles.pageContent
        }
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
      >
        <HomeHeader />

        <View
          style={[
            styles.contentShell,
            {
              maxWidth: contentWidth,
            },
          ]}
        >
          <HomeGlobalSearchEntry
            suggestions={
              homeSearchSuggestions
            }
            onPress={openSearch}
          />

          <CategoryStrip
            categories={categories}
            onPressCategory={openCategory}
          />

          {activeOrders.length > 0 ? (
            <ScrollView
              horizontal
              alwaysBounceHorizontal={false}
              bounces={false}
              contentContainerStyle={
                styles.activeOrdersRailContent
              }
              decelerationRate="fast"
              directionalLockEnabled
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              snapToAlignment="start"
              snapToInterval={
                activeOrderCardWidth + 12
              }
              style={
                styles.activeOrdersRail
              }
            >
              {activeOrders.map(
                (order) => {
                  const orderStore =
                    stores.find(
                      (store) =>
                        store.id ===
                        order.storeId,
                    ) ?? null;

                  return (
                    <ActiveOrderTrackingCard
                      key={order.id}
                      cardWidth={
                        activeOrderCardWidth
                      }
                      order={order}
                      store={orderStore}
                      onPress={() => {
                        openActiveOrder(
                          order.id,
                        );
                      }}
                    />
                  );
                },
              )}
            </ScrollView>
          ) : null}

          {recentDeliveredOrders.length >
          0 ? (
            <RecentOrdersRail
              cardWidth={
                recentOrderCardWidth
              }
              orders={
                recentDeliveredOrders
              }
              stores={stores}
              onPressStore={
                (order) => {
                  openRecentOrderStore(
                    order,
                  );
                }
              }
            />
          ) : null}

          <RecentlyViewedRail
            cardWidth={
              recentlyViewedCardWidth
            }
            items={
              recentlyViewedItems
            }
            stores={stores}
            onPressItem={
              openRecentlyViewedItem
            }
          />

          <ForYouRail
            addingRecommendationId={
              addingForYouRecommendationId
            }
            cardWidth={
              forYouCardWidth
            }
            items={
              forYouRecommendations
            }
            onPressItem={
              (item) => {
                void addForYouProductToCart(
                  item,
                );
              }
            }
          />

          <HomeDiscoveryRail
            items={
              discoveryContext.items
            }
            onPressItem={
              openDiscoveryItem
            }
          />

        </View>
      </ScrollView>

      <AppBottomNavigation
        activeTab="home"
        isSignedIn={isSignedIn}
      />

      <CampusUpdateWelcomeModal
        visible={
          isCampusUpdateModalVisible
        }
        onClose={() => {
          setIsCampusUpdateModalVisible(
            false,
          );
        }}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.page,
    flex: 1,
  },


  campusUpdateModalRoot: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: 16,
    position: 'absolute',
    right: 0,
    top: 0,
  },

  campusUpdateBackdrop: {
    backgroundColor:
      'rgba(0, 18, 10, 0.66)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },

  campusUpdateCard: {
    maxWidth: 356,
    position: 'relative',
    shadowColor: '#001A0B',
    shadowOffset: {
      width: 0,
      height: 16,
    },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 18,
  },

  campusUpdateCardSurface: {
    backgroundColor: '#FEFDF9',
    borderColor:
      'rgba(5, 91, 42, 0.08)',
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
  },

  campusUpdateHeroWrap: {
    backgroundColor: '#DCE7DE',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },

  campusUpdateHeroImage: {
    height: '100%',
    width: '100%',
  },

  campusUpdateHeroShade: {
    backgroundColor:
      'rgba(0, 0, 0, 0.025)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },

  campusUpdateCloseButton: {
    alignItems: 'center',
    backgroundColor:
      'rgba(255, 255, 255, 0.94)',
    borderColor:
      'rgba(0, 45, 19, 0.08)',
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    right: 12,
    shadowColor: '#001A0B',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    top: 12,
    width: 40,
    zIndex: 6,
    elevation: 5,
  },

  campusUpdateCloseButtonPressed: {
    backgroundColor:
      'rgba(244, 250, 246, 0.98)',
    transform: [
      {
        scale: 0.95,
      },
    ],
  },

  campusUpdateContent: {
    paddingBottom: 22,
    paddingHorizontal: 22,
    paddingTop: 21,
    width: '100%',
  },

  campusUpdateCopy: {
    alignItems: 'center',
    width: '100%',
  },

  campusUpdateHeadline: {
    color: '#168A3A',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 39,
    textAlign: 'center',
    writingDirection: 'rtl',
    width: '100%',
  },

  campusUpdateDescription: {
    color: '#151915',
    fontSize: 15.5,
    fontWeight: '700',
    lineHeight: 24,
    marginTop: 8,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  campusUpdatePrimaryButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#087D30',
    borderColor: '#0A6C2D',
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 55,
    shadowColor: '#075B2A',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.13,
    shadowRadius: 10,
    elevation: 4,
  },

  campusUpdatePrimaryButtonPressed: {
    opacity: 0.92,
    transform: [
      {
        scale: 0.985,
      },
    ],
  },

  campusUpdatePrimaryButtonText: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  pageContent: {
    paddingBottom:
      NAVIENTY_NOW_LAYOUT.bottomNavigationHeight +
      48,
  },

  header: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    minHeight: 172,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },

  headerTimeMoodLayer: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
  },

  headerTimeMoodBackground: {
    bottom: 0,
    height: '100%',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: '100%',
  },

  nightMoon: {
    backgroundColor: 'rgba(235,255,244,0.94)',
    borderRadius: 999,
    height: 22,
    left: '8%',
    position: 'absolute',
    top: 31,
    width: 22,
  },

  nightMoonCutout: {
    backgroundColor: '#0B463F',
    borderRadius: 999,
    height: 20,
    left: 7,
    position: 'absolute',
    top: -2,
    width: 20,
  },

  nightStar: {
    backgroundColor: 'rgba(235,255,244,0.82)',
    borderRadius: 999,
    height: 3,
    position: 'absolute',
    width: 3,
  },

  nightStarOne: {
    left: '16%',
    top: 24,
  },

  nightStarTwo: {
    height: 2,
    left: '20%',
    top: 43,
    width: 2,
  },

  nightStarThree: {
    height: 2,
    left: '12%',
    top: 58,
    width: 2,
  },

  morningGlow: {
    backgroundColor: 'rgba(221,255,190,0.10)',
    borderRadius: 999,
    height: 122,
    left: '23%',
    position: 'absolute',
    top: -48,
    width: 122,
  },

  morningSun: {
    backgroundColor: 'rgba(232,255,203,0.78)',
    borderColor: 'rgba(255,255,255,0.42)',
    borderRadius: 999,
    borderWidth: 1,
    height: 17,
    left: '31%',
    position: 'absolute',
    top: 29,
    width: 17,
  },

  dayGlow: {
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderRadius: 999,
    height: 220,
    left: '41%',
    position: 'absolute',
    top: -108,
    width: 220,
  },

  sunsetGlow: {
    backgroundColor: 'rgba(255,183,118,0.10)',
    borderRadius: 999,
    height: 178,
    position: 'absolute',
    right: -28,
    top: -48,
    width: 178,
  },

  sunsetSun: {
    backgroundColor: 'rgba(255,202,137,0.72)',
    borderColor: 'rgba(255,233,202,0.48)',
    borderRadius: 999,
    borderWidth: 1,
    bottom: 76,
    height: 19,
    position: 'absolute',
    right: '12%',
    width: 19,
  },

  moodHorizonVeil: {
    backgroundColor: 'rgba(0,69,43,0.055)',
    bottom: 58,
    height: 22,
    left: 0,
    position: 'absolute',
    right: 0,
  },

  // Abstract road: a darker green ribbon with very soft lane markers.
  // It is intentionally subtle so the courier remains the visual focus.
  headerRoadLayer: {
    bottom: 12,
    height: 58,
    left: -22,
    position: 'absolute',
    right: -22,
    zIndex: 2,
  },

  headerRoadSurface: {
    backgroundColor: 'rgba(0,50,39,0.29)',
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 999,
    borderWidth: 1,
    bottom: 0,
    height: 48,
    left: 0,
    position: 'absolute',
    right: 0,
  },

  headerRoadHighlight: {
    backgroundColor: 'rgba(255,255,255,0.075)',
    borderRadius: 999,
    height: 1,
    left: 28,
    position: 'absolute',
    right: 28,
    top: 9,
  },

  headerRoadDashTrack: {
    flexDirection: 'row',
    left: -384,
    position: 'absolute',
    top: 30,
    width: 1344,
  },

  headerRoadDash: {
    backgroundColor: 'rgba(255,255,255,0.30)',
    borderRadius: 999,
    height: 3,
    marginRight: 62,
    width: 34,
  },

  // The bike begins fully beyond the right edge, crosses every 24h mood,
  // then exits beyond the left edge before the invisible loop reset.
  deliveryBikeTrack: {
    bottom: 11,
    height: 132,
    position: 'absolute',
    right: -176,
    width: 166,
    zIndex: 6,
  },

  // Android mirrors the iOS physical journey inside a clipped full-width
  // layer. The bike begins completely outside the right edge, crosses the
  // header, exits completely outside the left edge, then resets invisibly.
  androidBikeLayer: {
    bottom: 0,
    direction: 'ltr',
    elevation: 40,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 40,
  },

  androidBikeTrack: {
    bottom: 11,
    height: 132,
    left: 0,
    position: 'absolute',
    width: 166,
  },

  deliveryBikeShadow: {
    backgroundColor: 'rgba(0,45,28,0.18)',
    borderRadius: 999,
    bottom: 8,
    height: 9,
    left: 25,
    position: 'absolute',
    right: 17,
    transform: [{ scaleX: 0.9 }],
  },

  deliveryBikeImage: {
    height: 132,
    width: 166,
  },

  headerWaveContainer: {
    bottom: 0,
    height: 34,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    zIndex: 8,
  },

  headerWaveSurface: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.page,
    borderRadius: 999,
    bottom: -54,
    height: 78,
    left: -50,
    position: 'absolute',
    right: 58,
    transform: [{ rotate: '-1deg' }],
  },

  headerWaveAccent: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.page,
    borderRadius: 999,
    bottom: -59,
    height: 80,
    position: 'absolute',
    right: -36,
    width: 188,
  },

  contentShell: {
    alignSelf: 'center',
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
    width: '100%',
  },

  homeSearchEntry: {
    alignItems: 'center',
    backgroundColor: '#F6F6F6',
    borderColor: '#E4E4E4',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row-reverse',
    height: 42,
    marginTop: 8,
    paddingHorizontal: 13,
  },

  homeSearchEntryPressed: {
    backgroundColor: '#F1F1F1',
    opacity: 0.94,
  },

  homeSearchIconWrap: {
    alignItems: 'center',
    height: 26,
    justifyContent: 'center',
    marginLeft: 6,
    width: 22,
  },

  homeSearchPlaceholder: {
    color: '#303030',
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.1,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  homeSearchFixedText: {
    color: '#303030',
    fontWeight: '500',
  },

  homeSearchDynamicText: {
    color: '#696969',
    fontWeight: '500',
  },

  categoryList: {
    marginHorizontal:
      -NAVIENTY_NOW_LAYOUT.pageGutter,
    marginTop: 18,
  },

  categoryListContent: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    flexGrow: 1,
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
    paddingVertical: 8,
  },

  categoryItem: {
    alignItems: 'center',
  },

  categoryItemPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.975 }],
  },

  categoryArtwork: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderRadius: 25,
    height: 104,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 104,
  },

  categoryImage: {
    height: '96%',
    width: '96%',
  },

  categoryFallbackIcon: {
    fontSize: 40,
  },

  categoryLabel: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 8,
    minHeight: 36,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  discoverySection: {
    marginTop: 26,
  },

  discoveryHeader: {
    alignItems: 'flex-end',
  },

  discoveryTitle: {
    color:
      NAVIENTY_NOW_COLORS.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.35,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  discoverySubtitle: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 3,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  discoveryRail: {
    marginHorizontal:
      -NAVIENTY_NOW_LAYOUT.pageGutter,
    marginTop: 15,
  },

  discoveryRailContent: {
    flexDirection: 'row-reverse',
    gap: 10,
    paddingBottom: 4,
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
  },

  discoveryCard: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderColor: '#DFE3E1',
    borderRadius: 20,
    borderWidth: 1,
    elevation: 1,
    flexShrink: 0,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.045,
    shadowRadius: 3,
  },

  discoveryCardPressed: {
    opacity: 0.82,
    transform: [
      {
        scale: 0.97,
      },
    ],
  },

  discoveryImageBox: {
    alignItems: 'center',
    backgroundColor: '#F5F7F5',
    height: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },

  discoveryImage: {
    height: '100%',
    width: '100%',
  },

  discoveryCardLabel: {
    color:
      NAVIENTY_NOW_COLORS.text,
    fontSize: 12.5,
    fontWeight: '800',
    lineHeight: 17,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  heroCampaign: {
    alignSelf: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.surface,
    borderRadius:
      NAVIENTY_NOW_LAYOUT.majorRadius,
    marginTop: 25,
    overflow: 'hidden',
  },

  heroCampaignPressed: {
    opacity: 0.88,
    transform: [
      {
        scale: 0.995,
      },
    ],
  },

  heroCampaignImage: {
    height: '100%',
    width: '100%',
  },

  heroCampaignLoading: {
    alignSelf: 'center',
    backgroundColor: '#EFEFF1',
    borderRadius:
      NAVIENTY_NOW_LAYOUT.majorRadius,
    marginTop: 25,
  },

  homeBannerSection: {
    marginTop: 8,
    width: '100%',
  },

  exclusiveOffersSection: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    overflow: 'visible',
    width: '100%',
  },

  exclusiveOffersHeader: {
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
  },

  exclusiveOffersBannerFrame: {
    borderRadius: 0,
  },

  homeBannerLoadingCard: {
    aspectRatio: HOME_BANNER_ASPECT_RATIO,
    backgroundColor: '#EFEFF1',
    borderRadius:
      NAVIENTY_NOW_LAYOUT.majorRadius,
    width: '100%',
  },

  homeBannerScroll: {
    width: '100%',
  },

  homeBannerCard: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.surface,
    borderRadius:
      NAVIENTY_NOW_LAYOUT.majorRadius,
    overflow: 'hidden',
  },

  homeBannerImage: {
    height: '100%',
    width: '100%',
  },

  homeBannerPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.995 }],
  },


  homeBannerDots: {
  alignItems: 'center',
  flexDirection: 'row',
  justifyContent: 'center',
  marginTop: 8,
  minHeight: 7,
},

homeBannerDot: {
  backgroundColor: '#D9D9D9',
  borderRadius: 999,
  height: 7,
  marginHorizontal: 3,
  width: 7,
},

  homeBannerDotActive: {
    backgroundColor: '#2B2B2B',
  },

  primaryButtonPressed: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPressed,
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },

  carouselSection: {
    marginTop: 27,
    width: '100%',
  },

  promoCard: {
    borderRadius:
      NAVIENTY_NOW_LAYOUT.majorRadius,
    flexDirection: 'row-reverse',
    height: 248,
    overflow: 'hidden',
    padding: 24,
    position: 'relative',
  },

  promoCardCopy: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: '62%',
    zIndex: 2,
  },

  promoEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  promoTitle: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 37,
    marginTop: 8,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  promoDescription: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 22,
    marginTop: 10,
    opacity: 0.88,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  promoLogoFrame: {
    alignItems: 'center',
    backgroundColor:
      'rgba(255,255,255,0.12)',
    borderColor:
      'rgba(255,255,255,0.22)',
    borderRadius: 28,
    borderWidth: 1,
    height: 126,
    justifyContent: 'center',
    left: 20,
    position: 'absolute',
    top: 61,
    transform: [{ rotate: '-6deg' }],
    width: 126,
  },

  promoLogoImage: {
    borderRadius: 21,
    height: 108,
    width: 108,
  },

  bagsArtwork: {
    bottom: 18,
    height: 175,
    left: 3,
    position: 'absolute',
    width: 156,
  },

  bagShape: {
    borderRadius: 19,
    bottom: 12,
    position: 'absolute',
  },

  bagShapeBack: {
    backgroundColor: '#BCEACD',
    height: 116,
    left: 7,
    transform: [{ rotate: '-9deg' }],
    width: 91,
  },

  bagShapeFront: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    height: 132,
    justifyContent: 'center',
    left: 49,
    transform: [{ rotate: '6deg' }],
    width: 97,
  },

  bagHandle: {
    borderColor:
      'rgba(255,255,255,0.72)',
    borderBottomWidth: 0,
    borderRadius: 14,
    borderWidth: 4,
    height: 24,
    left: 29,
    position: 'absolute',
    top: -12,
    width: 39,
  },

  bagMark: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 22,
    fontWeight: '900',
  },

  routeArtwork: {
    bottom: 25,
    height: 178,
    left: 12,
    position: 'absolute',
    width: 145,
  },

  routePoint: {
    backgroundColor: '#A8E9C0',
    borderColor: '#151F1A',
    borderRadius: 11,
    borderWidth: 4,
    height: 22,
    position: 'absolute',
    width: 22,
  },

  routePointTop: {
    right: 17,
    top: 4,
  },

  routePointBottom: {
    bottom: 8,
    left: 10,
  },

  routeLineOne: {
    backgroundColor: '#A8E9C0',
    borderRadius: 5,
    height: 7,
    position: 'absolute',
    right: 35,
    top: 26,
    transform: [{ rotate: '135deg' }],
    width: 75,
  },

  routeLineTwo: {
    backgroundColor: '#A8E9C0',
    borderRadius: 5,
    bottom: 35,
    height: 7,
    left: 27,
    position: 'absolute',
    transform: [{ rotate: '40deg' }],
    width: 77,
  },

  routePackage: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 20,
    height: 62,
    justifyContent: 'center',
    left: 46,
    position: 'absolute',
    top: 61,
    transform: [{ rotate: '-5deg' }],
    width: 62,
  },

  routePackageText: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 25,
    fontWeight: '900',
  },

  carouselDots: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 13,
  },

  carouselDot: {
    backgroundColor: '#DEDEE1',
    borderRadius: 5,
    height: 8,
    marginHorizontal: 4,
    width: 8,
  },

  carouselDotActive: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    width: 19,
  },

  /* ================================= */
  /* FOR YOU — SIMPLE PRODUCT TILE RAIL  */
  /* ================================= */

  forYouSection: {
    marginTop: 26,
  },

  forYouHeader: {
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
  },

  forYouSectionTitle: {
    color:
      NAVIENTY_NOW_COLORS.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.35,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  forYouSectionSubtitle: {
    color:
      NAVIENTY_NOW_COLORS.textMuted,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 3,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  forYouRail: {
    marginHorizontal:
      -NAVIENTY_NOW_LAYOUT.pageGutter,
    marginTop: 15,
  },

  forYouRailContent: {
    flexDirection: 'row-reverse',
    gap: 10,
    paddingBottom: 4,
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
  },

  forYouCard: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderColor: '#DFE3E1',
    borderRadius: 20,
    borderWidth: 1,
    elevation: 1,
    flexShrink: 0,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.045,
    shadowRadius: 3,
  },

  forYouCardPressed: {
    opacity: 0.82,
    transform: [
      {
        scale: 0.97,
      },
    ],
  },

  forYouCardDisabled: {
    opacity: 0.86,
  },

  forYouArtwork: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    height: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },

  forYouImage: {
    height: '100%',
    width: '100%',
  },

  forYouFallback: {
    fontSize: 32,
  },

  forYouLoadingOverlay: {
    alignItems: 'center',
    backgroundColor:
      'rgba(255,255,255,0.78)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },

  /* ================================= */
  /* RECENTLY VIEWED — SIMPLE TILE RAIL */
  /* ================================= */

  recentlyViewedSection: {
    marginTop: 26,
  },

  recentlyViewedSectionTitle: {
    color:
      NAVIENTY_NOW_COLORS.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.35,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  recentlyViewedRail: {
    marginHorizontal:
      -NAVIENTY_NOW_LAYOUT.pageGutter,
    marginTop: 15,
  },

  recentlyViewedRailContent: {
    flexDirection: 'row-reverse',
    gap: 10,
    paddingBottom: 4,
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
  },

  recentlyViewedCard: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderColor: '#DFE3E1',
    borderRadius: 20,
    borderWidth: 1,
    elevation: 1,
    flexShrink: 0,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.045,
    shadowRadius: 3,
  },

  recentlyViewedCardPressed: {
    opacity: 0.82,
    transform: [
      {
        scale: 0.97,
      },
    ],
  },

  recentlyViewedArtwork: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    height: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },

  recentlyViewedImage: {
    height: '100%',
    width: '100%',
  },

  recentlyViewedFallback: {
    fontSize: 32,
  },

  /* ================================= */
  /* RECENT / ORDER AGAIN — LOGO RAIL    */
  /* ================================= */

  recentOrdersSection: {
    marginTop: 26,
  },

  recentOrdersTitle: {
    color:
      NAVIENTY_NOW_COLORS.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.35,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  recentOrdersRail: {
    marginHorizontal:
      -NAVIENTY_NOW_LAYOUT.pageGutter,
    marginTop: 15,
  },

  recentOrdersRailContent: {
    flexDirection: 'row-reverse',
    gap: 10,
    paddingBottom: 4,
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
  },

  recentOrderCard: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderColor: '#DFE3E1',
    borderRadius: 20,
    borderWidth: 1,
    elevation: 1,
    flexShrink: 0,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.045,
    shadowRadius: 3,
  },

  recentOrderCardPressed: {
    opacity: 0.82,
    transform: [
      {
        scale: 0.97,
      },
    ],
  },

  recentOrderCardDisabled: {
    opacity: 0.86,
  },

  recentOrderArtwork: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    height: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },

  recentOrderArtworkImage: {
    height: '100%',
    width: '100%',
  },

  recentOrderArtworkLoading: {
    backgroundColor: '#F3F5F4',
    height: '100%',
    width: '100%',
  },

  recentOrderArtworkFallback: {
    fontSize: 32,
  },

  recentOrderLoadingOverlay: {
    alignItems: 'center',
    backgroundColor:
      'rgba(255,255,255,0.78)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },

  /* ================================= */
  /* ACTIVE ORDER TRACKING               */
  /* ================================= */

  activeOrdersRail: {
    marginHorizontal:
      -NAVIENTY_NOW_LAYOUT.pageGutter,
    marginTop: 24,
  },

  activeOrdersRailContent: {
    flexDirection: 'row-reverse',
    gap: 12,
    paddingBottom: 5,
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
  },

  activeOrderCardShell: {
    flexShrink: 0,
  },

  activeOrderCard: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderColor: '#E7E9E8',
    borderRadius: 24,
    borderWidth: 1,
    elevation: 0,
    minHeight: 190,
    paddingBottom: 17,
    paddingHorizontal: 17,
    paddingTop: 16,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.025,
    shadowRadius: 4,
  },

  activeOrderCardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.994 }],
  },

  activeOrderTopRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    minHeight: 62,
  },

  activeOrderStoreArtwork: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderColor: '#ECEEED',
    borderRadius: 16,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 58,
  },

  activeOrderStoreImage: {
    height: '100%',
    width: '100%',
  },

  activeOrderStoreImageLoading: {
    backgroundColor: '#F1F4F2',
    borderRadius: 14,
    height: '100%',
    width: '100%',
  },

  activeOrderStoreFallback: {
    fontSize: 25,
  },

  activeOrderStoreNameWrap: {
    alignItems: 'flex-end',
    flex: 1,
    justifyContent: 'center',
    marginRight: 12,
    minWidth: 0,
  },

  activeOrderStoreName: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 23,
    textAlign: 'right',
    width: '100%',
    writingDirection: 'rtl',
  },

  activeOrderFlow: {
    marginTop: 22,
  },

  activeOrderFlowRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    minHeight: 38,
    paddingHorizontal: 4,
  },

  activeOrderFlowStep: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    width: 38,
  },

  activeOrderStepIconWrap: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    position: 'relative',
    width: 34,
  },

  activeOrderConfirmationIcon: {
    backgroundColor: '#EFF1F0',
    borderRadius: 17,
  },

  activeOrderConfirmationIconReached: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
  },

  activeOrderActiveHalo: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 22,
    bottom: -5,
    left: -5,
    position: 'absolute',
    right: -5,
    top: -5,
  },

  activeOrderConnector: {
    backgroundColor: '#E4E6E5',
    borderRadius: 3,
    flex: 1,
    height: 5,
    marginHorizontal: 6,
    minWidth: 18,
    overflow: 'hidden',
    position: 'relative',
  },

  activeOrderConnectorFill: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },

  activeOrderConnectorCurrentFill: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 3,
    bottom: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: '18%',
  },

  activeOrderCurrentStatus: {
    color: '#2A2C2B',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 26,
    marginTop: 18,
    textAlign: 'right',
    width: '100%',
    writingDirection: 'rtl',
  },

  welcomeBanner: {
    alignItems: 'center',
    backgroundColor: '#F6FBF8',
    borderColor: '#DDEFE4',
    borderRadius:
      NAVIENTY_NOW_LAYOUT.cardRadius,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 25,
    minHeight: 112,
    padding: 17,
  },

  welcomeBannerIcon: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPale,
    borderRadius: 18,
    height: 67,
    justifyContent: 'center',
    marginRight: 13,
    width: 67,
  },

  welcomeBag: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 8,
    height: 39,
    justifyContent: 'center',
    position: 'relative',
    transform: [{ rotate: '-4deg' }],
    width: 35,
  },

  welcomeBagHandle: {
    borderColor:
      NAVIENTY_NOW_COLORS.primaryDark,
    borderBottomWidth: 0,
    borderRadius: 6,
    borderWidth: 3,
    height: 10,
    position: 'absolute',
    top: -6,
    width: 18,
  },

  welcomeBagText: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 18,
    fontWeight: '900',
  },

  welcomeBannerCopy: {
    alignItems: 'flex-end',
    flex: 1,
  },

  welcomeBannerTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  welcomeBannerDescription: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 5,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  welcomeBannerArrow: {
    alignItems: 'center',
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius: 17,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    marginLeft: 9,
    width: 34,
  },

  welcomeBannerArrowText: {
    color:
      NAVIENTY_NOW_COLORS.primaryDark,
    fontSize: 27,
    lineHeight: 28,
  },

  cardPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.992 }],
  },

  storesSection: {
    marginTop: 33,
  },

  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  sectionTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  sectionAction: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },

  sectionActionPressed: {
    opacity: 0.55,
  },

  sectionActionText: {
    color:
      NAVIENTY_NOW_COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '800',
  },

  storeRows: {
    gap: 12,
  },

  // "Big brands" flush-edge row: the logo tile touches the row's
  // trailing edge with no inner padding, mirroring a dense
  // brands-near-you list.
  brandRow: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius:
      NAVIENTY_NOW_LAYOUT.cardRadius,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    minHeight: 78,
    overflow: 'hidden',
  },

  brandRowContent: {
    alignItems: 'flex-end',
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  brandNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    maxWidth: '100%',
  },

  brandRowName: {
    color: NAVIENTY_NOW_COLORS.text,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  brandRowMeta: {
    color:
      NAVIENTY_NOW_COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  brandRowMetaClosed: {
    color: NAVIENTY_NOW_COLORS.textMuted,
  },

  featuredBadge: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPale,
    borderRadius: 7,
    marginRight: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },

  featuredBadgeText: {
    color:
      NAVIENTY_NOW_COLORS.primaryDark,
    fontSize: 9,
    fontWeight: '900',
  },

  compactEmptyCard: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.surface,
    borderRadius:
      NAVIENTY_NOW_LAYOUT.cardRadius,
    marginTop: 22,
    padding: 22,
  },

  compactEmptyTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  compactEmptyDescription: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 5,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  inlineErrorCard: {
    alignItems: 'center',
    backgroundColor: '#FFF7F7',
    borderColor: '#F4D4D4',
    borderRadius:
      NAVIENTY_NOW_LAYOUT.cardRadius,
    borderWidth: 1,
    padding: 21,
  },

  inlineErrorTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 15,
    fontWeight: '900',
  },

  inlineErrorDescription: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 5,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  inlineRetryButton: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 14,
    marginTop: 13,
    minHeight: 42,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },

  inlineRetryButtonText: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 12,
    fontWeight: '900',
  },

  storeSkeletonList: {
    gap: 12,
  },

  storeSkeletonRow: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius:
      NAVIENTY_NOW_LAYOUT.cardRadius,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    minHeight: 78,
    padding: 10,
  },

  storeSkeletonImage: {
    backgroundColor: '#EEEEF0',
    borderRadius: 15,
    height: 58,
    width: 58,
  },

  storeSkeletonCopy: {
    alignItems: 'flex-end',
    flex: 1,
    marginHorizontal: 14,
  },

  storeSkeletonTitle: {
    backgroundColor: '#EEEEF0',
    borderRadius: 6,
    height: 17,
    width: '64%',
  },

  storeSkeletonMeta: {
    backgroundColor: '#F2F2F4',
    borderRadius: 5,
    height: 11,
    marginTop: 11,
    width: '42%',
  },

  loadingPageContent: {
    paddingBottom:
      NAVIENTY_NOW_LAYOUT.bottomNavigationHeight +
      35,
  },

  loadingHeader: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    minHeight:
      Platform.OS === 'android'
        ? (NativeStatusBar.currentHeight ?? 0) +
          88
        : 106,
    overflow: 'hidden',
    position: 'relative',
  },

  loadingCategories: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 27,
    overflow: 'hidden',
  },

  loadingCategoryItem: {
    alignItems: 'center',
    width: 90,
  },

  loadingCategoryTile: {
    backgroundColor: '#EEEEF0',
    borderRadius: 23,
    height: 90,
    width: 90,
  },

  loadingCategoryLabel: {
    backgroundColor: '#F0F0F2',
    borderRadius: 5,
    height: 12,
    marginTop: 9,
    width: 58,
  },

  loadingMainCard: {
    backgroundColor: '#EFEFF1',
    borderRadius:
      NAVIENTY_NOW_LAYOUT.majorRadius,
    height: Math.round(
      232 * HOME_BANNER_HEIGHT_SCALE,
    ),
    marginTop: 30,
  },

  loadingExclusiveBanner: {
    backgroundColor: '#EFEFF1',
    borderRadius:
      NAVIENTY_NOW_LAYOUT.majorRadius,
    height: Math.round(
      232 * HOME_BANNER_HEIGHT_SCALE,
    ),
  },

  loadingSectionTitle: {
    backgroundColor: '#ECECEE',
    borderRadius: 7,
    height: 23,
    marginBottom: 16,
    marginLeft: 'auto',
    marginTop: 34,
    width: 170,
  },

  errorPageContent: {
    minHeight: '100%',
    paddingBottom:
      NAVIENTY_NOW_LAYOUT.bottomNavigationHeight +
      35,
  },

  errorContentShell: {
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: 430,
    paddingHorizontal: 24,
    paddingTop: 72,
    width: '100%',
  },

  fatalErrorIcon: {
    alignItems: 'center',
    backgroundColor: '#FFF0F0',
    borderRadius: 36,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },

  fatalErrorIconText: {
    color: NAVIENTY_NOW_COLORS.error,
    fontSize: 35,
    fontWeight: '900',
  },

  fatalErrorTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 20,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  fatalErrorDescription: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 21,
    marginTop: 9,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  fatalRetryButton: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 16,
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 50,
    paddingHorizontal: 23,
  },

  fatalRetryButtonText: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 14,
    fontWeight: '900',
  },
});

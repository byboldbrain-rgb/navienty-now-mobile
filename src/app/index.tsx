import { Ionicons } from '@expo/vector-icons';
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
  Animated,
  Easing,
  Image,
  type LayoutChangeEvent,
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
import getAppBootstrap, {
  type AppBootstrap,
  type City,
  type ServiceArea,
} from '../services/bootstrap-service';
import {
  listStores,
  type StoreSummary,
} from '../services/catalog-service';
import {
  type HomeBanner,
  type HomeBannerAudience,
  type HomeBannerPlacement,
  listHomeBanners,
} from '../services/home-banners-service';
import { getOrderByToken } from '../services/order-service';
import {
  canOpenHomeBanner,
  openHomeBannerAction,
} from '../services/promo-action-service';
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

const HOME_ORDER_POLL_INTERVAL_MS = 8000;

type BootstrapCategory =
  AppBootstrap['store_categories'][number] & {
    subtitle_ar?: string | null;
    subtitle_en?: string | null;
  };

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


const HOME_PROMO_CARDS: PromoCard[] = [
  {
    key: 'everyday-needs',
    eyebrow: 'Navienty Now',
    title: 'كل احتياجاتك أقرب',
    description:
      'مطاعم، سوبرماركت، صيدليات والمزيد من خلال تجربة واحدة سهلة.',
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
  category: BootstrapCategory;
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

  const imageSource = canShowRemoteImage
    ? { uri: remoteImageUrl }
    : getCategoryIcon(category.slug);

  return (
    <View
      style={[
        styles.categoryArtwork,
        {
          height: size,
          width: size,
        },
      ]}
    >
      <Image
        accessibilityIgnoresInvertColors
        accessibilityLabel={
          `أيقونة قسم ${category.name_ar}`
        }
        resizeMode="contain"
        source={imageSource}
        style={styles.categoryImage}
        onError={() => {
          if (canShowRemoteImage) {
            setRemoteImageFailed(true);
          }
        }}
      />
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
  categories: BootstrapCategory[];
  onPressCategory: (
    categorySlug: string,
  ) => void;
}) {
  const { width: viewportWidth } =
    useWindowDimensions();

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
   * Keep the four primary categories perfectly centered on every phone width.
   *
   * The old layout used four fixed 90px items plus page padding. On common
   * 360px Android devices that total is wider than the visible viewport, so
   * the horizontal ScrollView starts slightly off-center. Here each slot is
   * calculated from the actual available width while keeping 90px as the
   * maximum artwork size. If more than four categories are enabled, the rail
   * remains horizontally scrollable without changing the visual rhythm.
   */
  const stripWidth = Math.min(
    viewportWidth,
    NAVIENTY_NOW_LAYOUT.contentMaxWidth,
  );

  const visibleSlots = Math.min(
    4,
    Math.max(1, categories.length),
  );

  const categoryGap = 8;
  const horizontalPadding =
    NAVIENTY_NOW_LAYOUT.pageGutter;

  const availableWidth = Math.max(
    1,
    stripWidth - horizontalPadding * 2,
  );

  const categoryItemWidth = Math.floor(
    (availableWidth -
      categoryGap * (visibleSlots - 1)) /
      visibleSlots,
  );

  const categoryArtworkSize = Math.min(
    90,
    categoryItemWidth,
  );

  return (
    <ScrollView
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
   * The main Home banner should use the complete available width.
   *
   * Other placements can still keep the small next-card preview, but the
   * primary Home banner is intentionally full-width so it has the same
   * strong visual size as the large exclusive-offers banner.
   */
  const isMainPlacement = placement === 'main';

  const bannerPeekWidth =
    !isMainPlacement && banners.length > 1
      ? 28
      : 0;

  const bannerGap =
    !isMainPlacement && banners.length > 1
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
    bannerCardWidth * (9 / 16),
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
    if (!canOpenHomeBanner(banner)) {
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
        await openHomeBannerAction({
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
          <SectionHeader title={title} />
        ) : null}

        <View
          style={[
            styles.homeBannerLoadingCard,
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
        <SectionHeader title={title} />
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
                canOpenHomeBanner(banner)
                  ? 'link'
                  : 'image'
              }
              disabled={!canOpenHomeBanner(banner)}
              style={({ pressed }) => [
                styles.homeBannerCard,
                {
                  height: bannerHeight,
                  marginRight: bannerGap,
                  width: bannerCardWidth,
                },
                pressed &&
                  canOpenHomeBanner(banner) &&
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
    title: 'جاري تأكيد الطلب',
    icon: 'checkmark',
  },
  {
    key: 'preparing',
    title: 'جاري تحضير الطلب',
    icon: 'bag-handle-outline',
  },
  {
    key: 'delivery',
    title: 'الطلب في الطريق',
    icon: 'bicycle-outline',
  },
  {
    key: 'delivered',
    title: 'تم استلام الطلب',
    icon: 'home-outline',
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

function ActiveOrderStoreArtwork({
  order,
  store,
}: {
  order: Order;
  store: StoreSummary | null;
}) {
  const [imageFailed, setImageFailed] =
    useState(false);

  const logoUrl =
    store?.logoUrl?.trim() ?? '';

  const coverImageUrl =
    store?.coverImageUrl?.trim() ?? '';

  const imageUrl =
    logoUrl || coverImageUrl;

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  const canShowImage =
    imageUrl.length > 0 &&
    !imageFailed;

  return (
    <View style={styles.activeOrderStoreArtwork}>
      {canShowImage ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={`صورة ${order.storeName}`}
          resizeMode={
            logoUrl ? 'contain' : 'cover'
          }
          source={{ uri: imageUrl }}
          style={styles.activeOrderStoreImage}
          onError={() => {
            setImageFailed(true);
          }}
        />
      ) : (
        <Text style={styles.activeOrderStoreFallback}>
          {order.storeIcon || '🏪'}
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
  const currentStage =
    getHomeOrderTrackingStage(
      order.status,
    );

  return (
    <Pressable
      accessibilityLabel={`متابعة الطلب الحالي من ${order.storeName}`}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.activeOrderCard,
        {
          width: cardWidth,
        },
        pressed && styles.activeOrderCardPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.activeOrderTopRow}>
        <ActiveOrderStoreArtwork
          order={order}
          store={store}
        />

        <View style={styles.activeOrderHeading}>
          <Text style={styles.activeOrderEyebrow}>
            طلبك الحالي
          </Text>

          <Text
            numberOfLines={1}
            style={styles.activeOrderStoreName}
          >
            {order.storeName}
          </Text>
        </View>

        <View style={styles.activeOrderArrow}>
          <Text style={styles.activeOrderArrowText}>
            ‹
          </Text>
        </View>
      </View>

      <View style={styles.activeOrderFlow}>
        <View style={styles.activeOrderFlowRow}>
          {HOME_ORDER_TRACKING_STEPS.map(
            (step, index) => {
              const completed =
                currentStage > index;

              const active =
                currentStage === index;

              const reached =
                completed || active;

              return (
                <Fragment key={step.key}>
                  <View style={styles.activeOrderFlowStep}>
                    <View
                      style={[
                        styles.activeOrderFlowCircle,
                        reached &&
                          styles.activeOrderFlowCircleReached,
                        active &&
                          styles.activeOrderFlowCircleActive,
                      ]}
                    >
                      <Ionicons
                        name={
                          completed
                            ? 'checkmark'
                            : step.icon
                        }
                        size={14}
                        color={
                          reached
                            ? NAVIENTY_NOW_COLORS.white
                            : '#A6ACA8'
                        }
                      />
                    </View>

                    <Text
                      numberOfLines={2}
                      style={[
                        styles.activeOrderFlowLabel,
                        reached &&
                          styles.activeOrderFlowLabelReached,
                      ]}
                    >
                      {step.title}
                    </Text>
                  </View>

                  {index <
                    HOME_ORDER_TRACKING_STEPS.length - 1 ? (
                    <View
                      style={[
                        styles.activeOrderConnector,
                        currentStage > index &&
                          styles.activeOrderConnectorReached,
                      ]}
                    />
                  ) : null}
                </Fragment>
              );
            },
          )}
        </View>
      </View>
    </Pressable>
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

export default function HomeScreen() {
  const router = useRouter();
  const { width: windowWidth } =
    useWindowDimensions();
  const authState = useAuthSession();

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

  const orders = useOrdersStore(
    (state) => state.orders,
  );

  const pendingOrder = useOrdersStore(
    (state) => state.pendingOrder,
  );

  const ordersCount = orders.length;

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

  const userDisplayName =
    getUserDisplayName(authState);

  const categories = useMemo(
    () =>
      (bootstrap?.store_categories ?? []) as BootstrapCategory[],
    [bootstrap],
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
   * Active orders live in a horizontal rail.
   *
   * The card is intentionally a little narrower than the available
   * content width so the next active order peeks into view and makes
   * the horizontal interaction obvious.
   */
  const activeOrderCardWidth =
    Math.min(
      360,
      Math.max(
        302,
        bannerContentWidth - 20,
      ),
    );

  const bannerAudience: Exclude<
    HomeBannerAudience,
    'all'
  > = isSignedIn
    ? 'signed_in'
    : 'signed_out';

  const effectiveLocation =
    selectedLocation ??
    (bootstrap
      ? resolveDefaultLocation(bootstrap)
      : null);

  function openCategory(
    categorySlug: string,
  ) {
    const normalizedSlug = categorySlug
      .trim()
      .toLowerCase();

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

    router.push({
      pathname: '/category/[id]',
      params: {
        id: categorySlug,
      },
    });
  }

  function openStore(storeId: string) {
    router.push({
      pathname: '/store/[id]',
      params: {
        id: storeId,
      },
    });
  }


  function openOrders() {
    router.push('/orders');
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

          {isSignedIn ? (
            <>
              <PromoCarousel
                locationName={
                  effectiveLocation.areaName
                }
              />

              {/*
                Rewards/points/vouchers are intentionally not
                rendered here. The current supplied services expose
                no trusted credits, points, voucher, or wallet
                balance source, so we don't fabricate numbers just
                to match a reference layout. Wire this back up once
                a real balance endpoint exists.
              */}

              <SignedInWelcomeBanner
                ordersCount={ordersCount}
                userName={userDisplayName}
                onPressOrders={openOrders}
              />
            </>
          ) : (
            <HomeBannerCarousel
              audience="signed_out"
              fallbackWhatsAppNumber={
                bootstrap.settings
                  .support_whatsapp ||
                bootstrap.settings
                  .whatsapp_number
              }
              placement="main"
              serviceAreaId={
                effectiveLocation.areaId
              }
              width={bannerContentWidth}
            />
          )}

          <HomeBannerCarousel
            audience={bannerAudience}
            fallbackWhatsAppNumber={
              bootstrap.settings
                .support_whatsapp ||
              bootstrap.settings
                .whatsapp_number
            }
            placement="exclusive_offers"
            serviceAreaId={
              effectiveLocation.areaId
            }
            title="عروض حصرية"
            width={bannerContentWidth}
          />

        </View>
      </ScrollView>

      <AppBottomNavigation
        activeTab="home"
        isSignedIn={isSignedIn}
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
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 1,
  },

  headerTimeMoodBackground: {
    ...StyleSheet.absoluteFillObject,
    height: '100%',
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
    ...StyleSheet.absoluteFillObject,
    direction: 'ltr',
    elevation: 40,
    overflow: 'hidden',
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
    borderRadius: 23,
    height: 90,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 90,
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

  homeBannerSection: {
    marginTop: 29,
    width: '100%',
  },

  exclusiveOffersSection: {
    marginTop: 33,
    width: '100%',
  },

  homeBannerLoadingCard: {
    aspectRatio: 16 / 9,
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
    marginTop: 14,
    minHeight: 12,
  },

  homeBannerDot: {
    backgroundColor: '#D9D9D9',
    borderRadius: 999,
    height: 12,
    marginHorizontal: 5,
    width: 12,
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

  activeOrderCard: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius:
      NAVIENTY_NOW_LAYOUT.cardRadius,
    borderWidth: 1,
    elevation: 3,
    flexShrink: 0,
    paddingBottom: 15,
    paddingHorizontal: 15,
    paddingTop: 14,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.07,
    shadowRadius: 9,
  },

  activeOrderCardPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.993 }],
  },

  activeOrderTopRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
  },

  activeOrderStoreArtwork: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPale,
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 50,
  },

  activeOrderStoreImage: {
    height: '100%',
    width: '100%',
  },

  activeOrderStoreFallback: {
    fontSize: 23,
  },

  activeOrderHeading: {
    alignItems: 'flex-end',
    flex: 1,
    marginRight: 11,
  },

  activeOrderEyebrow: {
    color:
      NAVIENTY_NOW_COLORS.primaryDark,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  activeOrderStoreName: {
    color:
      NAVIENTY_NOW_COLORS.text,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 3,
    textAlign: 'right',
    width: '100%',
    writingDirection: 'rtl',
  },

  activeOrderArrow: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPale,
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    marginLeft: 8,
    width: 30,
  },

  activeOrderArrowText: {
    color:
      NAVIENTY_NOW_COLORS.primaryDark,
    fontSize: 23,
    fontWeight: '700',
    lineHeight: 24,
  },

  activeOrderFlow: {
    borderTopColor:
      NAVIENTY_NOW_COLORS.border,
    borderTopWidth:
      StyleSheet.hairlineWidth,
    marginTop: 13,
    paddingTop: 14,
  },

  activeOrderFlowRow: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
  },

  activeOrderFlowStep: {
    alignItems: 'center',
    width: 62,
  },

  activeOrderFlowCircle: {
    alignItems: 'center',
    backgroundColor: '#EEF1EF',
    borderColor: '#E3E7E4',
    borderRadius: 16,
    borderWidth: 2,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },

  activeOrderFlowCircleReached: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderColor:
      NAVIENTY_NOW_COLORS.primary,
  },

  activeOrderFlowCircleActive: {
    borderColor:
      NAVIENTY_NOW_COLORS.primaryDark,
    borderWidth: 3,
  },


  activeOrderFlowLabel: {
    color:
      NAVIENTY_NOW_COLORS.textMuted,
    fontSize: 8.5,
    fontWeight: '700',
    lineHeight: 13,
    marginTop: 6,
    minHeight: 27,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  activeOrderFlowLabelReached: {
    color:
      NAVIENTY_NOW_COLORS.text,
    fontWeight: '800',
  },

  activeOrderConnector: {
    backgroundColor: '#E3E7E4',
    borderRadius: 2,
    flex: 1,
    height: 3,
    marginHorizontal: -2,
    marginTop: 15,
    minWidth: 8,
  },

  activeOrderConnectorReached: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
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
    height: 232,
    marginTop: 30,
  },

  loadingExclusiveBanner: {
    backgroundColor: '#EFEFF1',
    borderRadius:
      NAVIENTY_NOW_LAYOUT.majorRadius,
    height: 232,
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


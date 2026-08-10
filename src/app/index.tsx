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
  Image,
  type LayoutChangeEvent,
  Linking,
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
import { useOrdersStore } from '../store/orders-store';
import {
  NAVIENTY_NOW_COLORS,
  NAVIENTY_NOW_LAYOUT,
} from '../theme/navienty-now-theme';

const navientyNowLogo = require('../assets/images/navienty-now-logo.jpg');

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

// Optional, purely-cosmetic fields for the "deals rail" cards.
// These are read defensively (with fallbacks) because the current
// catalog service does not guarantee they exist yet.
type DealsStore = StoreSummary & {
  discountLabel?: string | null;
  reviewsCountLabel?: string | null;
  averagePriceLabel?: string | null;
  distanceLabel?: string | null;
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

function formatCurrency(
  value: number,
  currencySymbol: string,
): string {
  const formattedValue =
    new Intl.NumberFormat('ar-EG', {
      maximumFractionDigits: 0,
    }).format(value);

  return `${formattedValue} ${
    currencySymbol || 'ج.م'
  }`;
}

function CategoryArtwork({
  category,
}: {
  category: BootstrapCategory;
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
    <View style={styles.categoryArtwork}>
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

function StoreArtwork({
  store,
  large = false,
  flushEdge = false,
}: {
  store: StoreSummary;
  large?: boolean;
  flushEdge?: boolean;
}) {
  const [imageFailed, setImageFailed] =
    useState(false);

  const imageUrl =
    store.logoUrl ?? store.coverImageUrl;

  const canShowImage =
    Boolean(imageUrl) && !imageFailed;

  return (
    <View
      style={[
        styles.storeArtwork,
        large && styles.storeArtworkLarge,
        flushEdge && styles.storeArtworkFlush,
      ]}
    >
      {canShowImage ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={
            `صورة ${store.name}`
          }
          resizeMode={
            store.logoUrl ? 'contain' : 'cover'
          }
          source={{
            uri: imageUrl ?? '',
          }}
          style={styles.storeImage}
          onError={() => {
            setImageFailed(true);
          }}
        />
      ) : (
        <Text
          style={[
            styles.storeFallbackIcon,
            large &&
              styles.storeFallbackIconLarge,
          ]}
        >
          {store.icon || '🏪'}
        </Text>
      )}

      {store.isManuallyClosed && (
        <View style={styles.closedOverlay}>
          <Text style={styles.closedOverlayText}>
            مغلق
          </Text>
        </View>
      )}
    </View>
  );
}

// Premium curved divider: a cleaner, softer wave made from large
// circular cut-outs and a small base strip. This keeps the same brand
// color while making the bottom edge feel more refined and intentional.
function HeaderWave() {
  return (
    <View
      pointerEvents="none"
      style={styles.headerWaveContainer}
    >
      <View style={styles.headerWaveBase} />

      <View
        style={[
          styles.waveCircle,
          styles.waveCircleOne,
        ]}
      />
      <View
        style={[
          styles.waveCircle,
          styles.waveCircleTwo,
        ]}
      />
      <View
        style={[
          styles.waveCircle,
          styles.waveCircleThree,
        ]}
      />
      <View
        style={[
          styles.waveCircle,
          styles.waveCircleFour,
        ]}
      />
    </View>
  );
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
          minHeight: topInset + 88,
        },
      ]}
    >
      <View
        pointerEvents="none"
        style={styles.headerDecorLayer}
      >
        <View
          style={[
            styles.headerGlow,
            styles.headerGlowPrimary,
          ]}
        />
        <View
          style={[
            styles.headerGlow,
            styles.headerGlowSecondary,
          ]}
        />
        <View
          style={[
            styles.headerStroke,
            styles.headerStrokeOne,
          ]}
        />
        <View
          style={[
            styles.headerStroke,
            styles.headerStrokeTwo,
          ]}
        />
      </View>

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

  return (
    <ScrollView
      horizontal
      contentContainerStyle={
        styles.categoryListContent
      }
      directionalLockEnabled
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
            pressed &&
              styles.categoryItemPressed,
          ]}
          onPress={() => {
            onPressCategory(category.slug);
          }}
        >
          <CategoryArtwork
            category={category}
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
}: {
  width: number;
  audience: Exclude<
    HomeBannerAudience,
    'all'
  >;
  placement: HomeBannerPlacement;
  title?: string;
}) {
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
  const bannerHeight = Math.round(
    carouselWidth * (9 / 16),
  );

  const carouselItems = useMemo(() => {
    if (banners.length <= 1) {
      return banners;
    }

    return [
      banners[banners.length - 1]!,
      ...banners,
      banners[0]!,
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
        x: nextPhysicalIndex * carouselWidth,
        y: 0,
      });
    },
    [carouselWidth],
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
  }, [audience, placement]);

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
    carouselWidth,
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
      const nextLogicalIndex =
        (activeIndexRef.current + 1) %
        banners.length;
      const nextPhysicalIndex =
        physicalIndexRef.current + 1;

      setLogicalIndex(nextLogicalIndex);
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
    setLogicalIndex,
  ]);

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
        carouselWidth,
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
      setLogicalIndex(0);
      scrollToPhysicalIndex(1, false);
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
    if (!banner.linkUrl) {
      return;
    }

    try {
      await Linking.openURL(banner.linkUrl);
    } catch (error) {
      console.warn(
        'Unable to open home banner link.',
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
              width: carouselWidth,
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
          height: bannerHeight,
        }}
        contentOffset={{
          x:
            banners.length > 1
              ? carouselWidth
              : 0,
          y: 0,
        }}
        decelerationRate="fast"
        nestedScrollEnabled
        overScrollMode="never"
        pagingEnabled
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={carouselWidth}
        style={[
          styles.homeBannerScroll,
          {
            height: bannerHeight,
            width: carouselWidth,
          },
        ]}
        onMomentumScrollEnd={handleScrollEnd}
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
                banner.linkUrl ? 'link' : 'image'
              }
              disabled={!banner.linkUrl}
              style={({ pressed }) => [
                styles.homeBannerCard,
                {
                  height: bannerHeight,
                  width: carouselWidth,
                },
                pressed &&
                  banner.linkUrl &&
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
                    width: carouselWidth,
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

// A promo banner (title + tagline + "see more" arrow) followed by a
// horizontally-scrolling rail of deal cards: cover image, a discount
// chip, a small round logo badge, name, rating and an average-price
// line. Any field the catalog service doesn't supply yet is simply
// omitted rather than faked.
function DealsBanner({
  onPressViewAll,
}: {
  onPressViewAll: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel="عروض توفير على المطاعم القريبة"
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.dealsBanner,
        pressed && styles.cardPressed,
      ]}
      onPress={onPressViewAll}
    >
      <View style={styles.dealsBannerArrow}>
        <Text
          style={styles.dealsBannerArrowText}
        >
          ‹
        </Text>
      </View>

      <View style={styles.dealsBannerCopy}>
        <Text style={styles.dealsBannerTitle}>
          وفّر في كل خروجة
        </Text>
        <Text
          style={styles.dealsBannerSubtitle}
        >
          خصومات على أشهر المطاعم القريبة منك
        </Text>
      </View>

      <View style={styles.dealsBannerBadge}>
        <Text style={styles.dealsBannerBadgeText}>
          %
        </Text>
      </View>
    </Pressable>
  );
}

function DealCard({
  store,
  currencySymbol,
  onPress,
}: {
  store: DealsStore;
  currencySymbol: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={
        `فتح ${store.name}`
      }
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.dealCard,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.dealCardImageWrap}>
        <StoreArtwork
          large
          store={store}
        />

        {store.discountLabel ? (
          <View style={styles.dealDiscountChip}>
            <Text
              style={styles.dealDiscountChipText}
            >
              {store.discountLabel}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.dealCardCopy}>
        <Text
          numberOfLines={1}
          style={styles.dealCardTitle}
        >
          {store.name}
        </Text>

        <View style={styles.dealCardFooter}>
          {store.rating > 0 ? (
            <Text style={styles.discoveryRating}>
              ★ {store.rating.toFixed(1)}
              {store.reviewsCountLabel
                ? ` (${store.reviewsCountLabel})`
                : ''}
            </Text>
          ) : (
            <Text
              style={styles.discoveryMutedMeta}
            >
              بدون تقييم بعد
            </Text>
          )}

          {store.distanceLabel ? (
            <Text style={styles.dealCardDistance}>
              {store.distanceLabel}
            </Text>
          ) : null}
        </View>

        <Text
          numberOfLines={1}
          style={styles.dealCardPrice}
        >
          {store.averagePriceLabel ||
            (store.deliveryFee > 0
              ? `التوصيل ${formatCurrency(
                  store.deliveryFee,
                  currencySymbol,
                )}`
              : 'تفاصيل الأسعار داخل المتجر')}
        </Text>
      </View>
    </Pressable>
  );
}

function DealsRailSection({
  stores,
  currencySymbol,
  onPressStore,
  onPressViewAll,
}: {
  stores: DealsStore[];
  currencySymbol: string;
  onPressStore: (storeId: string) => void;
  onPressViewAll: () => void;
}) {
  if (stores.length === 0) {
    return null;
  }

  return (
    <View style={styles.discoverySection}>
      <DealsBanner
        onPressViewAll={onPressViewAll}
      />

      <ScrollView
        horizontal
        contentContainerStyle={
          styles.discoveryListContent
        }
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
      >
        {stores.map((store) => (
          <DealCard
            key={store.id}
            currencySymbol={currencySymbol}
            store={store}
            onPress={() => {
              onPressStore(store.id);
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function DiscoveryRail({
  stores,
  currencySymbol,
  onPressStore,
}: {
  stores: StoreSummary[];
  currencySymbol: string;
  onPressStore: (storeId: string) => void;
}) {
  if (stores.length === 0) {
    return null;
  }

  return (
    <View style={styles.discoverySection}>
      <SectionHeader title="اكتشف المزيد" />

      <ScrollView
        horizontal
        contentContainerStyle={
          styles.discoveryListContent
        }
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
      >
        {stores.map((store) => (
          <Pressable
            key={store.id}
            accessibilityLabel={
              `فتح ${store.name}`
            }
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.discoveryCard,
              pressed && styles.cardPressed,
            ]}
            onPress={() => {
              onPressStore(store.id);
            }}
          >
            <StoreArtwork
              large
              store={store}
            />

            <View
              style={styles.discoveryCardCopy}
            >
              <Text
                numberOfLines={1}
                style={styles.discoveryCardTitle}
              >
                {store.name}
              </Text>

              <Text
                numberOfLines={1}
                style={styles.discoveryCardCategory}
              >
                {store.categoryName}
              </Text>

              <View
                style={styles.discoveryCardFooter}
              >
                {store.rating > 0 ? (
                  <Text
                    style={styles.discoveryRating}
                  >
                    ★{' '}
                    {store.rating.toFixed(1)}
                  </Text>
                ) : (
                  <Text
                    style={styles.discoveryMutedMeta}
                  >
                    بدون تقييم بعد
                  </Text>
                )}

                <Text
                  style={styles.discoveryDelivery}
                >
                  {store.deliveryFee > 0
                    ? formatCurrency(
                        store.deliveryFee,
                        currencySymbol,
                      )
                    : 'تفاصيل التوصيل داخل المتجر'}
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
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
  const [isStoresLoading, setIsStoresLoading] =
    useState(false);
  const [storesError, setStoresError] =
    useState<string | null>(null);

  const ordersCount = useOrdersStore(
    (state) => state.orders.length,
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
    [],
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
        setIsStoresLoading(true);
        setStoresError(null);

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
        setStoresError(
          error instanceof Error
            ? error.message
            : 'تعذر تحميل الأماكن.',
        );
      } finally {
        if (isMountedRef.current) {
          setIsStoresLoading(false);
        }
      }
    },
    [selectedLocation],
  );

  useEffect(() => {
    void loadStores();
  }, [loadStores]);

  const isSignedIn =
    authState.status === 'signedIn';

  const userDisplayName =
    getUserDisplayName(authState);

  const categories = useMemo(
    () =>
      (bootstrap?.store_categories ?? []) as BootstrapCategory[],
    [bootstrap],
  );


  // Reuses whichever stores are flagged as featured for the deals
  // rail; falls back to the first few stores if none are featured.
  const dealsStores = useMemo(() => {
    const featured = stores.filter(
      (store) => store.isFeatured,
    );

    const source =
      featured.length > 0
        ? featured
        : stores;

    return source.slice(0, 6) as DealsStore[];
  }, [stores]);

  const discoveryStores = useMemo(() => {
    const featured = stores.filter(
      (store) => store.isFeatured,
    );

    if (featured.length > 0) {
      return featured.slice(0, 6);
    }

    return stores.slice(0, 6);
  }, [stores]);

  const contentWidth = Math.min(
    windowWidth,
    NAVIENTY_NOW_LAYOUT.contentMaxWidth,
  );

  const bannerContentWidth = Math.max(
    1,
    contentWidth -
      NAVIENTY_NOW_LAYOUT.pageGutter * 2,
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
    if (categorySlug === 'supermarket') {
      router.push('/category/supermarket');
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

  function openSearch() {
    router.push('/search');
  }

  function openOrders() {
    router.push('/orders');
  }

  if (
    isBootstrapLoading ||
    authState.status === 'loading'
  ) {
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
              placement="main"
              width={bannerContentWidth}
            />
          )}

          <HomeBannerCarousel
            audience={bannerAudience}
            placement="exclusive_offers"
            title="عروض حصرية"
            width={bannerContentWidth}
          />

          {isSignedIn &&
            !isStoresLoading &&
            !storesError && (
              <DealsRailSection
                currencySymbol={
                  bootstrap.settings
                    .currency_symbol
                }
                stores={dealsStores}
                onPressStore={openStore}
                onPressViewAll={openSearch}
              />
            )}

          {isSignedIn &&
            !isStoresLoading &&
            !storesError && (
              <DiscoveryRail
                currencySymbol={
                  bootstrap.settings
                    .currency_symbol
                }
                stores={discoveryStores}
                onPressStore={openStore}
              />
            )}
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
    minHeight: 112,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },

  headerDecorLayer: {
    ...StyleSheet.absoluteFillObject,
  },

  headerGlow: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    position: 'absolute',
  },

  headerGlowPrimary: {
    height: 230,
    right: -36,
    top: 10,
    width: 230,
  },

  headerGlowSecondary: {
    height: 160,
    left: -34,
    top: 78,
    width: 160,
  },

  headerStroke: {
    borderColor: 'rgba(255,255,255,0.13)',
    borderRadius: 999,
    borderWidth: 1,
    position: 'absolute',
  },

  headerStrokeOne: {
    height: 216,
    right: -88,
    top: -48,
    width: 216,
  },

  headerStrokeTwo: {
    height: 138,
    left: -44,
    top: 28,
    width: 138,
  },

  // Premium bottom curve using softer, wider circular cut-outs.
  headerWaveContainer: {
    bottom: 0,
    height: 56,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
  },

  headerWaveBase: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.page,
    bottom: 0,
    height: 14,
    left: 0,
    position: 'absolute',
    right: 0,
  },

  waveCircle: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.page,
    borderRadius: 999,
    position: 'absolute',
  },

  waveCircleOne: {
    height: 164,
    left: -42,
    top: 18,
    width: 164,
  },

  waveCircleTwo: {
    height: 196,
    left: '28%',
    marginLeft: -98,
    top: 12,
    width: 196,
  },

  waveCircleThree: {
    height: 196,
    left: '72%',
    marginLeft: -98,
    top: 12,
    width: 196,
  },

  waveCircleFour: {
    height: 164,
    right: -42,
    top: 18,
    width: 164,
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
    flexDirection: 'row-reverse',
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
    paddingVertical: 9,
  },

  categoryItem: {
    alignItems: 'center',
    marginLeft: 11,
    width: 82,
  },

  categoryItemPressed: {
    opacity: 0.68,
    transform: [{ scale: 0.97 }],
  },

  categoryArtwork: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderRadius: 21,
    height: 82,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 82,
  },

  categoryImage: {
    height: '88%',
    width: '88%',
  },

  categoryFallbackIcon: {
    fontSize: 35,
  },

  categoryLabel: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 9,
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
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 7,
  },

  homeBannerDot: {
    backgroundColor: '#D9DBDF',
    borderRadius: 999,
    height: 7,
    marginHorizontal: 3,
    width: 7,
  },

  homeBannerDotActive: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    width: 18,
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

  storeArtwork: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.surface,
    borderRadius: 15,
    height: 90,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: 90,
  },

  storeArtworkLarge: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderRadius: 20,
    height: 142,
    width: '100%',
  },

  storeArtworkFlush: {
    borderBottomLeftRadius: 0,
    borderRadius: 0,
    borderTopLeftRadius: 0,
    height: '100%',
    width: 96,
  },

  storeImage: {
    height: '100%',
    width: '100%',
  },

  storeFallbackIcon: {
    fontSize: 34,
  },

  storeFallbackIconLarge: {
    fontSize: 48,
  },

  closedOverlay: {
    alignItems: 'center',
    backgroundColor:
      'rgba(20,20,20,0.52)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },

  closedOverlayText: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 13,
    fontWeight: '900',
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

  discoverySection: {
    marginTop: 35,
  },

  // Promo banner that introduces the deals rail below it.
  dealsBanner: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryUltraPale,
    borderRadius:
      NAVIENTY_NOW_LAYOUT.cardRadius,
    flexDirection: 'row-reverse',
    minHeight: 74,
    marginBottom: 15,
    padding: 15,
  },

  dealsBannerBadge: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 20,
    height: 44,
    justifyContent: 'center',
    marginRight: 12,
    width: 44,
  },

  dealsBannerBadgeText: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 20,
    fontWeight: '900',
  },

  dealsBannerCopy: {
    alignItems: 'flex-end',
    flex: 1,
  },

  dealsBannerTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  dealsBannerSubtitle: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  dealsBannerArrow: {
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

  dealsBannerArrowText: {
    color:
      NAVIENTY_NOW_COLORS.primaryDark,
    fontSize: 27,
    lineHeight: 28,
  },

  dealCard: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius:
      NAVIENTY_NOW_LAYOUT.cardRadius,
    borderWidth: 1,
    marginLeft: 13,
    overflow: 'hidden',
    width: 210,
  },

  dealCardImageWrap: {
    position: 'relative',
  },

  dealDiscountChip: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 8,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: 'absolute',
    top: 10,
  },

  dealDiscountChipText: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 11,
    fontWeight: '900',
  },

  dealCardCopy: {
    alignItems: 'flex-end',
    padding: 13,
  },

  dealCardTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
    width: '100%',
    writingDirection: 'rtl',
  },

  dealCardFooter: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 8,
    width: '100%',
  },

  dealCardDistance: {
    color: NAVIENTY_NOW_COLORS.textMuted,
    fontSize: 10,
  },

  dealCardPrice: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'right',
    width: '100%',
    writingDirection: 'rtl',
  },

  discoveryListContent: {
    flexDirection: 'row-reverse',
    paddingBottom: 5,
  },

  discoveryCard: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius:
      NAVIENTY_NOW_LAYOUT.cardRadius,
    borderWidth: 1,
    marginLeft: 13,
    overflow: 'hidden',
    width: 246,
  },

  discoveryCardCopy: {
    alignItems: 'flex-end',
    padding: 14,
  },

  discoveryCardTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
    width: '100%',
    writingDirection: 'rtl',
  },

  discoveryCardCategory: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 11,
    marginTop: 4,
    textAlign: 'right',
    width: '100%',
    writingDirection: 'rtl',
  },

  discoveryCardFooter: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 11,
    width: '100%',
  },

  discoveryRating: {
    color: '#8D6414',
    fontSize: 11,
    fontWeight: '800',
  },

  discoveryMutedMeta: {
    color: NAVIENTY_NOW_COLORS.textMuted,
    fontSize: 10,
  },

  discoveryDelivery: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 9,
    maxWidth: 130,
    textAlign: 'left',
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
    marginTop: 27,
    overflow: 'hidden',
  },

  loadingCategoryItem: {
    alignItems: 'center',
    marginLeft: 11,
    width: 82,
  },

  loadingCategoryTile: {
    backgroundColor: '#EEEEF0',
    borderRadius: 21,
    height: 82,
    width: 82,
  },

  loadingCategoryLabel: {
    backgroundColor: '#F0F0F2',
    borderRadius: 5,
    height: 12,
    marginTop: 10,
    width: 54,
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

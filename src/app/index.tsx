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

import AppBottomNavigation from '../components/app-bottom-navigation';
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

function getStoreStatusLabel(
  store: StoreSummary,
): string {
  if (store.isManuallyClosed) {
    return store.manualClosedNote?.trim() ||
      'مغلق مؤقتًا';
  }

  return 'متاح للطلب';
}

function SearchIcon({
  color = NAVIENTY_NOW_COLORS.textMuted,
}: {
  color?: string;
}) {
  return (
    <View
      style={styles.searchIconCanvas}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[
          styles.searchIconCircle,
          {
            borderColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.searchIconHandle,
          {
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

function CategoryArtwork({
  category,
}: {
  category: BootstrapCategory;
}) {
  const [imageFailed, setImageFailed] =
    useState(false);

  const canShowImage =
    Boolean(category.image_url) &&
    !imageFailed;

  return (
    <View style={styles.categoryArtwork}>
      {canShowImage ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={
            `صورة قسم ${category.name_ar}`
          }
          resizeMode="contain"
          source={{
            uri: category.image_url ?? '',
          }}
          style={styles.categoryImage}
          onError={() => {
            setImageFailed(true);
          }}
        />
      ) : (
        <Text
          style={styles.categoryFallbackIcon}
        >
          {category.icon ?? '📦'}
        </Text>
      )}
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

// Scalloped wave divider built from three large overlapping circles
// poking up out of a page-colored strip. This mirrors the reference
// header's wavy bottom edge while staying pure RN (no SVG deps) and
// keeping whatever header color is passed to it.
function HeaderWave() {
  return (
    <View
      pointerEvents="none"
      style={styles.headerWaveContainer}
    >
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
    </View>
  );
}

function HomeHeader({
  location,
  onPressLocation,
  onPressSearch,
}: {
  location: ResolvedLocation;
  onPressLocation: () => void;
  onPressSearch: () => void;
}) {
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
          paddingTop: topInset + 16,
        },
      ]}
    >
      <View style={styles.headerContent}>
        <Pressable
          accessibilityLabel={
            `التوصيل إلى ${location.fullName}. اضغط لتغيير المنطقة.`
          }
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.locationButton,
            pressed &&
              styles.headerControlPressed,
          ]}
          onPress={onPressLocation}
        >
          <Text style={styles.locationChevron}>
            ⌄
          </Text>

          <View style={styles.locationCopy}>
            <Text style={styles.locationLabel}>
              التوصيل إلى
            </Text>

            <Text
              numberOfLines={1}
              style={styles.locationValue}
            >
              {location.fullName}
            </Text>
          </View>
        </Pressable>

        <Pressable
          accessibilityLabel="البحث عن أكل أو بقالة أو صيدلية أو المزيد"
          accessibilityRole="search"
          style={({ pressed }) => [
            styles.searchPill,
            pressed &&
              styles.searchPillPressed,
          ]}
          onPress={onPressSearch}
        >
          <SearchIcon />

          <Text
            numberOfLines={1}
            style={styles.searchPlaceholder}
          >
            ابحث عن أكل، بقالة، صيدلية والمزيد
          </Text>
        </Pressable>
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

function LoginInvitationCard({
  authErrorMessage,
  onPressLogin,
}: {
  authErrorMessage: string | null;
  onPressLogin: () => void;
}) {
  return (
    <View style={styles.loginCard}>
      <View style={styles.loginArtworkWrap}>
        <Image
          accessibilityLabel="شعار Navienty Now"
          resizeMode="contain"
          source={navientyNowLogo}
          style={styles.loginLogo}
        />
      </View>

      <View style={styles.loginContent}>
        <Text style={styles.loginTitle}>
          أهلاً بك.
        </Text>

        <Text style={styles.loginDescription}>
          سجّل الدخول لتحصل على تجربة أسرع وأكثر تخصيصًا.
        </Text>

        {authErrorMessage && (
          <Text style={styles.authWarningText}>
            {authErrorMessage} يمكنك متابعة التصفح كزائر.
          </Text>
        )}

        <Pressable
          accessibilityLabel="تسجيل الدخول إلى Navienty Now"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.loginButton,
            pressed &&
              styles.primaryButtonPressed,
          ]}
          onPress={onPressLogin}
        >
          <Text style={styles.loginButtonText}>
            تسجيل الدخول
          </Text>
        </Pressable>
      </View>
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

// Flush-edge brand row: the logo tile sits directly against the
// card's leading edge (no inner padding around it), matching a
// dense "brands near you" list layout.
function BigBrandRow({
  store,
  onPress,
}: {
  store: StoreSummary;
  onPress: () => void;
}) {
  const statusLabel =
    getStoreStatusLabel(store);

  const deliveryLabel =
    store.deliveryTime ||
    (store.estimatedDeliveryMinutes
      ? `${store.estimatedDeliveryMinutes} دقيقة تقريبًا`
      : statusLabel);

  return (
    <Pressable
      accessibilityLabel={
        `${store.name}. ${deliveryLabel}.`
      }
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.brandRow,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      <StoreArtwork
        flushEdge
        store={store}
      />

      <View style={styles.brandRowContent}>
        <View style={styles.brandNameRow}>
          {store.isFeatured && (
            <View
              style={styles.featuredBadge}
            >
              <Text
                style={styles.featuredBadgeText}
              >
                مميز
              </Text>
            </View>
          )}

          <Text
            numberOfLines={1}
            style={styles.brandRowName}
          >
            {store.name}
          </Text>
        </View>

        <Text
          numberOfLines={1}
          style={[
            styles.brandRowMeta,
            store.isManuallyClosed &&
              styles.brandRowMetaClosed,
          ]}
        >
          {deliveryLabel}
        </Text>
      </View>
    </Pressable>
  );
}

function BigBrandsSection({
  stores,
  isLoading,
  errorMessage,
  onPressRetry,
  onPressStore,
  onPressViewAll,
}: {
  stores: StoreSummary[];
  isLoading: boolean;
  errorMessage: string | null;
  onPressRetry: () => void;
  onPressStore: (storeId: string) => void;
  onPressViewAll: () => void;
}) {
  return (
    <View style={styles.storesSection}>
      <SectionHeader
        actionLabel="عرض الكل"
        title="أشهر البراندات قريبة منك"
        onPressAction={onPressViewAll}
      />

      {isLoading ? (
        <View style={styles.storeSkeletonList}>
          {[0, 1].map((index) => (
            <View
              key={index}
              style={styles.storeSkeletonRow}
            >
              <View
                style={styles.storeSkeletonImage}
              />
              <View
                style={styles.storeSkeletonCopy}
              >
                <View
                  style={styles.storeSkeletonTitle}
                />
                <View
                  style={styles.storeSkeletonMeta}
                />
              </View>
            </View>
          ))}
        </View>
      ) : errorMessage ? (
        <View style={styles.inlineErrorCard}>
          <Text style={styles.inlineErrorTitle}>
            تعذر تحميل الأماكن
          </Text>
          <Text
            style={styles.inlineErrorDescription}
          >
            حاول مرة أخرى مع بقاء باقي الصفحة متاحًا.
          </Text>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.inlineRetryButton,
              pressed &&
                styles.primaryButtonPressed,
            ]}
            onPress={onPressRetry}
          >
            <Text
              style={styles.inlineRetryButtonText}
            >
              إعادة المحاولة
            </Text>
          </Pressable>
        </View>
      ) : stores.length === 0 ? (
        <View style={styles.compactEmptyCard}>
          <Text style={styles.compactEmptyTitle}>
            لا توجد أماكن متاحة في هذه المنطقة
          </Text>
          <Text
            style={styles.compactEmptyDescription}
          >
            جرّب اختيار منطقة توصيل أخرى.
          </Text>
        </View>
      ) : (
        <View style={styles.storeRows}>
          {stores.map((store) => (
            <BigBrandRow
              key={store.id}
              store={store}
              onPress={() => {
                onPressStore(store.id);
              }}
            />
          ))}
        </View>
      )}
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

function LocationSelectorModal({
  bootstrap,
  selectedLocation,
  visible,
  onClose,
  onSelectLocation,
}: {
  bootstrap: AppBootstrap;
  selectedLocation: ResolvedLocation;
  visible: boolean;
  onClose: () => void;
  onSelectLocation: (
    location: ResolvedLocation,
  ) => void;
}) {
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <Pressable
          accessibilityLabel="إغلاق اختيار منطقة التوصيل"
          accessibilityRole="button"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />

        <View style={styles.locationModalCard}>
          <View style={styles.modalHandle} />

          <View style={styles.modalHeader}>
            <Pressable
              accessibilityLabel="إغلاق"
              accessibilityRole="button"
              hitSlop={8}
              style={({ pressed }) => [
                styles.modalCloseButton,
                pressed &&
                  styles.sectionActionPressed,
              ]}
              onPress={onClose}
            >
              <Text
                style={styles.modalCloseText}
              >
                ×
              </Text>
            </Pressable>

            <View style={styles.modalHeaderCopy}>
              <Text style={styles.modalTitle}>
                اختر منطقة التوصيل
              </Text>
              <Text
                style={styles.modalDescription}
              >
                سنعرض الأماكن التي تخدم المنطقة المختارة.
              </Text>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={
              styles.locationOptions
            }
            showsVerticalScrollIndicator={false}
          >
            {bootstrap.cities.map((city) => (
              <View
                key={city.id}
                style={styles.cityGroup}
              >
                <Text style={styles.cityName}>
                  {city.name_ar}
                </Text>

                {city.areas.length === 0 ? (
                  <Text
                    style={styles.noAreasText}
                  >
                    لا توجد مناطق مفعلة في هذه المدينة.
                  </Text>
                ) : (
                  city.areas.map((area) => {
                    const isSelected =
                      area.id ===
                      selectedLocation.areaId;

                    return (
                      <Pressable
                        key={area.id}
                        accessibilityLabel={
                          `اختيار ${area.name_ar}، ${city.name_ar}`
                        }
                        accessibilityRole="radio"
                        accessibilityState={{
                          checked: isSelected,
                        }}
                        style={({ pressed }) => [
                          styles.areaOption,
                          isSelected &&
                            styles.areaOptionSelected,
                          pressed &&
                            styles.areaOptionPressed,
                        ]}
                        onPress={() => {
                          onSelectLocation(
                            locationFromArea(
                              city,
                              area,
                            ),
                          );
                        }}
                      >
                        <View
                          style={[
                            styles.areaRadio,
                            isSelected &&
                              styles.areaRadioSelected,
                          ]}
                        >
                          {isSelected && (
                            <View
                              style={
                                styles.areaRadioDot
                              }
                            />
                          )}
                        </View>

                        <View
                          style={styles.areaOptionCopy}
                        >
                          <Text
                            style={
                              styles.areaOptionName
                            }
                          >
                            {area.name_ar}
                          </Text>

                          {area.default_estimated_delivery_minutes ? (
                            <Text
                              style={
                                styles.areaOptionMeta
                              }
                            >
                              وقت تقديري افتراضي{' '}
                              {
                                area.default_estimated_delivery_minutes
                              }{' '}
                              دقيقة
                            </Text>
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
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
          <View style={styles.loadingHeaderInner}>
            <View
              style={styles.loadingLocationLine}
            />
            <View
              style={styles.loadingSearchPill}
            />
          </View>
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

          <View style={styles.storeSkeletonList}>
            {[0, 1].map((index) => (
              <View
                key={index}
                style={styles.storeSkeletonRow}
              >
                <View
                  style={
                    styles.storeSkeletonImage
                  }
                />
                <View
                  style={
                    styles.storeSkeletonCopy
                  }
                >
                  <View
                    style={
                      styles.storeSkeletonTitle
                    }
                  />
                  <View
                    style={
                      styles.storeSkeletonMeta
                    }
                  />
                </View>
              </View>
            ))}
          </View>
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
  onOpenSearch,
}: {
  message: string;
  onRetry: () => void;
  onOpenSearch: () => void;
}) {
  const fallbackLocation: ResolvedLocation = {
    areaId: null,
    cityId: null,
    cityName: '',
    areaName: 'منطقتك',
    fullName: 'منطقة التوصيل غير محددة',
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={
          styles.errorPageContent
        }
        showsVerticalScrollIndicator={false}
      >
        <HomeHeader
          location={fallbackLocation}
          onPressLocation={onRetry}
          onPressSearch={onOpenSearch}
        />

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
  const [locationModalVisible, setLocationModalVisible] =
    useState(false);

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

  const nearbyStores = useMemo(
    () => stores.slice(0, isSignedIn ? 3 : 2),
    [isSignedIn, stores],
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

  const effectiveLocation =
    selectedLocation ??
    (bootstrap
      ? resolveDefaultLocation(bootstrap)
      : null);

  function openCategory(
    categorySlug: string,
  ) {
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

  function openLogin() {
    router.push('/login');
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
        onOpenSearch={openSearch}
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
        <HomeHeader
          location={effectiveLocation}
          onPressLocation={() => {
            setLocationModalVisible(true);
          }}
          onPressSearch={openSearch}
        />

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
            <LoginInvitationCard
              authErrorMessage={
                authState.status === 'error'
                  ? authState.errorMessage
                  : null
              }
              onPressLogin={openLogin}
            />
          )}

          <BigBrandsSection
            errorMessage={storesError}
            isLoading={isStoresLoading}
            stores={nearbyStores}
            onPressRetry={() => {
              void loadStores();
            }}
            onPressStore={openStore}
            onPressViewAll={openSearch}
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

      <LocationSelectorModal
        bootstrap={bootstrap}
        selectedLocation={
          effectiveLocation
        }
        visible={locationModalVisible}
        onClose={() => {
          setLocationModalVisible(false);
        }}
        onSelectLocation={(location) => {
          setSelectedLocation(location);
          setLocationModalVisible(false);
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

  pageContent: {
    paddingBottom:
      NAVIENTY_NOW_LAYOUT.bottomNavigationHeight +
      48,
  },

  header: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    minHeight: 214,
    overflow: 'hidden',
    paddingBottom: 48,
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
    width: '100%',
  },

  headerContent: {
    alignSelf: 'center',
    maxWidth:
      NAVIENTY_NOW_LAYOUT.contentMaxWidth -
      NAVIENTY_NOW_LAYOUT.pageGutter * 2,
    width: '100%',
    zIndex: 2,
  },

  locationButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    minHeight: 48,
    paddingHorizontal: 2,
    paddingVertical: 3,
  },

  headerControlPressed: {
    opacity: 0.72,
  },

  locationChevron: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 23,
    fontWeight: '700',
    lineHeight: 24,
    marginRight: 8,
    marginTop: 4,
  },

  locationCopy: {
    alignItems: 'flex-start',
    maxWidth: '88%',
  },

  locationLabel: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  locationValue: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 2,
    maxWidth: 330,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  searchPill: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderRadius: 28,
    flexDirection: 'row-reverse',
    marginTop: 13,
    minHeight: 58,
    paddingHorizontal: 19,
    width: '100%',
  },

  searchPillPressed: {
    backgroundColor: '#F4F4F5',
    transform: [{ scale: 0.995 }],
  },

  searchPlaceholder: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    marginRight: 13,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  searchIconCanvas: {
    height: 23,
    position: 'relative',
    width: 23,
  },

  searchIconCircle: {
    borderRadius: 8,
    borderWidth: 2,
    height: 15,
    left: 1,
    position: 'absolute',
    top: 1,
    width: 15,
  },

  searchIconHandle: {
    borderRadius: 2,
    height: 2,
    left: 14,
    position: 'absolute',
    top: 15,
    transform: [{ rotate: '45deg' }],
    width: 8,
  },

  // Scalloped wave: a clipped strip at the header's bottom edge
  // holding three big circles. Each circle is filled with the page
  // background color and pokes up into the header color, so the
  // gaps between the circle tops read as wave crests.
  headerWaveContainer: {
    bottom: 0,
    height: 46,
    left: 0,
    overflow: 'hidden',
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
    height: 190,
    left: -60,
    top: 8,
    width: 190,
  },

  waveCircleTwo: {
    height: 230,
    left: '50%',
    marginLeft: -115,
    top: -18,
    width: 230,
  },

  waveCircleThree: {
    height: 190,
    right: -60,
    top: 8,
    width: 190,
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
      NAVIENTY_NOW_COLORS.surface,
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

  loginCard: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius:
      NAVIENTY_NOW_LAYOUT.majorRadius,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 29,
    minHeight: 232,
    overflow: 'hidden',
    padding: 22,
  },

  loginArtworkWrap: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryUltraPale,
    borderRadius: 23,
    height: 108,
    justifyContent: 'center',
    marginRight: 18,
    transform: [{ rotate: '-5deg' }],
    width: 108,
  },

  loginLogo: {
    borderRadius: 18,
    height: 94,
    width: 94,
  },

  loginContent: {
    alignItems: 'flex-end',
    flex: 1,
  },

  loginTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 25,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  loginDescription: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 23,
    marginTop: 7,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  authWarningText: {
    color: NAVIENTY_NOW_COLORS.error,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 7,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  loginButton: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 17,
    justifyContent: 'center',
    marginTop: 17,
    minHeight: 49,
    paddingHorizontal: 22,
  },

  loginButtonText: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 14,
    fontWeight: '900',
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

  modalBackdrop: {
    backgroundColor: 'rgba(10,18,14,0.48)',
    flex: 1,
    justifyContent: 'flex-end',
  },

  locationModalCard: {
    alignSelf: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '78%',
    maxWidth:
      NAVIENTY_NOW_LAYOUT.contentMaxWidth,
    paddingBottom:
      Platform.OS === 'ios' ? 26 : 18,
    paddingHorizontal: 20,
    width: '100%',
  },

  modalHandle: {
    alignSelf: 'center',
    backgroundColor: '#D8D8DC',
    borderRadius: 3,
    height: 5,
    marginTop: 10,
    width: 44,
  },

  modalHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    marginTop: 15,
  },

  modalCloseButton: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.surface,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginRight: 12,
    width: 36,
  },

  modalCloseText: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 25,
    lineHeight: 27,
  },

  modalHeaderCopy: {
    alignItems: 'flex-end',
    flex: 1,
  },

  modalTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  modalDescription: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 5,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  locationOptions: {
    paddingBottom: 10,
    paddingTop: 15,
  },

  cityGroup: {
    marginBottom: 18,
  },

  cityName: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  noAreasText: {
    color: NAVIENTY_NOW_COLORS.textMuted,
    fontSize: 11,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  areaOption: {
    alignItems: 'center',
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 8,
    minHeight: 65,
    padding: 13,
  },

  areaOptionSelected: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryUltraPale,
    borderColor:
      NAVIENTY_NOW_COLORS.primary,
  },

  areaOptionPressed: {
    opacity: 0.7,
  },

  areaRadio: {
    alignItems: 'center',
    borderColor: '#B9B9BF',
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    marginRight: 12,
    width: 20,
  },

  areaRadioSelected: {
    borderColor:
      NAVIENTY_NOW_COLORS.primary,
  },

  areaRadioDot: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 5,
    height: 10,
    width: 10,
  },

  areaOptionCopy: {
    alignItems: 'flex-end',
    flex: 1,
  },

  areaOptionName: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  areaOptionMeta: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  loadingPageContent: {
    paddingBottom:
      NAVIENTY_NOW_LAYOUT.bottomNavigationHeight +
      35,
  },

  loadingHeader: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    minHeight: 214,
    overflow: 'hidden',
    paddingBottom: 48,
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
    paddingTop:
      Platform.OS === 'android'
        ? (NativeStatusBar.currentHeight ?? 0) +
          20
        : 36,
  },

  loadingHeaderInner: {
    alignSelf: 'center',
    maxWidth:
      NAVIENTY_NOW_LAYOUT.contentMaxWidth -
      NAVIENTY_NOW_LAYOUT.pageGutter * 2,
    width: '100%',
    zIndex: 2,
  },

  loadingLocationLine: {
    backgroundColor:
      'rgba(255,255,255,0.28)',
    borderRadius: 7,
    height: 21,
    width: 176,
  },

  loadingSearchPill: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderRadius: 28,
    height: 58,
    marginTop: 24,
    opacity: 0.96,
    width: '100%',
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

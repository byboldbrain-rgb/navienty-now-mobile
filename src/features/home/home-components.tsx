import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import {
    ActivityIndicator,
    Animated,
    Easing,
    Image,
    StatusBar as NativeStatusBar,
    Platform,
    Pressable,
    ScrollView,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';

import AppBottomNavigation from '../../category/app-bottom-navigation';
import { getCategoryIcon } from '../../config/category-icons';
import type { StoreSummary } from '../../services/catalog-service';
import { getHomeStoreArtwork } from '../../services/home-store-artwork-service';
import type { Order } from '../../store/orders-store';
import {
    NAVIENTY_NOW_COLORS,
    NAVIENTY_NOW_LAYOUT,
} from '../../theme/navienty-now-theme';
import {
    type ForYouRecommendation,
    type HomeCategory,
    type HomeDiscoveryItem,
    type RecentlyViewedItem,
    isEligibleForYouProduct,
} from './home-model';
import { getActiveOrderCategoryArtwork } from './home-order-components';
import { styles } from './home-screen.styles';

const navientyDeliveryBike = require('../../assets/images/navienty-now-delivery-bike-transparent.png');
const navienty24hMoodBackground = require('../../assets/images/navienty-now-24h-mood-background.png');

const HOME_SEARCH_PLACEHOLDER_ROTATION_MS = 1800;

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
    canShowRemoteImage;

  const imageSource =
    shouldShowRemoteImage
      ? { uri: remoteImageUrl }
      : category.localArtwork ??
        (category.configuredArtworkSlug
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

export function HomeHeader() {
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

export function CategoryStrip({
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

export function HomeGlobalSearchEntry({
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
        const artwork =
          await getHomeStoreArtwork(
            item.storeId,
          );

        if (cancelled) {
          return;
        }

        setResolvedArtwork({
          logoUrl:
            artwork.logoUrl ||
            initialLogoUrl,
          coverImageUrl:
            artwork.coverImageUrl ||
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

export function RecentlyViewedRail({
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

export function ForYouRail({
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

export function HomeDiscoveryRail({
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

type HomeOrderArtworkState = {
  logoUrl: string;
  coverImageUrl: string;
  categorySlug: string;
};

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
    useState<HomeOrderArtworkState>({
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
        const artwork =
          await getHomeStoreArtwork(
            order.storeId,
          );

        if (cancelled) {
          return;
        }

        setResolvedArtwork({
          logoUrl:
            artwork.logoUrl ||
            initialLogoUrl,
          coverImageUrl:
            artwork.coverImageUrl ||
            initialCoverImageUrl,
          categorySlug:
            artwork.categorySlug ||
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

export function RecentOrdersRail({
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

export function HomeLoadingSkeleton() {
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

export function HomeFatalError({
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

import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import {
    Fragment,
    useEffect,
    useRef,
    useState,
} from 'react';
import {
    Animated,
    Easing,
    Image,
    type ImageSourcePropType,
    Pressable,
    Text,
    View,
} from 'react-native';

import { getCategoryIcon } from '../../config/category-icons';
import type { StoreSummary } from '../../services/catalog-service';
import { getHomeStoreArtwork } from '../../services/home-store-artwork-service';
import {
    type Order,
    type OrderStatus,
} from '../../store/orders-store';
import { NAVIENTY_NOW_COLORS } from '../../theme/navienty-now-theme';
import { styles } from './home-screen.styles';

const personalCareCategoryIcon = require('../../assets/icons/categories/personal-care.webp');
const laundryCategoryIcon = require('../../assets/icons/categories/laundry.webp');
const requestAnythingCategoryIcon = require('../../assets/icons/categories/request-anything.webp');

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

function normalizeActiveOrderCategorySlug(
  value: string | null | undefined,
) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');
}

export function getActiveOrderCategoryArtwork(
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
         * Resolve through the Home artwork service instead of issuing an RPC
         * from the component. The service preserves the direct RPC behavior
         * required for internal/service categories and deduplicates concurrent
         * requests for the same store.
         */
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
        <ExpoImage
          cachePolicy="memory-disk"
          accessibilityIgnoresInvertColors
          accessibilityLabel={
            `صورة ${order.storeName}`
          }
          contentFit={
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
        transition={0}
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

export function ActiveOrderTrackingCard({
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

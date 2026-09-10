import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import {
  Fragment,
  useEffect,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  Image,
  type ImageSourcePropType,
  Pressable,
  StyleSheet,
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
import {
  NAVIENTY_NOW_COLORS,
} from '../../theme/navienty-now-theme';

const personalCareCategoryIcon =
  require('../../assets/icons/categories/personal-care.webp');

const laundryCategoryIcon =
  require('../../assets/icons/categories/laundry.webp');

const requestAnythingCategoryIcon =
  require('../../assets/icons/categories/request-anything.webp');

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
    normalizedSlug === 'laundry' ||
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
    useState<ActiveOrderStoreArtworkState>(
      {
        logoUrl: initialLogoUrl,
        coverImageUrl:
          initialCoverImageUrl,
        categorySlug:
          initialCategorySlug,
      },
    );

  const [
    imageFailed,
    setImageFailed,
  ] = useState(false);

  const [
    isResolvingArtwork,
    setIsResolvingArtwork,
  ] = useState(
    !initialLogoUrl &&
      !initialCoverImageUrl &&
      !initialCategorySlug,
  );

  const orderItemImageUrl =
    order.items
      .map(
        (item) =>
          item.imageUrl?.trim() ?? '',
      )
      .find(
        (imageUrl) =>
          imageUrl.length > 0,
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

    async function resolveStoreArtworkDirectly() {
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

        if (__DEV__) {
          console.warn(
            'Unable to resolve active-order store artwork directly.',
            order.storeId,
            error,
          );
        }
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
    logoUrl || coverImageUrl;

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
        trackingStyles.storeArtwork
      }
    >
      {canShowRemoteImage ? (
        <ExpoImage
          accessibilityIgnoresInvertColors
          accessibilityLabel={
            `صورة ${order.storeName}`
          }
          cachePolicy="memory-disk"
          contentFit={
            logoUrl
              ? 'contain'
              : 'cover'
          }
          source={{
            uri: remoteImageUrl,
          }}
          style={
            trackingStyles.storeImage
          }
          transition={0}
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
            trackingStyles.storeImage
          }
        />
      ) : isResolvingArtwork ? (
        <View
          style={
            trackingStyles.storeImageLoading
          }
        />
      ) : (
        <Text
          style={
            trackingStyles.storeFallback
          }
        >
          {order.storeIcon || '🏪'}
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
    ] ??
    HOME_ORDER_TRACKING_STEPS[0];

  const [cardEntrance] =
    useState(
      () =>
        new Animated.Value(0),
    );

  const [activePulse] =
    useState(
      () =>
        new Animated.Value(0),
    );

  const [routePulse] =
    useState(
      () =>
        new Animated.Value(0),
    );

  useEffect(() => {
    cardEntrance.setValue(0);

    const animation =
      Animated.timing(
        cardEntrance,
        {
          toValue: 1,
          duration: 360,
          easing:
            Easing.out(
              Easing.cubic,
            ),
          useNativeDriver: true,
          isInteraction: false,
        },
      );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [cardEntrance]);

  useEffect(() => {
    activePulse.setValue(0);
    routePulse.setValue(0);

    const activeAnimation =
      Animated.loop(
        Animated.sequence([
          Animated.timing(
            activePulse,
            {
              toValue: 1,
              duration: 800,
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
              duration: 800,
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

    const routeAnimation =
      Animated.loop(
        Animated.sequence([
          Animated.timing(
            routePulse,
            {
              toValue: 1,
              duration: 900,
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
              duration: 900,
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

    activeAnimation.start();
    routeAnimation.start();

    return () => {
      activeAnimation.stop();
      routeAnimation.stop();
    };
  }, [
    activePulse,
    currentStage,
    routePulse,
  ]);

  const translateY =
    cardEntrance.interpolate({
      inputRange: [0, 1],
      outputRange: [6, 0],
    });

  const activeScale =
    activePulse.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.06],
    });

  const activeHaloOpacity =
    activePulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.03, 0.1],
    });

  const routePulseOpacity =
    routePulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.5, 1],
    });

  return (
    <Animated.View
      style={[
        trackingStyles.cardShell,
        {
          width: cardWidth,

          opacity:
            cardEntrance,

          transform: [
            {
              translateY,
            },
          ],
        },
      ]}
    >
      <Pressable
        accessibilityLabel={
          `${currentStep.title}. متابعة الطلب الحالي من ${order.storeName}`
        }
        accessibilityRole="button"
        style={({ pressed }) => [
          trackingStyles.card,

          pressed &&
            trackingStyles.cardPressed,
        ]}
        onPress={onPress}
      >
        {/*
         * Logo + tracking progress
         * now sit together on the
         * exact same horizontal row.
         */}
        <View
          style={
            trackingStyles.mainRow
          }
        >
          <ActiveOrderStoreArtwork
            order={order}
            store={store}
          />

          <View
            style={
              trackingStyles.progressContainer
            }
          >
            <View
              style={
                trackingStyles.flowRow
              }
            >
              {HOME_ORDER_TRACKING_STEPS.map(
                (step, index) => {
                  const completed =
                    currentStage >
                    index;

                  const active =
                    currentStage ===
                    index;

                  const reached =
                    currentStage >=
                    index;

                  const isConfirmation =
                    step.key ===
                    'confirmation';

                  const iconSize =
                    step.key ===
                    'preparing'
                      ? 25
                      : step.key ===
                          'delivery'
                        ? 24
                        : step.key ===
                            'delivered'
                          ? 25
                          : 18;

                  const iconColor =
                    isConfirmation
                      ? reached
                        ? NAVIENTY_NOW_COLORS.white
                        : '#D2D6D4'
                      : reached
                        ? NAVIENTY_NOW_COLORS.primary
                        : '#D4D8D6';

                  return (
                    <Fragment
                      key={step.key}
                    >
                      <View
                        style={
                          trackingStyles.flowStep
                        }
                      >
                        <Animated.View
                          style={[
                            trackingStyles.iconWrap,

                            isConfirmation &&
                              trackingStyles.confirmationCircle,

                            isConfirmation &&
                              reached &&
                              trackingStyles.confirmationCircleReached,

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
                                trackingStyles.activeHalo,

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
                            name={
                              step.icon
                            }
                            size={
                              iconSize
                            }
                          />
                        </Animated.View>
                      </View>

                      {index <
                      HOME_ORDER_TRACKING_STEPS.length -
                        1 ? (
                        <View
                          style={
                            trackingStyles.connector
                          }
                        >
                          {completed ? (
                            <View
                              style={
                                trackingStyles.connectorCompleted
                              }
                            />
                          ) : active ? (
                            <Animated.View
                              style={[
                                trackingStyles.connectorCurrent,

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
          </View>
        </View>

        <Text
          style={
            trackingStyles.statusText
          }
        >
          {currentStep.title}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const trackingStyles =
  StyleSheet.create({
    cardShell: {
      flexShrink: 0,
    },

    card: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.white,

      borderColor: '#E1E5E3',

      borderRadius: 22,

      borderWidth: 1,

      minHeight: 112,

      paddingHorizontal: 14,

      paddingVertical: 13,

      shadowColor: '#000000',

      shadowOffset: {
        width: 0,
        height: 1,
      },

      shadowOpacity: 0.02,

      shadowRadius: 3,

      elevation: 0,
    },

    cardPressed: {
      opacity: 0.95,

      transform: [
        {
          scale: 0.995,
        },
      ],
    },

    /*
     * The important change:
     * logo + progress line are
     * in one compact row.
     */
    mainRow: {
      alignItems: 'center',

      flexDirection: 'row-reverse',

      gap: 10,

      width: '100%',
    },

    storeArtwork: {
      alignItems: 'center',

      backgroundColor:
        NAVIENTY_NOW_COLORS.white,

      borderColor: '#ECEEED',

      borderRadius: 14,

      borderWidth: 1,

      flexShrink: 0,

      height: 48,

      justifyContent: 'center',

      overflow: 'hidden',

      width: 48,
    },

    storeImage: {
      height: '100%',

      width: '100%',
    },

    storeImageLoading: {
      backgroundColor: '#F2F4F3',

      height: '100%',

      width: '100%',
    },

    storeFallback: {
      fontSize: 22,
    },

    progressContainer: {
      flex: 1,

      justifyContent: 'center',

      minWidth: 0,
    },

    flowRow: {
      alignItems: 'center',

      flexDirection: 'row-reverse',

      height: 36,

      width: '100%',
    },

    flowStep: {
      alignItems: 'center',

      height: 34,

      justifyContent: 'center',

      width: 31,
    },

    iconWrap: {
      alignItems: 'center',

      height: 30,

      justifyContent: 'center',

      position: 'relative',

      width: 30,

      zIndex: 2,
    },

    confirmationCircle: {
      backgroundColor:
        '#EFF2F0',

      borderRadius: 15,
    },

    confirmationCircleReached: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.primary,
    },

    activeHalo: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.primary,

      borderRadius: 19,

      bottom: -4,

      left: -4,

      position: 'absolute',

      right: -4,

      top: -4,
    },

    connector: {
      backgroundColor:
        '#E4E7E5',

      borderRadius: 999,

      flex: 1,

      height: 4,

      marginHorizontal: 3,

      minWidth: 12,

      overflow: 'hidden',

      position: 'relative',
    },

    connectorCompleted: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.primary,

      bottom: 0,

      left: 0,

      position: 'absolute',

      right: 0,

      top: 0,
    },

    connectorCurrent: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.primary,

      borderRadius: 999,

      bottom: 0,

      position: 'absolute',

      right: 0,

      top: 0,

      width: '20%',
    },

    /*
     * Very small separation from
     * progress line — removes the
     * large empty area.
     */
    statusText: {
      color:
        NAVIENTY_NOW_COLORS.text,

      fontSize: 16,

      fontWeight: '900',

      lineHeight: 22,

      marginTop: 7,

      textAlign: 'center',

      width: '100%',

      writingDirection: 'rtl',
    },
  });
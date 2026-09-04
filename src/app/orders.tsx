import { Ionicons } from '@expo/vector-icons';
import {
  useFocusEffect,
  useRouter,
} from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';

import AppBottomNavigation from '../category/app-bottom-navigation';
import { useAuthSession } from '../hooks/use-auth-session';
import {
  listStores,
} from '../services/catalog-service';
import {
  getMyOrders,
} from '../services/order-service';
import {
  getOrderRating,
  submitOrderRating,
  type OrderRating,
} from '../services/rating-service';
import {
  useOrdersStore,
  type Order,
  type OrderStatus,
} from '../store/orders-store';
import {
  NAVIENTY_NOW_LAYOUT,
} from '../theme/navienty-now-theme';

type StatusPresentation = {
  title: string;
  backgroundColor: string;
  textColor: string;
};

type ExtendedOrder = Order & {
  storeImageUrl?: string | null;
  storeLogoUrl?: string | null;
  storeImage?: string | null;
  storeLogo?: string | null;
  imageUrl?: string | null;
  logoUrl?: string | null;
  storeAvatarUrl?: string | null;
  coverImageUrl?: string | null;
};

type StoreImageMap = Record<
  string,
  string | null
>;

const BRAND_GREEN = '#00B85C';
const BRAND_GREEN_SOFT = '#EAFBF2';

/*
 * Local artwork for service-style stores that do not have
 * a normal Store record/logo coming from listStores().
 *
 * These are the same official category assets used on Home,
 * so Orders never falls back to the empty image placeholder
 * for these three services.
 */
const personalCareStoreImage = require('../assets/icons/categories/personal-care.webp');
const laundryStoreImage = require('../assets/icons/categories/laundry.webp');
const requestAnythingStoreImage = require('../assets/icons/categories/request-anything.webp');

const statusPresentation: Record<
  OrderStatus,
  StatusPresentation
> = {
  'awaiting-whatsapp-send': {
    title: 'في انتظار الإرسال',
    backgroundColor: '#FFF4D9',
    textColor: '#7A5A13',
  },

  'waiting-confirmation': {
    title: 'في انتظار التأكيد',
    backgroundColor: '#F1EFFF',
    textColor: '#5643B8',
  },

  confirmed: {
    title: 'تم التأكيد',
    backgroundColor: '#EAF7EF',
    textColor: '#286446',
  },

  preparing: {
    title: 'جاري التجهيز',
    backgroundColor: '#FFF4D9',
    textColor: '#7A5A13',
  },

  'out-for-delivery': {
    title: 'في الطريق إليك',
    backgroundColor: '#EDF6FF',
    textColor: '#2C6696',
  },

  delivered: {
    title: 'تم الاستلام',
    backgroundColor: '#F2F2F2',
    textColor: '#626262',
  },

  cancelled: {
    title: 'تم الإلغاء',
    backgroundColor: '#FDEEEE',
    textColor: '#963D3D',
  },
};

const arabicMonthNames = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

function formatOrderDate(
  isoDate: string,
): string {
  const date =
    new Date(isoDate);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'تاريخ غير متاح';
  }

  const day =
    date.getDate();

  const month =
    arabicMonthNames[
      date.getMonth()
    ];

  let hours =
    date.getHours();

  const minutes =
    String(
      date.getMinutes(),
    ).padStart(
      2,
      '0',
    );

  const period =
    hours >= 12
      ? 'م'
      : 'ص';

  hours %= 12;

  if (
    hours === 0
  ) {
    hours = 12;
  }

  return `${day} ${month} • ${hours}:${minutes} ${period}`;
}

function formatMoney(
  value: number | string,
  currencySymbol: string,
): string {
  const numericValue =
    typeof value === 'number'
      ? value
      : Number(value);

  if (
    Number.isFinite(
      numericValue,
    )
  ) {
    return `${numericValue.toLocaleString(
      'en-US',
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      },
    )} ${currencySymbol}`;
  }

  return `${value} ${currencySymbol}`;
}

function getItemCountText(
  itemCount: number,
): string {
  if (
    itemCount === 1
  ) {
    return '1 منتج';
  }

  return `${itemCount} منتجات`;
}

function isImageUrl(
  value?: string | null,
): value is string {
  if (!value) {
    return false;
  }

  return (
    value.startsWith(
      'https://',
    ) ||
    value.startsWith(
      'http://',
    )
  );
}

function getStoreId(
  order: Order,
): string | null {
  return (
    order.storeId ??
    null
  );
}

function normalizeStoreName(
  value: string,
): string {
  return value
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');
}

function getLocalStoreImageSource(
  storeName: string,
): ImageSourcePropType | null {
  const normalizedName =
    normalizeStoreName(storeName);

  if (
    normalizedName === 'العنايه' ||
    normalizedName === 'العنايه الشخصيه'
  ) {
    return personalCareStoreImage;
  }

  if (
    normalizedName === 'الغسيل والكي' ||
    normalizedName === 'الغسيل والمكواه' ||
    normalizedName === 'غسيل وكي'
  ) {
    return laundryStoreImage;
  }

  if (
    normalizedName === 'اطلب اي حاجه' ||
    normalizedName === 'اي حاجه'
  ) {
    return requestAnythingStoreImage;
  }

  return null;
}

function getOrderEmbeddedImageUrl(
  order: Order,
): string | null {
  const extendedOrder =
    order as ExtendedOrder;

  const candidates = [
    extendedOrder.storeImageUrl,
    extendedOrder.storeLogoUrl,
    extendedOrder.storeImage,
    extendedOrder.storeLogo,
    extendedOrder.storeAvatarUrl,
    extendedOrder.logoUrl,
    extendedOrder.imageUrl,
    extendedOrder.coverImageUrl,
    order.storeIcon,
  ];

  for (
    const candidate
    of candidates
  ) {
    if (
      isImageUrl(
        candidate,
      )
    ) {
      return candidate;
    }
  }

  return null;
}

/*
 * شاشة تحميل جديدة بدل الـSkeleton القديم.
 *
 * التصميم Minimal ومبني على:
 * - خلفية بيضاء
 * - أخضر Navienty Now
 * - عنصر مركزي بسيط
 * - بدون Cards وهمية أو ازدحام بصري
 */
function OrdersLoadingSplash() {
  return (
    <View
      style={
        styles.loadingScreen
      }
    >
      <View
        pointerEvents="none"
        style={
          styles.loadingGlowTop
        }
      />

      <View
        pointerEvents="none"
        style={
          styles.loadingGlowBottom
        }
      />

      <View
        style={
          styles.loadingContent
        }
      >
        <View
          style={
            styles.loadingMarkOuter
          }
        >
          <View
            style={
              styles.loadingMarkMiddle
            }
          >
            <View
              style={
                styles.loadingMarkInner
              }
            >
              <Ionicons
                name="receipt-outline"
                size={29}
                color={BRAND_GREEN}
              />
            </View>
          </View>
        </View>

        <Text
          style={
            styles.loadingTitle
          }
        >
          طلباتك
        </Text>

        <Text
          style={
            styles.loadingDescription
          }
        >
          بنجهز آخر تحديث لطلباتك
        </Text>

        <View
          style={
            styles.loadingIndicatorContainer
          }
        >
          <ActivityIndicator
            size="small"
            color={BRAND_GREEN}
          />
        </View>
      </View>
    </View>
  );
}

function StoreImage({
  order,
  storeImageUrl,
}: {
  order: Order;
  storeImageUrl?: string | null;
}) {
  const localStoreImage =
    getLocalStoreImageSource(
      order.storeName,
    );

  const embeddedImageUrl =
    getOrderEmbeddedImageUrl(
      order,
    );

  const imageUrl =
    storeImageUrl ??
    embeddedImageUrl;

  const [
    hasImageError,
    setHasImageError,
  ] = useState(false);

  useEffect(() => {
    setHasImageError(
      false,
    );
  }, [
    imageUrl,
    order.storeName,
  ]);

  const shouldShowRemoteImage =
    Boolean(imageUrl) &&
    !hasImageError;

  return (
    <View
      style={
        styles.storeImageContainer
      }
    >
      {localStoreImage ? (
        <Image
          source={
            localStoreImage
          }
          resizeMode="contain"
          style={
            styles.storeImage
          }
        />
      ) : shouldShowRemoteImage ? (
        <Image
          source={{
            uri: imageUrl!,
          }}
          resizeMode="cover"
          style={
            styles.storeImage
          }
          onError={() => {
            setHasImageError(
              true,
            );
          }}
        />
      ) : (
        <View
          style={
            styles.storeImagePlaceholder
          }
        >
          <Ionicons
            name="image-outline"
            size={21}
            color="#B7B7B7"
          />
        </View>
      )}
    </View>
  );
}

function OrderRatingFooter({
  order,
}: {
  order: Order;
}) {
  const [
    orderRating,
    setOrderRating,
  ] = useState<OrderRating>({
    rated: false,
    rating: null,
    createdAt: null,
  });

  const [
    selectedRating,
    setSelectedRating,
  ] = useState<number | null>(
    null,
  );

  const [
    isLoadingRating,
    setIsLoadingRating,
  ] = useState(true);

  const [
    isSubmittingRating,
    setIsSubmittingRating,
  ] = useState(false);

  const [
    ratingError,
    setRatingError,
  ] = useState<string | null>(
    null,
  );

  const loadRating =
    useCallback(async () => {
      try {
        setIsLoadingRating(
          true,
        );

        setRatingError(
          null,
        );

        const result =
          await getOrderRating(
            order.id,
          );

        setOrderRating(
          result,
        );

        setSelectedRating(
          result.rating,
        );
      } catch (
        error
      ) {
        setRatingError(
          error instanceof Error
            ? error.message
            : 'تعذر تحميل التقييم.',
        );
      } finally {
        setIsLoadingRating(
          false,
        );
      }
    }, [
      order.id,
    ]);

  useEffect(() => {
    void loadRating();
  }, [
    loadRating,
  ]);

  async function handleRating(
    rating: number,
  ) {
    if (
      orderRating.rated ||
      isSubmittingRating ||
      isLoadingRating
    ) {
      return;
    }

    setSelectedRating(
      rating,
    );

    setRatingError(
      null,
    );

    try {
      setIsSubmittingRating(
        true,
      );

      const result =
        await submitOrderRating(
          order.id,
          rating,
        );

      setOrderRating({
        rated: true,
        rating:
          result.rating,
        createdAt:
          result.createdAt,
      });

      setSelectedRating(
        result.rating,
      );
    } catch (
      error
    ) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر إرسال التقييم.';

      setRatingError(
        message,
      );

      if (
        message.includes(
          'تم تقييم هذا الطلب بالفعل',
        )
      ) {
        await loadRating();
      }
    } finally {
      setIsSubmittingRating(
        false,
      );
    }
  }

  const activeRating =
    orderRating.rating ??
    selectedRating ??
    0;

  return (
    <View
      style={
        styles.ratingFooter
      }
    >
      <View
        style={
          styles.ratingLabelContainer
        }
      >
        {isLoadingRating ? (
          <ActivityIndicator
            size="small"
            color={BRAND_GREEN}
          />
        ) : (
          <>
            <Text
              style={
                styles.ratingLabel
              }
            >
              {orderRating.rated
                ? 'تم التقييم'
                : 'قيّم'}
            </Text>

            {ratingError && (
              <Text
                numberOfLines={1}
                style={
                  styles.ratingErrorText
                }
              >
                {
                  ratingError
                }
              </Text>
            )}
          </>
        )}
      </View>

      <View
        accessibilityRole="radiogroup"
        style={
          styles.ratingStars
        }
      >
        {[1, 2, 3, 4, 5].map(
          (
            star,
          ) => {
            const isFilled =
              star <=
              activeRating;

            return (
              <Pressable
                key={
                  star
                }
                accessibilityRole="radio"
                accessibilityLabel={`${star} نجوم`}
                accessibilityState={{
                  checked:
                    activeRating ===
                    star,

                  disabled:
                    orderRating.rated ||
                    isSubmittingRating ||
                    isLoadingRating,
                }}
                disabled={
                  orderRating.rated ||
                  isSubmittingRating ||
                  isLoadingRating
                }
                hitSlop={5}
                style={({
                  pressed,
                }) => [
                  styles.ratingStarButton,

                  star > 1 &&
                    styles.ratingStarSpacing,

                  pressed &&
                    !orderRating.rated &&
                    styles.ratingStarButtonPressed,
                ]}
                onPress={() => {
                  void handleRating(
                    star,
                  );
                }}
              >
                {isSubmittingRating &&
                selectedRating ===
                  star ? (
                  <ActivityIndicator
                    size="small"
                    color="#F4AF00"
                  />
                ) : (
                  <Ionicons
                    name={
                      isFilled
                        ? 'star'
                        : 'star-outline'
                    }
                    size={25}
                    color={
                      isFilled
                        ? '#F4AF00'
                        : '#C7C7C7'
                    }
                  />
                )}
              </Pressable>
            );
          },
        )}
      </View>
    </View>
  );
}

function OrderCard({
  order,
  storeImageUrl,
  onPress,
  onReorder,
}: {
  order: Order;
  storeImageUrl?: string | null;
  onPress: () => void;
  onReorder?: () => void;
}) {
  const status =
    statusPresentation[
      order.status
    ];

  const canRate =
    order.status ===
    'delivered';

  const canReorder =
    order.status ===
      'delivered' &&
    Boolean(
      onReorder,
    );

  return (
    <View
      style={
        styles.orderCard
      }
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`فتح تفاصيل الطلب ${order.orderCode}`}
        style={({
          pressed,
        }) => [
          styles.orderCardMain,

          pressed &&
            styles.orderCardPressed,
        ]}
        onPress={
          onPress
        }
      >
        <View
          style={
            styles.orderHeader
          }
        >
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  status.backgroundColor,
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color:
                    status.textColor,
                },
              ]}
            >
              {
                status.title
              }
            </Text>
          </View>

          <Text
            numberOfLines={1}
            style={
              styles.orderDate
            }
          >
            {formatOrderDate(
              order.submittedAt ??
                order.createdAt,
            )}
          </Text>
        </View>

        <View
          style={
            styles.cardDivider
          }
        />

        <View
          style={
            styles.orderBody
          }
        >
          <View
            style={
              styles.storeRow
            }
          >
            <StoreImage
              order={
                order
              }
              storeImageUrl={
                storeImageUrl
              }
            />

            <View
              style={
                styles.storeInformation
              }
            >
              <Text
                numberOfLines={1}
                style={
                  styles.storeName
                }
              >
                {
                  order.storeName
                }
              </Text>

              <Text
                numberOfLines={1}
                style={
                  styles.orderCodeText
                }
              >
                رمز الطلب:{' '}
                {
                  order.orderCode
                }
              </Text>
            </View>

            <View
              style={
                styles.itemCountContainer
              }
            >
              <Ionicons
                name="chevron-down"
                size={19}
                color="#272727"
              />

              <Text
                numberOfLines={1}
                style={
                  styles.itemCountText
                }
              >
                {getItemCountText(
                  order.itemCount,
                )}
              </Text>
            </View>
          </View>

          <View
            style={
              styles.orderBottomRow
            }
          >
            <Text
              style={
                styles.orderTotal
              }
            >
              {formatMoney(
                order.total,
                order.currencySymbol,
              )}
            </Text>

            {canReorder ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="اطلب مجددًا"
                hitSlop={8}
                style={({
                  pressed,
                }) => [
                  styles.reorderButton,

                  pressed &&
                    styles.reorderButtonPressed,
                ]}
                onPress={(
                  event,
                ) => {
                  event.stopPropagation();

                  onReorder?.();
                }}
              >
                <Text
                  style={
                    styles.reorderButtonText
                  }
                >
                  اطلب مجددًا
                </Text>
              </Pressable>
            ) : (
              <View
                style={
                  styles.reorderButtonSpace
                }
              />
            )}
          </View>
        </View>
      </Pressable>

      {canRate && (
        <OrderRatingFooter
          order={
            order
          }
        />
      )}
    </View>
  );
}

export default function OrdersScreen() {
  const router =
    useRouter();

  const authState =
    useAuthSession();

  const orders =
    useOrdersStore(
      (state) =>
        state.orders,
    );

  const pendingOrder =
    useOrdersStore(
      (state) =>
        state.pendingOrder,
    );

  const hasHydrated =
    useOrdersStore(
      (state) =>
        state.hasHydrated,
    );

  const [
    isRefreshing,
    setIsRefreshing,
  ] =
    useState(false);

  const [
    hasCompletedInitialSync,
    setHasCompletedInitialSync,
  ] =
    useState(false);

  const [
    refreshMessage,
    setRefreshMessage,
  ] =
    useState<
      string | null
    >(null);

  /*
   * صور المتاجر يتم جلبها
   * من catalog-service
   * ثم ربطها بالـ storeId.
   */
  const [
    storeImages,
    setStoreImages,
  ] =
    useState<StoreImageMap>(
      {},
    );

  const currentUserId =
    authState.status ===
      'anonymous' ||
    authState.status ===
      'signedIn'
      ? authState.session
          .user.id
      : null;

  useEffect(() => {
    if (
      !hasHydrated ||
      !currentUserId
    ) {
      return;
    }

    useOrdersStore
      .getState()
      .prepareForUser(
        currentUserId,
      );

    setHasCompletedInitialSync(
      false,
    );
  }, [
    currentUserId,
    hasHydrated,
  ]);

  useEffect(() => {
    if (
      authState.status ===
      'error'
    ) {
      setHasCompletedInitialSync(
        true,
      );
    }
  }, [
    authState.status,
  ]);

  const refreshOrders =
    useCallback(
      async () => {
        if (
          !hasHydrated
        ) {
          return;
        }

        if (
          !currentUserId
        ) {
          if (
            authState.status ===
            'error'
          ) {
            setRefreshMessage(
              authState.errorMessage ??
                'تعذر تحديد حساب الجهاز.',
            );
          }

          setHasCompletedInitialSync(
            true,
          );

          return;
        }

        const store =
          useOrdersStore
            .getState();

        store.prepareForUser(
          currentUserId,
        );

        try {
          setIsRefreshing(
            true,
          );

          setRefreshMessage(
            null,
          );

          const serverOrders =
            await getMyOrders();

          useOrdersStore
            .getState()
            .replaceOrdersFromServer(
              currentUserId,
              serverOrders,
            );
        } catch (
          error
        ) {
          const message =
            error instanceof
            Error
              ? error.message
              : 'تعذر تحميل سجل الطلبات من Supabase.';

          setRefreshMessage(
            `${message} يتم عرض آخر نسخة محفوظة على الجهاز إن وجدت.`,
          );
        } finally {
          setIsRefreshing(
            false,
          );

          setHasCompletedInitialSync(
            true,
          );
        }
      },
      [
        authState.errorMessage,
        authState.status,
        currentUserId,
        hasHydrated,
      ],
    );

  /*
   * Order لا يحتوي حاليًا على logoUrl،
   * لذلك نجلب المتاجر من listStores
   * ونكوّن Map:
   *
   * storeId -> logoUrl / coverImageUrl
   */
  const loadStoreImages =
    useCallback(
      async () => {
        try {
          const stores =
            await listStores();

          const nextStoreImages:
            StoreImageMap =
              {};

          for (
            const store
            of stores
          ) {
            const imageUrl =
              store.logoUrl ??
              store.coverImageUrl ??
              null;

            nextStoreImages[
              store.id
            ] = imageUrl;
          }

          setStoreImages(
            nextStoreImages,
          );
        } catch (
          error
        ) {
          console.warn(
            'Failed to load store images for orders:',
            error,
          );
        }
      },
      [],
    );

  useFocusEffect(
    useCallback(() => {
      if (
        !hasHydrated ||
        !currentUserId
      ) {
        return;
      }

      void Promise.all([
        refreshOrders(),
        loadStoreImages(),
      ]);
    }, [
      currentUserId,
      hasHydrated,
      loadStoreImages,
      refreshOrders,
    ]),
  );

  const sortedOrders =
    useMemo(
      () =>
        [...orders].sort(
          (
            firstOrder,
            secondOrder,
          ) =>
            new Date(
              secondOrder.createdAt,
            ).getTime() -
            new Date(
              firstOrder.createdAt,
            ).getTime(),
        ),
      [
        orders,
      ],
    );

  function returnToHome() {
    router.replace(
      '/',
    );
  }

  function continuePendingOrder() {
    router.push(
      '/order-confirmation',
    );
  }

  function openOrderDetails(
    orderId: string,
  ) {
    router.push({
      pathname:
        '/order/[id]',

      params: {
        id: orderId,
      },
    });
  }

  function reorder(
    order: Order,
  ) {
    const storeId =
      getStoreId(
        order,
      );

    if (
      !storeId
    ) {
      openOrderDetails(
        order.id,
      );

      return;
    }

    router.push({
      pathname:
        '/store/[id]',

      params: {
        id: storeId,
      },
    });
  }

  const shouldShowInitialSplash =
    !hasHydrated ||
    authState.status ===
      'loading' ||
    (
      !hasCompletedInitialSync &&
      sortedOrders.length ===
        0 &&
      !pendingOrder
    );

  /*
   * تم استبدال OrdersScreenSkeleton
   * بالـSplash الجديد.
   */
  if (
    shouldShowInitialSplash
  ) {
    return (
      <OrdersLoadingSplash />
    );
  }

  return (
    <View
      style={
        styles.screen
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.pageContent
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={
            styles.container
          }
        >
          <View
            style={
              styles.header
            }
          >
            <View
              style={
                styles.headerTitleRow
              }
            >
              <Text
                style={
                  styles.pageTitle
                }
              >
                طلباتك
              </Text>

              {isRefreshing && (
                <ActivityIndicator
                  size="small"
                  color="#777777"
                  style={
                    styles.refreshIndicator
                  }
                />
              )}
            </View>
          </View>

          {refreshMessage && (
            <View
              style={
                styles.warningCard
              }
            >
              <Ionicons
                name="warning-outline"
                size={17}
                color="#89681C"
              />

              <Text
                style={
                  styles.warningText
                }
              >
                {
                  refreshMessage
                }
              </Text>
            </View>
          )}

          {pendingOrder && (
            <View
              style={
                styles.pendingCard
              }
            >
              <View
                style={
                  styles.pendingHeader
                }
              >
                <View
                  style={
                    styles.pendingStatusBadge
                  }
                >
                  <Text
                    style={
                      styles.pendingStatusText
                    }
                  >
                    في انتظار الإرسال
                  </Text>
                </View>

                <Text
                  style={
                    styles.pendingDateLabel
                  }
                >
                  طلب غير مكتمل
                </Text>
              </View>

              <View
                style={
                  styles.cardDivider
                }
              />

              <View
                style={
                  styles.pendingContent
                }
              >
                <View
                  style={
                    styles.pendingTitleRow
                  }
                >
                  <View
                    style={
                      styles.pendingLogo
                    }
                  >
                    <Ionicons
                      name="logo-whatsapp"
                      size={23}
                      color="#4B4B4B"
                    />
                  </View>

                  <View
                    style={
                      styles.pendingInfo
                    }
                  >
                    <Text
                      style={
                        styles.pendingTitle
                      }
                    >
                      يوجد طلب قيد الإرسال
                    </Text>

                    <Text
                      numberOfLines={2}
                      style={
                        styles.pendingDescription
                      }
                    >
                      أكد إرسال رسالة الطلب على واتساب لاستكمال الطلب.
                    </Text>

                    <Text
                      style={
                        styles.pendingOrderCode
                      }
                    >
                      رمز الطلب:{' '}
                      {
                        pendingOrder.orderCode
                      }
                    </Text>
                  </View>
                </View>

                <Pressable
                  accessibilityRole="button"
                  style={({
                    pressed,
                  }) => [
                    styles.pendingButton,

                    pressed &&
                      styles.buttonPressed,
                  ]}
                  onPress={
                    continuePendingOrder
                  }
                >
                  <Text
                    style={
                      styles.pendingButtonText
                    }
                  >
                    استكمال الطلب
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {sortedOrders.length ===
          0 ? (
            <View
              style={
                styles.emptyState
              }
            >
              <View
                style={
                  styles.emptyIconContainer
                }
              >
                <Ionicons
                  name="receipt-outline"
                  size={30}
                  color="#555555"
                />
              </View>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                لا توجد طلبات حتى الآن
              </Text>

              <Text
                style={
                  styles.emptyDescription
                }
              >
                ستظهر جميع طلباتك هنا بعد إنشاء أول طلب.
              </Text>

              <Pressable
                accessibilityRole="button"
                style={({
                  pressed,
                }) => [
                  styles.shopButton,

                  pressed &&
                    styles.buttonPressed,
                ]}
                onPress={
                  returnToHome
                }
              >
                <Text
                  style={
                    styles.shopButtonText
                  }
                >
                  ابدأ التسوق
                </Text>
              </Pressable>
            </View>
          ) : (
            <View
              style={
                styles.ordersList
              }
            >
              {sortedOrders.map(
                (
                  order,
                ) => {
                  const storeId =
                    getStoreId(
                      order,
                    );

                  const storeImageUrl =
                    storeId
                      ? storeImages[
                          storeId
                        ] ??
                        null
                      : null;

                  return (
                    <OrderCard
                      key={
                        order.id
                      }
                      order={
                        order
                      }
                      storeImageUrl={
                        storeImageUrl
                      }
                      onPress={() =>
                        openOrderDetails(
                          order.id,
                        )
                      }
                      onReorder={
                        storeId
                          ? () =>
                              reorder(
                                order,
                              )
                          : undefined
                      }
                    />
                  );
                },
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <AppBottomNavigation
        activeTab="orders"
      />
    </View>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor:
        '#FFFFFF',
    },

    /*
     * NEW LOADING SPLASH
     */

    loadingScreen: {
      flex: 1,

      backgroundColor:
        '#FFFFFF',

      alignItems:
        'center',

      justifyContent:
        'center',

      overflow:
        'hidden',
    },

    loadingGlowTop: {
      position:
        'absolute',

      width: 330,

      height: 330,

      borderRadius: 165,

      top: -185,

      right: -120,

      backgroundColor:
        '#F0FFF6',
    },

    loadingGlowBottom: {
      position:
        'absolute',

      width: 280,

      height: 280,

      borderRadius: 140,

      bottom: -180,

      left: -130,

      backgroundColor:
        '#F6FFF9',
    },

    loadingContent: {
      width: '100%',

      maxWidth: 380,

      paddingHorizontal: 32,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    loadingMarkOuter: {
      width: 104,

      height: 104,

      borderRadius: 52,

      backgroundColor:
        '#F5FFF9',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    loadingMarkMiddle: {
      width: 82,

      height: 82,

      borderRadius: 41,

      backgroundColor:
        BRAND_GREEN_SOFT,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    loadingMarkInner: {
      width: 58,

      height: 58,

      borderRadius: 29,

      backgroundColor:
        '#FFFFFF',

      alignItems:
        'center',

      justifyContent:
        'center',

      borderWidth: 1,

      borderColor:
        '#DDF5E8',
    },

    loadingTitle: {
      marginTop: 22,

      color:
        '#1C1C1C',

      fontSize: 20,

      lineHeight: 28,

      fontWeight:
        '800',

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    loadingDescription: {
      marginTop: 6,

      color:
        '#818181',

      fontSize: 11.5,

      lineHeight: 18,

      fontWeight:
        '500',

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    loadingIndicatorContainer: {
      marginTop: 24,

      width: 34,

      height: 34,

      borderRadius: 17,

      backgroundColor:
        '#F7FBF9',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    pageContent: {
      flexGrow: 1,

      paddingTop: 36,

      paddingBottom:
        NAVIENTY_NOW_LAYOUT
          .bottomNavigationHeight +
        44,
    },

    container: {
      alignSelf:
        'center',

      maxWidth: 560,

      width: '100%',
    },

    /*
     * HEADER
     */

    header: {
      paddingHorizontal: 18,
      paddingBottom: 21,
    },

    headerTitleRow: {
      minHeight: 40,

      flexDirection:
        'row-reverse',

      alignItems:
        'center',
    },

    pageTitle: {
      color:
        '#222222',

      fontSize: 21,

      lineHeight: 29,

      fontWeight:
        '800',

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    refreshIndicator: {
      marginRight: 9,

      transform: [
        {
          scale: 0.8,
        },
      ],
    },

    /*
     * ORDERS
     */

    ordersList: {
      gap: 15,

      paddingHorizontal:
        16,
    },

    /*
     * CARD
     */

    orderCard: {
      backgroundColor:
        '#FFFFFF',

      borderWidth: 1,

      borderColor:
        '#DEDEDE',

      borderRadius: 21,

      overflow:
        'hidden',
    },

    orderCardMain: {
      backgroundColor:
        '#FFFFFF',
    },

    orderCardPressed: {
      opacity: 0.8,
    },

    /*
     * CARD HEADER
     */

    orderHeader: {
      minHeight: 54,

      paddingHorizontal: 16,

      flexDirection:
        'row-reverse',

      alignItems:
        'center',
    },

    statusBadge: {
      borderRadius: 5,

      paddingHorizontal: 7,

      paddingVertical: 4,
    },

    statusText: {
      fontSize: 11,

      lineHeight: 16,

      fontWeight:
        '600',

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    orderDate: {
      flex: 1,

      marginRight: 9,

      color:
        '#686868',

      fontSize: 12.5,

      lineHeight: 18,

      fontWeight:
        '500',

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    cardDivider: {
      width: '100%',

      height: 1,

      backgroundColor:
        '#E3E3E3',
    },

    /*
     * BODY
     */

    orderBody: {
      paddingTop: 20,

      paddingHorizontal: 16,

      paddingBottom: 18,
    },

    storeRow: {
      minHeight: 62,

      flexDirection:
        'row-reverse',

      alignItems:
        'center',
    },

    /*
     * STORE IMAGE
     */

    storeImageContainer: {
      width: 60,

      height: 60,

      borderRadius: 13,

      overflow:
        'hidden',

      backgroundColor:
        '#F7F7F7',

      borderWidth: 1,

      borderColor:
        '#EEEEEE',
    },

    storeImage: {
      width: '100%',

      height: '100%',
    },

    storeImagePlaceholder: {
      flex: 1,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#F5F5F5',
    },

    /*
     * STORE INFO
     */

    storeInformation: {
      flex: 1,

      marginRight: 11,

      marginLeft: 8,

      justifyContent:
        'center',
    },

    storeName: {
      color:
        '#1E1E1E',

      fontSize: 17,

      lineHeight: 24,

      fontWeight:
        '800',

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    orderCodeText: {
      color:
        '#777777',

      fontSize: 12,

      lineHeight: 18,

      fontWeight:
        '400',

      marginTop: 2,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    /*
     * ITEMS
     */

    itemCountContainer: {
      minWidth: 75,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'flex-start',
    },

    itemCountText: {
      marginLeft: 6,

      color:
        '#737373',

      fontSize: 12,

      lineHeight: 18,

      fontWeight:
        '400',

      writingDirection:
        'rtl',
    },

    /*
     * TOTAL
     */

    orderBottomRow: {
      minHeight: 42,

      marginTop: 17,

      flexDirection:
        'row-reverse',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    orderTotal: {
      color:
        '#242424',

      fontSize: 15.5,

      lineHeight: 22,

      fontWeight:
        '700',

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    /*
     * REORDER
     */

    reorderButton: {
      minHeight: 40,

      paddingHorizontal: 17,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderWidth: 1.25,

      borderColor:
        '#292929',

      borderRadius: 999,
    },

    reorderButtonPressed: {
      backgroundColor:
        '#F5F5F5',
    },

    reorderButtonText: {
      color:
        '#242424',

      fontSize: 13,

      lineHeight: 18,

      fontWeight:
        '700',

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    reorderButtonSpace: {
      width: 1,

      height: 40,
    },

    /*
     * RATING
     */

    ratingFooter: {
      minHeight: 56,

      paddingHorizontal: 17,

      flexDirection:
        'row-reverse',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      backgroundColor:
        '#F7F7F7',
    },

    ratingLabelContainer: {
      alignItems:
        'flex-end',

      flex: 1,
    },

    ratingLabel: {
      color:
        '#333333',

      fontSize: 13.5,

      lineHeight: 19,

      fontWeight:
        '700',

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    ratingErrorText: {
      color:
        '#A34444',

      fontSize: 8.5,

      lineHeight: 12,

      marginTop: 2,

      maxWidth: 170,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    ratingStars: {
      flexDirection:
        'row',

      alignItems:
        'center',
    },

    ratingStarButton: {
      width: 31,

      height: 38,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    ratingStarButtonPressed: {
      opacity: 0.65,

      transform: [
        {
          scale: 0.9,
        },
      ],
    },

    ratingStarSpacing: {
      marginLeft: 6,
    },

    /*
     * PENDING ORDER
     */

    pendingCard: {
      marginHorizontal: 16,

      marginBottom: 15,

      backgroundColor:
        '#FFFFFF',

      borderWidth: 1,

      borderColor:
        '#DEDEDE',

      borderRadius: 21,

      overflow:
        'hidden',
    },

    pendingHeader: {
      minHeight: 52,

      paddingHorizontal: 16,

      flexDirection:
        'row-reverse',

      alignItems:
        'center',
    },

    pendingStatusBadge: {
      backgroundColor:
        '#FFF4D9',

      borderRadius: 5,

      paddingHorizontal: 7,

      paddingVertical: 4,
    },

    pendingStatusText: {
      color:
        '#7A5A13',

      fontSize: 11,

      lineHeight: 16,

      fontWeight:
        '600',

      writingDirection:
        'rtl',
    },

    pendingDateLabel: {
      flex: 1,

      marginRight: 9,

      color:
        '#777777',

      fontSize: 12,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    pendingContent: {
      padding: 16,
    },

    pendingTitleRow: {
      flexDirection:
        'row-reverse',

      alignItems:
        'center',
    },

    pendingLogo: {
      width: 56,

      height: 56,

      borderRadius: 13,

      backgroundColor:
        '#F6F6F6',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    pendingInfo: {
      flex: 1,

      marginRight: 11,
    },

    pendingTitle: {
      color:
        '#202020',

      fontSize: 15,

      lineHeight: 21,

      fontWeight:
        '800',

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    pendingDescription: {
      color:
        '#747474',

      fontSize: 11.5,

      lineHeight: 18,

      marginTop: 3,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    pendingOrderCode: {
      color:
        '#808080',

      fontSize: 11,

      lineHeight: 17,

      marginTop: 3,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    pendingButton: {
      alignSelf:
        'flex-start',

      minHeight: 39,

      marginTop: 15,

      paddingHorizontal: 18,

      backgroundColor:
        '#292929',

      borderRadius: 999,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    pendingButtonText: {
      color:
        '#FFFFFF',

      fontSize: 12.5,

      fontWeight:
        '700',

      writingDirection:
        'rtl',
    },

    /*
     * WARNING
     */

    warningCard: {
      marginHorizontal: 16,

      marginBottom: 15,

      paddingHorizontal: 13,

      paddingVertical: 11,

      flexDirection:
        'row-reverse',

      alignItems:
        'center',

      gap: 8,

      borderRadius: 12,

      backgroundColor:
        '#FFF7E5',
    },

    warningText: {
      flex: 1,

      color:
        '#795E20',

      fontSize: 10.5,

      lineHeight: 17,

      fontWeight:
        '500',

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    /*
     * EMPTY
     */

    emptyState: {
      minHeight: 380,

      paddingHorizontal: 30,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    emptyIconContainer: {
      width: 68,

      height: 68,

      borderRadius: 34,

      backgroundColor:
        '#F4F4F4',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    emptyTitle: {
      marginTop: 16,

      color:
        '#202020',

      fontSize: 16,

      lineHeight: 22,

      fontWeight:
        '800',

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    emptyDescription: {
      marginTop: 6,

      color:
        '#777777',

      fontSize: 11.5,

      lineHeight: 18,

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    shopButton: {
      minHeight: 41,

      marginTop: 19,

      paddingHorizontal: 22,

      backgroundColor:
        '#292929',

      borderRadius: 999,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    shopButtonText: {
      color:
        '#FFFFFF',

      fontSize: 12.5,

      fontWeight:
        '700',

      writingDirection:
        'rtl',
    },

    buttonPressed: {
      opacity: 0.72,
    },
  });
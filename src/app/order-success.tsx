import { Ionicons } from '@expo/vector-icons';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Fragment,
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  type ImageSourcePropType,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getCategoryIcon } from '../config/category-icons';
import { publicSupabase } from '../lib/supabase';
import {
  getMyOrders,
  getOrderByToken,
} from '../services/order-service';

import ServiceBookingSuccess from '../components/service/service-booking-success';
import { OrderDetailsScreenSkeleton } from '../components/ui/loading-skeleton';
import {
  type Order,
  type OrderStatus,
  useOrdersStore,
} from '../store/orders-store';
import {
  NAVIENTY_NOW_COLORS,
} from '../theme/navienty-now-theme';
import {
  openOrderInWhatsApp,
} from '../utils/order-whatsapp';

const BRAND_GREEN =
  NAVIENTY_NOW_COLORS.primary;

const BRAND_GREEN_DARK =
  NAVIENTY_NOW_COLORS.primaryPressed;

const BRAND_GREEN_SOFT =
  NAVIENTY_NOW_COLORS.primaryPale;

const POLL_INTERVAL_MS = 8000;

const PERSONAL_CARE_CATEGORY_IMAGE =
  require(
    '../assets/icons/categories/personal-care.webp',
  );

const LAUNDRY_CATEGORY_IMAGE =
  require(
    '../assets/icons/categories/laundry.webp',
  );

const REQUEST_ANYTHING_CATEGORY_IMAGE =
  require(
    '../assets/icons/categories/request-anything.webp',
  );

type TrackingStep = {
  key:
    | 'confirmation'
    | 'preparing'
    | 'delivery'
    | 'delivered';

  title: string;

  icon:
    keyof typeof Ionicons.glyphMap;
};

const TRACKING_STEPS:
  TrackingStep[] = [
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

function getSingleParam(
  value:
    | string
    | string[]
    | undefined,
): string | undefined {
  return Array.isArray(value)
    ? value[0]
    : value;
}

function getTrackingStage(
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

function getCurrentStatusCopy(
  status: OrderStatus,
): {
  title: string;
  description: string;
} {
  switch (status) {
    case 'awaiting-whatsapp-send':
      return {
        title: 'جاري تسجيل الطلب',
        description:
          'تم حفظ طلبك وسيحاول التطبيق إرساله للمراجعة تلقائيًا.',
      };

    case 'waiting-confirmation':
      return {
        title: 'جاري تأكيد الطلب',
        description:
          'استلمنا طلبك وجاري مراجعة التفاصيل وتأكيد الطلب.',
      };

    case 'confirmed':
    case 'preparing':
      return {
        title: 'جاري تحضير الطلب',
        description:
          'تم تأكيد الطلب والمتجر يقوم الآن بتجهيز طلبك.',
      };

    case 'out-for-delivery':
      return {
        title: 'الطلب في الطريق',
        description:
          'تم تجهيز الطلب وهو الآن في طريقه إليك.',
      };

    case 'delivered':
      return {
        title: 'تم استلام الطلب',
        description:
          'تم توصيل الطلب بنجاح. نتمنى لك تجربة رائعة مع Navienty Now.',
      };

    case 'cancelled':
      return {
        title: 'تم إلغاء الطلب',
        description:
          'تم إلغاء هذا الطلب ولن يتم استكمال تنفيذه.',
      };

    default:
      return {
        title: 'جاري تحديث الطلب',
        description:
          'يتم الآن الحصول على أحدث حالة للطلب.',
      };
  }
}

function formatMoney(
  value: number,
  currencySymbol: string,
) {
  const numericValue =
    Number(value ?? 0);

  if (
    Number.isInteger(
      numericValue,
    )
  ) {
    return `${numericValue} ${currencySymbol}`;
  }

  return `${numericValue.toFixed(
    2,
  )} ${currencySymbol}`;
}

function getSafeIoniconName(
  value: string | null | undefined,
  fallback: keyof typeof Ionicons.glyphMap,
): keyof typeof Ionicons.glyphMap {
  return value &&
    value in Ionicons.glyphMap
    ? (value as keyof typeof Ionicons.glyphMap)
    : fallback;
}

function getOrderFromState(
  orderId: string,
): Order | null {
  const state =
    useOrdersStore.getState();

  return (
    state.orders.find(
      (currentOrder) =>
        currentOrder.id ===
        orderId,
    ) ??
    (
      state.pendingOrder?.id ===
      orderId
        ? state.pendingOrder
        : null
    )
  );
}

function normalizeWhatsAppNumber(
  phoneNumber: string,
): string {
  let digits =
    phoneNumber.replace(
      /\D/g,
      '',
    );

  if (
    digits.startsWith(
      '00',
    )
  ) {
    digits =
      digits.slice(2);
  }

  if (
    digits.startsWith(
      '0',
    )
  ) {
    digits =
      `20${digits.slice(1)}`;
  }

  return digits;
}

type RawOrderStoreCatalog = {
  store?: {
    id?: string | null;
    category_slug?: string | null;
    logo_url?: string | null;
    cover_image_url?: string | null;
  } | null;
};

type ResolvedOrderStoreArtwork = {
  logoUrl: string;
  coverImageUrl: string;
  categorySlug: string;
};

function normalizeStoreCategorySlug(
  value: string | null | undefined,
) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');
}

function getOrderStoreCategoryArtwork(
  categorySlug: string,
): ImageSourcePropType | null {
  const normalizedSlug =
    normalizeStoreCategorySlug(
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
    return LAUNDRY_CATEGORY_IMAGE;
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
    return PERSONAL_CARE_CATEGORY_IMAGE;
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
    return REQUEST_ANYTHING_CATEGORY_IMAGE;
  }

  if (
    normalizedSlug ===
      'restaurant' ||
    normalizedSlug ===
      'restaurants' ||
    normalizedSlug ===
      'supermarket' ||
    normalizedSlug ===
      'supermarkets' ||
    normalizedSlug ===
      'bookstore' ||
    normalizedSlug ===
      'bookstores'
  ) {
    return getCategoryIcon(
      normalizedSlug,
    );
  }

  return null;
}

export default function OrderSuccessScreen() {
  const params =
    useLocalSearchParams<{
      serviceBookingId?:
        | string
        | string[];
    }>();

  const serviceBookingId =
    getSingleParam(
      params.serviceBookingId,
    )?.trim();

  /**
   * Service bookings use the SAME /order-success route.
   *
   * Normal store orders continue into the original component below
   * completely unchanged.
   */
  if (serviceBookingId) {
    return (
      <ServiceBookingSuccess
        serviceBookingId={
          serviceBookingId
        }
      />
    );
  }

  return (
    <StoreOrderSuccessScreen />
  );
}

function StoreOrderSuccessScreen() {
  const router =
    useRouter();

  const insets =
    useSafeAreaInsets();

  const params =
    useLocalSearchParams<{
      id?:
        | string
        | string[];
    }>();

  const orderId =
    getSingleParam(
      params.id,
    );

  const hasHydrated =
    useOrdersStore(
      (state) =>
        state.hasHydrated,
    );

  const order =
    useOrdersStore(
      (state) => {
        if (!orderId) {
          return null;
        }

        return (
          state.orders.find(
            (currentOrder) =>
              currentOrder.id ===
              orderId,
          ) ??
          (
            state.pendingOrder?.id ===
            orderId
              ? state.pendingOrder
              : null
          )
        );
      },
    );

  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(false);

  const [
    refreshError,
    setRefreshError,
  ] = useState<
    string | null
  >(null);

  const [
    isOpeningCancellation,
    setIsOpeningCancellation,
  ] = useState(false);

  const [
    isOpeningPrintWhatsApp,
    setIsOpeningPrintWhatsApp,
  ] = useState(false);

  /*
   * Store artwork.
   *
   * Priority:
   *
   * 1. Real store logo.
   * 2. Real store cover.
   * 3. Product image snapshot stored with the order.
   * 4. Category artwork bundled in the app.
   * 5. Emoji only as the final fallback.
   *
   * IMPORTANT:
   *
   * We intentionally call get_store_catalog directly through
   * publicSupabase instead of getStoreCatalog().
   *
   * catalog-service applies the public-v1 category gate after the
   * RPC resolves. Active orders can belong to service/internal
   * categories such as Laundry or Request Anything, so the order
   * tracking screen must not inherit that catalog visibility filter.
   */
  const [
    resolvedStoreArtwork,
    setResolvedStoreArtwork,
  ] = useState<ResolvedOrderStoreArtwork>({
    logoUrl: '',
    coverImageUrl: '',
    categorySlug: '',
  });

  const [
    storeImageFailed,
    setStoreImageFailed,
  ] = useState(false);

  const [
    isResolvingStoreArtwork,
    setIsResolvingStoreArtwork,
  ] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setStoreImageFailed(false);

    setResolvedStoreArtwork({
      logoUrl: '',
      coverImageUrl: '',
      categorySlug: '',
    });

    if (
      !order?.storeId
    ) {
      setIsResolvingStoreArtwork(
        false,
      );

      return () => {
        cancelled = true;
      };
    }

    setIsResolvingStoreArtwork(
      true,
    );

    async function loadStoreArtwork() {
      try {
        const {
          data,
          error,
        } =
          await publicSupabase.rpc(
            'get_store_catalog',
            {
              p_store_id:
                order!.storeId,
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
            | RawOrderStoreCatalog
            | null;

        const rawStore =
          rawCatalog?.store;

        setResolvedStoreArtwork({
          logoUrl:
            rawStore
              ?.logo_url
              ?.trim() ??
            '',

          coverImageUrl:
            rawStore
              ?.cover_image_url
              ?.trim() ??
            '',

          categorySlug:
            rawStore
              ?.category_slug
              ?.trim() ??
            '',
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.warn(
          'Unable to resolve order store artwork.',
          order!.storeId,
          error,
        );

        setResolvedStoreArtwork({
          logoUrl: '',
          coverImageUrl: '',
          categorySlug: '',
        });
      } finally {
        if (!cancelled) {
          setIsResolvingStoreArtwork(
            false,
          );
        }
      }
    }

    void loadStoreArtwork();

    return () => {
      cancelled = true;
    };
  }, [
    order?.storeId,
  ]);

  const refreshOrder =
    useCallback(
      async (
        options?: {
          silent?: boolean;
        },
      ) => {
        if (!orderId) {
          setRefreshError(
            'تعذر تحديد الطلب.',
          );

          return;
        }

        const silent =
          options?.silent ===
          true;

        try {
          if (!silent) {
            setIsRefreshing(
              true,
            );
          }

          const savedOrder =
            getOrderFromState(
              orderId,
            );

          let latestOrder: Order;

          if (savedOrder) {
            latestOrder =
              await getOrderByToken(
                savedOrder.accessToken,
              );
          } else {
            /**
             * A notification deep link contains the server-side order ID, not
             * the private access token persisted in the local orders store.
             *
             * If local storage was cleared/migrated or hydration did not retain
             * this order, recover it from the owner-scoped order history RPC.
             * get_my_orders() is restricted by auth.uid(), so an arbitrary ID in
             * a notification/deep link cannot expose another customer's order.
             */
            const serverOrders =
              await getMyOrders();

            const recoveredOrder =
              serverOrders.find(
                (currentOrder) =>
                  currentOrder.id ===
                  orderId,
              );

            if (!recoveredOrder) {
              setRefreshError(
                'لم يتم العثور على الطلب.',
              );

              return;
            }

            latestOrder =
              recoveredOrder;
          }

          const store =
            useOrdersStore
              .getState();

          if (
            store
              .pendingOrder
              ?.id ===
            latestOrder.id
          ) {
            if (
              latestOrder.status ===
              'awaiting-whatsapp-send'
            ) {
              store.setPendingOrder(
                latestOrder,
              );
            } else {
              store.confirmPendingOrder(
                latestOrder,
              );
            }
          } else {
            store.upsertOrder(
              latestOrder,
            );
          }

          setRefreshError(
            null,
          );
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'تعذر تحديث حالة الطلب.';

          setRefreshError(
            message,
          );
        } finally {
          if (!silent) {
            setIsRefreshing(
              false,
            );
          }
        }
      },
      [orderId],
    );

  /*
   * Automatic order tracking.
   *
   * - Refresh immediately whenever this screen receives focus.
   * - Refresh again automatically every 8 seconds.
   * - No manual refresh button is required.
   */
  useFocusEffect(
    useCallback(() => {
      if (
        !hasHydrated ||
        !orderId
      ) {
        return;
      }

      void refreshOrder({
        silent: true,
      });

      const timer =
        setInterval(() => {
          const currentOrder =
            getOrderFromState(
              orderId,
            );

          /*
           * Delivered/cancelled orders are terminal.
           * There is no reason to keep polling them.
           */
          if (
            currentOrder?.status ===
              'delivered' ||
            currentOrder?.status ===
              'cancelled'
          ) {
            return;
          }

          void refreshOrder({
            silent: true,
          });
        }, POLL_INTERVAL_MS);

      return () => {
        clearInterval(timer);
      };
    }, [
      hasHydrated,
      orderId,
      refreshOrder,
    ]),
  );

  function returnToHome() {
    router.replace('/');
  }

  async function openCancellationWhatsApp() {
    if (
      !order ||
      isOpeningCancellation
    ) {
      return;
    }

    if (
      order.status ===
      'delivered'
    ) {
      Alert.alert(
        'تم توصيل الطلب',
        'لا يمكن طلب إلغاء طلب تم توصيله بالفعل.',
      );

      return;
    }

    if (
      order.status ===
      'cancelled'
    ) {
      return;
    }

    const whatsappNumber =
      normalizeWhatsAppNumber(
        order.whatsappNumber,
      );

    if (!whatsappNumber) {
      Alert.alert(
        'تعذر إرسال طلب الإلغاء',
        'رقم واتساب الخاص بالطلب غير متاح حاليًا.',
      );

      return;
    }

    /*
     * The order code is deliberately included in the WhatsApp message
     * even though it is no longer shown in the customer interface.
     * Operations still need a reliable way to identify the exact order.
     */
    const cancellationMessage =
      `مرحبًا، أريد إلغاء طلبي رقم ${order.orderCode} من ${order.storeName}.`;

    const whatsappUrl =
      `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
        cancellationMessage,
      )}`;

    try {
      setIsOpeningCancellation(
        true,
      );

      await Linking.openURL(
        whatsappUrl,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر فتح واتساب.';

      Alert.alert(
        'تعذر فتح واتساب',
        message,
      );
    } finally {
      setIsOpeningCancellation(
        false,
      );
    }
  }

  function requestCancellation() {
    if (
      !order ||
      isOpeningCancellation
    ) {
      return;
    }

    Alert.alert(
      'إلغاء الطلب',
      'هل أنت متأكد أنك تريد طلب إلغاء هذا الأوردر؟ سيتم فتح واتساب لإرسال طلب الإلغاء إلى فريق Navienty Now.',
      [
        {
          text: 'لا، رجوع',
          style: 'cancel',
        },
        {
          text: 'إلغاء الطلب',
          style: 'destructive',
          onPress: () => {
            void openCancellationWhatsApp();
          },
        },
      ],
    );
  }

  async function openPrintFileWhatsApp() {
    if (
      !order ||
      isOpeningPrintWhatsApp
    ) {
      return;
    }

    try {
      setIsOpeningPrintWhatsApp(
        true,
      );

      await openOrderInWhatsApp(
        order,
      );
    } catch (error) {
      Alert.alert(
        'تعذر فتح واتساب',
        error instanceof Error
          ? error.message
          : printJob?.uiCopy
              .whatsappOpenErrorBody ??
              'تعذر فتح واتساب لإرسال ملف الطباعة.',
      );
    } finally {
      setIsOpeningPrintWhatsApp(
        false,
      );
    }
  }

  if (!hasHydrated) {
    return <OrderDetailsScreenSkeleton />;
  }

  if (
    !orderId ||
    !order
  ) {
    return (
      <View
        style={
          styles.stateScreen
        }
      >
        <StatusBar
          style="dark"
        />

        <View
          style={
            styles.stateIcon
          }
        >
          <Ionicons
            name="receipt-outline"
            size={29}
            color={
              BRAND_GREEN
            }
          />
        </View>

        <Text
          style={
            styles.stateTitle
          }
        >
          لم يتم العثور على الطلب
        </Text>

        <Text
          style={
            styles.stateDescription
          }
        >
          {refreshError ??
            'تعذر الوصول إلى تفاصيل هذا الطلب.'}
        </Text>

        <Pressable
          disabled={
            isRefreshing
          }
          style={({
            pressed,
          }) => [
            styles.statePrimaryButton,

            isRefreshing &&
              styles.stateButtonDisabled,

            pressed &&
              !isRefreshing &&
              styles.buttonPressed,
          ]}
          onPress={() => {
            void refreshOrder();
          }}
        >
          {isRefreshing ? (
            <ActivityIndicator
              size="small"
              color={
                NAVIENTY_NOW_COLORS.white
              }
            />
          ) : null}

          <Text
            style={
              styles.statePrimaryButtonText
            }
          >
            إعادة المحاولة
          </Text>
        </Pressable>

        <Pressable
          style={({
            pressed,
          }) => [
            styles.stateSecondaryButton,

            pressed &&
              styles.buttonPressed,
          ]}
          onPress={
            returnToHome
          }
        >
          <Text
            style={
              styles.stateSecondaryButtonText
            }
          >
            العودة للرئيسية
          </Text>
        </Pressable>
      </View>
    );
  }

  const currentStage =
    getTrackingStage(
      order.status,
    );

  const currentCopy =
    getCurrentStatusCopy(
      order.status,
    );

  const isCancelled =
    order.status ===
    'cancelled';

  const isDelivered =
    order.status ===
    'delivered';

  const printJob =
    order.items.find(
      (item) =>
        item.itemKind ===
        'print_job',
    )?.printJob ?? null;

  const hasPrintJob =
    printJob !== null;

  const canRequestCancellation =
    !isCancelled &&
    !isDelivered;

  const storeLogoUrl =
    resolvedStoreArtwork
      .logoUrl;

  const storeCoverImageUrl =
    resolvedStoreArtwork
      .coverImageUrl;

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

  const remoteStoreImageUrl =
    storeLogoUrl ||
    storeCoverImageUrl ||
    orderItemImageUrl;

  const localStoreArtwork =
    getOrderStoreCategoryArtwork(
      resolvedStoreArtwork
        .categorySlug,
    );

  const showRemoteStoreImage =
    remoteStoreImageUrl.length >
      0 &&
    !storeImageFailed;

  const showLocalStoreArtwork =
    !showRemoteStoreImage &&
    localStoreArtwork !==
      null;

  const storeImageResizeMode:
    'contain' | 'cover' =
    storeLogoUrl
      ? 'contain'
      : storeCoverImageUrl
        ? 'cover'
        : 'contain';

  return (
    <View
      style={styles.screen}
    >
      <StatusBar
        style="light"
      />

      <ScrollView
        style={
          styles.scrollView
        }
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={
          false
        }
        bounces={false}
      >
        {/* =====================================================
            GREEN HERO
            ===================================================== */}

        <View
          style={[
            styles.hero,

            {
              paddingTop:
                Math.max(
                  insets.top,
                  12,
                ) + 8,
            },
          ]}
        >
          <View
            style={
              styles.heroHeader
            }
          >
            <Pressable
              accessibilityLabel="إغلاق"
              style={({
                pressed,
              }) => [
                styles.closeButton,

                pressed &&
                  styles.closeButtonPressed,
              ]}
              onPress={
                returnToHome
              }
            >
              <Ionicons
                name="close"
                size={24}
                color={
                  NAVIENTY_NOW_COLORS.text
                }
              />
            </Pressable>

            <View
              style={
                styles.heroTitleGroup
              }
            >
              <Text
                style={
                  styles.heroBrand
                }
              >
                Navienty Now
              </Text>

              <Text
                style={
                  styles.heroSubtitle
                }
              >
                تتبع طلبك
              </Text>
            </View>

            <View
              style={
                styles.headerSpacer
              }
            />
          </View>

          {/* ===================================================
              TRACKING CARD
              =================================================== */}

          <View
            style={
              styles.trackingCard
            }
          >
            <View
              style={
                styles.trackingTopRow
              }
            >
              <View
                style={
                  styles.storeLogo
                }
              >
                {showRemoteStoreImage ? (
                  <Image
                    accessibilityIgnoresInvertColors
                    accessibilityLabel={`صورة ${order.storeName}`}
                    source={{
                      uri:
                        remoteStoreImageUrl,
                    }}
                    resizeMode={
                      storeImageResizeMode
                    }
                    style={
                      styles.storeLogoImage
                    }
                    onError={() => {
                      setStoreImageFailed(
                        true,
                      );
                    }}
                  />
                ) : showLocalStoreArtwork ? (
                  <Image
                    accessibilityIgnoresInvertColors
                    accessibilityLabel={`صورة ${order.storeName}`}
                    source={
                      localStoreArtwork!
                    }
                    resizeMode="contain"
                    style={
                      styles.storeLogoImage
                    }
                  />
                ) : isResolvingStoreArtwork ? (
                  <View
                    style={
                      styles.storeLogoLoading
                    }
                  />
                ) : (
                  <Text
                    style={
                      styles.storeLogoText
                    }
                  >
                    {order.storeIcon ||
                      '🏪'}
                  </Text>
                )}
              </View>

              <View
                style={
                  styles.trackingHeading
                }
              >
                <Text
                  numberOfLines={1}
                  style={
                    styles.trackingStoreName
                  }
                >
                  {order.storeName}
                </Text>
              </View>
            </View>

            {isCancelled ? (
              <View
                style={
                  styles.cancelledCard
                }
              >
                <View
                  style={
                    styles.cancelledIcon
                  }
                >
                  <Ionicons
                    name="close"
                    size={19}
                    color="#FFFFFF"
                  />
                </View>

                <View
                  style={
                    styles.cancelledContent
                  }
                >
                  <Text
                    style={
                      styles.cancelledTitle
                    }
                  >
                    تم إلغاء الطلب
                  </Text>

                  <Text
                    style={
                      styles.cancelledDescription
                    }
                  >
                    {order.cancellationReason ||
                      'تم إلغاء هذا الطلب ولن يتم استكمال تنفيذه.'}
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <View
                  style={
                    styles.currentStatus
                  }
                >
                  <Text
                    style={
                      styles.currentStatusTitle
                    }
                  >
                    {currentCopy.title}
                  </Text>

                  <Text
                    style={
                      styles.currentStatusDescription
                    }
                  >
                    {
                      currentCopy.description
                    }
                  </Text>
                </View>

                {/* =============================================
                    FOUR-STAGE PROGRESS
                    ============================================= */}

                <View
                  style={
                    styles.progressSection
                  }
                >
                  <View
                    style={
                      styles.progressRow
                    }
                  >
                    {TRACKING_STEPS.map(
                      (
                        step,
                        index,
                      ) => {
                        const completed =
                          currentStage >
                          index;

                        const active =
                          currentStage ===
                          index;

                        const reached =
                          completed ||
                          active;

                        return (
                          <Fragment
                            key={
                              step.key
                            }
                          >
                            <View
                              style={
                                styles.progressStep
                              }
                            >
                              <View
                                style={[
                                  styles.progressCircle,

                                  reached &&
                                    styles.progressCircleReached,

                                  active &&
                                    styles.progressCircleActive,
                                ]}
                              >
                                {completed ? (
                                  <Ionicons
                                    name="checkmark"
                                    size={15}
                                    color="#FFFFFF"
                                  />
                                ) : (
                                  <Ionicons
                                    name={
                                      step.icon
                                    }
                                    size={14}
                                    color={
                                      reached
                                        ? '#FFFFFF'
                                        : '#AAAAAA'
                                    }
                                  />
                                )}
                              </View>

                              <Text
                                numberOfLines={2}
                                style={[
                                  styles.progressLabel,

                                  reached &&
                                    styles.progressLabelReached,
                                ]}
                              >
                                {
                                  step.title
                                }
                              </Text>
                            </View>

                            {index <
                              TRACKING_STEPS.length -
                                1 && (
                              <View
                                style={[
                                  styles.progressConnector,

                                  currentStage >
                                    index &&
                                    styles.progressConnectorReached,
                                ]}
                              />
                            )}
                          </Fragment>
                        );
                      },
                    )}
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* =====================================================
            WHITE CONTENT SHEET
            ===================================================== */}

        <View
          style={
            styles.contentSheet
          }
        >
          {refreshError ? (
            <View
              style={
                styles.refreshErrorCard
              }
            >
              <Ionicons
                name="cloud-offline-outline"
                size={18}
                color="#9A6516"
              />

              <Text
                style={
                  styles.refreshErrorText
                }
              >
                تعذر تحديث الحالة الآن.
                سيتم المحاولة تلقائيًا
                مرة أخرى.
              </Text>
            </View>
          ) : null}

          {/* DELIVERY ADDRESS */}

          <View
            style={
              styles.section
            }
          >
            <View
              style={
                styles.sectionHeader
              }
            >
              <Ionicons
                name="location-outline"
                size={19}
                color={
                  BRAND_GREEN
                }
              />

              <Text
                style={
                  styles.sectionTitle
                }
              >
                هنوصل الطلب إلى
              </Text>
            </View>

            <View
              style={
                styles.addressCard
              }
            >
              <View
                style={
                  styles.addressIcon
                }
              >
                <Ionicons
                  name="navigate-outline"
                  size={20}
                  color={
                    BRAND_GREEN
                  }
                />
              </View>

              <View
                style={
                  styles.addressContent
                }
              >
                <Text
                  style={
                    styles.areaName
                  }
                >
                  {order.area ||
                    'عنوان التوصيل'}
                </Text>

                <Text
                  style={
                    styles.addressText
                  }
                  numberOfLines={3}
                >
                  {order.address}
                </Text>

                {order.landmark ? (
                  <Text
                    style={
                      styles.landmarkText
                    }
                    numberOfLines={2}
                  >
                    {
                      order.landmark
                    }
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* ORDER DETAILS */}

          <View
            style={
              styles.section
            }
          >
            <View
              style={
                styles.sectionHeader
              }
            >
              <Ionicons
                name="bag-handle-outline"
                size={19}
                color={
                  BRAND_GREEN
                }
              />

              <Text
                style={
                  styles.sectionTitle
                }
              >
                تفاصيل الطلب
              </Text>
            </View>

            <View
              style={
                styles.itemsCard
              }
            >
              {order.items.map(
                (
                  item,
                  index,
                ) => (
                  <View
                    key={
                      item.id
                    }
                    style={[
                      styles.itemRow,

                      index <
                        order.items
                          .length -
                          1 &&
                        styles.itemRowBorder,
                    ]}
                  >
                    <View
                      style={
                        styles.itemQuantityCircle
                      }
                    >
                      <Text
                        style={
                          styles.itemQuantityText
                        }
                      >
                        {item.itemKind ===
                        'print_job'
                          ? '🖨️'
                          : item.quantity}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.itemCopy
                      }
                    >
                      <Text
                        numberOfLines={2}
                        style={
                          styles.itemName
                        }
                      >
                        {
                          item.name
                        }
                      </Text>

                      {item.variantName ? (
                        <Text
                          numberOfLines={
                            item.itemKind ===
                            'print_job'
                              ? 2
                              : 1
                          }
                          style={
                            styles.itemVariant
                          }
                        >
                          {
                            item.variantName
                          }
                        </Text>
                      ) : null}

                      {item.printJob ? (
                        <Text
                          style={
                            styles.printJobMeta
                          }
                        >
                          {item.printJob.totalSheets}{' '}
                          {item.printJob.uiCopy
                            .physicalSheetsUnitLabel}{' '}
                          •{' '}
                          {item.printJob.copyCount}{' '}
                          {item.printJob.uiCopy
                            .copyUnitLabel}
                        </Text>
                      ) : null}
                    </View>

                    <Text
                      style={
                        styles.itemPrice
                      }
                    >
                      {formatMoney(
                        item.lineTotal,
                        order.currencySymbol,
                      )}
                    </Text>
                  </View>
                ),
              )}
            </View>
          </View>

          {/* SUMMARY */}

          <View
            style={
              styles.section
            }
          >
            <Text
              style={
                styles.summaryTitle
              }
            >
              ملخص الطلب
            </Text>

            <View
              style={
                styles.summaryCard
              }
            >
              <View
                style={
                  styles.summaryRow
                }
              >
                <Text
                  style={
                    styles.summaryValue
                  }
                >
                  {formatMoney(
                    order.subtotal,
                    order.currencySymbol,
                  )}
                </Text>

                <Text
                  style={
                    styles.summaryLabel
                  }
                >
                  {hasPrintJob
                    ? printJob?.uiCopy
                        .orderItemsSummaryLabel
                    : 'المنتجات'}
                </Text>
              </View>

              <View
                style={
                  styles.summaryRow
                }
              >
                <Text
                  style={
                    styles.summaryValue
                  }
                >
                  {formatMoney(
                    order.deliveryFee,
                    order.currencySymbol,
                  )}
                </Text>

                <Text
                  style={
                    styles.summaryLabel
                  }
                >
                  التوصيل
                </Text>
              </View>

              <View
                style={
                  styles.summaryDivider
                }
              />

              <View
                style={
                  styles.totalRow
                }
              >
                <Text
                  style={
                    styles.totalValue
                  }
                >
                  {formatMoney(
                    order.total,
                    order.currencySymbol,
                  )}
                </Text>

                <Text
                  style={
                    styles.totalLabel
                  }
                >
                  الإجمالي
                </Text>
              </View>
            </View>
          </View>

          {hasPrintJob &&
          !isCancelled ? (
            <View
              style={
                styles.printFileSection
              }
            >
              <View
                style={
                  styles.printFileCard
                }
              >
                <View
                  style={
                    styles.printFileIcon
                  }
                >
                  <Ionicons
                    name={getSafeIoniconName(
                      printJob?.uiIcons
                        .orderFile,
                      'document-attach-outline',
                    )}
                    size={22}
                    color={
                      BRAND_GREEN
                    }
                  />
                </View>

                <View
                  style={
                    styles.printFileCopy
                  }
                >
                  <Text
                    style={
                      styles.printFileTitle
                    }
                  >
                    {printJob?.uiCopy
                      .orderFileCtaTitle}
                  </Text>

                  <Text
                    style={
                      styles.printFileDescription
                    }
                  >
                    {printJob?.uiCopy
                      .orderFileCtaBody ??
                      printJob
                        ?.whatsappFilePrompt}
                  </Text>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={
                  isOpeningPrintWhatsApp
                }
                style={({
                  pressed,
                }) => [
                  styles.printFileButton,

                  isOpeningPrintWhatsApp &&
                    styles.printFileButtonDisabled,

                  pressed &&
                    !isOpeningPrintWhatsApp &&
                    styles.printFileButtonPressed,
                ]}
                onPress={() => {
                  void openPrintFileWhatsApp();
                }}
              >
                {isOpeningPrintWhatsApp ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <Ionicons
                    name={getSafeIoniconName(
                      printJob?.uiIcons
                        .orderFile,
                      'logo-whatsapp',
                    )}
                    size={20}
                    color="#FFFFFF"
                  />
                )}

                <Text
                  style={
                    styles.printFileButtonText
                  }
                >
                  {printJob?.uiCopy
                    .sendFileCtaLabel}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {/* CANCELLATION */}

          {canRequestCancellation ? (
            <View
              style={
                styles.cancelActionSection
              }
            >
              <Pressable
                accessibilityRole="button"
                disabled={
                  isOpeningCancellation
                }
                style={({
                  pressed,
                }) => [
                  styles.cancelOrderButton,

                  isOpeningCancellation &&
                    styles.cancelOrderButtonDisabled,

                  pressed &&
                    !isOpeningCancellation &&
                    styles.cancelOrderButtonPressed,
                ]}
                onPress={
                  requestCancellation
                }
              >
                {isOpeningCancellation ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      NAVIENTY_NOW_COLORS.error
                    }
                  />
                ) : (
                  <Ionicons
                    name="close-circle-outline"
                    size={18}
                    color={
                      NAVIENTY_NOW_COLORS.error
                    }
                  />
                )}

                <Text
                  style={
                    styles.cancelOrderButtonText
                  }
                >
                  إلغاء الطلب
                </Text>
              </Pressable>


            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      backgroundColor:
        BRAND_GREEN,
      flex: 1,
    },

    scrollView: {
      flex: 1,
    },

    scrollContent: {
      backgroundColor:
        BRAND_GREEN,
      flexGrow: 1,
    },

    /* ================================= */
    /* HERO                              */
    /* ================================= */

    hero: {
      backgroundColor:
        BRAND_GREEN,
      paddingBottom: 28,
      paddingHorizontal: 16,
    },

    heroHeader: {
      alignItems: 'center',
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      minHeight: 60,
    },

    closeButton: {
      alignItems:
        'center',
      backgroundColor:
        NAVIENTY_NOW_COLORS.white,
      borderRadius: 23,
      height: 46,
      justifyContent:
        'center',
      width: 46,
    },

    closeButtonPressed: {
      opacity: 0.82,
      transform: [
        {
          scale: 0.96,
        },
      ],
    },

    heroTitleGroup: {
      alignItems:
        'center',
      flex: 1,
      marginHorizontal: 10,
    },

    heroBrand: {
      color:
        NAVIENTY_NOW_COLORS.white,
      fontSize: 17,
      fontWeight: '900',
    },

    heroSubtitle: {
      color:
        'rgba(255,255,255,0.76)',
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
      textAlign:
        'center',
      writingDirection:
        'rtl',
    },

    headerSpacer: {
      height: 46,
      width: 46,
    },

    /* ================================= */
    /* TRACKING CARD                     */
    /* ================================= */

    trackingCard: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.white,
      borderRadius: 24,
      elevation: 7,
      marginTop: 12,
      padding: 17,
      shadowColor:
        '#000000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.12,
      shadowRadius: 12,
    },

    trackingTopRow: {
      alignItems:
        'center',
      flexDirection:
        'row-reverse',
    },

    /*
     * Store logo container.
     *
     * The real logo/image from now.stores.logo_url is shown here.
     * The emoji/icon remains only as a fallback.
     */
    storeLogo: {
      alignItems:
        'center',
      backgroundColor:
        NAVIENTY_NOW_COLORS.white,
      borderColor:
        NAVIENTY_NOW_COLORS.border,
      borderRadius: 15,
      borderWidth: 1,
      height: 58,
      justifyContent:
        'center',
      overflow: 'hidden',
      width: 58,
    },

    storeLogoImage: {
      height: '88%',
      width: '88%',
    },

    storeLogoLoading: {
      backgroundColor:
        '#F1F4F2',

      borderRadius:
        12,

      height:
        '88%',

      width:
        '88%',
    },

    storeLogoText: {
      fontSize: 25,
    },

    trackingHeading: {
      alignItems:
        'flex-end',
      flex: 1,
      marginRight: 12,
    },

    trackingStoreName: {
      color:
        NAVIENTY_NOW_COLORS.text,
      fontSize: 17,
      fontWeight: '900',
      maxWidth: '100%',
      textAlign:
        'right',
      writingDirection:
        'rtl',
    },

    currentStatus: {
      alignItems:
        'flex-end',
      marginTop: 19,
    },

    currentStatusTitle: {
      color:
        NAVIENTY_NOW_COLORS.text,
      fontSize: 18,
      fontWeight: '900',
      textAlign:
        'right',
      writingDirection:
        'rtl',
    },

    currentStatusDescription: {
      color:
        NAVIENTY_NOW_COLORS.textSecondary,
      fontSize: 11,
      lineHeight: 18,
      marginTop: 5,
      textAlign:
        'right',
      writingDirection:
        'rtl',
    },

    /* ================================= */
    /* PROGRESS                          */
    /* ================================= */

    progressSection: {
      marginTop: 23,
    },

    progressRow: {
      alignItems:
        'flex-start',
      flexDirection:
        'row-reverse',
    },

    progressStep: {
      alignItems:
        'center',
      width: 62,
    },

    progressCircle: {
      alignItems:
        'center',
      backgroundColor:
        '#ECEEED',
      borderColor:
        '#ECEEED',
      borderRadius: 18,
      borderWidth: 2,
      height: 36,
      justifyContent:
        'center',
      width: 36,
    },

    progressCircleReached: {
      backgroundColor:
        BRAND_GREEN,
      borderColor:
        BRAND_GREEN,
    },

    progressCircleActive: {
      borderColor:
        BRAND_GREEN_DARK,
      borderWidth: 3,
      shadowColor:
        BRAND_GREEN,
      shadowOffset: {
        width: 0,
        height: 0,
      },
      shadowOpacity: 0.2,
      shadowRadius: 5,
    },

    progressLabel: {
      color:
        '#AAAAAA',
      fontSize: 9,
      fontWeight: '700',
      lineHeight: 14,
      marginTop: 7,
      minHeight: 28,
      textAlign:
        'center',
      writingDirection:
        'rtl',
    },

    progressLabelReached: {
      color:
        NAVIENTY_NOW_COLORS.text,
      fontWeight: '800',
    },

    progressConnector: {
      backgroundColor:
        '#E4E6E5',
      borderRadius: 2,
      flex: 1,
      height: 3,
      marginHorizontal: -2,
      marginTop: 17,
      minWidth: 8,
    },

    progressConnectorReached: {
      backgroundColor:
        BRAND_GREEN,
    },

    /* ================================= */
    /* CANCELLED                         */
    /* ================================= */

    cancelledCard: {
      alignItems:
        'center',
      backgroundColor:
        '#FDECEC',
      borderRadius: 16,
      flexDirection:
        'row-reverse',
      marginTop: 18,
      padding: 13,
    },

    cancelledIcon: {
      alignItems:
        'center',
      backgroundColor:
        NAVIENTY_NOW_COLORS.error,
      borderRadius: 16,
      height: 32,
      justifyContent:
        'center',
      width: 32,
    },

    cancelledContent: {
      alignItems:
        'flex-end',
      flex: 1,
      marginRight: 11,
    },

    cancelledTitle: {
      color:
        NAVIENTY_NOW_COLORS.error,
      fontSize: 14,
      fontWeight: '900',
      writingDirection:
        'rtl',
    },

    cancelledDescription: {
      color: '#9B5B5B',
      fontSize: 10,
      lineHeight: 17,
      marginTop: 3,
      textAlign:
        'right',
      writingDirection:
        'rtl',
    },

    /* ================================= */
    /* CONTENT                           */
    /* ================================= */

    contentSheet: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.page,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      flex: 1,
      marginTop: -5,
      paddingBottom: 45,
      paddingHorizontal: 16,
      paddingTop: 25,
    },

    refreshErrorCard: {
      alignItems:
        'center',
      backgroundColor:
        '#FFF5DA',
      borderColor:
        '#F0D89E',
      borderRadius: 14,
      borderWidth: 1,
      flexDirection:
        'row-reverse',
      marginBottom: 18,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },

    refreshErrorText: {
      color: '#745814',
      flex: 1,
      fontSize: 10,
      lineHeight: 16,
      marginRight: 8,
      textAlign:
        'right',
      writingDirection:
        'rtl',
    },

    section: {
      marginBottom: 25,
    },

    sectionHeader: {
      alignItems:
        'center',
      flexDirection:
        'row-reverse',
      gap: 7,
      marginBottom: 11,
    },

    sectionTitle: {
      color:
        NAVIENTY_NOW_COLORS.text,
      fontSize: 17,
      fontWeight: '900',
      textAlign:
        'right',
      writingDirection:
        'rtl',
    },

    /* ================================= */
    /* ADDRESS                           */
    /* ================================= */

    addressCard: {
      alignItems:
        'center',
      backgroundColor:
        NAVIENTY_NOW_COLORS.white,
      borderColor:
        NAVIENTY_NOW_COLORS.border,
      borderRadius: 19,
      borderWidth: 1,
      flexDirection:
        'row-reverse',
      padding: 14,
    },

    addressIcon: {
      alignItems:
        'center',
      backgroundColor:
        BRAND_GREEN_SOFT,
      borderRadius: 19,
      height: 38,
      justifyContent:
        'center',
      width: 38,
    },

    addressContent: {
      alignItems:
        'flex-end',
      flex: 1,
      marginRight: 12,
    },

    areaName: {
      color:
        NAVIENTY_NOW_COLORS.text,
      fontSize: 14,
      fontWeight: '900',
      textAlign:
        'right',
      writingDirection:
        'rtl',
    },

    addressText: {
      color:
        NAVIENTY_NOW_COLORS.textSecondary,
      fontSize: 11,
      lineHeight: 18,
      marginTop: 4,
      textAlign:
        'right',
      writingDirection:
        'rtl',
    },

    landmarkText: {
      color:
        BRAND_GREEN_DARK,
      fontSize: 10,
      lineHeight: 16,
      marginTop: 5,
      textAlign:
        'right',
      writingDirection:
        'rtl',
    },

    /* ================================= */
    /* ITEMS                             */
    /* ================================= */

    itemsCard: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.white,
      borderColor:
        NAVIENTY_NOW_COLORS.border,
      borderRadius: 19,
      borderWidth: 1,
      overflow:
        'hidden',
      paddingHorizontal: 13,
    },

    itemRow: {
      alignItems:
        'center',
      flexDirection:
        'row-reverse',
      minHeight: 68,
      paddingVertical: 11,
    },

    itemRowBorder: {
      borderBottomColor:
        NAVIENTY_NOW_COLORS.border,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
    },

    itemQuantityCircle: {
      alignItems:
        'center',
      backgroundColor:
        BRAND_GREEN_SOFT,
      borderRadius: 15,
      height: 30,
      justifyContent:
        'center',
      width: 30,
    },

    itemQuantityText: {
      color:
        BRAND_GREEN_DARK,
      fontSize: 12,
      fontWeight: '900',
    },

    itemCopy: {
      alignItems:
        'flex-end',
      flex: 1,
      marginHorizontal: 11,
    },

    itemName: {
      color:
        NAVIENTY_NOW_COLORS.text,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 19,
      textAlign:
        'right',
      writingDirection:
        'rtl',
    },

    itemVariant: {
      color:
        NAVIENTY_NOW_COLORS.textMuted,
      fontSize: 9,
      marginTop: 3,
      textAlign:
        'right',
      writingDirection:
        'rtl',
    },

    printJobMeta: {
      color:
        BRAND_GREEN_DARK,
      fontSize: 9,
      fontWeight: '700',
      lineHeight: 15,
      marginTop: 4,
      textAlign:
        'right',
      writingDirection:
        'rtl',
    },

    itemPrice: {
      color:
        NAVIENTY_NOW_COLORS.text,
      fontSize: 11,
      fontWeight: '800',
    },

    printFileSection: {
      marginHorizontal: 16,
      marginTop: 18,
    },

    printFileCard: {
      alignItems: 'center',
      backgroundColor:
        BRAND_GREEN_SOFT,
      borderColor: '#CFEBDD',
      borderRadius: 18,
      borderWidth: 1,
      flexDirection:
        'row-reverse',
      padding: 13,
    },

    printFileIcon: {
      alignItems: 'center',
      backgroundColor:
        NAVIENTY_NOW_COLORS.white,
      borderRadius: 16,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },

    printFileCopy: {
      alignItems: 'flex-end',
      flex: 1,
      marginRight: 11,
    },

    printFileTitle: {
      color:
        NAVIENTY_NOW_COLORS.text,
      fontSize: 13,
      fontWeight: '900',
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    printFileDescription: {
      color: '#486454',
      fontSize: 10,
      lineHeight: 16,
      marginTop: 4,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    printFileButton: {
      alignItems: 'center',
      backgroundColor:
        BRAND_GREEN,
      borderRadius: 16,
      flexDirection:
        'row-reverse',
      gap: 8,
      justifyContent: 'center',
      marginTop: 9,
      minHeight: 54,
      paddingHorizontal: 16,
    },

    printFileButtonPressed: {
      backgroundColor:
        BRAND_GREEN_DARK,
      transform: [
        {
          scale: 0.993,
        },
      ],
    },

    printFileButtonDisabled: {
      opacity: 0.55,
    },

    printFileButtonText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '900',
      writingDirection: 'rtl',
    },

    /* ================================= */
    /* SUMMARY                           */
    /* ================================= */

    summaryTitle: {
      color:
        NAVIENTY_NOW_COLORS.text,
      fontSize: 17,
      fontWeight: '900',
      marginBottom: 11,
      textAlign:
        'right',
      writingDirection:
        'rtl',
    },

    summaryCard: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.white,
      borderColor:
        NAVIENTY_NOW_COLORS.border,
      borderRadius: 19,
      borderWidth: 1,
      padding: 15,
    },

    summaryRow: {
      alignItems:
        'center',
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      marginBottom: 12,
    },

    summaryLabel: {
      color:
        NAVIENTY_NOW_COLORS.textSecondary,
      fontSize: 11,
      writingDirection:
        'rtl',
    },

    summaryValue: {
      color:
        NAVIENTY_NOW_COLORS.text,
      fontSize: 11,
      fontWeight: '700',
    },

    summaryDivider: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.border,
      height:
        StyleSheet.hairlineWidth,
      marginBottom: 13,
    },

    totalRow: {
      alignItems:
        'center',
      flexDirection:
        'row',
      justifyContent:
        'space-between',
    },

    totalLabel: {
      color:
        NAVIENTY_NOW_COLORS.text,
      fontSize: 14,
      fontWeight: '900',
      writingDirection:
        'rtl',
    },

    totalValue: {
      color:
        BRAND_GREEN_DARK,
      fontSize: 17,
      fontWeight: '900',
    },

    /* ================================= */
    /* CANCELLATION                      */
    /* ================================= */

    cancelActionSection: {
      alignItems:
        'center',
      marginTop: -3,
    },

    cancelOrderButton: {
      alignItems:
        'center',
      alignSelf:
        'stretch',
      backgroundColor:
        NAVIENTY_NOW_COLORS.white,
      borderColor:
        NAVIENTY_NOW_COLORS.error,
      borderRadius: 24,
      borderWidth: 1,
      flexDirection:
        'row-reverse',
      gap: 7,
      justifyContent:
        'center',
      minHeight: 50,
    },

    cancelOrderButtonPressed: {
      backgroundColor:
        '#FFF5F5',
      transform: [
        {
          scale: 0.992,
        },
      ],
    },

    cancelOrderButtonDisabled: {
      opacity: 0.55,
    },

    cancelOrderButtonText: {
      color:
        NAVIENTY_NOW_COLORS.error,
      fontSize: 13,
      fontWeight: '900',
      writingDirection:
        'rtl',
    },

    cancelOrderHelper: {
      color:
        NAVIENTY_NOW_COLORS.textMuted,
      fontSize: 9,
      lineHeight: 15,
      marginTop: 8,
      textAlign:
        'center',
      writingDirection:
        'rtl',
    },

    buttonPressed: {
      opacity: 0.7,
    },

    /* ================================= */
    /* STATES                            */
    /* ================================= */

    stateScreen: {
      alignItems:
        'center',
      backgroundColor:
        NAVIENTY_NOW_COLORS.page,
      flex: 1,
      justifyContent:
        'center',
      paddingHorizontal: 28,
    },

    stateIcon: {
      alignItems:
        'center',
      backgroundColor:
        BRAND_GREEN_SOFT,
      borderRadius: 30,
      height: 60,
      justifyContent:
        'center',
      width: 60,
    },

    stateTitle: {
      color:
        NAVIENTY_NOW_COLORS.text,
      fontSize: 19,
      fontWeight: '900',
      marginTop: 15,
      textAlign:
        'center',
      writingDirection:
        'rtl',
    },

    stateDescription: {
      color:
        NAVIENTY_NOW_COLORS.textSecondary,
      fontSize: 12,
      lineHeight: 19,
      marginTop: 6,
      maxWidth: 310,
      textAlign:
        'center',
      writingDirection:
        'rtl',
    },

    statePrimaryButton: {
      alignItems:
        'center',
      backgroundColor:
        BRAND_GREEN,
      borderRadius: 20,
      flexDirection:
        'row-reverse',
      gap: 8,
      justifyContent:
        'center',
      marginTop: 20,
      minHeight: 48,
      minWidth: 170,
      paddingHorizontal: 18,
    },

    stateButtonDisabled: {
      opacity: 0.6,
    },

    statePrimaryButtonText: {
      color:
        NAVIENTY_NOW_COLORS.white,
      fontSize: 13,
      fontWeight: '900',
    },

    stateSecondaryButton: {
      alignItems:
        'center',
      backgroundColor:
        NAVIENTY_NOW_COLORS.white,
      borderColor:
        NAVIENTY_NOW_COLORS.border,
      borderRadius: 20,
      borderWidth: 1,
      justifyContent:
        'center',
      marginTop: 9,
      minHeight: 46,
      minWidth: 170,
      paddingHorizontal: 18,
    },

    stateSecondaryButtonText: {
      color:
        NAVIENTY_NOW_COLORS.text,
      fontSize: 12,
      fontWeight: '800',
    },
  });

import { Ionicons } from '@expo/vector-icons';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import {
  useCallback,
  useEffect,
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OrderDetailsScreenSkeleton } from '../../components/ui/loading-skeleton';
import { getStoreCatalog } from '../../services/catalog-service';
import { getOrderByToken } from '../../services/order-service';
import {
  type Order,
  useOrdersStore,
} from '../../store/orders-store';

type ExtendedOrder = Order & {
  serviceFee?: number | string | null;
  processingFee?: number | string | null;
  paymentFee?: number | string | null;
  electronicPaymentFee?: number | string | null;
};

function toNumber(
  value:
    | number
    | string
    | null
    | undefined,
): number {
  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? value
      : 0;
  }

  const normalized = value
    .replace(/,/g, '')
    .trim();

  const parsed = Number(normalized);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function getCurrencyLabel(
  currencySymbol?: string | null,
): string {
  const symbol =
    currencySymbol?.trim() ?? '';

  const normalized =
    symbol.toUpperCase();

  if (
    !symbol ||
    normalized === 'EGP' ||
    normalized === 'LE' ||
    symbol.includes('ج.م')
  ) {
    return 'ج.م';
  }

  return symbol;
}

function formatMoney(
  value:
    | number
    | string
    | null
    | undefined,
  currencySymbol?: string | null,
): string {
  const amount = toNumber(value);

  return `${amount.toFixed(2)} ${getCurrencyLabel(
    currencySymbol,
  )}`;
}

function formatOrderDateCompact(
  isoDate: string | null,
): string {
  if (!isoDate) {
    return 'غير متاح';
  }

  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return 'غير متاح';
  }

  const day = String(
    date.getDate(),
  ).padStart(2, '0');

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, '0');

  const year = date.getFullYear();

  const hours = String(
    date.getHours(),
  ).padStart(2, '0');

  const minutes = String(
    date.getMinutes(),
  ).padStart(2, '0');

  return `${hours}:${minutes} ${day}/${month}/${year}`;
}

function getServiceFee(
  order: ExtendedOrder,
): number {
  const candidates = [
    order.serviceFee,
    order.processingFee,
    order.paymentFee,
    order.electronicPaymentFee,
  ];

  for (const candidate of candidates) {
    if (
      candidate !== null &&
      candidate !== undefined
    ) {
      const value = toNumber(candidate);

      if (value >= 0) {
        return value;
      }
    }
  }

  const total = toNumber(
    order.total,
  );

  const subtotal = toNumber(
    order.subtotal,
  );

  const deliveryFee = toNumber(
    order.deliveryFee,
  );

  const calculated =
    total -
    subtotal -
    deliveryFee;

  if (
    !Number.isFinite(calculated) ||
    calculated <= 0
  ) {
    return 0;
  }

  return calculated;
}

function cleanText(
  value?: string | null,
): string | null {
  if (!value) {
    return null;
  }

  const trimmed =
    value.trim();

  return trimmed.length > 0
    ? trimmed
    : null;
}

function getBestStoreImageUrl(
  logoUrl?: string | null,
  coverImageUrl?: string | null,
): string | null {
  const normalizedLogo =
    cleanText(logoUrl);

  if (normalizedLogo) {
    return normalizedLogo;
  }

  return cleanText(
    coverImageUrl,
  );
}

export default function OrderDetailsScreen() {
  const router = useRouter();

  const insets =
    useSafeAreaInsets();

  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(false);

  const [
    refreshError,
    setRefreshError,
  ] = useState<string | null>(
    null,
  );

  const [
    storeImageUrl,
    setStoreImageUrl,
  ] = useState<string | null>(
    null,
  );

  const [
    isLoadingStoreImage,
    setIsLoadingStoreImage,
  ] = useState(false);

  const [
    storeImageFailed,
    setStoreImageFailed,
  ] = useState(false);

  const params =
    useLocalSearchParams<{
      id?: string | string[];
    }>();

  const orderId = Array.isArray(
    params.id,
  )
    ? params.id[0]
    : params.id;

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
          (state.pendingOrder?.id ===
          orderId
            ? state.pendingOrder
            : null)
        );
      },
    );

  const refreshOrder =
    useCallback(async () => {
      if (!orderId) {
        setRefreshError(
          'رقم الطلب غير موجود.',
        );

        return;
      }

      const state =
        useOrdersStore.getState();

      const savedOrder =
        state.orders.find(
          (currentOrder) =>
            currentOrder.id ===
            orderId,
        ) ??
        (state.pendingOrder?.id ===
        orderId
          ? state.pendingOrder
          : null);

      if (!savedOrder) {
        setRefreshError(
          'لم يتم العثور على مرجع الطلب على هذا الجهاز.',
        );

        return;
      }

      try {
        setIsRefreshing(true);
        setRefreshError(null);

        const latestOrder =
          await getOrderByToken(
            savedOrder.accessToken,
          );

        const latestState =
          useOrdersStore.getState();

        if (
          latestState.pendingOrder
            ?.id === latestOrder.id
        ) {
          if (
            latestOrder.status ===
            'awaiting-whatsapp-send'
          ) {
            latestState.setPendingOrder(
              latestOrder,
            );
          } else {
            latestState.confirmPendingOrder(
              latestOrder,
            );
          }
        } else {
          latestState.upsertOrder(
            latestOrder,
          );
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'تعذر تحديث بيانات الطلب.';

        setRefreshError(
          message,
        );
      } finally {
        setIsRefreshing(false);
      }
    }, [orderId]);

  /*
   * تحميل صورة المتجر الحقيقية.
   *
   * Order نفسه لا يحتوي على logoUrl،
   * لذلك نستخدم storeId لجلب بيانات
   * المتجر من catalog-service.
   */
  useEffect(() => {
    let isCancelled = false;

    async function loadStoreImage() {
      if (
        !order?.storeId
      ) {
        setStoreImageUrl(null);
        return;
      }

      try {
        setIsLoadingStoreImage(true);
        setStoreImageFailed(false);

        const catalog =
          await getStoreCatalog(
            order.storeId,
            order.serviceAreaId ||
              undefined,
          );

        if (isCancelled) {
          return;
        }

        const imageUrl =
          getBestStoreImageUrl(
            catalog.store.logoUrl,
            catalog.store
              .coverImageUrl,
          );

        setStoreImageUrl(
          imageUrl,
        );
      } catch {
        if (isCancelled) {
          return;
        }

        setStoreImageUrl(
          null,
        );
      } finally {
        if (!isCancelled) {
          setIsLoadingStoreImage(
            false,
          );
        }
      }
    }

    void loadStoreImage();

    return () => {
      isCancelled = true;
    };
  }, [
    order?.storeId,
    order?.serviceAreaId,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (!hasHydrated) {
        return;
      }

      void refreshOrder();
    }, [
      hasHydrated,
      refreshOrder,
    ]),
  );

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/orders');
  }

  function goToOrders() {
    router.replace('/orders');
  }

  if (
    !hasHydrated ||
    (isRefreshing && !order)
  ) {
    return (
      <OrderDetailsScreenSkeleton />
    );
  }

  if (!order) {
    return (
      <View
        style={[
          styles.emptyScreen,
          {
            paddingTop:
              insets.top + 20,

            paddingBottom:
              insets.bottom + 20,
          },
        ]}
      >
        <View
          style={
            styles.emptyIconContainer
          }
        >
          <Ionicons
            name="receipt-outline"
            size={25}
            color="#222222"
          />
        </View>

        <Text
          style={styles.emptyTitle}
        >
          لم يتم العثور على الطلب
        </Text>

        <Text
          style={
            styles.emptyDescription
          }
        >
          {refreshError ??
            'قد يكون الطلب غير موجود أو تمت إزالته من سجل الطلبات على هذا الجهاز.'}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.retryButton,

            pressed &&
              styles.buttonPressed,

            isRefreshing &&
              styles.buttonDisabled,
          ]}
          disabled={isRefreshing}
          onPress={() => {
            void refreshOrder();
          }}
        >
          {isRefreshing ? (
            <ActivityIndicator
              color="#ffffff"
              size="small"
            />
          ) : (
            <Text
              style={
                styles.retryButtonText
              }
            >
              إعادة المحاولة
            </Text>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.ordersButton,

            pressed &&
              styles.buttonPressed,
          ]}
          onPress={goToOrders}
        >
          <Text
            style={
              styles.ordersButtonText
            }
          >
            العودة إلى طلباتي
          </Text>
        </Pressable>
      </View>
    );
  }

  const extendedOrder =
    order as ExtendedOrder;

  const serviceFee =
    getServiceFee(
      extendedOrder,
    );

  const orderDate =
    formatOrderDateCompact(
      order.submittedAt ??
        order.createdAt,
    );

  const customerName =
    cleanText(
      order.customerName,
    ) ?? 'غير محدد';

  const phoneNumber =
    cleanText(
      order.phoneNumber,
    ) ?? 'غير محدد';

  const deliveryArea =
    cleanText(
      order.area,
    );

  const deliveryAddress =
    cleanText(
      order.address,
    );

  const deliveryLandmark =
    cleanText(
      order.landmark,
    );

  const addressLines = [
    deliveryArea,
    deliveryAddress,
    deliveryLandmark,
  ].filter(
    (
      value,
    ): value is string =>
      Boolean(value),
  );

  const shouldShowStoreImage =
    Boolean(storeImageUrl) &&
    !storeImageFailed;

  return (
    <View
      style={styles.screen}
    >
      <ScrollView
        style={
          styles.scrollView
        }
        contentContainerStyle={[
          styles.pageContent,
          {
            paddingTop:
              insets.top + 10,

            paddingBottom:
              Math.max(
                insets.bottom,
                16,
              ) + 20,
          },
        ]}
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={styles.container}
        >
          {/* Header */}
          <View
            style={styles.header}
          >
            <View
              style={
                styles.headerPlaceholder
              }
            />

            <Text
              style={styles.pageTitle}
            >
              تفاصيل الطلب
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="العودة"
              style={({ pressed }) => [
                styles.backButton,

                pressed &&
                  styles.buttonPressed,
              ]}
              hitSlop={10}
              onPress={goBack}
            >
              <Ionicons
                name="arrow-forward"
                size={21}
                color="#171717"
              />
            </Pressable>
          </View>

          {refreshError && (
            <View
              style={
                styles.warningContainer
              }
            >
              <Ionicons
                name="warning-outline"
                size={14}
                color="#9a6214"
              />

              <Text
                style={
                  styles.warningText
                }
              >
                {refreshError}
              </Text>
            </View>
          )}

          {/* Store */}
          <View
            style={
              styles.storeSection
            }
          >
            <View
              style={
                styles.storeImageWrapper
              }
            >
              {shouldShowStoreImage ? (
                <Image
                  source={{
                    uri:
                      storeImageUrl ??
                      undefined,
                  }}
                  style={
                    styles.storeImage
                  }
                  resizeMode="cover"
                  fadeDuration={150}
                  onError={() => {
                    setStoreImageFailed(
                      true,
                    );
                  }}
                />
              ) : (
                <View
                  style={
                    styles.storeImageFallback
                  }
                >
                  {isLoadingStoreImage ? (
                    <ActivityIndicator
                      size="small"
                      color="#a4a4a4"
                    />
                  ) : (
                    <Text
                      style={
                        styles.storeFallbackIcon
                      }
                    >
                      {order.storeIcon ||
                        '🏪'}
                    </Text>
                  )}
                </View>
              )}
            </View>

            <View
              style={
                styles.storeInfo
              }
            >
              <Text
                style={
                  styles.storeName
                }
                numberOfLines={2}
              >
                {order.storeName}
              </Text>

              <Text
                style={
                  styles.orderDate
                }
              >
                {orderDate}
              </Text>

              <Text
                style={
                  styles.orderNumber
                }
                selectable
              >
                رقم الطلب:{' '}
                {order.orderCode}
              </Text>
            </View>
          </View>

          <View
            style={styles.divider}
          />

          {/* Delivery Address */}
          <View
            style={
              styles.deliverySection
            }
          >
            <View
              style={
                styles.deliveryTitleRow
              }
            >
              <Ionicons
                name="location-outline"
                size={22}
                color="#171717"
              />

              <Text
                style={
                  styles.sectionTitle
                }
              >
                عنوان التوصيل
              </Text>
            </View>

            <View
              style={
                styles.deliveryContent
              }
            >
              <Text
                style={
                  styles.customerName
                }
                selectable
              >
                {customerName}
              </Text>

              {addressLines.length >
              0 ? (
                addressLines.map(
                  (
                    line,
                    index,
                  ) => (
                    <Text
                      key={`${line}-${index}`}
                      style={
                        styles.addressLine
                      }
                      selectable
                    >
                      {line}
                    </Text>
                  ),
                )
              ) : (
                <Text
                  style={
                    styles.addressLine
                  }
                >
                  العنوان غير محدد
                </Text>
              )}

              <Text
                style={
                  styles.phoneLine
                }
                selectable
              >
                رقم الهاتف المتنقل:{' '}
                {phoneNumber}
              </Text>
            </View>
          </View>

          <View
            style={styles.divider}
          />

          {/* Order Details */}
          <View
            style={
              styles.orderDetailsSection
            }
          >
            <Text
              style={
                styles.orderDetailsTitle
              }
            >
              تفاصيل الطلب
            </Text>

            <View
              style={
                styles.itemsContainer
              }
            >
              {order.items.map(
                (item) => (
                  <View
                    key={item.id}
                    style={
                      styles.itemRow
                    }
                  >
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

                    <View
                      style={
                        styles.itemNameGroup
                      }
                    >
                      <Text
                        style={
                          styles.itemQuantity
                        }
                      >
                        x {item.quantity}
                      </Text>

                      <Text
                        style={
                          styles.itemName
                        }
                      >
                        {item.name}
                      </Text>
                    </View>
                  </View>
                ),
              )}
            </View>

            {/* Summary */}
            <View
              style={
                styles.summaryContainer
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
                  المجموع
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
                  رسوم التوصيل
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
                    serviceFee,
                    order.currencySymbol,
                  )}
                </Text>

                <Text
                  style={
                    styles.summaryLabel
                  }
                >
                  رسوم الخدمة
                </Text>
              </View>

              <View
                style={[
                  styles.summaryRow,
                  styles.totalSummaryRow,
                ]}
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
                  قيمة الطلب
                </Text>
              </View>

              <View
                style={[
                  styles.summaryRow,
                  styles.paymentRow,
                ]}
              >
                <Text
                  style={
                    styles.paymentValue
                  }
                >
                  {order.paymentMethodTitle ||
                    'غير محدد'}
                </Text>

                <Text
                  style={
                    styles.paymentLabel
                  }
                >
                  طريقة الدفع
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      backgroundColor: '#ffffff',
      flex: 1,
    },

    scrollView: {
      backgroundColor: '#ffffff',
      flex: 1,
    },

    pageContent: {
      flexGrow: 1,
      paddingHorizontal: 20,
    },

    container: {
      alignSelf: 'center',
      maxWidth: 580,
      width: '100%',
    },

    /*
     * Header
     */
    header: {
      alignItems: 'center',
      direction: 'ltr',
      flexDirection: 'row',
      minHeight: 50,
      width: '100%',
    },

    headerPlaceholder: {
      height: 44,
      width: 44,
    },

    pageTitle: {
      color: '#171717',
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      lineHeight: 24,
      textAlign: 'center',
      writingDirection: 'rtl',
    },

    backButton: {
      alignItems: 'center',
      backgroundColor: '#ffffff',
      borderColor: '#e2e2e2',
      borderRadius: 22,
      borderWidth: 1,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },

    /*
     * Warning
     */
    warningContainer: {
      alignItems: 'center',
      alignSelf: 'stretch',
      backgroundColor: '#fff8e9',
      borderRadius: 9,
      flexDirection: 'row-reverse',
      gap: 6,
      marginTop: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },

    warningText: {
      color: '#8a5b18',
      flex: 1,
      fontSize: 9.5,
      lineHeight: 15,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    /*
     * Store
     */
    storeSection: {
      alignItems: 'flex-start',
      direction: 'ltr',
      flexDirection: 'row-reverse',
      marginTop: 22,
      width: '100%',
    },

    storeImageWrapper: {
      borderRadius: 11,
      height: 58,
      overflow: 'hidden',
      width: 58,
    },

    storeImage: {
      backgroundColor: '#f5f5f5',
      height: '100%',
      width: '100%',
    },

    storeImageFallback: {
      alignItems: 'center',
      backgroundColor: '#f3f3f3',
      height: '100%',
      justifyContent: 'center',
      width: '100%',
    },

    storeFallbackIcon: {
      fontSize: 23,
    },

    storeInfo: {
      flex: 1,
      marginRight: 13,
      paddingTop: 0,
    },

    storeName: {
      color: '#191919',
      fontSize: 17,
      fontWeight: '700',
      lineHeight: 22,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    orderDate: {
      color: '#454545',
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 18,
      marginTop: 1,
      textAlign: 'right',
      writingDirection: 'ltr',
    },

    orderNumber: {
      color: '#454545',
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 18,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    divider: {
      backgroundColor: '#e9e9e9',
      height:
        StyleSheet.hairlineWidth,
      marginVertical: 19,
      width: '100%',
    },

    /*
     * Delivery
     */
    deliverySection: {
      width: '100%',
    },

    deliveryTitleRow: {
      alignItems: 'center',
      alignSelf: 'stretch',
      direction: 'ltr',
      flexDirection: 'row-reverse',
    },

    sectionTitle: {
      color: '#171717',
      flex: 1,
      fontSize: 19,
      fontWeight: '700',
      lineHeight: 26,
      marginRight: 9,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    deliveryContent: {
      alignItems: 'flex-end',
      marginTop: 3,
      paddingRight: 31,
      width: '100%',
    },

    customerName: {
      color: '#272727',
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 21,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    addressLine: {
      color: '#343434',
      fontSize: 13,
      fontWeight: '400',
      lineHeight: 20,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    phoneLine: {
      color: '#343434',
      fontSize: 13,
      fontWeight: '400',
      lineHeight: 20,
      marginTop: 1,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    /*
     * Order details
     */
    orderDetailsSection: {
      width: '100%',
    },

    orderDetailsTitle: {
      color: '#171717',
      fontSize: 20,
      fontWeight: '700',
      lineHeight: 27,
      marginBottom: 18,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    itemsContainer: {
      width: '100%',
    },

    itemRow: {
      alignItems: 'flex-start',
      direction: 'ltr',
      flexDirection: 'row',
      justifyContent:
        'space-between',
      minHeight: 41,
      width: '100%',
    },

    itemPrice: {
      color: '#303030',
      fontSize: 12.5,
      fontWeight: '400',
      lineHeight: 19,
      minWidth: 78,
      textAlign: 'left',
      writingDirection: 'ltr',
    },

    itemNameGroup: {
      alignItems: 'flex-start',
      direction: 'ltr',
      flex: 1,
      flexDirection: 'row-reverse',
      justifyContent: 'flex-start',
      marginLeft: 14,
    },

    itemQuantity: {
      color: '#303030',
      fontSize: 12.5,
      fontWeight: '400',
      lineHeight: 19,
      marginLeft: 6,
      writingDirection: 'ltr',
    },

    itemName: {
      color: '#303030',
      flexShrink: 1,
      fontSize: 12.5,
      fontWeight: '400',
      lineHeight: 19,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    /*
     * Summary
     */
    summaryContainer: {
      marginTop: 2,
      width: '100%',
    },

    summaryRow: {
      alignItems: 'center',
      direction: 'ltr',
      flexDirection: 'row',
      justifyContent:
        'space-between',
      minHeight: 39,
      width: '100%',
    },

    summaryLabel: {
      color: '#333333',
      flex: 1,
      fontSize: 13,
      fontWeight: '400',
      lineHeight: 20,
      marginLeft: 16,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    summaryValue: {
      color: '#333333',
      fontSize: 12.5,
      fontWeight: '400',
      lineHeight: 19,
      minWidth: 85,
      textAlign: 'left',
      writingDirection: 'ltr',
    },

    totalSummaryRow: {
      marginTop: 1,
    },

    totalLabel: {
      color: '#1e1e1e',
      flex: 1,
      fontSize: 13.5,
      fontWeight: '500',
      lineHeight: 21,
      marginLeft: 16,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    totalValue: {
      color: '#1e1e1e',
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 20,
      minWidth: 85,
      textAlign: 'left',
      writingDirection: 'ltr',
    },

    paymentRow: {
      alignItems: 'flex-start',
      marginTop: 1,
    },

    paymentLabel: {
      color: '#222222',
      flex: 1,
      fontSize: 13,
      fontWeight: '400',
      lineHeight: 20,
      marginLeft: 16,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    paymentValue: {
      color: '#333333',
      fontSize: 12.5,
      fontWeight: '400',
      lineHeight: 20,
      maxWidth: '48%',
      minWidth: 85,
      textAlign: 'left',
      writingDirection: 'rtl',
    },

    /*
     * Empty state
     */
    emptyScreen: {
      alignItems: 'center',
      backgroundColor: '#ffffff',
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
    },

    emptyIconContainer: {
      alignItems: 'center',
      backgroundColor: '#f4f4f4',
      borderRadius: 34,
      height: 68,
      justifyContent: 'center',
      width: 68,
    },

    emptyTitle: {
      color: '#1d1d1d',
      fontSize: 18,
      fontWeight: '700',
      marginTop: 16,
      textAlign: 'center',
      writingDirection: 'rtl',
    },

    emptyDescription: {
      color: '#777777',
      fontSize: 11,
      lineHeight: 18,
      marginTop: 7,
      maxWidth: 330,
      textAlign: 'center',
      writingDirection: 'rtl',
    },

    retryButton: {
      alignItems: 'center',
      backgroundColor: '#171717',
      borderRadius: 10,
      justifyContent: 'center',
      marginTop: 18,
      minHeight: 43,
      minWidth: 200,
      paddingHorizontal: 18,
    },

    retryButtonText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '700',
    },

    ordersButton: {
      alignItems: 'center',
      backgroundColor: '#ffffff',
      borderColor: '#dddddd',
      borderRadius: 10,
      borderWidth: 1,
      justifyContent: 'center',
      marginTop: 9,
      minHeight: 43,
      minWidth: 200,
      paddingHorizontal: 18,
    },

    ordersButtonText: {
      color: '#222222',
      fontSize: 12,
      fontWeight: '700',
    },

    buttonPressed: {
      opacity: 0.6,
    },

    buttonDisabled: {
      opacity: 0.6,
    },
  });
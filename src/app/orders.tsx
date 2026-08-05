import {
    useFocusEffect,
    useRouter,
} from 'expo-router';
import {
    useCallback,
    useMemo,
    useState,
} from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { getOrderByToken } from '../services/order-service';
import {
    type Order,
    type OrderStatus,
    useOrdersStore,
} from '../store/orders-store';

type StatusPresentation = {
  title: string;
  backgroundColor: string;
  textColor: string;
  dotColor: string;
};

const statusPresentation: Record<
  OrderStatus,
  StatusPresentation
> = {
  'awaiting-whatsapp-send': {
    title: 'في انتظار إرسال واتساب',
    backgroundColor: '#fff3d6',
    textColor: '#7a5a13',
    dotColor: '#e5a328',
  },

  'waiting-confirmation': {
    title: 'في انتظار التأكيد',
    backgroundColor: '#f1efff',
    textColor: '#4f3db8',
    dotColor: '#6d56df',
  },

  confirmed: {
    title: 'تم التأكيد',
    backgroundColor: '#e9f7ee',
    textColor: '#246343',
    dotColor: '#25a952',
  },

  preparing: {
    title: 'جاري التجهيز',
    backgroundColor: '#fff3d6',
    textColor: '#7a5a13',
    dotColor: '#e5a328',
  },

  'out-for-delivery': {
    title: 'خرج للتوصيل',
    backgroundColor: '#eaf4ff',
    textColor: '#245f91',
    dotColor: '#3d8fd1',
  },

  delivered: {
    title: 'تم التوصيل',
    backgroundColor: '#e9f7ee',
    textColor: '#246343',
    dotColor: '#25a952',
  },

  cancelled: {
    title: 'ملغي',
    backgroundColor: '#fdecec',
    textColor: '#9a3333',
    dotColor: '#d64b4b',
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
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return 'تاريخ غير متاح';
  }

  const day = date.getDate();
  const month =
    arabicMonthNames[date.getMonth()];
  const year = date.getFullYear();

  let hours = date.getHours();

  const minutes = String(
    date.getMinutes(),
  ).padStart(2, '0');

  const period =
    hours >= 12 ? 'م' : 'ص';

  hours %= 12;

  if (hours === 0) {
    hours = 12;
  }

  return `${day} ${month} ${year} • ${hours}:${minutes} ${period}`;
}

function OrderCard({
  order,
  onPress,
}: {
  order: Order;
  onPress: () => void;
}) {
  const status =
    statusPresentation[order.status];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        `فتح تفاصيل الطلب ${order.orderCode}`
      }
      style={({ pressed }) => [
        styles.orderCard,
        pressed &&
          styles.orderCardPressed,
      ]}
      onPress={onPress}
    >
      <View
        style={styles.orderCardHeader}
      >
        <View
          style={
            styles.storeIconContainer
          }
        >
          <Text style={styles.storeIcon}>
            {order.storeIcon || '🏪'}
          </Text>
        </View>

        <View
          style={
            styles.orderHeaderContent
          }
        >
          <Text
            style={styles.storeName}
            numberOfLines={1}
          >
            {order.storeName}
          </Text>

          <Text
            style={styles.orderDate}
            numberOfLines={1}
          >
            {formatOrderDate(
              order.submittedAt ??
                order.createdAt,
            )}
          </Text>
        </View>
      </View>

      <View
        style={styles.orderNumberRow}
      >
        <Text
          style={
            styles.orderNumberValue
          }
          selectable
        >
          {order.orderCode}
        </Text>

        <Text
          style={
            styles.orderNumberLabel
          }
        >
          رقم الطلب
        </Text>
      </View>

      <View
        style={styles.orderDivider}
      />

      <View
        style={styles.orderMetaRow}
      >
        <View
          style={styles.orderMetaItem}
        >
          <Text
            style={
              styles.orderMetaValue
            }
          >
            {order.itemCount}
          </Text>

          <Text
            style={
              styles.orderMetaLabel
            }
          >
            عدد المنتجات
          </Text>
        </View>

        <View
          style={
            styles.orderMetaDivider
          }
        />

        <View
          style={styles.orderMetaItem}
        >
          <Text
            style={
              styles.orderMetaValue
            }
          >
            {order.total}{' '}
            {order.currencySymbol}
          </Text>

          <Text
            style={
              styles.orderMetaLabel
            }
          >
            الإجمالي
          </Text>
        </View>
      </View>

      <View
        style={styles.orderFooter}
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
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  status.dotColor,
              },
            ]}
          />

          <Text
            style={[
              styles.statusText,
              {
                color:
                  status.textColor,
              },
            ]}
          >
            {status.title}
          </Text>
        </View>

        <View
          style={styles.detailsLink}
        >
          <Text
            style={
              styles.detailsLinkText
            }
          >
            عرض التفاصيل
          </Text>

          <Text
            style={
              styles.detailsLinkArrow
            }
          >
            ‹
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function OrdersScreen() {
  const router = useRouter();

  const orders = useOrdersStore(
    (state) => state.orders,
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

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [
    refreshMessage,
    setRefreshMessage,
  ] = useState<string | null>(null);

  const refreshOrders =
    useCallback(async () => {
      const state =
        useOrdersStore.getState();

      const savedOrders =
        state.orders;

      const savedPendingOrder =
        state.pendingOrder;

      if (
        savedOrders.length === 0 &&
        !savedPendingOrder
      ) {
        setRefreshMessage(null);
        return;
      }

      try {
        setIsRefreshing(true);
        setRefreshMessage(null);

        const refreshTasks =
          savedOrders.map(
            async (savedOrder) => {
              const latestOrder =
                await getOrderByToken(
                  savedOrder.accessToken,
                );

              useOrdersStore
                .getState()
                .upsertOrder(
                  latestOrder,
                );
            },
          );

        if (savedPendingOrder) {
          refreshTasks.push(
            (async () => {
              const latestPendingOrder =
                await getOrderByToken(
                  savedPendingOrder
                    .accessToken,
                );

              const latestState =
                useOrdersStore
                  .getState();

              if (
                latestPendingOrder.status ===
                'awaiting-whatsapp-send'
              ) {
                latestState.setPendingOrder(
                  latestPendingOrder,
                );

                return;
              }

              latestState
                .confirmPendingOrder(
                  latestPendingOrder,
                );
            })(),
          );
        }

        const results =
          await Promise.allSettled(
            refreshTasks,
          );

        const failedCount =
          results.filter(
            (result) =>
              result.status ===
              'rejected',
          ).length;

        if (failedCount > 0) {
          setRefreshMessage(
            failedCount ===
              results.length
              ? 'تعذر تحديث الطلبات من Supabase. البيانات المعروضة هي آخر نسخة محفوظة على الجهاز.'
              : `تم تحديث بعض الطلبات، وتعذر تحديث ${failedCount} طلب.`,
          );
        }
      } finally {
        setIsRefreshing(false);
      }
    }, []);

  useFocusEffect(
    useCallback(() => {
      if (!hasHydrated) {
        return;
      }

      void refreshOrders();
    }, [
      hasHydrated,
      refreshOrders,
    ]),
  );

  const sortedOrders = useMemo(
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
    [orders],
  );

  const activeOrdersCount =
    useMemo(
      () =>
        orders.filter(
          (order) =>
            order.status !==
              'delivered' &&
            order.status !==
              'cancelled',
        ).length,
      [orders],
    );

  function returnToHome() {
    router.replace('/');
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
      pathname: '/order/[id]',
      params: {
        id: orderId,
      },
    });
  }

  if (!hasHydrated) {
    return (
      <View style={styles.stateScreen}>
        <ActivityIndicator
          size="large"
          color="#6d56df"
        />

        <Text style={styles.stateTitle}>
          جاري تحميل طلباتك
        </Text>

        <Text
          style={
            styles.stateDescription
          }
        >
          يتم استعادة الطلبات المحفوظة
          على هذا الجهاز.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.pageContent
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed &&
                styles.buttonPressed,
            ]}
            onPress={() =>
              router.back()
            }
          >
            <Text style={styles.backIcon}>
              ›
            </Text>
          </Pressable>

          <View
            style={
              styles.titleContainer
            }
          >
            <Text style={styles.pageTitle}>
              طلباتي
            </Text>

            <Text
              style={
                styles.pageSubtitle
              }
            >
              آخر حالة من Supabase
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.refreshButton,
              pressed &&
                !isRefreshing &&
                styles.buttonPressed,
            ]}
            disabled={isRefreshing}
            onPress={() => {
              void refreshOrders();
            }}
          >
            {isRefreshing ? (
              <ActivityIndicator
                size="small"
                color="#5d47d2"
              />
            ) : (
              <Text
                style={
                  styles.refreshIcon
                }
              >
                ↻
              </Text>
            )}
          </Pressable>
        </View>

        {isRefreshing &&
          sortedOrders.length > 0 && (
            <View
              style={
                styles.refreshingCard
              }
            >
              <ActivityIndicator
                size="small"
                color="#5d47d2"
              />

              <Text
                style={
                  styles.refreshingText
                }
              >
                جاري تحديث حالات
                الطلبات من Supabase...
              </Text>
            </View>
          )}

        {refreshMessage && (
          <View
            style={styles.warningCard}
          >
            <Text
              style={
                styles.warningText
              }
            >
              {refreshMessage}
            </Text>

            <Text
              style={
                styles.warningIcon
              }
            >
              ⚠️
            </Text>
          </View>
        )}

        {pendingOrder && (
          <View
            style={styles.pendingCard}
          >
            <View
              style={
                styles.pendingCardHeader
              }
            >
              <View
                style={
                  styles.pendingIconContainer
                }
              >
                <Text
                  style={
                    styles.pendingIcon
                  }
                >
                  💬
                </Text>
              </View>

              <View
                style={
                  styles.pendingCardContent
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
                  style={
                    styles.pendingDescription
                  }
                >
                  أكد هل أرسلت رسالة
                  الطلب على واتساب قبل
                  بدء طلب جديد.
                </Text>
              </View>
            </View>

            <View
              style={
                styles.pendingOrderRow
              }
            >
              <Text
                style={
                  styles.pendingOrderValue
                }
                selectable
              >
                {pendingOrder.orderCode}
              </Text>

              <Text
                style={
                  styles.pendingOrderLabel
                }
              >
                رقم الطلب
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
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
                استكمال تأكيد الإرسال
              </Text>
            </Pressable>
          </View>
        )}

        {sortedOrders.length > 0 && (
          <View
            style={styles.summaryCard}
          >
            <View
              style={
                styles.summaryItem
              }
            >
              <Text
                style={
                  styles.summaryValue
                }
              >
                {orders.length}
              </Text>

              <Text
                style={
                  styles.summaryLabel
                }
              >
                إجمالي الطلبات
              </Text>
            </View>

            <View
              style={
                styles.summaryDivider
              }
            />

            <View
              style={
                styles.summaryItem
              }
            >
              <Text
                style={
                  styles.summaryValue
                }
              >
                {activeOrdersCount}
              </Text>

              <Text
                style={
                  styles.summaryLabel
                }
              >
                طلبات نشطة
              </Text>
            </View>
          </View>
        )}

        {sortedOrders.length ===
        0 ? (
          <View style={styles.emptyCard}>
            {isRefreshing ? (
              <ActivityIndicator
                size="large"
                color="#6d56df"
              />
            ) : (
              <View
                style={
                  styles.emptyIconContainer
                }
              >
                <Text
                  style={
                    styles.emptyIcon
                  }
                >
                  🧾
                </Text>
              </View>
            )}

            <Text
              style={styles.emptyTitle}
            >
              لا توجد طلبات محفوظة
            </Text>

            <Text
              style={
                styles.emptyDescription
              }
            >
              بعد إرسال أول طلب وتأكيد
              إرساله عبر واتساب، سيظهر
              هنا تلقائيًا.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.shopButton,
                pressed &&
                  styles.buttonPressed,
              ]}
              onPress={returnToHome}
            >
              <Text
                style={
                  styles.shopButtonText
                }
              >
                العودة للتسوق
              </Text>
            </Pressable>
          </View>
        ) : (
          <View
            style={styles.ordersSection}
          >
            <Text
              style={styles.sectionTitle}
            >
              سجل الطلبات
            </Text>

            <View
              style={styles.ordersList}
            >
              {sortedOrders.map(
                (order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onPress={() =>
                      openOrderDetails(
                        order.id,
                      )
                    }
                  />
                ),
              )}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#f7f7fa',
    flex: 1,
  },

  pageContent: {
    flexGrow: 1,
    paddingBottom: 40,
    paddingHorizontal: 18,
    paddingTop: 42,
  },

  container: {
    alignSelf: 'center',
    maxWidth: 520,
    width: '100%',
  },

  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  backButton: {
    alignItems: 'center',
    backgroundColor: '#eeeafd',
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },

  backIcon: {
    color: '#5d47d2',
    fontSize: 33,
    lineHeight: 35,
  },

  titleContainer: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 12,
  },

  pageTitle: {
    color: '#202025',
    fontSize: 23,
    fontWeight: '900',
    textAlign: 'center',
  },

  pageSubtitle: {
    color: '#898992',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },

  topBarPlaceholder: {
    height: 44,
    width: 44,
  },

  pendingCard: {
    backgroundColor: '#fff3d6',
    borderColor: '#f1d58f',
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 25,
    padding: 17,
  },

  pendingCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },

  pendingIconContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 15,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },

  pendingIcon: {
    fontSize: 25,
  },

  pendingCardContent: {
    flex: 1,
    marginLeft: 13,
  },

  pendingTitle: {
    color: '#7a5a13',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },

  pendingDescription: {
    color: '#977329',
    fontSize: 10,
    lineHeight: 17,
    marginTop: 4,
    textAlign: 'right',
  },

  pendingOrderRow: {
    alignItems: 'center',
    backgroundColor: '#fff9ec',
    borderRadius: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  pendingOrderValue: {
    color: '#7a5a13',
    fontSize: 11,
    fontWeight: '900',
  },

  pendingOrderLabel: {
    color: '#977329',
    fontSize: 10,
  },

  pendingButton: {
    alignItems: 'center',
    backgroundColor: '#e5a328',
    borderRadius: 14,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  pendingButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },

  summaryCard: {
    alignItems: 'center',
    backgroundColor: '#6d56df',
    borderRadius: 22,
    flexDirection: 'row',
    marginTop: 20,
    paddingVertical: 18,
  },

  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },

  summaryValue: {
    color: '#ffffff',
    fontSize: 21,
    fontWeight: '900',
  },

  summaryLabel: {
    color: '#e6e2ff',
    fontSize: 10,
    marginTop: 4,
  },

  summaryDivider: {
    backgroundColor: '#8e7ae8',
    height: 38,
    width: 1,
  },

  ordersSection: {
    marginTop: 27,
  },

  sectionTitle: {
    color: '#202025',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 14,
    textAlign: 'right',
  },

  ordersList: {
    gap: 14,
  },

  orderCard: {
    backgroundColor: '#ffffff',
    borderColor: '#ececf1',
    borderRadius: 22,
    borderWidth: 1,
    padding: 17,
  },

  orderCardPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },

  orderCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },

  storeIconContainer: {
    alignItems: 'center',
    backgroundColor: '#f1efff',
    borderRadius: 16,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },

  storeIcon: {
    fontSize: 28,
  },

  orderHeaderContent: {
    flex: 1,
    marginLeft: 13,
  },

  storeName: {
    color: '#24242a',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
  },

  orderDate: {
    color: '#898992',
    fontSize: 9,
    marginTop: 5,
    textAlign: 'right',
  },

  orderNumberRow: {
    alignItems: 'center',
    backgroundColor: '#f7f7fa',
    borderRadius: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  orderNumberValue: {
    color: '#5d47d2',
    fontSize: 11,
    fontWeight: '900',
  },

  orderNumberLabel: {
    color: '#898992',
    fontSize: 10,
  },

  orderDivider: {
    backgroundColor: '#eeeeF2',
    height: 1,
    marginVertical: 15,
  },

  orderMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },

  orderMetaItem: {
    alignItems: 'center',
    flex: 1,
  },

  orderMetaValue: {
    color: '#303036',
    fontSize: 15,
    fontWeight: '900',
  },

  orderMetaLabel: {
    color: '#898992',
    fontSize: 9,
    marginTop: 4,
  },

  orderMetaDivider: {
    backgroundColor: '#e5e5eb',
    height: 32,
    width: 1,
  },

  orderFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },

  statusBadge: {
    alignItems: 'center',
    borderRadius: 13,
    flexDirection: 'row',
    paddingHorizontal: 11,
    paddingVertical: 8,
  },

  statusDot: {
    borderRadius: 4,
    height: 8,
    marginRight: 7,
    width: 8,
  },

  statusText: {
    fontSize: 10,
    fontWeight: '900',
  },

  detailsLink: {
    alignItems: 'center',
    flexDirection: 'row',
  },

  detailsLinkText: {
    color: '#6d56df',
    fontSize: 10,
    fontWeight: '900',
  },

  detailsLinkArrow: {
    color: '#6d56df',
    fontSize: 22,
    lineHeight: 24,
    marginLeft: 5,
  },

  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 26,
    marginTop: 30,
    padding: 25,
  },

  emptyIconContainer: {
    alignItems: 'center',
    backgroundColor: '#eeeafd',
    borderRadius: 42,
    height: 84,
    justifyContent: 'center',
    width: 84,
  },

  emptyIcon: {
    fontSize: 39,
  },

  emptyTitle: {
    color: '#222228',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 19,
    textAlign: 'center',
  },

  emptyDescription: {
    color: '#777781',
    fontSize: 12,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 340,
    textAlign: 'center',
  },

  shopButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#6d56df',
    borderRadius: 16,
    marginTop: 21,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },

  shopButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },

  buttonPressed: {
    opacity: 0.75,
  },


  refreshButton: {
    alignItems: 'center',
    backgroundColor: '#eeeafd',
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },

  refreshIcon: {
    color: '#5d47d2',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 27,
  },

  refreshingCard: {
    alignItems: 'center',
    backgroundColor: '#f1efff',
    borderRadius: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },

  refreshingText: {
    color: '#5d47d2',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 9,
    textAlign: 'right',
  },

  warningCard: {
    alignItems: 'center',
    backgroundColor: '#fff3d6',
    borderRadius: 15,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  warningText: {
    color: '#7a5a13',
    flex: 1,
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 17,
    textAlign: 'right',
  },

  warningIcon: {
    fontSize: 18,
    marginLeft: 9,
  },

  stateScreen: {
    alignItems: 'center',
    backgroundColor: '#f7f7fa',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },

  stateTitle: {
    color: '#222228',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 16,
    textAlign: 'center',
  },

  stateDescription: {
    color: '#777781',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 350,
    textAlign: 'center',
  },

});

import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import {
  useCallback,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { OrderDetailsScreenSkeleton } from '../../components/ui/loading-skeleton';
import { getOrderByToken } from '../../services/order-service';
import {
  type OrderStatus,
  useOrdersStore,
} from '../../store/orders-store';
import { openOrderInWhatsApp } from '../../utils/order-whatsapp';

type StatusPresentation = {
  title: string;
  description: string;
  backgroundColor: string;
  textColor: string;
  dotColor: string;
  icon: string;
};

const statusPresentation: Record<
  OrderStatus,
  StatusPresentation
> = {
  'awaiting-whatsapp-send': {
    title: 'في انتظار إرسال واتساب',
    description:
      'لم يتم تأكيد إرسال رسالة الطلب على واتساب حتى الآن.',
    backgroundColor: '#fff3d6',
    textColor: '#7a5a13',
    dotColor: '#e5a328',
    icon: '💬',
  },

  'waiting-confirmation': {
    title: 'في انتظار التأكيد',
    description:
      'يتم الآن مراجعة توافر المنتجات والمبلغ النهائي.',
    backgroundColor: '#f1efff',
    textColor: '#4f3db8',
    dotColor: '#6d56df',
    icon: '⏳',
  },

  confirmed: {
    title: 'تم التأكيد',
    description:
      'تم تأكيد الطلب وأصبح جاهزًا للانتقال إلى مرحلة التجهيز.',
    backgroundColor: '#e9f7ee',
    textColor: '#246343',
    dotColor: '#25a952',
    icon: '✓',
  },

  preparing: {
    title: 'جاري التجهيز',
    description:
      'المتجر يقوم الآن بتجهيز المنتجات الموجودة في الطلب.',
    backgroundColor: '#fff3d6',
    textColor: '#7a5a13',
    dotColor: '#e5a328',
    icon: '🛍️',
  },

  'out-for-delivery': {
    title: 'خرج للتوصيل',
    description:
      'تم استلام الطلب من المتجر وهو الآن في طريقه إليك.',
    backgroundColor: '#eaf4ff',
    textColor: '#245f91',
    dotColor: '#3d8fd1',
    icon: '🛵',
  },

  delivered: {
    title: 'تم التوصيل',
    description:
      'تم توصيل الطلب بنجاح. نتمنى أن تكون تجربتك ممتازة.',
    backgroundColor: '#e9f7ee',
    textColor: '#246343',
    dotColor: '#25a952',
    icon: '✓',
  },

  cancelled: {
    title: 'تم إلغاء الطلب',
    description:
      'تم إلغاء هذا الطلب ولن يتم استكمال تنفيذه.',
    backgroundColor: '#fdecec',
    textColor: '#9a3333',
    dotColor: '#d64b4b',
    icon: '×',
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
  isoDate: string | null,
): string {
  if (!isoDate) {
    return 'غير متاح';
  }

  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return 'غير متاح';
  }

  const day = date.getDate();
  const month =
    arabicMonthNames[date.getMonth()];
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = String(
    date.getMinutes(),
  ).padStart(2, '0');

  const period = hours >= 12 ? 'م' : 'ص';

  hours %= 12;

  if (hours === 0) {
    hours = 12;
  }

  return `${day} ${month} ${year} • ${hours}:${minutes} ${period}`;
}

function DetailRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.detailRow,
        !last && styles.detailRowBorder,
      ]}
    >
      <Text
        style={styles.detailValue}
        selectable
      >
        {value}
      </Text>

      <Text style={styles.detailLabel}>
        {label}
      </Text>
    </View>
  );
}

export default function OrderDetailsScreen() {
  const router = useRouter();

  const [
    isOpeningWhatsApp,
    setIsOpeningWhatsApp,
  ] = useState(false);

  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(false);

  const [
    refreshError,
    setRefreshError,
  ] = useState<string | null>(null);

  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const orderId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const hasHydrated =
    useOrdersStore(
      (state) =>
        state.hasHydrated,
    );

  const order = useOrdersStore(
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
          latestState.pendingOrder?.id ===
          latestOrder.id
        ) {
          if (
            latestOrder.status ===
            'awaiting-whatsapp-send'
          ) {
            latestState.setPendingOrder(
              latestOrder,
            );
          } else {
            latestState
              .confirmPendingOrder(
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
            : 'تعذر تحديث الطلب من Supabase.';

        setRefreshError(message);
      } finally {
        setIsRefreshing(false);
      }
    }, [orderId]);

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

  function goToHome() {
    router.replace('/');
  }

  async function reopenOrderInWhatsApp() {
    if (
      isOpeningWhatsApp ||
      !order
    ) {
      return;
    }

    try {
      setIsOpeningWhatsApp(true);

      await openOrderInWhatsApp(
        order,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تأكد من وجود اتصال بالإنترنت ثم حاول مرة أخرى.';

      Alert.alert(
        'تعذر فتح واتساب',
        message,
      );
    } finally {
      setIsOpeningWhatsApp(false);
    }
  }

  if (
    !hasHydrated ||
    (isRefreshing && !order)
  ) {
    return <OrderDetailsScreenSkeleton />;
  }

  if (!order) {
    return (
      <View style={styles.emptyScreen}>
        <View
          style={
            styles.emptyIconContainer
          }
        >
          <Text style={styles.emptyIcon}>
            🧾
          </Text>
        </View>

        <Text style={styles.emptyTitle}>
          لم يتم العثور على الطلب
        </Text>

        <Text
          style={styles.emptyDescription}
        >
          {refreshError ??
            'قد يكون الطلب غير موجود أو تمت إزالته من سجل الطلبات على هذا الجهاز.'}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed &&
              styles.buttonPressed,
          ]}
          onPress={() => {
            void refreshOrder();
          }}
        >
          <Text
            style={
              styles.primaryButtonText
            }
          >
            إعادة المحاولة
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed &&
              styles.buttonPressed,
          ]}
          onPress={goToOrders}
        >
          <Text
            style={
              styles.secondaryButtonText
            }
          >
            العودة إلى طلباتي
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed &&
              styles.buttonPressed,
          ]}
          onPress={goToHome}
        >
          <Text
            style={
              styles.secondaryButtonText
            }
          >
            العودة للرئيسية
          </Text>
        </Pressable>
      </View>
    );
  }

  const status =
    statusPresentation[order.status];

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
              pressed && styles.buttonPressed,
            ]}
            onPress={goBack}
          >
            <Text style={styles.backIcon}>
              ›
            </Text>
          </Pressable>

          <View style={styles.titleContainer}>
            <Text style={styles.pageTitle}>
              تفاصيل الطلب
            </Text>

            <Text style={styles.pageSubtitle}>
              الحالة والتفاصيل من Supabase
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
              void refreshOrder();
            }}
          >
            {isRefreshing ? (
              <ActivityIndicator
                size="small"
                color="#5d47d2"
              />
            ) : (
              <Text
                style={styles.refreshIcon}
              >
                ↻
              </Text>
            )}
          </Pressable>
        </View>

        {refreshError && (
          <View style={styles.warningCard}>
            <Text
              style={styles.warningText}
            >
              {refreshError}
            </Text>

            <Text
              style={styles.warningIcon}
            >
              ⚠️
            </Text>
          </View>
        )}

        <View
          style={[
            styles.statusCard,
            {
              backgroundColor:
                status.backgroundColor,
            },
          ]}
        >
          <View
            style={[
              styles.statusIconContainer,
              {
                backgroundColor:
                  status.dotColor,
              },
            ]}
          >
            <Text style={styles.statusIcon}>
              {status.icon}
            </Text>
          </View>

          <View style={styles.statusContent}>
            <View
              style={styles.statusTitleRow}
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
                  styles.statusTitle,
                  {
                    color: status.textColor,
                  },
                ]}
              >
                {status.title}
              </Text>
            </View>

            <Text
              style={[
                styles.statusDescription,
                {
                  color: status.textColor,
                },
              ]}
            >
              {status.description}
            </Text>
          </View>
        </View>

        <View style={styles.orderIdentityCard}>
          <Text
            style={styles.orderIdentityLabel}
          >
            رقم الطلب
          </Text>

          <Text
            style={styles.orderIdentityValue}
            selectable
          >
            {order.orderCode}
          </Text>

          <Text style={styles.orderDate}>
            {formatOrderDate(
              order.submittedAt ??
                order.createdAt,
            )}
          </Text>
        </View>

        <View style={styles.storeCard}>
          <View style={styles.storeIconContainer}>
            <Text style={styles.storeIcon}>
              {order.storeIcon || '🏪'}
            </Text>
          </View>

          <View style={styles.storeContent}>
            <Text style={styles.storeLabel}>
              الطلب من
            </Text>

            <Text
              style={styles.storeName}
              numberOfLines={1}
            >
              {order.storeName}
            </Text>

            <Text style={styles.storeMeta}>
              {order.itemCount} منتجات •{' '}
              {order.total}{' '}
              {order.currencySymbol}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            المنتجات
          </Text>

          <View style={styles.itemsCard}>
            {order.items.map(
              (item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.itemRow,
                    index <
                      order.items.length - 1 &&
                      styles.itemRowBorder,
                  ]}
                >
                  <View
                    style={
                      styles.itemIconContainer
                    }
                  >
                    <Text style={styles.itemIcon}>
                      {item.icon || '🛍️'}
                    </Text>
                  </View>

                  <View
                    style={styles.itemContent}
                  >
                    <Text
                      style={styles.itemName}
                    >
                      {item.name}
                    </Text>

                    {item.description.trim()
                      .length > 0 && (
                      <Text
                        style={
                          styles.itemDescription
                        }
                        numberOfLines={2}
                      >
                        {item.description}
                      </Text>
                    )}

                    <Text
                      style={
                        styles.itemQuantity
                      }
                    >
                      الكمية: {item.quantity}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.itemPriceContent
                    }
                  >
                    <Text
                      style={styles.itemTotal}
                    >
                      {item.lineTotal}{' '}
                      {order.currencySymbol}
                    </Text>

                    <Text
                      style={styles.itemUnitPrice}
                    >
                      {item.price}{' '}
                      {order.currencySymbol}{' '}
                      للوحدة
                    </Text>
                  </View>
                </View>
              ),
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            ملخص الحساب
          </Text>

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryValue}>
                {order.subtotal}{' '}
                {order.currencySymbol}
              </Text>

              <Text style={styles.summaryLabel}>
                إجمالي المنتجات
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryValue}>
                {order.deliveryFee}{' '}
                {order.currencySymbol}
              </Text>

              <Text style={styles.summaryLabel}>
                رسوم التوصيل
              </Text>
            </View>

            <View
              style={styles.summaryDivider}
            />

            <View style={styles.totalRow}>
              <Text style={styles.totalValue}>
                {order.total}{' '}
                {order.currencySymbol}
              </Text>

              <Text style={styles.totalLabel}>
                الإجمالي النهائي
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            بيانات العميل
          </Text>

          <View style={styles.detailsCard}>
            <DetailRow
              label="الاسم"
              value={order.customerName}
            />

            <DetailRow
              label="رقم الموبايل"
              value={order.phoneNumber}
              last
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            عنوان التوصيل
          </Text>

          <View style={styles.detailsCard}>
            <DetailRow
              label="المنطقة"
              value={
                order.area || 'غير محدد'
              }
            />

            <DetailRow
              label="العنوان"
              value={order.address}
            />

            <DetailRow
              label="علامة مميزة"
              value={
                order.landmark ||
                'لا يوجد'
              }
            />

            <DetailRow
              label="ملاحظات الطلب"
              value={
                order.notes || 'لا يوجد'
              }
              last
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            الدفع
          </Text>

          <View style={styles.paymentCard}>
            <View
              style={
                styles.paymentIconContainer
              }
            >
              <Text style={styles.paymentIcon}>
                💳
              </Text>
            </View>

            <View
              style={styles.paymentContent}
            >
              <Text
                style={styles.paymentLabel}
              >
                طريقة الدفع المختارة
              </Text>

              <Text
                style={styles.paymentValue}
              >
                {order.paymentMethodTitle}
              </Text>

              <Text
                style={
                  styles.paymentDescription
                }
              >
                يتم الدفع بعد تأكيد المنتجات
                والمبلغ النهائي عبر واتساب.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            معلومات التسجيل
          </Text>

          <View style={styles.detailsCard}>
            <DetailRow
              label="وقت إنشاء الطلب"
              value={formatOrderDate(
                order.createdAt,
              )}
            />

            <DetailRow
              label="وقت تأكيد الإرسال"
              value={formatOrderDate(
                order.submittedAt,
              )}
            />

            <DetailRow
              label="آخر تحديث"
              value={formatOrderDate(
                order.updatedAt,
              )}
              last
            />
          </View>
        </View>

        {order.whatsappNumber &&
          order.whatsappMessage && (
            <Pressable
              style={({ pressed }) => [
                styles.whatsAppButton,
                isOpeningWhatsApp &&
                  styles.whatsAppButtonDisabled,
                pressed &&
                  !isOpeningWhatsApp &&
                  styles.whatsAppButtonPressed,
              ]}
              disabled={
                isOpeningWhatsApp
              }
              onPress={() => {
                void reopenOrderInWhatsApp();
              }}
            >
              <View
                style={
                  styles.whatsAppButtonIconContainer
                }
              >
                {isOpeningWhatsApp ? (
                  <ActivityIndicator
                    color="#25a952"
                    size="small"
                  />
                ) : (
                  <Text
                    style={
                      styles.whatsAppButtonIcon
                    }
                  >
                    💬
                  </Text>
                )}
              </View>

              <Text
                style={
                  styles.whatsAppButtonText
                }
              >
                إعادة فتح الطلب على واتساب
              </Text>
            </Pressable>
          )}

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={goToOrders}
        >
          <Text style={styles.primaryButtonText}>
            العودة إلى طلباتي
          </Text>
        </Pressable>
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
    fontSize: 22,
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

  statusCard: {
    alignItems: 'center',
    borderRadius: 22,
    flexDirection: 'row',
    marginTop: 25,
    padding: 17,
  },

  statusIconContainer: {
    alignItems: 'center',
    borderRadius: 17,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },

  statusIcon: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
  },

  statusContent: {
    flex: 1,
    marginLeft: 14,
  },

  statusTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  statusDot: {
    borderRadius: 5,
    height: 9,
    marginRight: 7,
    width: 9,
  },

  statusTitle: {
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
  },

  statusDescription: {
    fontSize: 10,
    lineHeight: 17,
    marginTop: 5,
    opacity: 0.84,
    textAlign: 'right',
  },

  orderIdentityCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#ececf1',
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
    padding: 18,
  },

  orderIdentityLabel: {
    color: '#898992',
    fontSize: 10,
  },

  orderIdentityValue: {
    color: '#5d47d2',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 6,
    textAlign: 'center',
  },

  orderDate: {
    color: '#898992',
    fontSize: 10,
    marginTop: 7,
    textAlign: 'center',
  },

  storeCard: {
    alignItems: 'center',
    backgroundColor: '#6d56df',
    borderRadius: 22,
    flexDirection: 'row',
    marginTop: 16,
    padding: 17,
  },

  storeIconContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 17,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },

  storeIcon: {
    fontSize: 29,
  },

  storeContent: {
    flex: 1,
    marginLeft: 14,
  },

  storeLabel: {
    color: '#dcd7ff',
    fontSize: 10,
    textAlign: 'right',
  },

  storeName: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 4,
    textAlign: 'right',
  },

  storeMeta: {
    color: '#e9e6ff',
    fontSize: 10,
    marginTop: 6,
    textAlign: 'right',
  },

  section: {
    marginTop: 27,
  },

  sectionTitle: {
    color: '#202025',
    fontSize: 19,
    fontWeight: '900',
    marginBottom: 13,
    textAlign: 'right',
  },

  itemsCard: {
    backgroundColor: '#ffffff',
    borderColor: '#ececf1',
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 16,
  },

  itemRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 16,
  },

  itemRowBorder: {
    borderBottomColor: '#eeeeF2',
    borderBottomWidth: 1,
  },

  itemIconContainer: {
    alignItems: 'center',
    backgroundColor: '#f1efff',
    borderRadius: 14,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },

  itemIcon: {
    fontSize: 24,
  },

  itemContent: {
    flex: 1,
    marginHorizontal: 12,
  },

  itemName: {
    color: '#25252b',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },

  itemDescription: {
    color: '#898992',
    fontSize: 9,
    lineHeight: 15,
    marginTop: 4,
    textAlign: 'right',
  },

  itemQuantity: {
    color: '#6d56df',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 5,
    textAlign: 'right',
  },

  itemPriceContent: {
    alignItems: 'flex-start',
  },

  itemTotal: {
    color: '#303036',
    fontSize: 12,
    fontWeight: '900',
  },

  itemUnitPrice: {
    color: '#9898a1',
    fontSize: 8,
    marginTop: 4,
  },

  summaryCard: {
    backgroundColor: '#ffffff',
    borderColor: '#ececf1',
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
  },

  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  summaryLabel: {
    color: '#777781',
    fontSize: 12,
  },

  summaryValue: {
    color: '#303036',
    fontSize: 12,
    fontWeight: '800',
  },

  summaryDivider: {
    backgroundColor: '#eeeeF2',
    height: 1,
    marginBottom: 15,
  },

  totalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  totalLabel: {
    color: '#202025',
    fontSize: 15,
    fontWeight: '900',
  },

  totalValue: {
    color: '#5d47d2',
    fontSize: 18,
    fontWeight: '900',
  },

  detailsCard: {
    backgroundColor: '#ffffff',
    borderColor: '#ececf1',
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 17,
  },

  detailRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 15,
  },

  detailRowBorder: {
    borderBottomColor: '#eeeeF2',
    borderBottomWidth: 1,
  },

  detailLabel: {
    color: '#898992',
    fontSize: 10,
    marginLeft: 18,
    textAlign: 'right',
  },

  detailValue: {
    color: '#303036',
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'left',
  },

  paymentCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#ececf1',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 17,
  },

  paymentIconContainer: {
    alignItems: 'center',
    backgroundColor: '#f1efff',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },

  paymentIcon: {
    fontSize: 27,
  },

  paymentContent: {
    flex: 1,
    marginLeft: 14,
  },

  paymentLabel: {
    color: '#898992',
    fontSize: 9,
    textAlign: 'right',
  },

  paymentValue: {
    color: '#25252b',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
    textAlign: 'right',
  },

  paymentDescription: {
    color: '#898992',
    fontSize: 9,
    lineHeight: 15,
    marginTop: 5,
    textAlign: 'right',
  },

  whatsAppButton: {
    alignItems: 'center',
    backgroundColor: '#25d366',
    borderRadius: 17,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
    minHeight: 58,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },

  whatsAppButtonDisabled: {
    opacity: 0.65,
  },

  whatsAppButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },

  whatsAppButtonIconContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 11,
    height: 36,
    justifyContent: 'center',
    marginRight: 10,
    width: 36,
  },

  whatsAppButtonIcon: {
    fontSize: 18,
  },

  whatsAppButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },

  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#6d56df',
    borderRadius: 17,
    marginTop: 11,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },

  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },

  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e8e8ed',
    borderRadius: 17,
    borderWidth: 1,
    marginTop: 11,
    minWidth: 220,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },

  secondaryButtonText: {
    color: '#5d47d2',
    fontSize: 13,
    fontWeight: '900',
  },

  buttonPressed: {
    opacity: 0.75,
  },

  emptyScreen: {
    alignItems: 'center',
    backgroundColor: '#f7f7fa',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
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
    fontSize: 24,
    fontWeight: '900',
    marginTop: 20,
    textAlign: 'center',
  },

  emptyDescription: {
    color: '#777781',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 350,
    textAlign: 'center',
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
});

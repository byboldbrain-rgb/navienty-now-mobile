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

import { getOrderByToken } from '../services/order-service';
import {
    type OrderStatus,
    useOrdersStore,
} from '../store/orders-store';
import { openOrderInWhatsApp } from '../utils/order-whatsapp';

type StatusPresentation = {
  title: string;
  description: string;
  backgroundColor: string;
  titleColor: string;
  descriptionColor: string;
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
    titleColor: '#7a5a13',
    descriptionColor: '#977329',
    dotColor: '#e5a328',
    icon: '💬',
  },

  'waiting-confirmation': {
    title: 'في انتظار التأكيد',
    description:
      'سيؤكد الفريق توافر المنتجات والمبلغ النهائي وبيانات الدفع.',
    backgroundColor: '#f1efff',
    titleColor: '#4f3db8',
    descriptionColor: '#7d72b2',
    dotColor: '#6d56df',
    icon: '⏳',
  },

  confirmed: {
    title: 'تم تأكيد الطلب',
    description:
      'تم تأكيد الطلب وسيبدأ المتجر في التجهيز.',
    backgroundColor: '#e9f7ee',
    titleColor: '#246343',
    descriptionColor: '#4e8067',
    dotColor: '#25a952',
    icon: '✓',
  },

  preparing: {
    title: 'جاري التجهيز',
    description:
      'المتجر يقوم الآن بتجهيز المنتجات الموجودة في الطلب.',
    backgroundColor: '#fff3d6',
    titleColor: '#7a5a13',
    descriptionColor: '#977329',
    dotColor: '#e5a328',
    icon: '🛍️',
  },

  'out-for-delivery': {
    title: 'خرج للتوصيل',
    description:
      'تم استلام الطلب من المتجر وهو الآن في طريقه إليك.',
    backgroundColor: '#eaf4ff',
    titleColor: '#245f91',
    descriptionColor: '#4c7698',
    dotColor: '#3d8fd1',
    icon: '🛵',
  },

  delivered: {
    title: 'تم التوصيل',
    description:
      'تم توصيل الطلب بنجاح.',
    backgroundColor: '#e9f7ee',
    titleColor: '#246343',
    descriptionColor: '#4e8067',
    dotColor: '#25a952',
    icon: '✓',
  },

  cancelled: {
    title: 'تم إلغاء الطلب',
    description:
      'تم إلغاء هذا الطلب ولن يتم استكمال تنفيذه.',
    backgroundColor: '#fdecec',
    titleColor: '#9a3333',
    descriptionColor: '#ad6262',
    dotColor: '#d64b4b',
    icon: '×',
  },
};

export default function OrderSuccessScreen() {
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
    (state) =>
      orderId
        ? state.orders.find(
            (currentOrder) =>
              currentOrder.id ===
              orderId,
          ) ?? null
        : null,
  );

  const refreshOrder =
    useCallback(async () => {
      if (!orderId) {
        setRefreshError(
          'رقم الطلب غير موجود.',
        );

        return;
      }

      const savedOrder =
        useOrdersStore
          .getState()
          .orders.find(
            (currentOrder) =>
              currentOrder.id ===
              orderId,
          );

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

        useOrdersStore
          .getState()
          .upsertOrder(
            latestOrder,
          );
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

  function openOrderDetails() {
    if (!orderId) {
      return;
    }

    router.push({
      pathname: '/order/[id]',
      params: {
        id: orderId,
      },
    });
  }

  function openOrders() {
    router.replace('/orders');
  }

  function returnToHome() {
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
    return (
      <View style={styles.emptyScreen}>
        <ActivityIndicator
          size="large"
          color="#6d56df"
        />

        <Text style={styles.emptyTitle}>
          جاري تحميل الطلب
        </Text>

        <Text
          style={styles.emptyDescription}
        >
          يتم جلب أحدث حالة للطلب من
          Supabase.
        </Text>
      </View>
    );
  }

  if (!orderId || !order) {
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
            'قد يكون رقم الطلب غير صحيح أو تم حذف الطلب من هذا الجهاز.'}
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
          onPress={openOrders}
        >
          <Text
            style={
              styles.secondaryButtonText
            }
          >
            الذهاب إلى طلباتي
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed &&
              styles.buttonPressed,
          ]}
          onPress={returnToHome}
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
        <View style={styles.successCard}>
          <View
            style={
              styles.successIconContainer
            }
          >
            <Text
              style={styles.successIcon}
            >
              ✓
            </Text>
          </View>

          <Text style={styles.successTitle}>
            تم تسجيل إرسال الطلب
          </Text>

          <Text
            style={styles.successDescription}
          >
            طلبك الآن في انتظار مراجعة
            فريق {order.appName} عبر
            واتساب.
          </Text>

          <View
            style={styles.orderNumberCard}
          >
            <Text
              style={styles.orderNumberLabel}
            >
              رقم الطلب
            </Text>

            <Text
              style={styles.orderNumberValue}
              selectable
            >
              {order.orderCode}
            </Text>

            <Text
              style={
                styles.orderNumberDescription
              }
            >
              احتفظ بالرقم للرجوع إلى
              الطلب بسهولة.
            </Text>
          </View>

          <View style={styles.storeCard}>
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
              style={styles.storeContent}
            >
              <Text
                style={styles.storeLabel}
              >
                الطلب من
              </Text>

              <Text
                style={styles.storeName}
                numberOfLines={1}
              >
                {order.storeName}
              </Text>

              <Text
                style={styles.storeMeta}
              >
                {order.itemCount} منتجات •{' '}
                {order.total}{' '}
                {
                  order.currencySymbol
                }
              </Text>
            </View>
          </View>

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
                styles.statusDot,
                {
                  backgroundColor:
                    status.dotColor,
                },
              ]}
            />

            <View
              style={styles.statusContent}
            >
              <Text
                style={[
                  styles.statusTitle,
                  {
                    color:
                      status.titleColor,
                  },
                ]}
              >
                {status.title}
              </Text>

              <Text
                style={[
                  styles.statusDescription,
                  {
                    color:
                      status.descriptionColor,
                  },
                ]}
              >
                {status.description}
              </Text>
            </View>

            <Text
              style={styles.statusIcon}
            >
              {status.icon}
            </Text>
          </View>

          {refreshError && (
            <View
              style={styles.warningCard}
            >
              <Text
                style={
                  styles.warningText
                }
              >
                {refreshError}
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
                style={
                  styles.refreshButtonText
                }
              >
                تحديث حالة الطلب
              </Text>
            )}
          </Pressable>

          <View
            style={styles.instructionsCard}
          >
            <Text
              style={
                styles.instructionsTitle
              }
            >
              الخطوات التالية
            </Text>

            <View
              style={styles.instructionRow}
            >
              <Text
                style={
                  styles.instructionText
                }
              >
                انتظر رد فريق{' '}
                {order.appName} على
                واتساب.
              </Text>

              <View
                style={
                  styles.instructionNumber
                }
              >
                <Text
                  style={
                    styles.instructionNumberText
                  }
                >
                  1
                </Text>
              </View>
            </View>

            <View
              style={styles.instructionRow}
            >
              <Text
                style={
                  styles.instructionText
                }
              >
                راجع المنتجات والمبلغ
                النهائي.
              </Text>

              <View
                style={
                  styles.instructionNumber
                }
              >
                <Text
                  style={
                    styles.instructionNumberText
                  }
                >
                  2
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.instructionRow,
                styles.lastInstructionRow,
              ]}
            >
              <Text
                style={
                  styles.instructionText
                }
              >
                نفّذ الدفع بعد استلام
                بيانات الدفع والتأكيد.
              </Text>

              <View
                style={
                  styles.instructionNumber
                }
              >
                <Text
                  style={
                    styles.instructionNumberText
                  }
                >
                  3
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.whatsAppButton,
              isOpeningWhatsApp &&
                styles.whatsAppButtonDisabled,
              pressed &&
                !isOpeningWhatsApp &&
                styles.whatsAppButtonPressed,
            ]}
            disabled={isOpeningWhatsApp}
            onPress={() => {
              void reopenOrderInWhatsApp();
            }}
          >
            <View
              style={
                styles.whatsAppButtonIconContainer
              }
            >
              <Text
                style={styles.whatsAppButtonIcon}
              >
                💬
              </Text>
            </View>

            <Text
              style={styles.whatsAppButtonText}
            >
              {isOpeningWhatsApp
                ? 'جاري فتح واتساب...'
                : 'إعادة فتح الطلب على واتساب'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed &&
                styles.buttonPressed,
            ]}
            onPress={openOrderDetails}
          >
            <Text
              style={styles.primaryButtonText}
            >
              عرض تفاصيل الطلب
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed &&
                styles.buttonPressed,
            ]}
            onPress={openOrders}
          >
            <Text
              style={
                styles.secondaryButtonText
              }
            >
              الذهاب إلى طلباتي
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.homeButton,
              pressed &&
                styles.buttonPressed,
            ]}
            onPress={returnToHome}
          >
            <Text
              style={styles.homeButtonText}
            >
              العودة للرئيسية
            </Text>
          </Pressable>
        </View>
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
    justifyContent: 'center',
    paddingBottom: 40,
    paddingHorizontal: 18,
    paddingTop: 40,
  },

  container: {
    alignSelf: 'center',
    maxWidth: 520,
    width: '100%',
  },

  successCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 24,
  },

  successIconContainer: {
    alignItems: 'center',
    backgroundColor: '#e9f7ee',
    borderRadius: 42,
    height: 84,
    justifyContent: 'center',
    width: 84,
  },

  successIcon: {
    color: '#25a952',
    fontSize: 43,
    fontWeight: '900',
  },

  successTitle: {
    color: '#222228',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 20,
    textAlign: 'center',
  },

  successDescription: {
    color: '#777781',
    fontSize: 13,
    lineHeight: 22,
    marginTop: 9,
    maxWidth: 370,
    textAlign: 'center',
  },

  orderNumberCard: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#f7f7fa',
    borderColor: '#e6e3fa',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 20,
    padding: 16,
  },

  orderNumberLabel: {
    color: '#898992',
    fontSize: 10,
  },

  orderNumberValue: {
    color: '#5d47d2',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 6,
    textAlign: 'center',
  },

  orderNumberDescription: {
    color: '#898992',
    fontSize: 9,
    marginTop: 6,
    textAlign: 'center',
  },

  storeCard: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#6d56df',
    borderRadius: 18,
    flexDirection: 'row',
    marginTop: 16,
    padding: 15,
  },

  storeIconContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 15,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },

  storeIcon: {
    fontSize: 26,
  },

  storeContent: {
    flex: 1,
    marginLeft: 13,
  },

  storeLabel: {
    color: '#dcd7ff',
    fontSize: 9,
    textAlign: 'right',
  },

  storeName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 3,
    textAlign: 'right',
  },

  storeMeta: {
    color: '#e9e6ff',
    fontSize: 9,
    marginTop: 5,
    textAlign: 'right',
  },

  statusCard: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#f1efff',
    borderRadius: 18,
    flexDirection: 'row',
    marginTop: 16,
    padding: 15,
  },

  statusDot: {
    backgroundColor: '#f0a92e',
    borderRadius: 5,
    height: 10,
    width: 10,
  },

  statusContent: {
    flex: 1,
    marginHorizontal: 13,
  },

  statusTitle: {
    color: '#4f3db8',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },

  statusDescription: {
    color: '#7d72b2',
    fontSize: 10,
    lineHeight: 17,
    marginTop: 4,
    textAlign: 'right',
  },

  statusIcon: {
    fontSize: 22,
  },

  instructionsCard: {
    alignSelf: 'stretch',
    backgroundColor: '#f7f7fa',
    borderRadius: 20,
    marginTop: 16,
    padding: 17,
  },

  instructionsTitle: {
    color: '#25252b',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 14,
    textAlign: 'right',
  },

  instructionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 12,
  },

  lastInstructionRow: {
    marginBottom: 0,
  },

  instructionText: {
    color: '#666670',
    flex: 1,
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'right',
  },

  instructionNumber: {
    alignItems: 'center',
    backgroundColor: '#eeeafd',
    borderRadius: 11,
    height: 28,
    justifyContent: 'center',
    marginLeft: 11,
    width: 28,
  },

  instructionNumberText: {
    color: '#5d47d2',
    fontSize: 12,
    fontWeight: '900',
  },

  whatsAppButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#25d366',
    borderRadius: 17,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 22,
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
    alignSelf: 'stretch',
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
    alignSelf: 'stretch',
    backgroundColor: '#eeeafd',
    borderRadius: 17,
    marginTop: 11,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },

  secondaryButtonText: {
    color: '#5d47d2',
    fontSize: 14,
    fontWeight: '900',
  },

  homeButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#ffffff',
    borderColor: '#e8e8ed',
    borderRadius: 17,
    borderWidth: 1,
    marginTop: 11,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },

  homeButtonText: {
    color: '#303036',
    fontSize: 14,
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
    maxWidth: 340,
    textAlign: 'center',
  },


  refreshButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#eeeafd',
    borderRadius: 15,
    marginTop: 12,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  refreshButtonText: {
    color: '#5d47d2',
    fontSize: 12,
    fontWeight: '900',
  },

  warningCard: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#fff3d6',
    borderRadius: 15,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
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

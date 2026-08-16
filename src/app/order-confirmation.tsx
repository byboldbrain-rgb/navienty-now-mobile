import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { OrderDetailsScreenSkeleton } from '../components/ui/loading-skeleton';
import {
  cancelPendingWhatsAppOrder,
  confirmWhatsAppOrderSent,
} from '../services/order-service';
import { useCartStore } from '../store/cart-store';
import { useOrdersStore } from '../store/orders-store';

export default function OrderConfirmationScreen() {
  const router = useRouter();

  const [isConfirming, setIsConfirming] =
    useState(false);

  const [isCancelling, setIsCancelling] =
    useState(false);

  const clearCart = useCartStore(
    (state) => state.clearCart,
  );

  const hasHydrated = useOrdersStore(
    (state) => state.hasHydrated,
  );

  const pendingOrder = useOrdersStore(
    (state) => state.pendingOrder,
  );

  const confirmPendingOrder =
    useOrdersStore(
      (state) =>
        state.confirmPendingOrder,
    );

  const discardPendingOrder =
    useOrdersStore(
      (state) =>
        state.discardPendingOrder,
    );

  async function confirmOrderWasSent() {
    if (
      isConfirming ||
      isCancelling ||
      !pendingOrder
    ) {
      return;
    }

    try {
      setIsConfirming(true);

      const confirmedOrder =
        await confirmWhatsAppOrderSent(
          pendingOrder.accessToken,
        );

      confirmPendingOrder(
        confirmedOrder,
      );

      clearCart();

      router.replace({
        pathname: '/order-success',
        params: {
          id: confirmedOrder.id,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر تأكيد إرسال الطلب.';

      Alert.alert(
        'تعذر تأكيد الطلب',
        message,
      );
    } finally {
      setIsConfirming(false);
    }
  }

  async function returnToCheckout() {
    if (
      isConfirming ||
      isCancelling
    ) {
      return;
    }

    if (!pendingOrder) {
      router.replace('/checkout');
      return;
    }

    try {
      setIsCancelling(true);

      await cancelPendingWhatsAppOrder(
        pendingOrder.accessToken,
        'customer_did_not_send_whatsapp',
      );

      discardPendingOrder();

      router.replace('/checkout');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر إلغاء الطلب المعلّق.';

      Alert.alert(
        'تعذر الرجوع للطلب',
        message,
      );
    } finally {
      setIsCancelling(false);
    }
  }

  function returnToHome() {
    router.replace('/');
  }

  if (!hasHydrated) {
    return <OrderDetailsScreenSkeleton />;
  }

  if (!pendingOrder) {
    return (
      <View style={styles.emptyScreen}>
        <View
          style={
            styles.emptyIconContainer
          }
        >
          <Text style={styles.emptyIcon}>
            🛒
          </Text>
        </View>

        <Text style={styles.emptyTitle}>
          لا يوجد طلب قيد الإرسال
        </Text>

        <Text
          style={styles.emptyDescription}
        >
          أضف منتجات إلى السلة ثم أنشئ
          الطلب من خلال Supabase وافتح
          واتساب.
        </Text>

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
            العودة للتسوق
          </Text>
        </Pressable>
      </View>
    );
  }

  const displayedStoreName =
    pendingOrder.storeName;

  const displayedStoreIcon =
    pendingOrder.storeIcon;

  const displayedItemCount =
    pendingOrder.itemCount;

  const displayedTotal =
    pendingOrder.total;

  const currencySymbol =
    pendingOrder.currencySymbol;

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
            onPress={() => {
              void returnToCheckout();
            }}
          >
            <Text style={styles.backIcon}>
              ›
            </Text>
          </Pressable>

          <View
            style={styles.titleContainer}
          >
            <Text style={styles.pageTitle}>
              تأكيد إرسال الطلب
            </Text>

            <Text
              style={styles.pageSubtitle}
            >
              أخبرنا هل أرسلت الرسالة على
              واتساب
            </Text>
          </View>

          <View
            style={
              styles.topBarPlaceholder
            }
          />
        </View>

        <View style={styles.heroCard}>
          <View
            style={
              styles.whatsAppIconContainer
            }
          >
            <Text
              style={styles.whatsAppIcon}
            >
              💬
            </Text>
          </View>

          <Text style={styles.heroTitle}>
            هل أرسلت رسالة الطلب؟
          </Text>

          <Text
            style={styles.heroDescription}
          >
            فتح واتساب لا يعني أن الرسالة
            تم إرسالها. اضغط على الخيار
            الصحيح حتى لا نفقد محتويات
            السلة بالخطأ.
          </Text>
        </View>

        <View style={styles.orderCard}>
          <View style={styles.storeRow}>
            <View
              style={
                styles.storeIconContainer
              }
            >
              <Text style={styles.storeIcon}>
                {displayedStoreIcon}
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
                {displayedStoreName}
              </Text>
            </View>
          </View>

          <View
            style={
              styles.pendingOrderIdCard
            }
          >
            <Text
              style={
                styles.pendingOrderIdLabel
              }
            >
              رقم الطلب
            </Text>

            <Text
              style={
                styles.pendingOrderIdValue
              }
              selectable
            >
              {pendingOrder.orderCode}
            </Text>
          </View>

          <View
            style={styles.orderDivider}
          />

          <View
            style={styles.orderDetails}
          >
            <View
              style={styles.detailItem}
            >
              <Text
                style={styles.detailValue}
              >
                {displayedItemCount}
              </Text>

              <Text
                style={styles.detailLabel}
              >
                عدد المنتجات
              </Text>
            </View>

            <View
              style={styles.detailDivider}
            />

            <View
              style={styles.detailItem}
            >
              <Text
                style={styles.detailValue}
              >
                {displayedTotal}{' '}
                {currencySymbol}
              </Text>

              <Text
                style={styles.detailLabel}
              >
                الإجمالي
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.warningCard}>
          <Text
            style={styles.warningContent}
          >
            عند الضغط على «تم إرسال
            الطلب»، سيتم تغيير حالة الطلب
            داخل Supabase إلى «في انتظار
            التأكيد»، ثم إفراغ السلة.
            بيانات العميل ستظل محفوظة
            للطلبات القادمة.
          </Text>

          <Text style={styles.warningIcon}>
            ⚠️
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.confirmButton,
            (isConfirming ||
              isCancelling) &&
              styles.confirmButtonDisabled,
            pressed &&
              !isConfirming &&
              !isCancelling &&
              styles.confirmButtonPressed,
          ]}
          disabled={isConfirming || isCancelling}
          onPress={() => {
            void confirmOrderWasSent();
          }}
        >
          <View
            style={
              styles.confirmButtonIconContainer
            }
          >
            {isConfirming ? (
              <ActivityIndicator
                color="#25a952"
                size="small"
              />
            ) : (
              <Text
                style={
                  styles.confirmButtonIcon
                }
              >
                ✓
              </Text>
            )}
          </View>

          <View
            style={
              styles.confirmButtonContent
            }
          >
            <Text
              style={
                styles.confirmButtonText
              }
            >
              تم إرسال الطلب
            </Text>

            <Text
              style={
                styles.confirmButtonDescription
              }
            >
              تحديث حالة الطلب في
              Supabase وإفراغ السلة
            </Text>
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.notSentButton,
            pressed &&
              !isConfirming &&
              !isCancelling &&
              styles.buttonPressed,
          ]}
          disabled={isConfirming || isCancelling}
          onPress={() => {
            void returnToCheckout();
          }}
        >
          <View
            style={
              styles.notSentButtonContent
            }
          >
            <Text
              style={
                styles.notSentButtonText
              }
            >
              لم أرسل الطلب بعد
            </Text>

            <Text
              style={
                styles.notSentButtonDescription
              }
            >
              العودة لبيانات التوصيل مع
              الاحتفاظ بالسلة
            </Text>
          </View>

          {isCancelling ? (
            <ActivityIndicator
              color="#6d56df"
              size="small"
            />
          ) : (
            <Text
              style={styles.notSentArrow}
            >
              ‹
            </Text>
          )}
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

  heroCard: {
    alignItems: 'center',
    backgroundColor: '#e9f7ee',
    borderRadius: 26,
    marginTop: 28,
    padding: 24,
  },

  whatsAppIconContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    height: 82,
    justifyContent: 'center',
    width: 82,
  },

  whatsAppIcon: {
    fontSize: 39,
  },

  heroTitle: {
    color: '#246343',
    fontSize: 23,
    fontWeight: '900',
    marginTop: 17,
    textAlign: 'center',
  },

  heroDescription: {
    color: '#4e8067',
    fontSize: 12,
    lineHeight: 21,
    marginTop: 10,
    maxWidth: 390,
    textAlign: 'center',
  },

  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    marginTop: 20,
    padding: 18,
  },

  storeRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },

  storeIconContainer: {
    alignItems: 'center',
    backgroundColor: '#f1efff',
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
    color: '#898992',
    fontSize: 10,
    textAlign: 'right',
  },

  storeName: {
    color: '#24242a',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 4,
    textAlign: 'right',
  },

  pendingOrderIdCard: {
    alignItems: 'center',
    backgroundColor: '#f7f7fa',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },

  pendingOrderIdLabel: {
    color: '#898992',
    fontSize: 10,
  },

  pendingOrderIdValue: {
    color: '#5d47d2',
    fontSize: 12,
    fontWeight: '900',
  },

  orderDivider: {
    backgroundColor: '#eeeeF2',
    height: 1,
    marginVertical: 17,
  },

  orderDetails: {
    alignItems: 'center',
    flexDirection: 'row',
  },

  detailItem: {
    alignItems: 'center',
    flex: 1,
  },

  detailValue: {
    color: '#5d47d2',
    fontSize: 18,
    fontWeight: '900',
  },

  detailLabel: {
    color: '#898992',
    fontSize: 10,
    marginTop: 4,
  },

  detailDivider: {
    backgroundColor: '#e5e5eb',
    height: 35,
    width: 1,
  },

  warningCard: {
    alignItems: 'center',
    backgroundColor: '#fff3d6',
    borderRadius: 17,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    padding: 15,
  },

  warningContent: {
    color: '#7a5a13',
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 19,
    textAlign: 'right',
  },

  warningIcon: {
    fontSize: 21,
    marginLeft: 10,
  },

  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#25d366',
    borderRadius: 20,
    flexDirection: 'row',
    marginTop: 24,
    minHeight: 76,
    padding: 14,
  },

  confirmButtonDisabled: {
    opacity: 0.65,
  },

  confirmButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },

  confirmButtonIconContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 13,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },

  confirmButtonIcon: {
    color: '#25a952',
    fontSize: 22,
    fontWeight: '900',
  },

  confirmButtonContent: {
    flex: 1,
    marginLeft: 14,
  },

  confirmButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'right',
  },

  confirmButtonDescription: {
    color: '#d7f7e3',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },

  notSentButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e8e8ed',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 12,
    minHeight: 76,
    padding: 15,
  },

  notSentButtonContent: {
    flex: 1,
  },

  notSentButtonText: {
    color: '#303036',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },

  notSentButtonDescription: {
    color: '#898992',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },

  notSentArrow: {
    color: '#6d56df',
    fontSize: 31,
    marginLeft: 12,
  },

  homeButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#6d56df',
    borderRadius: 17,
    marginTop: 22,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },

  homeButtonText: {
    color: '#ffffff',
    fontSize: 15,
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
    maxWidth: 330,
    textAlign: 'center',
  },
});

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { OrderDetailsScreenSkeleton } from '../components/ui/loading-skeleton';
import {
  submitOrderForConfirmation,
} from '../services/order-service';
import { useCartStore } from '../store/cart-store';
import { useOrderNotesStore } from '../store/order-notes-store';
import { useOrdersStore } from '../store/orders-store';
import { useVoucherStore } from '../store/voucher-store';
import {
  NAVIENTY_NOW_COLORS,
  NAVIENTY_NOW_LAYOUT,
} from '../theme/navienty-now-theme';
import { openOrderInWhatsApp } from '../utils/order-whatsapp';

export default function OrderConfirmationScreen() {
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [isOpeningWhatsApp, setIsOpeningWhatsApp] =
    useState(false);

  const clearStoreCart = useCartStore(
    (state) => state.clearStoreCart,
  );
  const clearOrderNotes = useOrderNotesStore(
    (state) => state.clearNote,
  );
  const setStoreVoucher = useVoucherStore(
    (state) => state.setVoucher,
  );

  const hasHydrated = useOrdersStore(
    (state) => state.hasHydrated,
  );
  const pendingOrder = useOrdersStore(
    (state) => state.pendingOrder,
  );
  const confirmPendingOrder = useOrdersStore(
    (state) => state.confirmPendingOrder,
  );

  async function submitPendingOrder() {
    if (
      !pendingOrder ||
      isSubmitting ||
      isOpeningWhatsApp
    ) {
      return;
    }

    try {
      setIsSubmitting(true);

      const submittedOrder =
        await submitOrderForConfirmation(
          pendingOrder.accessToken,
        );

      confirmPendingOrder({
        ...submittedOrder,
        whatsappMessage:
          pendingOrder.whatsappMessage,
      });

      /*
       * A pending order can survive an app restart while the customer uses a
       * different store cart. Clear only the cart and checkout metadata that
       * belong to the submitted order.
       */
      clearStoreCart(
        pendingOrder.storeId,
      );
      setStoreVoucher(
        pendingOrder.storeId,
        null,
      );
      clearOrderNotes(
        pendingOrder.storeId,
      );

      router.replace({
        pathname: '/order-success',
        params: {
          id: submittedOrder.id,
        },
      });
    } catch (error) {
      Alert.alert(
        'تعذر تأكيد الطلب',
        error instanceof Error
          ? error.message
          : 'حاول مرة أخرى.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function openOptionalWhatsApp() {
    if (
      !pendingOrder ||
      isSubmitting ||
      isOpeningWhatsApp
    ) {
      return;
    }

    try {
      setIsOpeningWhatsApp(true);

      await openOrderInWhatsApp(
        pendingOrder,
      );
    } catch (error) {
      Alert.alert(
        'تعذر فتح واتساب',
        error instanceof Error
          ? error.message
          : 'يمكنك تأكيد الطلب داخل التطبيق بدون واتساب.',
      );
    } finally {
      setIsOpeningWhatsApp(false);
    }
  }

  if (!hasHydrated) {
    return <OrderDetailsScreenSkeleton />;
  }

  if (!pendingOrder) {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <StatusBar style="dark" />

        <View style={styles.stateIcon}>
          <Ionicons
            color={NAVIENTY_NOW_COLORS.primary}
            name="checkmark-circle-outline"
            size={34}
          />
        </View>

        <Text style={styles.stateTitle}>
          لا يوجد طلب معلّق
        </Text>

        <Text style={styles.stateDescription}>
          يمكنك متابعة طلباتك الحالية من شاشة الطلبات.
        </Text>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.homeButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => {
            router.replace('/');
          }}
        >
          <Text style={styles.homeButtonText}>
            العودة للرئيسية
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const isBusy =
    isSubmitting || isOpeningWhatsApp;

  return (
    <SafeAreaView
      edges={['top']}
      style={styles.screen}
    >
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="العودة لإتمام الطلب"
            accessibilityRole="button"
            hitSlop={10}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => {
              router.replace('/checkout');
            }}
          >
            <Ionicons
              color={NAVIENTY_NOW_COLORS.text}
              name="arrow-back"
              size={22}
            />
          </Pressable>

          <Text style={styles.pageTitle}>
            تأكيد الطلب
          </Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons
              color={NAVIENTY_NOW_COLORS.primary}
              name="receipt-outline"
              size={32}
            />
          </View>

          <Text style={styles.heroTitle}>
            طلبك محفوظ وجاهز للإرسال
          </Text>

          <Text style={styles.heroDescription}>
            اضغط الزر الأخضر لإرسال الطلب للمراجعة داخل
            Navienty Now. لا تحتاج إلى فتح أي تطبيق آخر.
          </Text>
        </View>

        <View style={styles.orderCard}>
          <View style={styles.storeRow}>
            <View style={styles.storeIcon}>
              <Text style={styles.storeIconText}>
                {pendingOrder.storeIcon}
              </Text>
            </View>

            <View style={styles.storeCopy}>
              <Text style={styles.storeLabel}>
                الطلب من
              </Text>
              <Text
                numberOfLines={1}
                style={styles.storeName}
              >
                {pendingOrder.storeName}
              </Text>
            </View>
          </View>

          <View style={styles.orderCodeRow}>
            <Text style={styles.orderCodeLabel}>
              رقم الطلب
            </Text>
            <Text
              selectable
              style={styles.orderCodeValue}
            >
              {pendingOrder.orderCode}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {pendingOrder.itemCount}
              </Text>
              <Text style={styles.summaryLabel}>
                منتج
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {pendingOrder.total}{' '}
                {pendingOrder.currencySymbol}
              </Text>
              <Text style={styles.summaryLabel}>
                الإجمالي
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          accessibilityLabel="تأكيد الطلب داخل التطبيق"
          accessibilityRole="button"
          disabled={isBusy}
          style={({ pressed }) => [
            styles.submitButton,
            isBusy && styles.disabledButton,
            pressed &&
              !isBusy &&
              styles.submitButtonPressed,
          ]}
          onPress={() => {
            void submitPendingOrder();
          }}
        >
          {isSubmitting ? (
            <ActivityIndicator
              color="#FFFFFF"
              size="small"
            />
          ) : (
            <Ionicons
              color="#FFFFFF"
              name="checkmark-circle-outline"
              size={21}
            />
          )}

          <Text style={styles.submitButtonText}>
            تأكيد الطلب داخل التطبيق
          </Text>
        </Pressable>

        <Pressable
          accessibilityLabel="متابعة عبر واتساب، اختياري"
          accessibilityRole="button"
          disabled={isBusy}
          style={({ pressed }) => [
            styles.whatsAppButton,
            isBusy && styles.disabledButton,
            pressed &&
              !isBusy &&
              styles.buttonPressed,
          ]}
          onPress={() => {
            void openOptionalWhatsApp();
          }}
        >
          {isOpeningWhatsApp ? (
            <ActivityIndicator
              color="#168A48"
              size="small"
            />
          ) : (
            <Ionicons
              color="#168A48"
              name="logo-whatsapp"
              size={21}
            />
          )}

          <View style={styles.whatsAppCopy}>
            <Text style={styles.whatsAppTitle}>
              متابعة عبر واتساب (اختياري)
            </Text>
            <Text style={styles.whatsAppDescription}>
              للتواصل مع فريق الدعم فقط
            </Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    maxWidth: NAVIENTY_NOW_LAYOUT.contentMaxWidth,
    paddingBottom: 40,
    paddingHorizontal: 18,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 68,
  },
  backButton: {
    alignItems: 'center',
    borderColor: '#E4E4E4',
    borderRadius: 23,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  pageTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 46,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: NAVIENTY_NOW_COLORS.primaryPale,
    borderRadius: 22,
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  heroTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 14,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  heroDescription: {
    color: NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 20,
    marginTop: 7,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  orderCard: {
    borderColor: '#E8E8E8',
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
  },
  storeRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
  },
  storeIcon: {
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  storeIconText: {
    fontSize: 24,
  },
  storeCopy: {
    alignItems: 'flex-end',
    flex: 1,
    marginRight: 11,
  },
  storeLabel: {
    color: NAVIENTY_NOW_COLORS.textMuted,
    fontSize: 10,
    writingDirection: 'rtl',
  },
  storeName: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 3,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  orderCodeRow: {
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 13,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  orderCodeLabel: {
    color: NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 11,
  },
  orderCodeValue: {
    color: NAVIENTY_NOW_COLORS.primaryDark,
    fontSize: 13,
    fontWeight: '800',
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    marginTop: 16,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  summaryLabel: {
    color: NAVIENTY_NOW_COLORS.textMuted,
    fontSize: 10,
    marginTop: 3,
  },
  summaryDivider: {
    backgroundColor: '#E8E8E8',
    height: 32,
    width: StyleSheet.hairlineWidth,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: NAVIENTY_NOW_COLORS.primary,
    borderRadius: 16,
    flexDirection: 'row-reverse',
    gap: 9,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 56,
    paddingHorizontal: 16,
  },
  submitButtonPressed: {
    backgroundColor: NAVIENTY_NOW_COLORS.primaryPressed,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  whatsAppButton: {
    alignItems: 'center',
    backgroundColor: '#F1FBF5',
    borderColor: '#CEEEDD',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    marginTop: 11,
    minHeight: 60,
    paddingHorizontal: 16,
  },
  whatsAppCopy: {
    alignItems: 'flex-end',
    flex: 1,
    marginRight: 10,
  },
  whatsAppTitle: {
    color: '#168A48',
    fontSize: 13,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  whatsAppDescription: {
    color: '#548266',
    fontSize: 10,
    marginTop: 3,
    writingDirection: 'rtl',
  },
  disabledButton: {
    opacity: 0.55,
  },
  buttonPressed: {
    opacity: 0.78,
  },
  stateScreen: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  stateIcon: {
    alignItems: 'center',
    backgroundColor: NAVIENTY_NOW_COLORS.primaryPale,
    borderRadius: 34,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  stateTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 19,
    fontWeight: '800',
    marginTop: 17,
    textAlign: 'center',
  },
  stateDescription: {
    color: NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 20,
    marginTop: 7,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  homeButton: {
    backgroundColor: NAVIENTY_NOW_COLORS.primary,
    borderRadius: 14,
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  homeButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});

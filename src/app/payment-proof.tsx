import { Ionicons } from '@expo/vector-icons';
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useEffect,
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

import { getMyOrders } from '../services/order-service';
import {
  pickAndUploadOrderPaymentProof,
  prepareOrderPaymentProof,
  type OrderPaymentProof,
} from '../services/order-payment-proof-service';
import type { Order } from '../types/supabase-order';
import {
  NAVIENTY_NOW_COLORS,
  NAVIENTY_NOW_LAYOUT,
} from '../theme/navienty-now-theme';

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

function formatAmount(
  amount: number,
  currencyCode: string,
): string {
  const formatted =
    Number.isInteger(amount)
      ? String(amount)
      : amount.toFixed(2);

  return `${formatted} ${
    currencyCode === 'EGP'
      ? 'ج.م'
      : currencyCode
  }`;
}

export default function PaymentProofScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const orderId =
    getSingleParam(params.id);

  const [order, setOrder] =
    useState<Order | null>(null);

  const [proof, setProof] =
    useState<OrderPaymentProof | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isUploading, setIsUploading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [uploadedFileName, setUploadedFileName] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!orderId) {
        setErrorMessage(
          'رقم الطلب غير موجود.',
        );
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage(null);

        const orders = await getMyOrders();
        const currentOrder =
          orders.find(
            (candidate) =>
              candidate.id === orderId,
          ) ?? null;

        if (!currentOrder) {
          throw new Error(
            'تعذر العثور على الطلب.',
          );
        }

        if (cancelled) {
          return;
        }

        setOrder(currentOrder);

        if (
          currentOrder.paymentStatus ===
          'paid'
        ) {
          router.replace({
            pathname: '/order-success',
            params: { id: orderId },
          });
          return;
        }

        const preparation =
          await prepareOrderPaymentProof(
            orderId,
          );

        if (cancelled) {
          return;
        }

        if (!preparation.required) {
          router.replace({
            pathname: '/order-success',
            params: { id: orderId },
          });
          return;
        }

        setProof(preparation.proof);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'تعذر تحميل إثبات الدفع.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [orderId, router]);

  async function uploadProof() {
    if (
      !orderId ||
      isUploading ||
      proof?.status === 'submitted'
    ) {
      return;
    }

    try {
      setIsUploading(true);
      setErrorMessage(null);

      const result =
        await pickAndUploadOrderPaymentProof(
          orderId,
        );

      if (result.status === 'submitted') {
        setProof(result.proof);
        setUploadedFileName(
          result.fileName,
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر رفع إثبات الدفع.',
      );
    } finally {
      setIsUploading(false);
    }
  }

  function openOrderTracking() {
    if (!orderId) {
      router.replace('/orders');
      return;
    }

    router.replace({
      pathname: '/order-success',
      params: { id: orderId },
    });
  }

  if (isLoading) {
    return (
      <View style={styles.centerScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator
          color={NAVIENTY_NOW_COLORS.primary}
          size="large"
        />
        <Text style={styles.loadingText}>
          جاري تجهيز الدفع...
        </Text>
      </View>
    );
  }

  if (!order || !proof) {
    return (
      <View style={styles.centerScreen}>
        <StatusBar style="dark" />

        <View style={styles.errorIcon}>
          <Ionicons
            color={NAVIENTY_NOW_COLORS.error}
            name="alert-circle-outline"
            size={34}
          />
        </View>

        <Text style={styles.errorTitle}>
          تعذر تجهيز إثبات الدفع
        </Text>

        <Text style={styles.errorDescription}>
          {errorMessage ??
            'حاول فتح الطلب مرة أخرى.'}
        </Text>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.pressed,
          ]}
          onPress={() =>
            router.replace('/orders')
          }
        >
          <Text
            style={styles.secondaryButtonText}
          >
            عرض طلباتي
          </Text>
        </Pressable>
      </View>
    );
  }

  const submitted =
    proof.status === 'submitted';

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="العودة"
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}
              onPress={() => router.back()}
            >
              <Ionicons
                color={NAVIENTY_NOW_COLORS.text}
                name="arrow-back"
                size={24}
              />
            </Pressable>

            <Text style={styles.pageTitle}>
              إثبات الدفع
            </Text>

            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <Ionicons
                color={NAVIENTY_NOW_COLORS.primaryDark}
                name="shield-checkmark-outline"
                size={30}
              />
            </View>

            <Text style={styles.heroTitle}>
              {submitted
                ? 'تم استلام إثبات الدفع'
                : 'أكمل الدفع لتأكيد الطلب'}
            </Text>

            <Text style={styles.heroDescription}>
              {submitted
                ? 'الإثبات قيد المراجعة. لن يبدأ تنفيذ الطلب قبل تأكيد الدفع من Navienty Now.'
                : 'بعد التحويل حسب تعليمات الدفع التي استلمتها على واتساب، ارفع صورة التحويل أو ملف PDF هنا.'}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryValue}>
                {order.orderCode}
              </Text>
              <Text style={styles.summaryLabel}>
                رقم الطلب
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryValue}>
                {order.paymentMethodTitle}
              </Text>
              <Text style={styles.summaryLabel}>
                وسيلة الدفع
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.amountValue}>
                {formatAmount(
                  proof.amount,
                  proof.currencyCode,
                )}
              </Text>
              <Text style={styles.summaryLabel}>
                المبلغ المطلوب
              </Text>
            </View>
          </View>

          {!submitted ? (
            <View style={styles.uploadCard}>
              <View style={styles.uploadIcon}>
                <Ionicons
                  color={NAVIENTY_NOW_COLORS.primary}
                  name="cloud-upload-outline"
                  size={28}
                />
              </View>

              <Text style={styles.uploadTitle}>
                ارفع إثبات التحويل
              </Text>

              <Text style={styles.uploadDescription}>
                صورة JPG / PNG / WebP أو PDF بحد أقصى 8 ميجابايت.
              </Text>

              <Pressable
                accessibilityLabel="اختيار ورفع إثبات الدفع"
                accessibilityRole="button"
                disabled={isUploading}
                style={({ pressed }) => [
                  styles.primaryButton,
                  isUploading &&
                    styles.disabledButton,
                  pressed &&
                    !isUploading &&
                    styles.primaryPressed,
                ]}
                onPress={() => {
                  void uploadProof();
                }}
              >
                {isUploading ? (
                  <ActivityIndicator
                    color={NAVIENTY_NOW_COLORS.white}
                    size="small"
                  />
                ) : (
                  <>
                    <Ionicons
                      color={NAVIENTY_NOW_COLORS.white}
                      name="document-attach-outline"
                      size={19}
                    />
                    <Text
                      style={styles.primaryButtonText}
                    >
                      اختيار إثبات الدفع
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.submittedCard}>
              <Ionicons
                color={NAVIENTY_NOW_COLORS.primaryDark}
                name="checkmark-circle"
                size={30}
              />

              <View style={styles.submittedCopy}>
                <Text style={styles.submittedTitle}>
                  قيد المراجعة
                </Text>
                <Text
                  style={styles.submittedDescription}
                >
                  {uploadedFileName
                    ? `تم رفع ${uploadedFileName}`
                    : 'إثبات الدفع محفوظ بأمان وسيتم تحديث حالة الطلب بعد المراجعة.'}
                </Text>
              </View>
            </View>
          )}

          {errorMessage && (
            <View style={styles.inlineError}>
              <Ionicons
                color={NAVIENTY_NOW_COLORS.error}
                name="alert-circle-outline"
                size={18}
              />
              <Text style={styles.inlineErrorText}>
                {errorMessage}
              </Text>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.trackingButton,
              pressed && styles.pressed,
            ]}
            onPress={openOrderTracking}
          >
            <Text style={styles.trackingButtonText}>
              عرض حالة الطلب
            </Text>
          </Pressable>

          <Text style={styles.securityNote}>
            إثبات الدفع خاص بطلبك ويتم تخزينه بشكل خاص، ولا يتم اعتبار الطلب مدفوعًا إلا بعد مراجعة Navienty Now.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: NAVIENTY_NOW_COLORS.surface,
  },
  centerScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NAVIENTY_NOW_COLORS.surface,
    paddingHorizontal: 28,
  },
  content: {
    paddingTop: 20,
    paddingHorizontal: NAVIENTY_NOW_LAYOUT.pageGutter,
    paddingBottom: 44,
  },
  container: {
    width: '100%',
    maxWidth: NAVIENTY_NOW_LAYOUT.contentMaxWidth,
    alignSelf: 'center',
  },
  header: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NAVIENTY_NOW_COLORS.white,
    borderWidth: 1,
    borderColor: NAVIENTY_NOW_COLORS.border,
  },
  headerSpacer: {
    width: 42,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: NAVIENTY_NOW_COLORS.text,
  },
  heroCard: {
    marginTop: 22,
    alignItems: 'center',
    borderRadius: 24,
    padding: 22,
    backgroundColor: NAVIENTY_NOW_COLORS.primaryPale,
    borderWidth: 1,
    borderColor: '#CDEAD8',
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NAVIENTY_NOW_COLORS.white,
  },
  heroTitle: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '900',
    color: NAVIENTY_NOW_COLORS.text,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  heroDescription: {
    marginTop: 8,
    maxWidth: 420,
    fontSize: 11,
    lineHeight: 20,
    color: NAVIENTY_NOW_COLORS.textSecondary,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  summaryCard: {
    marginTop: 16,
    paddingHorizontal: 16,
    backgroundColor: NAVIENTY_NOW_COLORS.white,
    borderWidth: 1,
    borderColor: NAVIENTY_NOW_COLORS.border,
    borderRadius: NAVIENTY_NOW_LAYOUT.cardRadius,
  },
  summaryRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: NAVIENTY_NOW_COLORS.textSecondary,
    textAlign: 'right',
  },
  summaryValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
    color: NAVIENTY_NOW_COLORS.text,
    textAlign: 'left',
  },
  amountValue: {
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
    color: NAVIENTY_NOW_COLORS.primaryDark,
    textAlign: 'left',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: NAVIENTY_NOW_COLORS.border,
  },
  uploadCard: {
    marginTop: 16,
    alignItems: 'center',
    padding: 20,
    backgroundColor: NAVIENTY_NOW_COLORS.white,
    borderWidth: 1,
    borderColor: NAVIENTY_NOW_COLORS.border,
    borderRadius: NAVIENTY_NOW_LAYOUT.cardRadius,
  },
  uploadIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NAVIENTY_NOW_COLORS.primaryPale,
  },
  uploadTitle: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '900',
    color: NAVIENTY_NOW_COLORS.text,
  },
  uploadDescription: {
    marginTop: 6,
    fontSize: 10,
    lineHeight: 17,
    color: NAVIENTY_NOW_COLORS.textSecondary,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  primaryButton: {
    marginTop: 16,
    minHeight: 50,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 15,
    paddingHorizontal: 18,
    backgroundColor: NAVIENTY_NOW_COLORS.primary,
  },
  primaryButtonText: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 12,
    fontWeight: '900',
  },
  primaryPressed: {
    opacity: 0.8,
  },
  disabledButton: {
    opacity: 0.55,
  },
  submittedCard: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: NAVIENTY_NOW_LAYOUT.cardRadius,
    backgroundColor: NAVIENTY_NOW_COLORS.primaryPale,
    borderWidth: 1,
    borderColor: '#CDEAD8',
  },
  submittedCopy: {
    flex: 1,
    alignItems: 'flex-end',
  },
  submittedTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: NAVIENTY_NOW_COLORS.primaryDark,
  },
  submittedDescription: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 17,
    color: NAVIENTY_NOW_COLORS.textSecondary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  inlineError: {
    marginTop: 14,
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FFF4F4',
    borderWidth: 1,
    borderColor: '#F0CCCC',
  },
  inlineErrorText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 17,
    color: '#A13838',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  trackingButton: {
    marginTop: 16,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: NAVIENTY_NOW_COLORS.white,
    borderWidth: 1,
    borderColor: NAVIENTY_NOW_COLORS.border,
  },
  trackingButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: NAVIENTY_NOW_COLORS.text,
  },
  securityNote: {
    marginTop: 14,
    paddingHorizontal: 10,
    fontSize: 9,
    lineHeight: 16,
    color: NAVIENTY_NOW_COLORS.textMuted,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 11,
    color: NAVIENTY_NOW_COLORS.textSecondary,
  },
  errorIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1F1',
  },
  errorTitle: {
    marginTop: 15,
    fontSize: 17,
    fontWeight: '900',
    color: NAVIENTY_NOW_COLORS.text,
    textAlign: 'center',
  },
  errorDescription: {
    marginTop: 8,
    maxWidth: 420,
    fontSize: 11,
    lineHeight: 19,
    color: NAVIENTY_NOW_COLORS.textSecondary,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  secondaryButton: {
    marginTop: 18,
    minHeight: 48,
    minWidth: 180,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: NAVIENTY_NOW_COLORS.white,
    borderWidth: 1,
    borderColor: NAVIENTY_NOW_COLORS.border,
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: NAVIENTY_NOW_COLORS.text,
  },
  pressed: {
    opacity: 0.65,
  },
});

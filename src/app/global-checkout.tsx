import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  type ComponentProps,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GLOBAL_CART_DELIVERY_FEE } from '../config/global-cart';
import { calculatePaymentProcessingFee } from '../domain/payment-method';
import getAppBootstrap, {
  type AppBootstrap,
  type PaymentMethod,
} from '../services/bootstrap-service';
import {
  getDeliveryLocationErrorMessage,
  resolveDeliveryLocation,
} from '../services/delivery-location-service';
import {
  createGlobalOrderGroup,
  submitGlobalOrderGroup,
} from '../services/global-order-service';
import {
  isPrintJobCartItem,
  selectAllCartItemCount,
  selectAllCartSubtotal,
  useCartStore,
} from '../store/cart-store';
import { useCustomerStore } from '../store/customer-store';
import {
  NAVIENTY_NOW_COLORS,
  NAVIENTY_NOW_LAYOUT,
} from '../theme/navienty-now-theme';

const money = (value: number) => `${Number(value ?? 0).toFixed(2)} ج.م`;
const normalizePhone = (value: string) => value.replace(/\D/g, '').slice(0, 11);
const methodName = (method: PaymentMethod) => method.name_ar || method.name_en || method.code;

export default function GlobalCheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const carts = useCartStore((state) => state.carts);
  const itemCount = useCartStore(selectAllCartItemCount);
  const subtotal = useCartStore(selectAllCartSubtotal);
  const clearAllCarts = useCartStore((state) => state.clearAllCarts);

  const savedName = useCustomerStore((state) => state.customerName);
  const savedPhone = useCustomerStore((state) => state.phoneNumber);
  const savedAddress = useCustomerStore((state) => state.address);
  const locationAddress = useCustomerStore((state) => state.locationAddress);
  const latitude = useCustomerStore((state) => state.locationLatitude);
  const longitude = useCustomerStore((state) => state.locationLongitude);
  const serviceAreaId = useCustomerStore((state) => state.locationServiceAreaId);
  const savedPaymentMethod = useCustomerStore((state) => state.paymentMethod);
  const savedLandmark = useCustomerStore((state) => state.landmark);
  const savedInstructions = useCustomerStore((state) => state.deliveryInstructions);
  const setCustomerData = useCustomerStore((state) => state.setCustomerData);
  const setPaymentMethod = useCustomerStore((state) => state.setPaymentMethod);

  const [bootstrap, setBootstrap] = useState<AppBootstrap | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState(savedName);
  const [phoneNumber, setPhoneNumber] = useState(savedPhone);
  const [address, setAddress] = useState(savedAddress || locationAddress);
  const [landmark, setLandmark] = useState(savedLandmark);
  const [notes, setNotes] = useState(savedInstructions);

  const groups = useMemo(
    () => Object.values(carts).filter((group) => group.items.length > 0),
    [carts],
  );

  async function load() {
    try {
      setIsLoading(true);
      setLoadError(null);
      const data = await getAppBootstrap();
      setBootstrap(data);
      if (!savedPaymentMethod && data.payment_methods[0]) {
        setPaymentMethod(data.payment_methods[0].id);
      }
    } catch (error) {
      setBootstrap(null);
      setLoadError(error instanceof Error ? error.message : 'تعذر تحميل طرق الدفع.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const selectedPaymentMethod =
    bootstrap?.payment_methods.find((method) => method.id === savedPaymentMethod) ??
    bootstrap?.payment_methods[0] ??
    null;
  const processingFee = selectedPaymentMethod
    ? calculatePaymentProcessingFee(selectedPaymentMethod, subtotal)
    : 0;
  const total = subtotal + GLOBAL_CART_DELIVERY_FEE + processingFee;

  async function openWhatsApp(number: string, message: string) {
    const phone = number.replace(/\D/g, '');
    if (!phone || !message.trim()) return;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
  }

  async function submit() {
    const phone = normalizePhone(phoneNumber);
    if (!groups.length || itemCount <= 0) {
      Alert.alert('السلة فاضية', 'أضف منتجات الأول ثم حاول مرة أخرى.');
      return;
    }
    if (
      typeof latitude !== 'number' || !Number.isFinite(latitude) ||
      typeof longitude !== 'number' || !Number.isFinite(longitude)
    ) {
      router.push('/global-location-picker');
      return;
    }
    if (customerName.trim().length < 2) {
      Alert.alert('اكتب اسمك', 'الاسم لازم يكون حرفين على الأقل.');
      return;
    }
    if (!/^01[0125]\d{8}$/.test(phone)) {
      Alert.alert('رقم الموبايل غير صحيح', 'اكتب رقم موبايل مصري صحيح.');
      return;
    }
    if (address.trim().length < 8) {
      Alert.alert('العنوان غير مكتمل', 'اكتب عنوان التوصيل بشكل أوضح.');
      return;
    }
    if (!selectedPaymentMethod) {
      Alert.alert('اختر طريقة الدفع', 'حدد طريقة الدفع لإكمال الطلب.');
      return;
    }

    try {
      setIsSubmitting(true);
      const resolutions = await Promise.all(
        groups.map((group) => resolveDeliveryLocation({
          latitude,
          longitude,
          storeId: group.storeId,
        })),
      );
      const unavailable = resolutions.findIndex(
        (resolution) => !resolution.serviceable || resolution.storeAvailable !== true,
      );
      if (unavailable >= 0) {
        Alert.alert(
          'التوصيل غير متاح من أحد المتاجر',
          `${groups[unavailable].storeName}: ${getDeliveryLocationErrorMessage(resolutions[unavailable].reason)}`,
        );
        return;
      }

      setCustomerData({
        customerName: customerName.trim(),
        phoneNumber: phone,
        address: address.trim(),
        landmark: landmark.trim(),
        deliveryInstructions: notes.trim(),
        paymentMethod: selectedPaymentMethod.id,
      });

      const created = await createGlobalOrderGroup({
        serviceAreaId,
        deliveryLatitude: latitude,
        deliveryLongitude: longitude,
        paymentMethodId: selectedPaymentMethod.id,
        customerName: customerName.trim(),
        customerPhone: phone,
        address: address.trim(),
        landmark: landmark.trim(),
        notes: notes.trim(),
        stores: groups.map((group) => ({
          storeId: group.storeId,
          items: group.items.map((item) => ({
            productId: item.id,
            variantId: item.variantId,
            quantity: item.quantity,
            ...(isPrintJobCartItem(item)
              ? {
                  printJob: {
                    printingServiceId: item.printJob.printingServiceId,
                    colorOptionId: item.printJob.colorOptionId,
                    sideOptionId: item.printJob.sideOptionId,
                    pageCount: item.printJob.pageCount,
                    copyCount: item.printJob.copyCount,
                  },
                }
              : {}),
          })),
        })),
      });

      const submitted = await submitGlobalOrderGroup(created.accessToken);
      clearAllCarts();
      router.replace({
        pathname: '/global-order-success',
        params: {
          code: submitted.groupCode,
          stores: String(submitted.orders.length),
          total: submitted.total.toFixed(2),
        },
      });

      try {
        await openWhatsApp(submitted.whatsappNumber, submitted.whatsappMessage);
      } catch {
        // Order is already submitted in-app; WhatsApp is optional support/file handoff.
      }
    } catch (error) {
      Alert.alert(
        'تعذر إرسال الطلب',
        error instanceof Error ? error.message : 'حاول مرة أخرى.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (itemCount <= 0) {
    return <StateView title="لا يوجد طلب لإرساله" action="العودة للتسوق" onPress={() => router.replace('/')} />;
  }
  if (isLoading) {
    return (
      <View style={styles.stateScreen}>
        <ActivityIndicator color={NAVIENTY_NOW_COLORS.primary} />
        <Text style={styles.loadingText}>جاري تجهيز الدفع</Text>
      </View>
    );
  }
  if (!bootstrap || loadError) {
    return <StateView title="تعذر تحميل بيانات الدفع" description={loadError ?? undefined} action="إعادة المحاولة" onPress={() => void load()} />;
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={NAVIENTY_NOW_COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>إتمام الطلب</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>بيانات التوصيل</Text>
          <Field value={customerName} onChangeText={setCustomerName} placeholder="الاسم" />
          <Field
            value={phoneNumber}
            onChangeText={(value) => setPhoneNumber(normalizePhone(value))}
            placeholder="رقم الموبايل"
            keyboardType="phone-pad"
          />
          <TextInput
            value={address}
            onChangeText={setAddress}
            multiline
            placeholder="العنوان بالتفصيل"
            placeholderTextColor={NAVIENTY_NOW_COLORS.textMuted}
            style={[styles.input, styles.multiline]}
            textAlign="right"
            textAlignVertical="top"
          />
          <View style={styles.locationRow}>
            <Pressable style={styles.locationButton} onPress={() => router.push('/global-location-picker')}>
              <Ionicons name="location-outline" size={17} color={NAVIENTY_NOW_COLORS.primary} />
              <Text style={styles.locationButtonText}>تعديل الموقع</Text>
            </Pressable>
            <Text numberOfLines={2} style={styles.locationText}>{locationAddress || 'حدد موقع التوصيل'}</Text>
          </View>
          <Field value={landmark} onChangeText={setLandmark} placeholder="علامة مميزة — اختياري" />
          <Field value={notes} onChangeText={setNotes} placeholder="ملاحظات على الطلب — اختياري" />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>طريقة الدفع</Text>
          {bootstrap.payment_methods.map((method) => {
            const selected = selectedPaymentMethod?.id === method.id;
            return (
              <Pressable
                key={method.id}
                style={[styles.method, selected && styles.methodSelected]}
                onPress={() => setPaymentMethod(method.id)}
              >
                <View style={styles.radio}>{selected ? <View style={styles.radioInner} /> : null}</View>
                <View style={styles.methodCopy}>
                  <Text style={styles.methodName}>{methodName(method)}</Text>
                  {method.subtitle_ar ? <Text style={styles.methodSubtitle}>{method.subtitle_ar}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>ملخص الدفع</Text>
          <Summary label={`المنتجات من ${groups.length} ${groups.length === 1 ? 'متجر' : 'متاجر'}`} value={money(subtotal)} />
          <Summary label="التوصيل — مرة واحدة" value={money(GLOBAL_CART_DELIVERY_FEE)} />
          {processingFee > 0 ? <Summary label="رسوم الدفع" value={money(processingFee)} /> : null}
          <View style={styles.divider} />
          <Summary label="الإجمالي" value={money(total)} total />
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          disabled={isSubmitting}
          style={[styles.submitButton, isSubmitting && styles.disabled]}
          onPress={() => void submit()}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.submitTotal}>{money(total)}</Text>
              <Text style={styles.submitTitle}>تأكيد الطلب</Text>
              <View style={styles.submitIcon}><Ionicons name="checkmark" size={21} color="#FFFFFF" /></View>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

type FieldProps = ComponentProps<typeof TextInput>;
function Field(props: FieldProps) {
  return (
    <TextInput
      {...props}
      placeholderTextColor={NAVIENTY_NOW_COLORS.textMuted}
      style={[styles.input, props.style]}
      textAlign="right"
    />
  );
}

function Summary({ label, value, total = false }: { label: string; value: string; total?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={total ? styles.totalLabel : styles.summaryLabel}>{label}</Text>
      <Text style={total ? styles.totalValue : styles.summaryValue}>{value}</Text>
    </View>
  );
}

function StateView({ title, description, action, onPress }: { title: string; description?: string; action: string; onPress: () => void }) {
  return (
    <View style={styles.stateScreen}>
      <Text style={styles.stateTitle}>{title}</Text>
      {description ? <Text style={styles.stateDescription}>{description}</Text> : null}
      <Pressable style={styles.primaryButton} onPress={onPress}>
        <Text style={styles.primaryButtonText}>{action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: NAVIENTY_NOW_COLORS.page, flex: 1 },
  stateScreen: { alignItems: 'center', backgroundColor: NAVIENTY_NOW_COLORS.page, flex: 1, justifyContent: 'center', padding: 28 },
  stateTitle: { color: NAVIENTY_NOW_COLORS.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  stateDescription: { color: NAVIENTY_NOW_COLORS.textSecondary, fontSize: 12, lineHeight: 20, marginTop: 8, textAlign: 'center' },
  loadingText: { color: NAVIENTY_NOW_COLORS.textSecondary, fontSize: 12, marginTop: 10 },
  primaryButton: { alignItems: 'center', backgroundColor: NAVIENTY_NOW_COLORS.primary, borderRadius: 999, marginTop: 20, minHeight: 52, justifyContent: 'center', paddingHorizontal: 28 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  header: { alignItems: 'center', borderBottomColor: '#EEEEEE', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 78, paddingBottom: 12, paddingHorizontal: 16 },
  backButton: { alignItems: 'center', borderColor: '#E1E1E1', borderRadius: 23, borderWidth: 1, height: 46, justifyContent: 'center', width: 46 },
  headerTitle: { color: NAVIENTY_NOW_COLORS.text, flex: 1, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  headerSpacer: { height: 46, width: 46 },
  scroll: { flex: 1 },
  content: { alignSelf: 'center', maxWidth: NAVIENTY_NOW_LAYOUT.contentMaxWidth, padding: 16, paddingBottom: 28, width: '100%' },
  card: { backgroundColor: '#FFFFFF', borderColor: NAVIENTY_NOW_COLORS.border, borderRadius: NAVIENTY_NOW_LAYOUT.cardRadius, borderWidth: 1, marginBottom: 14, padding: 15 },
  sectionTitle: { color: NAVIENTY_NOW_COLORS.text, fontSize: 15, fontWeight: '900', marginBottom: 11, textAlign: 'right', writingDirection: 'rtl' },
  input: { backgroundColor: NAVIENTY_NOW_COLORS.surface, borderColor: NAVIENTY_NOW_COLORS.border, borderRadius: 15, borderWidth: 1, color: NAVIENTY_NOW_COLORS.text, fontSize: 13, minHeight: 50, marginTop: 9, paddingHorizontal: 13, writingDirection: 'rtl' },
  multiline: { minHeight: 80, paddingTop: 13 },
  locationRow: { alignItems: 'center', flexDirection: 'row-reverse', marginTop: 10 },
  locationButton: { alignItems: 'center', backgroundColor: NAVIENTY_NOW_COLORS.primaryUltraPale, borderRadius: 999, flexDirection: 'row-reverse', minHeight: 38, paddingHorizontal: 10 },
  locationButtonText: { color: NAVIENTY_NOW_COLORS.primaryDark, fontSize: 10, fontWeight: '900', marginRight: 4 },
  locationText: { color: NAVIENTY_NOW_COLORS.textSecondary, flex: 1, fontSize: 10, lineHeight: 16, marginRight: 10, textAlign: 'right', writingDirection: 'rtl' },
  method: { alignItems: 'center', borderColor: NAVIENTY_NOW_COLORS.border, borderRadius: 16, borderWidth: 1, flexDirection: 'row-reverse', marginTop: 9, minHeight: 58, padding: 12 },
  methodSelected: { backgroundColor: NAVIENTY_NOW_COLORS.primaryUltraPale, borderColor: NAVIENTY_NOW_COLORS.primary },
  radio: { alignItems: 'center', borderColor: NAVIENTY_NOW_COLORS.primary, borderRadius: 11, borderWidth: 2, height: 22, justifyContent: 'center', width: 22 },
  radioInner: { backgroundColor: NAVIENTY_NOW_COLORS.primary, borderRadius: 6, height: 12, width: 12 },
  methodCopy: { alignItems: 'flex-end', flex: 1, marginRight: 10 },
  methodName: { color: NAVIENTY_NOW_COLORS.text, fontSize: 13, fontWeight: '900', textAlign: 'right' },
  methodSubtitle: { color: NAVIENTY_NOW_COLORS.textSecondary, fontSize: 9.5, marginTop: 3, textAlign: 'right', writingDirection: 'rtl' },
  summaryRow: { alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between', minHeight: 39 },
  summaryLabel: { color: NAVIENTY_NOW_COLORS.textSecondary, fontSize: 11, writingDirection: 'rtl' },
  summaryValue: { color: NAVIENTY_NOW_COLORS.text, fontSize: 12, fontWeight: '800' },
  divider: { backgroundColor: '#EAEAEA', height: StyleSheet.hairlineWidth, marginVertical: 7 },
  totalLabel: { color: NAVIENTY_NOW_COLORS.text, fontSize: 13, fontWeight: '900', writingDirection: 'rtl' },
  totalValue: { color: NAVIENTY_NOW_COLORS.primaryDark, fontSize: 19, fontWeight: '900' },
  bottomBar: { backgroundColor: '#FFFFFF', borderTopColor: '#EEEEEE', borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 11 },
  submitButton: { alignItems: 'center', alignSelf: 'center', backgroundColor: NAVIENTY_NOW_COLORS.primary, borderRadius: 999, flexDirection: 'row', height: 56, justifyContent: 'space-between', maxWidth: NAVIENTY_NOW_LAYOUT.contentMaxWidth, paddingHorizontal: 8, width: '100%' },
  disabled: { opacity: 0.65 },
  submitTotal: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', minWidth: 100, paddingLeft: 10 },
  submitTitle: { color: '#FFFFFF', flex: 1, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  submitIcon: { alignItems: 'center', backgroundColor: NAVIENTY_NOW_COLORS.primaryDark, borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
});

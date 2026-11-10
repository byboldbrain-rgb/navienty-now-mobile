import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import getAppBootstrap, {
  type AppBootstrap,
} from '../../services/bootstrap-service';
import {
  getDeliveryLocationErrorMessage,
  resolveDeliveryLocation,
  type DeliveryLocationResolution,
} from '../../services/delivery-location-service';
import {
  createGlobalCheckoutRequestId,
  createGlobalOrderGroup,
  submitGlobalOrderGroup,
  type GlobalOrderGroup,
} from '../../services/global-order-group-service';
import { ensureAppSession } from '../../services/anonymous-auth-service';
import { getOrderByToken } from '../../services/order-service';
import { useCartStore, type StoreCart } from '../../store/cart-store';
import { useCustomerStore } from '../../store/customer-store';
import { useOrdersStore } from '../../store/orders-store';
import { openOrderInWhatsApp } from '../../utils/order-whatsapp';

const GREEN = '#00B14F';
// Current payment-method configuration charges EGP 10 per checkout.
// The server calculates the final fee; differences require user approval.
const PREVIEW_PAYMENT_FEE = 10;

type QuoteState = {
  key: string;
  quotes: Record<string, DeliveryLocationResolution>;
  errors: Record<string, string>;
};

type CreatedGroupState = {
  fingerprint: string;
  group: GlobalOrderGroup;
  whatsappOpened: boolean;
};

function money(amount: number | null): string {
  if (amount === null) return 'جارٍ الحساب...';
  const normalized = Math.round(amount * 100) / 100;
  return `${Number.isInteger(normalized) ? normalized : normalized.toFixed(2)} ج`;
}

function subtotalFor(cart: StoreCart): number {
  return cart.items.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0,
  );
}

function PriceRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.priceRow}>
      <Text style={[styles.priceValue, strong && styles.strongValue]}>
        {value}
      </Text>
      <Text style={[styles.priceLabel, strong && styles.strongLabel]}>
        {label}
      </Text>
    </View>
  );
}

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad';
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9A9A9A"
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        textAlign="right"
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
  );
}

export default function GlobalStoreCheckout() {
  const router = useRouter();
  const carts = useCartStore((state) => state.carts);
  const clearStoreCart = useCartStore((state) => state.clearStoreCart);
  const updateStoreDeliveryTerms = useCartStore(
    (state) => state.updateStoreDeliveryTerms,
  );
  const upsertOrder = useOrdersStore((state) => state.upsertOrder);

  const customerName = useCustomerStore((state) => state.customerName);
  const phoneNumber = useCustomerStore((state) => state.phoneNumber);
  const address = useCustomerStore((state) => state.address);
  const landmark = useCustomerStore((state) => state.landmark);
  const latitude = useCustomerStore((state) => state.locationLatitude);
  const longitude = useCustomerStore((state) => state.locationLongitude);
  const paymentMethod = useCustomerStore((state) => state.paymentMethod);
  const setCustomerName = useCustomerStore((state) => state.setCustomerName);
  const setPhoneNumber = useCustomerStore((state) => state.setPhoneNumber);
  const setAddress = useCustomerStore((state) => state.setAddress);
  const setLandmark = useCustomerStore((state) => state.setLandmark);
  const setPaymentMethod = useCustomerStore((state) => state.setPaymentMethod);

  const [bootstrap, setBootstrap] = useState<AppBootstrap | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<QuoteState | null>(null);
  const [quoteRetry, setQuoteRetry] = useState(0);
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [serverGroupPreview, setServerGroupPreview] =
    useState<GlobalOrderGroup | null>(null);
  const requestRef = useRef<{ fingerprint: string; id: string } | null>(null);
  const createdGroupRef = useRef<CreatedGroupState | null>(null);
  const processingRef = useRef(false);

  const storeCarts = useMemo(
    () => Object.values(carts).filter((cart) => cart.items.length > 0),
    [carts],
  );
  const idsKey = storeCarts.map((cart) => cart.storeId).join('|');
  const hasPin =
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude);
  const quoteKey = `${idsKey}:${latitude ?? 'no-lat'}:${longitude ?? 'no-lng'}:${quoteRetry}`;

  useEffect(() => {
    let cancelled = false;
    getAppBootstrap()
      .then((result) => {
        if (!cancelled) {
          setBootstrap(result);
          setBootstrapError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setBootstrapError(
            error instanceof Error ? error.message : 'تعذر تحميل طرق الدفع.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setQuotes(null);
    if (!hasPin || storeCarts.length === 0) return;

    // The key contains store IDs and coordinates, not persisted fees.
    // Updating cart delivery terms must not start an endless quote loop.
    const currentCarts = storeCarts;
    void Promise.all(
      currentCarts.map(async (cart) => {
        try {
          const quote = await resolveDeliveryLocation({
            latitude: latitude!,
            longitude: longitude!,
            storeId: cart.storeId,
          });
          if (
            quote.serviceable &&
            quote.storeAvailable === true &&
            quote.deliveryFee !== null &&
            Number.isFinite(quote.deliveryFee)
          ) {
            return { id: cart.storeId, quote, error: null as string | null };
          }
          return {
            id: cart.storeId,
            quote: null,
            error: getDeliveryLocationErrorMessage(quote.reason),
          };
        } catch (error) {
          return {
            id: cart.storeId,
            quote: null,
            error: error instanceof Error
              ? error.message
              : 'تعذر حساب توصيل هذا المتجر.',
          };
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      const nextQuotes: QuoteState = { key: quoteKey, quotes: {}, errors: {} };
      for (const result of results) {
        if (result.quote) {
          nextQuotes.quotes[result.id] = result.quote;
          updateStoreDeliveryTerms(
            result.id,
            result.quote.deliveryFee!,
            result.quote.minimumOrder ?? 0,
          );
        } else {
          nextQuotes.errors[result.id] = result.error ?? 'التوصيل غير متاح.';
        }
      }
      setQuotes(nextQuotes);
    });
    return () => {
      cancelled = true;
    };
  }, [quoteKey, updateStoreDeliveryTerms]);

  const currentQuotes = quotes?.key === quoteKey ? quotes : null;
  const allQuoted =
    storeCarts.length > 0 &&
    storeCarts.every((cart) => {
      const quote = currentQuotes?.quotes[cart.storeId];
      return quote?.serviceable === true &&
        quote.storeAvailable === true &&
        quote.deliveryFee !== null;
    });
  const minimumFailures = storeCarts.filter((cart) => {
    const minimum = currentQuotes?.quotes[cart.storeId]?.minimumOrder ?? 0;
    return subtotalFor(cart) < minimum;
  });
  const productsSubtotal = storeCarts.reduce(
    (sum, cart) => sum + subtotalFor(cart),
    0,
  );
  const quotedDeliveryTotal = allQuoted
    ? storeCarts.reduce(
        (sum, cart) =>
          sum + (currentQuotes?.quotes[cart.storeId]?.deliveryFee ?? 0),
        0,
      )
    : null;
  const previewTotal = quotedDeliveryTotal === null
    ? null
    : productsSubtotal + quotedDeliveryTotal + PREVIEW_PAYMENT_FEE;

  const fingerprint = JSON.stringify({
    stores: storeCarts.map((cart) => ({
      id: cart.storeId,
      items: cart.items.map((item) => [
        item.id,
        item.variantId ?? null,
        item.quantity,
        item.price,
      ]),
    })),
    latitude,
    longitude,
    customerName,
    phoneNumber,
    address,
    landmark,
    paymentMethod,
    notes,
  });
  const approvedGroup = createdGroupRef.current?.fingerprint === fingerprint
    ? serverGroupPreview
    : null;
  const renderedSubtotal = approvedGroup?.subtotal ?? productsSubtotal;
  const renderedDelivery = approvedGroup?.deliveryFee ?? quotedDeliveryTotal;
  const renderedFee = approvedGroup?.paymentProcessingFee ?? PREVIEW_PAYMENT_FEE;
  const renderedTotal = approvedGroup?.totalAmount ?? previewTotal;
  const normalizedPhone = phoneNumber.replace(/\D/g, '');
  const selectedMethod = bootstrap?.payment_methods.find(
    (method) => method.id === paymentMethod,
  );
  const detailsValid =
    customerName.trim().length >= 2 &&
    /^01[0125]\d{8}$/.test(normalizedPhone) &&
    address.trim().length >= 8 &&
    selectedMethod !== undefined &&
    hasPin;
  const canSubmit =
    detailsValid &&
    allQuoted &&
    minimumFailures.length === 0 &&
    bootstrap?.settings.orders_enabled === true &&
    !processing;

  function chooseLocation() {
    const firstStore = storeCarts[0];
    if (!firstStore) return;
    router.push({
      pathname: '/location-picker',
      params: {
        storeId: firstStore.storeId,
        source: 'global-checkout',
      },
    });
  }

  async function submitAllOrders() {
    setSubmitted(true);
    if (processingRef.current) return;
    if (!canSubmit || !selectedMethod || !hasPin) {
      Alert.alert(
        'راجع بيانات الطلبات',
        'تأكد من بيانات العميل والعنوان، ومن توفر توصيل كل مطعم والحد الأدنى للطلب.',
      );
      return;
    }

    processingRef.current = true;
    setProcessing(true);
    try {
      await ensureAppSession();
      let state = createdGroupRef.current;
      if (!state || state.fingerprint !== fingerprint) {
        let request = requestRef.current;
        if (!request || request.fingerprint !== fingerprint) {
          request = { fingerprint, id: createGlobalCheckoutRequestId() };
          requestRef.current = request;
        }
        const firstQuote = currentQuotes?.quotes[storeCarts[0].storeId];
        const group = await createGlobalOrderGroup({
          clientRequestId: request.id,
          stores: storeCarts.map((cart) => ({
            storeId: cart.storeId,
            items: cart.items.map((item) => ({
              productId: item.id,
              variantId: item.variantId,
              quantity: item.quantity,
            })),
          })),
          serviceAreaId: firstQuote?.serviceAreaId ?? null,
          latitude: latitude!,
          longitude: longitude!,
          paymentMethodId: selectedMethod.id,
          customerName,
          customerPhone: normalizedPhone,
          address,
          landmark,
          notes,
        });
        if (group.orders.length !== storeCarts.length) {
          throw new Error('عدد الطلبات المُنشأة لا يطابق عدد المتاجر في السلة.');
        }
        state = { fingerprint, group, whatsappOpened: false };
        createdGroupRef.current = state;

        // Always show the authoritative server totals if pricing changed.
        if (previewTotal === null ||
            Math.abs(group.totalAmount - previewTotal) > 0.01 ||
            Math.abs(group.deliveryFee - (quotedDeliveryTotal ?? 0)) > 0.01) {
          setServerGroupPreview(group);
          Alert.alert(
            'تم تحديث الإجمالي',
            `الإجمالي المؤكد من قاعدة البيانات ${money(group.totalAmount)}. راجع الرسوم الظاهرة لكل مطعم واضغط إتمام الطلبات مرة أخرى للموافقة.`,
          );
          return;
        }
      }

      if (state.group.status !== 'submitted' && !state.whatsappOpened) {
        await openOrderInWhatsApp({
          whatsappNumber: state.group.whatsappNumber,
          whatsappMessage: state.group.whatsappMessage,
        });
        // As in single-store checkout, successfully opening the WhatsApp
        // deep link is the best signal available, not proof of sending.
        state.whatsappOpened = true;
      }

      const group = state.group.status === 'submitted'
        ? state.group
        : await submitGlobalOrderGroup(state.group.accessToken);
      state.group = group;

      // Each child remains a distinct order in the existing orders history.
      await Promise.allSettled(
        group.orders.map(async (child) => {
          const order = await getOrderByToken(child.accessToken);
          upsertOrder(order);
        }),
      );
      for (const cart of storeCarts) clearStoreCart(cart.storeId);
      router.replace({
        pathname: '/global-order-success',
        params: { token: group.accessToken },
      });
    } catch (error) {
      Alert.alert(
        'تعذر إتمام الطلبات',
        error instanceof Error
          ? error.message
          : 'حدث خطأ أثناء إنشاء الطلبات، حاول مرة أخرى.',
      );
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }

  if (storeCarts.length === 0) {
    return (
      <SafeAreaView style={styles.empty}>
        <Text style={styles.title}>السلة فارغة</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.replace('/')}>
          <Text style={styles.primaryText}>العودة للتسوق</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView edges={['top']} style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="الرجوع"
            hitSlop={12}
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#222" />
          </Pressable>
          <View style={styles.heading}>
            <Text style={styles.title}>إتمام الطلبات</Text>
            <Text style={styles.subtitle}>
              {storeCarts.length} طلبات من {storeCarts.length} أماكن مختلفة
            </Text>
          </View>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={20} color="#12844A" />
            <Text style={styles.noticeText}>
              كل مطعم له أوردر مستقل برسوم توصيل واضحة. هتدفع إجمالي الطلبات كلها في خطوة واحدة.
            </Text>
          </View>

          <Text style={styles.sectionHeading}>تفاصيل طلباتك</Text>
          {storeCarts.map((cart, index) => {
            const quote = currentQuotes?.quotes[cart.storeId];
            const error = currentQuotes?.errors[cart.storeId];
            const child = approvedGroup?.orders.find(
              (order) => order.storeId === cart.storeId,
            );
            const storeSubtotal = child?.subtotal ?? subtotalFor(cart);
            const storeDelivery = child?.deliveryFee ?? quote?.deliveryFee ?? null;
            const minimum = quote?.minimumOrder ?? 0;
            const hasMinimumError = subtotalFor(cart) < minimum;

            return (
              <View key={cart.storeId} style={styles.orderCard}>
                <View style={styles.orderCardHeader}>
                  <Text style={styles.orderNumber}>الأوردر #{index + 1}</Text>
                  <View style={styles.storeHeading}>
                    <Text style={styles.storeName} numberOfLines={1}>
                      {cart.storeName}
                    </Text>
                    <Text style={styles.storeEmoji}>
                      {cart.storeIcon.startsWith('http') ? '🏪' : cart.storeIcon}
                    </Text>
                  </View>
                </View>
                <View style={styles.line} />
                {cart.items.map((item) => (
                  <View
                    key={`${item.id}-${item.variantId ?? 'base'}`}
                    style={styles.itemRow}
                  >
                    <Text style={styles.itemPrice}>
                      {money(item.price * item.quantity)}
                    </Text>
                    <View style={styles.itemContent}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemMeta}>
                        {item.variantName ? `${item.variantName} · ` : ''}
                        الكمية: {item.quantity}
                      </Text>
                    </View>
                  </View>
                ))}
                <View style={styles.line} />
                <PriceRow label="إجمالي المنتجات" value={money(storeSubtotal)} />
                <PriceRow
                  label={`توصيل ${cart.storeName}`}
                  value={
                    storeDelivery === null
                      ? error ?? 'جارٍ حساب التوصيل...'
                      : storeDelivery === 0 ? 'مجاني' : money(storeDelivery)
                  }
                />
                {hasMinimumError ? (
                  <Text style={styles.errorText}>
                    الحد الأدنى للطلب من {cart.storeName} هو {money(minimum)}.
                  </Text>
                ) : null}
                {error ? (
                  <Pressable onPress={() => setQuoteRetry((v) => v + 1)}>
                    <Text style={styles.errorText}>
                      {error} — اضغط لإعادة المحاولة
                    </Text>
                  </Pressable>
                ) : null}
                <View style={styles.cardTotal}>
                  <PriceRow
                    strong
                    label={`إجمالي الأوردر #${index + 1}`}
                    value={money(
                      child?.totalAmount ??
                      (storeDelivery === null ? null : storeSubtotal + storeDelivery),
                    )}
                  />
                </View>
              </View>
            );
          })}

          <Text style={styles.sectionHeading}>عنوان التوصيل</Text>
          <View style={styles.whiteCard}>
            <Pressable style={styles.locationRow} onPress={chooseLocation}>
              <Text style={styles.changeText}>تغيير</Text>
              <View style={styles.locationContent}>
                <Text style={styles.fieldLabel}>موقع التوصيل على الخريطة</Text>
                <Text style={styles.locationText}>
                  {hasPin ? 'تم تحديد الموقع على الخريطة' : 'حدد موقع التوصيل'}
                </Text>
              </View>
              <Ionicons name="location-outline" size={22} color={GREEN} />
            </Pressable>
            <InputField
              label="العنوان بالتفصيل"
              value={address}
              onChangeText={setAddress}
              placeholder="المبنى، الشقة، الشارع..."
              multiline
            />
            <InputField
              label="علامة مميزة أو تعليمات التوصيل (اختياري)"
              value={landmark}
              onChangeText={setLandmark}
              placeholder="أقرب علامة مميزة"
            />
          </View>

          <Text style={styles.sectionHeading}>بيانات العميل</Text>
          <View style={styles.whiteCard}>
            <InputField
              label="الاسم بالكامل"
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="اسم المستلم"
            />
            <InputField
              label="رقم الموبايل"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="01xxxxxxxxx"
              keyboardType="phone-pad"
            />
            {submitted && !detailsValid ? (
              <Text style={styles.errorText}>
                تأكد من الاسم، رقم الموبايل، العنوان وطريقة الدفع.
              </Text>
            ) : null}
          </View>

          <Text style={styles.sectionHeading}>طريقة الدفع</Text>
          <View style={styles.whiteCard}>
            {bootstrapError ? (
              <Text style={styles.errorText}>{bootstrapError}</Text>
            ) : !bootstrap ? (
              <ActivityIndicator color={GREEN} />
            ) : bootstrap.payment_methods.map((method) => {
              const selected = method.id === paymentMethod;
              return (
                <Pressable
                  key={method.id}
                  onPress={() => setPaymentMethod(method.id)}
                  style={[styles.methodRow, selected && styles.selectedMethod]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                >
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={21}
                    color={selected ? GREEN : '#B4B4B4'}
                  />
                  <Text style={styles.methodName}>{method.name_ar}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionHeading}>ملاحظات الطلبات (اختياري)</Text>
          <View style={styles.whiteCard}>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={notes}
              onChangeText={setNotes}
              placeholder="أي تفاصيل إضافية للمطاعم أو المندوب"
              placeholderTextColor="#999"
              textAlign="right"
              multiline
            />
          </View>

          <Text style={styles.sectionHeading}>ملخص الدفع</Text>
          <View style={styles.whiteCard}>
            <PriceRow label="إجمالي المنتجات" value={money(renderedSubtotal)} />
            <PriceRow
              label={`توصيل ${storeCarts.length} أماكن`}
              value={money(renderedDelivery)}
            />
            {storeCarts.map((cart) => {
              const child = approvedGroup?.orders.find(
                (order) => order.storeId === cart.storeId,
              );
              const delivery = child?.deliveryFee ??
                currentQuotes?.quotes[cart.storeId]?.deliveryFee ?? null;
              return (
                <PriceRow
                  key={cart.storeId}
                  label={`↳ ${cart.storeName}`}
                  value={delivery === 0 ? 'مجاني' : money(delivery)}
                />
              );
            })}
            <PriceRow
              label="رسوم الدفع الإلكتروني (مرة واحدة)"
              value={money(renderedFee)}
            />
            <View style={styles.line} />
            <PriceRow label="الإجمالي النهائي" value={money(renderedTotal)} strong />
            {approvedGroup ? (
              <Text style={styles.reviewNotice}>
                الأسعار المعروضة هنا هي المبالغ المؤكدة من قاعدة البيانات. راجعها قبل التأكيد.
              </Text>
            ) : null}
            <View style={styles.deliveryExplanation}>
              <Ionicons name="bicycle-outline" size={18} color="#666" />
              <Text style={styles.deliveryExplanationText}>
                رسوم التوصيل منفصلة لأن كل أوردر بيتم تحضيره وتوصيله من مكان مختلف.
              </Text>
            </View>
          </View>
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={styles.footer}>
          <View style={styles.footerRow}>
            <Text style={styles.footerTotal}>{money(renderedTotal)}</Text>
            <Text style={styles.footerLabel}>الإجمالي المطلوب</Text>
          </View>
          <Pressable
            disabled={!canSubmit || processing}
            onPress={() => { void submitAllOrders(); }}
            style={[styles.primaryButton, (!canSubmit || processing) && styles.buttonDisabled]}
          >
            {processing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>
                إتمام {storeCarts.length} طلبات عبر واتساب
              </Text>
            )}
          </Pressable>
          {!allQuoted && hasPin ? (
            <Text style={styles.footerHint}>
              {currentQuotes ? 'بعض المطاعم غير متاحة لهذا الموقع.' : 'جارٍ التحقق من رسوم توصيل كل متجر...'}
            </Text>
          ) : null}
          {minimumFailures.length > 0 ? (
            <Text style={styles.footerHint}>هناك طلب أقل من الحد الأدنى لأحد المتاجر.</Text>
          ) : null}
        </SafeAreaView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FA' },
  empty: { flex: 1, backgroundColor: '#fff', padding: 30, justifyContent: 'center', gap: 20 },
  header: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  heading: { flex: 1, alignItems: 'flex-end' },
  backButton: { padding: 7 },
  title: { fontSize: 23, fontWeight: '800', color: '#191919', textAlign: 'right' },
  subtitle: { fontSize: 13, color: '#777', marginTop: 3, textAlign: 'right' },
  content: { paddingHorizontal: 17, paddingTop: 17, paddingBottom: 22, gap: 12 },
  notice: { flexDirection: 'row-reverse', alignItems: 'flex-start', backgroundColor: '#EAF8F0', borderRadius: 13, padding: 13, gap: 9 },
  noticeText: { flex: 1, color: '#206D48', fontSize: 13, lineHeight: 21, textAlign: 'right' },
  sectionHeading: { fontSize: 18, fontWeight: '800', color: '#191919', textAlign: 'right', marginTop: 9, marginBottom: 1 },
  orderCard: { backgroundColor: '#FFF', padding: 15, borderWidth: 1, borderColor: '#E9E9E9', borderRadius: 17, gap: 12 },
  orderCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderNumber: { color: GREEN, fontWeight: '800', backgroundColor: '#EAF8F0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  storeHeading: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 7 },
  storeEmoji: { fontSize: 20 },
  storeName: { fontSize: 17, fontWeight: '800', color: '#202020', flexShrink: 1, textAlign: 'right' },
  line: { height: 1, backgroundColor: '#EEEEEE' },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  itemContent: { flex: 1, alignItems: 'flex-end' },
  itemName: { fontSize: 14, fontWeight: '600', color: '#252525', textAlign: 'right' },
  itemMeta: { marginTop: 4, color: '#888', fontSize: 12, textAlign: 'right' },
  itemPrice: { fontSize: 14, fontWeight: '700', color: '#333' },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 26 },
  priceValue: { fontSize: 14, color: '#222', fontWeight: '600' },
  priceLabel: { flex: 1, fontSize: 14, color: '#666', textAlign: 'right' },
  strongLabel: { fontSize: 17, fontWeight: '800', color: '#181818' },
  strongValue: { fontSize: 18, fontWeight: '800', color: '#181818' },
  cardTotal: { borderTopWidth: 1, borderColor: '#EEE', paddingTop: 10 },
  errorText: { textAlign: 'right', color: '#B42318', fontSize: 12, lineHeight: 19 },
  whiteCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#ECECEC', borderRadius: 16, padding: 15, gap: 11 },
  field: { gap: 7 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#444', textAlign: 'right' },
  input: { backgroundColor: '#FAFAFA', borderRadius: 11, borderWidth: 1, borderColor: '#E6E6E6', minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, color: '#202020', fontSize: 14 },
  multiline: { minHeight: 74, textAlignVertical: 'top' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 5 },
  locationContent: { flex: 1, alignItems: 'flex-end', gap: 3 },
  locationText: { fontSize: 13, color: '#777', textAlign: 'right' },
  changeText: { fontSize: 13, color: GREEN, fontWeight: '800' },
  methodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 49, paddingHorizontal: 12, borderWidth: 1, borderColor: '#EEE', borderRadius: 11 },
  methodName: { color: '#222', fontSize: 15, fontWeight: '600', textAlign: 'right' },
  selectedMethod: { borderColor: GREEN, backgroundColor: '#F2FCF6' },
  deliveryExplanation: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 7, marginTop: 5 },
  deliveryExplanationText: { flex: 1, fontSize: 12, lineHeight: 20, color: '#777', textAlign: 'right' },
  reviewNotice: { fontSize: 12, color: '#206D48', textAlign: 'right', lineHeight: 20 },
  footer: { backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#EEE', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 7, gap: 9 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerLabel: { fontWeight: '700', fontSize: 13, color: '#444' },
  footerTotal: { fontSize: 21, fontWeight: '900', color: '#191919' },
  primaryButton: { minHeight: 52, borderRadius: 13, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonDisabled: { opacity: 0.48 },
  primaryText: { fontWeight: '800', color: '#FFF', fontSize: 16 },
  footerHint: { fontSize: 12, color: '#BB6010', textAlign: 'center' },
});

import { useRouter } from 'expo-router';
import {
    useEffect,
    useState,
} from 'react';
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

import getAppBootstrap, {
    type AppBootstrap,
} from '../services/bootstrap-service';
import {
    cancelPendingWhatsAppOrder,
    createWhatsAppOrder,
} from '../services/order-service';
import {
    selectCartItemCount,
    selectCartSubtotal,
    selectCartTotal,
    useCartStore,
} from '../store/cart-store';
import {
    useCustomerStore,
} from '../store/customer-store';
import { useOrdersStore } from '../store/orders-store';
import { openOrderInWhatsApp } from '../utils/order-whatsapp';

type DefaultArea = {
  id: string;
  name: string;
};

function getDefaultArea(
  bootstrap: AppBootstrap,
): DefaultArea | null {
  const defaultAreaId =
    bootstrap.settings
      .default_service_area_id;

  for (const city of bootstrap.cities) {
    const area = city.areas.find(
      (currentArea) =>
        currentArea.id ===
        defaultAreaId,
    );

    if (area) {
      return {
        id: area.id,
        name:
          `${area.name_ar}، ${city.name_ar}`,
      };
    }
  }

  const firstCity =
    bootstrap.cities[0];

  const firstArea =
    firstCity?.areas[0];

  if (!firstArea) {
    return null;
  }

  return {
    id: firstArea.id,
    name: firstCity
      ? `${firstArea.name_ar}، ${firstCity.name_ar}`
      : firstArea.name_ar,
  };
}


export default function CheckoutScreen() {
  const router = useRouter();

  const [bootstrap, setBootstrap] =
    useState<AppBootstrap | null>(null);

  const [isLoadingBootstrap, setIsLoadingBootstrap] =
    useState(true);

  const [bootstrapError, setBootstrapError] =
    useState<string | null>(null);

  const items = useCartStore((state) => state.items);
  const storeId = useCartStore((state) => state.storeId);
  const storeName = useCartStore((state) => state.storeName);
  const storeIcon = useCartStore((state) => state.storeIcon);
  const deliveryFee = useCartStore((state) => state.deliveryFee);

  const itemCount = useCartStore(selectCartItemCount);
  const subtotal = useCartStore(selectCartSubtotal);
  const total = useCartStore(selectCartTotal);

  const pendingOrder = useOrdersStore(
    (state) => state.pendingOrder,
  );

  const setPendingOrder = useOrdersStore(
    (state) => state.setPendingOrder,
  );

  const discardPendingOrder = useOrdersStore(
    (state) => state.discardPendingOrder,
  );

  const customerName = useCustomerStore(
    (state) => state.customerName,
  );
  const phoneNumber = useCustomerStore(
    (state) => state.phoneNumber,
  );
  const address = useCustomerStore(
    (state) => state.address,
  );
  const landmark = useCustomerStore(
    (state) => state.landmark,
  );
  const paymentMethod = useCustomerStore(
    (state) => state.paymentMethod,
  );

  const setCustomerName = useCustomerStore(
    (state) => state.setCustomerName,
  );
  const setPhoneNumber = useCustomerStore(
    (state) => state.setPhoneNumber,
  );
  const setAddress = useCustomerStore(
    (state) => state.setAddress,
  );
  const setLandmark = useCustomerStore(
    (state) => state.setLandmark,
  );
  const setPaymentMethod = useCustomerStore(
    (state) => state.setPaymentMethod,
  );

  const [notes, setNotes] =
    useState('');

  const [submitted, setSubmitted] =
    useState(false);

  const [
    isOpeningWhatsApp,
    setIsOpeningWhatsApp,
  ] = useState(false);

  async function loadCheckoutData() {
    try {
      setIsLoadingBootstrap(true);
      setBootstrapError(null);

      const loadedBootstrap =
        await getAppBootstrap();

      setBootstrap(loadedBootstrap);

      const paymentMethodExists =
        loadedBootstrap.payment_methods.some(
          (method) =>
            method.id ===
            paymentMethod,
        );

      if (
        paymentMethod &&
        !paymentMethodExists
      ) {
        setPaymentMethod(null);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر تحميل إعدادات الطلب من Supabase.';

      setBootstrap(null);
      setBootstrapError(message);
    } finally {
      setIsLoadingBootstrap(false);
    }
  }

  useEffect(() => {
    void loadCheckoutData();
  }, []);

  const normalizedPhone =
    phoneNumber.replace(/\D/g, '');

  const paymentMethods =
    bootstrap?.payment_methods ?? [];

  const selectedPaymentMethod =
    paymentMethods.find(
      (method) =>
        method.id ===
        paymentMethod,
    );

  const defaultArea =
    bootstrap
      ? getDefaultArea(bootstrap)
      : null;

  const currencySymbol =
    bootstrap?.settings
      .currency_symbol ?? '';

  const appName =
    bootstrap?.settings.app_name ??
    '';

  const validation = {
    customerName:
      customerName.trim().length >= 2,

    phoneNumber:
      /^01[0125]\d{8}$/.test(
        normalizedPhone,
      ),

    address:
      address.trim().length >= 8,

    paymentMethod:
      paymentMethod !== null,
  };

  const formIsValid =
    Object.values(validation).every(
      Boolean,
    );



  if (items.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <View style={styles.emptyIconContainer}>
          <Text style={styles.emptyIcon}>🛒</Text>
        </View>

        <Text style={styles.emptyTitle}>لا يوجد طلب لإرساله</Text>

        <Text style={styles.emptyDescription}>
          أضف منتجات إلى السلة أولًا ثم ارجع لإتمام الطلب.
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.primaryButtonText}>
            العودة للتسوق
          </Text>
        </Pressable>
      </View>
    );
  }

  if (isLoadingBootstrap) {
    return (
      <View style={styles.emptyScreen}>
        <ActivityIndicator
          size="large"
          color="#6d56df"
        />

        <Text style={styles.emptyTitle}>
          جاري تحميل بيانات الطلب
        </Text>

        <Text
          style={styles.emptyDescription}
        >
          يتم تحميل الإعدادات وطرق
          الدفع من Supabase.
        </Text>
      </View>
    );
  }

  if (
    !bootstrap ||
    !defaultArea ||
    bootstrapError
  ) {
    return (
      <View style={styles.emptyScreen}>
        <View
          style={
            styles.emptyIconContainer
          }
        >
          <Text style={styles.emptyIcon}>
            ⚠️
          </Text>
        </View>

        <Text style={styles.emptyTitle}>
          تعذر تحميل بيانات الطلب
        </Text>

        <Text
          style={styles.emptyDescription}
        >
          {bootstrapError ??
            'منطقة التوصيل غير مضبوطة في Supabase.'}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed &&
              styles.buttonPressed,
          ]}
          onPress={() => {
            void loadCheckoutData();
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
      </View>
    );
  }


  async function sendOrderToWhatsApp() {
    setSubmitted(true);

    if (
      !formIsValid ||
      !selectedPaymentMethod
    ) {
      return;
    }

    if (
      !storeId ||
      !storeName
    ) {
      Alert.alert(
        'بيانات المتجر غير مكتملة',
        'ارجع إلى المتجر وأعد إضافة المنتجات إلى السلة.',
      );

      return;
    }

    if (
      !bootstrap ||
      !defaultArea
    ) {
      Alert.alert(
        'بيانات الطلب غير مكتملة',
        'تعذر تحميل إعدادات التطبيق أو منطقة التوصيل من Supabase.',
      );

      return;
    }

    const activeStoreId = storeId;
    const activeArea = defaultArea;
    const activeBootstrap = bootstrap;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const cartContainsLegacyIds =
      !uuidPattern.test(
        activeStoreId,
      ) ||
      items.some(
        (item) =>
          !uuidPattern.test(item.id),
      );

    if (cartContainsLegacyIds) {
      Alert.alert(
        'السلة تحتاج إلى تحديث',
        'هذه السلة أُنشئت قبل ربط الكتالوج بـSupabase. أفرغ السلة وأضف المنتجات من المتجر مرة أخرى.',
      );

      return;
    }

    if (
      !activeBootstrap.settings
        .orders_enabled
    ) {
      Alert.alert(
        'استقبال الطلبات متوقف',
        'الطلبات ما زالت غير مفعّلة في إعدادات Supabase.',
      );

      return;
    }

    let createdOrder:
      Awaited<
        ReturnType<
          typeof createWhatsAppOrder
        >
      > | null = null;

    try {
      setIsOpeningWhatsApp(true);

      if (pendingOrder) {
        try {
          await cancelPendingWhatsAppOrder(
            pendingOrder.accessToken,
            'checkout_recreated',
          );
        } catch {
          // The previous pending order may
          // already be cancelled or confirmed.
        }

        discardPendingOrder();
      }

      createdOrder =
        await createWhatsAppOrder({
          storeId:
            activeStoreId,

          serviceAreaId:
            activeArea.id,

          paymentMethodId:
            selectedPaymentMethod.id,

          customerName,

          customerPhone:
            normalizedPhone,

          address,
          landmark,
          notes,

          items: items.map(
            (item) => ({
              productId: item.id,
              quantity:
                item.quantity,
            }),
          ),
        });

      setPendingOrder(createdOrder);

      await openOrderInWhatsApp(
        createdOrder,
      );

      router.push(
        '/order-confirmation',
      );
    } catch (error) {
      if (createdOrder) {
        try {
          await cancelPendingWhatsAppOrder(
            createdOrder.accessToken,
            'whatsapp_open_failed',
          );
        } catch {
          // Keep the original error visible
          // to the customer.
        }

        discardPendingOrder();
      }

      const message =
        error instanceof Error
          ? error.message
          : 'تعذر إنشاء الطلب أو فتح واتساب.';

      Alert.alert(
        'تعذر إرسال الطلب',
        message,
      );
    } finally {
      setIsOpeningWhatsApp(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.pageContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <View style={styles.topBar}>
            <Pressable
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => router.back()}
            >
              <Text style={styles.backIcon}>›</Text>
            </Pressable>

            <View style={styles.titleContainer}>
              <Text style={styles.pageTitle}>بيانات التوصيل</Text>
              <Text style={styles.pageSubtitle}>
                الخطوة الأخيرة قبل إرسال الطلب
              </Text>
            </View>

            <View style={styles.topBarPlaceholder} />
          </View>

          <View style={styles.storeCard}>
            <View style={styles.storeIconContainer}>
              <Text style={styles.storeIcon}>
                {storeIcon ?? '🏪'}
              </Text>
            </View>

            <View style={styles.storeContent}>
              <Text style={styles.storeLabel}>طلبك من</Text>

              <Text style={styles.storeName} numberOfLines={1}>
                {storeName ?? 'المتجر'}
              </Text>

              <Text style={styles.storeMeta}>
                {itemCount} منتجات • الإجمالي {total}{' '}
                {currencySymbol}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>بيانات العميل</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>الاسم بالكامل</Text>

              <TextInput
                style={[
                  styles.input,
                  submitted &&
                    !validation.customerName &&
                    styles.inputError,
                ]}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="مثال: أحمد محمد"
                placeholderTextColor="#aaaab3"
                autoCapitalize="words"
                textAlign="right"
              />

              {submitted && !validation.customerName && (
                <Text style={styles.errorText}>
                  اكتب اسمًا صحيحًا مكوّنًا من حرفين على الأقل.
                </Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>رقم الموبايل</Text>

              <TextInput
                style={[
                  styles.input,
                  submitted &&
                    !validation.phoneNumber &&
                    styles.inputError,
                ]}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="01xxxxxxxxx"
                placeholderTextColor="#aaaab3"
                keyboardType="phone-pad"
                maxLength={14}
                textAlign="right"
              />

              {submitted && !validation.phoneNumber && (
                <Text style={styles.errorText}>
                  اكتب رقم موبايل مصريًا صحيحًا من 11 رقمًا.
                </Text>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>عنوان التوصيل</Text>

            <View style={styles.areaCard}>
              <View style={styles.areaContent}>
                <Text style={styles.areaLabel}>المنطقة الحالية</Text>
                <Text style={styles.areaValue}>
                  {defaultArea.name}
                </Text>
              </View>

              <Text style={styles.areaIcon}>📍</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                العنوان بالتفصيل
              </Text>

              <TextInput
                style={[
                  styles.input,
                  styles.multilineInput,
                  submitted &&
                    !validation.address &&
                    styles.inputError,
                ]}
                value={address}
                onChangeText={setAddress}
                placeholder="اسم الشارع، رقم العمارة، الدور، رقم الشقة"
                placeholderTextColor="#aaaab3"
                multiline
                numberOfLines={4}
                textAlign="right"
                textAlignVertical="top"
              />

              {submitted && !validation.address && (
                <Text style={styles.errorText}>
                  اكتب عنوانًا واضحًا ومفصلًا للتوصيل.
                </Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                علامة مميزة للمكان
              </Text>

              <TextInput
                style={styles.input}
                value={landmark}
                onChangeText={setLandmark}
                placeholder="مثال: بجوار الصيدلية أو أمام المسجد"
                placeholderTextColor="#aaaab3"
                textAlign="right"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                ملاحظات على الطلب
              </Text>

              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="أي تفاصيل مهمة للمتجر أو المندوب"
                placeholderTextColor="#aaaab3"
                multiline
                numberOfLines={3}
                textAlign="right"
                textAlignVertical="top"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>طريقة الدفع</Text>

            <Text style={styles.sectionDescription}>
              طرق الدفع تأتي من Supabase، وسيتم احتساب السعر
              والإجمالي النهائي داخل قاعدة البيانات قبل فتح واتساب.
            </Text>

            <View style={styles.paymentMethods}>
              {paymentMethods.map((method) => {
                const selected = paymentMethod === method.id;

                return (
                  <Pressable
                    key={method.id}
                    style={({ pressed }) => [
                      styles.paymentMethod,
                      selected && styles.paymentMethodSelected,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() =>
                      setPaymentMethod(
                        method.id,
                      )
                    }
                  >
                    <View
                      style={[
                        styles.radioOuter,
                        selected && styles.radioOuterSelected,
                      ]}
                    >
                      {selected && <View style={styles.radioInner} />}
                    </View>

                    <View style={styles.paymentContent}>
                      <Text style={styles.paymentTitle}>
                        {method.name_ar}
                      </Text>

                      <Text style={styles.paymentSubtitle}>
                        {method.subtitle_ar ?? ''}
                      </Text>
                    </View>

                    <Text style={styles.paymentIcon}>
                      {method.icon ?? '💳'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {submitted && !validation.paymentMethod && (
              <Text style={styles.paymentError}>
                اختر طريقة الدفع المناسبة.
              </Text>
            )}
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>ملخص الطلب</Text>

            <View style={styles.itemsSummary}>
              {items.map((item) => (
                <View key={item.id} style={styles.summaryItem}>
                  <Text style={styles.summaryItemPrice}>
                    {item.price * item.quantity}{' '}
                    {currencySymbol}
                  </Text>

                  <Text
                    style={styles.summaryItemName}
                    numberOfLines={1}
                  >
                    {item.name} × {item.quantity}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryValue}>
                {subtotal}{' '}
                {currencySymbol}
              </Text>
              <Text style={styles.summaryLabel}>
                إجمالي المنتجات
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryValue}>
                {deliveryFee}{' '}
                {currencySymbol}
              </Text>
              <Text style={styles.summaryLabel}>
                رسوم التوصيل
              </Text>
            </View>

            <View style={styles.totalDivider} />

            <View style={styles.totalRow}>
              <Text style={styles.totalValue}>
                {total}{' '}
                {currencySymbol}
              </Text>
              <Text style={styles.totalLabel}>الإجمالي</Text>
            </View>
          </View>

          <View style={styles.whatsAppNotice}>
            <View style={styles.whatsAppNoticeContent}>
              <Text style={styles.whatsAppNoticeTitle}>
                الطلب لن يُنفذ تلقائيًا
              </Text>

              <Text style={styles.whatsAppNoticeDescription}>
                بعد فتح واتساب، أرسل الرسالة وانتظر تأكيد
                المنتجات والمبلغ وبيانات الدفع من فريق{' '}
                {appName}. رسالة الطلب والإجمالي تم إنشاؤهما
                داخل Supabase.
              </Text>
            </View>

            <Text style={styles.whatsAppIcon}>💬</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.submitBarWrapper}>
        <View style={styles.submitBarContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              isOpeningWhatsApp && styles.submitButtonDisabled,
              pressed &&
                !isOpeningWhatsApp &&
                styles.submitButtonPressed,
            ]}
            disabled={isOpeningWhatsApp}
            onPress={sendOrderToWhatsApp}
          >
            <View style={styles.submitTotal}>
              <Text style={styles.submitTotalValue}>
                {total}{' '}
                {currencySymbol}
              </Text>

              <Text style={styles.submitTotalLabel}>
                الإجمالي
              </Text>
            </View>

            <Text style={styles.submitButtonText}>
              {isOpeningWhatsApp
                ? 'جاري فتح واتساب...'
                : 'إرسال الطلب عبر واتساب'}
            </Text>

            <View style={styles.submitIconContainer}>
              <Text style={styles.submitIcon}>💬</Text>
            </View>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#f7f7fa',
    flex: 1,
  },

  pageContent: {
    flexGrow: 1,
    paddingBottom: 135,
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
  },

  pageTitle: {
    color: '#202025',
    fontSize: 23,
    fontWeight: '900',
  },

  pageSubtitle: {
    color: '#898992',
    fontSize: 10,
    marginTop: 4,
  },

  topBarPlaceholder: {
    height: 44,
    width: 44,
  },

  storeCard: {
    alignItems: 'center',
    backgroundColor: '#6d56df',
    borderRadius: 24,
    flexDirection: 'row',
    marginTop: 26,
    padding: 18,
  },

  storeIconContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },

  storeIcon: {
    fontSize: 31,
  },

  storeContent: {
    flex: 1,
    marginLeft: 15,
  },

  storeLabel: {
    color: '#dcd7ff',
    fontSize: 11,
    textAlign: 'right',
  },

  storeName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 3,
    textAlign: 'right',
  },

  storeMeta: {
    color: '#e9e6ff',
    fontSize: 10,
    marginTop: 6,
    textAlign: 'right',
  },

  section: {
    marginTop: 28,
  },

  sectionTitle: {
    color: '#202025',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 14,
    textAlign: 'right',
  },

  sectionDescription: {
    color: '#777781',
    fontSize: 11,
    lineHeight: 18,
    marginBottom: 14,
    textAlign: 'right',
  },

  field: {
    marginBottom: 15,
  },

  fieldLabel: {
    color: '#3a3a40',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'right',
  },

  input: {
    backgroundColor: '#ffffff',
    borderColor: '#e8e8ed',
    borderRadius: 16,
    borderWidth: 1,
    color: '#202025',
    fontSize: 14,
    minHeight: 54,
    paddingHorizontal: 15,
    paddingVertical: 13,
    writingDirection: 'rtl',
  },

  inputError: {
    borderColor: '#d64b4b',
  },

  multilineInput: {
    minHeight: 112,
  },

  notesInput: {
    minHeight: 90,
  },

  errorText: {
    color: '#d64b4b',
    fontSize: 10,
    marginTop: 6,
    textAlign: 'right',
  },

  areaCard: {
    alignItems: 'center',
    backgroundColor: '#eeeafd',
    borderRadius: 17,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 15,
    padding: 15,
  },

  areaContent: {
    flex: 1,
  },

  areaLabel: {
    color: '#7d72b2',
    fontSize: 10,
    textAlign: 'right',
  },

  areaValue: {
    color: '#4f3db8',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
    textAlign: 'right',
  },

  areaIcon: {
    fontSize: 22,
    marginLeft: 11,
  },

  paymentMethods: {
    gap: 10,
  },

  paymentMethod: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e8e8ed',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 72,
    padding: 14,
  },

  paymentMethodSelected: {
    backgroundColor: '#f1efff',
    borderColor: '#6d56df',
  },

  radioOuter: {
    alignItems: 'center',
    borderColor: '#b7b7c0',
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },

  radioOuterSelected: {
    borderColor: '#6d56df',
  },

  radioInner: {
    backgroundColor: '#6d56df',
    borderRadius: 5,
    height: 10,
    width: 10,
  },

  paymentContent: {
    flex: 1,
    marginHorizontal: 13,
  },

  paymentTitle: {
    color: '#25252b',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },

  paymentSubtitle: {
    color: '#898992',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },

  paymentIcon: {
    fontSize: 23,
  },

  paymentError: {
    color: '#d64b4b',
    fontSize: 10,
    marginTop: 8,
    textAlign: 'right',
  },

  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    marginTop: 28,
    padding: 20,
  },

  summaryTitle: {
    color: '#202025',
    fontSize: 19,
    fontWeight: '900',
    marginBottom: 17,
    textAlign: 'right',
  },

  itemsSummary: {
    gap: 11,
  },

  summaryItem: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  summaryItemName: {
    color: '#55555e',
    flex: 1,
    fontSize: 12,
    marginLeft: 10,
    textAlign: 'right',
  },

  summaryItemPrice: {
    color: '#303036',
    fontSize: 12,
    fontWeight: '800',
  },

  summaryDivider: {
    backgroundColor: '#eeeeF2',
    height: 1,
    marginVertical: 17,
  },

  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  summaryLabel: {
    color: '#777781',
    fontSize: 13,
  },

  summaryValue: {
    color: '#303036',
    fontSize: 13,
    fontWeight: '800',
  },

  totalDivider: {
    backgroundColor: '#eeeeF2',
    height: 1,
    marginBottom: 16,
  },

  totalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  totalLabel: {
    color: '#202025',
    fontSize: 16,
    fontWeight: '900',
  },

  totalValue: {
    color: '#5d47d2',
    fontSize: 19,
    fontWeight: '900',
  },

  whatsAppNotice: {
    alignItems: 'center',
    backgroundColor: '#e9f7ee',
    borderRadius: 17,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 20,
    marginTop: 16,
    padding: 15,
  },

  whatsAppNoticeContent: {
    flex: 1,
  },

  whatsAppNoticeTitle: {
    color: '#246343',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },

  whatsAppNoticeDescription: {
    color: '#4e8067',
    fontSize: 10,
    lineHeight: 17,
    marginTop: 4,
    textAlign: 'right',
  },

  whatsAppIcon: {
    fontSize: 22,
    marginLeft: 10,
  },

  submitBarWrapper: {
    bottom: 0,
    left: 0,
    paddingBottom: 18,
    paddingHorizontal: 18,
    position: 'absolute',
    right: 0,
  },

  submitBarContainer: {
    alignSelf: 'center',
    maxWidth: 520,
    width: '100%',
  },

  submitButton: {
    alignItems: 'center',
    backgroundColor: '#25d366',
    borderRadius: 20,
    flexDirection: 'row',
    minHeight: 70,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },

  submitButtonDisabled: {
    opacity: 0.65,
  },

  submitButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },

  submitTotal: {
    flex: 1,
  },

  submitTotalValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },

  submitTotalLabel: {
    color: '#d7f7e3',
    fontSize: 10,
    marginTop: 2,
  },

  submitButtonText: {
    color: '#ffffff',
    flex: 2,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },

  submitIconContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 11,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },

  submitIcon: {
    fontSize: 18,
  },

  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#6d56df',
    borderRadius: 16,
    marginTop: 22,
    minWidth: 210,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },

  primaryButtonText: {
    color: '#ffffff',
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
    maxWidth: 330,
    textAlign: 'center',
  },
});

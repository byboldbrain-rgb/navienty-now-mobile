import { Ionicons } from '@expo/vector-icons';
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import {
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from 'react-native';

import ServicePackageCheckout from '../components/service/service-package-checkout';
import { CheckoutScreenSkeleton } from '../components/ui/loading-skeleton';
import {
  isV1PublicCategorySlug,
  V1_UNAVAILABLE_CATEGORY_MESSAGE,
} from '../config/v1-release-scope';
import {
  ensureAppSession,
} from '../services/anonymous-auth-service';
import getAppBootstrap, {
  type AppBootstrap,
} from '../services/bootstrap-service';
import {
  getDeliveryLocationErrorMessage,
  resolveDeliveryLocation,
  type DeliveryLocationResolution,
} from '../services/delivery-location-service';
import {
  cancelPendingWhatsAppOrder,
  createWhatsAppOrder,
  submitOrderForConfirmation,
} from '../services/order-service';
import {
  validateVoucher,
} from '../services/voucher-service';
import {
  useCartStore,
} from '../store/cart-store';
import {
  useCustomerStore,
} from '../store/customer-store';
import {
  useOrderNotesStore,
} from '../store/order-notes-store';
import {
  useOrdersStore,
} from '../store/orders-store';
import {
  useVoucherStore,
} from '../store/voucher-store';

/* ---------------------------------- */
/* BRAND                              */
/* ---------------------------------- */

const BRAND_GREEN = '#00B14F';
const BRAND_GREEN_DARK = '#009B45';
const BRAND_GREEN_SOFT = '#EAF8F0';

/* ---------------------------------- */
/* LOCAL PAYMENT METHOD IMAGES        */
/* ---------------------------------- */

const PAYMENT_METHOD_IMAGES:
  Record<string, ImageSourcePropType> = {
    'vodafone-cash': require(
      '../../assets/payment-methods/vodafone-cash.webp',
    ),

    'orange-cash': require(
      '../../assets/payment-methods/orange-cash.webp',
    ),

    'etisalat-cash': require(
      '../../assets/payment-methods/etisalat-cash.webp',
    ),

    instapay: require(
      '../../assets/payment-methods/instapay.webp',
    ),
  };

/* ---------------------------------- */
/* FEES                               */
/* ---------------------------------- */

const PAYMENT_PROCESSING_FEE = 10;

/* ---------------------------------- */
/* TYPES                              */
/* ---------------------------------- */

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

/* ---------------------------------- */
/* HELPERS                            */
/* ---------------------------------- */

/* ---------------------------------- */
/* SCREEN                             */
/* ---------------------------------- */

export default function CheckoutScreen() {
  const params =
    useLocalSearchParams<{
      servicePackageId?:
        | string
        | string[];
    }>();

  const servicePackageId =
    getSingleParam(
      params.servicePackageId,
    )?.trim();

  if (servicePackageId) {
    return (
      <ServicePackageCheckout
        servicePackageId={
          servicePackageId
        }
      />
    );
  }

  return <StoreCheckoutScreen />;
}

function StoreCheckoutScreen() {
  const router = useRouter();

  const params =
    useLocalSearchParams<{
      storeId?:
        | string
        | string[];
    }>();

  const requestedStoreId =
    getSingleParam(
      params.storeId,
    );

  /* -------------------------------- */
  /* BOOTSTRAP                        */
  /* -------------------------------- */

  const [
    bootstrap,
    setBootstrap,
  ] =
    useState<AppBootstrap | null>(
      null,
    );

  const [
    isLoadingBootstrap,
    setIsLoadingBootstrap,
  ] = useState(true);

  const [
    bootstrapError,
    setBootstrapError,
  ] = useState<string | null>(
    null,
  );

  const [
    deliveryResolution,
    setDeliveryResolution,
  ] = useState<DeliveryLocationResolution | null>(
    null,
  );

  const [
    isResolvingDelivery,
    setIsResolvingDelivery,
  ] = useState(false);

  const [
    deliveryResolutionError,
    setDeliveryResolutionError,
  ] = useState<string | null>(
    null,
  );

  /* -------------------------------- */
  /* CART                             */
  /* -------------------------------- */

  const carts = useCartStore(
    (state) => state.carts,
  );

  const activeStoreId =
    useCartStore(
      (state) =>
        state.activeStoreId,
    );

  const setActiveCart =
    useCartStore(
      (state) =>
        state.setActiveCart,
    );

  const clearStoreCart =
    useCartStore(
      (state) =>
        state.clearStoreCart,
    );

  const checkoutStoreId =
    requestedStoreId ??
    activeStoreId;

  const checkoutCart =
    checkoutStoreId
      ? carts[
          checkoutStoreId
        ] ?? null
      : null;

  const items =
    checkoutCart?.items ??
    [];

  const storeId =
    checkoutCart?.storeId ??
    null;

  const appliedVoucher =
    useVoucherStore(
      (state) =>
        storeId
          ? state.vouchers[storeId] ??
            null
          : null,
    );

  const setStoreVoucher =
    useVoucherStore(
      (state) => state.setVoucher,
    );

  const notes =
    useOrderNotesStore(
      (state) =>
        storeId
          ? state.notes[storeId] ??
            ''
          : '',
    );

  const clearOrderNotes =
    useOrderNotesStore(
      (state) => state.clearNote,
    );

  const storeName =
    checkoutCart?.storeName ??
    null;

  const hasAgeRestrictedItems =
    items.some(
      (item) =>
        item.isAgeRestricted,
    );

  const subtotal =
    items.reduce(
      (currentTotal, item) =>
        currentTotal +
        item.price *
          item.quantity,
      0,
    );

  const deliveryFee =
    deliveryResolution?.deliveryFee ??
    Number(checkoutCart?.deliveryFee ?? 0);

  const paymentProcessingFee =
    PAYMENT_PROCESSING_FEE;

  const voucherDiscountTarget =
    appliedVoucher?.discountTarget ??
    'order_subtotal';

  const voucherDiscountBase =
    voucherDiscountTarget ===
      'delivery_fee'
      ? deliveryFee
      : Number(subtotal ?? 0);

  const voucherDiscount =
    Math.min(
      Math.max(
        appliedVoucher
          ?.discountAmount ?? 0,
        0,
      ),
      Math.max(
        Number(
          voucherDiscountBase ?? 0,
        ),
        0,
      ),
    );

  const discountedSubtotal =
    Math.max(
      Number(subtotal ?? 0) -
        (
          voucherDiscountTarget ===
            'order_subtotal'
            ? voucherDiscount
            : 0
        ),
      0,
    );

  const discountedDeliveryFee =
    Math.max(
      deliveryFee -
        (
          voucherDiscountTarget ===
            'delivery_fee'
            ? voucherDiscount
            : 0
        ),
      0,
    );

  const total =
    discountedSubtotal +
    discountedDeliveryFee +
    paymentProcessingFee;

  /* -------------------------------- */
  /* ORDERS                           */
  /* -------------------------------- */

  const pendingOrder =
    useOrdersStore(
      (state) =>
        state.pendingOrder,
    );

  const setPendingOrder =
    useOrdersStore(
      (state) =>
        state.setPendingOrder,
    );

  const discardPendingOrder =
    useOrdersStore(
      (state) =>
        state.discardPendingOrder,
    );

  const confirmPendingOrder =
    useOrdersStore(
      (state) =>
        state.confirmPendingOrder,
    );

  /* -------------------------------- */
  /* CUSTOMER                         */
  /* -------------------------------- */

  const customerName =
    useCustomerStore(
      (state) =>
        state.customerName,
    );

  const phoneNumber =
    useCustomerStore(
      (state) =>
        state.phoneNumber,
    );

  const address =
    useCustomerStore(
      (state) =>
        state.address,
    );

  const locationLatitude =
    useCustomerStore(
      (state) =>
        state.locationLatitude,
    );

  const locationLongitude =
    useCustomerStore(
      (state) =>
        state.locationLongitude,
    );

  const landmark =
    useCustomerStore(
      (state) =>
        state.landmark,
    );

  const paymentMethod =
    useCustomerStore(
      (state) =>
        state.paymentMethod,
    );

  const setCustomerName =
    useCustomerStore(
      (state) =>
        state.setCustomerName,
    );

  const setPhoneNumber =
    useCustomerStore(
      (state) =>
        state.setPhoneNumber,
    );

  const setLandmark =
    useCustomerStore(
      (state) =>
        state.setLandmark,
    );

  const setPaymentMethod =
    useCustomerStore(
      (state) =>
        state.setPaymentMethod,
    );

  /* -------------------------------- */
  /* LOCAL STATE                      */
  /* -------------------------------- */

  const [
    submitted,
    setSubmitted,
  ] = useState(false);

  const [
    isSubmittingOrder,
    setIsSubmittingOrder,
  ] = useState(false);

  /* -------------------------------- */
  /* LOAD CHECKOUT DATA               */
  /* -------------------------------- */

  async function loadCheckoutData() {
    try {
      setIsLoadingBootstrap(true);
      setBootstrapError(null);

      const loadedBootstrap =
        await getAppBootstrap();

      setBootstrap(
        loadedBootstrap,
      );

      const paymentMethodExists =
        loadedBootstrap
          .payment_methods
          .some(
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
      setBootstrapError(
        message,
      );
    } finally {
      setIsLoadingBootstrap(
        false,
      );
    }
  }

  useEffect(() => {
    void loadCheckoutData();
  }, []);

  useEffect(() => {
    if (
      checkoutStoreId &&
      carts[checkoutStoreId]
    ) {
      setActiveCart(
        checkoutStoreId,
      );
    }
  }, [
    checkoutStoreId,
    carts,
    setActiveCart,
  ]);

  useEffect(() => {
    if (
      !appliedVoucher ||
      !storeId
    ) {
      return;
    }

    const voucherForRefresh =
      appliedVoucher;

    const storeIdForRefresh =
      storeId;

    const subtotalChanged =
      Math.abs(
        appliedVoucher
          .subtotalBeforeDiscount -
          subtotal,
      ) > 0.009;

    const deliveryChanged =
      Math.abs(
        appliedVoucher
          .deliveryFeeBeforeDiscount -
          deliveryFee,
      ) > 0.009;

    if (
      !subtotalChanged &&
      !deliveryChanged
    ) {
      return;
    }

    let cancelled = false;

    async function refreshVoucher() {
      try {
        await ensureAppSession();

        const voucherPhone =
          phoneNumber.replace(
            /\D/g,
            '',
          );

        const refreshedVoucher =
          await validateVoucher({
            code:
              voucherForRefresh.code,

            storeId:
              storeIdForRefresh,

            subtotal,
            deliveryFee,

            customerPhone:
              voucherPhone ||
              null,
          });

        if (!cancelled) {
          setStoreVoucher(
            storeIdForRefresh,
            refreshedVoucher,
          );
        }
      } catch {
        if (!cancelled) {
          setStoreVoucher(
            storeIdForRefresh,
            null,
          );
        }
      }
    }

    void refreshVoucher();

    return () => {
      cancelled = true;
    };
  }, [
    appliedVoucher,
    deliveryFee,
    phoneNumber,
    setStoreVoucher,
    storeId,
    subtotal,
  ]);

  /* -------------------------------- */
  /* DERIVED DATA                     */
  /* -------------------------------- */

  const normalizedPhone =
    phoneNumber.replace(
      /\D/g,
      '',
    );

  const paymentMethods =
    bootstrap?.payment_methods ??
    [];

  const selectedPaymentMethod =
    paymentMethods.find(
      (method) =>
        method.id ===
        paymentMethod,
    );

  const currencyCode =
    bootstrap?.settings
      .currency_code ??
    'EGP';



  /* -------------------------------- */
  /* FORMAT PRICE                     */
  /* -------------------------------- */

  function formatPrice(
    value:
      | number
      | string
      | null
      | undefined,
  ) {
    const numericValue =
      Number(value ?? 0);

    const currencyLabel =
      currencyCode
        .trim()
        .toUpperCase() === 'EGP'
        ? 'ج.م'
        : currencyCode;

    if (
      Number.isInteger(
        numericValue,
      )
    ) {
      return `${numericValue} ${currencyLabel}`;
    }

    return `${numericValue.toFixed(
      2,
    )} ${currencyLabel}`;
  }

  const hasDeliveryLocation =
    typeof locationLatitude ===
      'number' &&
    Number.isFinite(
      locationLatitude,
    ) &&
    typeof locationLongitude ===
      'number' &&
    Number.isFinite(
      locationLongitude,
    );

  useEffect(() => {
    let cancelled = false;

    async function refreshDeliveryResolution() {
      if (
        !storeId ||
        !hasDeliveryLocation ||
        typeof locationLatitude !== 'number' ||
        typeof locationLongitude !== 'number'
      ) {
        setDeliveryResolution(null);
        setDeliveryResolutionError(null);
        return;
      }

      try {
        setIsResolvingDelivery(true);
        setDeliveryResolutionError(null);

        const resolution =
          await resolveDeliveryLocation({
            latitude: locationLatitude,
            longitude: locationLongitude,
            storeId,
          });

        if (cancelled) {
          return;
        }

        setDeliveryResolution(resolution);

        if (
          !resolution.serviceable ||
          resolution.storeAvailable === false
        ) {
          setDeliveryResolutionError(
            getDeliveryLocationErrorMessage(
              resolution.reason,
            ),
          );
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        setDeliveryResolution(null);
        setDeliveryResolutionError(
          error instanceof Error
            ? error.message
            : 'تعذر التحقق من منطقة التوصيل.',
        );
      } finally {
        if (!cancelled) {
          setIsResolvingDelivery(false);
        }
      }
    }

    void refreshDeliveryResolution();

    return () => {
      cancelled = true;
    };
  }, [
    storeId,
    hasDeliveryLocation,
    locationLatitude,
    locationLongitude,
  ]);



  /* -------------------------------- */
  /* VALIDATION                       */
  /* -------------------------------- */

  const validation = {
    location:
      hasDeliveryLocation,

    customerName:
      customerName
        .trim()
        .length >= 2,

    phoneNumber:
      /^01[0125]\d{8}$/.test(
        normalizedPhone,
      ),

    address:
      address
        .trim()
        .length >= 8,

    paymentMethod:
      paymentMethod !== null,
  };

  const deliveryIsAvailable =
    deliveryResolution?.serviceable === true &&
    deliveryResolution.storeAvailable === true;

  const formIsValid =
    Object.values(
      validation,
    ).every(Boolean) &&
    deliveryIsAvailable &&
    !isResolvingDelivery;

  /* -------------------------------- */
  /* EMPTY CART                       */
  /* -------------------------------- */

  if (items.length === 0) {
    return (
      <View
        style={
          styles.emptyScreen
        }
      >
        <Pressable
          style={({ pressed }) => [
            styles.emptyBackButton,
            pressed &&
              styles.buttonPressed,
          ]}
          onPress={() =>
            router.back()
          }
        >
          <Ionicons
            name="arrow-back"
            size={27}
            color="#222222"
          />
        </Pressable>

        <View
          style={
            styles.emptyContainer
          }
        >
          <View
            style={
              styles.emptyIconContainer
            }
          >
            <Ionicons
              name="cart-outline"
              size={38}
              color={
                BRAND_GREEN
              }
            />
          </View>

          <Text
            style={
              styles.emptyTitle
            }
          >
            لا يوجد طلب لإرساله
          </Text>

          <Text
            style={
              styles.emptyDescription
            }
          >
            أضف منتجات إلى السلة
            أولًا ثم ارجع لإتمام
            الطلب.
          </Text>

          <Pressable
            style={({
              pressed,
            }) => [
              styles.primaryButton,
              pressed &&
                styles.buttonPressed,
            ]}
            onPress={() =>
              router.replace('/')
            }
          >
            <Text
              style={
                styles.primaryButtonText
              }
            >
              العودة للتسوق
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (isLoadingBootstrap) {
    return <CheckoutScreenSkeleton />;
  }

  if (
    !bootstrap ||
    bootstrapError
  ) {
    return (
      <View
        style={
          styles.emptyScreen
        }
      >
        <View
          style={
            styles.errorIconContainer
          }
        >
          <Ionicons
            name="alert-circle-outline"
            size={36}
            color="#d64b4b"
          />
        </View>

        <Text
          style={
            styles.emptyTitle
          }
        >
          تعذر تحميل بيانات الطلب
        </Text>

        <Text
          style={
            styles.emptyDescription
          }
        >
          {bootstrapError ??
            'تعذر تحميل إعدادات الطلب من Supabase.'}
        </Text>

        <Pressable
          style={({
            pressed,
          }) => [
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

  /* -------------------------------- */
  /* SEND ORDER                       */
  /* -------------------------------- */

  async function submitOrder() {
    setSubmitted(true);

    if (
      !isV1PublicCategorySlug(
        checkoutCart?.categorySlug,
      )
    ) {
      Alert.alert(
        'القسم غير متاح',
        V1_UNAVAILABLE_CATEGORY_MESSAGE,
      );
      return;
    }

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

    if (!bootstrap) {
      Alert.alert(
        'بيانات الطلب غير مكتملة',
        'تعذر تحميل إعدادات التطبيق من Supabase.',
      );
      return;
    }

    if (
      !hasDeliveryLocation ||
      typeof locationLatitude !== 'number' ||
      typeof locationLongitude !== 'number'
    ) {
      Alert.alert(
        'حدد موقع التوصيل',
        'اختر موقع التوصيل من الخريطة قبل إرسال الطلب.',
      );
      return;
    }

    if (
      !deliveryResolution ||
      !deliveryResolution.serviceable ||
      deliveryResolution.storeAvailable !== true
    ) {
      Alert.alert(
        'التوصيل غير متاح',
        deliveryResolutionError ??
          getDeliveryLocationErrorMessage(
            deliveryResolution?.reason,
          ),
      );
      return;
    }

    const activeStoreId =
      storeId;

    const activeBootstrap =
      bootstrap;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const cartContainsLegacyIds =
      !uuidPattern.test(
        activeStoreId,
      ) ||
      items.some(
        (item) =>
          !uuidPattern.test(
            item.id,
          ),
      );

    if (
      cartContainsLegacyIds
    ) {
      Alert.alert(
        'السلة تحتاج إلى تحديث',
        'هذه السلة أُنشئت قبل ربط الكتالوج بـSupabase. أفرغ السلة وأضف المنتجات من المتجر مرة أخرى.',
      );
      return;
    }

    if (
      !activeBootstrap
        .settings
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
      setIsSubmittingOrder(
        true,
      );

      await ensureAppSession();

      if (pendingOrder) {
        try {
          await cancelPendingWhatsAppOrder(
            pendingOrder.accessToken,
            'checkout_recreated',
          );
        } catch {
          // Previous pending order may already be cancelled.
        }

        discardPendingOrder();
      }

      createdOrder =
        await createWhatsAppOrder({
          storeId:
            activeStoreId,

          serviceAreaId:
            deliveryResolution.serviceAreaId,

          deliveryLatitude:
            locationLatitude,

          deliveryLongitude:
            locationLongitude,

          paymentMethodId:
            selectedPaymentMethod.id,

          customerName,

          customerPhone:
            normalizedPhone,

          address,

          landmark,

          notes,

          voucherCode:
            appliedVoucher?.code ??
            null,

          items: items.map(
            (item) => ({
              productId:
                item.id,

              variantId:
                item.variantId ?? null,

              quantity:
                item.quantity,
            }),
          ),
        });

      const whatsappPaymentMessage =
        `اكد الاوردر وهدفع عن طريق ${
          createdOrder.paymentMethodTitle ||
          selectedPaymentMethod.name_ar
        }`;

      const orderForWhatsApp = {
        ...createdOrder,
        whatsappMessage:
          whatsappPaymentMessage,
      };

      setPendingOrder(
        orderForWhatsApp,
      );

      let submittedOrder:
        Awaited<
          ReturnType<
            typeof submitOrderForConfirmation
          >
        >;

      try {
        submittedOrder =
          await submitOrderForConfirmation(
            createdOrder.accessToken,
          );
      } catch (submissionError) {
        /*
         * The order already exists. Keep it locally and move to the visible
         * recovery screen instead of cancelling it after a transient network
         * failure. The in-app submission RPC is idempotent, so retrying is
         * safe even if the server committed before the response was lost.
         */
        createdOrder = null;

        const message =
          submissionError instanceof Error
            ? submissionError.message
            : 'تعذر إرسال الطلب للمراجعة.';

        router.replace(
          '/order-confirmation',
        );

        Alert.alert(
          'تم حفظ الطلب',
          `${message}\n\nاضغط «تأكيد الطلب داخل التطبيق» للمحاولة مرة أخرى.`,
        );

        return;
      }

      confirmPendingOrder({
        ...submittedOrder,
        whatsappMessage:
          whatsappPaymentMessage,
      });

      clearStoreCart(
        activeStoreId,
      );

      setStoreVoucher(
        activeStoreId,
        null,
      );

      clearOrderNotes(
        activeStoreId,
      );

      createdOrder = null;

      router.replace({
        pathname: '/order-success',
        params: {
          id: submittedOrder.id,
        },
      });
    } catch (error) {
      if (createdOrder) {
        try {
          await cancelPendingWhatsAppOrder(
            createdOrder.accessToken,
            'checkout_create_failed',
          );
        } catch {
          // Keep original error visible.
        }

        discardPendingOrder();
      }

      const message =
        error instanceof Error
          ? error.message
          : 'تعذر إنشاء الطلب.';

      Alert.alert(
        'تعذر إرسال الطلب',
        message,
      );
    } finally {
      setIsSubmittingOrder(
        false,
      );
    }
  }

  /* -------------------------------- */
  /* UI                               */
  /* -------------------------------- */

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.pageContent
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={styles.header}
        >
          <Pressable
            style={({
              pressed,
            }) => [
              styles.backButton,
              pressed &&
                styles.buttonPressed,
            ]}
            onPress={() =>
              router.back()
            }
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color="#262626"
            />
          </Pressable>

          <View
            style={
              styles.headerContent
            }
          >
            <Text
              style={
                styles.pageTitle
              }
            >
              إتمام الطلب
            </Text>

            <Text
              style={
                styles.pageSubtitle
              }
              numberOfLines={1}
            >
              {storeName ??
                'Navienty Now'}
            </Text>
          </View>
        </View>

        <View
          style={styles.section}
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            بيانات العميل
          </Text>

          <View
            style={styles.field}
          >
            <Text
              style={
                styles.fieldLabel
              }
            >
              الاسم بالكامل
            </Text>

            <View
              style={[
                styles.inputContainer,
                submitted &&
                  !validation.customerName &&
                  styles.inputContainerError,
              ]}
            >
              <Ionicons
                name="person-outline"
                size={18}
                color="#777777"
              />

              <TextInput
                style={styles.input}
                value={
                  customerName
                }
                onChangeText={
                  setCustomerName
                }
                placeholder="مثال: أحمد محمد"
                placeholderTextColor="#a1a1a1"
                autoCapitalize="words"
                textAlign="right"
              />
            </View>

            {submitted &&
              !validation.customerName && (
                <Text
                  style={
                    styles.errorText
                  }
                >
                  اكتب اسمًا صحيحًا مكوّنًا من حرفين على الأقل.
                </Text>
              )}
          </View>

          <View
            style={styles.field}
          >
            <Text
              style={
                styles.fieldLabel
              }
            >
              رقم الموبايل
            </Text>

            <View
              style={[
                styles.inputContainer,
                submitted &&
                  !validation.phoneNumber &&
                  styles.inputContainerError,
              ]}
            >
              <Ionicons
                name="call-outline"
                size={18}
                color="#777777"
              />

              <TextInput
                style={styles.input}
                value={
                  phoneNumber
                }
                onChangeText={
                  setPhoneNumber
                }
                placeholder="01xxxxxxxxx"
                placeholderTextColor="#a1a1a1"
                keyboardType="phone-pad"
                maxLength={14}
                textAlign="right"
              />
            </View>

            {submitted &&
              !validation.phoneNumber && (
                <Text
                  style={
                    styles.errorText
                  }
                >
                  اكتب رقم موبايل مصريًا صحيحًا من 11 رقمًا.
                </Text>
              )}
          </View>
        </View>

        {hasAgeRestrictedItems && (
          <View style={styles.section}>
            <Text
              style={
                styles.sectionTitle
              }
            >
              متطلبات التسليم
            </Text>

            <View
              style={
                styles.ageVerificationCard
              }
            >
              <Ionicons
                name="card-outline"
                size={18}
                color="#7B4B14"
              />

              <View
                style={
                  styles.ageVerificationCopy
                }
              >
                <Text
                  style={
                    styles.ageVerificationTitle
                  }
                >
                  التحقق من السن عند التسليم
                </Text>

                <Text
                  style={
                    styles.ageVerificationText
                  }
                >
                  قد يطلب المندوب أو المتجر بطاقة هوية قبل تسليم المنتجات المقيدة بالعمر.
                </Text>
              </View>
            </View>
          </View>
        )}

        <View
          style={styles.section}
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            طريقة الدفع
          </Text>

          <Text
            style={
              styles.sectionDescription
            }
          >
            اختر طريقة الدفع المناسبة لإتمام الطلب.
          </Text>

          <View
            style={
              styles.paymentMethods
            }
          >
            {paymentMethods.map(
              (method) => {
                const selected =
                  paymentMethod ===
                  method.id;

                const paymentImage =
                  PAYMENT_METHOD_IMAGES[
                    method.code
                  ] ?? null;

                return (
                  <Pressable
                    key={
                      method.id
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.paymentMethod,
                      selected &&
                        styles.paymentMethodSelected,
                      pressed &&
                        styles.paymentMethodPressed,
                    ]}
                    onPress={() =>
                      setPaymentMethod(
                        method.id,
                      )
                    }
                  >
                    <View
                      style={
                        styles.paymentIconContainer
                      }
                    >
                      {paymentImage ? (
                        <Image
                          source={
                            paymentImage
                          }
                          style={
                            styles.paymentMethodImage
                          }
                          resizeMode="cover"
                        />
                      ) : (
                        <Text
                          style={
                            styles.paymentIcon
                          }
                        >
                          {method.icon ??
                            '💳'}
                        </Text>
                      )}
                    </View>

                    <View
                      style={
                        styles.paymentContent
                      }
                    >
                      <Text
                        style={
                          styles.paymentTitle
                        }
                      >
                        {
                          method.name_ar
                        }
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.radioOuter,
                        selected &&
                          styles.radioOuterSelected,
                      ]}
                    >
                      {selected && (
                        <View
                          style={
                            styles.radioInner
                          }
                        />
                      )}
                    </View>
                  </Pressable>
                );
              },
            )}
          </View>

          {submitted &&
            !validation.paymentMethod && (
              <Text
                style={
                  styles.paymentError
                }
              >
                اختر طريقة الدفع المناسبة.
              </Text>
            )}
        </View>

        <View
          style={
            styles.orderSummarySection
          }
        >
          <Text
            style={
              styles.orderSummaryTitle
            }
          >
            تفاصيل الطلب
          </Text>

          <View
            style={
              styles.summaryRow
            }
          >
            <Text
              style={
                styles.summaryLabel
              }
            >
              المنتجات
            </Text>

            <Text
              style={
                styles.summaryValue
              }
            >
              {formatPrice(
                subtotal,
              )}
            </Text>
          </View>

          {voucherDiscount > 0 &&
            voucherDiscountTarget ===
              'order_subtotal' && (
              <View
                style={
                  styles.summaryRow
                }
              >
                <Text
                  style={
                    styles.discountLabel
                  }
                >
                  خصم على الطلب
                </Text>

                <Text
                  style={
                    styles.discountValue
                  }
                >
                  -{formatPrice(
                    voucherDiscount,
                  )}
                </Text>
              </View>
            )}

          <View
            style={
              styles.summaryRow
            }
          >
            <Text
              style={
                styles.summaryLabel
              }
            >
              التوصيل
            </Text>

            <Text
              style={
                styles.summaryValue
              }
            >
              {formatPrice(
                deliveryFee,
              )}
            </Text>
          </View>

          {voucherDiscount > 0 &&
            voucherDiscountTarget ===
              'delivery_fee' && (
              <View
                style={
                  styles.summaryRow
                }
              >
                <Text
                  style={
                    styles.discountLabel
                  }
                >
                  خصم على التوصيل
                </Text>

                <Text
                  style={
                    styles.discountValue
                  }
                >
                  -{formatPrice(
                    voucherDiscount,
                  )}
                </Text>
              </View>
            )}

          <View
            style={
              styles.summaryRow
            }
          >
            <Text
              style={
                styles.summaryLabel
              }
            >
              رسوم الدفع الإلكتروني
            </Text>

            <Text
              style={
                styles.summaryValue
              }
            >
              {formatPrice(
                paymentProcessingFee,
              )}
            </Text>
          </View>

          <View
            style={
              styles.summaryDivider
            }
          />

          <View
            style={
              styles.totalRow
            }
          >
            <Text
              style={
                styles.totalLabel
              }
            >
              الإجمالي
            </Text>

            <Text
              style={
                styles.totalValue
              }
            >
              {formatPrice(total)}
            </Text>
          </View>
        </View>

      </ScrollView>

      <View
        style={
          styles.submitBarWrapper
        }
      >
        <View
          style={
            styles.submitBar
          }
        >
          <Pressable
            style={({
              pressed,
            }) => [
              styles.backToCartButton,
              pressed &&
                styles.bottomButtonPressed,
            ]}
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={
                styles.backToCartButtonText
              }
            >
              السلة
            </Text>
          </Pressable>

          <Pressable
            style={({
              pressed,
            }) => [
              styles.submitButton,
              isSubmittingOrder &&
                styles.submitButtonDisabled,
              pressed &&
                !isSubmittingOrder &&
                styles.submitButtonPressed,
            ]}
            disabled={
              isSubmittingOrder
            }
            onPress={
              submitOrder
            }
          >
            {isSubmittingOrder ? (
              <ActivityIndicator
                size="small"
                color="#ffffff"
              />
            ) : (
              <Ionicons
                name="checkmark-circle-outline"
                size={19}
                color="#ffffff"
              />
            )}

            <Text
              style={
                styles.submitButtonText
              }
              numberOfLines={1}
            >
              متابعة
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      backgroundColor:
        '#ffffff',
      flex: 1,
    },

    pageContent: {
      paddingBottom: 122,
    },

    header: {
      alignItems: 'center',
      flexDirection: 'row',
      paddingBottom: 20,
      paddingHorizontal: 24,
      paddingTop: 42,
    },

    backButton: {
      alignItems: 'center',
      backgroundColor:
        '#ffffff',
      borderColor: '#e5e5e5',
      borderRadius: 24,
      borderWidth: 1,
      height: 48,
      justifyContent:
        'center',
      width: 48,
    },

    headerContent: {
      flex: 1,
      marginLeft: 14,
    },

    pageTitle: {
      color: '#202020',
      fontSize: 21,
      fontWeight: '800',
    },

    pageSubtitle: {
      color: '#8a8a8a',
      fontSize: 12,
      marginTop: 2,
    },

    orderStoreSection: {
      alignItems: 'center',
      borderBottomColor:
        '#eeeeee',
      borderBottomWidth: 1,
      borderTopColor:
        '#eeeeee',
      borderTopWidth: 1,
      flexDirection: 'row',
      marginBottom: 5,
      paddingHorizontal: 24,
      paddingVertical: 14,
    },

    storeIconContainer: {
      alignItems: 'center',
      backgroundColor:
        '#f5f5f5',
      borderColor: '#ededed',
      borderRadius: 14,
      borderWidth: 1,
      height: 52,
      justifyContent:
        'center',
      overflow: 'hidden',
      width: 52,
    },

    storeImage: {
      height: '100%',
      width: '100%',
    },

    storeIcon: {
      fontSize: 24,
    },

    storeContent: {
      flex: 1,
      marginLeft: 12,
    },

    storeLabel: {
      color: '#929292',
      fontSize: 11,
    },

    storeName: {
      color: '#242424',
      fontSize: 15,
      fontWeight: '800',
      marginTop: 3,
    },

    storeMeta: {
      color: '#818181',
      fontSize: 11,
      marginTop: 3,
    },

    section: {
      borderBottomColor:
        '#f0f0f0',
      borderBottomWidth: 1,
      paddingBottom: 7,
      paddingHorizontal: 24,
      paddingTop: 22,
    },

    sectionTitle: {
      color: '#242424',
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 13,
      textAlign: 'right',
    },

    sectionDescription: {
      color: '#858585',
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 14,
      textAlign: 'right',
    },

    field: {
      marginBottom: 16,
    },

    fieldLabel: {
      color: '#373737',
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 7,
      textAlign: 'right',
    },

    inputContainer: {
      alignItems: 'center',
      backgroundColor:
        '#ffffff',
      borderColor: '#dfdfdf',
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      minHeight: 52,
      paddingHorizontal: 13,
    },

    inputContainerError: {
      borderColor: '#d64b4b',
    },

    input: {
      color: '#242424',
      flex: 1,
      fontSize: 14,
      minHeight: 50,
      paddingHorizontal: 11,
      paddingVertical: 12,
      writingDirection:
        'rtl',
    },

    multilineContainer: {
      alignItems: 'flex-start',
      minHeight: 108,
    },

    multilineInput: {
      minHeight: 104,
      paddingTop: 14,
    },

    multilineIcon: {
      marginTop: 15,
    },

    errorText: {
      color: '#d64b4b',
      fontSize: 11,
      lineHeight: 17,
      marginTop: 7,
      textAlign: 'right',
    },

    mapLocationCard: {
      alignItems: 'center',
      backgroundColor:
        BRAND_GREEN_SOFT,
      borderColor: '#d6f0e1',
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: 'row',
      marginBottom: 10,
      padding: 13,
    },

    mapLocationCardMissing: {
      backgroundColor: '#f7f7f7',
      borderColor: '#e0e0e0',
    },

    mapLocationIconContainer: {
      alignItems: 'center',
      backgroundColor:
        '#ffffff',
      borderRadius: 18,
      height: 36,
      justifyContent:
        'center',
      width: 36,
    },

    mapLocationContent: {
      flex: 1,
      marginHorizontal: 11,
    },

    mapLocationLabel: {
      color: '#638370',
      fontSize: 11,
      textAlign: 'right',
    },

    mapLocationValue: {
      color: '#1c5334',
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 18,
      marginTop: 4,
      textAlign: 'right',
    },

    changeLocationButton: {
      alignItems: 'center',
      backgroundColor:
        '#ffffff',
      borderColor:
        BRAND_GREEN,
      borderRadius: 13,
      borderWidth: 1,
      justifyContent:
        'center',
      minHeight: 34,
      minWidth: 56,
      paddingHorizontal: 12,
    },

    changeLocationButtonText: {
      color:
        BRAND_GREEN_DARK,
      fontSize: 11,
      fontWeight: '800',
    },

    locationErrorText: {
      color: '#d64b4b',
      fontSize: 11,
      lineHeight: 17,
      marginBottom: 12,
      textAlign: 'right',
    },

    addressHelperText: {
      color: '#8a8a8a',
      fontSize: 11,
      lineHeight: 18,
      marginBottom: 9,
      marginTop: -3,
      textAlign: 'right',
    },

    areaCard: {
      alignItems: 'center',
      backgroundColor:
        BRAND_GREEN_SOFT,
      borderColor: '#d6f0e1',
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      marginBottom: 17,
      padding: 13,
    },

    areaIconContainer: {
      alignItems: 'center',
      backgroundColor:
        '#ffffff',
      borderRadius: 21,
      height: 42,
      justifyContent:
        'center',
      width: 42,
    },

    areaContent: {
      flex: 1,
      marginHorizontal: 13,
    },

    areaLabel: {
      color: '#638370',
      fontSize: 11,
      textAlign: 'right',
    },

    areaValue: {
      color: '#1c5334',
      fontSize: 13,
      fontWeight: '800',
      marginTop: 3,
      textAlign: 'right',
    },

    ageVerificationCard: {
      alignItems: 'flex-start',
      backgroundColor: '#FFF8EB',
      borderColor: '#F0D8AE',
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      padding: 15,
    },

    ageVerificationCopy: {
      flex: 1,
      marginLeft: 12,
    },

    ageVerificationTitle: {
      color: '#5D3B13',
      fontSize: 13,
      fontWeight: '800',
      textAlign: 'right',
    },

    ageVerificationText: {
      color: '#806543',
      fontSize: 11,
      lineHeight: 18,
      marginTop: 5,
      textAlign: 'right',
    },

    paymentMethods: {
      gap: 9,
    },

    paymentMethod: {
      alignItems: 'center',
      backgroundColor:
        '#ffffff',
      borderColor: '#dedede',
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: 'row',
      minHeight: 66,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },

    paymentMethodSelected: {
      backgroundColor:
        BRAND_GREEN_SOFT,
      borderColor:
        BRAND_GREEN,
      borderWidth: 1.5,
    },

    paymentMethodPressed: {
      opacity: 0.76,
    },

    paymentIconContainer: {
      alignItems: 'center',
      backgroundColor:
        '#ffffff',
      borderRadius: 12,
      height: 42,
      justifyContent:
        'center',
      overflow: 'hidden',
      width: 42,
    },

    paymentMethodImage: {
      height: '100%',
      width: '100%',
    },

    paymentIcon: {
      fontSize: 20,
    },

    paymentContent: {
      flex: 1,
      marginHorizontal: 13,
    },

    paymentTitle: {
      color: '#262626',
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'right',
    },

    radioOuter: {
      alignItems: 'center',
      borderColor: '#b7b7b7',
      borderRadius: 9,
      borderWidth: 2,
      height: 18,
      justifyContent:
        'center',
      width: 18,
    },

    radioOuterSelected: {
      borderColor:
        BRAND_GREEN,
    },

    radioInner: {
      backgroundColor:
        BRAND_GREEN,
      borderRadius: 5,
      height: 10,
      width: 10,
    },

    paymentError: {
      color: '#d64b4b',
      fontSize: 11,
      marginTop: 9,
      textAlign: 'right',
    },

    orderSummarySection: {
      borderBottomColor:
        '#f0f0f0',
      borderBottomWidth: 1,
      paddingHorizontal: 24,
      paddingVertical: 22,
    },

    orderSummaryTitle: {
      color: '#242424',
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 18,
      textAlign: 'right',
    },

    itemsSummary: {
      gap: 13,
    },

    summaryItem: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent:
        'space-between',
    },

    summaryItemContent: {
      flex: 1,
      marginRight: 16,
    },

    summaryItemName: {
      color: '#343434',
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'right',
    },

    summaryItemQuantity: {
      color: '#939393',
      fontSize: 11,
      marginTop: 4,
      textAlign: 'right',
    },

    summaryItemPrice: {
      color: '#343434',
      fontSize: 13,
      fontWeight: '600',
    },

    itemsDivider: {
      backgroundColor:
        '#eeeeee',
      height: 1,
      marginVertical: 17,
    },

    summaryRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent:
        'space-between',
      marginBottom: 16,
    },

    summaryLabel: {
      color: '#696969',
      fontSize: 14,
    },

    summaryValue: {
      color: '#303030',
      fontSize: 14,
      fontWeight: '600',
    },

    discountLabel: {
      color: '#1F7A43',
      fontSize: 14,
      fontWeight: '700',
    },

    discountValue: {
      color: '#1F7A43',
      fontSize: 14,
      fontWeight: '800',
    },

    summaryDivider: {
      backgroundColor:
        '#eeeeee',
      height: 1,
      marginBottom: 19,
      marginTop: 3,
    },

    totalRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent:
        'space-between',
    },

    totalLabel: {
      color: '#202020',
      fontSize: 14,
      fontWeight: '800',
    },

    totalValue: {
      color: '#202020',
      fontSize: 18,
      fontWeight: '900',
    },

    submitBarWrapper: {
      backgroundColor:
        '#ffffff',
      borderTopColor:
        '#e8e8e8',
      borderTopWidth: 1,
      bottom: 0,
      left: 0,
      paddingBottom: 16,
      paddingHorizontal: 20,
      paddingTop: 14,
      position: 'absolute',
      right: 0,
      shadowColor: '#000000',
      shadowOffset: {
        width: 0,
        height: -3,
      },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 12,
    },

    submitBar: {
      flexDirection: 'row',
      gap: 11,
    },

    backToCartButton: {
      alignItems: 'center',
      backgroundColor:
        '#ffffff',
      borderColor: '#252525',
      borderRadius: 27,
      borderWidth: 1.5,
      flex: 0.7,
      height: 56,
      justifyContent:
        'center',
    },

    backToCartButtonText: {
      color: '#242424',
      fontSize: 14,
      fontWeight: '800',
    },

    submitButton: {
      alignItems: 'center',
      backgroundColor:
        BRAND_GREEN,
      borderRadius: 27,
      flex: 1.3,
      flexDirection: 'row',
      gap: 7,
      height: 56,
      justifyContent:
        'center',
      paddingHorizontal: 15,
    },

    submitButtonDisabled: {
      opacity: 0.65,
    },

    submitButtonPressed: {
      backgroundColor:
        BRAND_GREEN_DARK,
      transform: [
        {
          scale: 0.98,
        },
      ],
    },

    submitButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '800',
    },

    bottomButtonPressed: {
      opacity: 0.75,
      transform: [
        {
          scale: 0.98,
        },
      ],
    },

    emptyScreen: {
      backgroundColor:
        '#ffffff',
      flex: 1,
    },

    emptyContainer: {
      alignItems: 'center',
      flex: 1,
      justifyContent:
        'center',
      paddingHorizontal: 30,
    },

    emptyBackButton: {
      alignItems: 'center',
      backgroundColor:
        '#ffffff',
      borderColor: '#e4e4e4',
      borderRadius: 24,
      borderWidth: 1,
      height: 48,
      justifyContent:
        'center',
      left: 24,
      position: 'absolute',
      top: 54,
      width: 48,
      zIndex: 5,
    },

    emptyIconContainer: {
      alignItems: 'center',
      backgroundColor:
        BRAND_GREEN_SOFT,
      borderRadius: 40,
      height: 80,
      justifyContent:
        'center',
      width: 80,
    },

    errorIconContainer: {
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor:
        '#fff1f1',
      borderRadius: 48,
      height: 96,
      justifyContent:
        'center',
      marginTop: 'auto',
      width: 96,
    },

    emptyTitle: {
      color: '#242424',
      fontSize: 20,
      fontWeight: '800',
      marginTop: 18,
      textAlign: 'center',
    },

    emptyDescription: {
      alignSelf: 'center',
      color: '#7c7c7c',
      fontSize: 14,
      lineHeight: 22,
      marginTop: 8,
      maxWidth: 330,
      textAlign: 'center',
    },

    primaryButton: {
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor:
        BRAND_GREEN,
      borderRadius: 29,
      marginBottom: 'auto',
      marginTop: 24,
      minWidth: 220,
      paddingHorizontal: 30,
      paddingVertical: 16,
    },

    primaryButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '800',
    },

    buttonPressed: {
      opacity: 0.7,
    },
  });

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

import VoucherCheckoutCard from '../components/checkout/voucher-checkout-card';
import ServicePackageCheckout from '../components/service/service-package-checkout';
import { CheckoutScreenSkeleton } from '../components/ui/loading-skeleton';
import {
  ensureAppSession,
} from '../services/anonymous-auth-service';
import getAppBootstrap, {
  type AppBootstrap,
} from '../services/bootstrap-service';
import {
  getStoreCatalog,
} from '../services/catalog-service';
import {
  getDeliveryLocationErrorMessage,
  resolveDeliveryLocation,
  type DeliveryLocationResolution,
} from '../services/delivery-location-service';
import {
  cancelPendingWhatsAppOrder,
  createWhatsAppOrder,
} from '../services/order-service';
import {
  attachPrescriptionToOrder,
  getMyOpenPrescriptionSubmission,
  pickAndUploadPrescription,
  type PrescriptionSubmission,
} from '../services/prescription-service';
import type {
  VoucherQuote,
} from '../services/voucher-service';
import {
  useCartStore,
} from '../store/cart-store';
import {
  useCustomerStore,
} from '../store/customer-store';
import {
  useOrdersStore,
} from '../store/orders-store';

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
      '../../assets/payment-methods/vodafone-cash.png',
    ),

    'orange-cash': require(
      '../../assets/payment-methods/orange-cash.png',
    ),

    'etisalat-cash': require(
      '../../assets/payment-methods/etisalat-cash.png',
    ),

    instapay: require(
      '../../assets/payment-methods/instapay.png',
    ),
  };

/* ---------------------------------- */
/* FEES                               */
/* ---------------------------------- */

const PAYMENT_PROCESSING_FEE = 10;

/* ---------------------------------- */
/* TYPES                              */
/* ---------------------------------- */

type DefaultArea = {
  id: string;
  name: string;
};

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

function isImageUri(
  value: string | null | undefined,
) {
  if (!value) {
    return false;
  }

  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('file://') ||
    value.startsWith('data:image/')
  );
}

function getDefaultArea(
  bootstrap: AppBootstrap,
): DefaultArea | null {
  const defaultAreaId =
    bootstrap.settings
      .default_service_area_id;

  for (
    const city of bootstrap.cities
  ) {
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

  const [
    appliedVoucher,
    setAppliedVoucher,
  ] = useState<VoucherQuote | null>(
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

  const storeName =
    checkoutCart?.storeName ??
    null;

  const storeIcon =
    checkoutCart?.storeIcon ??
    null;

  const isPharmacyCart =
    checkoutCart?.categorySlug ===
      'pharmacy';

  const requiresPrescription =
    isPharmacyCart &&
    items.some(
      (item) =>
        item.requiresPrescription,
    );

  const hasAgeRestrictedItems =
    isPharmacyCart &&
    items.some(
      (item) =>
        item.isAgeRestricted,
    );

  const itemCount =
    items.reduce(
      (totalCount, item) =>
        totalCount +
        item.quantity,
      0,
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

  const locationAddress =
    useCustomerStore(
      (state) =>
        state.locationAddress,
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

  const setAddress =
    useCustomerStore(
      (state) =>
        state.setAddress,
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
    notes,
    setNotes,
  ] = useState('');

  const [
    submitted,
    setSubmitted,
  ] = useState(false);

  const [
    isSubmittingOrder,
    setIsSubmittingOrder,
  ] = useState(false);

  const [
    storeImageUrl,
    setStoreImageUrl,
  ] = useState<string | null>(null);

  const [
    storeImageFailed,
    setStoreImageFailed,
  ] = useState(false);

  const [
    prescriptionSubmission,
    setPrescriptionSubmission,
  ] = useState<PrescriptionSubmission | null>(
    null,
  );

  const [
    prescriptionFileName,
    setPrescriptionFileName,
  ] = useState<string | null>(null);

  const [
    isLoadingPrescription,
    setIsLoadingPrescription,
  ] = useState(false);

  const [
    isUploadingPrescription,
    setIsUploadingPrescription,
  ] = useState(false);

  const [
    prescriptionError,
    setPrescriptionError,
  ] = useState<string | null>(null);

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
    if (!appliedVoucher) {
      return;
    }

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
      !storeId ||
      subtotalChanged ||
      deliveryChanged
    ) {
      setAppliedVoucher(null);
    }
  }, [
    appliedVoucher,
    deliveryFee,
    storeId,
    subtotal,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadStoreImage() {
      setStoreImageFailed(false);

      if (!storeId) {
        setStoreImageUrl(null);
        return;
      }

      try {
        const loadedCatalog =
          await getStoreCatalog(storeId);

        const imageUrl =
          loadedCatalog.store.logoUrl ??
          loadedCatalog.store.coverImageUrl ??
          null;

        if (!cancelled) {
          setStoreImageUrl(
            isImageUri(imageUrl)
              ? imageUrl
              : null,
          );
        }
      } catch {
        if (!cancelled) {
          setStoreImageUrl(null);
        }
      }
    }

    void loadStoreImage();

    return () => {
      cancelled = true;
    };
  }, [storeId]);

  useEffect(() => {
    let cancelled = false;

    async function loadPrescription() {
      if (
        !requiresPrescription ||
        !storeId
      ) {
        setPrescriptionSubmission(null);
        setPrescriptionFileName(null);
        setPrescriptionError(null);
        setIsLoadingPrescription(false);
        return;
      }

      try {
        setIsLoadingPrescription(true);
        setPrescriptionError(null);

        const current =
          await getMyOpenPrescriptionSubmission(
            storeId,
          );

        if (!cancelled) {
          setPrescriptionSubmission(current);
          setPrescriptionFileName(
            current?.status === 'submitted'
              ? 'روشتة مرفوعة'
              : null,
          );
        }
      } catch (error) {
        if (!cancelled) {
          setPrescriptionError(
            error instanceof Error
              ? error.message
              : 'تعذر تحميل حالة الروشتة.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPrescription(false);
        }
      }
    }

    void loadPrescription();

    return () => {
      cancelled = true;
    };
  }, [
    requiresPrescription,
    storeId,
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

  const defaultArea =
    bootstrap
      ? getDefaultArea(
          bootstrap,
        )
      : null;

  const currencyCode =
    bootstrap?.settings
      .currency_code ??
    'EGP';

  const appName =
    bootstrap?.settings
      .app_name ??
    'Navienty Now';

  const displayStoreImage =
    !storeImageFailed
      ? storeImageUrl ??
        (isImageUri(storeIcon)
          ? storeIcon
          : null)
      : null;

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

  function editDeliveryLocation() {
    if (!storeId) {
      return;
    }

    router.push({
      pathname:
        '/location-picker',

      params: {
        storeId,
        source: 'checkout',
      },
    });
  }

  async function uploadPrescription() {
    if (
      !storeId ||
      isUploadingPrescription
    ) {
      return;
    }

    try {
      setIsUploadingPrescription(true);
      setPrescriptionError(null);

      const result =
        await pickAndUploadPrescription(
          storeId,
        );

      if (
        result.status ===
        'submitted'
      ) {
        setPrescriptionSubmission(
          result.submission,
        );
        setPrescriptionFileName(
          result.fileName,
        );
      }
    } catch (error) {
      setPrescriptionError(
        error instanceof Error
          ? error.message
          : 'تعذر رفع الروشتة.',
      );
    } finally {
      setIsUploadingPrescription(false);
    }
  }

  const prescriptionIsReady =
    !requiresPrescription ||
    prescriptionSubmission?.status ===
      'submitted' ||
    prescriptionSubmission?.status ===
      'approved';

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

    prescription:
      prescriptionIsReady,
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
              size={45}
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
            size={44}
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

      if (
        requiresPrescription &&
        prescriptionSubmission?.status ===
          'submitted'
      ) {
        await attachPrescriptionToOrder(
          createdOrder.id,
          prescriptionSubmission.id,
        );
      }

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

      createdOrder = null;

      router.replace(
        '/order-confirmation',
      );
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
              size={28}
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
          style={
            styles.orderStoreSection
          }
        >
          <View
            style={
              styles.storeIconContainer
            }
          >
            {displayStoreImage ? (
              <Image
                source={{
                  uri: displayStoreImage,
                }}
                style={styles.storeImage}
                resizeMode="cover"
                onError={() =>
                  setStoreImageFailed(true)
                }
              />
            ) : (
              <Text
                style={
                  styles.storeIcon
                }
              >
                {storeIcon ??
                  '🏪'}
              </Text>
            )}
          </View>

          <View
            style={
              styles.storeContent
            }
          >
            <Text
              style={
                styles.storeLabel
              }
            >
              طلبك من
            </Text>

            <Text
              style={
                styles.storeName
              }
              numberOfLines={1}
            >
              {storeName ??
                'المتجر'}
            </Text>

            <Text
              style={
                styles.storeMeta
              }
            >
              {itemCount}{' '}
              {itemCount === 1
                ? 'منتج'
                : 'منتجات'}{' '}
              •{' '}
              {formatPrice(
                total,
              )}
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
                size={21}
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
                size={21}
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

        <View
          style={styles.section}
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            عنوان التوصيل
          </Text>

          <View
            style={[
              styles.mapLocationCard,
              !hasDeliveryLocation &&
                styles.mapLocationCardMissing,
            ]}
          >
            <View
              style={
                styles.mapLocationIconContainer
              }
            >
              <Ionicons
                name={
                  hasDeliveryLocation
                    ? 'location'
                    : 'location-outline'
                }
                size={25}
                color={
                  hasDeliveryLocation
                    ? BRAND_GREEN
                    : '#8b8b8b'
                }
              />
            </View>

            <View
              style={
                styles.mapLocationContent
              }
            >
              <Text
                style={
                  styles.mapLocationLabel
                }
              >
                الموقع على الخريطة
              </Text>

              <Text
                numberOfLines={2}
                style={
                  styles.mapLocationValue
                }
              >
                {hasDeliveryLocation
                  ? locationAddress ||
                    'تم تحديد موقع التوصيل على الخريطة'
                  : 'حدد موقع التوصيل على الخريطة أولًا'}
              </Text>
            </View>

            <Pressable
              style={({
                pressed,
              }) => [
                styles.changeLocationButton,
                pressed &&
                  styles.buttonPressed,
              ]}
              onPress={
                editDeliveryLocation
              }
            >
              <Text
                style={
                  styles.changeLocationButtonText
                }
              >
                {hasDeliveryLocation
                  ? 'تغيير'
                  : 'تحديد'}
              </Text>
            </Pressable>
          </View>

          {submitted &&
            !validation.location && (
              <Text
                style={
                  styles.locationErrorText
                }
              >
                حدد موقع التوصيل على الخريطة قبل إرسال الطلب.
              </Text>
            )}

          <View
            style={
              styles.areaCard
            }
          >
            <View
              style={
                styles.areaIconContainer
              }
            >
              <Ionicons
                name="location-outline"
                size={25}
                color={
                  BRAND_GREEN
                }
              />
            </View>

            <View
              style={
                styles.areaContent
              }
            >
              <Text
                style={
                  styles.areaLabel
                }
              >
                منطقة التوصيل
              </Text>

              <Text
                style={
                  styles.areaValue
                }
              >
                {deliveryResolution?.serviceAreaName
                  ? `${deliveryResolution.serviceAreaName}${
                      deliveryResolution.cityName
                        ? `، ${deliveryResolution.cityName}`
                        : ''
                    }`
                  : defaultArea?.name ??
                    locationAddress ??
                    'موقع التوصيل'}
              </Text>
            </View>

            <Ionicons
              name="checkmark-circle"
              size={23}
              color={
                BRAND_GREEN
              }
            />
          </View>

          <View
            style={styles.field}
          >
            <Text
              style={
                styles.fieldLabel
              }
            >
              العنوان بالتفصيل
            </Text>

            <Text
              style={
                styles.addressHelperText
              }
            >
              تم تعبئة العنوان تلقائيًا من موقعك على الخريطة. يمكنك إضافة رقم العمارة والدور والشقة إذا لزم.
            </Text>

            <View
              style={[
                styles.inputContainer,
                styles.multilineContainer,
                submitted &&
                  !validation.address &&
                  styles.inputContainerError,
              ]}
            >
              <Ionicons
                name="home-outline"
                size={21}
                color="#777777"
                style={
                  styles.multilineIcon
                }
              />

              <TextInput
                style={[
                  styles.input,
                  styles.multilineInput,
                ]}
                value={address}
                onChangeText={
                  setAddress
                }
                placeholder="اسم الشارع، رقم العمارة، الدور، رقم الشقة"
                placeholderTextColor="#a1a1a1"
                multiline
                numberOfLines={4}
                textAlign="right"
                textAlignVertical="top"
              />
            </View>

            {submitted &&
              !validation.address && (
                <Text
                  style={
                    styles.errorText
                  }
                >
                  اكتب عنوانًا واضحًا ومفصلًا للتوصيل.
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
              ملاحظات على الطلب
            </Text>

            <View
              style={[
                styles.inputContainer,
                styles.notesContainer,
              ]}
            >
              <Ionicons
                name="chatbox-outline"
                size={21}
                color="#777777"
                style={
                  styles.multilineIcon
                }
              />

              <TextInput
                style={[
                  styles.input,
                  styles.notesInput,
                ]}
                value={notes}
                onChangeText={
                  setNotes
                }
                placeholder="أي تفاصيل مهمة للمتجر أو المندوب"
                placeholderTextColor="#a1a1a1"
                multiline
                numberOfLines={3}
                textAlign="right"
                textAlignVertical="top"
              />
            </View>
          </View>
        </View>

        {(requiresPrescription ||
          hasAgeRestrictedItems) && (
          <View style={styles.section}>
            <Text
              style={
                styles.sectionTitle
              }
            >
              متطلبات الصيدلية
            </Text>

            {requiresPrescription && (
              <View
                style={
                  styles.prescriptionCard
                }
              >
                <View
                  style={
                    styles.prescriptionHeader
                  }
                >
                  <View
                    style={
                      styles.prescriptionIcon
                    }
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={22}
                      color="#8A5A18"
                    />
                  </View>

                  <View
                    style={
                      styles.prescriptionCopy
                    }
                  >
                    <Text
                      style={
                        styles.prescriptionTitle
                      }
                    >
                      هذا الطلب يحتاج روشتة
                    </Text>

                    <Text
                      style={
                        styles.prescriptionDescription
                      }
                    >
                      ارفع صورة واضحة أو PDF للروشتة قبل إرسال الطلب. الملف خاص ولا يظهر في الكتالوج أو لأي مستخدم آخر.
                    </Text>
                  </View>
                </View>

                {isLoadingPrescription ? (
                  <View
                    style={
                      styles.prescriptionLoading
                    }
                  >
                    <ActivityIndicator
                      size="small"
                      color="#8A5A18"
                    />
                  </View>
                ) : prescriptionIsReady ? (
                  <View
                    style={
                      styles.prescriptionReadyRow
                    }
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={BRAND_GREEN}
                    />

                    <Text
                      style={
                        styles.prescriptionReadyText
                      }
                      numberOfLines={1}
                    >
                      {prescriptionFileName ??
                        'تم رفع الروشتة'}
                    </Text>
                  </View>
                ) : null}

                <Pressable
                  disabled={
                    isUploadingPrescription ||
                    isLoadingPrescription
                  }
                  style={({ pressed }) => [
                    styles.prescriptionButton,
                    (isUploadingPrescription ||
                      isLoadingPrescription) &&
                      styles.prescriptionButtonDisabled,
                    pressed &&
                      !isUploadingPrescription &&
                      !isLoadingPrescription &&
                      styles.buttonPressed,
                  ]}
                  onPress={() => {
                    void uploadPrescription();
                  }}
                >
                  {isUploadingPrescription ? (
                    <ActivityIndicator
                      size="small"
                      color="#ffffff"
                    />
                  ) : (
                    <Ionicons
                      name={
                        prescriptionIsReady
                          ? 'refresh-outline'
                          : 'cloud-upload-outline'
                      }
                      size={19}
                      color="#ffffff"
                    />
                  )}

                  <Text
                    style={
                      styles.prescriptionButtonText
                    }
                  >
                    {prescriptionIsReady
                      ? 'استبدال الروشتة'
                      : 'رفع الروشتة'}
                  </Text>
                </Pressable>

                {prescriptionError && (
                  <Text
                    style={
                      styles.prescriptionError
                    }
                  >
                    {prescriptionError}
                  </Text>
                )}

                {submitted &&
                  !validation.prescription && (
                    <Text
                      style={
                        styles.prescriptionError
                      }
                    >
                      ارفع الروشتة قبل إرسال الطلب.
                    </Text>
                  )}
              </View>
            )}

            {hasAgeRestrictedItems && (
              <View
                style={
                  styles.ageVerificationCard
                }
              >
                <Ionicons
                  name="card-outline"
                  size={22}
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
                    قد يطلب المندوب أو فريق الصيدلية بطاقة هوية قبل تسليم المنتجات المقيدة بالعمر.
                  </Text>
                </View>
              </View>
            )}
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

        <VoucherCheckoutCard
          storeId={storeId}
          subtotal={subtotal}
          deliveryFee={deliveryFee}
          customerPhone={
            normalizedPhone
          }
          currencyCode={
            currencyCode
          }
          value={
            appliedVoucher
          }
          onChange={
            setAppliedVoucher
          }
        />

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
              styles.itemsSummary
            }
          >
            {items.map(
              (item) => (
                <View
                  key={`${item.id}-${
                    item.variantId ??
                    'base'
                  }`}
                  style={
                    styles.summaryItem
                  }
                >
                  <View
                    style={
                      styles.summaryItemContent
                    }
                  >
                    <Text
                      style={
                        styles.summaryItemName
                      }
                      numberOfLines={2}
                    >
                      {item.name}
                    </Text>

                    <Text
                      style={
                        styles.summaryItemQuantity
                      }
                    >
                      الكمية:{' '}
                      {item.quantity}
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.summaryItemPrice
                    }
                  >
                    {formatPrice(
                      Number(
                        item.price,
                      ) *
                        item.quantity,
                    )}
                  </Text>
                </View>
              ),
            )}
          </View>

          <View
            style={
              styles.itemsDivider
            }
          />

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

        <View
          style={
            styles.whatsAppNotice
          }
        >
          <View
            style={
              styles.whatsAppIconContainer
            }
          >
            <Ionicons
              name="logo-whatsapp"
              size={27}
              color={
                BRAND_GREEN
              }
            />
          </View>

          <View
            style={
              styles.whatsAppNoticeContent
            }
          >
            <Text
              style={
                styles.whatsAppNoticeTitle
              }
            >
              تأكيد الطلب عبر واتساب
            </Text>

            <Text
              style={
                styles.whatsAppNoticeDescription
              }
            >
              بعد الضغط على متابعة سيتم إنشاء الطلب داخل {appName} أولًا. في الشاشة التالية يمكنك فتح واتساب برسالة جاهزة عندما تكون مستعدًا.
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
                size={22}
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
      paddingBottom: 145,
    },

    header: {
      alignItems: 'center',
      flexDirection: 'row',
      paddingBottom: 28,
      paddingHorizontal: 24,
      paddingTop: 54,
    },

    backButton: {
      alignItems: 'center',
      backgroundColor:
        '#ffffff',
      borderColor: '#e5e5e5',
      borderRadius: 31,
      borderWidth: 1,
      height: 62,
      justifyContent:
        'center',
      width: 62,
    },

    headerContent: {
      flex: 1,
      marginLeft: 18,
    },

    pageTitle: {
      color: '#202020',
      fontSize: 25,
      fontWeight: '800',
    },

    pageSubtitle: {
      color: '#8a8a8a',
      fontSize: 15,
      marginTop: 3,
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
      paddingVertical: 19,
    },

    storeIconContainer: {
      alignItems: 'center',
      backgroundColor:
        '#f5f5f5',
      borderColor: '#ededed',
      borderRadius: 17,
      borderWidth: 1,
      height: 62,
      justifyContent:
        'center',
      overflow: 'hidden',
      width: 62,
    },

    storeImage: {
      height: '100%',
      width: '100%',
    },

    storeIcon: {
      fontSize: 30,
    },

    storeContent: {
      flex: 1,
      marginLeft: 15,
    },

    storeLabel: {
      color: '#929292',
      fontSize: 11,
    },

    storeName: {
      color: '#242424',
      fontSize: 18,
      fontWeight: '800',
      marginTop: 3,
    },

    storeMeta: {
      color: '#818181',
      fontSize: 12,
      marginTop: 5,
    },

    section: {
      borderBottomColor:
        '#f0f0f0',
      borderBottomWidth: 1,
      paddingBottom: 7,
      paddingHorizontal: 24,
      paddingTop: 29,
    },

    sectionTitle: {
      color: '#242424',
      fontSize: 23,
      fontWeight: '800',
      marginBottom: 20,
      textAlign: 'right',
    },

    sectionDescription: {
      color: '#858585',
      fontSize: 13,
      lineHeight: 20,
      marginBottom: 17,
      textAlign: 'right',
    },

    field: {
      marginBottom: 20,
    },

    fieldLabel: {
      color: '#373737',
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 9,
      textAlign: 'right',
    },

    inputContainer: {
      alignItems: 'center',
      backgroundColor:
        '#ffffff',
      borderColor: '#dfdfdf',
      borderRadius: 17,
      borderWidth: 1,
      flexDirection: 'row',
      minHeight: 58,
      paddingHorizontal: 15,
    },

    inputContainerError: {
      borderColor: '#d64b4b',
    },

    input: {
      color: '#242424',
      flex: 1,
      fontSize: 15,
      minHeight: 56,
      paddingHorizontal: 13,
      paddingVertical: 12,
      writingDirection:
        'rtl',
    },

    multilineContainer: {
      alignItems: 'flex-start',
      minHeight: 125,
    },

    multilineInput: {
      minHeight: 120,
      paddingTop: 16,
    },

    notesContainer: {
      alignItems: 'flex-start',
      minHeight: 105,
    },

    notesInput: {
      minHeight: 100,
      paddingTop: 16,
    },

    multilineIcon: {
      marginTop: 17,
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
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      marginBottom: 12,
      padding: 15,
    },

    mapLocationCardMissing: {
      backgroundColor: '#f7f7f7',
      borderColor: '#e0e0e0',
    },

    mapLocationIconContainer: {
      alignItems: 'center',
      backgroundColor:
        '#ffffff',
      borderRadius: 21,
      height: 42,
      justifyContent:
        'center',
      width: 42,
    },

    mapLocationContent: {
      flex: 1,
      marginHorizontal: 13,
    },

    mapLocationLabel: {
      color: '#638370',
      fontSize: 11,
      textAlign: 'right',
    },

    mapLocationValue: {
      color: '#1c5334',
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 19,
      marginTop: 4,
      textAlign: 'right',
    },

    changeLocationButton: {
      alignItems: 'center',
      backgroundColor:
        '#ffffff',
      borderColor:
        BRAND_GREEN,
      borderRadius: 15,
      borderWidth: 1,
      justifyContent:
        'center',
      minHeight: 38,
      minWidth: 62,
      paddingHorizontal: 12,
    },

    changeLocationButtonText: {
      color:
        BRAND_GREEN_DARK,
      fontSize: 12,
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
      marginBottom: 21,
      padding: 15,
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
      fontSize: 14,
      fontWeight: '800',
      marginTop: 4,
      textAlign: 'right',
    },

    prescriptionCard: {
      backgroundColor: '#FFF8EB',
      borderColor: '#F0D8AE',
      borderRadius: 18,
      borderWidth: 1,
      marginBottom: 14,
      padding: 15,
    },

    prescriptionHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
    },

    prescriptionIcon: {
      alignItems: 'center',
      backgroundColor: '#ffffff',
      borderRadius: 20,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },

    prescriptionCopy: {
      flex: 1,
      marginLeft: 12,
    },

    prescriptionTitle: {
      color: '#5D3B13',
      fontSize: 14,
      fontWeight: '800',
      textAlign: 'right',
    },

    prescriptionDescription: {
      color: '#806543',
      fontSize: 11,
      lineHeight: 18,
      marginTop: 5,
      textAlign: 'right',
    },

    prescriptionLoading: {
      alignItems: 'center',
      marginTop: 14,
    },

    prescriptionReadyRow: {
      alignItems: 'center',
      backgroundColor: '#ffffff',
      borderRadius: 12,
      flexDirection: 'row',
      marginTop: 13,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },

    prescriptionReadyText: {
      color: '#325E42',
      flex: 1,
      fontSize: 11,
      fontWeight: '700',
      marginLeft: 8,
      textAlign: 'right',
    },

    prescriptionButton: {
      alignItems: 'center',
      backgroundColor: '#8A5A18',
      borderRadius: 14,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      marginTop: 13,
      minHeight: 48,
      paddingHorizontal: 16,
    },

    prescriptionButtonDisabled: {
      opacity: 0.55,
    },

    prescriptionButtonText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '800',
    },

    prescriptionError: {
      color: '#B44343',
      fontSize: 11,
      lineHeight: 17,
      marginTop: 9,
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
      gap: 11,
    },

    paymentMethod: {
      alignItems: 'center',
      backgroundColor:
        '#ffffff',
      borderColor: '#dedede',
      borderRadius: 19,
      borderWidth: 1,
      flexDirection: 'row',
      minHeight: 78,
      paddingHorizontal: 15,
      paddingVertical: 12,
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
      borderRadius: 14,
      height: 49,
      justifyContent:
        'center',
      overflow: 'hidden',
      width: 49,
    },

    paymentMethodImage: {
      height: '100%',
      width: '100%',
    },

    paymentIcon: {
      fontSize: 24,
    },

    paymentContent: {
      flex: 1,
      marginHorizontal: 13,
    },

    paymentTitle: {
      color: '#262626',
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'right',
    },

    radioOuter: {
      alignItems: 'center',
      borderColor: '#b7b7b7',
      borderRadius: 11,
      borderWidth: 2,
      height: 22,
      justifyContent:
        'center',
      width: 22,
    },

    radioOuterSelected: {
      borderColor:
        BRAND_GREEN,
    },

    radioInner: {
      backgroundColor:
        BRAND_GREEN,
      borderRadius: 6,
      height: 12,
      width: 12,
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
      paddingVertical: 29,
    },

    orderSummaryTitle: {
      color: '#242424',
      fontSize: 23,
      fontWeight: '800',
      marginBottom: 22,
      textAlign: 'right',
    },

    itemsSummary: {
      gap: 16,
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
      fontSize: 14,
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
      marginVertical: 21,
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
      fontSize: 18,
      fontWeight: '800',
    },

    totalValue: {
      color: '#202020',
      fontSize: 20,
      fontWeight: '900',
    },

    whatsAppNotice: {
      alignItems: 'center',
      backgroundColor:
        BRAND_GREEN_SOFT,
      borderColor: '#d5f0e0',
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      marginHorizontal: 24,
      marginTop: 21,
      padding: 16,
    },

    whatsAppIconContainer: {
      alignItems: 'center',
      backgroundColor:
        '#ffffff',
      borderRadius: 23,
      height: 46,
      justifyContent:
        'center',
      width: 46,
    },

    whatsAppNoticeContent: {
      flex: 1,
      marginLeft: 13,
    },

    whatsAppNoticeTitle: {
      color: '#23553a',
      fontSize: 14,
      fontWeight: '800',
      textAlign: 'right',
    },

    whatsAppNoticeDescription: {
      color: '#557362',
      fontSize: 11,
      lineHeight: 18,
      marginTop: 5,
      textAlign: 'right',
    },

    submitBarWrapper: {
      backgroundColor:
        '#ffffff',
      borderTopColor:
        '#e8e8e8',
      borderTopWidth: 1,
      bottom: 0,
      left: 0,
      paddingBottom: 20,
      paddingHorizontal: 24,
      paddingTop: 18,
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
      gap: 15,
    },

    backToCartButton: {
      alignItems: 'center',
      backgroundColor:
        '#ffffff',
      borderColor: '#252525',
      borderRadius: 31,
      borderWidth: 1.5,
      flex: 0.7,
      height: 64,
      justifyContent:
        'center',
    },

    backToCartButtonText: {
      color: '#242424',
      fontSize: 17,
      fontWeight: '800',
    },

    submitButton: {
      alignItems: 'center',
      backgroundColor:
        BRAND_GREEN,
      borderRadius: 31,
      flex: 1.3,
      flexDirection: 'row',
      gap: 9,
      height: 64,
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
      borderRadius: 30,
      borderWidth: 1,
      height: 60,
      justifyContent:
        'center',
      left: 24,
      position: 'absolute',
      top: 54,
      width: 60,
      zIndex: 5,
    },

    emptyIconContainer: {
      alignItems: 'center',
      backgroundColor:
        BRAND_GREEN_SOFT,
      borderRadius: 48,
      height: 96,
      justifyContent:
        'center',
      width: 96,
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
      fontSize: 24,
      fontWeight: '800',
      marginTop: 22,
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

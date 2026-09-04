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
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ServicePackageCheckout from '../components/service/service-package-checkout';
import { CheckoutScreenSkeleton } from '../components/ui/loading-skeleton';
import {
  isV1PublicCategorySlug,
  V1_UNAVAILABLE_CATEGORY_MESSAGE,
} from '../config/v1-release-scope';
import {
  supabase,
} from '../lib/supabase';
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

const WHATSAPP_ORDER_PHONE =
  '201032995859';

const WHATSAPP_ORDER_MESSAGE =
  'أكد الاوردر بتاعي';

const WHATSAPP_ORDER_URL =
  `https://wa.me/${WHATSAPP_ORDER_PHONE}?text=${encodeURIComponent(
    WHATSAPP_ORDER_MESSAGE,
  )}`;

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

const LAUNDRY_CHECKOUT_IMAGE: ImageSourcePropType =
  require(
    '../assets/icons/categories/laundry.webp',
  );

const REQUEST_ANYTHING_CHECKOUT_IMAGE: ImageSourcePropType =
  require(
    '../assets/icons/categories/request-anything.webp',
  );

const REQUEST_ANYTHING_CATEGORY_ALIASES = new Set([
  'request-anything',
  'anything',
  'other',
  'special-request',
]);

const LAUNDRY_CATEGORY_ALIASES = new Set([
  'laundry',
  'laundry-ironing',
  'wash-and-iron',
  'washing-ironing',
]);

/* ---------------------------------- */
/* FEES                               */
/* ---------------------------------- */

const PAYMENT_PROCESSING_FEE = 10;
const SPIN_UNLOCK_SUBTOTAL_FALLBACK = 200;

/* ---------------------------------- */
/* TYPES                              */
/* ---------------------------------- */

type CheckoutSpinMode =
  | 'welcome'
  | 'standard';

type CheckoutSpinRewardType =
  | 'current_order_discount'
  | 'next_order_discount'
  | 'processing_fee_waiver';

type CheckoutSpinState = {
  eventId: string;
  eventStatus: string;
  storeId: string;
  mode: CheckoutSpinMode;
  rewardType: CheckoutSpinRewardType;
  rewardValue: number;
  minimumNextOrder: number | null;
  expiresAt: string | null;
  rewardStatus: string | null;
  unlockSubtotal: number;
};

type CheckoutSpinStatusRpcResponse = {
  enabled?: boolean | null;
  mode?: string | null;
  unlock_subtotal?: number | string | null;
  has_existing_spin?: boolean | null;
  event?: {
    id?: string | null;
    mode?: string | null;
    store_id?: string | null;
    status?: string | null;
    reward?: {
      type?: string | null;
      value?: number | string | null;
      minimum_next_order?: number | string | null;
      expires_at?: string | null;
      reward_status?: string | null;
    } | null;
  } | null;
};

function toFiniteNumber(
  value:
    | number
    | string
    | null
    | undefined,
  fallback = 0,
) {
  const numericValue =
    Number(value);

  return Number.isFinite(
    numericValue,
  )
    ? numericValue
    : fallback;
}

function normalizeCheckoutSpinMode(
  value: string | null | undefined,
): CheckoutSpinMode {
  return value === 'standard'
    ? 'standard'
    : 'welcome';
}

function normalizeCheckoutSpinRewardType(
  value: string | null | undefined,
): CheckoutSpinRewardType | null {
  if (
    value ===
      'current_order_discount' ||
    value ===
      'next_order_discount' ||
    value ===
      'processing_fee_waiver'
  ) {
    return value;
  }

  return null;
}

function parseCheckoutSpinState(
  response:
    CheckoutSpinStatusRpcResponse,
): CheckoutSpinState | null {
  const event =
    response.event;

  if (
    !response.enabled ||
    !response.has_existing_spin ||
    !event?.id ||
    !event.store_id ||
    !event.reward
  ) {
    return null;
  }

  const rewardType =
    normalizeCheckoutSpinRewardType(
      event.reward.type,
    );

  if (!rewardType) {
    return null;
  }

  const minimumNextOrder =
    event.reward.minimum_next_order ===
        null ||
      event.reward.minimum_next_order ===
        undefined
      ? null
      : Math.max(
          toFiniteNumber(
            event.reward
              .minimum_next_order,
            0,
          ),
          0,
        );

  return {
    eventId: event.id,
    eventStatus:
      event.status ?? 'issued',
    storeId: event.store_id,
    mode:
      normalizeCheckoutSpinMode(
        event.mode ??
          response.mode,
      ),
    rewardType,
    rewardValue:
      Math.max(
        toFiniteNumber(
          event.reward.value,
          0,
        ),
        0,
      ),
    minimumNextOrder,
    expiresAt:
      event.reward.expires_at ??
      null,
    rewardStatus:
      event.reward.reward_status ??
      null,
    unlockSubtotal:
      Math.max(
        toFiniteNumber(
          response.unlock_subtotal,
          SPIN_UNLOCK_SUBTOTAL_FALLBACK,
        ),
        0,
      ),
  };
}

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

type RequestAnythingCartDetails = {
  kind: 'request-anything';
  requestText: string;
  pickupAddress: string;
};

function parseRequestAnythingCartDetails(
  description: string,
): RequestAnythingCartDetails | null {
  if (!description.trim()) {
    return null;
  }

  try {
    const parsed =
      JSON.parse(
        description,
      ) as Partial<RequestAnythingCartDetails>;

    if (
      parsed.kind !==
        'request-anything' ||
      typeof parsed.requestText !==
        'string' ||
      typeof parsed.pickupAddress !==
        'string'
    ) {
      return null;
    }

    const requestText =
      parsed.requestText.trim();

    const pickupAddress =
      parsed.pickupAddress.trim();

    if (
      !requestText ||
      !pickupAddress
    ) {
      return null;
    }

    return {
      kind:
        'request-anything',

      requestText,

      pickupAddress,
    };
  } catch {
    return null;
  }
}

function buildRequestAnythingOrderNotes(
  details: RequestAnythingCartDetails,
  additionalNotes: string,
) {
  const requestDetails =
    [
      'نوع الطلب: اطلب أي حاجة',
      `الطلب: ${details.requestText}`,
      `نجيبه من: ${details.pickupAddress}`,
    ].join('\n');

  const trimmedAdditionalNotes =
    additionalNotes.trim();

  if (!trimmedAdditionalNotes) {
    return requestDetails;
  }

  return [
    requestDetails,
    `ملاحظات إضافية من العميل: ${trimmedAdditionalNotes}`,
  ].join('\n\n');
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
  const insets = useSafeAreaInsets();

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
    storeImageUrl,
    setStoreImageUrl,
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

  const [
    checkoutSpin,
    setCheckoutSpin,
  ] = useState<CheckoutSpinState | null>(
    null,
  );

  const [
    isLoadingSpinStatus,
    setIsLoadingSpinStatus,
  ] = useState(false);

  const [
    spinStatusError,
    setSpinStatusError,
  ] = useState<string | null>(
    null,
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

  const normalizedStoreCategorySlug =
    (
      checkoutCart?.categorySlug ??
      ''
    )
      .trim()
      .toLowerCase()
      .replace(/_/g, '-')
      .replace(/\s+/g, '-');

  const isLaundryCheckout =
    LAUNDRY_CATEGORY_ALIASES.has(
      normalizedStoreCategorySlug,
    );

  const isRequestAnythingCheckout =
    REQUEST_ANYTHING_CATEGORY_ALIASES.has(
      normalizedStoreCategorySlug,
    );

  const requestAnythingDetails =
    isRequestAnythingCheckout
      ? (
          items
            .map((item) =>
              parseRequestAnythingCartDetails(
                item.description,
              ),
            )
            .find(
              (
                details,
              ): details is RequestAnythingCartDetails =>
                details !== null,
            ) ?? null
        )
      : null;

  const notesForSubmission =
    requestAnythingDetails
      ? buildRequestAnythingOrderNotes(
          requestAnythingDetails,
          notes,
        )
      : notes;

  const storeImageSource:
    ImageSourcePropType | null =
    isRequestAnythingCheckout
      ? REQUEST_ANYTHING_CHECKOUT_IMAGE
      : isLaundryCheckout
        ? LAUNDRY_CHECKOUT_IMAGE
        : storeImageUrl
          ? {
              uri: storeImageUrl,
            }
          : null;

  const hasAgeRestrictedItems =
    items.some(
      (item) =>
        'isAgeRestricted' in item &&
        item.isAgeRestricted === true,
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

  const spinBelongsToCurrentStore =
    !!checkoutSpin &&
    !!storeId &&
    checkoutSpin.storeId ===
      storeId;

  const spinEventIsAvailable =
    checkoutSpin?.eventStatus ===
      'issued';

  const spinIsImmediateReward =
    checkoutSpin?.rewardType ===
      'current_order_discount' ||
    checkoutSpin?.rewardType ===
      'processing_fee_waiver';

  const spinThresholdReached =
    checkoutSpin?.mode === 'welcome' ||
    Number(subtotal ?? 0) >=
      (
        checkoutSpin?.unlockSubtotal ??
        SPIN_UNLOCK_SUBTOTAL_FALLBACK
      );

  const spinCanApplyToCurrentOrder =
    !!checkoutSpin &&
    spinBelongsToCurrentStore &&
    spinEventIsAvailable &&
    spinIsImmediateReward &&
    spinThresholdReached;

  /**
   * One reward per order.
   *
   * If an immediate Spin reward is active, the voucher is ignored in
   * the quote immediately and removed from the store below. This avoids
   * even a single render where both discounts appear stacked.
   */
  const effectiveAppliedVoucher =
    spinCanApplyToCurrentOrder
      ? null
      : appliedVoucher;

  const voucherDiscountTarget =
    effectiveAppliedVoucher
      ?.discountTarget ??
    'order_subtotal';

  const voucherDiscountBase =
    voucherDiscountTarget ===
      'delivery_fee'
      ? deliveryFee
      : Number(subtotal ?? 0);

  const voucherDiscount =
    Math.min(
      Math.max(
        effectiveAppliedVoucher
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

  const spinSubtotalDiscount =
    spinCanApplyToCurrentOrder &&
    checkoutSpin?.rewardType ===
      'current_order_discount'
      ? Math.min(
          checkoutSpin.rewardValue,
          discountedSubtotal,
        )
      : 0;

  const spinProcessingFeeDiscount =
    spinCanApplyToCurrentOrder &&
    checkoutSpin?.rewardType ===
      'processing_fee_waiver'
      ? Math.min(
          checkoutSpin.rewardValue,
          paymentProcessingFee,
        )
      : 0;

  const activeSpinSavings =
    spinSubtotalDiscount +
    spinProcessingFeeDiscount;

  const totalBeforeSpin =
    discountedSubtotal +
    discountedDeliveryFee +
    paymentProcessingFee;

  const total =
    Math.max(
      totalBeforeSpin -
        activeSpinSavings,
      0,
    );

  const hasFutureSpinReward =
    !!checkoutSpin &&
    spinBelongsToCurrentStore &&
    checkoutSpin.eventStatus ===
      'issued' &&
    checkoutSpin.rewardType ===
      'next_order_discount' &&
    (
      checkoutSpin.rewardStatus ===
        null ||
      checkoutSpin.rewardStatus ===
        'available'
    );

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
    let cancelled = false;

    async function loadCheckoutSpinStatus() {
      if (!storeId) {
        setCheckoutSpin(null);
        setSpinStatusError(null);
        setIsLoadingSpinStatus(false);
        return;
      }

      try {
        setIsLoadingSpinStatus(true);
        setSpinStatusError(null);

        await ensureAppSession();

        const {
          data,
          error,
        } =
          await supabase.rpc(
            'get_my_spin_status',
            {
              p_store_id: storeId,
            },
          );

        if (error) {
          throw error;
        }

        if (cancelled) {
          return;
        }

        const response =
          (data ?? {}) as
            CheckoutSpinStatusRpcResponse;

        setCheckoutSpin(
          parseCheckoutSpinState(
            response,
          ),
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.warn(
          'Unable to load Checkout Spin status.',
          error,
        );

        setCheckoutSpin(null);
        setSpinStatusError(
          'تعذر تحديث مكافأة الـSpin. سيتم التحقق منها مرة أخرى عند إرسال الطلب.',
        );
      } finally {
        if (!cancelled) {
          setIsLoadingSpinStatus(false);
        }
      }
    }

    void loadCheckoutSpinStatus();

    return () => {
      cancelled = true;
    };
  }, [storeId]);

  useEffect(() => {
    if (
      !storeId ||
      !appliedVoucher ||
      !spinCanApplyToCurrentOrder
    ) {
      return;
    }

    setStoreVoucher(
      storeId,
      null,
    );
  }, [
    appliedVoucher,
    setStoreVoucher,
    spinCanApplyToCurrentOrder,
    storeId,
  ]);

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
    let cancelled = false;

    async function loadStoreImage() {
      if (!storeId) {
        setStoreImageUrl(null);
        return;
      }

      try {
        const storeCatalog =
          await getStoreCatalog(
            storeId,
          );

        if (cancelled) {
          return;
        }

        setStoreImageUrl(
          storeCatalog.store.logoUrl ||
            storeCatalog.store
              .coverImageUrl ||
            null,
        );
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
    if (
      !appliedVoucher ||
      !storeId ||
      spinCanApplyToCurrentOrder
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
    spinCanApplyToCurrentOrder,
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
    !isResolvingDelivery &&
    !isLoadingSpinStatus;

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

          notes:
            notesForSubmission,

          voucherCode:
            effectiveAppliedVoucher
              ?.code ??
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

      const whatsappConfirmationMessage =
        WHATSAPP_ORDER_MESSAGE;

      const orderForWhatsApp = {
        ...createdOrder,
        whatsappMessage:
          whatsappConfirmationMessage,
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
          whatsappConfirmationMessage,
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

      try {
        await Linking.openURL(
          WHATSAPP_ORDER_URL,
        );
      } catch {
        Alert.alert(
          'تعذر فتح واتساب',
          'تم إنشاء طلبك بنجاح. افتح واتساب وأرسل «أكد الاوردر بتاعي» إلى رقم ناڤينتي ناو.',
        );
      }
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


        </View>

      <ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={
          styles.pageContent
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
      >
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

          {activeSpinSavings > 0 ? (
            <View
              style={
                styles.summaryRow
              }
            >
              <Text
                style={
                  styles.spinDiscountLabel
                }
              >
                مكافأة Spin
              </Text>

              <Text
                style={
                  styles.spinDiscountValue
                }
              >
                -{formatPrice(
                  activeSpinSavings,
                )}
              </Text>
            </View>
          ) : null}

          {hasFutureSpinReward ? (
            <View
              style={
                styles.spinFutureRewardCard
              }
            >
              <View
                style={
                  styles.spinFutureRewardIcon
                }
              >
                <Ionicons
                  name="gift-outline"
                  size={17}
                  color={
                    BRAND_GREEN_DARK
                  }
                />
              </View>

              <View
                style={
                  styles.spinFutureRewardCopy
                }
              >
                <Text
                  style={
                    styles.spinFutureRewardTitle
                  }
                >
                  {checkoutSpin
                    ?.rewardValue ?? 0}
                  ج للطلب الجاي
                </Text>

                <Text
                  style={
                    styles.spinFutureRewardText
                  }
                >
                  محفوظة للطلب القادم
                  {checkoutSpin
                    ?.minimumNextOrder
                    ? ` عند طلب ${checkoutSpin.minimumNextOrder}ج أو أكتر`
                    : ''}
                  . لا تُخصم من هذا الطلب.
                </Text>
              </View>
            </View>
          ) : null}

          {spinStatusError ? (
            <View
              style={
                styles.spinStatusNotice
              }
            >
              <Ionicons
                name="information-circle-outline"
                size={15}
                color="#8A6519"
              />

              <Text
                style={
                  styles.spinStatusNoticeText
                }
              >
                {spinStatusError}
              </Text>
            </View>
          ) : null}

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
        style={[
          styles.submitBarWrapper,
          {
            paddingBottom: Math.max(
              insets.bottom,
              18,
            ),
          },
        ]}
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
              (
                isSubmittingOrder ||
                isLoadingSpinStatus
              ) &&
                styles.submitButtonDisabled,
              pressed &&
                !isSubmittingOrder &&
                !isLoadingSpinStatus &&
                styles.submitButtonPressed,
            ]}
            disabled={
              isSubmittingOrder ||
              isLoadingSpinStatus
            }
            onPress={
              submitOrder
            }
          >
            {isSubmittingOrder ||
            isLoadingSpinStatus ? (
              <ActivityIndicator
                size="small"
                color="#ffffff"
              />
            ) : null}

            <Text
              style={
                styles.submitButtonText
              }
              numberOfLines={1}
            >
              {isLoadingSpinStatus
                ? 'تحديث المكافأة...'
                : 'متابعة'}
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
      backgroundColor: '#ffffff',
      flex: 1,
    },

    mainScrollView: {
      flex: 1,
    },

    pageContent: {
      paddingBottom: 114,
    },

    header: {
      alignItems: 'center',
      backgroundColor: '#ffffff',
      flexDirection: 'row',
      flexShrink: 0,
      paddingBottom: 14,
      paddingHorizontal: 18,
      paddingTop: 48,
      position: 'relative',
      zIndex: 100,

      shadowColor: '#000000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.025,
      shadowRadius: 4,
      elevation: 2,
    },

    backButton: {
      alignItems: 'center',
      backgroundColor: '#ffffff',
      borderColor: '#e5e5e5',
      borderRadius: 22,
      borderWidth: 1,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },

    headerContent: {
      flex: 1,
      marginLeft: 12,
    },

    pageTitle: {
      color: '#202020',
      fontSize: 18,
      fontWeight: '800',
    },

    pageSubtitle: {
      color: '#8a8a8a',
      fontSize: 11,
      marginTop: 2,
    },

    orderStoreSection: {
      alignItems: 'center',
      backgroundColor: '#F7FBF8',
      borderColor: '#E2EEE7',
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row-reverse',
      marginBottom: 2,
      marginHorizontal: 18,
      marginTop: 10,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },

    storeIconContainer: {
      alignItems: 'center',
      backgroundColor: '#ffffff',
      borderColor: '#E5ECE8',
      borderRadius: 13,
      borderWidth: 1,
      height: 52,
      justifyContent: 'center',
      overflow: 'hidden',
      width: 52,
    },

    storeImage: {
      height: '100%',
      width: '100%',
    },

    storeIcon: {
      fontSize: 22,
    },

    storeContent: {
      flex: 1,
      marginRight: 12,
    },

    storeLabel: {
      color: '#638370',
      fontSize: 10.5,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    storeName: {
      color: '#242424',
      fontSize: 14.5,
      fontWeight: '800',
      marginTop: 3,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    storeMeta: {
      color: '#818181',
      fontSize: 10.5,
      marginTop: 3,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    section: {
      backgroundColor: '#ffffff',
      paddingBottom: 20,
      paddingHorizontal: 24,
      paddingTop: 24,
    },

    sectionTitle: {
      color: '#242424',
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: -0.4,
      lineHeight: 28,
      marginBottom: 16,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    sectionDescription: {
      color: '#777777',
      fontSize: 11.5,
      lineHeight: 18,
      marginBottom: 14,
      marginTop: -8,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    field: {
      marginBottom: 14,
    },

    fieldLabel: {
      color: '#373737',
      fontSize: 12.5,
      fontWeight: '700',
      marginBottom: 7,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    inputContainer: {
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderColor: '#DCDCDC',
      borderRadius: 16,
      borderWidth: 1.2,
      flexDirection: 'row-reverse',
      minHeight: 54,
      paddingHorizontal: 15,
    },

    inputContainerError: {
      borderColor: '#d64b4b',
    },

    input: {
      color: '#242424',
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      minHeight: 50,
      paddingHorizontal: 12,
      paddingVertical: 12,
      textAlign: 'right',
      writingDirection: 'rtl',
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
      color: '#D64B4B',
      fontSize: 10.5,
      lineHeight: 16,
      marginTop: 7,
      textAlign: 'right',
      writingDirection: 'rtl',
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
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: 'row-reverse',
      paddingHorizontal: 14,
      paddingVertical: 12,
    },

    ageVerificationCopy: {
      flex: 1,
      marginRight: 10,
    },

    ageVerificationTitle: {
      color: '#5D3B13',
      fontSize: 12.5,
      fontWeight: '800',
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    ageVerificationText: {
      color: '#806543',
      fontSize: 10.5,
      lineHeight: 17,
      marginTop: 4,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    paymentMethods: {
      gap: 10,
    },

    paymentMethod: {
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderColor: '#DCDCDC',
      borderRadius: 16,
      borderWidth: 1.2,
      flexDirection: 'row-reverse',
      minHeight: 60,
      paddingHorizontal: 13,
      paddingVertical: 9,
    },

    paymentMethodSelected: {
      backgroundColor: BRAND_GREEN_SOFT,
      borderColor: BRAND_GREEN,
      borderWidth: 1.4,
    },

    paymentMethodPressed: {
      opacity: 0.76,
    },

    paymentIconContainer: {
      alignItems: 'center',
      backgroundColor: '#ffffff',
      borderColor: '#EDF0EE',
      borderRadius: 12,
      borderWidth: 1,
      height: 40,
      justifyContent: 'center',
      overflow: 'hidden',
      width: 40,
    },

    paymentMethodImage: {
      height: '100%',
      width: '100%',
    },

    paymentIcon: {
      fontSize: 19,
    },

    paymentContent: {
      flex: 1,
      marginHorizontal: 12,
    },

    paymentTitle: {
      color: '#262626',
      fontSize: 13.5,
      fontWeight: '700',
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    radioOuter: {
      alignItems: 'center',
      borderColor: '#B7B7B7',
      borderRadius: 9,
      borderWidth: 1.8,
      height: 18,
      justifyContent: 'center',
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
      color: '#D64B4B',
      fontSize: 10.5,
      marginTop: 9,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    orderSummarySection: {
      backgroundColor: '#ffffff',
      paddingBottom: 24,
      paddingHorizontal: 24,
      paddingTop: 30,
    },

    orderSummaryTitle: {
      color: '#242424',
      fontSize: 21,
      fontWeight: '900',
      letterSpacing: -0.45,
      lineHeight: 29,
      marginBottom: 20,
      textAlign: 'right',
      writingDirection: 'rtl',
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
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      minHeight: 32,
    },

    summaryLabel: {
      color: '#313131',
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 19,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    summaryValue: {
      color: '#303030',
      fontSize: 13,
      fontWeight: '500',
      minWidth: 82,
      textAlign: 'left',
      writingDirection: 'ltr',
    },

    discountLabel: {
      color: BRAND_GREEN,
      fontSize: 12.5,
      fontWeight: '700',
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    discountValue: {
      color: BRAND_GREEN,
      fontSize: 12.5,
      fontWeight: '800',
      minWidth: 82,
      textAlign: 'left',
      writingDirection: 'ltr',
    },

    spinDiscountLabel: {
      color: BRAND_GREEN,
      fontSize: 12.5,
      fontWeight: '800',
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    spinDiscountValue: {
      color: BRAND_GREEN,
      fontSize: 12.5,
      fontWeight: '900',
      minWidth: 82,
      textAlign: 'left',
      writingDirection: 'ltr',
    },

    spinFutureRewardCard: {
      alignItems: 'center',
      backgroundColor: BRAND_GREEN_SOFT,
      borderColor: '#D5F0E0',
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: 'row-reverse',
      marginBottom: 16,
      marginTop: 8,
      paddingHorizontal: 13,
      paddingVertical: 11,
    },

    spinFutureRewardIcon: {
      alignItems: 'center',
      backgroundColor: '#ffffff',
      borderRadius: 17,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },

    spinFutureRewardCopy: {
      flex: 1,
      marginRight: 10,
    },

    spinFutureRewardTitle: {
      color: '#175F37',
      fontSize: 12.5,
      fontWeight: '800',
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    spinFutureRewardText: {
      color: '#64806F',
      fontSize: 10.5,
      lineHeight: 17,
      marginTop: 3,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    spinStatusNotice: {
      alignItems: 'center',
      backgroundColor: '#FFF8EB',
      borderColor: '#F0D8AE',
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row-reverse',
      gap: 7,
      marginBottom: 16,
      marginTop: 8,
      paddingHorizontal: 11,
      paddingVertical: 9,
    },

    spinStatusNoticeText: {
      color: '#806543',
      flex: 1,
      fontSize: 10.5,
      lineHeight: 16,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    summaryDivider: {
      backgroundColor: '#EEEEEE',
      height: 1,
      marginBottom: 6,
      marginTop: 14,
    },

    totalRow: {
      alignItems: 'center',
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      marginTop: 14,
      minHeight: 42,
    },

    totalLabel: {
      color: '#202020',
      fontSize: 16.5,
      fontWeight: '900',
      lineHeight: 23,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    totalValue: {
      color: BRAND_GREEN,
      fontSize: 18,
      fontWeight: '900',
      minWidth: 94,
      textAlign: 'left',
      writingDirection: 'ltr',
    },

    submitBarWrapper: {
      backgroundColor: '#ffffff',
      borderTopColor: '#e8e8e8',
      borderTopWidth: 1,
      bottom: 0,
      left: 0,
      paddingBottom: 14,
      paddingHorizontal: 18,
      paddingTop: 12,
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
      flexDirection: 'row-reverse',
      gap: 10,
    },

    backToCartButton: {
      alignItems: 'center',
      backgroundColor: '#ffffff',
      borderColor: '#252525',
      borderRadius: 25,
      borderWidth: 1.5,
      flex: 1,
      height: 52,
      justifyContent: 'center',
    },

    backToCartButtonText: {
      color: '#242424',
      fontSize: 14.5,
      fontWeight: '800',
    },

    submitButton: {
      alignItems: 'center',
      backgroundColor: BRAND_GREEN,
      borderRadius: 25,
      flex: 1,
      flexDirection: 'row-reverse',
      gap: 7,
      height: 52,
      justifyContent: 'center',
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
      fontSize: 14.5,
      fontWeight: '800',
    },

    bottomButtonPressed: {
      opacity: 0.88,
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
      backgroundColor: '#ffffff',
      borderColor: '#e4e4e4',
      borderRadius: 22,
      borderWidth: 1,
      height: 44,
      justifyContent: 'center',
      left: 20,
      position: 'absolute',
      top: 48,
      width: 44,
      zIndex: 5,
    },

    emptyIconContainer: {
      alignItems: 'center',
      backgroundColor: BRAND_GREEN_SOFT,
      borderRadius: 34,
      height: 68,
      justifyContent: 'center',
      width: 68,
    },

    errorIconContainer: {
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor: '#fff1f1',
      borderRadius: 40,
      height: 80,
      justifyContent: 'center',
      marginTop: 'auto',
      width: 80,
    },

    emptyTitle: {
      color: '#242424',
      fontSize: 18,
      fontWeight: '800',
      marginTop: 15,
      textAlign: 'center',
    },

    emptyDescription: {
      alignSelf: 'center',
      color: '#7c7c7c',
      fontSize: 11,
      lineHeight: 17,
      marginTop: 7,
      maxWidth: 310,
      textAlign: 'center',
    },

    primaryButton: {
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor: BRAND_GREEN,
      borderRadius: 23,
      marginBottom: 'auto',
      marginTop: 18,
      minWidth: 174,
      paddingHorizontal: 22,
      paddingVertical: 12,
    },

    primaryButtonText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '800',
    },

    buttonPressed: {
      opacity: 0.7,
    },
  });

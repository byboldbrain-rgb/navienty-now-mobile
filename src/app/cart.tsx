import { Ionicons } from '@expo/vector-icons';
import {
  Stack,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  type CatalogProduct,
  type StoreCatalog,
  getStoreCatalog,
} from '../services/catalog-service';

import {
  ensureAppSession,
} from '../services/anonymous-auth-service';
import {
  validateVoucher,
} from '../services/voucher-service';

import ServicePackageCart from '../components/service/service-package-cart';
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
  useVoucherStore,
} from '../store/voucher-store';

const BRAND_GREEN = '#00B14F';
const BRAND_GREEN_SOFT = '#EAF8F0';

/**
 * Electronic payment fee remains fixed for now.
 * Delivery fee is store/area-specific and comes from the cart/catalog.
 */
const FIXED_PAYMENT_PROCESSING_FEE = 10;

/**
 * Multi-cart bottom sheet swipe-to-dismiss settings.
 */
const CART_PICKER_CLOSE_DISTANCE = 95;
const CART_PICKER_CLOSE_VELOCITY = 0.75;
const CART_PICKER_OFFSCREEN_Y = 900;

/**
 * Keep route options referentially stable.
 * Recreating modal options during every render can cause unnecessary
 * navigation updates while the cart screen is mounted.
 */
const CART_SCREEN_OPTIONS = {
  headerShown: false,
  presentation: 'transparentModal' as const,
  contentStyle: {
    backgroundColor: 'transparent',
  },
};

function getSingleParam(
  value:
    | string
    | string[]
    | undefined,
) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

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

function getProductImage(
  product: CatalogProduct | null | undefined,
): string | null {
  if (!product) {
    return null;
  }

  if (isImageUri(product.imageUrl)) {
    return product.imageUrl;
  }

  const coverImage = product.images?.find(
    (image) =>
      image.isCover &&
      isImageUri(image.imageUrl),
  );

  if (coverImage) {
    return coverImage.imageUrl;
  }

  const firstImage = product.images?.find(
    (image) => isImageUri(image.imageUrl),
  );

  return firstImage?.imageUrl ?? null;
}

function getProductDisplayPrice(
  product: CatalogProduct,
) {
  if (
    !product.variants ||
    product.variants.length === 0
  ) {
    return Number(product.price ?? 0);
  }

  return Math.min(
    ...product.variants.map(
      (variant) => Number(variant.price ?? 0),
    ),
  );
}

function getCartItemCount(
  items: Array<{ quantity: number }>,
) {
  return items.reduce(
    (total, item) =>
      total + Number(item.quantity ?? 0),
    0,
  );
}

function getCartSubtotal(
  items: Array<{
    price: number;
    quantity: number;
  }>,
) {
  return items.reduce(
    (total, item) =>
      total +
      Number(item.price ?? 0) *
        Number(item.quantity ?? 0),
    0,
  );
}

function formatCartItemCount(
  count: number,
) {
  if (count === 1) {
    return 'صنف واحد';
  }

  if (count === 2) {
    return 'صنفان';
  }

  return `${count} أصناف`;
}

export default function CartScreen() {
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
      <ServicePackageCart
        servicePackageId={
          servicePackageId
        }
      />
    );
  }

  return <StoreCartScreen />;
}

function StoreCartScreen() {
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

  const [
    selectedStoreId,
    setSelectedStoreId,
  ] = useState<string | null>(null);

  const [
    clearModalVisible,
    setClearModalVisible,
  ] = useState(false);

  const [
    catalog,
    setCatalog,
  ] = useState<StoreCatalog | null>(null);

  const [
    failedImages,
    setFailedImages,
  ] = useState<Record<string, boolean>>(
    {},
  );

  const [
    storeImages,
    setStoreImages,
  ] = useState<Record<string, string | null>>(
    {},
  );

  const [
    failedStoreImages,
    setFailedStoreImages,
  ] = useState<Record<string, boolean>>(
    {},
  );

  /**
   * Interactive Y position for the multi-cart sheet.
   * 0 = open. Positive values move it down with the finger.
   */
  const cartPickerTranslateY = useRef(
    new Animated.Value(0),
  ).current;

  const cartPickerIsClosing = useRef(false);

  /* ============================================================
   * MULTI CART STATE
   * ============================================================
   */

  const carts = useCartStore(
    (state) => state.carts,
  );

  const addItem = useCartStore(
    (state) => state.addItem,
  );

  const setActiveCart = useCartStore(
    (state) => state.setActiveCart,
  );

  const increaseStoreItem = useCartStore(
    (state) => state.increaseStoreItem,
  );

  const decreaseStoreItem = useCartStore(
    (state) => state.decreaseStoreItem,
  );

  const removeStoreItem = useCartStore(
    (state) => state.removeStoreItem,
  );

  const clearStoreCart = useCartStore(
    (state) => state.clearStoreCart,
  );

  const availableCarts = useMemo(
    () =>
      Object.values(carts).filter(
        (cart) => cart.items.length > 0,
      ),
    [carts],
  );

  const hasMultipleCarts =
    availableCarts.length > 1;

  function restoreCartPickerPosition() {
    cartPickerIsClosing.current = false;

    Animated.spring(
      cartPickerTranslateY,
      {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 240,
        mass: 0.9,
      },
    ).start();
  }

  function closeCartPicker() {
    if (cartPickerIsClosing.current) {
      return;
    }

    cartPickerIsClosing.current = true;

    Animated.timing(
      cartPickerTranslateY,
      {
        toValue: CART_PICKER_OFFSCREEN_Y,
        duration: 210,
        useNativeDriver: true,
      },
    ).start(({ finished }) => {
      if (!finished) {
        cartPickerIsClosing.current = false;
        return;
      }

      router.back();
    });
  }

  /**
   * The responder lives on the sheet's handle/header area.
   * This is intentionally separate from the ScrollView so the
   * cart list keeps its normal scrolling/press behaviour.
   */
  const cartPickerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,

        onMoveShouldSetPanResponder: (
          _,
          gestureState,
        ) => {
          const verticalMovement =
            Math.abs(gestureState.dy) >
            Math.abs(gestureState.dx);

          return (
            verticalMovement &&
            gestureState.dy > 3
          );
        },

        onMoveShouldSetPanResponderCapture: (
          _,
          gestureState,
        ) => {
          const verticalMovement =
            Math.abs(gestureState.dy) >
            Math.abs(gestureState.dx);

          return (
            verticalMovement &&
            gestureState.dy > 3
          );
        },

        onPanResponderGrant: () => {
          cartPickerTranslateY.stopAnimation();
        },

        onPanResponderMove: (
          _,
          gestureState,
        ) => {
          cartPickerTranslateY.setValue(
            Math.max(gestureState.dy, 0),
          );
        },

        onPanResponderRelease: (
          _,
          gestureState,
        ) => {
          const shouldClose =
            gestureState.dy >=
              CART_PICKER_CLOSE_DISTANCE ||
            gestureState.vy >=
              CART_PICKER_CLOSE_VELOCITY;

          if (shouldClose) {
            closeCartPicker();
            return;
          }

          restoreCartPickerPosition();
        },

        onPanResponderTerminate: () => {
          restoreCartPickerPosition();
        },

        onPanResponderTerminationRequest:
          () => false,
      }),
    [cartPickerTranslateY],
  );

  /**
   * Reset the sheet whenever the chooser becomes visible again.
   */
  useEffect(() => {
    if (
      hasMultipleCarts &&
      !selectedStoreId
    ) {
      cartPickerIsClosing.current = false;
      cartPickerTranslateY.setValue(0);
    }
  }, [
    cartPickerTranslateY,
    hasMultipleCarts,
    selectedStoreId,
  ]);

  /**
   * IMPORTANT:
   * Do not synchronize the active cart from an effect while this screen
   * is opening. This route is presented as a transparent modal, so the
   * previous screen can still be mounted underneath it. If both screens
   * try to keep `activeStoreId` in sync, they can bounce Zustand updates
   * between each other and React eventually throws
   * "Maximum update depth exceeded".
   *
   * Instead, derive the cart that should be displayed without writing to
   * Zustand. `setActiveCart` is only called from explicit user actions
   * such as choosing a cart, continuing shopping, or checking out.
   */
  const singleCartStoreId =
    availableCarts.length === 1
      ? availableCarts[0].storeId
      : null;

  const validSelectedStoreId =
    selectedStoreId &&
    carts[selectedStoreId] &&
    carts[selectedStoreId].items.length > 0
      ? selectedStoreId
      : null;

  const requestedCartStoreId =
    !hasMultipleCarts &&
    requestedStoreId &&
    carts[requestedStoreId] &&
    carts[requestedStoreId].items.length > 0
      ? requestedStoreId
      : null;

  const resolvedStoreId =
    validSelectedStoreId ??
    requestedCartStoreId ??
    singleCartStoreId;

  const currentCart = resolvedStoreId
    ? carts[resolvedStoreId] ?? null
    : null;

  const items =
    currentCart?.items ?? [];

  const storeId =
    currentCart?.storeId ?? null;

  const phoneNumber =
    useCustomerStore(
      (state) => state.phoneNumber,
    );

  const normalizedPhone =
    phoneNumber.replace(
      /\D/g,
      '',
    );

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

  const clearVoucher =
    useVoucherStore(
      (state) => state.clearVoucher,
    );

  const orderNotes =
    useOrderNotesStore(
      (state) =>
        storeId
          ? state.notes[storeId] ??
            ''
          : '',
    );

  const setOrderNote =
    useOrderNotesStore(
      (state) => state.setNote,
    );

  const clearOrderNotes =
    useOrderNotesStore(
      (state) => state.clearNote,
    );

  const [
    noteEditorVisible,
    setNoteEditorVisible,
  ] = useState(false);

  const [
    draftOrderNote,
    setDraftOrderNote,
  ] = useState('');

  const noteInputRef =
    useRef<TextInput>(null);

  const [
    voucherCode,
    setVoucherCode,
  ] = useState('');

  const [
    voucherError,
    setVoucherError,
  ] = useState<string | null>(null);

  const [
    isApplyingVoucher,
    setIsApplyingVoucher,
  ] = useState(false);

  const storeName =
    currentCart?.storeName ?? null;

  const storeIcon =
    currentCart?.storeIcon ?? null;

  const minimumOrder =
    currentCart?.minimumOrder ?? 0;

  const subtotal = useMemo(
    () => getCartSubtotal(items),
    [items],
  );

  const paymentProcessingFee =
    FIXED_PAYMENT_PROCESSING_FEE;

  const deliveryFee =
    Number(currentCart?.deliveryFee ?? 0);

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

  const grandTotal =
    discountedSubtotal +
    discountedDeliveryFee +
    paymentProcessingFee;

  useEffect(() => {
    setVoucherCode(
      appliedVoucher?.code ?? '',
    );
    setVoucherError(null);
  }, [storeId]);

  useEffect(() => {
    if (appliedVoucher?.code) {
      setVoucherCode(
        appliedVoucher.code,
      );
    }
  }, [appliedVoucher?.code]);

  useEffect(() => {
    if (
      !appliedVoucher ||
      !storeId
    ) {
      return;
    }

    const subtotalChanged =
      Math.abs(
        appliedVoucher
          .subtotalBeforeDiscount -
          subtotal,
      ) > 0.009;

    const deliverySnapshot =
      appliedVoucher
        .deliveryFeeBeforeDiscount;

    const deliveryChanged =
      deliverySnapshot !== null &&
      deliverySnapshot !== undefined &&
      Math.abs(
        deliverySnapshot -
          deliveryFee,
      ) > 0.009;

    if (
      !subtotalChanged &&
      !deliveryChanged
    ) {
      return;
    }

    setStoreVoucher(
      storeId,
      null,
    );

    setVoucherError(
      'تغيّرت السلة. أرسل رمز القسيمة مرة أخرى.',
    );
  }, [
    appliedVoucher,
    deliveryFee,
    setStoreVoucher,
    storeId,
    subtotal,
  ]);

  /* ============================================================
   * LOAD STORE LOGOS FOR MULTI-CART CHOOSER
   * ============================================================
   */

  useEffect(() => {
    let cancelled = false;

    async function loadStoreImages() {
      if (
        availableCarts.length === 0
      ) {
        if (!cancelled) {
          setStoreImages({});
        }

        return;
      }

      const nextImages: Record<
        string,
        string | null
      > = {};

      await Promise.all(
        availableCarts.map(
          async (cart) => {
            if (
              isImageUri(
                cart.storeIcon,
              )
            ) {
              nextImages[
                cart.storeId
              ] = cart.storeIcon;

              return;
            }

            try {
              const loadedCatalog =
                await getStoreCatalog(
                  cart.storeId,
                );

              const imageUrl =
                loadedCatalog.store.logoUrl ??
                loadedCatalog.store
                  .coverImageUrl ??
                null;

              nextImages[
                cart.storeId
              ] = isImageUri(imageUrl)
                ? imageUrl
                : null;
            } catch {
              nextImages[
                cart.storeId
              ] = null;
            }
          },
        ),
      );

      if (!cancelled) {
        setStoreImages(
          nextImages,
        );
      }
    }

    void loadStoreImages();

    return () => {
      cancelled = true;
    };
  }, [availableCarts]);

  /* ============================================================
   * LOAD SELECTED STORE CATALOG
   * ============================================================
   */

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      if (!storeId) {
        setCatalog(null);

        return;
      }

      try {
        const loadedCatalog =
          await getStoreCatalog(storeId);

        if (!cancelled) {
          setCatalog(loadedCatalog);
        }
      } catch {
        if (!cancelled) {
          setCatalog(null);
        }
      }
    }

    void loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const catalogProducts = useMemo(() => {
    if (!catalog) {
      return [];
    }

    return catalog.sections.flatMap(
      (section) => section.products,
    );
  }, [catalog]);

  const productsById = useMemo(() => {
    const productMap =
      new Map<string, CatalogProduct>();

    catalogProducts.forEach((product) => {
      productMap.set(
        product.id,
        product,
      );
    });

    return productMap;
  }, [catalogProducts]);

  const recommendations = useMemo(() => {
    const cartProductIds = new Set(
      items.map((item) => item.id),
    );

    return catalogProducts
      .filter(
        (product) =>
          !cartProductIds.has(product.id),
      )
      .slice(0, 8);
  }, [
    catalogProducts,
    items,
  ]);

  const remainingForMinimum = Math.max(
    Number(minimumOrder ?? 0) -
      Number(subtotal ?? 0),
    0,
  );

  const minimumReached =
    items.length > 0 &&
    Number(subtotal ?? 0) >=
      Number(minimumOrder ?? 0);

  function formatPrice(
    value:
      | number
      | string
      | null
      | undefined,
  ) {
    const numericValue =
      Number(value ?? 0);

    if (
      Number.isInteger(numericValue)
    ) {
      return `EGP ${numericValue}`;
    }

    return `EGP ${numericValue.toFixed(
      2,
    )}`;
  }

  function formatCartSelectorPrice(
    value:
      | number
      | string
      | null
      | undefined,
  ) {
    const numericValue =
      Number(value ?? 0);

    return `${numericValue.toFixed(
      2,
    )} ج.م`;
  }

  function formatSummaryAmount(
    value:
      | number
      | string
      | null
      | undefined,
  ) {
    const numericValue =
      Number(value ?? 0);

    return numericValue.toFixed(2);
  }

  function openOrderNoteEditor() {
    setDraftOrderNote(
      orderNotes,
    );
    setNoteEditorVisible(true);
  }

  function closeOrderNoteEditor() {
    setNoteEditorVisible(false);
  }

  function handleDraftOrderNoteChange(
    value: string,
  ) {
    const nextValue =
      value.slice(0, 200);

    setDraftOrderNote(
      nextValue,
    );

    if (!storeId) {
      return;
    }

    setOrderNote(
      storeId,
      nextValue,
    );
  }

  function handleVoucherCodeChange(
    nextCode: string,
  ) {
    const normalizedCode =
      nextCode
        .replace(/\s+/g, '')
        .toUpperCase()
        .slice(0, 32);

    setVoucherCode(
      normalizedCode,
    );
    setVoucherError(null);

    if (
      storeId &&
      appliedVoucher &&
      normalizedCode !==
        appliedVoucher.code
    ) {
      setStoreVoucher(
        storeId,
        null,
      );
    }
  }

  function removeAppliedVoucher() {
    if (!storeId) {
      return;
    }

    setStoreVoucher(
      storeId,
      null,
    );
    setVoucherCode('');
    setVoucherError(null);
  }

  async function applyCartVoucher() {
    if (
      isApplyingVoucher ||
      !storeId
    ) {
      return;
    }

    const normalizedCode =
      voucherCode
        .trim()
        .toUpperCase();

    if (
      normalizedCode.length < 3
    ) {
      setVoucherError(
        'اكتب رمز القسيمة أولًا.',
      );
      setStoreVoucher(
        storeId,
        null,
      );
      return;
    }

    try {
      setIsApplyingVoucher(true);
      setVoucherError(null);

      await ensureAppSession();

      const quote =
        await validateVoucher({
          code:
            normalizedCode,
          storeId,
          subtotal,
          deliveryFee,
          customerPhone:
            normalizedPhone ||
            null,
        });

      setVoucherCode(
        quote.code,
      );

      setStoreVoucher(
        storeId,
        quote,
      );
    } catch (error) {
      setStoreVoucher(
        storeId,
        null,
      );

      setVoucherError(
        error instanceof Error
          ? error.message
          : 'تعذر تطبيق رمز القسيمة.',
      );
    } finally {
      setIsApplyingVoucher(false);
    }
  }

  function markImageAsFailed(
    imageUrl: string,
  ) {
    setFailedImages(
      (current) => ({
        ...current,
        [imageUrl]: true,
      }),
    );
  }

  function markStoreImageAsFailed(
    storeIdToMark: string,
  ) {
    setFailedStoreImages(
      (current) => ({
        ...current,
        [storeIdToMark]: true,
      }),
    );
  }

  function canDisplayImage(
    imageUrl: string | null,
  ) {
    return (
      !!imageUrl &&
      !failedImages[imageUrl]
    );
  }

  function handleSelectCart(
    nextStoreId: string,
  ) {
    setActiveCart(
      nextStoreId,
    );

    setSelectedStoreId(
      nextStoreId,
    );
  }

  function handleBack() {
    if (
      hasMultipleCarts &&
      selectedStoreId
    ) {
      setSelectedStoreId(null);

      return;
    }

    router.back();
  }

  function handleClearCart() {
    if (!storeId) {
      return;
    }

    clearVoucher(storeId);
    clearOrderNotes(storeId);
    clearStoreCart(storeId);

    setClearModalVisible(false);
    setSelectedStoreId(null);
  }

  function continueShopping() {
    if (storeId) {
      setActiveCart(storeId);

      router.replace({
        pathname: '/store/[id]',
        params: {
          id: storeId,
        },
      });

      return;
    }

    router.replace('/');
  }

  function handleCheckout() {
    if (
      !minimumReached ||
      !storeId
    ) {
      return;
    }

    setActiveCart(storeId);

    /**
     * Guest checkout is allowed.
     *
     * The app creates a persistent anonymous Supabase
     * session in the root layout, so checkout does not
     * require a visible Login step.
     */

    /**
     * Delivery location is required before checkout.
     *
     * The customer always sees the map first. The selected coordinates
     * and reverse-geocoded address are saved in customer-store, then
     * location-picker forwards the customer to checkout.
     */
    router.push({
      pathname: '/location-picker',
      params: {
        storeId,

        source: 'cart',

        paymentProcessingFee:
          paymentProcessingFee.toFixed(2),

        deliveryFee:
          deliveryFee.toFixed(2),

        grandTotal:
          grandTotal.toFixed(2),
      },
    });
  }

  function addRecommendation(
    product: CatalogProduct,
  ) {
    if (
      !currentCart ||
      !storeId ||
      !storeName
    ) {
      return;
    }

    if (
      product.variants &&
      product.variants.length > 0
    ) {
      continueShopping();

      return;
    }

    addItem(
      {
        id: storeId,
        name: storeName,
        icon: storeIcon ?? '🏪',
        categorySlug:
          currentCart.categorySlug,
        deliveryFee:
          Number(currentCart.deliveryFee ?? 0),
        minimumOrder:
          Number(minimumOrder ?? 0),
      },
      {
        id: product.id,
        name: product.name,
        description:
          product.description,
        price:
          Number(product.price ?? 0),
        icon: product.icon,
        variantId: null,
        variantName: null,
      },
    );
  }

  /* ============================================================
   * EMPTY STATE
   * ============================================================
   */

  if (availableCarts.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Stack.Screen options={CART_SCREEN_OPTIONS} />

        <Pressable
          style={({ pressed }) => [
            styles.emptyBackButton,

            pressed &&
              styles.buttonPressed,
          ]}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color="#222222"
          />
        </Pressable>

        <View
          style={styles.emptyContainer}
        >
          <View
            style={
              styles.emptyIconContainer
            }
          >
            <Ionicons
              name="cart-outline"
              size={36}
              color={BRAND_GREEN}
            />
          </View>

          <Text
            style={styles.emptyTitle}
          >
            السلة فارغة
          </Text>

          <Text
            style={
              styles.emptyDescription
            }
          >
            لم تضف أي منتجات إلى طلبك
            حتى الآن.
          </Text>

          <Pressable
            style={({ pressed }) => [
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
              ابدأ التسوق
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  /* ============================================================
   * MULTI-CART CHOOSER
   *
   * Appears automatically when the customer has products from
   * more than one place.
   * ============================================================
   */

  if (
    hasMultipleCarts &&
    !validSelectedStoreId
  ) {
    return (
      <View
        style={styles.cartPickerScreen}
      >
        <Stack.Screen options={CART_SCREEN_OPTIONS} />

        <Pressable
          style={styles.cartPickerBackdrop}
          onPress={closeCartPicker}
        />

        <Animated.View
          style={[
            styles.cartPickerSheet,
            {
              transform: [
                {
                  translateY:
                    cartPickerTranslateY,
                },
              ],
            },
          ]}
        >
          <View
            {...cartPickerPanResponder.panHandlers}
            style={styles.sheetDragArea}
          >
            <View
              style={styles.sheetHandle}
            />

            <View
              style={styles.sheetTopRow}
            >
              <Pressable
                accessibilityLabel="إغلاق"
                hitSlop={10}
                style={({ pressed }) => [
                  styles.sheetCloseButton,

                  pressed &&
                    styles.sheetCloseButtonPressed,
                ]}
                onPress={closeCartPicker}
              >
                <Ionicons
                  name="close"
                  size={23}
                  color="#171717"
                />
              </Pressable>
            </View>

            <Text
              style={styles.cartPickerTitle}
            >
              جميع سلات التسوق
            </Text>
          </View>

          <ScrollView
            style={styles.cartPickerList}
            contentContainerStyle={
              styles.cartPickerListContent
            }
            showsVerticalScrollIndicator={
              false
            }
          >
            {availableCarts.map(
              (cart, index) => {
                const itemCount =
                  getCartItemCount(
                    cart.items,
                  );

                const cartSubtotal =
                  getCartSubtotal(
                    cart.items,
                  );

                const storeImage =
                  storeImages[
                    cart.storeId
                  ] ?? null;

                const displayStoreImage =
                  !!storeImage &&
                  !failedStoreImages[
                    cart.storeId
                  ];

                const isLast =
                  index ===
                  availableCarts.length - 1;

                return (
                  <Pressable
                    key={cart.storeId}
                    style={({ pressed }) => [
                      styles.cartPickerRow,

                      !isLast &&
                        styles.cartPickerRowBorder,

                      pressed &&
                        styles.cartPickerRowPressed,
                    ]}
                    onPress={() =>
                      handleSelectCart(
                        cart.storeId,
                      )
                    }
                  >
                    <View
                      style={
                        styles.cartPickerLogoBox
                      }
                    >
                      {displayStoreImage ? (
                        <Image
                          source={{
                            uri: storeImage!,
                          }}
                          style={
                            styles.cartPickerLogo
                          }
                          resizeMode="cover"
                          onError={() =>
                            markStoreImageAsFailed(
                              cart.storeId,
                            )
                          }
                        />
                      ) : isImageUri(
                          cart.storeIcon,
                        ) &&
                        !failedStoreImages[
                          cart.storeId
                        ] ? (
                        <Image
                          source={{
                            uri: cart.storeIcon,
                          }}
                          style={
                            styles.cartPickerLogo
                          }
                          resizeMode="cover"
                          onError={() =>
                            markStoreImageAsFailed(
                              cart.storeId,
                            )
                          }
                        />
                      ) : (
                        <Text
                          style={
                            styles.cartPickerLogoFallback
                          }
                        >
                          {cart.storeIcon ||
                            '🏪'}
                        </Text>
                      )}
                    </View>

                    <View
                      style={
                        styles.cartPickerStoreContent
                      }
                    >
                      <Text
                        style={
                          styles.cartPickerStoreName
                        }
                        numberOfLines={1}
                      >
                        {cart.storeName}
                      </Text>

                      <Text
                        style={
                          styles.cartPickerItemCount
                        }
                        numberOfLines={1}
                      >
                        {formatCartItemCount(
                          itemCount,
                        )}
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.cartPickerPrice
                      }
                      numberOfLines={1}
                    >
                      {formatCartSelectorPrice(
                        cartSubtotal,
                      )}
                    </Text>
                  </Pressable>
                );
              },
            )}
          </ScrollView>

          

          
        </Animated.View>
      </View>
    );
  }

  /* ============================================================
   * SELECTED CART DETAILS
   * ============================================================
   */

  if (!currentCart) {
    return null;
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={CART_SCREEN_OPTIONS} />

      {/* STICKY HEADER */}

      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [
            styles.backButton,

            pressed &&
              styles.buttonPressed,
          ]}
          onPress={handleBack}
        >
          <Ionicons
            name="arrow-back"
            size={23}
            color="#262626"
          />
        </Pressable>

        <View
          style={styles.headerContent}
        >
          <Text
            style={styles.pageTitle}
          >
            سلة المشتريات
          </Text>

          {hasMultipleCarts ? (
            <Text
              style={
                styles.headerStoreName
              }
              numberOfLines={1}
            >
              {storeName}
            </Text>
          ) : null}
        </View>

        <Pressable
          hitSlop={10}
          style={({ pressed }) => [
            styles.clearCartButton,

            pressed &&
              styles.buttonPressed,
          ]}
          onPress={() =>
            setClearModalVisible(true)
          }
        >
          <Text
            style={
              styles.clearCartButtonText
            }
          >
            إفراغ السلة
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={
          styles.mainScrollView
        }
        contentContainerStyle={
          styles.pageContent
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* ITEMS */}

        <View style={styles.itemsSection}>
          {items.map(
            (item, index) => {
              const catalogProduct =
                productsById.get(item.id);

              const imageUrl =
                getProductImage(
                  catalogProduct,
                );

              const itemTotal =
                Number(item.price) *
                item.quantity;

              const variantName =
                item.variantName;

              const isLast =
                index ===
                items.length - 1;

              return (
                <View
                  key={`${item.id}-${
                    item.variantId ??
                    'base'
                  }`}
                  style={[
                    styles.itemRow,

                    isLast &&
                      styles.itemRowLast,
                  ]}
                >
                  {/* PRODUCT DETAILS */}

                  <View
                    style={
                      styles.itemContent
                    }
                  >
                    <Text
                      style={styles.itemName}
                      numberOfLines={2}
                    >
                      {item.name}
                    </Text>

                    {!!variantName && (
                      <Text
                        style={
                          styles.variantName
                        }
                        numberOfLines={1}
                      >
                        {variantName}
                      </Text>
                    )}

                    <Pressable
                      style={(responsiveness) => [
                        styles.editButton,

                        responsiveness.pressed &&
                          styles.buttonPressed,
                      ]}
                      onPress={
                        continueShopping
                      }
                    >
                      <Ionicons
                        name="pencil-outline"
                        size={17}
                        color={BRAND_GREEN}
                      />

                      <Text
                        style={
                          styles.editButtonText
                        }
                      >
                        تعديل
                      </Text>
                    </Pressable>

                    <View
                      style={
                        styles.itemPriceContainer
                      }
                    >
                      <Text
                        style={
                          styles.itemPrice
                        }
                      >
                        {formatPrice(
                          itemTotal,
                        )}
                      </Text>
                    </View>
                  </View>

                  {/* PRODUCT IMAGE */}

                  <View
                    style={styles.itemMedia}
                  >
                    {canDisplayImage(
                      imageUrl,
                    ) ? (
                      <Image
                        source={{
                          uri: imageUrl!,
                        }}
                        style={styles.itemImage}
                        resizeMode="cover"
                        onError={() =>
                          markImageAsFailed(
                            imageUrl!,
                          )
                        }
                      />
                    ) : (
                      <View
                        style={
                          styles.itemImageFallback
                        }
                      >
                        {item.icon ? (
                          <Text
                            style={
                              styles.itemEmoji
                            }
                          >
                            {item.icon}
                          </Text>
                        ) : (
                          <Ionicons
                            name="restaurant-outline"
                            size={36}
                            color="#bbbbbb"
                          />
                        )}
                      </View>
                    )}

                    {/* QUANTITY PILL */}

                    <View
                      style={
                        styles.quantityControl
                      }
                    >
                      <Pressable
                        style={({ pressed }) => [
                          styles.quantityButton,

                          pressed &&
                            styles.buttonPressed,
                        ]}
                        onPress={() => {
                          if (!storeId) {
                            return;
                          }

                          if (
                            item.quantity <= 1
                          ) {
                            if (
                              items.length === 1
                            ) {
                              clearOrderNotes(
                                storeId,
                              );
                            }

                            removeStoreItem(
                              storeId,
                              item.id,
                              item.variantId ??
                                null,
                            );

                            return;
                          }

                          decreaseStoreItem(
                            storeId,
                            item.id,
                            item.variantId ??
                              null,
                          );
                        }}
                      >
                        <Ionicons
                          name={
                            item.quantity <= 1
                              ? 'trash-outline'
                              : 'remove'
                          }
                          size={
                            item.quantity <= 1
                              ? 18
                              : 20
                          }
                          color={BRAND_GREEN}
                        />
                      </Pressable>

                      <Text
                        style={
                          styles.quantityText
                        }
                      >
                        {item.quantity}
                      </Text>

                      <Pressable
                        style={({ pressed }) => [
                          styles.quantityButton,

                          pressed &&
                            styles.buttonPressed,
                        ]}
                        onPress={() => {
                          if (!storeId) {
                            return;
                          }

                          increaseStoreItem(
                            storeId,
                            item.id,
                            item.variantId ??
                              null,
                          );
                        }}
                      >
                        <Ionicons
                          name="add"
                          size={22}
                          color={BRAND_GREEN}
                        />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            },
          )}
        </View>

        {/* RECOMMENDATIONS */}

        {recommendations.length > 0 && (
          <View
            style={
              styles.recommendationsSection
            }
          >
            <Text
              style={
                styles.recommendationsTitle
              }
            >
              قد يعجبك أيضًا...
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.recommendationsScroll
              }
            >
              {recommendations.map(
                (product) => {
                  const imageUrl =
                    getProductImage(
                      product,
                    );

                  const displayPrice =
                    getProductDisplayPrice(
                      product,
                    );

                  const hasVariants =
                    product.variants.length > 0;

                  return (
                    <View
                      key={product.id}
                      style={
                        styles.recommendationCard
                      }
                    >
                      <View
                        style={
                          styles.recommendationImageWrapper
                        }
                      >
                        {canDisplayImage(
                          imageUrl,
                        ) ? (
                          <Image
                            source={{
                              uri: imageUrl!,
                            }}
                            style={
                              styles.recommendationImage
                            }
                            resizeMode="cover"
                            onError={() =>
                              markImageAsFailed(
                                imageUrl!,
                              )
                            }
                          />
                        ) : (
                          <View
                            style={
                              styles.recommendationImageFallback
                            }
                          >
                            {product.icon ? (
                              <Text
                                style={
                                  styles.recommendationEmoji
                                }
                              >
                                {product.icon}
                              </Text>
                            ) : (
                              <Ionicons
                                name="image-outline"
                                size={32}
                                color="#b5b5b5"
                              />
                            )}
                          </View>
                        )}

                        <Pressable
                          style={({ pressed }) => [
                            styles.recommendationAddButton,

                            pressed &&
                              styles.recommendationAddButtonPressed,
                          ]}
                          onPress={() =>
                            addRecommendation(
                              product,
                            )
                          }
                        >
                          <Ionicons
                            name={
                              hasVariants
                                ? 'chevron-forward'
                                : 'add'
                            }
                            size={
                              hasVariants
                                ? 19
                                : 23
                            }
                            color={BRAND_GREEN}
                          />
                        </Pressable>
                      </View>

                      <Text
                        style={
                          styles.recommendationName
                        }
                        numberOfLines={2}
                      >
                        {product.name}
                      </Text>

                      <Text
                        style={
                          styles.recommendationPrice
                        }
                        numberOfLines={1}
                      >
                        {hasVariants
                          ? `من ${formatPrice(
                              displayPrice,
                            )}`
                          : formatPrice(
                              displayPrice,
                            )}
                      </Text>
                    </View>
                  );
                },
              )}
            </ScrollView>
          </View>
        )}


        {/* ORDER NOTES — REFERENCE STYLE */}

        <View
          style={
            styles.referenceNotesSection
          }
        >
          <Text
            style={
              styles.referenceSectionTitle
            }
          >
            ملاحظات إضافية
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="دوّن ملاحظة على الطلب"
            style={({ pressed }) => [
              styles.referenceNotesRow,
              pressed &&
                styles.referenceNotesRowPressed,
            ]}
            onPress={
              openOrderNoteEditor
            }
          >
            <Ionicons
              name="chatbox-outline"
              size={25}
              color="#242424"
              style={
                styles.referenceNotesIcon
              }
            />

            <View
              style={
                styles.referenceNotesCopy
              }
            >
              <Text
                style={
                  styles.referenceNotesLabel
                }
              >
                دوّن ملاحظة
              </Text>

              <Text
                style={[
                  styles.referenceNotesPreview,
                  !orderNotes.trim() &&
                    styles.referenceNotesPreviewPlaceholder,
                ]}
                numberOfLines={2}
              >
                {orderNotes.trim()
                  ? orderNotes
                  : 'هل تود أن تخبرنا أي شيء آخر؟'}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* VOUCHER — REFERENCE STYLE */}

        <View
          style={
            styles.referenceVoucherSection
          }
        >
          <Text
            style={
              styles.referenceSectionTitle
            }
          >
            وفّر على طلبك
          </Text>

          <View
            style={[
              styles.referenceVoucherField,
              appliedVoucher &&
                styles.referenceVoucherFieldApplied,
            ]}
          >
            <Ionicons
              name={
                appliedVoucher
                  ? 'ticket'
                  : 'ticket-outline'
              }
              size={24}
              color={
                appliedVoucher
                  ? BRAND_GREEN
                  : '#A0A0A0'
              }
            />

            {appliedVoucher ? (
              <View
                style={
                  styles.referenceVoucherAppliedCopy
                }
              >
                <Text
                  style={
                    styles.referenceVoucherAppliedCode
                  }
                  numberOfLines={1}
                >
                  {appliedVoucher.code}
                </Text>

                <Text
                  style={
                    styles.referenceVoucherAppliedSaving
                  }
                  numberOfLines={1}
                >
                  وفّرت{' '}
                  {formatSummaryAmount(
                    voucherDiscount,
                  )}{' '}
                  ج.م
                </Text>
              </View>
            ) : (
              <TextInput
                autoCapitalize="characters"
                autoCorrect={false}
                editable={
                  !isApplyingVoucher
                }
                maxLength={32}
                placeholder="قم بإدخال رمز القسيمة هنا"
                placeholderTextColor="#777777"
                returnKeyType="done"
                style={
                  styles.referenceVoucherInput
                }
                value={
                  voucherCode
                }
                onChangeText={
                  handleVoucherCodeChange
                }
                onSubmitEditing={() => {
                  void applyCartVoucher();
                }}
              />
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                appliedVoucher
                  ? 'إزالة القسيمة'
                  : 'إرسال رمز القسيمة'
              }
              disabled={
                !appliedVoucher &&
                (
                  isApplyingVoucher ||
                  voucherCode
                    .trim()
                    .length < 3
                )
              }
              hitSlop={8}
              style={({ pressed }) => [
                styles.referenceVoucherAction,
                pressed &&
                  styles.referenceVoucherActionPressed,
              ]}
              onPress={() => {
                if (appliedVoucher) {
                  removeAppliedVoucher();
                  return;
                }

                void applyCartVoucher();
              }}
            >
              {isApplyingVoucher &&
              !appliedVoucher ? (
                <ActivityIndicator
                  size="small"
                  color={
                    BRAND_GREEN
                  }
                />
              ) : (
                <Text
                  style={[
                    styles.referenceVoucherActionText,
                    !appliedVoucher &&
                      voucherCode
                        .trim()
                        .length < 3 &&
                      styles.referenceVoucherActionTextDisabled,
                  ]}
                >
                  {appliedVoucher
                    ? 'إزالة'
                    : 'إرسال'}
                </Text>
              )}
            </Pressable>
          </View>

          {voucherError ? (
            <View
              style={
                styles.referenceVoucherErrorRow
              }
            >
              <Ionicons
                name="alert-circle-outline"
                size={15}
                color="#D64B4B"
              />

              <Text
                style={
                  styles.referenceVoucherErrorText
                }
              >
                {voucherError}
              </Text>
            </View>
          ) : null}
        </View>

        {/* PAYMENT SUMMARY — REFERENCE STYLE */}

        <View
          style={
            styles.referencePaymentSummary
          }
        >
          <Text
            style={
              styles.referencePaymentTitle
            }
          >
            ملخص الدفع
          </Text>

          <View
            style={
              styles.referenceSummaryRow
            }
          >
            <Text
              style={
                styles.referenceSummaryLabel
              }
            >
              المجموع الفرعي
            </Text>

            <Text
              style={
                styles.referenceSummaryValue
              }
            >
              {formatSummaryAmount(
                subtotal,
              )}
            </Text>
          </View>

          {voucherDiscount > 0 &&
            voucherDiscountTarget ===
              'order_subtotal' && (
              <View
                style={
                  styles.referenceSummaryRow
                }
              >
                <Text
                  style={
                    styles.referenceDiscountLabel
                  }
                >
                  خصم القسيمة
                </Text>

                <Text
                  style={
                    styles.referenceDiscountValue
                  }
                >
                  -{formatSummaryAmount(
                    voucherDiscount,
                  )}
                </Text>
              </View>
            )}

          <View
            style={
              styles.referenceSummaryRow
            }
          >
            <View
              style={
                styles.referenceSummaryLabelWithInfo
              }
            >
              <Text
                style={
                  styles.referenceSummaryLabel
                }
              >
                رسوم التوصيل
              </Text>

              <Ionicons
                name="information-circle-outline"
                size={16}
                color="#8C8C8C"
              />
            </View>

            <Text
              style={
                styles.referenceSummaryValue
              }
            >
              {formatSummaryAmount(
                deliveryFee,
              )}
            </Text>
          </View>

          {voucherDiscount > 0 &&
            voucherDiscountTarget ===
              'delivery_fee' && (
              <View
                style={
                  styles.referenceSummaryRow
                }
              >
                <Text
                  style={
                    styles.referenceDiscountLabel
                  }
                >
                  خصم التوصيل
                </Text>

                <Text
                  style={
                    styles.referenceDiscountValue
                  }
                >
                  -{formatSummaryAmount(
                    voucherDiscount,
                  )}
                </Text>
              </View>
            )}

          <View
            style={
              styles.referenceSummaryRow
            }
          >
            <View
              style={
                styles.referenceSummaryLabelWithInfo
              }
            >
              <Text
                style={
                  styles.referenceSummaryLabel
                }
              >
                رسوم الخدمة
              </Text>

              <Ionicons
                name="information-circle-outline"
                size={16}
                color="#8C8C8C"
              />
            </View>

            <Text
              style={
                styles.referenceSummaryValue
              }
            >
              {formatSummaryAmount(
                paymentProcessingFee,
              )}
            </Text>
          </View>

          <View
            style={[
              styles.referenceSummaryRow,
              styles.referenceTotalRow,
            ]}
          >
            <Text
              style={
                styles.referenceTotalLabel
              }
            >
              المبلغ الإجمالي (ج.م)
            </Text>

            <Text
              style={
                styles.referenceTotalValue
              }
            >
              {formatSummaryAmount(
                grandTotal,
              )}
            </Text>
          </View>
        </View>

        {!minimumReached &&
          Number(minimumOrder) > 0 && (
            <View
              style={styles.minimumNotice}
            >
              <Ionicons
                name="information-circle-outline"
                size={18}
                color="#8a6519"
              />

              <Text
                style={
                  styles.minimumNoticeText
                }
              >
                متبقي{' '}
                {formatPrice(
                  remainingForMinimum,
                )}{' '}
                للوصول إلى الحد الأدنى
                للطلب
              </Text>
            </View>
          )}
      </ScrollView>

      {/* BOTTOM CHECKOUT */}

      <View
        style={styles.checkoutBarWrapper}
      >
        <View style={styles.checkoutBar}>
          <Pressable
            style={({ pressed }) => [
              styles.addItemsButton,

              pressed &&
                styles.bottomButtonPressed,
            ]}
            onPress={continueShopping}
          >
            <Text
              style={
                styles.addItemsButtonText
              }
            >
              أضف المزيد
            </Text>
          </Pressable>

          <Pressable
            disabled={!minimumReached}
            style={({ pressed }) => [
              styles.checkoutButton,

              !minimumReached &&
                styles.checkoutButtonDisabled,

              pressed &&
                minimumReached &&
                styles.bottomButtonPressed,
            ]}
            onPress={handleCheckout}
          >
            <Text
              style={[
                styles.checkoutButtonText,

                !minimumReached &&
                  styles.checkoutButtonTextDisabled,
              ]}
            >
              {minimumReached
                ? 'تابع للدفع'
                : `متبقي ${Math.ceil(
                    remainingForMinimum,
                  )}`}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ORDER NOTE EDITOR */}

      <Modal
        visible={
          noteEditorVisible
        }
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={
          closeOrderNoteEditor
        }
        onShow={() => {
          requestAnimationFrame(
            () => {
              noteInputRef.current?.focus();
            },
          );
        }}
      >
        <KeyboardAvoidingView
          style={
            styles.noteEditorModalRoot
          }
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : 'height'
          }
        >
          <Pressable
            style={
              styles.noteEditorBackdrop
            }
            onPress={
              closeOrderNoteEditor
            }
          />

          <View
            style={
              styles.noteEditorSheet
            }
          >
            <View
              style={
                styles.noteEditorInputFrame
              }
            >
              <TextInput
                ref={
                  noteInputRef
                }
                autoFocus
                multiline
                maxLength={200}
                returnKeyType="done"
                submitBehavior="blurAndSubmit"
                style={
                  styles.noteEditorInput
                }
                value={
                  draftOrderNote
                }
                onChangeText={
                  handleDraftOrderNoteChange
                }
                onSubmitEditing={
                  closeOrderNoteEditor
                }
                placeholder="دوّن ملاحظة"
                placeholderTextColor="#A0A0A0"
                textAlign="right"
                textAlignVertical="top"
              />
            </View>

            <Text
              style={
                styles.noteEditorCounter
              }
            >
              {draftOrderNote.length}/200
            </Text>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* CLEAR CART MODAL */}

      {clearModalVisible ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() =>
            setClearModalVisible(false)
          }
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
            <View
              style={styles.modalDangerIcon}
            >
              <Ionicons
                name="trash-outline"
                size={26}
                color="#d64b4b"
              />
            </View>

            <Text
              style={styles.modalTitle}
            >
              إفراغ السلة؟
            </Text>

            <Text
              style={
                styles.modalDescription
              }
            >
              سيتم حذف منتجات{' '}
              {storeName ?? 'هذا المتجر'}{' '}
              فقط، ولن تتأثر السلال الأخرى.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.dangerButton,

                pressed &&
                  styles.buttonPressed,
              ]}
              onPress={handleClearCart}
            >
              <Text
                style={
                  styles.dangerButtonText
                }
              >
                نعم، إفراغ هذه السلة
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.modalCancelButton,

                pressed &&
                  styles.buttonPressed,
              ]}
              onPress={() =>
                setClearModalVisible(false)
              }
            >
              <Text
                style={
                  styles.modalCancelButtonText
                }
              >
                إلغاء
              </Text>
            </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /* ============================================================
   * MULTI CART PICKER
   * ============================================================
   */

  cartPickerScreen: {
    backgroundColor:
      'rgba(0, 0, 0, 0.46)',
    flex: 1,
    justifyContent: 'flex-end',
  },

  cartPickerBackdrop: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  },

  cartPickerSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '76%',
    minHeight: 340,
    overflow: 'hidden',
    paddingBottom: 13,
    paddingHorizontal: 20,
    paddingTop: 0,

    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: -6,
    },
    shadowOpacity: 0.16,
    shadowRadius: 16,

    elevation: 24,
  },

  sheetDragArea: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: '#e5e5e5',
    borderRadius: 3,
    height: 4,
    marginTop: 3,
    width: 52,
  },

  sheetTopRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    height: 58,
    justifyContent: 'flex-start',
  },

  sheetCloseButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e1e1e1',
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },

  sheetCloseButtonPressed: {
    backgroundColor: '#f6f6f6',
    transform: [
      {
        scale: 0.97,
      },
    ],
  },

  cartPickerTitle: {
    color: '#1e1e1e',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 32,
    marginBottom: 14,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  cartPickerList: {
    flexGrow: 0,
  },

  cartPickerListContent: {
    paddingBottom: 4,
  },

  cartPickerRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    minHeight: 104,
    paddingVertical: 11,
  },

  cartPickerRowBorder: {
    borderBottomColor: '#e6e6e6',
    borderBottomWidth: 1,
  },

  cartPickerRowPressed: {
    opacity: 0.74,
  },

  cartPickerLogoBox: {
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderColor: '#eeeeee',
    borderRadius: 12,
    borderWidth: 1,
    height: 72,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 72,
  },

  cartPickerLogo: {
    height: '100%',
    width: '100%',
  },

  cartPickerLogoFallback: {
    fontSize: 34,
  },

  cartPickerStoreContent: {
    flex: 1,
    marginHorizontal: 14,
  },

  cartPickerStoreName: {
    color: '#1d1d1d',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  cartPickerItemCount: {
    color: '#444444',
    fontSize: 14,
    marginTop: 5,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  cartPickerPrice: {
    color: '#1d1d1d',
    fontSize: 16,
    fontWeight: '700',
    minWidth: 94,
    textAlign: 'left',
  },

  cartPickerNote: {
    borderTopColor: '#e6e6e6',
    borderTopWidth: 1,
    marginTop: 7,
    paddingHorizontal: 10,
    paddingTop: 22,
  },

  cartPickerNoteText: {
    color: '#858585',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  homeIndicator: {
    alignSelf: 'center',
    backgroundColor: '#111111',
    borderRadius: 4,
    height: 7,
    marginTop: 28,
    width: 210,
  },

  /* ============================================================
   * NORMAL CART SCREEN
   * ============================================================
   */

  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },

  mainScrollView: {
    flex: 1,
  },

  pageContent: {
    paddingBottom: 126,
  },

  /* ---------------------------------- */
  /* STICKY HEADER                      */
  /* ---------------------------------- */

  header: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    flexShrink: 0,
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 20,
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
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },

  headerContent: {
    flex: 1,
    marginLeft: 14,
  },

  pageTitle: {
    color: '#202020',
    fontSize: 20,
    fontWeight: '800',
  },

  headerStoreName: {
    color: '#8a8a8a',
    fontSize: 12,
    marginTop: 2,
  },

  clearCartButton: {
    paddingHorizontal: 6,
    paddingVertical: 7,
  },

  clearCartButtonText: {
    color: '#777777',
    fontSize: 12,
    fontWeight: '700',
  },

  /* ---------------------------------- */
  /* CART ITEMS                         */
  /* ---------------------------------- */

  itemsSection: {
    paddingHorizontal: 20,
  },

  itemRow: {
    flexDirection: 'row',
    minHeight: 218,
    paddingBottom: 22,
    paddingTop: 9,
    borderBottomColor: '#e8e8e8',
    borderBottomWidth: 1,
  },

  itemRowLast: {
    borderBottomWidth: 0,
  },

  itemContent: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingRight: 16,
  },

  itemName: {
    color: '#242424',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
    textAlign: 'left',
  },

  variantName: {
    color: '#777777',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
    textAlign: 'left',
    width: '100%',
  },

  editButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    marginTop: 10,
    paddingVertical: 2,
  },

  editButtonText: {
    borderBottomColor: BRAND_GREEN,
    borderBottomWidth: 1,
    color: BRAND_GREEN,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },

  itemPriceContainer: {
    marginTop: 'auto',
    paddingBottom: 6,
  },

  itemPrice: {
    color: '#242424',
    fontSize: 16,
    fontWeight: '600',
  },

  itemMedia: {
    height: 194,
    position: 'relative',
    width: 194,
  },

  itemImage: {
    backgroundColor: '#f2f2f2',
    borderRadius: 15,
    height: '100%',
    width: '100%',
  },

  itemImageFallback: {
    alignItems: 'center',
    backgroundColor: '#f4f4f4',
    borderRadius: 15,
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },

  itemEmoji: {
    fontSize: 48,
  },

  quantityControl: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e4e4e4',
    borderRadius: 24,
    borderWidth: 1,
    bottom: -8,
    flexDirection: 'row',
    height: 46,
    justifyContent: 'space-between',
    left: 7,
    paddingHorizontal: 4,
    position: 'absolute',
    right: 7,

    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 5,

    elevation: 4,
  },

  quantityButton: {
    alignItems: 'center',
    borderRadius: 20,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },

  quantityText: {
    color: '#242424',
    fontSize: 16,
    fontWeight: '600',
    minWidth: 34,
    textAlign: 'center',
  },

  /* ---------------------------------- */
  /* RECOMMENDATIONS                    */
  /* ---------------------------------- */

  recommendationsSection: {
    backgroundColor: '#faf8f4',
    marginTop: 8,
    paddingBottom: 22,
    paddingTop: 23,
  },

  recommendationsTitle: {
    color: '#242424',
    fontSize: 20,
    fontWeight: '800',
    paddingHorizontal: 20,
  },

  recommendationsScroll: {
    gap: 12,
    paddingHorizontal: 12,
    paddingTop: 18,
  },

  recommendationCard: {
    width: 162,
  },

  recommendationImageWrapper: {
    height: 194,
    position: 'relative',
    width: 162,
  },

  recommendationImage: {
    backgroundColor: '#f1f1f1',
    borderColor: '#e3e3e3',
    borderRadius: 17,
    borderWidth: 1,
    height: '100%',
    width: '100%',
  },

  recommendationImageFallback: {
    alignItems: 'center',
    backgroundColor: '#f3f3f3',
    borderColor: '#e3e3e3',
    borderRadius: 17,
    borderWidth: 1,
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },

  recommendationEmoji: {
    fontSize: 40,
  },

  recommendationAddButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e5e5e5',
    borderRadius: 22,
    borderWidth: 1,
    bottom: 9,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 9,
    width: 44,

    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.09,
    shadowRadius: 5,

    elevation: 4,
  },

  recommendationAddButtonPressed: {
    transform: [
      {
        scale: 0.94,
      },
    ],
  },

  recommendationName: {
    color: '#252525',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: 10,
  },

  recommendationPrice: {
    color: '#363636',
    fontSize: 13,
    marginTop: 4,
  },


  /* ---------------------------------- */
  /* ORDER NOTES                        */
  /* ---------------------------------- */

  /* ---------------------------------- */
  /* REFERENCE — NOTES                  */
  /* ---------------------------------- */

  referenceNotesSection: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 28,
    paddingTop: 30,
  },

  referenceSectionTitle: {
    color: '#242424',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 33,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  referenceNotesRow: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    marginTop: 20,
    paddingVertical: 2,
  },

  referenceNotesRowPressed: {
    opacity: 0.58,
  },

  referenceNotesIcon: {
    marginLeft: 14,
    marginTop: 4,
  },

  referenceNotesCopy: {
    flex: 1,
  },

  referenceNotesLabel: {
    color: '#242424',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 23,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  referenceNotesPreview: {
    color: '#4A4A4A',
    fontSize: 14.5,
    fontWeight: '400',
    lineHeight: 22,
    marginTop: 3,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  referenceNotesPreviewPlaceholder: {
    color: '#8A8A8A',
  },

  /* ---------------------------------- */
  /* REFERENCE — VOUCHER                */
  /* ---------------------------------- */

  referenceVoucherSection: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 28,
    paddingTop: 34,
  },

  referenceVoucherField: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DCDCDC',
    borderRadius: 18,
    borderWidth: 1.2,
    flexDirection: 'row-reverse',
    marginTop: 18,
    minHeight: 62,
    paddingHorizontal: 17,
  },

  referenceVoucherFieldApplied: {
    borderColor: '#CBEBD8',
  },

  referenceVoucherInput: {
    color: '#242424',
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    minHeight: 58,
    paddingHorizontal: 14,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  referenceVoucherAppliedCopy: {
    flex: 1,
    marginHorizontal: 14,
  },

  referenceVoucherAppliedCode: {
    color: '#242424',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'ltr',
  },

  referenceVoucherAppliedSaving: {
    color: BRAND_GREEN,
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  referenceVoucherAction: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 52,
    paddingHorizontal: 4,
  },

  referenceVoucherActionPressed: {
    opacity: 0.55,
  },

  referenceVoucherActionText: {
    color: '#242424',
    fontSize: 13.5,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  referenceVoucherActionTextDisabled: {
    color: '#A0A0A0',
  },

  referenceVoucherErrorRow: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    gap: 6,
    marginTop: 9,
  },

  referenceVoucherErrorText: {
    color: '#D64B4B',
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  /* ---------------------------------- */
  /* REFERENCE — PAYMENT SUMMARY        */
  /* ---------------------------------- */

  referencePaymentSummary: {
    backgroundColor: '#ffffff',
    paddingBottom: 28,
    paddingHorizontal: 28,
    paddingTop: 38,
  },

  referencePaymentTitle: {
    color: '#242424',
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: -0.45,
    lineHeight: 34,
    marginBottom: 28,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  referenceSummaryRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    minHeight: 36,
  },

  referenceSummaryLabel: {
    color: '#313131',
    fontSize: 14.5,
    fontWeight: '500',
    lineHeight: 21,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  referenceSummaryLabelWithInfo: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 8,
  },

  referenceSummaryValue: {
    color: '#303030',
    fontSize: 14.5,
    fontWeight: '500',
    minWidth: 96,
    textAlign: 'left',
    writingDirection: 'ltr',
  },

  referenceDiscountLabel: {
    color: BRAND_GREEN,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  referenceDiscountValue: {
    color: BRAND_GREEN,
    fontSize: 14,
    fontWeight: '800',
    minWidth: 96,
    textAlign: 'left',
    writingDirection: 'ltr',
  },

  referenceTotalRow: {
    marginTop: 17,
    minHeight: 48,
  },

  referenceTotalLabel: {
    color: '#202020',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 25,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  referenceTotalValue: {
    color: BRAND_GREEN,
    fontSize: 20,
    fontWeight: '900',
    minWidth: 106,
    textAlign: 'left',
    writingDirection: 'ltr',
  },

  minimumNotice: {
    alignItems: 'center',
    backgroundColor: '#fff8e7',
    borderRadius: 12,
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 13,
    padding: 11,
  },

  minimumNoticeText: {
    color: '#82651f',
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 7,
  },

  /* ---------------------------------- */
  /* BOTTOM BAR                         */
  /* ---------------------------------- */

  checkoutBarWrapper: {
    backgroundColor: '#ffffff',
    borderTopColor: '#e8e8e8',
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

  checkoutBar: {
    flexDirection: 'row-reverse',
    gap: 12,
  },

  addItemsButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#252525',
    borderRadius: 27,
    borderWidth: 1.5,
    flex: 1,
    height: 58,
    justifyContent: 'center',
  },

  addItemsButtonText: {
    color: '#242424',
    fontSize: 16,
    fontWeight: '800',
  },

  checkoutButton: {
    alignItems: 'center',
    backgroundColor: BRAND_GREEN,
    borderRadius: 27,
    flex: 1,
    height: 58,
    justifyContent: 'center',
  },

  checkoutButtonDisabled: {
    backgroundColor: '#dddddd',
  },

  checkoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },

  checkoutButtonTextDisabled: {
    color: '#8b8b8b',
  },

  bottomButtonPressed: {
    opacity: 0.88,
    transform: [
      {
        scale: 0.98,
      },
    ],
  },

  /* ---------------------------------- */
  /* ORDER NOTE EDITOR                  */
  /* ---------------------------------- */

  noteEditorModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  noteEditorBackdrop: {
    backgroundColor:
      'rgba(0, 0, 0, 0.50)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },

  noteEditorSheet: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 18,
    paddingHorizontal: 24,
    paddingTop: 18,
  },

  noteEditorInputFrame: {
    backgroundColor: '#FFFFFF',
    borderColor: '#242424',
    borderRadius: 22,
    borderWidth: 1.5,
    minHeight: 182,
    overflow: 'hidden',
  },

  noteEditorInput: {
    color: '#242424',
    fontSize: 16,
    lineHeight: 24,
    minHeight: 178,
    paddingHorizontal: 18,
    paddingTop: 15,
    paddingBottom: 15,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  noteEditorCounter: {
    color: '#8A8A8A',
    fontSize: 13,
    marginTop: 10,
    paddingHorizontal: 20,
    textAlign: 'left',
    writingDirection: 'ltr',
  },

  /* ---------------------------------- */
  /* MODALS                             */
  /* ---------------------------------- */

  modalOverlay: {
    alignItems: 'center',
    backgroundColor:
      'rgba(0, 0, 0, 0.50)',
    flex: 1,
    justifyContent: 'center',
    padding: 22,
  },

  modalCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 22,
    maxWidth: 400,
    padding: 22,
    width: '100%',
  },

  modalDangerIcon: {
    alignItems: 'center',
    backgroundColor: '#fff1f1',
    borderRadius: 30,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },

  modalTitle: {
    color: '#242424',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 14,
  },

  modalDescription: {
    color: '#777777',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 8,
    textAlign: 'center',
  },

  dangerButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#d84a4a',
    borderRadius: 14,
    marginTop: 20,
    paddingVertical: 12,
  },

  dangerButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },

  modalCancelButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#f2f2f2',
    borderRadius: 14,
    marginTop: 9,
    paddingVertical: 12,
  },

  modalCancelButtonText: {
    color: '#555555',
    fontSize: 13,
    fontWeight: '700',
  },

  /* ---------------------------------- */
  /* EMPTY CART                         */
  /* ---------------------------------- */

  emptyScreen: {
    backgroundColor: '#ffffff',
    flex: 1,
  },

  emptyBackButton: {
    alignItems: 'center',
    borderColor: '#e4e4e4',
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    left: 20,
    position: 'absolute',
    top: 48,
    width: 48,
  },

  emptyContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  emptyIconContainer: {
    alignItems: 'center',
    backgroundColor:
      BRAND_GREEN_SOFT,
    borderRadius: 39,
    height: 78,
    justifyContent: 'center',
    width: 78,
  },

  emptyTitle: {
    color: '#242424',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 18,
  },

  emptyDescription: {
    color: '#7c7c7c',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 8,
    textAlign: 'center',
  },

  primaryButton: {
    alignItems: 'center',
    backgroundColor: BRAND_GREEN,
    borderRadius: 25,
    marginTop: 20,
    minWidth: 190,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },

  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },

  buttonPressed: {
    opacity: 0.7,
  },
});

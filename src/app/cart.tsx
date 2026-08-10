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
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  type CatalogProduct,
  type StoreCatalog,
  getStoreCatalog,
} from '../services/catalog-service';

import {
  useCartStore,
} from '../store/cart-store';

const BRAND_GREEN = '#00B14F';
const BRAND_GREEN_SOFT = '#EAF8F0';

/**
 * Navienty Now fixed checkout fees.
 *
 * Electronic payment fee: EGP 10 per order.
 * Delivery fee: EGP 25 per order.
 */
const FIXED_PAYMENT_PROCESSING_FEE = 10;
const FIXED_DELIVERY_FEE = 25;

/**
 * Multi-cart bottom sheet swipe-to-dismiss settings.
 */
const CART_PICKER_CLOSE_DISTANCE = 95;
const CART_PICKER_CLOSE_VELOCITY = 0.75;
const CART_PICKER_OFFSCREEN_Y = 900;

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

  const activeStoreId = useCartStore(
    (state) => state.activeStoreId,
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
   * If there is only one cart, open it directly just like the old
   * cart screen.
   *
   * If there are multiple carts, no cart is selected initially so
   * the "All shopping carts" bottom sheet is displayed.
   */
  useEffect(() => {
    if (availableCarts.length === 0) {
      if (selectedStoreId !== null) {
        setSelectedStoreId(null);
      }

      return;
    }

    if (availableCarts.length === 1) {
      const onlyStoreId =
        availableCarts[0].storeId;

      if (
        selectedStoreId !== onlyStoreId
      ) {
        setSelectedStoreId(
          onlyStoreId,
        );
      }

      if (
        activeStoreId !== onlyStoreId
      ) {
        setActiveCart(
          onlyStoreId,
        );
      }

      return;
    }

    if (
      selectedStoreId &&
      !carts[selectedStoreId]
    ) {
      setSelectedStoreId(null);
    }
  }, [
    activeStoreId,
    availableCarts,
    carts,
    selectedStoreId,
    setActiveCart,
  ]);

  /**
   * requestedStoreId is useful when this screen is opened while
   * there is only one cart. When there are multiple carts we always
   * start with the carts chooser, matching the requested UX.
   */
  useEffect(() => {
    if (
      hasMultipleCarts ||
      !requestedStoreId ||
      !carts[requestedStoreId]
    ) {
      return;
    }

    setSelectedStoreId(
      requestedStoreId,
    );

    setActiveCart(
      requestedStoreId,
    );
  }, [
    carts,
    hasMultipleCarts,
    requestedStoreId,
    setActiveCart,
  ]);

  const currentCart =
    selectedStoreId
      ? carts[selectedStoreId] ?? null
      : null;

  const items =
    currentCart?.items ?? [];

  const storeId =
    currentCart?.storeId ?? null;

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
    FIXED_DELIVERY_FEE;

  const grandTotal =
    Number(subtotal ?? 0) +
    deliveryFee +
    paymentProcessingFee;

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

    router.push({
      pathname: '/checkout',
      params: {
        storeId,

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
          FIXED_DELIVERY_FEE,
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
        <Stack.Screen
          options={{
            headerShown: false,
            presentation: 'transparentModal',
            contentStyle: {
              backgroundColor: 'transparent',
            },
          }}
        />

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
            size={27}
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
              size={44}
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
    !selectedStoreId
  ) {
    return (
      <View
        style={styles.cartPickerScreen}
      >
        <Stack.Screen
          options={{
            headerShown: false,
            presentation: 'transparentModal',
            contentStyle: {
              backgroundColor: 'transparent',
            },
          }}
        />

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
                  size={31}
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
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: 'transparentModal',
          contentStyle: {
            backgroundColor: 'transparent',
          },
        }}
      />

      <ScrollView
        contentContainerStyle={
          styles.pageContent
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* HEADER */}

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
              size={28}
              color="#262626"
            />
          </Pressable>

          <View
            style={styles.headerContent}
          >
            <Text
              style={styles.pageTitle}
            >
              السلة
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
                        size={22}
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
                            size={45}
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
                              ? 22
                              : 24
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
                          size={28}
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
                                size={40}
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
                                ? 25
                                : 31
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

        {/* ORDER DETAILS */}

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
            style={styles.summaryRow}
          >
            <Text
              style={styles.summaryLabel}
            >
              المنتجات
            </Text>

            <Text
              style={styles.summaryValue}
            >
              {formatPrice(subtotal)}
            </Text>
          </View>

          <View
            style={styles.summaryRow}
          >
            <Text
              style={styles.summaryLabel}
            >
              التوصيل
            </Text>

            <Text
              style={styles.summaryValue}
            >
              {formatPrice(deliveryFee)}
            </Text>
          </View>

          <View
            style={styles.summaryRow}
          >
            <View
              style={
                styles.paymentFeeLabelContainer
              }
            >
              <Text
                style={
                  styles.summaryLabel
                }
              >
                رسوم الدفع الإلكتروني
              </Text>

              <Ionicons
                name="information-circle-outline"
                size={16}
                color="#8a8a8a"
              />
            </View>

            <Text
              style={styles.summaryValue}
            >
              {formatPrice(
                paymentProcessingFee,
              )}
            </Text>
          </View>

          <Text
            style={
              styles.paymentFeeDescription
            }
          >
            رسوم دفع إلكتروني ثابتة بقيمة EGP 10 لكل طلب.
          </Text>

          <View
            style={styles.summaryDivider}
          />

          <View
            style={styles.summaryRow}
          >
            <Text
              style={styles.totalLabel}
            >
              الإجمالي
            </Text>

            <Text
              style={styles.totalValue}
            >
              {formatPrice(grandTotal)}
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
                size={22}
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
              إضافة منتجات
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
                ? 'إتمام الطلب'
                : `متبقي ${Math.ceil(
                    remainingForMinimum,
                  )}`}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* CLEAR CART MODAL */}

      <Modal
        visible={clearModalVisible}
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
                size={34}
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
    ...StyleSheet.absoluteFillObject,
  },

  cartPickerSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    maxHeight: '76%',
    minHeight: 390,
    overflow: 'hidden',
    paddingBottom: 13,
    paddingHorizontal: 24,
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
    marginHorizontal: -24,
    paddingHorizontal: 24,
    paddingTop: 9,
  },

  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: '#e5e5e5',
    borderRadius: 3,
    height: 5,
    marginTop: 3,
    width: 70,
  },

  sheetTopRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    height: 73,
    justifyContent: 'flex-start',
  },

  sheetCloseButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e1e1e1',
    borderRadius: 34,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    width: 64,
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
    fontSize: 31,
    fontWeight: '900',
    lineHeight: 42,
    marginBottom: 19,
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
    minHeight: 128,
    paddingVertical: 14,
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
    borderRadius: 13,
    borderWidth: 1,
    height: 91,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 91,
  },

  cartPickerLogo: {
    height: '100%',
    width: '100%',
  },

  cartPickerLogoFallback: {
    fontSize: 43,
  },

  cartPickerStoreContent: {
    flex: 1,
    marginHorizontal: 17,
  },

  cartPickerStoreName: {
    color: '#1d1d1d',
    fontSize: 21,
    fontWeight: '700',
    lineHeight: 28,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  cartPickerItemCount: {
    color: '#444444',
    fontSize: 17,
    marginTop: 8,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  cartPickerPrice: {
    color: '#1d1d1d',
    fontSize: 19,
    fontWeight: '700',
    minWidth: 120,
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
    fontSize: 15,
    lineHeight: 25,
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

  pageContent: {
    paddingBottom: 150,
  },

  /* ---------------------------------- */
  /* HEADER                             */
  /* ---------------------------------- */

  header: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 54,
    paddingBottom: 28,
  },

  backButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e5e5e5',
    borderRadius: 31,
    borderWidth: 1,
    height: 62,
    justifyContent: 'center',
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

  headerStoreName: {
    color: '#8a8a8a',
    fontSize: 14,
    marginTop: 3,
  },

  clearCartButton: {
    paddingHorizontal: 7,
    paddingVertical: 10,
  },

  clearCartButtonText: {
    color: '#777777',
    fontSize: 13,
    fontWeight: '700',
  },

  /* ---------------------------------- */
  /* CART ITEMS                         */
  /* ---------------------------------- */

  itemsSection: {
    paddingHorizontal: 24,
  },

  itemRow: {
    flexDirection: 'row',
    minHeight: 245,
    paddingBottom: 26,
    paddingTop: 11,
    borderBottomColor: '#e8e8e8',
    borderBottomWidth: 1,
  },

  itemRowLast: {
    borderBottomWidth: 0,
  },

  itemContent: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingRight: 20,
  },

  itemName: {
    color: '#242424',
    fontSize: 21,
    fontWeight: '700',
    lineHeight: 28,
    textAlign: 'left',
  },

  variantName: {
    color: '#777777',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
    textAlign: 'left',
    width: '100%',
  },

  editButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    marginTop: 13,
    paddingVertical: 3,
  },

  editButtonText: {
    borderBottomColor: BRAND_GREEN,
    borderBottomWidth: 1,
    color: BRAND_GREEN,
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 7,
  },

  itemPriceContainer: {
    marginTop: 'auto',
    paddingBottom: 8,
  },

  itemPrice: {
    color: '#242424',
    fontSize: 19,
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
    fontSize: 59,
  },

  quantityControl: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e4e4e4',
    borderRadius: 31,
    borderWidth: 1,
    bottom: -11,
    flexDirection: 'row',
    height: 60,
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
    borderRadius: 26,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },

  quantityText: {
    color: '#242424',
    fontSize: 19,
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
    paddingBottom: 27,
    paddingTop: 29,
  },

  recommendationsTitle: {
    color: '#242424',
    fontSize: 25,
    fontWeight: '800',
    paddingHorizontal: 24,
  },

  recommendationsScroll: {
    gap: 14,
    paddingHorizontal: 14,
    paddingTop: 23,
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
    fontSize: 49,
  },

  recommendationAddButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e5e5e5',
    borderRadius: 29,
    borderWidth: 1,
    bottom: 10,
    height: 57,
    justifyContent: 'center',
    position: 'absolute',
    right: 10,
    width: 57,

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
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 21,
    marginTop: 13,
  },

  recommendationPrice: {
    color: '#363636',
    fontSize: 15,
    marginTop: 6,
  },

  /* ---------------------------------- */
  /* SUMMARY                            */
  /* ---------------------------------- */

  orderSummarySection: {
    borderTopColor: '#f1f1f1',
    borderTopWidth: 1,
    marginTop: 23,
    paddingHorizontal: 24,
    paddingTop: 26,
  },

  orderSummaryTitle: {
    color: '#242424',
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 20,
  },

  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  summaryLabel: {
    color: '#696969',
    fontSize: 15,
  },

  summaryValue: {
    color: '#303030',
    fontSize: 15,
    fontWeight: '600',
  },

  paymentFeeLabelContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },

  paymentFeeDescription: {
    color: '#8a8a8a',
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 16,
    marginTop: -6,
  },

  summaryDivider: {
    backgroundColor: '#eeeeee',
    height: 1,
    marginBottom: 17,
  },

  totalLabel: {
    color: '#202020',
    fontSize: 18,
    fontWeight: '800',
  },

  totalValue: {
    color: '#202020',
    fontSize: 19,
    fontWeight: '800',
  },

  minimumNotice: {
    alignItems: 'center',
    backgroundColor: '#fff8e7',
    borderRadius: 14,
    flexDirection: 'row',
    marginHorizontal: 24,
    marginTop: 15,
    padding: 13,
  },

  minimumNoticeText: {
    color: '#82651f',
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
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

  checkoutBar: {
    flexDirection: 'row',
    gap: 16,
  },

  addItemsButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#252525',
    borderRadius: 31,
    borderWidth: 1.5,
    flex: 1,
    height: 64,
    justifyContent: 'center',
  },

  addItemsButtonText: {
    color: '#242424',
    fontSize: 17,
    fontWeight: '800',
  },

  checkoutButton: {
    alignItems: 'center',
    backgroundColor: BRAND_GREEN,
    borderRadius: 31,
    flex: 1,
    height: 64,
    justifyContent: 'center',
  },

  checkoutButtonDisabled: {
    backgroundColor: '#dddddd',
  },

  checkoutButtonText: {
    color: '#ffffff',
    fontSize: 17,
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
    borderRadius: 25,
    maxWidth: 430,
    padding: 25,
    width: '100%',
  },

  modalDangerIcon: {
    alignItems: 'center',
    backgroundColor: '#fff1f1',
    borderRadius: 40,
    height: 78,
    justifyContent: 'center',
    width: 78,
  },

  modalTitle: {
    color: '#242424',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 18,
  },

  modalDescription: {
    color: '#777777',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 9,
    textAlign: 'center',
  },

  dangerButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#d84a4a',
    borderRadius: 16,
    marginTop: 23,
    paddingVertical: 15,
  },

  dangerButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },

  modalCancelButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#f2f2f2',
    borderRadius: 16,
    marginTop: 10,
    paddingVertical: 15,
  },

  modalCancelButtonText: {
    color: '#555555',
    fontSize: 14,
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
    borderRadius: 30,
    borderWidth: 1,
    height: 60,
    justifyContent: 'center',
    left: 24,
    position: 'absolute',
    top: 54,
    width: 60,
  },

  emptyContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  emptyIconContainer: {
    alignItems: 'center',
    backgroundColor:
      BRAND_GREEN_SOFT,
    borderRadius: 48,
    height: 96,
    justifyContent: 'center',
    width: 96,
  },

  emptyTitle: {
    color: '#242424',
    fontSize: 25,
    fontWeight: '800',
    marginTop: 22,
  },

  emptyDescription: {
    color: '#7c7c7c',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
  },

  primaryButton: {
    alignItems: 'center',
    backgroundColor: BRAND_GREEN,
    borderRadius: 29,
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

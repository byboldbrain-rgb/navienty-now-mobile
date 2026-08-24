import { Ionicons } from '@expo/vector-icons';
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import getAppBootstrap from '../../services/bootstrap-service';
import {
  type CatalogProduct,
  type StoreCatalog,
  getStoreCatalog,
} from '../../services/catalog-service';

import {
  isRestaurantCartCategory,
  useCartStore,
} from '../../store/cart-store';

const BRAND_GREEN = '#00B14F';
const BRAND_GREEN_DARK = '#009A45';

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

/**
 * Product image priority:
 *
 * 1. now.products.image_url
 * 2. Cover image from now.product_images
 * 3. First valid active product image returned by get_store_catalog
 *
 * The catalog RPC already returns product.imageUrl and product.images,
 * so the screen does not need any direct database query.
 */
function getProductImage(
  product: CatalogProduct,
): string | null {
  if (isImageUri(product.imageUrl)) {
    return product.imageUrl;
  }

  const coverImage =
    product.images.find(
      (image) =>
        image.isCover &&
        isImageUri(image.imageUrl),
    );

  if (coverImage) {
    return coverImage.imageUrl;
  }

  const firstImage =
    product.images.find(
      (image) =>
        isImageUri(image.imageUrl),
    );

  return firstImage?.imageUrl ?? null;
}

export default function StoreScreen() {
  const router = useRouter();

  const params =
    useLocalSearchParams<{
      id?: string | string[];
    }>();

  const rawId = Array.isArray(
    params.id,
  )
    ? params.id[0]
    : params.id;

  const scrollRef =
    useRef<ScrollView>(null);

  const sectionPositions =
    useRef<Record<string, number>>(
      {},
    );

  const [catalog, setCatalog] =
    useState<StoreCatalog | null>(
      null,
    );


  const [
    currencySymbol,
    setCurrencySymbol,
  ] = useState('EGP');

  const [isLoading, setIsLoading] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const [
    pendingProduct,
    setPendingProduct,
  ] = useState<CatalogProduct | null>(
    null,
  );

  const [
    pendingVariantId,
    setPendingVariantId,
  ] = useState<string | null>(null);

  const [
    pendingQuantity,
    setPendingQuantity,
  ] = useState(1);

  const [
    selectedProduct,
    setSelectedProduct,
  ] = useState<CatalogProduct | null>(
    null,
  );

  const [
    selectedVariantId,
    setSelectedVariantId,
  ] = useState<string | null>(
    null,
  );

  const [
    selectedProductQuantity,
    setSelectedProductQuantity,
  ] = useState(1);

  const [
    activeSectionId,
    setActiveSectionId,
  ] = useState<string | null>(
    null,
  );

  const [
    failedProductImages,
    setFailedProductImages,
  ] = useState<Record<string, boolean>>(
    {},
  );

  const carts = useCartStore(
    (state) => state.carts,
  );

  const addItem = useCartStore(
    (state) => state.addItem,
  );

  const increaseStoreItem = useCartStore(
    (state) => state.increaseStoreItem,
  );

  const decreaseStoreItem = useCartStore(
    (state) => state.decreaseStoreItem,
  );

  const clearStoreCart = useCartStore(
    (state) => state.clearStoreCart,
  );

  const setActiveCart = useCartStore(
    (state) => state.setActiveCart,
  );

  async function loadStoreData() {
    if (!rawId) {
      setCatalog(null);

      setErrorMessage(
        'لم يتم تحديد المتجر المطلوب.',
      );

      setIsLoading(false);

      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);

      const [
        loadedCatalog,
        loadedBootstrap,
      ] = await Promise.all([
        getStoreCatalog(rawId),
        getAppBootstrap(),
      ]);

      setCatalog(loadedCatalog);

      setCurrencySymbol(
        loadedBootstrap.settings
          .currency_symbol || 'EGP',
      );

      if (
        loadedCatalog.sections.length >
        0
      ) {
        setActiveSectionId(
          loadedCatalog.sections[0].id,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر تحميل بيانات المتجر.';

      setCatalog(null);
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadStoreData();
  }, [rawId]);


  if (isLoading) {
    return (
      <View style={styles.stateScreen}>
        <ActivityIndicator
          size="large"
          color={BRAND_GREEN}
        />

        <Text style={styles.stateTitle}>
          جاري تحميل المطعم
        </Text>

        <Text
          style={styles.stateDescription}
        >
          يتم تحميل المنتجات والأسعار.
        </Text>
      </View>
    );
  }

  if (!catalog || errorMessage) {
    return (
      <View style={styles.stateScreen}>
        <View
          style={
            styles.stateIconContainer
          }
        >
          <Ionicons
            name="restaurant-outline"
            size={28}
            color={BRAND_GREEN}
          />
        </View>

        <Text style={styles.stateTitle}>
          المطعم غير متاح
        </Text>

        <Text
          style={styles.stateDescription}
        >
          {errorMessage ??
            'لم نتمكن من العثور على بيانات المطعم.'}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.retryButton,

            pressed &&
              styles.buttonPressed,
          ]}
          onPress={() => {
            void loadStoreData();
          }}
        >
          <Text
            style={
              styles.retryButtonText
            }
          >
            إعادة المحاولة
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.errorButton,

            pressed &&
              styles.buttonPressed,
          ]}
          onPress={() =>
            router.replace('/')
          }
        >
          <Text
            style={
              styles.errorButtonText
            }
          >
            العودة للرئيسية
          </Text>
        </Pressable>
      </View>
    );
  }

  const currentStore =
    catalog.store;

  const delivery =
    catalog.delivery;

  const productSections =
    catalog.sections;

  const currentCart =
    carts[currentStore.id] ?? null;

  const cartItems =
    currentCart?.items ?? [];

  const cartItemCount =
    cartItems.reduce(
      (total, item) =>
        total + item.quantity,
      0,
    );

  const cartSubtotal =
    cartItems.reduce(
      (total, item) =>
        total +
        item.price *
          item.quantity,
      0,
    );

  const conflictingRestaurantCart =
    isRestaurantCartCategory(
      currentStore.categorySlug,
    )
      ? Object.values(carts).find(
          (cart) =>
            cart.storeId !==
              currentStore.id &&
            cart.items.length > 0 &&
            isRestaurantCartCategory(
              cart.categorySlug,
            ),
        ) ?? null
      : null;

  const storeIsClosed =
    currentStore.isManuallyClosed;

  const storeCoverImage =
    isImageUri(
      currentStore.coverImageUrl,
    )
      ? currentStore.coverImageUrl
      : null;

  const storeLogoImage =
    isImageUri(
      currentStore.logoUrl,
    )
      ? currentStore.logoUrl
      : null;

  const selectedVariant =
    selectedProduct?.variants.find(
      (variant) =>
        variant.id ===
        selectedVariantId,
    ) ?? null;

  const pendingVariant =
    pendingProduct?.variants.find(
      (variant) =>
        variant.id ===
        pendingVariantId,
    ) ?? null;

  function markProductImageAsFailed(
    imageUrl: string,
  ) {
    setFailedProductImages(
      (currentImages) => ({
        ...currentImages,
        [imageUrl]: true,
      }),
    );
  }

  function canDisplayProductImage(
    imageUrl: string | null,
  ) {
    return (
      !!imageUrl &&
      !failedProductImages[imageUrl]
    );
  }

  function formatPrice(
    value:
      | number
      | string
      | null
      | undefined,
  ) {
    const numericValue =
      Number(value ?? 0);

    return `${currencySymbol} ${numericValue.toFixed(
      2,
    )}`;
  }

  function getProductDisplayPrice(
    product: CatalogProduct,
  ) {
    if (
      !product.variants ||
      product.variants.length === 0
    ) {
      return product.price;
    }

    return Math.min(
      ...product.variants.map(
        (variant) => variant.price,
      ),
    );
  }

  function openProductDetails(
    product: CatalogProduct,
  ) {
    if (
      storeIsClosed ||
      product.variants.length === 0
    ) {
      return;
    }

    setSelectedProduct(product);
    setSelectedProductQuantity(1);

    if (product.variants.length === 1) {
      setSelectedVariantId(
        product.variants[0].id,
      );
    } else {
      setSelectedVariantId(null);
    }
  }

  function closeProductDetails() {
    setSelectedProduct(null);
    setSelectedVariantId(null);
    setSelectedProductQuantity(1);
  }

  function clearPendingCartRequest() {
    setPendingProduct(null);
    setPendingVariantId(null);
    setPendingQuantity(1);
  }

  function buildCartProduct(
    product: CatalogProduct,
    variant:
      | CatalogProduct['variants'][number]
      | null,
  ) {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price:
        variant?.price ??
        product.price,
      icon: product.icon,

      variantId:
        variant?.id ?? null,

      variantName:
        variant?.name ?? null,
    };
  }

  function addProductToCart(
    product: CatalogProduct,
  ) {
    if (storeIsClosed) {
      return;
    }

    const result = addItem(
      {
        id: currentStore.id,
        name: currentStore.name,
        icon: currentStore.icon,
        categorySlug:
          currentStore.categorySlug,
        deliveryFee:
          delivery.deliveryFee,
        minimumOrder:
          delivery.minimumOrder,
      },
      {
        id: product.id,
        name: product.name,
        description:
          product.description,
        price: product.price,
        icon: product.icon,
        variantId: null,
        variantName: null,
      },
    );

    if (
      result ===
      'different-restaurant'
    ) {
      setPendingProduct(product);
      setPendingVariantId(null);
      setPendingQuantity(1);
    }
  }

  function addConfiguredProductToCart() {
    if (
      !selectedProduct ||
      !selectedVariant ||
      storeIsClosed
    ) {
      return;
    }

    const cartProduct =
      buildCartProduct(
        selectedProduct,
        selectedVariant,
      );

    const storeInformation = {
      id: currentStore.id,
      name: currentStore.name,
      icon: currentStore.icon,
      categorySlug:
        currentStore.categorySlug,
      deliveryFee:
        delivery.deliveryFee,
      minimumOrder:
        delivery.minimumOrder,
    };

    const result = addItem(
      storeInformation,
      cartProduct,
    );

    if (
      result ===
      'different-restaurant'
    ) {
      setPendingProduct(
        selectedProduct,
      );
      setPendingVariantId(
        selectedVariant.id,
      );
      setPendingQuantity(
        selectedProductQuantity,
      );

      closeProductDetails();

      return;
    }

    for (
      let index = 1;
      index <
      selectedProductQuantity;
      index += 1
    ) {
      addItem(
        storeInformation,
        cartProduct,
      );
    }

    closeProductDetails();
  }

  function increaseProductQuantity(
    product: CatalogProduct,
  ) {
    if (storeIsClosed) {
      return;
    }

    const itemExistsInCurrentStore =
      cartItems.some(
        (item) =>
          item.id === product.id &&
          item.variantId === null,
      );

    if (itemExistsInCurrentStore) {
      increaseStoreItem(
        currentStore.id,
        product.id,
        null,
      );

      return;
    }

    addProductToCart(product);
  }

  function decreaseProductQuantity(
    productId: string,
  ) {
    decreaseStoreItem(
      currentStore.id,
      productId,
      null,
    );
  }

  function replaceCartAndAddProduct() {
    if (
      !pendingProduct ||
      storeIsClosed
    ) {
      return;
    }

    if (conflictingRestaurantCart) {
      clearStoreCart(
        conflictingRestaurantCart.storeId,
      );
    }

    const cartProduct =
      buildCartProduct(
        pendingProduct,
        pendingVariant,
      );

    const storeInformation = {
      id: currentStore.id,
      name: currentStore.name,
      icon: currentStore.icon,
      categorySlug:
        currentStore.categorySlug,
      deliveryFee:
        delivery.deliveryFee,
      minimumOrder:
        delivery.minimumOrder,
    };

    const result = addItem(
      storeInformation,
      cartProduct,
    );

    if (
      result !==
      'different-restaurant'
    ) {
      for (
        let index = 1;
        index < pendingQuantity;
        index += 1
      ) {
        addItem(
          storeInformation,
          cartProduct,
        );
      }
    }

    clearPendingCartRequest();
  }

  function openCart() {
    clearPendingCartRequest();
    setActiveCart(currentStore.id);

    router.push({
      pathname: '/cart',
      params: {
        storeId: currentStore.id,
      },
    });
  }

  function handleSectionLayout(
    sectionId: string,
    event: LayoutChangeEvent,
  ) {
    sectionPositions.current[
      sectionId
    ] =
      event.nativeEvent.layout.y;
  }

  function scrollToSection(
    sectionId: string,
  ) {
    setActiveSectionId(sectionId);

    const sectionY =
      sectionPositions.current[
        sectionId
      ];

    if (
      typeof sectionY !==
      'number'
    ) {
      return;
    }

    scrollRef.current?.scrollTo({
      y: Math.max(
        0,
        sectionY - 70,
      ),
      animated: true,
    });
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.pageContent,

          cartItemCount > 0 &&
            styles.pageContentWithBottomBar,
        ]}
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* HERO */}

        <View style={styles.hero}>
          {storeCoverImage ? (
            <ImageBackground
              source={{
                uri: storeCoverImage,
              }}
              resizeMode="cover"
              style={
                styles.heroBackground
              }
              imageStyle={
                styles.heroImage
              }
            >
              <View
                style={styles.heroOverlay}
              />
            </ImageBackground>
          ) : (
            <View
              style={
                styles.heroFallback
              }
            >
              <View
                style={
                  styles.heroFallbackCircleOne
                }
              />

              <View
                style={
                  styles.heroFallbackCircleTwo
                }
              />

              <Text
                style={
                  styles.heroFallbackIcon
                }
              >
                {currentStore.icon ||
                  '🍽️'}
              </Text>
            </View>
          )}

          {/* TOP BUTTONS */}

          <View style={styles.topBar}>
            <Pressable
              style={({ pressed }) => [
                styles.topCircleButton,

                pressed &&
                  styles.topCircleButtonPressed,
              ]}
              onPress={() =>
                router.back()
              }
            >
              <Ionicons
                name="arrow-back"
                size={20}
                color="#242424"
              />
            </Pressable>

          </View>
        </View>

        {/* STORE CARD */}

        <View
          style={
            styles.storeCardWrapper
          }
        >
          <View style={styles.storeCard}>
            <View
              style={
                styles.storeMainRow
              }
            >
              <View
                style={
                  styles.storeLogoContainer
                }
              >
                {storeLogoImage ? (
                  <Image
                    source={{
                      uri: storeLogoImage,
                    }}
                    style={
                      styles.storeLogoImage
                    }
                    resizeMode="cover"
                  />
                ) : (
                  <Text
                    style={
                      styles.storeLogoFallback
                    }
                  >
                    {currentStore.icon ||
                      '🍽️'}
                  </Text>
                )}
              </View>

              <View
                style={
                  styles.storeMainContent
                }
              >
                <Text
                  style={
                    styles.storeName
                  }
                  numberOfLines={1}
                >
                  {currentStore.name}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* CLOSED NOTICE */}

        {storeIsClosed && (
          <View
            style={
              styles.closedNotice
            }
          >
            <View
              style={
                styles.closedNoticeIcon
              }
            >
              <Ionicons
                name="close"
                size={12}
                color="#ffffff"
              />
            </View>

            <Text
              style={
                styles.closedNoticeText
              }
            >
              {currentStore.manualClosedNote ??
                'المطعم مغلق مؤقتًا ولا يستقبل طلبات الآن.'}
            </Text>
          </View>
        )}

        {/* CATEGORY NAVIGATION */}

        {productSections.length >
          0 && (
          <View
            style={
              styles.categoryNavigation
            }
          >
            <ScrollView
              horizontal
              style={styles.categoryScroll}
              showsHorizontalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.categoryScrollContent
              }
            >
              {productSections.map(
                (section) => {
                  const isActive =
                    activeSectionId ===
                    section.id;

                  return (
                    <Pressable
                      key={
                        section.id
                      }
                      onPress={() =>
                        scrollToSection(
                          section.id,
                        )
                      }
                      style={
                        styles.categoryTab
                      }
                    >
                      <Text
                        style={[
                          styles.categoryTabText,

                          isActive &&
                            styles.categoryTabTextActive,
                        ]}
                        numberOfLines={
                          1
                        }
                      >
                        {
                          section.name
                        }
                      </Text>

                      <View
                        style={[
                          styles.categoryUnderline,

                          isActive &&
                            styles.categoryUnderlineActive,
                        ]}
                      />
                    </Pressable>
                  );
                },
              )}
            </ScrollView>
          </View>
        )}

        {/* PRODUCTS */}

        {productSections.length ===
        0 ? (
          <View
            style={
              styles.emptyCatalog
            }
          >
            <View
              style={
                styles.emptyCatalogIconContainer
              }
            >
              <Ionicons
                name="restaurant-outline"
                size={28}
                color={BRAND_GREEN}
              />
            </View>

            <Text
              style={
                styles.emptyCatalogTitle
              }
            >
              {'لا توجد منتجات متاحة'}
            </Text>

            <Text
              style={
                styles.emptyCatalogDescription
              }
            >
              {'لم تتم إضافة منتجات مفعّلة لهذا المطعم بعد.'}
            </Text>
          </View>
        ) : (
          productSections.map(
            (section) => (
              <View
                key={section.id}
                style={
                  styles.productsSection
                }
                onLayout={(event) =>
                  handleSectionLayout(
                    section.id,
                    event,
                  )
                }
              >
                <Text
                  style={
                    styles.productsSectionTitle
                  }
                >
                  {section.name}
                </Text>

                <View
                  style={
                    styles.productsList
                  }
                >
                  {section.products.map(
                    (
                      product,
                      index,
                    ) => {
                      const cartItem =
                        cartItems.find(
                          (item) =>
                            item.id ===
                              product.id &&
                            item.variantId ===
                              null,
                        );

                      const quantity =
                        cartItem?.quantity ??
                        0;

                      const productImage =
                        getProductImage(
                          product,
                        );

                      const hasVariants =
                        product.variants.length >
                        0;

                      const displayPrice =
                        getProductDisplayPrice(
                          product,
                        );

                      return (
                        <Pressable
                          key={
                            product.id
                          }
                          disabled={
                            storeIsClosed
                          }
                          onPress={() => {
                            if (
                              hasVariants
                            ) {
                              openProductDetails(
                                product,
                              );
                            }
                          }}
                          style={({ pressed }) => [
                            styles.productRow,

                            pressed &&
                              hasVariants &&
                              !storeIsClosed &&
                              styles.productRowPressed,

                            index ===
                              section
                                .products
                                .length -
                                1 &&
                              styles.productRowLast,
                          ]}
                        >
                          {/* PRODUCT TEXT */}

                          <View
                            style={
                              styles.productContent
                            }
                          >
                            <Text
                              style={
                                styles.productName
                              }
                              numberOfLines={
                                2
                              }
                            >
                              {
                                product.name
                              }
                            </Text>

                            {!!product.description && (
                              <Text
                                style={
                                  styles.productDescription
                                }
                                numberOfLines={
                                  3
                                }
                              >
                                {
                                  product.description
                                }
                              </Text>
                            )}

                            <View
                              style={
                                styles.productBottomContent
                              }
                            >
                              {!hasVariants && (
                                <Text
                                  style={
                                    styles.productPrice
                                  }
                                >
                                  {formatPrice(
                                    displayPrice,
                                  )}
                                </Text>
                              )}

                              {hasVariants && (
                                <Text
                                  style={
                                    styles.productVariantHint
                                  }
                                >
                                  اختر الحجم
                                </Text>
                              )}

                              {product.isAgeRestricted && (
                                <View
                                  style={
                                    styles.warningBadge
                                  }
                                >
                                  <Text
                                    style={
                                      styles.warningBadgeText
                                    }
                                  >
                                    مقيّد
                                    بالعمر
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>

                          {/* PRODUCT IMAGE */}

                          <View
                            style={
                              styles.productImageWrapper
                            }
                          >
                            {canDisplayProductImage(
                              productImage,
                            ) ? (
                              <Image
                                source={{
                                  uri: productImage!,
                                }}
                                style={
                                  styles.productImage
                                }
                                resizeMode="cover"
                                onError={() => {
                                  markProductImageAsFailed(
                                    productImage!,
                                  );
                                }}
                              />
                            ) : (
                              <View
                                style={
                                  styles.productImageFallback
                                }
                              >
                                <Ionicons
                                  name="image-outline"
                                  size={30}
                                  color="#b9b9b9"
                                />
                              </View>
                            )}

                            {/* ADD / VARIANT / QUANTITY */}

                            {hasVariants ? (
                              <Pressable
                                disabled={
                                  storeIsClosed
                                }
                                onPress={(
                                  event,
                                ) => {
                                  event.stopPropagation();

                                  openProductDetails(
                                    product,
                                  );
                                }}
                                style={({
                                  pressed,
                                }) => [
                                  styles.productVariantButton,

                                  storeIsClosed &&
                                    styles.disabledButton,

                                  pressed &&
                                    !storeIsClosed &&
                                    styles.productAddButtonPressed,
                                ]}
                              >
                                <Ionicons
                                  name="chevron-forward"
                                  size={22}
                                  color={
                                    BRAND_GREEN
                                  }
                                />
                              </Pressable>
                            ) : quantity ===
                              0 ? (
                              <Pressable
                                disabled={
                                  storeIsClosed
                                }
                                onPress={(
                                  event,
                                ) => {
                                  event.stopPropagation();

                                  addProductToCart(
                                    product,
                                  );
                                }}
                                style={({
                                  pressed,
                                }) => [
                                  styles.productAddButton,

                                  storeIsClosed &&
                                    styles.disabledButton,

                                  pressed &&
                                    !storeIsClosed &&
                                    styles.productAddButtonPressed,
                                ]}
                              >
                                <Ionicons
                                  name="add"
                                  size={22}
                                  color={
                                    BRAND_GREEN
                                  }
                                />
                              </Pressable>
                            ) : (
                              <View
                                style={
                                  styles.productQuantityContainer
                                }
                              >
                                <Pressable
                                  disabled={
                                    storeIsClosed
                                  }
                                  onPress={(
                                    event,
                                  ) => {
                                    event.stopPropagation();

                                    increaseProductQuantity(
                                      product,
                                    );
                                  }}
                                  style={({
                                    pressed,
                                  }) => [
                                    styles.productQuantityButton,

                                    pressed &&
                                      styles.buttonPressed,
                                  ]}
                                >
                                  <Ionicons
                                    name="add"
                                    size={
                                      16
                                    }
                                    color="#ffffff"
                                  />
                                </Pressable>

                                <Text
                                  style={
                                    styles.productQuantityText
                                  }
                                >
                                  {
                                    quantity
                                  }
                                </Text>

                                <Pressable
                                  onPress={(
                                    event,
                                  ) => {
                                    event.stopPropagation();

                                    decreaseProductQuantity(
                                      product.id,
                                    );
                                  }}
                                  style={({
                                    pressed,
                                  }) => [
                                    styles.productQuantityButton,

                                    pressed &&
                                      styles.buttonPressed,
                                  ]}
                                >
                                  <Ionicons
                                    name="remove"
                                    size={
                                      16
                                    }
                                    color="#ffffff"
                                  />
                                </Pressable>
                              </View>
                            )}
                          </View>
                        </Pressable>
                      );
                    },
                  )}
                </View>
              </View>
            ),
          )
        )}
      </ScrollView>

      {/* PRODUCT OPTIONS MODAL */}

      <Modal
        visible={
          selectedProduct !== null
        }
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={
          closeProductDetails
        }
      >
        <View
          style={
            styles.productModalScreen
          }
        >
          {selectedProduct && (
            <>
              <ScrollView
                showsVerticalScrollIndicator={
                  false
                }
                contentContainerStyle={
                  styles.productModalScrollContent
                }
              >
                <View
                  style={
                    styles.productModalHero
                  }
                >
                  {canDisplayProductImage(
                    getProductImage(
                      selectedProduct,
                    ),
                  ) ? (
                    <Image
                      source={{
                        uri:
                          getProductImage(
                            selectedProduct,
                          )!,
                      }}
                      style={
                        styles.productModalImage
                      }
                      resizeMode="cover"
                      onError={() => {
                        const imageUrl =
                          getProductImage(
                            selectedProduct,
                          );

                        if (imageUrl) {
                          markProductImageAsFailed(
                            imageUrl,
                          );
                        }
                      }}
                    />
                  ) : (
                    <View
                      style={
                        styles.productModalImageFallback
                      }
                    >
                      <Ionicons
                        name="image-outline"
                        size={42}
                        color="#b9b9b9"
                      />
                    </View>
                  )}

                  <Pressable
                    onPress={
                      closeProductDetails
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.productModalCloseButton,

                      pressed &&
                        styles.topCircleButtonPressed,
                    ]}
                  >
                    <Ionicons
                      name="close"
                      size={22}
                      color="#242424"
                    />
                  </Pressable>
                </View>

                <View
                  style={
                    styles.productModalBody
                  }
                >
                  <Text
                    style={
                      styles.productModalTitle
                    }
                  >
                    {
                      selectedProduct.name
                    }
                  </Text>

                  {!!selectedProduct.description && (
                    <Text
                      style={
                        styles.productModalDescription
                      }
                    >
                      {
                        selectedProduct.description
                      }
                    </Text>
                  )}

                  {selectedProduct.variants
                    .length > 0 && (
                    <View
                      style={
                        styles.variantSection
                      }
                    >
                      <View
                        style={
                          styles.variantSectionHeader
                        }
                      >
                        <View>
                          <Text
                            style={
                              styles.variantSectionTitle
                            }
                          >
                            اختر الحجم:
                          </Text>

                          <Text
                            style={
                              styles.variantSectionSubtitle
                            }
                          >
                            اختر اختيارًا
                            واحدًا
                          </Text>
                        </View>

                        <View
                          style={
                            styles.requiredBadge
                          }
                        >
                          <Text
                            style={
                              styles.requiredBadgeText
                            }
                          >
                            مطلوب
                          </Text>
                        </View>
                      </View>

                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={
                          false
                        }
                        contentContainerStyle={
                          styles.variantCardsContainer
                        }
                      >
                        {selectedProduct.variants.map(
                          (
                            variant,
                          ) => {
                            const isSelected =
                              selectedVariantId ===
                              variant.id;

                            return (
                              <Pressable
                                key={
                                  variant.id
                                }
                                onPress={() =>
                                  setSelectedVariantId(
                                    variant.id,
                                  )
                                }
                                style={({
                                  pressed,
                                }) => [
                                  styles.variantCard,

                                  isSelected &&
                                    styles.variantCardSelected,

                                  pressed &&
                                    styles.variantCardPressed,
                                ]}
                              >
                                <View
                                  style={[
                                    styles.variantRadio,

                                    isSelected &&
                                      styles.variantRadioSelected,
                                  ]}
                                >
                                  {isSelected && (
                                    <View
                                      style={
                                        styles.variantRadioDot
                                      }
                                    />
                                  )}
                                </View>

                                <Text
                                  style={
                                    styles.variantName
                                  }
                                  numberOfLines={
                                    1
                                  }
                                >
                                  {
                                    variant.name
                                  }
                                </Text>

                                <Text
                                  style={
                                    styles.variantPrice
                                  }
                                >
                                  {formatPrice(
                                    variant.price,
                                  )}
                                </Text>
                              </Pressable>
                            );
                          },
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </ScrollView>

              <View
                style={
                  styles.productModalBottomBar
                }
              >
                {!selectedVariant && (
                  <Text
                    style={
                      styles.productModalRequiredHint
                    }
                  >
                    اختر الحجم لإضافة
                    المنتج
                  </Text>
                )}

                <View
                  style={
                    styles.productModalBottomRow
                  }
                >
                  <View
                    style={
                      styles.modalQuantityControl
                    }
                  >
                    <Pressable
                      disabled={
                        selectedProductQuantity <=
                        1
                      }
                      onPress={() =>
                        setSelectedProductQuantity(
                          (quantity) =>
                            Math.max(
                              1,
                              quantity -
                                1,
                            ),
                        )
                      }
                      style={
                        styles.modalQuantityButton
                      }
                    >
                      <Ionicons
                        name="remove"
                        size={20}
                        color={
                          selectedProductQuantity <=
                          1
                            ? '#b8b8b8'
                            : '#555555'
                        }
                      />
                    </Pressable>

                    <Text
                      style={
                        styles.modalQuantityText
                      }
                    >
                      {
                        selectedProductQuantity
                      }
                    </Text>

                    <Pressable
                      onPress={() =>
                        setSelectedProductQuantity(
                          (quantity) =>
                            quantity + 1,
                        )
                      }
                      style={
                        styles.modalQuantityButton
                      }
                    >
                      <Ionicons
                        name="add"
                        size={21}
                        color={
                          BRAND_GREEN
                        }
                      />
                    </Pressable>
                  </View>

                  <Pressable
                    disabled={
                      !selectedVariant ||
                      storeIsClosed
                    }
                    onPress={
                      addConfiguredProductToCart
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.modalAddItemButton,

                      (!selectedVariant ||
                        storeIsClosed) &&
                        styles.modalAddItemButtonDisabled,

                      pressed &&
                        selectedVariant &&
                        !storeIsClosed &&
                        styles.modalAddItemButtonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalAddItemButtonText,

                        (!selectedVariant ||
                          storeIsClosed) &&
                          styles.modalAddItemButtonTextDisabled,
                      ]}
                    >
                      {selectedVariant
                        ? `أضف للسلة • ${formatPrice(
                            selectedVariant.price *
                              selectedProductQuantity,
                          )}`
                        : 'أضف للسلة'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* CART BOTTOM BAR */}

      {cartItemCount > 0 ? (
        <View
          style={
            styles.cartBarWrapper
          }
        >
          <Pressable
            style={({ pressed }) => [
              styles.cartBar,

              pressed &&
                styles.cartBarPressed,
            ]}
            onPress={openCart}
          >
            <View
              style={
                styles.cartCountCircle
              }
            >
              <Text
                style={
                  styles.cartCountText
                }
              >
                {cartItemCount}
              </Text>
            </View>

            <Text
              style={
                styles.cartButtonText
              }
            >
              عرض السلة
            </Text>

            <Text
              style={
                styles.cartPrice
              }
            >
              {formatPrice(
                cartSubtotal,
              )}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* DIFFERENT RESTAURANT CART MODAL */}

      <Modal
        visible={pendingProduct !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={clearPendingCartRequest}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={clearPendingCartRequest}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(event) =>
              event.stopPropagation()
            }
          >
            <Text style={styles.modalTitle}>
              بدء سلة جديدة؟
            </Text>

            <Text
              style={styles.modalDescription}
            >
              عند بدء طلب جديد، سيتم إزالة سلة
              مشترياتك من «
              {conflictingRestaurantCart?.storeName ??
                'المطعم الحالي'}
              ».
            </Text>

            <View style={styles.modalActionsRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.replaceCartButton,
                  pressed &&
                    styles.modalActionPressed,
                ]}
                onPress={
                  replaceCartAndAddProduct
                }
              >
                <Text
                  style={
                    styles.replaceCartButtonText
                  }
                >
                  تأكيد البدء
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed &&
                    styles.modalActionPressed,
                ]}
                onPress={
                  clearPendingCartRequest
                }
              >
                <Text
                  style={
                    styles.cancelButtonText
                  }
                >
                  إلغاء
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },

  pageContent: {
    flexGrow: 1,
    paddingBottom: 36,
  },

  pageContentWithBottomBar: {
    paddingBottom: 140,
  },

  /* ---------------------------------- */
  /* HERO                               */
  /* ---------------------------------- */

  hero: {
    height: 355,
    overflow: 'hidden',
    position: 'relative',
  },

  heroBackground: {
    height: '100%',
    width: '100%',
  },

  heroImage: {
    backgroundColor: '#eeeeee',
  },

  heroOverlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,

    backgroundColor:
      'rgba(0,0,0,0.13)',
  },

  heroFallback: {
    alignItems: 'center',
    backgroundColor:
      BRAND_GREEN,
    height: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  heroFallbackCircleOne: {
    backgroundColor:
      'rgba(255,255,255,0.11)',
    borderRadius: 180,
    height: 360,
    position: 'absolute',
    right: -100,
    top: -130,
    width: 360,
  },

  heroFallbackCircleTwo: {
    backgroundColor:
      'rgba(255,255,255,0.08)',
    borderRadius: 130,
    bottom: -120,
    height: 260,
    left: -80,
    position: 'absolute',
    width: 260,
  },

  heroFallbackIcon: {
    fontSize: 90,
  },

  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent:
      'space-between',
    left: 0,
    paddingHorizontal: 22,
    paddingTop: 52,
    position: 'absolute',
    right: 0,
    top: 0,
  },


  topCircleButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor:
      'rgba(0,0,0,0.08)',
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',

    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.12,
    shadowRadius: 5,

    elevation: 4,

    width: 48,
  },

  topCircleButtonPressed: {
    opacity: 0.88,
    transform: [
      {
        scale: 0.96,
      },
    ],
  },

  /* ---------------------------------- */
  /* STORE CARD                         */
  /* ---------------------------------- */

  storeCardWrapper: {
    marginHorizontal: 18,
    marginTop: -88,
  },

  storeCard: {
    backgroundColor: '#ffffff',
    borderColor: '#ededed',
    borderRadius: 28,
    borderWidth: 1,
    paddingBottom: 19,
    paddingHorizontal: 18,
    paddingTop: 18,

    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 10,

    elevation: 5,
  },

  storeMainRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },

  storeLogoContainer: {
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderColor: '#eeeeee',
    borderRadius: 19,
    borderWidth: 1,
    height: 86,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 86,
  },

  storeLogoImage: {
    height: '100%',
    width: '100%',
  },

  storeLogoFallback: {
    fontSize: 32,
  },

  storeMainContent: {
    flex: 1,
    marginLeft: 15,
  },

  storeName: {
    color: '#1e1e1e',
    fontSize: 28,
    fontWeight: '900',
  },

  /* ---------------------------------- */
  /* NOTICES                            */
  /* ---------------------------------- */

  closedNotice: {
    alignItems: 'center',
    backgroundColor: '#fff1f0',
    borderRadius: 13,
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  closedNoticeIcon: {
    alignItems: 'center',
    backgroundColor: '#d7372f',
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    marginRight: 8,
    width: 20,
  },

  closedNoticeText: {
    color: '#9e2b25',
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'right',
  },

  /* ---------------------------------- */
  /* CATEGORIES                         */
  /* ---------------------------------- */

  categoryNavigation: {
    alignItems: 'stretch',
    backgroundColor: '#ffffff',
    borderBottomColor: '#e8e8e8',
    borderBottomWidth: 1,
    borderTopColor: '#efefef',
    borderTopWidth: 1,
    flexDirection: 'row',
    marginTop: 22,

    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,

    elevation: 2,
  },

  categoryScroll: {
    flex: 1,
  },

  categoryScrollContent: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },

  categoryTab: {
    alignItems: 'center',
    height: 66,
    justifyContent: 'flex-end',
    marginHorizontal: 11,
    minWidth: 90,
  },

  categoryTabText: {
    color: '#7d7d7d',
    fontSize: 15,
    fontWeight: '600',
    paddingBottom: 15,
  },

  categoryTabTextActive: {
    color: '#242424',
    fontWeight: '800',
  },

  categoryUnderline: {
    backgroundColor: 'transparent',
    borderRadius: 2,
    height: 4,
    width: '100%',
  },

  categoryUnderlineActive: {
    backgroundColor: '#222222',
  },

  /* ---------------------------------- */
  /* PRODUCT SECTIONS                   */
  /* ---------------------------------- */

  productsSection: {
    backgroundColor: '#ffffff',
    paddingTop: 24,
  },

  productsSectionTitle: {
    color: '#242424',
    fontSize: 23,
    fontWeight: '900',
    marginBottom: 4,
    paddingHorizontal: 21,
    textAlign: 'right',
  },

  productsList: {
    marginTop: 2,
  },

  productRow: {
    alignItems: 'stretch',
    borderBottomColor: '#ececec',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 190,
    paddingHorizontal: 21,
    paddingVertical: 18,
  },

  productRowLast: {
    borderBottomWidth: 0,
  },

  productRowPressed: {
    backgroundColor: '#fafafa',
  },

  productContent: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingRight: 17,
  },

  productName: {
    color: '#252525',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 23,
    textAlign: 'right',
  },

  productDescription: {
    color: '#858585',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'right',
  },

  productBottomContent: {
    alignItems: 'flex-end',
    flex: 1,
    justifyContent: 'flex-end',
    marginTop: 16,
  },

  productPrice: {
    color: '#303030',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
  },

  productVariantHint: {
    color: BRAND_GREEN,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
    textAlign: 'right',
  },

  warningBadge: {
    backgroundColor: '#fff0ed',
    borderRadius: 6,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  warningBadgeText: {
    color: '#bc342c',
    fontSize: 10,
    fontWeight: '800',
  },

  /* ---------------------------------- */
  /* PRODUCT IMAGE                      */
  /* ---------------------------------- */

  productImageWrapper: {
    height: 150,
    position: 'relative',
    width: 150,
  },

  productImage: {
    backgroundColor: '#f2f2f2',
    borderRadius: 21,
    height: '100%',
    width: '100%',
  },

  productImageFallback: {
    alignItems: 'center',
    backgroundColor: '#f4f4f4',
    borderRadius: 21,
    height: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },

  productAddButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#efefef',
    borderRadius: 24,
    borderWidth: 1,
    bottom: -3,
    height: 46,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,

    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,

    elevation: 5,

    width: 46,
  },

  productAddButtonPressed: {
    transform: [
      {
        scale: 0.94,
      },
    ],
  },

  productVariantButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#efefef',
    borderRadius: 24,
    borderWidth: 1,
    bottom: -3,
    height: 46,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
    width: 46,
  },

  productQuantityContainer: {
    alignItems: 'center',
    backgroundColor:
      BRAND_GREEN,
    borderRadius: 22,
    bottom: -3,
    flexDirection: 'row',
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
    position: 'absolute',
    right: 6,

    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.16,
    shadowRadius: 5,

    elevation: 5,
  },

  productQuantityButton: {
    alignItems: 'center',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },

  productQuantityText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    minWidth: 30,
    textAlign: 'center',
  },

  disabledButton: {
    opacity: 0.4,
  },

  /* ---------------------------------- */
  /* PRODUCT OPTIONS MODAL              */
  /* ---------------------------------- */

  productModalScreen: {
    backgroundColor: '#ffffff',
    flex: 1,
  },

  productModalScrollContent: {
    paddingBottom: 170,
  },

  productModalHero: {
    backgroundColor: '#f4f4f4',
    height: 360,
    overflow: 'hidden',
    position: 'relative',
  },

  productModalImage: {
    height: '100%',
    width: '100%',
  },

  productModalImageFallback: {
    alignItems: 'center',
    backgroundColor: '#f4f4f4',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },

  productModalCloseButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    left: 18,
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 5,
    top: 48,
    width: 48,
  },

  productModalBody: {
    paddingHorizontal: 22,
    paddingTop: 25,
  },

  productModalTitle: {
    color: '#202020',
    fontSize: 27,
    fontWeight: '900',
    lineHeight: 35,
    textAlign: 'right',
  },

  productModalDescription: {
    color: '#7a7a7a',
    fontSize: 16,
    lineHeight: 25,
    marginTop: 10,
    textAlign: 'right',
  },

  variantSection: {
    marginTop: 35,
  },

  variantSectionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },

  variantSectionTitle: {
    color: '#202020',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'right',
  },

  variantSectionSubtitle: {
    color: '#888888',
    fontSize: 15,
    marginTop: 6,
    textAlign: 'right',
  },

  requiredBadge: {
    backgroundColor: '#252525',
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  requiredBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },

  variantCardsContainer: {
    flexDirection: 'row-reverse',
    gap: 12,
    paddingBottom: 8,
    paddingTop: 20,
  },

  variantCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e1e1e1',
    borderRadius: 17,
    borderWidth: 2,
    minHeight: 116,
    padding: 13,
    position: 'relative',
    width: 155,
  },

  variantCardSelected: {
    borderColor: BRAND_GREEN,
    backgroundColor: '#EAF9F0',
  },

  variantCardPressed: {
    opacity: 0.83,
  },

  variantRadio: {
    alignItems: 'center',
    borderColor: '#e5e5e5',
    borderRadius: 12,
    borderWidth: 1.5,
    height: 24,
    justifyContent: 'center',
    left: 10,
    position: 'absolute',
    top: 10,
    width: 24,
  },

  variantRadioSelected: {
    borderColor: BRAND_GREEN,
  },

  variantRadioDot: {
    backgroundColor: BRAND_GREEN,
    borderRadius: 5,
    height: 10,
    width: 10,
  },

  variantName: {
    color: '#252525',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 42,
    textAlign: 'right',
  },

  variantPrice: {
    color: '#929292',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'right',
  },

  productModalBottomBar: {
    backgroundColor: '#ffffff',
    borderTopColor: '#ededed',
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    paddingBottom: 24,
    paddingHorizontal: 18,
    paddingTop: 13,
    position: 'absolute',
    right: 0,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.08,
    shadowRadius: 7,
    elevation: 14,
  },

  productModalRequiredHint: {
    color: '#999999',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },

  productModalBottomRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },

  modalQuantityControl: {
    alignItems: 'center',
    borderColor: '#e2e2e2',
    borderRadius: 27,
    borderWidth: 1,
    flexDirection: 'row',
    height: 54,
    justifyContent: 'space-between',
    paddingHorizontal: 7,
    width: 150,
  },

  modalQuantityButton: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },

  modalQuantityText: {
    color: '#242424',
    fontSize: 18,
    fontWeight: '800',
    minWidth: 25,
    textAlign: 'center',
  },

  modalAddItemButton: {
    alignItems: 'center',
    backgroundColor: BRAND_GREEN,
    borderRadius: 32,
    flex: 1,
    height: 64,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  modalAddItemButtonDisabled: {
    backgroundColor: '#f1f1f1',
  },

  modalAddItemButtonPressed: {
    backgroundColor: BRAND_GREEN_DARK,
    transform: [
      {
        scale: 0.99,
      },
    ],
  },

  modalAddItemButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },

  modalAddItemButtonTextDisabled: {
    color: '#a7a7a7',
  },

  /* ---------------------------------- */
  /* BOTTOM CART                        */
  /* ---------------------------------- */

  cartBarWrapper: {
    backgroundColor: '#ffffff',
    borderTopColor: '#eeeeee',
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    paddingBottom: 24,
    paddingHorizontal: 18,
    paddingTop: 13,
    position: 'absolute',
    right: 0,

    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.08,
    shadowRadius: 6,

    elevation: 12,
  },

  cartBar: {
    alignItems: 'center',
    backgroundColor:
      BRAND_GREEN,
    borderRadius: 35,
    flexDirection: 'row',
    height: 70,
    paddingHorizontal: 14,
  },

  cartBarPressed: {
    backgroundColor:
      BRAND_GREEN_DARK,

    transform: [
      {
        scale: 0.99,
      },
    ],
  },

  cartCountCircle: {
    alignItems: 'center',
    backgroundColor:
      'rgba(0,126,56,0.55)',
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },

  cartCountText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
  },

  cartButtonText: {
    color: '#ffffff',
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 15,
  },

  cartPrice: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },

  /* ---------------------------------- */
  /* EMPTY                              */
  /* ---------------------------------- */

  emptyCatalog: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 25,
    paddingVertical: 55,
  },

  emptyCatalogIconContainer: {
    alignItems: 'center',
    backgroundColor: '#EAF9F0',
    borderRadius: 29,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },

  emptyCatalogTitle: {
    color: '#222222',
    fontSize: 19,
    fontWeight: '900',
    marginTop: 16,
  },

  emptyCatalogDescription: {
    color: '#777777',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
    maxWidth: 300,
    textAlign: 'center',
  },

  /* ---------------------------------- */
  /* DIFFERENT RESTAURANT CART MODAL    */
  /* ---------------------------------- */

  modalOverlay: {
    alignItems: 'center',
    backgroundColor:
      'rgba(0,0,0,0.56)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },

  modalCard: {
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 30,
    maxWidth: 440,
    paddingBottom: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    width: '100%',
  },

  modalTitle: {
    color: '#202020',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 34,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  modalDescription: {
    color: '#777777',
    fontSize: 16,
    lineHeight: 27,
    marginTop: 10,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 26,
    width: '100%',
  },

  replaceCartButton: {
    alignItems: 'center',
    backgroundColor: BRAND_GREEN,
    borderRadius: 22,
    flex: 1,
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: 14,
  },

  replaceCartButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },

  cancelButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#E0E0E0',
    borderRadius: 22,
    borderWidth: 1.5,
    flex: 1,
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: 14,
  },

  cancelButtonText: {
    color: '#242424',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },

  modalActionPressed: {
    opacity: 0.82,
    transform: [
      {
        scale: 0.985,
      },
    ],
  },

  /* ---------------------------------- */
  /* STATE                              */
  /* ---------------------------------- */

  stateScreen: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },

  stateIconContainer: {
    alignItems: 'center',
    backgroundColor: '#EAF9F0',
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },

  stateTitle: {
    color: '#222222',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 16,
    textAlign: 'center',
  },

  stateDescription: {
    color: '#777777',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 350,
    textAlign: 'center',
  },

  retryButton: {
    backgroundColor:
      BRAND_GREEN,
    borderRadius: 15,
    marginTop: 22,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },

  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },

  errorButton: {
    backgroundColor: '#ffffff',
    borderColor: '#e8e8e8',
    borderRadius: 15,
    borderWidth: 1,
    marginTop: 11,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },

  errorButtonText: {
    color: BRAND_GREEN,
    fontSize: 14,
    fontWeight: '800',
  },

  buttonPressed: {
    opacity: 0.74,
  },
});

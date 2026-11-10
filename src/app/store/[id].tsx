import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import getAppBootstrap from '../../services/bootstrap-service';
import {
  type CatalogProduct,
  type StoreCatalog,
  getStoreCatalog,
} from '../../services/catalog-service';

import CategoryCartDock from '../../components/cart/category-cart-dock';
import { StoreScreenSkeleton } from '../../components/ui/loading-skeleton';
import {
  isRestaurantCartCategory,
  useCartStore,
} from '../../store/cart-store';
import { useCustomerStore } from '../../store/customer-store';
import {
  NAVIENTY_NOW_COLORS,
  NAVIENTY_NOW_LAYOUT,
} from '../../theme/navienty-now-theme';

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

function prefetchStoreCatalogImages(
  catalog: StoreCatalog,
) {
  const storeCover =
    isImageUri(
      catalog.store.coverImageUrl,
    )
      ? catalog.store.coverImageUrl
      : null;

  const storeLogo =
    isImageUri(
      catalog.store.logoUrl,
    )
      ? catalog.store.logoUrl
      : null;

  const urls = Array.from(
    new Set(
      [storeCover, storeLogo].filter(
        (url): url is string =>
          Boolean(url),
      ),
    ),
  );

  if (urls.length === 0) {
    return;
  }

  void ExpoImage.prefetch(
    urls,
    'memory-disk',
  ).catch(() => {});
}

type StoreRatingFields = {
  rating?: number | null;
  averageRating?: number | null;
  average_rating?: number | null;
};

function getStoreRating(
  store: StoreCatalog['store'],
): number | null {
  const ratingStore =
    store as StoreCatalog['store'] &
      StoreRatingFields;

  const candidates = [
    ratingStore.averageRating,
    ratingStore.average_rating,
    ratingStore.rating,
  ];

  for (const value of candidates) {
    if (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value > 0 &&
      value <= 5
    ) {
      return value;
    }
  }

  return null;
}

function BackArrowIcon() {
  return (
    <View style={styles.backArrowCanvas}>
      <View style={styles.backArrowStem} />

      <View
        style={[
          styles.backArrowDiagonal,
          styles.backArrowTop,
        ]}
      />

      <View
        style={[
          styles.backArrowDiagonal,
          styles.backArrowBottom,
        ]}
      />
    </View>
  );
}

function formatPriceValue(
  currencySymbol: string,
  value:
    | number
    | string
    | null
    | undefined,
) {
  const numericValue = Number(value ?? 0);

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

function normalizeRestaurantSearch(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ar')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesRestaurantSearch(
  product: CatalogProduct,
  terms: readonly string[],
): boolean {
  const searchText = normalizeRestaurantSearch(
    [
      product.name,
      product.nameEn,
      product.description,
      product.descriptionEn,
      product.sku,
      product.barcode,
      ...product.variants.flatMap((variant) => [
        variant.name,
        variant.nameEn,
      ]),
    ]
      .filter(Boolean)
      .join(' '),
  );

  return terms.every((term) => searchText.includes(term));
}

type ProductRowProps = {
  product: CatalogProduct;
  index: number;
  sectionProductCount: number;
  quantity: number;
  storeIsClosed: boolean;
  currencySymbol: string;
  onOpenProductDetails: (
    product: CatalogProduct,
  ) => void;
  onAddProduct: (
    product: CatalogProduct,
  ) => void;
  onIncreaseExistingProduct: (
    productId: string,
  ) => void;
  onDecreaseProduct: (
    productId: string,
  ) => void;
};

const ProductRow = memo(
  function ProductRow({
    product,
    index,
    sectionProductCount,
    quantity,
    storeIsClosed,
    currencySymbol,
    onOpenProductDetails,
    onAddProduct,
    onIncreaseExistingProduct,
    onDecreaseProduct,
  }: ProductRowProps) {
    const productImage =
      getProductImage(product);

    const [imageFailed, setImageFailed] =
      useState(false);

    useEffect(() => {
      setImageFailed(false);
    }, [productImage]);

    const hasVariants =
      product.variants.length > 0;

    const displayPrice =
      getProductDisplayPrice(product);

    const hasOldPrice =
      product.compareAtPrice !== null &&
      product.compareAtPrice >
        displayPrice;

    const canDisplayImage =
      !!productImage && !imageFailed;

    return (
      <Pressable
        disabled={storeIsClosed}
        onPress={() => {
          if (hasVariants) {
            onOpenProductDetails(product);
          }
        }}
        style={({ pressed }) => [
          styles.productRow,

          pressed &&
            hasVariants &&
            !storeIsClosed &&
            styles.productRowPressed,

          index ===
            sectionProductCount - 1 &&
            styles.productRowLast,
        ]}
      >
        {/* PRODUCT MEDIA */}

        <View
          style={styles.productMediaColumn}
        >
          <View
            style={styles.productImageWrapper}
          >
            {canDisplayImage ? (
              <ExpoImage
                cachePolicy="memory-disk"
                contentFit="cover"
                priority="normal"
                recyclingKey={`product-${product.id}`}
                source={{
                  uri: productImage,
                }}
                style={styles.productImage}
                onError={() => {
                  setImageFailed(true);
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
                disabled={storeIsClosed}
                onPress={(event) => {
                  event.stopPropagation();
                  onOpenProductDetails(
                    product,
                  );
                }}
                style={({ pressed }) => [
                  styles.productVariantButton,

                  storeIsClosed &&
                    styles.disabledButton,

                  pressed &&
                    !storeIsClosed &&
                    styles.productAddButtonPressed,
                ]}
              >
                <Ionicons
                  name="chevron-back"
                  size={18}
                  color={
                    NAVIENTY_NOW_COLORS.primary
                  }
                />
              </Pressable>
            ) : quantity === 0 ? (
              <Pressable
                disabled={storeIsClosed}
                onPress={(event) => {
                  event.stopPropagation();
                  onAddProduct(product);
                }}
                style={({ pressed }) => [
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
                  size={18}
                  color={
                    NAVIENTY_NOW_COLORS.primary
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
                  disabled={storeIsClosed}
                  onPress={(event) => {
                    event.stopPropagation();
                    onIncreaseExistingProduct(
                      product.id,
                    );
                  }}
                  style={({ pressed }) => [
                    styles.productQuantityButton,

                    pressed &&
                      styles.buttonPressed,
                  ]}
                >
                  <Ionicons
                    name="add"
                    size={15}
                    color="#ffffff"
                  />
                </Pressable>

                <Text
                  style={
                    styles.productQuantityText
                  }
                >
                  {quantity}
                </Text>

                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    onDecreaseProduct(
                      product.id,
                    );
                  }}
                  style={({ pressed }) => [
                    styles.productQuantityButton,

                    pressed &&
                      styles.buttonPressed,
                  ]}
                >
                  <Ionicons
                    name="remove"
                    size={15}
                    color="#ffffff"
                  />
                </Pressable>
              </View>
            )}
          </View>

          {hasVariants && (
            <Text
              style={
                styles.productVariantHint
              }
              numberOfLines={1}
            >
              يمكن تخصيصه
            </Text>
          )}
        </View>

        {/* PRODUCT TEXT */}

        <View style={styles.productContent}>
          <Text
            style={styles.productName}
            numberOfLines={2}
          >
            {product.name}
          </Text>

          {!!product.description && (
            <Text
              style={
                styles.productDescription
              }
              numberOfLines={3}
            >
              {product.description}
            </Text>
          )}

          <View
            style={
              styles.productBottomContent
            }
          >
            <View
              style={styles.priceColumn}
            >
              <Text
                style={styles.currentPrice}
              >
                {hasVariants
                  ? `من ${formatPriceValue(
                      currencySymbol,
                      displayPrice,
                    )}`
                  : formatPriceValue(
                      currencySymbol,
                      displayPrice,
                    )}
              </Text>

              {hasOldPrice && (
                <Text
                  style={styles.oldPrice}
                >
                  {formatPriceValue(
                    currencySymbol,
                    product.compareAtPrice!,
                  )}
                </Text>
              )}
            </View>

            {product.isAgeRestricted && (
              <View
                style={styles.warningBadge}
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
      </Pressable>
    );
  },
);

export default function StoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const savedServiceAreaId =
    useCustomerStore(
      (state) =>
        state.locationServiceAreaId,
    );

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
    useRef<SectionList<CatalogProduct>>(
      null,
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

  const [isSearchVisible, setIsSearchVisible] =
    useState(false);
  const [searchQuery, setSearchQuery] =
    useState('');
  const [debouncedSearch, setDebouncedSearch] =
    useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 260);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
    isScrollHeaderVisible,
    setIsScrollHeaderVisible,
  ] = useState(false);

  const scrollHeaderVisibleRef =
    useRef(false);

  useEffect(() => {
    setIsSearchVisible(false);
    setSearchQuery('');
    setDebouncedSearch('');
    setIsScrollHeaderVisible(false);
    scrollHeaderVisibleRef.current = false;
  }, [rawId]);

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

  const catalogSections =
    catalog?.sections ?? null;

  const currentStoreForActions =
    catalog?.store ?? null;

  const deliveryForActions =
    catalog?.delivery ?? null;

  const currentStoreId =
    currentStoreForActions?.id ?? null;

  const normalizedSearch = useMemo(
    () => normalizeRestaurantSearch(debouncedSearch),
    [debouncedSearch],
  );

  const sectionListData = useMemo(() => {
    const searchTerms =
      isSearchVisible && normalizedSearch
        ? normalizedSearch.split(' ').filter(Boolean)
        : [];

    return (catalogSections ?? [])
      .map((section) => ({
        ...section,
        data:
          searchTerms.length > 0
            ? section.products.filter((product) =>
                matchesRestaurantSearch(product, searchTerms),
              )
            : section.products,
      }))
      .filter((section) =>
        searchTerms.length === 0 || section.data.length > 0,
      );
  }, [catalogSections, isSearchVisible, normalizedSearch]);

  const cartQuantityByProductId =
    useMemo(() => {
      const quantityMap =
        new Map<string, number>();

      if (!currentStoreId) {
        return quantityMap;
      }

      const currentItems =
        carts[currentStoreId]?.items ?? [];

      for (const item of currentItems) {
        if (item.variantId === null) {
          quantityMap.set(
            item.id,
            item.quantity,
          );
        }
      }

      return quantityMap;
    }, [carts, currentStoreId]);

  const openProductDetails = useCallback(
    (product: CatalogProduct) => {
      if (
        !currentStoreForActions ||
        currentStoreForActions.isManuallyClosed ||
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
    },
    [currentStoreForActions],
  );

  const addProductToCart = useCallback(
    (product: CatalogProduct) => {
      if (
        !currentStoreForActions ||
        !deliveryForActions ||
        currentStoreForActions.isManuallyClosed
      ) {
        return;
      }

      const result = addItem(
        {
          id: currentStoreForActions.id,
          name: currentStoreForActions.name,
          icon: currentStoreForActions.icon,
          categorySlug:
            currentStoreForActions.categorySlug,
          deliveryFee:
            deliveryForActions.deliveryFee,
          minimumOrder:
            deliveryForActions.minimumOrder,
        },
        {
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          icon: product.icon,
          variantId: null,
          variantName: null,
        },
      );

      if (
        result === 'different-restaurant'
      ) {
        setPendingProduct(product);
        setPendingVariantId(null);
        setPendingQuantity(1);
      }
    },
    [
      addItem,
      currentStoreForActions,
      deliveryForActions,
    ],
  );

  const increaseExistingProduct =
    useCallback(
      (productId: string) => {
        if (
          !currentStoreForActions ||
          currentStoreForActions.isManuallyClosed
        ) {
          return;
        }

        increaseStoreItem(
          currentStoreForActions.id,
          productId,
          null,
        );
      },
      [
        currentStoreForActions,
        increaseStoreItem,
      ],
    );

  const decreaseProductQuantity =
    useCallback(
      (productId: string) => {
        if (!currentStoreForActions) {
          return;
        }

        decreaseStoreItem(
          currentStoreForActions.id,
          productId,
          null,
        );
      },
      [
        currentStoreForActions,
        decreaseStoreItem,
      ],
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

      const loadedBootstrap =
        await getAppBootstrap();

      const serviceAreaId =
        savedServiceAreaId ??
        loadedBootstrap.settings
          .default_service_area_id ??
        undefined;

      const loadedCatalog =
        await getStoreCatalog(
          rawId,
          serviceAreaId,
        );

      prefetchStoreCatalogImages(
        loadedCatalog,
      );

      setCatalog(loadedCatalog);

      setCurrencySymbol(
        loadedBootstrap.settings
          .currency_symbol || 'EGP',
      );
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
  }, [rawId, savedServiceAreaId]);


  if (isLoading) {
    return <StoreScreenSkeleton />;
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
            color={NAVIENTY_NOW_COLORS.primary}
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

  const storeRating =
    getStoreRating(currentStore);

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
    return formatPriceValue(
      currencySymbol,
      value,
    );
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

  function openRestaurantSearch() {
    setSearchQuery('');
    setDebouncedSearch('');
    setIsSearchVisible(true);
    scrollHeaderVisibleRef.current = false;
    setIsScrollHeaderVisible(false);
  }

  function closeRestaurantSearch() {
    setSearchQuery('');
    setDebouncedSearch('');
    setIsSearchVisible(false);
    scrollHeaderVisibleRef.current = false;
    setIsScrollHeaderVisible(false);
  }

  function handleStoreScroll(
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) {
    const scrollY =
      event.nativeEvent.contentOffset.y;

    const nextVisible = scrollY >= 170;

    if (
      scrollHeaderVisibleRef.current !==
      nextVisible
    ) {
      scrollHeaderVisibleRef.current =
        nextVisible;
      setIsScrollHeaderVisible(nextVisible);
    }
  }

  return (
    <View style={styles.screen}>
      <SectionList
        key={isSearchVisible ? 'restaurant-search' : 'restaurant-catalog'}
        ref={scrollRef}
        sections={sectionListData}
        contentContainerStyle={[
          isSearchVisible && {
            paddingTop:
              Math.max(
                insets.top,
                Platform.OS === 'android' ? 24 : 0,
              ) + 56,
          },
          styles.pageContent,

          cartItemCount > 0 &&
            styles.pageContentWithBottomBar,

          cartItemCount > 0 &&
            Platform.OS === 'android' && {
              paddingBottom:
                180 + Math.max(insets.bottom, 0),
            },
        ]}
        initialNumToRender={5}
        maxToRenderPerBatch={4}
        windowSize={5}
        updateCellsBatchingPeriod={60}
        removeClippedSubviews={
          Platform.OS === 'android'
        }
        stickySectionHeadersEnabled={false}
        keyExtractor={(product) =>
          product.id
        }
        ListHeaderComponent={
          !isSearchVisible ? (
            <>
        <View style={styles.container}>
        {/* HERO */}

        <View style={styles.hero}>
          {storeCoverImage ? (
            <>
              <ExpoImage
                cachePolicy="memory-disk"
                contentFit="cover"
                priority="high"
                recyclingKey={`store-cover-${currentStore.id}`}
                source={{
                  uri: storeCoverImage,
                }}
                style={
                  styles.heroBackground
                }
                transition={120}
              />

              <View
                style={styles.heroOverlay}
              />
            </>
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

          <Pressable
            accessibilityLabel="العودة"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.backButton,
              styles.heroBackButton,
              {
                top:
                  Math.max(
                    insets.top,
                    Platform.OS === 'android'
                      ? 24
                      : 12,
                  ) + 10,
              },
              pressed &&
                styles.headerButtonPressed,
            ]}
            onPress={() => router.back()}
          >
            <BackArrowIcon />
          </Pressable>

          <Pressable
            accessibilityLabel="البحث في منتجات المطعم"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.backButton,
              styles.heroSearchButton,
              {
                top:
                  Math.max(
                    insets.top,
                    Platform.OS === 'android' ? 24 : 12,
                  ) + 10,
              },
              pressed && styles.headerButtonPressed,
            ]}
            onPress={openRestaurantSearch}
          >
            <Ionicons
              name="search-outline"
              size={19}
              color="#202020"
            />
          </Pressable>

          {storeRating !== null && (
            <View style={styles.ratingBadge}>
              <Ionicons
                name="star"
                size={17}
                color="#F5B400"
              />

              <Text
                style={
                  styles.ratingBadgeText
                }
              >
                {storeRating.toFixed(1)}
              </Text>
            </View>
          )}
        </View>

        {/* STORE IDENTITY */}

        <View style={styles.storeInfoSection}>
          <View style={styles.storeMainRow}>
            <View
              style={
                styles.storeLogoContainer
              }
            >
              {storeLogoImage ? (
                <ExpoImage
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  priority="high"
                  recyclingKey={`store-logo-${currentStore.id}`}
                  source={{
                    uri: storeLogoImage,
                  }}
                  style={
                    styles.storeLogoImage
                  }
                  transition={100}
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
                size={13}
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

        </View>
            </>
          ) : null
        }
        ListEmptyComponent={
          <>
        <View
          style={styles.container}
        >
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
                name={
                  isSearchVisible && normalizedSearch
                    ? 'search-outline'
                    : 'restaurant-outline'
                }
                size={28}
                color={NAVIENTY_NOW_COLORS.primary}
              />
            </View>

            <Text
              style={
                styles.emptyCatalogTitle
              }
            >
              {isSearchVisible && normalizedSearch
                ? 'لا توجد نتائج للبحث'
                : 'لا توجد منتجات متاحة'}
            </Text>

            <Text
              style={
                styles.emptyCatalogDescription
              }
            >
              {isSearchVisible && normalizedSearch
                ? 'جرّب اسم منتج آخر أو امسح البحث لعرض قائمة المطعم.'
                : 'لم تتم إضافة منتجات مفعّلة لهذا المطعم بعد.'}
            </Text>
          </View>
        </View>
          </>
        }
        renderSectionHeader={({
          section,
        }) => (
          <View
            style={[
              styles.container,
              styles.productsSection,
            ]}
          >
            <Text
              style={
                styles.productsSectionTitle
              }
            >
              {section.name}
            </Text>
          </View>
        )}
        renderItem={({
          item: product,
          index,
          section,
        }) => (
          <View
            style={styles.container}
          >
            <ProductRow
              product={product}
              index={index}
              sectionProductCount={
                section.data.length
              }
              quantity={
                cartQuantityByProductId.get(
                  product.id,
                ) ?? 0
              }
              storeIsClosed={storeIsClosed}
              currencySymbol={currencySymbol}
              onOpenProductDetails={
                openProductDetails
              }
              onAddProduct={addProductToCart}
              onIncreaseExistingProduct={
                increaseExistingProduct
              }
              onDecreaseProduct={
                decreaseProductQuantity
              }
            />
          </View>
        )}
        onScroll={handleStoreScroll}
        scrollEventThrottle={32}
        showsVerticalScrollIndicator={false}
      />

      {(isScrollHeaderVisible || isSearchVisible) && (
        <View
          style={[
            styles.scrollHeader,
            {
              paddingTop: Math.max(
                insets.top,
                Platform.OS === 'android' ? 24 : 0,
              ),
            },
          ]}
        >
          <View style={styles.scrollHeaderRow}>
            {isSearchVisible ? (
              <View style={styles.searchInputContainer}>
                <Ionicons
                  name="search-outline"
                  size={17}
                  color="#222222"
                />
                <TextInput
                  autoFocus
                  accessibilityLabel="ابحث في منتجات المطعم"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="ابحث في منتجات المطعم"
                  placeholderTextColor="#999999"
                  returnKeyType="search"
                  style={styles.searchInput}
                  textAlign="right"
                />
                <Pressable
                  accessibilityLabel="إغلاق البحث"
                  accessibilityRole="button"
                  hitSlop={12}
                  onPress={closeRestaurantSearch}
                >
                  <Ionicons
                    name="close"
                    size={18}
                    color="#222222"
                  />
                </Pressable>
              </View>
            ) : (
              <>
                <Pressable
                  accessibilityLabel="العودة"
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.backButton,
                    pressed && styles.headerButtonPressed,
                  ]}
                  onPress={() => router.back()}
                >
                  <BackArrowIcon />
                </Pressable>
                <View style={styles.scrollHeaderTitleGroup}>
                  <Text
                    numberOfLines={1}
                    style={styles.scrollHeaderTitle}
                  >
                    {currentStore.name}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel="البحث في منتجات المطعم"
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.backButton,
                    pressed && styles.headerButtonPressed,
                  ]}
                  onPress={openRestaurantSearch}
                >
                  <Ionicons
                    name="search-outline"
                    size={19}
                    color="#202020"
                  />
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}

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
                contentContainerStyle={[
                  styles.productModalScrollContent,
                  Platform.OS === 'android' && {
                    paddingBottom:
                      170 + Math.max(insets.bottom, 0),
                  },
                ]}
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
                    <ExpoImage
                      cachePolicy="memory-disk"
                      contentFit="cover"
                      priority="high"
                      recyclingKey={`product-modal-${selectedProduct.id}`}
                      source={{
                        uri:
                          getProductImage(
                            selectedProduct,
                          )!,
                      }}
                      style={
                        styles.productModalImage
                      }
                      transition={100}
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
                        size={46}
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

                      Platform.OS === 'android' && {
                        top:
                          Math.max(insets.top, 24) + 12,
                      },

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
                            اختر الحجم
                          </Text>

                          <Text
                            style={
                              styles.variantSectionSubtitle
                            }
                          >
                            اختر اختيارًا واحدًا
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

                      <View
                        style={
                          styles.variantChoicesList
                        }
                      >
                        {selectedProduct.variants.map(
                          (variant) => {
                            const isSelected =
                              selectedVariantId ===
                              variant.id;

                            const variantCurrency =
                              currencySymbol === 'EGP'
                                ? 'ج.م'
                                : currencySymbol;

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
                                  style={
                                    styles.variantChoiceLeft
                                  }
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
                                      styles.variantPrice
                                    }
                                    numberOfLines={1}
                                  >
                                    {`(+${Number(
                                      variant.price,
                                    ).toFixed(2)} ${variantCurrency})`}
                                  </Text>
                                </View>

                                <Text
                                  style={
                                    styles.variantName
                                  }
                                  numberOfLines={
                                    2
                                  }
                                >
                                  {
                                    variant.name
                                  }
                                </Text>
                              </Pressable>
                            );
                          },
                        )}
                      </View>
                    </View>
                  )}
                </View>
              </ScrollView>

              <View
                style={[
                  styles.productModalBottomBar,
                  Platform.OS === 'android' && {
                    paddingBottom:
                      Math.max(insets.bottom, 8) + 12,
                  },
                ]}
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
                          NAVIENTY_NOW_COLORS.primary
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

      <CategoryCartDock
        itemCount={cartItemCount}
        subtotal={cartSubtotal}
        minimumOrder={delivery.minimumOrder}
        currencyCode={currencySymbol}
        accentColor={NAVIENTY_NOW_COLORS.primary}
        accentDarkColor="#009245"
        isScrollingDown={false}
        onPress={openCart}
      />

      {/* DIFFERENT RESTAURANT CART MODAL */}

      <Modal
        visible={pendingProduct !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={clearPendingCartRequest}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={clearPendingCartRequest}
          />

          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              بدء سلة جديدة؟
            </Text>

            <Text style={styles.modalDescription}>
              {`عند بدء طلب جديد، سيتم إزالة سلة مشترياتك من «${
                conflictingRestaurantCart?.storeName ??
                'المطعم السابق'
              }».`}
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.confirmNewCartButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={replaceCartAndAddProduct}
              >
                <Text style={styles.confirmNewCartButtonText}>
                  تأكيد البدء
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={clearPendingCartRequest}
              >
                <Text style={styles.cancelButtonText}>
                  إلغاء
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },

  backButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E1E1',
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },

  heroBackButton: {
    left:
      NAVIENTY_NOW_LAYOUT.pageGutter,
    position: 'absolute',
    zIndex: 20,

    shadowColor: '#000000',
    shadowOffset: {
      height: 2,
      width: 0,
    },
    shadowOpacity: 0.14,
    shadowRadius: 6,

    elevation: 5,
  },

  heroSearchButton: {
    right: NAVIENTY_NOW_LAYOUT.pageGutter,
    position: 'absolute',
    zIndex: 20,
    shadowColor: '#000000',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 5,
  },

  headerButtonPressed: {
    backgroundColor: '#F7F7F7',
    transform: [
      {
        scale: 0.97,
      },
    ],
  },

  backArrowCanvas: {
    height: 20,
    position: 'relative',
    width: 21,
  },

  backArrowStem: {
    backgroundColor: '#242424',
    borderRadius: 2,
    height: 2,
    left: 3,
    position: 'absolute',
    top: 9,
    width: 16,
  },

  backArrowDiagonal: {
    backgroundColor: '#242424',
    borderRadius: 2,
    height: 2,
    left: 2,
    position: 'absolute',
    width: 8,
  },

  backArrowTop: {
    top: 6,
    transform: [
      {
        rotate: '-42deg',
      },
    ],
  },

  backArrowBottom: {
    top: 12,
    transform: [
      {
        rotate: '42deg',
      },
    ],
  },

  scrollHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#ECEEEF',
    borderBottomWidth:
      StyleSheet.hairlineWidth,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 100,
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 5,
  },

  scrollHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 56,
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
  },

  scrollHeaderTitleGroup: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },

  scrollHeaderTitle: {
    color: '#171717',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  searchInputContainer: {
    alignItems: 'center',
    backgroundColor: '#F6F6F6',
    borderColor: '#EAEAEA',
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 40,
    paddingHorizontal: 13,
  },

  searchInput: {
    color: '#202020',
    flex: 1,
    fontSize: 13,
    minHeight: 38,
    writingDirection: 'rtl',
  },

  container: {
    alignSelf: 'center',
    maxWidth:
      NAVIENTY_NOW_LAYOUT.contentMaxWidth,
    width: '100%',
  },

  pageContent: {
    flexGrow: 1,
    paddingBottom: 36,
  },

  pageContentWithBottomBar: {
    paddingBottom: 180,
  },

  /* ---------------------------------- */
  /* HERO                               */
  /* ---------------------------------- */

  hero: {
    aspectRatio: 2.2,
    minHeight: 210,
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
    backgroundColor:
      'rgba(0,0,0,0.05)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },

  heroFallback: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
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

  ratingBadge: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    bottom: 18,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'absolute',
    right:
      NAVIENTY_NOW_LAYOUT.pageGutter,
    zIndex: 15,

    shadowColor: '#000000',
    shadowOffset: {
      height: 2,
      width: 0,
    },
    shadowOpacity: 0.10,
    shadowRadius: 5,

    elevation: 4,
  },

  ratingBadgeText: {
    color: '#242424',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
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
  /* STORE IDENTITY                     */
  /* ---------------------------------- */

  storeInfoSection: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 8,
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
  },

  storeMainRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },

  storeLogoContainer: {
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderColor: '#EEEEEE',
    borderRadius: 18,
    borderWidth: 1,
    height: 86,
    justifyContent: 'center',
    marginTop: -43,
    overflow: 'hidden',
    width: 86,

    shadowColor: '#000000',
    shadowOffset: {
      height: 2,
      width: 0,
    },
    shadowOpacity: 0.08,
    shadowRadius: 6,

    elevation: 4,
  },

  storeLogoImage: {
    height: '100%',
    width: '100%',
  },

  storeLogoFallback: {
    fontSize: 36,
  },

  storeMainContent: {
    alignSelf: 'flex-start',
    flex: 1,
    justifyContent: 'flex-start',
    marginLeft: 5,
    paddingTop: 0,
  },

  storeName: {
    color: '#1E1E1E',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 29,
  },

  /* ---------------------------------- */
  /* NOTICES                            */
  /* ---------------------------------- */

  closedNotice: {
    alignItems: 'center',
    backgroundColor: '#fff1f0',
    borderRadius: 13,
    flexDirection: 'row',
    marginHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
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
    marginRight: 10,
    width: 20,
  },

  closedNoticeText: {
    color: '#9e2b25',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'right',
  },

  /* ---------------------------------- */
  /* PRODUCT SECTIONS                   */
  /* ---------------------------------- */

  productsSection: {
    backgroundColor: '#ffffff',
    paddingTop: 18,
  },

  productsSectionTitle: {
    color: '#242424',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
    textAlign: 'right',
  },

  productsList: {
    marginTop: 0,
  },

  productRow: {
    alignItems: 'flex-start',
    borderBottomColor: '#ececec',
    borderBottomWidth: 1,
    direction: 'ltr',
    flexDirection: 'row',
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
    paddingVertical: 10,
  },

  productRowLast: {
    borderBottomWidth: 0,
  },

  productRowPressed: {
    backgroundColor: '#fafafa',
  },

  productContent: {
    alignSelf: 'flex-start',
    direction: 'rtl',
    flex: 1,
    justifyContent: 'flex-start',
    paddingLeft: 14,
  },

  productName: {
    color: '#252525',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'right',
  },

  productDescription: {
    color: '#7F7F7F',
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'right',
  },

  productBottomContent: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    marginTop: 9,
  },

  priceColumn: {
    alignItems: 'flex-end',
  },

  currentPrice: {
    color: '#202020',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },

  oldPrice: {
    color: '#969696',
    fontSize: 11.5,
    marginTop: 3,
    textDecorationLine: 'line-through',
  },

  productVariantHint: {
    color: '#7F7F7F',
    fontSize: 11.5,
    fontWeight: '500',
    lineHeight: 16,
    marginTop: 5,
    textAlign: 'center',
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

  productMediaColumn: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 0,
    width: 112,
  },

  productImageWrapper: {
    height: 112,
    position: 'relative',
    width: 112,
  },

  productImage: {
    backgroundColor: '#f2f2f2',
    borderRadius: 18,
    height: '100%',
    width: '100%',
  },

  productImageFallback: {
    alignItems: 'center',
    backgroundColor: '#f4f4f4',
    borderRadius: 18,
    height: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },

  productAddButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#efefef',
    borderRadius: 18,
    borderWidth: 1,
    bottom: 6,
    height: 36,
    justifyContent: 'center',
    left: 6,
    position: 'absolute',


    width: 36,
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
    borderRadius: 18,
    borderWidth: 1,
    bottom: 6,
    height: 36,
    justifyContent: 'center',
    left: 6,
    position: 'absolute',
    width: 36,
  },

  productQuantityContainer: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 18,
    bottom: 6,
    flexDirection: 'row',
    height: 36,
    justifyContent: 'center',
    left: 3,
    paddingHorizontal: 3,
    position: 'absolute',

  },

  productQuantityButton: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },

  productQuantityText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '800',
    minWidth: 20,
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
    height: 270,
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
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    left: 22,
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 5,
    top: 50,
    width: 44,
  },

  productModalBody: {
    paddingHorizontal: 18,
    paddingTop: 18,
  },

  productModalTitle: {
    color: '#202020',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 25,
    textAlign: 'right',
  },

  productModalDescription: {
    color: '#7a7a7a',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
    textAlign: 'right',
  },

  variantSection: {
    marginTop: 20,
  },

  variantSectionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 7,
  },

  variantSectionTitle: {
    color: '#202020',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  variantSectionSubtitle: {
    color: '#8A8A8A',
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 2,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  requiredBadge: {
    backgroundColor: '#252525',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  requiredBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },

  variantChoicesList: {
    borderTopColor: '#E8E8E8',
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  variantCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E5E5E5',
    borderBottomWidth: StyleSheet.hairlineWidth,
    direction: 'ltr',
    flexDirection: 'row',
    minHeight: 64,
    paddingHorizontal: 2,
    paddingVertical: 10,
    width: '100%',
  },

  variantCardSelected: {
    backgroundColor: '#F8FCFA',
  },

  variantCardPressed: {
    backgroundColor: '#F7F7F7',
  },

  variantChoiceLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 9,
    minWidth: 132,
  },

  variantRadio: {
    alignItems: 'center',
    borderColor: '#C9C9C9',
    borderRadius: 11,
    borderWidth: 1.7,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },

  variantRadioSelected: {
    borderColor: NAVIENTY_NOW_COLORS.primary,
  },

  variantRadioDot: {
    backgroundColor: NAVIENTY_NOW_COLORS.primary,
    borderRadius: 5,
    height: 10,
    width: 10,
  },

  variantName: {
    color: '#242424',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginLeft: 14,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  variantPrice: {
    color: '#8A8A8A',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
    textAlign: 'left',
    writingDirection: 'ltr',
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
    fontSize: 12,
    marginBottom: 10,
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
    paddingHorizontal: 8,
    width: 145,
  },

  modalQuantityButton: {
    alignItems: 'center',
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },

  modalQuantityText: {
    color: '#242424',
    fontSize: 15,
    fontWeight: '800',
    minWidth: 22,
    textAlign: 'center',
  },

  modalAddItemButton: {
    alignItems: 'center',
    backgroundColor: NAVIENTY_NOW_COLORS.primary,
    borderRadius: 27,
    flex: 1,
    height: 54,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  modalAddItemButtonDisabled: {
    backgroundColor: '#f1f1f1',
  },

  modalAddItemButtonPressed: {
    backgroundColor: NAVIENTY_NOW_COLORS.primary,
    opacity: 0.9,
    transform: [
      {
        scale: 0.99,
      },
    ],
  },

  modalAddItemButtonText: {
    color: '#ffffff',
    fontSize: 14,
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
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 999,
    flexDirection: 'row',
    height: 58,
    paddingHorizontal: 14,
  },

  cartBarPressed: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    opacity: 0.9,

    transform: [
      {
        scale: 0.99,
      },
    ],
  },

  cartCountCircle: {
    alignItems: 'center',
    backgroundColor:
      'rgba(255,255,255,0.18)',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },

  cartCountText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },

  cartButtonText: {
    color: '#ffffff',
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 13,
  },

  cartPrice: {
    color: '#ffffff',
    fontSize: 15,
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
    backgroundColor: '#EAF8F0',
    borderRadius: 29,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },

  emptyCatalogTitle: {
    color: '#222222',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 16,
  },

  emptyCatalogDescription: {
    color: '#777777',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 7,
    maxWidth: 300,
    textAlign: 'center',
  },

  /* ---------------------------------- */
  /* MODAL                              */
  /* ---------------------------------- */

  modalOverlay: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  modalBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.52)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },

  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    maxWidth: 540,
    paddingBottom: 24,
    paddingHorizontal: 24,
    paddingTop: 30,
    width: '100%',
  },

  modalTitle: {
    color: '#222222',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  modalDescription: {
    color: '#777777',
    fontSize: 14,
    lineHeight: 23,
    marginTop: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 26,
  },

  confirmNewCartButton: {
    alignItems: 'center',
    backgroundColor: NAVIENTY_NOW_COLORS.primary,
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 14,
  },

  confirmNewCartButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },

  cancelButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E3E6',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 14,
  },

  cancelButtonText: {
    color: '#222222',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },

  /* ---------------------------------- */
  /* STATE                              */
  /* ---------------------------------- */

  stateScreen: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },

  stateIconContainer: {
    alignItems: 'center',
    backgroundColor: '#EAF8F0',
    borderRadius: 33,
    height: 66,
    justifyContent: 'center',
    width: 66,
  },

  stateTitle: {
    color: '#17171A',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 17,
    textAlign: 'center',
  },

  stateDescription: {
    color: '#73737A',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 8,
    maxWidth: 350,
    textAlign: 'center',
  },

  retryButton: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 15,
    marginTop: 22,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },

  retryButtonText: {
    color: '#ffffff',
    fontSize: 13,
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
    color: NAVIENTY_NOW_COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
  },

  buttonPressed: {
    opacity: 0.76,
    transform: [
      {
        scale: 0.985,
      },
    ],
  },
});
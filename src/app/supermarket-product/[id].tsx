import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomActionSlot } from '../../components/cart/bottom-action-provider';
import CategorySearchEntry from '../../components/search/category-search-entry';

import { supabase } from '../../lib/supabase';
import getAppBootstrap from '../../services/bootstrap-service';
import {
  getSupermarketProductBrand,
  type SupermarketProductBrand,
} from '../../services/supermarket-brand-service';
import {
    getStoreCatalog,
    type CatalogProduct,
    type ProductVariant,
    type StoreBusinessHour,
    type StoreCatalog,
} from '../../services/catalog-service';
import { useCartStore } from '../../store/cart-store';
import { useCustomerStore } from '../../store/customer-store';
import { NAVIENTY_NOW_COLORS } from '../../theme/navienty-now-theme';

const GREEN = NAVIENTY_NOW_COLORS.primary;
const PRODUCT_BG = '#F7F7F7';
const MAX_PAGE_WIDTH = 560;
const RECOMMENDATION_GAP = 12;
const RECOMMENDATION_LIMIT = 12;

type PriceInfo = {
  price: number;
  compareAt: number | null;
  discount: number | null;
  variant: ProductVariant | null;
};

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function imagesForProduct(product: CatalogProduct): string[] {
  const ordered = [...product.images].sort(
    (a, b) => Number(b.isCover) - Number(a.isCover),
  );
  return [...new Set(
    [product.imageUrl, ...ordered.map(image => image.imageUrl)]
      .filter((value): value is string => Boolean(value?.trim())),
  )];
}

function formatPrice(value: number, currency: string): string {
  return `${value.toFixed(2)} ${currency.toUpperCase() === 'EGP' ? 'ج.م' : currency}`;
}

function discountFor(price: number, compareAtPrice: number | null): number | null {
  if (compareAtPrice === null || compareAtPrice <= price || price <= 0) return null;
  return Math.round((1 - price / compareAtPrice) * 100);
}

function priceInfoFor(product: CatalogProduct): PriceInfo {
  // Never mix a variant's current price with a different variant's old price.
  const variant = product.variants.find(item => item.isDefault) ?? product.variants[0] ?? null;
  const price = variant?.price ?? product.price;
  const compareAt = variant ? variant.compareAtPrice : product.compareAtPrice;
  return { price, compareAt, discount: discountFor(price, compareAt), variant };
}

function toMinutes(value: string | null): number | null {
  if (!value) return null;
  const [h, m = '0'] = value.split(':');
  const hour = Number(h);
  const minute = Number(m);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) ||
    hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function isOpenNow(hours: StoreBusinessHour[]): boolean {
  if (!hours.length) return true;
  const now = new Date();
  const day = now.getDay();
  const minute = now.getHours() * 60 + now.getMinutes();
  const today = hours.find(row => row.dayOfWeek === day);
  const yesterday = hours.find(row => row.dayOfWeek === (day + 6) % 7);
  if (today?.isOpen) {
    const start = toMinutes(today.openTime);
    const end = toMinutes(today.closeTime);
    if (start !== null && end !== null) {
      if (start === end) return true;
      if (end > start && minute >= start && minute < end) return true;
      if (end < start && minute >= start) return true;
    }
  }
  if (yesterday?.isOpen) {
    const start = toMinutes(yesterday.openTime);
    const end = toMinutes(yesterday.closeTime);
    if (start !== null && end !== null && end < start && minute < end) return true;
  }
  return false;
}

/**
 * Each recommended product comes from the current ACTIVE store catalog.
 * The quick-add action is separate from opening the product detail page.
 */
type RecommendationCardProps = {
  product: CatalogProduct;
  cardWidth: number;
  currency: string;
  quantity: number;
  disabled: boolean;
  onOpen: () => void;
  onAdd: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
};

function RecommendationCard({
  product,
  cardWidth,
  currency,
  quantity,
  disabled,
  onOpen,
  onAdd,
  onIncrease,
  onDecrease,
}: RecommendationCardProps) {
  const imageUrl = imagesForProduct(product)[0];
  const { price, compareAt, discount } = priceInfoFor(product);
  // A product with multiple variants or restrictions must open its details
  // instead of changing the quantity of an unselected cart line.
  const canQuickAdjust = product.variants.length <= 1 &&
    !product.isAgeRestricted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`عرض تفاصيل ${product.name}`}
      onPress={onOpen}
      style={({ pressed }) => [
        styles.recommendationCard,
        { width: cardWidth },
        pressed && styles.recommendationCardPressed,
      ]}
    >
      <View style={[styles.recommendationImageBox, { height: cardWidth }]}>
        {imageUrl ? (
          <ExpoImage
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={120}
          />
        ) : (
          <Text style={styles.recommendationEmoji}>{product.icon || '🛒'}</Text>
        )}

        {discount !== null && (
          <View style={styles.recommendationDiscount} pointerEvents="none">
            <Text numberOfLines={1} style={styles.recommendationDiscountText}>
              وفر {discount}%
            </Text>
          </View>
        )}

        {quantity === 0 || !canQuickAdjust ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={canQuickAdjust ? `إضافة ${product.name} للسلة` : `اختيار تفاصيل ${product.name}`}
            accessibilityHint={!canQuickAdjust ? 'يفتح صفحة المنتج لاختيار النوع أو الحجم' : undefined}
            disabled={disabled}
            hitSlop={4}
            onPress={event => {
              event.stopPropagation();
              onAdd();
            }}
            style={({ pressed }) => [
              styles.recommendationAddButton,
              disabled && styles.recommendationAddDisabled,
              pressed && !disabled && styles.recommendationAddPressed,
            ]}
          >
            <Text style={styles.recommendationPlus}>+</Text>
          </Pressable>
        ) : (
          <View style={styles.recommendationQuantityPill}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`تقليل كمية ${product.name}`}
              hitSlop={4}
              onPress={event => {
                event.stopPropagation();
                onDecrease();
              }}
              style={styles.quantityAction}
            >
              <Text style={styles.quantityActionText}>−</Text>
            </Pressable>
            <Text style={styles.quantityText}>{quantity}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`زيادة كمية ${product.name}`}
              disabled={disabled}
              hitSlop={4}
              onPress={event => {
                event.stopPropagation();
                onIncrease();
              }}
              style={styles.quantityAction}
            >
              <Text style={styles.quantityActionText}>+</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Text numberOfLines={2} style={styles.recommendationName}>{product.name}</Text>
      {product.unitLabelAr ? (
        <Text numberOfLines={1} style={styles.recommendationUnit}>{product.unitLabelAr}</Text>
      ) : null}
      <View style={styles.recommendationPriceRow}>
        <View style={discount !== null ? styles.recommendationPriceUnderline : undefined}>
          <Text numberOfLines={1} style={styles.recommendationPrice}>
            {formatPrice(price, currency)}
          </Text>
        </View>
        {discount !== null && compareAt !== null && (
          <Text numberOfLines={1} style={styles.recommendationOldPrice}>
            {formatPrice(compareAt, currency)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

type RecommendationSectionProps = {
  title: string;
  products: CatalogProduct[];
  cardWidth: number;
  currency: string;
  disabled: boolean;
  quantityFor: (product: CatalogProduct) => number;
  onOpen: (product: CatalogProduct) => void;
  onAdd: (product: CatalogProduct) => void;
  onIncrease: (product: CatalogProduct) => void;
  onDecrease: (product: CatalogProduct) => void;
};

function RecommendationSection({
  title,
  products,
  cardWidth,
  currency,
  disabled,
  quantityFor,
  onOpen,
  onAdd,
  onIncrease,
  onDecrease,
}: RecommendationSectionProps) {
  if (products.length === 0) return null;

  return (
    <View style={styles.recommendationSection}>
      <Text style={styles.recommendationSectionTitle}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        directionalLockEnabled
        style={styles.recommendationRail}
        contentContainerStyle={styles.recommendationRailContent}
      >
        {products.map(item => (
          <RecommendationCard
            key={item.id}
            product={item}
            cardWidth={cardWidth}
            currency={currency}
            disabled={disabled}
            quantity={quantityFor(item)}
            onOpen={() => onOpen(item)}
            onAdd={() => onAdd(item)}
            onIncrease={() => onIncrease(item)}
            onDecrease={() => onDecrease(item)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export default function SupermarketProductDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; storeId?: string }>();
  const productId = param(params.id);
  const storeId = param(params.storeId);
  const { width: windowWidth } = useWindowDimensions();
  const pageWidth = Math.min(windowWidth, MAX_PAGE_WIDTH);
  const heroHeight = Math.min(490, Math.max(330, pageWidth * 1.08));
  const recommendationCardWidth = Math.min(190, Math.max(146, pageWidth * 0.41));
  const savedAreaId = useCustomerStore(state => state.locationServiceAreaId);
  const insets = useSafeAreaInsets();

  const carts = useCartStore(state => state.carts);
  const addItem = useCartStore(state => state.addItem);
  const increaseStoreItem = useCartStore(state => state.increaseStoreItem);
  const decreaseStoreItem = useCartStore(state => state.decreaseStoreItem);
  const setActiveCart = useCartStore(state => state.setActiveCart);
  const [catalog, setCatalog] = useState<StoreCatalog | null>(null);
  const [productBrand, setProductBrand] = useState<SupermarketProductBrand | null>(null);
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [currency, setCurrency] = useState('EGP');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  // Quantity chosen for the next add-to-cart action; it does not change cart until Add is pressed.
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [boughtTogetherIds, setBoughtTogetherIds] = useState<string[]>([]);
  const imageScrollRef = useRef<ScrollView>(null);
  const mainScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setFailed(false);
      setCatalog(null);
      setProduct(null);
      setBoughtTogetherIds([]);
      try {
        if (!productId || !storeId) throw new Error('Invalid product link');
        const bootstrap = await getAppBootstrap();
        const areaId = savedAreaId ?? bootstrap.settings.default_service_area_id ?? undefined;
        const loadedCatalog = await getStoreCatalog(storeId, areaId);
        const selected = loadedCatalog.sections
          .flatMap(section => section.products)
          .find(item => item.id === productId);
        if (!selected) throw new Error('Product not found in current catalog');
        if (!active) return;
        setCatalog(loadedCatalog);
        setProduct(selected);
        setSelectedVariantId(
          selected.variants.find(variant => variant.isDefault)?.id ??
          selected.variants[0]?.id ?? null,
        );
        setCurrency(bootstrap.settings.currency_code || 'EGP');
        setImageIndex(0);
        setDescriptionExpanded(false);
        setSelectedQuantity(1);
        mainScrollRef.current?.scrollTo({ y: 0, animated: false });
      } catch (error) {
        if (active) {
          console.warn('Unable to open supermarket product:', error);
          setFailed(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [productId, storeId, savedAreaId, retryKey]);

  // A small aggregate RPC reads only product IDs co-purchased in at least two
  // accepted orders; it never returns customer or order information.
  // Failure must not block product details or checkout.
  useEffect(() => {
    if (!product || !catalog || !storeId) return;
    let active = true;
    setBoughtTogetherIds([]);
    void supabase.rpc('get_supermarket_bought_together', {
      p_store_id: storeId,
      p_product_id: product.id,
      p_limit: RECOMMENDATION_LIMIT,
    }).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.warn('Unable to load co-purchase suggestions:', error.message);
        return;
      }
      const ids = (Array.isArray(data) ? data : [])
        .map((row: { product_id?: unknown }) => row.product_id)
        .filter((value): value is string => typeof value === 'string');
      setBoughtTogetherIds(ids);
    }, () => {
      // PostgREST RPC builders are PromiseLike, not native Promise;
      // failure should never block the product page.
    });
    return () => { active = false; };
  }, [product, catalog, storeId]);

  const catalogProducts = useMemo(() => {
    const map = new Map<string, CatalogProduct>();
    for (const section of catalog?.sections ?? []) {
      for (const item of section.products) map.set(item.id, item);
    }
    return map;
  }, [catalog]);

  const frequentlyBought = useMemo(
    () => boughtTogetherIds
      .map(id => catalogProducts.get(id))
      .filter((item): item is CatalogProduct => Boolean(item) && item!.id !== productId),
    [boughtTogetherIds, catalogProducts, productId],
  );

  const relatedProducts = useMemo(() => {
    if (!product || frequentlyBought.length > 0) return [] as CatalogProduct[];
    const candidates = [...catalogProducts.values()].filter(item => item.id !== productId);
    const sameCategory = candidates.filter(item => item.catalogCategoryId === product.catalogCategoryId);
    // Even a one-product category can offer useful alternatives; never imply
    // basket co-purchase evidence when the aggregate signal is unavailable.
    const remaining = candidates.filter(item => item.catalogCategoryId !== product.catalogCategoryId);
    return [...sameCategory, ...remaining].slice(0, RECOMMENDATION_LIMIT);
  }, [catalogProducts, frequentlyBought.length, product, productId]);

  const discountedProducts = useMemo(() => {
    if (!product) return [] as CatalogProduct[];
    const frequentlyIds = new Set(frequentlyBought.map(item => item.id));
    return [...catalogProducts.values()]
      .filter(item => item.id !== productId && priceInfoFor(item).discount !== null)
      .sort((a, b) => {
        // Prioritize products relevant to the open category, then real discount.
        const aCategory = Number(a.catalogCategoryId === product.catalogCategoryId);
        const bCategory = Number(b.catalogCategoryId === product.catalogCategoryId);
        if (aCategory !== bCategory) return bCategory - aCategory;
        const aAlreadyShown = Number(frequentlyIds.has(a.id));
        const bAlreadyShown = Number(frequentlyIds.has(b.id));
        if (aAlreadyShown !== bAlreadyShown) return aAlreadyShown - bAlreadyShown;
        return (priceInfoFor(b).discount ?? 0) - (priceInfoFor(a).discount ?? 0);
      })
      .slice(0, RECOMMENDATION_LIMIT);
  }, [catalogProducts, frequentlyBought, product, productId]);

  // Brand comes from products.brand_id, not by guessing text in product names.
  // Loading brand metadata separately keeps the product screen fast even if
  // the optional brand lookup is unavailable.
  useEffect(() => {
    let active = true;
    setProductBrand(null);
    if (!product?.id || !storeId) return () => { active = false; };

    void getSupermarketProductBrand(storeId, product.id)
      .then(brand => {
        if (active) setProductBrand(brand);
      })
      .catch(error => {
        console.warn('Unable to load supermarket product brand:', error);
      });

    return () => { active = false; };
  }, [product?.id, storeId]);

  // Share the supermarket search bar and its rotating category suggestions.
  const searchSuggestions = useMemo(
    () => catalog?.sections
      .filter(section => section.depth === 0)
      .map(section => section.name) ?? [],
    [catalog],
  );

  const images = useMemo(() => product ? imagesForProduct(product) : [], [product]);
  const selectedVariant: ProductVariant | null = useMemo(
    () => product?.variants.find(v => v.id === selectedVariantId) ?? null,
    [product, selectedVariantId],
  );
  const price = selectedVariant?.price ?? product?.price ?? 0;
  // Do not apply a different variant's compare-at price to the selected variant.
  const compareAt = selectedVariant ? selectedVariant.compareAtPrice : product?.compareAtPrice ?? null;
  const discount = discountFor(price, compareAt);
  const disabled = !catalog || catalog.store.isManuallyClosed || !isOpenNow(catalog.businessHours);
  const cartItems = carts[storeId]?.items ?? [];
  const storeCartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  const selectedTotal = price * selectedQuantity;
  const selectedOldTotal = discount !== null && compareAt !== null
    ? compareAt * selectedQuantity
    : null;
  const description = product?.description?.trim() ?? '';
  const descriptionIsLong = description.length > 135;

  const addProductToCart = (chosenProduct: CatalogProduct, chosenVariant: ProductVariant | null) => {
    if (!catalog || disabled) return;
    const result = addItem({
      id: catalog.store.id,
      name: catalog.store.name,
      icon: catalog.store.icon,
      categorySlug: 'supermarket',
      deliveryFee: catalog.delivery.deliveryFee,
      minimumOrder: catalog.delivery.minimumOrder,
    }, {
      id: chosenProduct.id,
      name: chosenProduct.name,
      description: chosenProduct.description,
      price: chosenVariant?.price ?? chosenProduct.price,
      icon: chosenProduct.icon,
      variantId: chosenVariant?.id ?? null,
      variantName: chosenVariant?.name ?? null,
    });
    if (result !== 'added') return false;
    setActiveCart(storeId);
    return true;
  };

  // A single action adds the requested number of units of the selected variant.
  // The +/- selector edits a draft quantity (minimum 1), not the live cart.
  const addToCart = () => {
    if (!product || !catalog || disabled) return;
    // Update the cart before leaving this screen. Do not navigate if
    // the cart rejected the product (for example, an unsupported category).
    if (!addProductToCart(product, selectedVariant)) return;

    for (let index = 1; index < selectedQuantity; index += 1) {
      increaseStoreItem(storeId, product.id, selectedVariant?.id ?? null);
    }
    setSelectedQuantity(1);

    // Return to the exact list the customer opened this product from,
    // including campaign and recommendation lists.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/category/supermarket');
    }
  };

  const increaseMainQuantity = () => {
    if (disabled) return;
    setSelectedQuantity(previous => Math.min(99, previous + 1));
  };

  const decreaseMainQuantity = () => {
    setSelectedQuantity(previous => Math.max(1, previous - 1));
  };

  const openRecommendedProduct = (item: CatalogProduct) => {
    router.push({
      pathname: '/supermarket-product/[id]',
      params: { id: item.id, storeId },
    });
  };

  const quickAddRecommended = (item: CatalogProduct) => {
    if (disabled) return;
    // Multiple sizes need explicit customer choice. Never silently add the
    // default/first variant when the product has multiple variants.
    if (item.variants.length > 1 || item.isAgeRestricted) {
      openRecommendedProduct(item);
      return;
    }
    addProductToCart(item, item.variants[0] ?? null);
  };

  const quantityForRecommendation = (item: CatalogProduct) => {
    const { variant } = priceInfoFor(item);
    return cartItems
      .filter(line => line.id === item.id && (line.variantId ?? null) === (variant?.id ?? null))
      .reduce((sum, line) => sum + line.quantity, 0);
  };

  const increaseRecommended = (item: CatalogProduct) => {
    if (disabled) return;
    if (item.variants.length > 1 || item.isAgeRestricted) {
      openRecommendedProduct(item);
      return;
    }
    if (quantityForRecommendation(item) === 0) quickAddRecommended(item);
    else increaseStoreItem(storeId, item.id, priceInfoFor(item).variant?.id ?? null);
  };

  const decreaseRecommended = (item: CatalogProduct) => {
    if (quantityForRecommendation(item) <= 0) return;
    if (item.variants.length > 1 || item.isAgeRestricted) return;
    decreaseStoreItem(storeId, item.id, priceInfoFor(item).variant?.id ?? null);
  };

  const openProductBrand = () => {
    if (!productBrand) return;
    router.push({
      pathname: '/supermarket-campaign/[id]',
      params: {
        id: productBrand.id,
        storeId,
        view: 'catalog-brand',
      },
    });
  };

  const openCart = () => {
    setActiveCart(storeId);
    router.push({ pathname: '/cart', params: { storeId } });
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
      <Stack.Screen options={{ headerShown: false, animation: 'slide_from_bottom', gestureEnabled: true }} />
      <StatusBar style="dark" />
      <View style={[styles.page, { width: pageWidth }]}>
        {/* Same header structure, spacing, and shared search as category/supermarket.tsx. */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="رجوع"
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.headerButtonPressed,
            ]}
            onPress={() => router.back()}
          >
            <Ionicons
              color={NAVIENTY_NOW_COLORS.text}
              name="arrow-back-outline"
              size={20}
            />
          </Pressable>
          <CategorySearchEntry
            scope="supermarket"
            suggestions={searchSuggestions}
            style={styles.headerSearchEntry}
          />
        </View>
        {loading ? (
          <View style={styles.loadingPanel}>
            <View style={[styles.skeletonHero, { height: heroHeight }]}>
              <ActivityIndicator size="large" color={GREEN} />
            </View>
            <View style={styles.skeletonCopy}>
              <View style={[styles.skeletonLine, { width: '78%', height: 26 }]} />
              <View style={[styles.skeletonLine, { width: '44%' }]} />
              <View style={[styles.skeletonLine, { width: '90%' }]} />
            </View>
          </View>
        ) : failed || !product || !catalog ? (
          <View style={styles.errorPanel}>
            <Ionicons name="cube-outline" size={42} color="#9E9E9E" />
            <Text style={styles.errorTitle}>المنتج غير متاح حاليًا</Text>
            <Text style={styles.errorCaption}>ممكن يكون المنتج اتشال أو فيه مشكلة في الاتصال.</Text>
            <Pressable onPress={() => setRetryKey(value => value + 1)} style={styles.retryButton}>
              <Text style={styles.retryLabel}>إعادة المحاولة</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView
              ref={mainScrollRef}
              style={styles.scroll}
              contentContainerStyle={[styles.scrollContent, { paddingBottom: 130 + insets.bottom }]}
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.hero, { height: heroHeight }]}>
                {images.length ? (
                  <ScrollView
                    ref={imageScrollRef}
                    horizontal
                    pagingEnabled
                    directionalLockEnabled
                    nestedScrollEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={event => {
                      setImageIndex(Math.max(0, Math.min(images.length - 1,
                        Math.round(event.nativeEvent.contentOffset.x / pageWidth))));
                    }}
                  >
                    {images.map((uri, index) => (
                      <ExpoImage
                        key={`${product.id}-${index}`}
                        source={{ uri }}
                        contentFit="contain"
                        cachePolicy="memory-disk"
                        transition={150}
                        style={{ width: pageWidth, height: heroHeight }}
                      />
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.emoji}>{product.icon || '🛒'}</Text>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`عرض السلة، ${storeCartCount} منتجات`}
                  onPress={openCart}
                  style={styles.heroCartButton}
                >
                  <Ionicons name="bag-handle-outline" size={22} color={GREEN} />
                  {storeCartCount > 0 ? (
                    <View style={styles.heroCartBadge}>
                      <Text style={styles.heroCartBadgeText}>{storeCartCount > 99 ? '99+' : storeCartCount}</Text>
                    </View>
                  ) : null}
                </Pressable>
                {images.length > 1 && (
                  <View pointerEvents="none" style={styles.pagination}>
                    {images.slice(0, 7).map((uri, index) => (
                      <View key={`${uri}-${index}`} style={[styles.pageDot, index === imageIndex && styles.pageDotActive]} />
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.details}>
                {productBrand ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`عرض جميع منتجات ${productBrand.name}`}
                    onPress={openProductBrand}
                    hitSlop={8}
                    style={styles.brandLink}
                  >
                    <Text style={styles.brandLinkText} numberOfLines={1}>{productBrand.name}</Text>
                    <Ionicons name="chevron-back" size={15} color={GREEN} />
                  </Pressable>
                ) : null}
                <Text style={styles.productTitle}>{product.name}</Text>
                {product.unitLabelAr ? (
                  <Text style={styles.unitLine}>{product.unitLabelAr}</Text>
                ) : null}
                {description ? (
                  <View style={styles.descriptionBox}>
                    <Text style={styles.description} numberOfLines={descriptionExpanded ? undefined : 3}>
                      {description}
                    </Text>
                    {descriptionIsLong && (
                      <Pressable hitSlop={8} onPress={() => setDescriptionExpanded(value => !value)}>
                        <Text style={styles.more}>{descriptionExpanded ? 'عرض أقل' : 'المزيد'}</Text>
                      </Pressable>
                    )}
                  </View>
                ) : null}

                {product.variants.length > 1 ? (
                  <View style={styles.variantSection}>
                    <Text style={styles.sectionTitle}>اختار الحجم أو النوع</Text>
                    <View style={styles.variants}>
                      {product.variants.map(variant => {
                        const selected = variant.id === selectedVariantId;
                        return (
                          <Pressable
                            key={variant.id}
                            accessibilityRole="radio"
                            accessibilityState={{ selected }}
                            onPress={() => {
                              setSelectedVariantId(variant.id);
                              setSelectedQuantity(1);
                            }}
                            style={[styles.variantCard, selected && styles.variantCardSelected]}
                          >
                            <Text style={[styles.variantName, selected && styles.variantNameSelected]} numberOfLines={2}>
                              {variant.name}
                            </Text>
                            <Text style={styles.variantPrice} numberOfLines={1}>
                              {formatPrice(variant.price, currency)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}


              </View>

              <View style={styles.recommendationCollection}>
                <RecommendationSection
                  title={frequentlyBought.length ? 'عادةً ما يتم شراؤها مع' : 'قد يعجبك أيضًا'}
                  products={frequentlyBought.length ? frequentlyBought : relatedProducts}
                  cardWidth={recommendationCardWidth}
                  currency={currency}
                  disabled={disabled}
                  quantityFor={quantityForRecommendation}
                  onOpen={openRecommendedProduct}
                  onAdd={quickAddRecommended}
                  onIncrease={increaseRecommended}
                  onDecrease={decreaseRecommended}
                />
                <RecommendationSection
                  title="تسوّق أكثر بسعر أقل"
                  products={discountedProducts}
                  cardWidth={recommendationCardWidth}
                  currency={currency}
                  disabled={disabled}
                  quantityFor={quantityForRecommendation}
                  onOpen={openRecommendedProduct}
                  onAdd={quickAddRecommended}
                  onIncrease={increaseRecommended}
                  onDecrease={decreaseRecommended}
                />
              </View>
            </ScrollView>

          </>
        )}

        {/* Always register ownership, including loading: never show the fallback cart here. */}
        <BottomActionSlot kind="product-purchase" priority={300}>
          {!loading && !failed && product && catalog ? (
            <View pointerEvents="box-none" style={styles.purchaseDock}>
            {/* Bottom purchase bar: quantity on the left, one green CTA on the right. */}
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) } ]}>
              <View style={[styles.footerQuantitySelector, { width: Math.max(116, Math.min(146, Math.round(pageWidth * 0.32))) }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="تقليل الكمية المختارة"
                  accessibilityState={{ disabled: selectedQuantity <= 1 }}
                  disabled={selectedQuantity <= 1}
                  onPress={decreaseMainQuantity}
                  hitSlop={5}
                  style={styles.footerQuantityTouch}
                >
                  <Text style={[styles.footerQuantitySymbol, selectedQuantity <= 1 && styles.footerQuantitySymbolDisabled]}>−</Text>
                </Pressable>
                <Text style={styles.footerSelectedQuantity} accessibilityLabel={`الكمية ${selectedQuantity}`}>{selectedQuantity}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="زيادة الكمية المختارة"
                  accessibilityState={{ disabled: disabled || selectedQuantity >= 99 }}
                  disabled={disabled || selectedQuantity >= 99}
                  onPress={increaseMainQuantity}
                  hitSlop={5}
                  style={styles.footerQuantityTouch}
                >
                  <Text style={[styles.footerQuantitySymbol, (disabled || selectedQuantity >= 99) && styles.footerQuantitySymbolDisabled]}>+</Text>
                </Pressable>
              </View>

              <Pressable
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={disabled
                  ? 'الماركت مغلق حاليًا'
                  : `أضف ${selectedQuantity} من ${product.name} للسلة، الإجمالي ${formatPrice(selectedTotal, currency)}`}
                onPress={addToCart}
                style={({ pressed }) => [
                  styles.footerPurchaseButton,
                  disabled && styles.footerPurchaseDisabled,
                  pressed && !disabled && styles.footerPurchasePressed,
                ]}
              >
                <Text style={styles.footerPurchaseLabel} numberOfLines={1} adjustsFontSizeToFit>
                  {disabled ? 'مغلق' : 'أضف للسلة'}
                </Text>
                <View style={styles.footerPurchasePrices}>
                  <Text style={styles.footerPriceNow} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                    {formatPrice(selectedTotal, currency)}
                  </Text>
                  {selectedOldTotal !== null ? (
                    <Text style={styles.footerPriceOld} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                      {formatPrice(selectedOldTotal, currency)}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            </View>

            </View>
          ) : null}
        </BottomActionSlot>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  page: { flex: 1, alignSelf: 'center', maxWidth: MAX_PAGE_WIDTH, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { paddingBottom: 24 },
  hero: { position: 'relative', backgroundColor: PRODUCT_BG, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  emoji: { fontSize: 100 },
  header: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    zIndex: 10,
  },
  headerSearchEntry: {
    flex: 1,
    marginBottom: 0,
    marginHorizontal: 0,
    marginTop: 0,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E6E6E6',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerButtonPressed: {
    backgroundColor: '#F7F7F7',
    transform: [{ scale: 0.97 }],
  },
  heroCartButton: {
    position: 'absolute', top: 20, left: 20, width: 46, height: 46,
    borderRadius: 24, borderWidth: 1, borderColor: '#E9E9E9',
    backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', zIndex: 4,
  },
  heroCartBadge: {
    position: 'absolute', top: -5, right: -5, minWidth: 19, height: 19,
    borderRadius: 10, backgroundColor: '#C7FF00', paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  heroCartBadgeText: { fontSize: 10, fontWeight: '800', color: '#1A1A1A' },
  pagination: { flexDirection: 'row', position: 'absolute', bottom: 23, alignSelf: 'center', gap: 6, backgroundColor: 'rgba(40,40,40,0.18)', borderRadius: 30, paddingHorizontal: 10, paddingVertical: 8 },
  pageDot: { width: 6, height: 6, borderRadius: 6, backgroundColor: '#D1D1D1' },
  pageDotActive: { backgroundColor: '#FFFFFF', width: 9 },
  details: { paddingHorizontal: 20, paddingTop: 25, paddingBottom: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, marginTop: -12, backgroundColor: '#FFFFFF' },
  brandLink: {
    flexDirection: 'row-reverse', alignItems: 'center', alignSelf: 'flex-end',
    gap: 4, marginBottom: 10, maxWidth: '100%', minHeight: 28,
  },
  brandLinkText: {
    fontSize: 13, fontWeight: '700', color: GREEN, textAlign: 'right',
    writingDirection: 'rtl', flexShrink: 1,
  },
  productTitle: {
    fontSize: 19, fontWeight: '700', color: '#171717',
    textAlign: 'right', writingDirection: 'rtl', lineHeight: 28,
  },
  unitLine: { marginTop: 9, fontSize: 14, color: '#8A8A8A', textAlign: 'right', writingDirection: 'rtl' },
  descriptionBox: { alignItems: 'flex-end', marginTop: 24, gap: 6 },
  description: { fontSize: 14, color: '#737373', textAlign: 'right', writingDirection: 'rtl', lineHeight: 24 },
  more: { fontSize: 14, color: '#242424', fontWeight: '700', textDecorationLine: 'underline' },
  variantSection: { marginTop: 30, gap: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#252525', textAlign: 'right', writingDirection: 'rtl' },
  variants: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12 },
  variantCard: { width: '47%', minHeight: 106, borderColor: '#E1E1E1', borderWidth: 1.5, borderRadius: 15, backgroundColor: '#FFFFFF', padding: 12, justifyContent: 'center', alignItems: 'center', gap: 10 },
  variantCardSelected: { borderColor: '#1D1D1D', borderWidth: 2 },
  variantName: { color: '#242424', fontSize: 15, fontWeight: '700', textAlign: 'center', writingDirection: 'rtl' },
  variantNameSelected: { color: '#111111' },
  variantPrice: { fontSize: 12, color: '#777777' },

  recommendationCollection: { paddingBottom: 20, paddingTop: 8, gap: 28 },
  recommendationSection: { gap: 14 },
  recommendationSectionTitle: {
    fontSize: 23,
    fontWeight: '900',
    color: '#1C1C1C',
    textAlign: 'right',
    writingDirection: 'rtl',
    paddingHorizontal: 20,
    lineHeight: 33,
  },
  recommendationRail: { flexGrow: 0 },
  recommendationRailContent: {
    flexDirection: 'row-reverse',
    gap: RECOMMENDATION_GAP,
    paddingHorizontal: 20,
    paddingBottom: 7,
  },
  recommendationCard: { backgroundColor: '#FFFFFF' },
  recommendationCardPressed: { opacity: 0.86 },
  recommendationImageBox: {
    width: '100%',
    backgroundColor: PRODUCT_BG,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  recommendationEmoji: { fontSize: 44 },
  recommendationDiscount: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#C7FF00',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
    zIndex: 3,
  },
  recommendationDiscountText: { fontSize: 11, fontWeight: '800', color: '#181818' },
  // Exact add/quantity control proportions used by supermarket-category offers cards.
  recommendationAddButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E1E1E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 7,
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
  },
  recommendationAddPressed: { transform: [{ scale: 0.95 }], backgroundColor: '#F7F7F7' },
  recommendationAddDisabled: { opacity: 0.45 },
  recommendationPlus: { color: GREEN, fontWeight: '300', fontSize: 29, lineHeight: 31, marginTop: -3 },
  recommendationQuantityPill: {
    position: 'absolute', bottom: 8, right: 8,
    height: 40, borderRadius: 20, borderWidth: 1,
    borderColor: '#E1E1E1', backgroundColor: '#FFFFFF',
    flexDirection: 'row', alignItems: 'center', zIndex: 7,
    elevation: 3, shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 5,
  },
  quantityAction: { width: 28, height: 40, alignItems: 'center', justifyContent: 'center' },
  quantityActionText: { color: GREEN, fontSize: 19, fontWeight: '500' },
  quantityText: { color: '#202020', fontSize: 12, fontWeight: '700', minWidth: 16, textAlign: 'center' },
  recommendationName: {
    color: '#202020',
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: 8,
    minHeight: 38,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  recommendationUnit: { color: '#989898', fontSize: 11.5, marginTop: 2, textAlign: 'right', writingDirection: 'rtl' },
  recommendationPriceRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 5, alignItems: 'center', marginTop: 6, minHeight: 19 },
  recommendationPriceUnderline: { borderBottomColor: '#C7FF00', borderBottomWidth: 2 },
  recommendationPrice: { fontSize: 13.5, fontWeight: '800', color: '#202020', writingDirection: 'rtl' },
  recommendationOldPrice: { color: '#919191', fontSize: 11.5, textDecorationLine: 'line-through', writingDirection: 'rtl' },

  purchaseDock: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center', backgroundColor: 'transparent',
  },
  // Physical LTR row to match the reference: white stepper (left), green CTA (right).
  footer: {
    width: '100%',
    maxWidth: MAX_PAGE_WIDTH,
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 94,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#FFFFFF',
    borderTopColor: '#F0F0F0',
    borderTopWidth: 1,
  },
  footerQuantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 64,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E6E6E9',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 4,
  },
  footerQuantityTouch: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 58,
  },
  footerQuantitySymbol: { color: GREEN, fontSize: 28, fontWeight: '400', lineHeight: 34 },
  footerQuantitySymbolDisabled: { color: '#D1D3D6' },
  footerSelectedQuantity: { color: '#171717', fontSize: 20, fontWeight: '700', textAlign: 'center', minWidth: 20 },
  footerPurchaseButton: {
    direction: 'ltr',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
    height: 64,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: GREEN,
  },
  footerPurchasePressed: { backgroundColor: NAVIENTY_NOW_COLORS.primaryPressed, transform: [{ scale: 0.99 }] },
  footerPurchaseDisabled: { backgroundColor: '#ABBFB1' },
  footerPurchaseLabel: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  footerPurchasePrices: { flexShrink: 1, alignItems: 'flex-end', justifyContent: 'center', gap: 2 },
  footerPriceNow: { fontSize: 16, color: '#FFFFFF', fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  footerPriceOld: { fontSize: 11.5, color: '#E0F8E9', textDecorationLine: 'line-through', textAlign: 'right', writingDirection: 'rtl' },
  loadingPanel: { flex: 1 },
  skeletonHero: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5' },
  skeletonCopy: { padding: 24, gap: 14 },
  skeletonLine: { backgroundColor: '#ECECEC', borderRadius: 8, height: 18 },
  errorPanel: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 14 },
  errorTitle: { fontSize: 18, fontWeight: '800', color: '#222222' },
  errorCaption: { fontSize: 13, color: '#777777', textAlign: 'center' },
  retryButton: { backgroundColor: GREEN, borderRadius: 14, paddingHorizontal: 26, paddingVertical: 12 },
  retryLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});

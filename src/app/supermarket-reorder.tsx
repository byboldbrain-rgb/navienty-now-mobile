import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CategoryCartDock from '../components/cart/category-cart-dock';
import getAppBootstrap from '../services/bootstrap-service';
import {
    type CatalogProduct,
    getStoreCatalog,
    type StoreBusinessHour,
    type StoreCatalog,
} from '../services/catalog-service';
import { getMyOrders } from '../services/order-service';
import { useCartStore } from '../store/cart-store';
import { useCustomerStore } from '../store/customer-store';

const GREEN = '#00B14F';
const GREEN_DARK = '#009245';
const WHITE = '#FFFFFF';
const PAGE_PADDING = 16;
const PRODUCT_GAP = 10;

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function getImages(product: CatalogProduct): string[] {
  const sorted = [...product.images].sort(
    (a, b) => Number(b.isCover) - Number(a.isCover),
  );
  return [...new Set(
    [product.imageUrl, ...sorted.map(image => image.imageUrl)]
      .filter((url): url is string => Boolean(url?.trim())),
  )];
}

function formatMoney(value: number, currency: string): string {
  return `${value.toFixed(2)} ${currency.toUpperCase() === 'EGP' ? 'ج.م' : currency}`;
}

function getDiscount(product: CatalogProduct): number | null {
  const oldPrice = product.compareAtPrice;
  if (oldPrice === null || oldPrice <= 0 || oldPrice <= product.price) return null;
  return Math.round((1 - product.price / oldPrice) * 100);
}

function timeInMinutes(value: string | null): number | null {
  if (!value) return null;
  const [hourText, minuteText = '0'] = value.split(':');
  const hours = Number(hourText);
  const minutes = Number(minuteText);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) ||
      hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function storeIsOpen(hours: StoreBusinessHour[]): boolean {
  if (hours.length === 0) return true;
  const now = new Date();
  const day = now.getDay();
  const minute = now.getHours() * 60 + now.getMinutes();
  const today = hours.find(item => item.dayOfWeek === day);
  const yesterday = hours.find(item => item.dayOfWeek === (day + 6) % 7);

  if (today?.isOpen) {
    const start = timeInMinutes(today.openTime);
    const end = timeInMinutes(today.closeTime);
    if (start !== null && end !== null) {
      if (start === end) return true;
      if (end > start && minute >= start && minute < end) return true;
      if (end < start && minute >= start) return true;
    }
  }

  if (yesterday?.isOpen) {
    const start = timeInMinutes(yesterday.openTime);
    const end = timeInMinutes(yesterday.closeTime);
    if (start !== null && end !== null && end < start && minute < end) return true;
  }
  return false;
}

type ReorderTileProps = {
  product: CatalogProduct;
  width: number;
  currency: string;
  quantity: number;
  closed: boolean;
  onAdd: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
};

function ReorderTile({
  product,
  width,
  currency,
  quantity,
  closed,
  onAdd,
  onIncrease,
  onDecrease,
}: ReorderTileProps) {
  const images = useMemo(() => getImages(product), [product]);
  const [imageIndex, setImageIndex] = useState(0);
  const discount = getDiscount(product);
  return (
    <View style={[styles.productCard, { width }]}>
      <View style={[styles.imageFrame, { height: width }]}>
        {images.length > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            style={{ width, height: width }}
            nestedScrollEnabled
            directionalLockEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={event => {
              const offset = event.nativeEvent.contentOffset.x;
              setImageIndex(Math.max(0, Math.min(images.length - 1, Math.round(offset / width))));
            }}
          >
            {images.map((uri, index) => (
              <ExpoImage
                key={`${product.id}-${index}`}
                source={{ uri }}
                style={{ width, height: width }}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={120}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.imageFallback}>
            <Text style={styles.imageFallbackEmoji}>{product.icon || '🛒'}</Text>
          </View>
        )}

        {discount !== null ? (
          <View pointerEvents="none" style={styles.discountBadge}>
            <Text style={styles.discountLabel}>وفر {discount}%</Text>
          </View>
        ) : null}

        {images.length > 1 ? (
          <View pointerEvents="none" style={styles.dotsContainer}>
            {images.slice(0, 5).map((uri, index) => (
              <View
                key={`${uri}-${index}`}
                style={[styles.dot, index === imageIndex && styles.dotActive]}
              />
            ))}
          </View>
        ) : null}

        {quantity === 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`إضافة ${product.name} للسلة`}
            disabled={closed}
            onPress={onAdd}
            style={({ pressed }) => [
              styles.addButton,
              closed && styles.buttonDisabled,
              pressed && !closed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.addButtonText}>+</Text>
          </Pressable>
        ) : (
          <View style={styles.quantityControl}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`تقليل ${product.name}`}
              onPress={onDecrease}
              style={styles.quantityButton}
            >
              <Text style={styles.quantityAction}>−</Text>
            </Pressable>
            <Text style={styles.quantityValue}>{quantity}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`زيادة ${product.name}`}
              disabled={closed}
              onPress={onIncrease}
              style={styles.quantityButton}
            >
              <Text style={styles.quantityAction}>+</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Text numberOfLines={2} style={styles.productName}>{product.name}</Text>
      {product.unitLabelAr ? (
        <Text numberOfLines={1} style={styles.unitLabel}>{product.unitLabelAr}</Text>
      ) : null}
      <View style={styles.pricesRow}>
        <View style={discount !== null ? styles.priceUnderline : undefined}>
          <Text numberOfLines={1} style={styles.productPrice}>
            {formatMoney(product.price, currency)}
          </Text>
        </View>
        {discount !== null && product.compareAtPrice !== null ? (
          <Text numberOfLines={1} style={styles.oldPrice}>
            {formatMoney(product.compareAtPrice, currency)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function SupermarketReorderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ storeId?: string }>();
  const storeId = firstParam(params.storeId);
  const serviceAreaId = useCustomerStore(state => state.locationServiceAreaId);
  const { width: windowWidth } = useWindowDimensions();
  const pageWidth = Math.min(windowWidth, 560);
  const tileWidth = Math.max(1, (pageWidth - PAGE_PADDING * 2 - PRODUCT_GAP) / 2);

  const carts = useCartStore(state => state.carts);
  const addItem = useCartStore(state => state.addItem);
  const increaseStoreItem = useCartStore(state => state.increaseStoreItem);
  const decreaseStoreItem = useCartStore(state => state.decreaseStoreItem);
  const setActiveCart = useCartStore(state => state.setActiveCart);

  const [catalog, setCatalog] = useState<StoreCatalog | null>(null);
  const [currency, setCurrency] = useState('EGP');
  const [orderedProductIds, setOrderedProductIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setHasError(false);
      setCatalog(null);
      setOrderedProductIds([]);
      try {
        if (!storeId) throw new Error('Missing supermarket store ID');
        const [bootstrap, orders] = await Promise.all([
          getAppBootstrap(),
          getMyOrders(),
        ]);
        const area = serviceAreaId ?? bootstrap.settings.default_service_area_id ?? undefined;
        const loadedCatalog = await getStoreCatalog(storeId, area);

        const sortedOrders = [...orders].sort(
          (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
        );
        const seen = new Set<string>();
        const ids: string[] = [];
        for (const order of sortedOrders) {
          if (order.storeId !== storeId) continue;
          if (!['confirmed', 'preparing', 'out-for-delivery', 'delivered'].includes(order.status)) continue;
          for (const item of order.items) {
            if (!item.productId || seen.has(item.productId)) continue;
            seen.add(item.productId);
            ids.push(item.productId);
          }
        }
        if (!alive) return;
        setCatalog(loadedCatalog);
        setOrderedProductIds(ids);
        setCurrency(bootstrap.settings.currency_code || 'EGP');
      } catch (error) {
        if (alive) {
          console.warn('Unable to load repeat-order products:', error);
          setHasError(true);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => { alive = false; };
  }, [storeId, serviceAreaId, retryKey]);

  const products = useMemo(() => {
    const byId = new Map<string, CatalogProduct>();
    for (const section of catalog?.sections ?? []) {
      for (const product of section.products) byId.set(product.id, product);
    }
    return orderedProductIds
      .map(id => byId.get(id))
      .filter((product): product is CatalogProduct => Boolean(product));
  }, [catalog, orderedProductIds]);

  const visibleProducts = useMemo(() => {
    const text = query.trim().toLocaleLowerCase();
    if (!text) return products;
    return products.filter(product =>
      `${product.name} ${product.nameEn ?? ''} ${product.unitLabelAr ?? ''}`
        .toLocaleLowerCase()
        .includes(text),
    );
  }, [products, query]);

  const items = carts[storeId]?.items ?? [];
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const closed = !catalog || catalog.store.isManuallyClosed || !storeIsOpen(catalog.businessHours);
  const quantityFor = (id: string) => items.find(item => item.id === id)?.quantity ?? 0;

  const addProduct = (product: CatalogProduct) => {
    if (closed || !catalog) return;
    addItem({
      id: catalog.store.id,
      name: catalog.store.name,
      icon: catalog.store.icon,
      categorySlug: 'supermarket',
      deliveryFee: catalog.delivery.deliveryFee,
      minimumOrder: catalog.delivery.minimumOrder,
    }, {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      icon: product.icon,
    });
  };
  const increaseProduct = (product: CatalogProduct) => {
    if (closed) return;
    if (quantityFor(product.id) === 0) addProduct(product);
    else increaseStoreItem(storeId, product.id);
  };
  const decreaseProduct = (product: CatalogProduct) => {
    if (quantityFor(product.id) > 0) decreaseStoreItem(storeId, product.id);
  };
  const openCart = () => {
    setActiveCart(storeId);
    router.push({ pathname: '/cart', params: { storeId } });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />
      <View style={[styles.shell, { width: pageWidth }]}>
        {/* Header مطابق لواجهة supermarket-campaign/[id].tsx */}
        <View style={styles.header}>
          {searchOpen ? (
            <View style={styles.searchInputContainer}>
              <Ionicons name="search-outline" size={17} color="#222222" />
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder="ابحث في المنتجات اللي طلبتها"
                placeholderTextColor="#999999"
                style={styles.searchInput}
                textAlign="right"
                returnKeyType="search"
              />
              <Pressable
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="إغلاق البحث"
                onPress={() => {
                  setQuery('');
                  setSearchOpen(false);
                }}
              >
                <Ionicons name="close" size={18} color="#222222" />
              </Pressable>
            </View>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="رجوع"
                style={({ pressed }) => [styles.headerCircleButton, pressed && styles.pressed]}
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={20} color="#202020" />
              </Pressable>

              <View style={styles.headerTitleGroup}>
                <Text style={styles.headerTitle} numberOfLines={1}>اطلب من جديد</Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="بحث في المنتجات"
                style={({ pressed }) => [styles.headerCircleButton, pressed && styles.pressed]}
                onPress={() => setSearchOpen(true)}
              >
                <Ionicons name="search-outline" size={19} color="#202020" />
              </Pressable>
            </>
          )}
        </View>
        <FlatList
          data={loading || hasError ? [] : visibleProducts}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.productRow}
          contentContainerStyle={[styles.listContent, itemCount > 0 && styles.withCart]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <ReorderTile
              product={item}
              width={tileWidth}
              currency={currency}
              quantity={quantityFor(item.id)}
              closed={closed}
              onAdd={() => addProduct(item)}
              onIncrease={() => increaseProduct(item)}
              onDecrease={() => decreaseProduct(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              {loading ? (
                <>
                  <ActivityIndicator color={GREEN} size="large" />
                  <Text style={styles.emptyText}>بنجهز طلباتك السابقة...</Text>
                </>
              ) : hasError ? (
                <>
                  <Ionicons name="cloud-offline-outline" size={38} color="#777" />
                  <Text style={styles.emptyText}>مش قادرين نعرض طلباتك دلوقتي.</Text>
                  <Pressable style={styles.retryButton} onPress={() => setRetryKey(value => value + 1)}>
                    <Text style={styles.retryText}>إعادة المحاولة</Text>
                  </Pressable>
                </>
              ) : query.trim() ? (
                <>
                  <Ionicons name="search-outline" size={38} color="#AAA" />
                  <Text style={styles.emptyText}>مفيش منتجات مطابقة للبحث.</Text>
                </>
              ) : (
                <>
                  <Ionicons name="bag-handle-outline" size={38} color="#AAA" />
                  <Text style={styles.emptyText}>أول ما تطلب من الماركت، منتجاتك هتظهر هنا.</Text>
                </>
              )}
            </View>
          }
          ListFooterComponent={catalog && closed && !loading ? (
            <Text style={styles.closedNotice}>الماركت مغلق حاليًا، تقدر تتصفح المنتجات لحد ما يفتح.</Text>
          ) : null}
        />
        {catalog ? (
          <CategoryCartDock
            itemCount={itemCount}
            subtotal={subtotal}
            minimumOrder={catalog.delivery.minimumOrder}
            currencyCode={currency}
            accentColor={GREEN}
            accentDarkColor={GREEN_DARK}
            isScrollingDown={false}
            onPress={openCart}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  shell: { flex: 1, alignSelf: 'center', maxWidth: 560, backgroundColor: WHITE },
  listContent: { flexGrow: 1, paddingBottom: 40, backgroundColor: WHITE },
  withCart: { paddingBottom: 150 },
  // Identical header styles to supermarket-campaign/[id].tsx.
  header: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  headerCircleButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E1E1',
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerTitleGroup: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  headerTitle: {
    color: '#171717',
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  pressed: {
    backgroundColor: '#F6F6F6',
    transform: [{ scale: 0.97 }],
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


  productRow: {
    flexDirection: 'row-reverse',
    columnGap: PRODUCT_GAP,
    justifyContent: 'flex-start',
    paddingHorizontal: PAGE_PADDING,
  },
  productCard: { backgroundColor: WHITE, marginTop: 16, marginBottom: 8 },
  imageFrame: {
    backgroundColor: '#F7F7F7',
    borderColor: '#E4E4E4', borderWidth: 1, borderRadius: 20,
    overflow: 'hidden', position: 'relative', width: '100%',
    alignItems: 'center', justifyContent: 'center',
  },
  imageFallback: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  imageFallbackEmoji: { fontSize: 45 },
  discountBadge: {
    position: 'absolute', top: 8, right: 8, backgroundColor: '#C7FF00',
    borderRadius: 5, paddingVertical: 4, paddingHorizontal: 7, zIndex: 4,
  },
  discountLabel: { color: '#181818', fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  dotsContainer: {
    position: 'absolute', bottom: 10, left: 10, flexDirection: 'row', gap: 4,
    borderRadius: 16, backgroundColor: 'rgba(45,45,45,0.35)',
    paddingHorizontal: 6, paddingVertical: 5,
  },
  dot: { width: 5, height: 5, borderRadius: 4, backgroundColor: '#CFCFCF' },
  dotActive: { width: 12, backgroundColor: '#FFFFFF' },
  addButton: {
    position: 'absolute', right: 8, bottom: 8,
    width: 40, height: 40, backgroundColor: WHITE,
    borderWidth: 1, borderColor: '#E1E1E1', borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', zIndex: 5,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09, shadowRadius: 4,
  },
  addButtonText: { color: GREEN, fontWeight: '300', fontSize: 29, lineHeight: 31, marginTop: -3 },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { transform: [{ scale: 0.95 }], backgroundColor: '#F8F8F8' },
  quantityControl: {
    position: 'absolute', right: 8, bottom: 8, height: 40,
    borderRadius: 22, borderWidth: 1, borderColor: '#E1E1E1',
    backgroundColor: WHITE, flexDirection: 'row', alignItems: 'center', zIndex: 5,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09, shadowRadius: 4,
  },
  quantityButton: { width: 28, height: 40, justifyContent: 'center', alignItems: 'center' },
  quantityAction: { color: GREEN, fontWeight: '500', fontSize: 19 },
  quantityValue: { fontWeight: '800', fontSize: 12, color: '#202020', minWidth: 15, textAlign: 'center' },
  productName: {
    color: '#202020', fontSize: 13.5, fontWeight: '600', lineHeight: 20,
    minHeight: 40, marginTop: 8, textAlign: 'right', writingDirection: 'rtl',
  },
  unitLabel: {
    marginTop: 2, minHeight: 16, color: '#989898', fontSize: 11.5,
    textAlign: 'right', writingDirection: 'rtl',
  },
  pricesRow: {
    flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center',
    gap: 6, minHeight: 25, marginTop: 6,
  },
  priceUnderline: { borderBottomWidth: 2, borderBottomColor: '#C7FF00' },
  productPrice: { color: '#202020', fontSize: 14, fontWeight: '700', lineHeight: 19, writingDirection: 'rtl' },
  oldPrice: {
    color: '#979797', fontSize: 11.5,
    textDecorationLine: 'line-through', writingDirection: 'rtl',
  },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 65, gap: 15 },
  emptyText: { textAlign: 'center', color: '#777', fontSize: 14, lineHeight: 23 },
  retryButton: { paddingVertical: 12, paddingHorizontal: 20, backgroundColor: GREEN, borderRadius: 12 },
  retryText: { fontWeight: '700', color: WHITE },
  closedNotice: { color: '#B64B42', textAlign: 'center', paddingHorizontal: 18, marginTop: 24 },
});

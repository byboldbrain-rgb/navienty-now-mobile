import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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

import CategoryCartDock from '../../components/cart/category-cart-dock';
import Image from '../../components/ui/app-image';
import getAppBootstrap from '../../services/bootstrap-service';
import {
  type CatalogProduct,
  getStoreCatalog,
  type StoreBusinessHour,
  type StoreCatalog,
} from '../../services/catalog-service';
import {
  getSupermarketBrandCampaign,
  type SupermarketBrandCampaign,
} from '../../services/supermarket-campaign-service';
import { useCartStore } from '../../store/cart-store';
import { useCustomerStore } from '../../store/customer-store';

// Match product cards in supermarket-category/[slug].tsx (offers mode).
const GREEN = '#00B14F';
const GREEN_DARK = '#009245';
const COLUMN_GAP = 10;
const HORIZONTAL_PADDING = 16;

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

// Until the catalog exposes a canonical brandId, match the company name
// against product names while keeping all explicitly linked card products.
function normalizeBrandName(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^a-z0-9\u0621-\u064A]+/g, ' ')
    .trim();
}

function productImages(product: CatalogProduct): string[] {
  const all = [product.imageUrl, ...product.images
    .slice().sort((a, b) => Number(b.isCover) - Number(a.isCover))
    .map(image => image.imageUrl)]
    .filter((value): value is string => Boolean(value?.trim()));
  return [...new Set(all)];
}

function currencyText(value: number, currency: string): string {
  return `${value.toFixed(2)} ${currency.toUpperCase() === 'EGP' ? 'ج.م' : currency}`;
}

function discountPercent(product: CatalogProduct): number | null {
  if (!product.compareAtPrice || product.compareAtPrice <= product.price || product.price <= 0) return null;
  return Math.round((1 - product.price / product.compareAtPrice) * 100);
}

function toMinutes(value: string | null): number | null {
  if (!value) return null;
  const [hours, minutes = '0'] = value.split(':');
  const h = Number(hours), m = Number(minutes);
  return Number.isInteger(h) && Number.isInteger(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59
    ? h * 60 + m : null;
}

function storeIsOpen(hours: StoreBusinessHour[]): boolean {
  if (hours.length === 0) return true;
  const now = new Date();
  const today = now.getDay();
  const current = now.getHours() * 60 + now.getMinutes();
  const schedule = hours.find(hour => hour.dayOfWeek === today);
  const before = hours.find(hour => hour.dayOfWeek === (today + 6) % 7);
  if (before?.isOpen) {
    const from = toMinutes(before.openTime), until = toMinutes(before.closeTime);
    if (from !== null && until !== null && until < from && current < until) return true;
  }
  if (!schedule?.isOpen) return false;
  const start = toMinutes(schedule.openTime), end = toMinutes(schedule.closeTime);
  if (start === null || end === null) return false;
  if (start === end) return true;
  return end > start ? current >= start && current < end : current >= start;
}

function CampaignVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, instance => {
    instance.muted = true;
    instance.loop = true;
    instance.play();
  });
  // No pause() from cleanup: that can race with iOS native object disposal.
  return <VideoView player={player} nativeControls={false} contentFit="cover" surfaceType="textureView" style={styles.heroVideo} />;
}

type ProductTileProps = {
  product: CatalogProduct;
  width: number;
  quantity: number;
  currency: string;
  closed: boolean;
  onAdd: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
};

function ProductTile({ product, width, quantity, currency, closed, onAdd, onIncrease, onDecrease }: ProductTileProps) {
  const images = useMemo(() => productImages(product), [product]);
  const [imageIndex, setImageIndex] = useState(0);
  const discount = discountPercent(product);
  // Category product cards use square image frames.
  const imageHeight = width;
  return (
    <View style={[styles.productTile, { width }]}>
      <View style={[styles.productImageFrame, { height: imageHeight }]}>
        {images.length > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            directionalLockEnabled
            onMomentumScrollEnd={event => {
              setImageIndex(Math.min(images.length - 1, Math.max(0, Math.round(event.nativeEvent.contentOffset.x / width))));
            }}
          >
            {images.map((url, index) => (
              <ExpoImage
                key={`${product.id}-${index}`}
                source={{ uri: url }}
                style={{ width, height: imageHeight }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={120}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.imageFallback}><Text style={styles.imageFallbackIcon}>{product.icon || '🛒'}</Text></View>
        )}
        {discount !== null ? (
          <View style={styles.discountBadge}><Text numberOfLines={1} style={styles.discountText}>وفر {discount}%</Text></View>
        ) : null}
        {images.length > 1 ? (
          <View style={styles.imageDots} pointerEvents="none">
            {images.slice(0, 6).map((url, i) => <View key={`${url}-${i}`} style={[styles.imageDot, i === imageIndex && styles.imageDotSelected]} />)}
          </View>
        ) : null}
        {quantity === 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`إضافة ${product.name} إلى السلة`}
            disabled={closed}
            onPress={onAdd}
            style={({ pressed }) => [styles.addButton, closed && styles.disabledButton, pressed && !closed && styles.addButtonPressed]}
          >
            <Text style={styles.addButtonText}>+</Text>
          </Pressable>
        ) : (
          <View style={styles.quantityPill}>
            <Pressable accessibilityRole="button" accessibilityLabel="تقليل الكمية" onPress={onDecrease} style={styles.quantityAction}>
              <Text style={styles.quantityActionText}>−</Text>
            </Pressable>
            <Text style={styles.quantityText}>{quantity}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="زيادة الكمية" disabled={closed} onPress={onIncrease} style={styles.quantityAction}>
              <Text style={styles.quantityActionText}>+</Text>
            </Pressable>
          </View>
        )}
      </View>
      <Text numberOfLines={2} style={styles.productName}>{product.name}</Text>
      {product.unitLabelAr ? <Text numberOfLines={1} style={styles.productUnit}>{product.unitLabelAr}</Text> : null}
      <View style={styles.productPrices}>
        <View style={styles.currentPriceUnderline}>
          <Text numberOfLines={1} style={styles.productPrice}>{currencyText(product.price, currency)}</Text>
        </View>
        {discount !== null ? <Text numberOfLines={1} style={styles.oldPrice}>{currencyText(product.compareAtPrice!, currency)}</Text> : null}
      </View>
    </View>
  );
}

// A lightweight storefront skeleton keeps the page structured while data loads.
// It avoids an abrupt empty screen / spinner-to-content jump on slow networks.
function CampaignLoadingSkeleton({
  showHero,
  pageWidth,
  tileWidth,
}: {
  showHero: boolean;
  pageWidth: number;
  tileWidth: number;
}) {
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 720,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.6,
          duration: 720,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityLabel="جاري تحميل المنتجات"
      style={[styles.skeletonBody, { opacity: pulse }]}
    >
      {showHero ? (
        <View
          style={[
            styles.skeletonHero,
            { width: pageWidth, height: Math.round(pageWidth * 0.52) },
          ]}
        />
      ) : null}
      {[0, 1].map(row => (
        <View key={row} style={styles.skeletonRow}>
          {[0, 1].map(column => (
            <View key={`${row}-${column}`} style={{ width: tileWidth }}>
              <View style={[styles.skeletonImage, { width: tileWidth, height: tileWidth }]} />
              <View style={styles.skeletonTitleLine} />
              <View style={styles.skeletonShortLine} />
              <View style={styles.skeletonPriceLine} />
            </View>
          ))}
        </View>
      ))}
    </Animated.View>
  );
}

export default function SupermarketCampaignScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; storeId?: string; view?: string }>();
  const cardId = readParam(params.id);
  const storeId = readParam(params.storeId);
  const isBrandView = readParam(params.view) === 'brand';
  const { width: screenWidth } = useWindowDimensions();
  const pageWidth = Math.min(560, screenWidth);
  const tileWidth = (pageWidth - HORIZONTAL_PADDING * 2 - COLUMN_GAP) / 2;
  const serviceAreaId = useCustomerStore(state => state.locationServiceAreaId);
  const carts = useCartStore(state => state.carts);
  const addItem = useCartStore(state => state.addItem);
  const increaseItem = useCartStore(state => state.increaseStoreItem);
  const decreaseItem = useCartStore(state => state.decreaseStoreItem);
  const setActiveCart = useCartStore(state => state.setActiveCart);
  const [campaign, setCampaign] = useState<SupermarketBrandCampaign | null>(null);
  const [catalog, setCatalog] = useState<StoreCatalog | null>(null);
  const [currency, setCurrency] = useState('EGP');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // Same header behavior as supermarket-category/[slug].tsx.
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Give the content a gentle reveal *after* loading; the route itself
  // uses the native stack animation configured below.
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentOffset = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (!cardId || !storeId) throw new Error('رابط العرض غير صحيح.');
        const [fetchedCampaign, bootstrap] = await Promise.all([
          getSupermarketBrandCampaign(cardId, storeId),
          getAppBootstrap(),
        ]);
        const area = serviceAreaId ?? bootstrap.settings.default_service_area_id ?? undefined;
        const fetchedCatalog = await getStoreCatalog(storeId, area);
        if (!alive) return;
        setCampaign(fetchedCampaign);
        setCatalog(fetchedCatalog);
        setCurrency(bootstrap.settings.currency_code || 'EGP');
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : 'تعذر تحميل العرض.');
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => { alive = false; };
  }, [cardId, storeId, serviceAreaId, retryKey]);

  useEffect(() => {
    setSearchQuery('');
    setIsSearchVisible(false);
  }, [cardId, storeId, isBrandView]);

  const products = useMemo(() => {
    if (!catalog || !campaign) return [] as CatalogProduct[];

    // Flat store catalog: de-duplicate products appearing in multiple sections.
    const byId = new Map<string, CatalogProduct>();
    for (const section of catalog.sections) {
      for (const product of section.products) byId.set(product.id, product);
    }

    const companyName = campaign.card.companyName?.trim();
    if (isBrandView && companyName) {
      const normalizedCompany = normalizeBrandName(companyName);
      const explicitlyLinkedIds = new Set(campaign.productIds);

      return [...byId.values()].filter(product =>
        explicitlyLinkedIds.has(product.id) ||
        normalizeBrandName(product.name).includes(normalizedCompany),
      );
    }

    // Offer view shows only the products configured for this specific media card.
    return campaign.productIds
      .map(id => byId.get(id))
      .filter((product): product is CatalogProduct => Boolean(product));
  }, [campaign, catalog, isBrandView]);

  const filteredProducts = useMemo(() => {
    const query = normalizeBrandName(searchQuery);
    if (!query) return products;

    return products.filter(product =>
      normalizeBrandName([
        product.name,
        product.nameEn,
        product.description,
        product.descriptionEn,
        product.sku,
        product.barcode,
        product.unitLabelAr,
        product.unitLabelEn,
      ].filter(Boolean).join(' ')).includes(query),
    );
  }, [products, searchQuery]);

  useEffect(() => {
    if (loading || error || !catalog || !campaign) {
      contentOpacity.setValue(0);
      contentOffset.setValue(12);
      return;
    }

    const animation = Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentOffset, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [loading, error, catalog, campaign, contentOpacity, contentOffset]);

  const items = carts[storeId]?.items ?? [];
  const count = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const closed = !catalog || catalog.store.isManuallyClosed || !storeIsOpen(catalog.businessHours);

  const quantityFor = (productId: string) => items.find(item => item.id === productId)?.quantity ?? 0;
  const add = (product: CatalogProduct) => {
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
  const increase = (product: CatalogProduct) => {
    if (closed) return;
    if (quantityFor(product.id) === 0) add(product);
    else increaseItem(storeId, product.id);
  };
  const decrease = (productId: string) => {
    if (quantityFor(productId) > 0) decreaseItem(storeId, productId);
  };
  const openCart = () => {
    setActiveCart(storeId);
    router.push({ pathname: '/cart', params: { storeId } });
  };

  const companyName = campaign?.card.companyName?.trim() || '';
  // Show only the brand or campaign title supplied by the database.
  const title = companyName || campaign?.card.title?.trim() || '';
  const imageUrl = campaign?.card.imageUrl;
  const canOpenBrand = Boolean(companyName) && !isBrandView;

  const openBrand = () => {
    if (!canOpenBrand) return;
    router.push({
      pathname: '/supermarket-campaign/[id]',
      params: { id: cardId, storeId, view: 'brand' },
    });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Native push/pop motion; doesn't require changing the app layout. */}
      <Stack.Screen
        options={{
          headerShown: false,
          animation: 'fade_from_bottom',
          animationDuration: 330,
          gestureEnabled: true,
        }}
      />
      <StatusBar style="dark" />
      <View style={[styles.shell, { width: pageWidth }]}>
        {/* Same compact header as supermarket-category/[slug].tsx. */}
        <View style={styles.header}>
          {isSearchVisible ? (
            <View style={styles.searchInputContainer}>
              <Ionicons name="search-outline" size={17} color="#222222" />
              <TextInput
                autoFocus
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={isBrandView ? 'ابحث في منتجات الشركة' : 'ابحث في العرض'}
                placeholderTextColor="#999999"
                style={styles.searchInput}
                textAlign="right"
              />
              <Pressable
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="إغلاق البحث"
                onPress={() => {
                  setSearchQuery('');
                  setIsSearchVisible(false);
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

              <Pressable
                onPress={openBrand}
                disabled={!canOpenBrand}
                accessibilityRole="button"
                accessibilityLabel={canOpenBrand ? `عرض جميع منتجات ${companyName}` : (title || 'تفاصيل العرض')}
                style={styles.headerTitleGroup}
              >
                {title ? (
                  <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                ) : loading ? (
                  <View style={styles.headerTitlePlaceholder} />
                ) : null}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="بحث في المنتجات"
                style={({ pressed }) => [styles.headerCircleButton, pressed && styles.pressed]}
                onPress={() => setIsSearchVisible(true)}
              >
                <Ionicons name="search-outline" size={19} color="#202020" />
              </Pressable>
            </>
          )}
        </View>

        {loading ? (
          <CampaignLoadingSkeleton
            showHero={!isBrandView}
            pageWidth={pageWidth}
            tileWidth={tileWidth}
          />
        ) : error || !catalog || !campaign ? (
          <View style={styles.state}>
            <Ionicons name="alert-circle-outline" color="#666" size={42} />
            <Text style={styles.stateMessage}>تعذر فتح العرض حاليًا</Text>
            <Pressable onPress={() => setRetryKey(key => key + 1)} style={styles.retryButton}><Text style={styles.retryText}>إعادة المحاولة</Text></Pressable>
          </View>
        ) : (
          <>
            <Animated.View
              style={[
                styles.contentEntrance,
                { opacity: contentOpacity, transform: [{ translateY: contentOffset }] },
              ]}
            >
              <FlatList
                data={filteredProducts}
                keyExtractor={product => product.id}
                numColumns={2}
                columnWrapperStyle={styles.productRow}
                contentContainerStyle={[
                  styles.productListContent,
                  isBrandView && styles.brandListContent,
                  count > 0 && styles.contentWithCart,
                ]}
                showsVerticalScrollIndicator={false}
                initialNumToRender={8}
                maxToRenderPerBatch={10}
                windowSize={5}
                ListHeaderComponent={isBrandView ? null : (
                  <View style={[styles.hero, styles.heroInList, { width: pageWidth, height: Math.round(pageWidth * 0.52) }]}>
                    {imageUrl ? <Image source={{ uri: imageUrl }} resizeMode="cover" style={styles.heroImage} /> : <View style={styles.heroBackground} />}
                    {campaign.card.mediaType === 'video' && campaign.card.videoUrl ? (
                      <CampaignVideo uri={campaign.card.videoUrl} />
                    ) : null}
                  </View>
                )}
                renderItem={({ item: product }) => (
                  <ProductTile
                    product={product}
                    width={tileWidth}
                    quantity={quantityFor(product.id)}
                    currency={currency}
                    closed={closed}
                    onAdd={() => add(product)}
                    onIncrease={() => increase(product)}
                    onDecrease={() => decrease(product.id)}
                  />
                )}
                ListEmptyComponent={(
                  <View style={styles.empty}>
                    <Ionicons name="cube-outline" size={36} color="#AAA" />
                    <Text style={styles.emptyText}>
                      {searchQuery.trim()
                        ? 'لم نجد منتجًا مطابقًا لبحثك'
                        : isBrandView
                          ? 'مفيش منتجات متاحة للشركة حاليًا'
                          : 'مفيش منتجات متاحة في العرض دلوقتي'}
                    </Text>
                  </View>
                )}
                ListFooterComponent={closed ? (
                  <Text style={styles.closedNotice}>الماركت مغلق حاليًا، تقدر تتصفح المنتجات لحد ما يفتح.</Text>
                ) : null}
              />
            </Animated.View>
            <CategoryCartDock
              itemCount={count}
              subtotal={subtotal}
              minimumOrder={catalog.delivery.minimumOrder}
              currencyCode={currency}
              accentColor={GREEN}
              accentDarkColor={GREEN_DARK}
              isScrollingDown={false}
              onPress={openCart}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  shell: { flex: 1, alignSelf: 'center', maxWidth: 560, backgroundColor: '#FFFFFF' },
  contentEntrance: { flex: 1 },
  skeletonBody: {
    flex: 1,
    paddingTop: 0,
    overflow: 'hidden',
  },
  skeletonHero: {
    backgroundColor: '#EDF1EE',
    marginBottom: 16,
  },
  skeletonRow: {
    flexDirection: 'row-reverse',
    gap: COLUMN_GAP,
    paddingHorizontal: HORIZONTAL_PADDING,
    marginBottom: 20,
  },
  skeletonImage: {
    backgroundColor: '#EEF1EF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECE9',
  },
  skeletonTitleLine: {
    backgroundColor: '#EEF1EF',
    height: 12,
    borderRadius: 6,
    marginTop: 11,
    width: '90%',
    alignSelf: 'flex-end',
  },
  skeletonShortLine: {
    backgroundColor: '#EEF1EF',
    height: 12,
    borderRadius: 6,
    marginTop: 6,
    width: '60%',
    alignSelf: 'flex-end',
  },
  skeletonPriceLine: {
    backgroundColor: '#EEF1EF',
    height: 15,
    borderRadius: 6,
    marginTop: 10,
    width: '45%',
    alignSelf: 'flex-end',
  },

  // Exact header dimensions, spacing and typography from supermarket-category/[slug].tsx.
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
  headerTitlePlaceholder: {
    width: 96,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EEF1EF',
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

  productListContent: { paddingHorizontal: HORIZONTAL_PADDING, paddingBottom: 36 },
  brandListContent: { paddingTop: 16 },
  productRow: { flexDirection: 'row-reverse', columnGap: COLUMN_GAP, justifyContent: 'flex-start' },
  contentWithCart: { paddingBottom: 145 },
  hero: { width: '100%', overflow: 'hidden', backgroundColor: '#F3F3F3' },
  heroInList: { marginHorizontal: -HORIZONTAL_PADDING, marginBottom: 16 },
  heroBackground: { width: '100%', height: '100%', backgroundColor: '#DFF4E6' },
  heroImage: { width: '100%', height: '100%' },
  heroVideo: { ...StyleSheet.absoluteFill },

  productTile: {
    backgroundColor: '#FFFFFF',
    marginBottom: 13,
  },
  productImageFrame: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DEDEDE',
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  imageFallback: {
    height: '100%',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageFallbackIcon: { fontSize: 44 },
  // Image swiping remains available for products with multiple images.
  imageDots: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 12,
    left: 10,
    backgroundColor: 'rgba(60,60,60,0.35)',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 50,
  },
  imageDot: { width: 5, height: 5, borderRadius: 5, backgroundColor: '#C2C2C2' },
  imageDotSelected: { width: 12, backgroundColor: '#FFFFFF' },
  discountBadge: {
    alignItems: 'center',
    backgroundColor: '#C7FF00',
    borderRadius: 4,
    justifyContent: 'center',
    minHeight: 22,
    paddingHorizontal: 7,
    paddingVertical: 3,
    position: 'absolute',
    top: 7,
    right: 8,
    zIndex: 5,
  },
  discountText: {
    color: '#181818',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E1E1',
    borderRadius: 20,
    borderWidth: 1,
    bottom: 8,
    elevation: 3,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    width: 40,
    zIndex: 7,
  },
  addButtonPressed: {
    backgroundColor: '#F7F7F7',
    transform: [{ scale: 0.95 }],
  },
  addButtonText: {
    color: GREEN,
    fontSize: 29,
    fontWeight: '300',
    lineHeight: 31,
    marginTop: -3,
  },
  disabledButton: { opacity: 0.45 },
  quantityPill: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E1E1',
    borderRadius: 20,
    borderWidth: 1,
    bottom: 8,
    elevation: 3,
    flexDirection: 'row',
    height: 40,
    position: 'absolute',
    right: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    zIndex: 7,
  },
  quantityAction: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 28,
  },
  quantityActionText: {
    color: GREEN,
    fontSize: 19,
    fontWeight: '500',
  },
  quantityText: {
    color: '#202020',
    fontSize: 12,
    fontWeight: '700',
    minWidth: 16,
    textAlign: 'center',
  },
  productName: {
    color: '#202020',
    fontSize: 13.5,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 8,
    minHeight: 36,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  productUnit: {
    color: '#969696',
    fontSize: 11.5,
    marginTop: 2,
    minHeight: 15,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  productPrices: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 5,
    justifyContent: 'flex-start',
    marginTop: 6,
    minHeight: 20,
  },
  currentPriceUnderline: {
    borderBottomColor: '#C7FF00',
    borderBottomWidth: 2,
    paddingBottom: 0,
  },
  productPrice: {
    color: '#181818',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    writingDirection: 'rtl',
  },
  oldPrice: {
    color: '#8D8D8D',
    fontSize: 11.5,
    fontWeight: '400',
    lineHeight: 18,
    textDecorationLine: 'line-through',
    writingDirection: 'rtl',
  },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 30 },
  stateMessage: { fontSize: 17, fontWeight: '700', color: '#222', textAlign: 'center' },
  retryButton: { backgroundColor: GREEN, paddingVertical: 13, paddingHorizontal: 26, borderRadius: 16 },
  retryText: { fontWeight: '800', color: '#FFF' },
  empty: { alignItems: 'center', gap: 12, paddingTop: 50 },
  emptyText: { color: '#777', fontSize: 14 },
  closedNotice: { marginHorizontal: 16, color: '#B64B42', textAlign: 'center' },
});

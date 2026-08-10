import { useRouter } from 'expo-router';
import {
    useMemo,
    useState,
} from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import {
    CatalogCartBar,
    CatalogStateScreen,
    formatCurrency,
    ProductArtwork,
    QuantityControl,
    ReplaceCartModal,
} from '../../components/category/catalog-shared';
import useCatalogCart from '../../hooks/use-catalog-cart';
import { useCategoryStoreCatalog } from '../../hooks/use-category-store-catalog';
import type {
    CatalogProduct,
    CatalogSection,
} from '../../services/catalog-service';
import {
    NAVIENTY_NOW_LAYOUT,
} from '../../theme/navienty-now-theme';

const BOOKSTORE_SLUGS = [
  'bookstore',
  'library',
  'books',
  'stationery',
] as const;

const BOOKSTORE_ACCENT = '#263B75';
const BOOKSTORE_DARK = '#15254F';
const BOOKSTORE_YELLOW = '#F4C95D';
const BOOKSTORE_PALE = '#F3F5FB';

type VisibleSection = {
  id: string;
  name: string;
  products: CatalogProduct[];
};

export default function BookstoreScreen() {
  const router = useRouter();

  const {
    catalog,
    stores,
    activeStoreId,
    currencySymbol,
    isLoading,
    errorMessage,
    reload,
    selectStore,
  } = useCategoryStoreCatalog(
    BOOKSTORE_SLUGS,
  );

  const {
    cartItemCount,
    cartSubtotal,
    cartStoreName,
    pendingProduct,
    storeIsClosed,
    getProductQuantity,
    increaseProduct,
    decreaseProduct,
    replaceCartAndAddProduct,
    dismissPendingProduct,
  } = useCatalogCart(catalog);

  const [searchText, setSearchText] =
    useState('');
  const [activeSectionId, setActiveSectionId] =
    useState('all');

  const visibleSections = useMemo<
    VisibleSection[]
  >(() => {
    if (!catalog) {
      return [];
    }

    const normalizedSearch = searchText
      .trim()
      .toLocaleLowerCase('ar');

    return catalog.sections
      .filter(
        (section) =>
          activeSectionId === 'all' ||
          section.id === activeSectionId,
      )
      .map((section) => ({
        id: section.id,
        name: section.name,
        products: section.products.filter(
          (product) => {
            if (!normalizedSearch) {
              return true;
            }

            return [
              product.name,
              product.nameEn ?? '',
              product.description,
              product.sku ?? '',
              product.barcode ?? '',
            ]
              .join(' ')
              .toLocaleLowerCase('ar')
              .includes(normalizedSearch);
          },
        ),
      }))
      .filter(
        (section) => section.products.length > 0,
      );
  }, [activeSectionId, catalog, searchText]);

  const visibleProductCount =
    visibleSections.reduce(
      (total, section) =>
        total + section.products.length,
      0,
    );

  if (isLoading) {
    return (
      <CatalogStateScreen
        isLoading
        accentColor={BOOKSTORE_ACCENT}
        description="يتم تحميل المكتبة والمنتجات المتاحة."
        title="جاري فتح المكتبة"
      />
    );
  }

  if (!catalog || errorMessage) {
    return (
      <CatalogStateScreen
        accentColor={BOOKSTORE_ACCENT}
        description={
          errorMessage ??
          'لم نتمكن من تحميل بيانات المكتبة.'
        }
        icon="📚"
        title="المكتبة غير متاحة"
        onBack={() => router.replace('/')}
        onRetry={() => {
          void reload();
        }}
      />
    );
  }

  const currentStore = catalog.store;
  const delivery = catalog.delivery;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.pageContent,
          cartItemCount > 0 &&
            styles.pageContentWithCart,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <View style={styles.hero}>
            <View style={styles.heroDecorationOne} />
            <View style={styles.heroDecorationTwo} />

            <View style={styles.heroTopRow}>
              <Pressable
                accessibilityLabel="العودة"
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.backButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => router.back()}
              >
                <Text style={styles.backIcon}>›</Text>
              </Pressable>

              <View style={styles.heroCopy}>
                <Text style={styles.heroEyebrow}>
                  مكتبة Navienty Now
                </Text>
                <Text style={styles.heroTitle}>
                  {currentStore.name}
                </Text>
                <Text style={styles.heroDescription}>
                  {currentStore.shortDescription ||
                    'كتب، أدوات مكتبية ومستلزمات الدراسة في طلب واحد.'}
                </Text>
              </View>

              <View style={styles.heroIconBox}>
                <Text style={styles.heroIcon}>
                  {currentStore.icon || '📚'}
                </Text>
              </View>
            </View>

            <View style={styles.heroMetaRow}>
              <View style={styles.heroMetaItem}>
                <Text style={styles.heroMetaValue}>
                  ⭐ {currentStore.rating.toFixed(1)}
                </Text>
                <Text style={styles.heroMetaLabel}>
                  التقييم
                </Text>
              </View>
              <View style={styles.heroMetaDivider} />
              <View style={styles.heroMetaItem}>
                <Text style={styles.heroMetaValue}>
                  {delivery.deliveryTime ||
                    `${delivery.estimatedDeliveryMinutes ?? '-'} دقيقة`}
                </Text>
                <Text style={styles.heroMetaLabel}>
                  التوصيل
                </Text>
              </View>
              <View style={styles.heroMetaDivider} />
              <View style={styles.heroMetaItem}>
                <Text style={styles.heroMetaValue}>
                  {formatCurrency(
                    delivery.deliveryFee,
                    currencySymbol,
                  )}
                </Text>
                <Text style={styles.heroMetaLabel}>
                  الرسوم
                </Text>
              </View>
            </View>

            {storeIsClosed && (
              <View style={styles.closedNotice}>
                <Text style={styles.closedNoticeText}>
                  {currentStore.manualClosedNote ||
                    'المكتبة مغلقة مؤقتًا.'}
                </Text>
              </View>
            )}
          </View>

          {stores.length > 1 && (
            <View style={styles.storeSwitcherSection}>
              <Text style={styles.storeSwitcherTitle}>
                المكتبات المتاحة
              </Text>
              <ScrollView
                horizontal
                contentContainerStyle={
                  styles.storeSwitcherContent
                }
                showsHorizontalScrollIndicator={false}
              >
                {stores.map((store) => {
                  const isActive =
                    store.id === activeStoreId;

                  return (
                    <Pressable
                      key={store.id}
                      style={({ pressed }) => [
                        styles.storeSwitcherItem,
                        isActive &&
                          styles.storeSwitcherItemActive,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => {
                        void selectStore(store.id);
                      }}
                    >
                      <Text
                        style={styles.storeSwitcherIcon}
                      >
                        {store.icon || '📚'}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.storeSwitcherText,
                          isActive &&
                            styles.storeSwitcherTextActive,
                        ]}
                      >
                        {store.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <View style={styles.searchBox}>
            <View style={styles.searchBadge}>
              <Text style={styles.searchBadgeText}>
                بحث
              </Text>
            </View>
            <TextInput
              autoCorrect={false}
              placeholder="ابحث عن كتاب أو أداة مكتبية"
              placeholderTextColor="#888A93"
              returnKeyType="search"
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
            />
            <Text style={styles.searchIcon}>⌕</Text>
          </View>

          <View style={styles.featureStrip}>
            <FeatureCard
              icon="✏️"
              title="أدوات الدراسة"
              description="كل الأساسيات في مكان واحد"
            />
            <FeatureCard
              icon="📖"
              title="كتب ومراجع"
              description="تصفح المتاح حسب الأقسام"
            />
          </View>

          <View style={styles.sectionHeading}>
            <Text style={styles.productCountBadge}>
              {visibleProductCount} منتج
            </Text>
            <View style={styles.sectionHeadingCopy}>
              <Text style={styles.sectionHeadingTitle}>
                تصفح المكتبة
              </Text>
              <Text
                style={styles.sectionHeadingDescription}
              >
                اختر قسمًا أو استخدم البحث
              </Text>
            </View>
          </View>

          <SectionChips
            activeSectionId={activeSectionId}
            sections={catalog.sections}
            onSelect={setActiveSectionId}
          />

          {visibleSections.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🔎</Text>
              <Text style={styles.emptyTitle}>
                لا توجد نتائج
              </Text>
              <Text style={styles.emptyDescription}>
                جرّب اسمًا مختلفًا أو اختر قسمًا آخر.
              </Text>
            </View>
          ) : (
            <View style={styles.sectionsList}>
              {visibleSections.map((section) => (
                <View
                  key={section.id}
                  style={styles.productsSection}
                >
                  <View style={styles.productsSectionHeader}>
                    <Text style={styles.productsSectionCount}>
                      {section.products.length} منتج
                    </Text>
                    <Text style={styles.productsSectionTitle}>
                      {section.name}
                    </Text>
                  </View>

                  <View style={styles.productsGrid}>
                    {section.products.map((product) => (
                      <BookProductCard
                        key={product.id}
                        currencySymbol={currencySymbol}
                        disabled={storeIsClosed}
                        product={product}
                        quantity={getProductQuantity(
                          product.id,
                        )}
                        onDecrease={() =>
                          decreaseProduct(product.id)
                        }
                        onIncrease={() =>
                          increaseProduct(product)
                        }
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <CatalogCartBar
        accentColor={BOOKSTORE_ACCENT}
        currencySymbol={currencySymbol}
        itemCount={cartItemCount}
        storeName={cartStoreName}
        subtotal={cartSubtotal}
        onPress={() => router.push('/cart')}
      />

      <ReplaceCartModal
        accentColor={BOOKSTORE_ACCENT}
        currentCartStoreName={cartStoreName}
        product={pendingProduct}
        onCancel={dismissPendingProduct}
        onOpenCart={() => {
          dismissPendingProduct();
          router.push('/cart');
        }}
        onReplace={replaceCartAndAddProduct}
      />
    </View>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureIconBox}>
        <Text style={styles.featureIcon}>{icon}</Text>
      </View>
      <View style={styles.featureCopy}>
        <Text style={styles.featureTitle}>
          {title}
        </Text>
        <Text style={styles.featureDescription}>
          {description}
        </Text>
      </View>
    </View>
  );
}

function SectionChips({
  sections,
  activeSectionId,
  onSelect,
}: {
  sections: CatalogSection[];
  activeSectionId: string;
  onSelect: (sectionId: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      contentContainerStyle={styles.sectionChipsContent}
      showsHorizontalScrollIndicator={false}
      style={styles.sectionChips}
    >
      <SectionChip
        active={activeSectionId === 'all'}
        label="الكل"
        onPress={() => onSelect('all')}
      />

      {sections.map((section) => (
        <SectionChip
          key={section.id}
          active={activeSectionId === section.id}
          label={section.name}
          onPress={() => onSelect(section.id)}
        />
      ))}
    </ScrollView>
  );
}

function SectionChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.sectionChip,
        active && styles.sectionChipActive,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.sectionChipText,
          active && styles.sectionChipTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function BookProductCard({
  product,
  currencySymbol,
  quantity,
  disabled,
  onIncrease,
  onDecrease,
}: {
  product: CatalogProduct;
  currencySymbol: string;
  quantity: number;
  disabled: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  return (
    <View style={styles.productCard}>
      <View style={styles.productArtworkWrap}>
        <ProductArtwork
          backgroundColor={BOOKSTORE_PALE}
          product={product}
          size={112}
        />
      </View>

      <Text
        numberOfLines={2}
        style={styles.productName}
      >
        {product.name}
      </Text>
      <Text
        numberOfLines={2}
        style={styles.productDescription}
      >
        {product.description ||
          product.unitLabelAr ||
          'منتج متاح من المكتبة.'}
      </Text>

      <View style={styles.productPriceRow}>
        <View style={styles.productPriceBox}>
          <Text style={styles.productPrice}>
            {formatCurrency(
              product.price,
              currencySymbol,
            )}
          </Text>
          {product.compareAtPrice !== null &&
            product.compareAtPrice > product.price && (
              <Text style={styles.comparePrice}>
                {formatCurrency(
                  product.compareAtPrice,
                  currencySymbol,
                )}
              </Text>
            )}
        </View>
      </View>

      <View style={styles.quantityWrap}>
        <QuantityControl
          accentColor={BOOKSTORE_ACCENT}
          disabled={disabled}
          quantity={quantity}
          onDecrease={onDecrease}
          onIncrease={onIncrease}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#FBFAF7',
    flex: 1,
  },
  pageContent: {
    flexGrow: 1,
    paddingBottom: 42,
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
    paddingTop: 42,
  },
  pageContentWithCart: {
    paddingBottom: 116,
  },
  container: {
    alignSelf: 'center',
    maxWidth: NAVIENTY_NOW_LAYOUT.contentMaxWidth,
    width: '100%',
  },
  hero: {
    backgroundColor: BOOKSTORE_DARK,
    borderRadius: 30,
    overflow: 'hidden',
    padding: 20,
    position: 'relative',
  },
  heroDecorationOne: {
    backgroundColor: 'rgba(244,201,93,0.12)',
    borderRadius: 100,
    height: 150,
    position: 'absolute',
    right: -45,
    top: -55,
    width: 150,
  },
  heroDecorationTwo: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 80,
    bottom: -75,
    height: 160,
    left: -50,
    position: 'absolute',
    width: 160,
  },
  heroTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 13,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  backIcon: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 34,
  },
  heroCopy: {
    alignItems: 'flex-end',
    flex: 1,
  },
  heroEyebrow: {
    color: BOOKSTORE_YELLOW,
    fontSize: 11,
    fontWeight: '900',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 7,
    textAlign: 'right',
  },
  heroDescription: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    lineHeight: 20,
    marginTop: 7,
    textAlign: 'right',
  },
  heroIconBox: {
    alignItems: 'center',
    backgroundColor: BOOKSTORE_YELLOW,
    borderRadius: 20,
    height: 66,
    justifyContent: 'center',
    transform: [{ rotate: '4deg' }],
    width: 66,
  },
  heroIcon: {
    fontSize: 34,
  },
  heroMetaRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: 17,
    flexDirection: 'row',
    marginTop: 20,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  heroMetaItem: {
    alignItems: 'center',
    flex: 1,
  },
  heroMetaValue: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  heroMetaLabel: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 9,
    marginTop: 4,
  },
  heroMetaDivider: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    height: 28,
    width: 1,
  },
  closedNotice: {
    backgroundColor: 'rgba(255,225,225,0.13)',
    borderRadius: 13,
    marginTop: 12,
    padding: 11,
  },
  closedNoticeText: {
    color: '#FFD7D7',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
  },
  storeSwitcherSection: {
    marginTop: 22,
  },
  storeSwitcherTitle: {
    color: '#242A3A',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  storeSwitcherContent: {
    gap: 9,
    paddingTop: 11,
  },
  storeSwitcherItem: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E2E8',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    maxWidth: 210,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  storeSwitcherItemActive: {
    backgroundColor: '#EEF1FA',
    borderColor: BOOKSTORE_ACCENT,
  },
  storeSwitcherIcon: {
    fontSize: 20,
  },
  storeSwitcherText: {
    color: '#646773',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
  },
  storeSwitcherTextActive: {
    color: BOOKSTORE_DARK,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E2E7',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 20,
    minHeight: 55,
    paddingHorizontal: 13,
  },
  searchBadge: {
    backgroundColor: '#EEF1FA',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  searchBadgeText: {
    color: BOOKSTORE_ACCENT,
    fontSize: 9,
    fontWeight: '900',
  },
  searchInput: {
    color: '#202330',
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 14,
    textAlign: 'right',
  },
  searchIcon: {
    color: BOOKSTORE_ACCENT,
    fontSize: 24,
  },
  featureStrip: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  featureCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E4E1',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row-reverse',
    gap: 9,
    padding: 11,
  },
  featureIconBox: {
    alignItems: 'center',
    backgroundColor: '#FFF6DC',
    borderRadius: 13,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  featureIcon: {
    fontSize: 21,
  },
  featureCopy: {
    alignItems: 'flex-end',
    flex: 1,
  },
  featureTitle: {
    color: '#2A2D38',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'right',
  },
  featureDescription: {
    color: '#8A8B92',
    fontSize: 8,
    lineHeight: 13,
    marginTop: 3,
    textAlign: 'right',
  },
  sectionHeading: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 28,
  },
  productCountBadge: {
    backgroundColor: '#FFF2CF',
    borderRadius: 999,
    color: '#7B5B12',
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  sectionHeadingCopy: {
    alignItems: 'flex-end',
  },
  sectionHeadingTitle: {
    color: '#202330',
    fontSize: 20,
    fontWeight: '900',
  },
  sectionHeadingDescription: {
    color: '#878992',
    fontSize: 11,
    marginTop: 4,
  },
  sectionChips: {
    marginHorizontal: -20,
    marginTop: 14,
  },
  sectionChipsContent: {
    gap: 8,
    paddingHorizontal: 20,
  },
  sectionChip: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E0E1E6',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  sectionChipActive: {
    backgroundColor: BOOKSTORE_ACCENT,
    borderColor: BOOKSTORE_ACCENT,
  },
  sectionChipText: {
    color: '#666974',
    fontSize: 11,
    fontWeight: '800',
  },
  sectionChipTextActive: {
    color: '#FFFFFF',
  },
  sectionsList: {
    gap: 26,
    marginTop: 24,
  },
  productsSection: {
    gap: 13,
  },
  productsSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  productsSectionTitle: {
    color: '#242733',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'right',
  },
  productsSectionCount: {
    color: '#8B8D95',
    fontSize: 10,
    fontWeight: '800',
  },
  productsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E2E6',
    borderRadius: 21,
    borderWidth: 1,
    minWidth: 146,
    padding: 11,
    width: '48.4%',
  },
  productArtworkWrap: {
    alignItems: 'center',
  },
  productName: {
    color: '#242733',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 10,
    minHeight: 34,
    textAlign: 'right',
  },
  productDescription: {
    color: '#858790',
    fontSize: 9,
    lineHeight: 14,
    marginTop: 4,
    minHeight: 29,
    textAlign: 'right',
  },
  productPriceRow: {
    alignItems: 'flex-end',
    marginTop: 9,
  },
  productPriceBox: {
    alignItems: 'flex-end',
  },
  productPrice: {
    color: BOOKSTORE_DARK,
    fontSize: 12,
    fontWeight: '900',
  },
  comparePrice: {
    color: '#A2A3A9',
    fontSize: 8,
    marginTop: 2,
    textDecorationLine: 'line-through',
  },
  quantityWrap: {
    alignItems: 'flex-start',
    marginTop: 11,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E2E6',
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 24,
    padding: 28,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    color: '#242733',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 11,
  },
  emptyDescription: {
    color: '#858790',
    fontSize: 11,
    lineHeight: 18,
    marginTop: 6,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.985 }],
  },
});

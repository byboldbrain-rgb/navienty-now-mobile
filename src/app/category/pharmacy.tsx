import { useRouter } from 'expo-router';
import {
    useMemo,
    useState,
} from 'react';
import {
    Alert,
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

const PHARMACY_ACCENT = '#186B63';
const PHARMACY_ACCENT_DARK = '#0D4D47';
const PHARMACY_PALE = '#EAF7F5';

type VisibleSection = {
  id: string;
  name: string;
  products: CatalogProduct[];
};

export default function PharmacyScreen() {
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
  } = useCategoryStoreCatalog('pharmacy');

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
              product.barcode ?? '',
              product.sku ?? '',
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
        accentColor={PHARMACY_ACCENT}
        description="يتم تحميل الصيدلية والمنتجات المتاحة."
        title="جاري فتح الصيدلية"
      />
    );
  }

  if (!catalog || errorMessage) {
    return (
      <CatalogStateScreen
        accentColor={PHARMACY_ACCENT}
        description={
          errorMessage ??
          'لم نتمكن من تحميل بيانات الصيدلية.'
        }
        icon="💊"
        title="الصيدلية غير متاحة"
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
                  الصيدلية
                </Text>
                <Text style={styles.heroTitle}>
                  {currentStore.name}
                </Text>
                <Text style={styles.heroDescription}>
                  {currentStore.shortDescription ||
                    'منتجات الصيدلية والعناية الشخصية في مكان واحد.'}
                </Text>
              </View>

              <View style={styles.heroIconBox}>
                <Text style={styles.heroIcon}>
                  {currentStore.icon || '💊'}
                </Text>
              </View>
            </View>

            <View style={styles.deliveryCardsRow}>
              <View style={styles.deliveryInfoCard}>
                <Text style={styles.deliveryInfoValue}>
                  {delivery.deliveryTime ||
                    `${delivery.estimatedDeliveryMinutes ?? '-'} دقيقة`}
                </Text>
                <Text style={styles.deliveryInfoLabel}>
                  وقت التوصيل
                </Text>
              </View>

              <View style={styles.deliveryInfoCard}>
                <Text style={styles.deliveryInfoValue}>
                  {formatCurrency(
                    delivery.deliveryFee,
                    currencySymbol,
                  )}
                </Text>
                <Text style={styles.deliveryInfoLabel}>
                  رسوم التوصيل
                </Text>
              </View>

              <View style={styles.deliveryInfoCard}>
                <Text style={styles.deliveryInfoValue}>
                  ⭐ {currentStore.rating.toFixed(1)}
                </Text>
                <Text style={styles.deliveryInfoLabel}>
                  التقييم
                </Text>
              </View>
            </View>

            {storeIsClosed && (
              <View style={styles.closedNotice}>
                <Text style={styles.closedNoticeText}>
                  {currentStore.manualClosedNote ||
                    'الصيدلية مغلقة مؤقتًا.'}
                </Text>
              </View>
            )}
          </View>

          {stores.length > 1 && (
            <View style={styles.storeSwitcherSection}>
              <Text style={styles.smallSectionTitle}>
                اختر الصيدلية
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
                        {store.icon || '💊'}
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
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              autoCorrect={false}
              placeholder="ابحث باسم المنتج أو الدواء"
              placeholderTextColor="#8A8A91"
              returnKeyType="search"
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>

          <Pressable
            accessibilityLabel="معلومات رفع الروشتة"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.prescriptionCard,
              pressed && styles.pressed,
            ]}
            onPress={() => {
              Alert.alert(
                'رفع الروشتة',
                'سيتم ربط رفع الروشتة ومراجعتها في خطوة مستقلة. المنتجات التي تحتاج وصفة يجب مراجعتها قبل تأكيد الطلب.',
              );
            }}
          >
            <View style={styles.prescriptionAction}>
              <Text style={styles.prescriptionArrow}>
                ‹
              </Text>
            </View>

            <View style={styles.prescriptionCopy}>
              <Text style={styles.prescriptionTitle}>
                لديك روشتة؟
              </Text>
              <Text
                style={styles.prescriptionDescription}
              >
                اضغط لمعرفة مسار مراجعة الروشتة قبل تنفيذ الطلب.
              </Text>
            </View>

            <View style={styles.prescriptionIconBox}>
              <Text style={styles.prescriptionIcon}>
                🧾
              </Text>
            </View>
          </Pressable>

          <View style={styles.safetyRow}>
            <View style={styles.safetyCard}>
              <Text style={styles.safetyIcon}>🔒</Text>
              <Text style={styles.safetyText}>
                بيانات الطلب محمية
              </Text>
            </View>
            <View style={styles.safetyCard}>
              <Text style={styles.safetyIcon}>📋</Text>
              <Text style={styles.safetyText}>
                مراجعة المنتجات المقيدة
              </Text>
            </View>
          </View>

          <View style={styles.sectionHeading}>
            <Text style={styles.productCountBadge}>
              {visibleProductCount} منتج
            </Text>
            <View style={styles.sectionHeadingCopy}>
              <Text style={styles.sectionHeadingTitle}>
                أقسام الصيدلية
              </Text>
              <Text
                style={styles.sectionHeadingDescription}
              >
                اختر القسم أو ابحث عن المنتج مباشرة
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
                لا توجد منتجات مطابقة
              </Text>
              <Text style={styles.emptyDescription}>
                جرّب البحث باسم مختلف أو اختر قسمًا آخر.
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
                      {section.products.length}
                    </Text>
                    <Text style={styles.productsSectionTitle}>
                      {section.name}
                    </Text>
                  </View>

                  <View style={styles.productsList}>
                    {section.products.map((product) => (
                      <PharmacyProductCard
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
        accentColor={PHARMACY_ACCENT}
        currencySymbol={currencySymbol}
        itemCount={cartItemCount}
        storeName={cartStoreName}
        subtotal={cartSubtotal}
        onPress={() => router.push('/cart')}
      />

      <ReplaceCartModal
        accentColor={PHARMACY_ACCENT}
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

function PharmacyProductCard({
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
      <ProductArtwork
        backgroundColor={PHARMACY_PALE}
        product={product}
        size={92}
      />

      <View style={styles.productContent}>
        <View style={styles.productBadgesRow}>
          {product.requiresPrescription && (
            <Text style={styles.prescriptionBadge}>
              يحتاج وصفة
            </Text>
          )}
          {product.isAgeRestricted && (
            <Text style={styles.ageBadge}>
              تحقق من العمر
            </Text>
          )}
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
            'منتج متاح من الصيدلية.'}
        </Text>

        <View style={styles.productBottomRow}>
          <QuantityControl
            accentColor={PHARMACY_ACCENT}
            disabled={disabled}
            quantity={quantity}
            onDecrease={onDecrease}
            onIncrease={onIncrease}
          />

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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#F7FBFA',
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
    backgroundColor: PHARMACY_ACCENT_DARK,
    borderRadius: 30,
    padding: 20,
  },
  heroTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 13,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
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
    color: '#9CE5DA',
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
    color: 'rgba(255,255,255,0.76)',
    fontSize: 12,
    lineHeight: 20,
    marginTop: 7,
    textAlign: 'right',
  },
  heroIconBox: {
    alignItems: 'center',
    backgroundColor: '#D7FFF7',
    borderRadius: 20,
    height: 66,
    justifyContent: 'center',
    width: 66,
  },
  heroIcon: {
    fontSize: 35,
  },
  deliveryCardsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  deliveryInfoCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 15,
    flex: 1,
    paddingHorizontal: 6,
    paddingVertical: 11,
  },
  deliveryInfoValue: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  deliveryInfoLabel: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 9,
    marginTop: 4,
    textAlign: 'center',
  },
  closedNotice: {
    backgroundColor: 'rgba(255,224,224,0.16)',
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
  smallSectionTitle: {
    color: '#1F2F2D',
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
    borderColor: '#DCE7E5',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    maxWidth: 210,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  storeSwitcherItemActive: {
    backgroundColor: PHARMACY_PALE,
    borderColor: PHARMACY_ACCENT,
  },
  storeSwitcherIcon: {
    fontSize: 20,
  },
  storeSwitcherText: {
    color: '#5D6665',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
  },
  storeSwitcherTextActive: {
    color: PHARMACY_ACCENT_DARK,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE9E7',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 20,
    minHeight: 54,
    paddingHorizontal: 15,
  },
  searchIcon: {
    color: PHARMACY_ACCENT,
    fontSize: 24,
    marginRight: 9,
  },
  searchInput: {
    color: '#1A2524',
    flex: 1,
    fontSize: 14,
    paddingVertical: 14,
    textAlign: 'right',
  },
  prescriptionCard: {
    alignItems: 'center',
    backgroundColor: '#EEEAFE',
    borderRadius: 22,
    flexDirection: 'row',
    marginTop: 16,
    padding: 16,
  },
  prescriptionAction: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  prescriptionArrow: {
    color: '#5F49C6',
    fontSize: 26,
    lineHeight: 28,
  },
  prescriptionCopy: {
    alignItems: 'flex-end',
    flex: 1,
    marginHorizontal: 12,
  },
  prescriptionTitle: {
    color: '#332479',
    fontSize: 16,
    fontWeight: '900',
  },
  prescriptionDescription: {
    color: '#6D61A0',
    fontSize: 11,
    lineHeight: 18,
    marginTop: 5,
    textAlign: 'right',
  },
  prescriptionIconBox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  prescriptionIcon: {
    fontSize: 27,
  },
  safetyRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  safetyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E0EAE8',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row-reverse',
    gap: 7,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 8,
  },
  safetyIcon: {
    fontSize: 17,
  },
  safetyText: {
    color: '#4D5D5B',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
  },
  sectionHeading: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 28,
  },
  productCountBadge: {
    backgroundColor: PHARMACY_PALE,
    borderRadius: 999,
    color: PHARMACY_ACCENT,
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
    color: '#1A2524',
    fontSize: 20,
    fontWeight: '900',
  },
  sectionHeadingDescription: {
    color: '#818A89',
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
    borderColor: '#DFE9E7',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  sectionChipActive: {
    backgroundColor: PHARMACY_ACCENT,
    borderColor: PHARMACY_ACCENT,
  },
  sectionChipText: {
    color: '#66706F',
    fontSize: 11,
    fontWeight: '800',
  },
  sectionChipTextActive: {
    color: '#FFFFFF',
  },
  sectionsList: {
    gap: 25,
    marginTop: 24,
  },
  productsSection: {
    gap: 12,
  },
  productsSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  productsSectionTitle: {
    color: '#202B2A',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'right',
  },
  productsSectionCount: {
    color: '#8A9392',
    fontSize: 11,
    fontWeight: '800',
  },
  productsList: {
    gap: 11,
  },
  productCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1EAE8',
    borderRadius: 21,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 13,
    padding: 12,
  },
  productContent: {
    flex: 1,
  },
  productBadgesRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 5,
  },
  prescriptionBadge: {
    backgroundColor: '#FFF2D9',
    borderRadius: 999,
    color: '#8A5D09',
    fontSize: 8,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  ageBadge: {
    backgroundColor: '#FDE8E8',
    borderRadius: 999,
    color: '#A13B3B',
    fontSize: 8,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  productName: {
    color: '#1C2726',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 5,
    textAlign: 'right',
  },
  productDescription: {
    color: '#7C8584',
    fontSize: 10,
    lineHeight: 16,
    marginTop: 4,
    textAlign: 'right',
  },
  productBottomRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 11,
  },
  productPriceBox: {
    alignItems: 'flex-end',
  },
  productPrice: {
    color: PHARMACY_ACCENT_DARK,
    fontSize: 13,
    fontWeight: '900',
  },
  comparePrice: {
    color: '#A0A0A6',
    fontSize: 9,
    marginTop: 3,
    textDecorationLine: 'line-through',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1EAE8',
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 24,
    padding: 28,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    color: '#222D2C',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 11,
  },
  emptyDescription: {
    color: '#7B8583',
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

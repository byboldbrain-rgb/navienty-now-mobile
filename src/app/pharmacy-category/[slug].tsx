import { Ionicons } from '@expo/vector-icons';
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductGridScreenSkeleton } from '../../components/ui/loading-skeleton';
import getAppBootstrap from '../../services/bootstrap-service';
import {
  type CatalogProduct,
  type CatalogSection,
  findCatalogSectionBySlug,
  getCatalogSectionOffers,
  getCatalogSectionProducts,
  getStoreCatalog,
  listStores,
  type StoreCatalog,
} from '../../services/catalog-service';
import { useCartStore } from '../../store/cart-store';
import { useCustomerStore } from '../../store/customer-store';

/* ============================================================
 * CONSTANTS
 * ============================================================
 */

const PAGE_MAX_WIDTH = 560;
const HORIZONTAL_PADDING = 16;
const PRODUCT_GAP = 10;

const OFFERS_CATEGORY_IMAGE = require(
  '../../../assets/images/supermarket-categories/offers.webp',
);

type ProductFilterKey =
  | 'all'
  | 'offers'
  | string;

type ProductCardMode =
  | 'category'
  | 'offers';

/* ============================================================
 * PHARMACY CATEGORY IMAGES
 * ============================================================
 */

/*
 * Pharmacy Subcategory images live locally in:
 *
 * assets/images/pharmacy-subcategories/
 *
 * The keys below are the real catalog category slugs from Supabase.
 */
const PHARMACY_SUBCATEGORY_IMAGES: Record<
  string,
  ImageSourcePropType
> = {
  'cold-flu-allergy-general-cold-flu': require('../../../assets/images/pharmacy-subcategories/cold-flu-allergy-general-cold-flu.webp'),
  'cold-flu-allergy-cough-dry-cough': require('../../../assets/images/pharmacy-subcategories/cold-flu-allergy-cough-dry-cough.webp'),
  'cold-flu-allergy-nose-sinuses': require('../../../assets/images/pharmacy-subcategories/cold-flu-allergy-nose-sinuses.webp'),
  'cold-flu-allergy-antihistamines': require('../../../assets/images/pharmacy-subcategories/cold-flu-allergy-antihistamines.webp'),
  'cold-flu-allergy-immunity-support': require('../../../assets/images/pharmacy-subcategories/cold-flu-allergy-immunity-support.webp'),
  'headache-pain-fever-antipyretics-cold': require('../../../assets/images/pharmacy-subcategories/headache-pain-fever-antipyretics-cold.webp'),
  'headache-pain-fever-headache-migraine': require('../../../assets/images/pharmacy-subcategories/headache-pain-fever-headache-migraine.webp'),
  'headache-pain-fever-bone-joint-muscle': require('../../../assets/images/pharmacy-subcategories/headache-pain-fever-bone-joint-muscle.webp'),
  'headache-pain-fever-dental-oral-pain': require('../../../assets/images/pharmacy-subcategories/headache-pain-fever-dental-oral-pain.webp'),
  'headache-pain-fever-cramps-spasms': require('../../../assets/images/pharmacy-subcategories/headache-pain-fever-cramps-spasms.webp'),
  'stomach-digestive-acidity-heartburn': require('../../../assets/images/pharmacy-subcategories/stomach-digestive-acidity-heartburn.webp'),
  'stomach-digestive-bloating-gas-colon': require('../../../assets/images/pharmacy-subcategories/stomach-digestive-bloating-gas-colon.webp'),
  'stomach-digestive-cramps-spasms': require('../../../assets/images/pharmacy-subcategories/stomach-digestive-cramps-spasms.webp'),
  'stomach-digestive-diarrhea-intestinal-antiseptics': require('../../../assets/images/pharmacy-subcategories/stomach-digestive-diarrhea-intestinal-antiseptics.webp'),
  'stomach-digestive-constipation-laxatives': require('../../../assets/images/pharmacy-subcategories/stomach-digestive-constipation-laxatives.webp'),
  'stomach-digestive-nausea-vomiting-motility': require('../../../assets/images/pharmacy-subcategories/stomach-digestive-nausea-vomiting-motility.webp'),
  'stomach-digestive-probiotics-microbiome': require('../../../assets/images/pharmacy-subcategories/stomach-digestive-probiotics-microbiome.webp'),
  'first-aid-wounds-dressings-adhesive-strips': require('../../../assets/images/pharmacy-subcategories/first-aid-wounds-dressings-adhesive-strips.webp'),
  'first-aid-wounds-topical-antiseptics': require('../../../assets/images/pharmacy-subcategories/first-aid-wounds-topical-antiseptics.webp'),
  'first-aid-wounds-wound-burn-treatments': require('../../../assets/images/pharmacy-subcategories/first-aid-wounds-wound-burn-treatments.webp'),
  'first-aid-wounds-tools-equipment': require('../../../assets/images/pharmacy-subcategories/first-aid-wounds-tools-equipment.webp'),
  'skincare-cleansing-face-wash': require('../../../assets/images/pharmacy-subcategories/skincare-cleansing-face-wash.webp'),
  'skincare-moisturizing-daily-protection': require('../../../assets/images/pharmacy-subcategories/skincare-moisturizing-daily-protection.webp'),
  'skincare-serums-intensive-treatments': require('../../../assets/images/pharmacy-subcategories/skincare-serums-intensive-treatments.webp'),
  'skincare-eye-area-care': require('../../../assets/images/pharmacy-subcategories/skincare-eye-area-care.webp'),
  'skincare-masks-exfoliators': require('../../../assets/images/pharmacy-subcategories/skincare-masks-exfoliators.webp'),
  'skincare-body-care': require('../../../assets/images/pharmacy-subcategories/skincare-body-care.webp'),
  'skincare-tools': require('../../../assets/images/pharmacy-subcategories/skincare-tools.webp'),
  'hair-scalp-care-shampoo': require('../../../assets/images/pharmacy-subcategories/hair-scalp-care-shampoo.webp'),
  'hair-scalp-care-conditioner': require('../../../assets/images/pharmacy-subcategories/hair-scalp-care-conditioner.webp'),
  'hair-scalp-care-masks-cream-baths': require('../../../assets/images/pharmacy-subcategories/hair-scalp-care-masks-cream-baths.webp'),
  'hair-scalp-care-serums-oils': require('../../../assets/images/pharmacy-subcategories/hair-scalp-care-serums-oils.webp'),
  'hair-scalp-care-scalp-hair-loss-treatments': require('../../../assets/images/pharmacy-subcategories/hair-scalp-care-scalp-hair-loss-treatments.webp'),
  'hair-scalp-care-hair-coloring': require('../../../assets/images/pharmacy-subcategories/hair-scalp-care-hair-coloring.webp'),
  'hair-scalp-care-tools-accessories': require('../../../assets/images/pharmacy-subcategories/hair-scalp-care-tools-accessories.webp'),
  'oral-dental-care-toothpaste': require('../../../assets/images/pharmacy-subcategories/oral-dental-care-toothpaste.webp'),
  'oral-dental-care-toothbrushes': require('../../../assets/images/pharmacy-subcategories/oral-dental-care-toothbrushes.webp'),
  'oral-dental-care-floss-water-cleaners': require('../../../assets/images/pharmacy-subcategories/oral-dental-care-floss-water-cleaners.webp'),
  'oral-dental-care-mouthwash-fresheners': require('../../../assets/images/pharmacy-subcategories/oral-dental-care-mouthwash-fresheners.webp'),
  'oral-dental-care-gum-dental-treatments': require('../../../assets/images/pharmacy-subcategories/oral-dental-care-gum-dental-treatments.webp'),
  'oral-dental-care-dentures-appliances': require('../../../assets/images/pharmacy-subcategories/oral-dental-care-dentures-appliances.webp'),
  'vitamins-supplements-multivitamins': require('../../../assets/images/pharmacy-subcategories/vitamins-supplements-multivitamins.webp'),
  'vitamins-supplements-single-vitamins-minerals': require('../../../assets/images/pharmacy-subcategories/vitamins-supplements-single-vitamins-minerals.webp'),
  'vitamins-supplements-health-goal': require('../../../assets/images/pharmacy-subcategories/vitamins-supplements-health-goal.webp'),
  'vitamins-supplements-weight-management': require('../../../assets/images/pharmacy-subcategories/vitamins-supplements-weight-management.webp'),
  'women-care-menstrual-cycle': require('../../../assets/images/pharmacy-subcategories/women-care-menstrual-cycle.webp'),
  'women-care-hair-removal': require('../../../assets/images/pharmacy-subcategories/women-care-hair-removal.webp'),
  'men-care-beard-mustache': require('../../../assets/images/pharmacy-subcategories/men-care-beard-mustache.webp'),
  'men-care-shaving-aftershave': require('../../../assets/images/pharmacy-subcategories/men-care-shaving-aftershave.webp'),
  'men-care-face-skincare': require('../../../assets/images/pharmacy-subcategories/men-care-face-skincare.webp'),
  'men-care-hair-shower': require('../../../assets/images/pharmacy-subcategories/men-care-hair-shower.webp'),
  'men-care-deodorants-fragrances': require('../../../assets/images/pharmacy-subcategories/men-care-deodorants-fragrances.webp'),
  'men-care-body-intimate-care': require('../../../assets/images/pharmacy-subcategories/men-care-body-intimate-care.webp'),
  'eyes-lenses-therapeutic-drops-solutions': require('../../../assets/images/pharmacy-subcategories/eyes-lenses-therapeutic-drops-solutions.webp'),
  'eyes-lenses-cosmetic-contact-lenses': require('../../../assets/images/pharmacy-subcategories/eyes-lenses-cosmetic-contact-lenses.webp'),
  'eyes-lenses-medical-contact-lenses': require('../../../assets/images/pharmacy-subcategories/eyes-lenses-medical-contact-lenses.webp'),
  'eyes-lenses-solutions-accessories': require('../../../assets/images/pharmacy-subcategories/eyes-lenses-solutions-accessories.webp'),
  'eyes-lenses-eye-area-accessories': require('../../../assets/images/pharmacy-subcategories/eyes-lenses-eye-area-accessories.webp'),
  'cosmetics-face-makeup': require('../../../assets/images/pharmacy-subcategories/cosmetics-face-makeup.webp'),
  'cosmetics-eye-brow-makeup': require('../../../assets/images/pharmacy-subcategories/cosmetics-eye-brow-makeup.webp'),
  'cosmetics-lip-makeup': require('../../../assets/images/pharmacy-subcategories/cosmetics-lip-makeup.webp'),
  'cosmetics-makeup-tools-accessories': require('../../../assets/images/pharmacy-subcategories/cosmetics-makeup-tools-accessories.webp'),
  'cosmetics-nails-hand-care': require('../../../assets/images/pharmacy-subcategories/cosmetics-nails-hand-care.webp'),
  'cosmetics-makeup-removal-cleansing': require('../../../assets/images/pharmacy-subcategories/cosmetics-makeup-removal-cleansing.webp'),
};

/* ============================================================
 * HELPERS
 * ============================================================
 */

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

function normalizeSearchText(
  value: string | null | undefined,
) {
  return (value ?? '')
    .trim()
    .toLowerCase();
}

function normalizeSlug(
  value: string | null | undefined,
) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getProductImage(
  product: CatalogProduct,
): string | null {
  if (product.imageUrl) {
    return product.imageUrl;
  }

  const coverImage =
    product.images.find(
      (image) => image.isCover,
    );

  if (coverImage) {
    return coverImage.imageUrl;
  }

  return (
    product.images[0]?.imageUrl ??
    null
  );
}

function getDiscountPercent(
  product: CatalogProduct,
): number | null {
  if (
    product.compareAtPrice === null ||
    product.compareAtPrice <=
      product.price ||
    product.compareAtPrice <= 0
  ) {
    return null;
  }

  return Math.round(
    ((product.compareAtPrice -
      product.price) /
      product.compareAtPrice) *
      100,
  );
}

function isOfferProduct(
  product: CatalogProduct,
) {
  return (
    product.compareAtPrice !== null &&
    product.compareAtPrice >
      product.price &&
    product.compareAtPrice > 0
  );
}

function formatMoney(
  value: number,
  currencyCode: string,
) {
  const currencyLabel =
    currencyCode
      .trim()
      .toUpperCase() === 'EGP'
      ? 'ج.م'
      : currencyCode;

  return `${value.toFixed(
    2,
  )} ${currencyLabel}`;
}

function deduplicateProducts(
  products: CatalogProduct[],
) {
  const productsMap =
    new Map<
      string,
      CatalogProduct
    >();

  for (const product of products) {
    productsMap.set(
      product.id,
      product,
    );
  }

  return Array.from(
    productsMap.values(),
  );
}

function getOfferPageRootCategories(
  catalog: StoreCatalog,
): CatalogSection[] {
  /*
   * Primary source:
   * categoryTree contains the real root categories.
   */
  const treeRoots =
    catalog.categoryTree.filter(
      (section) =>
        section.parentId === null ||
        section.depth === 0,
    );

  /*
   * Defensive fallback:
   * لو categoryTree رجعت فاضية لأي سبب،
   * نستخدم الـFlat sections ونجيب الـRoot categories.
   */
  const fallbackRoots =
    catalog.sections.filter(
      (section) =>
        section.parentId === null,
    );

  const source =
    treeRoots.length > 0
      ? treeRoots
      : fallbackRoots.length > 0
        ? fallbackRoots
        : catalog.sections.filter(
            (section) =>
              section.depth === 0,
          );

  const uniqueRoots =
    new Map<
      string,
      CatalogSection
    >();

  for (const section of source) {
    uniqueRoots.set(
      section.id,
      section,
    );
  }

  return Array.from(
    uniqueRoots.values(),
  ).sort(
    (
      first,
      second,
    ) => {
      if (
        first.sortOrder !==
        second.sortOrder
      ) {
        return (
          first.sortOrder -
          second.sortOrder
        );
      }

      return first.name.localeCompare(
        second.name,
        'ar',
      );
    },
  );
}

function getAllCatalogOffers(
  catalog: StoreCatalog,
) {
  const products: CatalogProduct[] =
    [];

  for (
    const rootCategory of
    getOfferPageRootCategories(
      catalog,
    )
  ) {
    products.push(
      ...getCatalogSectionOffers(
        rootCategory,
      ),
    );
  }

  /*
   * Final defensive fallback:
   * لو hierarchy مش مكتملة، نجمع أي منتج عليه خصم
   * من كل sections بدل ما صفحة العروض تظهر فاضية.
   */
  if (products.length === 0) {
    for (
      const section of
      catalog.sections
    ) {
      for (
        const product of
        section.products
      ) {
        if (
          isOfferProduct(
            product,
          )
        ) {
          products.push(
            product,
          );
        }
      }
    }
  }

  return deduplicateProducts(
    products,
  );
}

/* ============================================================
 * CATEGORY VISUAL
 * ============================================================
 */

function CategoryFilterVisual({
  section,
  fallbackKey,
}: {
  section: CatalogSection;
  fallbackKey?: string;
}) {
  const normalizedSectionSlug =
    normalizeSlug(section.slug);

  const localSubcategoryImage =
    PHARMACY_SUBCATEGORY_IMAGES[
      normalizedSectionSlug
    ];

  /*
   * Keep the same visual behavior as Supermarket:
   * local artwork fills the complete circular category frame.
   */
  if (localSubcategoryImage) {
    return (
      <Image
        source={localSubcategoryImage}
        style={
          styles.filterCategoryImage
        }
        resizeMode="cover"
      />
    );
  }

  /*
   * Root Pharmacy categories continue using image_url from Supabase.
   * fallbackKey is also checked against the local map as a defensive
   * fallback for any future locally-mapped root category.
   */
  const fallbackLocalImage =
    fallbackKey
      ? PHARMACY_SUBCATEGORY_IMAGES[
          normalizeSlug(
            fallbackKey,
          )
        ]
      : undefined;

  if (fallbackLocalImage) {
    return (
      <Image
        source={fallbackLocalImage}
        style={
          styles.filterCategoryImage
        }
        resizeMode="cover"
      />
    );
  }

  if (section.imageUrl) {
    return (
      <Image
        source={{
          uri: section.imageUrl,
        }}
        style={
          styles.filterCategoryImage
        }
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={
        styles.filterImagePlaceholder
      }
    />
  );
}

/* ============================================================
 * PRODUCT CARD
 * ============================================================
 */

type ProductCardProps = {
  product: CatalogProduct;

  cardWidth: number;

  currencyCode: string;

  quantity: number;

  isStoreClosed: boolean;

  mode: ProductCardMode;

  onAdd: () => void;

  onIncrease: () => void;

  onDecrease: () => void;
};

function ProductCard({
  product,
  cardWidth,
  currencyCode,
  quantity,
  isStoreClosed,
  mode,
  onAdd,
  onIncrease,
  onDecrease,
}: ProductCardProps) {
  const imageUrl =
    getProductImage(product);

  const discount =
    getDiscountPercent(product);

  const isOffersMode =
    mode === 'offers';

  const hasOldPrice =
    product.compareAtPrice !== null &&
    product.compareAtPrice >
      product.price;

  return (
    <View
      style={[
        styles.productCard,
        isOffersMode &&
          styles.offersProductCard,
        {
          width: cardWidth,
        },
      ]}
    >
      <View
        style={[
          styles.productImageBox,
          isOffersMode &&
            styles.offersProductImageBox,
          {
            height: cardWidth,
          },
        ]}
      >
        {imageUrl ? (
          <Image
            source={{
              uri: imageUrl,
            }}
            style={
              styles.productImage
            }
            resizeMode="contain"
          />
        ) : (
          <Text
            style={
              styles.productFallback
            }
          >
            {product.icon || '💊'}
          </Text>
        )}

        {discount !== null && (
          <View
            style={[
              styles.discountBadgeBase,

              isOffersMode
                ? styles.offersDiscountBadge
                : styles.categoryDiscountBadge,
            ]}
          >
            <Text
              style={[
                styles.discountText,

                isOffersMode &&
                  styles.offersDiscountText,
              ]}
              numberOfLines={1}
            >
              {isOffersMode
                ? `وفر ${discount}%`
                : `خصم ${discount}%`}
            </Text>
          </View>
        )}

        {(product.requiresPrescription ||
          product.isAgeRestricted) && (
          <View
            style={[
              styles.restrictionBadges,

              isOffersMode
                ? styles.restrictionBadgesOffers
                : styles.restrictionBadgesCategory,
            ]}
          >
            {product.requiresPrescription && (
              <View
                style={
                  styles.prescriptionBadge
                }
              >
                <Text
                  style={
                    styles.prescriptionBadgeText
                  }
                >
                  وصفة
                </Text>
              </View>
            )}

            {product.isAgeRestricted && (
              <View
                style={
                  styles.ageRestrictionBadge
                }
              >
                <Text
                  style={
                    styles.ageRestrictionBadgeText
                  }
                >
                  18+
                </Text>
              </View>
            )}
          </View>
        )}

        {quantity === 0 ? (
          <Pressable
            disabled={isStoreClosed}
            hitSlop={4}
            onPress={onAdd}
            style={({ pressed }) => [
              styles.addButton,

              isOffersMode &&
                styles.offersAddButton,

              isStoreClosed &&
                styles.disabledButton,

              pressed &&
                !isStoreClosed &&
                styles.addButtonPressed,
            ]}
          >
            <Text
              style={[
                styles.addButtonText,

                isOffersMode &&
                  styles.offersAddButtonText,
              ]}
            >
              +
            </Text>
          </Pressable>
        ) : (
          <View
            style={[
              styles.quantityPill,

              isOffersMode &&
                styles.offersQuantityPill,
            ]}
          >
            <Pressable
              hitSlop={4}
              style={
                styles.quantityAction
              }
              onPress={onDecrease}
            >
              <Text
                style={
                  styles.quantityActionText
                }
              >
                −
              </Text>
            </Pressable>

            <Text
              style={
                styles.quantityText
              }
            >
              {quantity}
            </Text>

            <Pressable
              disabled={isStoreClosed}
              hitSlop={4}
              style={
                styles.quantityAction
              }
              onPress={onIncrease}
            >
              <Text
                style={
                  styles.quantityActionText
                }
              >
                +
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <Text
        style={[
          styles.productName,

          isOffersMode &&
            styles.offersProductName,
        ]}
        numberOfLines={
          isOffersMode ? 2 : 3
        }
      >
        {product.name}
      </Text>

      {product.unitLabelAr ? (
        <Text
          style={[
            styles.productUnitLabel,

            isOffersMode &&
              styles.offersProductUnitLabel,
          ]}
          numberOfLines={1}
        >
          {product.unitLabelAr}
        </Text>
      ) : null}

      {isOffersMode ? (
        <View
          style={
            styles.offersPriceRow
          }
        >
          <View
            style={
              styles.offersCurrentPriceUnderline
            }
          >
            <Text
              style={
                styles.offersCurrentPrice
              }
              numberOfLines={1}
            >
              {formatMoney(
                product.price,
                currencyCode,
              )}
            </Text>
          </View>

          {hasOldPrice && (
            <Text
              style={
                styles.offersOldPrice
              }
              numberOfLines={1}
            >
              {formatMoney(
                product.compareAtPrice!,
                currencyCode,
              )}
            </Text>
          )}
        </View>
      ) : (
        <View
          style={
            styles.priceColumn
          }
        >
          <Text
            style={
              styles.currentPrice
            }
          >
            {formatMoney(
              product.price,
              currencyCode,
            )}
          </Text>

          {hasOldPrice && (
            <Text
              style={
                styles.oldPrice
              }
            >
              {formatMoney(
                product.compareAtPrice!,
                currencyCode,
              )}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

/* ============================================================
 * SCREEN
 * ============================================================
 */

export default function PharmacyCategoryScreen() {
  const router = useRouter();

  const offersTabsScrollRef =
    useRef<ScrollView | null>(
      null,
    );

  const hasPositionedOffersTabsRef =
    useRef(false);

  /*
   * Normal category/subcategory rail.
   *
   * Expo Router may keep this screen mounted when navigating
   * between nested categories. Without explicitly resetting the
   * horizontal position, React Native can preserve the previous
   * ScrollView offset and make the next category open in the middle
   * of its subcategories.
   */
  const filtersScrollRef =
    useRef<ScrollView | null>(
      null,
    );

  const hasPositionedFiltersRef =
    useRef(false);

  const {
    width: windowWidth,
  } = useWindowDimensions();

  const savedServiceAreaId =
    useCustomerStore(
      (state) =>
        state.locationServiceAreaId,
    );

  const params =
    useLocalSearchParams<{
      slug?:
        | string
        | string[];

      storeId?:
        | string
        | string[];

      categoryKey?:
        | string
        | string[];

      label?:
        | string
        | string[];
    }>();

  const sectionSlug =
    getSingleParam(
      params.slug,
    ) ?? '';

  const requestedStoreId =
    getSingleParam(
      params.storeId,
    );

  const passedCategoryKey =
    getSingleParam(
      params.categoryKey,
    );

  const passedLabel =
    getSingleParam(
      params.label,
    );

  const isOffersPage =
    normalizeSlug(sectionSlug) ===
    'offers';

  /* ==========================================================
   * STATE
   * ==========================================================
   */

  const [
    catalog,
    setCatalog,
  ] =
    useState<StoreCatalog | null>(
      null,
    );

  const [
    selectedSection,
    setSelectedSection,
  ] =
    useState<CatalogSection | null>(
      null,
    );

  const [
    currencyCode,
    setCurrencyCode,
  ] =
    useState('EGP');

  const [
    selectedFilterKey,
    setSelectedFilterKey,
  ] =
    useState<ProductFilterKey>(
      'all',
    );

  const [
    isSearchVisible,
    setIsSearchVisible,
  ] =
    useState(false);

  const [
    searchQuery,
    setSearchQuery,
  ] =
    useState('');

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<string | null>(
      null,
    );

  /* ==========================================================
   * CART
   * ==========================================================
   */

  const carts =
    useCartStore(
      (state) => state.carts,
    );

  const addItem =
    useCartStore(
      (state) =>
        state.addItem,
    );

  const increaseStoreItem =
    useCartStore(
      (state) =>
        state.increaseStoreItem,
    );

  const decreaseStoreItem =
    useCartStore(
      (state) =>
        state.decreaseStoreItem,
    );

  const setActiveCart =
    useCartStore(
      (state) =>
        state.setActiveCart,
    );

  /* ==========================================================
   * LOAD
   * ==========================================================
   */

  async function loadCategory() {
    try {
      setIsLoading(true);

      setErrorMessage(null);

      const bootstrap =
        await getAppBootstrap();

      const serviceAreaId =
        savedServiceAreaId ??
        bootstrap.settings
          .default_service_area_id ??
        undefined;

      let storeId =
        requestedStoreId;

      if (!storeId) {
        const pharmacies =
          await listStores({
            categorySlug:
              'pharmacy',

            serviceAreaId,
          });

        if (
          pharmacies.length ===
          0
        ) {
          throw new Error(
            'لا توجد صيدلية متاحة حاليًا.',
          );
        }

        const pharmacy =
          pharmacies.find(
            (store) =>
              store.isFeatured &&
              !store.isManuallyClosed,
          ) ??
          pharmacies.find(
            (store) =>
              !store.isManuallyClosed,
          ) ??
          pharmacies[0];

        storeId =
          pharmacy.id;
      }

      const loadedCatalog =
        await getStoreCatalog(
          storeId,
          serviceAreaId,
        );

      /*
       * العروض ليست Category حقيقية.
       *
       * هي صفحة Virtual تجمع المنتجات
       * التي عليها compareAtPrice > price
       * من كل أقسام الصيدلية.
       */
      if (isOffersPage) {
        setCatalog(
          loadedCatalog,
        );

        setSelectedSection(
          null,
        );

        setCurrencyCode(
          bootstrap.settings
            .currency_code ||
            'EGP',
        );

        setSelectedFilterKey(
          'all',
        );

        setSearchQuery('');

        return;
      }

      const section =
        findCatalogSectionBySlug(
          loadedCatalog,
          sectionSlug,
        );

      if (!section) {
        throw new Error(
          'لم يتم العثور على فئة الصيدلية المطلوبة.',
        );
      }

      setCatalog(
        loadedCatalog,
      );

      setSelectedSection(
        section,
      );

      setCurrencyCode(
        bootstrap.settings
          .currency_code ||
          'EGP',
      );

      setSelectedFilterKey(
        'all',
      );

      setSearchQuery('');
    } catch (error) {
      setCatalog(null);

      setSelectedSection(
        null,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر تحميل هذه الفئة.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    hasPositionedOffersTabsRef.current =
      false;

    hasPositionedFiltersRef.current =
      false;

    void loadCategory();
  }, [
    requestedStoreId,
    sectionSlug,
    savedServiceAreaId,
  ]);

  /* ==========================================================
   * NORMAL CATEGORY CHILDREN
   * ==========================================================
   */

  const childCategories =
    useMemo(() => {
      if (!selectedSection) {
        return [];
      }

      return [
        ...selectedSection.children,
      ].sort(
        (
          first,
          second,
        ) => {
          if (
            first.sortOrder !==
            second.sortOrder
          ) {
            return (
              first.sortOrder -
              second.sortOrder
            );
          }

          return first.name.localeCompare(
            second.name,
            'ar',
          );
        },
      );
    }, [selectedSection]);

  /*
   * We render the normal filter rail using a regular row instead of
   * row-reverse. To keep the Arabic visual order:
   *
   * Right edge:
   *   الكل → العروض → أول Subcategory → ...
   *
   * the child categories are reversed only for display.
   */
  const childCategoriesForDisplay =
    useMemo(
      () => [
        ...childCategories,
      ].reverse(),
      [childCategories],
    );

  /*
   * Reset the normal subcategory rail whenever the actual category
   * changes. This is important because Expo Router can reuse the same
   * screen instance and preserve the old horizontal ScrollView offset.
   *
   * Two animation frames give React Native enough time to lay out the
   * new rail before we move it to its Arabic "start" (the right edge).
   */
  useEffect(() => {
    if (
      isOffersPage ||
      !selectedSection
    ) {
      return;
    }

    hasPositionedFiltersRef.current =
      false;

    requestAnimationFrame(
      () => {
        requestAnimationFrame(
          () => {
            filtersScrollRef.current?.scrollToEnd(
              {
                animated:
                  false,
              },
            );

            hasPositionedFiltersRef.current =
              true;
          },
        );
      },
    );
  }, [
    isOffersPage,
    selectedSection?.id,
  ]);

  /* ==========================================================
   * OFFER PAGE CATEGORY TABS
   * ==========================================================
   */

  const offerCategoryTabs =
    useMemo(() => {
      if (!catalog) {
        return [];
      }

      /*
       * بنعرض كل Main Categories في صفحة العروض،
       * حتى لو Category معينة مفيهاش عروض حالياً.
       *
       * قبل كده كان فيه filter بيخفي أي Category
       * مفيهاش منتج compareAtPrice > price.
       */
      return getOfferPageRootCategories(
        catalog,
      );
    }, [catalog]);

  /*
   * Horizontal ScrollView + row-reverse ممكن يخلي العناصر
   * تبدأ خارج الـviewport على بعض الأجهزة.
   *
   * لذلك نعرض Row عادي، نعكس الـCategories بصرياً،
   * ونضع "الكل" في أقصى اليمين.
   */
  const offerCategoryTabsForDisplay =
    useMemo(
      () => [
        ...offerCategoryTabs,
      ].reverse(),
      [offerCategoryTabs],
    );

  /* ==========================================================
   * PRODUCTS
   * ==========================================================
   */

  const filteredProducts =
    useMemo(() => {
      if (!catalog) {
        return [];
      }

      let products:
        CatalogProduct[] = [];

      /*
       * =====================================
       * OFFERS PAGE
       * =====================================
       */
      if (isOffersPage) {
        if (
          selectedFilterKey ===
          'all'
        ) {
          products =
            getAllCatalogOffers(
              catalog,
            );
        } else {
          const selectedOfferCategory =
            offerCategoryTabs.find(
              (category) =>
                category.id ===
                selectedFilterKey,
            );

          if (
            selectedOfferCategory
          ) {
            products =
              getCatalogSectionOffers(
                selectedOfferCategory,
              );
          }
        }
      }

      /*
       * =====================================
       * NORMAL CATEGORY PAGE
       * =====================================
       */
      else if (selectedSection) {
        if (
          selectedFilterKey ===
          'all'
        ) {
          products =
            getCatalogSectionProducts(
              selectedSection,
              true,
            );
        } else if (
          selectedFilterKey ===
          'offers'
        ) {
          products =
            getCatalogSectionOffers(
              selectedSection,
            );
        } else {
          const selectedChild =
            childCategories.find(
              (category) =>
                category.id ===
                selectedFilterKey,
            );

          if (selectedChild) {
            products =
              getCatalogSectionProducts(
                selectedChild,
                true,
              );
          }
        }
      }

      /*
       * Search.
       */
      const normalizedQuery =
        normalizeSearchText(
          searchQuery,
        );

      if (normalizedQuery) {
        products =
          products.filter(
            (product) => {
              const searchableText =
                [
                  product.name,
                  product.nameEn,
                  product.description,
                  product.descriptionEn,
                  product.sku,
                  product.barcode,
                  product.unitLabelAr,
                  product.unitLabelEn,
                ]
                  .filter(Boolean)
                  .join(' ')
                  .toLowerCase();

              return searchableText.includes(
                normalizedQuery,
              );
            },
          );
      }

      /*
       * Safety:
       *
       * صفحة العروض مستحيل تعرض
       * منتج بدون خصم.
       */
      if (isOffersPage) {
        products =
          products.filter(
            isOfferProduct,
          );
      }

      return deduplicateProducts(
        products,
      );
    }, [
      catalog,
      isOffersPage,
      selectedFilterKey,
      searchQuery,
      selectedSection,
      childCategories,
      offerCategoryTabs,
    ]);

  /* ==========================================================
   * LOADING
   * ==========================================================
   */

  if (isLoading) {
    return (
      <ProductGridScreenSkeleton />
    );
  }

  /* ==========================================================
   * ERROR
   * ==========================================================
   */

  if (
    !catalog ||
    errorMessage ||
    (!isOffersPage &&
      !selectedSection)
  ) {
    return (
      <SafeAreaView
        style={styles.stateScreen}
      >
        <StatusBar
          style="dark"
        />

        <Text
          style={
            styles.stateEmoji
          }
        >
          🛒
        </Text>

        <Text
          style={
            styles.stateTitle
          }
        >
          الفئة غير متاحة
        </Text>

        <Text
          style={
            styles.stateDescription
          }
        >
          {errorMessage ??
            'تعذر تحميل هذه الفئة.'}
        </Text>

        <Pressable
          style={
            styles.retryButton
          }
          onPress={() => {
            void loadCategory();
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
          style={
            styles.backErrorButton
          }
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.backErrorButtonText
            }
          >
            رجوع
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  /* ==========================================================
   * STORE
   * ==========================================================
   */

  const currentStore =
    catalog.store;

  const delivery =
    catalog.delivery;

  const isStoreClosed =
    currentStore.isManuallyClosed;

  const currentCart =
    carts[currentStore.id] ??
    null;

  const cartItems =
    currentCart?.items ??
    [];

  const currentStoreSubtotal =
    cartItems.reduce(
      (total, item) =>
        total +
        item.price *
          item.quantity,
      0,
    );

  const currentStoreItemCount =
    cartItems.reduce(
      (total, item) =>
        total +
        item.quantity,
      0,
    );

  const minimumOrder =
    delivery.minimumOrder;

  const amountRemaining =
    Math.max(
      minimumOrder -
        currentStoreSubtotal,
      0,
    );

  const orderProgress =
    minimumOrder <= 0
      ? currentStoreItemCount >
        0
        ? 1
        : 0
      : Math.min(
          currentStoreSubtotal /
            minimumOrder,
          1,
        );

  /* ==========================================================
   * LAYOUT
   * ==========================================================
   */

  const pageWidth =
    Math.min(
      windowWidth,
      PAGE_MAX_WIDTH,
    );

  const productCardWidth =
    (pageWidth -
      HORIZONTAL_PADDING * 2 -
      PRODUCT_GAP) /
    2;

  const categoryKey =
    passedCategoryKey ??
    selectedSection?.slug ??
    '';

  const pageTitle =
    isOffersPage
      ? 'العروض'
      : selectedSection?.name ||
        passedLabel ||
        '';

  const shouldShowNormalCartDock =
    !isOffersPage &&
    currentStoreItemCount > 0;

  /* ==========================================================
   * NORMAL CATEGORY NAVIGATION
   * ==========================================================
   */

  function openChildCategory(
    child: CatalogSection,
  ) {
    if (
      child.children.length > 0
    ) {
      router.push({
        pathname:
          '/pharmacy-category/[slug]',

        params: {
          slug:
            child.slug,

          storeId:
            currentStore.id,

          categoryKey:
            child.slug,

          label:
            child.name,
        },
      });

      return;
    }

    setSelectedFilterKey(
      child.id,
    );

    setSearchQuery('');
  }

  /* ==========================================================
   * CART
   * ==========================================================
   */

  function addProduct(
    product: CatalogProduct,
  ) {
    if (isStoreClosed) {
      return;
    }

    addItem(
      {
        id:
          currentStore.id,

        name:
          currentStore.name,

        icon:
          currentStore.icon,

        categorySlug:
          currentStore.categorySlug,

        deliveryFee:
          delivery.deliveryFee,

        minimumOrder:
          delivery.minimumOrder,
      },
      {
        id:
          product.id,

        name:
          product.name,

        description:
          product.description,

        price:
          product.price,

        icon:
          product.icon,

        variantId:
          null,

        variantName:
          null,

        requiresPrescription:
          product.requiresPrescription,

        isAgeRestricted:
          product.isAgeRestricted,
      },
    );
  }

  function increaseProduct(
    product: CatalogProduct,
  ) {
    if (isStoreClosed) {
      return;
    }

    const itemExists =
      cartItems.some(
        (item) =>
          item.id ===
            product.id &&
          item.variantId ===
            null,
      );

    if (itemExists) {
      increaseStoreItem(
        currentStore.id,
        product.id,
        null,
      );

      return;
    }

    addProduct(
      product,
    );
  }

  function decreaseProduct(
    productId: string,
  ) {
    decreaseStoreItem(
      currentStore.id,
      productId,
      null,
    );
  }

  function getProductQuantity(
    productId: string,
  ) {
    return (
      cartItems.find(
        (item) =>
          item.id ===
            productId &&
          item.variantId ===
            null,
      )?.quantity ?? 0
    );
  }

  function openCart() {
    if (
      currentStoreItemCount <= 0
    ) {
      return;
    }

    setActiveCart(
      currentStore.id,
    );

    router.push({
      pathname:
        '/cart',

      params: {
        storeId:
          currentStore.id,
      },
    });
  }

  function getCartMessage() {
    if (
      minimumOrder <= 0 ||
      amountRemaining <= 0
    ) {
      return 'الطلب جاهز للإكمال';
    }

    return `أضف ${formatMoney(
      amountRemaining,
      currencyCode,
    )} لإتمام الحد الأدنى للطلب`;
  }

  function getEmptyMessage() {
    if (
      searchQuery.trim()
    ) {
      return 'لم نجد منتجاً مطابقاً لبحثك.';
    }

    if (isOffersPage) {
      if (
        selectedFilterKey !==
        'all'
      ) {
        return 'لا توجد عروض متاحة حالياً داخل هذه الفئة.';
      }

      return 'لا توجد عروض متاحة حالياً.';
    }

    if (
      selectedFilterKey ===
      'offers'
    ) {
      return 'لا توجد عروض حالياً داخل هذه الفئة.';
    }

    if (
      selectedFilterKey !==
      'all'
    ) {
      return 'لا توجد منتجات متاحة داخل هذا القسم حالياً.';
    }

    return 'لا توجد منتجات متاحة داخل هذه الفئة حالياً.';
  }

  /* ==========================================================
   * UI
   * ==========================================================
   */

  return (
    <SafeAreaView
      style={styles.screen}
      edges={[
        'top',
        'bottom',
      ]}
    >
      <StatusBar
        style="dark"
      />

      <View
        style={
          styles.pageShell
        }
      >
        {/* =====================================================
         * HEADER
         * =====================================================
         */}

        <View
          style={
            styles.header
          }
        >
          {isSearchVisible ? (
            <View
              style={
                styles.searchInputContainer
              }
            >
              <Ionicons
                name="search-outline"
                size={18}
                color="#222222"
              />

              <TextInput
                autoFocus
                value={searchQuery}
                onChangeText={
                  setSearchQuery
                }
                placeholder={
                  isOffersPage
                    ? 'ابحث في العروض'
                    : 'ابحث في الفئة'
                }
                placeholderTextColor="#999999"
                style={
                  styles.searchInput
                }
                textAlign="right"
              />

              <Pressable
                hitSlop={12}
                onPress={() => {
                  setSearchQuery('');

                  setIsSearchVisible(
                    false,
                  );
                }}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color="#222222"
                />
              </Pressable>
            </View>
          ) : (
            <>
              {/* Back button stays on the LEFT side. */}
              <Pressable
                style={({
                  pressed,
                }) => [
                  styles.headerCircleButton,

                  pressed &&
                    styles.pressed,
                ]}
                onPress={() =>
                  router.back()
                }
              >
                <Ionicons
                  name="arrow-back"
                  size={22}
                  color="#202020"
                />
              </Pressable>

              <View
                style={
                  styles.headerTitleGroup
                }
              >
                <Text
                  style={
                    styles.headerTitle
                  }
                  numberOfLines={1}
                >
                  {pageTitle}
                </Text>
              </View>

              {/* Search button stays on the RIGHT side. */}
              <Pressable
                style={({
                  pressed,
                }) => [
                  styles.headerCircleButton,

                  pressed &&
                    styles.pressed,
                ]}
                onPress={() => {
                  setIsSearchVisible(
                    true,
                  );
                }}
              >
                <Ionicons
                  name="search-outline"
                  size={21}
                  color="#202020"
                />
              </Pressable>
            </>
          )}
        </View>

        {/* =====================================================
         * OFFERS CATEGORY TABS
         * =====================================================
         */}

        {isOffersPage && (
          <View
            style={
              styles.offersTabsContainer
            }
          >
            <ScrollView
              ref={
                offersTabsScrollRef
              }
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              directionalLockEnabled
              contentContainerStyle={
                styles.offersTabsRail
              }
              style={
                styles.offersTabsScroll
              }
              onContentSizeChange={() => {
                if (
                  hasPositionedOffersTabsRef.current
                ) {
                  return;
                }

                hasPositionedOffersTabsRef.current =
                  true;

                requestAnimationFrame(
                  () => {
                    offersTabsScrollRef.current?.scrollToEnd(
                      {
                        animated:
                          false,
                      },
                    );
                  },
                );
              }}
            >
              {offerCategoryTabsForDisplay.map(
                (category) => {
                  const isSelected =
                    selectedFilterKey ===
                    category.id;

                  return (
                    <Pressable
                      key={
                        category.id
                      }
                      style={
                        styles.offersTab
                      }
                      onPress={() => {
                        setSelectedFilterKey(
                          category.id,
                        );

                        setSearchQuery(
                          '',
                        );
                      }}
                    >
                      <Text
                        style={[
                          styles.offersTabText,

                          isSelected &&
                            styles.offersTabTextSelected,
                        ]}
                        numberOfLines={
                          1
                        }
                      >
                        {
                          category.name
                        }
                      </Text>

                      {isSelected && (
                        <View
                          style={
                            styles.offersTabUnderline
                          }
                        />
                      )}
                    </Pressable>
                  );
                },
              )}

              <Pressable
                style={
                  styles.offersTab
                }
                onPress={() => {
                  setSelectedFilterKey(
                    'all',
                  );

                  setSearchQuery('');
                }}
              >
                <Text
                  style={[
                    styles.offersTabText,

                    selectedFilterKey ===
                      'all' &&
                      styles.offersTabTextSelected,
                  ]}
                  numberOfLines={1}
                >
                  الكل
                </Text>

                {selectedFilterKey ===
                  'all' && (
                  <View
                    style={
                      styles.offersTabUnderline
                    }
                  />
                )}
              </Pressable>
            </ScrollView>
          </View>
        )}

        {/* =====================================================
         * CONTENT
         * =====================================================
         */}

        <ScrollView
          style={
            styles.scrollView
          }
          contentContainerStyle={[
            styles.scrollContent,

            {
              paddingBottom:
                shouldShowNormalCartDock
                  ? 145
                  : 30,
            },
          ]}
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
        >
          {/* ===================================================
           * NORMAL CATEGORY FILTERS
           * ===================================================
           */}

          {!isOffersPage &&
            selectedSection && (
            <>
              <ScrollView
                ref={
                  filtersScrollRef
                }
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                directionalLockEnabled
                contentContainerStyle={
                  styles.filtersRail
                }
                style={
                  styles.filtersScroll
                }
                onContentSizeChange={() => {
                  /*
                   * When the route changes to another category,
                   * React Native can retain the old x offset.
                   * Position once after the new content is measured.
                   */
                  if (
                    hasPositionedFiltersRef.current
                  ) {
                    return;
                  }

                  requestAnimationFrame(
                    () => {
                      filtersScrollRef.current?.scrollToEnd(
                        {
                          animated:
                            false,
                        },
                      );

                      hasPositionedFiltersRef.current =
                        true;
                    },
                  );
                }}
              >
                {/* CHILD CATEGORIES
                 *
                 * Reversed only for display because this ScrollView
                 * uses a normal row. They come before OFFERS in the
                 * underlying LTR row so the visible Arabic order starts:
                 * الكل → العروض → أول Subcategory → ثاني Subcategory → ...
                 */}

                {childCategoriesForDisplay.map(
                  (child) => {
                    const isSelected =
                      selectedFilterKey ===
                      child.id;

                    return (
                      <Pressable
                        key={
                          child.id
                        }
                        style={
                          styles.filterItem
                        }
                        onPress={() =>
                          openChildCategory(
                            child,
                          )
                        }
                      >
                        <View
                          style={[
                            styles.filterImageCircle,

                            isSelected &&
                              styles.filterImageCircleSelected,
                          ]}
                        >
                          <CategoryFilterVisual
                            section={
                              child
                            }
                          />

                          {child
                            .children
                            .length >
                            0 && (
                            <View
                              style={
                                styles.hasChildrenBadge
                              }
                            >
                              <Ionicons
                                name="chevron-forward"
                                size={
                                  10
                                }
                                color="#FFFFFF"
                              />
                            </View>
                          )}
                        </View>

                        <Text
                          style={[
                            styles.filterLabel,

                            isSelected &&
                              styles.filterLabelSelected,
                          ]}
                          numberOfLines={
                            2
                          }
                        >
                          {
                            child.name
                          }
                        </Text>
                      </Pressable>
                    );
                  },
                )}


                {/* OFFERS
                 *
                 * In the underlying LTR row, OFFERS is placed immediately
                 * before ALL. Since the rail opens at the right edge, the
                 * visible Arabic order becomes: الكل → العروض → Subcategories.
                 */}

                <Pressable
                  style={
                    styles.filterItem
                  }
                  onPress={() => {
                    setSelectedFilterKey(
                      'offers',
                    );

                    setSearchQuery(
                      '',
                    );
                  }}
                >
                  <View
                    style={[
                      styles.filterImageCircle,

                      selectedFilterKey ===
                        'offers' &&
                        styles.filterImageCircleSelected,
                    ]}
                  >
                    <Image
                      source={
                        OFFERS_CATEGORY_IMAGE
                      }
                      style={
                        styles.filterCategoryImage
                      }
                      resizeMode="cover"
                    />
                  </View>

                  <Text
                    style={[
                      styles.filterLabel,

                      selectedFilterKey ===
                        'offers' &&
                        styles.filterLabelSelected,
                    ]}
                  >
                    العروض
                  </Text>
                </Pressable>


                {/* ALL — rightmost / selected by default */}

                <Pressable
                  style={
                    styles.filterItem
                  }
                  onPress={() => {
                    setSelectedFilterKey(
                      'all',
                    );

                    setSearchQuery(
                      '',
                    );
                  }}
                >
                  <View
                    style={[
                      styles.filterImageCircle,

                      selectedFilterKey ===
                        'all' &&
                        styles.filterImageCircleSelected,
                    ]}
                  >
                    <CategoryFilterVisual
                      section={
                        selectedSection
                      }
                      fallbackKey={
                        categoryKey
                      }
                    />
                  </View>

                  <Text
                    style={[
                      styles.filterLabel,

                      selectedFilterKey ===
                        'all' &&
                        styles.filterLabelSelected,
                    ]}
                    numberOfLines={2}
                  >
                    الكل
                  </Text>
                </Pressable>
              </ScrollView>

              <View
                style={
                  styles.sectionDivider
                }
              />
            </>
          )}

          {/* ===================================================
           * CLOSED
           * ===================================================
           */}

          {isStoreClosed && (
            <View
              style={
                styles.closedBox
              }
            >
              <Text
                style={
                  styles.closedText
                }
              >
                {currentStore.manualClosedNote ??
                  'الصيدلية مغلقة حالياً'}
              </Text>
            </View>
          )}

          {/* ===================================================
           * NORMAL PAGE RESULTS COUNT
           * ===================================================
           */}

          {!isOffersPage &&
            filteredProducts.length >
              0 && (
              <View
                style={
                  styles.productsHeader
                }
              >
                <Text
                  style={
                    styles.productsCount
                  }
                >
                  {
                    filteredProducts.length
                  }{' '}
                  منتج
                </Text>
              </View>
            )}

          {/* ===================================================
           * PRODUCTS
           * ===================================================
           */}

          {filteredProducts.length >
          0 ? (
            <View
              style={[
                styles.productsGrid,

                isOffersPage &&
                  styles.offersProductsGrid,
              ]}
            >
              {filteredProducts.map(
                (product) => (
                  <ProductCard
                    key={
                      product.id
                    }
                    product={
                      product
                    }
                    cardWidth={
                      productCardWidth
                    }
                    currencyCode={
                      currencyCode
                    }
                    quantity={getProductQuantity(
                      product.id,
                    )}
                    isStoreClosed={
                      isStoreClosed
                    }
                    mode={
                      isOffersPage
                        ? 'offers'
                        : 'category'
                    }
                    onAdd={() =>
                      addProduct(
                        product,
                      )
                    }
                    onIncrease={() =>
                      increaseProduct(
                        product,
                      )
                    }
                    onDecrease={() =>
                      decreaseProduct(
                        product.id,
                      )
                    }
                  />
                ),
              )}
            </View>
          ) : (
            <View
              style={
                styles.emptyState
              }
            >
              <Text
                style={
                  styles.emptyStateEmoji
                }
              >
                🛍️
              </Text>

              <Text
                style={
                  styles.emptyStateTitle
                }
              >
                لا توجد منتجات
              </Text>

              <Text
                style={
                  styles.emptyStateDescription
                }
              >
                {getEmptyMessage()}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* =====================================================
         * NORMAL CATEGORY CART
         * =====================================================
         */}

        {shouldShowNormalCartDock && (
          <View
            style={
              styles.cartDock
            }
          >
            <Text
              style={
                styles.cartMessage
              }
              numberOfLines={1}
            >
              {getCartMessage()}
            </Text>

            <View
              style={
                styles.progressTrack
              }
            >
              <View
                style={[
                  styles.progressValue,

                  {
                    width: `${
                      orderProgress *
                      100
                    }%`,
                  },
                ]}
              />
            </View>

            <Pressable
              style={({
                pressed,
              }) => [
                styles.basketButton,

                pressed &&
                  styles.basketButtonPressed,
              ]}
              onPress={
                openCart
              }
            >
              <Text
                style={
                  styles.basketTotal
                }
              >
                {formatMoney(
                  currentStoreSubtotal,
                  currencyCode,
                )}
              </Text>

              <Text
                style={
                  styles.basketButtonTitle
                }
              >
                عرض السلة
              </Text>

              <View
                style={
                  styles.basketCount
                }
              >
                <Text
                  style={
                    styles.basketCountText
                  }
                >
                  {
                    currentStoreItemCount
                  }
                </Text>
              </View>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

/* ============================================================
 * STYLES
 * ============================================================
 */

const styles =
  StyleSheet.create({
    screen: {
      backgroundColor:
        '#FFFFFF',

      flex: 1,
    },

    pageShell: {
      alignSelf:
        'center',

      backgroundColor:
        '#FFFFFF',

      flex: 1,

      maxWidth:
        PAGE_MAX_WIDTH,

      position:
        'relative',

      width: '100%',
    },

    /* ========================================================
     * HEADER
     * ========================================================
     */

    header: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      flexDirection:
        'row',

      justifyContent:
        'space-between',

      minHeight: 68,

      paddingHorizontal:
        18,

      paddingVertical:
        10,
    },

    headerCircleButton: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderColor:
        '#E1E1E1',

      borderRadius: 24,

      borderWidth: 1,

      height: 48,

      justifyContent:
        'center',

      width: 48,
    },

    headerTitleGroup: {
      alignItems:
        'center',

      flex: 1,

      justifyContent:
        'center',

      paddingHorizontal:
        12,
    },

    headerTitle: {
      color:
        '#171717',

      flexShrink: 1,

      fontSize: 20,

      fontWeight:
        '700',

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    pressed: {
      backgroundColor:
        '#F6F6F6',

      transform: [
        {
          scale:
            0.97,
        },
      ],
    },

    /* ========================================================
     * SEARCH
     * ========================================================
     */

    searchInputContainer: {
      alignItems:
        'center',

      backgroundColor:
        '#F6F6F6',

      borderColor:
        '#EAEAEA',

      borderRadius: 23,

      borderWidth: 1,

      flex: 1,

      flexDirection:
        'row',

      gap: 7,

      minHeight: 46,

      paddingHorizontal:
        16,
    },

    searchInput: {
      color:
        '#202020',

      flex: 1,

      fontSize: 14,

      minHeight: 44,

      writingDirection:
        'rtl',
    },

    /* ========================================================
     * OFFERS TEXT TABS
     * ========================================================
     */

    offersTabsContainer: {
      backgroundColor:
        '#FFFFFF',

      borderBottomColor:
        '#E8E8E8',

      borderBottomWidth:
        StyleSheet.hairlineWidth,
    },

    offersTabsScroll: {
      flexGrow: 0,
    },

    offersTabsRail: {
      alignItems:
        'stretch',

      flexDirection:
        'row',

      flexGrow: 1,

      gap: 22,

      justifyContent:
        'flex-end',

      paddingHorizontal:
        18,
    },

    offersTab: {
      alignItems:
        'center',

      justifyContent:
        'center',

      minHeight: 50,

      paddingHorizontal:
        1,

      position:
        'relative',
    },

    offersTabText: {
      color:
        '#777777',

      fontSize: 14,

      fontWeight:
        '400',

      lineHeight: 19,

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    offersTabTextSelected: {
      color:
        '#171717',

      fontWeight:
        '700',
    },

    offersTabUnderline: {
      backgroundColor:
        '#202020',

      bottom: 0,

      height: 2,

      left: 0,

      position:
        'absolute',

      right: 0,
    },

    /* ========================================================
     * SCROLL
     * ========================================================
     */

    scrollView: {
      flex: 1,
    },

    scrollContent: {
      backgroundColor:
        '#FFFFFF',
    },

    /* ========================================================
     * NORMAL CATEGORY FILTERS
     * ========================================================
     */

    filtersScroll: {
      flexGrow: 0,
    },

    filtersRail: {
      /*
       * Avoid row-reverse here. On horizontal ScrollViews it can
       * produce inconsistent initial offsets between iOS/Android and
       * when Expo Router reuses the screen.
       *
       * Items are explicitly arranged in the JSX and we scroll to the
       * right edge when a category opens.
       */
      flexDirection:
        'row',

      flexGrow: 1,

      gap: 17,

      justifyContent:
        'flex-end',

      paddingBottom:
        17,

      paddingHorizontal:
        18,

      paddingTop: 7,
    },

    filterItem: {
      alignItems:
        'center',

      width: 79,
    },

    filterImageCircle: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderColor:
        'transparent',

      borderRadius: 39,

      borderWidth: 2.4,

      height: 78,

      justifyContent:
        'center',

      overflow:
        'hidden',

      position:
        'relative',

      width: 78,
    },

    filterImageCircleSelected: {
      borderColor:
        '#202020',
    },

    filterCategoryImage: {
      height: '100%',

      width: '100%',
    },

    filterImagePlaceholder: {
      backgroundColor:
        '#F3F3F3',

      height: '100%',

      width: '100%',
    },

    filterLabel: {
      color:
        '#666666',

      fontSize: 12.5,

      lineHeight: 17,

      marginTop: 6,

      minHeight: 34,

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    filterLabelSelected: {
      color:
        '#1D1D1D',

      fontWeight:
        '700',
    },

    hasChildrenBadge: {
      alignItems:
        'center',

      backgroundColor:
        '#202020',

      borderColor:
        '#FFFFFF',

      borderRadius: 9,

      borderWidth: 2,

      bottom: 1,

      height: 18,

      justifyContent:
        'center',

      position:
        'absolute',

      right: 0,

      width: 18,
    },

    sectionDivider: {
      backgroundColor:
        '#F0F0F0',

      elevation: 2,

      height: 7,

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: 2,
      },

      shadowOpacity:
        0.04,

      shadowRadius: 3,
    },

    /* ========================================================
     * CLOSED
     * ========================================================
     */

    closedBox: {
      backgroundColor:
        '#222222',

      borderRadius: 8,

      marginHorizontal:
        16,

      marginTop: 14,

      paddingHorizontal:
        14,

      paddingVertical:
        10,
    },

    closedText: {
      color:
        '#FFFFFF',

      fontSize: 12,

      fontWeight:
        '600',

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    /* ========================================================
     * PRODUCTS HEADER
     * ========================================================
     */

    productsHeader: {
      alignItems:
        'flex-end',

      paddingHorizontal:
        16,

      paddingTop: 15,
    },

    productsCount: {
      color:
        '#8A8A8A',

      fontSize: 12,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    /* ========================================================
     * PRODUCT GRID
     * ========================================================
     */

    productsGrid: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap:
        PRODUCT_GAP,

      paddingHorizontal:
        HORIZONTAL_PADDING,

      paddingTop: 11,
    },

    /*
     * أول Product في صفحة العروض
     * يظهر يمين الشاشة مثل الصورة.
     */
    offersProductsGrid: {
      flexDirection:
        'row-reverse',

      paddingTop: 12,
    },

    productCard: {
      backgroundColor:
        '#FFFFFF',

      marginBottom: 16,
    },

    offersProductCard: {
      marginBottom: 13,
    },

    productImageBox: {
      alignItems:
        'center',

      backgroundColor:
        '#F8F8F8',

      borderColor:
        '#E1E1E1',

      borderRadius: 20,

      borderWidth: 1,

      justifyContent:
        'center',

      overflow:
        'visible',

      position:
        'relative',

      width: '100%',
    },

    offersProductImageBox: {
      backgroundColor:
        '#F8F8F8',

      borderColor:
        '#DEDEDE',

      borderRadius: 20,
    },

    productImage: {
      height: '82%',

      width: '82%',
    },

    productFallback: {
      fontSize: 44,
    },

    /* ========================================================
     * DISCOUNT BADGES
     * ========================================================
     */

    discountBadgeBase: {
      alignItems:
        'center',

      borderRadius: 4,

      justifyContent:
        'center',

      minHeight: 22,

      paddingHorizontal:
        7,

      paddingVertical:
        3,

      position:
        'absolute',

      top: 7,

      zIndex: 5,
    },

    categoryDiscountBadge: {
      backgroundColor:
        '#FFF1B7',

      left: 8,
    },

    offersDiscountBadge: {
      backgroundColor:
        '#C7FF00',

      right: 8,
    },

    discountText: {
      color:
        '#8B6813',

      fontSize: 10,

      fontWeight:
        '700',

      lineHeight: 13,
    },

    offersDiscountText: {
      color:
        '#181818',

      fontSize: 11,

      fontWeight:
        '700',
    },

    /* ========================================================
     * PHARMACY RESTRICTIONS
     * ========================================================
     */

    restrictionBadges: {
      gap: 4,

      position:
        'absolute',

      top: 7,

      zIndex: 6,
    },

    restrictionBadgesCategory: {
      alignItems:
        'flex-end',

      right: 8,
    },

    restrictionBadgesOffers: {
      alignItems:
        'flex-start',

      left: 8,
    },

    prescriptionBadge: {
      backgroundColor:
        '#FFF2D9',

      borderRadius: 4,

      paddingHorizontal:
        6,

      paddingVertical:
        3,
    },

    prescriptionBadgeText: {
      color:
        '#8A5D09',

      fontSize: 9,

      fontWeight:
        '800',

      lineHeight: 12,
    },

    ageRestrictionBadge: {
      backgroundColor:
        '#FDE8E8',

      borderRadius: 4,

      paddingHorizontal:
        6,

      paddingVertical:
        3,
    },

    ageRestrictionBadgeText: {
      color:
        '#A13B3B',

      fontSize: 9,

      fontWeight:
        '800',

      lineHeight: 12,
    },

    /* ========================================================
     * ADD BUTTON
     * ========================================================
     */

    addButton: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderColor:
        '#E1E1E1',

      borderRadius: 21,

      borderWidth: 1,

      bottom: 8,

      elevation: 3,

      height: 42,

      justifyContent:
        'center',

      position:
        'absolute',

      right: 8,

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 42,
        height: 2,
      },

      shadowOpacity:
        0.08,

      shadowRadius: 5,

      width: 50,

      zIndex: 7,
    },

    offersAddButton: {
      borderRadius: 20,

      bottom: 8,

      height: 40,

      right: 8,

      width: 40,
    },

    addButtonPressed: {
      backgroundColor:
        '#F7F7F7',

      transform: [
        {
          scale: 0.95,
        },
      ],
    },

    disabledButton: {
      opacity: 0.45,
    },

    addButtonText: {
      color:
        '#F05A00',

      fontSize: 31,

      fontWeight:
        '300',

      lineHeight: 33,

      marginTop: -3,
    },

    offersAddButtonText: {
      fontSize: 29,

      lineHeight: 31,
    },

    /* ========================================================
     * QUANTITY
     * ========================================================
     */

    quantityPill: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderColor:
        '#E1E1E1',

      borderRadius: 21,

      borderWidth: 1,

      bottom: 8,

      elevation: 3,

      flexDirection:
        'row',

      height: 42,

      position:
        'absolute',

      right: 8,

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: 2,
      },

      shadowOpacity:
        0.08,

      shadowRadius: 5,

      zIndex: 7,
    },

    offersQuantityPill: {
      borderRadius: 20,

      height: 40,
    },

    quantityAction: {
      alignItems:
        'center',

      height: 40,

      justifyContent:
        'center',

      width: 28,
    },

    quantityActionText: {
      color:
        '#F05A00',

      fontSize: 19,

      fontWeight:
        '500',
    },

    quantityText: {
      color:
        '#202020',

      fontSize: 12,

      fontWeight:
        '700',

      minWidth: 16,

      textAlign:
        'center',
    },

    /* ========================================================
     * PRODUCT TEXT
     * ========================================================
     */

    productName: {
      color:
        '#202020',

      fontSize: 14,

      fontWeight:
        '500',

      lineHeight: 19,

      marginTop: 8,

      minHeight: 38,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    offersProductName: {
      fontSize: 13.5,

      fontWeight:
        '500',

      lineHeight: 18,

      marginTop: 8,

      minHeight: 36,
    },

    productUnitLabel: {
      color:
        '#999999',

      fontSize: 11.5,

      marginTop: 2,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    offersProductUnitLabel: {
      color:
        '#969696',

      fontSize: 11.5,

      minHeight: 15,
    },

    /* ========================================================
     * NORMAL PRICE
     * ========================================================
     */

    priceColumn: {
      alignItems:
        'flex-end',

      marginTop: 7,
    },

    currentPrice: {
      color:
        '#202020',

      fontSize: 14,

      fontWeight:
        '600',

      textAlign:
        'right',
    },

    oldPrice: {
      color:
        '#969696',

      fontSize: 11.5,

      marginTop: 3,

      textDecorationLine:
        'line-through',
    },

    /* ========================================================
     * OFFERS PRICE — SAME LOOK AS SCREENSHOT
     * ========================================================
     */

    offersPriceRow: {
      alignItems:
        'center',

      flexDirection:
        'row-reverse',

      flexWrap:
        'wrap',

      gap: 5,

      justifyContent:
        'flex-start',

      marginTop: 6,

      minHeight: 20,
    },

    offersCurrentPriceUnderline: {
      borderBottomColor:
        '#C7FF00',

      borderBottomWidth: 2,

      paddingBottom: 0,
    },

    offersCurrentPrice: {
      color:
        '#181818',

      fontSize: 14,

      fontWeight:
        '700',

      lineHeight: 18,

      writingDirection:
        'rtl',
    },

    offersOldPrice: {
      color:
        '#8D8D8D',

      fontSize: 11.5,

      fontWeight:
        '400',

      lineHeight: 18,

      textDecorationLine:
        'line-through',

      writingDirection:
        'rtl',
    },

    /* ========================================================
     * EMPTY
     * ========================================================
     */

    emptyState: {
      alignItems:
        'center',

      paddingHorizontal:
        30,

      paddingTop: 70,
    },

    emptyStateEmoji: {
      fontSize: 40,
    },

    emptyStateTitle: {
      color:
        '#202020',

      fontSize: 17,

      fontWeight:
        '700',

      marginTop: 15,
    },

    emptyStateDescription: {
      color:
        '#777777',

      fontSize: 13,

      lineHeight: 20,

      marginTop: 7,

      maxWidth: 300,

      textAlign:
        'center',
    },

    /* ========================================================
     * NORMAL CART DOCK
     * ========================================================
     */

    cartDock: {
      backgroundColor:
        '#FFFFFF',

      borderTopColor:
        '#EEEEEE',

      borderTopWidth:
        StyleSheet.hairlineWidth,

      bottom: 0,

      elevation: 12,

      left: 0,

      paddingBottom: 12,

      paddingHorizontal:
        16,

      paddingTop: 11,

      position:
        'absolute',

      right: 0,

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: -2,
      },

      shadowOpacity:
        0.08,

      shadowRadius: 8,
    },

    cartMessage: {
      color:
        '#242424',

      fontSize: 12.5,

      fontWeight:
        '500',

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    progressTrack: {
      backgroundColor:
        '#E7E7E7',

      borderRadius: 4,

      height: 4,

      marginTop: 10,

      overflow:
        'hidden',
    },

    progressValue: {
      backgroundColor:
        '#202020',

      borderRadius: 4,

      height: 4,
    },

    basketButton: {
      alignItems:
        'center',

      backgroundColor:
        '#F45A00',

      borderRadius: 28,

      flexDirection:
        'row',

      height: 56,

      justifyContent:
        'space-between',

      marginTop: 11,

      paddingHorizontal:
        18,
    },

    basketButtonPressed: {
      opacity: 0.9,

      transform: [
        {
          scale:
            0.985,
        },
      ],
    },

    basketTotal: {
      color:
        '#FFFFFF',

      fontSize: 14,

      fontWeight:
        '700',

      minWidth: 78,
    },

    basketButtonTitle: {
      color:
        '#FFFFFF',

      fontSize: 17,

      fontWeight:
        '700',
    },

    basketCount: {
      alignItems:
        'center',

      backgroundColor:
        'rgba(0,0,0,0.12)',

      borderRadius: 21,

      height: 42,

      justifyContent:
        'center',

      width: 42,
    },

    basketCountText: {
      color:
        '#FFFFFF',

      fontSize: 15,

      fontWeight:
        '700',
    },

    /* ========================================================
     * STATE
     * ========================================================
     */

    stateScreen: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      flex: 1,

      justifyContent:
        'center',

      paddingHorizontal:
        28,
    },

    stateEmoji: {
      fontSize: 40,
    },

    stateTitle: {
      color:
        '#202020',

      fontSize: 18,

      fontWeight:
        '800',

      marginTop: 14,

      textAlign:
        'center',
    },

    stateDescription: {
      color:
        '#777777',

      fontSize: 13,

      lineHeight: 20,

      marginTop: 8,

      maxWidth: 330,

      textAlign:
        'center',
    },

    retryButton: {
      backgroundColor:
        '#222222',

      borderRadius: 14,

      marginTop: 20,

      minWidth: 160,

      paddingHorizontal:
        20,

      paddingVertical:
        13,
    },

    retryButtonText: {
      color:
        '#FFFFFF',

      fontSize: 13,

      fontWeight:
        '700',

      textAlign:
        'center',
    },

    backErrorButton: {
      borderColor:
        '#E0E0E0',

      borderRadius: 14,

      borderWidth: 1,

      marginTop: 10,

      minWidth: 160,

      paddingHorizontal:
        20,

      paddingVertical:
        12,
    },

    backErrorButtonText: {
      color:
        '#222222',

      fontSize: 13,

      fontWeight:
        '600',

      textAlign:
        'center',
    },
  });
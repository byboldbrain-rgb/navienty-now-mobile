import { Ionicons } from '@expo/vector-icons';
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useEffect,
  useMemo,
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

import {
  useCartStore,
} from '../../store/cart-store';
import { useCustomerStore } from '../../store/customer-store';

/* ============================================================
 * TYPES
 * ============================================================
 */

type ProductFilterKey =
  | 'all'
  | 'offers'
  | string;

/* ============================================================
 * LOCAL CATEGORY IMAGES
 *
 * دي الصور الرئيسية الموجودة عندك بالفعل.
 * الـSubcategories تقدر تضيف لها image_url
 * من Database بعدين.
 * ============================================================
 */

const CATEGORY_IMAGES: Record<
  string,
  ImageSourcePropType
> = {
  'fruit-veg': require('../../../assets/images/supermarket-categories/fruit-veg.png'),

  bakery: require('../../../assets/images/supermarket-categories/bakery.png'),

  'poultry-meat-seafood': require('../../../assets/images/supermarket-categories/poultry-meat-seafood.png'),

  'coffee-tea': require('../../../assets/images/supermarket-categories/coffee-tea.png'),

  'cooking-baking': require('../../../assets/images/supermarket-categories/cooking-baking.png'),

  'fresh-food': require('../../../assets/images/supermarket-categories/fresh-food.png'),

  'ready-to-eat': require('../../../assets/images/supermarket-categories/ready-to-eat.png'),

  'frozen-food': require('../../../assets/images/supermarket-categories/frozen-food.png'),

  'dairy-eggs': require('../../../assets/images/supermarket-categories/dairy-eggs.png'),

  'breakfast-food': require('../../../assets/images/supermarket-categories/breakfast-food.png'),

  'canned-jarred': require('../../../assets/images/supermarket-categories/canned-jarred.png'),

  'household-essentials': require('../../../assets/images/supermarket-categories/household-essentials.png'),

  beverages: require('../../../assets/images/supermarket-categories/beverages.png'),

  'snacks-chocolate': require('../../../assets/images/supermarket-categories/snacks-chocolate.png'),

  condiments: require('../../../assets/images/supermarket-categories/condiments.png'),
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

function formatMoney(
  value: number,
  currencyCode: string,
) {
  const currencyLabel =
    currencyCode === 'EGP'
      ? 'ج.م'
      : currencyCode;

  return `${value.toFixed(
    2,
  )} ${currencyLabel}`;
}

/**
 * Temporary visual fallback
 * للـSubcategories اللي لسه معندهاش image_url.
 *
 * لما تضيف image_url في Supabase
 * الصورة الحقيقية هتظهر بدل Emoji تلقائيًا.
 */
function getCategoryFallbackIcon(
  slug: string,
) {
  const icons: Record<
    string,
    string
  > = {
    milk: '🥛',
    'fresh-milk': '🥛',
    'long-life-milk': '🥛',
    'powdered-milk': '🥛',
    'flavored-milk': '🥛',

    cheese: '🧀',
    'white-cheese': '🧀',
    'processed-cheese': '🧀',
    'spreadable-cheese': '🧀',
    'cheddar-cheese': '🧀',

    yogurt: '🥣',
    'plain-yogurt': '🥣',
    'flavored-yogurt': '🥣',
    'greek-yogurt': '🥣',

    eggs: '🥚',
    'butter-cream': '🧈',

    'fresh-fruit': '🍎',
    'fresh-vegetables': '🥬',
    herbs: '🌿',

    bread: '🍞',
    pastries: '🥐',
    cakes: '🍰',
    'wraps-flatbread': '🫓',

    poultry: '🍗',
    beef: '🥩',
    lamb: '🥩',
    seafood: '🐟',

    coffee: '☕',
    tea: '🫖',
    'hot-chocolate': '☕',

    'rice-pasta': '🍚',
    'flour-baking': '🌾',
    'oil-ghee': '🫗',
    'sugar-sweeteners': '🧂',

    'cold-cuts': '🥩',
    'deli-cheese': '🧀',
    'olives-pickles': '🫒',

    'ready-meals': '🍱',
    sandwiches: '🥪',
    salads: '🥗',

    'frozen-vegetables': '🥦',
    'frozen-meat-poultry': '🍗',
    'frozen-seafood': '🐟',
    'frozen-pastry': '🥐',

    cereals: '🥣',
    'oats-granola': '🥣',
    spreads: '🍫',
    'honey-jam': '🍯',

    'canned-vegetables': '🥫',
    'canned-beans': '🥫',
    'canned-fish': '🥫',
    'jarred-pickles': '🥒',

    'cleaning-laundry': '🧴',
    'paper-plastic': '🧻',
    dishwashing: '🧽',
    'home-care': '🧹',

    water: '💧',
    'soft-drinks': '🥤',
    juices: '🧃',
    'energy-drinks': '🥤',

    chips: '🍟',
    biscuits: '🍪',
    chocolate: '🍫',
    nuts: '🥜',

    'spices-seasonings': '🌶️',
    'table-sauces': '🥫',
    'ketchup-mayo-mustard': '🥫',
    'cooking-sauces': '🥫',
  };

  return icons[slug] ?? '🛒';
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
  const localImage =
    CATEGORY_IMAGES[section.slug] ??
    (fallbackKey
      ? CATEGORY_IMAGES[
          fallbackKey
        ]
      : undefined);

  if (section.imageUrl) {
    return (
      <Image
        source={{
          uri: section.imageUrl,
        }}
        style={
          styles.filterCategoryImage
        }
        resizeMode="contain"
      />
    );
  }

  if (localImage) {
    return (
      <Image
        source={localImage}
        style={
          styles.filterCategoryImage
        }
        resizeMode="contain"
      />
    );
  }

  return (
    <Text
      style={
        styles.filterFallbackEmoji
      }
    >
      {getCategoryFallbackIcon(
        section.slug,
      )}
    </Text>
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
  onAdd,
  onIncrease,
  onDecrease,
}: ProductCardProps) {
  const imageUrl =
    getProductImage(product);

  const discount =
    getDiscountPercent(product);

  return (
    <View
      style={[
        styles.productCard,
        {
          width: cardWidth,
        },
      ]}
    >
      <View
        style={[
          styles.productImageBox,
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
            {product.icon || '🛒'}
          </Text>
        )}

        {discount !== null && (
          <View
            style={
              styles.discountBadge
            }
          >
            <Text
              style={
                styles.discountText
              }
            >
              خصم {discount}%
            </Text>
          </View>
        )}

        {quantity === 0 ? (
          <Pressable
            disabled={isStoreClosed}
            onPress={onAdd}
            style={({ pressed }) => [
              styles.addButton,

              isStoreClosed &&
                styles.disabledButton,

              pressed &&
                !isStoreClosed &&
                styles.addButtonPressed,
            ]}
          >
            <Text
              style={
                styles.addButtonText
              }
            >
              +
            </Text>
          </Pressable>
        ) : (
          <View
            style={
              styles.quantityPill
            }
          >
            <Pressable
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
              disabled={
                isStoreClosed
              }
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
        style={styles.productName}
        numberOfLines={3}
      >
        {product.name}
      </Text>

      {product.unitLabelAr ? (
        <Text
          style={
            styles.productUnitLabel
          }
          numberOfLines={1}
        >
          {product.unitLabelAr}
        </Text>
      ) : null}

      <View
        style={styles.priceRow}
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

        {product.compareAtPrice !==
          null &&
          product.compareAtPrice >
            product.price && (
            <Text
              style={
                styles.oldPrice
              }
            >
              {formatMoney(
                product.compareAtPrice,
                currencyCode,
              )}
            </Text>
          )}
      </View>
    </View>
  );
}

/* ============================================================
 * SCREEN
 * ============================================================
 */

export default function SupermarketCategoryScreen() {
  const router = useRouter();

  const savedServiceAreaId =
    useCustomerStore(
      (state) =>
        state.locationServiceAreaId,
    );

  const {
    width: windowWidth,
  } = useWindowDimensions();

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
   *
   * كل متجر له Cart مستقلة داخل state.carts.
   * ==========================================================
   */

  const carts =
    useCartStore(
      (state) =>
        state.carts,
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
   * LOAD CATEGORY
   * ==========================================================
   */

  async function loadCategory() {
    try {
      setIsLoading(true);

      setErrorMessage(
        null,
      );

      const bootstrap =
        await getAppBootstrap();

      const serviceAreaId =
        savedServiceAreaId ??
        bootstrap.settings
          .default_service_area_id ??
        undefined;

      let storeId =
        requestedStoreId;

      /*
       * لو Store ID مش موجود في Route،
       * نجيب السوبر ماركت تلقائيًا.
       */
      if (!storeId) {
        const supermarkets =
          await listStores({
            categorySlug:
              'supermarket',

            serviceAreaId,
          });

        if (
          supermarkets.length ===
          0
        ) {
          throw new Error(
            'لا يوجد سوبر ماركت متاح حاليًا.',
          );
        }

        const supermarket =
          supermarkets.find(
            (store) =>
              store.isFeatured &&
              !store.isManuallyClosed,
          ) ??
          supermarkets.find(
            (store) =>
              !store.isManuallyClosed,
          ) ??
          supermarkets[0];

        storeId =
          supermarket.id;
      }

      const loadedCatalog =
        await getStoreCatalog(
          storeId,
          serviceAreaId,
        );

      /*
       * البحث عن Category
       * في الشجرة الجديدة بالـSlug.
       */
      const section =
        findCatalogSectionBySlug(
          loadedCatalog,
          sectionSlug,
        );

      if (!section) {
        throw new Error(
          'لم يتم العثور على فئة السوبر ماركت المطلوبة.',
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

      /*
       * كل مرة نفتح Category جديدة:
       *
       * نبدأ من "الكل".
       */
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
    void loadCategory();
  }, [
    requestedStoreId,
    sectionSlug,
  ]);

  /* ==========================================================
   * CHILD CATEGORIES
   * ==========================================================
   */

  const childCategories =
    useMemo(() => {
      if (
        !selectedSection
      ) {
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

  /* ==========================================================
   * PRODUCTS
   *
   * All:
   * Category + all descendants
   *
   * Offers:
   * Offers inside Category + descendants
   *
   * Child selected:
   * Products in that child + descendants
   * ==========================================================
   */

  const filteredProducts =
    useMemo(() => {
      if (
        !selectedSection
      ) {
        return [];
      }

      let products:
        CatalogProduct[] = [];

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

        if (
          selectedChild
        ) {
          products =
            getCatalogSectionProducts(
              selectedChild,
              true,
            );
        }
      }

      /*
       * Search داخل النتائج الحالية.
       */
      const normalizedQuery =
        normalizeSearchText(
          searchQuery,
        );

      if (
        normalizedQuery
      ) {
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
       * منع أي Duplicate.
       */
      const uniqueProducts =
        new Map<
          string,
          CatalogProduct
        >();

      for (
        const product of products
      ) {
        uniqueProducts.set(
          product.id,
          product,
        );
      }

      return Array.from(
        uniqueProducts.values(),
      );
    }, [
      selectedFilterKey,
      searchQuery,
      selectedSection,
      childCategories,
    ]);

  /* ==========================================================
   * LOADING
   * ==========================================================
   */

  if (isLoading) {
    return <ProductGridScreenSkeleton />;
  }

  /* ==========================================================
   * ERROR
   * ==========================================================
   */

  if (
    !catalog ||
    !selectedSection ||
    errorMessage
  ) {
    return (
      <SafeAreaView
        style={
          styles.stateScreen
        }
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
      560,
    );

  const horizontalPadding =
    16;

  const cardGap =
    10;

  const productCardWidth =
    (pageWidth -
      horizontalPadding *
        2 -
      cardGap) /
    2;

  const categoryKey =
    passedCategoryKey ??
    selectedSection.slug;

  /*
   * دايمًا نستخدم اسم Category الحالية.
   *
   * passedLabel fallback فقط.
   */
  const pageTitle =
    selectedSection.name ||
    passedLabel ||
    '';

  /* ==========================================================
   * NAVIGATION
   * ==========================================================
   */

  function openChildCategory(
    child: CatalogSection,
  ) {
    /*
     * لو الـChild عندها Children أخرى:
     *
     * مثال:
     *
     * Dairy & Eggs
     *   ↓
     * Milk
     *   ↓
     * Fresh Milk
     *
     * نفتح Milk كصفحة جديدة.
     */
    if (
      child.children.length >
      0
    ) {
      router.push({
        pathname:
          '/supermarket-category/[slug]',

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

    /*
     * لو Child آخر مستوى:
     * نستخدمها Filter.
     */
    setSelectedFilterKey(
      child.id,
    );

    setSearchQuery('');
  }

  /* ==========================================================
   * CART FUNCTIONS
   * ==========================================================
   */

  function addProduct(
    product: CatalogProduct,
  ) {
    if (
      isStoreClosed
    ) {
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
      },
    );
  }

  function increaseProduct(
    product: CatalogProduct,
  ) {
    if (
      isStoreClosed
    ) {
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

    if (
      itemExists
    ) {
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

  /* ==========================================================
   * EMPTY MESSAGE
   * ==========================================================
   */

  function getEmptyMessage() {
    if (
      searchQuery.trim()
    ) {
      return 'لم نجد منتجاً مطابقاً لبحثك.';
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
        {/* ===================================================
         * HEADER
         * ===================================================
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
                size={22}
                color="#222222"
              />

              <TextInput
                autoFocus

                value={
                  searchQuery
                }

                onChangeText={
                  setSearchQuery
                }

                placeholder="ابحث في الفئة"

                placeholderTextColor="#999999"

                style={
                  styles.searchInput
                }

                textAlign="right"
              />

              <Pressable
                hitSlop={12}
                onPress={() => {
                  setSearchQuery(
                    '',
                  );

                  setIsSearchVisible(
                    false,
                  );
                }}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color="#222222"
                />
              </Pressable>
            </View>
          ) : (
            <>
              {/* SEARCH */}

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
                  size={27}
                  color="#202020"
                />
              </Pressable>

              {/* TITLE + BACK */}

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
                    name="arrow-forward"
                    size={29}
                    color="#202020"
                  />
                </Pressable>
              </View>
            </>
          )}
        </View>

        {/* ===================================================
         * CONTENT
         * ===================================================
         */}

        <ScrollView
          style={
            styles.scrollView
          }
          contentContainerStyle={[
            styles.scrollContent,

            {
              paddingBottom:
                currentStoreItemCount >
                0
                  ? 165
                  : 35,
            },
          ]}
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
        >
          {/* =================================================
           * CATEGORY FILTERS
           * =================================================
           */}

          <ScrollView
            horizontal

            showsHorizontalScrollIndicator={
              false
            }

            contentContainerStyle={
              styles.filtersRail
            }

            style={
              styles.filtersScroll
            }
          >
            {/* ===============================================
             * ALL
             * ===============================================
             */}

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

            {/* ===============================================
             * OFFERS
             * ===============================================
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

                  styles.offerCircle,

                  selectedFilterKey ===
                    'offers' &&
                    styles.filterImageCircleSelected,
                ]}
              >
                <Text
                  style={
                    styles.offerPercent
                  }
                >
                  %
                </Text>
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

            {/* ===============================================
             * CHILD CATEGORIES
             * ===============================================
             */}

            {childCategories.map(
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

                      {child.children
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
                              13
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
                      numberOfLines={2}
                    >
                      {
                        child.name
                      }
                    </Text>
                  </Pressable>
                );
              },
            )}
          </ScrollView>

          <View
            style={
              styles.sectionDivider
            }
          />

          {/* =================================================
           * CLOSED
           * =================================================
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
                  'السوبر ماركت مغلق حالياً'}
              </Text>
            </View>
          )}

          {/* =================================================
           * RESULTS COUNT
           * =================================================
           */}

          {filteredProducts.length >
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

          {/* =================================================
           * PRODUCTS
           * =================================================
           */}

          {filteredProducts.length >
          0 ? (
            <View
              style={
                styles.productsGrid
              }
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

        {/* ===================================================
         * CART
         * ===================================================
         */}

        {currentStoreItemCount >
          0 && (
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

      maxWidth: 560,

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

      minHeight: 82,

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

      borderRadius: 30,

      borderWidth: 1,

      height: 60,

      justifyContent:
        'center',

      width: 60,
    },

    headerTitleGroup: {
      alignItems:
        'center',

      flexDirection:
        'row',

      gap: 13,

      maxWidth: '74%',
    },

    headerTitle: {
      color:
        '#171717',

      flexShrink: 1,

      fontSize: 24,

      fontWeight:
        '700',

      textAlign:
        'right',

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

      borderRadius: 27,

      borderWidth: 1,

      flex: 1,

      flexDirection:
        'row',

      gap: 8,

      minHeight: 54,

      paddingHorizontal:
        16,
    },

    searchInput: {
      color:
        '#202020',

      flex: 1,

      fontSize: 16,

      minHeight: 50,

      writingDirection:
        'rtl',
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
     * FILTERS
     * ========================================================
     */

    filtersScroll: {
      flexGrow: 0,
    },

    filtersRail: {
      flexDirection:
        'row-reverse',

      gap: 17,

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
      height: '86%',

      width: '86%',
    },

    filterFallbackEmoji: {
      fontSize: 37,
    },

    filterLabel: {
      color:
        '#666666',

      fontSize: 14.5,

      lineHeight: 19,

      marginTop: 7,

      minHeight: 38,

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

    /* ========================================================
     * OFFERS
     * ========================================================
     */

    offerCircle: {
      backgroundColor:
        '#FFF8EF',
    },

    offerPercent: {
      color:
        '#E96A16',

      fontSize: 46,

      fontWeight:
        '800',
    },

    hasChildrenBadge: {
      alignItems:
        'center',

      backgroundColor:
        '#202020',

      borderColor:
        '#FFFFFF',

      borderRadius: 11,

      borderWidth: 2,

      bottom: 1,

      height: 22,

      justifyContent:
        'center',

      position:
        'absolute',

      right: 0,

      width: 22,
    },

    /* ========================================================
     * DIVIDER
     * ========================================================
     */

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
     * CLOSED STORE
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

      fontSize: 13,

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

      fontSize: 13,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    /* ========================================================
     * PRODUCTS GRID
     * ========================================================
     */

    productsGrid: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap: 10,

      paddingHorizontal:
        16,

      paddingTop: 11,
    },

    productCard: {
      backgroundColor:
        '#FFFFFF',

      marginBottom: 16,
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

    productImage: {
      height: '82%',

      width: '82%',
    },

    productFallback: {
      fontSize: 54,
    },

    /* ========================================================
     * DISCOUNT
     * ========================================================
     */

    discountBadge: {
      backgroundColor:
        '#FFF1B7',

      borderRadius: 5,

      left: 8,

      paddingHorizontal:
        7,

      paddingVertical:
        4,

      position:
        'absolute',

      top: 8,

      zIndex: 3,
    },

    discountText: {
      color:
        '#8B6813',

      fontSize: 11,

      fontWeight:
        '700',
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

      borderRadius: 25,

      borderWidth: 1,

      bottom: 10,

      elevation: 3,

      height: 50,

      justifyContent:
        'center',

      position:
        'absolute',

      right: 10,

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: 2,
      },

      shadowOpacity:
        0.08,

      shadowRadius: 5,

      width: 50,
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

      fontSize: 40,

      fontWeight:
        '300',

      lineHeight: 42,

      marginTop: -4,
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

      borderRadius: 25,

      borderWidth: 1,

      bottom: 10,

      elevation: 3,

      flexDirection:
        'row',

      height: 50,

      position:
        'absolute',

      right: 10,

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: 2,
      },

      shadowOpacity:
        0.08,

      shadowRadius: 5,
    },

    quantityAction: {
      alignItems:
        'center',

      height: 48,

      justifyContent:
        'center',

      width: 35,
    },

    quantityActionText: {
      color:
        '#F05A00',

      fontSize: 24,

      fontWeight:
        '500',
    },

    quantityText: {
      color:
        '#202020',

      fontSize: 14,

      fontWeight:
        '700',

      minWidth: 18,

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

      fontSize: 16,

      fontWeight:
        '500',

      lineHeight: 22,

      marginTop: 9,

      minHeight: 44,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    productUnitLabel: {
      color:
        '#999999',

      fontSize: 13,

      marginTop: 2,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    priceRow: {
      alignItems:
        'flex-end',

      marginTop: 7,
    },

    currentPrice: {
      color:
        '#202020',

      fontSize: 16,

      fontWeight:
        '600',

      textAlign:
        'right',
    },

    oldPrice: {
      color:
        '#969696',

      fontSize: 13,

      marginTop: 3,

      textDecorationLine:
        'line-through',
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
      fontSize: 48,
    },

    emptyStateTitle: {
      color:
        '#202020',

      fontSize: 19,

      fontWeight:
        '700',

      marginTop: 15,
    },

    emptyStateDescription: {
      color:
        '#777777',

      fontSize: 14,

      lineHeight: 22,

      marginTop: 7,

      maxWidth: 300,

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    /* ========================================================
     * CART DOCK
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

      fontSize: 14,

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

      borderRadius: 32,

      flexDirection:
        'row',

      height: 64,

      justifyContent:
        'space-between',

      marginTop: 13,

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

      fontSize: 17,

      fontWeight:
        '700',

      minWidth: 90,
    },

    basketButtonTitle: {
      color:
        '#FFFFFF',

      fontSize: 21,

      fontWeight:
        '700',
    },

    basketCount: {
      alignItems:
        'center',

      backgroundColor:
        'rgba(0,0,0,0.12)',

      borderRadius: 25,

      height: 50,

      justifyContent:
        'center',

      width: 50,
    },

    basketCountText: {
      color:
        '#FFFFFF',

      fontSize: 18,

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
      fontSize: 48,
    },

    stateTitle: {
      color:
        '#202020',

      fontSize: 21,

      fontWeight:
        '800',

      marginTop: 14,

      textAlign:
        'center',
    },

    stateDescription: {
      color:
        '#777777',

      fontSize: 14,

      lineHeight: 21,

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

      fontSize: 14,

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

      fontSize: 14,

      fontWeight:
        '600',

      textAlign:
        'center',
    },
  });
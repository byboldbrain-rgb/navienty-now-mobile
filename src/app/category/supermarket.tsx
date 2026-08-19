import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Image,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CatalogHomeScreenSkeleton } from '../../components/ui/loading-skeleton';
import getAppBootstrap from '../../services/bootstrap-service';
import {
  type CatalogProduct,
  type CatalogSection,
  getStoreCatalog,
  listStores,
  type StoreCatalog,
} from '../../services/catalog-service';
import {
  listSupermarketPromotionBanners,
  type SupermarketPromotionBanner,
} from '../../services/supermarket-banner-service';
import { useCartStore } from '../../store/cart-store';
import { useCustomerStore } from '../../store/customer-store';
import { NAVIENTY_NOW_COLORS } from '../../theme/navienty-now-theme';

const CATEGORY_ROWS = 3;
const CATEGORY_INDICATOR_TRACK_WIDTH = 84;
const CATEGORY_INDICATOR_THUMB_WIDTH = 30;

type SupermarketCategoryDefinition = {
  key: string;
  label: string;
  aliases: string[];
  imageSource: ImageSourcePropType;
  isOffers?: boolean;
};

type CategoryDisplayItem = {
  key: string;
  label: string;
  imageSource: ImageSourcePropType;
  section: CatalogSection | null;
  isOffers: boolean;
};

type ResolvedPromotionBanner =
  SupermarketPromotionBanner & {
    products: CatalogProduct[];
  };

type FeaturedProductCardProps = {
  product: CatalogProduct;
  currencyCode: string;
  cardWidth: number;
  quantity: number;
  isStoreClosed: boolean;
  onAdd: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
};

const SUPERMARKET_CATEGORIES: SupermarketCategoryDefinition[] = [
  {
    key: 'offers',
    label: 'عروض',
    aliases: [
      'offers',
      'offer',
      'deals',
      'deal',
      'discounts',
      'discount',
      'promotions',
      'promotion',
      'sale',
      'sales',
      'special-offers',
      'special-offer',
      'special-deals',
      'special-deal',
      'discounted-products',
      'discounted',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/offers.png'),
    isOffers: true,
  },
  {
    key: 'fruit-veg',
    label: 'الفواكه والخضروات',
    aliases: [
      'fruit-veg',
      'fruit-and-veg',
      'fruits-vegetables',
      'fruits-and-vegetables',
      'fruit-vegetables',
      'fruit-and-vegetables',
      'fruits-veg',
      'fresh-fruit-vegetables',
      'fresh-fruits-vegetables',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/fruit-veg.png'),
  },
  {
    key: 'bakery',
    label: 'المخبوزات',
    aliases: [
      'bakery',
      'bread-bakery',
      'bread-and-bakery',
      'baked-goods',
      'breads',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/bakery.png'),
  },
  {
    key: 'poultry-meat-seafood',
    label: 'دواجن ولحوم ومأكولات بحرية',
    aliases: [
      'poultry-meat-seafood',
      'poultry-meat-and-seafood',
      'poultry-and-meat-and-seafood',
      'meat-seafood',
      'meat-and-seafood',
      'poultry-meat',
      'meat-poultry-seafood',
      'meat-poultry-and-seafood',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/poultry-meat-seafood.png'),
  },
  {
    key: 'coffee-tea',
    label: 'القهوة والشاي',
    aliases: [
      'coffee-tea',
      'coffee-and-tea',
      'tea-coffee',
      'tea-and-coffee',
      'coffee',
      'tea',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/coffee-tea.png'),
  },
  {
    key: 'cooking-baking',
    label: 'الطهي والخبز',
    aliases: [
      'cooking-baking',
      'cooking-and-baking',
      'cooking',
      'baking',
      'cooking-essentials',
      'baking-essentials',
      'cooking-and-baking-essentials',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/cooking-baking.png'),
  },
  {
    key: 'fresh-food',
    label: 'أطعمة طازجة',
    aliases: [
      'fresh-food',
      'fresh-foods',
      'fresh',
      'fresh-products',
      'fresh-groceries',
      'fresh-grocery',
      'fresh-counter',
      'fresh-deli',
      'cold-cuts-deli',
      'cold-cuts-and-deli',
      'deli',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/fresh-food.png'),
  },
  {
    key: 'ready-to-eat',
    label: 'جاهز للأكل',
    aliases: [
      'ready-to-eat',
      'ready-to-eat-food',
      'ready-to-eat-foods',
      'ready-meals',
      'ready-meal',
      'prepared-food',
      'prepared-foods',
      'prepared-meals',
      'prepared-meal',
      'ready-food',
      'ready-foods',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/ready-to-eat.png'),
  },
  {
    key: 'frozen-food',
    label: 'الأطعمة المجمدة',
    aliases: [
      'frozen-food',
      'frozen-foods',
      'frozen',
      'frozen-products',
      'frozen-groceries',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/frozen-food.png'),
  },
  {
    key: 'dairy-eggs',
    label: 'الألبان والبيض',
    aliases: [
      'dairy-eggs',
      'dairy-and-eggs',
      'dairy',
      'milk-eggs',
      'milk-and-eggs',
      'dairy-products',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/dairy-eggs.png'),
  },
  {
    key: 'breakfast-food',
    label: 'طعام الافطار',
    aliases: [
      'breakfast-food',
      'breakfast-foods',
      'breakfast',
      'breakfast-products',
      'breakfast-essentials',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/breakfast-food.png'),
  },
  {
    key: 'canned-jarred',
    label: 'معلبات',
    aliases: [
      'canned-jarred',
      'canned-and-jarred',
      'canned-food',
      'canned-foods',
      'canned',
      'cans-jars',
      'cans-and-jars',
      'jarred-food',
      'jarred-foods',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/canned-jarred.png'),
  },
  {
    key: 'household-essentials',
    label: 'مستلزمات منزلية',
    aliases: [
      'household-essentials',
      'household',
      'home-essentials',
      'home-supplies',
      'household-supplies',
      'household-products',
      'paper-plastic',
      'paper-and-plastic',
      'paper-products',
      'cleaning-laundry',
      'cleaning-and-laundry',
      'cleaning',
      'laundry',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/household-essentials.png'),
  },
  {
    key: 'beverages',
    label: 'المشروبات',
    aliases: [
      'beverages',
      'beverage',
      'drinks',
      'soft-drinks',
      'cold-drinks',
      'juices',
      'juice',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/beverages.png'),
  },
  {
    key: 'snacks-chocolate',
    label: 'شيكولاتة وسناكس',
    aliases: [
      'snacks-chocolate',
      'snacks-and-chocolate',
      'snacks-chocolates',
      'snacks-and-chocolates',
      'snacks',
      'chocolate',
      'chocolates',
      'chocolate-snacks',
      'chocolate-and-snacks',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/snacks-chocolate.png'),
  },
  {
    key: 'condiments',
    label: 'التوابل',
    aliases: [
      'condiments',
      'spices',
      'spice',
      'seasoning',
      'seasonings',
      'spices-seasonings',
      'spices-and-seasonings',
      'herbs-spices',
      'herbs-and-spices',
      'sauces',
      'sauces-condiments',
      'sauces-and-condiments',
    ],
    imageSource: require('../../../assets/images/supermarket-categories/condiments.png'),
  },
];

function normalizeValue(
  value: string | null | undefined,
) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(
      /[^a-z0-9\u0600-\u06ff]+/g,
      '-',
    )
    .replace(/^-+|-+$/g, '');
}

function getProductImage(
  product: CatalogProduct,
): string | null {
  if (product.imageUrl) {
    return product.imageUrl;
  }

  const coverImage = product.images.find(
    (image) => image.isCover,
  );

  if (coverImage) {
    return coverImage.imageUrl;
  }

  return product.images[0]?.imageUrl ?? null;
}

function getDiscountPercent(
  product: CatalogProduct,
): number | null {
  const compareAtPrice =
    product.compareAtPrice;

  if (
    compareAtPrice === null ||
    compareAtPrice <= product.price ||
    compareAtPrice <= 0
  ) {
    return null;
  }

  return Math.round(
    ((compareAtPrice - product.price) /
      compareAtPrice) *
      100,
  );
}

function formatMoney(
  amount: number,
  currencyCode: string,
) {
  return `${getArabicCurrencyLabel(
    currencyCode,
  )} ${amount.toFixed(
    2,
  )}`;
}

function getArabicCurrencyLabel(
  currencyCode: string,
) {
  if (
    currencyCode.trim().toUpperCase() ===
    'EGP'
  ) {
    return 'ج.م';
  }

  return currencyCode;
}

function formatCartMoney(
  amount: number,
  currencyCode: string,
) {
  return `${getArabicCurrencyLabel(
    currencyCode,
  )} ${amount.toFixed(2)}`;
}

function findSectionForCategory(
  definition: SupermarketCategoryDefinition,
  sections: CatalogSection[],
): CatalogSection | null {
  const normalizedAliases =
    definition.aliases.map(normalizeValue);

  const exactSlugMatch = sections.find(
    (section) =>
      normalizedAliases.includes(
        normalizeValue(section.slug),
      ),
  );

  if (exactSlugMatch) {
    return exactSlugMatch;
  }

  const exactEnglishNameMatch =
    sections.find((section) =>
      normalizedAliases.includes(
        normalizeValue(section.nameEn),
      ),
    );

  if (exactEnglishNameMatch) {
    return exactEnglishNameMatch;
  }

  const normalizedLabel =
    normalizeValue(definition.label);

  return (
    sections.find(
      (section) =>
        normalizeValue(section.nameEn) ===
          normalizedLabel ||
        normalizeValue(section.name) ===
          normalizedLabel,
    ) ?? null
  );
}

function makeCategoryColumns(
  categories: CategoryDisplayItem[],
) {
  const columns: CategoryDisplayItem[][] =
    [];

  for (
    let index = 0;
    index < categories.length;
    index += CATEGORY_ROWS
  ) {
    columns.push(
      categories.slice(
        index,
        index + CATEGORY_ROWS,
      ),
    );
  }

  return columns;
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

function CategoryVisual({
  item,
}: {
  item: CategoryDisplayItem;
}) {
  return (
    <View style={styles.categoryImageBox}>
      <Image
        source={item.imageSource}
        style={styles.categoryImage}
        resizeMode="cover"
      />
    </View>
  );
}

function FeaturedProductCard({
  product,
  currencyCode,
  cardWidth,
  quantity,
  isStoreClosed,
  onAdd,
  onIncrease,
  onDecrease,
}: FeaturedProductCardProps) {
  const imageUrl =
    getProductImage(product);

  const discount =
    getDiscountPercent(product);

  return (
    <View
      style={[
        styles.featuredProductCard,
        {
          width: cardWidth,
        },
      ]}
    >
      <View
        style={[
          styles.featuredProductImageBox,
          {
            width: cardWidth,
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
              styles.featuredProductImage
            }
            resizeMode="cover"
          />
        ) : (
          <Text
            style={
              styles.featuredProductFallback
            }
          >
            {product.icon ||
              '🛒'}
          </Text>
        )}

        {discount !== null && (
          <View
            style={
              styles.featuredDiscountBadge
            }
          >
            <Text
              style={
                styles.featuredDiscountText
              }
              numberOfLines={1}
            >
              وفر {discount}%
            </Text>
          </View>
        )}

        {quantity === 0 ? (
          <Pressable
            disabled={
              isStoreClosed
            }
            hitSlop={5}
            style={({
              pressed,
            }) => [
              styles.featuredAddButton,

              isStoreClosed &&
                styles.featuredAddButtonDisabled,

              pressed &&
                !isStoreClosed &&
                styles.featuredAddButtonPressed,
            ]}
            onPress={onAdd}
          >
            <Text
              style={
                styles.featuredAddButtonText
              }
            >
              +
            </Text>
          </Pressable>
        ) : (
          <View
            style={
              styles.featuredQuantityPill
            }
          >
            <Pressable
              hitSlop={4}
              style={
                styles.featuredQuantityButton
              }
              onPress={
                onDecrease
              }
            >
              <Text
                style={
                  styles.featuredQuantityButtonText
                }
              >
                −
              </Text>
            </Pressable>

            <Text
              style={
                styles.featuredQuantityValue
              }
            >
              {quantity}
            </Text>

            <Pressable
              disabled={
                isStoreClosed
              }
              hitSlop={4}
              style={
                styles.featuredQuantityButton
              }
              onPress={
                onIncrease
              }
            >
              <Text
                style={
                  styles.featuredQuantityButtonText
                }
              >
                +
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <Text
        style={
          styles.featuredProductName
        }
        numberOfLines={2}
      >
        {product.nameEn?.trim() ||
          product.name}
      </Text>

      <View
        style={
          styles.featuredCurrentPriceWrap
        }
      >
        <Text
          style={
            styles.featuredCurrentPrice
          }
          numberOfLines={1}
        >
          {formatMoney(
            product.price,
            currencyCode,
          )}
        </Text>
      </View>

      {product.compareAtPrice !==
        null &&
        product.compareAtPrice >
          product.price && (
          <Text
            style={
              styles.featuredOldPrice
            }
            numberOfLines={1}
          >
            {formatMoney(
              product.compareAtPrice,
              currencyCode,
            )}
          </Text>
        )}
    </View>
  );
}

export default function SupermarketScreen() {
  const router = useRouter();

  const { width: windowWidth } =
    useWindowDimensions();

  const categoryScrollX = useRef(
    new Animated.Value(0),
  ).current;

  const [
    categoryViewportWidth,
    setCategoryViewportWidth,
  ] = useState(0);

  const [
    categoryContentWidth,
    setCategoryContentWidth,
  ] = useState(0);

  const [
    catalog,
    setCatalog,
  ] =
    useState<StoreCatalog | null>(
      null,
    );

  const [
    promotionBanners,
    setPromotionBanners,
  ] = useState<
    SupermarketPromotionBanner[]
  >([]);

  const [
    currencyCode,
    setCurrencyCode,
  ] =
    useState('EGP');

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

  const savedServiceAreaId =
    useCustomerStore(
      (state) =>
        state.locationServiceAreaId,
    );

  const cartStore =
    useCartStore();

  const cartItems =
    cartStore.items;

  const addItem =
    cartStore.addItem;

  const increaseItem =
    cartStore.increaseItem;

  const decreaseItem =
    cartStore.decreaseItem;

  async function loadSupermarket() {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const bootstrap =
        await getAppBootstrap();

      const defaultServiceAreaId =
        savedServiceAreaId ??
        bootstrap.settings
          .default_service_area_id ??
        undefined;

      const supermarketStores =
        await listStores({
          categorySlug:
            'supermarket',

          serviceAreaId:
            defaultServiceAreaId,
        });

      if (
        supermarketStores.length ===
        0
      ) {
        throw new Error(
          'لا يوجد سوبر ماركت متاح حاليًا.',
        );
      }

      const supermarket =
        supermarketStores.find(
          (store) =>
            store.isFeatured &&
            !store.isManuallyClosed,
        ) ??
        supermarketStores.find(
          (store) =>
            !store.isManuallyClosed,
        ) ??
        supermarketStores[0];

      const [
        loadedCatalog,
        loadedPromotionBanners,
      ] = await Promise.all([
        getStoreCatalog(
          supermarket.id,
          defaultServiceAreaId,
        ),

        listSupermarketPromotionBanners({
          storeId:
            supermarket.id,
        }).catch(
          (bannerError) => {
            console.warn(
              'Unable to load supermarket banners:',
              bannerError,
            );

            return [];
          },
        ),
      ]);

      setCatalog(
        loadedCatalog,
      );

      setPromotionBanners(
        loadedPromotionBanners,
      );

      setCurrencyCode(
        bootstrap.settings
          .currency_code ||
          'EGP',
      );
    } catch (error) {
      setCatalog(null);

      setPromotionBanners([]);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر تحميل السوبر ماركت.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadSupermarket();
  }, [savedServiceAreaId]);

  const categories =
    useMemo<
      CategoryDisplayItem[]
    >(() => {
      const sections =
        catalog?.sections ??
        [];

      return SUPERMARKET_CATEGORIES.map(
        (definition) => ({
          key:
            definition.key,

          label:
            definition.label,

          imageSource:
            definition.imageSource,

          isOffers:
            definition.isOffers ===
            true,

          section:
            findSectionForCategory(
              definition,
              sections,
            ),
        }),
      );
    }, [catalog]);

  const categoryColumns =
    useMemo(
      () =>
        makeCategoryColumns(
          categories,
        ),
      [categories],
    );

  const categoryMaxScroll =
    Math.max(
      categoryContentWidth -
        categoryViewportWidth,
      1,
    );

  const categoryIndicatorTravel =
    CATEGORY_INDICATOR_TRACK_WIDTH -
    CATEGORY_INDICATOR_THUMB_WIDTH;

  const categoryIndicatorTranslateX =
    categoryScrollX.interpolate({
      inputRange: [
        0,
        categoryMaxScroll,
      ],

      outputRange: [
        0,
        categoryIndicatorTravel,
      ],

      extrapolate:
        'clamp',
    });

  const catalogProductsById =
    useMemo(() => {
      const productsById =
        new Map<
          string,
          CatalogProduct
        >();

      for (
        const section of
        catalog?.sections ?? []
      ) {
        for (
          const product of
          section.products
        ) {
          productsById.set(
            product.id,
            product,
          );
        }
      }

      return productsById;
    }, [catalog]);

  const resolvedPromotionBanners =
    useMemo<
      ResolvedPromotionBanner[]
    >(() => {
      return promotionBanners
        .map(
          (banner) => ({
            ...banner,

            products:
              banner.productIds
                .map(
                  (
                    productId,
                  ) =>
                    catalogProductsById.get(
                      productId,
                    ),
                )
                .filter(
                  (
                    product,
                  ): product is CatalogProduct =>
                    Boolean(
                      product,
                    ),
                ),
          }),
        )
        .filter(
          (banner) =>
            Boolean(
              banner.imageUrl.trim(),
            ),
        );
    }, [
      catalogProductsById,
      promotionBanners,
    ]);

  const pageWidth =
    Math.min(
      windowWidth,
      560,
    );

  const featuredCardWidth =
    Math.min(
      116,
      Math.max(
        92,
        pageWidth * 0.3,
      ),
    );

  /*
   * Banner becomes edge-to-edge.
   *
   * Previously:
   * pageWidth - 18
   *
   * That intentionally left 9px
   * on the left and 9px on the right.
   */
  const promotionBannerWidth =
    Math.max(
      pageWidth,
      1,
    );

  const promotionBannerHeight =
    Math.round(
      promotionBannerWidth *
        0.64,
    );

  const promotionProductsOverlap =
    Math.round(
      promotionBannerHeight *
        0.49,
    );

  if (isLoading) {
    return (
      <CatalogHomeScreenSkeleton />
    );
  }

  if (
    !catalog ||
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
          السوبر ماركت غير متاح
        </Text>

        <Text
          style={
            styles.stateDescription
          }
        >
          {errorMessage ??
            'تعذر تحميل السوبر ماركت.'}
        </Text>

        <Pressable
          style={({
            pressed,
          }) => [
            styles.retryButton,

            pressed &&
              styles.generalPressed,
          ]}
          onPress={() => {
            void loadSupermarket();
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
          style={({
            pressed,
          }) => [
            styles.errorBackButton,

            pressed &&
              styles.generalPressed,
          ]}
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.errorBackButtonText
            }
          >
            رجوع
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const currentStore =
    catalog.store;

  const delivery =
    catalog.delivery;

  const isStoreClosed =
    currentStore.isManuallyClosed;

  const currentStoreItemCount =
    cartItems.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.quantity,
      0,
    );

  const currentStoreSubtotal =
    cartItems.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.price *
          item.quantity,
      0,
    );

  const shouldShowCartBar =
    currentStoreItemCount >
    0;

  function openCategory(
    item: CategoryDisplayItem,
  ) {
    const categorySlug =
      item.isOffers
        ? 'offers'
        : item.section
              ?.slug ??
          item.key;

    router.push({
      pathname:
        '/supermarket-category/[slug]',

      params: {
        slug:
          categorySlug,

        storeId:
          currentStore.id,

        categoryKey:
          item.key,

        label:
          item.label,
      },
    });
  }

  function addFeaturedProduct(
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
      },
    );
  }

  function increaseFeaturedProduct(
    product: CatalogProduct,
  ) {
    if (isStoreClosed) {
      return;
    }

    const existingItem =
      cartItems.find(
        (item) =>
          item.id ===
          product.id,
      );

    if (existingItem) {
      increaseItem(
        product.id,
      );

      return;
    }

    addFeaturedProduct(
      product,
    );
  }

  function decreaseFeaturedProduct(
    productId: string,
  ) {
    const existingItem =
      cartItems.find(
        (item) =>
          item.id ===
          productId,
      );

    if (!existingItem) {
      return;
    }

    decreaseItem(
      productId,
    );
  }

  function getProductQuantity(
    productId: string,
  ) {
    return (
      cartItems.find(
        (item) =>
          item.id ===
          productId,
      )?.quantity ?? 0
    );
  }

  return (
    <SafeAreaView
      style={styles.screen}
      edges={['top']}
    >
      <StatusBar
        style="dark"
      />

      <View
        style={
          styles.pageShell
        }
      >
        <View
          style={styles.header}
        >
          <Pressable
            style={({
              pressed,
            }) => [
              styles.backButton,

              pressed &&
                styles.headerButtonPressed,
            ]}
            onPress={() =>
              router.back()
            }
          >
            <BackArrowIcon />
          </Pressable>
        </View>

        <ScrollView
          style={
            styles.mainScrollView
          }
          contentContainerStyle={[
            styles.mainContent,

            shouldShowCartBar &&
              styles.mainContentWithCart,
          ]}
          showsVerticalScrollIndicator={
            false
          }
        >
          <View
            style={
              styles.categoriesSection
            }
          >
            <Text
              style={
                styles.categoriesTitle
              }
            >
              تسوق حسب الفئة
            </Text>

            <Animated.ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              scrollEventThrottle={
                16
              }
              contentContainerStyle={
                styles.categoriesRail
              }
              onLayout={(
                event,
              ) => {
                setCategoryViewportWidth(
                  event.nativeEvent
                    .layout.width,
                );
              }}
              onContentSizeChange={(
                width,
              ) => {
                setCategoryContentWidth(
                  width,
                );
              }}
              onScroll={Animated.event(
                [
                  {
                    nativeEvent: {
                      contentOffset: {
                        x: categoryScrollX,
                      },
                    },
                  },
                ],
                {
                  useNativeDriver:
                    true,
                },
              )}
            >
              {categoryColumns.map(
                (
                  column,
                  columnIndex,
                ) => (
                  <View
                    key={`category-column-${columnIndex}`}
                    style={
                      styles.categoryColumn
                    }
                  >
                    {column.map(
                      (item) => (
                        <Pressable
                          key={
                            item.key
                          }
                          style={({
                            pressed,
                          }) => [
                            styles.categoryItem,

                            pressed &&
                              styles.categoryItemPressed,
                          ]}
                          onPress={() =>
                            openCategory(
                              item,
                            )
                          }
                        >
                          <CategoryVisual
                            item={
                              item
                            }
                          />

                          <Text
                            style={
                              styles.categoryLabel
                            }
                            numberOfLines={
                              2
                            }
                          >
                            {
                              item.label
                            }
                          </Text>
                        </Pressable>
                      ),
                    )}
                  </View>
                ),
              )}
            </Animated.ScrollView>

            <View
              style={
                styles.categoryPagination
              }
            >
              <Animated.View
                style={[
                  styles.categoryPaginationActive,

                  {
                    transform: [
                      {
                        translateX:
                          categoryIndicatorTranslateX,
                      },
                    ],
                  },
                ]}
              />
            </View>
          </View>

          {resolvedPromotionBanners.map(
            (
              banner,
              bannerIndex,
            ) => (
              <View
                key={
                  banner.id
                }
                style={[
                  styles.promotionSection,

                  bannerIndex ===
                    resolvedPromotionBanners.length -
                      1 &&
                    styles.promotionSectionLast,
                ]}
              >
                <View
                  style={
                    styles.promotionBannerFrame
                  }
                >
                  <Image
                    source={{
                      uri:
                        banner.imageUrl,
                    }}
                    style={[
                      styles.promotionBanner,

                      {
                        height:
                          promotionBannerHeight,
                      },
                    ]}
                    resizeMode="cover"
                    accessibilityLabel={
                      banner.altTextAr ??
                      banner.adminLabel
                    }
                  />
                </View>

                {banner.products
                  .length >
                  0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={
                      false
                    }
                    directionalLockEnabled
                    contentContainerStyle={
                      styles.promotionProductsRail
                    }
                    style={[
                      styles.promotionProductsScroll,

                      {
                        marginTop:
                          -promotionProductsOverlap,
                      },
                    ]}
                  >
                    {banner.products.map(
                      (
                        product,
                      ) => (
                        <FeaturedProductCard
                          key={`${banner.id}-${product.id}`}
                          product={
                            product
                          }
                          currencyCode={
                            currencyCode
                          }
                          cardWidth={
                            featuredCardWidth
                          }
                          quantity={getProductQuantity(
                            product.id,
                          )}
                          isStoreClosed={
                            isStoreClosed
                          }
                          onAdd={() =>
                            addFeaturedProduct(
                              product,
                            )
                          }
                          onIncrease={() =>
                            increaseFeaturedProduct(
                              product,
                            )
                          }
                          onDecrease={() =>
                            decreaseFeaturedProduct(
                              product.id,
                            )
                          }
                        />
                      ),
                    )}
                  </ScrollView>
                )}
              </View>
            ),
          )}
        </ScrollView>

        {isStoreClosed && (
          <View
            style={
              styles.closedOverlay
            }
          >
            <Text
              style={
                styles.closedOverlayText
              }
            >
              {currentStore.manualClosedNote ??
                'السوبر ماركت مغلق حاليًا.'}
            </Text>
          </View>
        )}

        {shouldShowCartBar && (
          <View
            pointerEvents="box-none"
            style={
              styles.cartBarFloatingWrapper
            }
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`عرض السلة، ${currentStoreItemCount} منتجات، الإجمالي ${formatCartMoney(
                currentStoreSubtotal,
                currencyCode,
              )}`}
              style={({
                pressed,
              }) => [
                styles.cartBar,

                pressed &&
                  styles.cartBarPressed,
              ]}
              onPress={() => {
                router.push(
                  '/cart',
                );
              }}
            >
              <View
                style={
                  styles.cartCountBadge
                }
              >
                <Text
                  style={
                    styles.cartCountText
                  }
                >
                  {
                    currentStoreItemCount
                  }
                </Text>
              </View>

              <View
                style={
                  styles.cartBarRight
                }
              >
                <Text
                  style={
                    styles.cartBarText
                  }
                  numberOfLines={
                    1
                  }
                >
                  {formatCartMoney(
                    currentStoreSubtotal,
                    currencyCode,
                  )}{' '}
                  عرض السلة
                </Text>
              </View>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

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

    header: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      flexDirection:
        'row',

      paddingBottom:
        12,

      paddingHorizontal:
        16,

      paddingTop: 10,

      zIndex: 10,
    },

    backButton: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderColor:
        '#E1E1E1',

      borderRadius: 24,

      borderWidth: 1,

      height: 46,

      justifyContent:
        'center',

      width: 46,
    },

    headerButtonPressed: {
      backgroundColor:
        '#F7F7F7',

      transform: [
        {
          scale: 0.97,
        },
      ],
    },

    backArrowCanvas: {
      height: 23,

      position:
        'relative',

      width: 24,
    },

    backArrowStem: {
      backgroundColor:
        '#242424',

      borderRadius: 2,

      height: 2.2,

      left: 3,

      position:
        'absolute',

      top: 10.3,

      width: 19,
    },

    backArrowDiagonal: {
      backgroundColor:
        '#242424',

      borderRadius: 2,

      height: 2.2,

      left: 2,

      position:
        'absolute',

      width: 10,
    },

    backArrowTop: {
      top: 7,

      transform: [
        {
          rotate:
            '-42deg',
        },
      ],
    },

    backArrowBottom: {
      top: 14,

      transform: [
        {
          rotate:
            '42deg',
        },
      ],
    },

    mainScrollView: {
      flex: 1,
    },

    mainContent: {
      backgroundColor:
        '#FFFFFF',

      paddingBottom:
        30,
    },

    mainContentWithCart: {
      paddingBottom:
        115,
    },

    categoriesSection: {
      backgroundColor:
        '#FFFFFF',

      paddingTop: 1,
    },

    categoriesTitle: {
      color:
        '#202020',

      fontSize: 21,

      fontWeight:
        '800',

      letterSpacing:
        -0.45,

      marginBottom:
        14,

      paddingHorizontal:
        16,
    },

    categoriesRail: {
      gap: 7,

      paddingHorizontal:
        16,
    },

    categoryColumn: {
      gap: 15,

      width: 85,
    },

    categoryItem: {
      alignItems:
        'center',

      width: 85,
    },

    categoryItemPressed: {
      opacity: 0.68,

      transform: [
        {
          scale: 0.97,
        },
      ],
    },

    categoryImageBox: {
      alignItems:
        'center',

      backgroundColor:
        '#F5F5F5',

      borderRadius:
        13,

      height:
        80,

      justifyContent:
        'center',

      overflow:
        'hidden',

      width:
        80,
    },

    categoryImage: {
      height: '100%',

      width: '100%',
    },

    categoryLabel: {
      color:
        '#202020',

      fontSize: 13.5,

      fontWeight:
        '400',

      letterSpacing:
        -0.2,

      lineHeight: 18,

      marginTop: 8,

      minHeight: 36,

      textAlign:
        'center',

      writingDirection:
        'rtl',

      width: 85,
    },

    categoryPagination: {
      alignSelf:
        'center',

      backgroundColor:
        '#E6E6E6',

      borderRadius: 3,

      height: 5,

      marginBottom:
        22,

      marginTop: 18,

      overflow:
        'hidden',

      position:
        'relative',

      width:
        CATEGORY_INDICATOR_TRACK_WIDTH,
    },

    categoryPaginationActive: {
      backgroundColor:
        '#151515',

      borderRadius: 3,

      height: 5,

      left: 0,

      position:
        'absolute',

      top: 0,

      width:
        CATEGORY_INDICATOR_THUMB_WIDTH,
    },

    /* ========================================================
     * PROMOTION BANNER
     * ========================================================
     */

    promotionSection: {
      backgroundColor:
        '#FFFFFF',

      marginBottom:
        22,

      overflow:
        'visible',

      width: '100%',
    },

    promotionSectionLast: {
      marginBottom: 0,
    },

    /*
     * IMPORTANT:
     *
     * Removed marginHorizontal: 9.
     *
     * Banner now touches both
     * sides of the page.
     */
    promotionBannerFrame: {
      marginHorizontal:
        0,

      overflow:
        'hidden',

      width:
        '100%',
    },

    promotionBanner: {
      backgroundColor:
        '#F4F4F4',

      width: '100%',
    },

    promotionProductsScroll: {
      overflow:
        'visible',
    },

    promotionProductsRail: {
      alignItems:
        'flex-start',

      gap: 7,

      paddingBottom: 7,

      paddingHorizontal:
        21,

      paddingTop: 0,
    },

    featuredProductCard: {
      backgroundColor:
        'transparent',

      overflow:
        'visible',
    },

    featuredProductImageBox: {
      alignItems:
        'center',

      backgroundColor:
        '#F4F4F4',

      borderColor:
        '#E8E8E8',

      borderRadius:
        12,

      borderWidth:
        1,

      justifyContent:
        'center',

      overflow:
        'hidden',

      position:
        'relative',
    },

    featuredProductImage: {
      height:
        '100%',

      width:
        '100%',
    },

    featuredProductFallback: {
      fontSize: 34,
    },

    featuredDiscountBadge: {
      alignItems:
        'center',

      backgroundColor:
        '#BFFF00',

      borderRadius: 3,

      justifyContent:
        'center',

      left: 6,

      minHeight: 17,

      paddingHorizontal:
        4,

      paddingVertical:
        2,

      position:
        'absolute',

      top: 6,

      zIndex: 5,
    },

    featuredDiscountText: {
      color:
        '#111111',

      fontSize: 8.5,

      fontWeight:
        '500',

      lineHeight: 11,
    },

    featuredAddButton: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderColor:
        '#E7E7E7',

      borderRadius:
        18,

      borderWidth:
        1,

      bottom:
        6,

      elevation:
        2,

      height:
        34,

      justifyContent:
        'center',

      position:
        'absolute',

      right:
        6,

      shadowColor:
        '#000000',

      shadowOffset: {
        width:
          0,

        height:
          1,
      },

      shadowOpacity:
        0.08,

      shadowRadius:
        2,

      width:
        34,

      zIndex:
        8,
    },

    featuredAddButtonPressed: {
      backgroundColor:
        '#F8F8F8',

      transform: [
        {
          scale:
            0.94,
        },
      ],
    },

    featuredAddButtonDisabled: {
      opacity: 0.45,
    },

    featuredAddButtonText: {
      color:
        NAVIENTY_NOW_COLORS.primary,

      fontSize:
        25,

      fontWeight:
        '300',

      lineHeight:
        27,

      marginTop:
        -2,
    },

    featuredQuantityPill: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderColor:
        '#E7E7E7',

      borderRadius:
        18,

      borderWidth:
        1,

      bottom:
        6,

      elevation:
        2,

      flexDirection:
        'row',

      height:
        34,

      position:
        'absolute',

      right:
        6,

      shadowColor:
        '#000000',

      shadowOffset: {
        width:
          0,

        height:
          1,
      },

      shadowOpacity:
        0.08,

      shadowRadius:
        2,

      zIndex:
        8,
    },

    featuredQuantityButton: {
      alignItems:
        'center',

      height:
        32,

      justifyContent:
        'center',

      width:
        25,
    },

    featuredQuantityButtonText: {
      color:
        NAVIENTY_NOW_COLORS.primary,

      fontSize:
        18,

      fontWeight:
        '500',

      lineHeight:
        20,
    },

    featuredQuantityValue: {
      color:
        '#202020',

      fontSize:
        10,

      fontWeight:
        '700',

      minWidth:
        14,

      textAlign:
        'center',
    },

    featuredProductName: {
      color:
        '#202020',

      fontSize:
        10.5,

      fontWeight:
        '400',

      letterSpacing:
        -0.15,

      lineHeight:
        12.5,

      marginTop:
        7,

      minHeight:
        25,

      textAlign:
        'left',

      writingDirection:
        'ltr',
    },

    featuredCurrentPriceWrap: {
      alignSelf:
        'flex-start',

      borderBottomColor:
        '#BFFF00',

      borderBottomWidth:
        2,

      marginTop:
        3,
    },


    featuredCurrentPrice: {
      color:
        '#202020',

      fontSize:
        10.5,

      fontWeight:
        '500',

      lineHeight:
        13,

      textAlign:
        'left',

      writingDirection:
        'ltr',
    },


    featuredOldPrice: {
      alignSelf:
        'flex-start',

      color:
        '#858585',

      fontSize:
        9,

      lineHeight:
        11,

      marginTop:
        1,

      textAlign:
        'left',

      textDecorationLine:
        'line-through',

      writingDirection:
        'ltr',
    },







    cartBarFloatingWrapper: {
      bottom: 12,

      left: 18,

      position:
        'absolute',

      right: 18,

      zIndex: 999,
    },

    cartBar: {
      alignItems:
        'center',

      backgroundColor:
        '#00B956',

      borderRadius: 34,

      elevation: 20,

      flexDirection:
        'row',

      height: 64,

      justifyContent:
        'space-between',

      paddingHorizontal:
        9,

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: 3,
      },

      shadowOpacity:
        0.16,

      shadowRadius: 8,

      width: '100%',
    },

    cartBarPressed: {
      opacity: 0.92,

      transform: [
        {
          scale:
            0.985,
        },
      ],
    },

    cartCountBadge: {
      alignItems:
        'center',

      backgroundColor:
        '#009D49',

      borderRadius: 24,

      height: 48,

      justifyContent:
        'center',

      width: 48,
    },

    cartCountText: {
      color:
        '#FFFFFF',

      fontSize: 17,

      fontWeight:
        '800',

      textAlign:
        'center',
    },

    cartBarRight: {
      alignItems:
        'flex-end',

      flex: 1,

      justifyContent:
        'center',

      paddingHorizontal:
        16,
    },

    cartBarText: {
      color:
        '#FFFFFF',

      fontSize: 15.5,

      fontWeight:
        '800',

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    closedOverlay: {
      backgroundColor:
        '#252525',

      left: 16,

      paddingHorizontal:
        15,

      paddingVertical:
        10,

      position:
        'absolute',

      right: 16,

      top: 68,

      zIndex: 50,
    },

    closedOverlayText: {
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
      fontSize: 50,
    },

    stateTitle: {
      color:
        '#202020',

      fontSize: 21,

      fontWeight:
        '800',

      marginTop: 15,

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

      marginTop: 22,

      minWidth: 150,

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

    errorBackButton: {
      borderColor:
        '#E0E0E0',

      borderRadius: 14,

      borderWidth: 1,

      marginTop: 10,

      minWidth: 150,

      paddingHorizontal:
        20,

      paddingVertical:
        12,
    },

    errorBackButtonText: {
      color:
        '#222222',

      fontSize: 14,

      fontWeight:
        '600',

      textAlign:
        'center',
    },

    generalPressed: {
      opacity: 0.72,

      transform: [
        {
          scale: 0.98,
        },
      ],
    },
  });
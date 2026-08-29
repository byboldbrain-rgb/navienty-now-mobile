import { Ionicons } from '@expo/vector-icons';
// SEARCH_CATEGORY_DIRECT_NAVIGATION_V6_NO_UI_CHANGE_2026_08_29
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  type ImageSourcePropType,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { publicSupabase } from '../lib/supabase';

import {
  createAnalyticsCorrelationId,
  sanitizeSearchQueryForAnalytics,
  trackBehaviorEvent,
} from '../services/behavioral-analytics-service';
import getAppBootstrap from '../services/bootstrap-service';
import {
  getStoreCatalog,
  listStores,
  type StoreCatalog,
  type StoreSummary,
} from '../services/catalog-service';
import {
  type GlobalSearchResult,
  type GlobalSearchServiceKey,
  prepareGlobalSearchIndex,
  searchGlobalCatalog,
} from '../services/global-search-service';
import {
  recordRecentlyViewed,
} from '../services/recently-viewed-service';
import {
  setSearchAttribution,
} from '../services/search-attribution-service';
import {
  clearRecentSearches as clearRecentSearchHistory,
  getRecentSearches,
  saveRecentSearch as persistRecentSearch,
} from '../services/search-history-service';
import { useCustomerStore } from '../store/customer-store';
import {
  NAVIENTY_NOW_COLORS,
  NAVIENTY_NOW_LAYOUT,
} from '../theme/navienty-now-theme';

const MAX_RECENT_SEARCHES = 6;
const SEARCH_DEBOUNCE_MS = 180;
const SEARCH_PLACEHOLDER_ROTATION_MS = 1800;
const SEARCH_SUGGESTION_CATALOG_CONCURRENCY = 4;
const SEARCH_DISCOVERY_LIMIT = 12;

type SearchGroups = {
  services: GlobalSearchResult[];
  stores: GlobalSearchResult[];
  categories: GlobalSearchResult[];
  products: GlobalSearchResult[];
};

type SearchTabKey =
  | 'restaurants'
  | 'supermarket'
  | 'bookstore'
  | 'personal-care';

type SearchCatalogSuggestion = {
  id: string;
  name: string;
  imageUrl: string | null;
  storeId: string;
  storeCategorySlug: string;
  sectionId: string;
  sectionSlug: string;
  depth: number;
};

type ActiveCategoryIdsByStore = Map<
  string,
  Set<string>
>;

const SEARCH_TABS: ReadonlyArray<{
  key: SearchTabKey;
  label: string;
}> = [
  {
    key: 'restaurants',
    label: 'المطاعم',
  },
  {
    key: 'supermarket',
    label: 'الماركت',
  },
  {
    key: 'bookstore',
    label: 'المكتبة',
  },
  {
    key: 'personal-care',
    label: 'العناية',
  },
];


/*
 * Category artwork shown on the real category landing screens is bundled
 * locally with the app. `catalog_categories.image_url` is allowed to be
 * NULL, so relying on section.imageUrl alone leaves the Search discovery
 * circles empty.
 *
 * Metro requires literal/static require(...) calls. Do not convert these
 * maps to a dynamic require template.
 */
const SUPERMARKET_CATEGORY_IMAGES: Readonly<
  Partial<Record<string, ImageSourcePropType>>
> = {
  'fruit-veg': require(
    '../../assets/images/supermarket-categories/fruit-veg.webp',
  ),
  bakery: require(
    '../../assets/images/supermarket-categories/bakery.webp',
  ),
  'poultry-meat-seafood': require(
    '../../assets/images/supermarket-categories/poultry-meat-seafood.webp',
  ),
  'coffee-tea': require(
    '../../assets/images/supermarket-categories/coffee-tea.webp',
  ),
  'cooking-baking': require(
    '../../assets/images/supermarket-categories/cooking-baking.webp',
  ),
  'fresh-food': require(
    '../../assets/images/supermarket-categories/fresh-food.webp',
  ),
  'ready-to-eat': require(
    '../../assets/images/supermarket-categories/ready-to-eat.webp',
  ),
  'frozen-food': require(
    '../../assets/images/supermarket-categories/frozen-food.webp',
  ),
  'dairy-eggs': require(
    '../../assets/images/supermarket-categories/dairy-eggs.webp',
  ),
  'breakfast-food': require(
    '../../assets/images/supermarket-categories/breakfast-food.webp',
  ),
  'canned-jarred': require(
    '../../assets/images/supermarket-categories/canned-jarred.webp',
  ),
  'household-essentials': require(
    '../../assets/images/supermarket-categories/household-essentials.webp',
  ),
  beverages: require(
    '../../assets/images/supermarket-categories/beverages.webp',
  ),
  'snacks-chocolate': require(
    '../../assets/images/supermarket-categories/snacks-chocolate.webp',
  ),
  condiments: require(
    '../../assets/images/supermarket-categories/condiments.webp',
  ),
};

const BOOKSTORE_CATEGORY_IMAGES: Readonly<
  Partial<Record<string, ImageSourcePropType>>
> = {
  'writing-tools': require(
    '../../assets/images/bookstore-categories/writing-tools.webp',
  ),
  'art-supplies': require(
    '../../assets/images/bookstore-categories/art-supplies.webp',
  ),
  notebooks: require(
    '../../assets/images/bookstore-categories/notebooks.webp',
  ),
  'geometry-tools': require(
    '../../assets/images/bookstore-categories/geometry-tools.webp',
  ),
  'printing-paper': require(
    '../../assets/images/bookstore-categories/printing-paper.webp',
  ),
  'cups-cans': require(
    '../../assets/images/bookstore-categories/cups-cans.webp',
  ),
  'pencil-cases-bags': require(
    '../../assets/images/bookstore-categories/pencil-cases-bags.webp',
  ),
  flowers: require(
    '../../assets/images/bookstore-categories/flowers.webp',
  ),
};

const PERSONAL_CARE_CATEGORY_IMAGES: Readonly<
  Partial<Record<string, ImageSourcePropType>>
> = {
  skincare: require(
    '../../assets/images/personal-care-categories/face-care.webp',
  ),
  cosmetics: require(
    '../../assets/images/personal-care-categories/face-makeup.webp',
  ),
  'hair-scalp-care': require(
    '../../assets/images/personal-care-categories/hair-care.webp',
  ),
  'personal-care-hygiene': require(
    '../../assets/images/personal-care-categories/body-care.webp',
  ),
  'oral-dental-care': require(
    '../../assets/images/personal-care-categories/dental-care.webp',
  ),
  'women-care': require(
    '../../assets/images/personal-care-categories/women-care.webp',
  ),
  'men-care': require(
    '../../assets/images/personal-care-categories/men-care.webp',
  ),
};

const BOOKSTORE_CATEGORY_IMAGE_ALIASES: Readonly<
  Record<string, string>
> = {
  'pens-writing-tools': 'writing-tools',
  'pens-and-writing-tools': 'writing-tools',
  'drawing-art': 'art-supplies',
  'drawing-and-art': 'art-supplies',
  'art-drawing': 'art-supplies',
  'notebooks-copybooks': 'notebooks',
  'notebooks-and-copybooks': 'notebooks',
  'copybooks-notebooks': 'notebooks',
  'geometric-tools': 'geometry-tools',
  'engineering-tools': 'geometry-tools',
  'geometry-and-engineering-tools': 'geometry-tools',
  'paper-printing': 'printing-paper',
  'printing-and-paper': 'printing-paper',
  'printing-papers': 'printing-paper',
  'cups-and-cans': 'cups-cans',
  'mugs-cans': 'cups-cans',
  'mugs-and-cans': 'cups-cans',
  cups: 'cups-cans',
  mugs: 'cups-cans',
  'pencil-cases-and-bags': 'pencil-cases-bags',
  'pencil-cases': 'pencil-cases-bags',
  'school-bags': 'pencil-cases-bags',
  flower: 'flowers',
  roses: 'flowers',
  rose: 'flowers',
};

const PERSONAL_CARE_CATEGORY_IMAGE_ALIASES: Readonly<
  Record<string, string>
> = {
  'skin-care': 'skincare',
  'face-care': 'skincare',
  skin: 'skincare',
  cosmetic: 'cosmetics',
  beauty: 'cosmetics',
  'beauty-care': 'cosmetics',
  makeup: 'cosmetics',
  'make-up': 'cosmetics',
  'hair-care': 'hair-scalp-care',
  hair: 'hair-scalp-care',
  'body-care': 'personal-care-hygiene',
  'bath-body': 'personal-care-hygiene',
  'bath-and-body': 'personal-care-hygiene',
  body: 'personal-care-hygiene',
  'oral-care': 'oral-dental-care',
  'dental-care': 'oral-dental-care',
  'teeth-care': 'oral-dental-care',
  teeth: 'oral-dental-care',
  'womens-care': 'women-care',
  'female-care': 'women-care',
  'mens-care': 'men-care',
  'male-care': 'men-care',
};

function getLocalCatalogCategoryImage(
  storeCategorySlug: string | null | undefined,
  sectionSlug: string | null | undefined,
): ImageSourcePropType | null {
  const tab =
    getSearchTabForCategorySlug(
      storeCategorySlug,
    );

  const normalizedSectionSlug =
    normalizeCategorySlug(
      sectionSlug,
    );

  if (!normalizedSectionSlug) {
    return null;
  }

  if (tab === 'supermarket') {
    return (
      SUPERMARKET_CATEGORY_IMAGES[
        normalizedSectionSlug
      ] ?? null
    );
  }

  if (tab === 'bookstore') {
    const resolvedBookstoreSlug =
      BOOKSTORE_CATEGORY_IMAGE_ALIASES[
        normalizedSectionSlug
      ] ??
      normalizedSectionSlug;

    return (
      BOOKSTORE_CATEGORY_IMAGES[
        resolvedBookstoreSlug
      ] ?? null
    );
  }

  if (tab === 'personal-care') {
    const resolvedPersonalCareSlug =
      PERSONAL_CARE_CATEGORY_IMAGE_ALIASES[
        normalizedSectionSlug
      ] ??
      normalizedSectionSlug;

    return (
      PERSONAL_CARE_CATEGORY_IMAGES[
        resolvedPersonalCareSlug
      ] ?? null
    );
  }

  return null;
}

function normalizeCategorySlug(
  value: string | null | undefined,
) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
}


function getSearchTabForCategorySlug(
  value: string | null | undefined,
): SearchTabKey | null {
  const slug =
    normalizeCategorySlug(value);

  if (
    slug === 'restaurants' ||
    slug === 'restaurant' ||
    slug === 'food'
  ) {
    return 'restaurants';
  }

  if (
    slug === 'supermarket' ||
    slug === 'supermarkets' ||
    slug === 'market' ||
    slug === 'grocery'
  ) {
    return 'supermarket';
  }

  if (
    slug === 'bookstore' ||
    slug === 'bookstores' ||
    slug === 'book-store' ||
    slug === 'library' ||
    slug === 'books' ||
    slug === 'stationery'
  ) {
    return 'bookstore';
  }

  if (
    slug === 'personal-care' ||
    slug === 'personalcare' ||
    slug === 'beauty' ||
    slug === 'beauty-care' ||
    slug === 'health-beauty' ||
    slug === 'care'
  ) {
    return 'personal-care';
  }

  return null;
}

function isSearchResultInActiveCategory(
  result: GlobalSearchResult,
  activeCategoryIdsByStore:
    ActiveCategoryIdsByStore,
) {
  if (
    result.kind !== 'category' &&
    result.kind !== 'product'
  ) {
    return true;
  }

  const activeCategoryIds =
    activeCategoryIdsByStore.get(
      result.storeId,
    );

  return Boolean(
    activeCategoryIds?.has(
      result.sectionId,
    ),
  );
}

function doesResultMatchSearchTab(
  result: GlobalSearchResult,
  tab: SearchTabKey,
  activeCategoryIdsByStore:
    ActiveCategoryIdsByStore,
) {
  if (result.kind === 'service') {
    return false;
  }

  if (
    !isSearchResultInActiveCategory(
      result,
      activeCategoryIdsByStore,
    )
  ) {
    return false;
  }

  return (
    getSearchTabForCategorySlug(
      result.storeCategorySlug,
    ) === tab
  );
}

function doesSuggestionMatchSearchTab(
  suggestion: SearchCatalogSuggestion,
  tab: SearchTabKey,
) {
  return (
    getSearchTabForCategorySlug(
      suggestion.storeCategorySlug,
    ) === tab
  );
}

function getDiscoveryTitle(
  tab: SearchTabKey,
) {
  switch (tab) {
    case 'restaurants':
      return 'نفسك تطلب منين؟';
    case 'supermarket':
      return 'ناقصك إيه من الماركت؟';
    case 'bookstore':
      return 'محتاج إيه للمذاكرة؟';
    case 'personal-care':
      return 'روتينك ناقصه إيه؟';
  }
}

async function loadActiveCatalogCategoryIds(
  stores: readonly StoreSummary[],
): Promise<ActiveCategoryIdsByStore> {
  const activeCategoryIdsByStore:
    ActiveCategoryIdsByStore =
    new Map();

  for (const store of stores) {
    activeCategoryIdsByStore.set(
      store.id,
      new Set<string>(),
    );
  }

  const storeIds = stores
    .map((store) => store.id.trim())
    .filter(Boolean);

  if (storeIds.length === 0) {
    return activeCategoryIdsByStore;
  }

  const nowClient =
    (publicSupabase as any).schema(
      'now',
    );

  const {
    data,
    error,
  } = await nowClient
    .from('catalog_categories')
    .select('id,store_id')
    .in('store_id', storeIds)
    .eq('is_active', true);

  if (error) {
    throw new Error(
      `Loading active search categories failed: ${error.message}`,
    );
  }

  if (!Array.isArray(data)) {
    return activeCategoryIdsByStore;
  }

  for (const row of data as Array<{
    id?: unknown;
    store_id?: unknown;
  }>) {
    const categoryId =
      typeof row.id === 'string'
        ? row.id.trim()
        : '';

    const storeId =
      typeof row.store_id === 'string'
        ? row.store_id.trim()
        : '';

    if (!categoryId || !storeId) {
      continue;
    }

    let activeIds =
      activeCategoryIdsByStore.get(
        storeId,
      );

    if (!activeIds) {
      activeIds = new Set<string>();

      activeCategoryIdsByStore.set(
        storeId,
        activeIds,
      );
    }

    activeIds.add(categoryId);
  }

  return activeCategoryIdsByStore;
}

async function loadSearchCatalogSuggestions(
  stores: readonly StoreSummary[],
  serviceAreaId: string | null,
  activeCategoryIdsByStore:
    ActiveCategoryIdsByStore,
): Promise<SearchCatalogSuggestion[]> {
  if (stores.length === 0) {
    return [];
  }

  const catalogs =
    new Array<StoreCatalog | null>(
      stores.length,
    ).fill(null);

  let nextStoreIndex = 0;

  async function worker() {
    while (true) {
      const storeIndex =
        nextStoreIndex;

      nextStoreIndex += 1;

      if (
        storeIndex >= stores.length
      ) {
        return;
      }

      const store =
        stores[storeIndex];

      if (!store) {
        continue;
      }

      try {
        catalogs[storeIndex] =
          await getStoreCatalog(
            store.id,
            serviceAreaId ??
              undefined,
          );
      } catch (error) {
        if (__DEV__) {
          console.warn(
            'Unable to load a search suggestion catalog.',
            store.id,
            error,
          );
        }
      }
    }
  }

  const workerCount = Math.min(
    SEARCH_SUGGESTION_CATALOG_CONCURRENCY,
    stores.length,
  );

  await Promise.all(
    Array.from(
      { length: workerCount },
      () => worker(),
    ),
  );

  const suggestions:
    SearchCatalogSuggestion[] = [];

  const seenNames =
    new Set<string>();

  for (const catalog of catalogs) {
    if (!catalog) {
      continue;
    }

    /*
     * `get_store_catalog` may still contain legacy/inactive categories.
     * The authoritative active IDs come directly from
     * now.catalog_categories where is_active = true.
     *
     * That keeps inactive categories out of the discovery rail,
     * rotating placeholder, and search category/product results.
     */
    const activeCategoryIds =
      activeCategoryIdsByStore.get(
        catalog.store.id,
      );

    for (const section of catalog.sections) {
      if (
        !activeCategoryIds?.has(
          section.id,
        )
      ) {
        continue;
      }

      const name =
        section.name.trim();

      if (!name) {
        continue;
      }

      const normalizedName =
        name.toLocaleLowerCase('ar');

      const categoryGroup =
        getSearchTabForCategorySlug(
          catalog.store.categorySlug,
        ) ??
        catalog.store.categorySlug;

      const uniqueKey =
        `${categoryGroup}:${normalizedName}`;

      if (seenNames.has(uniqueKey)) {
        continue;
      }

      seenNames.add(uniqueKey);

      suggestions.push({
        id:
          `${catalog.store.id}:${section.id}`,
        name,
        imageUrl:
          section.imageUrl ?? null,
        storeId:
          catalog.store.id,
        storeCategorySlug:
          catalog.store.categorySlug,
        sectionId:
          section.id,
        sectionSlug:
          section.slug,
        depth:
          section.depth,
      });
    }
  }

  return suggestions;
}

function formatMoney(
  value: number,
) {
  if (!Number.isFinite(value)) {
    return '0 ج.م';
  }

  const formatted =
    Number.isInteger(value)
      ? String(value)
      : value
          .toFixed(2)
          .replace(/\.?0+$/, '');

  return `${formatted} ج.م`;
}

function groupResults(
  results: readonly GlobalSearchResult[],
): SearchGroups {
  const groups: SearchGroups = {
    services: [],
    stores: [],
    categories: [],
    products: [],
  };

  for (const result of results) {
    switch (result.kind) {
      case 'service':
        groups.services.push(result);
        break;
      case 'store':
        groups.stores.push(result);
        break;
      case 'category':
        groups.categories.push(result);
        break;
      case 'product':
        groups.products.push(result);
        break;
    }
  }

  return groups;
}

function getServiceIconName(
  key: GlobalSearchServiceKey,
) {
  switch (key) {
    case 'restaurants':
      return 'restaurant-outline';
    case 'supermarket':
      return 'basket-outline';
    case 'bookstore':
      return 'book-outline';
    case 'personal-care':
      return 'sparkles-outline';
    case 'laundry':
      return 'shirt-outline';
    case 'request-anything':
      return 'flash-outline';
  }
}

function SearchArtwork({
  imageUrl,
  localImageSource = null,
  fallback,
  size = 42,
  resizeMode = 'cover',
}: {
  imageUrl?: string | null;
  localImageSource?:
    | ImageSourcePropType
    | null;
  fallback: string;
  size?: number;
  resizeMode?: 'cover' | 'contain';
}) {
  const [
    localImageFailed,
    setLocalImageFailed,
  ] = useState(false);

  const [
    remoteImageFailed,
    setRemoteImageFailed,
  ] = useState(false);

  useEffect(() => {
    setLocalImageFailed(false);
  }, [localImageSource]);

  useEffect(() => {
    setRemoteImageFailed(false);
  }, [imageUrl]);

  const normalizedImageUrl =
    imageUrl?.trim() ?? '';

  const canShowLocalImage =
    Boolean(localImageSource) &&
    !localImageFailed;

  const canShowRemoteImage =
    !canShowLocalImage &&
    normalizedImageUrl.length > 0 &&
    !remoteImageFailed;

  const imageSource:
    | ImageSourcePropType
    | null =
    canShowLocalImage
      ? localImageSource
      : canShowRemoteImage
        ? {
            uri:
              normalizedImageUrl,
          }
        : null;

  return (
    <View
      style={[
        styles.artwork,
        {
          height: size,
          width: size,
        },
      ]}
    >
      {imageSource ? (
        <Image
          accessibilityIgnoresInvertColors
          resizeMode={resizeMode}
          source={imageSource}
          style={
            styles.artworkImage
          }
          onError={() => {
            if (canShowLocalImage) {
              setLocalImageFailed(
                true,
              );
              return;
            }

            setRemoteImageFailed(
              true,
            );
          }}
        />
      ) : (
        <Text
          style={
            styles.artworkFallback
          }
        >
          {fallback}
        </Text>
      )}
    </View>
  );
}

function SearchSuggestionArtwork({
  suggestion,
}: {
  suggestion: SearchCatalogSuggestion;
}) {
  const [
    localImageFailed,
    setLocalImageFailed,
  ] = useState(false);

  const [
    remoteImageFailed,
    setRemoteImageFailed,
  ] = useState(false);

  const localImageSource =
    getLocalCatalogCategoryImage(
      suggestion.storeCategorySlug,
      suggestion.sectionSlug,
    );

  useEffect(() => {
    setLocalImageFailed(false);
  }, [
    localImageSource,
    suggestion.sectionSlug,
    suggestion.storeCategorySlug,
  ]);

  useEffect(() => {
    setRemoteImageFailed(false);
  }, [suggestion.imageUrl]);

  const imageUrl =
    suggestion.imageUrl?.trim() ?? '';

  const canShowLocalImage =
    Boolean(localImageSource) &&
    !localImageFailed;

  const canShowRemoteImage =
    !canShowLocalImage &&
    imageUrl.length > 0 &&
    !remoteImageFailed;

  const imageSource:
    | ImageSourcePropType
    | null =
    canShowLocalImage
      ? localImageSource
      : canShowRemoteImage
        ? {
            uri: imageUrl,
          }
        : null;

  return (
    <View
      style={
        styles.discoveryArtwork
      }
    >
      {imageSource ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={
            `صورة قسم ${suggestion.name}`
          }
          resizeMode="contain"
          source={imageSource}
          style={
            styles.discoveryArtworkImage
          }
          onError={() => {
            if (canShowLocalImage) {
              setLocalImageFailed(
                true,
              );
              return;
            }

            setRemoteImageFailed(
              true,
            );
          }}
        />
      ) : (
        <View
          style={
            styles.discoveryArtworkFallback
          }
        >
          <Ionicons
            color="#777D79"
            name="grid-outline"
            size={18}
          />
        </View>
      )}
    </View>
  );
}

function SearchDiscoveryRail({
  items,
  onPressItem,
}: {
  items: readonly SearchCatalogSuggestion[];
  onPressItem: (
    item: SearchCatalogSuggestion,
  ) => void;
}) {
  const scrollRef =
    useRef<ScrollView | null>(null);

  const positionAtStart =
    useCallback(() => {
      scrollRef.current?.scrollToEnd({
        animated: false,
      });
    }, []);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      alwaysBounceHorizontal={false}
      bounces={false}
      contentContainerStyle={
        styles.discoveryRailContent
      }
      directionalLockEnabled
      keyboardShouldPersistTaps="handled"
      overScrollMode="never"
      showsHorizontalScrollIndicator={false}
      style={styles.discoveryRail}
      onContentSizeChange={
        positionAtStart
      }
    >
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityLabel={
            `فتح قسم ${item.name}`
          }
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.discoveryItem,
            pressed &&
              styles.discoveryItemPressed,
          ]}
          onPress={() => {
            onPressItem(item);
          }}
        >
          <SearchSuggestionArtwork
            suggestion={item}
          />

          <Text
            numberOfLines={2}
            style={
              styles.discoveryItemLabel
            }
          >
            {item.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}


function RestaurantDiscoveryArtwork({
  store,
}: {
  store: StoreSummary;
}) {
  const [failed, setFailed] =
    useState(false);

  useEffect(() => {
    setFailed(false);
  }, [
    store.logoUrl,
    store.coverImageUrl,
  ]);

  const imageUrl =
    store.logoUrl?.trim() ||
    store.coverImageUrl?.trim() ||
    '';

  const canShowImage =
    imageUrl.length > 0 &&
    !failed;

  return (
    <View style={styles.discoveryArtwork}>
      {canShowImage ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={`لوجو ${store.name}`}
          resizeMode="contain"
          source={{ uri: imageUrl }}
          style={styles.discoveryArtworkImage}
          onError={() => {
            setFailed(true);
          }}
        />
      ) : (
        <View style={styles.discoveryArtworkFallback}>
          <Text style={styles.restaurantFallbackText}>
            {store.icon || '🍽️'}
          </Text>
        </View>
      )}
    </View>
  );
}

function RestaurantDiscoveryRail({
  stores,
  onPressStore,
}: {
  stores: readonly StoreSummary[];
  onPressStore: (
    store: StoreSummary,
  ) => void;
}) {
  const scrollRef =
    useRef<ScrollView | null>(null);

  const positionAtStart =
    useCallback(() => {
      scrollRef.current?.scrollToEnd({
        animated: false,
      });
    }, []);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      alwaysBounceHorizontal={false}
      bounces={false}
      contentContainerStyle={
        styles.discoveryRailContent
      }
      directionalLockEnabled
      keyboardShouldPersistTaps="handled"
      overScrollMode="never"
      showsHorizontalScrollIndicator={false}
      style={styles.discoveryRail}
      onContentSizeChange={positionAtStart}
    >
      {stores.map((store) => (
        <Pressable
          key={store.id}
          accessibilityLabel={`فتح ${store.name}`}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.discoveryItem,
            pressed &&
              styles.discoveryItemPressed,
          ]}
          onPress={() => {
            onPressStore(store);
          }}
        >
          <RestaurantDiscoveryArtwork
            store={store}
          />

          <Text
            numberOfLines={2}
            style={styles.discoveryItemLabel}
          >
            {store.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function ResultSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.resultSection}>
      <Text style={styles.resultSectionTitle}>
        {title}
      </Text>

      <View style={styles.resultSectionBody}>
        {children}
      </View>
    </View>
  );
}

function SearchResultRow({
  result,
  onPress,
}: {
  result: GlobalSearchResult;
  onPress: () => void;
}) {
  if (result.kind === 'service') {
    return (
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.resultRow,
          pressed &&
            styles.resultRowPressed,
        ]}
        onPress={onPress}
      >
        <View
          style={
            styles.serviceResultArtwork
          }
        >
          <Ionicons
            color={
              NAVIENTY_NOW_COLORS.primaryDark
            }
            name={
              getServiceIconName(
                result.serviceKey,
              )
            }
            size={24}
          />
        </View>

        <View style={styles.resultCopy}>
          <Text
            numberOfLines={1}
            style={styles.resultTitle}
          >
            {result.title}
          </Text>

          <Text
            numberOfLines={1}
            style={styles.resultSubtitle}
          >
            {result.subtitle}
          </Text>
        </View>

        <Ionicons
          color="#A2AAA5"
          name="chevron-back"
          size={16}
        />
      </Pressable>
    );
  }

  if (result.kind === 'store') {
    return (
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.resultRow,
          pressed &&
            styles.resultRowPressed,
        ]}
        onPress={onPress}
      >
        <SearchArtwork
          fallback={
            result.icon || '🏪'
          }
          imageUrl={
            result.imageUrl
          }
          resizeMode="contain"
        />

        <View style={styles.resultCopy}>
          <View
            style={
              styles.resultTitleRow
            }
          >
            <Text
              numberOfLines={1}
              style={styles.resultTitle}
            >
              {result.title}
            </Text>

            {result.isManuallyClosed ? (
              <View
                style={
                  styles.closedBadge
                }
              >
                <Text
                  style={
                    styles.closedBadgeText
                  }
                >
                  مغلق
                </Text>
              </View>
            ) : null}
          </View>

          <Text
            numberOfLines={1}
            style={styles.resultSubtitle}
          >
            {[
              result.subtitle,
              result.deliveryTime,
              result.rating > 0
                ? `★ ${result.rating.toFixed(1)}`
                : '',
            ]
              .filter(Boolean)
              .join(' • ')}
          </Text>
        </View>

        <Ionicons
          color="#A2AAA5"
          name="chevron-back"
          size={16}
        />
      </Pressable>
    );
  }

  if (result.kind === 'category') {
    return (
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.resultRow,
          pressed &&
            styles.resultRowPressed,
        ]}
        onPress={onPress}
      >
        <SearchArtwork
          fallback="▦"
          imageUrl={
            result.imageUrl
          }
          localImageSource={
            getLocalCatalogCategoryImage(
              result.storeCategorySlug,
              result.sectionSlug,
            )
          }
          resizeMode="contain"
        />

        <View style={styles.resultCopy}>
          <Text
            numberOfLines={1}
            style={styles.resultTitle}
          >
            {result.title}
          </Text>

          <Text
            numberOfLines={1}
            style={styles.resultSubtitle}
          >
            {result.storeName}
          </Text>
        </View>

        <Ionicons
          color="#A2AAA5"
          name="chevron-back"
          size={16}
        />
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.resultRow,
        pressed &&
          styles.resultRowPressed,
      ]}
      onPress={onPress}
    >
      <SearchArtwork
        fallback={
          result.icon || '📦'
        }
        imageUrl={
          result.imageUrl
        }
      />

      <View style={styles.resultCopy}>
        <Text
          numberOfLines={1}
          style={styles.resultTitle}
        >
          {result.title}
        </Text>

        <Text
          numberOfLines={1}
          style={styles.resultSubtitle}
        >
          {result.storeName}
          {' • '}
          {result.categoryName}
        </Text>
      </View>

      <View
        style={
          styles.productPriceWrap
        }
      >
        <Text
          style={
            styles.productPrice
          }
        >
          {formatMoney(
            result.price,
          )}
        </Text>

        {result.compareAtPrice !==
          null &&
        result.compareAtPrice >
          result.price ? (
          <Text
            style={
              styles.productComparePrice
            }
          >
            {formatMoney(
              result.compareAtPrice,
            )}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function SearchScreen() {
  const router = useRouter();

  const savedServiceAreaId =
    useCustomerStore(
      (state) =>
        state.locationServiceAreaId,
    );

  const inputRef =
    useRef<TextInput>(null);

  const searchRequestIdRef =
    useRef(0);

  const currentSearchSessionIdRef =
    useRef<string | null>(null);

  const [query, setQuery] =
    useState('');

  const [
    serviceAreaId,
    setServiceAreaId,
  ] = useState<string | null>(
    savedServiceAreaId,
  );

  const [
    isPreparing,
    setIsPreparing,
  ] = useState(true);

  const [
    isSearching,
    setIsSearching,
  ] = useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [
    results,
    setResults,
  ] = useState<
    GlobalSearchResult[]
  >([]);

  const [
    failedStoreCount,
    setFailedStoreCount,
  ] = useState(0);

  const [
    recentSearches,
    setRecentSearches,
  ] = useState<string[]>([]);

  const [
    availableStores,
    setAvailableStores,
  ] = useState<StoreSummary[]>([]);

  const [
    catalogSuggestions,
    setCatalogSuggestions,
  ] = useState<
    SearchCatalogSuggestion[]
  >([]);

  const [
    activeCategoryIdsByStore,
    setActiveCategoryIdsByStore,
  ] = useState<
    ActiveCategoryIdsByStore
  >(() => new Map());

  const [
    activeSuggestionIndex,
    setActiveSuggestionIndex,
  ] = useState(0);

  const [
    selectedTab,
    setSelectedTab,
  ] = useState<SearchTabKey>(
    'restaurants',
  );

  const normalizedQuery =
    query.trim();

  const visibleResults =
    useMemo(
      () =>
        results.filter(
          (result) =>
            doesResultMatchSearchTab(
              result,
              selectedTab,
              activeCategoryIdsByStore,
            ),
        ),
      [
        results,
        selectedTab,
        activeCategoryIdsByStore,
      ],
    );

  const groupedResults =
    useMemo(
      () =>
        groupResults(
          visibleResults,
        ),
      [visibleResults],
    );

  const suggestionsForSelectedTab =
    useMemo(
      () =>
        catalogSuggestions.filter(
          (suggestion) =>
            doesSuggestionMatchSearchTab(
              suggestion,
              selectedTab,
            ),
        ),
      [
        catalogSuggestions,
        selectedTab,
      ],
    );

  const placeholderSuggestions =
    useMemo(() => {
      const nested =
        suggestionsForSelectedTab.filter(
          (suggestion) =>
            suggestion.depth > 0,
        );

      return nested.length > 0
        ? nested
        : suggestionsForSelectedTab;
    }, [suggestionsForSelectedTab]);

  const discoverySuggestions =
    useMemo(
      () =>
        suggestionsForSelectedTab
          .filter(
            (suggestion) =>
              suggestion.depth === 0,
          )
          .slice(
            0,
            SEARCH_DISCOVERY_LIMIT,
          ),
      [suggestionsForSelectedTab],
    );

  const restaurantStores =
    useMemo(
      () =>
        availableStores
          .filter(
            (store) =>
              getSearchTabForCategorySlug(
                store.categorySlug,
              ) === 'restaurants',
          )
          .sort((first, second) => {
            if (
              first.isManuallyClosed !==
              second.isManuallyClosed
            ) {
              return first.isManuallyClosed
                ? 1
                : -1;
            }

            if (
              first.isFeatured !==
              second.isFeatured
            ) {
              return first.isFeatured
                ? -1
                : 1;
            }

            return first.name.localeCompare(
              second.name,
              'ar',
            );
          })
          .slice(
            0,
            SEARCH_DISCOVERY_LIMIT,
          ),
      [availableStores],
    );

  const activePlaceholderName =
    placeholderSuggestions[
      activeSuggestionIndex %
        Math.max(
          1,
          placeholderSuggestions.length,
        )
    ]?.name ??
      (selectedTab === 'restaurants'
        ? 'بيتزا'
        : 'منتج');

  const discoveryTitle =
    getDiscoveryTitle(selectedTab);

  const hasDiscoveryItems =
    selectedTab === 'restaurants'
      ? restaurantStores.length > 0
      : discoverySuggestions.length > 0;

  const hasSearchQuery =
    normalizedQuery.length >= 2;

  const storeResultsTitle =
    selectedTab === 'restaurants'
      ? 'المطاعم'
      : 'المتاجر';

  useEffect(() => {
    let active = true;

    async function loadSearchContext() {
      try {
        const [
          bootstrap,
          storedRecents,
        ] = await Promise.all([
          getAppBootstrap(),
          getRecentSearches(
            MAX_RECENT_SEARCHES,
          ),
        ]);

        if (!active) {
          return;
        }

        const resolvedServiceAreaId =
          savedServiceAreaId ||
          bootstrap.settings
            .default_service_area_id ||
          null;

        setServiceAreaId(
          resolvedServiceAreaId,
        );

        setRecentSearches(
          storedRecents,
        );

        const loadedStores =
          await listStores({
            serviceAreaId:
              resolvedServiceAreaId ??
              undefined,
          });

        setAvailableStores(
          loadedStores,
        );

        const activeCategoryIds =
          await loadActiveCatalogCategoryIds(
            loadedStores,
          );

        const [
          suggestions,
        ] = await Promise.all([
          loadSearchCatalogSuggestions(
            loadedStores,
            resolvedServiceAreaId,
            activeCategoryIds,
          ),
          prepareGlobalSearchIndex(
            resolvedServiceAreaId,
          ),
        ]);

        if (!active) {
          return;
        }

        setActiveCategoryIdsByStore(
          activeCategoryIds,
        );

        setCatalogSuggestions(
          suggestions,
        );
      } catch (error) {
        if (!active) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'تعذر تجهيز البحث.',
        );
      } finally {
        if (active) {
          setIsPreparing(false);
        }
      }
    }

    void loadSearchContext();

    const focusTimer =
      setTimeout(() => {
        inputRef.current?.focus();
      }, 120);

    return () => {
      active = false;
      clearTimeout(focusTimer);
    };
  }, [
    savedServiceAreaId,
  ]);

  useEffect(() => {
    setActiveSuggestionIndex(0);

    if (
      query.length > 0 ||
      placeholderSuggestions.length <= 1
    ) {
      return;
    }

    const timer = setInterval(() => {
      setActiveSuggestionIndex(
        (currentIndex) =>
          (currentIndex + 1) %
          placeholderSuggestions.length,
      );
    }, SEARCH_PLACEHOLDER_ROTATION_MS);

    return () => {
      clearInterval(timer);
    };
  }, [
    query.length,
    placeholderSuggestions,
  ]);

  useEffect(() => {
    const requestId =
      searchRequestIdRef.current +
      1;

    searchRequestIdRef.current =
      requestId;

    if (!hasSearchQuery) {
      currentSearchSessionIdRef.current =
        null;

      setResults([]);
      setIsSearching(false);
      setFailedStoreCount(0);
      setErrorMessage(null);
      return;
    }

    const timer =
      setTimeout(() => {
        async function executeSearch() {
          try {
            setIsSearching(true);
            setErrorMessage(null);

            const searchSessionId =
              createAnalyticsCorrelationId(
                'search',
              );

            const response =
              await searchGlobalCatalog(
                normalizedQuery,
                serviceAreaId,
              );

            if (
              searchRequestIdRef.current !==
              requestId
            ) {
              return;
            }

            currentSearchSessionIdRef.current =
              searchSessionId;

            setResults(
              response.results,
            );

            setFailedStoreCount(
              response.failedStoreCount,
            );

            const analyticsQuery =
              sanitizeSearchQueryForAnalytics(
                normalizedQuery,
              );

            void trackBehaviorEvent({
              eventName:
                'search_performed',
              searchSessionId,
              serviceAreaId,
              properties: {
                query:
                  analyticsQuery,
                result_count:
                  response.results.length,
                failed_store_count:
                  response.failedStoreCount,
                indexed_store_count:
                  response.indexedStoreCount,
              },
            });

            if (
              response.results.length ===
              0
            ) {
              void trackBehaviorEvent({
                eventName:
                  'search_zero_results',
                searchSessionId,
                serviceAreaId,
                properties: {
                  query:
                    analyticsQuery,
                  failed_store_count:
                    response.failedStoreCount,
                  indexed_store_count:
                    response.indexedStoreCount,
                },
              });
            }
          } catch (error) {
            if (
              searchRequestIdRef.current !==
              requestId
            ) {
              return;
            }

            setResults([]);
            setFailedStoreCount(0);
            setErrorMessage(
              error instanceof Error
                ? error.message
                : 'تعذر البحث حاليًا.',
            );
          } finally {
            if (
              searchRequestIdRef.current ===
              requestId
            ) {
              setIsSearching(false);
            }
          }
        }

        void executeSearch();
      }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [
    hasSearchQuery,
    normalizedQuery,
    serviceAreaId,
  ]);

  const saveRecentSearch =
    useCallback(
      async (
        value: string,
      ) => {
        const next =
          await persistRecentSearch(
            value,
            MAX_RECENT_SEARCHES,
          );

        setRecentSearches(next);
      },
      [],
    );

  function openService(
    serviceKey:
      GlobalSearchServiceKey,
  ) {
    switch (serviceKey) {
      case 'restaurants':
        router.push(
          '/category/restaurants',
        );
        return;

      case 'supermarket':
        router.push(
          '/category/supermarket',
        );
        return;

      case 'bookstore':
        router.push(
          '/category/bookstore',
        );
        return;

      case 'personal-care':
        router.push(
          '/category/personal-care',
        );
        return;

      case 'laundry':
        router.push(
          '/category/laundry',
        );
        return;

      case 'request-anything':
        router.push(
          '/category/request-anything',
        );
        return;
    }
  }

  function openStore(
    storeId: string,
    storeCategorySlug: string,
  ) {
    const destinationTab =
      getSearchTabForCategorySlug(
        storeCategorySlug,
      );

    if (destinationTab === 'restaurants') {
      router.push({
        pathname: '/store/[id]',
        params: {
          id: storeId,
        },
      });
      return;
    }

    if (destinationTab === 'supermarket') {
      router.push({
        pathname:
          '/category/supermarket',
        params: {
          storeId,
        },
      });
      return;
    }

    if (destinationTab === 'bookstore') {
      router.push({
        pathname:
          '/category/bookstore',
        params: {
          storeId,
        },
      });
      return;
    }

    if (destinationTab === 'personal-care') {
      router.push({
        pathname:
          '/category/personal-care',
        params: {
          storeId,
        },
      });
      return;
    }

    router.push({
      pathname: '/store/[id]',
      params: {
        id: storeId,
      },
    });
  }

  /**
   * Discovery cards are category shortcuts, so route them directly to the
   * destination screen instead of fabricating a GlobalSearchResult first.
   * This mirrors the working deep links used by Home discovery.
   */
  function openDiscoveryCategory(
    item: SearchCatalogSuggestion,
  ) {
    const destinationTab =
      getSearchTabForCategorySlug(
        item.storeCategorySlug,
      ) ?? selectedTab;

    const sectionSlug =
      item.sectionSlug.trim();

    if (!sectionSlug) {
      return;
    }

    if (destinationTab === 'supermarket') {
      router.push({
        pathname:
          '/supermarket-category/[slug]',
        params: {
          slug: sectionSlug,
          categoryKey: sectionSlug,
          label: item.name,
        },
      });
      return;
    }

    if (destinationTab === 'bookstore') {
      router.push({
        pathname:
          '/bookstore-category/[slug]',
        params: {
          slug: sectionSlug,
          categoryKey: sectionSlug,
          label: item.name,
        },
      });
      return;
    }

    if (destinationTab === 'personal-care') {
      router.push({
        pathname:
          '/personal-care-category/[slug]',
        params: {
          slug: sectionSlug,
          categoryKey: sectionSlug,
          label: item.name,
        },
      });
      return;
    }

    if (destinationTab === 'restaurants') {
      router.push({
        pathname: '/store/[id]',
        params: {
          id: item.storeId,
        },
      });
    }
  }

  function openCatalogSection(
    result:
      | Extract<
          GlobalSearchResult,
          {
            kind: 'category';
          }
        >
      | Extract<
          GlobalSearchResult,
          {
            kind: 'product';
          }
        >,
  ) {
    const destinationTab =
      getSearchTabForCategorySlug(
        result.storeCategorySlug,
      );

    const sectionSlug =
      result.sectionSlug.trim();

    if (!sectionSlug) {
      openStore(
        result.storeId,
        result.storeCategorySlug,
      );
      return;
    }

    if (destinationTab === 'restaurants') {
      router.push({
        pathname: '/store/[id]',
        params: {
          id: result.storeId,
        },
      });
      return;
    }

    const label =
      result.kind === 'category'
        ? result.title
        : result.categoryName;

    if (destinationTab === 'supermarket') {
      router.push({
        pathname:
          '/supermarket-category/[slug]',
        params: {
          slug: sectionSlug,
          categoryKey: sectionSlug,
          label,
        },
      });
      return;
    }

    if (destinationTab === 'bookstore') {
      router.push({
        pathname:
          '/bookstore-category/[slug]',
        params: {
          slug: sectionSlug,
          categoryKey: sectionSlug,
          label,
        },
      });
      return;
    }

    if (destinationTab === 'personal-care') {
      router.push({
        pathname:
          '/personal-care-category/[slug]',
        params: {
          slug: sectionSlug,
          categoryKey: sectionSlug,
          label,
        },
      });
      return;
    }

    openStore(
      result.storeId,
      result.storeCategorySlug,
    );
  }

  async function openResult(
    result: GlobalSearchResult,
  ) {
    Keyboard.dismiss();

    await saveRecentSearch(
      normalizedQuery,
    );

    const searchSessionId =
      currentSearchSessionIdRef.current ??
      createAnalyticsCorrelationId(
        'search',
      );

    const resultRank =
      Math.max(
        1,
        results.findIndex(
          (candidate) =>
            candidate.id ===
            result.id,
        ) + 1,
      );

    const analyticsQuery =
      sanitizeSearchQueryForAnalytics(
        normalizedQuery,
      );

    const resultStoreId =
      result.kind === 'service'
        ? null
        : result.storeId;

    const resultStoreCategorySlug =
      result.kind === 'service'
        ? result.serviceKey
        : result.storeCategorySlug;

    const resultProductId =
      result.kind === 'product'
        ? result.productId
        : null;

    const resultSectionId =
      result.kind === 'category' ||
      result.kind === 'product'
        ? result.sectionId
        : null;

    const resultSectionSlug =
      result.kind === 'category' ||
      result.kind === 'product'
        ? result.sectionSlug
        : null;

    void trackBehaviorEvent({
      eventName:
        'search_result_clicked',
      searchSessionId,
      serviceAreaId,
      properties: {
        query:
          analyticsQuery,
        result_id:
          result.id,
        result_type:
          result.kind,
        result_rank:
          resultRank,
        store_id:
          resultStoreId,
        store_category_slug:
          resultStoreCategorySlug,
        product_id:
          resultProductId,
        section_id:
          resultSectionId,
        section_slug:
          resultSectionSlug,
      },
    });

    void setSearchAttribution({
      searchSessionId,
      query:
        analyticsQuery,
      resultId:
        result.id,
      resultKind:
        result.kind,
      resultRank,
      storeId:
        resultStoreId,
      storeCategorySlug:
        resultStoreCategorySlug,
      productId:
        resultProductId,
      sectionId:
        resultSectionId,
      sectionSlug:
        resultSectionSlug,
      clickedAt:
        new Date().toISOString(),
    });

    if (result.kind === 'store') {
      await recordRecentlyViewed({
        entityId: result.storeId,
        kind: 'store',
        title: result.title,
        subtitle: result.subtitle,
        imageUrl: result.imageUrl,
        icon: result.icon,
        storeId: result.storeId,
        storeCategorySlug:
          result.storeCategorySlug,
        sectionId: null,
        sectionSlug: null,
        price: null,
      });
    } else if (
      result.kind === 'category'
    ) {
      await recordRecentlyViewed({
        entityId: result.sectionId,
        kind: 'category',
        title: result.title,
        subtitle: result.storeName,
        imageUrl: result.imageUrl,
        icon: '▦',
        storeId: result.storeId,
        storeCategorySlug:
          result.storeCategorySlug,
        sectionId: result.sectionId,
        sectionSlug: result.sectionSlug,
        price: null,
      });
    } else if (
      result.kind === 'product'
    ) {
      await recordRecentlyViewed({
        entityId: result.id,
        kind: 'product',
        title: result.title,
        subtitle: result.storeName,
        imageUrl: result.imageUrl,
        icon: result.icon,
        storeId: result.storeId,
        storeCategorySlug:
          result.storeCategorySlug,
        sectionId: result.sectionId,
        sectionSlug: result.sectionSlug,
        price: result.price,
      });
    }

    switch (result.kind) {
      case 'service':
        openService(
          result.serviceKey,
        );
        return;

      case 'store':
        openStore(
          result.storeId,
          result.storeCategorySlug,
        );
        return;

      case 'category':
      case 'product':
        openCatalogSection(
          result,
        );
        return;
    }
  }

  async function clearRecentSearches() {
    setRecentSearches([]);
    await clearRecentSearchHistory();
  }

  const hasResults =
    visibleResults.length > 0;

  return (
    <SafeAreaView
      edges={['top']}
      style={styles.screen}
    >
      <StatusBar
        style="dark"
      />

      <View style={styles.header}>
        <Pressable
          accessibilityLabel="رجوع"
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [
            styles.backButton,
            pressed &&
              styles.backButtonPressed,
          ]}
          onPress={() => {
            router.back();
          }}
        >
          <Ionicons
            color={
              NAVIENTY_NOW_COLORS.text
            }
            name="arrow-forward-outline"
            size={20}
          />
        </Pressable>

        <View
          style={
            styles.searchInputShell
          }
        >
          <Ionicons
            color="#999999"
            name="search-outline"
            size={19}
          />

          <View
            style={
              styles.searchFieldWrap
            }
          >
            {query.length === 0 ? (
              <View
                pointerEvents="none"
                style={
                  styles.searchPlaceholderOverlay
                }
              >
                <Text
                  numberOfLines={1}
                  style={
                    styles.searchPlaceholderText
                  }
                >
                  <Text
                    style={
                      styles.searchPlaceholderFixed
                    }
                  >
                    ابحث عن{' '}
                  </Text>
                  <Text
                    style={
                      styles.searchPlaceholderDynamic
                    }
                  >
                    {activePlaceholderName}
                  </Text>
                </Text>
              </View>
            ) : null}

            <TextInput
              ref={inputRef}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="never"
              enterKeyHint="search"
              placeholder=""
              returnKeyType="search"
              selectionColor={
                NAVIENTY_NOW_COLORS.primary
              }
              style={
                styles.searchInput
              }
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => {
                void saveRecentSearch(
                  normalizedQuery,
                );
              }}
            />
          </View>

          {query.length > 0 ? (
            <Pressable
              accessibilityLabel="مسح البحث"
              accessibilityRole="button"
              hitSlop={8}
              style={({ pressed }) => [
                styles.clearButton,
                pressed &&
                  styles.clearButtonPressed,
              ]}
              onPress={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
            >
              <Ionicons
                color="#858585"
                name="close-circle"
                size={20}
              />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.searchTabsBar}>
        {SEARCH_TABS.map((tab) => {
          const isActive =
            selectedTab === tab.key;

          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.searchTab,
                isActive &&
                  styles.searchTabActive,
                pressed &&
                  styles.searchTabPressed,
              ]}
              onPress={() => {
                setSelectedTab(tab.key);
              }}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.searchTabText,
                  isActive &&
                    styles.searchTabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={
          styles.pageContent
        }
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!hasSearchQuery ? (
          <>
            {isPreparing ||
            hasDiscoveryItems ? (
              <View
                style={
                  styles.discoverySection
                }
              >
                <Text
                  style={
                    styles.discoverySectionTitle
                  }
                >
                  {discoveryTitle}
                </Text>

                {hasDiscoveryItems ? (
                  selectedTab === 'restaurants' ? (
                    <RestaurantDiscoveryRail
                      stores={restaurantStores}
                      onPressStore={(store) => {
                        Keyboard.dismiss();
                        openStore(
                          store.id,
                          store.categorySlug,
                        );
                      }}
                    />
                  ) : (
                    <SearchDiscoveryRail
                      items={
                        discoverySuggestions
                      }
                      onPressItem={(item) => {
                        Keyboard.dismiss();
                        openDiscoveryCategory(
                          item,
                        );
                      }}
                    />
                  )
                ) : (
                  <View
                    style={
                      styles.discoveryLoadingRow
                    }
                  >
                    {[0, 1, 2, 3].map(
                      (item) => (
                        <View
                          key={item}
                          style={
                            styles.discoveryLoadingItem
                          }
                        >
                          <View
                            style={
                              styles.discoveryLoadingCircle
                            }
                          />
                          <View
                            style={
                              styles.discoveryLoadingLabel
                            }
                          />
                        </View>
                      ),
                    )}
                  </View>
                )}
              </View>
            ) : null}

            {recentSearches.length > 0 ? (
              <View
                style={
                  styles.recentSection
                }
              >
                <View
                  style={
                    styles.recentSectionHeader
                  }
                >
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => {
                      void clearRecentSearches();
                    }}
                  >
                    <Text
                      style={
                        styles.clearRecentsText
                      }
                    >
                      مسح
                    </Text>
                  </Pressable>

                  <Text
                    style={
                      styles.recentSectionTitle
                    }
                  >
                    ما بحثت عنه مؤخرًا
                  </Text>
                </View>

                <View
                  style={
                    styles.recentChips
                  }
                >
                  {recentSearches.map(
                    (item) => (
                      <Pressable
                        key={item}
                        accessibilityRole="button"
                        style={({ pressed }) => [
                          styles.recentChip,
                          pressed &&
                            styles.recentChipPressed,
                        ]}
                        onPress={() => {
                          setQuery(item);
                          inputRef.current?.focus();
                        }}
                      >
                        <Ionicons
                          color="#303030"
                          name="time-outline"
                          size={14}
                        />

                        <Text
                          numberOfLines={1}
                          style={
                            styles.recentChipText
                          }
                        >
                          {item}
                        </Text>
                      </Pressable>
                    ),
                  )}
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        {hasSearchQuery &&
        (isSearching ||
          isPreparing) ? (
          <View
            style={
              styles.searchingState
            }
          >
            <ActivityIndicator
              color={
                NAVIENTY_NOW_COLORS.primary
              }
              size="small"
            />

            <Text
              style={
                styles.searchingStateText
              }
            >
              بندور في المتاجر والمنتجات...
            </Text>
          </View>
        ) : null}

        {hasSearchQuery &&
        errorMessage &&
        !isSearching ? (
          <View
            style={
              styles.errorCard
            }
          >
            <Ionicons
              color="#A33A3A"
              name="alert-circle-outline"
              size={22}
            />

            <View
              style={
                styles.errorCardCopy
              }
            >
              <Text
                style={
                  styles.errorCardTitle
                }
              >
                تعذر إكمال البحث
              </Text>

              <Text
                style={
                  styles.errorCardText
                }
              >
                {errorMessage}
              </Text>
            </View>
          </View>
        ) : null}

        {hasSearchQuery &&
        !isSearching &&
        !isPreparing &&
        !errorMessage &&
        !hasResults ? (
          <View
            style={
              styles.emptyState
            }
          >
            <View
              style={
                styles.emptyStateIcon
              }
            >
              <Ionicons
                color="#7A837D"
                name="search-outline"
                size={23}
              />
            </View>

            <Text
              style={
                styles.emptyStateTitle
              }
            >
              ملقيناش نتيجة لـ “{normalizedQuery}”
            </Text>

            <Text
              style={
                styles.emptyStateText
              }
            >
              جرّب اسم أقصر، اسم المتجر، أو نوع الحاجة اللي بتدور عليها.
            </Text>
          </View>
        ) : null}

        {hasSearchQuery &&
        hasResults ? (
          <View
            style={
              styles.resultsContainer
            }
          >
            {failedStoreCount >
            0 ? (
              <View
                style={
                  styles.partialNotice
                }
              >
                <Ionicons
                  color="#7A6330"
                  name="information-circle-outline"
                  size={17}
                />

                <Text
                  style={
                    styles.partialNoticeText
                  }
                >
                  بعض الكتالوجات تعذر تحميلها مؤقتًا، فالنتائج المتاحة قد تكون جزئية.
                </Text>
              </View>
            ) : null}

            {groupedResults.stores
              .length > 0 ? (
              <ResultSection title={storeResultsTitle}>
                {groupedResults.stores.map(
                  (result) => (
                    <SearchResultRow
                      key={result.id}
                      result={result}
                      onPress={() => {
                        void openResult(
                          result,
                        );
                      }}
                    />
                  ),
                )}
              </ResultSection>
            ) : null}

            {groupedResults.categories
              .length > 0 ? (
              <ResultSection title="الأقسام">
                {groupedResults.categories.map(
                  (result) => (
                    <SearchResultRow
                      key={result.id}
                      result={result}
                      onPress={() => {
                        void openResult(
                          result,
                        );
                      }}
                    />
                  ),
                )}
              </ResultSection>
            ) : null}

            {groupedResults.products
              .length > 0 ? (
              <ResultSection title="المنتجات">
                {groupedResults.products.map(
                  (result) => (
                    <SearchResultRow
                      key={result.id}
                      result={result}
                      onPress={() => {
                        void openResult(
                          result,
                        );
                      }}
                    />
                  ),
                )}
              </ResultSection>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },

  header: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row-reverse',
    gap: 7,
    paddingBottom: 7,
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
    paddingTop: 4,
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

  backButtonPressed: {
    backgroundColor: '#F6F6F6',
    opacity: 0.76,
  },

  searchInputShell: {
    alignItems: 'center',
    backgroundColor: '#F6F6F6',
    borderColor: '#E4E4E4',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    flexDirection: 'row-reverse',
    height: 42,
    paddingHorizontal: 12,
  },

  searchFieldWrap: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    marginHorizontal: 6,
    position: 'relative',
  },

  searchPlaceholderOverlay: {
    alignItems: 'flex-end',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },

  searchPlaceholderText: {
    color: '#303030',
    fontSize: 12.5,
    fontWeight: '500',
    letterSpacing: -0.1,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  searchPlaceholderFixed: {
    color: '#303030',
    fontWeight: '500',
  },

  searchPlaceholderDynamic: {
    color: '#626262',
    fontWeight: '500',
  },

  searchInput: {
    color:
      NAVIENTY_NOW_COLORS.text,
    flex: 1,
    fontSize: 12.5,
    fontWeight: '500',
    paddingVertical: 0,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  clearButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  clearButtonPressed: {
    opacity: 0.55,
  },

  searchTabsBar: {
    alignItems: 'stretch',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#ECECEC',
    borderBottomWidth:
      StyleSheet.hairlineWidth,
    flexDirection: 'row-reverse',
    height: 40,
    paddingHorizontal: 5,
  },

  searchTab: {
    alignItems: 'center',
    borderBottomColor: 'transparent',
    borderBottomWidth: 2,
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 3,
    paddingTop: 2,
  },

  searchTabActive: {
    borderBottomColor: '#202020',
  },

  searchTabPressed: {
    opacity: 0.65,
  },

  searchTabText: {
    color: '#757575',
    fontSize: 12.5,
    fontWeight: '500',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  searchTabTextActive: {
    color: '#161616',
    fontWeight: '800',
  },

  pageContent: {
    paddingBottom: 48,
  },

  discoverySection: {
    marginTop: 18,
  },

  discoverySectionTitle: {
    color: '#202020',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  discoveryRail: {
    marginTop: 10,
  },

  discoveryRailContent: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    gap: 12,
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
  },

  discoveryItem: {
    alignItems: 'center',
    flexShrink: 0,
    width: 60,
  },

  discoveryItemPressed: {
    opacity: 0.72,
    transform: [
      {
        scale: 0.975,
      },
    ],
  },

  discoveryArtwork: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E8E8E8',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 58,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 4,
    width: 58,
  },

  discoveryArtworkImage: {
    height: '100%',
    width: '100%',
  },

  restaurantFallbackText: {
    fontSize: 20,
  },

  discoveryArtworkFallback: {
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },

  discoveryItemLabel: {
    color: '#5F5F5F',
    fontSize: 11.5,
    fontWeight: '500',
    lineHeight: 15,
    marginTop: 6,
    minHeight: 30,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  discoveryLoadingRow: {
    flexDirection: 'row-reverse',
    gap: 12,
    marginTop: 10,
    overflow: 'hidden',
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
  },

  discoveryLoadingItem: {
    alignItems: 'center',
    width: 60,
  },

  discoveryLoadingCircle: {
    backgroundColor: '#F1F1F1',
    borderRadius: 999,
    height: 58,
    width: 58,
  },

  discoveryLoadingLabel: {
    backgroundColor: '#F0F0F0',
    borderRadius: 999,
    height: 8,
    marginTop: 7,
    width: 44,
  },

  recentSection: {
    marginTop: 22,
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
  },

  recentSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent:
      'space-between',
  },

  recentSectionTitle: {
    color: '#202020',
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: -0.2,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  clearRecentsText: {
    color: '#7D7D7D',
    fontSize: 11,
    fontWeight: '700',
  },

  recentChips: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 11,
  },

  recentChip: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E0E0E0',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row-reverse',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },

  recentChipPressed: {
    backgroundColor: '#F7F7F7',
    opacity: 0.8,
  },

  recentChipText: {
    color: '#2B2B2B',
    fontSize: 12.5,
    fontWeight: '600',
    maxWidth: 200,
    writingDirection: 'rtl',
  },

  searchingState: {
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    minHeight: 150,
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
  },

  searchingStateText: {
    color: '#677069',
    fontSize: 12.5,
    fontWeight: '600',
  },

  errorCard: {
    alignItems: 'flex-start',
    alignSelf: 'center',
    backgroundColor: '#FFF2F2',
    borderRadius: 14,
    flexDirection: 'row-reverse',
    gap: 9,
    marginHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
    marginTop: 18,
    padding: 12,
  },

  errorCardCopy: {
    flex: 1,
  },

  errorCardTitle: {
    color: '#8F3232',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },

  errorCardText: {
    color: '#8F5555',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 3,
    textAlign: 'right',
  },

  emptyState: {
    alignItems: 'center',
    minHeight: 230,
    paddingHorizontal: 26,
    paddingTop: 42,
  },

  emptyStateIcon: {
    alignItems: 'center',
    backgroundColor: '#F2F3F2',
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },

  emptyStateTitle: {
    color:
      NAVIENTY_NOW_COLORS.text,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 13,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  emptyStateText: {
    color:
      NAVIENTY_NOW_COLORS.textMuted,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 7,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  resultsContainer: {
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
    paddingTop: 10,
  },

  partialNotice: {
    alignItems: 'flex-start',
    backgroundColor: '#FFF8E9',
    borderRadius: 14,
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: 10,
    padding: 11,
  },

  partialNoticeText: {
    color: '#7A6330',
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 17,
    textAlign: 'right',
  },

  resultSection: {
    marginTop: 14,
  },

  resultSectionTitle: {
    color:
      NAVIENTY_NOW_COLORS.text,
    fontSize: 14.5,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  resultSectionBody: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E9E9E9',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },

  resultRow: {
    alignItems: 'center',
    borderBottomColor: '#EFEFEF',
    borderBottomWidth:
      StyleSheet.hairlineWidth,
    flexDirection: 'row-reverse',
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  resultRowPressed: {
    backgroundColor: '#F7FAF8',
  },

  artwork: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E9E9E9',
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 2,
  },

  artworkImage: {
    height: '100%',
    width: '100%',
  },

  artworkFallback: {
    fontSize: 17,
  },

  serviceResultArtwork: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPale,
    borderRadius: 11,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },

  resultCopy: {
    flex: 1,
    minWidth: 0,
  },

  resultTitleRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 7,
  },

  resultTitle: {
    color:
      NAVIENTY_NOW_COLORS.text,
    flexShrink: 1,
    fontSize: 12.5,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  resultSubtitle: {
    color:
      NAVIENTY_NOW_COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  closedBadge: {
    backgroundColor: '#F3F4F3',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },

  closedBadgeText: {
    color: '#777D79',
    fontSize: 9.5,
    fontWeight: '800',
  },

  productPriceWrap: {
    alignItems: 'flex-start',
    minWidth: 62,
  },

  productPrice: {
    color:
      NAVIENTY_NOW_COLORS.primaryDark,
    fontSize: 11,
    fontWeight: '900',
  },

  productComparePrice: {
    color: '#A0A6A2',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    textDecorationLine:
      'line-through',
  },
});

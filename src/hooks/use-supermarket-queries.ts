import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  findCatalogSectionBySlug,
  type CatalogSection,
  type StoreCatalog,
} from '../services/catalog-service';
import {
  findStorefrontCategoryTile,
  getStorefrontTileCategoryImages,
  listStorefrontCategoryTiles,
} from '../services/storefront-category-service';
import {
  getSupermarketHomeSnapshot,
  getSupermarketHomePreviewProducts,
  type SupermarketHomeSnapshot,
} from '../services/supermarket-home-service';
import {
  getFastSupermarketCategoryContext,
  getFastSupermarketCategoryPage,
  normalizeSupermarketCategoryContext,
  SUPERMARKET_CATEGORY_PAGE_SIZE,
} from '../services/supermarket-category-fast-service';

type SupermarketCategoryContext = {
  catalog: StoreCatalog;
  currencyCode: string;
  offerRootCategoryIds: string[];
};

type SupermarketCategoryData = {
  catalog: StoreCatalog;
  selectedSection: CatalogSection | null;
  currencyCode: string;
  rootCategoryImageUrl: string | null;
  categoryImageOverrides: Record<string, string>;
  offerRootCategoryIds: string[];
};

type CategoryQueryOptions = {
  serviceAreaId: string | null;
  requestedStoreId: string | null;
  sectionSlug: string;
  categoryKey: string | null;
};

/**
 * Both hooks cache public data by service area (and store/category when
 * applicable). A failed refresh retains the last successful query data.
 * Data is restored from disk by the root PersistQueryClientProvider.
 */
export function useSupermarketHomeQuery(serviceAreaId: string | null) {
  return useQuery({
    // Versioned key prevents old persisted 4.5 MB catalog home data from
    // hydrating a lightweight home shell with a different response shape.
    queryKey: ['public', 'supermarket', 'home-shell-v2', serviceAreaId ?? '*'],
    queryFn: () => getSupermarketHomeSnapshot(serviceAreaId),
    staleTime: 90_000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    meta: { persist: true },
  });
}

/** Independent query for the small number of promo and reorder card items. */
export function useSupermarketHomePreviewProductsQuery(
  storeId: string | null,
  productIds: readonly string[],
) {
  return useQuery({
    queryKey: ['public', 'supermarket', 'home-previews', storeId ?? '*', productIds],
    queryFn: () => getSupermarketHomePreviewProducts(storeId!, productIds),
    enabled: Boolean(storeId) && productIds.length > 0,
    staleTime: 60_000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    // Product prices and availability should not be persisted indefinitely.
    meta: { persist: false },
  });
}

/**
 * Public category metadata and optional artwork are independent queries.
 * The product list has a separate paginated feed, so the header never waits
 * for thousands of products before opening.
 */
export function useSupermarketCategoryQuery(options: CategoryQueryOptions) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: [
      'public', 'supermarket', 'category-context-v2',
      options.serviceAreaId ?? '*', options.requestedStoreId ?? '*',
    ],
    queryFn: () => getFastSupermarketCategoryContext(
      options.serviceAreaId, options.requestedStoreId,
    ),
    // Fast navigation: the home already fetched the same current DB category
    // names. Render those immediately while refreshing store-specific
    // context and offer root counts in the background.
    placeholderData: () => {
      const home = queryClient.getQueryData<SupermarketHomeSnapshot>([
        'public', 'supermarket', 'home-shell-v2',
        options.serviceAreaId ?? '*',
      ]);
      if (!home?.catalog?.store?.id) return undefined;
      if (options.requestedStoreId && home.catalog.store.id !== options.requestedStoreId) {
        return undefined;
      }
      return normalizeSupermarketCategoryContext({
        catalog: home.catalog,
        currencyCode: home.currencyCode,
        offerRootCategoryIds: [],
      });
    },
    staleTime: 90_000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    meta: { persist: true },
  });

  const tilesQuery = useQuery({
    queryKey: ['public', 'supermarket', 'category-tiles-v2'],
    queryFn: () => listStorefrontCategoryTiles('supermarket'),
    staleTime: 120_000,
    retry: 1,
    meta: { persist: true },
  });

  const data = useMemo<SupermarketCategoryData | undefined>(() => {
    if (!query.data) return undefined;
    const { catalog, currencyCode, offerRootCategoryIds } =
      query.data as SupermarketCategoryContext;
    const tile = findStorefrontCategoryTile(
      tilesQuery.data ?? [],
      [options.categoryKey, options.sectionSlug],
    );
    const isOffersPage = options.sectionSlug.trim().toLowerCase() === 'offers';

    return {
      catalog,
      currencyCode,
      offerRootCategoryIds,
      selectedSection: isOffersPage
        ? null
        : findCatalogSectionBySlug(catalog, options.sectionSlug),
      rootCategoryImageUrl: tile?.imageUrl ?? null,
      categoryImageOverrides: getStorefrontTileCategoryImages(tile),
    };
  }, [query.data, tilesQuery.data, options.sectionSlug, options.categoryKey]);

  return { ...query, data, tiles: tilesQuery.data ?? [] };
}

export type SupermarketCategoryProductsOptions = {
  storeId: string | null;
  serviceAreaId: string | null;
  categoryId: string | null;
  offersOnly: boolean;
  search: string;
  enabled: boolean;
};

/** Per-selected-category infinite list with DB-side filters and search. */
export function useSupermarketCategoryProductsQuery(
  options: SupermarketCategoryProductsOptions,
) {
  return useInfiniteQuery({
    queryKey: [
      'public', 'supermarket', 'category-products-v2',
      options.storeId ?? '*', options.serviceAreaId ?? '*',
      options.categoryId ?? '*', options.offersOnly, options.search.trim(),
    ],
    enabled: options.enabled && Boolean(options.storeId),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => getFastSupermarketCategoryPage({
      storeId: options.storeId!,
      serviceAreaId: options.serviceAreaId,
      categoryId: options.categoryId,
      offersOnly: options.offersOnly,
      search: options.search,
      offset: pageParam,
    }),
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.hasMore ? lastPageParam + SUPERMARKET_CATEGORY_PAGE_SIZE : undefined,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    meta: { persist: false },
  });
}

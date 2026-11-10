import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import getAppBootstrap from '../services/bootstrap-service';
import {
  findCatalogSectionBySlug,
  getStoreCatalog,
  listStores,
  type CatalogSection,
  type StoreCatalog,
  type StoreSummary,
} from '../services/catalog-service';
import {
  findStorefrontCategoryTile,
  getStorefrontTileCategoryImages,
  listStorefrontCategoryTiles,
  type StorefrontCategoryTile,
} from '../services/storefront-category-service';
import {
  getSupermarketHomeSnapshot,
  getSupermarketHomePreviewProducts,
} from '../services/supermarket-home-service';

type SupermarketCategoryContext = {
  catalog: StoreCatalog;
  currencyCode: string;
  tiles: StorefrontCategoryTile[] | null;
};

type SupermarketCategoryData = {
  catalog: StoreCatalog;
  selectedSection: CatalogSection | null;
  currencyCode: string;
  rootCategoryImageUrl: string | null;
  categoryImageOverrides: Record<string, string>;
};

type CategoryQueryOptions = {
  serviceAreaId: string | null;
  requestedStoreId: string | null;
  sectionSlug: string;
  categoryKey: string | null;
};

function chooseSupermarket(stores: StoreSummary[]): StoreSummary {
  if (stores.length === 0) {
    throw new Error('لا يوجد سوبر ماركت متاح حاليًا.');
  }
  return (
    stores.find((store) => store.isFeatured && !store.isManuallyClosed) ??
    stores.find((store) => !store.isManuallyClosed) ??
    stores[0]
  );
}

async function getDefaultStoreContext(serviceAreaId: string | null) {
  // Bootstrap is useful for defaults, but a failed settings read must not
  // suppress an otherwise accessible public storefront.
  const bootstrap = await getAppBootstrap().catch(() => null);
  return {
    effectiveServiceAreaId:
      serviceAreaId ?? bootstrap?.settings.default_service_area_id ?? undefined,
    currencyCode: bootstrap?.settings.currency_code || 'EGP',
  };
}

async function fetchSupermarketCategoryContext({
  serviceAreaId,
  requestedStoreId,
}: Pick<CategoryQueryOptions, 'serviceAreaId' | 'requestedStoreId'>):
  Promise<SupermarketCategoryContext> {
  const { effectiveServiceAreaId, currencyCode } =
    await getDefaultStoreContext(serviceAreaId);

  const tilesPromise = listStorefrontCategoryTiles('supermarket').catch(() => null);

  let storeId = requestedStoreId;
  if (!storeId) {
    const stores = await listStores({
      categorySlug: 'supermarket',
      serviceAreaId: effectiveServiceAreaId,
    });
    storeId = chooseSupermarket(stores).id;
  }

  const [catalog, tiles] = await Promise.all([
    getStoreCatalog(storeId, effectiveServiceAreaId),
    tilesPromise,
  ]);

  return { catalog, currencyCode, tiles };
}

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

export function useSupermarketCategoryQuery(options: CategoryQueryOptions) {
  // All category screens for the same store/area share one cached catalog
  // rather than persisting duplicate product lists for every subcategory.
  const query = useQuery({
    queryKey: [
      'public', 'supermarket', 'category-catalog',
      options.serviceAreaId ?? '*',
      options.requestedStoreId ?? '*',
    ],
    queryFn: () => fetchSupermarketCategoryContext(options),
    staleTime: 120_000,
    gcTime: 30 * 60 * 1000,
    // Full 4+ MB catalog remains memory-cached but must not slow down
    // future app startup by being hydrated from persistent disk storage.
    meta: { persist: false },
  });

  const data = useMemo<SupermarketCategoryData | undefined>(() => {
    if (!query.data) return undefined;

    const { catalog, currencyCode, tiles } = query.data;
    const tile = findStorefrontCategoryTile(
      tiles ?? [],
      [options.categoryKey, options.sectionSlug],
    );
    const isOffersPage = options.sectionSlug.trim().toLowerCase() === 'offers';
    return {
      catalog,
      currencyCode,
      selectedSection: isOffersPage
        ? null
        : findCatalogSectionBySlug(catalog, options.sectionSlug),
      rootCategoryImageUrl: tile?.imageUrl ?? null,
      categoryImageOverrides: getStorefrontTileCategoryImages(tile),
    };
  }, [query.data, options.sectionSlug, options.categoryKey]);

  return { ...query, data };
}

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
  listSupermarketPromotionBanners,
  type SupermarketPromotionBanner,
} from '../services/supermarket-banner-service';

type SupermarketHomeData = {
  catalog: StoreCatalog;
  promotionBanners: SupermarketPromotionBanner[];
  storefrontCategoryTiles: StorefrontCategoryTile[] | null;
  currencyCode: string;
};

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

async function fetchSupermarketHome(
  serviceAreaId: string | null,
): Promise<SupermarketHomeData> {
  const { effectiveServiceAreaId, currencyCode } =
    await getDefaultStoreContext(serviceAreaId);

  const stores = await listStores({
    categorySlug: 'supermarket',
    serviceAreaId: effectiveServiceAreaId,
  });
  const store = chooseSupermarket(stores);

  const [catalog, promotionBanners, storefrontCategoryTiles] = await Promise.all([
    getStoreCatalog(store.id, effectiveServiceAreaId),
    listSupermarketPromotionBanners({ storeId: store.id }).catch(() => []),
    listStorefrontCategoryTiles('supermarket').catch(() => null),
  ]);

  return { catalog, promotionBanners, storefrontCategoryTiles, currencyCode };
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
    queryKey: ['public', 'supermarket', 'home', serviceAreaId ?? '*'],
    queryFn: () => fetchSupermarketHome(serviceAreaId),
    meta: { persist: true },
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
    meta: { persist: true },
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

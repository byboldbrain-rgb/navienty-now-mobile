import { useQuery } from '@tanstack/react-query';

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

async function fetchSupermarketCategory({
  serviceAreaId,
  requestedStoreId,
  sectionSlug,
  categoryKey,
}: CategoryQueryOptions): Promise<SupermarketCategoryData> {
  const { effectiveServiceAreaId, currencyCode } =
    await getDefaultStoreContext(serviceAreaId);

  // Artwork is optional; do not block product loading when it is unavailable.
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

  const tile = findStorefrontCategoryTile(tiles ?? [], [categoryKey, sectionSlug]);
  const isOffersPage = sectionSlug.trim().toLowerCase() === 'offers';
  const selectedSection = isOffersPage
    ? null
    : findCatalogSectionBySlug(catalog, sectionSlug);

  if (!isOffersPage && !selectedSection) {
    throw new Error('لم يتم العثور على فئة السوبر ماركت المطلوبة.');
  }

  return {
    catalog,
    selectedSection,
    currencyCode,
    rootCategoryImageUrl: tile?.imageUrl ?? null,
    categoryImageOverrides: getStorefrontTileCategoryImages(tile),
  };
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
  return useQuery({
    queryKey: [
      'public', 'supermarket', 'category',
      options.serviceAreaId ?? '*',
      options.requestedStoreId ?? '*',
      options.sectionSlug,
      options.categoryKey ?? '*',
    ],
    queryFn: () => fetchSupermarketCategory(options),
    meta: { persist: true },
  });
}

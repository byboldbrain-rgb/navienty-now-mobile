import { publicSupabase } from '../lib/supabase';
import type { StoreCatalog } from './catalog-service';
import { normalizeSupermarketCategoryContext } from './supermarket-category-fast-service';

export type ShoppingStoreSlug = 'bookstores' | 'personal-care';

export type ShoppingHomeSnapshot = {
  catalog: StoreCatalog;
  currencyCode: string;
  hasOffers: boolean;
};

/**
 * Only store metadata, business hours and active category names are fetched
 * before painting. A large product catalog must never gate the initial home.
 */
export async function getShoppingHomeSnapshot(
  slug: ShoppingStoreSlug,
  serviceAreaId: string | null,
  requestedStoreId?: string | null,
): Promise<ShoppingHomeSnapshot> {
  const { data, error } = await publicSupabase.rpc('get_catalog_home_snapshot__v1', {
    p_service_area_id: serviceAreaId?.trim() || null,
    p_category_slug: slug,
    p_store_id: requestedStoreId?.trim() || null,
  });
  if (error) throw error;
  const snapshot = data as ShoppingHomeSnapshot | null;
  if (!snapshot?.catalog?.store?.id || !Array.isArray(snapshot.catalog.sections)) {
    throw new Error('هذا المتجر غير متاح في منطقة التوصيل المختارة.');
  }
  const context = normalizeSupermarketCategoryContext({
    catalog: snapshot.catalog,
    currencyCode: snapshot.currencyCode,
    offerRootCategoryIds: [],
  });
  return { ...snapshot, catalog: context.catalog, currencyCode: context.currencyCode };
}

import { publicSupabase } from '../lib/supabase';
import type { CatalogProduct, StoreCatalog } from './catalog-service';
import { normalizeSupermarketCategoryContext } from './supermarket-category-fast-service';
import type { ShoppingStoreSlug } from './shopping-home-service';

type ContextRow = {
  catalog: StoreCatalog;
  currencyCode: string | null;
  offerRootCategoryIds: string[] | null;
};

export async function getShoppingCategoryContext(
  slug: ShoppingStoreSlug,
  serviceAreaId: string | null,
  requestedStoreId: string | null,
) {
  const { data, error } = await publicSupabase.rpc('get_catalog_category_context__v1', {
    p_category_slug: slug,
    p_service_area_id: serviceAreaId?.trim() || null,
    p_store_id: requestedStoreId?.trim() || null,
  });
  if (error) throw error;
  const context = data as ContextRow | null;
  if (!context?.catalog?.store?.id || !Array.isArray(context.catalog.sections)) {
    throw new Error('هذا القسم غير متاح في منطقة التوصيل المختارة.');
  }
  return normalizeSupermarketCategoryContext(context);
}

type RawProduct = Omit<CatalogProduct, 'price' | 'compareAtPrice'> & {
  price: number | string;
  compareAtPrice: number | string | null;
};

export const SHOPPING_CATEGORY_PAGE_SIZE = 24;

export async function getShoppingCategoryPage(params: {
  slug: ShoppingStoreSlug;
  storeId: string;
  serviceAreaId: string | null;
  categoryId: string | null;
  offersOnly: boolean;
  search: string;
  offset: number;
}): Promise<{ items: CatalogProduct[]; hasMore: boolean }> {
  const { data, error } = await publicSupabase.rpc('get_catalog_category_product_page__v1', {
    p_store_id: params.storeId,
    p_service_area_id: params.serviceAreaId?.trim() || null,
    p_category_id: params.categoryId,
    p_offers_only: params.offersOnly,
    p_search: params.search.trim(),
    p_limit: SHOPPING_CATEGORY_PAGE_SIZE,
    p_offset: Math.max(0, Math.floor(params.offset)),
    p_category_slug: params.slug,
  });
  if (error) throw error;
  const page = data as { items: RawProduct[] | null; hasMore: boolean } | null;
  return {
    items: (Array.isArray(page?.items) ? page.items : [])
      .filter(product => Boolean(product.id && product.name))
      .map(product => ({
        ...product,
        price: Number(product.price) || 0,
        compareAtPrice: product.compareAtPrice === null ? null : Number(product.compareAtPrice),
        variants: product.variants ?? [],
        images: product.images ?? [],
      })),
    hasMore: page?.hasMore === true,
  };
}

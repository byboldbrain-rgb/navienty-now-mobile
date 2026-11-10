import { publicSupabase } from '../lib/supabase';
import type { CatalogProduct } from './catalog-service';

export type ShoppingCategorySlug = 'bookstores' | 'personal-care';
const PAGE_SIZE = 16;

type RawProduct = Omit<CatalogProduct,'price'|'compareAtPrice'> & {
  price: number | string;
  compareAtPrice: number | string | null;
};

export async function getShoppingBannerProductPage(args: {
  storeId: string;
  bannerId: string;
  categorySlug: ShoppingCategorySlug;
  serviceAreaId: string | null;
  offset: number;
}): Promise<{ items: CatalogProduct[]; hasMore: boolean }> {
  const { data, error } = await publicSupabase.rpc('get_shopping_banner_products_v1', {
    p_store_id: args.storeId,
    p_banner_id: args.bannerId,
    p_category_slug: args.categorySlug,
    p_service_area_id: args.serviceAreaId || null,
    p_limit: PAGE_SIZE,
    p_offset: Math.max(0, Math.floor(args.offset)),
  });
  if (error) throw error;
  const page = data as { items: RawProduct[] | null; hasMore: boolean } | null;
  return {
    items: (Array.isArray(page?.items) ? page.items : [])
      .filter(p => Boolean(p.id && p.name))
      .map((p): CatalogProduct => ({
        ...p,
        price: Number(p.price) || 0,
        compareAtPrice: p.compareAtPrice == null ? null : Number(p.compareAtPrice),
        variants: p.variants ?? [],
        images: p.images ?? [],
      })),
    hasMore: page?.hasMore === true,
  };
}
export const SHOPPING_BANNER_PAGE_SIZE = PAGE_SIZE;

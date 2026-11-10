import { publicSupabase } from '../lib/supabase';
import type { CatalogProduct, StoreCatalog } from './catalog-service';

/**
 * Fast home-shell API. Unlike getStoreCatalog, this response NEVER
 * includes thousands of products, images, or variants.
 */
export type SupermarketHomeSnapshot = {
  catalog: StoreCatalog;
  currencyCode: string;
  hasOffers: boolean;
};

type HomeSnapshotRow = {
  catalog: StoreCatalog;
  currencyCode: string | null;
  hasOffers: boolean;
};

export async function getSupermarketHomeSnapshot(
  serviceAreaId: string | null,
): Promise<SupermarketHomeSnapshot> {
  const { data, error } = await publicSupabase.rpc(
    'get_supermarket_home_snapshot',
    { p_service_area_id: serviceAreaId?.trim() || null },
  );

  if (error) {
    throw new Error(`Loading supermarket home failed: ${error.message}`);
  }

  const snapshot = data as HomeSnapshotRow | null;
  if (!snapshot?.catalog?.store?.id || !Array.isArray(snapshot.catalog.sections)) {
    throw new Error('لا يوجد سوبر ماركت متاح حاليًا في المنطقة المختارة.');
  }

  return {
    catalog: snapshot.catalog,
    currencyCode: snapshot.currencyCode || 'EGP',
    hasOffers: snapshot.hasOffers === true,
  };
}

type PreviewRow = Omit<CatalogProduct, 'price' | 'compareAtPrice'> & {
  price: number | string;
  compareAtPrice: number | string | null;
};

/**
 * Home promotions/reorder previews fetch only products actually referenced
 * by an active banner or a recent order. Product details and category lists
 * still use their own catalog endpoints.
 */
export async function getSupermarketHomePreviewProducts(
  storeId: string,
  productIds: readonly string[],
): Promise<CatalogProduct[]> {
  // Order history may include legacy/non-UUID identifiers. The RPC expects
  // UUIDs, so ignore malformed values instead of failing every promo card.
  const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const uniqueIds = Array.from(
    new Set(productIds.filter((id) => validUuid.test(id))),
  ).slice(0, 120);
  if (!storeId.trim() || uniqueIds.length === 0) return [];

  const { data, error } = await publicSupabase.rpc(
    'get_supermarket_preview_products',
    {
      p_store_id: storeId,
      p_product_ids: uniqueIds,
    },
  );
  if (error) {
    throw new Error(`Loading supermarket preview products failed: ${error.message}`);
  }

  return (Array.isArray(data) ? (data as PreviewRow[]) : [])
    .filter((product) => Boolean(product.id && product.name))
    .map((product): CatalogProduct => ({
      ...product,
      price: Number(product.price) || 0,
      compareAtPrice:
        product.compareAtPrice === null ? null : Number(product.compareAtPrice),
      variants: product.variants ?? [],
      images: product.images ?? [],
    }));
}


/** Each banner has its own paginated product feed (no global 120-item cap). */
export const SUPERMARKET_BANNER_PAGE_SIZE = 16;

export type SupermarketBannerProductPage = {
  items: CatalogProduct[];
  hasMore: boolean;
};

type BannerProductPageRow = {
  items: PreviewRow[] | null;
  hasMore: boolean;
};

/**
 * This endpoint takes the banner ID, not an arbitrary subset of IDs from
 * other banners. It returns active products in the admin's banner sort order.
 * Fetch additional pages only as the customer swipes the rail.
 */
export async function getSupermarketBannerProductPage(
  storeId: string,
  bannerId: string,
  serviceAreaId: string | null,
  offset: number,
): Promise<SupermarketBannerProductPage> {
  if (!storeId || !bannerId) return { items: [], hasMore: false };

  const { data, error } = await publicSupabase.rpc(
    'get_supermarket_banner_products',
    {
      p_store_id: storeId,
      p_banner_id: bannerId,
      p_service_area_id: serviceAreaId || null,
      p_limit: SUPERMARKET_BANNER_PAGE_SIZE,
      p_offset: Math.max(0, Math.floor(offset)),
    },
  );
  if (error) {
    throw new Error(`Loading supermarket banner products failed: ${error.message}`);
  }

  const page = data as BannerProductPageRow | null;
  const rows = Array.isArray(page?.items) ? page.items : [];

  return {
    items: rows
      .filter((item) => Boolean(item.id && item.name))
      .map((item): CatalogProduct => ({
        ...item,
        price: Number(item.price) || 0,
        compareAtPrice:
          item.compareAtPrice === null ? null : Number(item.compareAtPrice),
        variants: item.variants ?? [],
        images: item.images ?? [],
      })),
    hasMore: page?.hasMore === true,
  };
}

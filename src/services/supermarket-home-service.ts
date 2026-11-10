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

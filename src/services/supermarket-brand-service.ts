import { supabase } from '../lib/supabase';

/**
 * The public RPC only exposes active, available product IDs and their
 * canonical brand. It never exposes private product or customer columns.
 */
type BrandProductRow = {
  brand_id: string;
  brand_name_ar: string;
  brand_logo_url: string | null;
  product_id: string;
};

export type SupermarketProductBrand = {
  id: string;
  name: string;
  logoUrl: string | null;
};

export type SupermarketBrandProductList = SupermarketProductBrand & {
  productIds: string[];
};

async function loadBrandRows(
  storeId: string,
  filter: { productId: string } | { brandId: string },
): Promise<BrandProductRow[]> {
  const { data, error } = await supabase.rpc('get_supermarket_brand_products', {
    p_store_id: storeId,
    p_brand_id: 'brandId' in filter ? filter.brandId : null,
    p_product_id: 'productId' in filter ? filter.productId : null,
  });

  if (error) throw error;
  return (data ?? []) as BrandProductRow[];
}

export async function getSupermarketProductBrand(
  storeId: string,
  productId: string,
): Promise<SupermarketProductBrand | null> {
  const rows = await loadBrandRows(storeId, { productId });
  if (!rows.length) return null;
  const first = rows[0];
  return {
    id: first.brand_id,
    name: first.brand_name_ar,
    logoUrl: first.brand_logo_url,
  };
}

export async function getSupermarketBrandProductsById(
  storeId: string,
  brandId: string,
): Promise<SupermarketBrandProductList> {
  const rows = await loadBrandRows(storeId, { brandId });
  if (!rows.length) throw new Error('منتجات الشركة غير متاحة حاليًا.');

  return {
    id: rows[0].brand_id,
    name: rows[0].brand_name_ar,
    logoUrl: rows[0].brand_logo_url,
    productIds: [...new Set(rows.map(row => row.product_id))],
  };
}

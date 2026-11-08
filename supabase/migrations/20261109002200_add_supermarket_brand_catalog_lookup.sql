-- Brand navigation for supermarket product detail screens.
-- Only the public brand name/logo and active, available product IDs are
-- exposed. The products table itself remains unavailable to anon/authenticated.
CREATE OR REPLACE FUNCTION now.get_supermarket_brand_products(
  p_store_id uuid,
  p_brand_id uuid DEFAULT NULL,
  p_product_id uuid DEFAULT NULL
)
RETURNS TABLE (
  brand_id uuid,
  brand_name_ar text,
  brand_logo_url text,
  product_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT b.id, b.name_ar, b.logo_url, related.id
  FROM now.products AS related
  JOIN now.brands AS b ON b.id = related.brand_id AND b.is_active = true
  JOIN now.stores AS s ON s.id = related.store_id AND s.is_active = true
  WHERE related.store_id = p_store_id
    AND related.is_active = true
    AND related.is_available = true
    AND (p_brand_id IS NOT NULL OR p_product_id IS NOT NULL)
    AND related.brand_id = COALESCE(
      p_brand_id,
      (SELECT seed.brand_id
       FROM now.products AS seed
       WHERE seed.id = p_product_id
         AND seed.store_id = p_store_id
         AND seed.is_active = true
         AND seed.is_available = true)
    )
  ORDER BY related.sort_order ASC, related.id ASC;
$$;

REVOKE ALL ON FUNCTION now.get_supermarket_brand_products(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION now.get_supermarket_brand_products(uuid, uuid, uuid)
  TO anon, authenticated;

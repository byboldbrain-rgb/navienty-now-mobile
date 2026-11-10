-- Store and region-scoped paginated promotion products for the bookstore and care.
-- Never allow arbitrary product selection across stores.
CREATE OR REPLACE FUNCTION now.get_shopping_banner_products_v1(p_store_id uuid, p_banner_id uuid, p_category_slug text, p_service_area_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 16, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'now', 'pg_temp'
AS $function$
DECLARE
  v_area_id uuid;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 16), 1), 32);
  v_offset integer := LEAST(GREATEST(COALESCE(p_offset, 0), 0), 25000);
  v_items jsonb;
  v_count integer;
BEGIN
  IF p_store_id IS NULL OR p_banner_id IS NULL OR p_category_slug NOT IN ('bookstores', 'personal-care') THEN
    RETURN jsonb_build_object('items', '[]'::jsonb, 'hasMore', false);
  END IF;

  SELECT COALESCE(p_service_area_id, a.default_service_area_id)
  INTO v_area_id FROM now.app_settings a WHERE a.singleton = true;

  IF v_area_id IS NULL THEN
    RETURN jsonb_build_object('items', '[]'::jsonb, 'hasMore', false);
  END IF;

  WITH eligible_banner AS (
    SELECT b.id
    FROM now.home_banners b
    JOIN now.stores s ON s.id=b.store_id AND s.is_active
    JOIN now.store_categories sc ON sc.id=s.category_id AND sc.is_active AND sc.slug=p_category_slug
    JOIN now.store_service_areas ssa ON ssa.store_id=s.id
      AND ssa.service_area_id=v_area_id AND ssa.is_available
    JOIN now.service_areas sa ON sa.id=ssa.service_area_id AND sa.is_active
    WHERE b.id=p_banner_id
      AND b.store_id=p_store_id
      AND b.placement=CASE p_category_slug WHEN 'bookstores' THEN 'bookstore' ELSE 'personal-care' END
      AND b.is_active
      AND b.audience='all'
      AND (b.starts_at IS NULL OR b.starts_at<=now())
      AND (b.ends_at IS NULL OR b.ends_at>now())
  ),
  page AS MATERIALIZED (
    SELECT p.*,bp.sort_order AS link_order,bp.id AS link_id,
      COALESCE(NULLIF(p.image_url,''), (
        SELECT pi.image_url
        FROM now.product_images pi
        WHERE pi.product_id=p.id AND pi.is_active
        ORDER BY pi.is_cover DESC,pi.sort_order,pi.id
        LIMIT 1
      )) AS cover_image
    FROM eligible_banner b
    JOIN now.home_banner_products bp ON bp.banner_id=b.id AND bp.is_active
    JOIN now.products p ON p.id=bp.product_id AND p.store_id=p_store_id
      AND p.is_active AND p.is_available AND NOT p.requires_prescription
    JOIN now.catalog_categories c ON c.id=p.catalog_category_id
      AND c.store_id=p.store_id AND c.is_active
    ORDER BY bp.sort_order,bp.id
    LIMIT v_limit + 1
    OFFSET v_offset
  ),
  numbered AS (
    SELECT p.*, ROW_NUMBER() OVER (ORDER BY link_order,link_id) AS position
    FROM page p
  )
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id',id,'slug',slug,'productType',product_type,
          'catalogCategoryId',catalog_category_id,
          'name',name_ar,'nameEn',name_en,
          'description',COALESCE(description_ar,''),
          'descriptionEn',description_en,
          'price',base_price,'compareAtPrice',compare_at_price,
          'sku',sku,'barcode',barcode,
          'unitLabelAr',unit_label_ar,'unitLabelEn',unit_label_en,
          'icon',COALESCE(icon,'📦'),'imageUrl',cover_image,
          'isAgeRestricted',is_age_restricted,
          'variants','[]'::jsonb,'images','[]'::jsonb
        ) ORDER BY link_order,link_id
      ) FILTER (WHERE position<=v_limit),
      '[]'::jsonb
    ),
    COUNT(*)
  INTO v_items, v_count
  FROM numbered;

  RETURN jsonb_build_object(
    'items',COALESCE(v_items,'[]'::jsonb),
    'hasMore',v_count>v_limit
  );
END
$function$
;
REVOKE ALL ON FUNCTION now.get_shopping_banner_products_v1(uuid,uuid,text,uuid,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION now.get_shopping_banner_products_v1(uuid,uuid,text,uuid,integer,integer) TO anon, authenticated;

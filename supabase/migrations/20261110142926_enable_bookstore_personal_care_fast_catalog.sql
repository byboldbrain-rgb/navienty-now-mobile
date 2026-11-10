-- Store- and service-area-scoped, paginated APIs for marketplace shopping.
-- Apply with the matching Supabase migration. Existing supermarket RPCs remain unchanged.
CREATE OR REPLACE FUNCTION now.get_catalog_category_context__v1(p_service_area_id uuid DEFAULT NULL::uuid, p_store_id uuid DEFAULT NULL::uuid, p_category_slug text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'now', 'pg_temp'
AS $function$
DECLARE
  v_area_id uuid;
  v_store record;
  v_sections jsonb;
  v_hours jsonb;
  v_currency text;
  v_has_offers boolean;
  v_offer_roots jsonb;
BEGIN
  SELECT COALESCE(p_service_area_id, st.default_service_area_id),
         COALESCE(st.currency_code, 'EGP')
    INTO v_area_id, v_currency
    FROM now.app_settings st
    WHERE st.singleton = true;
  IF v_area_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT s.*, sc.slug AS category_slug, sc.name_ar AS category_name,
         sc.subtitle_ar AS category_subtitle,
         a.code AS service_area_code, a.name_ar AS service_area_name,
         ssa.delivery_fee AS area_delivery_fee,
         ssa.minimum_order_amount AS area_minimum_order,
         ssa.estimated_delivery_minutes AS area_delivery_minutes
  INTO v_store
  FROM now.stores s
  JOIN now.store_categories sc ON sc.id = s.category_id
    AND sc.slug = p_category_slug AND p_category_slug IN ('supermarket','bookstores','personal-care') AND sc.is_active
  JOIN now.store_service_areas ssa ON ssa.store_id = s.id
    AND ssa.service_area_id = v_area_id AND ssa.is_available
  JOIN now.service_areas a ON a.id = v_area_id AND a.is_active
  WHERE s.is_active AND (p_store_id IS NULL OR s.id = p_store_id)
  ORDER BY (s.is_featured AND NOT s.is_manually_closed) DESC,
           (NOT s.is_manually_closed) DESC,
           s.sort_order, s.id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'slug', c.slug,
      'experienceKey', c.experience_key,
      'name', c.name_ar,
      'nameEn', c.name_en,
      'imageUrl', c.image_url,
      'parentId', c.parent_id,
      'depth', 0,
      'sortOrder', c.sort_order,
      'products', '[]'::jsonb,
      'children', '[]'::jsonb
    ) ORDER BY c.sort_order, c.name_ar, c.id
  ), '[]'::jsonb) INTO v_sections
  FROM now.catalog_categories c
  WHERE c.store_id = v_store.id AND c.is_active = true;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'dayOfWeek', h.day_of_week,
      'isOpen', h.is_open,
      'openTime', h.open_time,
      'closeTime', h.close_time
    ) ORDER BY h.day_of_week
  ), '[]'::jsonb) INTO v_hours
  FROM now.store_business_hours h WHERE h.store_id = v_store.id;

  SELECT EXISTS (
    SELECT 1
    FROM now.products p
    JOIN now.catalog_categories c ON c.id = p.catalog_category_id
    WHERE p.store_id = v_store.id AND p.is_active AND p.is_available
      AND c.is_active
      AND p.compare_at_price > p.base_price
  ) INTO v_has_offers;

  WITH RECURSIVE offer_ancestors AS (
    SELECT c.id, c.parent_id, c.store_id
    FROM now.products p
    JOIN now.catalog_categories c ON c.id=p.catalog_category_id
    WHERE p.store_id=v_store.id AND p.is_active AND p.is_available
      AND c.is_active AND p.compare_at_price>p.base_price
    UNION ALL
    SELECT parent.id, parent.parent_id, parent.store_id
    FROM offer_ancestors oa
    JOIN now.catalog_categories parent
      ON parent.id=oa.parent_id
      AND parent.store_id=oa.store_id
      AND parent.is_active
  )
  SELECT COALESCE(jsonb_agg(DISTINCT id), '[]'::jsonb)
  INTO v_offer_roots
  FROM offer_ancestors WHERE parent_id IS NULL;

  RETURN jsonb_build_object(
    'offerRootCategoryIds', v_offer_roots,
    'currencyCode', v_currency,
    'hasOffers', v_has_offers,
    'catalog', jsonb_build_object(
      'store', jsonb_build_object(
        'id', v_store.id,
        'slug', v_store.slug,
        'categoryId', v_store.category_id,
        'categorySlug', v_store.category_slug,
        'categoryName', v_store.category_name,
        'categorySubtitle', COALESCE(v_store.category_subtitle,''),
        'name', v_store.name_ar,
        'nameEn', v_store.name_en,
        'shortDescription', COALESCE(v_store.short_description_ar,''),
        'shortDescriptionEn', v_store.short_description_en,
        'fullDescription', v_store.full_description_ar,
        'fullDescriptionEn', v_store.full_description_en,
        'icon', COALESCE(v_store.icon,'🏪'),
        'logoUrl', v_store.logo_url,
        'coverImageUrl', v_store.cover_image_url,
        'rating', COALESCE(v_store.rating_avg,0),
        'ratingCount', COALESCE(v_store.rating_count,0),
        'deliveryTime', COALESCE(v_store.delivery_time_label_ar,''),
        'phone', v_store.phone,
        'whatsappNumber', v_store.whatsapp_number,
        'addressAr', v_store.address_line_ar,
        'addressEn', v_store.address_line_en,
        'latitude', v_store.latitude,
        'longitude', v_store.longitude,
        'averagePreparationMinutes', v_store.average_preparation_minutes,
        'isFeatured', v_store.is_featured,
        'isManuallyClosed', v_store.is_manually_closed,
        'manualClosedNote', v_store.manual_closed_note_ar
      ),
      'delivery', jsonb_build_object(
        'serviceAreaId', v_area_id,
        'serviceAreaCode', v_store.service_area_code,
        'serviceAreaName', v_store.service_area_name,
        'deliveryFee', v_store.area_delivery_fee,
        'minimumOrder', v_store.area_minimum_order,
        'estimatedDeliveryMinutes', v_store.area_delivery_minutes,
        'deliveryTime', COALESCE(v_store.delivery_time_label_ar,'')
      ),
      'businessHours', v_hours,
      'sections', v_sections,
      'categoryTree', '[]'::jsonb
    )
  );
END
$function$
;
REVOKE ALL ON FUNCTION now.get_catalog_category_context__v1(p_service_area_id uuid, p_store_id uuid, p_category_slug text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION now.get_catalog_category_context__v1(p_service_area_id uuid, p_store_id uuid, p_category_slug text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION now.get_catalog_category_product_page__v1(p_store_id uuid, p_service_area_id uuid DEFAULT NULL::uuid, p_category_id uuid DEFAULT NULL::uuid, p_offers_only boolean DEFAULT false, p_search text DEFAULT NULL::text, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0, p_category_slug text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'now', 'pg_temp'
AS $function$
DECLARE
  v_area_id uuid;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit,24),1),48);
  v_offset integer := LEAST(GREATEST(COALESCE(p_offset,0),0),25000);
  v_search text := btrim(left(lower(translate(COALESCE(p_search,''), 'إأآٱىؤئة', 'اااايويه')),90));
  v_items jsonb;
  v_count integer;
BEGIN
  SELECT COALESCE(p_service_area_id,a.default_service_area_id)
  INTO v_area_id FROM now.app_settings a WHERE a.singleton=true;

  IF v_area_id IS NULL OR p_store_id IS NULL THEN
    RETURN jsonb_build_object('items','[]'::jsonb,'hasMore',false);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM now.stores s
    JOIN now.store_categories sc ON sc.id=s.category_id
      AND sc.slug=p_category_slug AND p_category_slug IN ('supermarket','bookstores','personal-care') AND sc.is_active
    JOIN now.store_service_areas ssa ON ssa.store_id=s.id
      AND ssa.service_area_id=v_area_id AND ssa.is_available
    JOIN now.service_areas sa ON sa.id=ssa.service_area_id AND sa.is_active
    WHERE s.id=p_store_id AND s.is_active
  ) THEN
    RETURN jsonb_build_object('items','[]'::jsonb,'hasMore',false);
  END IF;

  WITH RECURSIVE allowed_categories AS (
    SELECT c.id
    FROM now.catalog_categories c
    WHERE c.id=p_category_id AND c.store_id=p_store_id AND c.is_active
    UNION ALL
    SELECT child.id
    FROM now.catalog_categories child
    JOIN allowed_categories parent ON child.parent_id=parent.id
    WHERE child.store_id=p_store_id AND child.is_active
  ),
  selected_products AS MATERIALIZED (
    SELECT p.id,p.sort_order,p.name_ar
    FROM now.products p
    JOIN now.catalog_categories c ON c.id=p.catalog_category_id
      AND c.store_id=p.store_id AND c.is_active
    WHERE p.store_id=p_store_id
      AND p.is_active AND p.is_available
      AND (p_category_id IS NULL OR EXISTS(
        SELECT 1 FROM allowed_categories allowed WHERE allowed.id=p.catalog_category_id
      ))
      AND (NOT p_offers_only OR p.compare_at_price>p.base_price)
      AND (
        v_search='' OR
        translate(lower(concat_ws(' ',p.name_ar,p.name_en,p.description_ar,
          p.description_en,p.sku,p.barcode,p.unit_label_ar)),
          'إأآٱىؤئة','اااايويه') LIKE '%'||replace(replace(v_search,'%',''), '_','')||'%'
      )
    ORDER BY p.sort_order,p.name_ar,p.id
    LIMIT v_limit+1 OFFSET v_offset
  ),
  indexed AS (
    SELECT p.*,
           COALESCE(NULLIF(p.image_url,''),(
              SELECT pi.image_url FROM now.product_images pi
              WHERE pi.product_id=p.id AND pi.is_active
              ORDER BY pi.is_cover DESC,pi.sort_order,pi.id LIMIT 1
           )) cover_image,
           row_number() over (ORDER BY selected.sort_order,selected.name_ar,selected.id) ordinal
    FROM selected_products selected
    JOIN now.products p ON p.id=selected.id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
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
  ) ORDER BY ordinal) FILTER (WHERE ordinal<=v_limit),'[]'::jsonb),
  COUNT(*)
  INTO v_items,v_count FROM indexed;

  RETURN jsonb_build_object('items',COALESCE(v_items,'[]'::jsonb),'hasMore',v_count>v_limit);
END
$function$
;
REVOKE ALL ON FUNCTION now.get_catalog_category_product_page__v1(p_store_id uuid, p_service_area_id uuid, p_category_id uuid, p_offers_only boolean, p_search text, p_limit integer, p_offset integer, p_category_slug text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION now.get_catalog_category_product_page__v1(p_store_id uuid, p_service_area_id uuid, p_category_id uuid, p_offers_only boolean, p_search text, p_limit integer, p_offset integer, p_category_slug text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION now.get_catalog_home_snapshot__v1(p_service_area_id uuid DEFAULT NULL::uuid, p_category_slug text DEFAULT NULL::text, p_store_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'now', 'pg_temp'
AS $function$
DECLARE
  v_area_id uuid;
  v_store record;
  v_sections jsonb;
  v_hours jsonb;
  v_currency text;
  v_has_offers boolean;
BEGIN
  SELECT COALESCE(p_service_area_id, st.default_service_area_id),
         COALESCE(st.currency_code, 'EGP')
    INTO v_area_id, v_currency
    FROM now.app_settings st
    WHERE st.singleton = true;
  IF v_area_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT s.*, sc.slug AS category_slug, sc.name_ar AS category_name,
         sc.subtitle_ar AS category_subtitle,
         a.code AS service_area_code, a.name_ar AS service_area_name,
         ssa.delivery_fee AS area_delivery_fee,
         ssa.minimum_order_amount AS area_minimum_order,
         ssa.estimated_delivery_minutes AS area_delivery_minutes
  INTO v_store
  FROM now.stores s
  JOIN now.store_categories sc ON sc.id = s.category_id
    AND sc.slug = p_category_slug AND p_category_slug IN ('supermarket','bookstores','personal-care') AND sc.is_active
  JOIN now.store_service_areas ssa ON ssa.store_id = s.id
    AND ssa.service_area_id = v_area_id AND ssa.is_available
  JOIN now.service_areas a ON a.id = v_area_id AND a.is_active
  WHERE s.is_active AND (p_store_id IS NULL OR s.id = p_store_id)
  ORDER BY (s.is_featured AND NOT s.is_manually_closed) DESC,
           (NOT s.is_manually_closed) DESC,
           s.sort_order, s.id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'slug', c.slug,
      'experienceKey', c.experience_key,
      'name', c.name_ar,
      'nameEn', c.name_en,
      'imageUrl', c.image_url,
      'parentId', c.parent_id,
      'depth', 0,
      'sortOrder', c.sort_order,
      'products', '[]'::jsonb,
      'children', '[]'::jsonb
    ) ORDER BY c.sort_order, c.name_ar, c.id
  ), '[]'::jsonb) INTO v_sections
  FROM now.catalog_categories c
  WHERE c.store_id = v_store.id AND c.is_active = true;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'dayOfWeek', h.day_of_week,
      'isOpen', h.is_open,
      'openTime', h.open_time,
      'closeTime', h.close_time
    ) ORDER BY h.day_of_week
  ), '[]'::jsonb) INTO v_hours
  FROM now.store_business_hours h WHERE h.store_id = v_store.id;

  SELECT EXISTS (
    SELECT 1
    FROM now.products p
    JOIN now.catalog_categories c ON c.id = p.catalog_category_id
    WHERE p.store_id = v_store.id AND p.is_active AND p.is_available
      AND c.is_active
      AND p.compare_at_price > p.base_price
  ) INTO v_has_offers;

  RETURN jsonb_build_object(
    'currencyCode', v_currency,
    'hasOffers', v_has_offers,
    'catalog', jsonb_build_object(
      'store', jsonb_build_object(
        'id', v_store.id,
        'slug', v_store.slug,
        'categoryId', v_store.category_id,
        'categorySlug', v_store.category_slug,
        'categoryName', v_store.category_name,
        'categorySubtitle', COALESCE(v_store.category_subtitle,''),
        'name', v_store.name_ar,
        'nameEn', v_store.name_en,
        'shortDescription', COALESCE(v_store.short_description_ar,''),
        'shortDescriptionEn', v_store.short_description_en,
        'fullDescription', v_store.full_description_ar,
        'fullDescriptionEn', v_store.full_description_en,
        'icon', COALESCE(v_store.icon,'🏪'),
        'logoUrl', v_store.logo_url,
        'coverImageUrl', v_store.cover_image_url,
        'rating', COALESCE(v_store.rating_avg,0),
        'ratingCount', COALESCE(v_store.rating_count,0),
        'deliveryTime', COALESCE(v_store.delivery_time_label_ar,''),
        'phone', v_store.phone,
        'whatsappNumber', v_store.whatsapp_number,
        'addressAr', v_store.address_line_ar,
        'addressEn', v_store.address_line_en,
        'latitude', v_store.latitude,
        'longitude', v_store.longitude,
        'averagePreparationMinutes', v_store.average_preparation_minutes,
        'isFeatured', v_store.is_featured,
        'isManuallyClosed', v_store.is_manually_closed,
        'manualClosedNote', v_store.manual_closed_note_ar
      ),
      'delivery', jsonb_build_object(
        'serviceAreaId', v_area_id,
        'serviceAreaCode', v_store.service_area_code,
        'serviceAreaName', v_store.service_area_name,
        'deliveryFee', v_store.area_delivery_fee,
        'minimumOrder', v_store.area_minimum_order,
        'estimatedDeliveryMinutes', v_store.area_delivery_minutes,
        'deliveryTime', COALESCE(v_store.delivery_time_label_ar,'')
      ),
      'businessHours', v_hours,
      'sections', v_sections,
      'categoryTree', '[]'::jsonb
    )
  );
END
$function$
;
REVOKE ALL ON FUNCTION now.get_catalog_home_snapshot__v1(p_service_area_id uuid, p_category_slug text, p_store_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION now.get_catalog_home_snapshot__v1(p_service_area_id uuid, p_category_slug text, p_store_id uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION now.get_catalog_preview_products__v1(p_store_id uuid, p_product_ids uuid[], p_category_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'now', 'pg_temp'
AS $function$
WITH selected_store AS (
  SELECT s.id FROM now.stores s
  JOIN now.store_categories sc ON sc.id=s.category_id
  WHERE s.id=p_store_id AND s.is_active AND sc.is_active AND sc.slug=p_category_slug AND p_category_slug IN ('supermarket','bookstores','personal-care')
),
requested AS (
  SELECT t.id, MIN(t.position) AS position
  FROM unnest(COALESCE(p_product_ids,'{}'::uuid[])) WITH ORDINALITY AS t(id,position)
  WHERE t.position <= 120
  GROUP BY t.id
),
items AS (
  SELECT p.*, req.position,
    COALESCE(NULLIF(p.image_url,''), (
      SELECT pi.image_url FROM now.product_images pi
      WHERE pi.product_id=p.id AND pi.is_active
      ORDER BY pi.is_cover DESC,pi.sort_order,pi.id LIMIT 1
    )) AS cover_image
  FROM requested req
  JOIN now.products p ON p.id=req.id AND p.store_id=p_store_id
  JOIN selected_store ss ON ss.id=p.store_id
  JOIN now.catalog_categories cat ON cat.id=p.catalog_category_id AND cat.is_active
  WHERE p.is_active AND p.is_available AND NOT p.requires_prescription
)
SELECT COALESCE(jsonb_agg(
  jsonb_build_object(
    'id',id,'slug',slug,'productType',product_type,
    'catalogCategoryId',catalog_category_id,
    'name',name_ar,'nameEn',name_en,
    'description',COALESCE(description_ar,''),
    'descriptionEn',description_en,
    'price',base_price,'compareAtPrice',compare_at_price,
    'sku',sku,'barcode',barcode,'unitLabelAr',unit_label_ar,'unitLabelEn',unit_label_en,
    'icon',COALESCE(icon,'📦'),'imageUrl',cover_image,
    'isAgeRestricted',is_age_restricted,
    'variants','[]'::jsonb,'images','[]'::jsonb
  ) ORDER BY position
),'[]'::jsonb) FROM items
$function$
;
REVOKE ALL ON FUNCTION now.get_catalog_preview_products__v1(p_store_id uuid, p_product_ids uuid[], p_category_slug text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION now.get_catalog_preview_products__v1(p_store_id uuid, p_product_ids uuid[], p_category_slug text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION now.search_catalog_products_paged__v1(p_query text, p_service_area_id uuid DEFAULT NULL::uuid, p_store_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 48, p_offset integer DEFAULT 0, p_category_slug text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'now', 'pg_temp'
AS $function$
DECLARE
  v_area_id uuid;
  v_query text;
  v_max integer := LEAST(GREATEST(COALESCE(p_limit, 48), 1), 60);
  v_result jsonb;
  v_offset integer := LEAST(GREATEST(COALESCE(p_offset, 0), 0), 20000);
BEGIN
  v_query := lower(translate(COALESCE(p_query, ''), 'إأآٱىؤئة', 'اااايويه'));
  v_query := translate(v_query, 'ًٌٍَُِّْٰ', '');
  v_query := regexp_replace(replace(replace(v_query, '%', ' '), '_', ' '), '[[:space:]]+', ' ', 'g');
  v_query := btrim(left(v_query, 90));

  IF char_length(v_query) < 2 THEN
    RETURN '[]'::jsonb;
  END IF;

  v_area_id := p_service_area_id;
  IF v_area_id IS NULL THEN
    SELECT a.default_service_area_id
      INTO v_area_id
      FROM now.app_settings a
      WHERE a.singleton = TRUE;
  END IF;

  IF v_area_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH selected_store AS (
    SELECT
      s.id, s.name_ar, s.icon, s.is_manually_closed,
      ssa.delivery_fee, ssa.minimum_order_amount
    FROM now.stores s
    JOIN now.store_categories sc
      ON sc.id = s.category_id
      AND sc.slug = p_category_slug AND p_category_slug IN ('supermarket','bookstores','personal-care')
      AND sc.is_active = TRUE
    JOIN now.store_service_areas ssa
      ON ssa.store_id = s.id
      AND ssa.service_area_id = v_area_id
      AND ssa.is_available = TRUE
    JOIN now.service_areas sa
      ON sa.id = v_area_id
      AND sa.is_active = TRUE
    WHERE s.is_active = TRUE
      AND (p_store_id IS NULL OR s.id = p_store_id)
    ORDER BY s.is_featured DESC, s.sort_order, s.id
    LIMIT 1
  ),
  normalized AS (
    SELECT
      p.*, cat.slug AS section_slug,
      cat.name_ar AS category_name,
      s.name_ar AS store_name,
      s.icon AS store_icon,
      s.delivery_fee,
      s.minimum_order_amount,
      s.is_manually_closed AS store_manually_closed,
      translate(
        lower(translate(COALESCE(p.name_ar, ''), 'إأآٱىؤئة', 'اااايويه')),
        'ًٌٍَُِّْٰ', ''
      ) AS name_normalized,
      translate(
        lower(translate(
          concat_ws(' ', p.name_ar, p.name_en, p.description_ar,
                    p.description_en, p.sku, p.barcode, p.unit_label_ar),
          'إأآٱىؤئة', 'اااايويه')),
        'ًٌٍَُِّْٰ', ''
      ) AS searchable
    FROM selected_store s
    JOIN now.products p ON p.store_id = s.id
      AND p.is_active = TRUE AND p.is_available = TRUE
    JOIN now.catalog_categories cat ON cat.id = p.catalog_category_id
      AND cat.store_id = p.store_id AND cat.is_active = TRUE
  ),
  matches AS (
    SELECT n.*,
      CASE
        WHEN n.name_normalized = v_query THEN 500
        WHEN n.name_normalized LIKE v_query || '%' THEN 400
        WHEN n.name_normalized LIKE '% ' || v_query || '%' THEN 350
        WHEN n.name_normalized LIKE '%' || v_query || '%' THEN 300
        ELSE 150
      END AS rank_score
    FROM normalized n
    WHERE
      n.searchable LIKE '%' || v_query || '%'
      OR NOT EXISTS (
        SELECT 1
        FROM unnest(string_to_array(v_query, ' ')) AS token(word)
        WHERE token.word <> '' AND n.searchable NOT LIKE '%' || token.word || '%'
      )
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'product_id', x.id,
    'store_id', x.store_id,
    'store_name', x.store_name,
    'store_icon', COALESCE(x.store_icon,'🏪'),
    'store_manually_closed', x.store_manually_closed,
    'delivery_fee', x.delivery_fee,
    'minimum_order', x.minimum_order_amount,
    'section_id', x.catalog_category_id,
    'section_slug', x.section_slug,
    'category_name', x.category_name,
    'name_ar', x.name_ar,
    'description_ar', COALESCE(x.description_ar,''),
    'image_url', COALESCE(x.image_url, (
       SELECT pi.image_url FROM now.product_images pi
       WHERE pi.product_id=x.id AND pi.is_active=TRUE
       ORDER BY pi.is_cover DESC, pi.sort_order, pi.id LIMIT 1
    )),
    'icon', COALESCE(x.icon,'📦'),
    'price', x.base_price,
    'compare_at_price', x.compare_at_price,
    'unit_label_ar', x.unit_label_ar,
    'is_age_restricted', x.is_age_restricted,
    'product_type', x.product_type
  ) ORDER BY x.rank_score DESC, x.sort_order, x.name_ar, x.id),'[]'::jsonb)
  INTO v_result
  FROM (
    SELECT *
    FROM matches
    ORDER BY rank_score DESC, sort_order, name_ar, id
    LIMIT v_max OFFSET v_offset
  ) AS x;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$function$
;
REVOKE ALL ON FUNCTION now.search_catalog_products_paged__v1(p_query text, p_service_area_id uuid, p_store_id uuid, p_limit integer, p_offset integer, p_category_slug text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION now.search_catalog_products_paged__v1(p_query text, p_service_area_id uuid, p_store_id uuid, p_limit integer, p_offset integer, p_category_slug text) TO anon, authenticated;

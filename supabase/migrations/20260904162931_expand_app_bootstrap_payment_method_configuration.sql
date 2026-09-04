create or replace function now.get_app_bootstrap()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'settings',
    (
      select jsonb_build_object(
        'app_name', s.app_name,
        'app_slug', s.app_slug,
        'app_logo_url', s.app_logo_url,
        'default_locale', s.default_locale,
        'timezone', s.timezone,
        'currency_code', s.currency_code,
        'currency_symbol', s.currency_symbol,
        'default_city_id', s.default_city_id,
        'default_service_area_id', s.default_service_area_id,
        'whatsapp_number', s.whatsapp_number,
        'support_phone', s.support_phone,
        'support_whatsapp', s.support_whatsapp,
        'support_email', s.support_email,
        'catalog_enabled', s.catalog_enabled,
        'orders_enabled', s.orders_enabled,
        'maintenance_mode', s.maintenance_mode,
        'maintenance_message_ar', s.maintenance_message_ar,
        'maintenance_message_en', s.maintenance_message_en,
        'minimum_supported_app_version', s.minimum_supported_app_version,
        'privacy_url', s.privacy_url,
        'terms_url', s.terms_url
      )
      from now.app_settings s
      where s.singleton = true
    ),
    'cities',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', c.id,
            'slug', c.slug,
            'name_ar', c.name_ar,
            'name_en', c.name_en,
            'areas',
            coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'id', a.id,
                    'code', a.code,
                    'name_ar', a.name_ar,
                    'name_en', a.name_en,
                    'default_delivery_fee', a.default_delivery_fee,
                    'default_minimum_order_amount', a.default_minimum_order_amount,
                    'default_estimated_delivery_minutes', a.default_estimated_delivery_minutes
                  )
                  order by a.sort_order, a.name_ar
                )
                from now.service_areas a
                where a.city_id = c.id
                  and a.is_active = true
              ),
              '[]'::jsonb
            )
          )
          order by c.sort_order, c.name_ar
        )
        from now.cities c
        where c.is_active = true
      ),
      '[]'::jsonb
    ),
    'store_categories',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', sc.id,
            'slug', sc.slug,
            'name_ar', sc.name_ar,
            'name_en', sc.name_en,
            'subtitle_ar', sc.subtitle_ar,
            'subtitle_en', sc.subtitle_en,
            'icon', sc.icon,
            'image_url', sc.image_url
          )
          order by sc.sort_order, sc.name_ar
        )
        from now.store_categories sc
        where sc.is_active = true
      ),
      '[]'::jsonb
    ),
    'payment_methods',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', pm.id,
            'code', pm.code,
            'name_ar', pm.name_ar,
            'name_en', pm.name_en,
            'subtitle_ar', pm.subtitle_ar,
            'subtitle_en', pm.subtitle_en,
            'icon', pm.icon,
            'icon_url', pm.icon_url,
            'instructions_ar', pm.instructions_ar,
            'instructions_en', pm.instructions_en,
            'processing_fee_enabled', pm.processing_fee_enabled,
            'processing_fee_type', pm.processing_fee_type,
            'processing_fee_percentage', pm.processing_fee_percentage,
            'processing_fee_fixed_amount', pm.processing_fee_fixed_amount,
            'processing_fee_min_amount', pm.processing_fee_min_amount,
            'processing_fee_max_amount', pm.processing_fee_max_amount,
            'processing_fee_charge_customer', pm.processing_fee_charge_customer,
            'processing_fee_label_ar', pm.processing_fee_label_ar,
            'processing_fee_label_en', pm.processing_fee_label_en,
            'requires_payment_proof', pm.requires_payment_proof
          )
          order by pm.sort_order, pm.name_ar
        )
        from now.payment_methods pm
        where pm.is_active = true
      ),
      '[]'::jsonb
    )
  );
$function$;

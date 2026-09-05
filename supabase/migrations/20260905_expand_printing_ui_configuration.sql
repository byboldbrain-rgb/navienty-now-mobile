-- Navienty Now — complete database ownership of printing-specific UI copy.
-- Additive and backward compatible with carts created before this migration.

begin;

alter table now.printing_services
  add column if not exists ui_copy jsonb not null default '{}'::jsonb,
  add column if not exists ui_icons jsonb not null default '{}'::jsonb;

update now.printing_services
set
  ui_copy = jsonb_build_object(
    'pageUnitLabel', 'صفحة',
    'pageRangeErrorTemplate', 'اكتب رقمًا من {min} إلى {max} صفحة.',
    'totalSheetsErrorTemplate', 'الحد الأقصى للطلب الواحد {max} ورقة A4.',
    'closedAlertTitle', 'المكتبة مغلقة حاليًا',
    'closedFallback', 'لا يمكن إضافة طلب طباعة الآن.',
    'addError', 'تعذر إضافة طلب الطباعة إلى هذه السلة.',
    'submitError', 'تعذر إضافة طلب الطباعة. حاول مرة أخرى.',
    'backAccessibilityLabel', 'رجوع',
    'increaseCopiesAccessibilityLabel', 'زيادة عدد النسخ',
    'decreaseCopiesAccessibilityLabel', 'تقليل عدد النسخ',
    'cartEditLabel', 'تعديل',
    'cartDeleteAccessibilityLabel', 'حذف طلب الطباعة',
    'physicalSheetsUnitLabel', 'ورقة A4 فعلية',
    'copyUnitLabel', 'نسخة',
    'orderItemsSummaryLabel', 'عناصر الطلب',
    'confirmationTitle', 'طلب الطباعة محفوظ وجاهز',
    'confirmationBody', 'أكد الطلب داخل Navienty Now، وبعدها سيفتح واتساب بالمواصفات تلقائيًا لتُرفق ملف الطباعة.',
    'confirmationPrimaryCta', 'تأكيد الطلب والمتابعة لإرسال الملف',
    'sendFileCtaLabel', 'إرسال ملف الطباعة عبر واتساب',
    'sendFileCtaHelper', 'خطوة مطلوبة لبدء تجهيز الطباعة',
    'orderFileCtaTitle', 'إرسال ملف الطباعة عبر واتساب',
    'orderFileCtaBody', 'بعد تأكيد الطلب افتح واتساب وأرفق الملف المطابق لعدد الصفحات والمواصفات.',
    'whatsappOpenErrorBody', 'تم إنشاء طلبك بنجاح. افتح واتساب من شاشة الطلب وأرسل ملف الطباعة.'
  ) || case
    when jsonb_typeof(ui_copy) = 'object' then ui_copy
    else '{}'::jsonb
  end,
  ui_icons = jsonb_build_object(
    'hero', 'print-outline',
    'pageSizeBadge', 'document-text-outline',
    'summary', 'receipt-outline',
    'fileNotice', 'logo-whatsapp',
    'addCta', 'bag-add-outline',
    'updateCta', 'checkmark',
    'confirmation', 'receipt-outline',
    'orderFile', 'logo-whatsapp'
  ) || case
    when jsonb_typeof(ui_icons) = 'object' then ui_icons
    else '{}'::jsonb
  end;

alter table now.printing_services
  alter column ui_copy set default '{"pageUnitLabel":"صفحة","pageRangeErrorTemplate":"اكتب رقمًا من {min} إلى {max} صفحة.","totalSheetsErrorTemplate":"الحد الأقصى للطلب الواحد {max} ورقة A4.","closedAlertTitle":"المكتبة مغلقة حاليًا","closedFallback":"لا يمكن إضافة طلب طباعة الآن.","addError":"تعذر إضافة طلب الطباعة إلى هذه السلة.","submitError":"تعذر إضافة طلب الطباعة. حاول مرة أخرى.","backAccessibilityLabel":"رجوع","increaseCopiesAccessibilityLabel":"زيادة عدد النسخ","decreaseCopiesAccessibilityLabel":"تقليل عدد النسخ","cartEditLabel":"تعديل","cartDeleteAccessibilityLabel":"حذف طلب الطباعة","physicalSheetsUnitLabel":"ورقة A4 فعلية","copyUnitLabel":"نسخة","orderItemsSummaryLabel":"عناصر الطلب","confirmationTitle":"طلب الطباعة محفوظ وجاهز","confirmationBody":"أكد الطلب داخل Navienty Now، وبعدها سيفتح واتساب بالمواصفات تلقائيًا لتُرفق ملف الطباعة.","confirmationPrimaryCta":"تأكيد الطلب والمتابعة لإرسال الملف","sendFileCtaLabel":"إرسال ملف الطباعة عبر واتساب","sendFileCtaHelper":"خطوة مطلوبة لبدء تجهيز الطباعة","orderFileCtaTitle":"إرسال ملف الطباعة عبر واتساب","orderFileCtaBody":"بعد تأكيد الطلب افتح واتساب وأرفق الملف المطابق لعدد الصفحات والمواصفات.","whatsappOpenErrorBody":"تم إنشاء طلبك بنجاح. افتح واتساب من شاشة الطلب وأرسل ملف الطباعة."}'::jsonb,
  alter column ui_icons set default '{"hero":"print-outline","pageSizeBadge":"document-text-outline","summary":"receipt-outline","fileNotice":"logo-whatsapp","addCta":"bag-add-outline","updateCta":"checkmark","confirmation":"receipt-outline","orderFile":"logo-whatsapp"}'::jsonb,
  alter column ui_copy set not null,
  alter column ui_icons set not null;

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'now.printing_services'::regclass
      and conname = 'printing_services_ui_copy_object_check'
  ) then
    alter table now.printing_services
      add constraint printing_services_ui_copy_object_check
      check (jsonb_typeof(ui_copy) = 'object');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'now.printing_services'::regclass
      and conname = 'printing_services_ui_icons_object_check'
  ) then
    alter table now.printing_services
      add constraint printing_services_ui_icons_object_check
      check (jsonb_typeof(ui_icons) = 'object');
  end if;
end
$migration$;

comment on column now.printing_services.ui_copy is
  'Printing-specific UI copy. Existing keys may be overridden per store without a mobile release.';
comment on column now.printing_services.ui_icons is
  'Ionicons names used by the printing experience, controlled per store.';

create or replace function now.get_printing_service_config(
  p_store_id uuid,
  p_catalog_category_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = now, pg_temp
as $function$
  select jsonb_build_object(
    'id', service.id,
    'store_id', service.store_id,
    'catalog_category_id', service.catalog_category_id,
    'category_slug', category.slug,
    'product_id', service.product_id,
    'product_name_ar', service.cart_item_name_ar,
    'product_icon', coalesce(product.icon, '🖨️'),
    'eyebrow_ar', service.eyebrow_ar,
    'title_ar', service.title_ar,
    'subtitle_ar', service.subtitle_ar,
    'page_size_label_ar', service.page_size_label_ar,
    'color_section_title_ar', service.color_section_title_ar,
    'sides_section_title_ar', service.sides_section_title_ar,
    'page_count_label_ar', service.page_count_label_ar,
    'page_count_helper_ar', service.page_count_helper_ar,
    'copy_count_label_ar', service.copy_count_label_ar,
    'copy_count_helper_ar', service.copy_count_helper_ar,
    'summary_title_ar', service.summary_title_ar,
    'sheets_per_copy_label_ar', service.sheets_per_copy_label_ar,
    'total_sheets_label_ar', service.total_sheets_label_ar,
    'price_per_sheet_label_ar', service.price_per_sheet_label_ar,
    'total_label_ar', service.total_label_ar,
    'file_notice_title_ar', service.file_notice_title_ar,
    'file_notice_body_ar', service.file_notice_body_ar,
    'add_cta_label_ar', service.add_cta_label_ar,
    'update_cta_label_ar', service.update_cta_label_ar,
    'whatsapp_file_prompt_ar', service.whatsapp_file_prompt_ar,
    'ui_copy', service.ui_copy,
    'ui_icons', service.ui_icons,
    'accent_color', service.accent_color,
    'accent_dark_color', service.accent_dark_color,
    'hero_background_color', service.hero_background_color,
    'minimum_page_count', service.minimum_page_count,
    'maximum_page_count', service.maximum_page_count,
    'default_page_count', service.default_page_count,
    'page_count_presets', to_jsonb(service.page_count_presets),
    'minimum_copy_count', service.minimum_copy_count,
    'maximum_copy_count', service.maximum_copy_count,
    'default_copy_count', service.default_copy_count,
    'maximum_total_sheets', service.maximum_total_sheets,
    'color_options', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', color_option.id,
          'key', color_option.option_key,
          'label_ar', color_option.label_ar,
          'helper_ar', color_option.helper_ar,
          'icon_name', color_option.icon_name,
          'is_default', color_option.is_default,
          'sort_order', color_option.sort_order
        )
        order by color_option.sort_order, color_option.id
      )
      from now.printing_color_options color_option
      where color_option.printing_service_id = service.id
        and color_option.is_active = true
    ), '[]'::jsonb),
    'side_options', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', side_option.id,
          'key', side_option.option_key,
          'label_ar', side_option.label_ar,
          'helper_ar', side_option.helper_ar,
          'icon_name', side_option.icon_name,
          'pages_per_sheet', side_option.pages_per_sheet,
          'is_default', side_option.is_default,
          'sort_order', side_option.sort_order
        )
        order by side_option.sort_order, side_option.id
      )
      from now.printing_side_options side_option
      where side_option.printing_service_id = service.id
        and side_option.is_active = true
    ), '[]'::jsonb),
    'rates', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', rate.id,
          'color_option_id', rate.color_option_id,
          'side_option_id', rate.side_option_id,
          'product_variant_id', rate.product_variant_id,
          'price_per_sheet', variant.price,
          'sort_order', rate.sort_order
        )
        order by rate.sort_order, rate.id
      )
      from now.printing_rates rate
      join now.product_variants variant
        on variant.id = rate.product_variant_id
      where rate.printing_service_id = service.id
        and rate.is_active = true
        and variant.is_active = true
        and variant.is_available = true
    ), '[]'::jsonb)
  )
  from now.printing_services service
  join now.catalog_categories category
    on category.id = service.catalog_category_id
   and category.store_id = service.store_id
   and category.is_active = true
  join now.products product
    on product.id = service.product_id
   and product.store_id = service.store_id
   and product.is_active = true
   and product.is_available = true
  join now.stores store
    on store.id = service.store_id
   and store.is_active = true
  where service.store_id = p_store_id
    and service.catalog_category_id = p_catalog_category_id
    and service.is_active = true
  limit 1;
$function$;

create or replace function now.get_printing_job_quote_internal(
  p_printing_service_id uuid,
  p_color_option_id uuid,
  p_side_option_id uuid,
  p_page_count integer,
  p_copy_count integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = now, pg_temp
as $function$
declare
  v_service now.printing_services%rowtype;
  v_category now.catalog_categories%rowtype;
  v_product now.products%rowtype;
  v_color now.printing_color_options%rowtype;
  v_side now.printing_side_options%rowtype;
  v_rate now.printing_rates%rowtype;
  v_variant now.product_variants%rowtype;
  v_sheets_per_copy integer;
  v_total_sheets integer;
  v_total_price numeric(12, 2);
  v_summary_ar text;
begin
  select * into v_service
  from now.printing_services
  where id = p_printing_service_id
    and is_active = true;

  if not found then
    raise exception using errcode = 'P0002', message = 'printing_service_not_available';
  end if;

  select * into v_category
  from now.catalog_categories
  where id = v_service.catalog_category_id
    and store_id = v_service.store_id
    and is_active = true;

  select * into v_product
  from now.products
  where id = v_service.product_id
    and store_id = v_service.store_id
    and product_type = 'service'
    and metadata ->> 'service_kind' = 'print_job'
    and is_active = true
    and is_available = true;

  if v_category.id is null or v_product.id is null then
    raise exception using errcode = 'P0002', message = 'printing_service_not_available';
  end if;

  if p_page_count is null
     or p_page_count < v_service.minimum_page_count
     or p_page_count > v_service.maximum_page_count then
    raise exception using
      errcode = '22023',
      message = 'invalid_printing_page_count',
      detail = jsonb_build_object(
        'minimum', v_service.minimum_page_count,
        'maximum', v_service.maximum_page_count
      )::text;
  end if;

  if p_copy_count is null
     or p_copy_count < v_service.minimum_copy_count
     or p_copy_count > v_service.maximum_copy_count then
    raise exception using
      errcode = '22023',
      message = 'invalid_printing_copy_count',
      detail = jsonb_build_object(
        'minimum', v_service.minimum_copy_count,
        'maximum', v_service.maximum_copy_count
      )::text;
  end if;

  select * into v_color
  from now.printing_color_options
  where id = p_color_option_id
    and printing_service_id = v_service.id
    and is_active = true;

  if not found then
    raise exception using errcode = 'P0002', message = 'printing_color_option_not_available';
  end if;

  select * into v_side
  from now.printing_side_options
  where id = p_side_option_id
    and printing_service_id = v_service.id
    and is_active = true;

  if not found then
    raise exception using errcode = 'P0002', message = 'printing_side_option_not_available';
  end if;

  select * into v_rate
  from now.printing_rates
  where printing_service_id = v_service.id
    and color_option_id = v_color.id
    and side_option_id = v_side.id
    and is_active = true;

  if not found then
    raise exception using errcode = 'P0002', message = 'printing_rate_not_available';
  end if;

  select * into v_variant
  from now.product_variants
  where id = v_rate.product_variant_id
    and product_id = v_product.id
    and is_active = true
    and is_available = true;

  if not found then
    raise exception using errcode = 'P0002', message = 'printing_rate_not_available';
  end if;

  v_sheets_per_copy := ceil(p_page_count::numeric / v_side.pages_per_sheet)::integer;
  v_total_sheets := v_sheets_per_copy * p_copy_count;

  if v_total_sheets > v_service.maximum_total_sheets then
    raise exception using
      errcode = '22023',
      message = 'printing_total_sheets_limit_exceeded',
      detail = jsonb_build_object('maximum', v_service.maximum_total_sheets)::text;
  end if;

  v_total_price := round(v_variant.price * v_total_sheets, 2);
  v_summary_ar := format(
    '%s • %s • %s صفحة • %s نسخة • %s',
    v_color.label_ar,
    v_side.label_ar,
    p_page_count,
    p_copy_count,
    v_service.page_size_label_ar
  );

  return jsonb_build_object(
    'printing_service_id', v_service.id,
    'store_id', v_service.store_id,
    'catalog_category_id', v_service.catalog_category_id,
    'category_slug', v_category.slug,
    'product_id', v_product.id,
    'product_variant_id', v_variant.id,
    'product_name_ar', v_service.cart_item_name_ar,
    'product_icon', coalesce(v_product.icon, '🖨️'),
    'color_option_id', v_color.id,
    'color_key', v_color.option_key,
    'color_label_ar', v_color.label_ar,
    'side_option_id', v_side.id,
    'side_key', v_side.option_key,
    'side_label_ar', v_side.label_ar,
    'pages_per_sheet', v_side.pages_per_sheet,
    'page_size_label_ar', v_service.page_size_label_ar,
    'page_count', p_page_count,
    'copy_count', p_copy_count,
    'sheets_per_copy', v_sheets_per_copy,
    'total_sheets', v_total_sheets,
    'price_per_sheet', v_variant.price,
    'total_price', v_total_price,
    'summary_ar', v_summary_ar,
    'whatsapp_file_prompt_ar', v_service.whatsapp_file_prompt_ar,
    'ui_copy', v_service.ui_copy,
    'ui_icons', v_service.ui_icons
  );
end;
$function$;

commit;

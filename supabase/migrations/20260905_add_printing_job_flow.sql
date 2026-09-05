-- Navienty Now — database-driven A4 printing flow.
-- Production strategy: additive Expand–Migrate–Contract change.

begin;

/* --------------------------------------------------------------------------
 * 1. Catalog routing metadata
 * -------------------------------------------------------------------------- */

alter table now.catalog_categories
  add column if not exists experience_key text;

comment on column now.catalog_categories.experience_key is
  'Optional client experience renderer key. NULL keeps the regular catalog UI.';

/* --------------------------------------------------------------------------
 * 2. Printing configuration
 * -------------------------------------------------------------------------- */

create table if not exists now.printing_services (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  catalog_category_id uuid not null,
  product_id uuid not null,

  eyebrow_ar text not null default 'خدمة الطباعة',
  title_ar text not null,
  subtitle_ar text not null,
  page_size_label_ar text not null default 'A4',

  color_section_title_ar text not null default 'نوع الطباعة',
  sides_section_title_ar text not null default 'الطباعة على الورق',
  page_count_label_ar text not null default 'عدد صفحات الملف',
  page_count_helper_ar text not null,
  copy_count_label_ar text not null default 'عدد النسخ',
  copy_count_helper_ar text not null,

  summary_title_ar text not null default 'ملخص طلب الطباعة',
  sheets_per_copy_label_ar text not null default 'ورق لكل نسخة',
  total_sheets_label_ar text not null default 'إجمالي أوراق A4',
  price_per_sheet_label_ar text not null default 'سعر الورقة',
  total_label_ar text not null default 'إجمالي الطباعة',

  file_notice_title_ar text not null default 'إرسال الملف بعد الطلب',
  file_notice_body_ar text not null,
  add_cta_label_ar text not null default 'إضافة طلب الطباعة للسلة',
  update_cta_label_ar text not null default 'تحديث طلب الطباعة',
  cart_item_name_ar text not null default 'طباعة ملف A4',
  whatsapp_file_prompt_ar text not null,

  accent_color text not null default '#00B14F',
  accent_dark_color text not null default '#009245',
  hero_background_color text not null default '#EAF8F0',

  minimum_page_count integer not null default 1,
  maximum_page_count integer not null default 2000,
  default_page_count integer not null default 10,
  page_count_presets integer[] not null default array[10, 25, 50, 100, 200],
  minimum_copy_count integer not null default 1,
  maximum_copy_count integer not null default 20,
  default_copy_count integer not null default 1,
  maximum_total_sheets integer not null default 5000,

  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint printing_services_store_fkey
    foreign key (store_id)
    references now.stores(id)
    on update restrict
    on delete restrict,
  constraint printing_services_category_store_fkey
    foreign key (catalog_category_id, store_id)
    references now.catalog_categories(id, store_id)
    on update restrict
    on delete restrict,
  constraint printing_services_product_fkey
    foreign key (product_id)
    references now.products(id)
    on update restrict
    on delete restrict,
  constraint printing_services_store_category_key
    unique (store_id, catalog_category_id),
  constraint printing_services_product_key
    unique (product_id),
  constraint printing_services_bounds_check
    check (
      minimum_page_count >= 1
      and maximum_page_count >= minimum_page_count
      and default_page_count between minimum_page_count and maximum_page_count
      and minimum_copy_count >= 1
      and maximum_copy_count >= minimum_copy_count
      and default_copy_count between minimum_copy_count and maximum_copy_count
      and maximum_total_sheets >= 1
      and sort_order >= 0
    ),
  constraint printing_services_presets_check
    check (
      cardinality(page_count_presets) between 1 and 10
      and 0 < all(page_count_presets)
    ),
  constraint printing_services_accent_color_check
    check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint printing_services_accent_dark_color_check
    check (accent_dark_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint printing_services_hero_color_check
    check (hero_background_color ~ '^#[0-9A-Fa-f]{6}$')
);

create table if not exists now.printing_color_options (
  id uuid primary key default gen_random_uuid(),
  printing_service_id uuid not null,
  option_key text not null,
  label_ar text not null,
  helper_ar text not null,
  icon_name text not null default 'document-text-outline',
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint printing_color_options_service_fkey
    foreign key (printing_service_id)
    references now.printing_services(id)
    on update restrict
    on delete cascade,
  constraint printing_color_options_service_key
    unique (printing_service_id, option_key),
  constraint printing_color_options_id_service_key
    unique (id, printing_service_id),
  constraint printing_color_options_key_format_check
    check (option_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint printing_color_options_sort_check
    check (sort_order >= 0)
);

create table if not exists now.printing_side_options (
  id uuid primary key default gen_random_uuid(),
  printing_service_id uuid not null,
  option_key text not null,
  label_ar text not null,
  helper_ar text not null,
  icon_name text not null default 'documents-outline',
  pages_per_sheet integer not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint printing_side_options_service_fkey
    foreign key (printing_service_id)
    references now.printing_services(id)
    on update restrict
    on delete cascade,
  constraint printing_side_options_service_key
    unique (printing_service_id, option_key),
  constraint printing_side_options_id_service_key
    unique (id, printing_service_id),
  constraint printing_side_options_key_format_check
    check (option_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint printing_side_options_pages_check
    check (pages_per_sheet between 1 and 2),
  constraint printing_side_options_sort_check
    check (sort_order >= 0)
);

create table if not exists now.printing_rates (
  id uuid primary key default gen_random_uuid(),
  printing_service_id uuid not null,
  color_option_id uuid not null,
  side_option_id uuid not null,
  product_variant_id uuid not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint printing_rates_service_fkey
    foreign key (printing_service_id)
    references now.printing_services(id)
    on update restrict
    on delete cascade,
  constraint printing_rates_color_service_fkey
    foreign key (color_option_id, printing_service_id)
    references now.printing_color_options(id, printing_service_id)
    on update restrict
    on delete restrict,
  constraint printing_rates_side_service_fkey
    foreign key (side_option_id, printing_service_id)
    references now.printing_side_options(id, printing_service_id)
    on update restrict
    on delete restrict,
  constraint printing_rates_variant_fkey
    foreign key (product_variant_id)
    references now.product_variants(id)
    on update restrict
    on delete restrict,
  constraint printing_rates_combination_key
    unique (printing_service_id, color_option_id, side_option_id),
  constraint printing_rates_variant_key
    unique (product_variant_id),
  constraint printing_rates_sort_check
    check (sort_order >= 0)
);

comment on table now.printing_services is
  'Database-controlled UI, validation bounds, and WhatsApp copy for A4 print jobs.';
comment on table now.printing_rates is
  'Maps each color/sides combination to the authoritative catalog variant price.';

create index if not exists printing_services_store_active_idx
  on now.printing_services (store_id, catalog_category_id)
  where is_active = true;
create index if not exists printing_color_options_service_active_idx
  on now.printing_color_options (printing_service_id, sort_order)
  where is_active = true;
create index if not exists printing_side_options_service_active_idx
  on now.printing_side_options (printing_service_id, sort_order)
  where is_active = true;
create index if not exists printing_rates_service_active_idx
  on now.printing_rates (printing_service_id, color_option_id, side_option_id)
  where is_active = true;

drop trigger if exists set_printing_services_updated_at on now.printing_services;
create trigger set_printing_services_updated_at
before update on now.printing_services
for each row execute function now.set_updated_at();

drop trigger if exists set_printing_color_options_updated_at on now.printing_color_options;
create trigger set_printing_color_options_updated_at
before update on now.printing_color_options
for each row execute function now.set_updated_at();

drop trigger if exists set_printing_side_options_updated_at on now.printing_side_options;
create trigger set_printing_side_options_updated_at
before update on now.printing_side_options
for each row execute function now.set_updated_at();

drop trigger if exists set_printing_rates_updated_at on now.printing_rates;
create trigger set_printing_rates_updated_at
before update on now.printing_rates
for each row execute function now.set_updated_at();

/* --------------------------------------------------------------------------
 * 3. Order snapshots
 * -------------------------------------------------------------------------- */

alter table now.order_items
  add column if not exists item_kind text not null default 'catalog_product',
  add column if not exists configuration_snapshot jsonb not null default '{}'::jsonb;

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'now.order_items'::regclass
      and conname = 'order_items_item_kind_check'
  ) then
    alter table now.order_items
      add constraint order_items_item_kind_check
      check (item_kind in ('catalog_product', 'print_job'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'now.order_items'::regclass
      and conname = 'order_items_configuration_object_check'
  ) then
    alter table now.order_items
      add constraint order_items_configuration_object_check
      check (jsonb_typeof(configuration_snapshot) = 'object');
  end if;
end
$migration$;

/* --------------------------------------------------------------------------
 * 4. RLS and table grants
 * -------------------------------------------------------------------------- */

alter table now.printing_services enable row level security;
alter table now.printing_color_options enable row level security;
alter table now.printing_side_options enable row level security;
alter table now.printing_rates enable row level security;

drop policy if exists printing_services_public_read on now.printing_services;
create policy printing_services_public_read
on now.printing_services
for select
to anon, authenticated
using (is_active = true);

drop policy if exists printing_color_options_public_read on now.printing_color_options;
create policy printing_color_options_public_read
on now.printing_color_options
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from now.printing_services service
    where service.id = printing_service_id
      and service.is_active = true
  )
);

drop policy if exists printing_side_options_public_read on now.printing_side_options;
create policy printing_side_options_public_read
on now.printing_side_options
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from now.printing_services service
    where service.id = printing_service_id
      and service.is_active = true
  )
);

drop policy if exists printing_rates_public_read on now.printing_rates;
create policy printing_rates_public_read
on now.printing_rates
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from now.printing_services service
    where service.id = printing_service_id
      and service.is_active = true
  )
);

revoke all on table now.printing_services from public, anon, authenticated;
revoke all on table now.printing_color_options from public, anon, authenticated;
revoke all on table now.printing_side_options from public, anon, authenticated;
revoke all on table now.printing_rates from public, anon, authenticated;

grant select on table now.printing_services to anon, authenticated;
grant select on table now.printing_color_options to anon, authenticated;
grant select on table now.printing_side_options to anon, authenticated;
grant select on table now.printing_rates to anon, authenticated;

/* --------------------------------------------------------------------------
 * 5. Seed the print service for every active bookstore that has the category.
 *    IDs are resolved by natural keys; no generated ID is hard-coded.
 * -------------------------------------------------------------------------- */

update now.catalog_categories category
set experience_key = 'print_job_builder'
from now.stores store
join now.store_categories store_category
  on store_category.id = store.category_id
where category.store_id = store.id
  and category.slug = 'printing-paper-printing-service'
  and store_category.slug in ('bookstore', 'bookstores');

insert into now.products (
  store_id,
  catalog_category_id,
  product_type,
  slug,
  name_ar,
  name_en,
  description_ar,
  description_en,
  base_price,
  unit_label_ar,
  unit_label_en,
  is_available,
  is_active,
  requires_prescription,
  is_age_restricted,
  sort_order,
  metadata,
  icon
)
select
  category.store_id,
  category.id,
  'service',
  'a4-print-job',
  'طباعة ملف A4',
  'A4 document printing',
  'خدمة طباعة ملفات A4 حسب عدد الصفحات والنسخ.',
  'A4 document printing by page and copy count.',
  1.00,
  'طلب طباعة',
  'print job',
  true,
  true,
  false,
  false,
  0,
  jsonb_build_object(
    'service_kind', 'print_job',
    'paper_size', 'A4'
  ),
  '🖨️'
from now.catalog_categories category
join now.stores store
  on store.id = category.store_id
join now.store_categories store_category
  on store_category.id = store.category_id
where category.slug = 'printing-paper-printing-service'
  and category.is_active = true
  and store_category.slug in ('bookstore', 'bookstores')
on conflict (store_id, slug)
do update set
  catalog_category_id = excluded.catalog_category_id,
  product_type = excluded.product_type,
  name_ar = excluded.name_ar,
  name_en = excluded.name_en,
  description_ar = excluded.description_ar,
  description_en = excluded.description_en,
  base_price = excluded.base_price,
  unit_label_ar = excluded.unit_label_ar,
  unit_label_en = excluded.unit_label_en,
  is_available = true,
  is_active = true,
  requires_prescription = false,
  is_age_restricted = false,
  sort_order = excluded.sort_order,
  metadata = now.products.metadata || excluded.metadata,
  icon = excluded.icon,
  updated_at = now();

insert into now.printing_services (
  store_id,
  catalog_category_id,
  product_id,
  eyebrow_ar,
  title_ar,
  subtitle_ar,
  page_size_label_ar,
  color_section_title_ar,
  sides_section_title_ar,
  page_count_label_ar,
  page_count_helper_ar,
  copy_count_label_ar,
  copy_count_helper_ar,
  summary_title_ar,
  sheets_per_copy_label_ar,
  total_sheets_label_ar,
  price_per_sheet_label_ar,
  total_label_ar,
  file_notice_title_ar,
  file_notice_body_ar,
  add_cta_label_ar,
  update_cta_label_ar,
  cart_item_name_ar,
  whatsapp_file_prompt_ar,
  accent_color,
  accent_dark_color,
  hero_background_color,
  minimum_page_count,
  maximum_page_count,
  default_page_count,
  page_count_presets,
  minimum_copy_count,
  maximum_copy_count,
  default_copy_count,
  maximum_total_sheets,
  is_active,
  sort_order
)
select
  category.store_id,
  category.id,
  product.id,
  'خدمة الطباعة',
  'اطبع ملفك من غير ما تضيف كل ورقة لوحدها',
  'اختار نوع الطباعة والوجه، واكتب عدد صفحات الملف والنسخ. السعر هيتحسب فورًا.',
  'A4 فقط',
  'اختار نوع الطباعة',
  'اختار الطباعة على الورق',
  'عدد صفحات الملف',
  'اكتب عدد صفحات الملف كما هو ظاهر داخل الـPDF.',
  'عدد النسخ',
  'كل نسخة هتتطبع بنفس الاختيارات.',
  'ملخص طلب الطباعة',
  'ورق لكل نسخة',
  'إجمالي أوراق A4',
  'سعر الورقة',
  'إجمالي الطباعة',
  'هتبعت الملف على واتساب',
  'بعد إتمام الطلب هنفتح لك واتساب برسالة جاهزة. ابعت الملف في الرسالة التالية مباشرة.',
  'إضافة طلب الطباعة للسلة',
  'حفظ تعديلات الطباعة',
  'طباعة ملف A4',
  'من فضلك أرفق ملف الطباعة في الرسالة التالية، وتأكد أن عدد صفحاته مطابق للطلب.',
  '#00B14F',
  '#009245',
  '#EAF8F0',
  1,
  2000,
  10,
  array[10, 25, 50, 100, 200],
  1,
  20,
  1,
  5000,
  true,
  0
from now.catalog_categories category
join now.products product
  on product.store_id = category.store_id
 and product.slug = 'a4-print-job'
where category.slug = 'printing-paper-printing-service'
on conflict (store_id, catalog_category_id)
do update set
  product_id = excluded.product_id,
  is_active = true,
  updated_at = now();

insert into now.printing_color_options (
  printing_service_id,
  option_key,
  label_ar,
  helper_ar,
  icon_name,
  is_default,
  is_active,
  sort_order
)
select
  service.id,
  option.option_key,
  option.label_ar,
  option.helper_ar,
  option.icon_name,
  option.is_default,
  true,
  option.sort_order
from now.printing_services service
cross join (
  values
    ('black-white', 'أبيض وأسود', 'مناسب للمحاضرات والمذكرات', 'contrast-outline', true, 10),
    ('color', 'ألوان', 'للصور والعروض والملفات الملونة', 'color-palette-outline', false, 20)
) as option(option_key, label_ar, helper_ar, icon_name, is_default, sort_order)
on conflict (printing_service_id, option_key)
do update set
  label_ar = excluded.label_ar,
  helper_ar = excluded.helper_ar,
  icon_name = excluded.icon_name,
  is_default = excluded.is_default,
  is_active = true,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into now.printing_side_options (
  printing_service_id,
  option_key,
  label_ar,
  helper_ar,
  icon_name,
  pages_per_sheet,
  is_default,
  is_active,
  sort_order
)
select
  service.id,
  option.option_key,
  option.label_ar,
  option.helper_ar,
  option.icon_name,
  option.pages_per_sheet,
  option.is_default,
  true,
  option.sort_order
from now.printing_services service
cross join (
  values
    ('single-sided', 'وجه واحد', 'كل صفحة على ورقة منفصلة', 'document-outline', 1, true, 10),
    ('double-sided', 'وجهين', 'صفحتان على ورقة واحدة', 'documents-outline', 2, false, 20)
) as option(option_key, label_ar, helper_ar, icon_name, pages_per_sheet, is_default, sort_order)
on conflict (printing_service_id, option_key)
do update set
  label_ar = excluded.label_ar,
  helper_ar = excluded.helper_ar,
  icon_name = excluded.icon_name,
  pages_per_sheet = excluded.pages_per_sheet,
  is_default = excluded.is_default,
  is_active = true,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into now.product_variants (
  product_id,
  slug,
  name_ar,
  name_en,
  price,
  is_default,
  is_available,
  is_active,
  sort_order
)
select
  product.id,
  variant.slug,
  variant.name_ar,
  variant.name_en,
  variant.price,
  variant.is_default,
  true,
  true,
  variant.sort_order
from now.products product
cross join (
  values
    ('black-white-single-sided', 'أبيض وأسود • وجه واحد', 'Black & white • single-sided', 1.00::numeric, true, 10),
    ('black-white-double-sided', 'أبيض وأسود • وجهين', 'Black & white • double-sided', 1.50::numeric, false, 20),
    ('color-single-sided', 'ألوان • وجه واحد', 'Color • single-sided', 3.00::numeric, false, 30),
    ('color-double-sided', 'ألوان • وجهين', 'Color • double-sided', 5.00::numeric, false, 40)
) as variant(slug, name_ar, name_en, price, is_default, sort_order)
where product.slug = 'a4-print-job'
  and product.metadata ->> 'service_kind' = 'print_job'
on conflict (product_id, slug)
do update set
  name_ar = excluded.name_ar,
  name_en = excluded.name_en,
  price = excluded.price,
  is_default = excluded.is_default,
  is_available = true,
  is_active = true,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into now.printing_rates (
  printing_service_id,
  color_option_id,
  side_option_id,
  product_variant_id,
  is_active,
  sort_order
)
select
  service.id,
  color_option.id,
  side_option.id,
  variant.id,
  true,
  mapping.sort_order
from now.printing_services service
join now.printing_color_options color_option
  on color_option.printing_service_id = service.id
join now.printing_side_options side_option
  on side_option.printing_service_id = service.id
join now.products product
  on product.id = service.product_id
join (
  values
    ('black-white', 'single-sided', 'black-white-single-sided', 10),
    ('black-white', 'double-sided', 'black-white-double-sided', 20),
    ('color', 'single-sided', 'color-single-sided', 30),
    ('color', 'double-sided', 'color-double-sided', 40)
) as mapping(color_key, side_key, variant_slug, sort_order)
  on mapping.color_key = color_option.option_key
 and mapping.side_key = side_option.option_key
join now.product_variants variant
  on variant.product_id = product.id
 and variant.slug = mapping.variant_slug
on conflict (printing_service_id, color_option_id, side_option_id)
do update set
  product_variant_id = excluded.product_variant_id,
  is_active = true,
  sort_order = excluded.sort_order,
  updated_at = now();

/* --------------------------------------------------------------------------
 * 6. Public configuration and server-authoritative quote
 * -------------------------------------------------------------------------- */

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
  select *
  into v_service
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
    'whatsapp_file_prompt_ar', v_service.whatsapp_file_prompt_ar
  );
end;
$function$;

create or replace function now.quote_print_job(
  p_printing_service_id uuid,
  p_color_option_id uuid,
  p_side_option_id uuid,
  p_page_count integer,
  p_copy_count integer
)
returns jsonb
language sql
stable
security definer
set search_path = now, pg_temp
as $function$
  select now.get_printing_job_quote_internal(
    p_printing_service_id,
    p_color_option_id,
    p_side_option_id,
    p_page_count,
    p_copy_count
  );
$function$;

revoke all on function now.get_printing_job_quote_internal(uuid, uuid, uuid, integer, integer)
  from public, anon, authenticated;
revoke all on function now.get_printing_service_config(uuid, uuid)
  from public, anon, authenticated;
revoke all on function now.quote_print_job(uuid, uuid, uuid, integer, integer)
  from public, anon, authenticated;

grant execute on function now.get_printing_service_config(uuid, uuid)
  to anon, authenticated, service_role;
grant execute on function now.quote_print_job(uuid, uuid, uuid, integer, integer)
  to anon, authenticated, service_role;

commit;

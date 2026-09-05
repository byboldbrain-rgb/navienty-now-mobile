-- Navienty Now — one customer Cart across all stores.
--
-- Customer contract:
--   * one global Cart / one checkout;
--   * products may come from several stores;
--   * fulfillment remains one child order per store;
--   * delivery is 25 EGP once for the whole checkout;
--   * payment-processing fee is charged once on the fee-owner child;
--   * store minimum-order enforcement is retired.

begin;

/* --------------------------------------------------------------------------
 * 1. Retire store minimum-order enforcement at the source of truth.
 * -------------------------------------------------------------------------- */

update now.store_service_areas
set minimum_order_amount = 0
where minimum_order_amount is distinct from 0;

update now.service_areas
set default_minimum_order_amount = 0
where default_minimum_order_amount is distinct from 0;

/* --------------------------------------------------------------------------
 * 2. Order group envelope.
 * -------------------------------------------------------------------------- */

create table if not exists now.order_groups (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  access_token uuid not null unique default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  group_code text not null unique,
  status text not null default 'created'
    check (status in ('created', 'submitted', 'cancelled')),
  service_area_id uuid null references now.service_areas(id) on delete restrict,
  payment_method_id uuid null references now.payment_methods(id) on delete restrict,
  customer_name text not null,
  customer_phone text not null,
  address text not null,
  landmark text null,
  notes text null,
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  delivery_fee numeric(12,2) not null default 25 check (delivery_fee >= 0),
  payment_processing_fee numeric(12,2) not null default 0
    check (payment_processing_fee >= 0),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  currency_code text not null default 'EGP',
  currency_symbol text not null default 'ج.م',
  created_at timestamptz not null default now(),
  submitted_at timestamptz null,
  updated_at timestamptz not null default now()
);

create index if not exists order_groups_user_created_idx
  on now.order_groups (user_id, created_at desc);

alter table now.order_groups enable row level security;

revoke all on now.order_groups
  from public, anon, authenticated;

grant select, insert, update, delete
  on now.order_groups
  to service_role;

alter table now.orders
  add column if not exists order_group_id uuid null
    references now.order_groups(id) on delete restrict;

alter table now.orders
  add column if not exists order_group_position integer null;

alter table now.orders
  add column if not exists order_group_fee_owner boolean not null default false;

create index if not exists orders_order_group_idx
  on now.orders (order_group_id, order_group_position, created_at, id);

/* --------------------------------------------------------------------------
 * 3. Final fee policy for child orders.
 *
 * Existing order triggers still validate/payment-price every child order.
 * This trigger intentionally runs last (zzz_ prefix) and converts that priced
 * child into the global-checkout fee policy after order_group_id is attached.
 * -------------------------------------------------------------------------- */

create or replace function now.apply_global_order_group_fee_policy()
returns trigger
language plpgsql
security definer
set search_path = now, pg_temp
as $function$
declare
  v_order_discount numeric(12,2) := 0;
  v_delivery_discount numeric(12,2) := 0;
  v_pre_spin_total numeric(12,2) := 0;
  v_spin_discount numeric(12,2) := 0;
begin
  if new.order_group_id is null then
    return new;
  end if;

  if coalesce(new.order_group_fee_owner, false) then
    new.delivery_fee := 25;
  else
    new.delivery_fee := 0;
    new.payment_processing_fee := 0;
  end if;

  if coalesce(
       new.voucher_discount_target_snapshot,
       'order_subtotal'
     ) = 'delivery_fee'
  then
    v_delivery_discount := least(
      greatest(coalesce(new.voucher_discount_amount, 0), 0),
      greatest(coalesce(new.delivery_fee, 0), 0)
    );
    new.voucher_discount_amount := v_delivery_discount;
  else
    v_order_discount := least(
      greatest(coalesce(new.voucher_discount_amount, 0), 0),
      greatest(coalesce(new.subtotal, 0), 0)
    );
    new.voucher_discount_amount := v_order_discount;
  end if;

  v_pre_spin_total :=
    greatest(coalesce(new.subtotal, 0) - v_order_discount, 0)
    + greatest(coalesce(new.delivery_fee, 0) - v_delivery_discount, 0)
    + greatest(coalesce(new.payment_processing_fee, 0), 0);

  v_spin_discount := least(
    greatest(coalesce(new.spin_discount_amount, 0), 0),
    greatest(v_pre_spin_total, 0)
  );

  new.spin_discount_amount := v_spin_discount;
  new.total_amount := greatest(v_pre_spin_total - v_spin_discount, 0);

  return new;
end;
$function$;

revoke all on function now.apply_global_order_group_fee_policy()
  from public, anon, authenticated;

drop trigger if exists zzz_orders_apply_global_group_fee_policy
  on now.orders;

create trigger zzz_orders_apply_global_group_fee_policy
before insert or update of
  order_group_id,
  order_group_fee_owner,
  subtotal,
  delivery_fee,
  payment_processing_fee,
  voucher_discount_amount,
  voucher_discount_target_snapshot,
  spin_discount_amount
on now.orders
for each row
execute function now.apply_global_order_group_fee_policy();

/* --------------------------------------------------------------------------
 * 4. Group read model and WhatsApp message.
 * -------------------------------------------------------------------------- */

create or replace function now.build_global_order_group_whatsapp_message_v1(
  p_group_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = now, pg_temp
as $function$
declare
  v_group now.order_groups%rowtype;
  v_settings now.app_settings%rowtype;
  v_orders_text text;
  v_has_print_job boolean := false;
begin
  select * into v_group
  from now.order_groups
  where id = p_group_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'global_order_group_not_found';
  end if;

  select * into v_settings
  from now.app_settings
  where singleton = true;

  select string_agg(
    format(
      '%s. %s — %s — %s %s',
      coalesce(order_group_position, 0),
      store_name_ar_snapshot,
      order_code,
      total_amount,
      currency_symbol
    ),
    E'\n'
    order by order_group_position, created_at, id
  )
  into v_orders_text
  from now.orders
  where order_group_id = p_group_id;

  select exists (
    select 1
    from now.order_items item
    join now.orders order_row
      on order_row.id = item.order_id
    where order_row.order_group_id = p_group_id
      and item.item_kind = 'print_job'
  )
  into v_has_print_job;

  return concat_ws(
    E'\n',
    'طلب مجمّع جديد من ' || coalesce(v_settings.app_name, 'Navienty Now'),
    '',
    'رقم الطلب المجمّع: ' || v_group.group_code,
    'عدد المتاجر: ' || (
      select count(*)
      from now.orders
      where order_group_id = p_group_id
    ),
    '',
    coalesce(v_orders_text, 'لا توجد طلبات'),
    '',
    'إجمالي المنتجات: ' || v_group.subtotal || ' ' || v_group.currency_symbol,
    'رسوم التوصيل: ' || v_group.delivery_fee || ' ' || v_group.currency_symbol || ' — مرة واحدة',
    case
      when v_group.payment_processing_fee > 0 then
        'رسوم الدفع: ' || v_group.payment_processing_fee || ' ' || v_group.currency_symbol
      else null
    end,
    'الإجمالي النهائي: ' || v_group.total_amount || ' ' || v_group.currency_symbol,
    '',
    'العميل: ' || v_group.customer_name,
    'الموبايل: ' || v_group.customer_phone,
    'العنوان: ' || v_group.address,
    case
      when v_has_print_job then
        'يوجد طلب طباعة داخل السلة — سأرسل ملف الطباعة في الرسالة التالية.'
      else null
    end,
    '',
    'أكد الطلب المجمّع بتاعي'
  );
end;
$function$;

revoke all on function now.build_global_order_group_whatsapp_message_v1(uuid)
  from public, anon, authenticated;

create or replace function now.get_global_order_group_v1(
  p_access_token uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = now, pg_temp
as $function$
declare
  v_group now.order_groups%rowtype;
  v_orders jsonb;
  v_whatsapp_number text;
  v_whatsapp_message text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select * into v_group
  from now.order_groups
  where access_token = p_access_token
    and user_id = auth.uid();

  if not found then
    raise exception using errcode = 'P0002', message = 'global_order_group_not_found';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', order_row.id,
        'order_code', order_row.order_code,
        'access_token', order_row.access_token,
        'store_id', order_row.store_id,
        'store_name', order_row.store_name_ar_snapshot,
        'subtotal', order_row.subtotal,
        'delivery_fee', order_row.delivery_fee,
        'payment_processing_fee', order_row.payment_processing_fee,
        'total_amount', order_row.total_amount
      )
      order by order_row.order_group_position, order_row.created_at, order_row.id
    ),
    '[]'::jsonb
  )
  into v_orders
  from now.orders order_row
  where order_row.order_group_id = v_group.id;

  select nullif(btrim(settings.whatsapp_number), '')
  into v_whatsapp_number
  from now.app_settings settings
  where settings.singleton = true;

  v_whatsapp_message :=
    now.build_global_order_group_whatsapp_message_v1(v_group.id);

  return jsonb_build_object(
    'id', v_group.id,
    'group_code', v_group.group_code,
    'access_token', v_group.access_token,
    'status', v_group.status,
    'subtotal', v_group.subtotal,
    'delivery_fee', v_group.delivery_fee,
    'payment_processing_fee', v_group.payment_processing_fee,
    'total_amount', v_group.total_amount,
    'currency_code', v_group.currency_code,
    'currency_symbol', v_group.currency_symbol,
    'whatsapp_number', v_whatsapp_number,
    'whatsapp_message', v_whatsapp_message,
    'orders', v_orders
  );
end;
$function$;

revoke all on function now.get_global_order_group_v1(uuid)
  from public, anon;
grant execute on function now.get_global_order_group_v1(uuid)
  to authenticated, service_role;

/* --------------------------------------------------------------------------
 * 5. Atomic create: one group, one existing order per store.
 * -------------------------------------------------------------------------- */

create or replace function now.create_global_order_group_v1(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = now, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_client_request_id uuid;
  v_existing_group now.order_groups%rowtype;
  v_group now.order_groups%rowtype;
  v_group_id uuid := gen_random_uuid();
  v_group_code text;
  v_store_payload jsonb;
  v_child_payload jsonb;
  v_child_result jsonb;
  v_child_order_id uuid;
  v_position integer := 0;
  v_stores jsonb;
  v_common jsonb;
  v_settings now.app_settings%rowtype;
  v_service_area_id uuid;
  v_payment_method_id uuid;
  v_delivery_latitude double precision;
  v_delivery_longitude double precision;
  v_has_print_job boolean;
  v_group_subtotal numeric(12,2) := 0;
  v_group_delivery_fee numeric(12,2) := 0;
  v_group_processing_fee numeric(12,2) := 0;
  v_group_total numeric(12,2) := 0;
  v_global_processing_fee numeric(12,2) := 0;
  v_payment_method now.payment_methods%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_order_payload';
  end if;

  begin
    v_client_request_id := (p_payload ->> 'client_request_id')::uuid;
    v_service_area_id := nullif(p_payload ->> 'service_area_id', '')::uuid;
    v_payment_method_id := (p_payload ->> 'payment_method_id')::uuid;
    v_delivery_latitude := (p_payload ->> 'delivery_latitude')::double precision;
    v_delivery_longitude := (p_payload ->> 'delivery_longitude')::double precision;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode = '22023', message = 'invalid_value_in_order_payload';
  end;

  if v_client_request_id is null then
    raise exception using errcode = '22023', message = 'client_request_id_required';
  end if;

  select * into v_existing_group
  from now.order_groups
  where client_request_id = v_client_request_id
    and user_id = v_user_id;

  if found then
    return now.get_global_order_group_v1(v_existing_group.access_token);
  end if;

  v_stores := p_payload -> 'stores';

  if v_stores is null
     or jsonb_typeof(v_stores) <> 'array'
     or jsonb_array_length(v_stores) = 0 then
    raise exception using errcode = '22023', message = 'global_cart_required';
  end if;

  if jsonb_array_length(v_stores) > 20 then
    raise exception using errcode = '22023', message = 'too_many_stores_in_global_cart';
  end if;

  select * into v_settings
  from now.app_settings
  where singleton = true;

  if not found then
    raise exception using errcode = 'P0002', message = 'app_settings_not_found';
  end if;

  v_group_code :=
    'NVG-' || upper(substr(replace(v_group_id::text, '-', ''), 1, 8));

  insert into now.order_groups (
    id,
    client_request_id,
    user_id,
    group_code,
    status,
    service_area_id,
    payment_method_id,
    customer_name,
    customer_phone,
    address,
    landmark,
    notes,
    delivery_fee,
    currency_code,
    currency_symbol
  ) values (
    v_group_id,
    v_client_request_id,
    v_user_id,
    v_group_code,
    'created',
    v_service_area_id,
    v_payment_method_id,
    btrim(coalesce(p_payload ->> 'customer_name', '')),
    regexp_replace(coalesce(p_payload ->> 'customer_phone', ''), '[^0-9+]', '', 'g'),
    btrim(coalesce(p_payload ->> 'address', '')),
    nullif(btrim(coalesce(p_payload ->> 'landmark', '')), ''),
    nullif(btrim(coalesce(p_payload ->> 'notes', '')), ''),
    25,
    v_settings.currency_code,
    v_settings.currency_symbol
  )
  returning * into v_group;

  v_common := jsonb_build_object(
    'service_area_id', v_service_area_id,
    'delivery_latitude', v_delivery_latitude,
    'delivery_longitude', v_delivery_longitude,
    'payment_method_id', v_payment_method_id,
    'customer_name', v_group.customer_name,
    'customer_phone', v_group.customer_phone,
    'address', v_group.address,
    'landmark', v_group.landmark,
    'notes', v_group.notes
  );

  for v_store_payload in
    select value
    from jsonb_array_elements(v_stores)
  loop
    v_position := v_position + 1;

    if jsonb_typeof(v_store_payload) <> 'object'
       or nullif(v_store_payload ->> 'store_id', '') is null
       or v_store_payload -> 'items' is null
       or jsonb_typeof(v_store_payload -> 'items') <> 'array'
       or jsonb_array_length(v_store_payload -> 'items') = 0 then
      raise exception using errcode = '22023', message = 'global_cart_store_required';
    end if;

    v_child_payload :=
      v_common ||
      jsonb_build_object(
        'client_request_id', gen_random_uuid(),
        'store_id', v_store_payload ->> 'store_id',
        'items', v_store_payload -> 'items',
        'voucher_code', nullif(v_store_payload ->> 'voucher_code', ''),
        'spin_event_id', nullif(v_store_payload ->> 'spin_event_id', '')
      );

    v_child_result := now.create_whatsapp_order_v3(v_child_payload);
    v_child_order_id := (v_child_result ->> 'id')::uuid;

    update now.orders
    set
      order_group_id = v_group.id,
      order_group_position = v_position,
      order_group_fee_owner = (v_position = 1)
    where id = v_child_order_id;

    select exists (
      select 1
      from now.order_items item
      where item.order_id = v_child_order_id
        and item.item_kind = 'print_job'
    )
    into v_has_print_job;

    update now.orders
    set whatsapp_message =
      case
        when v_has_print_job then
          now.build_order_whatsapp_message_v2(v_child_order_id)
        else
          now.build_order_whatsapp_message(v_child_order_id)
      end
    where id = v_child_order_id;
  end loop;

  select
    coalesce(sum(order_row.subtotal), 0),
    coalesce(sum(order_row.delivery_fee), 0),
    coalesce(sum(order_row.payment_processing_fee), 0),
    coalesce(sum(order_row.total_amount), 0)
  into
    v_group_subtotal,
    v_group_delivery_fee,
    v_group_processing_fee,
    v_group_total
  from now.orders order_row
  where order_row.order_group_id = v_group.id;

  select
    order_row.service_area_id,
    order_row.payment_method_id
  into
    v_service_area_id,
    v_payment_method_id
  from now.orders order_row
  where order_row.order_group_id = v_group.id
  order by order_row.order_group_position, order_row.created_at, order_row.id
  limit 1;

  -- Processing fee is also a checkout-level charge. Recalculate it against
  -- the whole global subtotal, then keep it only on the fee-owner child.
  select * into v_payment_method
  from now.payment_methods
  where id = v_payment_method_id;

  if found
     and v_payment_method.processing_fee_enabled
     and v_payment_method.processing_fee_charge_customer then
    case v_payment_method.processing_fee_type
      when 'fixed' then
        v_global_processing_fee :=
          coalesce(v_payment_method.processing_fee_fixed_amount, 0);
      when 'percentage' then
        v_global_processing_fee := round(
          v_group_subtotal
          * coalesce(v_payment_method.processing_fee_percentage, 0)
          / 100,
          2
        );
      else
        v_global_processing_fee := 0;
    end case;

    if v_payment_method.processing_fee_min_amount is not null then
      v_global_processing_fee := greatest(
        v_global_processing_fee,
        v_payment_method.processing_fee_min_amount
      );
    end if;

    if v_payment_method.processing_fee_max_amount is not null then
      v_global_processing_fee := least(
        v_global_processing_fee,
        v_payment_method.processing_fee_max_amount
      );
    end if;
  else
    v_global_processing_fee := 0;
  end if;

  update now.orders
  set payment_processing_fee = v_global_processing_fee
  where order_group_id = v_group.id
    and order_group_fee_owner = true;

  select
    coalesce(sum(order_row.subtotal), 0),
    coalesce(sum(order_row.delivery_fee), 0),
    coalesce(sum(order_row.payment_processing_fee), 0),
    coalesce(sum(order_row.total_amount), 0)
  into
    v_group_subtotal,
    v_group_delivery_fee,
    v_group_processing_fee,
    v_group_total
  from now.orders order_row
  where order_row.order_group_id = v_group.id;

  update now.order_groups
  set
    subtotal = v_group_subtotal,
    delivery_fee = v_group_delivery_fee,
    payment_processing_fee = v_group_processing_fee,
    total_amount = v_group_total,
    service_area_id = v_service_area_id,
    payment_method_id = v_payment_method_id,
    updated_at = now()
  where id = v_group.id
  returning * into v_group;

  if v_group.delivery_fee <> 25 then
    raise exception using errcode = 'P0001', message = 'global_delivery_fee_invariant_failed';
  end if;

  return now.get_global_order_group_v1(v_group.access_token);
end;
$function$;

revoke all on function now.create_global_order_group_v1(jsonb)
  from public, anon;
grant execute on function now.create_global_order_group_v1(jsonb)
  to authenticated, service_role;

/* --------------------------------------------------------------------------
 * 6. One in-app confirmation action submits every child order atomically.
 * -------------------------------------------------------------------------- */

create or replace function now.submit_global_order_group_v1(
  p_access_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = now, pg_temp
as $function$
declare
  v_group now.order_groups%rowtype;
  v_order record;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select * into v_group
  from now.order_groups
  where access_token = p_access_token
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'global_order_group_not_found';
  end if;

  if v_group.status = 'cancelled' then
    raise exception using errcode = 'P0001', message = 'global_order_group_cancelled';
  end if;

  for v_order in
    select access_token
    from now.orders
    where order_group_id = v_group.id
    order by order_group_position, created_at, id
  loop
    perform now.submit_order_for_confirmation(v_order.access_token);
  end loop;

  update now.order_groups
  set
    status = 'submitted',
    submitted_at = coalesce(submitted_at, now()),
    updated_at = now()
  where id = v_group.id;

  return now.get_global_order_group_v1(v_group.access_token);
end;
$function$;

revoke all on function now.submit_global_order_group_v1(uuid)
  from public, anon;
grant execute on function now.submit_global_order_group_v1(uuid)
  to authenticated, service_role;

commit;

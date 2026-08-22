-- Navienty Now vouchers V2
-- Adds order-vs-delivery discount targets and multi-category voucher scopes.

alter table now.vouchers
  add column if not exists discount_target text
  not null default 'order_subtotal';

alter table now.vouchers
  drop constraint if exists vouchers_discount_target_check;

alter table now.vouchers
  add constraint vouchers_discount_target_check
  check (
    discount_target in (
      'order_subtotal',
      'delivery_fee'
    )
  );

create table if not exists now.voucher_categories (
  voucher_id uuid not null
    references now.vouchers(id)
    on delete cascade,
  category_id uuid not null
    references now.store_categories(id)
    on delete cascade,
  created_at timestamptz not null default now(),
  primary key (voucher_id, category_id)
);

create index if not exists voucher_categories_category_idx
  on now.voucher_categories (category_id, voucher_id);

insert into now.voucher_categories (
  voucher_id,
  category_id
)
select
  id,
  category_id
from now.vouchers
where category_id is not null
on conflict do nothing;

alter table now.voucher_categories enable row level security;

revoke all on now.voucher_categories
  from public, anon, authenticated;

grant select, insert, update, delete
  on now.voucher_categories
  to service_role;

alter table now.orders
  add column if not exists voucher_discount_target_snapshot text null;

update now.orders
set voucher_discount_target_snapshot = 'order_subtotal'
where voucher_discount_target_snapshot is null
  and (
    voucher_id is not null
    or coalesce(voucher_discount_amount, 0) > 0
  );

alter table now.orders
  drop constraint if exists orders_voucher_discount_target_snapshot_check;

alter table now.orders
  add constraint orders_voucher_discount_target_snapshot_check
  check (
    voucher_discount_target_snapshot is null
    or voucher_discount_target_snapshot in (
      'order_subtotal',
      'delivery_fee'
    )
  );

alter table now.orders
  drop constraint if exists orders_voucher_discount_amount_check;

alter table now.orders
  add constraint orders_voucher_discount_amount_check
  check (
    voucher_discount_amount >= 0
    and (
      case
        when coalesce(
          voucher_discount_target_snapshot,
          'order_subtotal'
        ) = 'delivery_fee'
          then voucher_discount_amount <= delivery_fee
        else voucher_discount_amount <= subtotal
      end
    )
  );

alter table now.voucher_redemptions
  add column if not exists discount_target_snapshot text null;

update now.voucher_redemptions as redemption
set discount_target_snapshot =
  coalesce(
    orders.voucher_discount_target_snapshot,
    vouchers.discount_target,
    'order_subtotal'
  )
from now.orders as orders,
     now.vouchers as vouchers
where orders.id = redemption.order_id
  and vouchers.id = redemption.voucher_id
  and redemption.discount_target_snapshot is null;

alter table now.voucher_redemptions
  drop constraint if exists voucher_redemptions_discount_target_snapshot_check;

alter table now.voucher_redemptions
  add constraint voucher_redemptions_discount_target_snapshot_check
  check (
    discount_target_snapshot is null
    or discount_target_snapshot in (
      'order_subtotal',
      'delivery_fee'
    )
  );

create or replace function now.calculate_order_total()
returns trigger
language plpgsql
set search_path to 'now', 'pg_temp'
as $function$
declare
  v_order_discount numeric(12,2) := 0;
  v_delivery_discount numeric(12,2) := 0;
begin
  if new.payment_processing_fee is null
     or new.payment_processing_fee = 0
  then
    new.payment_processing_fee := 10;
  end if;

  if coalesce(
       new.voucher_discount_target_snapshot,
       'order_subtotal'
     ) = 'delivery_fee'
  then
    v_delivery_discount :=
      least(
        greatest(
          coalesce(new.voucher_discount_amount, 0),
          0
        ),
        greatest(coalesce(new.delivery_fee, 0), 0)
      );

    new.voucher_discount_amount :=
      v_delivery_discount;
  else
    v_order_discount :=
      least(
        greatest(
          coalesce(new.voucher_discount_amount, 0),
          0
        ),
        greatest(coalesce(new.subtotal, 0), 0)
      );

    new.voucher_discount_amount :=
      v_order_discount;
  end if;

  new.total_amount :=
    greatest(
      coalesce(new.subtotal, 0)
      - v_order_discount,
      0
    )
    + greatest(
      coalesce(new.delivery_fee, 0)
      - v_delivery_discount,
      0
    )
    + coalesce(new.payment_processing_fee, 0);

  return new;
end;
$function$;

create or replace function now.apply_order_payment_fee()
returns trigger
language plpgsql
security definer
set search_path to 'now', 'pg_temp'
as $function$
declare
  v_payment_method now.payment_methods%rowtype;
  v_processing_fee numeric := 0;
  v_order_discount numeric(12,2) := 0;
  v_delivery_discount numeric(12,2) := 0;
begin
  select *
  into v_payment_method
  from now.payment_methods
  where id = new.payment_method_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'payment_method_not_found';
  end if;

  if
    v_payment_method.processing_fee_enabled
    and
    v_payment_method.processing_fee_charge_customer
  then
    case v_payment_method.processing_fee_type
      when 'fixed' then
        v_processing_fee :=
          coalesce(
            v_payment_method.processing_fee_fixed_amount,
            0
          );

      when 'percentage' then
        v_processing_fee :=
          round(
            coalesce(new.subtotal, 0)
            * coalesce(
                v_payment_method.processing_fee_percentage,
                0
              )
            / 100,
            2
          );

      else
        v_processing_fee := 0;
    end case;

    if v_payment_method.processing_fee_min_amount is not null then
      v_processing_fee :=
        greatest(
          v_processing_fee,
          v_payment_method.processing_fee_min_amount
        );
    end if;

    if v_payment_method.processing_fee_max_amount is not null then
      v_processing_fee :=
        least(
          v_processing_fee,
          v_payment_method.processing_fee_max_amount
        );
    end if;
  else
    v_processing_fee := 0;
  end if;

  new.payment_processing_fee :=
    v_processing_fee;

  new.payment_fee_label_snapshot :=
    v_payment_method.processing_fee_label_ar;

  new.payment_fee_type_snapshot :=
    v_payment_method.processing_fee_type;

  new.payment_fee_percentage_snapshot :=
    v_payment_method.processing_fee_percentage;

  new.payment_fee_fixed_amount_snapshot :=
    v_payment_method.processing_fee_fixed_amount;

  if coalesce(
       new.voucher_discount_target_snapshot,
       'order_subtotal'
     ) = 'delivery_fee'
  then
    v_delivery_discount :=
      least(
        greatest(
          coalesce(new.voucher_discount_amount, 0),
          0
        ),
        greatest(coalesce(new.delivery_fee, 0), 0)
      );

    new.voucher_discount_amount :=
      v_delivery_discount;
  else
    v_order_discount :=
      least(
        greatest(
          coalesce(new.voucher_discount_amount, 0),
          0
        ),
        greatest(coalesce(new.subtotal, 0), 0)
      );

    new.voucher_discount_amount :=
      v_order_discount;
  end if;

  new.total_amount :=
    greatest(
      coalesce(new.subtotal, 0)
      - v_order_discount,
      0
    )
    + greatest(
      coalesce(new.delivery_fee, 0)
      - v_delivery_discount,
      0
    )
    + coalesce(v_processing_fee, 0);

  return new;
end;
$function$;

create or replace function now.get_voucher_quote_internal(
  p_code text,
  p_store_id uuid,
  p_subtotal numeric,
  p_delivery_fee numeric,
  p_user_id uuid,
  p_customer_phone text,
  p_for_reservation boolean,
  p_exclude_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'now', 'pg_temp'
as $function$
declare
  v_code text;
  v_phone text;
  v_voucher now.vouchers%rowtype;
  v_store now.stores%rowtype;
  v_discount numeric(12,2) := 0;
  v_discount_base numeric(12,2) := 0;
  v_total_redemptions integer := 0;
  v_user_redemptions integer := 0;
  v_has_previous_order boolean := false;
  v_has_category_scope boolean := false;
  v_count_statuses text[];
begin
  if p_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication_required';
  end if;

  v_code := upper(btrim(coalesce(p_code, '')));
  v_phone := regexp_replace(
    coalesce(p_customer_phone, ''),
    '[^0-9+]',
    '',
    'g'
  );

  if length(v_code) < 3
     or length(v_code) > 32
  then
    raise exception using
      errcode = '22023',
      message = 'voucher_invalid_code';
  end if;

  if p_store_id is null then
    raise exception using
      errcode = '22023',
      message = 'store_id_required';
  end if;

  if p_subtotal is null
     or p_subtotal < 0
  then
    raise exception using
      errcode = '22023',
      message = 'voucher_invalid_subtotal';
  end if;

  if p_delivery_fee is null
     or p_delivery_fee < 0
  then
    raise exception using
      errcode = '22023',
      message = 'voucher_invalid_delivery_fee';
  end if;

  if p_for_reservation then
    select *
    into v_voucher
    from now.vouchers
    where upper(btrim(code)) = v_code
    for update;
  else
    select *
    into v_voucher
    from now.vouchers
    where upper(btrim(code)) = v_code;
  end if;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'voucher_not_found';
  end if;

  if not v_voucher.is_active then
    raise exception using
      errcode = 'P0001',
      message = 'voucher_inactive';
  end if;

  if v_voucher.starts_at is not null
     and now() < v_voucher.starts_at
  then
    raise exception using
      errcode = 'P0001',
      message = 'voucher_not_started';
  end if;

  if v_voucher.ends_at is not null
     and now() >= v_voucher.ends_at
  then
    raise exception using
      errcode = 'P0001',
      message = 'voucher_expired';
  end if;

  select *
  into v_store
  from now.stores
  where id = p_store_id
    and is_active = true;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'store_not_available';
  end if;

  if v_voucher.store_id is not null
     and v_voucher.store_id <> p_store_id
  then
    raise exception using
      errcode = 'P0001',
      message = 'voucher_store_not_eligible';
  end if;

  select exists (
    select 1
    from now.voucher_categories as scope
    where scope.voucher_id = v_voucher.id
  )
  into v_has_category_scope;

  if v_has_category_scope then
    if not exists (
      select 1
      from now.voucher_categories as scope
      where scope.voucher_id = v_voucher.id
        and scope.category_id = v_store.category_id
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'voucher_category_not_eligible';
    end if;
  elsif v_voucher.category_id is not null
        and v_voucher.category_id <> v_store.category_id
  then
    raise exception using
      errcode = 'P0001',
      message = 'voucher_category_not_eligible';
  end if;

  if p_subtotal < v_voucher.minimum_subtotal then
    raise exception using
      errcode = 'P0001',
      message = 'voucher_minimum_not_reached',
      detail = jsonb_build_object(
        'minimum_subtotal',
          v_voucher.minimum_subtotal,
        'current_subtotal',
          p_subtotal
      )::text;
  end if;

  v_count_statuses :=
    case
      when p_for_reservation
        then array['reserved', 'redeemed']::text[]
      else array['redeemed']::text[]
    end;

  if v_voucher.max_redemptions_total is not null then
    select count(*)
    into v_total_redemptions
    from now.voucher_redemptions
    where voucher_id = v_voucher.id
      and status = any(v_count_statuses);

    if v_total_redemptions >=
       v_voucher.max_redemptions_total
    then
      raise exception using
        errcode = 'P0001',
        message = 'voucher_usage_limit_reached';
    end if;
  end if;

  if v_voucher.max_redemptions_per_user is not null then
    select count(*)
    into v_user_redemptions
    from now.voucher_redemptions
    where voucher_id = v_voucher.id
      and status = any(v_count_statuses)
      and (
        user_id = p_user_id
        or (
          v_phone <> ''
          and customer_phone_snapshot = v_phone
        )
      );

    if v_user_redemptions >=
       v_voucher.max_redemptions_per_user
    then
      raise exception using
        errcode = 'P0001',
        message = 'voucher_user_limit_reached';
    end if;
  end if;

  if v_voucher.first_order_only then
    select exists (
      select 1
      from now.orders as o
      where o.status <> 'cancelled'
        and (
          p_exclude_order_id is null
          or o.id <> p_exclude_order_id
        )
        and (
          o.user_id = p_user_id
          or (
            v_phone <> ''
            and regexp_replace(
              coalesce(o.customer_phone, ''),
              '[^0-9+]',
              '',
              'g'
            ) = v_phone
          )
        )
    )
    into v_has_previous_order;

    if v_has_previous_order then
      raise exception using
        errcode = 'P0001',
        message = 'voucher_first_order_only';
    end if;
  end if;

  v_discount_base :=
    case v_voucher.discount_target
      when 'order_subtotal'
        then p_subtotal
      when 'delivery_fee'
        then p_delivery_fee
      else 0
    end;

  case v_voucher.discount_type
    when 'fixed' then
      v_discount :=
        least(
          v_voucher.discount_value,
          v_discount_base
        );

    when 'percentage' then
      v_discount :=
        round(
          v_discount_base
          * v_voucher.discount_value
          / 100,
          2
        );

      if v_voucher.max_discount_amount is not null then
        v_discount :=
          least(
            v_discount,
            v_voucher.max_discount_amount
          );
      end if;

      v_discount :=
        least(
          v_discount,
          v_discount_base
        );

    else
      raise exception using
        errcode = '22023',
        message = 'voucher_invalid_discount_type';
  end case;

  v_discount :=
    greatest(
      round(v_discount, 2),
      0
    );

  if v_discount <= 0 then
    raise exception using
      errcode = 'P0001',
      message = 'voucher_no_discount';
  end if;

  return jsonb_build_object(
    'valid', true,
    'voucher_id', v_voucher.id,
    'code', upper(btrim(v_voucher.code)),
    'title_ar', v_voucher.title_ar,
    'description_ar', v_voucher.description_ar,
    'discount_target', v_voucher.discount_target,
    'discount_type', v_voucher.discount_type,
    'discount_value', v_voucher.discount_value,
    'discount_amount', v_discount,
    'discount_base_amount', v_discount_base,
    'minimum_subtotal', v_voucher.minimum_subtotal,
    'max_discount_amount', v_voucher.max_discount_amount,
    'subtotal_before_discount', p_subtotal,
    'subtotal_after_discount',
      case
        when v_voucher.discount_target = 'order_subtotal'
          then greatest(p_subtotal - v_discount, 0)
        else p_subtotal
      end,
    'delivery_fee_before_discount', p_delivery_fee,
    'delivery_fee_after_discount',
      case
        when v_voucher.discount_target = 'delivery_fee'
          then greatest(p_delivery_fee - v_discount, 0)
        else p_delivery_fee
      end,
    'starts_at', v_voucher.starts_at,
    'ends_at', v_voucher.ends_at,
    'eligible_category_slugs',
      coalesce(
        (
          select jsonb_agg(category.slug order by category.slug)
          from now.voucher_categories as scope
          join now.store_categories as category
            on category.id = scope.category_id
          where scope.voucher_id = v_voucher.id
        ),
        case
          when v_voucher.category_id is not null
          then (
            select jsonb_build_array(category.slug)
            from now.store_categories as category
            where category.id = v_voucher.category_id
          )
          else '[]'::jsonb
        end
      )
  );
end;
$function$;

create or replace function now.get_voucher_quote_internal(
  p_code text,
  p_store_id uuid,
  p_subtotal numeric,
  p_user_id uuid,
  p_customer_phone text,
  p_for_reservation boolean default false,
  p_exclude_order_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'now', 'pg_temp'
as $function$
declare
  v_delivery_fee numeric(12,2) := 0;
begin
  select coalesce(
    store_area.delivery_fee,
    service_area.default_delivery_fee,
    0
  )
  into v_delivery_fee
  from now.app_settings as settings
  left join now.service_areas as service_area
    on service_area.id = settings.default_service_area_id
  left join now.store_service_areas as store_area
    on store_area.store_id = p_store_id
   and store_area.service_area_id = settings.default_service_area_id
  where settings.singleton = true
  limit 1;

  return now.get_voucher_quote_internal(
    p_code,
    p_store_id,
    p_subtotal,
    coalesce(v_delivery_fee, 0),
    p_user_id,
    p_customer_phone,
    p_for_reservation,
    p_exclude_order_id
  );
end;
$function$;

create or replace function now.validate_voucher(
  p_code text,
  p_store_id uuid,
  p_subtotal numeric,
  p_delivery_fee numeric,
  p_customer_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'now', 'pg_temp'
as $function$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication_required';
  end if;

  return now.get_voucher_quote_internal(
    p_code,
    p_store_id,
    p_subtotal,
    p_delivery_fee,
    v_user_id,
    p_customer_phone,
    false,
    null
  );
end;
$function$;

create or replace function now.validate_voucher(
  p_code text,
  p_store_id uuid,
  p_subtotal numeric,
  p_customer_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'now', 'pg_temp'
as $function$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication_required';
  end if;

  return now.get_voucher_quote_internal(
    p_code,
    p_store_id,
    p_subtotal,
    v_user_id,
    p_customer_phone,
    false,
    null
  );
end;
$function$;

revoke all on function now.validate_voucher(
  text, uuid, numeric, numeric, text
) from public, anon;

grant execute on function now.validate_voucher(
  text, uuid, numeric, numeric, text
) to authenticated, service_role;

revoke all on function now.validate_voucher(
  text, uuid, numeric, text
) from public, anon;

grant execute on function now.validate_voucher(
  text, uuid, numeric, text
) to authenticated, service_role;

revoke all on function now.get_voucher_quote_internal(
  text, uuid, numeric, numeric, uuid, text, boolean, uuid
) from public, anon, authenticated;

grant execute on function now.get_voucher_quote_internal(
  text, uuid, numeric, numeric, uuid, text, boolean, uuid
) to service_role;

create or replace function now.create_whatsapp_order_v2(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'now', 'pg_temp'
as $function$
declare
  v_base_result jsonb;
  v_order now.orders%rowtype;
  v_quote jsonb;
  v_code text;
  v_user_id uuid;
  v_discount numeric(12,2);
  v_voucher_id uuid;
  v_discount_target text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication_required';
  end if;

  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
  then
    raise exception using
      errcode = '22023',
      message = 'invalid_order_payload';
  end if;

  v_code :=
    upper(
      btrim(
        coalesce(
          p_payload ->> 'voucher_code',
          ''
        )
      )
    );

  v_base_result :=
    now.create_whatsapp_order(
      p_payload - 'voucher_code'
    );

  select *
  into v_order
  from now.orders
  where id =
    (v_base_result ->> 'id')::uuid
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'order_not_found';
  end if;

  if v_code = '' then
    if v_order.voucher_id is not null then
      raise exception using
        errcode = 'P0001',
        message = 'voucher_order_conflict';
    end if;

    return v_base_result;
  end if;

  if v_order.voucher_id is not null then
    if upper(
      btrim(
        coalesce(
          v_order.voucher_code_snapshot,
          ''
        )
      )
    ) <> v_code then
      raise exception using
        errcode = 'P0001',
        message = 'voucher_order_conflict';
    end if;

    return jsonb_build_object(
      'id', v_order.id,
      'order_code', v_order.order_code,
      'access_token', v_order.access_token,
      'client_request_id', v_order.client_request_id,
      'status', v_order.status,
      'subtotal', v_order.subtotal,
      'voucher_code', v_order.voucher_code_snapshot,
      'voucher_discount_target',
        v_order.voucher_discount_target_snapshot,
      'voucher_discount_amount',
        v_order.voucher_discount_amount,
      'delivery_fee', v_order.delivery_fee,
      'payment_processing_fee',
        v_order.payment_processing_fee,
      'total_amount', v_order.total_amount,
      'currency_code', v_order.currency_code,
      'currency_symbol', v_order.currency_symbol,
      'whatsapp_number',
        (
          select settings.whatsapp_number
          from now.app_settings as settings
          where settings.singleton = true
        ),
      'whatsapp_message', v_order.whatsapp_message
    );
  end if;

  v_quote :=
    now.get_voucher_quote_internal(
      v_code,
      v_order.store_id,
      v_order.subtotal,
      v_order.delivery_fee,
      v_user_id,
      v_order.customer_phone,
      true,
      v_order.id
    );

  v_voucher_id :=
    (v_quote ->> 'voucher_id')::uuid;

  v_discount :=
    (v_quote ->> 'discount_amount')::numeric;

  v_discount_target :=
    v_quote ->> 'discount_target';

  update now.orders
  set
    voucher_id = v_voucher_id,
    voucher_code_snapshot =
      v_quote ->> 'code',
    voucher_title_ar_snapshot =
      nullif(
        v_quote ->> 'title_ar',
        ''
      ),
    voucher_discount_target_snapshot =
      v_discount_target,
    voucher_discount_type_snapshot =
      v_quote ->> 'discount_type',
    voucher_discount_value_snapshot =
      (
        v_quote ->> 'discount_value'
      )::numeric,
    voucher_discount_amount =
      v_discount
  where id = v_order.id
  returning *
  into v_order;

  insert into now.voucher_redemptions (
    voucher_id,
    order_id,
    user_id,
    customer_phone_snapshot,
    discount_amount,
    discount_target_snapshot,
    status
  )
  values (
    v_voucher_id,
    v_order.id,
    v_user_id,
    regexp_replace(
      coalesce(v_order.customer_phone, ''),
      '[^0-9+]',
      '',
      'g'
    ),
    v_discount,
    v_discount_target,
    'reserved'
  )
  on conflict (order_id)
  do nothing;

  update now.orders
  set whatsapp_message =
    now.build_order_whatsapp_message(
      v_order.id
    )
  where id = v_order.id
  returning *
  into v_order;

  return jsonb_build_object(
    'id', v_order.id,
    'order_code', v_order.order_code,
    'access_token', v_order.access_token,
    'client_request_id', v_order.client_request_id,
    'status', v_order.status,
    'subtotal', v_order.subtotal,
    'voucher_code', v_order.voucher_code_snapshot,
    'voucher_discount_target',
      v_order.voucher_discount_target_snapshot,
    'voucher_discount_amount',
      v_order.voucher_discount_amount,
    'delivery_fee', v_order.delivery_fee,
    'payment_processing_fee',
      v_order.payment_processing_fee,
    'total_amount', v_order.total_amount,
    'currency_code', v_order.currency_code,
    'currency_symbol', v_order.currency_symbol,
    'whatsapp_number',
      (
        select settings.whatsapp_number
        from now.app_settings as settings
        where settings.singleton = true
      ),
    'whatsapp_message', v_order.whatsapp_message
  );
end;
$function$;

create or replace function now.build_order_whatsapp_message(
  p_order_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path to 'now', 'pg_temp'
as $function$
declare
  v_order now.orders%rowtype;
  v_settings now.app_settings%rowtype;
  v_items_text text;
  v_discount_label text;
begin
  select *
  into v_order
  from now.orders
  where id = p_order_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'order_not_found';
  end if;

  select *
  into v_settings
  from now.app_settings
  where singleton = true;

  select string_agg(
    format(
      '%s. %s%s × %s = %s %s',
      line_number,
      product_name_ar_snapshot,
      case
        when variant_name_ar_snapshot is null then ''
        else ' - ' || variant_name_ar_snapshot
      end,
      quantity,
      line_total,
      v_order.currency_symbol
    ),
    E'\n'
    order by line_number
  )
  into v_items_text
  from (
    select
      row_number() over (
        order by created_at, id
      ) as line_number,
      product_name_ar_snapshot,
      variant_name_ar_snapshot,
      quantity,
      line_total
    from now.order_items
    where order_id = p_order_id
  ) as ordered_items;

  v_discount_label :=
    case coalesce(
      v_order.voucher_discount_target_snapshot,
      'order_subtotal'
    )
      when 'delivery_fee'
        then 'خصم على التوصيل'
      else 'خصم على الطلب'
    end;

  return concat_ws(
    E'\n',
    'طلب جديد من ' || v_settings.app_name,
    '',
    'رقم الطلب: ' || v_order.order_code,
    'المتجر: ' || v_order.store_name_ar_snapshot,
    '',
    'تفاصيل المنتجات:',
    coalesce(v_items_text, 'لا توجد منتجات'),
    '',
    'إجمالي المنتجات: ' ||
      v_order.subtotal || ' ' ||
      v_order.currency_symbol,
    case
      when coalesce(v_order.voucher_discount_amount, 0) > 0
      then
        v_discount_label ||
        case
          when nullif(v_order.voucher_code_snapshot, '') is null
            then ''
          else ' (' || v_order.voucher_code_snapshot || ')'
        end ||
        ': -' ||
        v_order.voucher_discount_amount ||
        ' ' ||
        v_order.currency_symbol
      else null
    end,
    'رسوم التوصيل: ' ||
      v_order.delivery_fee || ' ' ||
      v_order.currency_symbol,
    case
      when coalesce(v_order.payment_processing_fee, 0) > 0
      then
        coalesce(
          nullif(
            v_order.payment_fee_label_snapshot,
            ''
          ),
          'رسوم الدفع الإلكتروني'
        ) ||
        ': ' ||
        v_order.payment_processing_fee ||
        ' ' ||
        v_order.currency_symbol
      else null
    end,
    'الإجمالي النهائي: ' ||
      v_order.total_amount || ' ' ||
      v_order.currency_symbol,
    '',
    'بيانات العميل:',
    'الاسم: ' || v_order.customer_name,
    'رقم الموبايل: ' || v_order.customer_phone,
    'المنطقة: ' || v_order.area_name_ar_snapshot,
    'العنوان: ' || v_order.address,
    'علامة مميزة: ' ||
      coalesce(nullif(v_order.landmark, ''), 'لا يوجد'),
    'ملاحظات: ' ||
      coalesce(nullif(v_order.notes, ''), 'لا يوجد'),
    'طريقة الدفع المختارة: ' ||
      v_order.payment_method_name_snapshot,
    '',
    'أرجو تأكيد توافر المنتجات والمبلغ النهائي وإرسال بيانات الدفع.'
  );
end;
$function$;

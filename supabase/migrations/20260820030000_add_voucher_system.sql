-- Navienty Now voucher system V1
-- Server-authoritative validation + atomic reservation on order creation.

create table if not exists now.vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  title_ar text not null default '',
  description_ar text null,
  discount_type text not null
    check (discount_type in ('fixed', 'percentage')),
  discount_value numeric(12,2) not null
    check (discount_value > 0),
  max_discount_amount numeric(12,2) null
    check (
      max_discount_amount is null
      or max_discount_amount > 0
    ),
  minimum_subtotal numeric(12,2) not null default 0
    check (minimum_subtotal >= 0),
  store_id uuid null
    references now.stores(id)
    on delete cascade,
  category_id uuid null
    references now.store_categories(id)
    on delete cascade,
  starts_at timestamptz null,
  ends_at timestamptz null,
  max_redemptions_total integer null
    check (
      max_redemptions_total is null
      or max_redemptions_total > 0
    ),
  max_redemptions_per_user integer null default 1
    check (
      max_redemptions_per_user is null
      or max_redemptions_per_user > 0
    ),
  first_order_only boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vouchers_valid_window_check
    check (
      starts_at is null
      or ends_at is null
      or starts_at < ends_at
    ),
  constraint vouchers_percentage_value_check
    check (
      discount_type <> 'percentage'
      or discount_value <= 100
    )
);

create unique index if not exists vouchers_code_upper_key
  on now.vouchers (upper(btrim(code)));

create index if not exists vouchers_active_window_idx
  on now.vouchers (is_active, starts_at, ends_at);

create index if not exists vouchers_store_idx
  on now.vouchers (store_id)
  where store_id is not null;

create index if not exists vouchers_category_idx
  on now.vouchers (category_id)
  where category_id is not null;

drop trigger if exists vouchers_set_updated_at on now.vouchers;

create trigger vouchers_set_updated_at
before update on now.vouchers
for each row
execute function now.set_updated_at();

create table if not exists now.voucher_redemptions (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null
    references now.vouchers(id)
    on delete cascade,
  order_id uuid not null
    references now.orders(id)
    on delete cascade,
  user_id uuid not null,
  customer_phone_snapshot text not null,
  discount_amount numeric(12,2) not null
    check (discount_amount >= 0),
  status text not null default 'reserved'
    check (status in ('reserved', 'redeemed', 'released')),
  reserved_at timestamptz not null default now(),
  redeemed_at timestamptz null,
  released_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id)
);

create index if not exists voucher_redemptions_voucher_status_idx
  on now.voucher_redemptions (voucher_id, status);

create index if not exists voucher_redemptions_user_status_idx
  on now.voucher_redemptions (voucher_id, user_id, status);

create index if not exists voucher_redemptions_phone_status_idx
  on now.voucher_redemptions (
    voucher_id,
    customer_phone_snapshot,
    status
  );

drop trigger if exists voucher_redemptions_set_updated_at
  on now.voucher_redemptions;

create trigger voucher_redemptions_set_updated_at
before update on now.voucher_redemptions
for each row
execute function now.set_updated_at();

alter table now.orders
  add column if not exists voucher_id uuid null,
  add column if not exists voucher_code_snapshot text null,
  add column if not exists voucher_title_ar_snapshot text null,
  add column if not exists voucher_discount_type_snapshot text null,
  add column if not exists voucher_discount_value_snapshot numeric(12,2) null,
  add column if not exists voucher_discount_amount numeric(12,2) not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_voucher_id_fkey'
      and conrelid = 'now.orders'::regclass
  ) then
    alter table now.orders
      add constraint orders_voucher_id_fkey
      foreign key (voucher_id)
      references now.vouchers(id)
      on delete set null;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_voucher_discount_amount_check'
      and conrelid = 'now.orders'::regclass
  ) then
    alter table now.orders
      add constraint orders_voucher_discount_amount_check
      check (
        voucher_discount_amount >= 0
        and voucher_discount_amount <= subtotal
      );
  end if;
end;
$$;

alter table now.vouchers enable row level security;
alter table now.voucher_redemptions enable row level security;

revoke all on now.vouchers
  from public, anon, authenticated;

revoke all on now.voucher_redemptions
  from public, anon, authenticated;

grant select, insert, update, delete
  on now.vouchers
  to service_role;

grant select, insert, update, delete
  on now.voucher_redemptions
  to service_role;

create or replace function now.calculate_order_total()
returns trigger
language plpgsql
set search_path to 'now', 'pg_temp'
as $function$
begin
  if new.payment_processing_fee is null
     or new.payment_processing_fee = 0
  then
    new.payment_processing_fee := 10;
  end if;

  new.voucher_discount_amount :=
    least(
      greatest(
        coalesce(new.voucher_discount_amount, 0),
        0
      ),
      greatest(coalesce(new.subtotal, 0), 0)
    );

  new.total_amount :=
    greatest(
      coalesce(new.subtotal, 0)
      - new.voucher_discount_amount,
      0
    )
    + coalesce(new.delivery_fee, 0)
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
            *
            coalesce(
              v_payment_method.processing_fee_percentage,
              0
            )
            / 100,
            2
          );

      else
        v_processing_fee := 0;
    end case;

    if
      v_payment_method.processing_fee_min_amount
      is not null
    then
      v_processing_fee :=
        greatest(
          v_processing_fee,
          v_payment_method.processing_fee_min_amount
        );
    end if;

    if
      v_payment_method.processing_fee_max_amount
      is not null
    then
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

  new.voucher_discount_amount :=
    least(
      greatest(
        coalesce(new.voucher_discount_amount, 0),
        0
      ),
      greatest(coalesce(new.subtotal, 0), 0)
    );

  new.total_amount :=
    greatest(
      coalesce(new.subtotal, 0)
      - new.voucher_discount_amount,
      0
    )
    +
    coalesce(new.delivery_fee, 0)
    +
    coalesce(v_processing_fee, 0);

  return new;
end;
$function$;

create or replace function now.get_voucher_quote_internal(
  p_code text,
  p_store_id uuid,
  p_subtotal numeric,
  p_user_id uuid,
  p_customer_phone text,
  p_for_reservation boolean default false
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
  v_total_redemptions integer := 0;
  v_user_redemptions integer := 0;
  v_has_previous_order boolean := false;
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

  if v_voucher.category_id is not null
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

  case v_voucher.discount_type
    when 'fixed' then
      v_discount :=
        least(
          v_voucher.discount_value,
          p_subtotal
        );

    when 'percentage' then
      v_discount :=
        round(
          p_subtotal
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
          p_subtotal
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
    'discount_type', v_voucher.discount_type,
    'discount_value', v_voucher.discount_value,
    'discount_amount', v_discount,
    'minimum_subtotal', v_voucher.minimum_subtotal,
    'max_discount_amount', v_voucher.max_discount_amount,
    'subtotal_before_discount', p_subtotal,
    'subtotal_after_discount',
      greatest(p_subtotal - v_discount, 0),
    'starts_at', v_voucher.starts_at,
    'ends_at', v_voucher.ends_at
  );
end;
$function$;

revoke all on function now.get_voucher_quote_internal(
  text,
  uuid,
  numeric,
  uuid,
  text,
  boolean
) from public, anon, authenticated;

grant execute on function now.get_voucher_quote_internal(
  text,
  uuid,
  numeric,
  uuid,
  text,
  boolean
) to service_role;

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
    false
  );
end;
$function$;

revoke all on function now.validate_voucher(
  text,
  uuid,
  numeric,
  text
) from public, anon;

grant execute on function now.validate_voucher(
  text,
  uuid,
  numeric,
  text
) to authenticated, service_role;

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
      v_user_id,
      v_order.customer_phone,
      true
    );

  v_voucher_id :=
    (v_quote ->> 'voucher_id')::uuid;

  v_discount :=
    (v_quote ->> 'discount_amount')::numeric;

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

revoke all on function now.create_whatsapp_order_v2(jsonb)
  from public, anon;

grant execute on function now.create_whatsapp_order_v2(jsonb)
  to authenticated, service_role;

create or replace function now.sync_voucher_redemption_with_order()
returns trigger
language plpgsql
security definer
set search_path to 'now', 'pg_temp'
as $function$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'cancelled' then
    update now.voucher_redemptions
    set
      status = 'released',
      released_at = coalesce(released_at, now())
    where order_id = new.id
      and status <> 'released';

    return new;
  end if;

  if new.status <> 'awaiting_whatsapp_send' then
    update now.voucher_redemptions
    set
      status = 'redeemed',
      redeemed_at = coalesce(redeemed_at, now()),
      released_at = null
    where order_id = new.id
      and status = 'reserved';
  end if;

  return new;
end;
$function$;

drop trigger if exists orders_sync_voucher_redemption
  on now.orders;

create trigger orders_sync_voucher_redemption
after update of status on now.orders
for each row
execute function now.sync_voucher_redemption_with_order();

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
        'خصم الكوبون' ||
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

create or replace function now.get_order_by_token(
  p_access_token uuid
)
returns jsonb
language sql
stable
security definer
set search_path to 'now', 'pg_temp'
as $function$
  select jsonb_build_object(
    'id', o.id,
    'order_code', o.order_code,
    'access_token', o.access_token,
    'client_request_id',
      o.client_request_id,

    'app',
    jsonb_build_object(
      'name',
      (
        select settings.app_name
        from now.app_settings as settings
        where settings.singleton = true
      )
    ),

    'status', o.status,
    'payment_status',
      o.payment_status,
    'source', o.source,

    'store',
    jsonb_build_object(
      'id', o.store_id,
      'name_ar',
        o.store_name_ar_snapshot,
      'icon',
        (
          select store.icon
          from now.stores as store
          where store.id = o.store_id
        )
    ),

    'customer',
    jsonb_build_object(
      'name', o.customer_name,
      'phone', o.customer_phone
    ),

    'delivery',
    jsonb_build_object(
      'service_area_id',
        o.service_area_id,
      'area_name_ar',
        o.area_name_ar_snapshot,
      'address', o.address,
      'landmark', o.landmark,
      'notes', o.notes
    ),

    'payment',
    jsonb_build_object(
      'payment_method_id',
        o.payment_method_id,
      'payment_method_name',
        o.payment_method_name_snapshot
    ),

    'summary',
    jsonb_build_object(
      'subtotal', o.subtotal,
      'voucher_code',
        o.voucher_code_snapshot,
      'voucher_title_ar',
        o.voucher_title_ar_snapshot,
      'voucher_discount_amount',
        o.voucher_discount_amount,
      'delivery_fee',
        o.delivery_fee,
      'payment_processing_fee',
        o.payment_processing_fee,
      'total_amount',
        o.total_amount,
      'currency_code',
        o.currency_code,
      'currency_symbol',
        o.currency_symbol
    ),

    'whatsapp',
    jsonb_build_object(
      'message', o.whatsapp_message,
      'opened_at',
        o.whatsapp_opened_at,
      'sent_confirmed_at',
        o.whatsapp_sent_confirmed_at,
      'number',
        (
          select settings.whatsapp_number
          from now.app_settings as settings
          where settings.singleton = true
        )
    ),

    'items',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'product_id',
              oi.product_id,
            'product_variant_id',
              oi.product_variant_id,
            'name_ar',
              oi.product_name_ar_snapshot,
            'variant_name_ar',
              oi.variant_name_ar_snapshot,
            'sku', oi.sku_snapshot,
            'icon',
              (
                select product.icon
                from now.products as product
                where product.id = oi.product_id
              ),
            'image_url',
              oi.image_url_snapshot,
            'quantity', oi.quantity,
            'unit_price',
              oi.unit_price,
            'line_total',
              oi.line_total,
            'requires_prescription',
              oi.requires_prescription_snapshot,
            'is_age_restricted',
              oi.is_age_restricted_snapshot
          )
          order by
            oi.created_at,
            oi.id
        )
        from now.order_items as oi
        where oi.order_id = o.id
      ),
      '[]'::jsonb
    ),

    'status_history',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'old_status',
              osh.old_status,
            'new_status',
              osh.new_status,
            'note', osh.note,
            'changed_by_type',
              osh.changed_by_type,
            'actor_reference',
              osh.actor_reference,
            'created_at',
              osh.created_at
          )
          order by
            osh.created_at,
            osh.id
        )
        from now.order_status_history as osh
        where osh.order_id = o.id
      ),
      '[]'::jsonb
    ),

    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'confirmed_at', o.confirmed_at,
    'preparing_at', o.preparing_at,
    'out_for_delivery_at',
      o.out_for_delivery_at,
    'delivered_at', o.delivered_at,
    'cancelled_at', o.cancelled_at,
    'cancellation_reason',
      o.cancellation_reason
  )
  from now.orders as o
  where o.access_token = p_access_token
    and auth.uid() is not null
    and (
      o.user_id = auth.uid()
      or o.user_id is null
    );
$function$;

grant execute on function now.get_order_by_token(uuid)
  to authenticated, service_role;
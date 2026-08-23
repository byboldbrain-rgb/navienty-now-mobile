-- Allow create_whatsapp_order_v2 to ignore the order being created
-- when validating first-order-only vouchers.

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
  boolean,
  uuid
) from public, anon, authenticated;

grant execute on function now.get_voucher_quote_internal(
  text,
  uuid,
  numeric,
  uuid,
  text,
  boolean,
  uuid
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
    false,
    null
  );
end;
$function$;

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
      true,
      v_order.id
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

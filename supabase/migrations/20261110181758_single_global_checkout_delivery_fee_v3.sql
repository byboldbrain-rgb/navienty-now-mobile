-- Global checkout: price delivery once at the maximum applicable store-area fee.
-- Existing already-created orders are not repriced. This affects new order groups.

CREATE OR REPLACE FUNCTION now.apply_global_order_group_fee_policy()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'now', 'pg_temp'
AS $function$
declare
  v_order_discount numeric(12,2) := 0;
  v_delivery_discount numeric(12,2) := 0;
  v_pre_spin_total numeric(12,2) := 0;
  v_spin_discount numeric(12,2) := 0;
begin
  if new.order_group_id is null then
    return new;
  end if;

  -- The global group creator assigns exactly one delivery fee. Do not
  -- overwrite that amount with a per-store fee on subsequent child updates.
  new.delivery_fee := greatest(coalesce(new.delivery_fee, 0), 0);

  -- Processing fees stay a single checkout-level charge, owned by the first
  -- child order, independent from the per-store delivery fees.
  if not coalesce(new.order_group_fee_owner, false) then
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

CREATE OR REPLACE FUNCTION now.create_global_order_group_v1(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'now', 'pg_temp'
AS $function$
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
    0,
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

  -- One customer-facing delivery fee for the whole global cart: the largest
  -- applicable store/area quote, never the sum of quotes. The first child
  -- owns that one fee; every other child has zero delivery fee.
  select coalesce(
    max(greatest(coalesce(ssa.delivery_fee, area.default_delivery_fee, 0), 0)),
    0
  )
  into v_group_delivery_fee
  from now.orders group_child
  join now.service_areas area
    on area.id = group_child.service_area_id
  left join now.store_service_areas ssa
    on ssa.store_id = group_child.store_id
   and ssa.service_area_id = area.id
  where group_child.order_group_id = v_group.id;

  update now.orders as group_child
  set delivery_fee = case
    when coalesce(group_child.order_group_fee_owner, false)
      then v_group_delivery_fee
    else 0
  end
  where group_child.order_group_id = v_group.id;

  -- Refresh each individual order's message after its delivery is final.
  update now.orders as group_child
  set whatsapp_message = case
    when exists (
      select 1 from now.order_items item
      where item.order_id = group_child.id and item.item_kind = 'print_job'
    ) then now.build_order_whatsapp_message_v2(group_child.id)
    else now.build_order_whatsapp_message(group_child.id)
  end
  where group_child.order_group_id = v_group.id;

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

  -- Processing fee remains one checkout-level charge. Recalculate it against
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

  if v_group.delivery_fee <> (
    select coalesce(sum(grouped_order.delivery_fee), 0)
    from now.orders grouped_order
    where grouped_order.order_group_id = v_group.id
  ) then
    raise exception using errcode = 'P0001', message = 'global_delivery_fee_invariant_failed';
  end if;

  return now.get_global_order_group_v1(v_group.access_token);
end;
$function$;

CREATE OR REPLACE FUNCTION now.build_global_order_group_whatsapp_message_v1(p_group_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'now', 'pg_temp'
AS $function$
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
      E'%s. %s — %s\n   المنتجات: %s %s\n   التوصيل: %s %s\n   إجمالي الطلب: %s %s',
      coalesce(order_group_position, 0),
      store_name_ar_snapshot,
      order_code,
      subtotal,
      currency_symbol,
      delivery_fee,
      currency_symbol,
      total_amount,
      currency_symbol
    ),
    E'\\n'
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
    E'\\n',
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
    'رسوم التوصيل (مرة واحدة): ' || v_group.delivery_fee || ' ' || v_group.currency_symbol,
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

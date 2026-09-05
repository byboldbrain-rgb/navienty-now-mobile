-- Navienty Now — printing job order integration.
-- Existing order RPCs stay unchanged; the mobile client opts into v2/v3 RPCs.

begin;

/* --------------------------------------------------------------------------
 * 1. Convert one semantic print job into the existing priced catalog lines.
 *
 * The legacy pricing RPC accepts a maximum quantity of 99 per line. A print
 * job can contain hundreds of sheets, so it is split into internal chunks.
 * The order RPC consolidates those chunks back into one customer-facing row.
 * -------------------------------------------------------------------------- */

create or replace function now.expand_printing_order_items(
  p_items jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = now, pg_temp
as $function$
declare
  v_item jsonb;
  v_print_job jsonb;
  v_quote jsonb;
  v_print_quote jsonb;
  v_expanded_items jsonb := '[]'::jsonb;
  v_print_job_count integer := 0;
  v_print_chunk_count integer := 0;
  v_remaining integer;
  v_chunk integer;
  v_service_id uuid;
  v_color_option_id uuid;
  v_side_option_id uuid;
  v_page_count integer;
  v_copy_count integer;
begin
  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = '22023', message = 'order_items_required';
  end if;

  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception using errcode = '22023', message = 'invalid_order_item';
    end if;

    if v_item ? 'print_job' then
      v_print_job := v_item -> 'print_job';

      if v_print_job is null or jsonb_typeof(v_print_job) <> 'object' then
        raise exception using errcode = '22023', message = 'invalid_print_job';
      end if;

      v_print_job_count := v_print_job_count + 1;

      if v_print_job_count > 1 then
        raise exception using
          errcode = '22023',
          message = 'multiple_print_jobs_not_supported';
      end if;

      begin
        v_service_id := (v_print_job ->> 'printing_service_id')::uuid;
        v_color_option_id := (v_print_job ->> 'color_option_id')::uuid;
        v_side_option_id := (v_print_job ->> 'side_option_id')::uuid;
        v_page_count := (v_print_job ->> 'page_count')::integer;
        v_copy_count := (v_print_job ->> 'copy_count')::integer;
      exception
        when invalid_text_representation or numeric_value_out_of_range then
          raise exception using errcode = '22023', message = 'invalid_print_job';
      end;

      v_quote := now.get_printing_job_quote_internal(
        v_service_id,
        v_color_option_id,
        v_side_option_id,
        v_page_count,
        v_copy_count
      );

      -- The server-resolved product is authoritative. A client cannot swap
      -- the product or variant while preserving a cheaper print selection.
      if nullif(v_item ->> 'product_id', '') is not null
         and (v_item ->> 'product_id')::uuid <> (v_quote ->> 'product_id')::uuid then
        raise exception using errcode = '22023', message = 'print_job_product_mismatch';
      end if;

      v_print_quote := v_quote;
      v_remaining := (v_quote ->> 'total_sheets')::integer;

      while v_remaining > 0 loop
        v_chunk := least(v_remaining, 99);

        v_expanded_items := v_expanded_items || jsonb_build_array(
          jsonb_build_object(
            'product_id', v_quote ->> 'product_id',
            'variant_id', v_quote ->> 'product_variant_id',
            'quantity', v_chunk
          )
        );

        v_print_chunk_count := v_print_chunk_count + 1;
        v_remaining := v_remaining - v_chunk;
      end loop;
    else
      v_expanded_items := v_expanded_items || jsonb_build_array(v_item);
    end if;
  end loop;

  if jsonb_array_length(v_expanded_items) > 100 then
    raise exception using
      errcode = '22023',
      message = 'printing_order_too_large',
      detail = jsonb_build_object(
        'maximum_total_internal_lines', 100
      )::text;
  end if;

  return jsonb_build_object(
    'items', v_expanded_items,
    'print_quote', v_print_quote,
    'print_chunk_count', v_print_chunk_count
  );
end;
$function$;

revoke all on function now.expand_printing_order_items(jsonb)
  from public, anon, authenticated;

/* --------------------------------------------------------------------------
 * 2. Printing-aware WhatsApp message
 * -------------------------------------------------------------------------- */

create or replace function now.build_order_whatsapp_message_v2(
  p_order_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = now, pg_temp
as $function$
declare
  v_order now.orders%rowtype;
  v_settings now.app_settings%rowtype;
  v_items_text text;
  v_discount_label text;
  v_file_prompt text;
begin
  if not exists (
    select 1
    from now.order_items item
    where item.order_id = p_order_id
      and item.item_kind = 'print_job'
  ) then
    return now.build_order_whatsapp_message(p_order_id);
  end if;

  select * into v_order
  from now.orders
  where id = p_order_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'order_not_found';
  end if;

  select * into v_settings
  from now.app_settings
  where singleton = true;

  select string_agg(
    case
      when item_kind = 'print_job' then
        format(
          E'%s. %s\n   %s\n   %s ورقة A4 × %s %s = %s %s',
          line_number,
          product_name_ar_snapshot,
          coalesce(
            nullif(configuration_snapshot ->> 'summary_ar', ''),
            variant_name_ar_snapshot,
            'طلب طباعة A4'
          ),
          coalesce(configuration_snapshot ->> 'total_sheets', quantity::text),
          coalesce(configuration_snapshot ->> 'price_per_sheet', unit_price::text),
          v_order.currency_symbol,
          line_total,
          v_order.currency_symbol
        )
      else
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
        )
    end,
    E'\n'
    order by line_number
  )
  into v_items_text
  from (
    select
      row_number() over (order by created_at, id) as line_number,
      product_name_ar_snapshot,
      variant_name_ar_snapshot,
      quantity,
      unit_price,
      line_total,
      item_kind,
      configuration_snapshot
    from now.order_items
    where order_id = p_order_id
  ) ordered_items;

  select nullif(item.configuration_snapshot ->> 'whatsapp_file_prompt_ar', '')
  into v_file_prompt
  from now.order_items item
  where item.order_id = p_order_id
    and item.item_kind = 'print_job'
  order by item.created_at, item.id
  limit 1;

  v_discount_label := case coalesce(
    v_order.voucher_discount_target_snapshot,
    'order_subtotal'
  )
    when 'delivery_fee' then 'خصم على التوصيل'
    else 'خصم على الطلب'
  end;

  return concat_ws(
    E'\n',
    'طلب جديد من ' || v_settings.app_name,
    '',
    'رقم الطلب: ' || v_order.order_code,
    'المتجر: ' || v_order.store_name_ar_snapshot,
    '',
    'تفاصيل الطلب:',
    coalesce(v_items_text, 'لا توجد عناصر'),
    '',
    'إجمالي الطلب قبل الرسوم: ' || v_order.subtotal || ' ' || v_order.currency_symbol,
    case
      when coalesce(v_order.voucher_discount_amount, 0) > 0 then
        v_discount_label ||
        case
          when nullif(v_order.voucher_code_snapshot, '') is null then ''
          else ' (' || v_order.voucher_code_snapshot || ')'
        end || ': -' || v_order.voucher_discount_amount || ' ' || v_order.currency_symbol
      else null
    end,
    'رسوم التوصيل: ' || v_order.delivery_fee || ' ' || v_order.currency_symbol,
    case
      when coalesce(v_order.payment_processing_fee, 0) > 0 then
        coalesce(
          nullif(v_order.payment_fee_label_snapshot, ''),
          'رسوم الدفع الإلكتروني'
        ) || ': ' || v_order.payment_processing_fee || ' ' || v_order.currency_symbol
      else null
    end,
    'الإجمالي النهائي: ' || v_order.total_amount || ' ' || v_order.currency_symbol,
    '',
    'بيانات العميل:',
    'الاسم: ' || v_order.customer_name,
    'رقم الموبايل: ' || v_order.customer_phone,
    'المنطقة: ' || v_order.area_name_ar_snapshot,
    'العنوان: ' || v_order.address,
    'علامة مميزة: ' || coalesce(nullif(v_order.landmark, ''), 'لا يوجد'),
    'ملاحظات: ' || coalesce(nullif(v_order.notes, ''), 'لا يوجد'),
    'طريقة الدفع المختارة: ' || v_order.payment_method_name_snapshot,
    '',
    coalesce(
      v_file_prompt,
      'من فضلك أرفق ملف الطباعة في الرسالة التالية.'
    ),
    'أرجو تأكيد الملف والمبلغ النهائي وإرسال بيانات الدفع.'
  );
end;
$function$;

revoke all on function now.build_order_whatsapp_message_v2(uuid)
  from public, anon, authenticated;

/* --------------------------------------------------------------------------
 * 3. Create order v3
 * -------------------------------------------------------------------------- */

create or replace function now.create_whatsapp_order_v3(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = now, pg_temp
as $function$
declare
  v_expansion jsonb;
  v_expanded_items jsonb;
  v_print_quote jsonb;
  v_print_chunk_count integer;
  v_base_result jsonb;
  v_order_id uuid;
  v_primary_item_id uuid;
  v_matching_item_count integer;
  v_existing_snapshot jsonb;
  v_message text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_order_payload';
  end if;

  v_expansion := now.expand_printing_order_items(p_payload -> 'items');
  v_expanded_items := v_expansion -> 'items';
  v_print_quote := v_expansion -> 'print_quote';
  v_print_chunk_count := coalesce((v_expansion ->> 'print_chunk_count')::integer, 0);

  v_base_result := now.create_whatsapp_order_v2(
    jsonb_set(p_payload, '{items}', v_expanded_items, true)
  );

  if v_print_quote is null or jsonb_typeof(v_print_quote) = 'null' then
    return v_base_result;
  end if;

  v_order_id := (v_base_result ->> 'id')::uuid;

  -- Idempotent retry after this same print job was already consolidated.
  select item.configuration_snapshot
  into v_existing_snapshot
  from now.order_items item
  where item.order_id = v_order_id
    and item.item_kind = 'print_job'
  order by item.created_at, item.id
  limit 1;

  if found then
    if (v_existing_snapshot ->> 'printing_service_id') is distinct from
         (v_print_quote ->> 'printing_service_id')
       or (v_existing_snapshot ->> 'color_option_id') is distinct from
         (v_print_quote ->> 'color_option_id')
       or (v_existing_snapshot ->> 'side_option_id') is distinct from
         (v_print_quote ->> 'side_option_id')
       or (v_existing_snapshot ->> 'page_count') is distinct from
         (v_print_quote ->> 'page_count')
       or (v_existing_snapshot ->> 'copy_count') is distinct from
         (v_print_quote ->> 'copy_count') then
      raise exception using errcode = 'P0001', message = 'print_job_order_conflict';
    end if;

    v_message := now.build_order_whatsapp_message_v2(v_order_id);
    update now.orders set whatsapp_message = v_message where id = v_order_id;

    return v_base_result || jsonb_build_object('whatsapp_message', v_message);
  end if;

  select count(*)::integer
  into v_matching_item_count
  from now.order_items item
  where item.order_id = v_order_id
    and item.product_id = (v_print_quote ->> 'product_id')::uuid
    and item.product_variant_id = (v_print_quote ->> 'product_variant_id')::uuid
    and item.item_kind = 'catalog_product';

  if v_matching_item_count <> v_print_chunk_count then
    raise exception using errcode = 'P0001', message = 'print_job_order_conflict';
  end if;

  select item.id
  into v_primary_item_id
  from now.order_items item
  where item.order_id = v_order_id
    and item.product_id = (v_print_quote ->> 'product_id')::uuid
    and item.product_variant_id = (v_print_quote ->> 'product_variant_id')::uuid
    and item.item_kind = 'catalog_product'
  order by item.created_at, item.id
  limit 1;

  delete from now.order_items item
  where item.order_id = v_order_id
    and item.product_id = (v_print_quote ->> 'product_id')::uuid
    and item.product_variant_id = (v_print_quote ->> 'product_variant_id')::uuid
    and item.item_kind = 'catalog_product'
    and item.id <> v_primary_item_id;

  update now.order_items
  set
    product_name_ar_snapshot = v_print_quote ->> 'product_name_ar',
    variant_name_ar_snapshot = v_print_quote ->> 'summary_ar',
    quantity = (v_print_quote ->> 'total_sheets')::integer,
    unit_price = (v_print_quote ->> 'price_per_sheet')::numeric,
    line_total = (v_print_quote ->> 'total_price')::numeric,
    item_kind = 'print_job',
    configuration_snapshot = v_print_quote
  where id = v_primary_item_id;

  v_message := now.build_order_whatsapp_message_v2(v_order_id);

  update now.orders
  set whatsapp_message = v_message
  where id = v_order_id;

  return v_base_result || jsonb_build_object('whatsapp_message', v_message);
end;
$function$;

revoke all on function now.create_whatsapp_order_v3(jsonb)
  from public, anon, authenticated;
grant execute on function now.create_whatsapp_order_v3(jsonb)
  to authenticated, service_role;

/* --------------------------------------------------------------------------
 * 4. Spin quote v2: same server conversion as checkout
 * -------------------------------------------------------------------------- */

create or replace function now.claim_cart_spin_reward_v2(
  p_store_id uuid,
  p_items jsonb,
  p_has_active_voucher boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = now, pg_temp
as $function$
declare
  v_expansion jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  v_expansion := now.expand_printing_order_items(p_items);

  return now.claim_cart_spin_reward(
    p_store_id,
    v_expansion -> 'items',
    p_has_active_voucher
  );
end;
$function$;

revoke all on function now.claim_cart_spin_reward_v2(uuid, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function now.claim_cart_spin_reward_v2(uuid, jsonb, boolean)
  to authenticated, service_role;

/* --------------------------------------------------------------------------
 * 5. Additive order readers exposing print snapshots
 * -------------------------------------------------------------------------- */

create or replace function now.get_order_by_token_v2(
  p_access_token uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = now, pg_temp
as $function$
declare
  v_order jsonb;
  v_items jsonb;
begin
  v_order := now.get_order_by_token(p_access_token);

  if v_order is null then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      source_item || jsonb_build_object(
        'item_kind', order_item.item_kind,
        'configuration', order_item.configuration_snapshot
      )
      order by source_item_ordinality
    ),
    '[]'::jsonb
  )
  into v_items
  from jsonb_array_elements(v_order -> 'items')
    with ordinality source(source_item, source_item_ordinality)
  join now.order_items order_item
    on order_item.id = (source_item ->> 'id')::uuid;

  return jsonb_set(v_order, '{items}', v_items, true);
end;
$function$;

create or replace function now.get_my_orders_v2()
returns jsonb
language plpgsql
security definer
set search_path = now, pg_temp
as $function$
declare
  v_user_id uuid;
  v_result jsonb;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select coalesce(
    jsonb_agg(
      now.get_order_by_token_v2(order_row.access_token)
      order by order_row.created_at desc
    ),
    '[]'::jsonb
  )
  into v_result
  from now.orders order_row
  where order_row.user_id = v_user_id;

  return v_result;
end;
$function$;

revoke all on function now.get_order_by_token_v2(uuid)
  from public, anon, authenticated;
revoke all on function now.get_my_orders_v2()
  from public, anon, authenticated;
grant execute on function now.get_order_by_token_v2(uuid)
  to authenticated, service_role;
grant execute on function now.get_my_orders_v2()
  to authenticated, service_role;

commit;

alter table now.account_deletion_requests
  add column if not exists processing_started_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists last_preflight_at timestamptz,
  add column if not exists last_preflight jsonb,
  add column if not exists completion_blocked_reason text;

create or replace function now.get_account_deletion_preflight(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_context jsonb;
  v_request now.account_deletion_requests%rowtype;
  v_reference record;
  v_reference_count bigint;
  v_blocking_references jsonb := '[]'::jsonb;
  v_blocker_count integer := 0;
  v_now_footprint jsonb;
  v_result jsonb;
begin
  v_admin_context := now.assert_admin_permission('manage_settings');

  select request_row.*
    into v_request
    from now.account_deletion_requests request_row
   where request_row.id = p_request_id
   for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'account_deletion_request_not_found';
  end if;

  if v_request.user_id is null then
    v_result := jsonb_build_object(
      'request_id', v_request.id,
      'auth_user_id', null,
      'auth_user_present', false,
      'can_delete_auth_user', true,
      'blocking_reference_count', 0,
      'blocking_references', '[]'::jsonb,
      'now_footprint', jsonb_build_object(
        'orders', 0,
        'service_bookings', 0,
        'push_subscriptions', 0,
        'prescriptions', 0,
        'order_payment_proofs', 0,
        'service_booking_payment_proofs', 0
      )
    );

    update now.account_deletion_requests
       set last_preflight_at = now(),
           last_preflight = v_result,
           completion_blocked_reason = null,
           updated_at = now()
     where id = v_request.id;

    return v_result;
  end if;

  for v_reference in
    select
      source_namespace.nspname as schema_name,
      source_table.relname as table_name,
      source_column.attname as column_name,
      constraint_row.confdeltype as delete_action
    from pg_catalog.pg_constraint constraint_row
    join pg_catalog.pg_class source_table
      on source_table.oid = constraint_row.conrelid
    join pg_catalog.pg_namespace source_namespace
      on source_namespace.oid = source_table.relnamespace
    join pg_catalog.pg_attribute source_column
      on source_column.attrelid = source_table.oid
     and source_column.attnum = constraint_row.conkey[1]
   where constraint_row.contype = 'f'
     and constraint_row.confrelid = 'auth.users'::regclass
     and array_length(constraint_row.conkey, 1) = 1
     and constraint_row.confdeltype in ('a', 'r')
     and source_namespace.nspname <> 'auth'
   order by source_namespace.nspname, source_table.relname
  loop
    execute format(
      'select count(*) from %I.%I where %I = $1',
      v_reference.schema_name,
      v_reference.table_name,
      v_reference.column_name
    )
    into v_reference_count
    using v_request.user_id;

    if v_reference_count > 0 then
      v_blocker_count := v_blocker_count + 1;
      v_blocking_references :=
        v_blocking_references ||
        jsonb_build_array(
          jsonb_build_object(
            'schema', v_reference.schema_name,
            'table', v_reference.table_name,
            'column', v_reference.column_name,
            'rows', v_reference_count,
            'on_delete', case v_reference.delete_action
              when 'a' then 'NO ACTION'
              when 'r' then 'RESTRICT'
              else 'UNKNOWN'
            end
          )
        );
    end if;
  end loop;

  select jsonb_build_object(
    'orders', (
      select count(*)
      from now.orders orders
      where orders.user_id = v_request.user_id
    ),
    'service_bookings', (
      select count(*)
      from now.service_bookings bookings
      where bookings.user_id = v_request.user_id
    ),
    'push_subscriptions', (
      select count(*)
      from now.customer_push_subscriptions subscriptions
      where subscriptions.user_id = v_request.user_id
    ),
    'prescriptions', (
      select count(*)
      from now.prescription_submissions prescriptions
      where prescriptions.user_id = v_request.user_id
    ),
    'order_payment_proofs', (
      select count(*)
      from now.order_payment_proofs proofs
      where proofs.user_id = v_request.user_id
    ),
    'service_booking_payment_proofs', (
      select count(*)
      from now.service_booking_payment_proofs proofs
      where proofs.user_id = v_request.user_id
    )
  )
  into v_now_footprint;

  v_result := jsonb_build_object(
    'request_id', v_request.id,
    'auth_user_id', v_request.user_id,
    'auth_user_present', true,
    'can_delete_auth_user', v_blocker_count = 0,
    'blocking_reference_count', v_blocker_count,
    'blocking_references', v_blocking_references,
    'now_footprint', v_now_footprint
  );

  update now.account_deletion_requests
     set last_preflight_at = now(),
         last_preflight = v_result,
         completion_blocked_reason = case
           when v_blocker_count > 0
             then 'shared_auth_user_references_require_retention_review'
           else null
         end,
         updated_at = now()
   where id = v_request.id;

  return v_result;
end;
$$;

create or replace function now.list_account_deletion_requests(
  p_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin_context jsonb;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_status text := nullif(lower(btrim(coalesce(p_status, ''))), '');
  v_items jsonb;
  v_total bigint;
begin
  v_admin_context := now.assert_admin_permission('manage_settings');

  if v_status is not null
     and v_status not in ('pending', 'processing', 'completed', 'cancelled')
  then
    raise exception using
      errcode = '22023',
      message = 'invalid_account_deletion_status';
  end if;

  select count(*)
    into v_total
    from now.account_deletion_requests request_row
   where v_status is null
      or request_row.status = v_status;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', request_row.id,
        'user_id', request_row.user_id,
        'is_anonymous', request_row.is_anonymous,
        'source', request_row.source,
        'status', request_row.status,
        'requested_at', request_row.requested_at,
        'target_completion_at', request_row.target_completion_at,
        'processing_started_at', request_row.processing_started_at,
        'completed_at', request_row.completed_at,
        'cancelled_at', request_row.cancelled_at,
        'retention_note', request_row.retention_note,
        'last_preflight_at', request_row.last_preflight_at,
        'last_preflight', request_row.last_preflight,
        'completion_blocked_reason', request_row.completion_blocked_reason
      )
      order by request_row.requested_at asc
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select request_row.*
    from now.account_deletion_requests request_row
    where v_status is null
       or request_row.status = v_status
    order by request_row.requested_at asc
    limit v_limit
    offset v_offset
  ) request_row;

  return jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset
  );
end;
$$;

create or replace function now.start_account_deletion_processing(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_context jsonb;
  v_request now.account_deletion_requests%rowtype;
  v_preflight jsonb;
begin
  v_admin_context := now.assert_admin_permission('manage_settings');

  select request_row.*
    into v_request
    from now.account_deletion_requests request_row
   where request_row.id = p_request_id
   for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'account_deletion_request_not_found';
  end if;

  if v_request.status = 'processing' then
    return jsonb_build_object(
      'id', v_request.id,
      'status', v_request.status,
      'processing_started_at', v_request.processing_started_at,
      'last_preflight', v_request.last_preflight,
      'completion_blocked_reason', v_request.completion_blocked_reason
    );
  end if;

  if v_request.status <> 'pending' then
    raise exception using
      errcode = 'P0001',
      message = 'account_deletion_request_not_pending';
  end if;

  v_preflight := now.get_account_deletion_preflight(v_request.id);

  update now.account_deletion_requests
     set status = 'processing',
         processing_started_at = coalesce(processing_started_at, now()),
         processing_started_by_user_id = auth.uid(),
         updated_at = now()
   where id = v_request.id
  returning * into v_request;

  return jsonb_build_object(
    'id', v_request.id,
    'status', v_request.status,
    'processing_started_at', v_request.processing_started_at,
    'last_preflight', v_preflight,
    'completion_blocked_reason', v_request.completion_blocked_reason
  );
end;
$$;

create or replace function now.complete_account_deletion_request(
  p_request_id uuid,
  p_retention_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_context jsonb;
  v_request now.account_deletion_requests%rowtype;
  v_note text := nullif(btrim(coalesce(p_retention_note, '')), '');
begin
  v_admin_context := now.assert_admin_permission('manage_settings');

  select request_row.*
    into v_request
    from now.account_deletion_requests request_row
   where request_row.id = p_request_id
   for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'account_deletion_request_not_found';
  end if;

  if v_request.status = 'completed' then
    return jsonb_build_object(
      'id', v_request.id,
      'status', v_request.status,
      'completed_at', v_request.completed_at,
      'retention_note', v_request.retention_note
    );
  end if;

  if v_request.status <> 'processing' then
    raise exception using
      errcode = 'P0001',
      message = 'account_deletion_request_not_processing';
  end if;

  if v_request.user_id is not null then
    raise exception using
      errcode = 'P0001',
      message = 'auth_user_still_present';
  end if;

  update now.account_deletion_requests
     set status = 'completed',
         completed_at = coalesce(completed_at, now()),
         retention_note = coalesce(v_note, retention_note),
         completion_blocked_reason = null,
         updated_at = now()
   where id = v_request.id
  returning * into v_request;

  return jsonb_build_object(
    'id', v_request.id,
    'status', v_request.status,
    'completed_at', v_request.completed_at,
    'retention_note', v_request.retention_note
  );
end;
$$;

revoke all on function now.get_account_deletion_preflight(uuid) from public, anon;
revoke all on function now.list_account_deletion_requests(text, integer, integer) from public, anon;
revoke all on function now.start_account_deletion_processing(uuid) from public, anon;
revoke all on function now.complete_account_deletion_request(uuid, text) from public, anon;

grant execute on function now.get_account_deletion_preflight(uuid) to authenticated;
grant execute on function now.list_account_deletion_requests(text, integer, integer) to authenticated;
grant execute on function now.start_account_deletion_processing(uuid) to authenticated;
grant execute on function now.complete_account_deletion_request(uuid, text) to authenticated;

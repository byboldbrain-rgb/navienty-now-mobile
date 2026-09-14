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
  v_push_tokens_disabled integer := 0;
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
      'completion_blocked_reason', v_request.completion_blocked_reason,
      'push_tokens_disabled', 0
    );
  end if;

  if v_request.status <> 'pending' then
    raise exception using
      errcode = 'P0001',
      message = 'account_deletion_request_not_pending';
  end if;

  v_preflight := now.get_account_deletion_preflight(v_request.id);

  if v_request.user_id is not null then
    update now.customer_push_subscriptions subscriptions
       set is_active = false,
           updated_at = now()
     where subscriptions.user_id = v_request.user_id
       and subscriptions.is_active = true;

    get diagnostics v_push_tokens_disabled = row_count;
  end if;

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
    'completion_blocked_reason', v_request.completion_blocked_reason,
    'push_tokens_disabled', v_push_tokens_disabled
  );
end;
$$;

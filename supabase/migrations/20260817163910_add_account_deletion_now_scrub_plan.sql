alter table now.account_deletion_requests
  add column if not exists last_now_scrub_plan_at timestamptz,
  add column if not exists last_now_scrub_plan jsonb;

create or replace function now.get_account_deletion_now_scrub_plan(
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
  v_orders_total bigint := 0;
  v_orders_active bigint := 0;
  v_service_total bigint := 0;
  v_service_active bigint := 0;
  v_push_total bigint := 0;
  v_push_active bigint := 0;
  v_prescriptions bigint := 0;
  v_order_proofs bigint := 0;
  v_service_proofs bigint := 0;
  v_private_objects bigint := 0;
  v_order_pii_rows bigint := 0;
  v_service_pii_rows bigint := 0;
  v_plan jsonb;
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
    v_plan := jsonb_build_object(
      'request_id', v_request.id,
      'auth_user_id', null,
      'can_run_now_scrub', true,
      'active_work_blockers', jsonb_build_object(
        'orders', 0,
        'service_bookings', 0
      ),
      'counts', jsonb_build_object(
        'orders', 0,
        'service_bookings', 0,
        'push_subscriptions', 0,
        'active_push_subscriptions', 0,
        'prescriptions', 0,
        'order_payment_proofs', 0,
        'service_booking_payment_proofs', 0,
        'private_storage_objects', 0,
        'order_rows_with_pii', 0,
        'service_booking_rows_with_pii', 0
      ),
      'planned_actions', jsonb_build_array(
        'No Navienty Now user binding remains on this deletion request.'
      ),
      'retained_facts', jsonb_build_array(
        'financial totals and fee snapshots',
        'order/service status history',
        'catalog/package snapshots required for transaction history'
      ),
      'schema_contract_required', false
    );
  else
    select count(*),
           count(*) filter (
             where orders.status not in ('delivered', 'cancelled')
           ),
           count(*) filter (
             where nullif(btrim(orders.customer_name), '') is not null
                or nullif(btrim(orders.customer_phone), '') is not null
                or nullif(btrim(orders.address), '') is not null
                or nullif(btrim(coalesce(orders.landmark, '')), '') is not null
                or nullif(btrim(coalesce(orders.notes, '')), '') is not null
                or nullif(btrim(coalesce(orders.whatsapp_message, '')), '') is not null
                or orders.delivery_latitude is not null
                or orders.delivery_longitude is not null
           )
      into v_orders_total, v_orders_active, v_order_pii_rows
      from now.orders orders
     where orders.user_id = v_request.user_id;

    select count(*),
           count(*) filter (
             where bookings.status not in ('delivered', 'cancelled')
           ),
           count(*) filter (
             where nullif(btrim(bookings.customer_name), '') is not null
                or nullif(btrim(bookings.customer_phone), '') is not null
                or nullif(btrim(bookings.address), '') is not null
                or nullif(btrim(coalesce(bookings.landmark, '')), '') is not null
           )
      into v_service_total, v_service_active, v_service_pii_rows
      from now.service_bookings bookings
     where bookings.user_id = v_request.user_id;

    select count(*),
           count(*) filter (where subscriptions.is_active)
      into v_push_total, v_push_active
      from now.customer_push_subscriptions subscriptions
     where subscriptions.user_id = v_request.user_id;

    select count(*)
      into v_prescriptions
      from now.prescription_submissions prescriptions
     where prescriptions.user_id = v_request.user_id;

    select count(*)
      into v_order_proofs
      from now.order_payment_proofs proofs
     where proofs.user_id = v_request.user_id;

    select count(*)
      into v_service_proofs
      from now.service_booking_payment_proofs proofs
     where proofs.user_id = v_request.user_id;

    select count(*)
      into v_private_objects
      from storage.objects object
     where object.bucket_id in (
       'now-prescriptions',
       'now-payment-proofs',
       'now-service-booking-payment-proofs'
     )
       and object.name like v_request.user_id::text || '/%';

    v_plan := jsonb_build_object(
      'request_id', v_request.id,
      'auth_user_id', v_request.user_id,
      'can_run_now_scrub',
        v_orders_active = 0 and v_service_active = 0,
      'active_work_blockers', jsonb_build_object(
        'orders', v_orders_active,
        'service_bookings', v_service_active
      ),
      'counts', jsonb_build_object(
        'orders', v_orders_total,
        'service_bookings', v_service_total,
        'push_subscriptions', v_push_total,
        'active_push_subscriptions', v_push_active,
        'prescriptions', v_prescriptions,
        'order_payment_proofs', v_order_proofs,
        'service_booking_payment_proofs', v_service_proofs,
        'private_storage_objects', v_private_objects,
        'order_rows_with_pii', v_order_pii_rows,
        'service_booking_rows_with_pii', v_service_pii_rows
      ),
      'planned_actions', jsonb_build_array(
        'Deactivate/delete Navienty Now push subscriptions.',
        'Delete private prescription and payment-proof objects and their Navienty Now metadata rows after retention review.',
        'Redact order customer name, phone, address, landmark, free-text notes, WhatsApp message, delivery coordinates, and rotate bearer access tokens while retaining transaction totals/status/catalog snapshots.',
        'Redact service-booking customer name, phone, address and landmark while retaining package/payment/status facts.',
        'Detach Navienty Now records from the shared Auth identity only after active work is closed and schema/retention rules permit it.'
      ),
      'retained_facts', jsonb_build_array(
        'order codes and timestamps',
        'financial totals and fee snapshots',
        'payment method/store/package snapshots',
        'order/service status history needed for operational or accounting records'
      ),
      'schema_contract_required', true,
      'schema_contract_notes', jsonb_build_array(
        'now.orders.user_id is nullable and can be detached after scrub.',
        'now.service_bookings.user_id is currently NOT NULL, so a future destructive scrub must make the ownership column nullable or introduce a dedicated anonymized subject key before detaching the shared Auth identity.',
        'Exact legal/accounting retention periods are intentionally not encoded by this migration.'
      )
    );
  end if;

  update now.account_deletion_requests
     set last_now_scrub_plan_at = now(),
         last_now_scrub_plan = v_plan,
         updated_at = now()
   where id = v_request.id;

  return v_plan;
end;
$$;

revoke all on function now.get_account_deletion_now_scrub_plan(uuid) from public, anon;
grant execute on function now.get_account_deletion_now_scrub_plan(uuid) to authenticated;

-- Complete the customer handoff inside Navienty Now.
--
-- WhatsApp remains an optional support channel. Submitting an order or a
-- service booking must not depend on another app being installed, opened, or
-- foregrounded.

-- The existing customer-write guard historically inferred that every
-- transition to waiting-confirmation meant WhatsApp had been opened. The
-- transition now also represents an in-app submission, so only the legacy
-- mark_service_booking_whatsapp_opened RPC should explicitly set that
-- timestamp.
create or replace function now.guard_service_booking_customer_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_package now.service_packages%rowtype;
  v_payment now.payment_methods%rowtype;
  v_whatsapp text;
  v_payment_gate_enabled boolean := false;
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.user_id := (select auth.uid());

    select *
      into v_package
      from now.service_packages
     where id = new.service_package_id
       and is_active = true;

    if not found then
      raise exception 'Service package is unavailable';
    end if;

    new.package_slug := v_package.slug;
    new.package_name_ar := v_package.name_ar;
    new.package_name_en := v_package.name_en;
    new.package_price := v_package.price;
    new.currency_code := v_package.currency_code;
    new.currency_symbol := v_package.currency_symbol;
    new.package_image_url := v_package.image_url;

    if new.payment_method_id is null then
      raise exception 'Payment method is required';
    end if;

    select *
      into v_payment
      from now.payment_methods
     where id = new.payment_method_id
       and is_active = true;

    if not found then
      raise exception 'Payment method is unavailable';
    end if;

    new.payment_method_name_ar := v_payment.name_ar;

    select
      nullif(btrim(settings.whatsapp_number), ''),
      coalesce(settings.service_booking_payment_proof_gate_enabled, false)
      into v_whatsapp, v_payment_gate_enabled
      from now.app_settings settings
     where settings.singleton = true
     limit 1;

    if v_whatsapp is not null then
      new.whatsapp_number := v_whatsapp;
    end if;

    new.payment_proof_required :=
      coalesce(v_payment_gate_enabled, false)
      and coalesce(v_payment.requires_payment_proof, false);

    new.status := 'awaiting-whatsapp-send';
    new.cancellation_reason := null;
    new.whatsapp_opened_at := null;
    new.cancelled_at := null;
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := now();

    return new;
  end if;

  if old.user_id is distinct from (select auth.uid()) then
    raise exception 'Booking does not belong to the current user';
  end if;

  if new.user_id is distinct from old.user_id
     or new.service_package_id is distinct from old.service_package_id
     or new.package_slug is distinct from old.package_slug
     or new.package_name_ar is distinct from old.package_name_ar
     or new.package_name_en is distinct from old.package_name_en
     or new.package_price is distinct from old.package_price
     or new.currency_code is distinct from old.currency_code
     or new.currency_symbol is distinct from old.currency_symbol
     or new.package_image_url is distinct from old.package_image_url
     or new.payment_method_id is distinct from old.payment_method_id
     or new.payment_method_name_ar is distinct from old.payment_method_name_ar
     or new.payment_proof_required is distinct from old.payment_proof_required
     or new.customer_name is distinct from old.customer_name
     or new.customer_phone is distinct from old.customer_phone
     or new.address is distinct from old.address
     or new.landmark is distinct from old.landmark
     or new.service_area_name is distinct from old.service_area_name
     or new.whatsapp_number is distinct from old.whatsapp_number
     or new.created_at is distinct from old.created_at then
    raise exception 'Protected service booking fields cannot be changed';
  end if;

  if old.status = 'awaiting-whatsapp-send'
     and new.status = 'waiting-confirmation' then
    new.cancellation_reason := null;
    new.cancelled_at := null;
  elsif old.status in ('awaiting-whatsapp-send', 'waiting-confirmation')
        and new.status = 'cancelled' then
    new.cancellation_reason := coalesce(
      nullif(btrim(new.cancellation_reason), ''),
      'customer_cancelled'
    );
    new.cancelled_at := coalesce(new.cancelled_at, now());
  elsif new.status is distinct from old.status then
    raise exception 'Customer cannot set this booking status';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function now.submit_order_for_confirmation(
  p_access_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order now.orders%rowtype;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication_required';
  end if;

  select order_row.*
    into v_order
    from now.orders as order_row
   where order_row.access_token = p_access_token
     and order_row.user_id = v_user_id
   for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'order_not_found';
  end if;

  if v_order.status = 'awaiting_whatsapp_send' then
    update now.orders
       set status = 'waiting_confirmation',
           updated_at = now()
     where id = v_order.id;
  elsif v_order.status not in (
    'waiting_confirmation',
    'confirmed',
    'preparing',
    'out_for_delivery',
    'delivered'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'order_not_available_for_submission';
  end if;

  return now.get_order_by_token(
    p_access_token
  );
end;
$$;

comment on function now.submit_order_for_confirmation(uuid) is
  'Owner-scoped, idempotent in-app order submission. Does not claim that WhatsApp was opened or sent.';

revoke all on function now.submit_order_for_confirmation(uuid)
  from public, anon;

grant execute on function now.submit_order_for_confirmation(uuid)
  to authenticated;

create or replace function now.submit_service_booking_for_confirmation(
  p_booking_id uuid
)
returns now.service_bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_booking now.service_bookings%rowtype;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication_required';
  end if;

  select booking_row.*
    into v_booking
    from now.service_bookings as booking_row
   where booking_row.id = p_booking_id
     and booking_row.user_id = v_user_id
   for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'service_booking_not_found';
  end if;

  if v_booking.status = 'awaiting-whatsapp-send' then
    update now.service_bookings
       set status = 'waiting-confirmation',
           updated_at = now()
     where id = v_booking.id
    returning * into v_booking;
  elsif v_booking.status not in (
    'waiting-confirmation',
    'confirmed',
    'picked-up',
    'processing',
    'ready-for-delivery',
    'out-for-delivery',
    'delivered'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'service_booking_not_available_for_submission';
  end if;

  return v_booking;
end;
$$;

comment on function now.submit_service_booking_for_confirmation(uuid) is
  'Owner-scoped, idempotent in-app service booking submission. Does not claim that WhatsApp was opened.';

revoke all on function now.submit_service_booking_for_confirmation(uuid)
  from public, anon;

grant execute on function now.submit_service_booking_for_confirmation(uuid)
  to authenticated;

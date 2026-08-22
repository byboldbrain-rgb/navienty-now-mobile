create or replace function now.guard_service_booking_customer_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_package now.service_packages%rowtype;
  v_payment now.payment_methods%rowtype;
  v_whatsapp text;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if tg_op = 'INSERT' then
    new.user_id := (select auth.uid());

    select *
      into v_package
      from now.service_packages
     where id = new.service_package_id
       and is_active = true;

    if not found then
      raise exception 'Service package is not available';
    end if;

    new.package_slug := v_package.slug;
    new.package_name_ar := v_package.name_ar;
    new.package_name_en := v_package.name_en;
    new.package_price := v_package.price;
    new.currency_code := v_package.currency_code;
    new.currency_symbol := v_package.currency_symbol;
    new.package_image_url := v_package.image_url;

    if new.payment_method_id is not null then
      select *
        into v_payment
        from now.payment_methods
       where id = new.payment_method_id
         and is_active = true;

      if not found then
        raise exception 'Payment method is not available';
      end if;

      new.payment_method_name_ar := v_payment.name_ar;
    end if;

    select nullif(trim(whatsapp_number), '')
      into v_whatsapp
      from now.app_settings
     where singleton = true
     limit 1;

    if v_whatsapp is not null then
      new.whatsapp_number := v_whatsapp;
    end if;

    new.status := 'awaiting-whatsapp-send';
    new.whatsapp_opened_at := null;
    new.cancelled_at := null;
    new.cancellation_reason := null;

    return new;
  end if;

  if old.user_id <> (select auth.uid()) or new.user_id <> old.user_id then
    raise exception 'Not allowed to modify this booking';
  end if;

  if new.service_package_id is distinct from old.service_package_id
    or new.package_slug is distinct from old.package_slug
    or new.package_name_ar is distinct from old.package_name_ar
    or new.package_name_en is distinct from old.package_name_en
    or new.package_price is distinct from old.package_price
    or new.currency_code is distinct from old.currency_code
    or new.currency_symbol is distinct from old.currency_symbol
    or new.package_image_url is distinct from old.package_image_url
    or new.payment_method_id is distinct from old.payment_method_id
    or new.payment_method_name_ar is distinct from old.payment_method_name_ar
    or new.customer_name is distinct from old.customer_name
    or new.customer_phone is distinct from old.customer_phone
    or new.address is distinct from old.address
    or new.landmark is distinct from old.landmark
    or new.service_area_name is distinct from old.service_area_name
    or new.whatsapp_number is distinct from old.whatsapp_number
  then
    raise exception 'Booking details are immutable';
  end if;

  if old.status = 'awaiting-whatsapp-send'
     and new.status = 'waiting-confirmation' then
    new.whatsapp_opened_at := coalesce(old.whatsapp_opened_at, now());
    new.cancelled_at := null;
    new.cancellation_reason := null;
  elsif old.status = 'awaiting-whatsapp-send'
     and new.status = 'cancelled' then
    new.cancelled_at := coalesce(old.cancelled_at, now());
    if nullif(trim(new.cancellation_reason), '') is null then
      new.cancellation_reason := 'whatsapp_open_failed';
    end if;
  else
    raise exception 'Invalid customer booking status transition';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists service_bookings_customer_write_guard on now.service_bookings;
create trigger service_bookings_customer_write_guard
before insert or update on now.service_bookings
for each row
execute function now.guard_service_booking_customer_write();

create or replace function now.create_service_booking(
  p_service_package_id uuid,
  p_payment_method_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_address text,
  p_landmark text default null,
  p_service_area_name text default null
)
returns now.service_bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_package now.service_packages%rowtype;
  v_payment now.payment_methods%rowtype;
  v_whatsapp text;
  v_booking now.service_bookings%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(p_customer_name), '') is null
     or nullif(trim(p_customer_phone), '') is null
     or nullif(trim(p_address), '') is null then
    raise exception 'Customer name, phone, and address are required';
  end if;

  select *
    into v_package
    from now.service_packages
   where id = p_service_package_id
     and is_active = true;

  if not found then
    raise exception 'Service package is not available';
  end if;

  select *
    into v_payment
    from now.payment_methods
   where id = p_payment_method_id
     and is_active = true;

  if not found then
    raise exception 'Payment method is not available';
  end if;

  select nullif(trim(whatsapp_number), '')
    into v_whatsapp
    from now.app_settings
   where singleton = true
   limit 1;

  if v_whatsapp is null then
    raise exception 'WhatsApp number is not configured';
  end if;

  insert into now.service_bookings (
    user_id,
    service_package_id,
    package_slug,
    package_name_ar,
    package_name_en,
    package_price,
    currency_code,
    currency_symbol,
    package_image_url,
    payment_method_id,
    payment_method_name_ar,
    customer_name,
    customer_phone,
    address,
    landmark,
    service_area_name,
    whatsapp_number,
    status
  ) values (
    v_user_id,
    v_package.id,
    v_package.slug,
    v_package.name_ar,
    v_package.name_en,
    v_package.price,
    v_package.currency_code,
    v_package.currency_symbol,
    v_package.image_url,
    v_payment.id,
    v_payment.name_ar,
    trim(p_customer_name),
    trim(p_customer_phone),
    trim(p_address),
    nullif(trim(p_landmark), ''),
    nullif(trim(p_service_area_name), ''),
    v_whatsapp,
    'awaiting-whatsapp-send'
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

create or replace function now.mark_service_booking_whatsapp_opened(
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
    raise exception 'Authentication required';
  end if;

  update now.service_bookings
     set status = 'waiting-confirmation',
         whatsapp_opened_at = coalesce(whatsapp_opened_at, now()),
         updated_at = now()
   where id = p_booking_id
     and user_id = v_user_id
     and status = 'awaiting-whatsapp-send'
  returning * into v_booking;

  if not found then
    raise exception 'Booking is not available for this transition';
  end if;

  return v_booking;
end;
$$;

create or replace function now.cancel_service_booking_open_failure(
  p_booking_id uuid,
  p_reason text default 'whatsapp_open_failed'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_updated integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  update now.service_bookings
     set status = 'cancelled',
         cancellation_reason = left(coalesce(nullif(trim(p_reason), ''), 'whatsapp_open_failed'), 500),
         cancelled_at = coalesce(cancelled_at, now()),
         updated_at = now()
   where id = p_booking_id
     and user_id = v_user_id
     and status = 'awaiting-whatsapp-send';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function now.create_service_booking(uuid, uuid, text, text, text, text, text) from public, anon;
revoke all on function now.mark_service_booking_whatsapp_opened(uuid) from public, anon;
revoke all on function now.cancel_service_booking_open_failure(uuid, text) from public, anon;

grant execute on function now.create_service_booking(uuid, uuid, text, text, text, text, text) to authenticated;
grant execute on function now.mark_service_booking_whatsapp_opened(uuid) to authenticated;
grant execute on function now.cancel_service_booking_open_failure(uuid, text) to authenticated;

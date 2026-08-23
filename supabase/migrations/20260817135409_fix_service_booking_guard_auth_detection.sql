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
begin
  -- Database/admin writes without a user JWT are left untouched.
  -- Any client request carrying an authenticated/anonymous-user JWT has
  -- auth.uid() and must pass the customer-write guard below.
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

    select nullif(btrim(whatsapp_number), '')
      into v_whatsapp
      from now.app_settings
     where singleton = true
     limit 1;

    if v_whatsapp is not null then
      new.whatsapp_number := v_whatsapp;
    end if;

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
    new.whatsapp_opened_at := coalesce(new.whatsapp_opened_at, now());
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

revoke all on function now.guard_service_booking_customer_write() from public, anon, authenticated;

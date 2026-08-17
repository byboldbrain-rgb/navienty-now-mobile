alter table now.app_settings
  add column if not exists service_booking_payment_proof_gate_enabled boolean not null default false;

alter table now.service_bookings
  add column if not exists payment_proof_required boolean not null default false;

create table if not exists now.service_booking_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  service_booking_id uuid not null references now.service_bookings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_method_id uuid not null references now.payment_methods(id) on delete restrict,
  amount_snapshot numeric(12,2) not null check (amount_snapshot >= 0),
  currency_code_snapshot text not null,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'rejected', 'cancelled')),
  storage_bucket text not null default 'now-service-booking-payment-proofs',
  storage_path text not null,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists service_booking_payment_proofs_one_open_idx
  on now.service_booking_payment_proofs(service_booking_id)
  where status in ('draft', 'submitted');

create index if not exists service_booking_payment_proofs_user_booking_idx
  on now.service_booking_payment_proofs(user_id, service_booking_id, created_at desc);

alter table now.service_booking_payment_proofs enable row level security;
revoke all on table now.service_booking_payment_proofs from public, anon, authenticated;
grant select, insert, update, delete on table now.service_booking_payment_proofs to service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'now-service-booking-payment-proofs',
  'now-service-booking-payment-proofs',
  false,
  8388608,
  array['image/jpeg','image/png','image/webp','application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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

create or replace function now.can_access_service_booking_payment_proof_object(
  p_object_name text,
  p_mode text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_proof_id uuid;
  v_expected_path text;
  v_proof now.service_booking_payment_proofs%rowtype;
begin
  if v_user_id is null then return false; end if;

  begin
    v_proof_id := split_part(coalesce(p_object_name, ''), '/', 2)::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  select proof.* into v_proof
    from now.service_booking_payment_proofs proof
   where proof.id = v_proof_id
     and proof.user_id = v_user_id;

  if not found then return false; end if;

  v_expected_path :=
    v_user_id::text || '/' || v_proof.id::text || '/payment-proof';

  if p_object_name is distinct from v_expected_path then return false; end if;

  if p_mode = 'insert' then
    return v_proof.status = 'draft';
  elsif p_mode = 'select' then
    return true;
  elsif p_mode = 'delete' then
    return v_proof.status in ('draft', 'rejected', 'cancelled');
  end if;

  return false;
end;
$$;

revoke all on function now.can_access_service_booking_payment_proof_object(text, text) from public, anon;
grant execute on function now.can_access_service_booking_payment_proof_object(text, text) to authenticated;

drop policy if exists customer_insert_own_service_booking_payment_proof on storage.objects;
create policy customer_insert_own_service_booking_payment_proof
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'now-service-booking-payment-proofs'
  and now.can_access_service_booking_payment_proof_object(name, 'insert')
);

drop policy if exists customer_select_own_service_booking_payment_proof on storage.objects;
create policy customer_select_own_service_booking_payment_proof
on storage.objects
for select
to authenticated
using (
  bucket_id = 'now-service-booking-payment-proofs'
  and now.can_access_service_booking_payment_proof_object(name, 'select')
);

drop policy if exists customer_delete_own_service_booking_payment_proof on storage.objects;
create policy customer_delete_own_service_booking_payment_proof
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'now-service-booking-payment-proofs'
  and now.can_access_service_booking_payment_proof_object(name, 'delete')
);

create or replace function now.create_service_booking_payment_proof(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking now.service_bookings%rowtype;
  v_proof now.service_booking_payment_proofs%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select booking.* into v_booking
    from now.service_bookings booking
   where booking.id = p_booking_id
     and booking.user_id = v_user_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'service_payment_proof_booking_not_found';
  end if;

  if not v_booking.payment_proof_required then
    raise exception using errcode = 'P0001', message = 'service_payment_proof_not_required';
  end if;

  if v_booking.status not in ('awaiting-whatsapp-send', 'waiting-confirmation') then
    if exists (
      select 1 from now.service_booking_payment_proofs proof
       where proof.service_booking_id = v_booking.id
         and proof.user_id = v_user_id
         and proof.status = 'approved'
    ) then
      select proof.* into v_proof
        from now.service_booking_payment_proofs proof
       where proof.service_booking_id = v_booking.id
         and proof.user_id = v_user_id
         and proof.status = 'approved'
       order by proof.reviewed_at desc nulls last, proof.created_at desc
       limit 1;

      return jsonb_build_object(
        'id', v_proof.id,
        'service_booking_id', v_proof.service_booking_id,
        'payment_method_id', v_proof.payment_method_id,
        'amount', v_proof.amount_snapshot,
        'currency_code', v_proof.currency_code_snapshot,
        'status', v_proof.status,
        'bucket', v_proof.storage_bucket,
        'path', v_proof.storage_path,
        'review_note', v_proof.review_note,
        'created_at', v_proof.created_at,
        'submitted_at', v_proof.submitted_at,
        'reviewed_at', v_proof.reviewed_at
      );
    end if;

    raise exception using errcode = 'P0001', message = 'service_payment_proof_booking_closed';
  end if;

  select proof.* into v_proof
    from now.service_booking_payment_proofs proof
   where proof.service_booking_id = v_booking.id
     and proof.user_id = v_user_id
     and proof.status in ('draft', 'submitted', 'approved')
   order by
     case proof.status when 'approved' then 0 when 'submitted' then 1 else 2 end,
     proof.created_at desc
   limit 1;

  if not found then
    insert into now.service_booking_payment_proofs (
      service_booking_id,
      user_id,
      payment_method_id,
      amount_snapshot,
      currency_code_snapshot,
      storage_path
    ) values (
      v_booking.id,
      v_user_id,
      v_booking.payment_method_id,
      v_booking.package_price,
      v_booking.currency_code,
      v_user_id::text || '/' || gen_random_uuid()::text
    ) returning * into v_proof;

    update now.service_booking_payment_proofs
       set storage_path =
         v_user_id::text || '/' || v_proof.id::text || '/payment-proof',
         updated_at = now()
     where id = v_proof.id
    returning * into v_proof;
  end if;

  return jsonb_build_object(
    'id', v_proof.id,
    'service_booking_id', v_proof.service_booking_id,
    'payment_method_id', v_proof.payment_method_id,
    'amount', v_proof.amount_snapshot,
    'currency_code', v_proof.currency_code_snapshot,
    'status', v_proof.status,
    'bucket', v_proof.storage_bucket,
    'path', v_proof.storage_path,
    'review_note', v_proof.review_note,
    'created_at', v_proof.created_at,
    'submitted_at', v_proof.submitted_at,
    'reviewed_at', v_proof.reviewed_at
  );
end;
$$;

create or replace function now.submit_service_booking_payment_proof(p_proof_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_proof now.service_booking_payment_proofs%rowtype;
  v_object_exists boolean;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select proof.* into v_proof
    from now.service_booking_payment_proofs proof
   where proof.id = p_proof_id
     and proof.user_id = v_user_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'service_payment_proof_not_found';
  end if;

  if v_proof.status = 'submitted' then
    return jsonb_build_object(
      'id', v_proof.id,
      'service_booking_id', v_proof.service_booking_id,
      'payment_method_id', v_proof.payment_method_id,
      'amount', v_proof.amount_snapshot,
      'currency_code', v_proof.currency_code_snapshot,
      'status', v_proof.status,
      'bucket', v_proof.storage_bucket,
      'path', v_proof.storage_path,
      'review_note', v_proof.review_note,
      'created_at', v_proof.created_at,
      'submitted_at', v_proof.submitted_at,
      'reviewed_at', v_proof.reviewed_at
    );
  end if;

  if v_proof.status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'service_payment_proof_not_editable';
  end if;

  select exists (
    select 1 from storage.objects object
     where object.bucket_id = v_proof.storage_bucket
       and object.name = v_proof.storage_path
  ) into v_object_exists;

  if not v_object_exists then
    raise exception using errcode = 'P0002', message = 'service_payment_proof_file_not_uploaded';
  end if;

  update now.service_booking_payment_proofs
     set status = 'submitted',
         submitted_at = coalesce(submitted_at, now()),
         updated_at = now()
   where id = v_proof.id
  returning * into v_proof;

  return jsonb_build_object(
    'id', v_proof.id,
    'service_booking_id', v_proof.service_booking_id,
    'payment_method_id', v_proof.payment_method_id,
    'amount', v_proof.amount_snapshot,
    'currency_code', v_proof.currency_code_snapshot,
    'status', v_proof.status,
    'bucket', v_proof.storage_bucket,
    'path', v_proof.storage_path,
    'review_note', v_proof.review_note,
    'created_at', v_proof.created_at,
    'submitted_at', v_proof.submitted_at,
    'reviewed_at', v_proof.reviewed_at
  );
end;
$$;

create or replace function now.get_my_service_booking_payment_proof(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_proof now.service_booking_payment_proofs%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select proof.* into v_proof
    from now.service_booking_payment_proofs proof
   where proof.service_booking_id = p_booking_id
     and proof.user_id = v_user_id
   order by proof.created_at desc
   limit 1;

  if not found then return null; end if;

  return jsonb_build_object(
    'id', v_proof.id,
    'service_booking_id', v_proof.service_booking_id,
    'payment_method_id', v_proof.payment_method_id,
    'amount', v_proof.amount_snapshot,
    'currency_code', v_proof.currency_code_snapshot,
    'status', v_proof.status,
    'bucket', v_proof.storage_bucket,
    'path', v_proof.storage_path,
    'review_note', v_proof.review_note,
    'created_at', v_proof.created_at,
    'submitted_at', v_proof.submitted_at,
    'reviewed_at', v_proof.reviewed_at
  );
end;
$$;

create or replace function now.get_service_booking_payment_proof(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin_context jsonb;
  v_proof now.service_booking_payment_proofs%rowtype;
begin
  v_admin_context := now.assert_admin_permission('view_orders');

  select proof.* into v_proof
    from now.service_booking_payment_proofs proof
   where proof.service_booking_id = p_booking_id
   order by proof.created_at desc
   limit 1;

  if not found then return null; end if;

  return jsonb_build_object(
    'id', v_proof.id,
    'service_booking_id', v_proof.service_booking_id,
    'payment_method_id', v_proof.payment_method_id,
    'amount', v_proof.amount_snapshot,
    'currency_code', v_proof.currency_code_snapshot,
    'status', v_proof.status,
    'bucket', v_proof.storage_bucket,
    'path', v_proof.storage_path,
    'review_note', v_proof.review_note,
    'created_at', v_proof.created_at,
    'submitted_at', v_proof.submitted_at,
    'reviewed_at', v_proof.reviewed_at
  );
end;
$$;

create or replace function now.review_service_booking_payment_proof(
  p_booking_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_context jsonb;
  v_booking now.service_bookings%rowtype;
  v_proof now.service_booking_payment_proofs%rowtype;
  v_decision text := lower(btrim(coalesce(p_decision, '')));
begin
  v_admin_context := now.assert_admin_permission('manage_orders');

  if v_decision not in ('approved', 'rejected') then
    raise exception using errcode = '22023', message = 'invalid_service_payment_proof_decision';
  end if;

  select booking.* into v_booking
    from now.service_bookings booking
   where booking.id = p_booking_id;

  if not found or not v_booking.payment_proof_required then
    raise exception using errcode = 'P0002', message = 'service_payment_proof_booking_not_found';
  end if;

  select proof.* into v_proof
    from now.service_booking_payment_proofs proof
   where proof.service_booking_id = v_booking.id
     and proof.status = 'submitted'
   order by proof.submitted_at desc nulls last, proof.created_at desc
   limit 1
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'submitted_service_payment_proof_not_found';
  end if;

  update now.service_booking_payment_proofs
     set status = v_decision,
         reviewed_at = now(),
         reviewed_by_user_id = auth.uid(),
         review_note = nullif(btrim(coalesce(p_note, '')), ''),
         updated_at = now()
   where id = v_proof.id
  returning * into v_proof;

  return jsonb_build_object(
    'id', v_proof.id,
    'service_booking_id', v_proof.service_booking_id,
    'status', v_proof.status,
    'review_note', v_proof.review_note,
    'reviewed_at', v_proof.reviewed_at
  );
end;
$$;

create or replace function now.enforce_service_booking_payment_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'confirmed'
     and old.status is distinct from new.status
     and coalesce(new.payment_proof_required, false)
     and not exists (
       select 1 from now.service_booking_payment_proofs proof
        where proof.service_booking_id = new.id
          and proof.status = 'approved'
     )
  then
    raise exception using errcode = 'P0001', message = 'service_payment_verification_required';
  end if;

  return new;
end;
$$;

revoke all on function now.enforce_service_booking_payment_transition() from public, anon, authenticated;

drop trigger if exists service_bookings_enforce_payment_transition on now.service_bookings;
create trigger service_bookings_enforce_payment_transition
before update of status
on now.service_bookings
for each row
execute function now.enforce_service_booking_payment_transition();

create or replace function now.can_admin_read_service_booking_payment_proof_object(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin_context jsonb;
  v_proof_id uuid;
  v_proof now.service_booking_payment_proofs%rowtype;
  v_expected_path text;
begin
  begin
    v_admin_context := now.assert_admin_permission('view_orders');
  exception when others then
    return false;
  end;

  if v_admin_context is null then return false; end if;

  begin
    v_proof_id := split_part(coalesce(p_object_name, ''), '/', 2)::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  select proof.* into v_proof
    from now.service_booking_payment_proofs proof
   where proof.id = v_proof_id;

  if not found then return false; end if;

  v_expected_path :=
    v_proof.user_id::text || '/' || v_proof.id::text || '/payment-proof';

  return p_object_name = v_expected_path;
end;
$$;

revoke all on function now.can_admin_read_service_booking_payment_proof_object(text) from public, anon;
grant execute on function now.can_admin_read_service_booking_payment_proof_object(text) to authenticated;

drop policy if exists authorized_admin_select_service_booking_payment_proof on storage.objects;
create policy authorized_admin_select_service_booking_payment_proof
on storage.objects
for select
to authenticated
using (
  bucket_id = 'now-service-booking-payment-proofs'
  and now.can_admin_read_service_booking_payment_proof_object(name)
);

revoke all on function now.create_service_booking_payment_proof(uuid) from public, anon;
revoke all on function now.submit_service_booking_payment_proof(uuid) from public, anon;
revoke all on function now.get_my_service_booking_payment_proof(uuid) from public, anon;
revoke all on function now.get_service_booking_payment_proof(uuid) from public, anon;
revoke all on function now.review_service_booking_payment_proof(uuid, text, text) from public, anon;

grant execute on function now.create_service_booking_payment_proof(uuid) to authenticated;
grant execute on function now.submit_service_booking_payment_proof(uuid) to authenticated;
grant execute on function now.get_my_service_booking_payment_proof(uuid) to authenticated;
grant execute on function now.get_service_booking_payment_proof(uuid) to authenticated;
grant execute on function now.review_service_booking_payment_proof(uuid, text, text) to authenticated;

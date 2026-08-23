alter table now.app_settings
  add column if not exists prescription_gate_enabled boolean not null default false,
  add column if not exists age_verification_gate_enabled boolean not null default false;

create table if not exists now.prescription_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references now.stores(id) on delete cascade,
  order_id uuid unique references now.orders(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'rejected', 'cancelled')),
  storage_bucket text not null default 'now-prescriptions',
  storage_path text not null,
  submitted_at timestamptz,
  attached_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists prescription_submissions_one_open_per_user_store_idx
  on now.prescription_submissions (user_id, store_id)
  where order_id is null and status in ('draft', 'submitted');

create index if not exists prescription_submissions_order_idx
  on now.prescription_submissions (order_id)
  where order_id is not null;

alter table now.prescription_submissions enable row level security;
revoke all on table now.prescription_submissions from public, anon, authenticated;
grant select, insert, update, delete on table now.prescription_submissions to service_role;

alter table now.orders
  add column if not exists prescription_required boolean not null default false,
  add column if not exists prescription_submission_id uuid references now.prescription_submissions(id) on delete set null,
  add column if not exists age_verification_required boolean not null default false,
  add column if not exists age_verified_at timestamptz,
  add column if not exists age_verified_by_user_id uuid references auth.users(id) on delete set null;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'now-prescriptions',
  'now-prescriptions',
  false,
  8388608,
  array['image/jpeg','image/png','image/webp','application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function now.can_access_prescription_object(
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
  v_submission_id uuid;
  v_expected_path text;
  v_submission now.prescription_submissions%rowtype;
begin
  if v_user_id is null then
    return false;
  end if;

  begin
    v_submission_id := split_part(coalesce(p_object_name, ''), '/', 2)::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  select s.*
    into v_submission
    from now.prescription_submissions s
   where s.id = v_submission_id
     and s.user_id = v_user_id;

  if not found then
    return false;
  end if;

  v_expected_path :=
    v_user_id::text || '/' || v_submission.id::text || '/prescription';

  if p_object_name is distinct from v_expected_path then
    return false;
  end if;

  if p_mode = 'insert' then
    return v_submission.status = 'draft'
      and v_submission.order_id is null;
  elsif p_mode = 'select' then
    return true;
  elsif p_mode = 'delete' then
    return v_submission.order_id is null
      and v_submission.status in ('draft', 'submitted', 'cancelled', 'rejected');
  end if;

  return false;
end;
$$;

revoke all on function now.can_access_prescription_object(text, text) from public, anon;
grant execute on function now.can_access_prescription_object(text, text) to authenticated;

drop policy if exists customer_insert_own_prescription on storage.objects;
create policy customer_insert_own_prescription
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'now-prescriptions'
  and now.can_access_prescription_object(name, 'insert')
);

drop policy if exists customer_select_own_prescription on storage.objects;
create policy customer_select_own_prescription
on storage.objects
for select
to authenticated
using (
  bucket_id = 'now-prescriptions'
  and now.can_access_prescription_object(name, 'select')
);

drop policy if exists customer_delete_own_prescription on storage.objects;
create policy customer_delete_own_prescription
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'now-prescriptions'
  and now.can_access_prescription_object(name, 'delete')
);

create or replace function now.create_prescription_submission(
  p_store_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_submission now.prescription_submissions%rowtype;
  v_category_slug text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select category.slug
    into v_category_slug
    from now.stores store
    join now.store_categories category on category.id = store.category_id
   where store.id = p_store_id
     and store.is_active = true;

  if not found or v_category_slug <> 'pharmacy' then
    raise exception using errcode = '22023', message = 'pharmacy_store_required';
  end if;

  select s.*
    into v_submission
    from now.prescription_submissions s
   where s.user_id = v_user_id
     and s.store_id = p_store_id
     and s.order_id is null
     and s.status in ('draft', 'submitted')
   order by s.created_at desc
   limit 1;

  if found then
    return jsonb_build_object(
      'id', v_submission.id,
      'store_id', v_submission.store_id,
      'status', v_submission.status,
      'bucket', v_submission.storage_bucket,
      'path', v_submission.storage_path,
      'created_at', v_submission.created_at,
      'submitted_at', v_submission.submitted_at
    );
  end if;

  insert into now.prescription_submissions (
    user_id, store_id, storage_path
  )
  values (
    v_user_id,
    p_store_id,
    v_user_id::text || '/' || gen_random_uuid()::text
  )
  returning * into v_submission;

  update now.prescription_submissions
     set storage_path =
       v_user_id::text || '/' || v_submission.id::text || '/prescription',
       updated_at = now()
   where id = v_submission.id
  returning * into v_submission;

  return jsonb_build_object(
    'id', v_submission.id,
    'store_id', v_submission.store_id,
    'status', v_submission.status,
    'bucket', v_submission.storage_bucket,
    'path', v_submission.storage_path,
    'created_at', v_submission.created_at,
    'submitted_at', v_submission.submitted_at
  );
end;
$$;

create or replace function now.submit_prescription_submission(
  p_submission_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_submission now.prescription_submissions%rowtype;
  v_object_exists boolean;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select s.*
    into v_submission
    from now.prescription_submissions s
   where s.id = p_submission_id
     and s.user_id = v_user_id
     and s.order_id is null
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'prescription_submission_not_found';
  end if;

  if v_submission.status = 'submitted' then
    return jsonb_build_object(
      'id', v_submission.id,
      'store_id', v_submission.store_id,
      'status', v_submission.status,
      'bucket', v_submission.storage_bucket,
      'path', v_submission.storage_path,
      'created_at', v_submission.created_at,
      'submitted_at', v_submission.submitted_at
    );
  end if;

  if v_submission.status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'prescription_submission_not_editable';
  end if;

  select exists (
    select 1
      from storage.objects object
     where object.bucket_id = v_submission.storage_bucket
       and object.name = v_submission.storage_path
  ) into v_object_exists;

  if not v_object_exists then
    raise exception using errcode = 'P0002', message = 'prescription_file_not_uploaded';
  end if;

  update now.prescription_submissions
     set status = 'submitted',
         submitted_at = coalesce(submitted_at, now()),
         updated_at = now()
   where id = v_submission.id
  returning * into v_submission;

  return jsonb_build_object(
    'id', v_submission.id,
    'store_id', v_submission.store_id,
    'status', v_submission.status,
    'bucket', v_submission.storage_bucket,
    'path', v_submission.storage_path,
    'created_at', v_submission.created_at,
    'submitted_at', v_submission.submitted_at
  );
end;
$$;

create or replace function now.get_my_prescription_submission(
  p_submission_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_submission now.prescription_submissions%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select s.*
    into v_submission
    from now.prescription_submissions s
   where s.id = p_submission_id
     and s.user_id = v_user_id;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_submission.id,
    'store_id', v_submission.store_id,
    'order_id', v_submission.order_id,
    'status', v_submission.status,
    'bucket', v_submission.storage_bucket,
    'path', v_submission.storage_path,
    'review_note', v_submission.review_note,
    'created_at', v_submission.created_at,
    'submitted_at', v_submission.submitted_at,
    'attached_at', v_submission.attached_at,
    'reviewed_at', v_submission.reviewed_at
  );
end;
$$;

create or replace function now.cancel_my_prescription_submission(
  p_submission_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  update now.prescription_submissions s
     set status = 'cancelled',
         updated_at = now()
   where s.id = p_submission_id
     and s.user_id = v_user_id
     and s.order_id is null
     and s.status in ('draft', 'submitted', 'rejected');

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function now.attach_prescription_to_order(
  p_order_id uuid,
  p_submission_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order now.orders%rowtype;
  v_submission now.prescription_submissions%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select o.*
    into v_order
    from now.orders o
   where o.id = p_order_id
     and o.user_id = v_user_id
     and o.status in ('awaiting_whatsapp_send', 'waiting_confirmation')
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'order_not_available_for_prescription';
  end if;

  select s.*
    into v_submission
    from now.prescription_submissions s
   where s.id = p_submission_id
     and s.user_id = v_user_id
     and s.store_id = v_order.store_id
     and s.order_id is null
     and s.status = 'submitted'
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'submitted_prescription_not_available';
  end if;

  update now.prescription_submissions
     set order_id = v_order.id,
         attached_at = now(),
         updated_at = now()
   where id = v_submission.id;

  update now.orders
     set prescription_required = true,
         prescription_submission_id = v_submission.id,
         updated_at = now()
   where id = v_order.id;

  return now.get_order_by_token(v_order.access_token);
end;
$$;

revoke all on function now.create_prescription_submission(uuid) from public, anon;
revoke all on function now.submit_prescription_submission(uuid) from public, anon;
revoke all on function now.get_my_prescription_submission(uuid) from public, anon;
revoke all on function now.cancel_my_prescription_submission(uuid) from public, anon;
revoke all on function now.attach_prescription_to_order(uuid, uuid) from public, anon;

grant execute on function now.create_prescription_submission(uuid) to authenticated;
grant execute on function now.submit_prescription_submission(uuid) to authenticated;
grant execute on function now.get_my_prescription_submission(uuid) to authenticated;
grant execute on function now.cancel_my_prescription_submission(uuid) to authenticated;
grant execute on function now.attach_prescription_to_order(uuid, uuid) to authenticated;

create or replace function now.apply_order_compliance_flags()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order now.orders%rowtype;
  v_submission now.prescription_submissions%rowtype;
  v_prescription_gate_enabled boolean := false;
begin
  if not coalesce(new.requires_prescription_snapshot, false)
     and not coalesce(new.is_age_restricted_snapshot, false) then
    return new;
  end if;

  select o.*
    into v_order
    from now.orders o
   where o.id = new.order_id
   for update;

  if not found then
    return new;
  end if;

  if coalesce(new.is_age_restricted_snapshot, false) then
    update now.orders
       set age_verification_required = true,
           updated_at = now()
     where id = v_order.id;
  end if;

  if not coalesce(new.requires_prescription_snapshot, false) then
    return new;
  end if;

  update now.orders
     set prescription_required = true,
         updated_at = now()
   where id = v_order.id;

  select coalesce(s.prescription_gate_enabled, false)
    into v_prescription_gate_enabled
    from now.app_settings s
   where s.singleton = true
   limit 1;

  if not v_prescription_gate_enabled then
    return new;
  end if;

  if v_order.user_id is null then
    raise exception using errcode = '42501', message = 'prescription_authenticated_user_required';
  end if;

  if v_order.prescription_submission_id is not null then
    return new;
  end if;

  select s.*
    into v_submission
    from now.prescription_submissions s
   where s.user_id = v_order.user_id
     and s.store_id = v_order.store_id
     and s.order_id is null
     and s.status = 'submitted'
   order by s.submitted_at desc nulls last, s.created_at desc
   limit 1
   for update skip locked;

  if not found then
    raise exception using errcode = 'P0001', message = 'prescription_required';
  end if;

  update now.prescription_submissions
     set order_id = v_order.id,
         attached_at = now(),
         updated_at = now()
   where id = v_submission.id;

  update now.orders
     set prescription_submission_id = v_submission.id,
         prescription_required = true,
         updated_at = now()
   where id = v_order.id;

  return new;
end;
$$;

revoke all on function now.apply_order_compliance_flags() from public, anon, authenticated;

drop trigger if exists order_items_apply_compliance_flags on now.order_items;
create trigger order_items_apply_compliance_flags
after insert on now.order_items
for each row
execute function now.apply_order_compliance_flags();

create or replace function now.enforce_order_compliance_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prescription_gate_enabled boolean := false;
  v_age_gate_enabled boolean := false;
  v_prescription_status text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select
    coalesce(s.prescription_gate_enabled, false),
    coalesce(s.age_verification_gate_enabled, false)
  into
    v_prescription_gate_enabled,
    v_age_gate_enabled
  from now.app_settings s
  where s.singleton = true
  limit 1;

  if new.status = 'confirmed'
     and v_prescription_gate_enabled
     and new.prescription_required then
    select p.status
      into v_prescription_status
      from now.prescription_submissions p
     where p.id = new.prescription_submission_id
       and p.order_id = new.id;

    if v_prescription_status is distinct from 'approved' then
      raise exception using errcode = 'P0001', message = 'prescription_approval_required';
    end if;
  end if;

  if new.status = 'delivered'
     and v_age_gate_enabled
     and new.age_verification_required
     and new.age_verified_at is null then
    raise exception using errcode = 'P0001', message = 'age_verification_required';
  end if;

  return new;
end;
$$;

revoke all on function now.enforce_order_compliance_transition() from public, anon, authenticated;

drop trigger if exists orders_enforce_compliance_transition on now.orders;
create trigger orders_enforce_compliance_transition
before update of status on now.orders
for each row
execute function now.enforce_order_compliance_transition();

create or replace function now.review_order_prescription(
  p_order_id uuid,
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
  v_order now.orders%rowtype;
  v_submission now.prescription_submissions%rowtype;
  v_decision text := lower(btrim(coalesce(p_decision, '')));
begin
  v_admin_context := now.assert_admin_permission('manage_orders');

  if v_decision not in ('approved', 'rejected') then
    raise exception using errcode = '22023', message = 'invalid_prescription_decision';
  end if;

  select o.*
    into v_order
    from now.orders o
   where o.id = p_order_id
   for update;

  if not found or not v_order.prescription_required then
    raise exception using errcode = 'P0002', message = 'prescription_order_not_found';
  end if;

  select p.*
    into v_submission
    from now.prescription_submissions p
   where p.id = v_order.prescription_submission_id
     and p.order_id = v_order.id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'prescription_submission_not_attached';
  end if;

  if v_submission.status not in ('submitted', 'approved', 'rejected') then
    raise exception using errcode = 'P0001', message = 'prescription_not_reviewable';
  end if;

  update now.prescription_submissions
     set status = v_decision,
         reviewed_at = now(),
         reviewed_by_user_id = auth.uid(),
         review_note = nullif(btrim(coalesce(p_note, '')), ''),
         updated_at = now()
   where id = v_submission.id;

  return now.get_admin_order(v_order.id);
end;
$$;

create or replace function now.verify_order_age(
  p_order_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_context jsonb;
  v_order now.orders%rowtype;
begin
  v_admin_context := now.assert_admin_permission('manage_orders');

  select o.*
    into v_order
    from now.orders o
   where o.id = p_order_id
   for update;

  if not found or not v_order.age_verification_required then
    raise exception using errcode = 'P0002', message = 'age_restricted_order_not_found';
  end if;

  update now.orders
     set age_verified_at = coalesce(age_verified_at, now()),
         age_verified_by_user_id = coalesce(age_verified_by_user_id, auth.uid()),
         updated_at = now()
   where id = v_order.id;

  insert into now.order_status_history (
    order_id,
    old_status,
    new_status,
    note,
    changed_by_type,
    changed_by_user_id,
    actor_reference
  ) values (
    v_order.id,
    v_order.status,
    v_order.status,
    coalesce(nullif(btrim(coalesce(p_note, '')), ''), 'Age/ID verification recorded.'),
    'admin',
    auth.uid(),
    'age_verification'
  );

  return now.get_admin_order(v_order.id);
end;
$$;

create or replace function now.get_order_compliance(
  p_order_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin_context jsonb;
  v_order now.orders%rowtype;
  v_submission now.prescription_submissions%rowtype;
begin
  v_admin_context := now.assert_admin_permission('view_orders');

  select o.*
    into v_order
    from now.orders o
   where o.id = p_order_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'order_not_found';
  end if;

  if v_order.prescription_submission_id is not null then
    select p.*
      into v_submission
      from now.prescription_submissions p
     where p.id = v_order.prescription_submission_id;
  end if;

  return jsonb_build_object(
    'order_id', v_order.id,
    'prescription_required', v_order.prescription_required,
    'prescription_submission_id', v_order.prescription_submission_id,
    'prescription_status', case when v_submission.id is null then null else v_submission.status end,
    'prescription_path', case when v_submission.id is null then null else v_submission.storage_path end,
    'prescription_review_note', case when v_submission.id is null then null else v_submission.review_note end,
    'age_verification_required', v_order.age_verification_required,
    'age_verified_at', v_order.age_verified_at
  );
end;
$$;

revoke all on function now.review_order_prescription(uuid, text, text) from public, anon;
revoke all on function now.verify_order_age(uuid, text) from public, anon;
revoke all on function now.get_order_compliance(uuid) from public, anon;

grant execute on function now.review_order_prescription(uuid, text, text) to authenticated;
grant execute on function now.verify_order_age(uuid, text) to authenticated;
grant execute on function now.get_order_compliance(uuid) to authenticated;

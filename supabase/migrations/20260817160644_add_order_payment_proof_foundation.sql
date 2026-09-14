alter table now.app_settings
  add column if not exists payment_proof_gate_enabled boolean not null default false;

alter table now.payment_methods
  add column if not exists requires_payment_proof boolean not null default false;

update now.payment_methods
set requires_payment_proof = true
where code in ('vodafone-cash', 'orange-cash', 'etisalat-cash', 'instapay');

alter table now.orders
  add column if not exists payment_proof_required boolean not null default false;

create table if not exists now.order_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references now.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_method_id uuid not null references now.payment_methods(id) on delete restrict,
  amount_snapshot numeric(12,2) not null check (amount_snapshot >= 0),
  currency_code_snapshot text not null,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'rejected', 'cancelled')),
  storage_bucket text not null default 'now-payment-proofs',
  storage_path text not null,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists order_payment_proofs_one_open_per_order_idx
  on now.order_payment_proofs(order_id)
  where status in ('draft', 'submitted');

create index if not exists order_payment_proofs_user_order_idx
  on now.order_payment_proofs(user_id, order_id, created_at desc);

alter table now.order_payment_proofs enable row level security;
revoke all on table now.order_payment_proofs from public, anon, authenticated;
grant select, insert, update, delete on table now.order_payment_proofs to service_role;

alter table now.orders
  add column if not exists payment_proof_id uuid references now.order_payment_proofs(id) on delete set null;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'now-payment-proofs',
  'now-payment-proofs',
  false,
  8388608,
  array['image/jpeg','image/png','image/webp','application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function now.apply_order_payment_policy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gate_enabled boolean := false;
  v_method_requires_proof boolean := false;
begin
  select coalesce(settings.payment_proof_gate_enabled, false)
    into v_gate_enabled
    from now.app_settings settings
   where settings.singleton = true
   limit 1;

  select coalesce(method.requires_payment_proof, false)
    into v_method_requires_proof
    from now.payment_methods method
   where method.id = new.payment_method_id;

  new.payment_proof_required :=
    coalesce(v_gate_enabled, false)
    and coalesce(v_method_requires_proof, false);

  return new;
end;
$$;

revoke all on function now.apply_order_payment_policy() from public, anon, authenticated;

drop trigger if exists orders_apply_payment_policy on now.orders;
create trigger orders_apply_payment_policy
before insert or update of payment_method_id
on now.orders
for each row
execute function now.apply_order_payment_policy();

create or replace function now.can_access_order_payment_proof_object(
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
  v_proof now.order_payment_proofs%rowtype;
begin
  if v_user_id is null then
    return false;
  end if;

  begin
    v_proof_id := split_part(coalesce(p_object_name, ''), '/', 2)::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  select proof.*
    into v_proof
    from now.order_payment_proofs proof
   where proof.id = v_proof_id
     and proof.user_id = v_user_id;

  if not found then
    return false;
  end if;

  v_expected_path :=
    v_user_id::text || '/' || v_proof.id::text || '/payment-proof';

  if p_object_name is distinct from v_expected_path then
    return false;
  end if;

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

revoke all on function now.can_access_order_payment_proof_object(text, text) from public, anon;
grant execute on function now.can_access_order_payment_proof_object(text, text) to authenticated;

drop policy if exists customer_insert_own_order_payment_proof on storage.objects;
create policy customer_insert_own_order_payment_proof
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'now-payment-proofs'
  and now.can_access_order_payment_proof_object(name, 'insert')
);

drop policy if exists customer_select_own_order_payment_proof on storage.objects;
create policy customer_select_own_order_payment_proof
on storage.objects
for select
to authenticated
using (
  bucket_id = 'now-payment-proofs'
  and now.can_access_order_payment_proof_object(name, 'select')
);

drop policy if exists customer_delete_own_order_payment_proof on storage.objects;
create policy customer_delete_own_order_payment_proof
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'now-payment-proofs'
  and now.can_access_order_payment_proof_object(name, 'delete')
);

create or replace function now.create_order_payment_proof(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order now.orders%rowtype;
  v_proof now.order_payment_proofs%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select orders.* into v_order
    from now.orders orders
   where orders.id = p_order_id
     and orders.user_id = v_user_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'payment_proof_order_not_found';
  end if;

  if not v_order.payment_proof_required then
    raise exception using errcode = 'P0001', message = 'payment_proof_not_required';
  end if;

  if v_order.payment_status = 'paid' then
    raise exception using errcode = 'P0001', message = 'payment_already_verified';
  end if;

  if v_order.status in ('cancelled', 'delivered') then
    raise exception using errcode = 'P0001', message = 'payment_proof_order_closed';
  end if;

  select proof.* into v_proof
    from now.order_payment_proofs proof
   where proof.order_id = v_order.id
     and proof.user_id = v_user_id
     and proof.status in ('draft', 'submitted')
   order by proof.created_at desc
   limit 1;

  if not found then
    insert into now.order_payment_proofs (
      order_id, user_id, payment_method_id, amount_snapshot,
      currency_code_snapshot, storage_path
    ) values (
      v_order.id, v_user_id, v_order.payment_method_id, v_order.total_amount,
      v_order.currency_code, v_user_id::text || '/' || gen_random_uuid()::text
    ) returning * into v_proof;

    update now.order_payment_proofs
       set storage_path = v_user_id::text || '/' || v_proof.id::text || '/payment-proof',
           updated_at = now()
     where id = v_proof.id
    returning * into v_proof;
  end if;

  return jsonb_build_object(
    'id', v_proof.id,
    'order_id', v_proof.order_id,
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

create or replace function now.submit_order_payment_proof(p_proof_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_proof now.order_payment_proofs%rowtype;
  v_object_exists boolean;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select proof.* into v_proof
    from now.order_payment_proofs proof
   where proof.id = p_proof_id
     and proof.user_id = v_user_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'payment_proof_not_found';
  end if;

  if v_proof.status = 'submitted' then
    return jsonb_build_object(
      'id', v_proof.id, 'order_id', v_proof.order_id,
      'payment_method_id', v_proof.payment_method_id,
      'amount', v_proof.amount_snapshot,
      'currency_code', v_proof.currency_code_snapshot,
      'status', v_proof.status, 'bucket', v_proof.storage_bucket,
      'path', v_proof.storage_path, 'review_note', v_proof.review_note,
      'created_at', v_proof.created_at, 'submitted_at', v_proof.submitted_at,
      'reviewed_at', v_proof.reviewed_at
    );
  end if;

  if v_proof.status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'payment_proof_not_editable';
  end if;

  select exists (
    select 1 from storage.objects object
     where object.bucket_id = v_proof.storage_bucket
       and object.name = v_proof.storage_path
  ) into v_object_exists;

  if not v_object_exists then
    raise exception using errcode = 'P0002', message = 'payment_proof_file_not_uploaded';
  end if;

  update now.order_payment_proofs
     set status = 'submitted',
         submitted_at = coalesce(submitted_at, now()),
         updated_at = now()
   where id = v_proof.id
  returning * into v_proof;

  update now.orders orders
     set payment_status = 'awaiting_payment'
   where orders.id = v_proof.order_id
     and orders.user_id = v_user_id
     and orders.payment_status <> 'paid';

  return jsonb_build_object(
    'id', v_proof.id, 'order_id', v_proof.order_id,
    'payment_method_id', v_proof.payment_method_id,
    'amount', v_proof.amount_snapshot,
    'currency_code', v_proof.currency_code_snapshot,
    'status', v_proof.status, 'bucket', v_proof.storage_bucket,
    'path', v_proof.storage_path, 'review_note', v_proof.review_note,
    'created_at', v_proof.created_at, 'submitted_at', v_proof.submitted_at,
    'reviewed_at', v_proof.reviewed_at
  );
end;
$$;

create or replace function now.get_my_order_payment_proof(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_proof now.order_payment_proofs%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select proof.* into v_proof
    from now.order_payment_proofs proof
   where proof.order_id = p_order_id
     and proof.user_id = v_user_id
   order by proof.created_at desc
   limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_proof.id, 'order_id', v_proof.order_id,
    'payment_method_id', v_proof.payment_method_id,
    'amount', v_proof.amount_snapshot,
    'currency_code', v_proof.currency_code_snapshot,
    'status', v_proof.status, 'bucket', v_proof.storage_bucket,
    'path', v_proof.storage_path, 'review_note', v_proof.review_note,
    'created_at', v_proof.created_at, 'submitted_at', v_proof.submitted_at,
    'reviewed_at', v_proof.reviewed_at
  );
end;
$$;

create or replace function now.cancel_my_order_payment_proof(p_proof_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_id uuid;
  v_updated integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  update now.order_payment_proofs proof
     set status = 'cancelled', updated_at = now()
   where proof.id = p_proof_id
     and proof.user_id = v_user_id
     and proof.status in ('draft', 'rejected')
  returning proof.order_id into v_order_id;

  get diagnostics v_updated = row_count;

  if v_updated = 1 then
    update now.orders orders
       set payment_status = 'pending'
     where orders.id = v_order_id
       and orders.user_id = v_user_id
       and orders.payment_status <> 'paid';
  end if;

  return v_updated = 1;
end;
$$;

create or replace function now.get_order_payment_proof(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin_context jsonb;
  v_proof now.order_payment_proofs%rowtype;
begin
  v_admin_context := now.assert_admin_permission('view_orders');

  select proof.* into v_proof
    from now.order_payment_proofs proof
   where proof.order_id = p_order_id
   order by proof.created_at desc
   limit 1;

  if not found then return null; end if;

  return jsonb_build_object(
    'id', v_proof.id, 'order_id', v_proof.order_id,
    'payment_method_id', v_proof.payment_method_id,
    'amount', v_proof.amount_snapshot,
    'currency_code', v_proof.currency_code_snapshot,
    'status', v_proof.status, 'bucket', v_proof.storage_bucket,
    'path', v_proof.storage_path, 'review_note', v_proof.review_note,
    'created_at', v_proof.created_at, 'submitted_at', v_proof.submitted_at,
    'reviewed_at', v_proof.reviewed_at
  );
end;
$$;

create or replace function now.review_order_payment_proof(
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
  v_proof now.order_payment_proofs%rowtype;
  v_decision text := lower(btrim(coalesce(p_decision, '')));
begin
  v_admin_context := now.assert_admin_permission('manage_orders');

  if v_decision not in ('approved', 'rejected') then
    raise exception using errcode = '22023', message = 'invalid_payment_proof_decision';
  end if;

  select orders.* into v_order
    from now.orders orders
   where orders.id = p_order_id
   for update;

  if not found or not v_order.payment_proof_required then
    raise exception using errcode = 'P0002', message = 'payment_proof_order_not_found';
  end if;

  select proof.* into v_proof
    from now.order_payment_proofs proof
   where proof.order_id = v_order.id
     and proof.status = 'submitted'
   order by proof.submitted_at desc nulls last, proof.created_at desc
   limit 1
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'submitted_payment_proof_not_found';
  end if;

  update now.order_payment_proofs
     set status = v_decision,
         reviewed_at = now(),
         reviewed_by_user_id = auth.uid(),
         review_note = nullif(btrim(coalesce(p_note, '')), ''),
         updated_at = now()
   where id = v_proof.id
  returning * into v_proof;

  update now.orders
     set payment_status = case when v_decision = 'approved' then 'paid' else 'pending' end,
         payment_proof_id = case when v_decision = 'approved' then v_proof.id else null end
   where id = v_order.id
  returning * into v_order;

  insert into now.order_status_history (
    order_id, old_status, new_status, note,
    changed_by_type, changed_by_user_id, actor_reference
  ) values (
    v_order.id, v_order.status, v_order.status,
    coalesce(
      nullif(btrim(coalesce(p_note, '')), ''),
      case when v_decision = 'approved'
        then 'Payment proof approved.'
        else 'Payment proof rejected.'
      end
    ),
    'admin', auth.uid(), 'payment_verification:' || v_decision
  );

  return now.get_admin_order(v_order.id);
end;
$$;

create or replace function now.enforce_order_payment_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'confirmed'
     and old.status is distinct from new.status
     and coalesce(new.payment_proof_required, false)
     and new.payment_status <> 'paid'
  then
    raise exception using errcode = 'P0001', message = 'payment_verification_required';
  end if;

  return new;
end;
$$;

revoke all on function now.enforce_order_payment_transition() from public, anon, authenticated;

drop trigger if exists orders_enforce_payment_transition on now.orders;
create trigger orders_enforce_payment_transition
before update of status
on now.orders
for each row
execute function now.enforce_order_payment_transition();

revoke all on function now.create_order_payment_proof(uuid) from public, anon;
revoke all on function now.submit_order_payment_proof(uuid) from public, anon;
revoke all on function now.get_my_order_payment_proof(uuid) from public, anon;
revoke all on function now.cancel_my_order_payment_proof(uuid) from public, anon;
revoke all on function now.get_order_payment_proof(uuid) from public, anon;
revoke all on function now.review_order_payment_proof(uuid, text, text) from public, anon;

grant execute on function now.create_order_payment_proof(uuid) to authenticated;
grant execute on function now.submit_order_payment_proof(uuid) to authenticated;
grant execute on function now.get_my_order_payment_proof(uuid) to authenticated;
grant execute on function now.cancel_my_order_payment_proof(uuid) to authenticated;
grant execute on function now.get_order_payment_proof(uuid) to authenticated;
grant execute on function now.review_order_payment_proof(uuid, text, text) to authenticated;

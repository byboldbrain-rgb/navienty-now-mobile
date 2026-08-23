alter table now.app_settings
  add column if not exists account_deletion_processing_days integer not null default 30
  check (account_deletion_processing_days between 1 and 90);

create table if not exists now.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  is_anonymous boolean not null default false,
  source text not null default 'navienty_now_mobile',
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'cancelled')),
  requested_at timestamptz not null default now(),
  target_completion_at timestamptz not null,
  processing_started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  retention_note text,
  updated_at timestamptz not null default now()
);

create unique index if not exists account_deletion_requests_one_active_per_user_idx
  on now.account_deletion_requests (user_id)
  where user_id is not null
    and status in ('pending', 'processing');

create index if not exists account_deletion_requests_status_requested_idx
  on now.account_deletion_requests (status, requested_at);

alter table now.account_deletion_requests enable row level security;
revoke all on table now.account_deletion_requests from public, anon, authenticated;
grant select, insert, update, delete on table now.account_deletion_requests to service_role;

create or replace function now.request_account_deletion()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_anonymous boolean := false;
  v_processing_days integer := 30;
  v_request now.account_deletion_requests%rowtype;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication_required';
  end if;

  select coalesce(u.is_anonymous, false)
    into v_is_anonymous
    from auth.users u
   where u.id = v_user_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'auth_user_not_found';
  end if;

  select coalesce(s.account_deletion_processing_days, 30)
    into v_processing_days
    from now.app_settings s
   where s.singleton = true
   limit 1;

  select r.*
    into v_request
    from now.account_deletion_requests r
   where r.user_id = v_user_id
     and r.status in ('pending', 'processing')
   order by r.requested_at desc
   limit 1;

  if found then
    return jsonb_build_object(
      'id', v_request.id,
      'status', v_request.status,
      'is_anonymous', v_request.is_anonymous,
      'requested_at', v_request.requested_at,
      'target_completion_at', v_request.target_completion_at
    );
  end if;

  insert into now.account_deletion_requests (
    user_id,
    is_anonymous,
    source,
    status,
    requested_at,
    target_completion_at,
    updated_at
  ) values (
    v_user_id,
    v_is_anonymous,
    'navienty_now_mobile',
    'pending',
    now(),
    now() + make_interval(days => v_processing_days),
    now()
  )
  returning * into v_request;

  return jsonb_build_object(
    'id', v_request.id,
    'status', v_request.status,
    'is_anonymous', v_request.is_anonymous,
    'requested_at', v_request.requested_at,
    'target_completion_at', v_request.target_completion_at
  );
end;
$$;

create or replace function now.get_my_account_deletion_request()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_request now.account_deletion_requests%rowtype;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication_required';
  end if;

  select r.*
    into v_request
    from now.account_deletion_requests r
   where r.user_id = v_user_id
   order by r.requested_at desc
   limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_request.id,
    'status', v_request.status,
    'is_anonymous', v_request.is_anonymous,
    'requested_at', v_request.requested_at,
    'target_completion_at', v_request.target_completion_at,
    'completed_at', v_request.completed_at,
    'cancelled_at', v_request.cancelled_at
  );
end;
$$;

create or replace function now.cancel_my_account_deletion_request()
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
    raise exception using
      errcode = '42501',
      message = 'authentication_required';
  end if;

  update now.account_deletion_requests r
     set status = 'cancelled',
         cancelled_at = now(),
         updated_at = now()
   where r.user_id = v_user_id
     and r.status = 'pending';

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function now.request_account_deletion() from public, anon;
revoke all on function now.get_my_account_deletion_request() from public, anon;
revoke all on function now.cancel_my_account_deletion_request() from public, anon;

grant execute on function now.request_account_deletion() to authenticated;
grant execute on function now.get_my_account_deletion_request() to authenticated;
grant execute on function now.cancel_my_account_deletion_request() to authenticated;

create table if not exists now.customer_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('android', 'ios')),
  project_id text null,
  app_version text null,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_push_subscriptions_token_unique unique (expo_push_token)
);

alter table now.customer_push_subscriptions enable row level security;

revoke all on table now.customer_push_subscriptions from anon, authenticated;

create index if not exists customer_push_subscriptions_user_active_idx
  on now.customer_push_subscriptions (user_id, is_active)
  where is_active = true;

create or replace function now.upsert_customer_push_subscription(
  p_expo_push_token text,
  p_platform text,
  p_project_id text default null,
  p_app_version text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_token text := btrim(coalesce(p_expo_push_token, ''));
  v_platform text := lower(btrim(coalesce(p_platform, '')));
  v_project_id text := nullif(btrim(coalesce(p_project_id, '')), '');
  v_app_version text := nullif(btrim(coalesce(p_app_version, '')), '');
  v_subscription_id uuid;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication_required';
  end if;

  if length(v_token) < 20 or length(v_token) > 512 then
    raise exception using
      errcode = '22023',
      message = 'invalid_expo_push_token';
  end if;

  if v_platform not in ('android', 'ios') then
    raise exception using
      errcode = '22023',
      message = 'invalid_push_platform';
  end if;

  insert into now.customer_push_subscriptions (
    user_id,
    expo_push_token,
    platform,
    project_id,
    app_version,
    is_active,
    last_seen_at,
    updated_at
  )
  values (
    v_user_id,
    v_token,
    v_platform,
    v_project_id,
    v_app_version,
    true,
    now(),
    now()
  )
  on conflict (expo_push_token)
  do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    project_id = excluded.project_id,
    app_version = excluded.app_version,
    is_active = true,
    last_seen_at = now(),
    updated_at = now()
  returning id into v_subscription_id;

  return v_subscription_id;
end;
$$;

revoke all on function now.upsert_customer_push_subscription(text, text, text, text) from public, anon;
grant execute on function now.upsert_customer_push_subscription(text, text, text, text) to authenticated;

create or replace function now.disable_customer_push_subscription(
  p_expo_push_token text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_token text := btrim(coalesce(p_expo_push_token, ''));
  v_updated boolean := false;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication_required';
  end if;

  update now.customer_push_subscriptions
  set
    is_active = false,
    updated_at = now()
  where
    user_id = v_user_id
    and expo_push_token = v_token
    and is_active = true;

  v_updated := found;
  return v_updated;
end;
$$;

revoke all on function now.disable_customer_push_subscription(text) from public, anon;
grant execute on function now.disable_customer_push_subscription(text) to authenticated;

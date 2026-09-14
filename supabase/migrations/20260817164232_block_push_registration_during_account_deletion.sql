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

  if exists (
    select 1
    from now.account_deletion_requests request_row
    where request_row.user_id = v_user_id
      and request_row.status = 'processing'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'account_deletion_processing';
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

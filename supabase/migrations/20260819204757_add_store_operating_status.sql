create or replace function now.get_store_open_status(
  p_store_id uuid,
  p_at timestamptz default now()
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = now, pg_temp
as $$
declare
  v_store now.stores%rowtype;
  v_timezone text := 'Africa/Cairo';
  v_local_ts timestamp without time zone;
  v_local_day smallint;
  v_local_time time without time zone;
  v_previous_day smallint;
  v_schedule_count integer := 0;
  v_today now.store_business_hours%rowtype;
  v_previous now.store_business_hours%rowtype;
  v_is_open boolean := false;
begin
  select *
  into v_store
  from now.stores
  where id = p_store_id
    and is_active = true;

  if not found then
    return jsonb_build_object(
      'is_open_now', false,
      'is_closed', true,
      'has_business_hours', false,
      'reason', 'store_not_available',
      'timezone', v_timezone
    );
  end if;

  select coalesce(nullif(btrim(timezone), ''), 'Africa/Cairo')
  into v_timezone
  from now.app_settings
  where singleton = true;

  v_timezone := coalesce(v_timezone, 'Africa/Cairo');

  if coalesce(v_store.is_manually_closed, false) then
    return jsonb_build_object(
      'is_open_now', false,
      'is_closed', true,
      'has_business_hours', exists(
        select 1
        from now.store_business_hours
        where store_id = p_store_id
      ),
      'reason', 'manual_closed',
      'timezone', v_timezone
    );
  end if;

  select count(*)
  into v_schedule_count
  from now.store_business_hours
  where store_id = p_store_id;

  if v_schedule_count = 0 then
    return jsonb_build_object(
      'is_open_now', true,
      'is_closed', false,
      'has_business_hours', false,
      'reason', 'hours_not_configured',
      'timezone', v_timezone
    );
  end if;

  v_local_ts := p_at at time zone v_timezone;
  v_local_day := extract(dow from v_local_ts)::smallint;
  v_local_time := v_local_ts::time;
  v_previous_day := ((v_local_day + 6) % 7)::smallint;

  select *
  into v_today
  from now.store_business_hours
  where store_id = p_store_id
    and day_of_week = v_local_day;

  if found and v_today.is_open then
    if v_today.open_time = v_today.close_time then
      v_is_open := true;
    elsif v_today.open_time < v_today.close_time then
      v_is_open :=
        v_local_time >= v_today.open_time
        and v_local_time < v_today.close_time;
    else
      v_is_open := v_local_time >= v_today.open_time;
    end if;
  end if;

  if not v_is_open then
    select *
    into v_previous
    from now.store_business_hours
    where store_id = p_store_id
      and day_of_week = v_previous_day;

    if found
       and v_previous.is_open
       and v_previous.open_time > v_previous.close_time
       and v_local_time < v_previous.close_time
    then
      v_is_open := true;
    end if;
  end if;

  return jsonb_build_object(
    'is_open_now', v_is_open,
    'is_closed', not v_is_open,
    'has_business_hours', true,
    'reason', case
      when v_is_open then 'open'
      else 'outside_business_hours'
    end,
    'timezone', v_timezone,
    'local_day_of_week', v_local_day,
    'local_time', to_char(v_local_time, 'HH24:MI:SS')
  );
end;
$$;

revoke all on function now.get_store_open_status(uuid, timestamptz) from public;
revoke all on function now.get_store_open_status(uuid, timestamptz) from anon;
revoke all on function now.get_store_open_status(uuid, timestamptz) from authenticated;
grant execute on function now.get_store_open_status(uuid, timestamptz) to service_role;

create or replace function now.get_store_operating_statuses(
  p_store_ids uuid[]
)
returns jsonb
language sql
stable
security definer
set search_path = now, pg_temp
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('store_id', s.id)
      || now.get_store_open_status(s.id, now())
      order by s.id
    ),
    '[]'::jsonb
  )
  from now.stores as s
  where s.is_active = true
    and s.id = any(coalesce(p_store_ids, '{}'::uuid[]));
$$;

revoke all on function now.get_store_operating_statuses(uuid[]) from public;
grant execute on function now.get_store_operating_statuses(uuid[]) to anon, authenticated, service_role;

create or replace function now.enforce_store_open_for_mobile_order()
returns trigger
language plpgsql
security definer
set search_path = now, pg_temp
as $$
declare
  v_status jsonb;
begin
  if new.store_id is null
     or coalesce(new.source, '') <> 'mobile_whatsapp'
  then
    return new;
  end if;

  v_status := now.get_store_open_status(new.store_id, now());

  if coalesce((v_status ->> 'is_open_now')::boolean, true) = false then
    raise exception using
      errcode = 'P0001',
      message = 'store_closed',
      detail = v_status::text;
  end if;

  return new;
end;
$$;

revoke all on function now.enforce_store_open_for_mobile_order() from public;
revoke all on function now.enforce_store_open_for_mobile_order() from anon;
revoke all on function now.enforce_store_open_for_mobile_order() from authenticated;

DROP TRIGGER IF EXISTS now_orders_enforce_store_open ON now.orders;

create trigger now_orders_enforce_store_open
before insert on now.orders
for each row
execute function now.enforce_store_open_for_mobile_order();

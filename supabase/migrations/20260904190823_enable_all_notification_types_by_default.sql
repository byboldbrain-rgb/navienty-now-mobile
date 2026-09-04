-- Enable every notification category by default while preserving explicit opt-outs.
--
-- Navienty Now notification preferences live in the `now` schema.

alter table now.customer_notification_preferences
  alter column order_updates_enabled set default true,
  alter column service_updates_enabled set default true,
  alter column account_updates_enabled set default true,
  alter column offers_enabled set default true,
  alter column quiet_hours_enabled set default false;

-- Rows that are still on the old implicit offers=false default should inherit
-- the new default-on behavior. Explicit opt-outs are preserved.
update now.customer_notification_preferences
set offers_enabled = true,
    updated_at = now()
where offers_enabled = false
  and marketing_opted_out_at is null;

create or replace function now.get_customer_notification_delivery_policy(
  p_user_id uuid,
  p_category text
)
returns table(enabled boolean, defer_until timestamp with time zone)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_category text := lower(btrim(coalesce(p_category, 'general')));
  v_pref now.customer_notification_preferences%rowtype;
  v_enabled boolean := true;
  v_local_now timestamp without time zone;
  v_local_time time without time zone;
  v_target_local timestamp without time zone;
begin
  select * into v_pref
  from now.customer_notification_preferences p
  where p.user_id = p_user_id;

  if not found then
    v_pref.user_id := p_user_id;
    v_pref.order_updates_enabled := true;
    v_pref.service_updates_enabled := true;
    v_pref.account_updates_enabled := true;
    v_pref.offers_enabled := true;
    v_pref.quiet_hours_enabled := false;
    v_pref.timezone := 'Africa/Cairo';
  end if;

  v_enabled := case v_category
    when 'orders' then coalesce(v_pref.order_updates_enabled, true)
    when 'service' then coalesce(v_pref.service_updates_enabled, true)
    when 'account' then coalesce(v_pref.account_updates_enabled, true)
    when 'offers' then coalesce(v_pref.offers_enabled, true)
    else true
  end;

  if not v_enabled then
    return query select false, null::timestamptz;
    return;
  end if;

  if v_category = 'offers'
     and coalesce(v_pref.quiet_hours_enabled, false)
     and v_pref.quiet_hours_start is not null
     and v_pref.quiet_hours_end is not null
  then
    v_local_now := now() at time zone coalesce(v_pref.timezone, 'Africa/Cairo');
    v_local_time := v_local_now::time;

    if v_pref.quiet_hours_start < v_pref.quiet_hours_end then
      if v_local_time >= v_pref.quiet_hours_start
         and v_local_time < v_pref.quiet_hours_end
      then
        v_target_local := v_local_now::date + v_pref.quiet_hours_end;
      end if;
    elsif v_pref.quiet_hours_start > v_pref.quiet_hours_end then
      if v_local_time >= v_pref.quiet_hours_start then
        v_target_local := (v_local_now::date + 1) + v_pref.quiet_hours_end;
      elsif v_local_time < v_pref.quiet_hours_end then
        v_target_local := v_local_now::date + v_pref.quiet_hours_end;
      end if;
    else
      v_target_local := (v_local_now + interval '24 hours')::date + v_pref.quiet_hours_end;
    end if;

    if v_target_local is not null then
      return query
      select true, v_target_local at time zone coalesce(v_pref.timezone, 'Africa/Cairo');
      return;
    end if;
  end if;

  return query select true, null::timestamptz;
end;
$function$;

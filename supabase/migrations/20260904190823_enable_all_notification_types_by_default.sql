-- Enable every notification category by default for newly-created
-- notification preference rows while preserving existing users' choices.
--
-- The notification-preferences schema currently lives in the deployed
-- Supabase project and is consumed through get_my_notification_preferences /
-- update_my_notification_preferences. This migration intentionally discovers
-- the backing preferences table by its stable column contract instead of
-- hard-coding a relation name, so it remains compatible with the existing
-- production schema.

do $$
declare
  preferences_table regclass;
begin
  select c.oid::regclass
    into preferences_table
  from pg_catalog.pg_class as c
  join pg_catalog.pg_namespace as n
    on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and exists (
      select 1
      from pg_catalog.pg_attribute as a
      where a.attrelid = c.oid
        and a.attname = 'order_updates_enabled'
        and a.attnum > 0
        and not a.attisdropped
    )
    and exists (
      select 1
      from pg_catalog.pg_attribute as a
      where a.attrelid = c.oid
        and a.attname = 'service_updates_enabled'
        and a.attnum > 0
        and not a.attisdropped
    )
    and exists (
      select 1
      from pg_catalog.pg_attribute as a
      where a.attrelid = c.oid
        and a.attname = 'account_updates_enabled'
        and a.attnum > 0
        and not a.attisdropped
    )
    and exists (
      select 1
      from pg_catalog.pg_attribute as a
      where a.attrelid = c.oid
        and a.attname = 'offers_enabled'
        and a.attnum > 0
        and not a.attisdropped
    )
    and exists (
      select 1
      from pg_catalog.pg_attribute as a
      where a.attrelid = c.oid
        and a.attname = 'quiet_hours_enabled'
        and a.attnum > 0
        and not a.attisdropped
    )
  order by c.oid
  limit 1;

  if preferences_table is null then
    raise exception
      'Notification preferences table was not found. Expected the order_updates_enabled, service_updates_enabled, account_updates_enabled, offers_enabled, and quiet_hours_enabled columns.';
  end if;

  execute format(
    'alter table %s
       alter column order_updates_enabled set default true,
       alter column service_updates_enabled set default true,
       alter column account_updates_enabled set default true,
       alter column offers_enabled set default true,
       alter column quiet_hours_enabled set default false',
    preferences_table
  );
end
$$;

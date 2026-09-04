create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.get_app_launch_gate_internal()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'maintenance_mode', s.maintenance_mode,
    'maintenance_message_ar', s.maintenance_message_ar,
    'minimum_supported_app_version', s.minimum_supported_app_version,
    'support_whatsapp', s.support_whatsapp
  )
  from now.app_settings s
  where s.singleton = true;
$function$;

revoke execute
on function private.get_app_launch_gate_internal()
from public;

grant execute
on function private.get_app_launch_gate_internal()
to anon, authenticated;

create or replace function now.get_app_launch_gate()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.get_app_launch_gate_internal();
$function$;

revoke execute
on function now.get_app_launch_gate()
from public;

grant execute
on function now.get_app_launch_gate()
to anon, authenticated;

comment on function private.get_app_launch_gate_internal()
is 'Internal privileged reader for public launch-critical application settings.';

comment on function now.get_app_launch_gate()
is 'Lightweight public launch-gate settings endpoint. Returns only launch-critical settings.';

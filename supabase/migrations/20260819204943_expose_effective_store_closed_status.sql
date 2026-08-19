do $do$
declare
  v_function_name text;
  v_oid oid;
  v_definition text;
  v_updated_definition text;
begin
  foreach v_function_name in array array['list_stores', 'get_store_catalog']
  loop
    select p.oid
    into v_oid
    from pg_proc as p
    join pg_namespace as n
      on n.oid = p.pronamespace
    where n.nspname = 'now'
      and p.proname = v_function_name
    order by p.oid
    limit 1;

    if v_oid is null then
      raise exception 'required function now.% was not found', v_function_name;
    end if;

    v_definition := pg_get_functiondef(v_oid);

    if regexp_count(
      v_definition,
      E'''is_manually_closed'',\\s*s\\.is_manually_closed'
    ) <> 1 then
      raise exception 'unexpected definition for now.%: is_manually_closed mapping was not found exactly once', v_function_name;
    end if;

    v_updated_definition := regexp_replace(
      v_definition,
      E'''is_manually_closed'',\\s*s\\.is_manually_closed',
      $replacement$'is_manually_closed',
        coalesce(
          (now.get_store_open_status(s.id, now()) ->> 'is_closed')::boolean,
          s.is_manually_closed
        ),
      'is_manual_override_closed',
        s.is_manually_closed$replacement$
    );

    execute v_updated_definition;
  end loop;
end;
$do$;

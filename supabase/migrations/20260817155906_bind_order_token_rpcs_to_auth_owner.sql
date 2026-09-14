do $migration$
declare
  v_oid oid;
  v_definition text;
  v_hardened text;
begin
  select p.oid
    into v_oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'now'
     and p.proname = 'get_order_by_token'
     and pg_get_function_identity_arguments(p.oid) = 'p_access_token uuid';

  if v_oid is null then
    raise exception 'now.get_order_by_token(uuid) not found';
  end if;

  v_definition := pg_get_functiondef(v_oid);

  if position('o.user_id = auth.uid()' in v_definition) = 0 then
    v_hardened := regexp_replace(
      v_definition,
      'where o\.access_token\s*=\s*p_access_token;',
      E'where o.access_token = p_access_token\n    and auth.uid() is not null\n    and (o.user_id = auth.uid() or o.user_id is null);',
      'i'
    );

    if v_hardened = v_definition then
      raise exception 'Unable to patch now.get_order_by_token ownership guard';
    end if;

    execute v_hardened;
  end if;

  select p.oid
    into v_oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'now'
     and p.proname = 'confirm_whatsapp_order_sent'
     and pg_get_function_identity_arguments(p.oid) = 'p_access_token uuid';

  if v_oid is null then
    raise exception 'now.confirm_whatsapp_order_sent(uuid) not found';
  end if;

  v_definition := pg_get_functiondef(v_oid);

  if position('user_id = auth.uid()' in v_definition) = 0 then
    v_hardened := regexp_replace(
      v_definition,
      'where access_token\s*=\s*p_access_token\s*for update;',
      E'where access_token = p_access_token\n    and auth.uid() is not null\n    and (user_id = auth.uid() or user_id is null)\n  for update;',
      'i'
    );

    if v_hardened = v_definition then
      raise exception 'Unable to patch now.confirm_whatsapp_order_sent ownership guard';
    end if;

    execute v_hardened;
  end if;

  select p.oid
    into v_oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'now'
     and p.proname = 'cancel_pending_whatsapp_order'
     and pg_get_function_identity_arguments(p.oid) = 'p_access_token uuid, p_reason text';

  if v_oid is null then
    raise exception 'now.cancel_pending_whatsapp_order(uuid,text) not found';
  end if;

  v_definition := pg_get_functiondef(v_oid);

  if position('user_id = auth.uid()' in v_definition) = 0 then
    v_hardened := regexp_replace(
      v_definition,
      'where access_token\s*=\s*p_access_token\s*for update;',
      E'where access_token = p_access_token\n    and auth.uid() is not null\n    and (user_id = auth.uid() or user_id is null)\n  for update;',
      'i'
    );

    if v_hardened = v_definition then
      raise exception 'Unable to patch now.cancel_pending_whatsapp_order ownership guard';
    end if;

    execute v_hardened;
  end if;
end
$migration$;

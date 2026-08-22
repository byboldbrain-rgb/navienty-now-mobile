create or replace function now.attach_prescription_to_order(
  p_order_id uuid,
  p_submission_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order now.orders%rowtype;
  v_submission now.prescription_submissions%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select o.*
    into v_order
    from now.orders o
   where o.id = p_order_id
     and o.user_id = v_user_id
     and o.status in ('awaiting_whatsapp_send', 'waiting_confirmation')
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'order_not_available_for_prescription';
  end if;

  if v_order.prescription_submission_id = p_submission_id then
    return now.get_order_by_token(v_order.access_token);
  end if;

  if v_order.prescription_submission_id is not null then
    raise exception using errcode = 'P0001', message = 'order_already_has_prescription';
  end if;

  select s.*
    into v_submission
    from now.prescription_submissions s
   where s.id = p_submission_id
     and s.user_id = v_user_id
     and s.store_id = v_order.store_id
     and (
       (s.order_id is null and s.status = 'submitted')
       or (s.order_id = v_order.id and s.status in ('submitted', 'approved', 'rejected'))
     )
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'submitted_prescription_not_available';
  end if;

  if v_submission.order_id is null then
    update now.prescription_submissions
       set order_id = v_order.id,
           attached_at = coalesce(attached_at, now()),
           updated_at = now()
     where id = v_submission.id;
  end if;

  update now.orders
     set prescription_required = true,
         prescription_submission_id = v_submission.id,
         updated_at = now()
   where id = v_order.id;

  return now.get_order_by_token(v_order.access_token);
end;
$$;

revoke all on function now.attach_prescription_to_order(uuid, uuid) from public, anon;
grant execute on function now.attach_prescription_to_order(uuid, uuid) to authenticated;

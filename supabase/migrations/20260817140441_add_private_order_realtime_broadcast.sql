create policy "customer_receive_own_order_broadcasts"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and realtime.topic() =
    'customer:' || (select auth.uid())::text || ':orders'
);

create or replace function now.broadcast_customer_order_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is null then
    return null;
  end if;

  perform realtime.send(
    jsonb_build_object(
      'order_id', new.id,
      'status', new.status,
      'payment_status', new.payment_status,
      'updated_at', new.updated_at
    ),
    'order_updated',
    'customer:' || new.user_id::text || ':orders',
    true
  );

  return null;
end;
$$;

revoke all on function now.broadcast_customer_order_update() from public, anon, authenticated;

drop trigger if exists broadcast_customer_order_update_trigger on now.orders;
create trigger broadcast_customer_order_update_trigger
after update of status, payment_status on now.orders
for each row
when (
  old.status is distinct from new.status
  or old.payment_status is distinct from new.payment_status
)
execute function now.broadcast_customer_order_update();

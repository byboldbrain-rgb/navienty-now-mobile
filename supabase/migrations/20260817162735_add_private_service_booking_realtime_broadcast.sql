create or replace function now.broadcast_customer_service_booking_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null
     and new.status is distinct from old.status
  then
    perform realtime.send(
      jsonb_build_object(
        'service_booking_id', new.id,
        'status', new.status,
        'updated_at', new.updated_at
      ),
      'service_booking_updated',
      'customer:' || new.user_id::text || ':service-bookings',
      true
    );
  end if;

  return new;
end;
$$;

revoke all on function now.broadcast_customer_service_booking_update() from public;
revoke all on function now.broadcast_customer_service_booking_update() from anon;
revoke all on function now.broadcast_customer_service_booking_update() from authenticated;

drop trigger if exists service_bookings_broadcast_customer_update on now.service_bookings;
create trigger service_bookings_broadcast_customer_update
after update of status
on now.service_bookings
for each row
execute function now.broadcast_customer_service_booking_update();

drop policy if exists customer_receive_own_service_booking_broadcasts on realtime.messages;
create policy customer_receive_own_service_booking_broadcasts
on realtime.messages
for select
to authenticated
using (
  extension = 'broadcast'
  and realtime.topic() = (
    'customer:' || (select auth.uid())::text || ':service-bookings'
  )
);

-- Evaluate auth.uid() once per statement rather than once per row while
-- preserving the exact existing owner-only service-booking semantics.

alter policy service_bookings_select_own
  on now.service_bookings
  using (user_id = (select auth.uid()));

alter policy service_bookings_insert_own
  on now.service_bookings
  with check (user_id = (select auth.uid()));

alter policy service_bookings_update_own
  on now.service_bookings
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

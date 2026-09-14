alter function now.guard_service_booking_customer_write() security definer;
revoke all on function now.guard_service_booking_customer_write() from public, anon, authenticated;

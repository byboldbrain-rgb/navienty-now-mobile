-- Keep the notification worker's runtime access reproducible in migrations.
-- The dispatch worker reads active subscriptions and may deactivate invalid tokens.
grant select, update
on table now.customer_push_subscriptions
to service_role;

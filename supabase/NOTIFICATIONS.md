# Navienty Now customer notifications

The customer notification pipeline uses:

- `now.customer_push_subscriptions` for Expo push tokens.
- `now.customer_notification_outbox` for idempotent order/service-booking events.
- `now.customer_notification_tickets` for Expo ticket/receipt tracking.
- `supabase/functions/dispatch-customer-notifications` as the delivery worker.
- `pg_cron` + `pg_net` to invoke the worker once per minute.

## Required Vault secrets

The scheduled worker expects these Supabase Vault secret **names** to exist:

- `navienty_now_project_url` — the project base URL.
- `navienty_now_legacy_anon_key` — a JWT-compatible anon key used only to invoke the JWT-protected Edge Function from `pg_cron`.

Never commit either secret value to the repository.

## Optional Edge Function secret

If Expo Push Security is enabled, configure `EXPO_ACCESS_TOKEN` as an Edge Function secret. The worker automatically sends it as a Bearer token when present.

## Delivery behavior

Status changes enqueue an event inside the same database transaction, but network delivery happens asynchronously in the Edge Function. This keeps order state transitions independent from Expo Push availability.

The worker retries transient failures, avoids re-sending to subscriptions that already received an Expo ticket for the same outbox event, checks receipts after a delay, and disables subscriptions that Expo reports as `DeviceNotRegistered`.

create table if not exists now.customer_notification_tickets (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null references now.customer_notification_outbox(id) on delete cascade,
  push_subscription_id uuid not null references now.customer_push_subscriptions(id) on delete cascade,
  expo_ticket_id text not null unique,
  status text not null default 'pending' check (status in ('pending', 'ok', 'error')),
  error_code text,
  error_message text,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_notification_tickets_pending_idx
  on now.customer_notification_tickets (created_at)
  where status = 'pending';

alter table now.customer_notification_tickets enable row level security;
revoke all on table now.customer_notification_tickets from public, anon, authenticated;
grant select, insert, update, delete on table now.customer_notification_tickets to service_role;

create or replace function now.claim_customer_notification_batch(p_limit integer default 25)
returns setof now.customer_notification_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select o.id
    from now.customer_notification_outbox o
    where o.attempt_count < 6
      and (
        (o.status in ('pending', 'failed') and o.next_attempt_at <= now())
        or (o.status = 'processing' and o.locked_at < now() - interval '5 minutes')
      )
    order by o.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  )
  update now.customer_notification_outbox o
  set
    status = 'processing',
    attempt_count = o.attempt_count + 1,
    locked_at = now(),
    updated_at = now()
  from candidates c
  where o.id = c.id
  returning o.*;
end;
$$;

revoke all on function now.claim_customer_notification_batch(integer) from public, anon, authenticated;
grant execute on function now.claim_customer_notification_batch(integer) to service_role;

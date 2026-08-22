create table if not exists now.customer_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_type text not null check (resource_type in ('order', 'service_booking')),
  resource_id uuid not null,
  event_key text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (resource_type, resource_id, event_key)
);

create index if not exists customer_notification_outbox_pending_idx
  on now.customer_notification_outbox (status, next_attempt_at, created_at)
  where status in ('pending', 'failed');

alter table now.customer_notification_outbox enable row level security;
revoke all on table now.customer_notification_outbox from public, anon, authenticated;

grant select, insert, update, delete on table now.customer_notification_outbox to service_role;

create or replace function now.enqueue_order_status_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_body text;
  v_event_key text;
begin
  if new.user_id is null
     or old.status is not distinct from new.status
  then
    return new;
  end if;

  case new.status
    when 'confirmed' then
      v_title := 'تم تأكيد طلبك';
      v_body := 'تم تأكيد طلبك من ' || coalesce(new.store_name_ar_snapshot, 'المتجر') || ' وجاري تجهيزه.';
    when 'preparing' then
      v_title := 'طلبك بيتجهز';
      v_body := 'المتجر بدأ تجهيز طلبك الآن.';
    when 'out_for_delivery' then
      v_title := 'طلبك في الطريق';
      v_body := 'تم تجهيز طلبك وخرج للتوصيل.';
    when 'delivered' then
      v_title := 'تم توصيل طلبك';
      v_body := 'تم توصيل طلبك بنجاح. نتمنى لك تجربة رائعة مع Navienty Now.';
    when 'cancelled' then
      v_title := 'تم إلغاء طلبك';
      v_body := 'تم إلغاء الطلب. افتح التطبيق لمراجعة آخر حالة.';
    else
      return new;
  end case;

  v_event_key := 'status:' || new.status;

  insert into now.customer_notification_outbox (
    user_id,
    resource_type,
    resource_id,
    event_key,
    title,
    body,
    data
  )
  values (
    new.user_id,
    'order',
    new.id,
    v_event_key,
    v_title,
    v_body,
    jsonb_build_object(
      'type', 'order_status',
      'orderId', new.id,
      'status', new.status,
      'url', '/order-success?id=' || new.id::text
    )
  )
  on conflict (resource_type, resource_id, event_key) do nothing;

  return new;
end;
$$;

revoke all on function now.enqueue_order_status_notification() from public, anon, authenticated;

create or replace function now.enqueue_service_booking_status_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_body text;
  v_event_key text;
begin
  if new.user_id is null
     or old.status is not distinct from new.status
  then
    return new;
  end if;

  case new.status
    when 'confirmed' then
      v_title := 'تم تأكيد حجز الخدمة';
      v_body := 'تم تأكيد حجز ' || coalesce(new.package_name_ar, 'الخدمة') || '.';
    when 'picked-up' then
      v_title := 'تم استلام الغسيل';
      v_body := 'استلمنا الغسيل وهنبدأ التجهيز.';
    when 'processing' then
      v_title := 'جاري الغسيل والمكواة';
      v_body := 'طلبك موجود حاليًا في مرحلة الغسيل والمكواة.';
    when 'ready-for-delivery' then
      v_title := 'الغسيل جاهز للتوصيل';
      v_body := 'تم الانتهاء من التجهيز وطلبك جاهز للتوصيل.';
    when 'out-for-delivery' then
      v_title := 'الغسيل في الطريق';
      v_body := 'طلبك خرج للتوصيل وهو في طريقه إليك.';
    when 'delivered' then
      v_title := 'تم تسليم الغسيل';
      v_body := 'تم تسليم طلبك بنجاح. نتمنى لك تجربة رائعة مع Navienty Now.';
    when 'cancelled' then
      v_title := 'تم إلغاء حجز الخدمة';
      v_body := 'تم إلغاء الحجز. افتح التطبيق لمراجعة آخر حالة.';
    else
      return new;
  end case;

  v_event_key := 'status:' || new.status;

  insert into now.customer_notification_outbox (
    user_id,
    resource_type,
    resource_id,
    event_key,
    title,
    body,
    data
  )
  values (
    new.user_id,
    'service_booking',
    new.id,
    v_event_key,
    v_title,
    v_body,
    jsonb_build_object(
      'type', 'service_booking_status',
      'serviceBookingId', new.id,
      'status', new.status,
      'url', '/order-success?serviceBookingId=' || new.id::text
    )
  )
  on conflict (resource_type, resource_id, event_key) do nothing;

  return new;
end;
$$;

revoke all on function now.enqueue_service_booking_status_notification() from public, anon, authenticated;

drop trigger if exists orders_enqueue_customer_notification on now.orders;
create trigger orders_enqueue_customer_notification
after update of status on now.orders
for each row
execute function now.enqueue_order_status_notification();

drop trigger if exists service_bookings_enqueue_customer_notification on now.service_bookings;
create trigger service_bookings_enqueue_customer_notification
after update of status on now.service_bookings
for each row
execute function now.enqueue_service_booking_status_notification();

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
    where (
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

create or replace function now.complete_customer_notification(
  p_outbox_id uuid,
  p_success boolean,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  update now.customer_notification_outbox o
  set
    status = case when p_success then 'sent' else 'failed' end,
    sent_at = case when p_success then coalesce(o.sent_at, now()) else o.sent_at end,
    last_error = case when p_success then null else left(coalesce(p_error, 'notification_delivery_failed'), 1000) end,
    next_attempt_at = case
      when p_success then o.next_attempt_at
      else now() + make_interval(secs => least(3600, 30 * (2 ^ least(o.attempt_count, 7))::integer))
    end,
    locked_at = null,
    updated_at = now()
  where o.id = p_outbox_id
    and o.status = 'processing';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function now.complete_customer_notification(uuid, boolean, text) from public, anon, authenticated;
grant execute on function now.complete_customer_notification(uuid, boolean, text) to service_role;

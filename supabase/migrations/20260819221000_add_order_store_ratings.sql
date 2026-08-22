alter table now.stores
  add column if not exists rating_count integer not null default 0;

alter table now.stores
  drop constraint if exists stores_rating_count_nonnegative;

alter table now.stores
  add constraint stores_rating_count_nonnegative
  check (rating_count >= 0);

create table if not exists now.order_ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references now.orders(id) on delete cascade,
  user_id uuid not null,
  store_id uuid not null references now.stores(id) on delete cascade,
  rating smallint not null,
  created_at timestamptz not null default now(),
  constraint order_ratings_order_unique unique (order_id),
  constraint order_ratings_value_check check (rating between 1 and 5)
);

create index if not exists order_ratings_store_id_created_at_idx
  on now.order_ratings (store_id, created_at desc);

create index if not exists order_ratings_user_id_created_at_idx
  on now.order_ratings (user_id, created_at desc);

alter table now.order_ratings enable row level security;

revoke all on table now.order_ratings from public;
revoke all on table now.order_ratings from anon;
revoke all on table now.order_ratings from authenticated;
grant select, insert, update, delete on table now.order_ratings to service_role;

create or replace function now.refresh_store_rating_aggregate(
  p_store_id uuid
)
returns void
language plpgsql
security definer
set search_path = 'now', 'pg_temp'
as $$
declare
  v_rating_count integer;
  v_rating_avg numeric;
begin
  select
    count(*)::integer,
    coalesce(round(avg(r.rating)::numeric, 2), 0::numeric)
  into
    v_rating_count,
    v_rating_avg
  from now.order_ratings as r
  where r.store_id = p_store_id;

  update now.stores
  set
    rating_count = v_rating_count,
    rating_avg = v_rating_avg,
    updated_at = now()
  where id = p_store_id;
end;
$$;

revoke all on function now.refresh_store_rating_aggregate(uuid) from public;
revoke all on function now.refresh_store_rating_aggregate(uuid) from anon;
revoke all on function now.refresh_store_rating_aggregate(uuid) from authenticated;

create or replace function now.handle_order_rating_aggregate()
returns trigger
language plpgsql
security definer
set search_path = 'now', 'pg_temp'
as $$
begin
  if tg_op = 'DELETE' then
    perform now.refresh_store_rating_aggregate(old.store_id);
    return old;
  end if;

  perform now.refresh_store_rating_aggregate(new.store_id);

  if
    tg_op = 'UPDATE'
    and old.store_id is distinct from new.store_id
  then
    perform now.refresh_store_rating_aggregate(old.store_id);
  end if;

  return new;
end;
$$;

revoke all on function now.handle_order_rating_aggregate() from public;
revoke all on function now.handle_order_rating_aggregate() from anon;
revoke all on function now.handle_order_rating_aggregate() from authenticated;

drop trigger if exists order_ratings_refresh_store_aggregate
  on now.order_ratings;

create trigger order_ratings_refresh_store_aggregate
after insert or update or delete
on now.order_ratings
for each row
execute function now.handle_order_rating_aggregate();

create or replace function now.get_order_rating(
  p_order_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'now', 'pg_temp'
as $$
declare
  v_user_id uuid;
  v_order_user_id uuid;
  v_result jsonb;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication_required';
  end if;

  select o.user_id
  into v_order_user_id
  from now.orders as o
  where o.id = p_order_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'order_not_found';
  end if;

  if v_order_user_id is distinct from v_user_id then
    raise exception using
      errcode = '42501',
      message = 'order_not_owned';
  end if;

  select jsonb_build_object(
    'rated', true,
    'rating', r.rating,
    'created_at', r.created_at
  )
  into v_result
  from now.order_ratings as r
  where r.order_id = p_order_id;

  return coalesce(
    v_result,
    jsonb_build_object(
      'rated', false,
      'rating', null,
      'created_at', null
    )
  );
end;
$$;

revoke all on function now.get_order_rating(uuid) from public;
revoke all on function now.get_order_rating(uuid) from anon;
grant execute on function now.get_order_rating(uuid) to authenticated;
grant execute on function now.get_order_rating(uuid) to service_role;

create or replace function now.submit_order_rating(
  p_order_id uuid,
  p_rating integer
)
returns jsonb
language plpgsql
security definer
set search_path = 'now', 'pg_temp'
as $$
declare
  v_user_id uuid;
  v_order_user_id uuid;
  v_store_id uuid;
  v_order_status text;
  v_created_at timestamptz;
  v_store_rating_avg numeric;
  v_store_rating_count integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication_required';
  end if;

  if p_rating < 1 or p_rating > 5 then
    raise exception using
      errcode = '22023',
      message = 'invalid_rating';
  end if;

  select
    o.user_id,
    o.store_id,
    o.status
  into
    v_order_user_id,
    v_store_id,
    v_order_status
  from now.orders as o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'order_not_found';
  end if;

  if v_order_user_id is distinct from v_user_id then
    raise exception using
      errcode = '42501',
      message = 'order_not_owned';
  end if;

  if v_order_status <> 'delivered' then
    raise exception using
      errcode = '55000',
      message = 'order_not_delivered';
  end if;

  if exists (
    select 1
    from now.order_ratings as r
    where r.order_id = p_order_id
  ) then
    raise exception using
      errcode = '23505',
      message = 'rating_already_submitted';
  end if;

  begin
    insert into now.order_ratings (
      order_id,
      user_id,
      store_id,
      rating
    )
    values (
      p_order_id,
      v_user_id,
      v_store_id,
      p_rating::smallint
    )
    returning created_at
    into v_created_at;
  exception
    when unique_violation then
      raise exception using
        errcode = '23505',
        message = 'rating_already_submitted';
  end;

  select
    s.rating_avg,
    s.rating_count
  into
    v_store_rating_avg,
    v_store_rating_count
  from now.stores as s
  where s.id = v_store_id;

  return jsonb_build_object(
    'order_id', p_order_id,
    'store_id', v_store_id,
    'rating', p_rating,
    'created_at', v_created_at,
    'store_rating_avg', v_store_rating_avg,
    'store_rating_count', v_store_rating_count
  );
end;
$$;

revoke all on function now.submit_order_rating(uuid, integer) from public;
revoke all on function now.submit_order_rating(uuid, integer) from anon;
grant execute on function now.submit_order_rating(uuid, integer) to authenticated;
grant execute on function now.submit_order_rating(uuid, integer) to service_role;

create or replace function now.list_stores(
  p_service_area_id uuid default null::uuid,
  p_category_slug text default null::text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'now', 'pg_temp'
as $$
declare
  v_service_area_id uuid;
  v_result jsonb;
begin
  v_service_area_id := p_service_area_id;

  if v_service_area_id is null then
    select default_service_area_id
    into v_service_area_id
    from now.app_settings
    where singleton = true;
  end if;

  if v_service_area_id is null then
    raise exception using
      errcode = '22023',
      message = 'service_area_required';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'category_id', sc.id,
        'category_slug', sc.slug,
        'category_name_ar', sc.name_ar,
        'category_subtitle_ar', sc.subtitle_ar,
        'slug', s.slug,
        'name_ar', s.name_ar,
        'name_en', s.name_en,
        'short_description_ar', s.short_description_ar,
        'short_description_en', s.short_description_en,
        'icon', s.icon,
        'logo_url', s.logo_url,
        'cover_image_url', s.cover_image_url,
        'rating_avg', s.rating_avg,
        'rating_count', s.rating_count,
        'delivery_time_label_ar', s.delivery_time_label_ar,
        'is_featured', s.is_featured,
        'is_manually_closed',
          coalesce(
            (now.get_store_open_status(s.id, now()) ->> 'is_closed')::boolean,
            s.is_manually_closed
          ),
        'is_manual_override_closed', s.is_manually_closed,
        'manual_closed_note_ar', s.manual_closed_note_ar,
        'delivery_fee', ssa.delivery_fee,
        'minimum_order_amount', ssa.minimum_order_amount,
        'estimated_delivery_minutes', ssa.estimated_delivery_minutes
      )
      order by
        s.is_featured desc,
        s.sort_order,
        s.name_ar
    ),
    '[]'::jsonb
  )
  into v_result
  from now.stores as s
  join now.store_categories as sc
    on sc.id = s.category_id
  join now.store_service_areas as ssa
    on ssa.store_id = s.id
  where
    ssa.service_area_id = v_service_area_id
    and ssa.is_available = true
    and s.is_active = true
    and sc.is_active = true
    and (
      p_category_slug is null
      or sc.slug = p_category_slug
    );

  return v_result;
end;
$$;

revoke all on function now.list_stores(uuid, text) from public;
grant execute on function now.list_stores(uuid, text) to anon;
grant execute on function now.list_stores(uuid, text) to authenticated;
grant execute on function now.list_stores(uuid, text) to service_role;

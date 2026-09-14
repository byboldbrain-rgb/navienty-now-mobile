alter table now.home_banner_products enable row level security;

drop policy if exists "Public can read active home banner products" on now.home_banner_products;

create policy "Public can read active home banner products"
on now.home_banner_products
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from now.home_banners banner
    where banner.id = home_banner_products.banner_id
      and banner.is_active = true
      and (banner.starts_at is null or banner.starts_at <= now())
      and (banner.ends_at is null or banner.ends_at > now())
  )
);

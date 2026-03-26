alter table public.product_catalog
  drop constraint if exists product_catalog_category_check;

update public.product_catalog
set category = case
  when lower(brand) = 'nike' and lower(name) like '%vaporfly%' then 'shoes'
  when lower(brand) = 'garmin' then 'wearables'
  when lower(brand) = 'wahoo' then 'wearables'
  when lower(brand) = 'tyr' and lower(name) like '%goggles%' then 'eyewear'
  else 'miscellaneous'
end
where category = 'gear';

alter table public.product_catalog
  add constraint product_catalog_category_check
  check (category in (
    'shoes',
    'apparel',
    'wearables',
    'miscellaneous',
    'hydration',
    'nutrition',
    'accessories',
    'eyewear'
  ));

alter table public.user_products
  drop constraint if exists user_products_category_check;

update public.user_products up
set category = case
  when exists (
    select 1
    from public.product_catalog pc
    where pc.id = up.catalog_product_id
      and pc.category = 'shoes'
  ) then 'shoes'
  when exists (
    select 1
    from public.product_catalog pc
    where pc.id = up.catalog_product_id
      and pc.category = 'wearables'
  ) then 'wearables'
  when exists (
    select 1
    from public.product_catalog pc
    where pc.id = up.catalog_product_id
      and pc.category = 'eyewear'
  ) then 'eyewear'
  when lower(coalesce(up.brand, '')) = 'nike' and lower(coalesce(up.name, '')) like '%vaporfly%' then 'shoes'
  when lower(coalesce(up.brand, '')) = 'garmin' then 'wearables'
  when lower(coalesce(up.brand, '')) = 'wahoo' then 'wearables'
  when lower(coalesce(up.brand, '')) = 'tyr' and lower(coalesce(up.name, '')) like '%goggles%' then 'eyewear'
  else 'miscellaneous'
end
where up.category = 'gear';

alter table public.user_products
  add constraint user_products_category_check
  check (category in (
    'shoes',
    'apparel',
    'wearables',
    'miscellaneous',
    'hydration',
    'nutrition',
    'accessories',
    'eyewear'
  ));

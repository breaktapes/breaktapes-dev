insert into public.product_catalog (category, brand, name, metadata)
select *
from (
  values
    (
      'accessories',
      'Precision Fuel & Hydration',
      'PF&H x Cimoro Running Belt',
      '{"subcategory":"Race Belts","source_url":"https://www.precisionhydration.com/products/pfh-x-cimoro-running-belt/"}'::jsonb
    )
) as seed(category, brand, name, metadata)
where not exists (
  select 1
  from public.product_catalog existing
  where existing.brand = seed.brand
    and existing.name = seed.name
);

insert into public.product_catalog (category, brand, name, metadata)
select *
from (
  values
    (
      'hydration',
      'Precision Fuel & Hydration',
      'Chris Myers x Cimoro Running Vest',
      '{"subcategory":"Hydration Vests","source_url":"https://www.precisionhydration.com/products/chris-myers-x-cimoro-running-vest/"}'::jsonb
    )
) as seed(category, brand, name, metadata)
where not exists (
  select 1
  from public.product_catalog existing
  where existing.brand = seed.brand
    and existing.name = seed.name
);

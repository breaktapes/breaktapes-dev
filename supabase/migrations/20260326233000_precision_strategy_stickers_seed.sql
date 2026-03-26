insert into public.product_catalog (category, brand, name, metadata)
select *
from (
  values
    (
      'accessories',
      'Precision Fuel & Hydration',
      'Strategy Stickers',
      '{"subcategory":"Miscellaneous","source_url":"https://www.precisionhydration.com/products/strategy-stickers/"}'::jsonb
    )
) as seed(category, brand, name, metadata)
where not exists (
  select 1
  from public.product_catalog existing
  where existing.brand = seed.brand
    and existing.name = seed.name
);

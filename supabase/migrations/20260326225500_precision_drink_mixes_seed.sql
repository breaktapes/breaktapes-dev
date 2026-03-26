insert into public.product_catalog (category, brand, name, metadata)
select *
from (
  values
    (
      'nutrition',
      'Precision Fuel & Hydration',
      'Carb Only Drink Mix',
      '{"subcategory":"Drink Mixes","source_url":"https://www.precisionhydration.com/products/carb-only-drink-mix/"}'::jsonb
    ),
    (
      'nutrition',
      'Precision Fuel & Hydration',
      'Carb & Electrolyte Drink Mix',
      '{"subcategory":"Drink Mixes","source_url":"https://www.precisionhydration.com/products/carb-electrolyte-drink-mix/"}'::jsonb
    )
) as seed(category, brand, name, metadata)
where not exists (
  select 1
  from public.product_catalog existing
  where existing.brand = seed.brand
    and existing.name = seed.name
);

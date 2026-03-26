insert into public.product_catalog (category, brand, name, metadata)
select *
from (
  values
    (
      'hydration',
      'Precision Fuel & Hydration',
      'PH 1500',
      '{"subcategory":"Electrolytes","source_url":"https://www.precisionhydration.com/products/ph-1500-low-calorie-electrolyte-supplement/"}'::jsonb
    ),
    (
      'hydration',
      'Precision Fuel & Hydration',
      'PH 1000',
      '{"subcategory":"Electrolytes","source_url":"https://www.precisionhydration.com/products/ph-1000-low-calorie-electrolyte-supplement/"}'::jsonb
    ),
    (
      'hydration',
      'Precision Fuel & Hydration',
      'PH 500',
      '{"subcategory":"Electrolytes","source_url":"https://www.precisionhydration.com/products/ph-500-low-calorie-electrolyte-supplement/"}'::jsonb
    ),
    (
      'hydration',
      'Precision Fuel & Hydration',
      'PH 1500 Drink Mix',
      '{"subcategory":"Electrolytes","source_url":"https://www.precisionhydration.com/products/ph-1500-electrolyte-drink-mix/"}'::jsonb
    ),
    (
      'hydration',
      'Precision Fuel & Hydration',
      'PH 1000 Drink Mix',
      '{"subcategory":"Electrolytes","source_url":"https://www.precisionhydration.com/products/ph-1000-electrolyte-drink-mix/"}'::jsonb
    ),
    (
      'hydration',
      'Precision Fuel & Hydration',
      'PH 500 Drink Mix',
      '{"subcategory":"Electrolytes","source_url":"https://www.precisionhydration.com/products/ph-500-electrolyte-drink-mix/"}'::jsonb
    ),
    (
      'hydration',
      'Precision Fuel & Hydration',
      'Electrolyte Capsules',
      '{"subcategory":"Electrolytes","source_url":"https://www.precisionhydration.com/products/electrolyte-salt-capsules-for-athletes/"}'::jsonb
    ),
    (
      'hydration',
      'Precision Fuel & Hydration',
      'PH 250',
      '{"subcategory":"Electrolytes","source_url":"https://www.precisionhydration.com/products/ph-250-low-calorie-electrolyte-supplement/"}'::jsonb
    )
) as seed(category, brand, name, metadata)
where not exists (
  select 1
  from public.product_catalog existing
  where existing.brand = seed.brand
    and existing.name = seed.name
);

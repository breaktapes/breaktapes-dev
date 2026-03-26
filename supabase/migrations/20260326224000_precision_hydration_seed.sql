insert into public.product_catalog (category, brand, name, metadata)
select *
from (
  values
    (
      'hydration',
      'Precision Fuel & Hydration',
      'PF&H Bottles',
      '{"subcategory":"Bottles","source_url":"https://www.precisionhydration.com/products/pfh-ergonomic-water-bottles/"}'::jsonb
    ),
    (
      'hydration',
      'Precision Fuel & Hydration',
      'Flow Bottles',
      '{"subcategory":"Soft Flasks","source_url":"https://www.precisionhydration.com/products/pfh-flow-bottles/"}'::jsonb
    ),
    (
      'hydration',
      'Precision Fuel & Hydration',
      '500ml Collapsible Soft Flask',
      '{"subcategory":"Soft Flasks","source_url":"https://www.precisionhydration.com/products/soft-collapsible-flask-bottle/"}'::jsonb
    ),
    (
      'hydration',
      'Precision Fuel & Hydration',
      'PF&H Top Tube Flask',
      '{"subcategory":"Soft Flasks","source_url":"https://www.precisionhydration.com/products/pfh-top-tube-flask/"}'::jsonb
    )
) as seed(category, brand, name, metadata)
where not exists (
  select 1
  from public.product_catalog existing
  where existing.brand = seed.brand
    and existing.name = seed.name
);

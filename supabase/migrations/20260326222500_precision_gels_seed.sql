insert into public.product_catalog (category, brand, name, metadata)
select *
from (
  values
    (
      'nutrition',
      'Precision Fuel & Hydration',
      'PF 30 Gel',
      '{"subcategory":"Gels","source_url":"https://www.precisionhydration.com/products/pf-30-gel/"}'::jsonb
    ),
    (
      'nutrition',
      'Precision Fuel & Hydration',
      'PF 30 Caffeine Gel',
      '{"subcategory":"Gels","source_url":"https://www.precisionhydration.com/products/pf-30-caffeine-gel/"}'::jsonb
    ),
    (
      'nutrition',
      'Precision Fuel & Hydration',
      'PF 90 Gel',
      '{"subcategory":"Gels","source_url":"https://www.precisionhydration.com/products/pf-90-gel/"}'::jsonb
    ),
    (
      'nutrition',
      'Precision Fuel & Hydration',
      'PF 300 Flow Gel',
      '{"subcategory":"Gels","source_url":"https://www.precisionhydration.com/products/pf-300-flow-gel/"}'::jsonb
    )
) as seed(category, brand, name, metadata)
where not exists (
  select 1
  from public.product_catalog existing
  where existing.brand = seed.brand
    and existing.name = seed.name
);

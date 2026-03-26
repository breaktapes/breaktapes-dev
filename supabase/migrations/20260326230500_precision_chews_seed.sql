insert into public.product_catalog (category, brand, name, metadata)
select *
from (
  values
    (
      'nutrition',
      'Precision Fuel & Hydration',
      'PF 30 Chew - Original',
      '{"subcategory":"Chews","source_url":"https://www.precisionhydration.com/products/pf-30-chew/"}'::jsonb
    ),
    (
      'nutrition',
      'Precision Fuel & Hydration',
      'PF 30 Chew - Mint & Lemon',
      '{"subcategory":"Chews","source_url":"https://www.precisionhydration.com/products/pf-30-chew-mint-lemon/"}'::jsonb
    )
) as seed(category, brand, name, metadata)
where not exists (
  select 1
  from public.product_catalog existing
  where existing.brand = seed.brand
    and existing.name = seed.name
);

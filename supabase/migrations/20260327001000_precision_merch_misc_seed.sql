insert into public.product_catalog (category, brand, name, metadata)
select *
from (
  values
    (
      'footwear',
      'Precision Fuel & Hydration',
      'PF&H Socks',
      '{"subcategory":"Socks","source_url":"https://www.precisionhydration.com/products/socks/"}'::jsonb
    ),
    (
      'accessories',
      'Precision Fuel & Hydration',
      'PF&H Microfibre Towel',
      '{"subcategory":"Towels","source_url":"https://www.precisionhydration.com/products/multi-strength-microfibre-towel/"}'::jsonb
    ),
    (
      'accessories',
      'Precision Fuel & Hydration',
      'PF&H Microfibre Robe',
      '{"subcategory":"Miscellaneous","source_url":"https://www.precisionhydration.com/products/multi-strength-microfibre-adult-changing-robe/"}'::jsonb
    )
) as seed(category, brand, name, metadata)
where not exists (
  select 1
  from public.product_catalog existing
  where existing.brand = seed.brand
    and existing.name = seed.name
);

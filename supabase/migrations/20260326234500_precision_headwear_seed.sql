insert into public.product_catalog (category, brand, name, metadata)
select *
from (
  values
    (
      'apparel',
      'Precision Fuel & Hydration',
      'Adaptable Headwear',
      '{"subcategory":"Headwear","source_url":"https://www.precisionhydration.com/products/adaptable-headwear/"}'::jsonb
    ),
    (
      'apparel',
      'Precision Fuel & Hydration',
      'PF&H Visor',
      '{"subcategory":"Headwear","source_url":"https://www.precisionhydration.com/products/multi-strength-visor/"}'::jsonb
    ),
    (
      'apparel',
      'Precision Fuel & Hydration',
      'PF&H Headband',
      '{"subcategory":"Headwear","source_url":"https://www.precisionhydration.com/products/ph-headband/"}'::jsonb
    ),
    (
      'apparel',
      'Precision Fuel & Hydration',
      'PF&H Bobble Hat',
      '{"subcategory":"Headwear","source_url":"https://www.precisionhydration.com/products/multi-strength-bobble-hat/"}'::jsonb
    ),
    (
      'apparel',
      'Precision Fuel & Hydration',
      'PF&H Classic Trail Hat',
      '{"subcategory":"Headwear","source_url":"https://www.precisionhydration.com/products/pfh-classic-hat/"}'::jsonb
    ),
    (
      'apparel',
      'Precision Fuel & Hydration',
      'PF&H Splatter Hat',
      '{"subcategory":"Headwear","source_url":"https://www.precisionhydration.com/products/pfh-splatter-hat/"}'::jsonb
    ),
    (
      'apparel',
      'Precision Fuel & Hydration',
      'PF&H Sticker Hat',
      '{"subcategory":"Headwear","source_url":"https://www.precisionhydration.com/products/pfh-sticker-hat/"}'::jsonb
    ),
    (
      'apparel',
      'Precision Fuel & Hydration',
      'PF&H Trail Hat (Black)',
      '{"subcategory":"Headwear","source_url":"https://www.precisionhydration.com/products/pfh-everyday-trail-hat-black/"}'::jsonb
    ),
    (
      'apparel',
      'Precision Fuel & Hydration',
      'PF&H Trail Hat (White)',
      '{"subcategory":"Headwear","source_url":"https://www.precisionhydration.com/products/pfh-everyday-trail-hat-white/"}'::jsonb
    ),
    (
      'apparel',
      'Precision Fuel & Hydration',
      'PF&H Bucket Hat',
      '{"subcategory":"Headwear","source_url":"https://www.precisionhydration.com/products/bucket-hat/"}'::jsonb
    ),
    (
      'apparel',
      'Precision Fuel & Hydration',
      'PF&H Sticker Bucket Hat',
      '{"subcategory":"Headwear","source_url":"https://www.precisionhydration.com/products/pfh-sticker-bucket-hat/"}'::jsonb
    ),
    (
      'apparel',
      'Precision Fuel & Hydration',
      'PF&H Winter Running Hat',
      '{"subcategory":"Headwear","source_url":"https://www.precisionhydration.com/products/pfh-winter-running-hat/"}'::jsonb
    )
) as seed(category, brand, name, metadata)
where not exists (
  select 1
  from public.product_catalog existing
  where existing.brand = seed.brand
    and existing.name = seed.name
);

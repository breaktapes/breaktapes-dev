insert into public.product_catalog (category, brand, name, metadata)
select *
from (
  values
    (
      'hydration',
      'Maurten',
      'HydraPak SkyFlask - made for hydrogel',
      '{"subcategory":"Soft Flasks","source_url":"https://www.maurten.com/products/skyflask-350ml"}'::jsonb
    ),
    (
      'hydration',
      'Maurten',
      'Gelflask 150 ml',
      '{"subcategory":"Soft Flasks","source_url":"https://www.maurten.com/products/gel-flask-150"}'::jsonb
    ),
    (
      'hydration',
      'Maurten',
      'Drinkflask 550 ml',
      '{"subcategory":"Soft Flasks","source_url":"https://www.maurten.com/products/drink-flask-550"}'::jsonb
    ),
    (
      'hydration',
      'Maurten',
      'Bottle 500 ml',
      '{"subcategory":"Bottles","source_url":"https://www.maurten.com/products/bottle-500-ml"}'::jsonb
    ),
    (
      'hydration',
      'Maurten',
      'Bottle 750 ml',
      '{"subcategory":"Bottles","source_url":"https://www.maurten.com/products/bottle-750-ml"}'::jsonb
    )
) as seed(category, brand, name, metadata)
where not exists (
  select 1
  from public.product_catalog existing
  where existing.brand = seed.brand
    and existing.name = seed.name
);

insert into public.product_catalog (category, brand, name, metadata)
select *
from (
  values
    ('nutrition', 'Maurten', 'Gel 100 CAF 100', '{"source_url":"https://www.maurten.com/products/gel-100-caf-100-box-us"}'::jsonb),
    ('nutrition', 'Maurten', 'Gel 100', '{"source_url":"https://www.maurten.com/products/gel-100-box-us"}'::jsonb),
    ('nutrition', 'Maurten', 'Gel 160', '{"source_url":"https://www.maurten.com/products/gel-160-us-ca"}'::jsonb),
    ('nutrition', 'Maurten', 'Drink Mix 320 CAF 100', '{"source_url":"https://www.maurten.com/products/drink-mix-320-caf-100-us"}'::jsonb),
    ('nutrition', 'Maurten', 'Drink Mix 160', '{"source_url":"https://www.maurten.com/products/drink-mix-160-box-us"}'::jsonb),
    ('nutrition', 'Maurten', 'Drink Mix 320', '{"source_url":"https://www.maurten.com/products/drink-mix-320-box-us"}'::jsonb),
    ('nutrition', 'Maurten', 'Bicarb', '{"source_url":"https://www.maurten.com/products/bicarb"}'::jsonb),
    ('nutrition', 'Maurten', 'Solid C 160', '{"source_url":"https://www.maurten.com/products/solid-c-160-us"}'::jsonb),
    ('nutrition', 'Maurten', 'Solid 160', '{"source_url":"https://www.maurten.com/products/solid-160-us"}'::jsonb)
) as seed(category, brand, name, metadata)
where not exists (
  select 1
  from public.product_catalog existing
  where existing.brand = seed.brand
    and existing.name = seed.name
);

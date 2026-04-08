-- Add product_url to metadata for Maurten catalog products
-- product_url is used by the frontend to resolve product images via Shopify JSON API

update public.product_catalog set metadata = metadata || '{"product_url":"https://www.maurten.com/products/gel-100-box-us"}'::jsonb
  where brand = 'Maurten' and name = 'Gel 100';

update public.product_catalog set metadata = metadata || '{"product_url":"https://www.maurten.com/products/gel-100-caf-100-box-us"}'::jsonb
  where brand = 'Maurten' and name = 'Gel 100 CAF 100';

update public.product_catalog set metadata = metadata || '{"product_url":"https://www.maurten.com/products/gel-160-box-us"}'::jsonb
  where brand = 'Maurten' and name = 'Gel 160';

update public.product_catalog set metadata = metadata || '{"product_url":"https://www.maurten.com/products/gel-160-caf-100-box-us"}'::jsonb
  where brand = 'Maurten' and name = 'Gel 160 CAF 100';

update public.product_catalog set metadata = metadata || '{"product_url":"https://www.maurten.com/products/drink-mix-160-box-us"}'::jsonb
  where brand = 'Maurten' and name = 'Drink Mix 160';

update public.product_catalog set metadata = metadata || '{"product_url":"https://www.maurten.com/products/drink-mix-320-box-us"}'::jsonb
  where brand = 'Maurten' and name = 'Drink Mix 320';

update public.product_catalog set metadata = metadata || '{"product_url":"https://www.maurten.com/products/drink-mix-320-caf-100-box-us"}'::jsonb
  where brand = 'Maurten' and name = 'Drink Mix 320 CAF 100';

update public.product_catalog set metadata = metadata || '{"product_url":"https://www.maurten.com/products/solid-225-box-us"}'::jsonb
  where brand = 'Maurten' and name = 'Solid 225';

update public.product_catalog set metadata = metadata || '{"product_url":"https://www.maurten.com/products/solid-225-caf-100-box-us"}'::jsonb
  where brand = 'Maurten' and name = 'Solid 225 CAF 100';

-- Precision Fuel & Hydration
update public.product_catalog set metadata = metadata || '{"product_url":"https://www.precisionfuelandhydration.com/products/pf-30-caffeine-gel"}'::jsonb
  where brand = 'Precision Fuel & Hydration' and name = 'PF 30 Caffeine Gel';

update public.product_catalog set metadata = metadata || '{"product_url":"https://www.precisionfuelandhydration.com/products/pf-30-gel"}'::jsonb
  where brand = 'Precision Fuel & Hydration' and name = 'PF 30 Gel';

update public.product_catalog set metadata = metadata || '{"product_url":"https://www.precisionfuelandhydration.com/products/pf-90-gel"}'::jsonb
  where brand = 'Precision Fuel & Hydration' and name = 'PF 90 Gel';

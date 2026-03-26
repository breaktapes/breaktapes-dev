insert into public.product_catalog (category, brand, name, metadata)
select *
from (
  values
    ('footwear', 'The North Face', 'VECTIV Pro', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes","Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'The North Face', 'Summit VECTIV Pro', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes","Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'The North Face', 'VECTIV Enduris', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'The North Face', 'VECTIV Enduris 2', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'The North Face', 'VECTIV Enduris 3', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'The North Face', 'Summit VECTIV Sky', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes","Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'The North Face', 'Summit VECTIV Sky 2', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes","Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'The North Face', 'VECTIV Infinite', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'The North Face', 'VECTIV Infinite 2', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'The North Face', 'Altamesa', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'The North Face', 'Altamesa 300', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'The North Face', 'Altamesa 500', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'The North Face', 'Flight VECTIV', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes","Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'The North Face', 'Flight VECTIV Guard FUTURELIGHT', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb)
) as seed(category, brand, name, metadata)
where not exists (
  select 1
  from public.product_catalog existing
  where existing.brand = seed.brand
    and existing.name = seed.name
);

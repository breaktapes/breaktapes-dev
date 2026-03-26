insert into public.product_catalog (category, brand, name, metadata)
select *
from (
  values
    ('footwear', 'Li-Ning', 'Feidian', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Li-Ning', 'Feidian Challenger', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Li-Ning', 'Feidian Elite', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Li-Ning', 'Feidian Discovery', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Li-Ning', 'Red Hare', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Li-Ning', 'Shadow', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Li-Ning', 'Yue Ying', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Li-Ning', 'Jue Ying', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Li-Ning', 'Super Light', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Li-Ning', 'Ultra Light', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Li-Ning', 'Arc', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes","Tempo Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Li-Ning', 'BOOM', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes","Tempo Shoes"],"source_note":"user_seed"}'::jsonb)
) as seed(category, brand, name, metadata)
where not exists (
  select 1
  from public.product_catalog existing
  where existing.brand = seed.brand
    and existing.name = seed.name
);

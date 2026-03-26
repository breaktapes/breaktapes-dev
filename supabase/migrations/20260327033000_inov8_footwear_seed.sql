insert into public.product_catalog (category, brand, name, metadata)
select *
from (
  values
    ('footwear', 'Inov-8', 'Trailfly', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Inov-8', 'Trailfly Speed', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes","Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Inov-8', 'Trailfly Max', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Inov-8', 'Trailfly Ultra G 280', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Inov-8', 'Trailfly Zero', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Inov-8', 'Trailtalon', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Inov-8', 'Trailtalon Speed', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes","Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Inov-8', 'Trailtalon Max', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Inov-8', 'Trailtalon GTX', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Inov-8', 'Trailtalon Zero', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Inov-8', 'Mudtalon', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Inov-8', 'Mudclaw', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Inov-8', 'X-Talon', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes","Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Inov-8', 'Roclite', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Inov-8', 'Parkclaw', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes","Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Inov-8', 'Terraultra', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Inov-8', 'Race Ultra', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes","Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Inov-8', 'Roadfly', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Inov-8', 'Roadfly Zero', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Inov-8', 'F-Lite', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb)
) as seed(category, brand, name, metadata)
where not exists (
  select 1
  from public.product_catalog existing
  where existing.brand = seed.brand
    and existing.name = seed.name
);

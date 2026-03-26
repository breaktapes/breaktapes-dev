insert into public.product_catalog (category, brand, name, metadata)
select *
from (
  values
    ('footwear', 'Brooks', 'Ghost', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Ghost Max', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Glycerin', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Glycerin GTS', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Glycerin Max', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Adrenaline GTS', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Hyperion', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Hyperion Elite', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Hyperion Max', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Launch', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Launch GTS', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Levitate', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Levitate GTS', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Beast', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Ariel', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Addiction GTS', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Anthem', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Revel', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Ricochet', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Aurora-BL', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'PureCadence', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'PureFlow', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'PureGrit', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'PureConnect', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Green Silence', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Ravenna', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Transcend', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Neuro', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Bedlam', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Caldera', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Cascadia', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Cascadia GTX', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Catamount', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes","Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Catamount Agil', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes","Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Divide', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Divide GTX', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Brooks', 'Ghost Trail', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes","Daily Trainers"],"source_note":"user_seed"}'::jsonb)
) as seed(category, brand, name, metadata)
where not exists (
  select 1
  from public.product_catalog existing
  where existing.brand = seed.brand
    and existing.name = seed.name
);

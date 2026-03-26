insert into public.product_catalog (category, brand, name, metadata)
select *
from (
  values
    ('footwear', 'Saucony', 'Triumph', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Ride', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Kinvara', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Guide', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Hurricane', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Endorphin Pro', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Endorphin Speed', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Endorphin Shift', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Endorphin Elite', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Endorphin Edge', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes","Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Endorphin Rift', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Endorphin Trainer', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Peregrine', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Xodus', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Xodus Ultra', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Excursion TR', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Cohesion', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Cohesion TR', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Omni', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Echelon', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Freedom', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers","Tempo Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Liberty', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers","Tempo Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Fastwitch', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes","Tempo Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Type A', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Mirage', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Zealot', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'ISO', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'ProGrid', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Breakthru', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Jazz', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Cortana', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Virrata', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Switchback', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Havok', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Mad River', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Saucony', 'Ride TR', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes","Daily Trainers"],"source_note":"user_seed"}'::jsonb)
) as seed(category, brand, name, metadata)
where not exists (
  select 1
  from public.product_catalog existing
  where existing.brand = seed.brand
    and existing.name = seed.name
);

insert into public.product_catalog (category, brand, name, metadata)
select *
from (
  values
    ('footwear', 'On', 'Cloudmonster', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'On', 'Cloudmonster Hyper', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'On', 'Cloudsurfer', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'On', 'Cloudflow', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'On', 'Cloudflyer', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'On', 'Cloudstratus', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'On', 'Cloudswift', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'On', 'Cloudrunner', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'On', 'Cloudeclipse', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'On', 'Cloudboom Echo', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'On', 'Cloudboom Strike', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'On', 'Cloudboom', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'On', 'Cloudgo', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'On', 'Cloudultra', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'On', 'Cloudventure', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'On', 'Cloudvista', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'On', 'Cloudhorizon', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'On', 'Cloudace', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'On', 'Cloudflash', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'On', 'Cloud X', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'On', 'Cloudspike', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'On', 'Cloudspike 10000m', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_note":"user_seed"}'::jsonb)
) as seed(category, brand, name, metadata)
where not exists (
  select 1
  from public.product_catalog existing
  where existing.brand = seed.brand
    and existing.name = seed.name
);

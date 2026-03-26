insert into public.product_catalog (category, brand, name, metadata)
select *
from (
  values
    ('footwear', 'Adidas', 'Adizero Adios 5', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Adizero Adios 6', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Adizero Adios 7', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Adizero Adios 8', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Adizero Adios Pro 1', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Adizero Adios Pro 2', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Adizero Adios Pro 3', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Adizero Adios Pro 4', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Adizero Boston 8', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Adizero Boston 9', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Adizero Boston 10', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Adizero Boston 11', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Adizero Boston 12', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Takumi Sen 5', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes","Tempo Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Takumi Sen 6', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes","Tempo Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Takumi Sen 7', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes","Tempo Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Takumi Sen 8', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes","Tempo Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Takumi Sen 9', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes","Tempo Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Takumi Sen 10', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes","Tempo Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Ultraboost 3.0', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Ultraboost 4.0', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Ultraboost 19', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Ultraboost 20', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Ultraboost 21', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Ultraboost 22', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Ultraboost Light', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Adizero EVO 1', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Adidas', 'Adizero EVO SL', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Daily Trainers"],"source_note":"user_seed"}'::jsonb)
) as seed(category, brand, name, metadata)
where not exists (
  select 1
  from public.product_catalog existing
  where existing.brand = seed.brand
    and existing.name = seed.name
);

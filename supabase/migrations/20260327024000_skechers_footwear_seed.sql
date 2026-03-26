insert into public.product_catalog (category, brand, name, metadata)
select *
from (
  values
    ('footwear', 'Skechers', 'GO RUN Ride', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Skechers', 'GO RUN MaxRoad', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Skechers', 'GO RUN Razor', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Skechers', 'GO RUN Razor Excess', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Skechers', 'GO RUN Speed Elite', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Skechers', 'GO RUN Speed Beast', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes","Tempo Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Skechers', 'GO RUN Elevate', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Skechers', 'GO RUN Forza', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Skechers', 'GO RUN Persistence', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Skechers', 'GO RUN Consistent', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Skechers', 'GO RUN Supersonic', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Skechers', 'GO RUN Arch Fit', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Skechers', 'GO RUN Trail Altitude', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Skechers', 'GOtrail', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Skechers', 'Max Cushioning Elite', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Skechers', 'Max Cushioning Premier', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Skechers', 'GOrun Horizon Vanish', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'Skechers', 'GOrun Horizon', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb)
) as seed(category, brand, name, metadata)
where not exists (
  select 1
  from public.product_catalog existing
  where existing.brand = seed.brand
    and existing.name = seed.name
);

insert into public.product_catalog (category, brand, name, metadata)
select *
from (
  values
    ('footwear', 'La Sportiva', 'Prodigio', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'La Sportiva', 'Prodigio Pro', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes","Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'La Sportiva', 'Bushido', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'La Sportiva', 'Bushido II', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'La Sportiva', 'Jackal', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'La Sportiva', 'Jackal II', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'La Sportiva', 'Akasha', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'La Sportiva', 'Akasha II', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'La Sportiva', 'Karacal', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'La Sportiva', 'Helios', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'La Sportiva', 'Helios III', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'La Sportiva', 'Mutant', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'La Sportiva', 'Cyklon', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'La Sportiva', 'Tempesta', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'La Sportiva', 'Blizzard', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'La Sportiva', 'Lycan', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'La Sportiva', 'Captiva', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'La Sportiva', 'Kaptiva', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes","Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'La Sportiva', 'VK Boa', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes","Race Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'La Sportiva', 'Akyra', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'La Sportiva', 'Ultra Raptor', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'La Sportiva', 'Ultra Raptor II', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_note":"user_seed"}'::jsonb)
) as seed(category, brand, name, metadata)
where not exists (
  select 1
  from public.product_catalog existing
  where existing.brand = seed.brand
    and existing.name = seed.name
);

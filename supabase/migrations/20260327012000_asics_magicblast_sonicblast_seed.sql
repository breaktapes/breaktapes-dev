insert into public.product_catalog (category, brand, name, metadata)
select *
from (
  values
    ('footwear', 'ASICS', 'Magicblast', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb),
    ('footwear', 'ASICS', 'Sonicblast', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_note":"user_seed"}'::jsonb)
) as seed(category, brand, name, metadata)
where not exists (
  select 1
  from public.product_catalog existing
  where existing.brand = seed.brand
    and existing.name = seed.name
);

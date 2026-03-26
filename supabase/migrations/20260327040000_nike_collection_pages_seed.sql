insert into public.product_catalog (category, brand, name, metadata)
select *
from (
  values
    ('footwear', 'Nike', 'Nike Maxfly 2 Glam', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_collection":"track_field"}'::jsonb),
    ('footwear', 'Nike', 'Nike Dragonfly 2 Glam', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_collection":"track_field"}'::jsonb),
    ('footwear', 'Nike', 'Nike Dragonfly 2 Elite', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_collection":"track_field"}'::jsonb),
    ('footwear', 'Nike', 'Nike Zoom Superfly Elite 2', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_collection":"track_field"}'::jsonb),
    ('footwear', 'Nike', 'Nike Victory 2 Glam', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_collection":"track_field"}'::jsonb),
    ('footwear', 'Nike', 'Nike Zoom Ja Fly 4', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_collection":"track_field"}'::jsonb),
    ('footwear', 'Nike', 'Nike Zoom Rival Distance Glam', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_collection":"track_field"}'::jsonb),
    ('footwear', 'Nike', 'Nike Zoom Rival Sprint Glam', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_collection":"track_field"}'::jsonb),
    ('footwear', 'Nike', 'Nike Zoom Rival Multi Glam', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_collection":"track_field"}'::jsonb),
    ('footwear', 'Nike', 'Nike Long Jump Elite Glam', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_collection":"track_field"}'::jsonb),
    ('footwear', 'Nike', 'Nike Zoom Rival Jump Glam', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_collection":"track_field"}'::jsonb),
    ('footwear', 'Nike', 'Nike Pole Vault Elite', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_collection":"track_field"}'::jsonb),
    ('footwear', 'Nike', 'Nike Triple Jump Elite 3', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_collection":"track_field"}'::jsonb),
    ('footwear', 'Nike', 'Nike High Jump Elite', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_collection":"track_field"}'::jsonb),
    ('footwear', 'Nike', 'Nike Zoom Rotational 6', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_collection":"track_field"}'::jsonb),
    ('footwear', 'Nike', 'Nike Zoom Javelin Elite 3', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_collection":"track_field"}'::jsonb),
    ('footwear', 'Nike', 'Nike Zoom SD 4', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_collection":"track_field"}'::jsonb),
    ('footwear', 'Nike', 'Nike Zoom Rival SD 2', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_collection":"track_field"}'::jsonb),
    ('footwear', 'Nike', 'Nike Zoom Mamba 5 Bowerman Track Club', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_collection":"track_field"}'::jsonb),
    ('footwear', 'Nike', 'Nike Zoom Rival XC 6', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes","Trail Shoes"],"source_collection":"track_field"}'::jsonb),

    ('footwear', 'Nike', 'Nike ACG Ultrafly Trail', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes","Race Shoes"],"source_collection":"trail_running"}'::jsonb),
    ('footwear', 'Nike', 'Nike Kiger 10', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_collection":"trail_running"}'::jsonb),
    ('footwear', 'Nike', 'Nike Pegasus Trail 5 GORE-TEX', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_collection":"trail_running"}'::jsonb),
    ('footwear', 'Nike', 'Nike Wildhorse 10', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_collection":"trail_running"}'::jsonb),
    ('footwear', 'Nike', 'Nike Zegama 2', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_collection":"trail_running"}'::jsonb),
    ('footwear', 'Nike', 'Nike Pegasus Trail 5', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_collection":"trail_running"}'::jsonb),
    ('footwear', 'Nike', 'Nike Juniper Trail 3', '{"primary_subcategory":"Trail Shoes","subcategories":["Trail Shoes"],"source_collection":"trail_running"}'::jsonb),

    ('footwear', 'Nike', 'Nike Alphafly 3 Glam', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_collection":"road_racing"}'::jsonb),
    ('footwear', 'Nike', 'Nike Vaporfly 4 Glam', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_collection":"road_racing"}'::jsonb),
    ('footwear', 'Nike', 'Nike Zoom Fly 6 Glam', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Race Shoes"],"source_collection":"road_racing"}'::jsonb),
    ('footwear', 'Nike', 'Nike Streakfly 2', '{"primary_subcategory":"Race Shoes","subcategories":["Race Shoes"],"source_collection":"road_racing"}'::jsonb),
    ('footwear', 'Nike', 'Nike Zoom Rival Fly 4', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Race Shoes"],"source_collection":"road_racing"}'::jsonb),

    ('footwear', 'Nike', 'Nike Vomero Plus', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_collection":"road_running"}'::jsonb),
    ('footwear', 'Nike', 'Nike Vomero 18', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_collection":"road_running"}'::jsonb),
    ('footwear', 'Nike', 'Nike Pegasus Premium', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_collection":"road_running"}'::jsonb),
    ('footwear', 'Nike', 'Nike Structure Plus', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_collection":"road_running"}'::jsonb),
    ('footwear', 'Nike', 'Nike Structure 26', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_collection":"road_running"}'::jsonb),
    ('footwear', 'Nike', 'Nike Pegasus Plus', '{"primary_subcategory":"Tempo Shoes","subcategories":["Tempo Shoes","Daily Trainers"],"source_collection":"road_running"}'::jsonb),
    ('footwear', 'Nike', 'Nike Pegasus 41', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_collection":"road_running"}'::jsonb),
    ('footwear', 'Nike', 'Nike Pegasus 42', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_collection":"road_running"}'::jsonb),
    ('footwear', 'Nike', 'Nike Vomero Premium', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_collection":"road_running"}'::jsonb),
    ('footwear', 'Nike', 'Nike Downshifter 14', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_collection":"road_running"}'::jsonb),
    ('footwear', 'Nike', 'Nike Winflo 12', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_collection":"road_running"}'::jsonb),
    ('footwear', 'Nike', 'Nike Journey Run', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_collection":"road_running"}'::jsonb),
    ('footwear', 'Nike', 'Nike Revolution 8', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_collection":"road_running"}'::jsonb),
    ('footwear', 'Nike', 'Nike Pegasus 41 GORE-TEX', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_collection":"cold_weather_running"}'::jsonb),
    ('footwear', 'Nike', 'Nike Vomero 18 GORE-TEX', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_collection":"cold_weather_running"}'::jsonb),
    ('footwear', 'Nike', 'Nike Winflo 11 GORE-TEX', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_collection":"cold_weather_running"}'::jsonb),
    ('footwear', 'Nike', 'Nike Run Defy', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_collection":"road_running"}'::jsonb),
    ('footwear', 'Nike', 'Nike Flex Experience Run 12', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_collection":"road_running"}'::jsonb),
    ('footwear', 'Nike', 'Nike Cosmic Runner', '{"primary_subcategory":"Daily Trainers","subcategories":["Daily Trainers"],"source_collection":"road_running"}'::jsonb),

    ('apparel', 'Nike', 'Nike Stride', '{"primary_subcategory":"Trousers & Tights","subcategories":["Trousers & Tights"],"source_collection":"cold_weather_running","product_hint":"Men''s Dri-FIT Woven Running Pants"}'::jsonb),
    ('apparel', 'Nike', 'Nike Swift', '{"primary_subcategory":"Trousers & Leggings","subcategories":["Trousers & Leggings","Tops & T-Shirts"],"source_collection":"cold_weather_running","product_hint":"Women''s running leggings and 1/4-zip top"}'::jsonb),
    ('footwear', 'Nike', 'Nike Running Wool Micro Crew Socks', '{"primary_subcategory":"Socks","subcategories":["Socks"],"source_collection":"cold_weather_running"}'::jsonb),
    ('footwear', 'Nike', 'Nike Running No-Show Wool Socks', '{"primary_subcategory":"Socks","subcategories":["Socks"],"source_collection":"cold_weather_running"}'::jsonb),
    ('footwear', 'Nike', 'Nike Running Lightweight Wool Crew Socks', '{"primary_subcategory":"Socks","subcategories":["Socks"],"source_collection":"cold_weather_running"}'::jsonb),
    ('apparel', 'Nike', 'Nike AeroSwift Aerogami', '{"primary_subcategory":"Jackets & Gilets","subcategories":["Jackets & Gilets"],"source_collection":"cold_weather_running","product_hint":"Women''s Storm-FIT Running Jacket"}'::jsonb),
    ('apparel', 'Nike', 'Nike AeroSwift', '{"primary_subcategory":"Shorts","subcategories":["Shorts"],"source_collection":"cold_weather_running","product_hint":"Men''s Dri-FIT ADV 4\" Brief-Lined Running Shorts"}'::jsonb),
    ('apparel', 'Nike', 'Nike Therma-FIT ADV AeroLoft', '{"primary_subcategory":"Jackets & Gilets","subcategories":["Jackets & Gilets"],"source_collection":"cold_weather_running","product_hint":"Men''s Repel Down Running Jacket"}'::jsonb),
    ('apparel', 'Nike', 'Nike Therma-FIT Swift', '{"primary_subcategory":"Jackets & Gilets","subcategories":["Jackets & Gilets"],"source_collection":"cold_weather_running","product_hint":"Women''s Running Jacket"}'::jsonb),
    ('apparel', 'Nike', 'Nike Men''s 4\" 2-in-1 Reflective Running Shorts', '{"primary_subcategory":"Shorts","subcategories":["Shorts"],"source_collection":"cold_weather_running"}'::jsonb),
    ('apparel', 'Nike', 'Nike Stride 7\" 2-in-1 Running Shorts', '{"primary_subcategory":"Shorts","subcategories":["Shorts"],"source_collection":"cold_weather_running"}'::jsonb),
    ('apparel', 'Nike', 'Nike Men''s Therma-FIT ADV Reflective Running Vest', '{"primary_subcategory":"Jackets & Gilets","subcategories":["Jackets & Gilets"],"source_collection":"cold_weather_running"}'::jsonb),
    ('apparel', 'Nike', 'Nike Phenom', '{"primary_subcategory":"Trousers & Tights","subcategories":["Trousers & Tights"],"source_collection":"cold_weather_running","product_hint":"Men''s Dri-FIT Knit Running Pants"}'::jsonb)
) as seed(category, brand, name, metadata)
where not exists (
  select 1
  from public.product_catalog existing
  where existing.brand = seed.brand
    and existing.name = seed.name
);

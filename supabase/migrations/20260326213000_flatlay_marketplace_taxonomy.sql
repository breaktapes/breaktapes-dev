create or replace function public.flatlay_marketplace_category(old_category text)
returns text
language sql
immutable
as $$
  select case old_category
    when 'shoes' then 'footwear'
    when 'socks' then 'footwear'
    when 'headwear' then 'apparel'
    when 'bikes' then 'bike'
    when 'bike_components' then 'bike'
    when 'bike_maintenance' then 'bike'
    when 'indoor_training' then 'bike'
    when 'swim_gear' then 'swim'
    when 'miscellaneous' then 'accessories'
    when 'eyewear' then 'accessories'
    else old_category
  end;
$$;

create or replace function public.flatlay_marketplace_subcategory(old_category text, product_name text, product_metadata jsonb)
returns text
language sql
immutable
as $$
  select case
    when coalesce(product_metadata->>'subcategory', '') <> '' then product_metadata->>'subcategory'
    when old_category in ('shoes', 'footwear') then case
      when lower(product_name) like '%sock%' then 'Socks'
      when lower(product_name) like '%cycling%' then 'Cycling Shoes'
      when lower(product_name) like '%tri%' then 'Triathlon Shoes'
      when lower(product_name) like '%trail%' then 'Trail Shoes'
      when lower(product_name) like '%recovery%' then 'Recovery Shoes'
      when lower(product_name) like '%daily%' or lower(product_name) like '%trainer%' then 'Daily Trainers'
      when lower(product_name) like '%tempo%' then 'Tempo Shoes'
      else 'Race Shoes'
    end
    when old_category in ('apparel', 'headwear') then case
      when old_category = 'headwear' or lower(product_name) like '%cap%' or lower(product_name) like '%visor%' or lower(product_name) like '%beanie%' or lower(product_name) like '%headband%' or lower(product_name) like '%buff%' then 'Headwear'
      when lower(product_name) like '%singlet%' then 'Singlets'
      when lower(product_name) like '%short%' then 'Shorts'
      when lower(product_name) like '%legging%' then 'Trousers & Leggings'
      when lower(product_name) like '%tight%' then 'Trousers & Tights'
      when lower(product_name) like '%compression%' or lower(product_name) like '%baselayer%' or lower(product_name) like '%base layer%' then 'Compression & Baselayer'
      when lower(product_name) like '%jacket%' or lower(product_name) like '%gilet%' or lower(product_name) like '%vest%' then 'Jackets & Gilets'
      when lower(product_name) like '%hoodie%' or lower(product_name) like '%sweatshirt%' then 'Hoodies & Sweatshirts'
      when lower(product_name) like '%top%' or lower(product_name) like '%t-shirt%' or lower(product_name) like '%tee%' then 'Tops & T-Shirts'
      else 'Tops & T-Shirts'
    end
    when old_category in ('wearables') then case
      when lower(product_name) like '%power meter%' then 'Power Meters'
      when lower(product_name) like '%heart rate%' or lower(product_name) like '%hr monitor%' then 'Heart Rate Monitors'
      when lower(product_name) like '%bike computer%' or lower(product_name) like '%computer%' or lower(product_name) like '%bolt%' then 'Bike Computers'
      when lower(product_name) like '%ring%' then 'Smart Rings'
      when lower(product_name) like '%headphone%' or lower(product_name) like '%earbud%' then 'Headphones'
      else 'GPS Watches'
    end
    when old_category in ('bike', 'bikes', 'bike_components', 'bike_maintenance', 'indoor_training') then case
      when old_category = 'bikes' or lower(product_name) like '%p-series%' then 'Bikes'
      when old_category = 'bike_maintenance' then 'Maintenance'
      when old_category = 'indoor_training' or lower(product_name) like '%trainer%' or lower(product_name) like '%roller%' then 'Indoor Trainers'
      when lower(product_name) like '%wheel%' then 'Wheels'
      when lower(product_name) like '%tyre%' or lower(product_name) like '%tire%' then 'Tyres'
      when lower(product_name) like '%saddle%' then 'Saddles'
      when lower(product_name) like '%pedal%' then 'Pedals'
      when lower(product_name) like '%handlebar%' or lower(product_name) like 'bar %' or lower(product_name) like '% stem%' then 'Handlebars'
      when lower(product_name) like '%pump%' or lower(product_name) like '%tool%' or lower(product_name) like '%lube%' or lower(product_name) like '%tube%' then 'Tools'
      else 'Drivetrain'
    end
    when old_category in ('swim', 'swim_gear') then case
      when lower(product_name) like '%goggle%' then 'Goggles'
      when lower(product_name) like '%cap%' then 'Swim Caps'
      when lower(product_name) like '%wetsuit%' then 'Wetsuits'
      when lower(product_name) like '%buoy%' then 'Pull Buoys'
      when lower(product_name) like '%paddle%' then 'Paddles'
      when lower(product_name) like '%kickboard%' then 'Kickboards'
      when lower(product_name) like '%bag%' then 'Swim Bags'
      else 'Swimwear'
    end
    when old_category in ('hydration') then case
      when lower(product_name) like '%soft flask%' or lower(product_name) like '%flask%' then 'Soft Flasks'
      when lower(product_name) like '%vest%' then 'Hydration Vests'
      when lower(product_name) like '%pack%' then 'Hydration Packs'
      when lower(product_name) like '%reservoir%' then 'Reservoirs'
      when lower(product_name) like '%electrolyte%' or lower(product_name) like '%tablet%' then 'Electrolytes'
      else 'Bottles'
    end
    when old_category in ('nutrition') then case
      when lower(product_name) like '%bicarb%' then 'Bicarb'
      when lower(product_name) like '%drink mix%' or coalesce(product_metadata->>'fuel_type', '') = 'drink_mix' then 'Drink Mix'
      when lower(product_name) like '%gel%' or coalesce(product_metadata->>'fuel_type', '') = 'gel' then 'Gels'
      when lower(product_name) like '%solid%' or lower(product_name) like '%bar%' then 'Bars'
      when lower(product_name) like '%chew%' then 'Chews'
      when lower(product_name) like '%recovery%' then 'Recovery Fuel'
      when lower(product_name) like '%caffeine%' or lower(product_name) like '%caf%' then 'Caffeine'
      else 'Gels'
    end
    when old_category in ('recovery') then case
      when lower(product_name) like '%massage%' then 'Massage Guns'
      when lower(product_name) like '%boot%' then 'Compression Boots'
      when lower(product_name) like '%mobility%' then 'Mobility Tools'
      when lower(product_name) like '%band%' then 'Resistance Bands'
      when lower(product_name) like '%ice%' or lower(product_name) like '%heat%' then 'Ice & Heat Therapy'
      when lower(product_name) like '%sandal%' then 'Recovery Sandals'
      else 'Foam Rollers'
    end
    when old_category in ('accessories', 'miscellaneous', 'eyewear') then case
      when old_category = 'eyewear' then 'Eyewear'
      when lower(product_name) like '%belt%' then 'Race Belts'
      when lower(product_name) like '%bag%' then 'Bags'
      when lower(product_name) like '%light%' then 'Lights'
      when lower(product_name) like '%phone%' then 'Phone Holders'
      when lower(product_name) like '%towel%' then 'Towels'
      when lower(product_name) like '%sunscreen%' then 'Sunscreen'
      when lower(product_name) like '%chafe%' then 'Anti-Chafe'
      else 'Miscellaneous'
    end
    else null
  end;
$$;

alter table public.product_catalog
  drop constraint if exists product_catalog_category_check;

alter table public.user_products
  drop constraint if exists user_products_category_check;

update public.product_catalog
set
  category = public.flatlay_marketplace_category(category),
  metadata = jsonb_strip_nulls(
    coalesce(metadata, '{}'::jsonb) ||
    case
      when coalesce(public.flatlay_marketplace_subcategory(category, name, metadata), '') <> ''
        then jsonb_build_object('subcategory', public.flatlay_marketplace_subcategory(category, name, metadata))
      else '{}'::jsonb
    end
  )
where category is distinct from public.flatlay_marketplace_category(category)
   or coalesce(metadata->>'subcategory', '') is distinct from coalesce(public.flatlay_marketplace_subcategory(category, name, metadata), '');

update public.user_products
set
  category = public.flatlay_marketplace_category(category),
  metadata = jsonb_strip_nulls(
    coalesce(metadata, '{}'::jsonb) ||
    case
      when coalesce(public.flatlay_marketplace_subcategory(category, name, metadata), '') <> ''
        then jsonb_build_object('subcategory', public.flatlay_marketplace_subcategory(category, name, metadata))
      else '{}'::jsonb
    end
  )
where category is distinct from public.flatlay_marketplace_category(category)
   or coalesce(metadata->>'subcategory', '') is distinct from coalesce(public.flatlay_marketplace_subcategory(category, name, metadata), '');

alter table public.product_catalog
  drop constraint if exists product_catalog_category_check;

alter table public.product_catalog
  add constraint product_catalog_category_check
  check (category in (
    'footwear',
    'apparel',
    'wearables',
    'bike',
    'swim',
    'hydration',
    'nutrition',
    'recovery',
    'accessories'
  ));

alter table public.user_products
  drop constraint if exists user_products_category_check;

alter table public.user_products
  add constraint user_products_category_check
  check (category in (
    'footwear',
    'apparel',
    'wearables',
    'bike',
    'swim',
    'hydration',
    'nutrition',
    'recovery',
    'accessories'
  ));

drop function if exists public.flatlay_marketplace_subcategory(text, text, jsonb);
drop function if exists public.flatlay_marketplace_category(text);

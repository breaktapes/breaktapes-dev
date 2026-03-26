alter table public.product_catalog
  drop constraint if exists product_catalog_category_check;

alter table public.product_catalog
  add constraint product_catalog_category_check
  check (category in (
    'shoes',
    'socks',
    'apparel',
    'headwear',
    'wearables',
    'bikes',
    'bike_components',
    'bike_maintenance',
    'indoor_training',
    'swim_gear',
    'recovery',
    'miscellaneous',
    'hydration',
    'nutrition',
    'accessories',
    'eyewear'
  ));

alter table public.user_products
  drop constraint if exists user_products_category_check;

alter table public.user_products
  add constraint user_products_category_check
  check (category in (
    'shoes',
    'socks',
    'apparel',
    'headwear',
    'wearables',
    'bikes',
    'bike_components',
    'bike_maintenance',
    'indoor_training',
    'swim_gear',
    'recovery',
    'miscellaneous',
    'hydration',
    'nutrition',
    'accessories',
    'eyewear'
  ));

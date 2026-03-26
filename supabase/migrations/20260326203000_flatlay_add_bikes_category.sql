alter table public.product_catalog
  drop constraint if exists product_catalog_category_check;

alter table public.product_catalog
  add constraint product_catalog_category_check
  check (category in (
    'shoes',
    'apparel',
    'wearables',
    'bikes',
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
    'apparel',
    'wearables',
    'bikes',
    'miscellaneous',
    'hydration',
    'nutrition',
    'accessories',
    'eyewear'
  ));

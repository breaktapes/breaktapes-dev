update public.product_catalog
set metadata = jsonb_strip_nulls(
  (coalesce(metadata, '{}'::jsonb) - 'subcategory') ||
  case
    when coalesce(metadata->>'primary_subcategory', '') <> '' then jsonb_build_object('primary_subcategory', metadata->>'primary_subcategory')
    when coalesce(metadata->>'subcategory', '') <> '' then jsonb_build_object('primary_subcategory', metadata->>'subcategory')
    else '{}'::jsonb
  end ||
  case
    when jsonb_typeof(metadata->'subcategories') = 'array' then jsonb_build_object('subcategories', metadata->'subcategories')
    when coalesce(metadata->>'primary_subcategory', '') <> '' then jsonb_build_object('subcategories', jsonb_build_array(metadata->>'primary_subcategory'))
    when coalesce(metadata->>'subcategory', '') <> '' then jsonb_build_object('subcategories', jsonb_build_array(metadata->>'subcategory'))
    else '{}'::jsonb
  end
)
where coalesce(metadata->>'subcategory', '') <> ''
   or coalesce(metadata->>'primary_subcategory', '') <> ''
   or jsonb_typeof(metadata->'subcategories') = 'array';

update public.user_products
set metadata = jsonb_strip_nulls(
  (coalesce(metadata, '{}'::jsonb) - 'subcategory') ||
  case
    when coalesce(metadata->>'primary_subcategory', '') <> '' then jsonb_build_object('primary_subcategory', metadata->>'primary_subcategory')
    when coalesce(metadata->>'subcategory', '') <> '' then jsonb_build_object('primary_subcategory', metadata->>'subcategory')
    else '{}'::jsonb
  end ||
  case
    when jsonb_typeof(metadata->'subcategories') = 'array' then jsonb_build_object('subcategories', metadata->'subcategories')
    when coalesce(metadata->>'primary_subcategory', '') <> '' then jsonb_build_object('subcategories', jsonb_build_array(metadata->>'primary_subcategory'))
    when coalesce(metadata->>'subcategory', '') <> '' then jsonb_build_object('subcategories', jsonb_build_array(metadata->>'subcategory'))
    else '{}'::jsonb
  end
)
where coalesce(metadata->>'subcategory', '') <> ''
   or coalesce(metadata->>'primary_subcategory', '') <> ''
   or jsonb_typeof(metadata->'subcategories') = 'array';

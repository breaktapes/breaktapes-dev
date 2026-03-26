create extension if not exists pgcrypto;

create table if not exists public.product_catalog (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('gear', 'apparel', 'nutrition')),
  brand text not null,
  name text not null,
  metadata jsonb not null default '{}'::jsonb,
  search_text tsvector generated always as (
    to_tsvector('simple', trim(coalesce(brand, '') || ' ' || coalesce(name, '')))
  ) stored,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists product_catalog_search_idx
  on public.product_catalog using gin (search_text);

create index if not exists product_catalog_category_idx
  on public.product_catalog (category);

create table if not exists public.user_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  catalog_product_id uuid references public.product_catalog(id) on delete set null,
  category text not null check (category in ('gear', 'apparel', 'nutrition')),
  brand text not null default '',
  name text not null,
  metadata jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists user_products_user_idx
  on public.user_products (user_id, created_at desc);

create unique index if not exists user_products_user_catalog_unique_idx
  on public.user_products (user_id, catalog_product_id)
  where catalog_product_id is not null;

create table if not exists public.flatlay_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'list',
  is_shareable boolean not null default false,
  share_slug text unique,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists flatlay_lists_user_idx
  on public.flatlay_lists (user_id, updated_at desc);

create table if not exists public.flatlay_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.flatlay_lists(id) on delete cascade,
  user_product_id uuid not null references public.user_products(id) on delete cascade,
  position integer not null default 0,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists flatlay_list_items_list_idx
  on public.flatlay_list_items (list_id, position asc);

create unique index if not exists flatlay_list_items_unique_idx
  on public.flatlay_list_items (list_id, user_product_id);

create table if not exists public.race_stacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  stack_mode text not null check (stack_mode in ('template', 'race')),
  sport_category text,
  distance_label text,
  race_label text,
  notes text,
  is_shareable boolean not null default false,
  share_slug text unique,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists race_stacks_user_idx
  on public.race_stacks (user_id, updated_at desc);

create table if not exists public.race_stack_items (
  id uuid primary key default gen_random_uuid(),
  race_stack_id uuid not null references public.race_stacks(id) on delete cascade,
  user_product_id uuid not null references public.user_products(id) on delete cascade,
  position integer not null default 0,
  quantity text,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists race_stack_items_stack_idx
  on public.race_stack_items (race_stack_id, position asc);

create unique index if not exists race_stack_items_unique_idx
  on public.race_stack_items (race_stack_id, user_product_id);

create or replace function public.touch_flatlay_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists flatlay_lists_updated_at on public.flatlay_lists;
create trigger flatlay_lists_updated_at
before update on public.flatlay_lists
for each row
execute function public.touch_flatlay_updated_at();

drop trigger if exists race_stacks_updated_at on public.race_stacks;
create trigger race_stacks_updated_at
before update on public.race_stacks
for each row
execute function public.touch_flatlay_updated_at();

alter table public.product_catalog enable row level security;
alter table public.user_products enable row level security;
alter table public.flatlay_lists enable row level security;
alter table public.flatlay_list_items enable row level security;
alter table public.race_stacks enable row level security;
alter table public.race_stack_items enable row level security;

drop policy if exists "product_catalog_read_all" on public.product_catalog;
create policy "product_catalog_read_all"
on public.product_catalog
for select
to anon, authenticated
using (true);

drop policy if exists "user_products_select_own" on public.user_products;
create policy "user_products_select_own"
on public.user_products
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_products_insert_own" on public.user_products;
create policy "user_products_insert_own"
on public.user_products
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_products_update_own" on public.user_products;
create policy "user_products_update_own"
on public.user_products
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_products_delete_own" on public.user_products;
create policy "user_products_delete_own"
on public.user_products
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "flatlay_lists_select_own" on public.flatlay_lists;
create policy "flatlay_lists_select_own"
on public.flatlay_lists
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "flatlay_lists_insert_own" on public.flatlay_lists;
create policy "flatlay_lists_insert_own"
on public.flatlay_lists
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "flatlay_lists_update_own" on public.flatlay_lists;
create policy "flatlay_lists_update_own"
on public.flatlay_lists
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "flatlay_lists_delete_own" on public.flatlay_lists;
create policy "flatlay_lists_delete_own"
on public.flatlay_lists
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "flatlay_list_items_select_own" on public.flatlay_list_items;
create policy "flatlay_list_items_select_own"
on public.flatlay_list_items
for select
to authenticated
using (
  exists (
    select 1
    from public.flatlay_lists l
    where l.id = list_id
      and l.user_id = auth.uid()
  )
);

drop policy if exists "flatlay_list_items_insert_own" on public.flatlay_list_items;
create policy "flatlay_list_items_insert_own"
on public.flatlay_list_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.flatlay_lists l
    where l.id = list_id
      and l.user_id = auth.uid()
  )
);

drop policy if exists "flatlay_list_items_update_own" on public.flatlay_list_items;
create policy "flatlay_list_items_update_own"
on public.flatlay_list_items
for update
to authenticated
using (
  exists (
    select 1
    from public.flatlay_lists l
    where l.id = list_id
      and l.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.flatlay_lists l
    where l.id = list_id
      and l.user_id = auth.uid()
  )
);

drop policy if exists "flatlay_list_items_delete_own" on public.flatlay_list_items;
create policy "flatlay_list_items_delete_own"
on public.flatlay_list_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.flatlay_lists l
    where l.id = list_id
      and l.user_id = auth.uid()
  )
);

drop policy if exists "race_stacks_select_own" on public.race_stacks;
create policy "race_stacks_select_own"
on public.race_stacks
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "race_stacks_insert_own" on public.race_stacks;
create policy "race_stacks_insert_own"
on public.race_stacks
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "race_stacks_update_own" on public.race_stacks;
create policy "race_stacks_update_own"
on public.race_stacks
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "race_stacks_delete_own" on public.race_stacks;
create policy "race_stacks_delete_own"
on public.race_stacks
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "race_stack_items_select_own" on public.race_stack_items;
create policy "race_stack_items_select_own"
on public.race_stack_items
for select
to authenticated
using (
  exists (
    select 1
    from public.race_stacks s
    where s.id = race_stack_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "race_stack_items_insert_own" on public.race_stack_items;
create policy "race_stack_items_insert_own"
on public.race_stack_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.race_stacks s
    where s.id = race_stack_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "race_stack_items_update_own" on public.race_stack_items;
create policy "race_stack_items_update_own"
on public.race_stack_items
for update
to authenticated
using (
  exists (
    select 1
    from public.race_stacks s
    where s.id = race_stack_id
      and s.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.race_stacks s
    where s.id = race_stack_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "race_stack_items_delete_own" on public.race_stack_items;
create policy "race_stack_items_delete_own"
on public.race_stack_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.race_stacks s
    where s.id = race_stack_id
      and s.user_id = auth.uid()
  )
);

grant usage on schema public to anon, authenticated;
grant select on public.product_catalog to anon, authenticated;
grant select, insert, update, delete on public.user_products to authenticated;
grant select, insert, update, delete on public.flatlay_lists to authenticated;
grant select, insert, update, delete on public.flatlay_list_items to authenticated;
grant select, insert, update, delete on public.race_stacks to authenticated;
grant select, insert, update, delete on public.race_stack_items to authenticated;

insert into public.product_catalog (category, brand, name, metadata)
values
  ('gear', 'Nike', 'Vaporfly 3', '{"sport":"running"}'::jsonb),
  ('gear', 'Garmin', 'Forerunner 965', '{"sport":"running"}'::jsonb),
  ('gear', 'Cervelo', 'P-Series', '{"sport":"triathlon"}'::jsonb),
  ('apparel', '2XU', 'Core Tri Suit', '{"sport":"triathlon"}'::jsonb),
  ('apparel', 'SAYSKY', 'Combat Singlet', '{"sport":"running"}'::jsonb),
  ('nutrition', 'Maurten', 'Gel 100', '{"fuel_type":"gel"}'::jsonb),
  ('nutrition', 'Precision Fuel & Hydration', 'PF 90 Gel', '{"fuel_type":"gel"}'::jsonb),
  ('nutrition', 'Skratch Labs', 'Sport Hydration Drink Mix', '{"fuel_type":"drink_mix"}'::jsonb),
  ('gear', 'TYR', 'Special Ops 3.0 Goggles', '{"sport":"swimming"}'::jsonb),
  ('gear', 'Wahoo', 'ELEMNT BOLT', '{"sport":"cycling"}'::jsonb)
on conflict do nothing;

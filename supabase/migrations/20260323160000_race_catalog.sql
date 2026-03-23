create table if not exists public.race_catalog (
  id          bigint generated always as identity primary key,
  name        text    not null,
  aliases     text[]  not null default '{}',
  type        text    not null,
  dist        text    not null,
  dist_km     numeric,
  custom_dist text,
  city        text    not null,
  country     text    not null,
  year        integer,
  event_date  date,
  month       integer,
  day         integer
);

create index if not exists race_catalog_name_idx on public.race_catalog (name);
create index if not exists race_catalog_year_idx on public.race_catalog (year);
create index if not exists race_catalog_aliases_idx on public.race_catalog using gin (aliases);

alter table public.race_catalog enable row level security;

drop policy if exists "race_catalog_public_read" on public.race_catalog;
create policy "race_catalog_public_read"
  on public.race_catalog
  for select
  to anon, authenticated
  using (true);

grant usage on schema public to anon, authenticated;
grant select on public.race_catalog to anon, authenticated;

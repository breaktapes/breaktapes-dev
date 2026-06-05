-- T100 (and other bot-protected timer) race results, harvested into our DB so
-- imports query our own table instead of live-scraping a bot-protected source.
-- Public read (anon), like race_catalog. Seeded out-of-band per event.

create extension if not exists pg_trgm;

create table if not exists public.t100_results (
  id               uuid primary key default gen_random_uuid(),
  event_name       text not null,
  event_date       date,
  race_name        text,            -- "70.3", "Olympic", "Age Group Men", etc.
  distance_m       integer,
  athlete_name     text not null,
  finish_time      text,            -- HH:MM:SS
  swim_time        text,
  t1_time          text,
  bike_time        text,
  t2_time          text,
  run_time         text,
  overall_position integer,
  gender_position  integer,
  category         text,
  country          text,
  bib              text,
  source           text default 'sportstats',
  created_at       timestamptz default now()
);

-- Trigram index for case-insensitive `ilike '%name%'` athlete search.
create index if not exists t100_results_name_trgm
  on public.t100_results using gin (athlete_name gin_trgm_ops);

-- Dedupe guard: one row per athlete per event+race.
create unique index if not exists t100_results_unique
  on public.t100_results (lower(athlete_name), lower(event_name), coalesce(lower(race_name), ''), coalesce(bib, ''));

alter table public.t100_results enable row level security;

drop policy if exists t100_results_anon_read on public.t100_results;
create policy t100_results_anon_read
  on public.t100_results for select
  to anon, authenticated
  using (true);

grant select on public.t100_results to anon, authenticated;

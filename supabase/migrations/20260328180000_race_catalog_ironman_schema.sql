alter table public.race_catalog
  add column if not exists discipline text,
  add column if not exists event_end_date date,
  add column if not exists venue text,
  add column if not exists region text,
  add column if not exists lat numeric,
  add column if not exists lng numeric,
  add column if not exists timezone text,
  add column if not exists source_site text,
  add column if not exists source_url text,
  add column if not exists registration_url text,
  add column if not exists source_page integer,
  add column if not exists series text,
  add column if not exists registration_status text,
  add column if not exists swim_type text,
  add column if not exists bike_profile text,
  add column if not exists run_profile text,
  add column if not exists air_temp_high_c numeric,
  add column if not exists air_temp_low_c numeric,
  add column if not exists water_temp_c numeric,
  add column if not exists humidity_pct numeric,
  add column if not exists wind_kph numeric,
  add column if not exists weather_profile_source text,
  add column if not exists course_summary text,
  add column if not exists surface text,
  add column if not exists elevation_profile text,
  add column if not exists source_priority integer,
  add column if not exists source_last_seen_at timestamptz;

create index if not exists race_catalog_source_url_idx on public.race_catalog (source_url);
create index if not exists race_catalog_event_date_idx on public.race_catalog (event_date);
create index if not exists race_catalog_discipline_idx on public.race_catalog (discipline);
create index if not exists race_catalog_type_event_date_idx on public.race_catalog (type, event_date);

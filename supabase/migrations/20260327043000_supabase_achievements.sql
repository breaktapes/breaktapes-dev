create extension if not exists pgcrypto;

create table if not exists public.achievement_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  group_key text not null,
  family_key text,
  kind text not null check (kind in ('single', 'ladder')),
  name text not null,
  description text not null,
  icon text not null default '🏆',
  sort_order integer not null default 0,
  criteria jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_races (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  race_key text not null,
  name text not null,
  type text,
  distance text,
  time text,
  city text,
  country text,
  date date,
  priority text,
  medal text,
  dist_km numeric,
  placing text,
  age_category text,
  age_category_pos text,
  gender_pos text,
  notes text,
  strava_id bigint,
  tri_segments jsonb not null default '{}'::jsonb,
  splits jsonb not null default '[]'::jsonb,
  raw_race jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, race_key)
);

create table if not exists public.race_achievement_context (
  user_race_id uuid primary key references public.user_races(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  elevation_gain_m integer,
  temperature_c numeric,
  start_time text,
  after_sunset boolean,
  negative_split boolean,
  almost_dnf boolean,
  hr_zone_45_pct numeric,
  injury_comeback boolean,
  solo_race boolean,
  desert_terrain boolean,
  mountain_trail boolean,
  coastal boolean,
  altitude_m integer,
  open_water boolean,
  official_pacer boolean,
  helped_first_timer boolean,
  run_club_years integer,
  bib_number text,
  cutoff_percentile numeric,
  photo_uploaded boolean,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id uuid not null references public.achievement_catalog(id) on delete cascade,
  source_race_id uuid references public.user_races(id) on delete set null,
  unlocked_at timestamptz not null default now(),
  proof jsonb not null default '{}'::jsonb,
  unique (user_id, achievement_id)
);

create index if not exists user_races_user_id_idx on public.user_races (user_id);
create index if not exists user_races_user_id_date_idx on public.user_races (user_id, date desc);
create index if not exists race_achievement_context_user_id_idx on public.race_achievement_context (user_id);
create index if not exists user_achievements_user_id_idx on public.user_achievements (user_id);
create index if not exists achievement_catalog_group_key_idx on public.achievement_catalog (group_key, sort_order);

create or replace function public.touch_user_races_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists user_races_updated_at on public.user_races;
create trigger user_races_updated_at
before update on public.user_races
for each row execute function public.touch_user_races_updated_at();

create or replace function public.touch_race_achievement_context_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists race_achievement_context_updated_at on public.race_achievement_context;
create trigger race_achievement_context_updated_at
before update on public.race_achievement_context
for each row execute function public.touch_race_achievement_context_updated_at();

alter table public.achievement_catalog enable row level security;
alter table public.user_races enable row level security;
alter table public.race_achievement_context enable row level security;
alter table public.user_achievements enable row level security;

drop policy if exists "achievement_catalog_public_read" on public.achievement_catalog;
create policy "achievement_catalog_public_read"
on public.achievement_catalog
for select
using (true);

drop policy if exists "user_races_select_own" on public.user_races;
create policy "user_races_select_own"
on public.user_races
for select
using (auth.uid() = user_id);

drop policy if exists "user_races_insert_own" on public.user_races;
create policy "user_races_insert_own"
on public.user_races
for insert
with check (auth.uid() = user_id);

drop policy if exists "user_races_update_own" on public.user_races;
create policy "user_races_update_own"
on public.user_races
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_races_delete_own" on public.user_races;
create policy "user_races_delete_own"
on public.user_races
for delete
using (auth.uid() = user_id);

drop policy if exists "race_achievement_context_select_own" on public.race_achievement_context;
create policy "race_achievement_context_select_own"
on public.race_achievement_context
for select
using (auth.uid() = user_id);

drop policy if exists "race_achievement_context_insert_own" on public.race_achievement_context;
create policy "race_achievement_context_insert_own"
on public.race_achievement_context
for insert
with check (auth.uid() = user_id);

drop policy if exists "race_achievement_context_update_own" on public.race_achievement_context;
create policy "race_achievement_context_update_own"
on public.race_achievement_context
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "race_achievement_context_delete_own" on public.race_achievement_context;
create policy "race_achievement_context_delete_own"
on public.race_achievement_context
for delete
using (auth.uid() = user_id);

drop policy if exists "user_achievements_select_own" on public.user_achievements;
create policy "user_achievements_select_own"
on public.user_achievements
for select
using (auth.uid() = user_id);

drop policy if exists "user_achievements_insert_own" on public.user_achievements;
create policy "user_achievements_insert_own"
on public.user_achievements
for insert
with check (auth.uid() = user_id);

drop policy if exists "user_achievements_update_own" on public.user_achievements;
create policy "user_achievements_update_own"
on public.user_achievements
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_achievements_delete_own" on public.user_achievements;
create policy "user_achievements_delete_own"
on public.user_achievements
for delete
using (auth.uid() = user_id);

grant select on public.achievement_catalog to anon, authenticated;
grant select, insert, update, delete on public.user_races to authenticated;
grant select, insert, update, delete on public.race_achievement_context to authenticated;
grant select, insert, update, delete on public.user_achievements to authenticated;

with seeded(slug, group_key, family_key, kind, name, description, icon, sort_order, criteria) as (
  values
    ('climb_crusher','special',null,'single','Climb Crusher','Completed a race with 500m+ elevation gain','⛰️',10,'{"type":"context_threshold","field":"elevation_gain_m","op":"gte","value":500}'::jsonb),
    ('heat_warrior','special',null,'single','Heat Warrior','Finished a race above 30°C','🔥',20,'{"type":"context_threshold","field":"temperature_c","op":"gt","value":30}'::jsonb),
    ('night_runner','special',null,'single','Night Runner','Completed a race starting after sunset','🌙',30,'{"type":"context_flag","field":"after_sunset"}'::jsonb),
    ('negative_split_master','special',null,'single','Negative Split Master','Ran a race with a faster second half','⚡',40,'{"type":"context_flag","field":"negative_split"}'::jsonb),
    ('no_quit','special',null,'single','No Quit','Finished a race you almost DNF’d','🫀',50,'{"type":"context_flag","field":"almost_dnf"}'::jsonb),
    ('pain_cave','special',null,'single','Pain Cave','HR in Zone 4/5 for 70%+ of race','❤️',60,'{"type":"context_threshold","field":"hr_zone_45_pct","op":"gte","value":70}'::jsonb),
    ('comeback_run','special',null,'single','Comeback Run','Race after injury break','🔁',70,'{"type":"context_flag","field":"injury_comeback"}'::jsonb),
    ('solo_warrior','special',null,'single','Solo Warrior','No pacer, no group, full solo race','🪖',80,'{"type":"context_flag","field":"solo_race"}'::jsonb),
    ('desert_runner','special',null,'single','Desert Runner','Race in desert terrain','🏜️',90,'{"type":"context_flag","field":"desert_terrain"}'::jsonb),
    ('mountain_goat','special',null,'single','Mountain Goat','Trail race with elevation','🐐',100,'{"type":"context_flag","field":"mountain_trail"}'::jsonb),
    ('sea_level_sprinter','special',null,'single','Sea Level Sprinter','Coastal race','🌊',110,'{"type":"context_flag","field":"coastal"}'::jsonb),
    ('stamp_collector','special',null,'single','Stamp Collector','10 different race cities','📮',120,'{"type":"city_count","value":10}'::jsonb),
    ('continental','special',null,'single','Continental','Race on 3+ continents','🌍',130,'{"type":"continent_count","value":3}'::jsonb),
    ('race_tourist','special',null,'single','Race Tourist','5 races in different countries','🧳',140,'{"type":"country_count","value":5}'::jsonb),
    ('season_finisher','special',null,'single','Season Finisher','5+ races in a year','📆',150,'{"type":"year_race_count","value":5}'::jsonb),
    ('double_trouble','special',null,'single','Double Trouble','Two races in 7 days','✌️',160,'{"type":"gap_days","count":2,"days":7}'::jsonb),
    ('sprint_specialist','special',null,'single','Sprint Specialist','5x 5K races','💨',170,'{"type":"distance_count","distance":"5KM","value":5}'::jsonb),
    ('half_collector','special',null,'single','Half Collector','10 half marathons','🌓',180,'{"type":"distance_count","distance":"Half Marathon","value":10}'::jsonb),
    ('marathoner_plus','special',null,'single','Marathoner+','5 marathons','🏛️',190,'{"type":"distance_count","distance":"Marathon","value":5}'::jsonb),
    ('ultra_initiate','special',null,'single','Ultra Initiate','First 50K','🏔️',200,'{"type":"distance_count","distance":"50KM","value":1}'::jsonb),
    ('ultra_elite','special',null,'single','Ultra Elite','100K completed','🦅',210,'{"type":"distance_count","distance":"100KM","value":1}'::jsonb),
    ('hundred_miler','special',null,'single','Hundred Miler','100-mile finish','💯',220,'{"type":"distance_count","distance":"100 Mile","value":1}'::jsonb),
    ('iron_mind','special',null,'single','Iron Mind','Finished 70.3','🔱',230,'{"type":"distance_count","distance":"70.3 / Half Ironman","value":1}'::jsonb),
    ('full_send','special',null,'single','Full Send','Completed a Full Ironman','🛡️',240,'{"type":"distance_count","distance":"Ironman / Full","value":1}'::jsonb),
    ('swim_survivor','special',null,'single','Swim Survivor','Open water race finish','🏊',250,'{"type":"context_flag","field":"open_water"}'::jsonb),
    ('pacemaker','special',null,'single','Pacemaker','Official pacer role','⏱️',260,'{"type":"context_flag","field":"official_pacer"}'::jsonb),
    ('first_timer_guide','special',null,'single','First Timer Guide','Helped someone finish first race','🤝',270,'{"type":"context_flag","field":"helped_first_timer"}'::jsonb),
    ('club_loyalist','special',null,'single','Club Loyalist','3+ years with a run club','🏃‍♂️',280,'{"type":"context_threshold","field":"run_club_years","op":"gte","value":3}'::jsonb),
    ('photo_finish','special',null,'single','Photo Finish','Race photo uploaded','📸',290,'{"type":"context_flag","field":"photo_uploaded"}'::jsonb),
    ('early_bird','special',null,'single','Early Bird','Race start before 6AM','🌅',300,'{"type":"start_time_before","value":"06:00"}'::jsonb),
    ('bib_collector','special',null,'single','Bib Collector','25 race bibs','🎽',310,'{"type":"bib_count","value":25}'::jsonb),
    ('medal_wall','special',null,'single','Medal Wall','50 medals collected','🏅',320,'{"type":"race_count","value":50}'::jsonb),
    ('lucky_number','special',null,'single','Lucky Number','Same bib number twice','🍀',330,'{"type":"duplicate_bib"}'::jsonb),
    ('back_to_back_ultra','special',null,'single','Back-to-Back Ultra','2 ultras in a week','🧱',340,'{"type":"ultra_gap_days","count":2,"days":7}'::jsonb),
    ('comrades_marathon_finisher','special',null,'single','Comrades Marathon Finisher','Completed the Comrades Marathon','🔥',350,'{"type":"race_name_match","value":"comrades marathon"}'::jsonb),
    ('six_star_journey_started','special',null,'single','Six Star Journey Started','Completed your first World Major','⭐',360,'{"type":"world_major_count","value":1}'::jsonb),
    ('six_star_marathon_finisher','special',null,'single','Six Star Marathon Finisher','Completed all six World Marathon Majors','🌟',370,'{"type":"world_major_count","value":6}'::jsonb),
    ('extreme_conditions','special',null,'single','Extreme Conditions','Race above 3,000m altitude','🗻',380,'{"type":"context_threshold","field":"altitude_m","op":"gt","value":3000}'::jsonb),
    ('cutoff_survivor','special',null,'single','Cutoff Survivor','Finished within last 5%','⏳',390,'{"type":"context_threshold","field":"cutoff_percentile","op":"lte","value":5}'::jsonb),
    ('10k_first_gear','ladder','10k','ladder','First Gear','10K under 60 minutes','🏁',1000,'{"type":"pb_seconds","distance":"10KM","seconds":3600}'::jsonb),
    ('10k_steady_roll','ladder','10k','ladder','Steady Roll','10K under 55 minutes','🏁',1010,'{"type":"pb_seconds","distance":"10KM","seconds":3300}'::jsonb),
    ('10k_breaking_rhythm','ladder','10k','ladder','Breaking Rhythm','10K under 50 minutes','🏁',1020,'{"type":"pb_seconds","distance":"10KM","seconds":3000}'::jsonb),
    ('10k_locked_in','ladder','10k','ladder','Locked In','10K under 45 minutes','🏁',1030,'{"type":"pb_seconds","distance":"10KM","seconds":2700}'::jsonb),
    ('10k_sharp_pace','ladder','10k','ladder','Sharp Pace','10K under 40 minutes','🏁',1040,'{"type":"pb_seconds","distance":"10KM","seconds":2400}'::jsonb),
    ('10k_speed_control','ladder','10k','ladder','Speed Control','10K under 35 minutes','🏁',1050,'{"type":"pb_seconds","distance":"10KM","seconds":2100}'::jsonb),
    ('10k_velocity_elite','ladder','10k','ladder','Velocity Elite','10K under 30 minutes','🏁',1060,'{"type":"pb_seconds","distance":"10KM","seconds":1800}'::jsonb),
    ('half_half_starter','ladder','half_marathon','ladder','Half Starter','Half marathon under 2:30','🌓',1100,'{"type":"pb_seconds","distance":"Half Marathon","seconds":9000}'::jsonb),
    ('half_finding_flow','ladder','half_marathon','ladder','Finding Flow','Half marathon under 2:20','🌓',1110,'{"type":"pb_seconds","distance":"Half Marathon","seconds":8400}'::jsonb),
    ('half_built_engine','ladder','half_marathon','ladder','Built Engine','Half marathon under 2:10','🌓',1120,'{"type":"pb_seconds","distance":"Half Marathon","seconds":7800}'::jsonb),
    ('half_strong_hold','ladder','half_marathon','ladder','Strong Hold','Half marathon under 2:00','🌓',1130,'{"type":"pb_seconds","distance":"Half Marathon","seconds":7200}'::jsonb),
    ('half_pace_driver','ladder','half_marathon','ladder','Pace Driver','Half marathon under 1:50','🌓',1140,'{"type":"pb_seconds","distance":"Half Marathon","seconds":6600}'::jsonb),
    ('half_subtle_shift','ladder','half_marathon','ladder','Subtle Shift','Half marathon under 1:45','🌓',1150,'{"type":"pb_seconds","distance":"Half Marathon","seconds":6300}'::jsonb),
    ('half_double_digits','ladder','half_marathon','ladder','Double Digits','Half marathon under 1:40','🌓',1160,'{"type":"pb_seconds","distance":"Half Marathon","seconds":6000}'::jsonb),
    ('half_on_the_edge','ladder','half_marathon','ladder','On The Edge','Half marathon under 1:35','🌓',1170,'{"type":"pb_seconds","distance":"Half Marathon","seconds":5700}'::jsonb),
    ('half_half_elite','ladder','half_marathon','ladder','Half Elite','Half marathon under 1:30','🌓',1180,'{"type":"pb_seconds","distance":"Half Marathon","seconds":5400}'::jsonb),
    ('half_sharp_operator','ladder','half_marathon','ladder','Sharp Operator','Half marathon under 1:25','🌓',1190,'{"type":"pb_seconds","distance":"Half Marathon","seconds":5100}'::jsonb),
    ('half_speed_endurance','ladder','half_marathon','ladder','Speed Endurance','Half marathon under 1:20','🌓',1200,'{"type":"pb_seconds","distance":"Half Marathon","seconds":4800}'::jsonb),
    ('half_precision_runner','ladder','half_marathon','ladder','Precision Runner','Half marathon under 1:15','🌓',1210,'{"type":"pb_seconds","distance":"Half Marathon","seconds":4500}'::jsonb),
    ('half_top_tier','ladder','half_marathon','ladder','Top Tier','Half marathon under 1:05','🌓',1220,'{"type":"pb_seconds","distance":"Half Marathon","seconds":3900}'::jsonb),
    ('half_unreal_territory','ladder','half_marathon','ladder','Unreal Territory','Half marathon under 60 minutes','🌓',1230,'{"type":"pb_seconds","distance":"Half Marathon","seconds":3600}'::jsonb),
    ('marathon_first_marathoner','ladder','marathon','ladder','First Marathoner','Marathon under 5:00','🏛️',1300,'{"type":"pb_seconds","distance":"Marathon","seconds":18000}'::jsonb),
    ('marathon_settling_in','ladder','marathon','ladder','Settling In','Marathon under 4:30','🏛️',1310,'{"type":"pb_seconds","distance":"Marathon","seconds":16200}'::jsonb),
    ('marathon_sub4_club','ladder','marathon','ladder','Sub-4 Club','Marathon under 4:00','🏛️',1320,'{"type":"pb_seconds","distance":"Marathon","seconds":14400}'::jsonb),
    ('marathon_rising_standard','ladder','marathon','ladder','Rising Standard','Marathon under 3:45','🏛️',1330,'{"type":"pb_seconds","distance":"Marathon","seconds":13500}'::jsonb),
    ('marathon_serious_runner','ladder','marathon','ladder','Serious Runner','Marathon under 3:30','🏛️',1340,'{"type":"pb_seconds","distance":"Marathon","seconds":12600}'::jsonb),
    ('marathon_competitive_edge','ladder','marathon','ladder','Competitive Edge','Marathon under 3:15','🏛️',1350,'{"type":"pb_seconds","distance":"Marathon","seconds":11700}'::jsonb),
    ('marathon_elite_barrier','ladder','marathon','ladder','Elite Barrier','Marathon under 3:00','🏛️',1360,'{"type":"pb_seconds","distance":"Marathon","seconds":10800}'::jsonb),
    ('marathon_breaking_limits','ladder','marathon','ladder','Breaking Limits','Marathon under 2:55','🏛️',1370,'{"type":"pb_seconds","distance":"Marathon","seconds":10500}'::jsonb),
    ('marathon_precision_pace','ladder','marathon','ladder','Precision Pace','Marathon under 2:50','🏛️',1380,'{"type":"pb_seconds","distance":"Marathon","seconds":10200}'::jsonb),
    ('marathon_high_performance','ladder','marathon','ladder','High Performance','Marathon under 2:45','🏛️',1390,'{"type":"pb_seconds","distance":"Marathon","seconds":9900}'::jsonb),
    ('marathon_advanced_tier','ladder','marathon','ladder','Advanced Tier','Marathon under 2:40','🏛️',1400,'{"type":"pb_seconds","distance":"Marathon","seconds":9600}'::jsonb),
    ('marathon_national_level','ladder','marathon','ladder','National Level','Marathon under 2:35','🏛️',1410,'{"type":"pb_seconds","distance":"Marathon","seconds":9300}'::jsonb),
    ('marathon_elite_class','ladder','marathon','ladder','Elite Class','Marathon under 2:30','🏛️',1420,'{"type":"pb_seconds","distance":"Marathon","seconds":9000}'::jsonb),
    ('marathon_sub_elite','ladder','marathon','ladder','Sub-Elite','Marathon under 2:25','🏛️',1430,'{"type":"pb_seconds","distance":"Marathon","seconds":8700}'::jsonb),
    ('marathon_world_class','ladder','marathon','ladder','World Class','Marathon under 2:20','🏛️',1440,'{"type":"pb_seconds","distance":"Marathon","seconds":8400}'::jsonb),
    ('ultra_50k_entry','ladder','ultra','ladder','Ultra Entry','50K under 6:00','🏔️',1500,'{"type":"pb_seconds","distance":"50KM","seconds":21600}'::jsonb),
    ('ultra_50k_endurance_builder','ladder','ultra','ladder','Endurance Builder','50K under 5:30','🏔️',1510,'{"type":"pb_seconds","distance":"50KM","seconds":19800}'::jsonb),
    ('ultra_50k_ultra_control','ladder','ultra','ladder','Ultra Control','50K under 5:00','🏔️',1520,'{"type":"pb_seconds","distance":"50KM","seconds":18000}'::jsonb),
    ('ultra_50k_ultra_strong','ladder','ultra','ladder','Ultra Strong','50K under 4:30','🏔️',1530,'{"type":"pb_seconds","distance":"50KM","seconds":16200}'::jsonb),
    ('ultra_50k_ultra_elite','ladder','ultra','ladder','Ultra Elite','50K under 4:00','🏔️',1540,'{"type":"pb_seconds","distance":"50KM","seconds":14400}'::jsonb),
    ('ultra_100k_century_runner','ladder','ultra','ladder','Century Runner','100K under 12:00','🏔️',1550,'{"type":"pb_seconds","distance":"100KM","seconds":43200}'::jsonb),
    ('ultra_100m_hundred_legend','ladder','ultra','ladder','Hundred Legend','100 Mile under 24:00','🏔️',1560,'{"type":"pb_seconds","distance":"100 Mile","seconds":86400}'::jsonb),
    ('tri703_half_iron_entry','ladder','ironman_703','ladder','Half Iron Entry','70.3 under 6:00','🔱',1600,'{"type":"pb_seconds","distance":"70.3 / Half Ironman","seconds":21600}'::jsonb),
    ('tri703_building_strength','ladder','ironman_703','ladder','Building Strength','70.3 under 5:30','🔱',1610,'{"type":"pb_seconds","distance":"70.3 / Half Ironman","seconds":19800}'::jsonb),
    ('tri703_iron_control','ladder','ironman_703','ladder','Iron Control','70.3 under 5:00','🔱',1620,'{"type":"pb_seconds","distance":"70.3 / Half Ironman","seconds":18000}'::jsonb),
    ('tri703_competitive_field','ladder','ironman_703','ladder','Competitive Field','70.3 under 4:45','🔱',1630,'{"type":"pb_seconds","distance":"70.3 / Half Ironman","seconds":17100}'::jsonb),
    ('tri703_sharp_execution','ladder','ironman_703','ladder','Sharp Execution','70.3 under 4:30','🔱',1640,'{"type":"pb_seconds","distance":"70.3 / Half Ironman","seconds":16200}'::jsonb),
    ('tri703_elite_amateur','ladder','ironman_703','ladder','Elite Amateur','70.3 under 4:15','🔱',1650,'{"type":"pb_seconds","distance":"70.3 / Half Ironman","seconds":15300}'::jsonb),
    ('tri703_iron_elite','ladder','ironman_703','ladder','Iron Elite','70.3 under 4:00','🔱',1660,'{"type":"pb_seconds","distance":"70.3 / Half Ironman","seconds":14400}'::jsonb),
    ('ironman_full_iron_finisher','ladder','ironman_full','ladder','Iron Finisher','Full Ironman under 12:00','🛡️',1700,'{"type":"pb_seconds","distance":"Ironman / Full","seconds":43200}'::jsonb),
    ('ironman_full_iron_builder','ladder','ironman_full','ladder','Iron Builder','Full Ironman under 11:30','🛡️',1710,'{"type":"pb_seconds","distance":"Ironman / Full","seconds":41400}'::jsonb),
    ('ironman_full_strong_iron','ladder','ironman_full','ladder','Strong Iron','Full Ironman under 11:00','🛡️',1720,'{"type":"pb_seconds","distance":"Ironman / Full","seconds":39600}'::jsonb),
    ('ironman_full_iron_competitor','ladder','ironman_full','ladder','Iron Competitor','Full Ironman under 10:30','🛡️',1730,'{"type":"pb_seconds","distance":"Ironman / Full","seconds":37800}'::jsonb),
    ('ironman_full_sub10_club','ladder','ironman_full','ladder','Sub-10 Club','Full Ironman under 10:00','🛡️',1740,'{"type":"pb_seconds","distance":"Ironman / Full","seconds":36000}'::jsonb),
    ('ironman_full_elite_iron','ladder','ironman_full','ladder','Elite Iron','Full Ironman under 9:30','🛡️',1750,'{"type":"pb_seconds","distance":"Ironman / Full","seconds":34200}'::jsonb),
    ('ironman_full_world_tier','ladder','ironman_full','ladder','World Tier','Full Ironman under 9:00','🛡️',1760,'{"type":"pb_seconds","distance":"Ironman / Full","seconds":32400}'::jsonb)
)
insert into public.achievement_catalog (slug, group_key, family_key, kind, name, description, icon, sort_order, criteria)
select slug, group_key, family_key, kind, name, description, icon, sort_order, criteria
from seeded
on conflict (slug) do update
set group_key = excluded.group_key,
    family_key = excluded.family_key,
    kind = excluded.kind,
    name = excluded.name,
    description = excluded.description,
    icon = excluded.icon,
    sort_order = excluded.sort_order,
    criteria = excluded.criteria,
    is_active = true;

insert into public.user_races (
  user_id, race_key, name, type, distance, time, city, country, date, priority, medal, dist_km,
  placing, age_category, age_category_pos, gender_pos, notes, strava_id, tri_segments, splits, raw_race
)
select
  us.user_id,
  coalesce(race->>'id', md5(race::text)),
  coalesce(race->>'name', 'Race'),
  race->>'type',
  race->>'distance',
  race->>'time',
  race->>'city',
  race->>'country',
  nullif(race->>'date', '')::date,
  race->>'priority',
  race->>'medal',
  nullif(race->>'distKm', '')::numeric,
  race->>'placing',
  race->>'ageCategory',
  race->>'ageCategoryPos',
  race->>'genderPos',
  race->>'notes',
  nullif(race->>'strava_id', '')::bigint,
  coalesce(race->'triSegments', '{}'::jsonb),
  coalesce(race->'splits', '[]'::jsonb),
  race
from public.user_state us
cross join lateral jsonb_array_elements(coalesce(us.races, '[]'::jsonb)) race
on conflict (user_id, race_key) do update
set name = excluded.name,
    type = excluded.type,
    distance = excluded.distance,
    time = excluded.time,
    city = excluded.city,
    country = excluded.country,
    date = excluded.date,
    priority = excluded.priority,
    medal = excluded.medal,
    dist_km = excluded.dist_km,
    placing = excluded.placing,
    age_category = excluded.age_category,
    age_category_pos = excluded.age_category_pos,
    gender_pos = excluded.gender_pos,
    notes = excluded.notes,
    strava_id = excluded.strava_id,
    tri_segments = excluded.tri_segments,
    splits = excluded.splits,
    raw_race = excluded.raw_race;

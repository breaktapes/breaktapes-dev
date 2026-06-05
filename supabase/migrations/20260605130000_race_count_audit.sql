-- Daily race-count integrity audit — standing safety net for the data-loss class
-- fixed in v0.7.6.12 (server-side state merge). Snapshots every user's race /
-- upcoming counts once a day; the race_count_drops view flags any account whose
-- count fell vs its previous snapshot (especially →0), so a wipe is caught the
-- moment it happens instead of via a user complaint.

create extension if not exists pg_cron;

create table if not exists public.race_count_audit (
  id bigint generated always as identity primary key,
  user_id  text not null,
  races    int  not null,
  upcoming int  not null,
  captured_at timestamptz not null default now()
);
create index if not exists race_count_audit_user_idx
  on public.race_count_audit (user_id, captured_at desc);

-- Service role only (admin Worker). No anon / authenticated access.
alter table public.race_count_audit enable row level security;

-- One snapshot row per user per run. SECURITY DEFINER so the cron job (postgres)
-- reads user_state regardless of RLS.
create or replace function public.snapshot_race_counts()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.race_count_audit (user_id, races, upcoming)
  select user_id,
         coalesce(jsonb_array_length(state_json->'races'), 0),
         coalesce(jsonb_array_length(state_json->'upcoming_races'), 0)
  from public.user_state;
$$;

-- Drop detector: latest snapshot per user vs the one before it; surface decreases.
create or replace view public.race_count_drops as
with snaps as (
  select user_id, races, upcoming, captured_at,
         lag(races) over (partition by user_id order by captured_at) as prev_races,
         row_number() over (partition by user_id order by captured_at desc) as rn
  from public.race_count_audit
)
select user_id,
       prev_races,
       races as current_races,
       (prev_races - races) as lost,
       captured_at
from snaps
where rn = 1 and prev_races is not null and races < prev_races
order by (prev_races - races) desc;

-- Daily at 02:17 UTC. cron.schedule replaces an existing job of the same name,
-- so this migration is safe to re-run.
select cron.schedule('race-count-snapshot', '17 2 * * *', $$select public.snapshot_race_counts();$$);

-- Seed a baseline immediately so drops are detectable from the next run.
select public.snapshot_race_counts();

-- Race count audit daily snapshot. Snapshots per-user race + upcoming counts
-- nightly via pg_cron and exposes a `race_count_drops` view that surfaces any
-- user whose latest snapshot has fewer races than the prior one (data-loss
-- early warning). Already applied to staging + prod; this file restores parity
-- between the local migrations dir and the remote schema_migrations table.

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

alter table public.race_count_audit enable row level security;

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

create or replace view public.race_count_drops as
with snaps as (
  select user_id, races, upcoming, captured_at,
         lag(races) over (partition by user_id order by captured_at) as prev_races,
         row_number() over (partition by user_id order by captured_at desc) as rn
  from public.race_count_audit
)
select user_id, prev_races, races as current_races,
       (prev_races - races) as lost, captured_at
from snaps
where rn = 1 and prev_races is not null and races < prev_races
order by (prev_races - races) desc;

-- The pg_cron schedule + initial snapshot were already executed on the remote;
-- guarded with DO blocks here so this file is idempotent.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'race-count-snapshot') then
    perform cron.schedule('race-count-snapshot', '17 2 * * *', $cron$select public.snapshot_race_counts();$cron$);
  end if;
end$$;

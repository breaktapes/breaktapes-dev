# T100 results — harvested data for `t100_results`

Finisher data for T100 Triathlon World Tour events, scraped from sportstats.one
and loaded into the Supabase `t100_results` table (the import dialog queries it by
athlete name). sportstats.one is bot-protected, but its results API
(`public.sportstats.one/getsortedresults?rid={raceId}&sort=overall&timeType=chip&offset=&limit=`)
is open, so we harvest per-leaderboard into CSV.

## Files
One CSV per race leaderboard. Columns match `t100_results` exactly:
`event_name, event_date, race_name, distance_m, athlete_name, finish_time,
swim_time, bike_time, run_time, overall_position, category, country, bib, source`

- `t100-london-2025.csv` — London Age Group (100km), 1272 finishers
- `t100-london-2025-olympic.csv` — London Olympic, 1513
- `t100-london-144548.csv` / `-144549.csv` — London Sprint / Super Sprint
- `t100-dubai-*.csv` — Dubai T100 / Age Group / Sprint (×2) / Pro Men/Women / T100 Pro Men/Women

Finishers only (`latest.lbl === "Finish"`); DNF/DNS excluded.

## Loading
Supabase dashboard → Table Editor → `t100_results` → Import data from CSV → pick a
file (columns auto-map) → Import. Do it for prod and staging. The unique index
(lower(name), lower(event), race, bib) makes re-imports idempotent.

## Re-harvesting / new events
1. Open the leaderboard once in a real/headed browser (passes the bot check); note
   the race name + row-1 Swim Finish / Bike Finish cumulative times.
2. The split checkpoint ids are auto-detected by matching those cumulatives against
   the API's per-checkpoint `cd` (cumulative) values.
3. Paginate `getsortedresults` (limit 100) over `info.total`, keep finishers,
   compute swim = swim_cum, bike = bike_cum − swim_cum, run = finish − bike_cum.

`scripts/seed-t100.mjs` bulk-loads a harvested JSON via the Supabase REST API when
a `SUPABASE_SERVICE_KEY` is available (alternative to dashboard import).

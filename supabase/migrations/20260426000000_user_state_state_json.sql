-- Add the state_json JSONB blob the React app writes to. The original
-- table used per-slice columns (races, athlete, next_race, upcoming_races);
-- the rewrite in commit 8d7819a switched to a single blob but the schema
-- change was never committed. Sync has been a no-op since 2026-04-23.

ALTER TABLE public.user_state
  ADD COLUMN IF NOT EXISTS state_json jsonb;

-- Backfill any pre-existing rows from the legacy per-slice columns.
-- Both prod and staging currently have zero rows, but staging fixtures
-- and any future restore-from-backup will land here, so this stays
-- defensive and idempotent.
UPDATE public.user_state
SET state_json = jsonb_strip_nulls(jsonb_build_object(
  'races',          races,
  'athlete',        athlete,
  'next_race',      next_race,
  'upcoming_races', upcoming_races
))
WHERE state_json IS NULL;

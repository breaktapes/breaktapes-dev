-- Adds competitor.com event id to race_catalog.
--
-- Set only on IRONMAN / 70.3 / 5150 rows imported from the ironman.com →
-- competitor.com crawl (scripts/scrape-ironman-catalog.mjs). Powers the
-- race-picker import: given this id, the health-proxy /import/ironman-event
-- route returns that event's finishers with official swim/T1/bike/T2/run
-- splits in a single upstream call (then edge-cached per event).
--
-- Null for every existing (running/cycling/etc.) catalog row. Idempotent.

ALTER TABLE public.race_catalog
  ADD COLUMN IF NOT EXISTS competitor_event_id text;

-- Unique partial index: the race-picker only queries rows that HAVE an id, and
-- each competitor event maps to exactly one catalog row. UNIQUE also gives the
-- loader (scripts/load-ironman-catalog.mjs) an on_conflict target for idempotent
-- upserts. NULL rows (every non-IRONMAN race) are exempt from the constraint.
CREATE UNIQUE INDEX IF NOT EXISTS race_catalog_competitor_event_id_idx
  ON public.race_catalog (competitor_event_id)
  WHERE competitor_event_id IS NOT NULL;

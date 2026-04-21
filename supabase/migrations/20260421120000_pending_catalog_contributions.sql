-- pending_catalog_contributions: user-submitted races awaiting admin review
-- Admin promotes via Supabase SQL editor (no in-app admin UI for v1)

CREATE TABLE public.pending_catalog_contributions (
  id                 bigint generated always as identity primary key,
  name               text not null,
  city               text not null,
  country            text not null,
  sport              text not null,
  dist_label         text,
  dist_km            numeric,
  year               integer,
  event_date         date,
  month              integer,
  day                integer,
  contributor_id     uuid references auth.users(id),
  contributor_count  integer default 1,
  status             text default 'pending',
  created_at         timestamptz default now()
);

ALTER TABLE pending_catalog_contributions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own contributions
CREATE POLICY "users_can_contribute"
  ON pending_catalog_contributions FOR INSERT
  TO authenticated
  WITH CHECK (contributor_id = auth.uid());

-- Unique index for ON CONFLICT dedup (double-parens required for expression indexes)
-- NULL year is non-deduplicable (NULL != NULL in Postgres indexes) — handled in RPC
CREATE UNIQUE INDEX pending_catalog_unique
  ON pending_catalog_contributions ((lower(name)), (lower(city)), year)
  WHERE status = 'pending' AND year IS NOT NULL;

-- ── RPC: upsert_catalog_contribution ────────────────────────────────────────
-- SECURITY DEFINER so it can read contributor counts without exposing the table to anon.
-- Spam guard: max 5 contributions per user per 24 hours.
-- NULL year always inserts (no dedup possible).
-- Skips silently if already in race_catalog for same name+city+year.
CREATE OR REPLACE FUNCTION upsert_catalog_contribution(
  p_name           text,
  p_city           text,
  p_country        text,
  p_sport          text,
  p_dist_label     text,
  p_dist_km        numeric,
  p_year           integer,
  p_event_date     date,
  p_month          integer,
  p_day            integer,
  p_contributor_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  today_count integer;
BEGIN
  -- Spam guard
  SELECT COUNT(*) INTO today_count
  FROM pending_catalog_contributions
  WHERE contributor_id = p_contributor_id
    AND created_at >= now() - interval '24 hours';
  IF today_count >= 5 THEN RETURN; END IF;

  -- NULL year: non-deduplicable — always insert
  IF p_year IS NULL THEN
    INSERT INTO pending_catalog_contributions
      (name, city, country, sport, dist_label, dist_km, year, event_date, month, day, contributor_id)
    VALUES
      (p_name, p_city, p_country, p_sport, p_dist_label, p_dist_km, NULL, p_event_date, p_month, p_day, p_contributor_id);
    RETURN;
  END IF;

  -- Skip if already live in race_catalog
  IF EXISTS (
    SELECT 1 FROM race_catalog
    WHERE lower(name) = lower(p_name)
      AND lower(city)  = lower(p_city)
      AND year = p_year
  ) THEN RETURN; END IF;

  -- Upsert: increment contributor_count if pending row exists, otherwise insert
  INSERT INTO pending_catalog_contributions
    (name, city, country, sport, dist_label, dist_km, year, event_date, month, day, contributor_id)
  VALUES
    (p_name, p_city, p_country, p_sport, p_dist_label, p_dist_km, p_year, p_event_date, p_month, p_day, p_contributor_id)
  ON CONFLICT ((lower(name)), (lower(city)), year) WHERE status = 'pending'
  DO UPDATE SET contributor_count = pending_catalog_contributions.contributor_count + 1;
END;
$$;

-- ── Admin promotion queries (run in Supabase SQL editor) ────────────────────
--
-- Review pending, highest contributor_count first:
--   SELECT id, name, city, country, sport, dist_km, year, event_date, contributor_count
--   FROM pending_catalog_contributions
--   WHERE status = 'pending'
--   ORDER BY contributor_count DESC, created_at ASC;
--
-- Promote (idempotent):
--   INSERT INTO race_catalog (name, city, country, type, dist, dist_km, year, event_date, month, day)
--   SELECT
--     name, city, country,
--     CASE lower(sport)
--       WHEN 'running'   THEN 'run'
--       WHEN 'triathlon' THEN 'tri'
--       WHEN 'cycling'   THEN 'cycle'
--       WHEN 'swimming'  THEN 'swim'
--       WHEN 'hyrox'     THEN 'hyrox'
--       ELSE lower(sport)
--     END,
--     COALESCE(dist_label, dist_km::text),
--     dist_km, year, event_date, month, day
--   FROM pending_catalog_contributions WHERE id = <ID>
--   ON CONFLICT DO NOTHING;
--
--   UPDATE pending_catalog_contributions SET status = 'approved' WHERE id = <ID>;

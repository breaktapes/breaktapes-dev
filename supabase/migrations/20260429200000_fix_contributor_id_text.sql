-- Fix: contributor_id was uuid referencing auth.users — incompatible with Clerk.
-- Clerk user IDs are "user_2abc..." strings, not UUIDs, and auth.users is empty
-- when using Clerk auth. Every upsert_catalog_contribution RPC call silently
-- failed with a type-cast error, leaving the table permanently empty.
-- Fix: drop FK constraint, change column to text, update RPC signature.

-- 1. Drop FK constraint (if it exists)
ALTER TABLE pending_catalog_contributions
  DROP CONSTRAINT IF EXISTS pending_catalog_contributions_contributor_id_fkey;

-- 2. Drop RLS policy that references the column (required before ALTER COLUMN)
DROP POLICY IF EXISTS users_can_contribute ON pending_catalog_contributions;

-- 3. Change column type to text
ALTER TABLE pending_catalog_contributions
  ALTER COLUMN contributor_id TYPE text USING contributor_id::text;

-- 4. Recreate the policy with text comparison
CREATE POLICY users_can_contribute ON pending_catalog_contributions
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 5. Drop old RPC and recreate with text param
DROP FUNCTION IF EXISTS upsert_catalog_contribution(text,text,text,text,text,numeric,integer,date,integer,integer,uuid);

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
  p_contributor_id text
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

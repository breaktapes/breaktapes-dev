-- Add start_time TIME column to race_catalog.
-- Captures local race-city wall-clock start time when source publishes one
-- (e.g. World's Marathons per-distance startDateTime). Null when unknown.

ALTER TABLE race_catalog
  ADD COLUMN IF NOT EXISTS start_time TIME NULL;

COMMENT ON COLUMN race_catalog.start_time IS
  'Local race-city wall clock start time (HH:MM:SS). NULL when source did not publish a time. No timezone — interpret as local race-city time.';

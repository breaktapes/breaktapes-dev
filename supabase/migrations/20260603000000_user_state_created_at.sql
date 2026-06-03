-- Add created_at to user_state so admin growth analytics can track signups
-- over time. The table only ever had updated_at (a touch-trigger column that
-- moves on every sync), which is useless for "when did this user join".
--
-- Backfill limitation: for rows that predate this migration there is no true
-- signup timestamp. We seed created_at = updated_at as the only available
-- lower-bound signal (a user's first sync can't be after their last sync).
-- This OVERSTATES recency for long-dormant users, so the admin growth chart
-- treats pre-deploy data as approximate. New rows get an accurate now().

ALTER TABLE public.user_state
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE public.user_state
SET created_at = COALESCE(updated_at, timezone('utc'::text, now()))
WHERE created_at IS NULL;

ALTER TABLE public.user_state
  ALTER COLUMN created_at SET DEFAULT timezone('utc'::text, now());

-- Index for the growth-over-time query (created_at >= cutoff, ordered).
CREATE INDEX IF NOT EXISTS idx_user_state_created_at
  ON public.user_state (created_at);

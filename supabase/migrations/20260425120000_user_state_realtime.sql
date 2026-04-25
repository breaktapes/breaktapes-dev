-- Enable Supabase realtime on user_state so a write from one device
-- (laptop) pushes a postgres_changes event to every other connected
-- client (phone) for the same user_id, and the client-side hook
-- invalidates its sync-state query and re-pulls. Without this, the
-- last-write-wins window meant two devices could clobber each other.
--
-- The publication may not exist on a brand-new project; create-then-add
-- pattern is idempotent and safe to re-run.

-- 1. Make sure the publication exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- 2. Add user_state to the publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_state;
  END IF;
END $$;

-- 3. REPLICA IDENTITY FULL is unnecessary — we only need the new row
-- on UPDATE/INSERT, which DEFAULT replica identity already gives us.
-- Skipping it keeps WAL traffic low.

-- Public athlete profiles
-- Adds: username, is_public to user_state + anon RLS policy + profile_views table

-- 1. Add username + is_public columns
ALTER TABLE user_state
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

-- 2. Unique partial index on username (non-null values only)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_state_username
  ON user_state (username)
  WHERE username IS NOT NULL;

-- 3. Anon RLS policy: allow SELECT of public profiles only
--    (existing authenticated-user policies are unaffected)
DROP POLICY IF EXISTS "Public profiles are readable by anyone" ON user_state;
CREATE POLICY "Public profiles are readable by anyone"
  ON user_state FOR SELECT
  TO anon
  USING (is_public = true);

-- 4. Grant anon role access to user_state (RLS still gates rows)
GRANT SELECT ON user_state TO anon;

-- 5. Profile view count table
CREATE TABLE IF NOT EXISTS profile_views (
  username       TEXT PRIMARY KEY,
  view_count     BIGINT NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View counts are publicly readable" ON profile_views;
CREATE POLICY "View counts are publicly readable"
  ON profile_views FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Authenticated users can read their own view counts" ON profile_views;
CREATE POLICY "Authenticated users can read their own view counts"
  ON profile_views FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role can manage view counts" ON profile_views;
CREATE POLICY "Service role can manage view counts"
  ON profile_views FOR ALL TO service_role USING (true);

GRANT SELECT ON profile_views TO anon;

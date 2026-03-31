-- wearable_tokens: stores OAuth tokens for WHOOP, Garmin, and future wearable integrations.
-- Tokens are written by the browser (authenticated Supabase JS) after the health-proxy worker
-- exchanges the auth code server-side. RLS ensures users can only access their own rows.

CREATE TABLE IF NOT EXISTS wearable_tokens (
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider      text        NOT NULL,   -- 'whoop' | 'garmin'
  access_token  text        NOT NULL,
  refresh_token text,
  expires_at    timestamptz,
  profile       jsonb       NOT NULL DEFAULT '{}',  -- athlete/display name, avatar, etc.
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);

ALTER TABLE wearable_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own wearable tokens"
  ON wearable_tokens
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- apple_health_data: stores imported Apple Health records (file upload, not OAuth).
-- Each row is one logical "import" keyed by date; newer imports for the same date overwrite.

CREATE TABLE IF NOT EXISTS apple_health_data (
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       date        NOT NULL,
  records    jsonb       NOT NULL DEFAULT '[]',   -- array of parsed health records for that date
  imported_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

ALTER TABLE apple_health_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own apple health data"
  ON apple_health_data
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

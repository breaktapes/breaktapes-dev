-- Drop unused profile_views table.
-- View counts are tracked in Cloudflare KV (PROFILE_KV key: views:{username}).
-- The Worker never had INSERT/UPDATE RLS on this table so it was never populated.
DROP TABLE IF EXISTS profile_views;

-- Revoke over-broad profile_views read policies (view-count leak)
--
-- profile_views (created in 20260409120000_public_profiles.sql) is keyed by
-- `username TEXT PRIMARY KEY` and has columns: username, view_count, last_viewed_at.
-- There is NO user_id column, so "a user's own row" cannot be expressed in RLS
-- without a username join.
--
-- The original migration added TWO SELECT policies, both with USING (true):
--   * anon          — "View counts are publicly readable"
--   * authenticated — "Authenticated users can read their own view counts"
--                     (the comment said "their own" but the predicate allows ALL rows)
--
-- Effect of the leak: any anon or authenticated caller could read EVERY user's
-- view counts (and last_viewed_at) for every username, not just their own.
--
-- Nothing in the app (src/) reads profile_views directly. The SSR Worker
-- (worker/index.js) is the only reader/writer, and it uses the Supabase
-- service-role key, which BYPASSES RLS entirely. Dropping these two broad SELECT
-- policies therefore closes the leak with zero impact on profile view counting.
--
-- RLS stays enabled and the service-role write/manage policy is left untouched.

DROP POLICY IF EXISTS "View counts are publicly readable" ON public.profile_views;
DROP POLICY IF EXISTS "Authenticated users can read their own view counts" ON public.profile_views;

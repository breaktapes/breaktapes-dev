-- Clerk Auth Migration
-- Switches user_id columns from Supabase UUID auth to Clerk text IDs.
-- RLS policies updated from auth.uid() to (auth.jwt() ->> 'sub').
-- All FK constraints to auth.users(id) are dropped — Clerk manages identity.

-- ────────────────────────────────────────────────────────────
-- 1. Drop old RLS policies (must come BEFORE alter column type
--    — Postgres forbids altering a column referenced by a policy)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_state_select_own"    ON public.user_state;
DROP POLICY IF EXISTS "user_state_insert_own"    ON public.user_state;
DROP POLICY IF EXISTS "user_state_update_own"    ON public.user_state;
DROP POLICY IF EXISTS "Users own wearable tokens"     ON public.wearable_tokens;
DROP POLICY IF EXISTS "Users own apple health data"   ON public.apple_health_data;
DROP POLICY IF EXISTS "beta_feedback_auth_insert"     ON public.beta_feedback;

-- ────────────────────────────────────────────────────────────
-- 2. Drop foreign key constraints referencing auth.users(id)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.user_state
  DROP CONSTRAINT IF EXISTS user_state_user_id_fkey;

ALTER TABLE public.wearable_tokens
  DROP CONSTRAINT IF EXISTS wearable_tokens_user_id_fkey;

ALTER TABLE public.apple_health_data
  DROP CONSTRAINT IF EXISTS apple_health_data_user_id_fkey;

ALTER TABLE public.beta_feedback
  DROP CONSTRAINT IF EXISTS beta_feedback_user_id_fkey;

-- ────────────────────────────────────────────────────────────
-- 3. Wipe existing rows — old Supabase UUID user IDs are
--    incompatible with Clerk IDs. Staging only: users re-login.
--    (TRUNCATE must run BEFORE type change because any row with
--     a non-castable value would block ALTER COLUMN.)
-- ────────────────────────────────────────────────────────────
TRUNCATE public.user_state CASCADE;
TRUNCATE public.wearable_tokens;
TRUNCATE public.apple_health_data;

-- ────────────────────────────────────────────────────────────
-- 4. Change user_id column types uuid → text
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.user_state
  ALTER COLUMN user_id TYPE text;

ALTER TABLE public.wearable_tokens
  ALTER COLUMN user_id TYPE text;

ALTER TABLE public.apple_health_data
  ALTER COLUMN user_id TYPE text;

ALTER TABLE public.beta_feedback
  ALTER COLUMN user_id TYPE text;

-- ────────────────────────────────────────────────────────────
-- 5. Recreate RLS policies using Clerk JWT sub claim
-- ────────────────────────────────────────────────────────────
CREATE POLICY "user_state_select_own"
  ON public.user_state FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "user_state_insert_own"
  ON public.user_state FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "user_state_update_own"
  ON public.user_state FOR UPDATE TO authenticated
  USING  ((auth.jwt() ->> 'sub') = user_id)
  WITH CHECK ((auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "Users own wearable tokens"
  ON public.wearable_tokens FOR ALL TO authenticated
  USING  ((auth.jwt() ->> 'sub') = user_id)
  WITH CHECK ((auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "Users own apple health data"
  ON public.apple_health_data FOR ALL TO authenticated
  USING  ((auth.jwt() ->> 'sub') = user_id)
  WITH CHECK ((auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "beta_feedback_auth_insert"
  ON public.beta_feedback FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'sub') = user_id);

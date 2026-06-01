-- Close the public-profile data-exposure: anon could SELECT the full user_state
-- row (entire state_json, incl. sections the owner hid) for any is_public=true
-- profile. All public reads now go through visibility-filtered RPCs
-- (get_public_card) or the SSR worker's service-role key. Drop the anon read
-- policy + grant. Idempotent. Applied to prod via MCP on 2026-06-01.
DROP POLICY IF EXISTS "Public profiles are readable by anyone" ON public.user_state;
REVOKE SELECT ON public.user_state FROM anon;

-- Security fix: get_public_card was returning the full athlete JSONB object
-- which exposed DOB, injuryBreakStart, injuryBreakEnd, owUserId, clubJoinDates,
-- and other private fields to any anon caller via Compare.tsx.
-- Replace with an explicit field allowlist — only public display fields.
create or replace function public.get_public_card(p_username text)
returns jsonb language sql security definer set search_path = public stable as $$
  select case when us.user_id is null then null else
    jsonb_strip_nulls(jsonb_build_object(
      'username', us.username,
      'athlete', jsonb_build_object(
        'firstName',         us.state_json->'athlete'->'firstName',
        'lastName',          us.state_json->'athlete'->'lastName',
        'city',              us.state_json->'athlete'->'city',
        'country',           us.state_json->'athlete'->'country',
        'bio',               us.state_json->'athlete'->'bio',
        'mainSport',         us.state_json->'athlete'->'mainSport',
        'clubs',             us.state_json->'athlete'->'clubs',
        'imageUrl',          us.state_json->'athlete'->'imageUrl',
        'profileVisibility', us.state_json->'athlete'->'profileVisibility',
        'pbHiddenKeys',      us.state_json->'athlete'->'pbHiddenKeys'
      ),
      'races', case when coalesce((us.state_json->'athlete'->'profileVisibility'->>'races')::boolean, false)
                    then us.state_json->'races' else null end,
      'upcoming_races', case when coalesce((us.state_json->'athlete'->'profileVisibility'->>'upcoming')::boolean, false)
                    then us.state_json->'upcoming_races' else null end
    )) end
  from user_state us
  where lower(us.username) = lower(p_username) and us.is_public = true limit 1;
$$;

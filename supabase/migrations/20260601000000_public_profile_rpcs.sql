-- Visibility-filtered public profile RPCs so anon never reads the raw user_state
-- row (which exposed full state_json incl. sections the user hid). Applied to
-- prod via MCP on 2026-06-01; this file is the repo record + staging apply.
create or replace function public.get_public_card(p_username text)
returns jsonb language sql security definer set search_path = public stable as $$
  select case when us.user_id is null then null else
    jsonb_strip_nulls(jsonb_build_object(
      'username', us.username,
      'athlete', us.state_json->'athlete',
      'races', case when coalesce((us.state_json->'athlete'->'profileVisibility'->>'races')::boolean, false)
                    then us.state_json->'races' else null end,
      'upcoming_races', case when coalesce((us.state_json->'athlete'->'profileVisibility'->>'upcoming')::boolean, false)
                    then us.state_json->'upcoming_races' else null end
    )) end
  from user_state us
  where lower(us.username) = lower(p_username) and us.is_public = true limit 1;
$$;
create or replace function public.username_taken(p_username text)
returns boolean language sql security definer set search_path = public stable as $$
  select exists(select 1 from user_state where lower(username) = lower(p_username));
$$;
grant execute on function public.get_public_card(text) to anon;
grant execute on function public.username_taken(text) to anon;

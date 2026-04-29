-- RPC: contribute_race_start_time
-- Lets authenticated users set start_time on a race_catalog entry when it is currently NULL.
-- SECURITY DEFINER so regular users can write to race_catalog without direct UPDATE grant.
CREATE OR REPLACE FUNCTION contribute_race_start_time(
  p_name       text,
  p_city       text,
  p_year       integer,
  p_start_time text   -- 'HH:MM' or 'HH:MM:SS' local race-city time
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE race_catalog
  SET    start_time = p_start_time
  WHERE  lower(name) = lower(p_name)
    AND  lower(city) = lower(p_city)
    AND  year        = p_year
    AND  (start_time IS NULL OR start_time = '');
END;
$$;

GRANT EXECUTE ON FUNCTION contribute_race_start_time(text, text, integer, text) TO authenticated;

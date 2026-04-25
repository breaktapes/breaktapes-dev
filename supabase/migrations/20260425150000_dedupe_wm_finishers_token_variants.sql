-- Dedupe WM-vs-Finishers token-reorder variants.
--
-- After both seed migrations ran, 7 cross-source duplicates remained where
-- the WM and Finishers rows have the same word tokens in different order
-- (e.g. "Marathon Hamburg" vs "Hamburg Marathon"). Levenshtein-based dedupe
-- missed these because reordering pushes character distance >3.
--
-- Cleanup keeps the Finishers row in each pair (it tends to carry per-distance
-- start_time, which WM never publishes) and removes the WM duplicate.

DELETE FROM race_catalog c
USING race_catalog k
WHERE c.source_site = 'worldsmarathons.com'
  AND k.source_site = 'finishers.com'
  AND lower(c.city) = lower(k.city)
  AND c.year = k.year
  AND ROUND(c.dist_km::numeric, 1) = ROUND(k.dist_km::numeric, 1)
  AND lower(c.name) <> lower(k.name)
  AND (
    SELECT array_to_string(ARRAY(SELECT lower(unnest(string_to_array(regexp_replace(c.name, '[^a-zA-Z0-9 ]', ' ', 'g'), ' '))) ORDER BY 1), ' ')
  ) = (
    SELECT array_to_string(ARRAY(SELECT lower(unnest(string_to_array(regexp_replace(k.name, '[^a-zA-Z0-9 ]', ' ', 'g'), ' '))) ORDER BY 1), ' ')
  );

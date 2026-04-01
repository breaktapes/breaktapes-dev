-- Fix Ventoux by UTMB race catalog entries
-- Source: https://ventoux.utmb.world
-- 4 races: UGP 125K, GEV 87K, MMT 51K, TDC 26K — all in Bédoin, France — Apr 24–26 2026
-- Existing entries were incomplete: "Grand Raid Ventoux" had no dist_km, wrong name
-- GEV 87K already existed correctly — skip on conflict

-- Remove the bad placeholder entry
DELETE FROM race_catalog
WHERE source_url = 'https://ventoux.utmb.world'
  AND (dist_km IS NULL OR name = 'Grand Raid Ventoux by UTMB');

-- Re-insert all 4 correctly, skip if already present
INSERT INTO race_catalog (
  name, aliases, type, dist, dist_km, city, country,
  year, month, day, event_date, discipline, surface, elevation_profile,
  series, source_site, source_url, source_priority
) VALUES

('Ultra Géant de Provence by UTMB',
  ARRAY['UGP Ventoux','Ultra Geant de Provence','Ventoux UGP 125K','Grand Raid Ventoux'],
  'run', '100KM', 125.0, 'Bédoin', 'France',
  2026, 4, 24, '2026-04-24',
  'trail-running', 'Trail', 'Mountain',
  'UTMB World Series', 'manual', 'https://ventoux.utmb.world', 85),

('Grande Epopée Ventoux by UTMB',
  ARRAY['GEV Ventoux','Grande Epopee Ventoux','Ventoux GEV 87K','Grande Epopée Ventoux 87K by UTMB'],
  'run', '50KM', 87.0, 'Bédoin', 'France',
  2026, 4, 25, '2026-04-25',
  'trail-running', 'Trail', 'Mountain',
  'UTMB World Series', 'manual', 'https://ventoux.utmb.world', 80),

('Mistral Marathon Trail by UTMB',
  ARRAY['MMT Ventoux','Mistral Marathon Trail','Ventoux MMT 51K'],
  'run', '50KM', 51.0, 'Bédoin', 'France',
  2026, 4, 26, '2026-04-26',
  'trail-running', 'Trail', 'Rolling',
  'UTMB World Series', 'manual', 'https://ventoux.utmb.world', 75),

('Trail des Coteaux by UTMB',
  ARRAY['TDC Ventoux','Trail des Coteaux','Ventoux TDC 26K'],
  'run', 'Half Marathon', 26.0, 'Bédoin', 'France',
  2026, 4, 25, '2026-04-25',
  'trail-running', 'Trail', 'Rolling',
  'UTMB World Series', 'manual', 'https://ventoux.utmb.world', 70)

ON CONFLICT DO NOTHING;

-- Remove the duplicate GEV entry with old name if it still exists
DELETE FROM race_catalog
WHERE name = 'Grande Epopée Ventoux 87K by UTMB';

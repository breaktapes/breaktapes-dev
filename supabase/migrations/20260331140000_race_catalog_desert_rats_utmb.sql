-- Desert RATS Trail Running Festival by UTMB — all 4 race categories
-- Location: Fruita, Colorado, USA
-- Source: https://desertrats.utmb.world
-- 2026 dates: 10–12 April 2026 (10K on 10th, 100K/50K on 11th, 21K on 12th)
-- dist_km converted from miles (62.1mi=99.9km, 29.8mi=48.0km, 13mi=20.9km, 5.5mi=8.9km)
-- elevation in metres (6725ft=2050m, 3444ft=1050m, 2296ft=700m, 656ft=200m)

INSERT INTO race_catalog (
  name, aliases, type, dist, dist_km, city, country,
  year, month, day, event_date, discipline, surface, elevation_profile,
  series, source_site, source_url, source_priority
) VALUES

('Desert RATS 100K by UTMB',
  ARRAY['Desert Rats 100K','Desert RATS Trail Running Festival 100K','Desert Rats UTMB 100K'],
  'run', '100KM', 99.9, 'Fruita', 'United States',
  2026, 4, 11, '2026-04-11',
  'trail-running', 'Trail', 'Rolling',
  'UTMB World Series', 'manual', 'https://desertrats.utmb.world', 85),

('Desert RATS 50K by UTMB',
  ARRAY['Desert Rats 50K','Desert RATS Trail Running Festival 50K','Desert Rats UTMB 50K'],
  'run', '50KM', 48.0, 'Fruita', 'United States',
  2026, 4, 11, '2026-04-11',
  'trail-running', 'Trail', 'Rolling',
  'UTMB World Series', 'manual', 'https://desertrats.utmb.world', 80),

('Desert RATS 21K by UTMB',
  ARRAY['Desert Rats 21K','Desert RATS Trail Running Festival 21K','Desert Rats UTMB 21K'],
  'run', 'Half Marathon', 20.9, 'Fruita', 'United States',
  2026, 4, 12, '2026-04-12',
  'trail-running', 'Trail', 'Rolling',
  'UTMB World Series', 'manual', 'https://desertrats.utmb.world', 75),

('Desert RATS 10K by UTMB',
  ARRAY['Desert Rats 10K','Desert RATS Trail Running Festival 10K','Desert Rats UTMB 10K'],
  'run', '10KM', 8.9, 'Fruita', 'United States',
  2026, 4, 10, '2026-04-10',
  'trail-running', 'Trail', 'Rolling',
  'UTMB World Series', 'manual', 'https://desertrats.utmb.world', 70);

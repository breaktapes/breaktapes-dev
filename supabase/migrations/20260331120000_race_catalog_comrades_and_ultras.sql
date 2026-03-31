-- Add Comrades Marathon and other iconic ultramarathons / missing races to the catalog
-- Comrades alternates: even years = "up" run (Durban → Pietermaritzburg), odd years = "down" run (Pietermaritzburg → Durban)

INSERT INTO race_catalog (
  name, aliases, type, dist, dist_km, city, country,
  year, month, day, event_date, discipline, surface, elevation_profile,
  series, source_site, source_priority
) VALUES

-- ── Comrades Marathon (base entry — current) ─────────────────────────────────
('Comrades Marathon',
  ARRAY['Comrades 2025','Comrades Marathon 2025','Comrades 90th'],
  'run', 'Ultra', 89.0, 'Durban', 'South Africa',
  2025, 6, 8, '2025-06-08', 'road-running', 'Road', 'Rolling',
  'Comrades Marathon', 'manual', 80),

-- Year-specific entries for historical logging
('Comrades Marathon 2024',
  ARRAY['Comrades 2024','Comrades 89th'],
  'run', 'Ultra', 90.0, 'Pietermaritzburg', 'South Africa',
  2024, 6, 9, '2024-06-09', 'road-running', 'Road', 'Rolling',
  'Comrades Marathon', 'manual', 70),

('Comrades Marathon 2023',
  ARRAY['Comrades 2023','Comrades 88th'],
  'run', 'Ultra', 90.6, 'Durban', 'South Africa',
  2023, 6, 11, '2023-06-11', 'road-running', 'Road', 'Rolling',
  'Comrades Marathon', 'manual', 70),

('Comrades Marathon 2022',
  ARRAY['Comrades 2022','Comrades 87th'],
  'run', 'Ultra', 85.9, 'Pietermaritzburg', 'South Africa',
  2022, 6, 26, '2022-06-26', 'road-running', 'Road', 'Rolling',
  'Comrades Marathon', 'manual', 70),

('Comrades Marathon 2019',
  ARRAY['Comrades 2019','Comrades 94th'],
  'run', 'Ultra', 89.0, 'Durban', 'South Africa',
  2019, 6, 9, '2019-06-09', 'road-running', 'Road', 'Rolling',
  'Comrades Marathon', 'manual', 70),

('Comrades Marathon 2018',
  ARRAY['Comrades 2018','Comrades 93rd'],
  'run', 'Ultra', 90.0, 'Pietermaritzburg', 'South Africa',
  2018, 6, 10, '2018-06-10', 'road-running', 'Road', 'Rolling',
  'Comrades Marathon', 'manual', 70),

('Comrades Marathon 2017',
  ARRAY['Comrades 2017','Comrades 92nd'],
  'run', 'Ultra', 88.0, 'Durban', 'South Africa',
  2017, 6, 4, '2017-06-04', 'road-running', 'Road', 'Rolling',
  'Comrades Marathon', 'manual', 70),

('Comrades Marathon 2016',
  ARRAY['Comrades 2016'],
  'run', 'Ultra', 90.0, 'Pietermaritzburg', 'South Africa',
  2016, 6, 29, '2016-06-29', 'road-running', 'Road', 'Rolling',
  'Comrades Marathon', 'manual', 70),

('Comrades Marathon 2015',
  ARRAY['Comrades 2015'],
  'run', 'Ultra', 89.0, 'Durban', 'South Africa',
  2015, 5, 31, '2015-05-31', 'road-running', 'Road', 'Rolling',
  'Comrades Marathon', 'manual', 70),

('Comrades Marathon 2014',
  ARRAY['Comrades 2014'],
  'run', 'Ultra', 90.0, 'Pietermaritzburg', 'South Africa',
  2014, 6, 1, '2014-06-01', 'road-running', 'Road', 'Rolling',
  'Comrades Marathon', 'manual', 70),

('Comrades Marathon 2013',
  ARRAY['Comrades 2013'],
  'run', 'Ultra', 89.0, 'Durban', 'South Africa',
  2013, 6, 2, '2013-06-02', 'road-running', 'Road', 'Rolling',
  'Comrades Marathon', 'manual', 70),

('Comrades Marathon 2012',
  ARRAY['Comrades 2012'],
  'run', 'Ultra', 90.0, 'Pietermaritzburg', 'South Africa',
  2012, 6, 3, '2012-06-03', 'road-running', 'Road', 'Rolling',
  'Comrades Marathon', 'manual', 70),

('Comrades Marathon 2011',
  ARRAY['Comrades 2011'],
  'run', 'Ultra', 89.0, 'Durban', 'South Africa',
  2011, 5, 29, '2011-05-29', 'road-running', 'Road', 'Rolling',
  'Comrades Marathon', 'manual', 70),

('Comrades Marathon 2010',
  ARRAY['Comrades 2010'],
  'run', 'Ultra', 89.9, 'Pietermaritzburg', 'South Africa',
  2010, 5, 30, '2010-05-30', 'road-running', 'Road', 'Rolling',
  'Comrades Marathon', 'manual', 70),

('Comrades Marathon 2009',
  ARRAY['Comrades 2009'],
  'run', 'Ultra', 89.0, 'Durban', 'South Africa',
  2009, 5, 24, '2009-05-24', 'road-running', 'Road', 'Rolling',
  'Comrades Marathon', 'manual', 70),

('Comrades Marathon 2008',
  ARRAY['Comrades 2008'],
  'run', 'Ultra', 87.7, 'Pietermaritzburg', 'South Africa',
  2008, 6, 1, '2008-06-01', 'road-running', 'Road', 'Rolling',
  'Comrades Marathon', 'manual', 70),

('Comrades Marathon 2007',
  ARRAY['Comrades 2007'],
  'run', 'Ultra', 89.0, 'Durban', 'South Africa',
  2007, 6, 17, '2007-06-17', 'road-running', 'Road', 'Rolling',
  'Comrades Marathon', 'manual', 70),

('Comrades Marathon 2006',
  ARRAY['Comrades 2006'],
  'run', 'Ultra', 87.7, 'Pietermaritzburg', 'South Africa',
  2006, 6, 11, '2006-06-11', 'road-running', 'Road', 'Rolling',
  'Comrades Marathon', 'manual', 70),

('Comrades Marathon 2005',
  ARRAY['Comrades 2005'],
  'run', 'Ultra', 89.0, 'Durban', 'South Africa',
  2005, 6, 12, '2005-06-12', 'road-running', 'Road', 'Rolling',
  'Comrades Marathon', 'manual', 70),

('Comrades Marathon 2004',
  ARRAY['Comrades 2004'],
  'run', 'Ultra', 87.7, 'Pietermaritzburg', 'South Africa',
  2004, 6, 13, '2004-06-13', 'road-running', 'Road', 'Rolling',
  'Comrades Marathon', 'manual', 70),

('Comrades Marathon 2003',
  ARRAY['Comrades 2003'],
  'run', 'Ultra', 89.0, 'Durban', 'South Africa',
  2003, 6, 15, '2003-06-15', 'road-running', 'Road', 'Rolling',
  'Comrades Marathon', 'manual', 70),

('Comrades Marathon 2002',
  ARRAY['Comrades 2002'],
  'run', 'Ultra', 87.7, 'Pietermaritzburg', 'South Africa',
  2002, 6, 16, '2002-06-16', 'road-running', 'Road', 'Rolling',
  'Comrades Marathon', 'manual', 70),

('Comrades Marathon 2001',
  ARRAY['Comrades 2001'],
  'run', 'Ultra', 89.0, 'Durban', 'South Africa',
  2001, 6, 17, '2001-06-17', 'road-running', 'Road', 'Rolling',
  'Comrades Marathon', 'manual', 70),

('Comrades Marathon 2000',
  ARRAY['Comrades 2000'],
  'run', 'Ultra', 87.7, 'Pietermaritzburg', 'South Africa',
  2000, 6, 18, '2000-06-18', 'road-running', 'Road', 'Rolling',
  'Comrades Marathon', 'manual', 70),

-- ── Two Oceans Marathon ────────────────────────────────────────────────────────
('Two Oceans Marathon',
  ARRAY['Two Oceans Ultra','Cape Two Oceans','Two Oceans 2025'],
  'run', 'Ultra', 56.0, 'Cape Town', 'South Africa',
  2025, 4, 19, '2025-04-19', 'road-running', 'Road', 'Hilly',
  'Two Oceans Marathon', 'manual', 75),

-- ── Cape Town Marathon ─────────────────────────────────────────────────────────
('Cape Town Marathon',
  ARRAY['Cape Town 2025','CT Marathon'],
  'run', 'Marathon', 42.2, 'Cape Town', 'South Africa',
  2025, 9, 21, '2025-09-21', 'road-running', 'Road', 'Flat',
  'Cape Town Marathon', 'manual', 75);

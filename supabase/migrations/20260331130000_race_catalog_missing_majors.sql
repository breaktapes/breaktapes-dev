-- Add major races missing from catalog, cross-referenced from user's race history spreadsheet.
-- Covers: World Marathon Majors, HYROX, Ironman, UTMB, Indian races, ultras, cycling gran fondos.
-- Base entries added for autocomplete; recent year editions added for specific matching.

INSERT INTO race_catalog (
  name, aliases, type, dist, dist_km, city, country,
  year, month, day, event_date, discipline, surface, elevation_profile,
  series, source_site, source_priority
) VALUES

-- ══════════════════════════════════════════════════════════════
-- WORLD MARATHON MAJORS (missing entirely)
-- ══════════════════════════════════════════════════════════════

('Tokyo Marathon',
  ARRAY['Tokyo 2026','Tokyo Marathon 2026'],
  'run','Marathon',42.2,'Tokyo','Japan',
  2026,3,1,'2026-03-01','road-running','Road','Flat',
  'World Marathon Majors','manual',90),
('Tokyo Marathon 2025',ARRAY['Tokyo 2025'],'run','Marathon',42.2,'Tokyo','Japan',2025,3,2,'2025-03-02','road-running','Road','Flat','World Marathon Majors','manual',85),
('Tokyo Marathon 2024',ARRAY['Tokyo 2024'],'run','Marathon',42.2,'Tokyo','Japan',2024,3,3,'2024-03-03','road-running','Road','Flat','World Marathon Majors','manual',85),
('Tokyo Marathon 2023',ARRAY['Tokyo 2023'],'run','Marathon',42.2,'Tokyo','Japan',2023,3,5,'2023-03-05','road-running','Road','Flat','World Marathon Majors','manual',80),
('Tokyo Marathon 2022',ARRAY['Tokyo 2022'],'run','Marathon',42.2,'Tokyo','Japan',2022,3,6,'2022-03-06','road-running','Road','Flat','World Marathon Majors','manual',80),
('Tokyo Marathon 2020',ARRAY['Tokyo 2020'],'run','Marathon',42.2,'Tokyo','Japan',2020,3,1,'2020-03-01','road-running','Road','Flat','World Marathon Majors','manual',80),
('Tokyo Marathon 2019',ARRAY['Tokyo 2019'],'run','Marathon',42.2,'Tokyo','Japan',2019,3,3,'2019-03-03','road-running','Road','Flat','World Marathon Majors','manual',80),
('Tokyo Marathon 2018',ARRAY['Tokyo 2018'],'run','Marathon',42.2,'Tokyo','Japan',2018,2,25,'2018-02-25','road-running','Road','Flat','World Marathon Majors','manual',80),
('Tokyo Marathon 2017',ARRAY['Tokyo 2017'],'run','Marathon',42.2,'Tokyo','Japan',2017,2,26,'2017-02-26','road-running','Road','Flat','World Marathon Majors','manual',80),
('Tokyo Marathon 2016',ARRAY['Tokyo 2016'],'run','Marathon',42.2,'Tokyo','Japan',2016,2,28,'2016-02-28','road-running','Road','Flat','World Marathon Majors','manual',80),
('Tokyo Marathon 2015',ARRAY['Tokyo 2015'],'run','Marathon',42.2,'Tokyo','Japan',2015,2,22,'2015-02-22','road-running','Road','Flat','World Marathon Majors','manual',80),
('Tokyo Marathon 2014',ARRAY['Tokyo 2014'],'run','Marathon',42.2,'Tokyo','Japan',2014,2,23,'2014-02-23','road-running','Road','Flat','World Marathon Majors','manual',80),
('Tokyo Marathon 2013',ARRAY['Tokyo 2013'],'run','Marathon',42.2,'Tokyo','Japan',2013,2,24,'2013-02-24','road-running','Road','Flat','World Marathon Majors','manual',80),
('Tokyo Marathon 2012',ARRAY['Tokyo 2012'],'run','Marathon',42.2,'Tokyo','Japan',2012,2,26,'2012-02-26','road-running','Road','Flat','World Marathon Majors','manual',80),
('Tokyo Marathon 2011',ARRAY['Tokyo 2011'],'run','Marathon',42.2,'Tokyo','Japan',2011,2,27,'2011-02-27','road-running','Road','Flat','World Marathon Majors','manual',80),
('Tokyo Marathon 2010',ARRAY['Tokyo 2010'],'run','Marathon',42.2,'Tokyo','Japan',2010,2,28,'2010-02-28','road-running','Road','Flat','World Marathon Majors','manual',80),
('Tokyo Marathon 2009',ARRAY['Tokyo 2009'],'run','Marathon',42.2,'Tokyo','Japan',2009,3,22,'2009-03-22','road-running','Road','Flat','World Marathon Majors','manual',80),
('Tokyo Marathon 2008',ARRAY['Tokyo 2008'],'run','Marathon',42.2,'Tokyo','Japan',2008,2,17,'2008-02-17','road-running','Road','Flat','World Marathon Majors','manual',80),
('Tokyo Marathon 2007',ARRAY['Tokyo 2007'],'run','Marathon',42.2,'Tokyo','Japan',2007,3,18,'2007-03-18','road-running','Road','Flat','World Marathon Majors','manual',80),

('New York City Marathon',
  ARRAY['NYC Marathon','New York Marathon','TCS New York City Marathon','TCS NYC Marathon'],
  'run','Marathon',42.2,'New York','United States',
  2025,11,2,'2025-11-02','road-running','Road','Rolling',
  'World Marathon Majors','manual',90),
('New York City Marathon 2024',ARRAY['NYC Marathon 2024','New York Marathon 2024'],'run','Marathon',42.2,'New York','United States',2024,11,3,'2024-11-03','road-running','Road','Rolling','World Marathon Majors','manual',85),
('New York City Marathon 2023',ARRAY['NYC Marathon 2023'],'run','Marathon',42.2,'New York','United States',2023,11,5,'2023-11-05','road-running','Road','Rolling','World Marathon Majors','manual',85),
('New York City Marathon 2022',ARRAY['NYC Marathon 2022'],'run','Marathon',42.2,'New York','United States',2022,11,6,'2022-11-06','road-running','Road','Rolling','World Marathon Majors','manual',80),
('New York City Marathon 2021',ARRAY['NYC Marathon 2021'],'run','Marathon',42.2,'New York','United States',2021,11,7,'2021-11-07','road-running','Road','Rolling','World Marathon Majors','manual',80),
('New York City Marathon 2019',ARRAY['NYC Marathon 2019'],'run','Marathon',42.2,'New York','United States',2019,11,3,'2019-11-03','road-running','Road','Rolling','World Marathon Majors','manual',80),
('New York City Marathon 2018',ARRAY['NYC Marathon 2018'],'run','Marathon',42.2,'New York','United States',2018,11,4,'2018-11-04','road-running','Road','Rolling','World Marathon Majors','manual',80),
('New York City Marathon 2017',ARRAY['NYC Marathon 2017'],'run','Marathon',42.2,'New York','United States',2017,11,5,'2017-11-05','road-running','Road','Rolling','World Marathon Majors','manual',80),

('Chicago Marathon',
  ARRAY['Bank of America Chicago Marathon','Chicago 2025'],
  'run','Marathon',42.2,'Chicago','United States',
  2025,10,12,'2025-10-12','road-running','Road','Flat',
  'World Marathon Majors','manual',90),
('Chicago Marathon 2024',ARRAY['Chicago 2024'],'run','Marathon',42.2,'Chicago','United States',2024,10,13,'2024-10-13','road-running','Road','Flat','World Marathon Majors','manual',85),
('Chicago Marathon 2023',ARRAY['Chicago 2023'],'run','Marathon',42.2,'Chicago','United States',2023,10,8,'2023-10-08','road-running','Road','Flat','World Marathon Majors','manual',85),
('Chicago Marathon 2022',ARRAY['Chicago 2022'],'run','Marathon',42.2,'Chicago','United States',2022,10,9,'2022-10-09','road-running','Road','Flat','World Marathon Majors','manual',80),
('Chicago Marathon 2021',ARRAY['Chicago 2021'],'run','Marathon',42.2,'Chicago','United States',2021,10,10,'2021-10-10','road-running','Road','Flat','World Marathon Majors','manual',80),
('Chicago Marathon 2019',ARRAY['Chicago 2019'],'run','Marathon',42.2,'Chicago','United States',2019,10,13,'2019-10-13','road-running','Road','Flat','World Marathon Majors','manual',80),
('Chicago Marathon 2018',ARRAY['Chicago 2018'],'run','Marathon',42.2,'Chicago','United States',2018,10,7,'2018-10-07','road-running','Road','Flat','World Marathon Majors','manual',80),
('Chicago Marathon 2017',ARRAY['Chicago 2017'],'run','Marathon',42.2,'Chicago','United States',2017,10,8,'2017-10-08','road-running','Road','Flat','World Marathon Majors','manual',80),

('Dubai Marathon',
  ARRAY['Dubai Standard Chartered Marathon','SCDM','Dubai Marathon 2026'],
  'run','Marathon',42.2,'Dubai','United Arab Emirates',
  2026,1,16,'2026-01-16','road-running','Road','Flat',
  'Dubai Marathon','manual',85),
('Dubai Marathon 2025',ARRAY['Dubai Marathon 2025'],'run','Marathon',42.2,'Dubai','United Arab Emirates',2025,1,17,'2025-01-17','road-running','Road','Flat','Dubai Marathon','manual',85),
('Dubai Marathon 2024',ARRAY['Dubai Marathon 2024'],'run','Marathon',42.2,'Dubai','United Arab Emirates',2024,1,12,'2024-01-12','road-running','Road','Flat','Dubai Marathon','manual',80),
('Dubai Marathon 2023',ARRAY['Dubai Marathon 2023'],'run','Marathon',42.2,'Dubai','United Arab Emirates',2023,1,20,'2023-01-20','road-running','Road','Flat','Dubai Marathon','manual',80),
('Dubai Marathon 2022',ARRAY['Dubai Marathon 2022'],'run','Marathon',42.2,'Dubai','United Arab Emirates',2022,1,21,'2022-01-21','road-running','Road','Flat','Dubai Marathon','manual',80),

('Barcelona Marathon',
  ARRAY['Zurich Barcelona Marathon','Marató de Barcelona','Barcelona 2026'],
  'run','Marathon',42.2,'Barcelona','Spain',
  2026,3,15,'2026-03-15','road-running','Road','Flat',
  'Barcelona Marathon','manual',85),
('Barcelona Marathon 2025',ARRAY['Barcelona Marathon 2025'],'run','Marathon',42.2,'Barcelona','Spain',2025,3,16,'2025-03-16','road-running','Road','Flat','Barcelona Marathon','manual',80),
('Barcelona Marathon 2024',ARRAY['Barcelona Marathon 2024'],'run','Marathon',42.2,'Barcelona','Spain',2024,3,17,'2024-03-17','road-running','Road','Flat','Barcelona Marathon','manual',80),
('Barcelona Marathon 2023',ARRAY['Barcelona Marathon 2023'],'run','Marathon',42.2,'Barcelona','Spain',2023,3,19,'2023-03-19','road-running','Road','Flat','Barcelona Marathon','manual',80),

('Rome Marathon',
  ARRAY['Acea Run Rome The Marathon','Maratona di Roma','Rome 2026'],
  'run','Marathon',42.2,'Rome','Italy',
  2026,3,22,'2026-03-22','road-running','Road','Flat',
  'Rome Marathon','manual',85),
('Rome Marathon 2025',ARRAY['Rome Marathon 2025'],'run','Marathon',42.2,'Rome','Italy',2025,3,23,'2025-03-23','road-running','Road','Flat','Rome Marathon','manual',80),
('Rome Marathon 2024',ARRAY['Rome Marathon 2024'],'run','Marathon',42.2,'Rome','Italy',2024,3,17,'2024-03-17','road-running','Road','Flat','Rome Marathon','manual',80),
('Rome Marathon 2023',ARRAY['Rome Marathon 2023'],'run','Marathon',42.2,'Rome','Italy',2023,3,19,'2023-03-19','road-running','Road','Flat','Rome Marathon','manual',80),

('Singapore Marathon',
  ARRAY['SCSM Singapore Marathon','Standard Chartered Singapore Marathon'],
  'run','Marathon',42.2,'Singapore','Singapore',
  2025,12,7,'2025-12-07','road-running','Road','Flat',
  'Singapore Marathon','manual',85),
('Singapore Marathon 2024',ARRAY['Singapore Marathon 2024'],'run','Marathon',42.2,'Singapore','Singapore',2024,12,1,'2024-12-01','road-running','Road','Flat','Singapore Marathon','manual',80),
('Singapore Marathon 2023',ARRAY['Singapore Marathon 2023'],'run','Marathon',42.2,'Singapore','Singapore',2023,12,3,'2023-12-03','road-running','Road','Flat','Singapore Marathon','manual',80),
('Singapore Marathon 2022',ARRAY['Singapore Marathon 2022'],'run','Marathon',42.2,'Singapore','Singapore',2022,12,4,'2022-12-04','road-running','Road','Flat','Singapore Marathon','manual',80),

('Seoul Marathon',
  ARRAY['Chosun Ilbo Dong-A Marathon','Seoul 2026'],
  'run','Marathon',42.2,'Seoul','South Korea',
  2026,3,22,'2026-03-22','road-running','Road','Flat',
  'Seoul Marathon','manual',85),
('Seoul Marathon 2025',ARRAY['Seoul Marathon 2025'],'run','Marathon',42.2,'Seoul','South Korea',2025,3,16,'2025-03-16','road-running','Road','Flat','Seoul Marathon','manual',80),
('Seoul Marathon 2024',ARRAY['Seoul Marathon 2024'],'run','Marathon',42.2,'Seoul','South Korea',2024,3,17,'2024-03-17','road-running','Road','Flat','Seoul Marathon','manual',80),
('Seoul Marathon 2023',ARRAY['Seoul Marathon 2023'],'run','Marathon',42.2,'Seoul','South Korea',2023,3,19,'2023-03-19','road-running','Road','Flat','Seoul Marathon','manual',80),

('Osaka Marathon',
  ARRAY['Osaka Marathon 2026'],
  'run','Marathon',42.2,'Osaka','Japan',
  2026,2,1,'2026-02-01','road-running','Road','Flat',
  'Osaka Marathon','manual',85),
('Osaka Marathon 2025',ARRAY['Osaka Marathon 2025'],'run','Marathon',42.2,'Osaka','Japan',2025,2,2,'2025-02-02','road-running','Road','Flat','Osaka Marathon','manual',80),
('Osaka Marathon 2024',ARRAY['Osaka Marathon 2024'],'run','Marathon',42.2,'Osaka','Japan',2024,2,25,'2024-02-25','road-running','Road','Flat','Osaka Marathon','manual',80),
('Osaka Marathon 2023',ARRAY['Osaka Marathon 2023'],'run','Marathon',42.2,'Osaka','Japan',2023,11,26,'2023-11-26','road-running','Road','Flat','Osaka Marathon','manual',80),

('Lisbon Marathon',
  ARRAY['EDP Lisbon Marathon','Maratona de Lisboa'],
  'run','Marathon',42.2,'Lisbon','Portugal',
  2025,10,19,'2025-10-19','road-running','Road','Rolling',
  'Lisbon Marathon','manual',80),
('Lisbon Marathon 2024',ARRAY['Lisbon Marathon 2024'],'run','Marathon',42.2,'Lisbon','Portugal',2024,10,20,'2024-10-20','road-running','Road','Rolling','Lisbon Marathon','manual',75),

('Melbourne Marathon',
  ARRAY['Melbourne Marathon Festival'],
  'run','Marathon',42.2,'Melbourne','Australia',
  2025,10,19,'2025-10-19','road-running','Road','Flat',
  'Melbourne Marathon','manual',80),
('Melbourne Marathon 2024',ARRAY['Melbourne Marathon 2024'],'run','Marathon',42.2,'Melbourne','Australia',2024,10,20,'2024-10-20','road-running','Road','Flat','Melbourne Marathon','manual',75),

('Gold Coast Marathon',
  ARRAY['Gold Coast Airport Marathon'],
  'run','Marathon',42.2,'Gold Coast','Australia',
  2025,7,6,'2025-07-06','road-running','Road','Flat',
  'Gold Coast Marathon','manual',80),
('Gold Coast Marathon 2024',ARRAY['Gold Coast Marathon 2024'],'run','Marathon',42.2,'Gold Coast','Australia',2024,7,7,'2024-07-07','road-running','Road','Flat','Gold Coast Marathon','manual',75),

('Toronto Marathon',
  ARRAY['Scotiabank Toronto Waterfront Marathon'],
  'run','Marathon',42.2,'Toronto','Canada',
  2025,10,19,'2025-10-19','road-running','Road','Flat',
  'Toronto Marathon','manual',80),

-- ══════════════════════════════════════════════════════════════
-- HALF MARATHONS
-- ══════════════════════════════════════════════════════════════

('Great North Run',
  ARRAY['GNR','Great North Run 2025'],
  'run','Half Marathon',21.1,'Newcastle','United Kingdom',
  2025,9,7,'2025-09-07','road-running','Road','Rolling',
  'Great North Run','manual',85),
('Great North Run 2024',ARRAY['GNR 2024'],'run','Half Marathon',21.1,'Newcastle','United Kingdom',2024,9,8,'2024-09-08','road-running','Road','Rolling','Great North Run','manual',80),
('Great North Run 2023',ARRAY['GNR 2023'],'run','Half Marathon',21.1,'Newcastle','United Kingdom',2023,9,10,'2023-09-10','road-running','Road','Rolling','Great North Run','manual',80),
('Great North Run 2022',ARRAY['GNR 2022'],'run','Half Marathon',21.1,'Newcastle','United Kingdom',2022,9,11,'2022-09-11','road-running','Road','Rolling','Great North Run','manual',80),

('Royal Parks Half Marathon',
  ARRAY['Royal Parks Foundation Half Marathon'],
  'run','Half Marathon',21.1,'London','United Kingdom',
  2025,10,5,'2025-10-05','road-running','Road','Flat',
  'Royal Parks Half Marathon','manual',80),
('Royal Parks Half Marathon 2024',ARRAY['Royal Parks Half 2024'],'run','Half Marathon',21.1,'London','United Kingdom',2024,10,6,'2024-10-06','road-running','Road','Flat','Royal Parks Half Marathon','manual',75),

('NYC Half Marathon',
  ARRAY['United Airlines NYC Half','New York Half Marathon'],
  'run','Half Marathon',21.1,'New York','United States',
  2025,3,16,'2025-03-16','road-running','Road','Rolling',
  'NYC Half Marathon','manual',80),
('NYC Half Marathon 2024',ARRAY['NYC Half 2024'],'run','Half Marathon',21.1,'New York','United States',2024,3,17,'2024-03-17','road-running','Road','Rolling','NYC Half Marathon','manual',75),

('Ras Al Khaimah Half Marathon',
  ARRAY['RAK Half Marathon','Ras Al Khaimah Half 2026'],
  'run','Half Marathon',21.1,'Ras Al Khaimah','United Arab Emirates',
  2026,2,20,'2026-02-20','road-running','Road','Flat',
  'RAK Half Marathon','manual',85),
('Ras Al Khaimah Half Marathon 2025',ARRAY['RAK Half 2025'],'run','Half Marathon',21.1,'Ras Al Khaimah','United Arab Emirates',2025,2,21,'2025-02-21','road-running','Road','Flat','RAK Half Marathon','manual',80),
('Ras Al Khaimah Half Marathon 2024',ARRAY['RAK Half 2024'],'run','Half Marathon',21.1,'Ras Al Khaimah','United Arab Emirates',2024,2,23,'2024-02-23','road-running','Road','Flat','RAK Half Marathon','manual',80),
('Ras Al Khaimah Half Marathon 2023',ARRAY['RAK Half 2023'],'run','Half Marathon',21.1,'Ras Al Khaimah','United Arab Emirates',2023,2,17,'2023-02-17','road-running','Road','Flat','RAK Half Marathon','manual',80),

-- ══════════════════════════════════════════════════════════════
-- HYROX (missing locations)
-- ══════════════════════════════════════════════════════════════

('HYROX Dubai',ARRAY['Hyrox Dubai 2025','HYROX Dubai Open'],'hyrox','Solo Open',NULL,'Dubai','United Arab Emirates',2025,1,10,'2025-01-10','hyrox','Indoor',NULL,'HYROX World Series','manual',85),
('HYROX Dubai 2024',ARRAY['Hyrox Dubai 2024'],'hyrox','Solo Open',NULL,'Dubai','United Arab Emirates',2024,1,12,'2024-01-12','hyrox','Indoor',NULL,'HYROX World Series','manual',80),
('HYROX Dubai 2023',ARRAY['Hyrox Dubai 2023'],'hyrox','Solo Open',NULL,'Dubai','United Arab Emirates',2023,1,13,'2023-01-13','hyrox','Indoor',NULL,'HYROX World Series','manual',80),
('HYROX London',ARRAY['Hyrox London 2025'],'hyrox','Solo Open',NULL,'London','United Kingdom',2025,4,26,'2025-04-26','hyrox','Indoor',NULL,'HYROX World Series','manual',85),
('HYROX London 2024',ARRAY['Hyrox London 2024'],'hyrox','Solo Open',NULL,'London','United Kingdom',2024,3,16,'2024-03-16','hyrox','Indoor',NULL,'HYROX World Series','manual',80),
('HYROX Frankfurt',ARRAY['Hyrox Frankfurt 2025'],'hyrox','Solo Open',NULL,'Frankfurt','Germany',2025,11,15,'2025-11-15','hyrox','Indoor',NULL,'HYROX World Series','manual',85),
('HYROX Frankfurt 2024',ARRAY['Hyrox Frankfurt 2024'],'hyrox','Solo Open',NULL,'Frankfurt','Germany',2024,11,16,'2024-11-16','hyrox','Indoor',NULL,'HYROX World Series','manual',80),
('HYROX New York',ARRAY['Hyrox New York 2025'],'hyrox','Solo Open',NULL,'New York','United States',2025,11,22,'2025-11-22','hyrox','Indoor',NULL,'HYROX World Series','manual',85),
('HYROX New York 2024',ARRAY['Hyrox New York 2024'],'hyrox','Solo Open',NULL,'New York','United States',2024,11,23,'2024-11-23','hyrox','Indoor',NULL,'HYROX World Series','manual',80),
('HYROX Chicago',ARRAY['Hyrox Chicago 2025'],'hyrox','Solo Open',NULL,'Chicago','United States',2025,3,8,'2025-03-08','hyrox','Indoor',NULL,'HYROX World Series','manual',80),
('HYROX Sydney',ARRAY['Hyrox Sydney 2025'],'hyrox','Solo Open',NULL,'Sydney','Australia',2025,8,9,'2025-08-09','hyrox','Indoor',NULL,'HYROX World Series','manual',80),

-- ══════════════════════════════════════════════════════════════
-- IRONMAN MISSING EVENTS
-- ══════════════════════════════════════════════════════════════

('IRONMAN Nice',ARRAY['Ironman Nice 2026','IM Nice'],'tri','Ironman / Full',226.0,'Nice','France',2026,6,21,'2026-06-21','triathlon','Mixed','Hilly','IRONMAN Series','manual',85),
('IRONMAN Nice 2025',ARRAY['Ironman Nice 2025'],'tri','Ironman / Full',226.0,'Nice','France',2025,6,22,'2025-06-22','triathlon','Mixed','Hilly','IRONMAN Series','manual',80),
('IRONMAN Nice 2024',ARRAY['Ironman Nice 2024'],'tri','Ironman / Full',226.0,'Nice','France',2024,6,23,'2024-06-23','triathlon','Mixed','Hilly','IRONMAN Series','manual',80),
('IRONMAN Nice 2023',ARRAY['Ironman Nice 2023'],'tri','Ironman / Full',226.0,'Nice','France',2023,6,25,'2023-06-25','triathlon','Mixed','Hilly','IRONMAN Series','manual',80),

('IRONMAN Switzerland',ARRAY['Ironman Zürich','Ironman Zurich 2026','IM Switzerland'],'tri','Ironman / Full',226.0,'Zürich','Switzerland',2026,7,26,'2026-07-26','triathlon','Mixed','Hilly','IRONMAN Series','manual',85),
('IRONMAN Switzerland 2025',ARRAY['Ironman Switzerland 2025'],'tri','Ironman / Full',226.0,'Zürich','Switzerland',2025,7,27,'2025-07-27','triathlon','Mixed','Hilly','IRONMAN Series','manual',80),
('IRONMAN Switzerland 2024',ARRAY['Ironman Switzerland 2024'],'tri','Ironman / Full',226.0,'Zürich','Switzerland',2024,7,28,'2024-07-28','triathlon','Mixed','Hilly','IRONMAN Series','manual',80),
('IRONMAN Switzerland 2023',ARRAY['Ironman Switzerland 2023'],'tri','Ironman / Full',226.0,'Zürich','Switzerland',2023,7,30,'2023-07-30','triathlon','Mixed','Hilly','IRONMAN Series','manual',80),

('IRONMAN 70.3 Dubai',ARRAY['IM 70.3 Dubai 2026','Ironman 70.3 Dubai'],'tri','70.3 / Half Ironman',113.0,'Dubai','United Arab Emirates',2026,1,30,'2026-01-30','triathlon','Mixed','Flat','IRONMAN 70.3 Series','manual',85),
('IRONMAN 70.3 Dubai 2025',ARRAY['IM 70.3 Dubai 2025'],'tri','70.3 / Half Ironman',113.0,'Dubai','United Arab Emirates',2025,1,31,'2025-01-31','triathlon','Mixed','Flat','IRONMAN 70.3 Series','manual',80),
('IRONMAN 70.3 Dubai 2024',ARRAY['IM 70.3 Dubai 2024'],'tri','70.3 / Half Ironman',113.0,'Dubai','United Arab Emirates',2024,2,2,'2024-02-02','triathlon','Mixed','Flat','IRONMAN 70.3 Series','manual',80),
('IRONMAN 70.3 Dubai 2023',ARRAY['IM 70.3 Dubai 2023'],'tri','70.3 / Half Ironman',113.0,'Dubai','United Arab Emirates',2023,2,3,'2023-02-03','triathlon','Mixed','Flat','IRONMAN 70.3 Series','manual',80),
('IRONMAN 70.3 Dubai 2022',ARRAY['IM 70.3 Dubai 2022'],'tri','70.3 / Half Ironman',113.0,'Dubai','United Arab Emirates',2022,2,4,'2022-02-04','triathlon','Mixed','Flat','IRONMAN 70.3 Series','manual',80),

('IRONMAN 70.3 Mallorca',ARRAY['IM 70.3 Mallorca 2026'],'tri','70.3 / Half Ironman',113.0,'Alcúdia','Spain',2026,5,23,'2026-05-23','triathlon','Mixed','Rolling','IRONMAN 70.3 Series','manual',80),
('IRONMAN 70.3 Mallorca 2025',ARRAY['IM 70.3 Mallorca 2025'],'tri','70.3 / Half Ironman',113.0,'Alcúdia','Spain',2025,5,24,'2025-05-24','triathlon','Mixed','Rolling','IRONMAN 70.3 Series','manual',75),
('IRONMAN 70.3 Mallorca 2024',ARRAY['IM 70.3 Mallorca 2024'],'tri','70.3 / Half Ironman',113.0,'Alcúdia','Spain',2024,5,18,'2024-05-18','triathlon','Mixed','Rolling','IRONMAN 70.3 Series','manual',75),
('IRONMAN 70.3 Mallorca 2023',ARRAY['IM 70.3 Mallorca 2023'],'tri','70.3 / Half Ironman',113.0,'Alcúdia','Spain',2023,5,20,'2023-05-20','triathlon','Mixed','Rolling','IRONMAN 70.3 Series','manual',75),

('IRONMAN 70.3 Bahrain',ARRAY['IM 70.3 Bahrain 2025','Ironman Bahrain'],'tri','70.3 / Half Ironman',113.0,'Manama','Bahrain',2025,11,28,'2025-11-28','triathlon','Mixed','Flat','IRONMAN 70.3 Series','manual',85),
('IRONMAN 70.3 Bahrain 2024',ARRAY['IM 70.3 Bahrain 2024'],'tri','70.3 / Half Ironman',113.0,'Manama','Bahrain',2024,11,29,'2024-11-29','triathlon','Mixed','Flat','IRONMAN 70.3 Series','manual',80),
('IRONMAN 70.3 Bahrain 2023',ARRAY['IM 70.3 Bahrain 2023'],'tri','70.3 / Half Ironman',113.0,'Manama','Bahrain',2023,11,25,'2023-11-25','triathlon','Mixed','Flat','IRONMAN 70.3 Series','manual',80),
('IRONMAN 70.3 Bahrain 2022',ARRAY['IM 70.3 Bahrain 2022'],'tri','70.3 / Half Ironman',113.0,'Manama','Bahrain',2022,11,26,'2022-11-26','triathlon','Mixed','Flat','IRONMAN 70.3 Series','manual',80),

('IRONMAN 70.3 Oceanside',ARRAY['IM 70.3 Oceanside 2026'],'tri','70.3 / Half Ironman',113.0,'Oceanside','United States',2026,4,4,'2026-04-04','triathlon','Mixed','Rolling','IRONMAN 70.3 Series','manual',80),
('IRONMAN 70.3 Oceanside 2025',ARRAY['IM 70.3 Oceanside 2025'],'tri','70.3 / Half Ironman',113.0,'Oceanside','United States',2025,4,5,'2025-04-05','triathlon','Mixed','Rolling','IRONMAN 70.3 Series','manual',75),
('IRONMAN 70.3 Oceanside 2024',ARRAY['IM 70.3 Oceanside 2024'],'tri','70.3 / Half Ironman',113.0,'Oceanside','United States',2024,4,6,'2024-04-06','triathlon','Mixed','Rolling','IRONMAN 70.3 Series','manual',75),

('IRONMAN World Championship',
  ARRAY['Ironman World Champs','Kona Ironman','IM World Championship','IMWC Kona'],
  'tri','Ironman / Full',226.0,'Kailua-Kona','United States',
  2025,10,25,'2025-10-25','triathlon','Mixed','Hilly',
  'IRONMAN World Championship','manual',90),
('IRONMAN World Championship 2024',ARRAY['Kona 2024','IMWC 2024'],'tri','Ironman / Full',226.0,'Kailua-Kona','United States',2024,10,26,'2024-10-26','triathlon','Mixed','Hilly','IRONMAN World Championship','manual',85),
('IRONMAN World Championship Women 2024',ARRAY['Ironman World Championship Women Nice 2024','IMWC Women 2024'],'tri','Ironman / Full',226.0,'Nice','France',2024,6,29,'2024-06-29','triathlon','Mixed','Hilly','IRONMAN World Championship','manual',85),
('IRONMAN World Championship Women 2023',ARRAY['Ironman World Championship Women Nice 2023','IMWC Women 2023'],'tri','Ironman / Full',226.0,'Nice','France',2023,6,25,'2023-06-25','triathlon','Mixed','Hilly','IRONMAN World Championship','manual',85),
('IRONMAN World Championship Women 2025',ARRAY['IMWC Women 2025'],'tri','Ironman / Full',226.0,'Nice','France',2025,6,28,'2025-06-28','triathlon','Mixed','Hilly','IRONMAN World Championship','manual',85),

-- ══════════════════════════════════════════════════════════════
-- ULTRAS
-- ══════════════════════════════════════════════════════════════

('UTMB',
  ARRAY['Ultra-Trail du Mont-Blanc','UTMB Mont-Blanc','UTMB 2025'],
  'run','100 Mile',171.0,'Chamonix','France',
  2025,8,29,'2025-08-29','trail-running','Trail','Mountain',
  'UTMB World Series','manual',90),
('UTMB 2024',ARRAY['UTMB Mont-Blanc 2024'],'run','100 Mile',171.0,'Chamonix','France',2024,8,30,'2024-08-30','trail-running','Trail','Mountain','UTMB World Series','manual',85),
('UTMB 2023',ARRAY['UTMB Mont-Blanc 2023'],'run','100 Mile',171.0,'Chamonix','France',2023,9,1,'2023-09-01','trail-running','Trail','Mountain','UTMB World Series','manual',85),
('UTMB 2022',ARRAY['UTMB Mont-Blanc 2022'],'run','100 Mile',171.0,'Chamonix','France',2022,8,26,'2022-08-26','trail-running','Trail','Mountain','UTMB World Series','manual',85),
('UTMB 2021',ARRAY['UTMB Mont-Blanc 2021'],'run','100 Mile',171.0,'Chamonix','France',2021,8,27,'2021-08-27','trail-running','Trail','Mountain','UTMB World Series','manual',80),

('UTMB CCC',
  ARRAY['Courmayeur-Champex-Chamonix','CCC 2025'],
  'run','100KM',100.0,'Chamonix','France',
  2025,8,28,'2025-08-28','trail-running','Trail','Mountain',
  'UTMB World Series','manual',85),
('UTMB CCC 2024',ARRAY['CCC 2024'],'run','100KM',100.0,'Chamonix','France',2024,8,29,'2024-08-29','trail-running','Trail','Mountain','UTMB World Series','manual',80),
('UTMB CCC 2023',ARRAY['CCC 2023'],'run','100KM',100.0,'Chamonix','France',2023,8,31,'2023-08-31','trail-running','Trail','Mountain','UTMB World Series','manual',80),

('UTMB OCC',ARRAY['OCC 2025'],'run','50KM',55.0,'Chamonix','France',2025,8,27,'2025-08-27','trail-running','Trail','Mountain','UTMB World Series','manual',80),
('UTMB OCC 2024',ARRAY['OCC 2024'],'run','50KM',55.0,'Chamonix','France',2024,8,28,'2024-08-28','trail-running','Trail','Mountain','UTMB World Series','manual',75),
('UTMB OCC 2023',ARRAY['OCC 2023'],'run','50KM',55.0,'Chamonix','France',2023,8,30,'2023-08-30','trail-running','Trail','Mountain','UTMB World Series','manual',75),

('Western States 100',
  ARRAY['Western States Endurance Run','WSER','Western States 100 2025'],
  'run','100 Mile',161.0,'Auburn','United States',
  2025,6,28,'2025-06-28','trail-running','Trail','Mountain',
  'Western States Endurance Run','manual',90),
('Western States 100 2024',ARRAY['WSER 2024','Western States 2024'],'run','100 Mile',161.0,'Auburn','United States',2024,6,29,'2024-06-29','trail-running','Trail','Mountain','Western States Endurance Run','manual',85),
('Western States 100 2023',ARRAY['WSER 2023'],'run','100 Mile',161.0,'Auburn','United States',2023,6,24,'2023-06-24','trail-running','Trail','Mountain','Western States Endurance Run','manual',85),
('Western States 100 2022',ARRAY['WSER 2022'],'run','100 Mile',161.0,'Auburn','United States',2022,6,25,'2022-06-25','trail-running','Trail','Mountain','Western States Endurance Run','manual',85),

('Marathon des Sables',
  ARRAY['MdS','Marathon of the Sands','MDS 2026'],
  'run','Custom',250.0,'Ouarzazate','Morocco',
  2026,4,1,'2026-04-01','trail-running','Trail','Flat',
  'Marathon des Sables','manual',90),
('Marathon des Sables 2025',ARRAY['MdS 2025','MDS 2025'],'run','Custom',250.0,'Ouarzazate','Morocco',2025,4,4,'2025-04-04','trail-running','Trail','Flat','Marathon des Sables','manual',85),
('Marathon des Sables 2024',ARRAY['MdS 2024'],'run','Custom',250.0,'Ouarzazate','Morocco',2024,4,5,'2024-04-05','trail-running','Trail','Flat','Marathon des Sables','manual',85),
('Marathon des Sables 2023',ARRAY['MdS 2023'],'run','Custom',250.0,'Ouarzazate','Morocco',2023,4,21,'2023-04-21','trail-running','Trail','Flat','Marathon des Sables','manual',85),

('Badwater 135',ARRAY['Badwater Ultramarathon'],'run','100 Mile',217.0,'Death Valley','United States',2025,7,21,'2025-07-21','trail-running','Road','Flat','Badwater 135','manual',85),
('Leadville 100',ARRAY['Leadville Trail 100','LT100'],'run','100 Mile',161.0,'Leadville','United States',2025,8,16,'2025-08-16','trail-running','Trail','Mountain','Leadville 100','manual',85),

('Everest Base Camp Marathon',
  ARRAY['EBC Marathon','Everest Marathon 2025'],
  'run','Marathon',42.2,'Gorak Shep','Nepal',
  2025,5,29,'2025-05-29','trail-running','Trail','Mountain',
  'Everest Marathon','manual',85),
('Everest Base Camp Marathon 2024',ARRAY['EBC Marathon 2024'],'run','Marathon',42.2,'Gorak Shep','Nepal',2024,5,29,'2024-05-29','trail-running','Trail','Mountain','Everest Marathon','manual',80),

('Spiti Marathon',ARRAY['Spiti Ultra'],'run','Half Marathon',21.1,'Sumdo','India',2025,6,1,'2025-06-01','trail-running','Trail','Mountain','Spiti Marathon','manual',75),
('Spiti Marathon 2024',ARRAY['Spiti Marathon 2024'],'run','Half Marathon',21.1,'Sumdo','India',2024,6,2,'2024-06-02','trail-running','Trail','Mountain','Spiti Marathon','manual',70),

-- ══════════════════════════════════════════════════════════════
-- INDIAN RACES
-- ══════════════════════════════════════════════════════════════

('Mumbai Marathon',
  ARRAY['Tata Mumbai Marathon','TMM','TCSM Mumbai'],
  'run','Marathon',42.2,'Mumbai','India',
  2026,1,18,'2026-01-18','road-running','Road','Flat',
  'Mumbai Marathon','manual',85),
('Mumbai Marathon 2025',ARRAY['Tata Mumbai Marathon 2025','TMM 2025'],'run','Marathon',42.2,'Mumbai','India',2025,1,19,'2025-01-19','road-running','Road','Flat','Mumbai Marathon','manual',80),
('Mumbai Marathon 2024',ARRAY['Tata Mumbai Marathon 2024','TMM 2024'],'run','Marathon',42.2,'Mumbai','India',2024,1,21,'2024-01-21','road-running','Road','Flat','Mumbai Marathon','manual',80),
('Mumbai Marathon 2023',ARRAY['Tata Mumbai Marathon 2023','TMM 2023'],'run','Marathon',42.2,'Mumbai','India',2023,1,15,'2023-01-15','road-running','Road','Flat','Mumbai Marathon','manual',80),
('Mumbai Marathon 2022',ARRAY['Tata Mumbai Marathon 2022','TMM 2022'],'run','Marathon',42.2,'Mumbai','India',2022,1,16,'2022-01-16','road-running','Road','Flat','Mumbai Marathon','manual',80),
('Mumbai Marathon 2021',ARRAY['Tata Mumbai Marathon 2021','TMM 2021'],'run','Marathon',42.2,'Mumbai','India',2021,3,21,'2021-03-21','road-running','Road','Flat','Mumbai Marathon','manual',80),
('Mumbai Marathon 2020',ARRAY['Tata Mumbai Marathon 2020','TMM 2020'],'run','Marathon',42.2,'Mumbai','India',2020,1,19,'2020-01-19','road-running','Road','Flat','Mumbai Marathon','manual',80),
('Mumbai Marathon 2019',ARRAY['Tata Mumbai Marathon 2019','TMM 2019'],'run','Marathon',42.2,'Mumbai','India',2019,1,20,'2019-01-20','road-running','Road','Flat','Mumbai Marathon','manual',80),
('Mumbai Marathon 2018',ARRAY['Tata Mumbai Marathon 2018','TMM 2018'],'run','Marathon',42.2,'Mumbai','India',2018,1,21,'2018-01-21','road-running','Road','Flat','Mumbai Marathon','manual',80),
('Mumbai Marathon 2017',ARRAY['Tata Mumbai Marathon 2017','TMM 2017'],'run','Marathon',42.2,'Mumbai','India',2017,1,15,'2017-01-15','road-running','Road','Flat','Mumbai Marathon','manual',80),

('Bengaluru Marathon',
  ARRAY['Bengaluru Marathon','Bengaluru 2025','Wipro Bengaluru Marathon'],
  'run','Marathon',42.2,'Bengaluru','India',
  2025,10,19,'2025-10-19','road-running','Road','Rolling',
  'Bengaluru Marathon','manual',80),
('Bengaluru Marathon 2024',ARRAY['Bengaluru Marathon 2024'],'run','Marathon',42.2,'Bengaluru','India',2024,10,20,'2024-10-20','road-running','Road','Rolling','Bengaluru Marathon','manual',75),

('TCS World 10K Bangalore',
  ARRAY['World 10K Bangalore','World 10K','TCS World 10K'],
  'run','10KM',10.0,'Bengaluru','India',
  2025,5,18,'2025-05-18','road-running','Road','Rolling',
  'TCS World 10K','manual',80),
('TCS World 10K Bangalore 2024',ARRAY['World 10K 2024'],'run','10KM',10.0,'Bengaluru','India',2024,5,19,'2024-05-19','road-running','Road','Rolling','TCS World 10K','manual',75),

('Jaipur Marathon',
  ARRAY['Pink City Marathon','Jaipur Marathon 2026'],
  'run','Marathon',42.2,'Jaipur','India',
  2026,1,11,'2026-01-11','road-running','Road','Flat',
  'Jaipur Marathon','manual',75),
('Jaipur Marathon 2025',ARRAY['Jaipur Marathon 2025'],'run','Marathon',42.2,'Jaipur','India',2025,1,12,'2025-01-12','road-running','Road','Flat','Jaipur Marathon','manual',70),

('Pink City Half Marathon',ARRAY['Jaipur Half Marathon'],'run','Half Marathon',21.1,'Jaipur','India',2025,1,12,'2025-01-12','road-running','Road','Flat','Jaipur Marathon','manual',70),
('Pink City Half Marathon 2024',ARRAY['Jaipur Half 2024'],'run','Half Marathon',21.1,'Jaipur','India',2024,1,14,'2024-01-14','road-running','Road','Flat','Jaipur Marathon','manual',65),

('Chennai Marathon',ARRAY['Wipro Chennai Marathon'],'run','Marathon',42.2,'Chennai','India',2026,1,1,'2026-01-01','road-running','Road','Flat','Chennai Marathon','manual',75),
('Chennai Marathon 2025',ARRAY['Chennai Marathon 2025'],'run','Marathon',42.2,'Chennai','India',2025,1,1,'2025-01-01','road-running','Road','Flat','Chennai Marathon','manual',70),

('Pune International Marathon',ARRAY['Pune Marathon'],'run','Marathon',42.2,'Pune','India',2025,9,14,'2025-09-14','road-running','Road','Rolling','Pune Marathon','manual',70),
('Pune International Marathon 2024',ARRAY['Pune Marathon 2024'],'run','Marathon',42.2,'Pune','India',2024,9,15,'2024-09-15','road-running','Road','Rolling','Pune Marathon','manual',65),

('ADNOC Abu Dhabi Marathon',ARRAY['Abu Dhabi Marathon 2026','ADNOC Marathon'],'run','Marathon',42.2,'Abu Dhabi','United Arab Emirates',2026,12,6,'2026-12-06','road-running','Road','Flat','ADNOC Abu Dhabi Marathon','manual',85),
('ADNOC Abu Dhabi Marathon 2025',ARRAY['Abu Dhabi Marathon 2025'],'run','Marathon',42.2,'Abu Dhabi','United Arab Emirates',2025,12,7,'2025-12-07','road-running','Road','Flat','ADNOC Abu Dhabi Marathon','manual',80),
('ADNOC Abu Dhabi Marathon 2024',ARRAY['Abu Dhabi Marathon 2024'],'run','Marathon',42.2,'Abu Dhabi','United Arab Emirates',2024,12,8,'2024-12-08','road-running','Road','Flat','ADNOC Abu Dhabi Marathon','manual',80),
('ADNOC Abu Dhabi Marathon 2023',ARRAY['Abu Dhabi Marathon 2023'],'run','Marathon',42.2,'Abu Dhabi','United Arab Emirates',2023,11,26,'2023-11-26','road-running','Road','Flat','ADNOC Abu Dhabi Marathon','manual',80),

('Athens Classic Marathon',ARRAY['Authentic Athens Marathon','Marathon Classic Athens'],'run','Marathon',42.2,'Athens','Greece',2025,11,9,'2025-11-09','road-running','Road','Hilly','Athens Marathon','manual',85),
('Athens Classic Marathon 2024',ARRAY['Athens Marathon 2024'],'run','Marathon',42.2,'Athens','Greece',2024,11,10,'2024-11-10','road-running','Road','Hilly','Athens Marathon','manual',80),

-- ══════════════════════════════════════════════════════════════
-- CYCLING GRAN FONDOS
-- ══════════════════════════════════════════════════════════════

('Cape Epic',
  ARRAY['Absa Cape Epic','Cape Epic MTB'],
  'cycle','Gran Fondo',700.0,'Cape Town','South Africa',
  2026,3,15,'2026-03-15','cycling','Trail','Mountain',
  'Cape Epic','manual',90),
('Cape Epic 2025',ARRAY['Absa Cape Epic 2025'],'cycle','Gran Fondo',700.0,'Cape Town','South Africa',2025,3,16,'2025-03-16','cycling','Trail','Mountain','Cape Epic','manual',85),
('Cape Epic 2024',ARRAY['Absa Cape Epic 2024'],'cycle','Gran Fondo',700.0,'Cape Town','South Africa',2024,3,17,'2024-03-17','cycling','Trail','Mountain','Cape Epic','manual',85),

('L''Étape du Tour',ARRAY['Etape du Tour 2025'],'cycle','Gran Fondo',175.0,'Albertville','France',2025,7,6,'2025-07-06','cycling','Road','Mountain','L''Étape du Tour','manual',85),
('L''Étape du Tour 2024',ARRAY['Etape du Tour 2024'],'cycle','Gran Fondo',175.0,'Albertville','France',2024,7,7,'2024-07-07','cycling','Road','Mountain','L''Étape du Tour','manual',80),

('La Marmotte',ARRAY['Marmotte Gran Fondo Alps'],'cycle','Gran Fondo',174.0,'Bourg-d''Oisans','France',2025,7,5,'2025-07-05','cycling','Road','Mountain','La Marmotte','manual',85),

('Ötztaler Radmarathon',ARRAY['Oetztaler Radmarathon','Ötztaler 2025'],'cycle','Gran Fondo',238.0,'Sölden','Austria',2025,8,31,'2025-08-31','cycling','Road','Mountain','Ötztaler Radmarathon','manual',85),

('Fred Whitton Challenge',ARRAY['Fred Whitton 2025'],'cycle','Gran Fondo',179.0,'Coniston','United Kingdom',2025,5,11,'2025-05-11','cycling','Road','Mountain','Fred Whitton Challenge','manual',80),

('Maratona dles Dolomites',ARRAY['Dolomites Marathon','Maratona Dolomiti'],'cycle','Gran Fondo',138.0,'La Villa','Italy',2025,7,6,'2025-07-06','cycling','Road','Mountain','Maratona dles Dolomites','manual',85),

('Tour of Flanders Sportif',ARRAY['Ronde van Vlaanderen Cyclo'],'cycle','Gran Fondo',220.0,'Oudenaarde','Belgium',2025,4,6,'2025-04-06','cycling','Road','Hilly','Tour of Flanders','manual',85),

('Haute Route Alps',ARRAY['Haute Route Alps 2025'],'cycle','Gran Fondo',900.0,'Geneva','Switzerland',2025,8,16,'2025-08-16','cycling','Road','Mountain','Haute Route','manual',85),

('Dirty Kanza 200',ARRAY['Unbound Gravel 200','Unbound Gravel'],'cycle','Gran Fondo',320.0,'Emporia','United States',2025,6,7,'2025-06-07','cycling','Gravel','Rolling','Unbound Gravel','manual',85);

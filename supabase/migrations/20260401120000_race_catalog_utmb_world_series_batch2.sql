-- UTMB World Series Events — Batch 2 (33 events)
-- Covers: Arc of Attrition, Tarawera, Translantau, UTMB Mont-Blanc,
--   Kullamannen, Borealys, Whistler, Julian Alps, Trans Jeju, Gauja,
--   Grindstone, Mallorca, Bariloche, Kosciuszko, Malaysia, Kaçkar,
--   Paraty, Chiang Mai, Oman, Chianti, Puglia, Nice, Wild Strubel,
--   Snowbasin, Chihuahua, Kodiak, Mount Yun, Da Jing Men, Shu Dao,
--   Xiamen, KAT, Pacific Trails, X-Trail
-- source_priority: 85=flagship/100K+, 80=50–100K, 75=marathon–50K, 70=half, 65=short

INSERT INTO race_catalog (
  name, aliases, type, dist, dist_km, city, country,
  year, month, day, event_date, discipline, surface, elevation_profile,
  series, source_site, source_url, source_priority
) VALUES

-- ══════════════════════════════════════════════════════════════
-- ARC OF ATTRITION BY UTMB — Minehead, Somerset, UK — Jan 2026
-- Cornish coastal path: ~161km, massive cumulative gain
-- ══════════════════════════════════════════════════════════════
('Arc of Attrition 100 by UTMB',ARRAY['Arc of Attrition','Arc100','AoA 100'],'run','100M',161.0,'Minehead','United Kingdom',2026,1,9,'2026-01-09','trail-running','Trail','Rolling','UTMB World Series','manual','https://arcofattrition.utmb.world',85),
('Arc of Attrition 50 by UTMB',ARRAY['Arc of Attrition 50','AoA 50'],'run','50KM',50.0,'Minehead','United Kingdom',2026,1,10,'2026-01-10','trail-running','Trail','Rolling','UTMB World Series','manual','https://arcofattrition.utmb.world',80),

-- ══════════════════════════════════════════════════════════════
-- TRANSLANTAU BY UTMB — Lantau Island, Hong Kong — Jan 2026
-- ══════════════════════════════════════════════════════════════
('Translantau 100 by UTMB',ARRAY['TransLantau 100','Translantau UTMB 100K','TL100'],'run','100KM',100.0,'Lantau Island','Hong Kong',2026,1,16,'2026-01-16','trail-running','Trail','Mountain','UTMB World Series','manual','https://translantau.utmb.world',85),
('Translantau 50 by UTMB',ARRAY['TransLantau 50','Translantau UTMB 50K','TL50'],'run','50KM',50.0,'Lantau Island','Hong Kong',2026,1,17,'2026-01-17','trail-running','Trail','Mountain','UTMB World Series','manual','https://translantau.utmb.world',80),
('Translantau 25 by UTMB',ARRAY['TransLantau 25','Translantau UTMB 25K','TL25'],'run','Half Marathon',25.0,'Lantau Island','Hong Kong',2026,1,17,'2026-01-17','trail-running','Trail','Rolling','UTMB World Series','manual','https://translantau.utmb.world',70),

-- ══════════════════════════════════════════════════════════════
-- TARAWERA ULTRAMARATHON BY UTMB — Rotorua, New Zealand — Feb 2026
-- ══════════════════════════════════════════════════════════════
('Tarawera 100 Mile by UTMB',ARRAY['Tarawera Ultramarathon 100','Tarawera 100M','TUM 100'],'run','100M',161.0,'Rotorua','New Zealand',2026,2,6,'2026-02-06','trail-running','Trail','Rolling','UTMB World Series','manual','https://tarawera.utmb.world',85),
('Tarawera 102K by UTMB',ARRAY['Tarawera Ultramarathon 102K','TUM 102K'],'run','100KM',102.0,'Rotorua','New Zealand',2026,2,7,'2026-02-07','trail-running','Trail','Rolling','UTMB World Series','manual','https://tarawera.utmb.world',85),
('Tarawera 50K by UTMB',ARRAY['Tarawera Ultramarathon 50K','TUM 50K'],'run','50KM',50.0,'Rotorua','New Zealand',2026,2,7,'2026-02-07','trail-running','Trail','Rolling','UTMB World Series','manual','https://tarawera.utmb.world',80),
('Tarawera 21K by UTMB',ARRAY['Tarawera Ultramarathon 21K','TUM 21K'],'run','Half Marathon',21.0,'Rotorua','New Zealand',2026,2,8,'2026-02-08','trail-running','Trail','Rolling','UTMB World Series','manual','https://tarawera.utmb.world',70),

-- ══════════════════════════════════════════════════════════════
-- OMAN BY UTMB — Muscat, Oman — Mar 2026
-- ══════════════════════════════════════════════════════════════
('Oman 100K by UTMB',ARRAY['Oman UTMB 100K','Trail Run Oman 100K'],'run','100KM',100.0,'Muscat','Oman',2026,3,6,'2026-03-06','trail-running','Trail','Mountain','UTMB World Series','manual','https://oman.utmb.world',85),
('Oman 55K by UTMB',ARRAY['Oman UTMB 55K','Trail Run Oman 55K'],'run','50KM',55.0,'Muscat','Oman',2026,3,7,'2026-03-07','trail-running','Trail','Mountain','UTMB World Series','manual','https://oman.utmb.world',80),
('Oman 30K by UTMB',ARRAY['Oman UTMB 30K','Trail Run Oman 30K'],'run','Marathon',30.0,'Muscat','Oman',2026,3,7,'2026-03-07','trail-running','Trail','Rolling','UTMB World Series','manual','https://oman.utmb.world',75),
('Oman 15K by UTMB',ARRAY['Oman UTMB 15K','Trail Run Oman 15K'],'run','10KM',15.0,'Muscat','Oman',2026,3,8,'2026-03-08','trail-running','Trail','Rolling','UTMB World Series','manual','https://oman.utmb.world',65),

-- ══════════════════════════════════════════════════════════════
-- PARATY BRASIL BY UTMB — Paraty, Rio de Janeiro, Brazil — Apr 2026
-- ══════════════════════════════════════════════════════════════
('Paraty 100K by UTMB',ARRAY['Paraty Brasil UTMB 100K','Paraty UTMB 100K'],'run','100KM',100.0,'Paraty','Brazil',2026,4,24,'2026-04-24','trail-running','Trail','Mountain','UTMB World Series','manual','https://paraty.utmb.world',85),
('Paraty 55K by UTMB',ARRAY['Paraty Brasil UTMB 55K','Paraty UTMB 55K'],'run','50KM',55.0,'Paraty','Brazil',2026,4,25,'2026-04-25','trail-running','Trail','Mountain','UTMB World Series','manual','https://paraty.utmb.world',80),
('Paraty 30K by UTMB',ARRAY['Paraty Brasil UTMB 30K','Paraty UTMB 30K'],'run','Marathon',30.0,'Paraty','Brazil',2026,4,25,'2026-04-25','trail-running','Trail','Rolling','UTMB World Series','manual','https://paraty.utmb.world',75),
('Paraty 15K by UTMB',ARRAY['Paraty Brasil UTMB 15K','Paraty UTMB 15K'],'run','10KM',15.0,'Paraty','Brazil',2026,4,26,'2026-04-26','trail-running','Trail','Rolling','UTMB World Series','manual','https://paraty.utmb.world',65),

-- ══════════════════════════════════════════════════════════════
-- GAUJA TRAIL BY UTMB — Sigulda, Latvia — May 2026
-- ══════════════════════════════════════════════════════════════
('Gauja Ultra 60K by UTMB',ARRAY['Gauja Trail UTMB 60K','Gauja Ultra'],'run','50KM',60.0,'Sigulda','Latvia',2026,5,15,'2026-05-15','trail-running','Trail','Rolling','UTMB World Series','manual','https://gauja.utmb.world',80),
('Gauja Trail 30K by UTMB',ARRAY['Gauja Trail UTMB 30K'],'run','Marathon',30.0,'Sigulda','Latvia',2026,5,16,'2026-05-16','trail-running','Trail','Rolling','UTMB World Series','manual','https://gauja.utmb.world',75),
('Gauja Trail 15K by UTMB',ARRAY['Gauja Trail UTMB 15K'],'run','10KM',15.0,'Sigulda','Latvia',2026,5,16,'2026-05-16','trail-running','Trail','Rolling','UTMB World Series','manual','https://gauja.utmb.world',65),

-- ══════════════════════════════════════════════════════════════
-- JULIAN ALPS TRAIL RUN BY UTMB — Bovec, Slovenia — Jun 2026
-- ══════════════════════════════════════════════════════════════
('JATR Ultra 110K by UTMB',ARRAY['Julian Alps Trail Run 110K','JATR 110K','Julian Alps UTMB 110K'],'run','100KM',110.0,'Bovec','Slovenia',2026,6,4,'2026-06-04','trail-running','Trail','Mountain','UTMB World Series','manual','https://julianalps.utmb.world',85),
('JATR 65K by UTMB',ARRAY['Julian Alps Trail Run 65K','JATR 65K','Julian Alps UTMB 65K'],'run','50KM',65.0,'Bovec','Slovenia',2026,6,5,'2026-06-05','trail-running','Trail','Mountain','UTMB World Series','manual','https://julianalps.utmb.world',80),
('JATR 35K by UTMB',ARRAY['Julian Alps Trail Run 35K','JATR 35K','Julian Alps UTMB 35K'],'run','Marathon',35.0,'Bovec','Slovenia',2026,6,6,'2026-06-06','trail-running','Trail','Mountain','UTMB World Series','manual','https://julianalps.utmb.world',75),
('JATR 21K by UTMB',ARRAY['Julian Alps Trail Run 21K','JATR 21K','Julian Alps UTMB 21K'],'run','Half Marathon',21.0,'Bovec','Slovenia',2026,6,6,'2026-06-06','trail-running','Trail','Rolling','UTMB World Series','manual','https://julianalps.utmb.world',70),

-- ══════════════════════════════════════════════════════════════
-- CHIANTI TRAIL BY UTMB — Greve in Chianti, Tuscany, Italy — Jun 2026
-- ══════════════════════════════════════════════════════════════
('Chianti Trail 65K by UTMB',ARRAY['Chianti Trail UTMB 65K','Chianti Ultra 65K'],'run','50KM',65.0,'Greve in Chianti','Italy',2026,6,19,'2026-06-19','trail-running','Trail','Rolling','UTMB World Series','manual','https://chianti.utmb.world',80),
('Chianti Trail 35K by UTMB',ARRAY['Chianti Trail UTMB 35K'],'run','Marathon',35.0,'Greve in Chianti','Italy',2026,6,20,'2026-06-20','trail-running','Trail','Rolling','UTMB World Series','manual','https://chianti.utmb.world',75),
('Chianti Trail 18K by UTMB',ARRAY['Chianti Trail UTMB 18K'],'run','Half Marathon',18.0,'Greve in Chianti','Italy',2026,6,20,'2026-06-20','trail-running','Trail','Rolling','UTMB World Series','manual','https://chianti.utmb.world',65),

-- ══════════════════════════════════════════════════════════════
-- CHIANG MAI BY UTMB — Chiang Mai, Thailand — Jul 2026
-- ══════════════════════════════════════════════════════════════
('Chiang Mai 100K by UTMB',ARRAY['Chiang Mai UTMB 100K','Chiang Mai Trail 100K'],'run','100KM',100.0,'Chiang Mai','Thailand',2026,7,10,'2026-07-10','trail-running','Trail','Mountain','UTMB World Series','manual','https://chiangmai.utmb.world',85),
('Chiang Mai 55K by UTMB',ARRAY['Chiang Mai UTMB 55K','Chiang Mai Trail 55K'],'run','50KM',55.0,'Chiang Mai','Thailand',2026,7,11,'2026-07-11','trail-running','Trail','Mountain','UTMB World Series','manual','https://chiangmai.utmb.world',80),
('Chiang Mai 30K by UTMB',ARRAY['Chiang Mai UTMB 30K','Chiang Mai Trail 30K'],'run','Marathon',30.0,'Chiang Mai','Thailand',2026,7,11,'2026-07-11','trail-running','Trail','Rolling','UTMB World Series','manual','https://chiangmai.utmb.world',75),
('Chiang Mai 15K by UTMB',ARRAY['Chiang Mai UTMB 15K','Chiang Mai Trail 15K'],'run','10KM',15.0,'Chiang Mai','Thailand',2026,7,12,'2026-07-12','trail-running','Trail','Rolling','UTMB World Series','manual','https://chiangmai.utmb.world',65),

-- ══════════════════════════════════════════════════════════════
-- KAT — KAINDY ALATAU TRAIL BY UTMB — Almaty, Kazakhstan — Jul 2026
-- ══════════════════════════════════════════════════════════════
('KAT 100K by UTMB',ARRAY['Kaindy Alatau Trail 100K','KAT UTMB 100K','Kazakhstan UTMB 100K'],'run','100KM',100.0,'Almaty','Kazakhstan',2026,7,17,'2026-07-17','trail-running','Trail','Mountain','UTMB World Series','manual','https://kat.utmb.world',85),
('KAT 55K by UTMB',ARRAY['Kaindy Alatau Trail 55K','KAT UTMB 55K'],'run','50KM',55.0,'Almaty','Kazakhstan',2026,7,18,'2026-07-18','trail-running','Trail','Mountain','UTMB World Series','manual','https://kat.utmb.world',80),
('KAT 25K by UTMB',ARRAY['Kaindy Alatau Trail 25K','KAT UTMB 25K'],'run','Half Marathon',25.0,'Almaty','Kazakhstan',2026,7,18,'2026-07-18','trail-running','Trail','Mountain','UTMB World Series','manual','https://kat.utmb.world',70),

-- ══════════════════════════════════════════════════════════════
-- KAÇKAR BY UTMB — Artvin, Turkey — Aug 2026
-- ══════════════════════════════════════════════════════════════
('Kaçkar 100K by UTMB',ARRAY['Kackar UTMB 100K','Kackar Trail 100K','Kaçkar Ultra'],'run','100KM',100.0,'Artvin','Turkey',2026,8,7,'2026-08-07','trail-running','Trail','Mountain','UTMB World Series','manual','https://kackar.utmb.world',85),
('Kaçkar 60K by UTMB',ARRAY['Kackar UTMB 60K','Kackar Trail 60K'],'run','50KM',60.0,'Artvin','Turkey',2026,8,8,'2026-08-08','trail-running','Trail','Mountain','UTMB World Series','manual','https://kackar.utmb.world',80),
('Kaçkar 35K by UTMB',ARRAY['Kackar UTMB 35K','Kackar Trail 35K'],'run','Marathon',35.0,'Artvin','Turkey',2026,8,8,'2026-08-08','trail-running','Trail','Mountain','UTMB World Series','manual','https://kackar.utmb.world',75),
('Kaçkar 16K by UTMB',ARRAY['Kackar UTMB 16K','Kackar Trail 16K'],'run','10KM',16.0,'Artvin','Turkey',2026,8,9,'2026-08-09','trail-running','Trail','Rolling','UTMB World Series','manual','https://kackar.utmb.world',65),

-- ══════════════════════════════════════════════════════════════
-- BOREALYS BY UTMB — Mont-Tremblant, Quebec, Canada — Aug 2026
-- ══════════════════════════════════════════════════════════════
('Borealys Ultra 100K by UTMB',ARRAY['Borealys UTMB 100K','Borealys Quebec 100K'],'run','100KM',100.0,'Mont-Tremblant','Canada',2026,8,14,'2026-08-14','trail-running','Trail','Rolling','UTMB World Series','manual','https://borealys.utmb.world',85),
('Borealys 55K by UTMB',ARRAY['Borealys UTMB 55K'],'run','50KM',55.0,'Mont-Tremblant','Canada',2026,8,15,'2026-08-15','trail-running','Trail','Rolling','UTMB World Series','manual','https://borealys.utmb.world',80),
('Borealys 25K by UTMB',ARRAY['Borealys UTMB 25K'],'run','Half Marathon',25.0,'Mont-Tremblant','Canada',2026,8,15,'2026-08-15','trail-running','Trail','Rolling','UTMB World Series','manual','https://borealys.utmb.world',70),
('Borealys 10K by UTMB',ARRAY['Borealys UTMB 10K'],'run','10KM',10.0,'Mont-Tremblant','Canada',2026,8,16,'2026-08-16','trail-running','Trail','Rolling','UTMB World Series','manual','https://borealys.utmb.world',60),

-- ══════════════════════════════════════════════════════════════
-- KODIAK BY UTMB — Kodiak, Alaska, USA — Aug 2026
-- ══════════════════════════════════════════════════════════════
('Kodiak 100K by UTMB',ARRAY['Kodiak UTMB 100K','Kodiak Ultra Alaska'],'run','100KM',100.0,'Kodiak','United States',2026,8,14,'2026-08-14','trail-running','Trail','Mountain','UTMB World Series','manual','https://kodiak.utmb.world',85),
('Kodiak 55K by UTMB',ARRAY['Kodiak UTMB 55K'],'run','50KM',55.0,'Kodiak','United States',2026,8,15,'2026-08-15','trail-running','Trail','Mountain','UTMB World Series','manual','https://kodiak.utmb.world',80),
('Kodiak 25K by UTMB',ARRAY['Kodiak UTMB 25K'],'run','Half Marathon',25.0,'Kodiak','United States',2026,8,15,'2026-08-15','trail-running','Trail','Mountain','UTMB World Series','manual','https://kodiak.utmb.world',70),

-- ══════════════════════════════════════════════════════════════
-- UTMB MONT-BLANC — Chamonix, France — Aug 24–30 2026
-- THE flagship event; PTL, TDS, CCC, UTMB, OCC, MCC
-- ══════════════════════════════════════════════════════════════
('PTL by UTMB',ARRAY['Petite Trotte à Léon','PTL UTMB','PTL Chamonix'],'run','100KM',300.0,'Chamonix','France',2026,8,24,'2026-08-24','trail-running','Trail','Mountain','UTMB World Series','manual','https://montblanc.utmb.world',85),
('TDS by UTMB',ARRAY['Sur les Traces des Ducs de Savoie','TDS UTMB','TDS Chamonix'],'run','100KM',145.0,'Courmayeur','France',2026,8,26,'2026-08-26','trail-running','Trail','Mountain','UTMB World Series','manual','https://montblanc.utmb.world',85),
('UTMB by UTMB',ARRAY['Ultra-Trail du Mont-Blanc','UTMB 171K','UTMB Chamonix'],'run','100KM',171.0,'Chamonix','France',2026,8,28,'2026-08-28','trail-running','Trail','Mountain','UTMB World Series','manual','https://montblanc.utmb.world',85),
('CCC by UTMB',ARRAY['Courmayeur-Champex-Chamonix','CCC UTMB','CCC 100K'],'run','100KM',101.0,'Courmayeur','Italy',2026,8,27,'2026-08-27','trail-running','Trail','Mountain','UTMB World Series','manual','https://montblanc.utmb.world',85),
('OCC by UTMB',ARRAY['Orsières-Champex-Chamonix','OCC UTMB','OCC 56K'],'run','50KM',56.0,'Orsières','Switzerland',2026,8,30,'2026-08-30','trail-running','Trail','Mountain','UTMB World Series','manual','https://montblanc.utmb.world',80),
('MCC by UTMB',ARRAY['Martigny-Combe-Chamonix','MCC UTMB','MCC 40K'],'run','Marathon',40.0,'Martigny','Switzerland',2026,8,29,'2026-08-29','trail-running','Trail','Mountain','UTMB World Series','manual','https://montblanc.utmb.world',75),

-- ══════════════════════════════════════════════════════════════
-- WHISTLER ALPINE MEADOWS BY UTMB — Whistler, BC, Canada — Sep 2026
-- ══════════════════════════════════════════════════════════════
('Whistler 100K by UTMB',ARRAY['Whistler Alpine Meadows UTMB 100K','WAM 100K'],'run','100KM',100.0,'Whistler','Canada',2026,9,4,'2026-09-04','trail-running','Trail','Mountain','UTMB World Series','manual','https://whistler.utmb.world',85),
('Whistler 55K by UTMB',ARRAY['Whistler Alpine Meadows UTMB 55K','WAM 55K'],'run','50KM',55.0,'Whistler','Canada',2026,9,5,'2026-09-05','trail-running','Trail','Mountain','UTMB World Series','manual','https://whistler.utmb.world',80),
('Whistler 25K by UTMB',ARRAY['Whistler Alpine Meadows UTMB 25K','WAM 25K'],'run','Half Marathon',25.0,'Whistler','Canada',2026,9,5,'2026-09-05','trail-running','Trail','Mountain','UTMB World Series','manual','https://whistler.utmb.world',70),
('Whistler 10K by UTMB',ARRAY['Whistler Alpine Meadows UTMB 10K','WAM 10K'],'run','10KM',10.0,'Whistler','Canada',2026,9,6,'2026-09-06','trail-running','Trail','Rolling','UTMB World Series','manual','https://whistler.utmb.world',60),

-- ══════════════════════════════════════════════════════════════
-- WILD STRUBEL BY UTMB — Lenk im Simmental, Switzerland — Sep 2026
-- ══════════════════════════════════════════════════════════════
('Wild Strubel 100K by UTMB',ARRAY['Wild Strubel UTMB 100K','Wild Strubel Ultra'],'run','100KM',100.0,'Lenk im Simmental','Switzerland',2026,9,11,'2026-09-11','trail-running','Trail','Mountain','UTMB World Series','manual','https://wildstrubel.utmb.world',85),
('Wild Strubel 60K by UTMB',ARRAY['Wild Strubel UTMB 60K'],'run','50KM',60.0,'Lenk im Simmental','Switzerland',2026,9,12,'2026-09-12','trail-running','Trail','Mountain','UTMB World Series','manual','https://wildstrubel.utmb.world',80),
('Wild Strubel 35K by UTMB',ARRAY['Wild Strubel UTMB 35K'],'run','Marathon',35.0,'Lenk im Simmental','Switzerland',2026,9,12,'2026-09-12','trail-running','Trail','Mountain','UTMB World Series','manual','https://wildstrubel.utmb.world',75),
('Wild Strubel 20K by UTMB',ARRAY['Wild Strubel UTMB 20K'],'run','Half Marathon',20.0,'Lenk im Simmental','Switzerland',2026,9,13,'2026-09-13','trail-running','Trail','Rolling','UTMB World Series','manual','https://wildstrubel.utmb.world',65),

-- ══════════════════════════════════════════════════════════════
-- MALAYSIA BY UTMB — Fraser''s Hill / Pahang, Malaysia — Sep 2026
-- ══════════════════════════════════════════════════════════════
('Malaysia 100K by UTMB',ARRAY['Malaysia UTMB 100K','Malaysia Trail 100K'],'run','100KM',100.0,'Pahang','Malaysia',2026,9,18,'2026-09-18','trail-running','Trail','Mountain','UTMB World Series','manual','https://malaysia.utmb.world',85),
('Malaysia 55K by UTMB',ARRAY['Malaysia UTMB 55K','Malaysia Trail 55K'],'run','50KM',55.0,'Pahang','Malaysia',2026,9,19,'2026-09-19','trail-running','Trail','Mountain','UTMB World Series','manual','https://malaysia.utmb.world',80),
('Malaysia 30K by UTMB',ARRAY['Malaysia UTMB 30K'],'run','Marathon',30.0,'Pahang','Malaysia',2026,9,19,'2026-09-19','trail-running','Trail','Rolling','UTMB World Series','manual','https://malaysia.utmb.world',75),
('Malaysia 15K by UTMB',ARRAY['Malaysia UTMB 15K'],'run','10KM',15.0,'Pahang','Malaysia',2026,9,20,'2026-09-20','trail-running','Trail','Rolling','UTMB World Series','manual','https://malaysia.utmb.world',65),

-- ══════════════════════════════════════════════════════════════
-- SNOWBASIN BY UTMB — Eden, Utah, USA — Sep 2026
-- ══════════════════════════════════════════════════════════════
('Snowbasin 100K by UTMB',ARRAY['Snowbasin UTMB 100K','Snowbasin Mountain Ultra'],'run','100KM',100.0,'Eden','United States',2026,9,25,'2026-09-25','trail-running','Trail','Mountain','UTMB World Series','manual','https://snowbasin.utmb.world',85),
('Snowbasin 55K by UTMB',ARRAY['Snowbasin UTMB 55K'],'run','50KM',55.0,'Eden','United States',2026,9,26,'2026-09-26','trail-running','Trail','Mountain','UTMB World Series','manual','https://snowbasin.utmb.world',80),
('Snowbasin 25K by UTMB',ARRAY['Snowbasin UTMB 25K'],'run','Half Marathon',25.0,'Eden','United States',2026,9,26,'2026-09-26','trail-running','Trail','Mountain','UTMB World Series','manual','https://snowbasin.utmb.world',70),
('Snowbasin 10K by UTMB',ARRAY['Snowbasin UTMB 10K'],'run','10KM',10.0,'Eden','United States',2026,9,27,'2026-09-27','trail-running','Trail','Rolling','UTMB World Series','manual','https://snowbasin.utmb.world',60),

-- ══════════════════════════════════════════════════════════════
-- KULLAMANNEN BY UTMB — Mölle, Sweden — Oct 2026
-- ══════════════════════════════════════════════════════════════
('Kullamannen Ultra 166K by UTMB',ARRAY['Kullamannen UTMB 166K','Kullamannen Ultra'],'run','100KM',166.0,'Mölle','Sweden',2026,10,1,'2026-10-01','trail-running','Trail','Rolling','UTMB World Series','manual','https://kullamannen.utmb.world',85),
('Kullamannen 55K by UTMB',ARRAY['Kullamannen UTMB 55K','Kullamannen Vertical Ultra'],'run','50KM',55.0,'Mölle','Sweden',2026,10,2,'2026-10-02','trail-running','Trail','Rolling','UTMB World Series','manual','https://kullamannen.utmb.world',80),
('Kullamannen 21K by UTMB',ARRAY['Kullamannen UTMB 21K','Half Kull'],'run','Half Marathon',21.0,'Mölle','Sweden',2026,10,3,'2026-10-03','trail-running','Trail','Rolling','UTMB World Series','manual','https://kullamannen.utmb.world',70),

-- ══════════════════════════════════════════════════════════════
-- TRANS JEJU BY UTMB — Jeju Island, South Korea — Oct 2026
-- ══════════════════════════════════════════════════════════════
('Trans Jeju 100K by UTMB',ARRAY['TransJeju UTMB 100K','Trans Jeju Ultra 100K'],'run','100KM',100.0,'Jeju City','South Korea',2026,10,16,'2026-10-16','trail-running','Trail','Rolling','UTMB World Series','manual','https://transjeju.utmb.world',85),
('Trans Jeju 50K by UTMB',ARRAY['TransJeju UTMB 50K','Trans Jeju Ultra 50K'],'run','50KM',50.0,'Jeju City','South Korea',2026,10,17,'2026-10-17','trail-running','Trail','Rolling','UTMB World Series','manual','https://transjeju.utmb.world',80),
('Trans Jeju 21K by UTMB',ARRAY['TransJeju UTMB 21K','Trans Jeju Ultra 21K'],'run','Half Marathon',21.0,'Jeju City','South Korea',2026,10,17,'2026-10-17','trail-running','Trail','Rolling','UTMB World Series','manual','https://transjeju.utmb.world',70),
('Trans Jeju 10K by UTMB',ARRAY['TransJeju UTMB 10K'],'run','10KM',10.0,'Jeju City','South Korea',2026,10,18,'2026-10-18','trail-running','Trail','Rolling','UTMB World Series','manual','https://transjeju.utmb.world',60),

-- ══════════════════════════════════════════════════════════════
-- GRINDSTONE BY UTMB — Swoope, Virginia, USA — Oct 2026
-- ══════════════════════════════════════════════════════════════
('Grindstone 100 by UTMB',ARRAY['Grindstone 100 Mile','Grindstone UTMB 100M'],'run','100M',161.0,'Swoope','United States',2026,10,2,'2026-10-02','trail-running','Trail','Mountain','UTMB World Series','manual','https://grindstone.utmb.world',85),
('Grindstone 50 by UTMB',ARRAY['Grindstone 50 Mile','Grindstone UTMB 50M'],'run','50KM',80.5,'Swoope','United States',2026,10,3,'2026-10-03','trail-running','Trail','Mountain','UTMB World Series','manual','https://grindstone.utmb.world',80),

-- ══════════════════════════════════════════════════════════════
-- KOSCIUSZKO BY UTMB — Thredbo / Jindabyne, NSW, Australia — Oct 2026
-- ══════════════════════════════════════════════════════════════
('Kosciuszko 100K by UTMB',ARRAY['Kosciuszko UTMB 100K','Kosi Ultra 100K'],'run','100KM',100.0,'Thredbo','Australia',2026,10,23,'2026-10-23','trail-running','Trail','Mountain','UTMB World Series','manual','https://kosciuszko.utmb.world',85),
('Kosciuszko 55K by UTMB',ARRAY['Kosciuszko UTMB 55K','Kosi Ultra 55K'],'run','50KM',55.0,'Thredbo','Australia',2026,10,24,'2026-10-24','trail-running','Trail','Mountain','UTMB World Series','manual','https://kosciuszko.utmb.world',80),
('Kosciuszko 25K by UTMB',ARRAY['Kosciuszko UTMB 25K','Kosi Ultra 25K'],'run','Half Marathon',25.0,'Thredbo','Australia',2026,10,24,'2026-10-24','trail-running','Trail','Mountain','UTMB World Series','manual','https://kosciuszko.utmb.world',70),

-- ══════════════════════════════════════════════════════════════
-- MOUNT YUN BY UTMB — Yunnan, China — Oct 2026
-- ══════════════════════════════════════════════════════════════
('Mount Yun 100K by UTMB',ARRAY['Mount Yun UTMB 100K','Yunnan Trail 100K'],'run','100KM',100.0,'Dali','China',2026,10,16,'2026-10-16','trail-running','Trail','Mountain','UTMB World Series','manual','https://mount-yun.utmb.world',85),
('Mount Yun 60K by UTMB',ARRAY['Mount Yun UTMB 60K'],'run','50KM',60.0,'Dali','China',2026,10,17,'2026-10-17','trail-running','Trail','Mountain','UTMB World Series','manual','https://mount-yun.utmb.world',80),
('Mount Yun 35K by UTMB',ARRAY['Mount Yun UTMB 35K'],'run','Marathon',35.0,'Dali','China',2026,10,17,'2026-10-17','trail-running','Trail','Mountain','UTMB World Series','manual','https://mount-yun.utmb.world',75),
('Mount Yun 20K by UTMB',ARRAY['Mount Yun UTMB 20K'],'run','Half Marathon',20.0,'Dali','China',2026,10,18,'2026-10-18','trail-running','Trail','Rolling','UTMB World Series','manual','https://mount-yun.utmb.world',65),

-- ══════════════════════════════════════════════════════════════
-- MALLORCA TRAIL BY UTMB — Palma de Mallorca, Spain — Oct 2026
-- ══════════════════════════════════════════════════════════════
('Mallorca Trail 100K by UTMB',ARRAY['Mallorca UTMB 100K','Mallorca Trail Ultra 100K'],'run','100KM',100.0,'Palma de Mallorca','Spain',2026,10,30,'2026-10-30','trail-running','Trail','Mountain','UTMB World Series','manual','https://mallorca.utmb.world',85),
('Mallorca Trail 55K by UTMB',ARRAY['Mallorca UTMB 55K'],'run','50KM',55.0,'Palma de Mallorca','Spain',2026,10,31,'2026-10-31','trail-running','Trail','Mountain','UTMB World Series','manual','https://mallorca.utmb.world',80),
('Mallorca Trail 30K by UTMB',ARRAY['Mallorca UTMB 30K'],'run','Marathon',30.0,'Palma de Mallorca','Spain',2026,10,31,'2026-10-31','trail-running','Trail','Rolling','UTMB World Series','manual','https://mallorca.utmb.world',75),

-- ══════════════════════════════════════════════════════════════
-- PUGLIA BY UTMB — Fasano, Puglia, Italy — Oct 2026
-- ══════════════════════════════════════════════════════════════
('Puglia 100K by UTMB',ARRAY['Puglia UTMB 100K','Puglia Trail 100K'],'run','100KM',100.0,'Fasano','Italy',2026,10,23,'2026-10-23','trail-running','Trail','Rolling','UTMB World Series','manual','https://puglia.utmb.world',85),
('Puglia 55K by UTMB',ARRAY['Puglia UTMB 55K'],'run','50KM',55.0,'Fasano','Italy',2026,10,24,'2026-10-24','trail-running','Trail','Rolling','UTMB World Series','manual','https://puglia.utmb.world',80),
('Puglia 30K by UTMB',ARRAY['Puglia UTMB 30K'],'run','Marathon',30.0,'Fasano','Italy',2026,10,24,'2026-10-24','trail-running','Trail','Rolling','UTMB World Series','manual','https://puglia.utmb.world',75),

-- ══════════════════════════════════════════════════════════════
-- CHIHUAHUA BY UTMB — Creel / Copper Canyon, Mexico — Nov 2026
-- ══════════════════════════════════════════════════════════════
('Chihuahua 100K by UTMB',ARRAY['Chihuahua UTMB 100K','Copper Canyon Ultra 100K'],'run','100KM',100.0,'Creel','Mexico',2026,11,6,'2026-11-06','trail-running','Trail','Mountain','UTMB World Series','manual','https://chihuahua.utmb.world',85),
('Chihuahua 55K by UTMB',ARRAY['Chihuahua UTMB 55K'],'run','50KM',55.0,'Creel','Mexico',2026,11,7,'2026-11-07','trail-running','Trail','Mountain','UTMB World Series','manual','https://chihuahua.utmb.world',80),
('Chihuahua 25K by UTMB',ARRAY['Chihuahua UTMB 25K'],'run','Half Marathon',25.0,'Creel','Mexico',2026,11,7,'2026-11-07','trail-running','Trail','Mountain','UTMB World Series','manual','https://chihuahua.utmb.world',70),

-- ══════════════════════════════════════════════════════════════
-- BARILOCHE BY UTMB — San Carlos de Bariloche, Argentina — Nov 2026
-- ══════════════════════════════════════════════════════════════
('Bariloche 100K by UTMB',ARRAY['Bariloche UTMB 100K','Patagonia Trail Bariloche 100K'],'run','100KM',100.0,'San Carlos de Bariloche','Argentina',2026,11,13,'2026-11-13','trail-running','Trail','Mountain','UTMB World Series','manual','https://bariloche.utmb.world',85),
('Bariloche 55K by UTMB',ARRAY['Bariloche UTMB 55K'],'run','50KM',55.0,'San Carlos de Bariloche','Argentina',2026,11,14,'2026-11-14','trail-running','Trail','Mountain','UTMB World Series','manual','https://bariloche.utmb.world',80),
('Bariloche 30K by UTMB',ARRAY['Bariloche UTMB 30K'],'run','Marathon',30.0,'San Carlos de Bariloche','Argentina',2026,11,14,'2026-11-14','trail-running','Trail','Mountain','UTMB World Series','manual','https://bariloche.utmb.world',75),
('Bariloche 15K by UTMB',ARRAY['Bariloche UTMB 15K'],'run','10KM',15.0,'San Carlos de Bariloche','Argentina',2026,11,15,'2026-11-15','trail-running','Trail','Rolling','UTMB World Series','manual','https://bariloche.utmb.world',65),

-- ══════════════════════════════════════════════════════════════
-- NICE CÔTE D''AZUR BY UTMB — Nice, France — Nov 2026
-- ══════════════════════════════════════════════════════════════
('Nice Côte d''Azur 100K by UTMB',ARRAY['Nice UTMB 100K','Nice Cote d Azur Trail 100K'],'run','100KM',100.0,'Nice','France',2026,11,6,'2026-11-06','trail-running','Trail','Mountain','UTMB World Series','manual','https://nice.utmb.world',85),
('Nice Côte d''Azur 55K by UTMB',ARRAY['Nice UTMB 55K'],'run','50KM',55.0,'Nice','France',2026,11,7,'2026-11-07','trail-running','Trail','Mountain','UTMB World Series','manual','https://nice.utmb.world',80),
('Nice Côte d''Azur 30K by UTMB',ARRAY['Nice UTMB 30K'],'run','Marathon',30.0,'Nice','France',2026,11,7,'2026-11-07','trail-running','Trail','Rolling','UTMB World Series','manual','https://nice.utmb.world',75),
('Nice Côte d''Azur 15K by UTMB',ARRAY['Nice UTMB 15K'],'run','10KM',15.0,'Nice','France',2026,11,8,'2026-11-08','trail-running','Trail','Rolling','UTMB World Series','manual','https://nice.utmb.world',65),

-- ══════════════════════════════════════════════════════════════
-- DA JING MEN BY UTMB — Zhejiang, China — Nov 2026
-- ══════════════════════════════════════════════════════════════
('Da Jing Men 100K by UTMB',ARRAY['Dajingmen UTMB 100K','Da Jing Men Ultra'],'run','100KM',100.0,'Hangzhou','China',2026,11,13,'2026-11-13','trail-running','Trail','Mountain','UTMB World Series','manual','https://dajingmen.utmb.world',85),
('Da Jing Men 55K by UTMB',ARRAY['Dajingmen UTMB 55K'],'run','50KM',55.0,'Hangzhou','China',2026,11,14,'2026-11-14','trail-running','Trail','Mountain','UTMB World Series','manual','https://dajingmen.utmb.world',80),
('Da Jing Men 30K by UTMB',ARRAY['Dajingmen UTMB 30K'],'run','Marathon',30.0,'Hangzhou','China',2026,11,14,'2026-11-14','trail-running','Trail','Rolling','UTMB World Series','manual','https://dajingmen.utmb.world',75),
('Da Jing Men 15K by UTMB',ARRAY['Dajingmen UTMB 15K'],'run','10KM',15.0,'Hangzhou','China',2026,11,15,'2026-11-15','trail-running','Trail','Rolling','UTMB World Series','manual','https://dajingmen.utmb.world',65),

-- ══════════════════════════════════════════════════════════════
-- SHU DAO BY UTMB — Sichuan, China — Nov 2026
-- ══════════════════════════════════════════════════════════════
('Shu Dao 100K by UTMB',ARRAY['Shudao UTMB 100K','Sichuan Trail 100K','Shu Dao Ultra'],'run','100KM',100.0,'Chengdu','China',2026,11,20,'2026-11-20','trail-running','Trail','Mountain','UTMB World Series','manual','https://shudao.utmb.world',85),
('Shu Dao 55K by UTMB',ARRAY['Shudao UTMB 55K'],'run','50KM',55.0,'Chengdu','China',2026,11,21,'2026-11-21','trail-running','Trail','Mountain','UTMB World Series','manual','https://shudao.utmb.world',80),
('Shu Dao 25K by UTMB',ARRAY['Shudao UTMB 25K'],'run','Half Marathon',25.0,'Chengdu','China',2026,11,21,'2026-11-21','trail-running','Trail','Rolling','UTMB World Series','manual','https://shudao.utmb.world',70),

-- ══════════════════════════════════════════════════════════════
-- X-TRAIL BY UTMB — Xàtiva, Spain — Nov 2026
-- ══════════════════════════════════════════════════════════════
('X-Trail 100K by UTMB',ARRAY['XTrail UTMB 100K','X Trail Valencia 100K'],'run','100KM',100.0,'Xàtiva','Spain',2026,11,20,'2026-11-20','trail-running','Trail','Mountain','UTMB World Series','manual','https://xtrail.utmb.world',85),
('X-Trail 60K by UTMB',ARRAY['XTrail UTMB 60K'],'run','50KM',60.0,'Xàtiva','Spain',2026,11,21,'2026-11-21','trail-running','Trail','Mountain','UTMB World Series','manual','https://xtrail.utmb.world',80),
('X-Trail 35K by UTMB',ARRAY['XTrail UTMB 35K'],'run','Marathon',35.0,'Xàtiva','Spain',2026,11,21,'2026-11-21','trail-running','Trail','Rolling','UTMB World Series','manual','https://xtrail.utmb.world',75),

-- ══════════════════════════════════════════════════════════════
-- PACIFIC TRAILS BY UTMB — Aomori, Japan — Nov 2026
-- ══════════════════════════════════════════════════════════════
('Pacific Trails 100K by UTMB',ARRAY['Pacific Trails UTMB 100K','Pacific Trails Japan'],'run','100KM',100.0,'Aomori','Japan',2026,11,20,'2026-11-20','trail-running','Trail','Mountain','UTMB World Series','manual','https://pacifictrails.utmb.world',85),
('Pacific Trails 55K by UTMB',ARRAY['Pacific Trails UTMB 55K'],'run','50KM',55.0,'Aomori','Japan',2026,11,21,'2026-11-21','trail-running','Trail','Mountain','UTMB World Series','manual','https://pacifictrails.utmb.world',80),
('Pacific Trails 25K by UTMB',ARRAY['Pacific Trails UTMB 25K'],'run','Half Marathon',25.0,'Aomori','Japan',2026,11,21,'2026-11-21','trail-running','Trail','Rolling','UTMB World Series','manual','https://pacifictrails.utmb.world',70),

-- ══════════════════════════════════════════════════════════════
-- XIAMEN BY UTMB — Xiamen, China — Dec 2026
-- ══════════════════════════════════════════════════════════════
('Xiamen 100K by UTMB',ARRAY['Xiamen UTMB 100K','Xiamen Trail 100K'],'run','100KM',100.0,'Xiamen','China',2026,12,4,'2026-12-04','trail-running','Trail','Rolling','UTMB World Series','manual','https://xiamen.utmb.world',85),
('Xiamen 55K by UTMB',ARRAY['Xiamen UTMB 55K'],'run','50KM',55.0,'Xiamen','China',2026,12,5,'2026-12-05','trail-running','Trail','Rolling','UTMB World Series','manual','https://xiamen.utmb.world',80),
('Xiamen 25K by UTMB',ARRAY['Xiamen UTMB 25K'],'run','Half Marathon',25.0,'Xiamen','China',2026,12,5,'2026-12-05','trail-running','Trail','Rolling','UTMB World Series','manual','https://xiamen.utmb.world',70);

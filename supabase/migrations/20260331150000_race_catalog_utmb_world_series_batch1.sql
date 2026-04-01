-- UTMB World Series Events — Batch 1 (31 events, ~180 race distances)
-- Sourced by browsing each event's official utmb.world subdomain.
-- Distances converted from miles, elevation from feet.

INSERT INTO race_catalog (
  name, aliases, type, dist, dist_km, city, country,
  year, month, day, event_date, discipline, surface, elevation_profile,
  series, source_site, source_url, source_priority
) VALUES

-- ══════════════════════════════════════════════════════════════
-- ULTRA-TRAIL MOGAN BY UTMB — Moganshan, China — Apr 10–12 2026
-- ══════════════════════════════════════════════════════════════
('Ultra-Trail Mogan 112K by UTMB',ARRAY['DMG Mogan','Mogan DMG','Mogan UTMB 112K'],'run','100KM',112.2,'Moganshan','China',2026,4,10,'2026-04-10','trail-running','Trail','Mountain','UTMB World Series','manual','https://mogan.utmb.world',85),
('Ultra-Trail Mogan 78K by UTMB',ARRAY['CMG Mogan','Mogan CMG'],'run','50KM',78.4,'Moganshan','China',2026,4,10,'2026-04-10','trail-running','Trail','Mountain','UTMB World Series','manual','https://mogan.utmb.world',80),
('Ultra-Trail Mogan 46K by UTMB',ARRAY['MMG Mogan','Mogan MMG'],'run','50KM',46.3,'Moganshan','China',2026,4,11,'2026-04-11','trail-running','Trail','Mountain','UTMB World Series','manual','https://mogan.utmb.world',75),
('Ultra-Trail Mogan 21K by UTMB',ARRAY['EMG Mogan','Mogan EMG'],'run','Half Marathon',20.8,'Moganshan','China',2026,4,12,'2026-04-12','trail-running','Trail','Mountain','UTMB World Series','manual','https://mogan.utmb.world',70),

-- ══════════════════════════════════════════════════════════════
-- ISTRIA 100 BY UTMB — Umag, Croatia — Apr 9–12 2026
-- ══════════════════════════════════════════════════════════════
('Istria 168K by UTMB',ARRAY['Istria 100 168K','Istria UTMB 168'],'run','100KM',168.2,'Umag','Croatia',2026,4,10,'2026-04-10','trail-running','Trail','Rolling','UTMB World Series','manual','https://istria.utmb.world',85),
('Istria 110K by UTMB',ARRAY['Istria 100 110K'],'run','100KM',111.4,'Umag','Croatia',2026,4,11,'2026-04-11','trail-running','Trail','Rolling','UTMB World Series','manual','https://istria.utmb.world',80),
('Istria 69K by UTMB',ARRAY['Istria 100 69K'],'run','50KM',69.5,'Umag','Croatia',2026,4,11,'2026-04-11','trail-running','Trail','Rolling','UTMB World Series','manual','https://istria.utmb.world',75),
('Istria 42K by UTMB',ARRAY['Istria 100 42K'],'run','Marathon',42.5,'Umag','Croatia',2026,4,11,'2026-04-11','trail-running','Trail','Rolling','UTMB World Series','manual','https://istria.utmb.world',75),
('Istria 21K by UTMB',ARRAY['Istria 100 21K'],'run','Half Marathon',21.4,'Umag','Croatia',2026,4,12,'2026-04-12','trail-running','Trail','Rolling','UTMB World Series','manual','https://istria.utmb.world',70),

-- ══════════════════════════════════════════════════════════════
-- PUERTO VALLARTA BY UTMB — Puerto Vallarta, Mexico — Apr 16–18 2026
-- ══════════════════════════════════════════════════════════════
('Puerto Vallarta 81K by UTMB',ARRAY['Hikuri 81K','Puerto Vallarta UTMB 81K'],'run','50KM',80.9,'Puerto Vallarta','Mexico',2026,4,17,'2026-04-17','trail-running','Trail','Mountain','UTMB World Series','manual','https://puerto-vallarta.utmb.world',85),
('Puerto Vallarta 53K by UTMB',ARRAY['Nakawé 53K','Puerto Vallarta UTMB 53K'],'run','50KM',52.9,'Puerto Vallarta','Mexico',2026,4,17,'2026-04-17','trail-running','Trail','Mountain','UTMB World Series','manual','https://puerto-vallarta.utmb.world',80),
('Puerto Vallarta 37K by UTMB',ARRAY['Haramara 37K','Puerto Vallarta UTMB 37K'],'run','Marathon',36.9,'Puerto Vallarta','Mexico',2026,4,18,'2026-04-18','trail-running','Trail','Mountain','UTMB World Series','manual','https://puerto-vallarta.utmb.world',75),
('Puerto Vallarta 20K by UTMB',ARRAY['Ereno 20K','Puerto Vallarta UTMB 20K'],'run','Half Marathon',20.0,'Puerto Vallarta','Mexico',2026,4,18,'2026-04-18','trail-running','Trail','Mountain','UTMB World Series','manual','https://puerto-vallarta.utmb.world',70),
('Puerto Vallarta 5K by UTMB',ARRAY['Pata Salada 5K','Puerto Vallarta UTMB 5K'],'run','5KM',5.0,'Puerto Vallarta','Mexico',2026,4,17,'2026-04-17','trail-running','Trail','Mountain','UTMB World Series','manual','https://puerto-vallarta.utmb.world',65),

-- ══════════════════════════════════════════════════════════════
-- TENERIFE BLUETRAIL BY UTMB — Santa Cruz de Tenerife, Spain — Mar 19–21 2026
-- ══════════════════════════════════════════════════════════════
('Tenerife Bluetrail 110K by UTMB',ARRAY['Tenerife Bluetrail 110K','Tenerife UTMB 110K'],'run','100KM',109.9,'Santa Cruz de Tenerife','Spain',2026,3,20,'2026-03-20','trail-running','Trail','Mountain','UTMB World Series','manual','https://tenerife.utmb.world',85),
('Tenerife Bluetrail 73K by UTMB',ARRAY['Tenerife Bluetrail 73K','Tenerife UTMB 73K'],'run','50KM',72.9,'Santa Cruz de Tenerife','Spain',2026,3,21,'2026-03-21','trail-running','Trail','Mountain','UTMB World Series','manual','https://tenerife.utmb.world',80),
('Tenerife Bluetrail 47K by UTMB',ARRAY['Tenerife Bluetrail 47K','Tenerife UTMB 47K'],'run','Marathon',47.0,'Santa Cruz de Tenerife','Spain',2026,3,21,'2026-03-21','trail-running','Trail','Mountain','UTMB World Series','manual','https://tenerife.utmb.world',75),
('Tenerife Bluetrail 24K by UTMB',ARRAY['Tenerife Bluetrail 24K','Tenerife UTMB 24K'],'run','Half Marathon',24.0,'Santa Cruz de Tenerife','Spain',2026,3,21,'2026-03-21','trail-running','Trail','Mountain','UTMB World Series','manual','https://tenerife.utmb.world',70),

-- ══════════════════════════════════════════════════════════════
-- VALHÖLL END OF THE WORLD BY UTMB — Ushuaia, Argentina — Mar 20–22 2026
-- ══════════════════════════════════════════════════════════════
('Valhöll Epic 130K by UTMB',ARRAY['Ushuaia UTMB 130K','Valhoell Epic','End of the World 130K'],'run','100KM',113.0,'Ushuaia','Argentina',2026,3,21,'2026-03-21','trail-running','Trail','Mountain','UTMB World Series','manual','https://ushuaia.utmb.world',85),
('Valhöll Advance 85K by UTMB',ARRAY['Ushuaia UTMB 85K','Valhoell Advance'],'run','50KM',86.8,'Ushuaia','Argentina',2026,3,21,'2026-03-21','trail-running','Trail','Mountain','UTMB World Series','manual','https://ushuaia.utmb.world',80),
('Valhöll Challenge 50K by UTMB',ARRAY['Ushuaia UTMB 50K','Valhoell Challenge'],'run','50KM',49.9,'Ushuaia','Argentina',2026,3,21,'2026-03-21','trail-running','Trail','Mountain','UTMB World Series','manual','https://ushuaia.utmb.world',75),
('Valhöll Courage 33K by UTMB',ARRAY['Ushuaia UTMB 33K','Valhoell Courage'],'run','Marathon',33.8,'Ushuaia','Argentina',2026,3,20,'2026-03-20','trail-running','Trail','Mountain','UTMB World Series','manual','https://ushuaia.utmb.world',70),
('Valhöll Power 22K by UTMB',ARRAY['Ushuaia UTMB 22K','Valhoell Power'],'run','Half Marathon',22.4,'Ushuaia','Argentina',2026,3,20,'2026-03-20','trail-running','Trail','Mountain','UTMB World Series','manual','https://ushuaia.utmb.world',70),
('Valhöll Explore 12K by UTMB',ARRAY['Ushuaia UTMB 12K','Valhoell Explore'],'run','10KM',13.4,'Ushuaia','Argentina',2026,3,21,'2026-03-21','trail-running','Trail','Mountain','UTMB World Series','manual','https://ushuaia.utmb.world',65),

-- ══════════════════════════════════════════════════════════════
-- CANYONS ENDURANCE RUNS BY UTMB — Auburn, California, USA — Apr 23–26 2026
-- ══════════════════════════════════════════════════════════════
('Canyons 100M by UTMB',ARRAY['Canyons Endurance Run 100M','Canyons 100 Mile UTMB'],'run','100 Mile',161.0,'Auburn','United States',2026,4,24,'2026-04-24','trail-running','Trail','Mountain','UTMB World Series','manual','https://canyons.utmb.world',90),
('Canyons 100K by UTMB',ARRAY['Canyons Endurance Run 100K'],'run','100KM',99.9,'Auburn','United States',2026,4,25,'2026-04-25','trail-running','Trail','Mountain','UTMB World Series','manual','https://canyons.utmb.world',85),
('Canyons 50K by UTMB',ARRAY['Canyons Endurance Run 50K'],'run','50KM',49.9,'Auburn','United States',2026,4,25,'2026-04-25','trail-running','Trail','Mountain','UTMB World Series','manual','https://canyons.utmb.world',80),
('Canyons 25K by UTMB',ARRAY['Canyons Endurance Run 25K'],'run','Half Marathon',24.9,'Auburn','United States',2026,4,24,'2026-04-24','trail-running','Trail','Mountain','UTMB World Series','manual','https://canyons.utmb.world',75),

-- ══════════════════════════════════════════════════════════════
-- VENTOUX BY UTMB — Bédoin / Mont Ventoux, France — Apr 24–26 2026
-- ══════════════════════════════════════════════════════════════
('Ultra Géant de Provence 125K by UTMB',ARRAY['UGP Ventoux','Ventoux UTMB 125K','Géant de Provence'],'run','100KM',124.9,'Bédoin','France',2026,4,24,'2026-04-24','trail-running','Trail','Mountain','UTMB World Series','manual','https://ventoux.utmb.world',85),
('Grande Epopée Ventoux 87K by UTMB',ARRAY['GEV Ventoux','Ventoux UTMB 87K'],'run','50KM',86.9,'Bédoin','France',2026,4,25,'2026-04-25','trail-running','Trail','Mountain','UTMB World Series','manual','https://ventoux.utmb.world',80),
('Mistral Marathon Trail 51K by UTMB',ARRAY['MMT Ventoux','Ventoux UTMB 51K'],'run','50KM',50.8,'Bédoin','France',2026,4,26,'2026-04-26','trail-running','Trail','Mountain','UTMB World Series','manual','https://ventoux.utmb.world',75),
('Trail des Coteaux 26K by UTMB',ARRAY['TDC Ventoux','Ventoux UTMB 26K'],'run','Half Marathon',25.9,'Bédoin','France',2026,4,25,'2026-04-25','trail-running','Trail','Rolling','UTMB World Series','manual','https://ventoux.utmb.world',70),

-- ══════════════════════════════════════════════════════════════
-- AMAZEAN BY UTMB — Betong, Thailand — Apr 30–May 3 2026
-- ══════════════════════════════════════════════════════════════
('Amazean 115K by UTMB',ARRAY['Betong 100M UTMB','Amazean Betong 115K'],'run','100KM',114.9,'Betong','Thailand',2026,5,1,'2026-05-01','trail-running','Trail','Mountain','UTMB World Series','manual','https://amazean.utmb.world',85),
('Amazean Tunnel 90K by UTMB',ARRAY['Amazean 90K','Betong UTMB 90K'],'run','50KM',90.0,'Betong','Thailand',2026,5,2,'2026-05-02','trail-running','Trail','Mountain','UTMB World Series','manual','https://amazean.utmb.world',80),
('Amazean Jungle 55K by UTMB',ARRAY['Amazean 55K','Betong UTMB 55K'],'run','50KM',54.9,'Betong','Thailand',2026,5,2,'2026-05-02','trail-running','Trail','Mountain','UTMB World Series','manual','https://amazean.utmb.world',75),
('Amazean Mist 26K by UTMB',ARRAY['Amazean 26K','Betong UTMB 26K'],'run','Half Marathon',25.9,'Betong','Thailand',2026,5,3,'2026-05-03','trail-running','Trail','Rolling','UTMB World Series','manual','https://amazean.utmb.world',70),
('Amazean Flower 17K by UTMB',ARRAY['Amazean 17K','Betong UTMB 17K'],'run','10KM',16.9,'Betong','Thailand',2026,5,3,'2026-05-03','trail-running','Trail','Rolling','UTMB World Series','manual','https://amazean.utmb.world',65),

-- ══════════════════════════════════════════════════════════════
-- OH MEU DEUS BY UTMB — Covilhã, Portugal — May 1–3 2026
-- ══════════════════════════════════════════════════════════════
('Oh Meu Deus 163K by UTMB',ARRAY['OMD 100M','Oh Meu Deus UTMB 163K','Serra da Estrela UTMB'],'run','100 Mile',162.9,'Covilhã','Portugal',2026,5,1,'2026-05-01','trail-running','Trail','Mountain','UTMB World Series','manual','https://ohmeudeus.utmb.world',85),
('Oh Meu Deus 93K by UTMB',ARRAY['OMD 100K','Oh Meu Deus UTMB 100K'],'run','100KM',92.9,'Covilhã','Portugal',2026,5,1,'2026-05-01','trail-running','Trail','Mountain','UTMB World Series','manual','https://ohmeudeus.utmb.world',80),
('Oh Meu Deus 51K by UTMB',ARRAY['OMD 50K','Oh Meu Deus UTMB 50K'],'run','50KM',50.9,'Covilhã','Portugal',2026,5,1,'2026-05-01','trail-running','Trail','Mountain','UTMB World Series','manual','https://ohmeudeus.utmb.world',75),
('Oh Meu Deus 22K by UTMB',ARRAY['OMD 20K','Oh Meu Deus UTMB 20K'],'run','Half Marathon',21.9,'Covilhã','Portugal',2026,5,3,'2026-05-03','trail-running','Trail','Rolling','UTMB World Series','manual','https://ohmeudeus.utmb.world',70),

-- ══════════════════════════════════════════════════════════════
-- TRAIL ALSACE GRAND EST BY UTMB — Obernai, France — May 14–17 2026
-- ══════════════════════════════════════════════════════════════
('Ultra-Trail des Chevaliers 156K by UTMB',ARRAY['UTDC Alsace','Alsace UTMB 156K','Trail Alsace 100M'],'run','100 Mile',155.9,'Obernai','France',2026,5,15,'2026-05-15','trail-running','Trail','Rolling','UTMB World Series','manual','https://alsace.utmb.world',85),
('Ultra-Trail des Païens 109K by UTMB',ARRAY['UTDP Alsace','Alsace UTMB 109K','Trail Alsace 100K'],'run','100KM',108.9,'Obernai','France',2026,5,15,'2026-05-15','trail-running','Trail','Rolling','UTMB World Series','manual','https://alsace.utmb.world',80),
('Trail des Celtes 47K by UTMB',ARRAY['TDC Alsace','Alsace UTMB 47K'],'run','Marathon',47.0,'Obernai','France',2026,5,17,'2026-05-17','trail-running','Trail','Rolling','UTMB World Series','manual','https://alsace.utmb.world',75),
('Trail des Pèlerins 29K by UTMB',ARRAY['TDP Alsace','Alsace UTMB 29K'],'run','Half Marathon',29.0,'Obernai','France',2026,5,16,'2026-05-16','trail-running','Trail','Rolling','UTMB World Series','manual','https://alsace.utmb.world',70),
('Ronde des Pages 18K by UTMB',ARRAY['RDP Alsace','Alsace UTMB 18K'],'run','10KM',17.9,'Obernai','France',2026,5,16,'2026-05-16','trail-running','Trail','Rolling','UTMB World Series','manual','https://alsace.utmb.world',65),

-- ══════════════════════════════════════════════════════════════
-- HOKA ULTRA-TRAIL AUSTRALIA (UTA) BY UTMB — Katoomba, NSW, Australia — May 14–17 2026
-- ══════════════════════════════════════════════════════════════
('UTA Miler by UTMB',ARRAY['Ultra-Trail Australia Miler','UTA 100 Mile'],'run','100 Mile',161.1,'Katoomba','Australia',2026,5,15,'2026-05-15','trail-running','Trail','Mountain','UTMB World Series','manual','https://uta.utmb.world',90),
('UTA 100 by UTMB',ARRAY['Ultra-Trail Australia 100','UTA100'],'run','100KM',100.9,'Katoomba','Australia',2026,5,16,'2026-05-16','trail-running','Trail','Mountain','UTMB World Series','manual','https://uta.utmb.world',85),
('UTA 50 by UTMB',ARRAY['Ultra-Trail Australia 50','UTA50'],'run','50KM',50.9,'Katoomba','Australia',2026,5,16,'2026-05-16','trail-running','Trail','Mountain','UTMB World Series','manual','https://uta.utmb.world',80),
('UTA 22 by UTMB',ARRAY['Ultra-Trail Australia 22','UTA22'],'run','Half Marathon',21.9,'Katoomba','Australia',2026,5,15,'2026-05-15','trail-running','Trail','Mountain','UTMB World Series','manual','https://uta.utmb.world',75),
('UTA 11 by UTMB',ARRAY['Ultra-Trail Australia 11','UTA11'],'run','10KM',11.4,'Katoomba','Australia',2026,5,14,'2026-05-14','trail-running','Trail','Mountain','UTMB World Series','manual','https://uta.utmb.world',70),

-- ══════════════════════════════════════════════════════════════
-- ULTRA-TRAIL SNOWDONIA BY UTMB — Llanberis, Wales, UK — May 15–17 2026
-- ══════════════════════════════════════════════════════════════
('UTS 100M by UTMB',ARRAY['Ultra-Trail Snowdonia 100M','Snowdonia UTMB 100M'],'run','100 Mile',162.9,'Llanberis','United Kingdom',2026,5,15,'2026-05-15','trail-running','Trail','Mountain','UTMB World Series','manual','https://snowdonia.utmb.world',85),
('UTS 100K by UTMB',ARRAY['Ultra-Trail Snowdonia 100K','Snowdonia UTMB 100K'],'run','100KM',99.9,'Llanberis','United Kingdom',2026,5,16,'2026-05-16','trail-running','Trail','Mountain','UTMB World Series','manual','https://snowdonia.utmb.world',85),
('UTS 80K by UTMB',ARRAY['Ultra-Trail Snowdonia 80K','Snowdonia UTMB 80K'],'run','50KM',77.9,'Llanberis','United Kingdom',2026,5,15,'2026-05-15','trail-running','Trail','Mountain','UTMB World Series','manual','https://snowdonia.utmb.world',80),
('UTS 50K by UTMB',ARRAY['Ultra-Trail Snowdonia 50K','Snowdonia UTMB 50K'],'run','50KM',55.8,'Llanberis','United Kingdom',2026,5,16,'2026-05-16','trail-running','Trail','Mountain','UTMB World Series','manual','https://snowdonia.utmb.world',80),
('Eryri 25K by UTMB',ARRAY['UTS 25K','Snowdonia UTMB 25K','Eryri Trail 25K'],'run','Half Marathon',24.9,'Llanberis','United Kingdom',2026,5,17,'2026-05-17','trail-running','Trail','Mountain','UTMB World Series','manual','https://snowdonia.utmb.world',75),

-- ══════════════════════════════════════════════════════════════
-- ROTHROCK BY UTMB — State College, Pennsylvania, USA — May 15–17 2026
-- ══════════════════════════════════════════════════════════════
('Rothrock 50K by UTMB',ARRAY['Rothrock Trail 50K','Rothrock UTMB 50K'],'run','50KM',54.1,'State College','United States',2026,5,16,'2026-05-16','trail-running','Trail','Rolling','UTMB World Series','manual','https://rothrock.utmb.world',80),
('Rothrock 25K by UTMB',ARRAY['Rothrock Trail 25K','Rothrock UTMB 25K'],'run','Half Marathon',26.9,'State College','United States',2026,5,17,'2026-05-17','trail-running','Trail','Rolling','UTMB World Series','manual','https://rothrock.utmb.world',75),

-- ══════════════════════════════════════════════════════════════
-- MOZART 100 BY UTMB — Fuschlsee, Austria — May 23 2026
-- ══════════════════════════════════════════════════════════════
('Mozart 100 by UTMB',ARRAY['Mozart 100 Ultra Trail','Mozart UTMB 100'],'run','100KM',118.9,'Fuschlsee','Austria',2026,5,23,'2026-05-23','trail-running','Trail','Mountain','UTMB World Series','manual','https://mozart.utmb.world',85),
('Mozart Ultra 72K by UTMB',ARRAY['Mozart Ultra','Mozart UTMB 72K'],'run','50KM',71.9,'Fuschlsee','Austria',2026,5,23,'2026-05-23','trail-running','Trail','Mountain','UTMB World Series','manual','https://mozart.utmb.world',80),
('Mozart Marathon Trail 44K by UTMB',ARRAY['Mozart Marathon','Mozart UTMB 44K'],'run','Marathon',43.9,'Fuschlsee','Austria',2026,5,23,'2026-05-23','trail-running','Trail','Mountain','UTMB World Series','manual','https://mozart.utmb.world',75),
('Mozart Half Marathon 28K by UTMB',ARRAY['Mozart Half','Mozart UTMB 28K'],'run','Half Marathon',27.8,'Fuschlsee','Austria',2026,5,23,'2026-05-23','trail-running','Trail','Rolling','UTMB World Series','manual','https://mozart.utmb.world',70),
('Mozart Lake Trail 12K by UTMB',ARRAY['Mozart Lake Trail','Mozart UTMB 12K'],'run','10KM',11.9,'Fuschlsee','Austria',2026,5,23,'2026-05-23','trail-running','Trail','Flat','UTMB World Series','manual','https://mozart.utmb.world',65),

-- ══════════════════════════════════════════════════════════════
-- TRAIL 100 ANDORRA BY UTMB — Ordino, Andorra — Jun 11–14 2026
-- ══════════════════════════════════════════════════════════════
('Trail 100 Andorra Ultra 105K by UTMB',ARRAY['Andorra Ultra 105K','Trail Andorra UTMB 105K'],'run','100KM',104.9,'Ordino','Andorra',2026,6,13,'2026-06-13','trail-running','Trail','Mountain','UTMB World Series','manual','https://andorra.utmb.world',85),
('Trail 100 Andorra 80K by UTMB',ARRAY['Andorra Trail 80K','Trail Andorra UTMB 80K'],'run','50KM',78.9,'Ordino','Andorra',2026,6,12,'2026-06-12','trail-running','Trail','Mountain','UTMB World Series','manual','https://andorra.utmb.world',80),
('Trail 100 Andorra 50K by UTMB',ARRAY['Andorra Trail 50K','Trail Andorra UTMB 50K'],'run','50KM',49.9,'Ordino','Andorra',2026,6,13,'2026-06-13','trail-running','Trail','Mountain','UTMB World Series','manual','https://andorra.utmb.world',75),
('Trail 100 Andorra 21K by UTMB',ARRAY['Andorra Trail 21K','Trail Andorra UTMB 21K'],'run','Half Marathon',24.8,'Ordino','Andorra',2026,6,14,'2026-06-14','trail-running','Trail','Mountain','UTMB World Series','manual','https://andorra.utmb.world',70),
('Trail 100 Andorra 10K by UTMB',ARRAY['Andorra Trail 10K','Trail Andorra UTMB 10K'],'run','10KM',10.0,'Ordino','Andorra',2026,6,14,'2026-06-14','trail-running','Trail','Rolling','UTMB World Series','manual','https://andorra.utmb.world',65),

-- ══════════════════════════════════════════════════════════════
-- MUT BY UTMB — George, South Africa — May 29–31 2026
-- ══════════════════════════════════════════════════════════════
('MUT Miler by UTMB',ARRAY['MUT 100 Mile','Mountain Ultra Trail Miler'],'run','100 Mile',162.9,'George','South Africa',2026,5,29,'2026-05-29','trail-running','Trail','Mountain','UTMB World Series','manual','https://mut.utmb.world',85),
('MUT 100 by UTMB',ARRAY['Mountain Ultra Trail 100K','MUT100'],'run','100KM',97.8,'George','South Africa',2026,5,30,'2026-05-30','trail-running','Trail','Mountain','UTMB World Series','manual','https://mut.utmb.world',85),
('MUT 60 by UTMB',ARRAY['Mountain Ultra Trail 60K','MUT60'],'run','50KM',57.9,'George','South Africa',2026,5,30,'2026-05-30','trail-running','Trail','Mountain','UTMB World Series','manual','https://mut.utmb.world',80),
('MUT Marathon by UTMB',ARRAY['Mountain Ultra Trail Marathon','MUT Marathon'],'run','Marathon',43.9,'George','South Africa',2026,5,30,'2026-05-30','trail-running','Trail','Mountain','UTMB World Series','manual','https://mut.utmb.world',75),
('MUT Challenge 25K by UTMB',ARRAY['Mountain Ultra Trail Challenge','MUT 25K'],'run','Half Marathon',24.9,'George','South Africa',2026,5,31,'2026-05-31','trail-running','Trail','Rolling','UTMB World Series','manual','https://mut.utmb.world',70),
('MUT Lite 11K by UTMB',ARRAY['Mountain Ultra Trail Lite','MUT Lite'],'run','10KM',10.9,'George','South Africa',2026,5,31,'2026-05-31','trail-running','Trail','Rolling','UTMB World Series','manual','https://mut.utmb.world',65),

-- ══════════════════════════════════════════════════════════════
-- TRAIL DU SAINT-JACQUES BY UTMB — Le Puy-en-Velay, France — Jun 12–14 2026
-- ══════════════════════════════════════════════════════════════
('Ultra du Saint-Jacques 139K by UTMB',ARRAY['Trail Saint Jacques 100M','Saint-Jacques UTMB 139K'],'run','100KM',138.9,'Le Puy-en-Velay','France',2026,6,12,'2026-06-12','trail-running','Trail','Mountain','UTMB World Series','manual','https://saint-jacques.utmb.world',85),
('Grand Trail du Saint-Jacques 86K by UTMB',ARRAY['Trail Saint Jacques 100K','Saint-Jacques UTMB 86K'],'run','50KM',85.9,'Le Puy-en-Velay','France',2026,6,13,'2026-06-13','trail-running','Trail','Mountain','UTMB World Series','manual','https://saint-jacques.utmb.world',80),
('Monistrail 55K by UTMB',ARRAY['Trail Saint Jacques 50K','Saint-Jacques UTMB 55K'],'run','50KM',54.9,'Le Puy-en-Velay','France',2026,6,14,'2026-06-14','trail-running','Trail','Mountain','UTMB World Series','manual','https://saint-jacques.utmb.world',75),
('Les Chibottes 28K by UTMB',ARRAY['Trail Saint Jacques 28K','Saint-Jacques UTMB 28K'],'run','Half Marathon',27.8,'Le Puy-en-Velay','France',2026,6,13,'2026-06-13','trail-running','Trail','Rolling','UTMB World Series','manual','https://saint-jacques.utmb.world',70),

-- ══════════════════════════════════════════════════════════════
-- TRAIL OF THE KINGS – LAKE TOBA BY UTMB — Samosir Island, Indonesia — Jun 12–14 2026
-- ══════════════════════════════════════════════════════════════
('Lake Toba 100K by UTMB',ARRAY['Caldera Crown 100K','Trail of the Kings Lake Toba 100K'],'run','100KM',100.0,'Samosir','Indonesia',2026,6,13,'2026-06-13','trail-running','Trail','Mountain','UTMB World Series','manual','https://laketoba.utmb.world',85),
('Lake Toba 60K by UTMB',ARRAY['Ultimate Expedition 60K','Trail of the Kings Lake Toba 60K'],'run','50KM',60.0,'Samosir','Indonesia',2026,6,13,'2026-06-13','trail-running','Trail','Mountain','UTMB World Series','manual','https://laketoba.utmb.world',80),
('Lake Toba 28K by UTMB',ARRAY['King''s Ascent 28K','Trail of the Kings Lake Toba 28K'],'run','Half Marathon',28.0,'Samosir','Indonesia',2026,6,13,'2026-06-13','trail-running','Trail','Mountain','UTMB World Series','manual','https://laketoba.utmb.world',75),
('Lake Toba 10K by UTMB',ARRAY['Legacy Dash 10K','Trail of the Kings Lake Toba 10K'],'run','10KM',10.0,'Samosir','Indonesia',2026,6,14,'2026-06-14','trail-running','Trail','Rolling','UTMB World Series','manual','https://laketoba.utmb.world',65),
('Lake Toba 5K by UTMB',ARRAY['Legend Leap 5K','Trail of the Kings Lake Toba 5K'],'run','5KM',5.0,'Samosir','Indonesia',2026,6,14,'2026-06-14','trail-running','Trail','Rolling','UTMB World Series','manual','https://laketoba.utmb.world',60),

-- ══════════════════════════════════════════════════════════════
-- KAGA SPA ENDURANCE100 BY UTMB — Kaga, Japan — Jun 18–21 2026
-- ══════════════════════════════════════════════════════════════
('KAGASPA 100K by UTMB',ARRAY['Kaga Spa Endurance 100K','KAGASPA UTMB 100K'],'run','100KM',100.0,'Kaga','Japan',2026,6,20,'2026-06-20','trail-running','Trail','Mountain','UTMB World Series','manual','https://kagaspa.utmb.world',85),
('KAGASPA 50K by UTMB',ARRAY['Kaga Spa Endurance 50K','KAGASPA UTMB 50K'],'run','50KM',50.0,'Kaga','Japan',2026,6,21,'2026-06-21','trail-running','Trail','Mountain','UTMB World Series','manual','https://kagaspa.utmb.world',80),
('KAGASPA 20K by UTMB',ARRAY['Kaga Spa Endurance 20K','KAGASPA UTMB 20K'],'run','Half Marathon',20.0,'Kaga','Japan',2026,6,20,'2026-06-20','trail-running','Trail','Rolling','UTMB World Series','manual','https://kagaspa.utmb.world',70),

-- ══════════════════════════════════════════════════════════════
-- ZUGSPITZ ULTRA TRAIL BY UTMB — Garmisch-Partenkirchen, Germany — Jun 18–20 2026
-- ══════════════════════════════════════════════════════════════
('ZUT100 by UTMB',ARRAY['Zugspitz Ultra Trail 100','Zugspitz UTMB 165K','ZUT100'],'run','100 Mile',165.9,'Garmisch-Partenkirchen','Germany',2026,6,18,'2026-06-18','trail-running','Trail','Mountain','UTMB World Series','manual','https://zugspitz.utmb.world',90),
('Zugspitz Ultratrail 107K by UTMB',ARRAY['Zugspitz UTMB 107K'],'run','100KM',106.9,'Garmisch-Partenkirchen','Germany',2026,6,19,'2026-06-19','trail-running','Trail','Mountain','UTMB World Series','manual','https://zugspitz.utmb.world',85),
('Zugspitz Ehrwald Trail 86K by UTMB',ARRAY['Zugspitz UTMB Ehrwald'],'run','50KM',85.9,'Garmisch-Partenkirchen','Germany',2026,6,19,'2026-06-19','trail-running','Trail','Mountain','UTMB World Series','manual','https://zugspitz.utmb.world',80),
('Zugspitz Leutasch Trail 69K by UTMB',ARRAY['Zugspitz UTMB Leutasch'],'run','50KM',68.9,'Garmisch-Partenkirchen','Germany',2026,6,20,'2026-06-20','trail-running','Trail','Mountain','UTMB World Series','manual','https://zugspitz.utmb.world',75),
('Zugspitz Mittenwald Trail 44K by UTMB',ARRAY['Zugspitz UTMB Mittenwald'],'run','Marathon',43.9,'Garmisch-Partenkirchen','Germany',2026,6,20,'2026-06-20','trail-running','Trail','Mountain','UTMB World Series','manual','https://zugspitz.utmb.world',75),
('Zugspitz GP Trail 29K by UTMB',ARRAY['Zugspitz UTMB 29K'],'run','Half Marathon',29.0,'Garmisch-Partenkirchen','Germany',2026,6,19,'2026-06-19','trail-running','Trail','Rolling','UTMB World Series','manual','https://zugspitz.utmb.world',70),
('Zugspitz Grainau Trail 16K by UTMB',ARRAY['Zugspitz UTMB 16K'],'run','10KM',15.9,'Garmisch-Partenkirchen','Germany',2026,6,20,'2026-06-20','trail-running','Trail','Rolling','UTMB World Series','manual','https://zugspitz.utmb.world',65),

-- ══════════════════════════════════════════════════════════════
-- LAVAREDO ULTRA TRAIL BY UTMB — Cortina d'Ampezzo, Italy — Jun 24–28 2026
-- ══════════════════════════════════════════════════════════════
('Lavaredo Ultra Trail 120K by UTMB',ARRAY['Lavaredo UTMB 120K','Lavaredo 120'],'run','100KM',119.9,'Cortina d''Ampezzo','Italy',2026,6,26,'2026-06-26','trail-running','Trail','Mountain','UTMB World Series','manual','https://lavaredo.utmb.world',90),
('Lavaredo Ultra Trail 80K by UTMB',ARRAY['Lavaredo UTMB 80K','Lavaredo 80'],'run','50KM',79.9,'Cortina d''Ampezzo','Italy',2026,6,27,'2026-06-27','trail-running','Trail','Mountain','UTMB World Series','manual','https://lavaredo.utmb.world',85),
('Lavaredo Ultra Trail 50K by UTMB',ARRAY['Lavaredo UTMB 50K','Lavaredo 50'],'run','50KM',49.9,'Cortina d''Ampezzo','Italy',2026,6,26,'2026-06-26','trail-running','Trail','Mountain','UTMB World Series','manual','https://lavaredo.utmb.world',80),
('Lavaredo Ultra Trail 20K by UTMB',ARRAY['Lavaredo UTMB 20K','Lavaredo 20'],'run','Half Marathon',20.0,'Cortina d''Ampezzo','Italy',2026,6,25,'2026-06-25','trail-running','Trail','Rolling','UTMB World Series','manual','https://lavaredo.utmb.world',75),
('Lavaredo Ultra Trail 10K by UTMB',ARRAY['Lavaredo UTMB 10K','Lavaredo 10'],'run','10KM',10.0,'Cortina d''Ampezzo','Italy',2026,6,24,'2026-06-24','trail-running','Trail','Rolling','UTMB World Series','manual','https://lavaredo.utmb.world',65),

-- ══════════════════════════════════════════════════════════════
-- TORRENCIAL CHILE BY UTMB — Valdivia, Chile — Jun 26–28 2026
-- ══════════════════════════════════════════════════════════════
('Torrencial PILOCURA 97K by UTMB',ARRAY['Torrencial Chile 97K','Valdivia UTMB 97K'],'run','100KM',97.0,'Valdivia','Chile',2026,6,28,'2026-06-28','trail-running','Trail','Rolling','UTMB World Series','manual','https://torrencial.utmb.world',85),
('Torrencial ONCOL 64K by UTMB',ARRAY['Torrencial Chile 64K','Valdivia UTMB 64K'],'run','50KM',63.9,'Valdivia','Chile',2026,6,28,'2026-06-28','trail-running','Trail','Rolling','UTMB World Series','manual','https://torrencial.utmb.world',80),
('Torrencial LLANCAHUE 44K by UTMB',ARRAY['Torrencial Chile 44K','Valdivia UTMB 44K'],'run','Marathon',43.9,'Valdivia','Chile',2026,6,27,'2026-06-27','trail-running','Trail','Rolling','UTMB World Series','manual','https://torrencial.utmb.world',75),
('Torrencial COLLICO 21K by UTMB',ARRAY['Torrencial Chile 21K','Valdivia UTMB 21K'],'run','Half Marathon',20.9,'Valdivia','Chile',2026,6,27,'2026-06-27','trail-running','Trail','Rolling','UTMB World Series','manual','https://torrencial.utmb.world',70),
('Torrencial CAU CAU 12K by UTMB',ARRAY['Torrencial Chile 12K','Valdivia UTMB 12K'],'run','10KM',11.9,'Valdivia','Chile',2026,6,26,'2026-06-26','trail-running','Trail','Rolling','UTMB World Series','manual','https://torrencial.utmb.world',65),
('Torrencial ISLA TEJA 6K by UTMB',ARRAY['Torrencial Chile 6K','Valdivia UTMB 6K'],'run','5KM',6.0,'Valdivia','Chile',2026,6,26,'2026-06-26','trail-running','Trail','Flat','UTMB World Series','manual','https://torrencial.utmb.world',60),

-- ══════════════════════════════════════════════════════════════
-- WESTERN STATES ENDURANCE RUN — Auburn, California, USA — Jun 27–28 2026
-- Already partially in catalog; adding 2026 edition
-- ══════════════════════════════════════════════════════════════
('Western States 100 2026',ARRAY['WSER 2026','Western States 2026','Western States Endurance Run 2026'],'run','100 Mile',161.3,'Auburn','United States',2026,6,27,'2026-06-27','trail-running','Trail','Mountain','Western States Endurance Run','manual','https://www.wser.org',90),

-- ══════════════════════════════════════════════════════════════
-- HOKA VAL D'ARAN BY UTMB — Vielha, Spain — Jul 1–5 2026
-- ══════════════════════════════════════════════════════════════
('Val d''Aran 163K by UTMB',ARRAY['VDA Torn dera Val d''Aran','Val d''Aran UTMB 163K','Hoka Val d''Aran'],'run','100 Mile',162.9,'Vielha','Spain',2026,7,3,'2026-07-03','trail-running','Trail','Mountain','UTMB World Series','manual','https://valdaran.utmb.world',90),
('Val d''Aran 110K by UTMB',ARRAY['CDH Val d''Aran','Val d''Aran UTMB 110K'],'run','100KM',109.9,'Vielha','Spain',2026,7,3,'2026-07-03','trail-running','Trail','Mountain','UTMB World Series','manual','https://valdaran.utmb.world',85),
('Val d''Aran 75K by UTMB',ARRAY['TDL Val d''Aran','Val d''Aran UTMB 75K'],'run','50KM',75.0,'Vielha','Spain',2026,7,1,'2026-07-01','trail-running','Trail','Mountain','UTMB World Series','manual','https://valdaran.utmb.world',80),
('Val d''Aran 55K by UTMB',ARRAY['PDA Val d''Aran','Val d''Aran UTMB 55K'],'run','50KM',54.9,'Vielha','Spain',2026,7,2,'2026-07-02','trail-running','Trail','Mountain','UTMB World Series','manual','https://valdaran.utmb.world',75),
('Val d''Aran Experiència 32K by UTMB',ARRAY['EXP Val d''Aran','Val d''Aran UTMB 32K'],'run','Marathon',31.9,'Vielha','Spain',2026,7,5,'2026-07-05','trail-running','Trail','Mountain','UTMB World Series','manual','https://valdaran.utmb.world',70),
('Val d''Aran Sky 18K by UTMB',ARRAY['SKY Val d''Aran','Val d''Aran UTMB 18K'],'run','10KM',17.9,'Vielha','Spain',2026,7,4,'2026-07-04','trail-running','Trail','Mountain','UTMB World Series','manual','https://valdaran.utmb.world',65),
('Val d''Aran 10K by UTMB',ARRAY['Val d''Aran Vielha 10K'],'run','10KM',10.0,'Vielha','Spain',2026,7,1,'2026-07-01','trail-running','Trail','Rolling','UTMB World Series','manual','https://valdaran.utmb.world',60),

-- ══════════════════════════════════════════════════════════════
-- ULTRA-TRAIL DE LA RESTONICA BY UTMB — Corte, Corsica, France — Jul 9–11 2026
-- ══════════════════════════════════════════════════════════════
('Restonica UTC 110K by UTMB',ARRAY['Ultra-Trail Restonica 110K','Restonica UTMB 110K'],'run','100KM',109.9,'Corte','France',2026,7,9,'2026-07-09','trail-running','Trail','Mountain','UTMB World Series','manual','https://restonica.utmb.world',85),
('Restonica RT 67K by UTMB',ARRAY['Restonica 100K UTMB RT','Restonica UTMB 67K'],'run','50KM',66.9,'Corte','France',2026,7,11,'2026-07-11','trail-running','Trail','Mountain','UTMB World Series','manual','https://restonica.utmb.world',80),
('Restonica TT 33K by UTMB',ARRAY['Restonica 50K UTMB TT','Restonica UTMB 33K'],'run','Marathon',33.0,'Corte','France',2026,7,11,'2026-07-11','trail-running','Trail','Mountain','UTMB World Series','manual','https://restonica.utmb.world',75),
('Restonica GT 17K by UTMB',ARRAY['Restonica 20K UTMB GT','Restonica UTMB 17K'],'run','10KM',16.9,'Corte','France',2026,7,10,'2026-07-10','trail-running','Trail','Rolling','UTMB World Series','manual','https://restonica.utmb.world',70),

-- ══════════════════════════════════════════════════════════════
-- TRAIL VERBIER ST-BERNARD BY UTMB — Verbier, Switzerland — Jul 10–12 2026
-- ══════════════════════════════════════════════════════════════
('Verbier X-Alpine 140K by UTMB',ARRAY['Verbier St-Bernard X-Alpine','Verbier UTMB 140K'],'run','100KM',139.9,'Verbier','Switzerland',2026,7,10,'2026-07-10','trail-running','Trail','Mountain','UTMB World Series','manual','https://verbier.utmb.world',85),
('Verbier X-Traversée 77K by UTMB',ARRAY['Verbier St-Bernard 77K','Verbier UTMB 77K'],'run','50KM',76.9,'Verbier','Switzerland',2026,7,11,'2026-07-11','trail-running','Trail','Mountain','UTMB World Series','manual','https://verbier.utmb.world',80),
('Verbier Marathon 43K by UTMB',ARRAY['Verbier St-Bernard Marathon','Verbier UTMB 43K'],'run','Marathon',43.0,'Verbier','Switzerland',2026,7,11,'2026-07-11','trail-running','Trail','Mountain','UTMB World Series','manual','https://verbier.utmb.world',75),
('Verbier X-Plore 28K by UTMB',ARRAY['Verbier St-Bernard 28K','Verbier UTMB 28K'],'run','Half Marathon',27.8,'Verbier','Switzerland',2026,7,12,'2026-07-12','trail-running','Trail','Mountain','UTMB World Series','manual','https://verbier.utmb.world',70),

-- ══════════════════════════════════════════════════════════════
-- EIGER ULTRA TRAIL BY UTMB — Grindelwald, Switzerland — Jul 15–19 2026
-- ══════════════════════════════════════════════════════════════
('Eiger E250 by UTMB',ARRAY['Eiger Ultra Trail E250','Eiger UTMB 250K'],'run','Custom',249.9,'Grindelwald','Switzerland',2026,7,15,'2026-07-15','trail-running','Trail','Mountain','UTMB World Series','manual','https://eiger.utmb.world',90),
('Eiger E101 by UTMB',ARRAY['Eiger Ultra Trail E101','Eiger UTMB 101K'],'run','100KM',100.9,'Grindelwald','Switzerland',2026,7,18,'2026-07-18','trail-running','Trail','Mountain','UTMB World Series','manual','https://eiger.utmb.world',85),
('Eiger E51 by UTMB',ARRAY['Eiger Ultra Trail E51','Eiger UTMB 51K'],'run','50KM',50.9,'Grindelwald','Switzerland',2026,7,18,'2026-07-18','trail-running','Trail','Mountain','UTMB World Series','manual','https://eiger.utmb.world',80),
('Eiger E35 by UTMB',ARRAY['Eiger Ultra Trail E35','Eiger UTMB 35K'],'run','Marathon',34.9,'Grindelwald','Switzerland',2026,7,18,'2026-07-18','trail-running','Trail','Mountain','UTMB World Series','manual','https://eiger.utmb.world',75),
('Eiger E16 by UTMB',ARRAY['Eiger Ultra Trail E16','Eiger UTMB 16K'],'run','10KM',15.9,'Grindelwald','Switzerland',2026,7,18,'2026-07-18','trail-running','Trail','Mountain','UTMB World Series','manual','https://eiger.utmb.world',70),

-- ══════════════════════════════════════════════════════════════
-- MONTE ROSA WALSERWAEG BY UTMB — Gressoney, Italy — Jul 17–19 2026
-- ══════════════════════════════════════════════════════════════
('MRWW SDV 120K by UTMB',ARRAY['Monte Rosa Walserwaeg SDV','MRWW UTMB 120K'],'run','100KM',119.9,'Gressoney','Italy',2026,7,17,'2026-07-17','trail-running','Trail','Mountain','UTMB World Series','manual','https://mrww.utmb.world',85),
('MRWW MRT 82K by UTMB',ARRAY['Monte Rosa Walserwaeg MRT','MRWW UTMB 82K'],'run','50KM',81.9,'Gressoney','Italy',2026,7,17,'2026-07-17','trail-running','Trail','Mountain','UTMB World Series','manual','https://mrww.utmb.world',80),
('MRWW WWT 43K by UTMB',ARRAY['Monte Rosa Walserwaeg WWT','MRWW UTMB 43K'],'run','Marathon',43.0,'Gressoney','Italy',2026,7,18,'2026-07-18','trail-running','Trail','Mountain','UTMB World Series','manual','https://mrww.utmb.world',75),
('MRWW APINK 15K by UTMB',ARRAY['Monte Rosa Walserwaeg APINK','MRWW UTMB 15K'],'run','10KM',15.0,'Gressoney','Italy',2026,7,19,'2026-07-19','trail-running','Trail','Rolling','UTMB World Series','manual','https://mrww.utmb.world',65),

-- ══════════════════════════════════════════════════════════════
-- SPEEDGOAT MOUNTAIN RACES BY UTMB — Snowbird, Utah, USA — Jul 23–25 2026
-- ══════════════════════════════════════════════════════════════
('Speedgoat 50K by UTMB',ARRAY['Speedgoat Mountain 50K','Speedgoat UTMB 50K'],'run','50KM',49.9,'Snowbird','United States',2026,7,25,'2026-07-25','trail-running','Trail','Mountain','UTMB World Series','manual','https://speedgoat.utmb.world',85),
('Speedgoat 30K by UTMB',ARRAY['Speedgoat Mountain 30K','Speedgoat UTMB 30K'],'run','Marathon',30.9,'Snowbird','United States',2026,7,24,'2026-07-24','trail-running','Trail','Mountain','UTMB World Series','manual','https://speedgoat.utmb.world',80),
('Speedgoat 10K by UTMB',ARRAY['Speedgoat Mountain 10K','Speedgoat UTMB 10K'],'run','10KM',10.0,'Snowbird','United States',2026,7,24,'2026-07-24','trail-running','Trail','Mountain','UTMB World Series','manual','https://speedgoat.utmb.world',70),

-- ══════════════════════════════════════════════════════════════
-- BUCOVINA ULTRA ROCKS BY UTMB — Eastern Carpathians, Romania — Jul 24–26 2026
-- ══════════════════════════════════════════════════════════════
('Bucovina Ultra Rocks 114K by UTMB',ARRAY['Bucovina Ultra UTMB 114K','Ultra Rocks Romania'],'run','100KM',113.9,'Vatra Dornei','Romania',2026,7,24,'2026-07-24','trail-running','Trail','Mountain','UTMB World Series','manual','https://bucovina.utmb.world',85),
('Bucovina Four Summits 72K by UTMB',ARRAY['Bucovina Ultra UTMB 72K','Four Summits Romania'],'run','50KM',71.9,'Vatra Dornei','Romania',2026,7,25,'2026-07-25','trail-running','Trail','Mountain','UTMB World Series','manual','https://bucovina.utmb.world',80),
('Bucovina Lady''s Rocks 48K by UTMB',ARRAY['Bucovina Ultra UTMB 48K'],'run','Marathon',48.0,'Vatra Dornei','Romania',2026,7,25,'2026-07-25','trail-running','Trail','Mountain','UTMB World Series','manual','https://bucovina.utmb.world',75),
('Bucovina Rocky 33K by UTMB',ARRAY['Bucovina Ultra UTMB 33K'],'run','Marathon',33.0,'Vatra Dornei','Romania',2026,7,25,'2026-07-25','trail-running','Trail','Mountain','UTMB World Series','manual','https://bucovina.utmb.world',70),
('Bucovina Radical 20K by UTMB',ARRAY['Bucovina Ultra UTMB 20K'],'run','Half Marathon',20.0,'Vatra Dornei','Romania',2026,7,25,'2026-07-25','trail-running','Trail','Rolling','UTMB World Series','manual','https://bucovina.utmb.world',65),
('Bucovina Rumble Rock 16K by UTMB',ARRAY['Bucovina Ultra UTMB 16K'],'run','10KM',16.4,'Vatra Dornei','Romania',2026,7,26,'2026-07-26','trail-running','Trail','Rolling','UTMB World Series','manual','https://bucovina.utmb.world',60),

-- ══════════════════════════════════════════════════════════════
-- QUITO ULTRA TRAIL BY UTMB — Quito, Ecuador — Jul 31–Aug 2 2026
-- ══════════════════════════════════════════════════════════════
('Quito Ultra Trail Oso 77K by UTMB',ARRAY['Quito UTMB 77K','Quito Oso'],'run','50KM',76.9,'Quito','Ecuador',2026,8,1,'2026-08-01','trail-running','Trail','Mountain','UTMB World Series','manual','https://quito.utmb.world',85),
('Quito Ultra Trail Nutria 54K by UTMB',ARRAY['Quito UTMB 54K','Quito Nutria'],'run','50KM',53.9,'Quito','Ecuador',2026,8,1,'2026-08-01','trail-running','Trail','Mountain','UTMB World Series','manual','https://quito.utmb.world',80),
('Quito Ultra Trail Tucán 31K by UTMB',ARRAY['Quito UTMB 31K','Quito Tucan'],'run','Marathon',30.9,'Quito','Ecuador',2026,8,1,'2026-08-01','trail-running','Trail','Mountain','UTMB World Series','manual','https://quito.utmb.world',75),
('Quito Ultra Trail Quinde 20K by UTMB',ARRAY['Quito UTMB 20K','Quito Quinde'],'run','Half Marathon',20.0,'Quito','Ecuador',2026,8,2,'2026-08-02','trail-running','Trail','Mountain','UTMB World Series','manual','https://quito.utmb.world',70),
('Quito Ultra Trail Humboldt 13K by UTMB',ARRAY['Quito UTMB 13K','Quito Humboldt'],'run','10KM',12.9,'Quito','Ecuador',2026,8,2,'2026-08-02','trail-running','Trail','Rolling','UTMB World Series','manual','https://quito.utmb.world',65),
('Quito Ultra Trail Rana 6K by UTMB',ARRAY['Quito UTMB 6K','Quito Rana'],'run','5KM',6.4,'Quito','Ecuador',2026,8,2,'2026-08-02','trail-running','Trail','Rolling','UTMB World Series','manual','https://quito.utmb.world',60);

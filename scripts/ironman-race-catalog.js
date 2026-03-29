#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const HYROX_LIST_URL = 'https://hyrox.com/find-my-race/';
const UTMB_WORLD_SERIES_URL = 'https://utmb.world/utmb-world-series-events';
const AHOTU_DEFAULT_PATH = path.resolve(__dirname, 'ahotu-curated-events.json');
const CLIMATE_MODEL = 'CMCC_CM2_VHR4';
const IRONMAN_BASE_URL = 'https://www.ironman.com';
const NON_RACE_SLUGS = new Set(['xclusive-challenge', 'nirvana', 'vip-experience']);
const IRONMAN_LOCATION_OVERRIDES = {
  'im703-brasilia': { city: 'Brasilia', country: 'Brazil' },
  'im703-florianopolis': { city: 'Florianopolis', country: 'Brazil' },
  'im703-sao-paulo': { city: 'Sao Paulo', country: 'Brazil' },
  'im-brazil': { city: 'Florianopolis', country: 'Brazil' },
};
const MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};
const DISCIPLINE_META = {
  'road-running': { type: 'run', label: 'Road Running', surface: 'Road' },
  'trail-running': { type: 'run', label: 'Trail Running', surface: 'Trail' },
  cycling: { type: 'cycle', label: 'Cycling', surface: 'Road' },
  triathlon: { type: 'tri', label: 'Triathlon', surface: 'Road / Open Water' },
  swimming: { type: 'swim', label: 'Swimming', surface: 'Open Water' },
  hyrox: { type: 'hyrox', label: 'HYROX', surface: 'Indoor Arena' },
};
const HYROX_CITY_OVERRIDES = {
  'las-vegas': { city: 'Las Vegas', country: 'United States', region: 'Nevada' },
  'new-york': { city: 'New York', country: 'United States', region: 'New York' },
  'new-york-city': { city: 'New York', country: 'United States', region: 'New York' },
  'miami-beach': { city: 'Miami Beach', country: 'United States', region: 'Florida' },
  'los-angeles': { city: 'Los Angeles', country: 'United States', region: 'California' },
  'san-jose': { city: 'San Jose', country: 'United States', region: 'California' },
  'washington-dc': { city: 'Washington', country: 'United States', region: 'District of Columbia' },
  'washington-d-c': { city: 'Washington', country: 'United States', region: 'District of Columbia' },
  'salt-lake-city': { city: 'Salt Lake City', country: 'United States', region: 'Utah' },
  'sao-paulo': { city: 'Sao Paulo', country: 'Brazil', region: 'Sao Paulo' },
  'rio-de-janeiro': { city: 'Rio de Janeiro', country: 'Brazil', region: 'Rio de Janeiro' },
  'hong-kong': { city: 'Hong Kong', country: 'Hong Kong', region: '' },
  'hong-kong-china': { city: 'Hong Kong', country: 'Hong Kong', region: '' },
  'sydney': { city: 'Sydney', country: 'Australia', region: 'New South Wales' },
  'melbourne': { city: 'Melbourne', country: 'Australia', region: 'Victoria' },
  'mexico-city': { city: 'Mexico City', country: 'Mexico', region: 'Mexico City' },
  'guangzhou': { city: 'Guangzhou', country: 'China', region: 'Guangdong' },
  'shanghai': { city: 'Shanghai', country: 'China', region: 'Shanghai' },
  'seoul': { city: 'Seoul', country: 'South Korea', region: 'Seoul' },
  'singapore': { city: 'Singapore', country: 'Singapore', region: '' },
  'poznan': { city: 'Poznan', country: 'Poland', region: 'Greater Poland' },
  'poznan-': { city: 'Poznan', country: 'Poland', region: 'Greater Poland' },
  'dusseldorf': { city: 'Dusseldorf', country: 'Germany', region: 'North Rhine-Westphalia' },
  'nice': { city: 'Nice', country: 'France', region: "Provence-Alpes-Cote d'Azur" },
  'barcelona': { city: 'Barcelona', country: 'Spain', region: 'Catalonia' },
  'birmingham': { city: 'Birmingham', country: 'United Kingdom', region: 'England' },
  'dublin': { city: 'Dublin', country: 'Ireland', region: 'Leinster' },
  'utrecht': { city: 'Utrecht', country: 'Netherlands', region: 'Utrecht' },
  'hamburg': { city: 'Hamburg', country: 'Germany', region: 'Hamburg' },
  'london': { city: 'London', country: 'United Kingdom', region: 'England' },
  'houston': { city: 'Houston', country: 'United States', region: 'Texas' },
  'dallas': { city: 'Dallas', country: 'United States', region: 'Texas' },
  'denver': { city: 'Denver', country: 'United States', region: 'Colorado' },
};
const UTMB_WORLD_SERIES_SCHEDULE = [
  { slug: 'desertrats', start: '2026-04-09', end: '2026-04-12', url: 'https://desertrats.utmb.world' },
  { slug: 'puerto-vallarta', start: '2026-04-16', end: '2026-04-18', url: 'https://puerto-vallarta.utmb.world' },
  { slug: 'canyons', start: '2026-04-23', end: '2026-04-26', url: 'https://canyons.utmb.world' },
  { slug: 'rothrock', start: '2026-05-15', end: '2026-05-17', url: 'https://rothrock.utmb.world' },
  { slug: 'www', start: '2026-06-27', end: '2026-06-28', url: 'https://www.wser.org' },
  { slug: 'speedgoat', start: '2026-07-23', end: '2026-07-25', url: 'https://speedgoat.utmb.world' },
  { slug: 'borealys', start: '2026-08-14', end: '2026-08-16', url: 'https://borealys.utmb.world' },
  { slug: 'whistler', start: '2026-08-21', end: '2026-08-23', url: 'https://whistler.utmb.world' },
  { slug: 'snowbasin', start: '2026-09-10', end: '2026-09-12', url: 'https://snowbasin.utmb.world' },
  { slug: 'grindstone', start: '2026-09-17', end: '2026-09-20', url: 'https://grindstone.utmb.world' },
  { slug: 'chihuahua', start: '2026-10-01', end: '2026-10-03', url: 'https://chihuahua.utmb.world' },
  { slug: 'kodiak', start: '2026-10-08', end: '2026-10-11', url: 'https://kodiak.utmb.world' },
  { slug: 'pacifictrails', start: '2026-11-13', end: '2026-11-15', url: 'https://pacifictrails.utmb.world' },
  { slug: 'istria', start: '2026-04-09', end: '2026-04-12', url: 'https://istria.utmb.world' },
  { slug: 'ventoux', start: '2026-04-24', end: '2026-04-26', url: 'https://ventoux.utmb.world' },
  { slug: 'ohmeudeus', start: '2026-05-01', end: '2026-05-03', url: 'https://ohmeudeus.utmb.world' },
  { slug: 'alsace', start: '2026-05-14', end: '2026-05-17', url: 'https://alsace.utmb.world' },
  { slug: 'snowdonia', start: '2026-05-15', end: '2026-05-17', url: 'https://snowdonia.utmb.world' },
  { slug: 'mozart', start: '2026-05-23', end: null, url: 'https://mozart.utmb.world' },
  { slug: 'andorra', start: '2026-06-11', end: '2026-06-14', url: 'https://andorra.utmb.world' },
  { slug: 'saint-jacques', start: '2026-06-12', end: '2026-06-14', url: 'https://saint-jacques.utmb.world' },
  { slug: 'zugspitz', start: '2026-06-18', end: '2026-06-20', url: 'https://zugspitz.utmb.world' },
  { slug: 'lavaredo', start: '2026-06-24', end: '2026-06-28', url: 'https://lavaredo.utmb.world' },
  { slug: 'valdaran', start: '2026-07-01', end: '2026-07-05', url: 'https://valdaran.utmb.world' },
  { slug: 'restonica', start: '2026-07-09', end: '2026-07-11', url: 'https://restonica.utmb.world' },
  { slug: 'verbier', start: '2026-07-10', end: '2026-07-12', url: 'https://verbier.utmb.world' },
  { slug: 'eiger', start: '2026-07-15', end: '2026-07-19', url: 'https://eiger.utmb.world' },
  { slug: 'mrww', start: '2026-07-17', end: '2026-07-19', url: 'https://mrww.utmb.world' },
  { slug: 'bucovina', start: '2026-07-24', end: '2026-07-26', url: 'https://bucovina.utmb.world' },
  { slug: 'gauja', start: '2026-08-01', end: '2026-08-02', url: 'https://gauja.utmb.world' },
  { slug: 'kat', start: '2026-08-06', end: '2026-08-08', url: 'https://kat.utmb.world' },
  { slug: 'montblanc', start: '2026-08-24', end: '2026-08-30', url: 'https://montblanc.utmb.world' },
  { slug: 'wildstrubel', start: '2026-09-10', end: '2026-09-13', url: 'https://wildstrubel.utmb.world' },
  { slug: 'kackar', start: '2026-09-11', end: '2026-09-13', url: 'https://kackar.utmb.world' },
  { slug: 'julianalps', start: '2026-09-18', end: '2026-09-20', url: 'https://julianalps.utmb.world' },
  { slug: 'nice', start: '2026-09-24', end: '2026-09-27', url: 'https://nice.utmb.world' },
  { slug: 'kullamannen', start: '2026-10-30', end: '2026-10-31', url: 'https://kullamannen.utmb.world' },
  { slug: 'mallorca', start: '2026-10-30', end: '2026-11-01', url: 'https://mallorca.utmb.world' },
  { slug: 'mogan', start: '2026-04-10', end: '2026-04-12', url: 'https://mogan.utmb.world' },
  { slug: 'amazean', start: '2026-04-30', end: '2026-05-03', url: 'https://amazean.utmb.world' },
  { slug: 'laketoba', start: '2026-06-12', end: '2026-06-14', url: 'https://laketoba.utmb.world' },
  { slug: 'kagaspa', start: '2026-06-18', end: '2026-06-21', url: 'https://kagaspa.utmb.world' },
  { slug: 'malaysia', start: '2026-09-11', end: '2026-09-13', url: 'https://malaysia.utmb.world' },
  { slug: 'dajingmen', start: '2026-09-11', end: '2026-09-13', url: 'https://dajingmen.utmb.world' },
  { slug: 'transjeju', start: '2026-10-02', end: '2026-10-04', url: 'https://transjeju.utmb.world' },
  { slug: 'mount-yun', start: '2026-10-16', end: '2026-10-18', url: 'https://mount-yun.utmb.world' },
  { slug: 'shudao', start: '2026-11-06', end: '2026-11-08', url: 'https://shudao.utmb.world' },
  { slug: 'translantau', start: '2026-11-13', end: '2026-11-15', url: 'https://translantau.utmb.world' },
  { slug: 'oman', start: '2026-12-10', end: '2026-12-12', url: 'https://oman.utmb.world' },
  { slug: 'uta', start: '2026-05-14', end: '2026-05-17', url: 'https://uta.utmb.world' },
  { slug: 'kosciuszko', start: '2026-11-26', end: '2026-11-28', url: 'https://kosciuszko.utmb.world' },
  { slug: 'tarawera', start: '2027-02-13', end: '2027-02-14', url: 'https://tarawera.utmb.world' },
  { slug: 'mut', start: '2026-05-29', end: '2026-05-31', url: 'https://mut.utmb.world' },
  { slug: 'torrencial', start: '2026-06-26', end: '2026-06-28', url: 'https://torrencial.utmb.world' },
  { slug: 'quito', start: '2026-07-31', end: '2026-08-02', url: 'https://quito.utmb.world' },
  { slug: 'paraty', start: '2026-09-17', end: '2026-09-20', url: 'https://paraty.utmb.world' },
  { slug: 'bariloche', start: '2026-11-18', end: '2026-11-22', url: 'https://bariloche.utmb.world' }
];
const UTMB_EVENT_OVERRIDES = {
  'desertrats': { name: 'Desert RATS Trail Running Festival by UTMB', city: 'Fruita', region: 'Colorado', country: 'United States' },
  'puerto-vallarta': { name: 'Puerto Vallarta México by UTMB', city: 'Puerto Vallarta', region: 'Jalisco', country: 'Mexico' },
  'canyons': { name: 'Canyons Endurance Runs by UTMB', city: 'Auburn', region: 'California', country: 'United States' },
  'rothrock': { name: 'Rothrock Trail Fest by UTMB', city: 'State College', region: 'Pennsylvania', country: 'United States' },
  'www': { name: 'Western States Endurance Run', city: 'Olympic Valley', region: 'California', country: 'United States' },
  'speedgoat': { name: 'Speedgoat Mountain Races by UTMB', city: 'Snowbird', region: 'Utah', country: 'United States' },
  'borealys': { name: 'Borealys Ultra Trail by UTMB', city: 'Saint-Donat', region: 'Quebec', country: 'Canada' },
  'whistler': { name: 'Whistler by UTMB', city: 'Whistler', region: 'British Columbia', country: 'Canada' },
  'snowbasin': { name: 'Snowbasin by UTMB', city: 'Huntsville', region: 'Utah', country: 'United States' },
  'grindstone': { name: 'Grindstone by UTMB', city: 'Staunton', region: 'Virginia', country: 'United States' },
  'chihuahua': { name: 'Chihuahua by UTMB', city: 'Copper Canyon', region: 'Chihuahua', country: 'Mexico' },
  'kodiak': { name: 'Kodiak Ultra Marathons by UTMB', city: 'Big Bear Lake', region: 'California', country: 'United States' },
  'pacifictrails': { name: 'Pacific Trails California by UTMB', city: 'Folsom', region: 'California', country: 'United States' },
  'istria': { name: 'Istria 100 by UTMB', city: 'Labin', region: 'Istria', country: 'Croatia' },
  'ventoux': { name: 'Grand Raid Ventoux by UTMB', city: 'Malaucene', region: 'Provence-Alpes-Cote d\'Azur', country: 'France' },
  'ohmeudeus': { name: 'Oh Meu Deus by UTMB', city: 'Miranda do Corvo', region: 'Coimbra', country: 'Portugal' },
  'alsace': { name: 'Trail Alsace Grand Est by UTMB', city: 'Turckheim', region: 'Grand Est', country: 'France' },
  'snowdonia': { name: 'Snowdonia by UTMB', city: 'Llanberis', region: 'Wales', country: 'United Kingdom' },
  'mozart': { name: 'mozart 100 by UTMB', city: 'Salzburg', region: 'Salzburg', country: 'Austria' },
  'andorra': { name: 'Trail 100 Andorra by UTMB', city: 'Ordino', region: 'Ordino', country: 'Andorra' },
  'saint-jacques': { name: 'Trail Saint-Jacques by UTMB', city: 'Le Puy-en-Velay', region: 'Auvergne-Rhone-Alpes', country: 'France' },
  'zugspitz': { name: 'Zugspitz Ultratrail by UTMB', city: 'Garmisch-Partenkirchen', region: 'Bavaria', country: 'Germany' },
  'lavaredo': { name: 'Lavaredo Ultra Trail by UTMB', city: 'Cortina d\'Ampezzo', region: 'Veneto', country: 'Italy' },
  'valdaran': { name: 'Val d\'Aran by UTMB', city: 'Vielha', region: 'Catalonia', country: 'Spain' },
  'restonica': { name: 'Restonica Trail by UTMB', city: 'Corte', region: 'Corsica', country: 'France' },
  'verbier': { name: 'Trail Verbier St-Bernard by UTMB', city: 'Verbier', region: 'Valais', country: 'Switzerland' },
  'eiger': { name: 'Eiger Ultra Trail by UTMB', city: 'Grindelwald', region: 'Bern', country: 'Switzerland' },
  'mrww': { name: 'Monte Rosa WalserWaeg by UTMB', city: 'Gressoney-Saint-Jean', region: 'Aosta Valley', country: 'Italy' },
  'bucovina': { name: 'Bucovina Ultra Rocks by UTMB', city: 'Campulung Moldovenesc', region: 'Suceava', country: 'Romania' },
  'gauja': { name: 'Gauja by UTMB', city: 'Sigulda', region: 'Sigulda Municipality', country: 'Latvia' },
  'kat': { name: 'KAT100 by UTMB', city: 'Fieberbrunn', region: 'Tyrol', country: 'Austria' },
  'montblanc': { name: 'HOKA UTMB Mont-Blanc', city: 'Chamonix', region: 'Auvergne-Rhone-Alpes', country: 'France' },
  'wildstrubel': { name: 'Wildstrubel by UTMB', city: 'Adelboden', region: 'Bern', country: 'Switzerland' },
  'kackar': { name: 'Kackar by UTMB', city: 'Rize', region: 'Rize', country: 'Turkey' },
  'julianalps': { name: 'Julian Alps by UTMB', city: 'Kranjska Gora', region: 'Upper Carniola', country: 'Slovenia' },
  'nice': { name: 'Nice Cote d\'Azur by UTMB', city: 'Nice', region: 'Provence-Alpes-Cote d\'Azur', country: 'France' },
  'kullamannen': { name: 'Kullamannen by UTMB', city: 'Molle', region: 'Skane', country: 'Sweden' },
  'mallorca': { name: 'Mallorca by UTMB', city: 'Soller', region: 'Balearic Islands', country: 'Spain' },
  'tenerife': { name: 'Tenerife Bluetrail by UTMB', city: 'Puerto de la Cruz', region: 'Canary Islands', country: 'Spain' },
  'arcofattrition': { name: 'Arc of Attrition by UTMB', city: 'Newquay', region: 'England', country: 'United Kingdom' },
  'puglia': { name: 'Puglia by UTMB', city: 'Peschici', region: 'Puglia', country: 'Italy' },
  'mogan': { name: 'Ultra-Trail Mogan by UTMB', city: 'Mogan', region: 'Canary Islands', country: 'Spain' },
  'amazean': { name: 'Amazean Jungle Thailand by UTMB', city: 'Betong', region: 'Yala', country: 'Thailand' },
  'laketoba': {
    name: 'Trail of the Kings by UTMB',
    city: 'Lake Toba',
    region: 'North Sumatra',
    country: 'Indonesia',
    lat: 2.6845,
    lng: 98.8636,
    timezone: 'Asia/Jakarta',
    air_temp_high_c: 28,
    air_temp_low_c: 21,
    humidity_pct: 80,
    wind_kph: 5,
    weather_profile_source: 'geocoded-climate',
  },
  'kagaspa': { name: 'Kaga Spa Trail Endurance 100 by UTMB', city: 'Kaga', region: 'Ishikawa', country: 'Japan' },
  'malaysia': { name: 'Ultra-Trail Malaysia by UTMB', city: 'Taiping', region: 'Perak', country: 'Malaysia' },
  'dajingmen': { name: 'Dajingmen by UTMB', city: 'Zhangjiakou', region: 'Hebei', country: 'China' },
  'transjeju': { name: 'TransJeju by UTMB', city: 'Jeju', region: 'Jeju', country: 'South Korea' },
  'mount-yun': { name: 'Mount Yun by UTMB', city: 'Yongzhou', region: 'Hunan', country: 'China' },
  'shudao': { name: 'Shudao by UTMB', city: 'Guangyuan', region: 'Sichuan', country: 'China' },
  'translantau': { name: 'TransLantau by UTMB', city: 'Hong Kong', region: 'Hong Kong', country: 'Hong Kong' },
  'oman': { name: 'Oman by UTMB', city: 'Al Hamra', region: 'Ad Dakhiliyah', country: 'Oman' },
  'xiamen': { name: 'Xiamen by UTMB', city: 'Xiamen', region: 'Fujian', country: 'China' },
  'xtrail': { name: 'Chiang Mai Thailand by UTMB', city: 'Chiang Mai', region: 'Chiang Mai', country: 'Thailand' },
  'chiangmai': { name: 'Chiang Mai Thailand by UTMB', city: 'Chiang Mai', region: 'Chiang Mai', country: 'Thailand' },
  'uta': { name: 'Ultra-Trail Australia by UTMB', city: 'Katoomba', region: 'New South Wales', country: 'Australia' },
  'kosciuszko': { name: 'Ultra-Trail Kosciuszko by UTMB', city: 'Thredbo', region: 'New South Wales', country: 'Australia' },
  'tarawera': { name: 'Tarawera Ultramarathon by UTMB', city: 'Rotorua', region: 'Bay of Plenty', country: 'New Zealand' },
  'mut': { name: 'Mountain Ultra-Trail by UTMB', city: 'George', region: 'Western Cape', country: 'South Africa' },
  'torrencial': { name: 'Torrencial Chile by UTMB', city: 'Valdivia', region: 'Los Rios', country: 'Chile' },
  'quito': { name: 'Quito Trail by UTMB', city: 'Quito', region: 'Pichincha', country: 'Ecuador' },
  'paraty': { name: 'Paraty Brazil by UTMB', city: 'Paraty', region: 'Rio de Janeiro', country: 'Brazil' },
  'bariloche': { name: 'Bariloche by UTMB', city: 'San Carlos de Bariloche', region: 'Rio Negro', country: 'Argentina' },
  'ushuaia': { name: 'Valholl Fin del Mundo by UTMB', city: 'Ushuaia', region: 'Tierra del Fuego', country: 'Argentina' }
};

function decodeHtml(value = '') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;/g, '-')
    .replace(/&#8217;/g, "'")
    .replace(/&#038;/g, '&');
}

function normalizeWhitespace(value = '') {
  return decodeHtml(value).replace(/\s+/g, ' ').trim();
}

function stripDiacritics(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function slugify(value = '') {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleCaseFromSlug(value = '') {
  return String(value)
    .split('-')
    .filter(Boolean)
    .map(part => part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function splitCityCountry(label = '') {
  const parts = normalizeWhitespace(label).split(',').map(part => part.trim()).filter(Boolean);
  if (!parts.length) return { city: '', country: '' };
  if (parts.length === 1) return { city: parts[0], country: '' };
  return {
    city: parts.slice(0, -1).join(', '),
    country: parts[parts.length - 1],
  };
}

function slugFromIronmanUrl(url = '') {
  return String(url).replace(/^https:\/\/www\.ironman\.com\/races\//, '').replace(/\/+$/, '');
}

function inferIronmanSeries(name = '') {
  if (/^IRONMAN 70\.3\b/i.test(name)) return 'IRONMAN 70.3';
  if (/^IRONMAN\b/i.test(name)) return 'IRONMAN';
  if (/5150/i.test(name)) return '5150';
  if (/super sprint/i.test(name)) return 'Super Sprint';
  if (/\bsprint\b/i.test(name)) return 'Sprint';
  return '';
}

function normalizeIronmanDistance(series = '', name = '') {
  const value = `${series} ${name}`.toLowerCase();
  if (value.includes('70.3')) {
    return { type: 'tri', dist: '70.3 / Half Ironman', distKm: 113, customDist: null };
  }
  if (/\b5150\b/.test(value) || value.includes('short course tri')) {
    return { type: 'tri', dist: 'Olympic / Standard', distKm: 51.5, customDist: null };
  }
  if (value.includes('super sprint')) {
    return { type: 'tri', dist: 'Super Sprint', distKm: 12.9, customDist: null };
  }
  if (/\bsprint\b/.test(value)) {
    return { type: 'tri', dist: 'Sprint', distKm: 25.75, customDist: null };
  }
  if (value.includes('ironman')) {
    return { type: 'tri', dist: 'Ironman / Full', distKm: 226, customDist: null };
  }
  return { type: 'tri', dist: 'Custom…', distKm: null, customDist: series || name };
}

function normalizeAhotuDistance(row) {
  if (row.dist) {
    return {
      type: row.type || DISCIPLINE_META[row.discipline]?.type || 'run',
      dist: row.dist,
      distKm: row.dist_km ?? null,
      customDist: row.custom_dist ?? '',
    };
  }
  if (row.discipline === 'road-running') {
    return { type: 'run', dist: 'Marathon', distKm: 42.2, customDist: '' };
  }
  if (row.discipline === 'cycling') {
    return { type: 'cycle', dist: 'Gran Fondo', distKm: 120, customDist: '' };
  }
  if (row.discipline === 'swimming') {
    return { type: 'swim', dist: 'Custom…', distKm: null, customDist: 'Open Water Swim' };
  }
  if (row.discipline === 'triathlon') {
    return { type: 'tri', dist: 'Custom…', distKm: null, customDist: 'Triathlon' };
  }
  if (row.discipline === 'trail-running') {
    return { type: 'run', dist: 'Custom…', distKm: null, customDist: 'Trail Running' };
  }
  return { type: 'run', dist: 'Custom…', distKm: null, customDist: row.discipline || 'Race' };
}

function buildAliases(name, city, country, series, extras = []) {
  const aliases = new Set();
  if (series && name !== series) aliases.add(series);
  if (city) aliases.add(`${name} ${city}`.trim());
  if (country) aliases.add(`${name} ${country}`.trim());
  for (const extra of extras) if (extra) aliases.add(normalizeWhitespace(extra));
  return [...aliases].filter(Boolean);
}

function parseCelsius(value) {
  const match = String(value).match(/(-?\d+(?:\.\d+)?)\s*°C/i);
  return match ? Number(match[1]) : null;
}

function extractDetailUrls(html) {
  const urls = new Set();
  const matches = html.matchAll(/https:\/\/www\.ironman\.com\/races\/([a-z0-9-]+)/gi);
  for (const match of matches) {
    const slug = match[1];
    if (!slug || NON_RACE_SLUGS.has(slug)) continue;
    urls.add(`${IRONMAN_BASE_URL}/races/${slug}`);
  }
  return [...urls].sort();
}

function extractJsonLd(html) {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (Array.isArray(parsed)) return parsed[0] || null;
    if (parsed && Array.isArray(parsed['@graph'])) {
      return parsed['@graph'].find(item => item['@type'] === 'SportsEvent') || parsed['@graph'][0] || null;
    }
    return parsed;
  } catch (error) {
    return null;
  }
}

function extractLabelValue(html, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`icon-field-label">${escaped}<\\/div>\\s*<div class="[^"]*icon-field-value[^"]*">([\\s\\S]*?)<\\/div>`, 'i');
  const match = html.match(re);
  if (!match) return '';
  const values = [...match[1].matchAll(/<span[^>]*>(.*?)<\/span>/g)]
    .map(item => normalizeWhitespace(item[1]))
    .filter(Boolean)
    .filter(value => value !== '—');
  return values[0] || '';
}

function extractHeroRegistration(html) {
  const match = html.match(/race-hero-content[\s\S]*?tag tag--white[^>]*>([^<]+)</i);
  return match ? normalizeWhitespace(match[1]) : '';
}

function extractCourseSummary(html) {
  const meta = html.match(/<meta name="description" content="([^"]+)"/i);
  return meta ? normalizeWhitespace(meta[1]) : '';
}

function extractHeroLocationLabel(html) {
  const match = html.match(/country-flag-formatter[\s\S]*?<span class="label">([^<]+)<\/span>/i);
  return match ? normalizeWhitespace(match[1]) : '';
}

function parseRaceDetail(html, meta = {}) {
  const jsonLd = extractJsonLd(html) || {};
  const name = normalizeWhitespace(jsonLd.name || meta.name || '');
  const startDate = String(jsonLd.startDate || '').slice(0, 10);
  const date = startDate || meta.eventDate || '';
  const year = date ? Number(date.slice(0, 4)) : null;
  const month = date ? Number(date.slice(5, 7)) : null;
  const day = date ? Number(date.slice(8, 10)) : null;
  const locationLabel = normalizeWhitespace(
    (jsonLd.location && jsonLd.location.address && jsonLd.location.address.addressRegion && jsonLd.location.address.addressCountry)
      ? `${jsonLd.location.address.addressRegion}, ${jsonLd.location.address.addressCountry}`
      : meta.location || extractHeroLocationLabel(html) || ''
  );
  const slug = slugFromIronmanUrl(meta.sourceUrl || '');
  const override = IRONMAN_LOCATION_OVERRIDES[slug] || null;
  const parsedLocation = splitCityCountry(locationLabel);
  const city = override?.city || parsedLocation.city;
  const country = override?.country || parsedLocation.country;
  const registrationStatus = extractHeroRegistration(html);
  const series = inferIronmanSeries(name);
  const normalized = normalizeIronmanDistance(series, name);
  return fillRowDefaults({
    name,
    aliases: buildAliases(name, city, country, series),
    type: normalized.type,
    discipline: 'triathlon',
    dist: normalized.dist,
    dist_km: normalized.distKm,
    custom_dist: normalized.customDist,
    city,
    region: '',
    country,
    venue: '',
    lat: null,
    lng: null,
    timezone: '',
    year,
    event_date: date || null,
    event_end_date: null,
    month,
    day,
    source_site: 'ironman',
    source_url: meta.sourceUrl || '',
    registration_url: meta.sourceUrl || '',
    source_page: meta.sourcePage || null,
    series,
    registration_status: registrationStatus || null,
    swim_type: extractLabelValue(html, 'Swim') || null,
    bike_profile: extractLabelValue(html, 'Bike') || null,
    run_profile: extractLabelValue(html, 'Run') || null,
    air_temp_high_c: parseCelsius(extractLabelValue(html, 'High Air Temp')),
    air_temp_low_c: parseCelsius(extractLabelValue(html, 'Low Air Temp')),
    water_temp_c: parseCelsius(extractLabelValue(html, 'Avg. Water Temp')),
    humidity_pct: null,
    wind_kph: null,
    weather_profile_source: 'source-page',
    course_summary: extractCourseSummary(html) || null,
    source_priority: 100,
    source_last_seen_at: meta.seenAt || new Date().toISOString(),
  });
}

function buildGenericCourseSummary(row) {
  if (row.course_summary) return row.course_summary;
  if (row.source_site === 'hyrox') {
    const majorText = row.series && row.series !== 'HYROX' ? `${row.series} weekend` : 'HYROX race weekend';
    return `${row.name} is a ${majorText} with 8 x 1km indoor runs separated by functional workout stations in a flat arena setting.`;
  }
  if (row.discipline === 'trail-running') {
    return `${row.name} is a trail-focused mountain race with technical terrain, climbing, and off-road footing.`;
  }
  if (row.discipline === 'road-running') {
    return `${row.name} is a major road race with urban crowds, paved roads, and a championship-style atmosphere.`;
  }
  if (row.discipline === 'cycling') {
    return `${row.name} is a gran fondo style road cycling event with a long endurance profile and all-day pacing demands.`;
  }
  if (row.discipline === 'triathlon') {
    return `${row.name} is a triathlon weekend with multi-discipline race demands, transition management, and variable pacing across the course.`;
  }
  if (row.discipline === 'swimming') {
    return `${row.name} is an open-water swim event where conditions, sighting, and water temperature shape race execution.`;
  }
  return '';
}

function enrichSurface(row) {
  if (row.surface) return row.surface;
  if (row.source_site === 'hyrox') return 'Indoor Arena';
  return DISCIPLINE_META[row.discipline]?.surface || '';
}

function enrichElevationProfile(row) {
  if (row.elevation_profile) return row.elevation_profile;
  if (row.source_site === 'hyrox') return 'Flat';
  if (row.discipline === 'trail-running') return 'Mountainous';
  if (row.discipline === 'road-running') {
    if (/boston/i.test(row.name)) return 'Rolling';
    if (/new york/i.test(row.name)) return 'Rolling';
    return 'Flat';
  }
  if (row.discipline === 'cycling') {
    if (/tourmalet|alpe|grand ballon|vaujany/i.test(row.name)) return 'Mountainous';
    if (/new york|maryland|cozumel/i.test(row.name)) return 'Rolling';
    return 'Rolling';
  }
  if (row.discipline === 'triathlon') return 'Rolling';
  return '';
}

function parseIronmanRow(raw) {
  const series = inferIronmanSeries(raw.name || '');
  const normalized = normalizeIronmanDistance(series, raw.name || '');
  return {
    name: raw.name,
    aliases: Array.isArray(raw.aliases) ? raw.aliases : buildAliases(raw.name, raw.city, raw.country, series),
    type: raw.type || normalized.type,
    discipline: raw.discipline || 'triathlon',
    dist: raw.dist || normalized.dist,
    dist_km: raw.dist_km ?? normalized.distKm ?? null,
    custom_dist: raw.custom_dist ?? normalized.customDist ?? '',
    city: raw.city || '',
    region: raw.region || '',
    country: raw.country || '',
    venue: raw.venue || '',
    lat: raw.lat ?? null,
    lng: raw.lng ?? null,
    timezone: raw.timezone || '',
    year: raw.year ?? null,
    event_date: raw.event_date || null,
    event_end_date: raw.event_end_date || null,
    month: raw.month ?? (raw.event_date ? Number(raw.event_date.slice(5, 7)) : null),
    day: raw.day ?? (raw.event_date ? Number(raw.event_date.slice(8, 10)) : null),
    source_site: 'ironman',
    source_url: raw.source_url || '',
    registration_url: raw.registration_url || raw.source_url || '',
    source_page: raw.source_page ?? null,
    series: raw.series || series,
    registration_status: raw.registration_status || null,
    swim_type: raw.swim_type || null,
    bike_profile: raw.bike_profile || null,
    run_profile: raw.run_profile || null,
    air_temp_high_c: raw.air_temp_high_c ?? null,
    air_temp_low_c: raw.air_temp_low_c ?? null,
    water_temp_c: raw.water_temp_c ?? null,
    humidity_pct: raw.humidity_pct ?? null,
    wind_kph: raw.wind_kph ?? null,
    weather_profile_source: raw.weather_profile_source || (raw.air_temp_high_c != null || raw.air_temp_low_c != null || raw.water_temp_c != null ? 'source-page' : ''),
    course_summary: raw.course_summary || '',
    surface: raw.surface || '',
    elevation_profile: raw.elevation_profile || '',
    source_priority: raw.source_priority ?? 100,
    source_last_seen_at: raw.source_last_seen_at || new Date().toISOString(),
  };
}

function parseHyroxDate(dateText, fallbackYear = null) {
  const match = normalizeWhitespace(dateText).match(/(\d{1,2})\.\s*([A-Za-z]+)\.?\s*(\d{4})?/);
  if (!match) return '';
  const day = Number(match[1]);
  const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
  const year = Number(match[3] || fallbackYear || new Date().getFullYear());
  if (!month || !day || !year) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseUtmbDateRange(text) {
  const normalized = normalizeWhitespace(text)
    .replace(/(\d+)(st|nd|rd|th)/gi, '$1');
  const full = normalized.match(/^(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/i);
  if (full) {
    const month = MONTHS[full[3].slice(0, 3).toLowerCase()];
    const year = Number(full[4]);
    const start = `${year}-${String(month).padStart(2, '0')}-${String(Number(full[1])).padStart(2, '0')}`;
    const end = `${year}-${String(month).padStart(2, '0')}-${String(Number(full[2])).padStart(2, '0')}`;
    return { start, end };
  }
  const cross = normalized.match(/^(\d{1,2})\s+([A-Za-z]+)\s*-\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/i);
  if (cross) {
    const startMonth = MONTHS[cross[2].slice(0, 3).toLowerCase()];
    const endMonth = MONTHS[cross[4].slice(0, 3).toLowerCase()];
    const year = Number(cross[5]);
    const start = `${year}-${String(startMonth).padStart(2, '0')}-${String(Number(cross[1])).padStart(2, '0')}`;
    const end = `${year}-${String(endMonth).padStart(2, '0')}-${String(Number(cross[3])).padStart(2, '0')}`;
    return { start, end };
  }
  const single = normalized.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/i);
  if (single) {
    const month = MONTHS[single[2].slice(0, 3).toLowerCase()];
    const year = Number(single[3]);
    const start = `${year}-${String(month).padStart(2, '0')}-${String(Number(single[1])).padStart(2, '0')}`;
    return { start, end: null };
  }
  return { start: '', end: null };
}

function inferHyroxCity(title, url) {
  let cleanedTitle = normalizeWhitespace(title)
    .replace(/^.*?\bHYROX\b\s*/i, '')
    .replace(/\bRegional Open Championships?\b/ig, '')
    .replace(/\bWorld Championships?\b/ig, '')
    .replace(/\bMajor\b/ig, '')
    .trim();
  cleanedTitle = cleanedTitle
    .replace(/^APAC Championships?\s*-\s*/i, '')
    .replace(/^EMEA Championships?\s*-\s*/i, '')
    .replace(/^AMERICAS Championships?\s*-\s*/i, '')
    .replace(/\bGrand Palais\b/ig, '')
    .replace(/\bExCel\b/ig, '')
    .replace(/\b\d{2}\/\d{2}\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (/^Washington D\.?C\.?$/i.test(cleanedTitle)) cleanedTitle = 'Washington';
  if (cleanedTitle) return cleanedTitle;
  const slug = String(url).split('/event/')[1]?.replace(/\/+$/, '') || '';
  const hyroxPart = slug.includes('hyrox-') ? slug.split('hyrox-').pop() : slug;
  return titleCaseFromSlug(hyroxPart);
}

function inferHyroxSeries(title) {
  if (/world championships/i.test(title)) return 'HYROX World Championship';
  if (/regional open championships/i.test(title)) return 'HYROX Regional Open Championship';
  if (/\bmajor\b/i.test(title)) return 'HYROX Major';
  return 'HYROX';
}

function extractHyroxEvents(html) {
  const cards = [];
  const blocks = String(html || '').split(/<div class="w-vwrapper usg_vwrapper_1 en_subpage-pt_titlebox">/i).slice(1);
  for (const block of blocks) {
    const url = block.match(/<a href="([^"]+)">/i)?.[1] || '';
    const title = normalizeWhitespace(block.match(/<a href="[^"]+">([^<]+)<\/a>/i)?.[1] || '');
    if (!url || !title || /youngstars/i.test(title) || /youngstars/i.test(url)) continue;
    const startRaw = block.match(/event_date_1[\s\S]*?<span class="w-post-elm-value">([^<]+)<\/span>/i)?.[1] || '';
    const endRaw = block.match(/event_date_3[\s\S]*?<span class="w-post-elm-value">([^<]+)<\/span>/i)?.[1] || '';
    const startDate = parseHyroxDate(startRaw);
    const endDate = endRaw ? parseHyroxDate(endRaw, startDate.slice(0, 4)) : '';
    const city = inferHyroxCity(title, url);
    const citySlug = slugify(city);
    const override = HYROX_CITY_OVERRIDES[citySlug] || {};
    cards.push({
      name: title,
      city,
      region: override.region || '',
      country: override.country || '',
      year: startDate ? Number(startDate.slice(0, 4)) : null,
      event_date: startDate || null,
      event_end_date: endDate || null,
      month: startDate ? Number(startDate.slice(5, 7)) : null,
      day: startDate ? Number(startDate.slice(8, 10)) : null,
      source_site: 'hyrox',
      source_url: url,
      registration_url: url,
      source_page: 1,
      series: inferHyroxSeries(title),
      type: 'hyrox',
      discipline: 'hyrox',
      dist: 'Solo Open',
      dist_km: 8,
      custom_dist: '',
      registration_status: null,
      swim_type: null,
      bike_profile: null,
      run_profile: null,
      course_summary: '',
      surface: 'Indoor Arena',
      elevation_profile: 'Flat',
      source_priority: /major|championship/i.test(title) ? 95 : 90,
      aliases: buildAliases(title, city, override.country || '', inferHyroxSeries(title), [
        city,
        citySlug.replace(/-/g, ' '),
      ]),
      source_last_seen_at: new Date().toISOString(),
    });
  }
  return cards;
}

function extractUtmbEvents(html, today = new Date().toISOString().slice(0, 10)) {
  const rows = [];
  const regions = ['North America', 'Europe', 'Asia', 'Oceania', 'Africa', 'South America'];
  let currentRegion = '';
  const re = />(North America|Europe|Asia|Oceania|Africa|South America)<\/|href="(https:\/\/[^"]+\.utmb\.world[^"]*|https:\/\/www\.wser\.org[^"]*)"[^>]*>([^<]+)</gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    if (match[1]) {
      currentRegion = match[1];
      continue;
    }
    const url = match[2];
    const label = normalizeWhitespace(match[3]);
    if (!url || !label || !/\d{4}$/.test(label)) continue;
    const { start, end } = parseUtmbDateRange(label);
    if (!start || start <= today) continue;
    const host = new URL(url).hostname;
    const slug = host.split('.')[0];
    const override = UTMB_EVENT_OVERRIDES[slug];
    if (!override) continue;
    rows.push(fillRowDefaults({
      name: override.name,
      aliases: buildAliases(override.name, override.city, override.country, 'UTMB World Series', [
        'UTMB',
        'UTMB World Series',
        titleCaseFromSlug(slug),
      ]),
      type: 'run',
      discipline: 'trail-running',
      dist: 'Custom…',
      dist_km: null,
      custom_dist: 'Trail Running',
      city: override.city,
      region: override.region || currentRegion,
      country: override.country,
      venue: '',
      lat: override.lat ?? null,
      lng: override.lng ?? null,
      timezone: override.timezone || '',
      year: Number(start.slice(0, 4)),
      event_date: start,
      event_end_date: end,
      month: Number(start.slice(5, 7)),
      day: Number(start.slice(8, 10)),
      source_site: 'utmb',
      source_url: url,
      registration_url: url,
      source_page: 1,
      series: 'UTMB World Series',
      registration_status: null,
      swim_type: null,
      bike_profile: null,
      run_profile: null,
      air_temp_high_c: override.air_temp_high_c ?? null,
      air_temp_low_c: override.air_temp_low_c ?? null,
      water_temp_c: null,
      humidity_pct: override.humidity_pct ?? null,
      wind_kph: override.wind_kph ?? null,
      weather_profile_source: override.weather_profile_source || '',
      course_summary: `${override.name} is a UTMB World Series trail-running festival with mountain terrain, climbing, and technical trail conditions.`,
      surface: 'Trail',
      elevation_profile: 'Mountainous',
      source_priority: 76,
      source_last_seen_at: new Date().toISOString(),
    }));
  }
  return dedupeRows(rows);
}

function buildStaticUtmbRows(today = new Date().toISOString().slice(0, 10)) {
  const rows = [];
  for (const event of UTMB_WORLD_SERIES_SCHEDULE) {
    const start = event.start || null;
    if (!start || start <= today) continue;
    const override = UTMB_EVENT_OVERRIDES[event.slug];
    if (!override) continue;
    rows.push(fillRowDefaults({
      name: override.name,
      aliases: buildAliases(override.name, override.city, override.country, 'UTMB World Series', [
        'UTMB',
        'UTMB World Series',
        titleCaseFromSlug(event.slug),
      ]),
      type: 'run',
      discipline: 'trail-running',
      dist: 'Custom…',
      dist_km: null,
      custom_dist: 'Trail Running',
      city: override.city,
      region: override.region || '',
      country: override.country,
      venue: '',
      lat: override.lat ?? null,
      lng: override.lng ?? null,
      timezone: override.timezone || '',
      year: Number(start.slice(0, 4)),
      event_date: start,
      event_end_date: event.end || start,
      month: Number(start.slice(5, 7)),
      day: Number(start.slice(8, 10)),
      source_site: 'utmb',
      source_url: event.url,
      registration_url: event.url,
      source_page: 1,
      series: 'UTMB World Series',
      registration_status: null,
      swim_type: null,
      bike_profile: null,
      run_profile: null,
      air_temp_high_c: override.air_temp_high_c ?? null,
      air_temp_low_c: override.air_temp_low_c ?? null,
      water_temp_c: null,
      humidity_pct: override.humidity_pct ?? null,
      wind_kph: override.wind_kph ?? null,
      weather_profile_source: override.weather_profile_source || '',
      course_summary: `${override.name} is a UTMB World Series trail-running festival with mountain terrain, climbing, and technical trail conditions.`,
      surface: 'Trail',
      elevation_profile: 'Mountainous',
      source_priority: 76,
      source_last_seen_at: new Date().toISOString(),
    }));
  }
  return dedupeRows(rows);
}

function buildAhotuCuratedRows(items) {
  return items.map(item => {
    const normalized = normalizeAhotuDistance(item);
    return {
      name: item.name,
      aliases: buildAliases(item.name, item.city, item.country, item.series || '', item.aliases || [DISCIPLINE_META[item.discipline]?.label || '']),
      type: normalized.type,
      discipline: item.discipline,
      dist: normalized.dist,
      dist_km: normalized.distKm,
      custom_dist: normalized.customDist,
      city: item.city || '',
      region: item.region || '',
      country: item.country || '',
      venue: item.venue || '',
      lat: item.lat ?? null,
      lng: item.lng ?? null,
      timezone: item.timezone || '',
      year: item.year ?? Number(String(item.event_date).slice(0, 4)),
      event_date: item.event_date || null,
      event_end_date: item.event_end_date || null,
      month: item.month ?? Number(String(item.event_date).slice(5, 7)),
      day: item.day ?? Number(String(item.event_date).slice(8, 10)),
      source_site: 'ahotu',
      source_url: item.source_url || '',
      registration_url: item.registration_url || item.source_url || '',
      source_page: item.source_page ?? null,
      series: item.series || '',
      registration_status: item.registration_status || null,
      swim_type: item.swim_type || null,
      bike_profile: item.bike_profile || null,
      run_profile: item.run_profile || null,
      air_temp_high_c: item.air_temp_high_c ?? null,
      air_temp_low_c: item.air_temp_low_c ?? null,
      water_temp_c: item.water_temp_c ?? null,
      humidity_pct: item.humidity_pct ?? null,
      wind_kph: item.wind_kph ?? null,
      weather_profile_source: item.weather_profile_source || '',
      course_summary: item.course_summary || '',
      surface: item.surface || '',
      elevation_profile: item.elevation_profile || '',
      source_priority: item.source_priority ?? 70,
      source_last_seen_at: item.source_last_seen_at || new Date().toISOString(),
    };
  });
}

function curl(url, extraArgs = []) {
  return execFileSync('curl', ['-L', '--max-time', '10', '-A', 'Mozilla/5.0', '-s', ...extraArgs, url], {
    encoding: 'utf8',
  });
}

async function fetchText(url) {
  return curl(url);
}

async function fetchJson(url) {
  return JSON.parse(curl(url));
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function geocodeLocation(row, cache) {
  const key = slugify(`${row.city}|${row.country}|${row.region}`);
  if (cache.has(key)) return cache.get(key);
  const query = row.city || '';
  if (!query) return null;
  await sleep(50);
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
    const data = await fetchJson(url);
    const first = (data.results || []).find(result => {
      const countryMatches = !row.country || normalizeWhitespace(result.country || '') === row.country;
      if (countryMatches) return true;
      return false;
    }) || data.results?.[0];
    if (!first) {
      cache.set(key, null);
      return null;
    }
    const result = {
      lat: Number(first.lat ?? first.latitude),
      lng: Number(first.lon ?? first.longitude),
      city: row.city || normalizeWhitespace(first.name || ''),
      region: row.region || normalizeWhitespace(first.admin1 || first.admin2 || ''),
      country: row.country || normalizeWhitespace(first.country || ''),
      timezone: first.timezone || '',
    };
    cache.set(key, result);
    return result;
  } catch (error) {
    cache.set(key, null);
    return null;
  }
}

async function fetchTimezoneAndClimate(row, coord, climateCache) {
  const climateKey = `${coord.lat.toFixed(3)}|${coord.lng.toFixed(3)}|${row.event_date}|${row.discipline}`;
  if (climateCache.has(climateKey)) return climateCache.get(climateKey);
  try {
    const dailyParams = ['temperature_2m_max', 'temperature_2m_min', 'relative_humidity_2m_mean', 'windspeed_10m_mean'];
    const climateUrl = `https://climate-api.open-meteo.com/v1/climate?latitude=${coord.lat}&longitude=${coord.lng}&start_date=${row.event_date}&end_date=${row.event_date}&models=${CLIMATE_MODEL}&daily=${dailyParams.join(',')}`;
    const climate = await fetchJson(climateUrl);
    const forecast = await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${coord.lat}&longitude=${coord.lng}&current=temperature_2m&timezone=auto&forecast_days=1`);
    const result = {
      timezone: forecast.timezone || '',
      air_temp_high_c: climate.daily?.temperature_2m_max?.[0] != null ? Math.round(climate.daily.temperature_2m_max[0]) : null,
      air_temp_low_c: climate.daily?.temperature_2m_min?.[0] != null ? Math.round(climate.daily.temperature_2m_min[0]) : null,
      humidity_pct: climate.daily?.relative_humidity_2m_mean?.[0] != null ? Math.round(climate.daily.relative_humidity_2m_mean[0]) : null,
      wind_kph: climate.daily?.windspeed_10m_mean?.[0] != null ? Math.round(climate.daily.windspeed_10m_mean[0]) : null,
    };
    climateCache.set(climateKey, result);
    return result;
  } catch (error) {
    climateCache.set(climateKey, null);
    return null;
  }
}

function fillRowDefaults(row) {
  const disciplineMeta = DISCIPLINE_META[row.discipline] || {};
  const result = { ...row };
  result.aliases = Array.isArray(result.aliases) ? result.aliases : [];
  result.custom_dist = result.custom_dist ?? '';
  result.registration_url = result.registration_url || result.source_url || '';
  result.surface = enrichSurface(result);
  result.elevation_profile = enrichElevationProfile(result);
  result.course_summary = buildGenericCourseSummary(result);
  result.weather_profile_source = result.weather_profile_source || '';
  result.source_priority = result.source_priority ?? 0;
  result.type = result.type || disciplineMeta.type || 'run';
  return result;
}

async function enrichRows(rows) {
  const geocodeCache = new Map();
  const climateCache = new Map();
  const enriched = [];
  for (const inputRow of rows) {
    const row = fillRowDefaults(inputRow);
    const hasSourceWeather = row.air_temp_high_c != null || row.air_temp_low_c != null || row.water_temp_c != null;
    const shouldSkipIronmanLookup = row.source_site === 'ironman' && hasSourceWeather && row.country;
    const needsGeocode = !shouldSkipIronmanLookup && (!row.country || row.lat == null || row.lng == null || !row.timezone || row.air_temp_high_c == null || row.air_temp_low_c == null || row.humidity_pct == null || row.wind_kph == null) && row.city && row.event_date;
    if (needsGeocode) {
      const coord = row.lat != null && row.lng != null
        ? { lat: Number(row.lat), lng: Number(row.lng), city: row.city, region: row.region, country: row.country }
        : await geocodeLocation(row, geocodeCache);
      if (coord) {
        row.lat = row.lat ?? coord.lat;
        row.lng = row.lng ?? coord.lng;
        row.city = row.city || coord.city;
        row.region = row.region || coord.region;
        row.country = row.country || coord.country;
        row.timezone = row.timezone || coord.timezone || '';
        const climate = await fetchTimezoneAndClimate(row, coord, climateCache);
        if (climate) {
          row.timezone = row.timezone || climate.timezone;
          if (row.air_temp_high_c == null) row.air_temp_high_c = climate.air_temp_high_c;
          if (row.air_temp_low_c == null) row.air_temp_low_c = climate.air_temp_low_c;
          if (row.humidity_pct == null) row.humidity_pct = climate.humidity_pct;
          if (row.wind_kph == null) row.wind_kph = climate.wind_kph;
          if (!row.weather_profile_source && (climate.air_temp_high_c != null || climate.air_temp_low_c != null)) {
            row.weather_profile_source = row.source_site === 'ironman' && (inputRow.air_temp_high_c != null || inputRow.air_temp_low_c != null)
              ? 'source-page'
              : 'geocoded-climate';
          }
        }
      }
    } else if (row.source_site === 'ironman' && hasSourceWeather) {
      row.weather_profile_source = row.weather_profile_source || 'source-page';
    }
    enriched.push(row);
  }
  return enriched;
}

function mergeRows(preferred, candidate) {
  const merged = { ...preferred };
  for (const [key, value] of Object.entries(candidate)) {
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value)) {
      const current = Array.isArray(merged[key]) ? merged[key] : [];
      merged[key] = [...new Set([...current, ...value])];
      continue;
    }
    if (merged[key] === null || merged[key] === undefined || merged[key] === '') {
      merged[key] = value;
    }
  }
  return merged;
}

function rowRichness(row) {
  return Object.values(row).reduce((score, value) => {
    if (Array.isArray(value)) return score + value.filter(Boolean).length;
    if (value === null || value === undefined || value === '') return score;
    return score + 1;
  }, 0);
}

function dedupeRows(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = [
      slugify(row.name),
      slugify(row.city),
      slugify(row.country),
      row.year || '',
      row.type || '',
      slugify(row.dist || ''),
      slugify(row.custom_dist || row.customDist || ''),
    ].join('::');
    const existing = map.get(key);
    if (!existing) {
      map.set(key, row);
      continue;
    }
    if ((row.source_priority || 0) > (existing.source_priority || 0)) {
      map.set(key, mergeRows(row, existing));
      continue;
    }
    if ((row.source_priority || 0) === (existing.source_priority || 0) && rowRichness(row) > rowRichness(existing)) {
      map.set(key, mergeRows(row, existing));
      continue;
    }
    map.set(key, mergeRows(existing, row));
  }
  return [...map.values()].sort((a, b) => {
    if ((a.event_date || '') !== (b.event_date || '')) return (a.event_date || '').localeCompare(b.event_date || '');
    return a.name.localeCompare(b.name);
  });
}

function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (Array.isArray(value)) {
    if (!value.length) return "ARRAY[]::text[]";
    return `ARRAY[${value.map(item => sqlValue(item)).join(', ')}]`;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildRefreshMigration(rows) {
  const columns = [
    'name', 'aliases', 'type', 'discipline', 'dist', 'dist_km', 'custom_dist',
    'city', 'region', 'country', 'venue', 'lat', 'lng', 'timezone',
    'year', 'event_date', 'event_end_date', 'month', 'day',
    'source_site', 'source_url', 'registration_url', 'source_page', 'series',
    'registration_status', 'swim_type', 'bike_profile', 'run_profile',
    'air_temp_high_c', 'air_temp_low_c', 'water_temp_c', 'humidity_pct', 'wind_kph',
    'weather_profile_source', 'course_summary', 'surface', 'elevation_profile',
    'source_priority', 'source_last_seen_at',
  ];
  const tuples = rows.map(row => `(${columns.map(column => sqlValue(row[column])).join(', ')})`);
  return `-- Race catalog refresh — IRONMAN + HYROX + curated Ahotu + UTMB + manual imports\ntruncate table public.race_catalog restart identity cascade;\n\ninsert into public.race_catalog\n  (${columns.join(', ')})\nvalues\n${tuples.join(',\n')};\n`;
}

function parseArgs(argv) {
  const args = {
    ironmanJson: path.resolve(process.cwd(), 'public/ironman-race-catalog.json'),
    ahotuJson: AHOTU_DEFAULT_PATH,
    outputJson: '',
    outputSql: '',
    hyroxUrl: HYROX_LIST_URL,
    utmbUrl: UTMB_WORLD_SERIES_URL,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--ironman-json') args.ironmanJson = argv[++i];
    else if (arg === '--ahotu-json') args.ahotuJson = argv[++i];
    else if (arg === '--hyrox-url') args.hyroxUrl = argv[++i];
    else if (arg === '--utmb-url') args.utmbUrl = argv[++i];
    else if (arg === '--output-json') args.outputJson = argv[++i];
    else if (arg === '--output-sql') args.outputSql = argv[++i];
  }
  return args;
}

async function generateCatalog(options = {}) {
  const ironmanRows = JSON.parse(fs.readFileSync(options.ironmanJson, 'utf8')).map(parseIronmanRow);
  const ahotuRows = buildAhotuCuratedRows(JSON.parse(fs.readFileSync(options.ahotuJson, 'utf8')));
  const hyroxHtml = await fetchText(options.hyroxUrl || HYROX_LIST_URL);
  const hyroxRows = extractHyroxEvents(hyroxHtml);
  const utmbRows = buildStaticUtmbRows();
  const enriched = await enrichRows([...ironmanRows, ...hyroxRows, ...ahotuRows, ...utmbRows]);
  return dedupeRows(enriched);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rows = await generateCatalog(args);
  if (args.outputJson) {
    fs.writeFileSync(args.outputJson, `${JSON.stringify(rows, null, 2)}\n`);
  }
  if (args.outputSql) {
    fs.writeFileSync(args.outputSql, buildRefreshMigration(rows));
  }
  process.stdout.write(`${rows.length}\n`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  buildAhotuCuratedRows,
  buildStaticUtmbRows,
  buildRefreshMigration,
  dedupeRows,
  enrichRows,
  extractDetailUrls,
  extractHyroxEvents,
  extractUtmbEvents,
  generateCatalog,
  normalizeAhotuDistance,
  normalizeIronmanDistance,
  parseIronmanRow,
  parseRaceDetail,
  parseHyroxDate,
  splitCityCountry,
};

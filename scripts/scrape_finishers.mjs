#!/usr/bin/env node
// Finishers.com scraper — sitemap walker + Next.js __NEXT_DATA__ parser.
//
// Usage:
//   node scripts/scrape_finishers.mjs --sample 50
//   node scripts/scrape_finishers.mjs           (full run, ~10K events)
//
// Output:
//   scripts/out/finishers.json          accepted rows (one per matched distance)
//   scripts/out/finishers-skipped.json  events with no resolvable date
//   scripts/out/finishers-failed.json   network/parse errors per URL
//
// Distance buckets per the user's listing URLs:
//   discipline=road
//   dmin/dmax=42195/42195    → Marathon (42.195 km)
//   dmin/dmax=21097/21098    → Half Marathon (21.1 km)
//   dmin/dmax=9000/11000     → 10K bucket (wide — captures odd-distance French races)

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, 'out');

const SITEMAP_URL = 'https://www.finishers.com/sitemap/events.xml';
const UAS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];
const pickUA = () => UAS[Math.floor(Math.random() * UAS.length)];
const CONCURRENCY = 6;
const POLITE_DELAY_MS = 300;
const MAX_RETRIES = 2;

const DIST_BUCKETS = [
  // Wide 10K bucket per user spec (9000-11000m)
  { min: 9000, max: 11000, dist_km: 10, dist: '10K', type: '10K' },
  { min: 21097, max: 21098, dist_km: 21.1, dist: 'Half Marathon', type: 'Half Marathon' },
  { min: 42195, max: 42195, dist_km: 42.195, dist: 'Marathon', type: 'Marathon' },
];

// ISO-2 → canonical full name (mirrors scrape_worldsmarathons.mjs).
const ISO_TO_COUNTRY = {
  AD: 'Andorra', AE: 'United Arab Emirates', AG: 'Antigua and Barbuda',
  AL: 'Albania', AM: 'Armenia', AO: 'Angola', AQ: 'Antarctica', AR: 'Argentina',
  AT: 'Austria', AU: 'Australia', AW: 'Aruba', AX: 'Åland Islands', AZ: 'Azerbaijan',
  BA: 'Bosnia and Herzegovina', BB: 'Barbados', BD: 'Bangladesh', BE: 'Belgium',
  BG: 'Bulgaria', BH: 'Bahrain', BJ: 'Benin', BL: 'Saint Barthélemy',
  BM: 'Bermuda', BN: 'Brunei', BO: 'Bolivia',
  BR: 'Brazil', BS: 'Bahamas', BT: 'Bhutan', BW: 'Botswana', BY: 'Belarus',
  BZ: 'Belize', CA: 'Canada', CD: 'Democratic Republic of the Congo',
  CH: 'Switzerland', CI: "Côte d'Ivoire", CK: 'Cook Islands', CL: 'Chile',
  CN: 'China', CO: 'Colombia', CR: 'Costa Rica', CU: 'Cuba', CV: 'Cape Verde',
  CW: 'Curaçao', CY: 'Cyprus', CZ: 'Czech Republic', DE: 'Germany',
  DK: 'Denmark', DO: 'Dominican Republic', DZ: 'Algeria', EC: 'Ecuador',
  EE: 'Estonia', EG: 'Egypt', ES: 'Spain', ET: 'Ethiopia', FI: 'Finland',
  FJ: 'Fiji', FK: 'Falkland Islands', FO: 'Faroe Islands', FR: 'France',
  GA: 'Gabon', GB: 'United Kingdom', GD: 'Grenada', GE: 'Georgia', GF: 'French Guiana',
  GG: 'Guernsey', GP: 'Guadeloupe',
  GH: 'Ghana', GL: 'Greenland', GM: 'Gambia', GR: 'Greece', GT: 'Guatemala',
  GU: 'Guam', HK: 'Hong Kong', HN: 'Honduras', HR: 'Croatia', HU: 'Hungary',
  ID: 'Indonesia', IE: 'Ireland', IL: 'Israel', IM: 'Isle of Man', IN: 'India',
  IR: 'Iran', IS: 'Iceland', IT: 'Italy', JE: 'Jersey', JM: 'Jamaica',
  JO: 'Jordan', JP: 'Japan', KE: 'Kenya', KG: 'Kyrgyzstan', KH: 'Cambodia',
  KN: 'Saint Kitts and Nevis',
  KR: 'South Korea', KW: 'Kuwait', KY: 'Cayman Islands', KZ: 'Kazakhstan',
  LA: 'Laos', LB: 'Lebanon', LC: 'Saint Lucia', LI: 'Liechtenstein', LK: 'Sri Lanka',
  LR: 'Liberia', LT: 'Lithuania', LU: 'Luxembourg', LV: 'Latvia',
  MA: 'Morocco', MC: 'Monaco', MD: 'Moldova', ME: 'Montenegro', MK: 'North Macedonia',
  MM: 'Myanmar', MN: 'Mongolia', MO: 'Macau', MP: 'Northern Mariana Islands',
  MQ: 'Martinique', MT: 'Malta', MU: 'Mauritius', MV: 'Maldives',
  MX: 'Mexico', MY: 'Malaysia', NA: 'Namibia', NC: 'New Caledonia',
  NE: 'Niger', NG: 'Nigeria', NL: 'Netherlands', NO: 'Norway', NP: 'Nepal',
  NZ: 'New Zealand', OM: 'Oman', PA: 'Panama', PE: 'Peru', PF: 'French Polynesia',
  PG: 'Papua New Guinea', PH: 'Philippines', PK: 'Pakistan', PL: 'Poland',
  PR: 'Puerto Rico', PT: 'Portugal', PY: 'Paraguay', QA: 'Qatar',
  RE: 'Réunion', RO: 'Romania', RS: 'Serbia', RU: 'Russia', RW: 'Rwanda', SA: 'Saudi Arabia',
  SC: 'Seychelles', SE: 'Sweden', SG: 'Singapore', SI: 'Slovenia', SJ: 'Svalbard and Jan Mayen', SK: 'Slovakia',
  SL: 'Sierra Leone', SN: 'Senegal', SO: 'Somalia', ST: 'São Tomé and Príncipe',
  SV: 'El Salvador', SY: 'Syria', TC: 'Turks and Caicos Islands',
  TG: 'Togo', TH: 'Thailand', TJ: 'Tajikistan', TN: 'Tunisia', TR: 'Turkey',
  TT: 'Trinidad and Tobago', TW: 'Taiwan', TZ: 'Tanzania', UA: 'Ukraine',
  UG: 'Uganda', US: 'United States', UY: 'Uruguay', UZ: 'Uzbekistan',
  VA: 'Vatican City', VE: 'Venezuela', VG: 'British Virgin Islands',
  VI: 'United States Virgin Islands', VN: 'Vietnam', WS: 'Samoa',
  ZA: 'South Africa', ZM: 'Zambia', ZW: 'Zimbabwe',
};

// Sponsor-strip list (mirror of WM scraper for consistency)
const SPONSOR_PREFIXES = [
  'asics', 'bmw', 'tcs', 'aramco', 'bose', 'adidas', 'virgin', 'lloyds', 'generali',
  'mainova', 'haspa', 'allianz', 'sparkassen', 'sparkasse', 'edp',
  'bupa', 'volkswagen', 'hyundai', 'kia', 'samsung', 'panasonic', 'toyota', 'honda',
  'nissan', 'mazda', 'subaru', 'ford', 'tesla', 'hilton', 'marriott', 'westin',
  'chevron', 'shell', 'totalenergies', 'castrol', 'amgen', 'pfizer', 'moderna',
  'astrazeneca', 'novartis', 'roche', 'colgate', 'pepsi', 'coca-cola', 'nestle',
  'unilever', 'henkel', 'philips', 'siemens', 'bosch', 'continental', 'vinci',
  'engie', 'vodafone', 'verizon', 'comcast', 'xfinity', 'amazon', 'microsoft',
  'apple', 'meta', 'netflix', 'disney', 'paramount', 'csob', 'iwelt', 'mitja',
  'sennheiser', 'jbl', 'beats', 'mastercard', 'visa', 'amex', 'paypal',
];
const SPONSOR_PHRASES = [
  'standard chartered', 'bank of america', 'first abu dhabi', 'emirates nbd',
  'sony pictures', 'lions gate', 'rock n roll', "rock 'n' roll", "rock'n'roll",
];

const args = process.argv.slice(2);
const sampleN = (() => {
  const i = args.indexOf('--sample');
  if (i >= 0 && args[i + 1]) return parseInt(args[i + 1], 10);
  return null;
})();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url, attempt = 1) {
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': pickUA(),
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        'accept-encoding': 'gzip, deflate, br',
        'cache-control': 'no-cache',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
      },
    });
    if (res.status === 403 || res.status === 429 || res.status >= 500) {
      if (attempt <= MAX_RETRIES) {
        const wait = (1000 * Math.pow(2, attempt - 1)) + Math.random() * 500;
        await sleep(wait);
        return fetchText(url, attempt + 1);
      }
      throw new Error(`status ${res.status}`);
    }
    if (res.status === 404) throw new Error('status 404');
    if (!res.ok) throw new Error(`status ${res.status}`);
    return await res.text();
  } catch (e) {
    if (attempt <= MAX_RETRIES && !/status (403|404)/.test(String(e?.message || e))) {
      await sleep(500 * attempt);
      return fetchText(url, attempt + 1);
    }
    throw e;
  }
}

async function fetchSitemap() {
  const xml = await fetchText(SITEMAP_URL);
  // Sitemap has <url><loc>...</loc>...<xhtml:link...> blocks. Use English alternate
  // when available; fall back to the canonical /course/ URL only as a last resort
  // (those redirect through French paths).
  const urls = new Set();
  const re = /<xhtml:link[^>]+hreflang="en"[^>]+href="([^"]+)"/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    urls.add(m[1].trim());
  }
  return [...urls];
}

function bucketFor(d) {
  for (const b of DIST_BUCKETS) if (d >= b.min && d <= b.max) return b;
  return null;
}

function tokensOf(name) {
  return name.trim().split(/\s+/);
}

function stripSponsor(name) {
  if (!name) return { canonical: name, stripped: false };
  let s = name.trim();
  const phrases = [...SPONSOR_PHRASES].sort((a, b) => b.length - a.length);
  let stripped = false;
  let guard = 0;
  while (guard++ < 8) {
    let advanced = false;
    const lower = s.toLowerCase();
    for (const p of phrases) {
      if (lower.startsWith(p + ' ')) {
        s = s.slice(p.length + 1);
        stripped = true;
        advanced = true;
        break;
      }
    }
    if (advanced) continue;
    const toks = tokensOf(s);
    if (!toks.length) break;
    const head = toks[0].toLowerCase().replace(/[^a-z0-9'-]/g, '');
    if (SPONSOR_PREFIXES.includes(head)) {
      s = toks.slice(1).join(' ');
      stripped = true;
    } else break;
  }
  s = s.replace(/\s+(19|20)\d{2}\s*$/, '').trim();
  return { canonical: s || name, stripped };
}

function ymdFromDate(iso) {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? { year: +m[1], month: +m[2], day: +m[3] } : null;
}

function normTime(t) {
  if (!t) return null;
  const m = String(t).match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);
  return m ? `${m[1]}:${m[2]}:${m[3] ?? '00'}` : null;
}

// Extract the __NEXT_DATA__ JSON. Returns parsed object or null.
function parseNextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

async function processEventUrl(url) {
  const html = await fetchText(url);
  const data = parseNextData(html);
  if (!data) return { rows: [], skipped: { url, reason: 'no_next_data' } };
  const pp = data?.props?.pageProps;
  if (!pp || !pp.event) return { rows: [], skipped: { url, reason: 'no_pageProps_event' } };

  const eventName = (pp.event.name || '').trim();

  // City + country come from breadcrumb.
  let city = null;
  let countryCode = null;
  for (const b of pp.event.breadcrumb || []) {
    if (b?.type === 'city' && !city) city = b.label;
    if (b?.type === 'country' && !countryCode) countryCode = (b.code || '').toUpperCase();
  }
  // Fallback: jsonLd.location.address
  if (!city && pp.jsonLd?.location?.address?.addressLocality) city = pp.jsonLd.location.address.addressLocality;
  if (!countryCode && pp.jsonLd?.location?.address?.addressCountry) countryCode = String(pp.jsonLd.location.address.addressCountry).toUpperCase();
  const country = countryCode ? (ISO_TO_COUNTRY[countryCode] || null) : null;

  // Coords (cityCoordinates is {lat, lng})
  const coords = pp.event.cityCoordinates || null;

  const races = pp.races || [];
  const rows = [];
  const seen = new Set();

  for (const r of races) {
    if (r.discipline !== 'road') continue;          // user filter
    const distMeters = +r.distance;
    if (!Number.isFinite(distMeters)) continue;
    if (r.distanceUnit && r.distanceUnit !== 'meters') continue;
    const bucket = bucketFor(distMeters);
    if (!bucket) continue;
    if (r.status === 'cancelled') continue;          // skip cancelled

    const iso = r.date || pp.nextEdition?.dateRange?.start || pp.lastEdition?.dateRange?.start;
    const ymd = ymdFromDate(iso);
    if (!ymd) continue;

    const start_time = normTime(r.time);
    const event_date = `${ymd.year}-${String(ymd.month).padStart(2, '0')}-${String(ymd.day).padStart(2, '0')}`;
    const dedupeKey = `${bucket.dist_km}|${event_date}|${start_time || ''}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const rawName = eventName;
    const { canonical, stripped } = stripSponsor(rawName);
    const aliases = stripped ? [rawName, canonical] : [rawName];

    rows.push({
      name: canonical || rawName,
      aliases,
      city,
      country,
      country_iso2: countryCode,
      year: ymd.year,
      month: ymd.month,
      day: ymd.day,
      event_date,
      start_time,
      dist: bucket.dist,
      dist_km: bucket.dist_km,
      type: bucket.type,
      discipline: 'running',
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      source_site: 'finishers.com',
      source_url: url,
      _fin: { raceName: r.name, distance: distMeters, status: r.status, raceId: r.id },
    });
  }

  return { rows, skipped: null };
}

async function pool(items, fn, concurrency) {
  const results = [];
  let i = 0;
  let active = 0;
  return new Promise((resolveAll) => {
    const next = () => {
      if (i >= items.length && active === 0) return resolveAll(results);
      while (active < concurrency && i < items.length) {
        const idx = i++;
        active++;
        Promise.resolve()
          .then(() => fn(items[idx], idx))
          .then((r) => { results[idx] = { ok: true, value: r }; })
          .catch((e) => { results[idx] = { ok: false, error: String(e?.message || e) }; })
          .finally(() => {
            active--;
            setTimeout(next, POLITE_DELAY_MS);
          });
      }
    };
    next();
  });
}

(async () => {
  await mkdir(OUT_DIR, { recursive: true });
  console.error('[fin] fetching sitemap…');
  let urls = await fetchSitemap();
  console.error(`[fin] english event urls: ${urls.length}`);

  if (sampleN && Number.isFinite(sampleN)) {
    urls = urls.slice(0, sampleN);
    console.error(`[fin] sample mode: limiting to first ${urls.length} urls`);
  }

  const accepted = [];
  const skipped = [];
  const failed = [];
  let processed = 0;

  await pool(urls, async (url) => {
    try {
      const { rows, skipped: skip } = await processEventUrl(url);
      accepted.push(...rows);
      if (skip) skipped.push(skip);
    } catch (e) {
      failed.push({ url, error: String(e?.message || e) });
    } finally {
      processed++;
      if (processed % 100 === 0 || processed === urls.length) {
        console.error(`[fin] ${processed}/${urls.length}  accepted=${accepted.length}  skipped=${skipped.length}  failed=${failed.length}`);
      }
    }
  }, CONCURRENCY);

  await writeFile(resolve(OUT_DIR, 'finishers.json'), JSON.stringify(accepted, null, 2));
  await writeFile(resolve(OUT_DIR, 'finishers-skipped.json'), JSON.stringify(skipped, null, 2));
  await writeFile(resolve(OUT_DIR, 'finishers-failed.json'), JSON.stringify(failed, null, 2));

  const byBucket = { '10K': 0, 'Half Marathon': 0, 'Marathon': 0 };
  for (const r of accepted) byBucket[r.type] = (byBucket[r.type] || 0) + 1;
  const withTime = accepted.filter((r) => r.start_time).length;
  const missingCountry = accepted.filter((r) => !r.country).length;

  console.error('---');
  console.error(`[fin] accepted rows:   ${accepted.length}`);
  console.error(`[fin]   10K:           ${byBucket['10K']}`);
  console.error(`[fin]   Half Marathon: ${byBucket['Half Marathon']}`);
  console.error(`[fin]   Marathon:      ${byBucket['Marathon']}`);
  console.error(`[fin] with start_time: ${withTime}`);
  console.error(`[fin] skipped events:  ${skipped.length}`);
  console.error(`[fin] failed urls:     ${failed.length}`);
  console.error(`[fin] missing country: ${missingCountry}`);
  console.error(`[fin] outputs in:      ${OUT_DIR}`);
})().catch((e) => {
  console.error('[fin] fatal:', e);
  process.exit(1);
});

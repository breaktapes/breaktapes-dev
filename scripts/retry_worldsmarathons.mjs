#!/usr/bin/env node
// Retry pass — re-fetch the URLs in worldsmarathons-failed.json with very polite settings
// and merge any newly-parsed rows into worldsmarathons.json.
//
// Usage:
//   node scripts/retry_worldsmarathons.mjs
//
// Reads:
//   scripts/out/worldsmarathons.json          (existing accepted rows — appended to)
//   scripts/out/worldsmarathons-failed.json   (urls to retry)
//
// Writes:
//   scripts/out/worldsmarathons.json          (with newly recovered rows appended)
//   scripts/out/worldsmarathons-failed.json   (only urls that still failed)
//
// NOTE: This script duplicates the parsing logic from scrape_worldsmarathons.mjs.
// Both must stay in sync — when adding sponsor list / ISO countries / parsers,
// update both.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, 'out');

// ── Inlined config — mirrors scrape_worldsmarathons.mjs ───────────────
const UAS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
];
const pickUA = () => UAS[Math.floor(Math.random() * UAS.length)];

const DIST_BUCKETS = [
  { min: 9900, max: 10100, dist_km: 10, dist: '10K', type: '10K' },
  { min: 21000, max: 21200, dist_km: 21.1, dist: 'Half Marathon', type: 'Half Marathon' },
  { min: 42100, max: 42300, dist_km: 42.195, dist: 'Marathon', type: 'Marathon' },
];

// Keep ISO map in sync with scrape_worldsmarathons.mjs
const ISO_TO_COUNTRY = {
  AD: 'Andorra', AE: 'United Arab Emirates', AG: 'Antigua and Barbuda',
  AL: 'Albania', AM: 'Armenia', AO: 'Angola', AQ: 'Antarctica', AR: 'Argentina',
  AT: 'Austria', AU: 'Australia', AW: 'Aruba', AX: 'Åland Islands', AZ: 'Azerbaijan',
  BA: 'Bosnia and Herzegovina', BB: 'Barbados', BD: 'Bangladesh', BE: 'Belgium',
  BG: 'Bulgaria', BH: 'Bahrain', BM: 'Bermuda', BN: 'Brunei', BO: 'Bolivia',
  BR: 'Brazil', BS: 'Bahamas', BT: 'Bhutan', BW: 'Botswana', BY: 'Belarus',
  BZ: 'Belize', CA: 'Canada', CD: 'Democratic Republic of the Congo',
  CH: 'Switzerland', CI: "Côte d'Ivoire", CK: 'Cook Islands', CL: 'Chile',
  CN: 'China', CO: 'Colombia', CR: 'Costa Rica', CU: 'Cuba', CV: 'Cape Verde',
  CW: 'Curaçao', CY: 'Cyprus', CZ: 'Czech Republic', DE: 'Germany',
  DK: 'Denmark', DO: 'Dominican Republic', DZ: 'Algeria', EC: 'Ecuador',
  EE: 'Estonia', EG: 'Egypt', ES: 'Spain', ET: 'Ethiopia', FI: 'Finland',
  FJ: 'Fiji', FK: 'Falkland Islands', FO: 'Faroe Islands', FR: 'France',
  GA: 'Gabon', GB: 'United Kingdom', GD: 'Grenada', GE: 'Georgia', GG: 'Guernsey',
  GH: 'Ghana', GL: 'Greenland', GM: 'Gambia', GR: 'Greece', GT: 'Guatemala',
  GU: 'Guam', HK: 'Hong Kong', HN: 'Honduras', HR: 'Croatia', HU: 'Hungary',
  ID: 'Indonesia', IE: 'Ireland', IL: 'Israel', IM: 'Isle of Man', IN: 'India',
  IR: 'Iran', IS: 'Iceland', IT: 'Italy', JE: 'Jersey', JM: 'Jamaica',
  JO: 'Jordan', JP: 'Japan', KE: 'Kenya', KG: 'Kyrgyzstan', KH: 'Cambodia',
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
  RO: 'Romania', RS: 'Serbia', RU: 'Russia', RW: 'Rwanda', SA: 'Saudi Arabia',
  SC: 'Seychelles', SE: 'Sweden', SG: 'Singapore', SI: 'Slovenia', SK: 'Slovakia',
  SL: 'Sierra Leone', SN: 'Senegal', SO: 'Somalia', ST: 'São Tomé and Príncipe',
  SV: 'El Salvador', SY: 'Syria', TC: 'Turks and Caicos Islands',
  TG: 'Togo', TH: 'Thailand', TJ: 'Tajikistan', TN: 'Tunisia', TR: 'Turkey',
  TT: 'Trinidad and Tobago', TW: 'Taiwan', TZ: 'Tanzania', UA: 'Ukraine',
  UG: 'Uganda', US: 'United States', UY: 'Uruguay', UZ: 'Uzbekistan',
  VA: 'Vatican City', VE: 'Venezuela', VG: 'British Virgin Islands',
  VI: 'United States Virgin Islands', VN: 'Vietnam', WS: 'Samoa',
  ZA: 'South Africa', ZM: 'Zambia', ZW: 'Zimbabwe',
};

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url, attempt = 1) {
  const res = await fetch(url, {
    headers: {
      'user-agent': pickUA(),
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
      'cache-control': 'no-cache',
      'pragma': 'no-cache',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
    },
  });
  if (res.status === 403) {
    if (attempt <= 4) {
      const wait = 5000 + Math.random() * 5000;
      await sleep(wait);
      return fetchText(url, attempt + 1);
    }
    throw new Error('status 403');
  }
  if (res.status === 429 || res.status >= 500) {
    if (attempt <= 3) {
      await sleep(2000 * attempt);
      return fetchText(url, attempt + 1);
    }
    throw new Error(`status ${res.status}`);
  }
  if (!res.ok) throw new Error(`status ${res.status}`);
  return await res.text();
}

function parseEventLd(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const b of blocks) {
    try {
      const obj = JSON.parse(b[1].trim());
      if (obj && obj['@type'] === 'Event') return obj;
    } catch {}
  }
  return null;
}

function parseRaceObjects(html) {
  const out = [];
  const re = /\{"raceName":"[^"]+","distance":[0-9.]+[^{}]*?"distanceId":"[^"]+","hidden":(?:true|false),"measureType":[0-9]+\}/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try { out.push(JSON.parse(m[0])); } catch {}
  }
  return out;
}

function bucketFor(d) {
  for (const b of DIST_BUCKETS) if (d >= b.min && d <= b.max) return b;
  return null;
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
    const toks = s.trim().split(/\s+/);
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

function timeFromDateTime(iso) {
  if (!iso) return null;
  const m = String(iso).match(/T(\d{2}):(\d{2})(?::(\d{2}))?/);
  return m ? `${m[1]}:${m[2]}:${m[3] ?? '00'}` : null;
}

function parseEvent(html, url) {
  const ld = parseEventLd(html);
  if (!ld) return [];
  const eventName = (ld.name || '').trim();
  const eventStart = ld.startDate || null;
  const city = ld.location?.address?.addressLocality?.trim() || null;
  const iso2 = ld.location?.address?.addressCountry?.trim().toUpperCase() || null;
  const country = iso2 ? (ISO_TO_COUNTRY[iso2] || null) : null;

  const races = parseRaceObjects(html);
  const rows = [];
  const seen = new Set();
  for (const r of races) {
    const bucket = bucketFor(r.distance);
    if (!bucket) continue;
    const sdt = r.startDateTime || null;
    const ymd = sdt ? ymdFromDate(sdt) : (eventStart ? ymdFromDate(eventStart) : null);
    if (!ymd) continue;
    const start_time = sdt ? timeFromDateTime(sdt) : null;
    const event_date = `${ymd.year}-${String(ymd.month).padStart(2, '0')}-${String(ymd.day).padStart(2, '0')}`;
    const dedupeKey = `${bucket.dist_km}|${event_date}|${start_time || ''}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const rawName = eventName;
    const { canonical, stripped } = stripSponsor(rawName);
    const aliases = stripped ? [rawName, canonical] : [rawName];

    rows.push({
      name: canonical || rawName,
      aliases, city, country, country_iso2: iso2,
      year: ymd.year, month: ymd.month, day: ymd.day,
      event_date, start_time,
      dist: bucket.dist, dist_km: bucket.dist_km, type: bucket.type,
      discipline: 'running',
      source_site: 'worldsmarathons.com',
      source_url: url,
      _wm: { raceName: r.raceName, distance: r.distance, distanceStr: r.distanceStr, type: r.type },
    });
  }
  return rows;
}

(async () => {
  const failedPath = resolve(OUT_DIR, 'worldsmarathons-failed.json');
  const acceptedPath = resolve(OUT_DIR, 'worldsmarathons.json');
  const failed = JSON.parse(await readFile(failedPath, 'utf8'));
  const accepted = JSON.parse(await readFile(acceptedPath, 'utf8'));
  console.error(`[retry] failed urls: ${failed.length}`);
  console.error(`[retry] existing accepted rows: ${accepted.length}`);
  if (failed.length === 0) return;

  const CONCURRENCY = 2;
  const POLITE_DELAY_MS = 2500;

  const stillFailed = [];
  let recovered = 0;
  let i = 0;

  async function worker() {
    while (i < failed.length) {
      const idx = i++;
      const item = failed[idx];
      const url = item.url;
      try {
        const html = await fetchText(url);
        const rows = parseEvent(html, url);
        if (rows.length) {
          accepted.push(...rows);
          recovered++;
        }
      } catch (e) {
        stillFailed.push({ url, error: String(e?.message || e) });
      }
      if ((idx + 1) % 20 === 0 || idx === failed.length - 1) {
        console.error(`[retry] ${idx + 1}/${failed.length}  recovered=${recovered}  stillFailed=${stillFailed.length}`);
      }
      await sleep(POLITE_DELAY_MS);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  await writeFile(acceptedPath, JSON.stringify(accepted, null, 2));
  await writeFile(failedPath, JSON.stringify(stillFailed, null, 2));
  console.error('---');
  console.error(`[retry] urls recovered:    ${recovered}`);
  console.error(`[retry] urls still failed: ${stillFailed.length}`);
  console.error(`[retry] accepted rows now: ${accepted.length}`);
})().catch((e) => {
  console.error('[retry] fatal:', e);
  process.exit(1);
});

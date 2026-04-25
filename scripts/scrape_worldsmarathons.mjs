#!/usr/bin/env node
// World's Marathons scraper — sitemap walker + JSON-LD parser.
// Usage:
//   node scripts/scrape_worldsmarathons.mjs --sample 50
//   node scripts/scrape_worldsmarathons.mjs           (full run, ~7K events)
//
// Output:
//   scripts/out/worldsmarathons.json          accepted rows (one per matched distance)
//   scripts/out/worldsmarathons-skipped.json  events with no resolvable date
//   scripts/out/worldsmarathons-failed.json   network/parse errors per URL

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, 'out');

const SITEMAP_URL = 'https://worldsmarathons.com/marathons-sitemap-en.xml';
// Rotate through a few realistic desktop UAs to dilute bot fingerprint heuristics.
const UAS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];
const pickUA = () => UAS[Math.floor(Math.random() * UAS.length)];
// Throughput-tuned profile: 403s never clear with quick retries, only with much longer cooldown.
// Better to fail fast on 403, accumulate to a retry pass at the end with longer per-request waits.
const CONCURRENCY = 8;
const POLITE_DELAY_MS = 250;
const MAX_RETRIES_NETWORK = 2;       // genuine network errors / 5xx
const MAX_RETRIES_BOT_BLOCK = 1;     // 403s — one quick retry with backoff, then defer to retry pass

// Distance buckets (meters) per plan: 10K, half, full marathon.
const DIST_BUCKETS = [
  { min: 9900, max: 10100, dist_km: 10, dist: '10K', type: '10K' },
  { min: 21000, max: 21200, dist_km: 21.1, dist: 'Half Marathon', type: 'Half Marathon' },
  { min: 42100, max: 42300, dist_km: 42.195, dist: 'Marathon', type: 'Marathon' },
];

// ISO-2 → canonical full country name (storage-form, matches existing catalog convention).
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

// Sponsor prefix list — single-token brand names only. Token-stripped iff the leading token
// is in this list AND not a known city/region. City/airline names are intentionally excluded
// because they often appear as part of the canonical race name (e.g. "Cebu Marathon",
// "China Airlines Half Marathon" where "Cebu"/"China" is the geography).
//
// Add a brand here only if (a) it's a known race title sponsor, and (b) the token is unlikely
// to be the geographic anchor of any race name.
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

// Multi-token sponsor phrases — matched whole (longest first) before single-token loop.
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
        'pragma': 'no-cache',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
      },
    });
    if (res.status === 403) {
      // Bot-block — quick single retry then defer to retry pass.
      if (attempt <= MAX_RETRIES_BOT_BLOCK) {
        await sleep(800 + Math.random() * 400);
        return fetchText(url, attempt + 1);
      }
      throw new Error('status 403');
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt <= MAX_RETRIES_NETWORK) {
        const wait = (1000 * Math.pow(2, attempt - 1)) + Math.random() * 500;
        await sleep(wait);
        return fetchText(url, attempt + 1);
      }
      throw new Error(`status ${res.status}`);
    }
    if (!res.ok) throw new Error(`status ${res.status}`);
    return await res.text();
  } catch (e) {
    if (attempt <= MAX_RETRIES_NETWORK && !/status 403/.test(String(e?.message || e))) {
      await sleep(500 * attempt);
      return fetchText(url, attempt + 1);
    }
    throw e;
  }
}

async function fetchSitemap() {
  const xml = await fetchText(SITEMAP_URL);
  const urls = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    urls.push(m[1].trim());
  }
  return urls;
}

// JSON-LD `Event` block extractor: finds the Event-typed block among multiple ld+json scripts.
function parseEventLd(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const b of blocks) {
    const raw = b[1].trim();
    try {
      const obj = JSON.parse(raw);
      if (obj && obj['@type'] === 'Event') return obj;
    } catch {
      // ignore
    }
  }
  return null;
}

// Extract per-distance objects from inline JSON. They share the shape:
// {"raceName":"...","distance":N,"type":"...","startDateTime":"YYYY-MM-DDTHH:MM:SS"|null,"distanceStr":"...","distanceId":"..."}
function parseRaceObjects(html) {
  const out = [];
  const re = /\{"raceName":"[^"]+","distance":[0-9.]+[^{}]*?"distanceId":"[^"]+","hidden":(?:true|false),"measureType":[0-9]+\}/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const obj = JSON.parse(m[0]);
      out.push(obj);
    } catch {
      // ignore
    }
  }
  return out;
}

function bucketFor(distanceMeters) {
  for (const b of DIST_BUCKETS) {
    if (distanceMeters >= b.min && distanceMeters <= b.max) return b;
  }
  return null;
}

function tokensOf(name) {
  return name.trim().split(/\s+/);
}

// Strip leading sponsor tokens. Returns the canonical name (sponsor-stripped) plus the raw input.
function stripSponsor(name) {
  if (!name) return { canonical: name, stripped: false };
  let s = name.trim();
  // Try multi-token phrases first (longest first)
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
    if (toks.length === 0) break;
    const head = toks[0].toLowerCase().replace(/[^a-z0-9'-]/g, '');
    if (SPONSOR_PREFIXES.includes(head)) {
      s = toks.slice(1).join(' ');
      stripped = true;
    } else {
      break;
    }
  }
  // Strip trailing year token (e.g. "Berlin Marathon 2025")
  s = s.replace(/\s+(19|20)\d{2}\s*$/, '').trim();
  return { canonical: s || name, stripped };
}

function ymdFromDate(iso) {
  // iso = YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return { year: +m[1], month: +m[2], day: +m[3] };
}

function timeFromDateTime(iso) {
  if (!iso) return null;
  const m = iso.match(/T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return `${m[1]}:${m[2]}:${m[3] ?? '00'}`;
}

async function processEventUrl(url) {
  const html = await fetchText(url);
  const ld = parseEventLd(html);
  if (!ld) return { rows: [], skipped: { url, reason: 'no_ld_event' } };

  const eventName = (ld.name || '').trim();
  const eventStart = ld.startDate || null;
  const city = ld.location?.address?.addressLocality?.trim() || null;
  const iso2 = ld.location?.address?.addressCountry?.trim().toUpperCase() || null;
  const country = iso2 ? (ISO_TO_COUNTRY[iso2] || null) : null;

  const races = parseRaceObjects(html);
  const rows = [];
  const dropped = [];
  // Per-event dedupe: collapse multiple raceName objects that resolve to the same
  // (dist_km, event_date, start_time) to a single row. WM lists "Marathon", "Wheelchair
  // Marathon", "Marathon Relay" all at 42195m — for catalog purposes we only want one.
  const seen = new Set();

  for (const r of races) {
    const bucket = bucketFor(r.distance);
    if (!bucket) continue;

    // Determine date and start time:
    //   Prefer per-distance startDateTime when present; else fall back to event.startDate (no time).
    const sdt = r.startDateTime || null;
    const ymd = sdt ? ymdFromDate(sdt) : (eventStart ? ymdFromDate(eventStart) : null);
    if (!ymd) {
      dropped.push({ url, reason: 'no_resolvable_date', raceName: r.raceName, distance: r.distance });
      continue;
    }
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
      aliases,
      city,
      country,
      country_iso2: iso2,
      year: ymd.year,
      month: ymd.month,
      day: ymd.day,
      event_date,
      start_time,
      dist: bucket.dist,
      dist_km: bucket.dist_km,
      type: bucket.type,
      discipline: 'running',
      source_site: 'worldsmarathons.com',
      source_url: url,
      // Source-side raw distance for audit
      _wm: { raceName: r.raceName, distance: r.distance, distanceStr: r.distanceStr, type: r.type },
    });
  }

  return { rows, skipped: dropped.length ? { url, reason: 'partial_drops', drops: dropped } : null };
}

async function pool(items, fn, concurrency) {
  const results = [];
  let i = 0;
  let active = 0;
  return new Promise((resolveAll, rejectAll) => {
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
            // Polite delay between requests on the same worker slot.
            setTimeout(next, POLITE_DELAY_MS);
          });
      }
    };
    next();
  });
}

(async () => {
  await mkdir(OUT_DIR, { recursive: true });
  console.error('[wm] fetching sitemap…');
  let urls = await fetchSitemap();
  console.error(`[wm] sitemap urls: ${urls.length}`);

  if (sampleN && Number.isFinite(sampleN)) {
    urls = urls.slice(0, sampleN);
    console.error(`[wm] sample mode: limiting to first ${urls.length} urls`);
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
      if (processed % 50 === 0 || processed === urls.length) {
        console.error(`[wm] ${processed}/${urls.length}  accepted_rows=${accepted.length}  skipped=${skipped.length}  failed=${failed.length}`);
      }
    }
  }, CONCURRENCY);

  await writeFile(resolve(OUT_DIR, 'worldsmarathons.json'), JSON.stringify(accepted, null, 2));
  await writeFile(resolve(OUT_DIR, 'worldsmarathons-skipped.json'), JSON.stringify(skipped, null, 2));
  await writeFile(resolve(OUT_DIR, 'worldsmarathons-failed.json'), JSON.stringify(failed, null, 2));

  // Summary
  const byBucket = { '10K': 0, 'Half Marathon': 0, 'Marathon': 0 };
  for (const r of accepted) byBucket[r.type] = (byBucket[r.type] || 0) + 1;
  const missingCountry = accepted.filter((r) => !r.country).length;

  console.error('---');
  console.error(`[wm] accepted rows: ${accepted.length}`);
  console.error(`[wm]   10K:           ${byBucket['10K']}`);
  console.error(`[wm]   Half Marathon: ${byBucket['Half Marathon']}`);
  console.error(`[wm]   Marathon:      ${byBucket['Marathon']}`);
  console.error(`[wm] skipped events:  ${skipped.length}  (no_ld_event or no_resolvable_date)`);
  console.error(`[wm] failed urls:     ${failed.length}`);
  console.error(`[wm] missing country: ${missingCountry}  (iso2 not in ISO_TO_COUNTRY map)`);
  console.error(`[wm] outputs in:      ${OUT_DIR}`);
})().catch((e) => {
  console.error('[wm] fatal:', e);
  process.exit(1);
});

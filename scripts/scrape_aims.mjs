#!/usr/bin/env node
// AIMS (Association of International Marathons and Distance Races) scraper.
//
// Usage:
//   node scripts/scrape_aims.mjs --sample 30
//   node scripts/scrape_aims.mjs           (full run, ~376 events × all historical editions)
//
// Output:
//   scripts/out/aims.json          accepted rows (one per (event, year, distance))
//   scripts/out/aims-skipped.json  events with no parseable distance
//   scripts/out/aims-failed.json   network/parse errors per URL
//
// Pipeline:
// 1. Fetch iCal feed at https://aims-worldrunning.org/events.ics — gives us
//    event UIDs (race ids) + future date + LOCATION + URL. ~376 events.
// 2. For each event id, fetch /races/<id>.html which lists ALL past editions
//    with per-edition name + date. Many AIMS events have decade+ of history.
// 3. For each historical edition, parse name for distance hint:
//    - "Marathon" (no "Half") → 42.195 km
//    - "Half" / "Half Marathon" → 21.1 km
//    - "10K" / "10km" → 10 km
//    - "Ultra" → SKIPPED (no exact km)
//    Other distances dropped.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, 'out');

const CALENDAR_URL = 'https://aims-worldrunning.org/calendar.html';
const ICAL_URL = 'https://aims-worldrunning.org/events.ics';
const RACE_PAGE = (id) => `https://www.aims-worldrunning.org/races/${id}.html`;

const UAS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];
const pickUA = () => UAS[Math.floor(Math.random() * UAS.length)];
const CONCURRENCY = 6;
const POLITE_DELAY_MS = 200;
const MAX_RETRIES = 2;

// AIMS country names ↔ catalog canonical names.
// AIMS sometimes uses local-language country names (e.g. Türkiye, U.S.A.).
const COUNTRY_REWRITES = new Map([
  ['türkiye', 'Turkey'],
  ['turkiye', 'Turkey'],
  ['u.s.a.', 'United States'],
  ['usa', 'United States'],
  ['united states of america', 'United States'],
  ['uk', 'United Kingdom'],
  ['great britain', 'United Kingdom'],
  ['england', 'United Kingdom'],
  ['scotland', 'United Kingdom'],
  ['wales', 'United Kingdom'],
  ['northern ireland', 'United Kingdom'],
  ['hong kong sar', 'Hong Kong'],
  ['hong kong, china', 'Hong Kong'],
  ['chinese taipei', 'Taiwan'],
  ['russia', 'Russia'],
  ['russian federation', 'Russia'],
  ['south korea', 'South Korea'],
  ['korea', 'South Korea'],
  ['korea, republic of', 'South Korea'],
  ['czech republic', 'Czech Republic'],
  ['czechia', 'Czech Republic'],
  ['ivory coast', "Côte d'Ivoire"],
]);

// Race-name city heuristic — strip common running tokens, take longest remaining capitalized token.
const NAME_NOISE = new Set([
  'marathon', 'half', 'halbmarathon', 'maratona', 'maratón', 'maraton', 'maratonu', 'półmaraton', 'półmarathon',
  'run', 'runs', 'race', 'racing', 'ultra', 'ultramarathon', 'mile', 'miler',
  'international', 'classic', 'open', 'series', 'cup', 'world', 'national', 'city',
  'street', 'park', 'beach', 'lake', 'river', 'mountain', 'island',
  'spring', 'summer', 'fall', 'autumn', 'winter', 'night', 'day', 'sunrise', 'sunset',
  'memorial', 'anniversary', 'jubilee', 'edition', 'festival', 'event', 'meeting',
  'the', 'of', 'on', 'in', 'for', 'and', '&', 'a', 'an',
  'wine', 'craft', 'beer', 'food', 'art', 'music', 'cultural',
  'mens', "men's", 'women', "women's", 'kids', 'family', 'fun', 'charity',
  'historic', 'royal', 'grand', 'great', 'golden', 'silver', 'crystal', 'platinum',
  'speed', 'fast', 'flat', 'hilly', 'scenic', 'desert', 'forest', 'oasis',
  'eco', 'green', 'blue', 'red', 'black', 'white',
  '5k', '10k', '21k', '42k', '5km', '10km', '21km', '42km', 'k', 'km',
  'presented', 'by', 'sponsored', 'official',
  'pko', 'tcs', 'bmw', 'asics', 'nn', 'edp', 'aramco', 'mtb', 'au', 'mg',
  'alexander', 'great', 'ochsner', 'samsung', 'standard', 'chartered', 'mizuno',
]);
function cityFromName(name) {
  if (!name) return null;
  const toks = String(name)
    .replace(/[‘’']/g, "'")
    .replace(/[–—]/g, '-')
    .split(/[\s,–\-:;\(\)\[\]\/\\.]+/)
    .filter(Boolean);
  const candidates = [];
  for (const t of toks) {
    const cleaned = t.replace(/[^A-Za-zÀ-ỳ'\-]/g, '');
    if (cleaned.length < 3) continue;
    if (!/^[A-ZÀ-Þ]/.test(cleaned)) continue;
    if (NAME_NOISE.has(cleaned.toLowerCase())) continue;
    if (/^(20|19)\d{2}$/.test(cleaned)) continue;
    candidates.push(cleaned);
  }
  if (!candidates.length) return null;
  // Take longest candidate — city names tend to be longer than sponsor abbreviations.
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}

function canonicalCountry(raw) {
  if (!raw) return null;
  const k = String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
  return COUNTRY_REWRITES.get(k) || raw.trim();
}

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

// Parse iCal-encoded value. Strip backslash-escapes (\, → ,).
function ical(line) {
  return line.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n');
}

// Returns { uid, location, summary, url, dtstart } per VEVENT.
async function fetchICal() {
  const text = await fetchText(ICAL_URL);
  const lines = text.split(/\r?\n/);
  const unfolded = [];
  for (const ln of lines) {
    if (ln.startsWith(' ') || ln.startsWith('\t')) {
      if (unfolded.length) unfolded[unfolded.length - 1] += ln.slice(1);
    } else unfolded.push(ln);
  }
  const events = [];
  let cur = null;
  for (const ln of unfolded) {
    if (ln.startsWith('BEGIN:VEVENT')) cur = {};
    else if (ln.startsWith('END:VEVENT')) { if (cur) events.push(cur); cur = null; }
    else if (cur) {
      const i = ln.indexOf(':');
      if (i < 0) continue;
      const key = ln.slice(0, i).split(';')[0];
      const val = ical(ln.slice(i + 1));
      cur[key] = val;
    }
  }
  return events;
}

// Calendar.html groups by month — each <div class="calendar-item"> has the next-edition
// event id (in the .ics anchor) PLUS the race-series ID (in the /races/<id>.html link).
// We need the race-series ID to load the page that lists historical editions.
//
// Returns array of { eventId, raceId, eventName, localName, location } unique by raceId.
async function fetchCalendar() {
  const html = await fetchText(CALENDAR_URL);
  // Each item: <div class="calendar-item"> ... title="6755" href=".../events/6755.ics" ... href=".../races/1003.html">Race Name</a>
  const items = [];
  const seen = new Set();
  const itemRe = /<div class="calendar-item">([\s\S]*?)(?=<div class="calendar-item">|<h3 class="calendar-month-header"|<\/div>\s*<\/div>\s*<a name=)/g;
  let m;
  while ((m = itemRe.exec(html)) !== null) {
    const block = m[1];
    const idM = block.match(/href="https?:\/\/www\.aims-worldrunning\.org\/races\/(\d+)\.html"/);
    if (!idM) continue;
    const raceId = idM[1];
    if (seen.has(raceId)) continue;
    seen.add(raceId);
    const eventIdM = block.match(/title="(\d+)"/);
    const nameM = block.match(/<a href="https?:\/\/www\.aims-worldrunning\.org\/races\/\d+\.html">([^<]+)<\/a>/);
    items.push({
      raceId,
      eventId: eventIdM?.[1] ?? null,
      eventName: nameM?.[1]?.trim() ?? null,
    });
  }
  return items;
}

// Distance parser — looks at edition name for hints. Returns array of {dist_km, dist, type}.
// One name can yield multiple distance rows ("Marathon (Half + 10km)" → both half and 10K).
function parseDistances(name) {
  if (!name) return [];
  const lc = name.toLowerCase();
  const out = [];
  const has = (re) => re.test(lc);
  // 10K (look for "10k"/"10km"/"10-km")
  if (has(/\b10\s*[-]?\s*k(m)?\b/)) {
    out.push({ dist_km: 10, dist: '10K', type: '10K' });
  }
  // Half marathon
  if (has(/\bhalf\b/) || has(/\bhalf-?marathon\b/)) {
    out.push({ dist_km: 21.1, dist: 'Half Marathon', type: 'Half Marathon' });
  }
  // Marathon (full) — only if NOT preceded by "Half" / "Mini" / "Quarter" / "Wheelchair"
  // and not part of "ultramarathon"
  if (
    has(/\bmarathon\b/) &&
    !has(/\bhalf\s*marathon\b/) &&
    !has(/\bmini\s*marathon\b/) &&
    !has(/\bquarter\s*marathon\b/) &&
    !has(/\bultra\s*marathon\b/) &&
    !has(/\bultra-?marathon\b/)
  ) {
    out.push({ dist_km: 42.195, dist: 'Marathon', type: 'Marathon' });
  }
  return out;
}

function monthNum(s) {
  const m = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  return m[String(s).slice(0, 3).toLowerCase()] || null;
}

// Parse a race page's past-events block. Returns array of {year, month, day, name}.
function parseRacePage(html) {
  // Find country + AIMS distance codes from header line "Country | M,H,R | Full member of AIMS"
  let country = null;
  let codes = [];
  const headerMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>\s*<p[^>]*>([\s\S]*?)<\/p>/);
  if (headerMatch) {
    // Try to find the country block — header structure varies.
  }
  // Pattern: <h2 class="race-page-subheader">Local Name | <a href="...countries/N.html">Country</a> | M,H,R | Full member of AIMS</h2>
  const meta = html.match(/<a[^>]+countries\/\d+\.html"[^>]*>([^<]+)<\/a>\s*\|\s*([MHRUC,\s]+)\s*\|\s*Full member of AIMS/);
  if (meta) {
    country = meta[1].trim();
    codes = meta[2].split(',').map((s) => s.trim()).filter(Boolean);
  } else {
    // Fallback: just the codes
    const codeOnly = html.match(/\|\s*([MHRUC,\s]+)\s*\|\s*Full member of AIMS/);
    if (codeOnly) codes = codeOnly[1].split(',').map((s) => s.trim()).filter(Boolean);
    const countryOnly = html.match(/<a[^>]+countries\/\d+\.html"[^>]*>([^<]+)<\/a>/);
    if (countryOnly) country = countryOnly[1].trim();
  }

  // City extraction from contact-details block.
  // AIMS pages put a postal address in #contact-details. Pattern is usually
  // "<postal-code> <City>" on its own line, sometimes followed by ", <Country>"
  // or "<State>". Look for the most likely city.
  let pageCity = null;
  const contactM = html.match(/Contact details([\s\S]+?)(?:Race director|Twitter:|Tel:|E:|Phone:|<\/div>|$)/);
  if (contactM) {
    const block = contactM[1].replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
    // Match "<digits> <City>" — city is letters (with diacritics, hyphens, spaces)
    const lines = block.split(/\n/).map((s) => s.trim()).filter(Boolean);
    for (const ln of lines) {
      // Dutch postal: "3068 AZ Rotterdam" → strip "AZ" code, keep "Rotterdam"
      const mNL = ln.match(/^\d{4}\s+[A-Z]{2}\s+([A-Za-zÀ-ỳ'\-\.\s]{2,40})$/);
      if (mNL) { pageCity = mNL[1].trim(); break; }
      // Standard postal + city: "07200 Antalya", "5003 Bergen", "I-37100 Verona"
      const m1 = ln.match(/^[A-Z]{0,2}-?\d{3,6}\s+([A-Za-zÀ-ỳ'\-\.\s]{2,40})$/);
      if (m1) { pageCity = m1[1].trim(); break; }
      // City (Province)
      const m2 = ln.match(/^([A-Za-zÀ-ỳ'\-\.\s]{3,40})\s*\([^\)]+\)\s*$/);
      if (m2) { pageCity = m2[1].trim(); break; }
    }
    // Strip trailing country tokens that crept in (e.g. "Rotterdam, Netherlands")
    if (pageCity) pageCity = pageCity.split(/[,]/)[0].trim();
  }
  // Past editions block: each edition is `<p>Day name <br> Sun  D Month YYYY</p>` style — but the dump we saw was simpler.
  // Pattern in dump: "5\nRuntalya Marathon\nSun  5 April 2026\nPlease consult..."
  // Strip tags first then regex on text.
  const stripped = html
    .replace(/<script[^>]*>.*?<\/script>/gs, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#039;|&apos;/g, "'");
  const editions = [];
  const re = /(?:^|\n)\s*([A-Z][^\n]{2,})\n\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b/g;
  let m;
  while ((m = re.exec(stripped)) !== null) {
    const name = m[1].trim();
    const day = +m[2];
    const month = monthNum(m[3]);
    const year = +m[4];
    if (!month || !year) continue;
    if (name.toLowerCase().includes('please consult')) continue;
    editions.push({ name, year, month, day });
  }
  return { country, codes, editions, pageCity };
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

const args = process.argv.slice(2);
const sampleN = (() => {
  const i = args.indexOf('--sample');
  if (i >= 0 && args[i + 1]) return parseInt(args[i + 1], 10);
  return null;
})();

(async () => {
  await mkdir(OUT_DIR, { recursive: true });
  console.error('[aims] fetching calendar.html for race-series IDs…');
  const calendarItems = await fetchCalendar();
  console.error(`[aims] unique race-series ids: ${calendarItems.length}`);

  console.error('[aims] fetching iCal for location data…');
  const icalEvents = await fetchICal();
  // Map: eventId → LOCATION
  const eventIdToLocation = new Map();
  for (const ev of icalEvents) {
    const eid = (ev.UID || '').match(/aims-worldrunning\.org-(\d+)/)?.[1];
    if (eid) eventIdToLocation.set(eid, ev.LOCATION || null);
  }

  let workItems = calendarItems;
  if (sampleN && Number.isFinite(sampleN)) {
    workItems = calendarItems.slice(0, sampleN);
    console.error(`[aims] sample mode: limiting to first ${workItems.length} race series`);
  }

  const accepted = [];
  const skipped = [];
  const failed = [];
  let processed = 0;

  await pool(workItems, async (item) => {
    const url = RACE_PAGE(item.raceId);
    try {
      const html = await fetchText(url);
      const { country: pageCountry, codes, editions, pageCity } = parseRacePage(html);

      // City precedence:
      //   1. iCal LOCATION first part (most authoritative — matches event instance)
      //   2. Race name token heuristic (catches "Pardubice Wine Half Marathon" → Pardubice)
      //   3. Race-page contact-block city (fragile — different city sometimes)
      const location = item.eventId ? eventIdToLocation.get(item.eventId) : null;
      let city = null;
      let icalCountry = null;
      if (location) {
        const parts = location.split(',').map((s) => s.trim()).filter(Boolean);
        if (parts.length >= 2) {
          city = parts[0];
          icalCountry = parts[parts.length - 1];
        } else if (parts.length === 1) {
          icalCountry = parts[0];
        }
      }
      // Race name often has the city anchor ("Pardubice Wine Half Marathon"). Try this
      // before the contact-block parse — contact addresses often point to the organizer's
      // office, which can be a different city from the race city.
      if (!city) city = cityFromName(item.eventName);
      if (!city && pageCity) city = pageCity;
      const country = canonicalCountry(pageCountry || icalCountry);

      const eventName = item.eventName || '';
      let editionRows = 0;
      for (const ed of editions) {
        const dists = parseDistances(ed.name);
        if (dists.length === 0) continue;
        for (const d of dists) {
          const event_date = `${ed.year}-${String(ed.month).padStart(2, '0')}-${String(ed.day).padStart(2, '0')}`;
          accepted.push({
            name: ed.name,
            aliases: eventName && eventName !== ed.name ? [eventName, ed.name] : [ed.name],
            city,
            country,
            country_iso2: null,
            year: ed.year,
            month: ed.month,
            day: ed.day,
            event_date,
            start_time: null,
            dist: d.dist,
            dist_km: d.dist_km,
            type: d.type,
            discipline: 'running',
            source_site: 'aims-worldrunning.org',
            source_url: url,
            _aims: { raceId: item.raceId, eventId: item.eventId, codes, eventName },
          });
          editionRows++;
        }
      }
      if (editionRows === 0) {
        skipped.push({ raceId: item.raceId, url, reason: 'no_distance_match', codes, editions: editions.length });
      }
    } catch (e) {
      failed.push({ raceId: item.raceId, url, error: String(e?.message || e) });
    } finally {
      processed++;
      if (processed % 25 === 0 || processed === workItems.length) {
        console.error(`[aims] ${processed}/${workItems.length}  rows=${accepted.length}  skipped=${skipped.length}  failed=${failed.length}`);
      }
    }
  }, CONCURRENCY);

  await writeFile(resolve(OUT_DIR, 'aims.json'), JSON.stringify(accepted, null, 2));
  await writeFile(resolve(OUT_DIR, 'aims-skipped.json'), JSON.stringify(skipped, null, 2));
  await writeFile(resolve(OUT_DIR, 'aims-failed.json'), JSON.stringify(failed, null, 2));

  const byBucket = { '10K': 0, 'Half Marathon': 0, 'Marathon': 0 };
  for (const r of accepted) byBucket[r.type] = (byBucket[r.type] || 0) + 1;
  const yearMin = accepted.length ? Math.min(...accepted.map((r) => r.year)) : null;
  const yearMax = accepted.length ? Math.max(...accepted.map((r) => r.year)) : null;
  const missingCity = accepted.filter((r) => !r.city).length;
  const missingCountry = accepted.filter((r) => !r.country).length;

  console.error('---');
  console.error(`[aims] accepted rows:   ${accepted.length}`);
  console.error(`[aims]   10K:           ${byBucket['10K']}`);
  console.error(`[aims]   Half Marathon: ${byBucket['Half Marathon']}`);
  console.error(`[aims]   Marathon:      ${byBucket['Marathon']}`);
  console.error(`[aims] year range:      ${yearMin} – ${yearMax}`);
  console.error(`[aims] skipped events:  ${skipped.length}`);
  console.error(`[aims] failed urls:     ${failed.length}`);
  console.error(`[aims] missing city:    ${missingCity}`);
  console.error(`[aims] missing country: ${missingCountry}`);
  console.error(`[aims] outputs in:      ${OUT_DIR}`);
})().catch((e) => {
  console.error('[aims] fatal:', e);
  process.exit(1);
});

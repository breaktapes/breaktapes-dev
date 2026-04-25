#!/usr/bin/env node
// Dedupe World's Marathons scrape against the live race_catalog table.
//
// Usage:
//   SUPABASE_URL=https://xxx.supabase.co \
//   SUPABASE_ANON_KEY=sb_publishable_xxx \
//   node scripts/dedupe_worldsmarathons.mjs
//
//   Optional: SUPABASE_TARGET=staging|prod  (just a label, key drives target)
//
// Inputs:
//   scripts/out/worldsmarathons.json   (from Phase 1 scrape)
//
// Outputs:
//   scripts/out/dupes_exact.json   exact matches by (normName, normCity, year, distRounded)
//   scripts/out/dupes_fuzzy.json   Levenshtein <= 3 + same city/year/dist matches
//   scripts/out/dupes_fuzzy.csv    side-by-side review-friendly CSV
//   scripts/out/new_rows.json      rows with no match — to insert
//
// Counts printed to stderr. Heavy lifting is local — only one HTTP fetch.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, 'out');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const LOCAL_SNAPSHOT = resolve(__dirname, 'out', 'catalog_snapshot.json');
const useSnapshot = !SUPABASE_URL || !SUPABASE_ANON_KEY;
if (useSnapshot) {
  console.error(`[dedupe] no SUPABASE_URL/ANON_KEY env — using local snapshot ${LOCAL_SNAPSHOT}`);
}

const PAGE = 1000;
const COLS = 'id,name,aliases,city,country,year,month,day,dist_km';

// Diacritic-stripping normalize. The combining marks block is U+0300..U+036F.
function stripDiacritics(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Sponsor list — keep in sync with scrape_worldsmarathons.mjs SPONSOR_PREFIXES.
// We re-strip on existing catalog rows too so a row stored as "BMW Berlin Marathon"
// matches an incoming "Berlin Marathon".
const SPONSOR_PREFIXES = new Set([
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
]);

const SPONSOR_PHRASES = [
  'standard chartered', 'bank of america', 'first abu dhabi', 'emirates nbd',
  'sony pictures', 'lions gate', 'rock n roll', "rock 'n' roll", "rock'n'roll",
];

function normalizeName(name) {
  if (!name) return '';
  let s = stripDiacritics(String(name)).trim();
  // Strip multi-token phrases first (longest first)
  const phrases = [...SPONSOR_PHRASES].sort((a, b) => b.length - a.length);
  let guard = 0;
  while (guard++ < 8) {
    let advanced = false;
    const lower = s.toLowerCase();
    for (const p of phrases) {
      if (lower.startsWith(p + ' ')) {
        s = s.slice(p.length + 1);
        advanced = true;
        break;
      }
    }
    if (advanced) continue;
    const toks = s.trim().split(/\s+/);
    if (!toks.length) break;
    const head = toks[0].toLowerCase().replace(/[^a-z0-9'-]/g, '');
    if (SPONSOR_PREFIXES.has(head)) {
      s = toks.slice(1).join(' ');
    } else {
      break;
    }
  }
  // Strip trailing year token
  s = s.replace(/\s+(19|20)\d{2}\s*$/, '').trim();
  // Lowercase, collapse whitespace, strip punctuation
  s = s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

function normalizeCity(city) {
  if (!city) return '';
  return stripDiacritics(String(city)).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  // Quick reject by length diff
  if (Math.abs(a.length - b.length) > 4) return Math.abs(a.length - b.length);
  const prev = new Array(b.length + 1);
  const cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

async function fetchAllCatalogRows() {
  if (useSnapshot) {
    const raw = await readFile(LOCAL_SNAPSHOT, 'utf8');
    return JSON.parse(raw);
  }
  const all = [];
  for (let from = 0; from < 50000; from += PAGE) {
    const url = `${SUPABASE_URL}/rest/v1/race_catalog?select=${COLS}&order=id.asc`;
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      range: `${from}-${from + PAGE - 1}`,
      'range-unit': 'items',
    };
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`catalog fetch failed: ${res.status} ${await res.text()}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

function distKey(km) {
  if (km == null || !Number.isFinite(+km)) return null;
  return Math.round(+km * 10) / 10;  // 21.097 → 21.1
}

(async () => {
  const scraped = JSON.parse(await readFile(resolve(OUT_DIR, 'worldsmarathons.json'), 'utf8'));
  console.error(`[dedupe] scraped rows in: ${scraped.length}`);

  console.error(`[dedupe] loading race_catalog ${useSnapshot ? '(from local snapshot)' : `from ${SUPABASE_URL}`}…`);
  const catalog = await fetchAllCatalogRows();
  console.error(`[dedupe] catalog rows: ${catalog.length}`);

  // Build exact-match index keyed on (normName, normCity, year, distKey)
  // Plus a fuzzy index keyed on (normCity, year, distKey) → list of {normName, raw}
  const exactIdx = new Map();
  const fuzzyIdx = new Map();
  for (const c of catalog) {
    const n = normalizeName(c.name);
    const ci = normalizeCity(c.city);
    const dk = distKey(c.dist_km);
    if (!n || !ci || c.year == null || dk == null) continue;
    const ek = `${n}|${ci}|${c.year}|${dk}`;
    exactIdx.set(ek, c);
    const fk = `${ci}|${c.year}|${dk}`;
    if (!fuzzyIdx.has(fk)) fuzzyIdx.set(fk, []);
    fuzzyIdx.get(fk).push({ normName: n, raw: c });
  }

  const exact = [];
  const fuzzy = [];
  const fresh = [];

  for (const r of scraped) {
    const n = normalizeName(r.name);
    const ci = normalizeCity(r.city);
    const dk = distKey(r.dist_km);
    if (!n || !ci || r.year == null || dk == null) {
      // Can't reliably match — push to fresh (let migration NOT EXISTS guard handle it)
      fresh.push(r);
      continue;
    }
    const ek = `${n}|${ci}|${r.year}|${dk}`;
    if (exactIdx.has(ek)) {
      exact.push({ scraped: r, catalog: exactIdx.get(ek) });
      continue;
    }
    // Fuzzy: same (city, year, dist) bucket, name within Lev <= 3
    const fk = `${ci}|${r.year}|${dk}`;
    const candidates = fuzzyIdx.get(fk) || [];
    let bestHit = null;
    let bestDist = 99;
    for (const c of candidates) {
      const d = levenshtein(n, c.normName);
      if (d <= 3 && d < bestDist) {
        bestDist = d;
        bestHit = c;
      }
    }
    if (bestHit) {
      fuzzy.push({ scraped: r, catalog: bestHit.raw, levDist: bestDist });
    } else {
      fresh.push(r);
    }
  }

  await writeFile(resolve(OUT_DIR, 'dupes_exact.json'), JSON.stringify(exact, null, 2));
  await writeFile(resolve(OUT_DIR, 'dupes_fuzzy.json'), JSON.stringify(fuzzy, null, 2));
  await writeFile(resolve(OUT_DIR, 'new_rows.json'), JSON.stringify(fresh, null, 2));

  // CSV for human review of fuzzy bucket
  const csvLines = ['lev,year,dist_km,city,scraped_name,catalog_name,catalog_id,scraped_url'];
  for (const f of fuzzy) {
    const fmt = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    csvLines.push([
      f.levDist,
      f.scraped.year,
      f.scraped.dist_km,
      fmt(f.scraped.city),
      fmt(f.scraped.name),
      fmt(f.catalog.name),
      f.catalog.id,
      fmt(f.scraped.source_url),
    ].join(','));
  }
  await writeFile(resolve(OUT_DIR, 'dupes_fuzzy.csv'), csvLines.join('\n'));

  console.error('---');
  console.error(`[dedupe] exact dupes:   ${exact.length}  (skip)`);
  console.error(`[dedupe] fuzzy dupes:   ${fuzzy.length}  (review dupes_fuzzy.csv)`);
  console.error(`[dedupe] new rows:      ${fresh.length}  (insert via migration)`);
  console.error(`[dedupe] outputs in:    ${OUT_DIR}`);
})().catch((e) => {
  console.error('[dedupe] fatal:', e);
  process.exit(1);
});

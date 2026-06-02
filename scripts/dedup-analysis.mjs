#!/usr/bin/env node
/**
 * dedup-analysis.mjs — compares the existing race_catalog IRONMAN/70.3/5150
 * rows against the crawled ironman_catalog.json, flags overlaps, and prints a
 * merge plan (what to INSERT new vs UPDATE-in-place to attach competitor_event_id).
 *
 * Usage: node scripts/dedup-analysis.mjs <existing-rows-tool-result.txt>
 */
import { readFileSync } from 'node:fs';

const EXISTING_FILE = process.argv[2];
const CRAWL_FILE = new URL('./ironman_catalog.json', import.meta.url).pathname;

// Extract the JSON array embedded in the saved tool-result file.
function loadExisting(path) {
  const raw = readFileSync(path, 'utf8');
  const outer = JSON.parse(raw);                 // { result: "...<untrusted>\n[...]\n</untrusted>..." }
  const s = outer.result;
  const start = s.indexOf('[');
  const end = s.lastIndexOf(']');
  return JSON.parse(s.slice(start, end + 1));
}

// Normalized match key: lowercase name (alnum + spaces only) + year.
const normName = (n) => (n || '')
  .toLowerCase()
  .replace(/[^a-z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const key = (name, year) => `${normName(name)}|${year || ''}`;

const existing = loadExisting(EXISTING_FILE);
const crawlRaw = JSON.parse(readFileSync(CRAWL_FILE, 'utf8'));
const crawl = crawlRaw.filter(r =>
  r.competitorEventId && r.date && r.distance && r.distance !== 'Unknown' && r.distance !== '4184');

// Index existing by key and by name-only (to catch year-mismatch near-dupes).
const existByKey = new Map();
const existByName = new Map();
for (const e of existing) {
  existByKey.set(key(e.name, e.year), e);
  const nn = normName(e.name);
  if (!existByName.has(nn)) existByName.set(nn, []);
  existByName.get(nn).push(e);
}

const overlaps = [];     // exact name+year match → UPDATE existing (attach competitor id)
const newRows = [];      // no match → INSERT
const nameOnly = [];     // same event name exists but different year (informational)

const crawlByKey = new Map();
for (const c of crawl) {
  const cName = c.name.replace(/^\d{4}\s+/, '');   // strip leading year as the loader does
  const k = key(cName, c.year);
  crawlByKey.set(k, c);
  if (existByKey.has(k)) {
    overlaps.push({ crawl: { name: cName, year: c.year, eid: c.competitorEventId }, existingId: existByKey.get(k).id });
  } else {
    newRows.push({ name: cName, year: c.year, dist: c.distance });
    if (existByName.has(normName(cName))) {
      nameOnly.push({ name: cName, crawlYear: c.year, existingYears: existByName.get(normName(cName)).map(e => e.year) });
    }
  }
}

// Existing IRONMAN rows the crawl did NOT cover (kept as-is, no competitor id).
const existingOnly = existing.filter(e => !crawlByKey.has(key(e.name, e.year)));

// Internal duplicate keys within crawl (should be none after dedupe).
const crawlKeyCounts = {};
for (const c of crawl) { const k = key(c.name.replace(/^\d{4}\s+/, ''), c.year); crawlKeyCounts[k] = (crawlKeyCounts[k] || 0) + 1; }
const crawlInternalDupes = Object.entries(crawlKeyCounts).filter(([, n]) => n > 1);

console.log('=== DEDUP ANALYSIS: ironman_catalog.json vs existing race_catalog ===\n');
console.log(`Existing IRONMAN/70.3/5150 rows in catalog : ${existing.length}`);
console.log(`Crawled loadable event-years              : ${crawl.length}\n`);
console.log(`OVERLAP (exact name+year → UPDATE in place): ${overlaps.length}`);
console.log(`NEW (no match → INSERT)                    : ${newRows.length}`);
console.log(`  └ of which same-event diff-year          : ${nameOnly.length}`);
console.log(`EXISTING-ONLY (crawl didn't cover)         : ${existingOnly.length}`);
console.log(`Crawl internal duplicate keys             : ${crawlInternalDupes.length}\n`);

console.log('--- sample OVERLAPS (will UPDATE existing, attach competitor_event_id) ---');
overlaps.slice(0, 12).forEach(o => console.log(`  [#${o.existingId}] ${o.crawl.name} ${o.crawl.year}`));

console.log('\n--- sample NEW rows (will INSERT) ---');
newRows.slice(0, 12).forEach(n => console.log(`  ${n.name} ${n.year} (${n.dist})`));

console.log('\n--- sample EXISTING-ONLY (catalog has, crawl missing) ---');
existingOnly.slice(0, 12).forEach(e => console.log(`  [#${e.id}] ${e.name} ${e.year ?? '?'}`));

// ── FUZZY HIDDEN-DUPE PASS ────────────────────────────────────────────────
// Exact name+year missed dupes where the SAME event-year is named differently
// (championship labels, "70.3" placement, etc.). Catch them via:
//   same year + same distance class + a shared meaningful location token.
const STOP = new Set(['ironman','70','3','5150','im','the','championship','asia','pacific','african','european','north','american','south','middle','east','presented','by','and','of','de','la','el']);
const distClass = (row, isCrawl) => {
  if (isCrawl) return row.distance;                          // 'IRONMAN'|'70.3'|'Olympic'
  const km = row.dist_km;
  if (km == null) {
    const n = (row.name || '').toLowerCase();
    if (n.includes('70.3')) return '70.3';
    if (n.includes('5150')) return 'Olympic';
    return 'IRONMAN';
  }
  if (Math.abs(km - 113) < 2) return '70.3';
  if (Math.abs(km - 51.5) < 3) return 'Olympic';
  if (Math.abs(km - 226) < 3) return 'IRONMAN';
  return 'IRONMAN';
};
const tokens = (n) => normName(n).split(' ').filter(t => t && !STOP.has(t) && t.length > 2);

// Index crawl-new by year for fuzzy lookup
const crawlNewByYear = new Map();
for (const c of crawl) {
  const cName = c.name.replace(/^\d{4}\s+/, '');
  if (existByKey.has(key(cName, c.year))) continue;  // already an exact overlap
  const y = c.year;
  if (!crawlNewByYear.has(y)) crawlNewByYear.set(y, []);
  crawlNewByYear.get(y).push({ name: cName, dist: c.distance, eid: c.competitorEventId, toks: tokens(cName) });
}

const suspects = [];
for (const e of existingOnly) {
  if (!e.year) continue;
  const cands = crawlNewByYear.get(e.year) || [];
  const eToks = new Set(tokens(e.name));
  const eDist = distClass(e, false);
  for (const c of cands) {
    if (c.dist !== eDist) continue;
    const shared = c.toks.filter(t => eToks.has(t));
    if (shared.length >= 1) {
      suspects.push({ existing: `[#${e.id}] ${e.name} ${e.year}`, crawl: `${c.name} (${c.dist})`, shared: shared.join(',') });
    }
  }
}

console.log(`\n=== FUZZY HIDDEN-DUPE SUSPECTS (same year+dist+location token, different name): ${suspects.length} ===`);
suspects.slice(0, 40).forEach(s => console.log(`  EXIST ${s.existing}\n    ~ CRAWL ${s.crawl}  [shared: ${s.shared}]`));

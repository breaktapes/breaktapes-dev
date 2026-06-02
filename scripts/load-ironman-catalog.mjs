#!/usr/bin/env node
/**
 * load-ironman-catalog.mjs
 *
 * MERGES crawled IRONMAN/70.3/5150 event-years (scripts/ironman_catalog.json)
 * into Supabase race_catalog WITHOUT creating duplicates.
 *
 * Dedupe strategy (see scripts/dedup-analysis.mjs for the audit):
 *   - Existing catalog tri rows have NULL competitor_event_id, so they will
 *     NOT collide on the unique index. Matching purely on competitor_event_id
 *     would therefore INSERT a second copy of every event the catalog already
 *     has (31 overlaps as of the 2026-06 audit). To prevent that:
 *       1. Fetch existing tri rows, key by normalized(name)+year.
 *       2. Crawl row matches an existing key  → UPDATE that row in place
 *          (attach competitor_event_id). No insert.
 *       3. Crawl row has no existing match     → INSERT.
 *   - Crawl rows are de-duplicated against each other by (name, year) first
 *     (resolves upstream artifacts like the double Port Macquarie 2011 entry).
 *   - Idempotent: re-runs UPDATE the same rows and the unique partial index on
 *     competitor_event_id stops duplicate inserts.
 *
 * Requires migration 20260602000000_race_catalog_competitor_event_id.sql first.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
 *     node scripts/load-ironman-catalog.mjs [catalogJson] [--dry-run]
 *
 *   STAGING:    https://yqzycwuyhvzkbofwkazr.supabase.co
 *   PRODUCTION: https://kmdpufauamadwavqsinj.supabase.co
 */

import { readFileSync } from 'node:fs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const DRY_RUN      = process.argv.includes('--dry-run');
const CATALOG_FILE = process.argv.find(a => a.endsWith('.json'))
  || new URL('./ironman_catalog.json', import.meta.url).pathname;
const BATCH = 200;

if (!DRY_RUN && (!SUPABASE_URL || !SERVICE_KEY)) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY required (or pass --dry-run).');
  process.exit(1);
}

const KM = { 'IRONMAN': 226, '70.3': 113, 'Olympic': 51.5 };
// Match the catalog's existing tri dist-label convention so IRONMAN rows display
// identically to the rest of the catalog (verified against race_catalog).
const DIST_LABEL = { 'IRONMAN': 'IRONMAN / Full Distance', '70.3': '70.3 / Middle Distance', 'Olympic': 'Olympic' };
const cityFromSlug = (slug) => (slug || '')
  .replace(/^(im703|im|5150|4184)-/, '')
  .split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').trim();

// Canonicalize an event name so all years of a race share ONE name (→ one
// year-pill group). Strips the leading year and REGIONAL championship labels
// that competitor.com embeds in some years' names ("IRONMAN Asia-Pacific
// Championship Cairns" → "IRONMAN Cairns"; "IRONMAN African Championship South
// Africa" → "IRONMAN South Africa"). Deliberately preserves "70.3" (decimal)
// and "World Championship" (a distinct event, not a regional label).
//
// When the championship label WAS the whole location ("IRONMAN European
// Championship" / "…Championship: Triathlon" — both are im-frankfurt), stripping
// leaves only the brand. In that case derive the location from the slug so the
// row unifies with the catalog's existing race for that venue (→ "IRONMAN
// Frankfurt"), instead of stranding it under a label nobody searches.
const CHAMP_RE = /\b(asia[- ]pacific|african|european|north american|south american|latin american|pan[- ]american|middle east|oceania|asia)\s+championship\b/gi;
const canonicalizeName = (n, slug) => {
  const base = (n || '').replace(/^\d{4}\s+/, '').trim();   // leading year
  const stripped = base.replace(CHAMP_RE, '');
  const champMatched = stripped !== base;
  let c = stripped.replace(/\s*:\s*/g, ' ').replace(/\s+/g, ' ').trim();
  if (champMatched) {
    // Rebuild "<BRAND> <location>"; if no real location remains, use the slug.
    const m = c.match(/^(IRONMAN(?:\s+70\.3)?)\b\s*(.*)$/i);
    if (m) {
      let loc = m[2].replace(/\btriathlon\b/gi, '').replace(/\s+/g, ' ').trim();
      if (!loc) loc = cityFromSlug(slug);
      c = `${m[1]} ${loc}`.replace(/\s+/g, ' ').trim();
    }
  }
  return c;
};
const catalogName = canonicalizeName;
const normName = (n) => (n || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const mkKey = (name, year) => `${normName(name)}|${year || ''}`;

// Build row. cityByName: normName(name) → established catalog city, so EVERY
// year of a race shares ONE city → the rows group into a single year-pill set
// (Boston/Comrades behavior: pick race → pick year → date auto-fills). Falls
// back to the slug-derived location for races the catalog has never seen.
function toRow(r, cityByName) {
  const [year, month, day] = (r.date || '').split('-').map(Number);
  const name = canonicalizeName(r.name, r.slug);
  const inherited = cityByName.get(normName(name));
  return {
    name,
    city: inherited || cityFromSlug(r.slug) || r.location || '',
    country: '',
    year: year || null,
    month: month || null,
    day: day || null,
    dist_km: KM[r.distance] ?? null,
    dist: DIST_LABEL[r.distance] || r.distance,
    type: 'tri',
    competitor_event_id: r.competitorEventId,
    _key: mkKey(name, year),
  };
}

async function rest(path, opts = {}) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!resp.ok) throw new Error(`${opts.method || 'GET'} ${path} → ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  return resp;
}

async function fetchExistingTri() {
  // All existing tri rows (covers IRONMAN/70.3/5150 + other tri brands).
  const rows = [];
  for (let page = 0; ; page++) {
    const resp = await rest(`race_catalog?select=id,name,city,year,competitor_event_id&type=eq.tri&order=id&offset=${page * 1000}&limit=1000`);
    const batch = await resp.json();
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  return rows;
}

// normName(name) → most-common non-empty city among existing rows for that race.
function buildCityByName(existing) {
  const counts = new Map();   // key → Map(city → n)
  for (const e of existing) {
    if (!e.city) continue;
    const k = normName(e.name);
    if (!counts.has(k)) counts.set(k, new Map());
    const m = counts.get(k);
    m.set(e.city, (m.get(e.city) || 0) + 1);
  }
  const out = new Map();
  for (const [k, m] of counts) {
    out.set(k, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  }
  return out;
}

async function run() {
  const raw = JSON.parse(readFileSync(CATALOG_FILE, 'utf8'));
  const crawlRaw = raw.filter(r =>
    r.competitorEventId && r.date && r.distance && r.distance !== 'Unknown' && r.distance !== '4184');

  // Fetch existing FIRST so new rows inherit established catalog cities.
  let existing = [];
  if (!DRY_RUN) existing = await fetchExistingTri();
  const cityByName = buildCityByName(existing);
  const exByKey = new Map(existing.map(e => [mkKey(e.name, e.year), e]));

  let rows = crawlRaw.map(r => toRow(r, cityByName));

  // Dedupe crawl against itself by (name, year) — keeps first, drops upstream artifacts.
  const seenKey = new Set();
  const before = rows.length;
  rows = rows.filter(r => (seenKey.has(r._key) ? false : (seenKey.add(r._key), true)));
  const internalDropped = before - rows.length;

  const toInsert = [];
  const toUpdate = [];   // { id, competitor_event_id }
  for (const r of rows) {
    const ex = exByKey.get(r._key);
    if (ex) {
      if (ex.competitor_event_id !== r.competitor_event_id) {
        toUpdate.push({ id: ex.id, competitor_event_id: r.competitor_event_id });
      }
    } else {
      const { _key, ...row } = r;
      toInsert.push(row);
    }
  }

  console.log('=== MERGE PLAN ===');
  console.log(`Crawl rows (post internal-dedupe) : ${rows.length}  (dropped ${internalDropped} internal dupes)`);
  console.log(`Existing tri rows in catalog      : ${existing.length}`);
  console.log(`→ UPDATE in place (attach id)     : ${toUpdate.length}`);
  console.log(`→ INSERT new                      : ${toInsert.length}`);

  if (DRY_RUN) {
    console.log('\n[dry-run] no writes performed.');
    return;
  }

  // 1. UPDATE overlaps (attach competitor_event_id to existing rows by id)
  let updated = 0;
  for (const u of toUpdate) {
    await rest(`race_catalog?id=eq.${u.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ competitor_event_id: u.competitor_event_id }),
    });
    updated++;
    if (updated % 10 === 0) console.log(`  updated ${updated}/${toUpdate.length}`);
  }

  // 2. INSERT new (on_conflict makes re-runs idempotent)
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    await rest('race_catalog?on_conflict=competitor_event_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(batch),
    });
    inserted += batch.length;
    console.log(`  inserted ${inserted}/${toInsert.length}`);
  }

  console.log(`\nDONE. Updated ${updated} existing rows, inserted ${toInsert.length} new. Zero duplicates.`);
}

run().catch(e => { console.error('FATAL', e.message); process.exit(1); });

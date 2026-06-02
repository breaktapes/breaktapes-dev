#!/usr/bin/env node
/**
 * emit-merge-sql.mjs — generates the SQL to merge ironman_catalog.json into
 * race_catalog via MCP execute_sql (no service key needed; runs server-side).
 *
 * Strategy (all dedupe/city-inheritance done IN-DB so it's correct per-project):
 *   1. Stage canonicalized crawl rows into a persistent _im_staging table.
 *   2. UPDATE race_catalog: attach competitor_event_id to existing rows that
 *      match a staged row by (lower(name), year) and have no id yet (overlaps).
 *   3. INSERT staged rows with no (name, year) match — inheriting the city from
 *      any existing same-name tri row (so all years group), else slug city.
 *   4. DROP _im_staging.
 *
 * Emits files under scripts/sql/:
 *   00_migration.sql, 01_create_staging.sql, 02_insert_NNN.sql…, 03_merge.sql, 04_cleanup.sql
 *
 * Usage: node scripts/emit-merge-sql.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const CATALOG = new URL('./ironman_catalog.json', import.meta.url).pathname;
const OUTDIR  = new URL('./sql/', import.meta.url).pathname;
mkdirSync(OUTDIR, { recursive: true });

const KM = { 'IRONMAN': 226, '70.3': 113, 'Olympic': 51.5 };
const DIST_LABEL = { 'IRONMAN': 'IRONMAN / Full Distance', '70.3': '70.3 / Middle Distance', 'Olympic': 'Olympic' };
const cityFromSlug = (slug) => (slug || '')
  .replace(/^(im703|im|5150|4184)-/, '')
  .split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').trim();
const CHAMP_RE = /\b(asia[- ]pacific|african|european|north american|south american|latin american|pan[- ]american|middle east|oceania|asia)\s+championship\b/gi;
const canonicalizeName = (n, slug) => {
  const base = (n || '').replace(/^\d{4}\s+/, '').trim();
  const stripped = base.replace(CHAMP_RE, '');
  const champMatched = stripped !== base;
  let c = stripped.replace(/\s*:\s*/g, ' ').replace(/\s+/g, ' ').trim();
  if (champMatched) {
    const m = c.match(/^(IRONMAN(?:\s+70\.3)?)\b\s*(.*)$/i);
    if (m) {
      let loc = m[2].replace(/\btriathlon\b/gi, '').replace(/\s+/g, ' ').trim();
      if (!loc) loc = cityFromSlug(slug);
      c = `${m[1]} ${loc}`.replace(/\s+/g, ' ').trim();
    }
  }
  return c;
};
const normName = (n) => (n || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const q = (s) => `'${String(s ?? '').replace(/'/g, "''")}'`;
const qn = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 'NULL' : Number(v));

const raw = JSON.parse(readFileSync(CATALOG, 'utf8'));
const seen = new Set();
const rows = [];
for (const r of raw) {
  if (!r.competitorEventId || !r.date || !r.distance || r.distance === 'Unknown' || r.distance === '4184') continue;
  const name = canonicalizeName(r.name, r.slug);
  const [year, month, day] = r.date.split('-').map(Number);
  const key = `${normName(name)}|${year || ''}`;
  if (seen.has(key)) continue;            // internal dedupe (name, year)
  seen.add(key);
  rows.push({
    name,
    city_slug: cityFromSlug(r.slug),
    year: year || null, month: month || null, day: day || null,
    dist_km: KM[r.distance] ?? null,
    dist: DIST_LABEL[r.distance] || r.distance,
    eid: r.competitorEventId,
  });
}

// 00 — migration (idempotent)
writeFileSync(OUTDIR + '00_migration.sql', `
ALTER TABLE public.race_catalog ADD COLUMN IF NOT EXISTS competitor_event_id text;
CREATE UNIQUE INDEX IF NOT EXISTS race_catalog_competitor_event_id_idx
  ON public.race_catalog (competitor_event_id) WHERE competitor_event_id IS NOT NULL;
`.trim() + '\n');

// 01 — staging table
writeFileSync(OUTDIR + '01_create_staging.sql', `
DROP TABLE IF EXISTS _im_staging;
CREATE TABLE _im_staging (
  name text, city_slug text, year int, month int, day int,
  dist_km numeric, dist text, competitor_event_id text
);
`.trim() + '\n');

// 02 — insert batches
const BATCH = 150;
let fileIdx = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const values = batch.map(r =>
    `(${q(r.name)}, ${q(r.city_slug)}, ${qn(r.year)}, ${qn(r.month)}, ${qn(r.day)}, ${qn(r.dist_km)}, ${q(r.dist)}, ${q(r.eid)})`
  ).join(',\n');
  const sql = `INSERT INTO _im_staging (name, city_slug, year, month, day, dist_km, dist, competitor_event_id) VALUES\n${values};\n`;
  writeFileSync(OUTDIR + `02_insert_${String(fileIdx).padStart(3, '0')}.sql`, sql);
  fileIdx++;
}

// 03 — merge: UPDATE overlaps, then INSERT new with city inheritance
writeFileSync(OUTDIR + '03_merge.sql', `
-- (a) Attach competitor_event_id to existing rows that match by (name, year).
--     Only fills rows that don't already have an id (idempotent).
WITH ranked AS (
  SELECT DISTINCT ON (lower(name), year) name, year, competitor_event_id
  FROM _im_staging ORDER BY lower(name), year, competitor_event_id
)
UPDATE race_catalog rc
SET competitor_event_id = s.competitor_event_id
FROM ranked s
WHERE rc.type = 'tri'
  AND lower(rc.name) = lower(s.name)
  AND rc.year = s.year
  AND rc.competitor_event_id IS NULL;

-- (b) Insert staged rows with no (name, year) match in the catalog.
--     City inherits from any existing same-name tri row (so years group),
--     else the slug-derived location.
INSERT INTO race_catalog (name, city, country, year, month, day, dist_km, dist, type, competitor_event_id)
SELECT s.name,
       COALESCE(ec.city, s.city_slug, ''),
       '',
       s.year, s.month, s.day, s.dist_km, s.dist, 'tri', s.competitor_event_id
FROM _im_staging s
LEFT JOIN LATERAL (
  SELECT e.city FROM race_catalog e
  WHERE e.type = 'tri' AND lower(e.name) = lower(s.name) AND coalesce(e.city,'') <> ''
  GROUP BY e.city ORDER BY count(*) DESC LIMIT 1
) ec ON true
WHERE NOT EXISTS (
  SELECT 1 FROM race_catalog r
  WHERE r.type = 'tri' AND lower(r.name) = lower(s.name) AND r.year = s.year
)
-- guard against re-runs: skip if this competitor_event_id already landed
AND NOT EXISTS (
  SELECT 1 FROM race_catalog r2 WHERE r2.competitor_event_id = s.competitor_event_id
);
`.trim() + '\n');

// 04 — cleanup + verification
writeFileSync(OUTDIR + '04_cleanup.sql', `
DROP TABLE IF EXISTS _im_staging;
SELECT
  count(*) FILTER (WHERE competitor_event_id IS NOT NULL) AS rows_with_eid,
  count(*) FILTER (WHERE type='tri') AS tri_rows
FROM race_catalog;
`.trim() + '\n');

console.log(`Emitted SQL for ${rows.length} staged rows → ${OUTDIR}`);
console.log(`Insert batch files: ${fileIdx} (×${BATCH} rows)`);

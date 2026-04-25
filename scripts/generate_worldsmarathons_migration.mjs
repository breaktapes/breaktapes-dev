#!/usr/bin/env node
// Convert dedupe output (new_rows.json) into a Supabase migration SQL file.
//
// Usage:
//   node scripts/generate_worldsmarathons_migration.mjs
//
// Inputs:
//   scripts/out/new_rows.json
//
// Outputs:
//   supabase/migrations/<timestamp>_worldsmarathons_seed.sql
//
// SQL details:
// - 500-row INSERT batches.
// - Idempotent guard via WHERE NOT EXISTS keyed on (lower(name), lower(city), year, dist_km).
// - Wraps everything in a transaction.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, 'out');
const MIGR_DIR = resolve(__dirname, '..', 'supabase', 'migrations');

const BATCH_SIZE = 500;

// Stamp: today's date at 13:30:00 (after the start_time column migration at 13:00:00).
const stamp = (() => {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}133000`;
})();

function sqlStr(v) {
  if (v == null || v === '') return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function sqlNum(v) {
  if (v == null || v === '' || !Number.isFinite(+v)) return 'NULL';
  return String(+v);
}

function sqlArr(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 'NULL';
  const items = arr.map((s) => `'${String(s).replace(/'/g, "''")}'`).join(',');
  return `ARRAY[${items}]::text[]`;
}

function buildValueRow(r) {
  // Column order must match the INSERT column list.
  return `(${[
    sqlStr(r.name),
    sqlArr(r.aliases),
    sqlStr(r.city),
    sqlStr(r.country),
    sqlNum(r.year),
    sqlNum(r.month),
    sqlNum(r.day),
    sqlStr(r.event_date),
    sqlStr(r.start_time),
    sqlStr(r.dist),
    sqlNum(r.dist_km),
    sqlStr(r.type),
    sqlStr(r.discipline),
    sqlStr(r.source_site),
    sqlStr(r.source_url),
  ].join(',')})`;
}

(async () => {
  const allRows = JSON.parse(await readFile(resolve(OUT_DIR, 'new_rows.json'), 'utf8'));
  console.error(`[migr] new rows in: ${allRows.length}`);

  // Filter rows missing NOT NULL columns (race_catalog: name, aliases, type, dist, city, country).
  const valid = [];
  const dropped = [];
  for (const r of allRows) {
    if (!r.name || !r.city || !r.country || !r.dist || !r.type || !r.aliases?.length) {
      dropped.push(r);
      continue;
    }
    valid.push(r);
  }
  console.error(`[migr] dropped (NOT NULL violation): ${dropped.length}`);
  console.error(`[migr] valid for insert: ${valid.length}`);
  await writeFile(
    resolve(OUT_DIR, 'dropped_required_fields.json'),
    JSON.stringify(dropped, null, 2),
  );
  const rows = valid;

  if (rows.length === 0) {
    console.error('[migr] nothing to insert — exiting without writing migration');
    return;
  }

  const lines = [];
  lines.push(`-- World's Marathons catalog seed — generated ${new Date().toISOString()}`);
  lines.push(`-- Source: scripts/out/new_rows.json (after dedupe vs live race_catalog)`);
  lines.push(`-- Rows: ${rows.length}`);
  lines.push(`-- Idempotent: WHERE NOT EXISTS guard on (lower(name), lower(city), year, dist_km)`);
  lines.push('');
  lines.push('BEGIN;');
  lines.push('');

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    // Use INSERT ... SELECT FROM (VALUES ...) so the NOT EXISTS guard can apply per-row.
    lines.push(`INSERT INTO race_catalog (`);
    lines.push(`  name, aliases, city, country, year, month, day, event_date, start_time,`);
    lines.push(`  dist, dist_km, type, discipline, source_site, source_url`);
    lines.push(`)`);
    lines.push(`SELECT`);
    lines.push(`  v.name::text, v.aliases::text[], v.city::text, v.country::text,`);
    lines.push(`  v.year::int, v.month::int, v.day::int, v.event_date::date, v.start_time::time,`);
    lines.push(`  v.dist::text, v.dist_km::numeric, v.type::text, v.discipline::text,`);
    lines.push(`  v.source_site::text, v.source_url::text`);
    lines.push(`FROM (VALUES`);
    const valueLines = batch.map((r, idx) => `  ${buildValueRow(r)}${idx === batch.length - 1 ? '' : ','}`);
    lines.push(...valueLines);
    lines.push(`) AS v (`);
    lines.push(`  name, aliases, city, country, year, month, day, event_date, start_time,`);
    lines.push(`  dist, dist_km, type, discipline, source_site, source_url`);
    lines.push(`)`);
    lines.push(`WHERE NOT EXISTS (`);
    lines.push(`  SELECT 1 FROM race_catalog c`);
    lines.push(`  WHERE lower(c.name) = lower(v.name::text)`);
    lines.push(`    AND lower(c.city) = lower(v.city::text)`);
    lines.push(`    AND c.year = v.year::int`);
    lines.push(`    AND ROUND(c.dist_km::numeric, 1) = ROUND(v.dist_km::numeric, 1)`);
    lines.push(`);`);
    lines.push('');
  }

  lines.push('COMMIT;');
  lines.push('');

  const filename = `${stamp}_worldsmarathons_seed.sql`;
  const path = resolve(MIGR_DIR, filename);
  await writeFile(path, lines.join('\n'));
  console.error(`[migr] wrote ${path}`);
  console.error(`[migr] batches: ${Math.ceil(rows.length / BATCH_SIZE)}, batch size: ${BATCH_SIZE}`);
})().catch((e) => {
  console.error('[migr] fatal:', e);
  process.exit(1);
});

#!/usr/bin/env node
// Bulk-load harvested T100 finishers into Supabase t100_results via the REST API.
// Usage:
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_KEY=<service_role> \
//     node scripts/seed-t100.mjs /tmp/t100_full.json
//
// Input JSON: [{ n:name, t:finish, sw:swim, bk:bike, rn:run, p:place, c:category, co:country, b:bib }, ...]
// Event metadata is hardcoded per harvest below — edit EVENT/DATE/RACE/DIST per leaderboard.

import { readFileSync } from 'node:fs'

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_KEY
const file = process.argv[2] || '/tmp/t100_full.json'
if (!URL || !KEY) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY'); process.exit(1) }

const EVENT = process.env.T100_EVENT || 'T100 Triathlon World Tour - London'
const DATE  = process.env.T100_DATE  || '2025-08-09'
const RACE  = process.env.T100_RACE  || 'Age Group'
const DIST  = Number(process.env.T100_DIST || 100000)

const rows = JSON.parse(readFileSync(file, 'utf8')).map(r => ({
  event_name: EVENT, event_date: DATE, race_name: RACE, distance_m: DIST,
  athlete_name: r.n, finish_time: r.t,
  swim_time: r.sw ?? null, bike_time: r.bk ?? null, run_time: r.rn ?? null,
  overall_position: r.p ?? null, category: r.c ?? null, country: r.co ?? null,
  bib: r.b ?? null, source: 'sportstats',
}))

const headers = {
  apikey: KEY, Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'resolution=ignore-duplicates,return=minimal',
}

let ok = 0
for (let i = 0; i < rows.length; i += 500) {
  const batch = rows.slice(i, i + 500)
  const res = await fetch(`${URL}/rest/v1/t100_results`, { method: 'POST', headers, body: JSON.stringify(batch) })
  if (!res.ok) { console.error('batch', i, res.status, (await res.text()).slice(0, 200)); process.exit(1) }
  ok += batch.length
  console.log(`inserted ${ok}/${rows.length}`)
}
console.log('done:', ok, 'rows')

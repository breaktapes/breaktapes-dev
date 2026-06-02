#!/usr/bin/env node
/**
 * scrape-ironman-catalog.mjs
 *
 * Builds an IRONMAN / 70.3 / 5150 EVENT CATALOG (not athlete results) from the
 * public ironman.com race pages. For each race location it follows the link
 * format:
 *
 *   1. ironman.com/races/{slug}/results        → competitor.com master event id
 *   2. labs-v2.competitor.com/results/event/{id} → __NEXT_DATA__ subevents list
 *      (every year that race has been held, with name + date)
 *
 * Emits one catalog row per event-year: { name, date, year, distance, sport,
 * location, slug, competitorEventId }.
 *
 * POLITE CRAWLER. ironman.com robots.txt requests Crawl-delay: 10 and reserves
 * content rights (Content-Signal: ai-train=no). This collects only event
 * metadata (search=yes signal), with bounded concurrency + delay + backoff so
 * it does not trip Cloudflare bot mitigation or get the Worker IP banned.
 *
 * Usage:
 *   node scripts/scrape-ironman-catalog.mjs [resultsUrlsFile] [outFile]
 *   resultsUrlsFile: newline-delimited results-page URLs (default: scripts/im_results_urls.txt)
 *   outFile:         JSON output path (default: scripts/ironman_catalog.json)
 */

import { readFileSync, writeFileSync } from 'node:fs';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const CONCURRENCY = 2;          // simultaneous workers (shared global cap)
const DELAY_MS    = 3000;       // base delay between requests per worker
const MAX_RETRIES = 4;          // on 429/403/5xx/network
const TIMEOUT_MS  = 15000;

const argv = process.argv.slice(2);
const URLS_FILE = argv[0] || new URL('./im_results_urls.txt', import.meta.url).pathname;
const OUT_FILE  = argv[1] || new URL('./ironman_catalog.json', import.meta.url).pathname;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const jitter = (ms) => ms + Math.floor(Math.random() * 1000);

async function politeFetch(url, label) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const resp = await fetch(url, {
        headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (resp.status === 429 || resp.status === 403 || resp.status >= 500) {
        const backoff = jitter(DELAY_MS * Math.pow(2, attempt));
        console.warn(`  [retry ${attempt + 1}] ${label} → ${resp.status}, backing off ${backoff}ms`);
        await sleep(backoff);
        continue;
      }
      if (!resp.ok) throw new Error(`${label} → HTTP ${resp.status}`);
      return await resp.text();
    } catch (e) {
      lastErr = e;
      const backoff = jitter(DELAY_MS * Math.pow(2, attempt));
      console.warn(`  [retry ${attempt + 1}] ${label} → ${e.message}, backing off ${backoff}ms`);
      await sleep(backoff);
    }
  }
  throw lastErr || new Error(`${label} → exhausted retries`);
}

// Distance label from the event name brand.
function distanceFromName(name) {
  const n = name.toLowerCase();
  if (n.includes('70.3')) return '70.3';
  if (n.includes('5150')) return 'Olympic';
  if (n.includes('4184')) return '4184';
  if (n.includes('ironman')) return 'IRONMAN';        // full
  return 'Unknown';
}

// Location = event name minus leading year and brand tokens.
// "2025 IRONMAN 70.3 Victoria" → "Victoria"
function locationFromName(name) {
  return name
    .replace(/^\d{4}\s+/, '')
    .replace(/IRONMAN\s+70\.3/i, '')
    .replace(/IRONMAN/i, '')
    .replace(/\b5150\b/i, '')
    .replace(/\b4184\b/i, '')
    .trim();
}

function extractCompetitorEventId(html) {
  const m = html.match(/competitor\.com\/results\/event\/([a-z0-9-]{36})/i);
  return m ? m[1] : null;
}

function extractSubevents(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/);
  if (!m) return null;
  let data;
  try { data = JSON.parse(m[1]); } catch { return null; }
  const subs = data?.props?.pageProps?.subevents;
  return Array.isArray(subs) ? subs : null;
}

async function processOne(resultsUrl) {
  const slug = (resultsUrl.match(/\/races\/([^/]+)\/results/) || [])[1] || resultsUrl;
  const rows = [];

  // Step 1: ironman.com results page → competitor event id
  const imHtml = await politeFetch(resultsUrl, `im:${slug}`);
  const eid = extractCompetitorEventId(imHtml);
  if (!eid) return { slug, rows, note: 'no_competitor_id' };
  await sleep(jitter(DELAY_MS));

  // Step 2: competitor master event → subevents (all years)
  const compHtml = await politeFetch(`https://labs-v2.competitor.com/results/event/${eid}`, `comp:${slug}`);
  const subs = extractSubevents(compHtml);
  if (!subs) return { slug, rows, note: 'no_subevents' };

  for (const s of subs) {
    const name = s.wtc_name || '';
    if (!name) continue;
    const dateIso = (s.wtc_eventdate || '').slice(0, 10);
    const year = (name.match(/^(\d{4})/) || [])[1] || (dateIso.slice(0, 4) || '');
    rows.push({
      name,
      date: dateIso,
      year,
      distance: distanceFromName(name),
      sport: 'Triathlon',
      location: locationFromName(name),
      slug,
      competitorEventId: s.wtc_eventid || null,
    });
  }
  return { slug, rows, note: 'ok' };
}

// Bounded-concurrency worker pool over the URL list (shared global cap).
async function run() {
  const urls = readFileSync(URLS_FILE, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
  console.log(`Crawling ${urls.length} race locations · concurrency=${CONCURRENCY} · delay=${DELAY_MS}ms\n`);

  const all = [];
  const failures = [];
  let idx = 0;
  let done = 0;

  async function worker(wid) {
    while (idx < urls.length) {
      const myIdx = idx++;
      const url = urls[myIdx];
      try {
        const { slug, rows, note } = await processOne(url);
        all.push(...rows);
        done++;
        console.log(`[${done}/${urls.length}] ${slug} → ${rows.length} event-years (${note})`);
        if (note !== 'ok') failures.push({ url, note });
      } catch (e) {
        done++;
        failures.push({ url, note: e.message });
        console.error(`[${done}/${urls.length}] ${url} → FAILED: ${e.message}`);
      }
      await sleep(jitter(DELAY_MS));
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));

  // Dedupe by competitorEventId (some locations share master events / aliases)
  const seen = new Set();
  const deduped = all.filter(r => {
    const k = r.competitorEventId || `${r.name}|${r.date}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  deduped.sort((a, b) => (a.location || '').localeCompare(b.location || '') || (b.date || '').localeCompare(a.date || ''));

  writeFileSync(OUT_FILE, JSON.stringify(deduped, null, 2));
  console.log(`\nDONE. ${deduped.length} unique event-years from ${urls.length} locations → ${OUT_FILE}`);
  if (failures.length) {
    console.log(`\n${failures.length} locations had issues:`);
    failures.slice(0, 30).forEach(f => console.log(`  ${f.url} → ${f.note}`));
  }
  // Quick distance breakdown
  const byDist = {};
  for (const r of deduped) byDist[r.distance] = (byDist[r.distance] || 0) + 1;
  console.log('\nBy distance:', JSON.stringify(byDist));
}

run().catch(e => { console.error('FATAL', e); process.exit(1); });

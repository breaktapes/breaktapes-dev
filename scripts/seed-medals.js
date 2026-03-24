#!/usr/bin/env node
/**
 * seed-medals.js — Bulk upload race medal photos to Supabase
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=eyJxxx \
 *   node scripts/seed-medals.js ./medals-to-upload/
 *
 * Image folder structure:
 *   medals-to-upload/
 *     dubai-marathon-2026.png          → race_key="dubai-marathon-2026", variant=null
 *     comrades-marathon-2024-gold.png  → race_key="comrades-marathon-2024", variant="gold"
 *     london-marathon-2025.jpg
 *     ...
 *
 * Rules:
 *   - File name (without extension) = race_key, OR race_key + "-" + variant
 *   - Known Comrades variants: gold, silver, bill-rowan, bronze, vic-clapham, back
 *   - First upload wins (ON CONFLICT DO NOTHING via unique index)
 *   - Supports .jpg, .jpeg, .png, .webp
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = 'medal-photos';
const COMRADES_VARIANTS = new Set(['gold', 'silver', 'bill-rowan', 'bronze', 'vic-clapham', 'back']);

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY env vars required');
  process.exit(1);
}

const imageDir = process.argv[2] || './medals-to-upload';
if (!fs.existsSync(imageDir)) {
  console.error(`Error: directory not found: ${imageDir}`);
  process.exit(1);
}

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

function parseFilename(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (!MIME[ext]) return null;
  const base = path.basename(filename, ext);
  // Check if last segment is a known Comrades variant
  const parts = base.split('-');
  const lastPart = parts[parts.length - 1];
  // Check for 2-word variants (e.g. "bill-rowan", "vic-clapham")
  const twoWordVariant = parts.slice(-2).join('-');
  let variant = null;
  let raceKey = base;
  if (COMRADES_VARIANTS.has(twoWordVariant)) {
    variant = twoWordVariant;
    raceKey = parts.slice(0, -2).join('-');
  } else if (COMRADES_VARIANTS.has(lastPart)) {
    variant = lastPart;
    raceKey = parts.slice(0, -1).join('-');
  }
  return { raceKey, variant, ext, mime: MIME[ext] };
}

function fetchJson(method, urlPath, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + urlPath);
    const mod = url.protocol === 'https:' ? https : http;
    const bodyStr = body ? JSON.stringify(body) : null;
    const req = mod.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
        ...extraHeaders,
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function uploadFile(filePath, storagePath, mime) {
  return new Promise((resolve, reject) => {
    const fileBuffer = fs.readFileSync(filePath);
    const url = new URL(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`);
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': mime,
        'Content-Length': fileBuffer.length,
        'x-upsert': 'false',   // first upload wins
      },
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(fileBuffer);
    req.end();
  });
}

function getPublicUrl(storagePath) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

async function insertRow(raceKey, variant, photoUrl) {
  const body = { race_key: raceKey, variant: variant || null, photo_url: photoUrl };
  const res = await fetchJson('POST', '/rest/v1/race_medal_photos', body, {
    'Prefer': 'resolution=ignore-duplicates',
  });
  return res;
}

async function main() {
  const files = fs.readdirSync(imageDir).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return MIME[ext];
  });

  if (!files.length) {
    console.log('No image files found in', imageDir);
    return;
  }

  console.log(`Found ${files.length} image(s) to upload.\n`);
  let uploaded = 0, skipped = 0, errors = 0;

  for (const filename of files) {
    const parsed = parseFilename(filename);
    if (!parsed) { console.log(`  SKIP  ${filename} (unsupported format)`); skipped++; continue; }
    const { raceKey, variant, mime } = parsed;
    const storagePath = variant ? `${raceKey}/${variant}.png` : `${raceKey}/medal.png`;
    const filePath = path.join(imageDir, filename);

    process.stdout.write(`  UP    ${raceKey}${variant ? ` [${variant}]` : ''} ... `);
    try {
      const uploadRes = await uploadFile(filePath, storagePath, mime);
      if (uploadRes.status === 200 || uploadRes.status === 201) {
        const photoUrl = getPublicUrl(storagePath);
        const dbRes = await insertRow(raceKey, variant, photoUrl);
        if (dbRes.status === 200 || dbRes.status === 201 || dbRes.status === 204) {
          console.log('OK');
          uploaded++;
        } else {
          console.log(`DB insert status ${dbRes.status}`);
          errors++;
        }
      } else if (uploadRes.status === 400 && uploadRes.body?.includes('already exists')) {
        console.log('already exists (skip)');
        skipped++;
      } else {
        console.log(`storage error ${uploadRes.status}`);
        errors++;
      }
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone: ${uploaded} uploaded, ${skipped} skipped, ${errors} errors`);
}

main().catch(err => { console.error(err); process.exit(1); });

#!/usr/bin/env node
/**
 * rmbg-proxy.js — Local HTTP proxy for rmbg background removal
 *
 * Accepts image uploads from the browser and returns clean PNGs
 * processed by the local rmbg CLI (ML-quality background removal).
 *
 * Usage:
 *   node scripts/rmbg-proxy.js
 *
 * Then upload medal photos in the app — background removal happens
 * automatically via rmbg instead of the canvas flood-fill fallback.
 *
 * Requires: rmbg CLI installed (local.backgroundrm.com) and activated.
 */

const http = require('http');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 7437;

// Find rmbg binary
function findRmbg() {
  const candidates = [
    process.env.RMBG_BIN,
    'rmbg',
    path.join(os.homedir(), '.local/bin/rmbg'),
    '/usr/local/bin/rmbg',
  ].filter(Boolean);
  for (const c of candidates) {
    try { execFileSync(c, ['--help'], { stdio: 'ignore' }); return c; } catch {}
  }
  return null;
}

const RMBG = findRmbg();
if (!RMBG) {
  console.error('rmbg not found. Install at local.backgroundrm.com and activate your CLI key.');
  process.exit(1);
}
console.log(`rmbg: ${RMBG}`);

const server = http.createServer((req, res) => {
  // CORS — allow requests from the local preview server
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'POST' || req.url !== '/remove-bg') {
    res.writeHead(404); res.end('Not found'); return;
  }

  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    if (!body.length) { res.writeHead(400); res.end('Empty body'); return; }

    const ext = req.headers['content-type']?.includes('png') ? '.png' : '.jpg';
    const tmpIn  = path.join(os.tmpdir(), `rmbg-in-${Date.now()}${ext}`);
    const tmpOut = path.join(os.tmpdir(), `rmbg-out-${Date.now()}.png`);

    try {
      fs.writeFileSync(tmpIn, body);
      execFileSync(RMBG, [
        'remove', '--surface', 'cli',
        '--input', tmpIn,
        '--output', tmpOut,
        '--format', 'json',
      ], { stdio: 'pipe' });

      const png = fs.readFileSync(tmpOut);
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': png.length });
      res.end(png);
    } catch (err) {
      console.error('rmbg error:', err.message);
      res.writeHead(500); res.end('rmbg failed');
    } finally {
      try { fs.unlinkSync(tmpIn); } catch {}
      try { fs.unlinkSync(tmpOut); } catch {}
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`rmbg proxy listening on http://localhost:${PORT}/remove-bg`);
  console.log('Upload a medal photo in the app to use ML background removal.');
});

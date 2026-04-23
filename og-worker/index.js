/**
 * BREAKTAPES OG Image Worker
 *
 * Route: health.breaktapes.com/og/u/:username
 *
 * Generates a 1200x630 PNG social card for athlete profiles using Satori (SVG)
 * + @resvg/resvg-wasm (SVG → PNG). KV cache keyed by username (1hr TTL).
 *
 * On failure, redirects to the static placeholder at APP_URL/og-placeholder.png.
 *
 * Deploy:
 *   cd og-worker && npm install && wrangler deploy
 *
 * Env vars (wrangler.toml [vars]):
 *   SUPABASE_URL  — Supabase project URL
 *   APP_URL       — https://app.breaktapes.com (for placeholder fallback)
 *
 * Secrets (wrangler secret put):
 *   SUPABASE_ANON_KEY
 *
 * KV binding (optional):
 *   OG_KV — cache rendered PNGs for 1hr
 */

import satori from 'satori';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
// Static WASM import — wrangler bundles this as a module binding (required by CF Workers)
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';

// Load Resvg WASM once per worker process
let wasmInitialized = false;
async function ensureWasm() {
  if (wasmInitialized) return;
  await initWasm(resvgWasm);
  wasmInitialized = true;
}

// ── Utilities ────────────────────────────────────────────────────────────────

function timeToSecs(t) {
  if (!t) return Infinity;
  const parts = String(t).split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Infinity;
}

function fmtTime(t) {
  if (!t) return '';
  const parts = String(t).split(':').map(Number);
  if (parts.length === 3) {
    const [h, m, s] = parts;
    if (h === 0) return `${m}:${String(s).padStart(2, '0')}`;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return t;
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function computePBs(races) {
  const pb = {};
  const PRIORITY = ['Marathon', 'Half Marathon', '10K', '5K', '70.3 / Half Ironman', 'Ironman / Full'];
  for (const r of races) {
    if (!r.time || !r.distance) continue;
    const secs = timeToSecs(r.time);
    if (secs === Infinity) continue;
    if (!pb[r.distance] || secs < pb[r.distance].secs) {
      pb[r.distance] = { secs, time: r.time };
    }
  }
  return PRIORITY.filter(d => pb[d]).slice(0, 3).map(d => ({ dist: d, time: fmtTime(pb[d].time) }));
}

function uniqueCountries(races) {
  return new Set(races.map(r => r.country).filter(Boolean)).size;
}

// ── Supabase fetch ────────────────────────────────────────────────────────────

async function fetchProfile(username, env) {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/user_state`);
  url.searchParams.set('username', `eq.${username}`);
  url.searchParams.set('is_public', 'eq.true');
  url.searchParams.set('select', 'races,athlete,next_race');
  url.searchParams.set('limit', '1');

  const res = await fetch(url.toString(), {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) return null;
  const rows = await res.json();
  return rows && rows.length > 0 ? rows[0] : null;
}

// ── Font loader ───────────────────────────────────────────────────────────────

let fontCache = null;

async function loadFonts() {
  if (fontCache) return fontCache;

  // Google Fonts: Barlow Condensed Bold
  const [boldRes, regularRes] = await Promise.all([
    fetch('https://fonts.gstatic.com/s/barlowcondensed/v13/HTxwL3I-JCGChYJ8VI-L6OO_au7B46r2_3E.ttf'),
    fetch('https://fonts.gstatic.com/s/barlow/v13/7cHpv4kjgoGqM7EPCw.ttf'),
  ]);

  const [bold, regular] = await Promise.all([
    boldRes.arrayBuffer(),
    regularRes.arrayBuffer(),
  ]);

  fontCache = [
    { name: 'Barlow Condensed', data: bold, weight: 700, style: 'normal' },
    { name: 'Barlow', data: regular, weight: 400, style: 'normal' },
  ];
  return fontCache;
}

// ── SVG card template (Satori JSX-compatible object) ─────────────────────────

function buildCardElement(data) {
  const { name, location, sport, totalRaces, totalMedals, countries, pbs, username } = data;

  const ORANGE = '#FF4D00';
  const WHITE = '#F5F5F5';
  const SURFACE = '#0D0D0D';
  const MUTED = 'rgba(245,245,245,0.45)';

  const pbItems = pbs.slice(0, 3).map(pb => ({
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 20px',
        background: 'rgba(255,77,0,0.1)',
        borderRadius: '10px',
        minWidth: '160px',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              fontSize: 32,
              fontFamily: 'Barlow Condensed',
              fontWeight: 700,
              color: ORANGE,
              lineHeight: 1,
            },
            children: pb.time,
          },
        },
        {
          type: 'div',
          props: {
            style: { fontSize: 12, color: MUTED, marginTop: 4 },
            children: pb.dist,
          },
        },
      ],
    },
  }));

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: 1200,
        height: 630,
        background: SURFACE,
        padding: '48px 64px',
        fontFamily: 'Barlow',
        color: WHITE,
        position: 'relative',
      },
      children: [
        // Header row: name + BREAKTAPES
        {
          type: 'div',
          props: {
            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 72,
                    fontFamily: 'Barlow Condensed',
                    fontWeight: 700,
                    lineHeight: 0.9,
                    maxWidth: 800,
                  },
                  children: truncate(name, 32),
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 18,
                    fontFamily: 'Barlow Condensed',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    color: ORANGE,
                    marginTop: 8,
                  },
                  children: 'BREAKTAPES',
                },
              },
            ],
          },
        },

        // Location + sport
        {
          type: 'div',
          props: {
            style: { display: 'flex', gap: 16, marginBottom: 40 },
            children: [
              location ? {
                type: 'div',
                props: { style: { fontSize: 20, color: MUTED }, children: `📍 ${location}` },
              } : null,
              sport ? {
                type: 'div',
                props: { style: { fontSize: 20, color: ORANGE, fontWeight: 700 }, children: sport },
              } : null,
            ].filter(Boolean),
          },
        },

        // Career stats row
        {
          type: 'div',
          props: {
            style: { display: 'flex', gap: 40, marginBottom: 40 },
            children: [
              { dist: null, val: totalRaces, lbl: 'RACES' },
              { dist: null, val: totalMedals, lbl: 'MEDALS' },
              { dist: null, val: countries, lbl: countries === 1 ? 'COUNTRY' : 'COUNTRIES' },
            ].map(s => ({
              type: 'div',
              props: {
                style: { display: 'flex', flexDirection: 'column' },
                children: [
                  {
                    type: 'div',
                    props: {
                      style: { fontSize: 56, fontFamily: 'Barlow Condensed', fontWeight: 700, lineHeight: 1, color: WHITE },
                      children: String(s.val),
                    },
                  },
                  {
                    type: 'div',
                    props: { style: { fontSize: 13, color: MUTED, letterSpacing: '0.1em' }, children: s.lbl },
                  },
                ],
              },
            })),
          },
        },

        // PBs row
        pbItems.length > 0 ? {
          type: 'div',
          props: {
            style: { display: 'flex', gap: 12, marginBottom: 'auto' },
            children: pbItems,
          },
        } : null,

        // Footer: URL
        {
          type: 'div',
          props: {
            style: {
              marginTop: 'auto',
              fontSize: 16,
              color: MUTED,
              letterSpacing: '0.04em',
            },
            children: `app.breaktapes.com/u/${username}`,
          },
        },
      ].filter(Boolean),
    },
  };
}

// ── PNG generation ────────────────────────────────────────────────────────────

async function generatePng(cardElement, fonts) {
  const svg = await satori(cardElement, {
    width: 1200,
    height: 630,
    fonts,
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
  });
  return resvg.render().asPng();
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Route: /og/u/:username
    const match = path.match(/^\/og\/u\/([a-z0-9][a-z0-9-]{1,18}[a-z0-9])$/i);
    if (!match || request.method !== 'GET') {
      return new Response('Not found', { status: 404 });
    }

    const username = match[1].toLowerCase();
    const cacheKey = `og:${username}`;
    const appUrl = env.APP_URL || 'https://app.breaktapes.com';
    const fallbackUrl = `${appUrl}/og-placeholder.png`;

    // Check KV cache
    if (env.OG_KV) {
      try {
        const cached = await env.OG_KV.get(cacheKey, 'arrayBuffer');
        if (cached) {
          return new Response(cached, {
            headers: {
              'Content-Type': 'image/png',
              'Cache-Control': 'public, max-age=3600',
              'X-Cache': 'HIT',
            },
          });
        }
      } catch (_) {}
    }

    // Fetch profile data
    let row;
    try {
      row = await fetchProfile(username, env);
    } catch (_) {
      return Response.redirect(fallbackUrl, 302);
    }

    if (!row) {
      return Response.redirect(fallbackUrl, 302);
    }

    // Build card data
    const athlete = row.athlete || {};
    const races = Array.isArray(row.races) ? row.races : [];

    const cardData = {
      username,
      name: truncate(athlete.name || username, 36),
      location: [athlete.city, athlete.country].filter(Boolean).join(', '),
      sport: athlete.primary || '',
      totalRaces: races.length,
      totalMedals: races.filter(r => r.medal && r.medal !== 'none' && r.medal !== '').length,
      countries: uniqueCountries(races),
      pbs: computePBs(races),
    };

    // Generate PNG
    try {
      await ensureWasm();
      const fonts = await loadFonts();
      const element = buildCardElement(cardData);
      const png = await generatePng(element, fonts);

      // Cache in KV for 1hr
      if (env.OG_KV) {
        env.OG_KV.put(cacheKey, png.buffer, { expirationTtl: 3600 }).catch(() => {});
      }

      return new Response(png, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=3600',
          'X-Cache': 'MISS',
        },
      });
    } catch (err) {
      console.error('OG render failed:', err);
      return Response.redirect(fallbackUrl, 302);
    }
  },
};

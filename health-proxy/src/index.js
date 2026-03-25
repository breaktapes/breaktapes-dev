/**
 * breaktapes-health — Cloudflare Worker
 *
 * Two responsibilities:
 *  1. Strava OAuth — keeps STRAVA_CLIENT_SECRET server-side so users never
 *     have to create their own Strava developer app.
 *  2. Open Wearables proxy — adds OW_API_KEY server-side (future use).
 *
 * Secrets (set via `wrangler secret put`):
 *   STRAVA_CLIENT_ID     — from strava.com/settings/api
 *   STRAVA_CLIENT_SECRET — from strava.com/settings/api  ← never reaches browser
 *   OW_BASE_URL          — Railway OW URL (optional, future)
 *   OW_API_KEY           — OW admin key  (optional, future)
 *
 * Routes:
 *   POST /strava/token    — exchange auth code → access + refresh tokens
 *   POST /strava/refresh  — exchange refresh token → new access token
 *   GET  /*               — OW API proxy
 */

const ALLOWED_ORIGINS = new Set([
  'https://app.breaktapes.com',
  'https://dev.breaktapes.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-OW-User-ID',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url    = new URL(request.url);
    const path   = url.pathname;

    if (!ALLOWED_ORIGINS.has(origin)) {
      return new Response('Forbidden', { status: 403 });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // ── POST /strava/token — initial code → token exchange ────────────────
    if (path === '/strava/token' && request.method === 'POST') {
      if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET) {
        return json({ error: 'Strava integration not configured on this server.' }, 503, origin);
      }
      const { code } = await request.json().catch(() => ({}));
      if (!code) return json({ error: 'Missing code' }, 400, origin);

      const resp = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:     env.STRAVA_CLIENT_ID,
          client_secret: env.STRAVA_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
        }),
      });
      return json(await resp.json(), resp.status, origin);
    }

    // ── POST /strava/refresh — refresh token rotation ─────────────────────
    if (path === '/strava/refresh' && request.method === 'POST') {
      if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET) {
        return json({ error: 'Strava integration not configured on this server.' }, 503, origin);
      }
      const { refresh_token } = await request.json().catch(() => ({}));
      if (!refresh_token) return json({ error: 'Missing refresh_token' }, 400, origin);

      const resp = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:     env.STRAVA_CLIENT_ID,
          client_secret: env.STRAVA_CLIENT_SECRET,
          refresh_token,
          grant_type: 'refresh_token',
        }),
      });
      return json(await resp.json(), resp.status, origin);
    }

    // ── OW API proxy (GET only) ───────────────────────────────────────────
    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405, origin);
    }

    if (!env.OW_BASE_URL || !env.OW_API_KEY) {
      return json({ error: 'OW proxy not configured — set OW_BASE_URL and OW_API_KEY secrets' }, 503, origin);
    }

    const owUserId = request.headers.get('X-OW-User-ID');
    if (!owUserId) {
      return json({ error: 'Missing X-OW-User-ID header' }, 400, origin);
    }

    const owUrl = env.OW_BASE_URL.replace(/\/$/, '') + path + url.search;
    let owResponse;
    try {
      owResponse = await fetch(owUrl, {
        headers: { 'X-Open-Wearables-API-Key': env.OW_API_KEY, 'Accept': 'application/json' },
      });
    } catch (err) {
      return json({ error: 'OW instance unreachable', detail: err.message }, 502, origin);
    }

    const body = await owResponse.text();
    return new Response(body, {
      status: owResponse.status,
      headers: {
        'Content-Type': owResponse.headers.get('Content-Type') || 'application/json',
        'Cache-Control': 'no-store',
        ...corsHeaders(origin),
      },
    });
  },
};

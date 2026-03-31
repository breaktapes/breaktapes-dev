/**
 * breaktapes-health — Cloudflare Worker
 *
 * Responsibilities:
 *  1. Strava OAuth  — keeps STRAVA_CLIENT_SECRET server-side
 *  2. WHOOP  OAuth  — keeps WHOOP_CLIENT_SECRET server-side
 *  3. Garmin OAuth  — keeps GARMIN_CLIENT_SECRET + PKCE server-side
 *  4. Open Wearables proxy (legacy)
 *
 * Secrets (set via `wrangler secret put`):
 *   STRAVA_CLIENT_ID      — strava.com/settings/api
 *   STRAVA_CLIENT_SECRET  — strava.com/settings/api
 *   WHOOP_CLIENT_ID       — developer-dashboard.whoop.com
 *   WHOOP_CLIENT_SECRET   — developer-dashboard.whoop.com
 *   GARMIN_CLIENT_ID      — developer.garmin.com
 *   GARMIN_CLIENT_SECRET  — developer.garmin.com
 *   OW_BASE_URL           — Railway OW URL (optional, legacy)
 *   OW_API_KEY            — OW admin key  (optional, legacy)
 *
 * Routes:
 *   POST /strava/token    — exchange auth code → Strava tokens
 *   POST /strava/refresh  — rotate Strava refresh token
 *   POST /whoop/token     — exchange auth code → WHOOP tokens
 *   POST /whoop/refresh   — rotate WHOOP refresh token
 *   POST /garmin/token    — exchange auth code (PKCE) → Garmin tokens
 *   POST /garmin/refresh  — rotate Garmin refresh token
 *   GET  /*               — OW API proxy (legacy)
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

    // ── POST /strava/token ────────────────────────────────────────────────
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

    // ── POST /strava/refresh ──────────────────────────────────────────────
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

    // ── POST /whoop/token ─────────────────────────────────────────────────
    if (path === '/whoop/token' && request.method === 'POST') {
      if (!env.WHOOP_CLIENT_ID || !env.WHOOP_CLIENT_SECRET) {
        return json({ error: 'WHOOP integration not configured on this server.' }, 503, origin);
      }
      const { code, redirect_uri } = await request.json().catch(() => ({}));
      if (!code || !redirect_uri) return json({ error: 'Missing code or redirect_uri' }, 400, origin);

      const body = new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        redirect_uri,
        client_id:     env.WHOOP_CLIENT_ID,
        client_secret: env.WHOOP_CLIENT_SECRET,
      });
      const resp = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    body.toString(),
      });
      const data = await resp.json();
      if (!resp.ok) return json(data, resp.status, origin);

      // Fetch WHOOP user profile to attach to token response
      let profile = {};
      try {
        const profileResp = await fetch('https://api.prod.whoop.com/developer/v1/user/profile/basic', {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        if (profileResp.ok) profile = await profileResp.json();
      } catch (_) {}

      return json({ ...data, profile }, resp.status, origin);
    }

    // ── POST /whoop/refresh ───────────────────────────────────────────────
    if (path === '/whoop/refresh' && request.method === 'POST') {
      if (!env.WHOOP_CLIENT_ID || !env.WHOOP_CLIENT_SECRET) {
        return json({ error: 'WHOOP integration not configured on this server.' }, 503, origin);
      }
      const { refresh_token } = await request.json().catch(() => ({}));
      if (!refresh_token) return json({ error: 'Missing refresh_token' }, 400, origin);

      const body = new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token,
        client_id:     env.WHOOP_CLIENT_ID,
        client_secret: env.WHOOP_CLIENT_SECRET,
      });
      const resp = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    body.toString(),
      });
      return json(await resp.json(), resp.status, origin);
    }

    // ── POST /garmin/token ────────────────────────────────────────────────
    if (path === '/garmin/token' && request.method === 'POST') {
      if (!env.GARMIN_CLIENT_ID || !env.GARMIN_CLIENT_SECRET) {
        return json({ error: 'Garmin integration not configured on this server.' }, 503, origin);
      }
      const { code, redirect_uri, code_verifier } = await request.json().catch(() => ({}));
      if (!code || !redirect_uri || !code_verifier) {
        return json({ error: 'Missing code, redirect_uri, or code_verifier' }, 400, origin);
      }

      const body = new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        redirect_uri,
        code_verifier,
        client_id:     env.GARMIN_CLIENT_ID,
        client_secret: env.GARMIN_CLIENT_SECRET,
      });
      const resp = await fetch('https://connectapi.garmin.com/oauth-service/oauth/token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    body.toString(),
      });
      const data = await resp.json();
      if (!resp.ok) return json(data, resp.status, origin);

      // Fetch Garmin user summary to attach display name
      let profile = {};
      try {
        const profileResp = await fetch('https://apis.garmin.com/wellness-api/rest/user/id', {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        if (profileResp.ok) profile = await profileResp.json();
      } catch (_) {}

      return json({ ...data, profile }, resp.status, origin);
    }

    // ── POST /garmin/refresh ──────────────────────────────────────────────
    if (path === '/garmin/refresh' && request.method === 'POST') {
      if (!env.GARMIN_CLIENT_ID || !env.GARMIN_CLIENT_SECRET) {
        return json({ error: 'Garmin integration not configured on this server.' }, 503, origin);
      }
      const { refresh_token } = await request.json().catch(() => ({}));
      if (!refresh_token) return json({ error: 'Missing refresh_token' }, 400, origin);

      const body = new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token,
        client_id:     env.GARMIN_CLIENT_ID,
        client_secret: env.GARMIN_CLIENT_SECRET,
      });
      const resp = await fetch('https://connectapi.garmin.com/oauth-service/oauth/token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    body.toString(),
      });
      return json(await resp.json(), resp.status, origin);
    }

    // ── OW API proxy (GET only, legacy) ───────────────────────────────────
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

    const owBody = await owResponse.text();
    return new Response(owBody, {
      status: owResponse.status,
      headers: {
        'Content-Type': owResponse.headers.get('Content-Type') || 'application/json',
        'Cache-Control': 'no-store',
        ...corsHeaders(origin),
      },
    });
  },
};

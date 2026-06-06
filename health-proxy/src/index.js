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

import { PostHog } from 'posthog-node';

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
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-OW-User-ID, X-POSTHOG-DISTINCT-ID, X-POSTHOG-SESSION-ID',
    'Access-Control-Max-Age': '86400',
  };
}

function makePostHog(env) {
  if (!env.POSTHOG_API_KEY) return null;
  return new PostHog(env.POSTHOG_API_KEY, {
    host: env.POSTHOG_HOST || 'https://us.i.posthog.com',
    flushAt: 1,
    flushInterval: 0,
    enableExceptionAutocapture: true,
  });
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

// ── Cryptographic Clerk JWT verification (RS256 via JWKS) ────────────────────
// Mirrors worker/index.js. Issuer is PINNED so an attacker can't point us at
// their own JWKS. Fails CLOSED on any error.
const ALLOWED_ISS = new Set([
  'https://clerk.breaktapes.com',
  'https://accounts.breaktapes.com',
  'https://elegant-snipe-62.clerk.accounts.dev', // dev/local instance
]);
const _jwksCache = new Map(); // iss -> { keys, fetchedAt }

function _b64urlToBytes(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
  const bin = atob(b64 + pad);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function _getJwks(iss, force) {
  const cached = _jwksCache.get(iss);
  if (!force && cached && Date.now() - cached.fetchedAt < 3600_000) return cached.keys;
  const res = await fetch(`${iss}/.well-known/jwks.json`);
  if (!res.ok) throw new Error(`jwks ${res.status}`);
  const { keys } = await res.json();
  _jwksCache.set(iss, { keys, fetchedAt: Date.now() });
  return keys;
}

// Returns the verified Clerk `sub` (user_xxx), or null. Fails CLOSED.
async function verifyClerkSub(request) {
  try {
    const authHeader = request.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return null;
    const parts = String(token).split('.');
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const header = JSON.parse(atob(h.replace(/-/g, '+').replace(/_/g, '/')));
    if (header.alg !== 'RS256' || !header.kid) return null;
    const payload = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
    if (!ALLOWED_ISS.has(String(payload.iss ?? ''))) return null;
    if (!payload.sub || !String(payload.sub).startsWith('user_')) return null;
    const nowS = Math.floor(Date.now() / 1000);
    if (!payload.exp || nowS > payload.exp) return null;
    if (payload.nbf && nowS + 5 < payload.nbf) return null;

    let keys = await _getJwks(payload.iss, false);
    let jwk = keys.find(k => k.kid === header.kid);
    if (!jwk) { keys = await _getJwks(payload.iss, true); jwk = keys.find(k => k.kid === header.kid); }
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'],
    );
    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5', key, _b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`),
    );
    return ok ? String(payload.sub) : null;
  } catch {
    return null;
  }
}

// Verify the caller (by verified Clerk sub) owns the given OW user id.
// OW user objects carry external_user_id = the Clerk sub set at /ow/user creation.
// Prevents IDOR: a user cannot read/mutate another user's wearable data by
// passing a different ow_user_id. Fails CLOSED.
async function verifyOwOwner(request, env, owUserId) {
  const sub = await verifyClerkSub(request);
  if (!sub || !owUserId) return false;
  try {
    const ow = env.OW_BASE_URL.replace(/\/$/, '');
    const res = await fetch(`${ow}/api/v1/users/${encodeURIComponent(owUserId)}`, {
      headers: { 'X-Open-Wearables-API-Key': env.OW_API_KEY },
    });
    if (!res.ok) return false;
    const u = await res.json().catch(() => ({}));
    return u && u.external_user_id === sub;
  } catch {
    return false;
  }
}

export default {
  async fetch(request, env) {
    const origin     = request.headers.get('Origin') || '';
    const url        = new URL(request.url);
    const path       = url.pathname;
    const distinctId = request.headers.get('X-POSTHOG-DISTINCT-ID') || 'anonymous';
    const sessionId  = request.headers.get('X-POSTHOG-SESSION-ID') || undefined;
    const posthog    = makePostHog(env);

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
      const data = await resp.json();
      if (resp.ok && posthog) {
        posthog.capture({
          distinctId,
          event: 'wearable connected',
          properties: {
            provider: 'strava',
            athlete_id: data.athlete?.id ?? null,
            ...(sessionId && { $session_id: sessionId }),
          },
        });
        await posthog.shutdown();
      }
      return json(data, resp.status, origin);
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
      const data = await resp.json();
      if (resp.ok && posthog) {
        posthog.capture({
          distinctId,
          event: 'wearable token refreshed',
          properties: {
            provider: 'strava',
            ...(sessionId && { $session_id: sessionId }),
          },
        });
        await posthog.shutdown();
      }
      return json(data, resp.status, origin);
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

      if (posthog) {
        posthog.capture({
          distinctId,
          event: 'wearable connected',
          properties: {
            provider: 'whoop',
            whoop_user_id: profile.user_id ?? null,
            ...(sessionId && { $session_id: sessionId }),
          },
        });
        await posthog.shutdown();
      }
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
      const data = await resp.json();
      if (resp.ok && posthog) {
        posthog.capture({
          distinctId,
          event: 'wearable token refreshed',
          properties: {
            provider: 'whoop',
            ...(sessionId && { $session_id: sessionId }),
          },
        });
        await posthog.shutdown();
      }
      return json(data, resp.status, origin);
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

      if (posthog) {
        posthog.capture({
          distinctId,
          event: 'wearable connected',
          properties: {
            provider: 'garmin',
            garmin_user_id: profile.userId ?? null,
            ...(sessionId && { $session_id: sessionId }),
          },
        });
        await posthog.shutdown();
      }
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
      const data = await resp.json();
      if (resp.ok && posthog) {
        posthog.capture({
          distinctId,
          event: 'wearable token refreshed',
          properties: {
            provider: 'garmin',
            ...(sessionId && { $session_id: sessionId }),
          },
        });
        await posthog.shutdown();
      }
      return json(data, resp.status, origin);
    }

    // ── POST /email/send — transactional send via Resend ──────────────────
    if (path === '/email/send' && request.method === 'POST') {
      if (!env.RESEND_API_KEY) {
        return json({ error: 'Email not configured on this server.' }, 503, origin);
      }
      const { to, subject, html, replyTo, from } = await request.json().catch(() => ({}));
      if (!to || !subject || !html) {
        return json({ error: 'Missing to, subject, or html' }, 400, origin);
      }
      // Allowlisted senders — prevents the route being used as an open relay.
      const SENDERS = {
        hello:   'BREAKTAPES <hello@breaktapes.com>',
        founder: 'Ayush · BREAKTAPES <founder@breaktapes.com>',
        support: 'BREAKTAPES Support <support@breaktapes.com>',
        noreply: 'BREAKTAPES <noreply@breaktapes.com>',
      };
      const fromHeader = SENDERS[from] || SENDERS.hello;
      const resp = await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          from:     fromHeader,
          to,
          subject,
          html,
          // noreply: no reply-to (unmonitored). Others route replies to the inbox.
          ...(from === 'noreply' ? {} : { reply_to: replyTo || 'ayushkrishnan03@gmail.com' }),
        }),
      });
      const data = await resp.json().catch(() => ({}));
      return json(data, resp.status, origin);
    }

    // ── Race Import: UltraSignup ──────────────────────────────────────────
    if (path === '/import/ultrasignup' && request.method === 'POST') {
      try {
        const { firstName, lastName } = await request.json();
        const f = encodeURIComponent((firstName || '').trim());
        const l = encodeURIComponent((lastName  || '').trim());
        if (!f || !l) return json({ results: [], status: 'ok' }, 200, origin);
        const url = `https://ultrasignup.com/service/events.svc/historybyname/${f}/${l}/`;
        const resp = await fetch(url, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(6000),
        });
        if (!resp.ok) throw new Error(`UltraSignup ${resp.status}`);
        const persons = await resp.json();

        // Convert "M/D/YYYY HH:MM:SS AM/PM" → "YYYY-MM-DD"
        const normDate = (s) => {
          if (!s) return '';
          const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          return m ? `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}` : '';
        };

        const results = [];
        for (const p of (Array.isArray(persons) ? persons : [])) {
          for (const r of (p.Results || [])) {
            results.push({
              raceName: r.eventname || 'Unknown Race',
              date:     normDate(r.eventdate),
              time:     r.formattime || r.time || '',
              city:     r.city || '',
              state:    r.state || '',
              placing:       r.place        ? String(r.place)        : '',
              genderPlacing: r.gender_place ? String(r.gender_place) : '',
            });
          }
        }
        if (posthog) {
          posthog.capture({
            distinctId,
            event: 'race import searched',
            properties: {
              provider: 'ultrasignup',
              result_count: results.length,
              ...(sessionId && { $session_id: sessionId }),
            },
          });
          await posthog.shutdown();
        }
        return json({ results, status: 'ok' }, 200, origin);
      } catch (e) {
        if (posthog) {
          posthog.captureException(e, distinctId);
          await posthog.shutdown();
        }
        return json({ results: [], status: 'error', message: e.message }, 502, origin);
      }
    }

    // ── Race Import: Athlinks (public profile scrape via __NEXT_DATA__) ──────
    if (path === '/import/athlinks' && request.method === 'POST') {
      try {
        const { profileUrl } = await request.json();
        const trimmed = (profileUrl || '').trim();
        if (!trimmed) return json({ results: [], status: 'ok' }, 200, origin);

        // Accept full URLs or bare numeric IDs
        const match = trimmed.match(/(?:athlinks\.com\/[Aa]thletes?\/|^)(\d+)/i);
        const athleteId = match?.[1];
        if (!athleteId) return json({ results: [], status: 'error', message: 'Could not find athlete ID in URL' }, 200, origin);

        const pageUrl = `https://www.athlinks.com/athletes/${athleteId}/results`;
        const resp = await fetch(pageUrl, {
          signal: AbortSignal.timeout(6000),
          headers: {
            'Accept': 'text/html,application/xhtml+xml',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });
        if (!resp.ok) throw new Error(`Athlinks ${resp.status}`);
        const html = await resp.text();

        // Next.js embeds SSR data in a <script id="__NEXT_DATA__"> tag
        const ndMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
        if (!ndMatch) return json({ results: [], status: 'ok', message: 'no_data' }, 200, origin);

        const nextData = JSON.parse(ndMatch[1]);
        const pp = nextData?.props?.pageProps ?? {};

        // Athlinks has used several field names across versions — try all known paths
        const rawResults = pp.athleteResults ?? pp.racerResults ?? pp.results
          ?? pp.data?.results ?? pp.data?.racerResults ?? [];

        const normDate = (s) => {
          if (!s) return '';
          const iso = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
          const mdy = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`;
          return '';
        };

        const secsToHMS = (secs) => {
          const h = Math.floor(secs / 3600);
          const m = Math.floor((secs % 3600) / 60);
          const s = Math.floor(secs % 60);
          return h > 0
            ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
            : `${m}:${String(s).padStart(2,'0')}`;
        };

        const results = [];
        for (const r of (Array.isArray(rawResults) ? rawResults : [])) {
          const name = r.eventName ?? r.raceName ?? r.name ?? r.eventCourseName ?? r.courseName ?? '';
          if (!name || name.length < 3) continue;

          const date = normDate(r.eventDate ?? r.startDate ?? r.raceDate ?? r.date ?? '');

          const rawTime = r.chipTime ?? r.clockTime ?? r.finishTime ?? r.time ?? r.netTime ?? '';
          let time = '';
          if (rawTime) {
            if (typeof rawTime === 'number' && rawTime > 0) {
              time = secsToHMS(rawTime);
            } else if (String(rawTime).match(/^\d+:\d{2}/)) {
              time = String(rawTime);
            }
          }

          const rawDist = r.distance ?? r.eventDistance ?? r.distanceInMeters ?? r.courseDistance ?? 0;
          const distance_m = typeof rawDist === 'number' && rawDist > 0 ? rawDist : 0;

          results.push({
            raceName: name,
            date,
            time: time || undefined,
            source: 'athlinks',
            distance_m,
            country: r.eventCountry ?? r.country ?? r.location ?? '',
          });
        }

        return json({ results, status: 'ok' }, 200, origin);
      } catch (e) {
        return json({ results: [], status: 'error', message: e.message }, 502, origin);
      }
    }

    // ── Race Import: MarathonView ─────────────────────────────────────────
    if (path === '/import/marathonview' && request.method === 'POST') {
      try {
        const { name, birthYear, gender } = await request.json();
        const trimmed = (name || '').trim();
        if (!trimmed) return json({ results: [], status: 'ok' }, 200, origin);
        const url = `https://marathonview.net/query/${encodeURIComponent(trimmed)}`;
        const resp = await fetch(url, {
          headers: { 'Accept': 'text/html', 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(6000),
        });
        if (!resp.ok) throw new Error(`MarathonView ${resp.status}`);
        const html = await resp.text();

        // MarathonView server-renders results as `const json = {...};` inside a <script> tag.
        // Brace-balanced extractor (must respect string literals).
        const startIdx = html.indexOf('const json=');
        if (startIdx === -1) return json({ results: [], status: 'ok' }, 200, origin);
        const braceStart = html.indexOf('{', startIdx);
        if (braceStart === -1) return json({ results: [], status: 'ok' }, 200, origin);
        let depth = 0, inStr = false, esc = false, end = -1;
        for (let i = braceStart; i < html.length; i++) {
          const ch = html[i];
          if (esc) { esc = false; continue; }
          if (inStr) {
            if (ch === '\\') { esc = true; continue; }
            if (ch === '"') inStr = false;
            continue;
          }
          if (ch === '"') { inStr = true; continue; }
          if (ch === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) { end = i; break; }
          }
        }
        if (end === -1) return json({ results: [], status: 'ok' }, 200, origin);
        let payload;
        try { payload = JSON.parse(html.slice(braceStart, end + 1)); }
        catch (_) { return json({ results: [], status: 'ok' }, 200, origin); }

        const raceList = (payload && payload.data && Array.isArray(payload.data.results))
          ? payload.data.results
          : [];

        // Soft age/gender filter using the caller's DOB-derived birthYear + gender.
        // MarathonView name search returns ALL namesakes; this removes wrong-person
        // rows. CONSERVATIVE: only drop on an actual CONFLICT — keep any row whose
        // field is null, because MarathonView leaves age/gender blank on many of the
        // user's OWN races and a hard match would discard valid results.
        let wantGender = String(gender || '').trim().toUpperCase().slice(0, 1);
        if (wantGender !== 'M' && wantGender !== 'F') wantGender = '';
        const wantBirthYear = Number(birthYear) || 0;
        const matchesUser = (r) => {
          if (wantGender && r.gender != null) {
            const g = String(r.gender).trim().toUpperCase().slice(0, 1);
            if ((g === 'M' || g === 'F') && g !== wantGender) return false;
          }
          if (wantBirthYear && r.birth_year != null) {
            if (Number(r.birth_year) !== wantBirthYear) return false;
          }
          return true;
        };
        const filteredList = (wantGender || wantBirthYear)
          ? raceList.filter(matchesUser)
          : raceList;

        const fmtTime = (secs) => {
          if (!secs || !Number.isFinite(secs)) return '';
          secs = Math.round(secs); // personal_time can be a float (e.g. 12431.299…)
          const h = Math.floor(secs / 3600);
          const m = Math.floor((secs % 3600) / 60);
          const s = Math.floor(secs % 60);
          return h > 0
            ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
            : `${m}:${String(s).padStart(2, '0')}`;
        };

        // Prefer NET/chip time (`personal_time`) over GUN/clock time (`result`).
        // MarathonView's `result` is the official gun time; for big-corral races
        // (Berlin, Tokyo) the gun→net gap reaches 15+ min for back-of-pack runners,
        // which surfaced as inflated import times. Fall back to `result` when net absent.
        const pickTime = (r) => {
          const net = Number(r.personal_time);
          const gun = Number(r.result);
          return fmtTime(Number.isFinite(net) && net > 0 ? net : gun);
        };

        const results = filteredList.map(r => ({
          raceName:   r.event_name || r.race_name || 'Unknown Race',
          date:       r.date || '',
          time:       pickTime(r),
          distance_m: r.distance,
          country:    r.event_country || '',
          raw:        [r.event_name, r.date, pickTime(r)],
        }));

        if (posthog) {
          posthog.capture({
            distinctId,
            event: 'race import searched',
            properties: {
              provider: 'marathonview',
              result_count: results.length,
              ...(sessionId && { $session_id: sessionId }),
            },
          });
          await posthog.shutdown();
        }
        return json({ results, status: 'ok' }, 200, origin);
      } catch (e) {
        if (posthog) {
          posthog.captureException(e, distinctId);
          await posthog.shutdown();
        }
        return json({ results: [], status: 'error', message: e.message }, 502, origin);
      }
    }

    // ── Race Import: Hopasports (UAE / MENA timer — RAK, Dubai Creek, etc.) ──
    // The caller supplies a hopa event `slug` (from /import/hopasports-events)
    // plus a name. We parse the event's race list off the event page, then scan
    // every race (21km / 10km / 5km …) for that athlete in parallel and return
    // matches tagged with distance. finishtime is chip/net (ms) — no gun/net issue.
    if (path === '/import/hopasports' && request.method === 'POST') {
      const distinctId = request.headers.get('X-POSTHOG-DISTINCT-ID') || 'anon';
      const posthog = makePostHog(env);
      try {
        const body = await request.json().catch(() => ({}));
        const slug = String(body.slug || '').trim();
        const q = String(body.name || `${body.firstName || ''} ${body.lastName || ''}`).trim();
        if (!slug || !q) return json({ results: [], status: 'ok' }, 200, origin);

        // finishtime is milliseconds (e.g. 2367000 → 39:27, fractional → rounded).
        const fmt = (ms) => {
          if (!ms || !Number.isFinite(ms)) return '';
          const s = Math.round(ms / 1000);
          const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
          return h > 0
            ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`
            : `${m}:${String(x).padStart(2, '0')}`;
        };
        // "21km" → 21000, "10Miler (16KM)" → 16000, "5km" → 5000.
        const parseDistM = (title) => {
          if (!title) return 0;
          const paren = title.match(/\((\d+(?:\.\d+)?)\s*km\)/i);
          if (paren) return Math.round(parseFloat(paren[1]) * 1000);
          const km = title.match(/(\d+(?:\.\d+)?)\s*km/i);
          if (km) return Math.round(parseFloat(km[1]) * 1000);
          const mi = title.match(/(\d+(?:\.\d+)?)\s*mile/i);
          if (mi) return Math.round(parseFloat(mi[1]) * 1609.34);
          return 0;
        };

        // 1. Pull the event page and parse its race list (Vue prop
        //    `:races_with_pt="JSON.parse('[…]')"`, "-escaped).
        const pageHtml = await fetch(`https://results.hopasports.com/event/${encodeURIComponent(slug)}`, {
          headers: { 'Accept': 'text/html', 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(10000),
        }).then(r => r.ok ? r.text() : '');
        let races = [];
        const m = pageHtml.match(/:races_with_pt="JSON\.parse\(.(.*?).\)"/s);
        if (m) {
          try {
            races = JSON.parse(m[1].replace(/\\u0022/g, '"').replace(/\\\//g, '/')).map(r => ({
              race_id: r.race_id, pt: r.pt || 'i', title: r.title || '',
            }));
          } catch (_) { /* fall through */ }
        }
        if (!races.length) races = [{ race_id: 1, pt: 'i', title: '' }];
        const eventTitle = ((pageHtml.match(/<title>([^<|]+)/) || [])[1] || 'Hopasports Event').trim();
        // hopa exposes no machine-readable event date on these surfaces; fall back
        // to the year in the slug/title so the import isn't stamped "today". The
        // user fixes the exact day in race detail. Empty when no year is present.
        const yr = (slug.match(/20\d\d/) || eventTitle.match(/20\d\d/) || [])[0];
        const dateGuess = yr ? `${yr}-01-01` : '';

        // 2. Scan every race for the athlete in parallel.
        const perRace = await Promise.all(races.map(async (rc) => {
          try {
            const url = `https://results.hopasports.com/static_forward/en/event/${encodeURIComponent(slug)}/results/list`
              + `?nopag=1&race=${rc.race_id}&pt=${encodeURIComponent(rc.pt)}&q=${encodeURIComponent(q)}&raw=1`;
            const data = await fetch(url, {
              headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0', 'X-Requested-With': 'XMLHttpRequest' },
              signal: AbortSignal.timeout(10000),
            }).then(r => r.ok ? r.json() : null);
            // ranktable is an array for the full list, an object keyed by rank for
            // some filtered queries — normalize both.
            const rtt = data && data.ranktable;
            const rank = Array.isArray(rtt) ? rtt : (rtt && typeof rtt === 'object' ? Object.values(rtt) : []);
            // Drop DNS/DNF/registered-but-no-time rows — nothing to import.
            return rank.filter(r => r && Number(r.finishtime) > 0).map(r => {
              const p = (r && r.target && r.target.participants && r.target.participants[0]) || {};
              return {
                raceName:    eventTitle,
                date:        dateGuess,
                distance:    rc.title,
                distance_m:  parseDistM(rc.title),
                athleteName: p.name || '',
                time:        fmt(r.finishtime) || (r.finishtimeTxt || ''),
                placing:     r.overallrankTxt != null ? String(r.overallrankTxt) : '',
                category:    r.category || p.category || '',
                club:        p.represents || '',
                nationality: p.nationality || '',
                bib:         r.bib || p.bib || '',
                source:      'hopasports',
              };
            });
          } catch (_) { return []; }
        }));
        const results = perRace.flat();

        if (posthog) {
          posthog.capture({
            distinctId,
            event: 'race import searched',
            properties: { provider: 'hopasports', result_count: results.length, ...(sessionId && { $session_id: sessionId }) },
          });
          await posthog.shutdown();
        }
        return json({ results, status: 'ok' }, 200, origin);
      } catch (e) {
        if (posthog) { posthog.captureException(e, distinctId); await posthog.shutdown(); }
        return json({ results: [], status: 'error', message: e.message }, 502, origin);
      }
    }

    // ── Hopasports event search (for the event-first import picker) ──────────
    // hopa has no public events API (its global search is Livewire). The
    // past/on-tour listing pages ARE plain server HTML, so we scrape the event
    // links + names and filter client-side. Covers the recent UAE/MENA events.
    if (path === '/import/hopasports-events' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const query = String(body.q || '').trim().toLowerCase();
        const pages = [
          'https://www.hopasports.com/en/events/past',
          'https://www.hopasports.com/en/events/ontour',
        ];
        const htmls = await Promise.all(pages.map(u =>
          fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' }, signal: AbortSignal.timeout(10000) })
            .then(r => r.ok ? r.text() : '').catch(() => '')
        ));
        const decode = (s) => s
          .replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
        const seen = new Set();
        const events = [];
        const re = /<a[^>]*href="[^"]*\/event\/([a-z0-9-]+)"[^>]*class="[^"]*hover:underline[^"]*"[^>]*>([^<]{2,140})</g;
        for (const html of htmls) {
          let m;
          while ((m = re.exec(html))) {
            const slug = m[1];
            if (seen.has(slug)) continue;
            seen.add(slug);
            const name = decode(m[2]);
            if (query && !(`${name} ${slug}`.toLowerCase().includes(query))) continue;
            events.push({ slug, name, source: 'hopasports' });
          }
          re.lastIndex = 0;
        }
        return json({ events, status: 'ok' }, 200, origin);
      } catch (e) {
        return json({ events: [], status: 'error', message: e.message }, 502, origin);
      }
    }

    // ── Race Import: Sporthive / Speedhive (MYLAPS — global name search) ─────
    // True pure-name search across the whole MYLAPS network (any finisher, not
    // just claimed accounts). Two open JSON GETs (Origin header only):
    //  1. search.speedhive.com/api/search?term={name} → Participants (every race
    //     the person did: eventName, raceName, date, raceId GUID, bib).
    //  2. eventresults-api.speedhive.com/sporthive/races/{raceId}/bibs/{bib} →
    //     the finisher's chip/gun time, placing, category, splits (incl. tri legs).
    if (path === '/import/sporthive' && request.method === 'POST') {
      const distinctId = request.headers.get('X-POSTHOG-DISTINCT-ID') || 'anon';
      const posthog = makePostHog(env);
      try {
        const body = await request.json().catch(() => ({}));
        const first = String(body.firstName || '').trim();
        const last  = String(body.lastName || '').trim();
        const term  = String(body.name || `${first} ${last}`).trim();
        if (!term) return json({ results: [], status: 'ok' }, 200, origin);

        const SH = { 'Accept': 'application/json', 'Origin': 'https://sporthive.com', 'Referer': 'https://sporthive.com/', 'User-Agent': 'Mozilla/5.0' };

        // 1. Name search → participant rows.
        const searchUrl = `https://search.speedhive.com/api/search?term=${encodeURIComponent(term)}`
          + `&category=Active&count=40&offset=0&fuzzy=true`;
        const searchData = await fetch(searchUrl, { headers: SH, signal: AbortSignal.timeout(10000) })
          .then(r => r.ok ? r.json() : []).catch(() => []);
        const parts = (Array.isArray(searchData) ? searchData : [])
          .filter(x => x && x.entityType === 'Participants' && x.raceId && x.bib != null);

        // Keep only rows whose name actually matches the query tokens — fuzzy
        // search returns loose hits. Require every query token to appear.
        const tokens = term.toLowerCase().split(/\s+/).filter(t => t.length > 1);
        const matched = parts.filter(p => {
          const n = String(p.name || '').toLowerCase();
          return tokens.every(t => n.includes(t));
        }).slice(0, 25); // bound the per-result fetch fan-out

        // HH:MM:SS(.mmm) → strip fraction, drop a leading "00:" hour.
        const cleanTime = (t) => {
          if (!t) return '';
          let s = String(t).split('.')[0];
          const m = s.match(/^(\d+):(\d{2}):(\d{2})$/);
          if (m) return Number(m[1]) > 0 ? `${Number(m[1])}:${m[2]}:${m[3]}` : `${Number(m[2])}:${m[3]}`;
          return s;
        };
        const parseDistM = (s) => {
          if (!s) return 0;
          const km = String(s).match(/(\d+(?:\.\d+)?)\s*km/i);
          if (km) return Math.round(parseFloat(km[1]) * 1000);
          const mi = String(s).match(/(\d+(?:\.\d+)?)\s*mile/i);
          if (mi) return Math.round(parseFloat(mi[1]) * 1609.34);
          return 0;
        };

        // 2. Fetch each finisher result in parallel for time/placing/splits.
        const results = (await Promise.all(matched.map(async (p) => {
          try {
            const r = await fetch(`https://eventresults-api.speedhive.com/sporthive/races/${encodeURIComponent(p.raceId)}/bibs/${encodeURIComponent(p.bib)}`,
              { headers: SH, signal: AbortSignal.timeout(10000) }).then(x => x.ok ? x.json() : null);
            if (!r || r.dns || r.dsq) return null;
            const time = cleanTime(r.chipTimeOfParticipant) || cleanTime(r.gunTimeOfParticipant)
              || cleanTime(r.legs && r.legs[0] && r.legs[0].totalDuration);
            const distM = Number(r.distanceInMeter) || (r.legs && r.legs[0] && Number(r.legs[0].distanceInMeters)) || parseDistM(p.raceName);
            const date = (p.date || '').slice(0, 10);
            // Tri / multi-leg splits → import splits (Swim/Bike/Run, or named splits).
            const splits = [];
            for (const leg of (Array.isArray(r.legs) ? r.legs : [])) {
              const dur = cleanTime(leg.totalDuration || leg.legDuration);
              const label = leg.sportName ? leg.sportName.charAt(0).toUpperCase() + leg.sportName.slice(1) : '';
              if (dur && label) splits.push({ label, split: dur });
            }
            return {
              raceName:   p.eventName || 'Sporthive Event',
              date,
              time:       time || undefined,
              distance_m: distM || undefined,
              sport:      p.sportType || undefined,
              placing:    r.overallPosition != null ? String(r.overallPosition) : '',
              genderPlacing: r.genderPosition != null ? String(r.genderPosition) : '',
              agLabel:    r.raceCategory || '',
              country:    p.countryCode || '',
              ...(splits.length ? { splits } : {}),
              source:     'sporthive',
            };
          } catch (_) { return null; }
        }))).filter(Boolean);

        if (posthog) {
          posthog.capture({ distinctId, event: 'race import searched', properties: { provider: 'sporthive', result_count: results.length, ...(sessionId && { $session_id: sessionId }) } });
          await posthog.shutdown();
        }
        return json({ results, status: 'ok' }, 200, origin);
      } catch (e) {
        if (posthog) { posthog.captureException(e, distinctId); await posthog.shutdown(); }
        return json({ results: [], status: 'error', message: e.message }, 502, origin);
      }
    }

    // ── RunSignup race results search ─────────────────────────────────────
    if (path === '/import/runsignup' && request.method === 'POST') {
      const distinctId = request.headers.get('X-POSTHOG-DISTINCT-ID') || 'anon';
      const posthog = makePostHog(env);
      try {
        const body = await request.json().catch(() => ({}));
        const firstName = (body.firstName || '').trim();
        const lastName  = (body.lastName  || '').trim();
        if (!firstName || !lastName) {
          return json({ results: [], status: 'error', message: 'firstName and lastName required' }, 400, origin);
        }

        // RunSignup requires race_id for result lookup, but we can search for a participant
        // across races using their public participant search API.
        const searchUrl = `https://runsignup.com/Rest/race/results/search-participants?format=json&tmp=1&search_word=${encodeURIComponent(firstName + ' ' + lastName)}&results_per_page=50`;
        // The 404 endpoint hangs ~39s before responding; the wizard waits for all
        // sources, so bound this fetch to 6s and degrade gracefully on timeout.
        let searchRes;
        try {
          searchRes = await fetch(searchUrl, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(6000) });
        } catch {
          return json({ results: [], status: 'ok', note: 'runsignup_timeout' }, 200, origin);
        }
        if (!searchRes.ok) {
          // RunSignup has no keyless cross-race results search (this path 404s);
          // a real integration needs an api_key/api_secret. Degrade gracefully —
          // return an empty OK so the import wizard doesn't flag RunSignup as a
          // failed source (it just contributes nothing alongside the working
          // UltraSignup + MarathonView scrapers).
          return json({ results: [], status: 'ok', note: 'runsignup_api_key_required' }, 200, origin);
        }
        const data = await searchRes.json().catch(() => null);

        // Try multiple response shapes
        const participants = data?.participants ?? data?.race_results ?? data?.results ?? [];
        const results = [];
        for (const p of Array.isArray(participants) ? participants : []) {
          // Each participant may have multiple race results
          const entries = Array.isArray(p.results) ? p.results : [p];
          for (const e of entries) {
            const raceName = e.race_name || e.event_name || p.race_name || '';
            const dateRaw  = e.start_time || e.race_date || p.start_time || '';
            const timeRaw  = e.chip_time  || e.clock_time || e.finish_time || '';
            if (!raceName) continue;
            // Normalize date
            let date = '';
            if (dateRaw) {
              const d = new Date(dateRaw);
              if (!isNaN(d.getTime())) date = d.toISOString().slice(0, 10);
            }
            // Normalize time HH:MM:SS
            let time = '';
            if (timeRaw) {
              const m = String(timeRaw).match(/(\d+):(\d{2}):(\d{2})/);
              if (m) time = `${m[1]}:${m[2]}:${m[3]}`;
            }
            const distM = e.distance_meters || e.distance_m || null;
            results.push({ raceName, date, time, distance_m: distM, source: 'runsignup' });
          }
        }

        if (posthog) {
          posthog.capture({
            distinctId,
            event: 'race import searched',
            properties: { provider: 'runsignup', result_count: results.length },
          });
          await posthog.shutdown();
        }
        return json({ results, status: 'ok' }, 200, origin);
      } catch (e) {
        if (posthog) {
          posthog.captureException(e, distinctId);
          await posthog.shutdown();
        }
        return json({ results: [], status: 'error', message: e.message }, 502, origin);
      }
    }

    // ── Race Import: Coach Cox (IRONMAN / 70.3 cross-event name search) ───
    // coachcox.co.uk aggregates 14+ years of IRONMAN + 70.3 results with full
    // swim/bike/run splits. Public JSON API, one call returns every result for
    // a name across all events/years. This is the name-search source for tri.
    if (path === '/import/coachcox' && request.method === 'POST') {
      try {
        const { firstName, lastName } = await request.json().catch(() => ({}));
        const name = `${(firstName || '').trim()} ${(lastName || '').trim()}`.trim();
        if (!name) return json({ results: [], status: 'ok' }, 200, origin);

        const url = `https://www.coachcox.co.uk/wp-json/imstats/v1.90/athlete/search/quick/${encodeURIComponent(name)}`;
        const resp = await fetch(url, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
          // 10s: coachcox is ~1.3s warm but can exceed 6s on a cold cache hit.
          signal: AbortSignal.timeout(10000),
        });
        if (!resp.ok) throw new Error(`CoachCox ${resp.status}`);
        const rows = await resp.json();

        // seconds (string|number) → "H:MM:SS" / "M:SS"; empty/0 → '' (no split)
        const hms = (v) => {
          const secs = Number(v);
          if (!Number.isFinite(secs) || secs <= 0) return '';
          const h = Math.floor(secs / 3600);
          const m = Math.floor((secs % 3600) / 60);
          const s = Math.floor(secs % 60);
          return h > 0
            ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
            : `${m}:${String(s).padStart(2, '0')}`;
        };
        // Unix-seconds → YYYY-MM-DD (rd.s); fall back to parsing rd.d "1 Jun 2025"
        const toDate = (rd) => {
          if (rd && rd.s) {
            const d = new Date(Number(rd.s) * 1000);
            if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
          }
          return '';
        };
        const statusMap = { FIN: 'Finished', DNF: 'DNF', DNS: 'DNS', DQ: 'DSQ' };

        // Coach Cox /quick is a loose first-name search: "Pratik Desai" returns
        // every "Pratik *" (Kamat, Maniyar, ...). Require EXACT first AND last
        // token match against what the user typed so only their own results show.
        const norm = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
        const fn = norm(firstName);
        const ln = norm(lastName);
        const nameMatches = (athleteName) => {
          const toks = norm(athleteName).split(' ').filter(Boolean);
          if (!toks.length) return false;
          const first = toks[0];
          const last  = toks[toks.length - 1];
          if (fn && first !== fn) return false;   // first name must match exactly
          if (ln && last  !== ln) return false;   // last name must match exactly
          return true;
        };

        const results = [];
        for (const r of (Array.isArray(rows) ? rows : [])) {
          const raceName = r.rn || '';
          if (!raceName) continue;
          if (!nameMatches(r.n)) continue;   // drop loose first-name-only matches
          const isFull = r.rty === 'im';     // 'im' = full IRONMAN, 'him' = 70.3
          results.push({
            raceName,
            date:         toDate(r.rd),
            time:         hms(r.ot),
            distance_m:   isFull ? 226000 : 113000,
            sport:        'Triathlon',
            agLabel:      r.di || '',
            placing:      r.or  ? String(r.or)  : '',
            agPlacing:    r.odr ? String(r.odr) : '',
            outcome:      statusMap[r.fs] || '',
            // splits: swim (st) / bike (bt) / run (rt) — seconds
            splits: [
              { label: 'Swim', split: hms(r.st) },
              { label: 'Bike', split: hms(r.bt) },
              { label: 'Run',  split: hms(r.rt) },
            ].filter(s => s.split),
            source: 'coachcox',
          });
        }

        if (posthog) {
          posthog.capture({
            distinctId,
            event: 'race import searched',
            properties: { provider: 'coachcox', result_count: results.length, ...(sessionId && { $session_id: sessionId }) },
          });
          await posthog.shutdown();
        }
        return json({ results, status: 'ok' }, 200, origin);
      } catch (e) {
        if (posthog) { posthog.captureException(e, distinctId); await posthog.shutdown(); }
        return json({ results: [], status: 'error', message: e.message }, 502, origin);
      }
    }

    // ── Race Import: IRONMAN per-event (official competitor.com data) ──────
    // Given a competitor.com event id (stored in race_catalog as
    // competitor_event_id), returns ALL finishers for that one event in a
    // single upstream call, with full swim/T1/bike/T2/run splits. Powers the
    // race-picker flow: user picks a race → fetch event → filter by name.
    // Demand-driven cache: response cached at the edge (caches.default) keyed
    // by event id, so repeat imports of the same race hit zero upstream calls.
    if (path === '/import/ironman-event' && request.method === 'POST') {
      try {
        const { eventId } = await request.json().catch(() => ({}));
        if (!eventId || !/^[a-z0-9-]{36}$/i.test(eventId)) {
          return json({ results: [], status: 'error', message: 'valid eventId required' }, 400, origin);
        }

        const cache = caches.default;
        const cacheKey = new Request(`https://cache.breaktapes.com/ironman-event/${eventId}`);
        let upstream = await cache.match(cacheKey);

        if (!upstream) {
          const resp = await fetch(
            `https://labs-v2.competitor.com/api/results?wtc_eventid=${eventId}`,
            { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }, signal: AbortSignal.timeout(12000) },
          );
          if (!resp.ok) throw new Error(`competitor ${resp.status}`);
          const body = await resp.text();
          upstream = new Response(body, {
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
          });
          // Store a clone; cache TTL via Cache-Control (24h)
          await cache.put(cacheKey, upstream.clone());
        }

        const data = JSON.parse(await upstream.text());
        const rowsRaw = data?.resultsJson?.value ?? [];

        // "H:MM:SS"/"M:SS" passthrough; "0:00:00"/empty → '' (no split)
        const clean = (t) => {
          const s = (t || '').trim();
          return (!s || /^0(:00)*$/.test(s)) ? '' : s;
        };
        const statusOf = (r) => r.wtc_dnf ? 'DNF' : r.wtc_dns ? 'DNS' : r.wtc_dq ? 'DSQ' : 'Finished';

        const results = rowsRaw.map(r => {
          const c = r.wtc_ContactId || {};
          return {
            athlete:    c.fullname || `${c.firstname || ''} ${c.lastname || ''}`.trim(),
            firstName:  c.firstname || '',
            lastName:   c.lastname || '',
            city:       c.address1_city || '',
            country:    (r.wtc_CountryRepresentingId || {}).wtc_name || '',
            agLabel:    (r.wtc_AgeGroupId || {}).wtc_agegroupname || '',
            time:       clean(r.wtc_finishtimeformatted),
            placing:    r.wtc_finishrankoverall != null ? String(r.wtc_finishrankoverall) : '',
            genderPlacing: r.wtc_finishrankgender != null ? String(r.wtc_finishrankgender) : '',
            agPlacing:  r.wtc_finishrankgroup != null ? String(r.wtc_finishrankgroup) : '',
            outcome:    statusOf(r),
            bibNumber:  r.wtc_bibnumber != null ? String(r.wtc_bibnumber) : '',
            splits: [
              { label: 'Swim', split: clean(r.wtc_swimtimeformatted) },
              { label: 'T1',   split: clean(r.wtc_transition1timeformatted) },
              { label: 'Bike', split: clean(r.wtc_biketimeformatted) },
              { label: 'T2',   split: clean(r.wtc_transitiontime2formatted) },
              { label: 'Run',  split: clean(r.wtc_runtimeformatted) },
            ].filter(s => s.split),
          };
        }).filter(r => r.athlete);

        if (posthog) {
          posthog.capture({
            distinctId,
            event: 'race import event fetched',
            properties: { provider: 'ironman', event_id: eventId, result_count: results.length, ...(sessionId && { $session_id: sessionId }) },
          });
          await posthog.shutdown();
        }
        return json({ results, status: 'ok', count: results.length }, 200, origin);
      } catch (e) {
        if (posthog) { posthog.captureException(e, distinctId); await posthog.shutdown(); }
        return json({ results: [], status: 'error', message: e.message }, 502, origin);
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // ── Open Wearables unified API routes ─────────────────────────────────
    // All /ow/* routes proxy to the self-hosted OW instance on Railway.
    // OW_BASE_URL and OW_API_KEY are Worker secrets — never exposed to client.
    // ══════════════════════════════════════════════════════════════════════

    if (path.startsWith('/ow/')) {
      if (!env.OW_BASE_URL || !env.OW_API_KEY) {
        return json({ error: 'OW not configured — set OW_BASE_URL and OW_API_KEY secrets' }, 503, origin);
      }

      const ow = env.OW_BASE_URL.replace(/\/$/, '');
      const owKey = env.OW_API_KEY;

      // ── POST /ow/user — create or retrieve OW user ──────────────────────
      // Body: { clerk_user_id, email }
      // Returns: { id, external_user_id, email }
      if (path === '/ow/user' && request.method === 'POST') {
        try {
          const { clerk_user_id, email } = await request.json().catch(() => ({}));
          if (!clerk_user_id || !email) {
            return json({ error: 'clerk_user_id and email required' }, 400, origin);
          }
          // A user may only create/retrieve their OWN OW user — verified sub must match.
          const sub = await verifyClerkSub(request);
          if (!sub || sub !== clerk_user_id) return json({ error: 'Forbidden' }, 403, origin);
          // Try to find existing user first (OW does not deduplicate on external_user_id automatically)
          const listRes = await fetch(`${ow}/api/v1/users?search=${encodeURIComponent(email)}`, {
            headers: { 'X-Open-Wearables-API-Key': owKey },
          });
          if (listRes.ok) {
            const listData = await listRes.json();
            // OW paginates: { items: [...], total, page, ... }
            const items = Array.isArray(listData) ? listData : (listData.items ?? listData.users ?? []);
            const existing = items.find(u => u.external_user_id === clerk_user_id);
            if (existing) return json({ id: existing.id, email: existing.email }, 200, origin);
          }
          // Create new
          const createRes = await fetch(`${ow}/api/v1/users`, {
            method: 'POST',
            headers: { 'X-Open-Wearables-API-Key': owKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, external_user_id: clerk_user_id }),
          });
          const created = await createRes.json().catch(() => ({}));
          return json(created, createRes.status, origin);
        } catch (e) {
          return json({ error: e.message }, 502, origin);
        }
      }

      // ── GET /ow/connect — initiate provider OAuth ───────────────────────
      // Query: ow_user_id, provider, redirect_uri
      // Returns: { authorization_url }
      if (path === '/ow/connect' && request.method === 'GET') {
        const owUserId    = url.searchParams.get('ow_user_id');
        const provider    = url.searchParams.get('provider');
        const redirectUri = url.searchParams.get('redirect_uri');
        if (!owUserId || !provider || !redirectUri) {
          return json({ error: 'ow_user_id, provider, redirect_uri required' }, 400, origin);
        }
        if (!await verifyOwOwner(request, env, owUserId)) return json({ error: 'Forbidden' }, 403, origin);
        try {
          const authRes = await fetch(
            `${ow}/api/v1/oauth/${provider}/authorize?user_id=${owUserId}&redirect_uri=${encodeURIComponent(redirectUri)}`,
            { headers: { 'X-Open-Wearables-API-Key': owKey } },
          );
          const authData = await authRes.json().catch(() => ({}));
          return json(authData, authRes.status, origin);
        } catch (e) {
          return json({ error: e.message }, 502, origin);
        }
      }

      // ── POST /ow/purge — delete a provider's synced data + disconnect ────
      // Body: { ow_user_id, provider }
      // OW has no bulk per-provider purge, so we list the provider's events
      // (workouts + sleep) and delete each, then revoke the connection. The
      // user's source account is never touched (read-only). Timeseries samples
      // are not individually deletable via OW's API — full purge happens on
      // account deletion (DELETE user).
      if (path === '/ow/purge' && request.method === 'POST') {
        try {
          const { ow_user_id, provider } = await request.json().catch(() => ({}));
          if (!ow_user_id || !provider) {
            return json({ error: 'ow_user_id and provider required' }, 400, origin);
          }
          if (!await verifyOwOwner(request, env, ow_user_id)) return json({ error: 'Forbidden' }, 403, origin);
          const start = new Date(Date.now() - 5 * 365 * 86400000).toISOString();
          const end   = new Date().toISOString();
          const hdr   = { 'X-Open-Wearables-API-Key': owKey };
          let deleted = 0;

          // Delete workouts for this provider
          try {
            const wRes = await fetch(
              `${ow}/api/v1/users/${ow_user_id}/events/workouts?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}&limit=1000`,
              { headers: hdr },
            );
            const wBody = await wRes.json().catch(() => ({ data: [] }));
            const workouts = (wBody.data ?? wBody.workouts ?? []).filter(w => (w.provider ?? w.data_source) === provider);
            for (const w of workouts) {
              const id = w.id ?? w.external_id;
              if (!id) continue;
              const dr = await fetch(`${ow}/api/v1/users/${ow_user_id}/events/workouts/${id}`, { method: 'DELETE', headers: hdr });
              if (dr.ok) deleted++;
            }
          } catch { /* best-effort */ }

          // Delete sleep sessions for this provider
          try {
            const sRes = await fetch(
              `${ow}/api/v1/users/${ow_user_id}/events/sleep?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}&limit=1000`,
              { headers: hdr },
            );
            const sBody = await sRes.json().catch(() => ({ data: [] }));
            const sleeps = (sBody.data ?? sBody.sleep ?? []).filter(x => (x.provider ?? x.data_source) === provider);
            for (const s of sleeps) {
              const id = s.id ?? s.external_id;
              if (!id) continue;
              const dr = await fetch(`${ow}/api/v1/users/${ow_user_id}/events/sleep/${id}`, { method: 'DELETE', headers: hdr });
              if (dr.ok) deleted++;
            }
          } catch { /* best-effort */ }

          // Revoke the connection
          await fetch(`${ow}/api/v1/users/${ow_user_id}/connections/${provider}`, { method: 'DELETE', headers: hdr }).catch(() => {});

          return json({ ok: true, deleted }, 200, origin);
        } catch (e) {
          return json({ error: e.message }, 502, origin);
        }
      }

      // ── POST /ow/disconnect — revoke a provider connection ──────────────
      // Body: { ow_user_id, provider }
      if (path === '/ow/disconnect' && request.method === 'POST') {
        try {
          const { ow_user_id, provider } = await request.json().catch(() => ({}));
          if (!ow_user_id || !provider) {
            return json({ error: 'ow_user_id and provider required' }, 400, origin);
          }
          if (!await verifyOwOwner(request, env, ow_user_id)) return json({ error: 'Forbidden' }, 403, origin);
          // OW path: DELETE /api/v1/users/{user_id}/connections/{provider}
          const res = await fetch(`${ow}/api/v1/users/${ow_user_id}/connections/${provider}`, {
            method: 'DELETE',
            headers: { 'X-Open-Wearables-API-Key': owKey },
          });
          return json({ ok: res.ok }, res.ok ? 200 : res.status, origin);
        } catch (e) {
          return json({ error: e.message }, 502, origin);
        }
      }

      // ── GET /ow/connections — list connected providers for a user ───────
      // Query: ow_user_id
      // Returns: { connections: [{ provider, connected, last_sync }] }
      if (path === '/ow/connections' && request.method === 'GET') {
        const owUserId = url.searchParams.get('ow_user_id');
        if (!owUserId) return json({ error: 'ow_user_id required' }, 400, origin);
        if (!await verifyOwOwner(request, env, owUserId)) return json({ error: 'Forbidden' }, 403, origin);
        try {
          const res = await fetch(`${ow}/api/v1/users/${owUserId}/connections`, {
            headers: { 'X-Open-Wearables-API-Key': owKey },
          });
          const body = await res.json().catch(() => ([]));
          // OW returns a bare array of UserConnectionRead:
          //   { provider, status: 'active'|'revoked'|'expired', last_synced_at }
          const raw = Array.isArray(body) ? body : (body.connections ?? body.data ?? []);
          const connections = raw.map(c => ({
            provider: c.provider ?? 'unknown',
            connected: c.status === 'active',
            last_sync: c.last_synced_at ?? null,
          }));
          return json({ connections }, 200, origin);
        } catch (e) {
          return json({ connections: [] }, 200, origin);
        }
      }

      // ── GET /ow/workouts — normalized workouts across all providers ──────
      // Query: ow_user_id, since (ISO), limit (default 200)
      // Returns: { workouts: OWWorkout[] }
      // OW: GET /api/v1/users/{id}/events/workouts — start_date AND end_date
      //     both required; array is in response.data; paginated.
      if (path === '/ow/workouts' && request.method === 'GET') {
        const owUserId = url.searchParams.get('ow_user_id');
        if (!owUserId) return json({ error: 'ow_user_id required' }, 400, origin);
        if (!await verifyOwOwner(request, env, owUserId)) return json({ error: 'Forbidden' }, 403, origin);
        const since = url.searchParams.get('since') ?? new Date(Date.now() - 60 * 86400000).toISOString();
        const end   = new Date().toISOString();
        const limit = url.searchParams.get('limit') ?? '200';
        try {
          const qs = new URLSearchParams({ start_date: since, end_date: end, limit });
          const res = await fetch(
            `${ow}/api/v1/users/${owUserId}/events/workouts?${qs}`,
            { headers: { 'X-Open-Wearables-API-Key': owKey } },
          );
          const body = await res.json().catch(() => ({ data: [] }));
          const raw = body.data ?? body.workouts ?? body.results ?? [];
          // Normalize to OWWorkout shape
          const workouts = raw.map(w => ({
            id: w.id ?? w.external_id ?? String(Math.random()),
            provider: w.provider ?? w.data_source ?? 'unknown',
            sport_type: w.sport_type ?? w.activity_type ?? w.type ?? 'other',
            started_at: w.started_at ?? w.start_time ?? w.start_datetime ?? w.start_date ?? '',
            duration_seconds: w.duration_seconds ?? w.duration ?? 0,
            distance_meters: w.distance_meters ?? w.distance ?? null,
            average_heart_rate: w.average_heart_rate ?? w.avg_hr ?? null,
            name: w.name ?? w.title ?? null,
          }));
          return json({ workouts }, 200, origin);
        } catch (e) {
          return json({ workouts: [] }, 200, origin);
        }
      }

      // ── GET /ow/recovery — daily HRV + resting HR + recovery score ───────
      // Query: ow_user_id, days (default 14)
      // Returns: { recovery: OWRecovery[] }
      // OW's /summaries/recovery is "Not implemented" in current build. Recovery
      // metrics flow through /timeseries as typed samples. We pull the relevant
      // types and aggregate to one record per day (last sample wins per type).
      // NOTE: timeseries uses start_time/end_time (NOT start_date like summaries).
      if (path === '/ow/recovery' && request.method === 'GET') {
        const owUserId = url.searchParams.get('ow_user_id');
        if (!owUserId) return json({ error: 'ow_user_id required' }, 400, origin);
        if (!await verifyOwOwner(request, env, owUserId)) return json({ error: 'Forbidden' }, 403, origin);
        const days = parseInt(url.searchParams.get('days') ?? '14', 10);
        const since = new Date(Date.now() - days * 86400000).toISOString();
        const end   = new Date().toISOString();
        try {
          const qs = new URLSearchParams({ start_time: since, end_time: end });
          // types is a repeated query param
          ['heart_rate_variability_rmssd', 'resting_heart_rate', 'recovery_score', 'oxygen_saturation']
            .forEach(t => qs.append('types', t));
          const res = await fetch(
            `${ow}/api/v1/users/${owUserId}/timeseries?${qs}`,
            { headers: { 'X-Open-Wearables-API-Key': owKey } },
          );
          const body = await res.json().catch(() => ({ data: [] }));
          const samples = body.data ?? [];
          // Aggregate samples → { date: { type: value } }, last sample wins
          const byDate = {};
          for (const s of samples) {
            const date = (s.timestamp ?? '').slice(0, 10);
            if (!date) continue;
            (byDate[date] ??= {})[s.type] = s.value;
          }
          const recovery = Object.entries(byDate)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, v]) => ({
              date,
              hrv_rmssd: v.heart_rate_variability_rmssd ?? null,
              resting_heart_rate: v.resting_heart_rate ?? null,
              recovery_score: v.recovery_score ?? null,
              spo2: v.oxygen_saturation ?? null,
            }));
          return json({ recovery }, 200, origin);
        } catch (e) {
          return json({ recovery: [] }, 200, origin);
        }
      }

      // ── GET /ow/activity — daily steps + calories ─────────────────────────
      // Query: ow_user_id, days (default 14)
      // OW: GET /api/v1/users/{id}/summaries/activity — start_date AND end_date
      //     both required; array is in response.data.
      if (path === '/ow/activity' && request.method === 'GET') {
        const owUserId = url.searchParams.get('ow_user_id');
        if (!owUserId) return json({ error: 'ow_user_id required' }, 400, origin);
        if (!await verifyOwOwner(request, env, owUserId)) return json({ error: 'Forbidden' }, 403, origin);
        const days = parseInt(url.searchParams.get('days') ?? '14', 10);
        const since = new Date(Date.now() - days * 86400000).toISOString();
        const end   = new Date().toISOString();
        try {
          const qs = new URLSearchParams({ start_date: since, end_date: end });
          const res = await fetch(
            `${ow}/api/v1/users/${owUserId}/summaries/activity?${qs}`,
            { headers: { 'X-Open-Wearables-API-Key': owKey } },
          );
          const body = await res.json().catch(() => ({ data: [] }));
          const raw = body.data ?? body.days ?? body.results ?? [];
          const activity = raw.map(d => ({
            date: (d.date ?? d.day ?? d.summary_date ?? '').slice(0, 10),
            steps: d.steps ?? null,
            energy_kcal: d.energy ?? d.active_energy ?? null,
            distance_meters: d.distance ?? d.distance_meters ?? null,
          })).filter(d => d.date);
          return json({ activity }, 200, origin);
        } catch (e) {
          return json({ activity: [] }, 200, origin);
        }
      }

      // ── POST /ow/sync — trigger a manual sync for a user ─────────────────
      // Body: { ow_user_id, provider (optional) }
      if (path === '/ow/sync' && request.method === 'POST') {
        try {
          const { ow_user_id, provider } = await request.json().catch(() => ({}));
          if (!ow_user_id) return json({ error: 'ow_user_id required' }, 400, origin);
          if (!await verifyOwOwner(request, env, ow_user_id)) return json({ error: 'Forbidden' }, 403, origin);
          const syncPath = provider
            ? `${ow}/api/v1/providers/${provider}/users/${ow_user_id}/sync`
            : `${ow}/api/v1/users/${ow_user_id}/sync`;
          const res = await fetch(syncPath, {
            method: 'POST',
            headers: { 'X-Open-Wearables-API-Key': owKey },
          });
          const data = await res.json().catch(() => ({}));
          return json(data, res.status, origin);
        } catch (e) {
          return json({ error: e.message }, 502, origin);
        }
      }

      // Unknown /ow/* route
      return json({ error: `Unknown OW route: ${path}` }, 404, origin);
    }

    // ── Legacy GET proxy (catchall — kept for backwards compat) ───────────
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
    // Ownership gate: the caller's verified Clerk sub must own this OW user.
    // Without this, any path proxies to OW with the admin key for any user id.
    if (!await verifyOwOwner(request, env, owUserId)) {
      return json({ error: 'Forbidden' }, 403, origin);
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

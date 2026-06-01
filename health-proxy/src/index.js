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
    'Access-Control-Allow-Headers': 'Content-Type, X-OW-User-ID, X-POSTHOG-DISTINCT-ID, X-POSTHOG-SESSION-ID',
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
              place:    r.place || null,
              gender_place: r.gender_place || null,
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
        const { name } = await request.json();
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

        const fmtTime = (secs) => {
          if (!secs || !Number.isFinite(secs)) return '';
          const h = Math.floor(secs / 3600);
          const m = Math.floor((secs % 3600) / 60);
          const s = Math.floor(secs % 60);
          return h > 0
            ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
            : `${m}:${String(s).padStart(2, '0')}`;
        };

        const results = raceList.map(r => ({
          raceName:   r.event_name || r.race_name || 'Unknown Race',
          date:       r.date || '',
          time:       fmtTime(Number(r.result)),
          distance_m: r.distance,
          country:    r.event_country || '',
          raw:        [r.event_name, r.date, fmtTime(Number(r.result))],
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

      // ── POST /ow/disconnect — revoke a provider connection ──────────────
      // Body: { ow_user_id, provider }
      if (path === '/ow/disconnect' && request.method === 'POST') {
        try {
          const { ow_user_id, provider } = await request.json().catch(() => ({}));
          if (!ow_user_id || !provider) {
            return json({ error: 'ow_user_id and provider required' }, 400, origin);
          }
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

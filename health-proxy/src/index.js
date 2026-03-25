/**
 * breaktapes-health — Cloudflare Worker proxy for Open Wearables
 *
 * Sits between the Breaktapes frontend and the shared OW instance hosted on Railway.
 * Adds the OW API key (stored as a Worker secret) so it never touches the browser.
 *
 * Secrets required (set via `wrangler secret put`):
 *   OW_BASE_URL  — Railway OW instance URL, e.g. https://open-wearables.up.railway.app
 *   OW_API_KEY   — OW admin API key generated in the OW developer panel
 *
 * Request contract:
 *   Header: X-OW-User-ID  — the caller's Open Wearables user ID (stored in Supabase app_state)
 *   Path/query: forwarded as-is to OW (e.g. /api/v1/users/{uid}/summaries/recovery?...)
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

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // Reject unknown origins
    if (!ALLOWED_ORIGINS.has(origin)) {
      return new Response('Forbidden', { status: 403 });
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Only GET supported for now (all OW reads are GETs)
    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // Validate required secrets are configured
    if (!env.OW_BASE_URL || !env.OW_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OW proxy not configured — set OW_BASE_URL and OW_API_KEY secrets' }),
        { status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
      );
    }

    // Require a user ID
    const owUserId = request.headers.get('X-OW-User-ID');
    if (!owUserId) {
      return new Response(JSON.stringify({ error: 'Missing X-OW-User-ID header' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // Forward the request to OW (path + query string pass through unchanged)
    const incomingUrl = new URL(request.url);
    const owUrl = env.OW_BASE_URL.replace(/\/$/, '') + incomingUrl.pathname + incomingUrl.search;

    let owResponse;
    try {
      owResponse = await fetch(owUrl, {
        method: 'GET',
        headers: {
          'X-Open-Wearables-API-Key': env.OW_API_KEY,
          'Accept': 'application/json',
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'OW instance unreachable', detail: err.message }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
      );
    }

    const contentType = owResponse.headers.get('Content-Type') || 'application/json';
    const body = await owResponse.text();

    return new Response(body, {
      status: owResponse.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
        ...corsHeaders(origin),
      },
    });
  },
};

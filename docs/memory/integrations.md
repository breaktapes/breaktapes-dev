# BREAKTAPES — Integration Reference

> Part of the trunk memory docs. See `CLAUDE.md` at root for full context.
> Update this file when integrations are added, changed, or removed.

---

## Supabase

Two separate projects — production and staging data are fully isolated.

| Environment | Project name | URL | Anon key |
|---|---|---|---|
| **Production** | `breaktapes-prod` | `https://kmdpufauamadwavqsinj.supabase.co` | `sb_publishable_aXlZ54g7bW8dckyl3N-kCA_Jzy_Nt0B` |
| **Staging** | `breaktapes-dev` | `https://yqzycwuyhvzkbofwkazr.supabase.co` | `sb_publishable_XiI5lGzh_3rWoA2TxrKnWg_gPtPKSRp` |

- **Auth:** Email/password via Supabase Auth
- **SDK:** `@supabase/supabase-js@2` via CDN
- **Config selection:** `index.html` uses `window.location.hostname === 'app.breaktapes.com'` to pick prod vs staging credentials at runtime

### Staging restrictions
- Public sign-up is **disabled** on the staging Supabase project (`disable_signup: true`)
- To add a staging user: Supabase dashboard → `breaktapes-dev` project → Authentication → Users → Invite User
- The app UI also hides the Sign Up button when `hostname === 'dev.breaktapes.com'`

### Tables (both projects have identical schema via migrations)
| Table | RLS | Purpose |
|---|---|---|
| `app_state` | Yes (per user) | Serialized app state: races, settings, athlete profile |
| `race_catalog` | Public read | Global race database (~1,068+ rows) |
| `race_medal_community` | Public read / auth write | Community medal photos (race_id → photo URL) |

### Migrations
All migrations live in `supabase/migrations/`. Applied to both projects via `supabase link + supabase db push --linked`.
- Push to production: `supabase link --project-ref kmdpufauamadwavqsinj && supabase db push --linked`
- Push to staging: `supabase link --project-ref yqzycwuyhvzkbofwkazr && supabase db push --linked`

### State sync pattern
- On sign-in: `loadRemoteState()` pulls state from `app_state`
- On changes: `scheduleRemoteStateSync()` debounces writes to Supabase
- `buildRemoteStatePayload()` serializes RACES + settings + athlete profile
- `applyRemoteState(row)` deserializes and applies to local state

---

## Open-Meteo (Weather)

- **URL:** `https://api.open-meteo.com/v1/forecast`
- **Auth:** None (free, no key)
- **Usage:** Dashboard greeting — current conditions + 6-hour forecast
- **Parameters:** `latitude`, `longitude`, `hourly=temperature_2m,weathercode`, `forecast_days=2`, `timezone=auto`
- **Geolocation:** `navigator.geolocation.getCurrentPosition` — coords cached 1hr in `localStorage` key `bt_geo`
- **WMO codes:** `wmoIcon(code)` maps WMO weather codes to emoji

---

## Claude API (AI features)

- **Auth:** User-supplied API key stored in `localStorage` (`fl2_key`)
- **Model:** `claude-haiku-4-5` (fast, low cost)
- **Base function:** `callClaude(messages)` — minimal wrapper around Anthropic messages API
- **Usage points:**
  1. `parseAI()` — extract race data from pasted text
  2. `parsePhoto()` — extract race data from result screenshot (vision)
  3. `fetchCourseInfo(race)` — get terrain/surface/tip for a race
  4. `rdLookupRace()` — autocomplete/enrich race name input

---

## Leaflet.js (Maps)

- **Version:** 1.9.4 via CDN
- **Page:** `page-map`
- **Tile layer:** CartoDB Dark Matter (no key required)
- **Features:**
  - Race markers (custom orange dot markers)
  - Route polylines via OpenRouteService
  - Country polygon layer (hover highlight)
  - Tooltip on route hover and country hover
  - Drawer panel for race list per city

---

## OpenRouteService (Routing)

- **URL:** `https://api.openrouteservice.org/v2/directions/driving-car`
- **Auth:** API key (user-supplied or hardcoded — check `fetchAndDrawRoute`)
- **Usage:** Draw route lines between race cities on map
- **Caching:** Routes cached in `sessionStorage` by city pair
- **Failure mode:** Silent — if routing fails, no line is drawn

---

## Nominatim (Geocoding)

- **URL:** `https://nominatim.openstreetmap.org/search`
- **Auth:** None (free OSM service)
- **Usage:** Convert city+country names to lat/lng for map markers
- **Rate limiting:** Nominatim requires a `User-Agent` header and asks for max 1 req/sec

---

## Strava

- **Auth:** OAuth 2.0 (client-side PKCE flow)
- **Tokens:** Stored in `localStorage`
- **Token refresh:** `refreshStravaToken()` — client-side refresh
- **Usage:** Sync recent activities to Training page; match activities to races

---

## Open Wearables

- **Self-hosted:** User provides their own OW instance URL
- **Auth:** `X-Open-Wearables-API-Key` header
- **Config stored:** `localStorage` key `fl2_ow` → `{ url, key, uid }`
- **Base fetch:** `owFetch(path, params)` — adds auth header, returns JSON or null
- **Supported providers via OW:** Garmin, Whoop, Oura, Apple Health, and more
- **Endpoints used:**
  - `GET /api/v1/users/{uid}/summaries/recovery` — recovery score, HRV, RHR
  - `GET /api/v1/users/{uid}/summaries/sleep` — sleep score, duration
  - `GET /api/v1/users/{uid}/summaries/activity` — steps, active calories
  - `GET /api/v1/users/{uid}/metrics/vo2max` — VO2 max trend
  - `GET /api/v1/users/{uid}/workouts` — workout feed

---

## Cloudflare Workers (Deployment)

- **Config:** `wrangler.toml`
- **Account ID:** `b09f233e618dc7f23bcb247c947eb303`
- **Zone ID:** `7d1d8be858893e977e57b0455ed2388f`
- **Assets dir:** `public/` — contains only `index.html` (keep in sync with root `index.html`)

| Environment | Worker name | Route | Deploy command |
|---|---|---|---|
| Production | `breaktapes-app` | `app.breaktapes.com/*` | `wrangler deploy --env=""` |
| Staging | `breaktapes-app-staging` | `dev.breaktapes.com/*` | `wrangler deploy --env staging` |

- **Landing redirect worker:** `landing-worker/` — separate worker, routes `breaktapes.com/*` → 301 to `app.breaktapes.com`
- **DNS:** `dev.breaktapes.com` A record (proxied, 192.0.2.1) created 2026-03-24
- **Note:** `wrangler deploy` uses the OAuth session (not the `.env` CF_API_TOKEN). If deploy fails with auth error, run with `CLOUDFLARE_API_TOKEN="" CF_API_TOKEN="" wrangler deploy ...`
- **Note:** `.wranglerignore` is not respected in wrangler v4.76+ — use `assets.directory` pointing to a clean subdirectory instead

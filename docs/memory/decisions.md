# BREAKTAPES — Architecture & Design Decisions Log

> Running log of decisions made during development sessions.
> Add new entries at the top. Date format: YYYY-MM-DD.

---

## 2026-03-24 (session 2)

### Production / staging environment split
**Decision:** Two fully isolated environments — `app.breaktapes.com` (production) and `dev.breaktapes.com` (staging).
**Supabase:** Two separate projects. Data never crosses environments.
**Staging access:** Public sign-up disabled at Supabase level (`disable_signup: true` via Management API) AND at the UI level (Sign Up button hidden when `hostname === 'dev.breaktapes.com'`). Add users via Supabase dashboard invite.
**Runtime config selection:** `index.html` uses `window.location.hostname === 'app.breaktapes.com'` to choose the correct Supabase URL and anon key.
**Deploy:** Both environments use `wrangler deploy` with or without `--env staging`. Assets served from `public/` directory.

### Assets directory changed from `.` to `public/`
**Decision:** Wrangler serves static assets from `public/` not the repo root.
**Reason:** Wrangler v4.76 does not respect `.wranglerignore` for nested subdirectories. The `open-wearables/` project co-located in the repo root caused a "file too large" error. Serving from a clean `public/` subdirectory is the reliable fix.
**Implication:** After editing `index.html`, copy to `public/` before deploying: `cp index.html public/index.html`.

---

## 2026-03-24

### Single-file architecture (`index.html`)
**Decision:** Keep the entire app in one HTML file.
**Rationale:** Prototype speed, zero build tooling, easy to deploy as a static asset. Cloudflare Pages serves it directly.
**Trade-offs:** File is now 5,800+ lines. Navigation is done with Ctrl+F and comment markers. No tree-shaking, no module system.
**Status:** Intentional — do not split unless explicitly requested.

### No build toolchain
**Decision:** No bundler, no TypeScript, no framework.
**Rationale:** Prototype/MVP velocity. Everything is vanilla JS.
**Status:** Intentional. Do not introduce build steps without a clear request.

### Guest mode
**Decision:** Users can use the app without signing up ("Continue as Guest").
**Rationale:** Reduces friction for first-time users. Data stays in localStorage.
**Implication:** All data features must work in both authenticated and guest modes.

### C-priority race exclusion from progress chart
**Decision:** Races with `priority: 'C'` in `race_catalog` are excluded from the Progress Over Time chart.
**Rationale:** Small local fun-runs distort the trend line. C = low-priority / not a target race.
**They still appear in:** Race search dropdown, add race modal, all other views.

### Silent-fail async widgets
**Decision:** All async data widgets (weather, OW, map routes) silently hide themselves on error rather than showing an error state.
**Rationale:** These are enhancement features — the core app works without them. Error states add noise.
**Exception:** OW connection test (`testOWConnection`) does show explicit pass/fail — it's a user-initiated action.

### OW config stored client-side only
**Decision:** Open Wearables credentials stored in `localStorage`, never sent to Supabase.
**Rationale:** User's wearable API key is sensitive. No server-side storage needed since OW calls are made direct from the browser.

### Medal wall: uniform white spotlight over per-tier color
**Decision:** All medal tiers use a white spotlight effect, not gold/silver/bronze-colored spotlights.
**Rationale:** Color spotlights looked inconsistent when mixed with real medal photos. White spotlight works with all photo backgrounds.
**Commit:** `471bମedal wall: uniform white spotlight`

### Photo-first medal cards
**Decision:** If a community or user photo exists for a race, show the photo as the card background. SVG medal is a fallback.
**Rationale:** Real medal photos are more meaningful and visually interesting than generated SVGs.
**Implementation:** Community photos fetched from Supabase `race_medal_community`, merged with user-uploaded photos.

### Race catalog in Supabase (not hardcoded)
**Decision:** Race database lives in Supabase `race_catalog` table, fetched on app init.
**Previous state:** `RACE_DB` was a hardcoded JS array.
**Rationale:** Allows updates without a code deploy. Can be maintained independently.
**Commit:** `5ea4ac2`

### Auth render guard
**Decision:** Dashboard is hidden (opacity 0, no pointer events) until Supabase auth resolves.
**Rationale:** Prevents flash of empty/wrong state on load.
**Implementation:** CSS class toggled by `initAuth()` callback.
**Commit:** `12ff4c7`

### Geolocation caching
**Decision:** Cache browser geolocation coords for 1 hour.
**Rationale:** Browser prompts user for location permission every page load if coords aren't cached. Annoying UX.
**Storage:** `localStorage` key `bt_geo` with timestamp.
**Commit:** `9c99b48`

### Map: routes over arcs
**Decision:** Replace SVG arc lines with real Leaflet polylines from OpenRouteService.
**Rationale:** Arcs were cosmetic and not anchored to actual geography. Routes look more real and informative.
**Trade-off:** ORS rate limits + latency. Mitigated by sessionStorage caching.
**Commit:** `de1c616`

### Safari autofill fix
**Decision:** Use `autocomplete="new-password"` + `readonly` attribute trick on password inputs.
**Rationale:** Safari aggressively autofills any input with `type="password"` even when `autocomplete="off"`.
**Do not revert:** This fix is load-bearing for Safari users.
**Commit:** `2fa1d33`, `742d179`

### Landing screen for unauthenticated users
**Decision:** Show a branded landing screen before the app if user is not authenticated.
**Copy:** "Track Every Finish Line." / "Log your marathons, triathlons, ultras and more."
**Features listed:** Race Log, Medal Wall, Personal Bests, Race Countdown, Flatlays
**Commit:** `cb291e2`, `d3d6918`

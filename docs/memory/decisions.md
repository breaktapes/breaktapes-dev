# BREAKTAPES — Architecture & Design Decisions Log

> Running log of decisions made during development sessions.
> Add new entries at the top. Date format: YYYY-MM-DD.

---

## 2026-06-04 (session 41)

### Render the login screen during Clerk `!isLoaded` instead of a blocking loader
**Decision:** While Clerk boots (`!isLoaded`), `AuthGate` renders the real `<LandingScreen>` for likely-logged-out visitors (gated on the `__client_uat` cookie hint) rather than the `AuthLoadingScreen` pulsing dot. Signed-in users (cookie present, non-zero) still get the loader to avoid a login flash.
**Rationale:** The old hard gate made the LCP element a pulsing dot — real content (headline text) couldn't paint until Clerk's network round-trip resolved (P50 3.3s, P99 11s). Most first-time visitors are logged out, so painting the login screen immediately gives instant text LCP. The cookie is a synchronous, first-party JS-readable hint; worst case is a brief flash, never a broken state (once `isLoaded` resolves, `isSignedIn` decides the real screen).
**Tradeoff:** Signed-in users with no `__client_uat` (cleared cookies, fresh device) see a brief login-screen flash before the dashboard. Accepted — rare, and cheaper than the universal LCP penalty.

### `index.html` owns all render hints; fonts via `<link>`, never CSS `@import`
**Decision:** Preconnect/dns-prefetch `clerk.breaktapes.com` and load Google Fonts via `<link>` in the root `index.html`. Fonts are NOT a CSS `@import`.
**Rationale:** A CSS `@import` chains behind the CSS-bundle download before the font request even starts → late text LCP. `<link>` in the head + preconnect lets the browser warm the font origin and Clerk's FAPI domain before the JS bundle requests them. (`public/index.html` is a stale legacy vanilla-app artifact and is NOT the React template — don't be misled by its preconnects.)

### Drive landing scroll-progress from a CSS var, not React state
**Decision:** The scroll-progress bar reads a `--pl-progress` CSS var written on `#landing-screen` each scroll frame; `navVisible`/`screen` commit React state only on change. `.pl-parallax` gets `will-change: transform`.
**Rationale:** Per-frame `setProgress` re-rendered the entire 1,400-line `LandingPage` tree on every scroll frame (scroll jank, inflated INP). A CSS var write touches no React. `will-change` GPU-composites the GSAP parallax transform so its late y-shift isn't counted as CLS.

## 2026-06-02 (session 38)

### Triathlon Predictor: empirical-over-engine blend
**Decision:** Predict tri splits/finish by blending two signals — recency-weighted Riegel projection from the athlete's own recent tri leg splits (empirical) and a running-PB engine fallback for the run leg — weighted by `α = nEff/(nEff+2)`.
**Rationale:** The athlete's real tri splits already encode race pacing + brick fatigue, so they beat any fresh-TT model when data exists; new users have none, so the model degrades gracefully. `α` grows with same-distance tris logged (cross-distance samples count half) — cold-start leans engine, seasoned triathletes lean on their own history.
**Mechanics:** Per-leg Riegel exponents swim 1.02 / bike 1.04 / run 1.06; 1yr half-life recency decay; cross-distance samples downweighted ×0.6 and widen the confidence band. Transitions = weighted avg of actual T1/T2 else per-distance default.
**Reusable pattern:** "use the athlete's own data when they have it, fall back to a model when they don't" with a confidence band that widens as `α→0` and on cross-distance extrapolation.
**Where:** `src/lib/triFormulas.ts` (`predictTriathlon`), `TriPredictorWidget` in Dashboard.tsx.
**Version:** v0.7.2.0 (PR #419 → #420)

---

## 2026-04-26 (session 27)

### Single `state_json` JSONB blob on `user_state` (not per-slice columns)
**Decision:** Cross-device app state is stored as one JSONB column `state_json` on `public.user_state`. Read-merge-write upsert from `src/lib/syncState.ts`. Realtime subscription in `src/hooks/useSyncState.ts` invalidates the React Query cache on any `postgres_changes` event for the user's row.
**Rationale:** Adding new persisted slices (wishlist, season plans, focus race id) requires only a payload change — no schema migration. Single source of truth simplifies the public-profile SSR Worker too.
**Trade-off:** Loses Postgres-level field validation. Acceptable because client owns the type contract anyway.
**Migration:** `supabase/migrations/20260426000000_user_state_state_json.sql`
**Commit:** `5a1b7c5` (PR #230)

### Two focus-race setters with different sync semantics
**Decision:** `useRaceStore` exposes both `setFocusRaceId` (silent, no sync) and `pinFocusRace` (sets + `syncStateToSupabase()`).
**Rationale:** The remote-pull path applies server state via `setFocusRaceId` so it does not echo back as a write — preventing infinite sync loops. User-initiated focus-pin actions call `pinFocusRace` so the change crosses devices.
**Implication:** Future call sites must match intent, not just signature. Renaming one to the other will silently regress cross-device sync (caught and reverted in PR #231 ship).

### Race-day completion via `dismissExpiredRace` + `ViewEditRaceModal` edit-mode
**Decision:** Race-day pill renders "✓ Mark Completed · Log Result" when `daysUntil(race.date) === 0`. Click moves the race upcoming → past via existing `dismissExpiredRace(race.id)`, then opens `ViewEditRaceModal` with new `initialMode='edit'` prop so the user lands directly in the result-entry form.
**Rationale:** Reuses existing store action and modal — no new abstractions. Preserves the race's identity (name, date, distance, location, gear, goalTime) instead of forcing the user to re-enter via `AddRaceModal` (which is the older `ExpiredRacePrompts` flow). Different audience: race-day completion vs days-after expiry.
**Commit:** `a80d7e3` (PR #231)

---

## 2026-03-24 (session 4)

### gstack skills bundled in repo
**Decision:** gstack (`https://github.com/garrytan/gstack.git`) committed to `.claude/skills/gstack/`. Skill symlinks created at `.claude/skills/<skill>` for Claude Code discovery.
**Reason:** Teammates get all gstack skills automatically on clone — no separate install step needed. They run `cd .claude/skills/gstack && ./setup` once to build the browser binary.
**Web browsing rule:** Always use `/browse` skill. Never use `mcp__claude-in-chrome__*` tools directly.
**`.gitignore` fix:** Changed `.claude/` to `.claude/*` + `!.claude/skills/` to allow skills to be tracked while keeping the rest of `.claude/` private (worktrees, projects, etc.).

### Cloudflare API token (pipeline)
**Decision:** Use a proper Cloudflare API token (not the wrangler OAuth session token) for `CLOUDFLARE_API_TOKEN` GitHub secret.
**Reason:** The wrangler OAuth token (`oauth_token` in `~/.wrangler/config/default.toml`) is a user session token — it expires and returns `Invalid access token [code: 9109]` when used as `CLOUDFLARE_API_TOKEN`. A proper API token created at `dash.cloudflare.com → My Profile → API Tokens` works reliably.
**Token format:** Starts with `cfut_` (custom token) or `cf_` (legacy). The OAuth token starts with `OGLPAC` — do not use that.
**If token expires:** Create a new one at `dash.cloudflare.com/profile/api-tokens` with Edit Cloudflare Workers template, then update `CLOUDFLARE_API_TOKEN` GitHub secret.

### Supabase DB password management
**Decision:** Both staging and prod DB passwords managed via Supabase Management API: `PATCH https://api.supabase.com/v1/projects/{ref}/database/password` with `Authorization: Bearer <SUPABASE_ACCESS_TOKEN>`.
**Reason:** Dashboard resets are manual and error-prone. API reset is scriptable and instant (though password propagation takes ~60s before the new password works).
**Staging password:** `Bt2026Stg!xK9mRnQvLzWp3hY7sD` (reset 2026-03-24)
**Prod password:** `Bt2026Prod!xK9mRnQvLzWp3hY7sD` (reset 2026-03-24)
**Watch out:** Password changes take ~60 seconds to propagate. Re-running a failed pipeline immediately after a reset will still fail — wait 60s first.

---

## 2026-03-24 (session 3)

### CI/CD pipeline via GitHub Actions
**Decision:** Three GitHub Actions workflows in `.github/workflows/`.
- `ci.yml` — runs on all PRs to `staging` or `main`; validates HTML markers, file size, wrangler config
- `deploy-staging.yml` — triggers on push to `staging`; pushes Supabase migrations + deploys to `dev.breaktapes.com`
- `deploy-production.yml` — triggers on push to `main`; pushes Supabase migrations + deploys to `app.breaktapes.com`

**Branch strategy:** `feature → staging → main`. `staging` is a permanent protected branch — the stable pre-production environment. `main` is production-only.

**Concurrency:** Staging deploys cancel-in-progress (fast iteration). Production deploys never cancel (`cancel-in-progress: false`) — a deploy in flight always finishes.

**Supabase migrations in pipeline:** Auto-pushed on every deploy using `supabase link + supabase db push --yes`. Both environments get migrations independently, preventing schema drift.

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

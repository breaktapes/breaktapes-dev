# BREAKTAPES — Claude Project Memory (Trunk)

> **Instruction:** After every commit merged to `main`, update this file and all memory documents under `docs/memory/` to reflect new learnings, architectural changes, and session decisions. Keep these files current — they are the source of truth for every Claude session.

---

## gstack

gstack is installed at `.claude/skills/gstack` (committed to this repo — teammates get it automatically on clone).

**Web browsing:** Always use `/browse` for any web browsing tasks. Never use `mcp__claude-in-chrome__*` tools directly.

**Available skills:**

| Skill | Purpose |
|---|---|
| `/browse` | Web browsing |
| `/office-hours` | Engineering office hours |
| `/plan-ceo-review` | CEO review planning |
| `/plan-eng-review` | Engineering review planning |
| `/plan-design-review` | Design review planning |
| `/design-consultation` | Design consultation |
| `/design-review` | Design review |
| `/review` | Code review |
| `/ship` | Ship a feature |
| `/land-and-deploy` | Land and deploy |
| `/canary` | Canary deploy |
| `/qa` | QA |
| `/qa-only` | QA only |
| `/benchmark` | Benchmarking |
| `/retro` | Retrospective |
| `/investigate` | Investigation |
| `/document-release` | Document a release |
| `/codex` | Codex |
| `/cso` | CSO |
| `/autoplan` | Auto planning |
| `/careful` | Careful mode |
| `/freeze` | Freeze |
| `/guard` | Guard |
| `/unfreeze` | Unfreeze |
| `/setup-browser-cookies` | Set up browser cookies |
| `/setup-deploy` | Set up deploy |
| `/gstack-upgrade` | Upgrade gstack |

**If gstack skills aren't working** (e.g. binary missing after a fresh clone), rebuild with:
```bash
cd .claude/skills/gstack && ./setup
```

---

## Project Overview

**BREAKTAPES** is a single-page app for endurance athletes to track race history, medals, personal bests, upcoming races, and wearable health data.

| Environment | URL | Purpose |
|---|---|---|
| Production | `app.breaktapes.com` | Live users — open sign-up |
| Staging | `dev.breaktapes.com` | Testing — invite-only, no public sign-up |

- **Hosting:** Cloudflare Workers (static assets) via `wrangler.toml`
  - Account ID: `b09f233e618dc7f23bcb247c947eb303`
  - Zone ID: `7d1d8be858893e977e57b0455ed2388f`
  - Assets served from `public/` directory (contains only `index.html`)
- **Production Supabase:** `https://kmdpufauamadwavqsinj.supabase.co` (project: `breaktapes-prod`)
- **Staging Supabase:** `https://yqzycwuyhvzkbofwkazr.supabase.co` (project: `breaktapes-dev`)
- **Local preview:** `python3 -m http.server 3000` (serves from root; access `index.html` directly)

### Release pipeline (automated via GitHub Actions)

```
feature-branch
    │
    ▼  PR merge
 staging  ──► auto-deploy → dev.breaktapes.com  +  staging DB migrations
    │
    ▼  PR merge
  main  ──────► auto-deploy → app.breaktapes.com  +  prod DB migrations
```

| Workflow file | Trigger | Action |
|---|---|---|
| `.github/workflows/ci.yml` | PR opened/updated targeting `staging` or `main` | Validates HTML, markers, wrangler config |
| `.github/workflows/deploy-staging.yml` | Push to `staging` branch | Supabase migrations + `wrangler deploy --env staging` |
| `.github/workflows/deploy-production.yml` | Push to `main` branch | Supabase migrations + `wrangler deploy --env=""` |

**Reference note for all future deploy/push/pull instructions:** treat `staging` as `dev.breaktapes.com` and treat `main` / production as `app.breaktapes.com`.

### Manual deploy (emergency / local)
```bash
cp index.html public/index.html

# Staging
CLOUDFLARE_API_TOKEN="" CF_API_TOKEN="" wrangler deploy --env staging

# Production
CLOUDFLARE_API_TOKEN="" CF_API_TOKEN="" wrangler deploy --env=""
```

### Required GitHub Secrets
`CLOUDFLARE_API_TOKEN` · `SUPABASE_ACCESS_TOKEN` · `SUPABASE_PROD_PROJECT_REF` · `SUPABASE_PROD_DB_PASSWORD` · `SUPABASE_STAGING_PROJECT_REF` · `SUPABASE_STAGING_DB_PASSWORD`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JS — single file (`index.html`) |
| Map | Leaflet.js 1.9.4 |
| Backend | Supabase (auth + postgres + storage) |
| Deployment | Cloudflare Pages (wrangler) |
| Fonts | Barlow Condensed (headlines) + Barlow (body) |
| Weather | Open-Meteo API (free, no key required) |
| AI parsing | Claude API (user-supplied key, stored in localStorage) |
| Routing/geocode | OpenRouteService + Nominatim |

---

## Architecture

### Worker entry point (`worker/index.js`)
Cloudflare Worker that intercepts public profile routes before serving static assets:
- `GET /u/:username` → `handleProfile()` → SSR public athlete profile HTML
- `GET /u/:username/race/:id` → `handleRaceCard()` → SSR individual race card HTML
- All other routes → `env.ASSETS.fetch(request)` (serves `index.html` SPA)

OG image Worker (`og-worker/index.js`) runs separately at `health.breaktapes.com/og/u/:username`. Deployed independently via `cd og-worker && CF_API_TOKEN="" wrangler deploy`.

### Single-file structure (`index.html`)
The entire app lives in one HTML file (~22,900 lines). Sections are organized as:
1. CSS tokens / reset / component styles
2. HTML markup (pages, modals, landing screen)
3. JavaScript (data, auth, render functions, integrations)

### Page system
Pages use `id="page-*"` with `.page` / `.page.active` CSS classes. Navigation is handled by `go(page)` which sets active class and calls `render(page)`.

Pages: `dashboard`, `history`, `medals`, `map`, `athlete`, `train`, `wishlist`, `flatlay`, `pace`

### State management
- Local state: `localStorage` via `sv(k,v)` helper
- Remote state: Supabase `app_state` table (synced on auth)
- Race data: `RACES` array (in-memory), synced to Supabase
- Auth: Supabase Auth (email/password) — authenticated-only app, no guest mode

### Supabase tables
| Table | Purpose |
|---|---|
| `app_state` | Per-user app state (races, settings, athlete profile) |
| `race_catalog` | Global race database (~1,068+ rows, searchable) |
| `race_medal_community` | Community-uploaded medal photos |
| `beta_feedback` | Staging-only: star ratings + messages from beta testers |
| `wearable_tokens` | OAuth tokens for WHOOP/Garmin — per-user, per-provider, RLS protected |
| `apple_health_data` | Apple Health imported records grouped by date — per-user, RLS protected |
| `profile_views` | Public profile view counts keyed by username — anon readable, service-role writable |

**Note:** The table is named `user_state` (not `app_state`) — confirmed from `buildRemoteStatePayload()` in index.html. `user_state` has `username TEXT UNIQUE` and `is_public BOOLEAN` columns added in migration `20260409120000`.

---

## Design System

### Color tokens
```
--black:      #000000
--white:      #F5F5F5
--orange:     #FF4D00      (primary accent)
--orange-dim: rgba(255,77,0,0.12)
--orange-glow:rgba(255,77,0,0.25)
--green:      #00FF88      (secondary accent)
--surface:    #0D0D0D
--surface2:   #141414
--surface3:   #1A1A1A
--border:     rgba(245,245,245,0.06)
--border2:    rgba(245,245,245,0.12)
--muted:      rgba(245,245,245,0.35)
--muted2:     rgba(245,245,245,0.18)
```

### Medal tier colors
- Gold: `#FFD770` / `#B8860B` / `#FFF0A0`
- Silver: `#C8D4DC` / `#6A7880` / `#E8F0F4`
- Bronze: `#CD8C5A` / `#7A4420` / `#F0C090`
- Finisher: uses `--orange`

### Typography
- Headlines: `Barlow Condensed` (700/800/900 weight), uppercase, tracked
- Body: `Barlow` (400/500/600)

### Component patterns
- Buttons: `.cta-btn` (orange fill), ghost variants
- Cards: dark surface (`--surface2`/`--surface3`) with subtle border
- Modals: slide-up with backdrop blur, `.open` class toggle
- Grain texture overlay on `body::after` (z-index 9999, mix-blend-mode overlay)
- All borders: thin 1px with very low opacity white

---

## Frontend Design System

All frontend work MUST conform to `DESIGN.md` in the repo root.

**Rule:** Read `DESIGN.md` before making any frontend change. Do not deviate from it without explicit user approval.

`DESIGN.md` covers: color tokens, typography scale, spacing grid, breakpoints, navigation patterns, icon style, modal patterns, form validation, empty states, accessibility requirements, iOS safe area, and brand copy voice.

---

## Key Functions Reference

| Function | Purpose |
|---|---|
| `go(page)` | Navigate to a page |
| `render(p)` | Dispatch page render |
| `renderDash()` | Build dashboard view |
| `renderMedals()` | Build medal wall |
| `renderRaces()` | Render Races page: calls renderRacesSheet() + renderMap() |
| `renderRacesSheet()` | Build bottom sheet race list (year filter, compact/detailed rows, stats) |
| `renderRacesYearTabs()` | Render year filter tabs from race data |
| `expandRacesSheet()` / `collapseRacesSheet()` | Toggle bottom sheet peek ↔ expanded state |
| `buildCompactRow(r, pb, triPB)` | One-line race row (name/city/date \| time/dist) with PB gradient |
| `buildDetailedRow(r, pb, triPB)` | Card race row with PB/medal/terrain/A-Race tags |
| `openRaceShareCard()` | Open share modal; draws canvas 1200×630 race passport card |
| `renderHistory()` | Build race history list — still used by season planner; no longer called from renderRaces() |
| `renderAthlete()` | Build athlete profile |
| `renderMap()` | Init Leaflet map + arc routes (zoom 1.5, world view); always full-viewport on races page |
| `renderTrain()` | Build Train hub (Pace / Activities / Wearables sub-tabs) |
| `renderGreeting()` | Weather + time greeting |
| `initAuth()` | Bootstrap Supabase auth |
| `loadRaceCatalog()` | Fetch race DB from Supabase |
| `syncRemoteState()` | Push/pull app state to Supabase |
| `callClaude(messages)` | Hit Claude API for AI features |
| `buildPBMap()` | Compute personal bests |
| `submitRace()` | Add race to RACES array |
| `deleteRace(id)` | Remove race |
| `openRaceDetail(id)` | Open race detail modal (edit existing race) |
| `openRaceDetailFromParsed(obj)` | Open race detail modal pre-filled from AI/screenshot parsed data (new race flow) |
| `saveRaceDetail()` | Save race detail modal — branches on `_rdIsNew` flag (create vs update) |
| `_collectRdFields()` | Collect all raceDetailModal form values into a plain object |
| `recalcSplits()` | Walk splits table, sum split times, write cumulative cells (preserves rows with no split) |
| `importResultsScreenshot()` | Claude vision API call to parse race results photo → populate finish time, placing, splits |
| `rdLookupRace()` | Auto-fill race details — catalog-first (free/instant), falls back to Claude API |
| `rdApplyCatalogSuggestion(idx)` | Fill race form from catalog entry (name, type, distance, city, country, date) |
| `rdOnNameInput()` | Race name autocomplete — searches raceDb catalog + user's own races |
| `renderSparklineSVG(values, w, h, color)` | Generate inline SVG sparkline string for widget charts |
| `geocodeCityIfNeeded(city, country)` | Geocode a city with Nominatim (rate-limited, cached in `fl2_geocache`) |
| `parsePlacing(str)` | Parse "342/5000" placing strings → `{pos, total, percentile}` |
| `computeStreak(activities)` | Calculate current + longest training streak from Strava activities |
| `classifyPacing(race)` | Classify a race as positive/negative/even split from splits data |
| `computePacingIQ()` | Aggregate pacing persona across all races with splits |
| `computeMomentum()` | Weighted career momentum score from recent race times vs PBs |
| `renderRaceDayForecast()` | Fetch Open-Meteo forecast for next race location + date |
| `computeAgeGrade(race)` | Calculate WA age-grade percentage for a race result |
| `renderAgeGradeWidget()` | Render age-grade trajectory widget on dashboard |
| `renderAgeGradeChart()` | Render age-grade history chart on Athlete page |
| `fetchRaceWeather(race)` | Fetch historical weather for a past race via Open-Meteo archive API |
| `computeRaceDNA()` | Aggregate race conditions (weather, surface, elevation) across all races |
| `renderRaceDNA()` | Render Race DNA widget with condition breakdown |
| `setMapMode(mode)` | Switch map between default and performance overlay modes |
| `applyMapPerformanceMode(enabled)` | Apply/remove performance color overlay on race map markers |
| `getPerformanceColor(percentile)` | Map percentile → color for performance map overlay |
| `getCityPerformanceSummary(cityKey)` | Aggregate performance stats for a city across all races |
| `saveWearableToken(provider, tokenObj)` | Supabase upsert to `wearable_tokens` for authenticated user |
| `removeWearableToken(provider)` | Delete wearable token for provider from Supabase |
| `loadWearableTokens()` | Load all wearable tokens for current user into `whoopData`/`garminData` |
| `startWhoopOAuth()` | Redirect to WHOOP OAuth consent with state='whoop' |
| `handleWhoopCallback()` | Detect `?state=whoop&code=`, POST to `/whoop/token`, save to Supabase |
| `refreshWhoopToken()` | Rotate WHOOP access token using refresh token (auto-called 60s before expiry) |
| `fetchWhoopActivities(limit)` | GET WHOOP workout activities via access token |
| `fetchWhoopRecovery(limit)` | GET WHOOP recovery scores via access token |
| `startGarminOAuth()` | Generate PKCE verifier/challenge, store verifier in sessionStorage, redirect to Garmin |
| `handleGarminCallback()` | Detect `?state=garmin&code=`, POST to `/garmin/token` with PKCE verifier |
| `refreshGarminToken()` | Rotate Garmin access token using refresh token |
| `fetchGarminActivities(limit)` | GET Garmin wellness activities (90-day window) |
| `handleAppleHealthImport(file)` | Handle .xml/.json upload; routes to streaming path for files > 500 MB |
| `parseAppleHealthXML(file)` | Regex-based `<Record>` extractor for Apple Health XML (files < 500 MB) |
| `importAppleHealthXMLStreaming(file, label)` | 8 MB FileReader chunks for files > 500 MB; sort-independent date flushing; upserts to Supabase incrementally |
| `saveAppleHealthData(records)` | Group records by date, upsert in 100-row batches to `apple_health_data` |
| `renderWearables()` | Render 5 integration cards in Wearables tab (WHOOP, Garmin, COROS, Oura, Apple Health) |
| `renderWearablesFeed()` | Parallel fetch WHOOP+Garmin activities, sort by date, render activity cards |
| `whoopSportName(id)` | Map WHOOP sport_id integer to human-readable sport name |
| `renderAthleteBriefing()` | State-aware hero card at top of dashboard — 4 states: Welcome / Pre-Race / Just Finished / No Upcoming Race |
| `checkUsernameAvailability(username)` | Debounced Supabase query to check if username is taken; updates availability indicator in Settings |
| `onUsernameInput()` | Debounced handler for username field input — validates format, triggers availability check |
| `onIsPublicToggle()` | Handles is_public toggle switch; disabled until username is saved |
| `updateProfileLinkPreview()` | Shows/hides profile link preview in Settings based on username + is_public state |
| `copyProfileLink()` | Copies `app.breaktapes.com/u/{username}` to clipboard + shows toast |
| `updateShareProfileButton()` | Shows/hides share button on athlete page — visible only when username set + is_public = true |
| `getDashZoneCollapse()` | Read `fl2_dash_zone_collapse` from localStorage; returns default state (NOW+RECENTLY expanded) if unset or invalid |
| `saveDashZoneCollapse(state)` | Persist accordion collapse state object to `fl2_dash_zone_collapse` in localStorage |
| `initDashAccordion()` | Attach single delegated click listener on dashboard page for zone accordion; idempotent (guards with `_accordionInit` flag) |
| `getDashLayout()` | Return array of `{id, enabled}` widget config; migration v2 handles legacy layout formats |
| `renderTaperTimeline(planItems)` | Generate inline SVG taper/recovery timeline for Season Planner; returns empty string if < 2 valid items or data is missing |
| `deleteSeasonPlan(planId)` | Remove a saved season plan by ID, persist, sync, re-render saved list, show toast |
| `autoSuggestPriorities()` | Assign A/B/C priorities to future upcoming races by distance rank (IM=10 → A, Marathon=7 → A/B, 5K=2 → C); updates `data-planner-priority` selects in-place |
| `renderSeasonYearCompare()` | Render prev year vs current year race count side-by-side in `#seasonPlannerYearCompare`; noop if no races in either year |
| `computeSeasonPlan(upcoming)` | Build taper/recovery plan for future races; includes `goalTime`, `goalPace`, peak week conflict warnings, future-only filter |
| `loadSavedSeasonPlan(planId)` | Apply saved plan priorities to `upcomingRaces`; ID-first match, name+date fallback; shows toast with match count |
| `openSeasonPlannerModal()` | Open Season Planner modal; auto-prunes past events from `upcomingRaces` on open |
| `saveSeasonPlanDraft(name, items)` | Save season plan to `seasonPlans`; uses `crypto.randomUUID()` for Supabase-compatible UUID IDs |

---

## Testing

- **Test runner:** Jest + jsdom (`npm test` or `npm run test:coverage`)
- **Test files:** `tests/utils.test.js` (pure functions), `tests/navigation.test.js` (go() + scroll behaviour)
- **Loader:** `tests/spa-loader.js` — loads `index.html` into jsdom, exposes globals via `window`
- **Coverage:** `npm run test:coverage` → `coverage/` directory
- **218 tests, all green** as of Session 13
- Functions tested: `timeToSecs`, `secsToHMS`, `buildPBMap`, `parsePlacing`, `computeStreak`, `computeMomentum`, `computePacingIQ`, `computeAgeGrade`, `classifyPacing`, `go()` scroll + page switching + nav state, `whoopSportName`, `parseAppleHealthXML`, all wearable function smoke tests, `getDashZoneCollapse`, `saveDashZoneCollapse`, `getDashLayout`, `renderAthleteBriefing`
- `tests/wearables.test.js` added in Session 10 — 15 tests for wearable integration functions
- `tests/dash-layout.test.js` added in Session 11 — 13 tests for `getDashZoneCollapse`, `saveDashZoneCollapse`, `getDashLayout` migration v2
- `tests/athlete-briefing.test.js` added in Session 11 — 17 tests for `renderAthleteBriefing` all 4 states

---

## External Integrations

### Supabase Auth
- Email/password sign-up and sign-in — authenticated-only (no guest mode)
- Forgot password flow via Supabase `sendPasswordResetEmail` (8s timeout guard)
- New user onboarding: profile-first flow — new sign-ups go to `page-athlete`, welcome banner shows X/7 field progress, edit modal auto-opens after 300ms (once per device via `bt_modal_shown` flag), banner resolves to "Profile Complete → Go to Dashboard" when complete
- Staging invite gate: `BETA_INVITE_CODES` array validated in `submitAuth()` before Supabase call; invite field shown in sign-up form when `_IS_STAGING`; production unaffected
- Staging feedback widget: floating pill (bottom-right, auth-gated) → `feedbackModal` → `beta_feedback` Supabase table insert
- `bt_new_user` / `bt_modal_shown` localStorage flags cleared on sign-out to prevent shared-device confusion
- Auth state managed via `refreshAuthState()` / `initAuth()`

### Open-Meteo (Weather)
- Free API, no key required
- Endpoint: `https://api.open-meteo.com/v1/forecast`
- Uses browser geolocation; coordinates cached 1hr in localStorage to avoid repeated permission prompts
- Displays 6-hour forecast pills on dashboard greeting

### Claude API (AI race parsing)
- User supplies their own Anthropic API key (stored in localStorage)
- Used for: race text parsing (`parseAI`), race photo parsing (`parsePhoto`), course info lookup (`fetchCourseInfo`), race name autocomplete (`rdLookupRace`)
- Model: `claude-haiku` (fast, cheap)

### Leaflet + OpenRouteService + Nominatim
- Race map page shows route lines between race cities
- Country polygons fetched from `restcountries.com` for hover highlighting
- Geocoding: Nominatim (OpenStreetMap)
- Routing: OpenRouteService

### Strava
- OAuth integration for activity sync
- Token refresh handled client-side
- Activities imported and matched to races by distance/type

### WHOOP
- OAuth 2.0 integration — direct developer access (no approval required)
- Register at `developer-dashboard.whoop.com`, set `WHOOP_CLIENT_ID` constant in `index.html`
- Secrets: `WHOOP_CLIENT_SECRET` + `WHOOP_CLIENT_ID` via `wrangler secret put` in `health-proxy/`
- Tokens stored in Supabase `wearable_tokens` (provider = 'whoop')
- Data: workout activities + recovery scores via WHOOP Developer API v1

### Garmin
- OAuth 2.0 + PKCE — developer approval required (apply at `developer.garmin.com`)
- PKCE flow: code_verifier generated in browser, code_challenge sent to Garmin, verifier in `sessionStorage` for callback
- Token exchange and client secret kept server-side in `health-proxy/`
- Tokens stored in Supabase `wearable_tokens` (provider = 'garmin')
- Data: activities via Garmin Wellness API (`/wellness-api/rest/activities`)

### Apple Health
- No OAuth — file-based import only (no web OAuth exists for HealthKit)
- User exports `export.xml` from iPhone Health app, uploads via file input in Wearables tab
- `parseAppleHealthXML()` uses a regex-based extractor (never DOMParser) on `export.xml`, extracts `<Record>` elements
- Files < 500 MB: `parseAppleHealthXML()` loads via `file.text()`, groups by date, upserts in 100-row batches
- Files > 500 MB: `importAppleHealthXMLStreaming()` reads in 8 MB FileReader chunks, flushes dates incrementally
- Records upserted to `apple_health_data` keyed by `user_id, date`
- Requires `authUser` — upload button only shown when authenticated

---

## Race Catalog

- Stored in Supabase `race_catalog` table
- ~1,068+ rows (refreshed March 2026)
- Fields: `name`, `city`, `country`, `month`, `day`, `distance`, `sport`, `priority` (A/B/C)
- C-priority races excluded from some charts (progress over time graph)
- Migrations: `20260323160000`, `20260323160001`, `20260324120000` (v1 refresh), `20260324130000` (v2), `20260324150000` (v3)

---

## Deployment

- After pushing changes to staging, always verify the deployment is live by checking `dev.breaktapes.com` before merging to main/production.
- Check `gh run list --branch staging --limit 3` and confirm the deploy workflow shows `success` before proceeding.

---

## Git Workflow

- When merging PRs, first check if any open PRs have their base branch set to the branch being merged: `gh pr list --state open` and inspect `baseRefName`. Rebase those PRs onto the new base before squash-merging to avoid auto-closed PRs.
- If a PR does get auto-closed due to a squash merge, rebase the branch onto the updated base and open a new PR.
- **Before deleting any git worktrees**, first `cd` to the main repository root directory (`/Users/akrish/DEV/breaktapes-dev` or equivalent). Then clean up worktrees. Never delete the directory the current shell is inside of.

---

## UI / Frontend

- **After every UI change**, take a screenshot at desktop (1280px) and mobile (375px) viewports using the Claude Preview MCP screenshot tool. Compare both and flag any layout issues before the user reviews.
- For iOS mobile UI changes, always test at a 390px viewport before considering the task done. Check for overflow, sizing issues, and native picker rendering.
- Specify target devices and constraints upfront when requesting UI changes — e.g. "this needs to work on iOS Safari at 390px".

---

## Development Workflow

- All work happens in Claude Code worktrees (`/Users/akrish/DEV/.claude/worktrees/<branch>`)
- PRs merge into `main`
- Branch naming: `claude/<adjective>-<surname>` pattern (e.g. `claude/frosty-wozniak`)
- Deploy: Cloudflare Pages auto-deploys from `main` (or via `wrangler deploy`)
- **Never delete a git worktree while the shell is inside it** — always `cd` to the main repo root first.

---

## Session History Summary

### Foundational commits
- `ccfbfa8` Initial project setup
- `c199dd2` Supabase authentication added
- `a2bd476` Supabase app state sync
- `5ea4ac2` Replace hardcoded RACE_DB with Supabase `race_catalog` fetch

### Feature work
- `cb291e2` Landing screen for unauthenticated users
- `2fa1d33` Fix browser autofill on dashboard (Safari issue)
- `f7aabc9` PR strip: distance tabs + top-3 gold/silver/bronze cards
- `33f5e68` Split PR strip into Running / Triathlon groups
- `fc90deb` Fix custom distance sorting (90K after Marathon)
- `02e781e` Course Records redesign (formerly Matched Races)
- `269155e` Progress chart: monthly x-axis + average line hover tooltip
- `e213c6f` Total race time in country map tooltip
- `de1c616` Race map rework: remove arcs, add Leaflet routes + hover tooltip
- `ac160f0` Map stat pills moved to bottom-left
- `235a621` Country hover highlight + fix 6-hour weather forecast
- `3fb24bf` Medal Wall: spotlight, PB shimmer, tier badges, achievement system
- `324c478` Medal wall: photo-first with mix-blend-mode multiply
- `471b98b` Community medal photos (Supabase table + frontend)
- `06a27f9` Medal upload workflow: `medals-to-upload/` folder + `upload-medals.sh`
- `88ef04e` Open Wearables: 6 integrations (readiness, training load, VO2, sleep, fatigue, OW workouts)
- `38eb3b6` Race catalog v3 + map/weather/UI improvements
- `12ff4c7` Block dashboard render until auth confirmed

### Infrastructure
- `82fcb9a` race_catalog Supabase migration + seed
- `20260324*` Race catalog v1/v2/v3 refresh migrations
- `20260324160000` race_medal_community migration
- `26878dc` CI/CD pipeline, prod/staging environments, project memory docs
- `f2c1774` Merge PR #9: gstack skills, landing-worker, gitignore fixes, pipeline hardening

### Session 7 (2026-03-26) — Analytics dashboard + test suite + repo hygiene

**Branch:** `claude/sleepy-gould` (staging) → main

#### 10 analytics dashboard widgets
- `582957e` / `9d9d110` — Field-Adjusted Placing, On This Day, Activity Feed Preview, Training Streak, Pacing IQ, Career Momentum Score, Race Day Forecast, Age-Grade Trajectory, Race DNA, Performance Map
- Dashboard customization: `DASH_WIDGETS` array + `applyDashLayout()` + `fl2_dash_layout` localStorage persist
- New infrastructure: `renderSparklineSVG()`, `geocodeCityIfNeeded()`, `AGE_GRADE_STANDARDS` (WA standards table for M/F × 5K/10K/HM/Marathon), `fetchRaceWeather()` (Open-Meteo archive API)
- Performance map: toggle between default and percentile-colored overlay modes via `setMapMode()`

#### Bug fix
- `a8a09e0` — Scroll to top on tab navigation: `window.scrollTo(0, 0)` added to `go()` before `render()`

#### Test suite
- `ca32051` — Jest + jsdom test suite: 67 tests across `tests/utils.test.js` + `tests/navigation.test.js`
- Loader: `tests/spa-loader.js` loads full `index.html` into jsdom, exposes globals
- Found + fixed `computeMomentum` bug: `buildPBMap()` call was missing `pbMap` variable assignment

#### Tooling
- `33808eb` — PostToolUse hook in `.claude/settings.json` to auto-reload preview server on file edit
- `880cf9e` — `/deploy` custom skill for compile-merge-deploy pipeline
- `d73e0ac` — Ruflo v3 multi-agent setup (coder/reviewer/tester agents, hierarchical-mesh swarm)

#### Repo hygiene (end of session)
- Synced `staging` back to `main` (post-squash reset) — both branches now at same commit
- Updated local `main` worktree at `/Users/akrish/DEV` (was 34 commits behind)
- Deleted 4 stale remote branches + 6 stale local branches + 1 stale worktree (`frosty-wozniak`)

#### Key learnings
- `computeMomentum()` must call `buildPBMap()` and assign result before use — was silently returning `null`
- Ruflo `init --force --minimal` overwrites `settings.json` and `CLAUDE.md` — always backup first, merge back after
- `gh pr merge --squash` tries to checkout the target branch locally; fails if target is checked out in another worktree — use `--repo` flag or GitHub API directly
- After squash merges from staging → main, reset staging to `origin/main` to keep branches in sync

---

### Session 6 (2026-03-25) — Beta launch prep

**Branch:** `claude/sleepy-gould` → staging → main

- `d9447d6` — New `beta_feedback` Supabase migration (RLS insert-only, authenticated users)
- `e2eb8f8` — Beta launch: invite gate + landing redesign + profile onboarding + feedback widget

#### Key components
- **Invite gate:** `BETA_INVITE_CODES` = `['BREAKTAPES2026','BETA26','RUNFAST','TAPES24']`; validated in `submitAuth()` before Supabase; staging-only
- **Landing:** radial orange glow + grain texture; headline with `<em>` emphasis; `landing-proof` 3-column grid; `.out` class now includes `translateY(-24px)` slide-up
- **Profile onboarding:** `go('athlete')` on signup + `bt_new_user` flag; `onboardBanner` with progress counter; `openEditAth()` auto-fires after 300ms (once); `isProfileComplete()` / `getProfileCompleteness()` helpers
- **Feedback widget:** `#feedbackPill` + `#feedbackModal` + `submitFeedback()` → `beta_feedback` table; `showBtToast()` helper; auth-gated via `updateAuthUI()`

#### Key learnings
- `bt_new_user` and `bt_modal_shown` must be cleared in `signOutUser()` — shared device edge case
- `applyEnvRestrictions()` should NOT duplicate pill visibility control (owned by `updateAuthUI()`)
- Feedback catch block must NOT show success toast on Supabase error — shows real error instead

---

### Session 5 (2026-03-25) — UI/UX overhaul + race detail form + splits

**Branch:** `claude/pedantic-newton` → staging → main

#### Comprehensive UI/UX overhaul (Phase 1–11 of audit plan)
- `c57c456` — Mobile bottom nav (5 tabs), iOS safe area, ARIA attributes, password field security fix, API key masking, inline form validation, focus-visible states, history search + pagination, modal swipe-to-close, breakpoint consolidation, empty states, design system docs (`DESIGN.md`)
- `aa55cbe` — Removed "Continue as Guest" (authenticated-only app); fixed Safari autofill regression in `openAuthModal`
- `aaf5b08` — Forgot password link in sign-in modal with 8s timeout guard
- `9fd5e1e` — Forgot password UI (link → confirmation state)
- `8e4d951` — New user onboarding: first/last name prompt, empty state with CTA
- `f516685` / `28bfeb3` — One-off Supabase auth config workflow (applied + removed)
- `92ac3b3` — Create account helper text copy fix
- `1fddc19` — Race vs Train nav: `page-train` hub (Pace / Activities / Wearables sub-tabs), green identity, sidebar sections, Map demoted from bottom nav

#### Race card + detail form (Phase 13–14 of audit plan)
- `b7ac3df` — Race card redesign: view-then-edit flow (tap card → race view modal with stats; Edit button opens detail form)
- `c8962ee` — Race view modal improvements: date below location, labeled ranking cards (Overall/Age Group), splits table; splits auto-calc in detail form (cumulative readonly, recalcs on split input); results screenshot import button (Claude vision → populate finish time, placing, splits)
- `2eb024d` — Fix splits screenshot import: extract every checkpoint type (5K, 10 Mile, Swim, T1, Bike, etc.); fix `recalcSplits()` to preserve cumulative-only rows
- `094ca33` — AI + screenshot import now routes through detail form (`openRaceDetailFromParsed`) instead of saving immediately; hint banner when no race name extracted
- `5255646` — Race name autocomplete searches catalog (`raceDb`) with full detail autofill (name, city, country, date, distance, sport); `rdLookupRace()` tries catalog-first, Claude API fallback

#### Key learnings
- `races` is a scoped `let` (not on `window`) — test data must be injected via `sv('fl2_races', ...)` + page reload
- `_rdIsNew` flag branches `saveRaceDetail()` between create (new) and update (existing)
- Catalog autocomplete stores matches on DOM element `el._catalogMatches` to avoid global state
- `recalcSplits()` must NOT clear cumulative when split is empty — screenshots may only provide cumulative column

---

### Session 4 (2026-03-24) — Pipeline hardening + gstack
- Fixed `CLOUDFLARE_API_TOKEN` — wrangler OAuth token doesn't work as API token; created proper `cfut_*` token
- Reset staging DB password via Management API (`PATCH /v1/projects/{ref}/database/password`) — `Bt2026Stg!xK9mRnQvLzWp3hY7sD`
- Reset prod DB password same way — `Bt2026Prod!xK9mRnQvLzWp3hY7sD`; password propagation takes ~60s
- Added graceful skip to `deploy-staging.yml` migration step when DB password not set
- Installed gstack globally (`~/.claude/skills/gstack`) and in repo (`.claude/skills/gstack`)
- `.gitignore` updated: `.claude/*` + `!.claude/skills/` to allow skills while blocking rest of `.claude/`
- `landing-worker/` committed (Cloudflare redirect: `breaktapes.com` → `app.breaktapes.com`)
- Both environments fully green end-to-end via GitHub Actions

---

### Session 8 (2026-03-30) — Mobile UI polish, focus picker, map controls

**Branch:** `claude/modest-ardinghelli` → staging (#54) → main (#55)

#### Changes shipped
- **Signature Distances**: avg pace (min/km) shown instead of km/h for running distances (`computeSignatureDistances()`); cycling/tri still shows km/h
- **Focus card race picker**: "Change" button on athlete card (shown when 2+ upcoming races); `openFocusRacePicker()` / `closeFocusRacePicker()` / `setFocusRace(id)` functions; selection persisted in `fl2_focus_race_id` localStorage; `renderAthlete()` reads saved ID, falls back to `nextRace`
- **Achievement modal**: removed subtitle copy under "ACHIEVEMENT" heading
- **Achievement badges**: smaller (78px min-height, 28px icon, 3-col on mobile instead of 2-col)
- **Map stat pills**: `bottom` offset now accounts for `--bottom-nav-base-height` + safe area
- **Leaflet zoom controls**: margin raised above bottom nav using CSS calc
- **Performance map**: fixed invisible markers — fallback color is now `var(--orange)` when no placing data (was near-transparent grey)
- **More tab** in bottom nav: replaced TRAIN with MORE (···) → `toggleMenu()` opens full hamburger menu
- **Auth guard**: `openAuthModal()` and `openLandingAuth()` return early if `authUser` is set
- **Settings auth section**: cleaned up (only "Signed in as [email]", no jargon)
- **Focus card layout**: race name on own line (`athFocusName`), distance · date · location on second line (`athFocusMeta`) with ellipsis overflow

#### Key learnings
- `fl2_focus_race_id` is stored as plain string (not JSON) — read with `localStorage.getItem()` not `sv()`
- When staging and main diverge post-squash, resolve merge conflicts by taking staging (`git checkout --theirs`) then re-sync staging to main via `git push origin origin/main:staging --force`
- `gh pr merge` from a worktree may fail if the target branch is checked out in another worktree — always pass `--repo owner/repo` flag
- Leaflet zoom controls use `!important` overrides; use `margin` (not `bottom`) to reposition them above the bottom nav
- Performance map markers become invisible when placing data is absent because the color computed to `rgba(245,245,245,0.4)` — always set a visible fallback

---

### Session 9 (2026-03-31) — Pro theme system + light mode fix

**Branch:** `claude/modest-fermat` → staging (#57) → main (#58)

#### Changes shipped
- **New visual identity**: CARBON + CHROME — brick vermilion `#E84E1B`, warm stone `#E8E0D5`, dark surfaces. Replaces the old orange `#FF4D00` / white `#F5F5F5` defaults.
- **9-theme system**: Carbon+Chrome (default, free), Light Mode (free), + 7 Pro themes: Deep Space, Race Night, Obsidian, Acid Track, Titanium, Ember, Polar Circuit. Each defined as a `[data-theme="x"]` CSS block overriding `:root` vars.
- **Theme picker in Settings**: `.theme-picker-grid` with swatch + name + PRO pill per row; live preview on tap; `renderThemePicker()` called from `openSettings()`; `bt_theme` localStorage persistence.
- **Pro gating**: `setTheme()` checks `hasProAccess()` for Pro themes; locked themes open `openProModal('themes')`.
- **RGB channel vars**: Added `--orange-ch` and `--green-ch` CSS vars (e.g. `232, 78, 27`) so `rgba(var(--orange-ch), 0.12)` gradients switch with themes. Bulk-replaced ~80+ hardcoded `rgba(255,77,0,...)` → `rgba(var(--orange-ch),...)` via `sed`.
- **Light mode text fix**: Comprehensive `[data-theme="light"]` override block covering all major text-bearing surfaces (race modals, history rows, map pills, nav, side menu, auth settings, cards, SVG axis labels, hamburger bars, Leaflet controls). Also converted 5 hardcoded contrast-fix rules to use `var(--muted)`/`var(--muted2)`.
- **Side-menu z-index**: Raised `.menu-overlay` to z-550, `.side-menu` to z-600 — was behind bottom nav at z-500.
- **Auth buttons**: Change Password / Sign Out / Delete Account stacked full-width in a column, equal height.
- **Ember theme**: `--green` overridden to warm amber `#FFB347` — neon green clashed with volcanic surfaces.
- **DESIGN.md**: Added full `## Theme System` section and updated Decisions Log.

#### Key learnings
- `--orange-ch`/`--green-ch` RGB channel vars enable `rgba(var(--orange-ch), alpha)` in gradients — the only way to make theme-aware rgba() work without touching hundreds of individual rules
- Light mode needs explicit text overrides for every class that uses hardcoded `rgba(245,245,245,...)` — CSS var override alone isn't enough because `:root --white` can't override inline colour declarations
- `sed` bulk replace of `rgba(255,77,0,` → `rgba(var(--orange-ch),` is reliable for this pattern; run on index.html directly
- `openSettings()` can fail with null error if elements inside the modal don't exist at call time — guard all `getElementById` calls or call `renderThemePicker()` before the null-risk line
- After a squash merge from staging → main, force-push `origin/main:staging` to re-sync staging and prevent divergence

---

### Session 10 (2026-03-31) — Wearable integrations

**Branch:** `claude/eloquent-ishizaka` → staging (#61) → main (pending)

#### Changes shipped
- **WHOOP OAuth** — direct OAuth 2.0, no Terra. `startWhoopOAuth()` → `handleWhoopCallback()` → token saved to Supabase `wearable_tokens`. Activity feed via `/developer/v1/activity/workout`. Recovery via `/developer/v1/recovery`. Auto-refresh 60s before expiry via `refreshWhoopToken()`.
- **Garmin OAuth + PKCE** — `startGarminOAuth()` generates 64-byte verifier, derives SHA-256 challenge via `crypto.subtle.digest`, stores verifier in `sessionStorage`. `handleGarminCallback()` retrieves verifier and POSTs to `/garmin/token`. Activity feed via Garmin Wellness API (90-day window).
- **Apple Health import** — no OAuth (HealthKit has no web OAuth). File upload → `parseAppleHealthXML()` with `DOMParser` → records grouped by date → `saveAppleHealthData()` upserts in 100-row batches to `apple_health_data`.
- **Wearables tab in Train page** — 5 integration cards: WHOOP (live), Garmin (live), COROS (coming soon), Oura (coming soon), Apple Health (live). Brand SVG logos for all 5.
- **health-proxy routes** — `POST /whoop/token|refresh`, `POST /garmin/token|refresh` added. Client secrets server-side only.
- **Supabase migration** `20260331000000_wearable_tokens.sql` — `wearable_tokens` + `apple_health_data` tables with RLS.
- **gstack upgrade** v0.14.0.0 → v0.14.5.0 vendored.
- **15 new tests** — `tests/wearables.test.js`: `whoopSportName`, `parseAppleHealthXML`, smoke tests for all 9 wearable functions. Total: 144 tests.

#### Key learnings
- `sessionStorage` (not localStorage) is the right place for PKCE `code_verifier` — survives OAuth redirect but clears on tab/session close, preventing replay
- jsdom's `File` object lacks `.text()` method — polyfill with `file.text = () => Promise.resolve(content)` in tests
- `loadSPA()` doesn't return the global object — it populates `global` directly; reference functions without `g.` prefix in tests
- gstack vendored copy in `.claude/skills/gstack/` is gitignored by pattern `gstack/`; use `git add -f` to stage. Do NOT stage `node_modules` inside it — use `git diff --name-only | grep -v node_modules` to select files
- Apple Health file format: `export.xml` uses `<Record>` elements with type/value/unit/startDate/endDate/sourceName attributes

---

### Session 11 (2026-04-09) — Athlete Briefing Card + narrative dashboard layout

**Branch:** `claude/busy-poincare` → staging (#75) → main (#78)

#### Changes shipped
- **Athlete Briefing Card** — `renderAthleteBriefing()` replaces the static greeting hero. Four states driven by race data: Welcome (no races yet), Pre-Race (upcoming race with countdown + streak/last-result pills), Just Finished (race within past 7 days — shows time, placing, Add Next Race CTA), No Upcoming Race (shows last race + Add Next Race CTA). Null-guard on `last.name` prevents crash on AI-parsed races with missing name.
- **Narrative dashboard accordion** — four named zones replace the flat widget list: NOW (Race Day context), RECENTLY (Your Racing summary), TRENDING (Build & Consistency), CONTEXT (Patterns & Analysis). Zone labels use `getDashZoneCollapse()` / `saveDashZoneCollapse()` persisted in `fl2_dash_zone_collapse`.
- **`initDashAccordion()`** — single delegated click listener on `#page-dashboard`; idempotent via `_accordionInit` flag so safe to call on every `renderDash()`.
- **`getDashLayout()` migration v2** — detects stale layout formats, rewrites with new zone structure, writes v2 migration flag inside the try block (prevents silent abandonment on `QuotaExceededError`).
- **`DASH_WIDGETS` reordered** — Race Stats moved to TRENDING (career summary, not race-day context); widget defaults trimmed to 8 enabled (countdown disabled by default).
- **30 new tests** — `tests/dash-layout.test.js` (13) + `tests/athlete-briefing.test.js` (17). Total: 174.
- **Version bump** — v0.1.0.0 → v0.2.0.0.

#### Key learnings
- `getDashZoneCollapse` must guard against JSON arrays (`!Array.isArray(saved)`) — `JSON.parse('[]')` is truthy and would corrupt the state object
- Migration v2 flag write must be inside the `try` block, not after it — `QuotaExceededError` silently abandoned the migration when the flag write was outside
- `daysAway` can go negative on same-day or clock-skew races — guard with `Math.max(0, daysAway)` or explicit `<= 0` → "Today!" branch to avoid "in -1 days" display
- `renderAthleteBriefing()` must null-guard `last.name` — AI-parsed races saved before name validation was enforced may have `name: undefined`

---

### Session 12 (2026-04-10) — Public athlete profile /u/:username

**Branch:** `claude/laughing-hofstadter` → staging (#77) → main (#78)

#### Changes shipped
- **Cloudflare Worker SSR** (`worker/index.js`) — handles `/u/:username` and `/u/:username/race/:id` routes, server-renders public profile HTML, falls through to `env.ASSETS.fetch(request)` for all other routes. `escapeHtml()` on all user data. 404 for both private and missing profiles (no existence leak).
- **Supabase migration** `20260409120000_public_profiles.sql` — adds `username TEXT UNIQUE` + `is_public BOOLEAN DEFAULT false` to `user_state`. Partial unique index. Anon RLS policy `USING (is_public = true)`. `profile_views` table with RLS. `GRANT SELECT ON user_state TO anon`.
- **OG image Worker** (`og-worker/`) — separate Cloudflare Worker at `health.breaktapes.com/og/u/:username`. Satori (JSX → SVG) + @resvg/resvg-wasm (SVG → PNG). KV cache 1hr TTL. Fallback to `public/og-placeholder.png`. Bundle: 1,061 KiB / 214 KiB gzipped (within limits).
- **`wrangler.toml`** — added `main = "worker/index.js"`, `SUPABASE_URL` vars for prod + staging.
- **Settings modal** — username input with debounced availability check (`checkUsernameAvailability()`), `is_public` toggle switch (disabled until username set), profile link preview + copy button (`copyProfileLink()`).
- **Athlete page share button** — `#shareProfileBanner` shown when username + is_public both set (`updateShareProfileButton()`).
- **Join CTA** — fixed bottom bar on all public pages with UTM: `?ref=u-{username}-profile&join_context=compare-with-{encodedName}`.
- **`initAuth()`** — reads `?join_context` param and updates landing headline for viral pre-fill flow.
- **`buildRemoteStatePayload()`** — now includes `username` and `is_public` fields synced to Supabase.
- **Static placeholder** `public/og-placeholder.png` — 1200x630 dark PNG (3151 bytes).
- **Version bump** — v0.2.0.0 → v0.3.0.0.

#### Key learnings
- Actual Supabase table is `user_state`, not `app_state` — confirmed by reading `buildRemoteStatePayload()` / `syncRemoteState()` in index.html. CLAUDE.md was wrong.
- OG Worker must be deployed and have `SUPABASE_ANON_KEY` set separately: `cd og-worker && CF_API_TOKEN="" wrangler secret put SUPABASE_ANON_KEY`
- `wrangler secret put` requires CWD to be inside the worker directory (has a `wrangler.toml`) — fails silently with "Required Worker name missing" from any other directory
- Supabase new key format: `sb_publishable_...` shown in Settings → API Keys is the anon key equivalent — safe to use as `SUPABASE_ANON_KEY` in Workers
- `@resvg/resvg-wasm` bundles fine within Cloudflare's 1MB compressed limit — no need to externalize WASM to R2
- Worker routing: fall through to `env.ASSETS.fetch(request)` must be the last line of the `fetch()` handler — any unmatched route hits it
- `escapeHtml()` must cover every string interpolated into SSR HTML — name, location, sport, username, race name, race location, gear items

---

### Session 13 (2026-04-14) — Season Planner v2 + dashboard upcoming race fix

**Branch:** `claude/sad-black` → staging (#88) → main (pending)

#### Changes shipped
- **Dashboard upcoming race fix** — `applyRemoteState()` was overwriting `nextRace` with null from remote state without falling back to `upcomingRaces`. Added auto-promote: after sync, if `nextRace` is null or past today, find nearest future race from `upcomingRaces` and promote it.
- **Season Planner LOAD fix** — `loadSavedSeasonPlan()` now shows toast ("Loaded 'Name' — N races updated") and falls back to name+date matching when IDs differ. Handles plans saved with old `plan-${Date.now()}` IDs.
- **Plan UUID fix** — `saveSeasonPlanDraft()` now uses `crypto.randomUUID()`. Old `plan-${Date.now()}` format was not a valid UUID; Supabase `season_plans.id` is `uuid` type, causing silent upsert failures that wiped saved plans.
- **Past race pruning** — `computeSeasonPlan()` filters to `r.date >= today`; `openSeasonPlannerModal()` prunes past events from `upcomingRaces` on open.
- **`renderTaperTimeline(planItems)`** — SVG inline visualization (320px viewBox) with orange taper zones and green recovery bands. Includes NaN guard: filters items with missing/invalid date or non-finite taper/recovery values before computing geometry.
- **`deleteSeasonPlan(planId)`** — filter from `seasonPlans`, persist, sync, re-render, toast.
- **`autoSuggestPriorities()`** — distance-rank lookup (Ironman=10, Marathon=7, Half=6, 5K=2...) assigns A/B/C to all future upcoming races; updates open planner selects in-place.
- **Peak week conflict detection** — `computeSeasonPlan()` adds warning when two A/B races are < 21 days apart.
- **`renderSeasonYearCompare()`** — prev vs current year race count side-by-side in `#seasonPlannerYearCompare`.
- **Training block labels** — `[data-block-label]` free-text inputs between race rows in planner; `saveSeasonPlannerModal()` reads and persists `trainingBlockLabel` on each `upcomingRaces` entry via `buildUpcomingRaceFromSource()`.
- **Goal time in plan card** — `computeSeasonPlan()` includes `goalTime` in each plan item; `renderPlannerRows()` shows 🎯 orange if set.
- **4 new regression tests** — `computeSeasonPlan`: past-date filter, goalTime passthrough, peak week conflict, goalTime default. Total: 218 tests.

#### Key learnings
- `applyRemoteState()` applies remote state indiscriminately — always add a fallback check after sync if a derived value (like `nextRace`) might be null from fresh/empty remote state
- `season_plans.id` is `uuid primary key` in Supabase — any client-generated ID must be a valid UUID; `plan-${Date.now()}` silently fails upsert
- `renderTaperTimeline` SVG: `+new Date(dateStr + 'T00:00:00')` returns `NaN` for undefined/invalid dates; `.toFixed(1)` on NaN produces the string `"NaN"` which renders as blank SVG element rather than throwing — always guard before computing geometry
- String date comparison (`date < today` where both are `YYYY-MM-DD`) is lexicographically correct and safe — no need for Date parsing for simple past/future checks

---

## Known Issues / Watch Points

- Beta invite codes: `BETA_INVITE_CODES` array is client-visible in source — intentional tradeoff for self-service beta; update the array and redeploy to staging to add/revoke codes
- Safari autofill: fixed with `autocomplete="off"` + `readonly` trick on inputs; do not revert
- Geolocation caching: coords cached 1hr in localStorage under key `geo_cache` to avoid repeated browser permission prompts
- Race catalog priority: C-priority races intentionally excluded from progress-over-time chart
- Auth guard: dashboard must not render until `initAuth()` resolves — guard is in place, do not remove
- Cloudflare API token: if pipeline fails with auth error, token may have expired — create new one at `dash.cloudflare.com/profile/api-tokens` and update `CLOUDFLARE_API_TOKEN` secret
- Supabase DB passwords: if migrations fail with SASL auth error, reset via `PATCH https://api.supabase.com/v1/projects/{ref}/database/password` and wait 60s before retrying
- gstack binary: after fresh clone, run `cd .claude/skills/gstack && ./setup` to build the browse binary (not committed — 117MB)
- `races` scoping: `races` is declared with `let` (not `var`/`window`) — test data injection via the browser console must use `sv('fl2_races', [...])` + page reload, not `window.races = [...]`
- `_rdIsNew` flag: when opening race detail from parsed AI/screenshot data, `_rdIsNew = true` routes `saveRaceDetail()` to create a new race. Cancel button must reset this flag to `false`.
- `recalcSplits()`: must not clear cumulative cells when split input is empty — screenshot imports may only provide the cumulative column with no per-split diff
- WHOOP integration: `WHOOP_CLIENT_ID` constant in `index.html` is intentionally blank until credentials are obtained — the Connect button will not work until filled
- Garmin integration: requires developer approval at `developer.garmin.com` before OAuth will function — `GARMIN_CLIENT_ID` constant is blank placeholder
- health-proxy uses `custom_domain = true` in `wrangler.toml` — auto-provisions DNS for `health.breaktapes.com`. Must be redeployed (`wrangler deploy` in `health-proxy/`) after any new routes are added.
- Apple Health `.zip` export: not supported (raw `export.xml` required). App shows error toast for .zip files.
- Apple Health files < 500 MB use `parseAppleHealthXML()` (`file.text()` + regex). Files > 500 MB use `importAppleHealthXMLStreaming()` (8 MB FileReader chunks). The 500 MB threshold is safe for iOS Safari; 2 GB+ exports always use the streaming path.
- WHOOP users who connected before the `offline` scope was added (v0.3.0.1) have no refresh token stored. When their access token expires (~1 hr), `refreshWhoopToken()` clears the stale token and shows a "reconnect" toast. They must re-authenticate once to get a refresh token.
- Public profile Worker (`worker/index.js`) deploys with the main app via CI — no separate step needed. OG Worker (`og-worker/`) must be deployed manually: `cd og-worker && CF_API_TOKEN="" wrangler deploy`. Needs `SUPABASE_ANON_KEY` secret set separately.
- Username availability check (`checkUsernameAvailability()`) queries `user_state` directly with anon key — works because anon can SELECT rows but only sees `username` field pattern, not private data.
- `is_public` toggle in Settings is disabled until a username is saved — enforced in `onIsPublicToggle()`. Do not remove this guard.
- `user_state` (not `app_state`) is the actual Supabase table name — CLAUDE.md previously said `app_state` incorrectly. All references now fixed.
- Side menu positioning: **do not revert to `right: -310px`** — it inflates `body.scrollWidth` on iOS Safari causing a full-page horizontal scroll. The menu uses `transform: translateX(100%)` + `display: none` (with a 350ms `_menuCloseTimer` delay on close).
- `#pageTitleBar` is a mobile-only sticky element updated by `go()` — it must stay in sync with the `_pageNames` map in `go()` when new pages are added.
- `initAuth()` races against a 4-second timeout. If Supabase is cold, the user sees the landing screen (not a blank page). The landing spinner (`#landing-auth-spinner`) shows during this window.
- FIT file upload: `handleGarminFitImport()` guards against `FitParser` being undefined (CDN not yet loaded) and files > 100 MB. Both checks must stay in place.

---

### Session 14 (2026-04-15) — WHOOP OAuth fix + Apple Health 2GB streaming

**Branch:** `claude/musing-bhabha` → staging (#91)

#### Root causes fixed
- **WHOOP DNS (NXDOMAIN)** — `health.breaktapes.com` Worker was deployed with a route pattern that requires a manually-created DNS record. That step was never done. Fixed by switching `health-proxy/wrangler.toml` to `custom_domain = true` which auto-provisions the Cloudflare-managed DNS entry on deploy.
- **WHOOP refresh tokens** — `offline` scope was missing from `WHOOP_SCOPES`. WHOOP only issues refresh tokens when `offline` is requested. Added to scope list.
- **Apple Health > 500 MB crash** — `file.text()` loads the entire file as a JS string. 2 GB file = 2 GB string = OOM. Added `importAppleHealthXMLStreaming()`: reads in 8 MB FileReader chunks, parses records per chunk, flushes dates to Supabase incrementally using `!batchDates.has(d)` (sort-independent). Peak memory: ~2 chunks (~16 MB).

#### Key learnings
- `custom_domain = true` in `wrangler.toml` auto-provisions Cloudflare DNS — never use zone route patterns for custom domains; they require manual DNS setup and are easy to forget
- WHOOP only issues `refresh_token` when `offline` scope is requested at authorize time — adding it after the fact requires all existing users to re-authenticate once
- `FileReader.readAsText(blob)` splits multi-byte UTF-8 sequences at chunk boundaries silently (replacement char U+FFFD) — only `sourceName` attribute is affected (cosmetic), not health metric values or dates
- For streaming parsers that flush data by date, `!batchDates.has(d)` is safer than `d < minBatchDate` — the latter silently drops records if the export is not chronologically sorted
- Force-flush by record count (5000 cap) is essential for single-date bulk exports — the date-based flushing alone doesn't help when all records share one date

---

### Session 13 (2026-04-13) — Race catalog v2 full refresh

**Branch:** `claude/serene-kilby` → staging (pending)

#### Changes
- **Race catalog replaced** — both staging and production `race_catalog` tables truncated and reloaded from `race_catalog_export.numbers` (uploaded 2026-04-13). 8,284 rows across run, tri, cycle, hyrox, swim disciplines.
- **Migration file** — `supabase/migrations/20260411120000_race_catalog_v2_refresh.sql` committed (documents the truncate + re-insert).
- **Branch cleanup** — deleted 17 stale local branches (squash-merged via PRs); removed stale `nifty-blackwell` worktree. Remaining local branches: `main`, `staging`, `claude/serene-kilby`, `codex/*` (Codex-owned).

#### How the reload was done (future reference)
Direct DB access (psql/psycopg2) is blocked from localhost — Supabase only exposes the DB via pooler at non-standard ports. Instead:
1. Temporarily `GRANT INSERT ON race_catalog TO anon` + `CREATE POLICY race_catalog_anon_insert ... WITH CHECK (true)`
2. Bulk POST via `https://<project>.supabase.co/rest/v1/race_catalog` with anon key, 200-row batches
3. `REVOKE INSERT` + `DROP POLICY` after load completes

#### Key learnings
- Supabase `db.*.supabase.co:5432` is not reachable from localhost — use REST API or Supabase MCP `execute_sql` for remote data loads
- `execute_sql` MCP tool works but payload size limits make it slow for large datasets — REST API bulk insert is faster (200-row JSON batches, ~40 requests for 8K rows)
- `GRANT INSERT TO anon` alone is insufficient when RLS is enabled — must also `CREATE POLICY ... FOR INSERT TO anon WITH CHECK (true)`; revoke both after load
- Supabase anon key format changed from `eyJ...` JWT to `sb_publishable_...` — both work identically in REST API headers

---

### Session 15 (2026-04-15) — Mobile UX polish, overflow fixes, auth timeout, aria (v0.3.1.x)

**Branch:** `claude/gifted-beaver-apname` → staging

#### Changes shipped
- **Bottom nav readability** — labels bumped from 8px to 10px, opacity from 68% to 85%. At `max-width: 360px`, labels now show at 9px (previously `font-size: 0` — icon-only). Light mode inactive tab opacity raised from 55% to 75%.
- **Side menu sub-labels** — each `.menu-item` now wraps its label in `.menu-item-label` with a `.menu-item-sub` description (9px, `var(--muted2)`). Adds context at a glance.
- **Mobile horizontal overflow fix** — `.side-menu` changed from `right: -310px` → `right: 0; transform: translateX(100%)`. Eliminates `body.scrollWidth` inflation on iOS Safari. `display: none` toggled with 350ms `_menuCloseTimer` delay so CSS transition completes before hiding.
- **`.wrap > * { min-width: 0 }` blanket rule** — prevents any grid child from blowing out its 1fr column. Cascaded `min-width: 0` to `.dash-shell`, `.dash-zone`, `.dash-zone-grid`, `.ath-page-shell`, `.ath-hero-content`, `.ath-section`, `.ath-pb-grid`, `.pb-sport-section`, `.dash-pb-strip`, and more.
- **Athlete hero column floor** — `minmax(290px, 0.75fr)` → `minmax(140px, 0.75fr)` prevents right column from forcing overflow on narrow viewports.
- **Strava `.ap-name` fix** — replaced `max-width: 160px` with `flex: 1; min-width: 0`. Strava activity names now expand to available space and truncate correctly.
- **Menu aria attributes** — `toggleMenu()` / `closeMenu()` now set `aria-expanded` on the hamburger button and `aria-hidden` on the menu panel. Fixed a race condition where rapid open/close left the menu in an intermediate state via `_menuCloseTimer` guard.
- **`initAuth()` 4-second timeout** — `Promise.race([client.auth.getSession(), timeout])` prevents blank screen on slow Supabase cold-start. Landing screen shows a spinner (`#landing-auth-spinner`) during auth resolution.
- **FIT file upload guard** — `handleGarminFitImport()` now checks `typeof FitParser !== 'undefined'` before parsing and rejects files > 100 MB with a clear error toast (previously crashed silently).
- **Page title bar** — `#pageTitleBar` (mobile-only, sticky) shows current page name. Updated by `go()` on every navigation.
- **Dashboard zone labels** — "Build & Consistency" → "Consistency", "Patterns & Analysis" → "Patterns".
- **Text density pass** — Flatlay section descriptions, OW connect prompts, fatigue empty state, FIT error toast all shortened.
- **Version:** v0.3.1.0 → v0.3.1.3

#### Key learnings
- `right: -310px` on a `position: fixed` element still expands `body.scrollWidth` on iOS Safari — use `transform: translateX(100%)` instead; it is GPU-composited and does not affect layout flow
- `display: none` must be deferred by the CSS transition duration (350ms) on close — removing it immediately skips the slide-out animation; store the timer ID so re-open can cancel it
- `min-width: 0` is required on every CSS grid child that contains text or other potentially-wide content — grid items default to `auto` min-width which bypasses the 1fr constraint
- `Promise.race()` for auth timeout: the `_timedOut: true` field on the fallback object is a clean signal without throwing — catch block is not needed for timeout, only for genuine errors
- FIT parser crash guard: `typeof FitParser === 'undefined'` check must precede any call to `new FitParser()` — the library loads async via CDN and may not be ready on first render

---

### Session 16 (2026-04-16) — Races page rebuild, Flighty Passport style (v0.4.0.0)

**Branch:** `claude/strange-euler` → main (PR #104)

#### Changes shipped
- **Full-viewport map** — `#page-races` is now `position:relative; overflow:hidden` with `#racesPanel-map` filling via `position:absolute; inset:0`. Height calc subtracts both header and bottom nav heights.
- **Bottom sheet** — `.races-sheet` at `position:absolute; bottom:0` with `transform:translateY(calc(100% - 230px))` peeking state → `translateY(0)` expanded. `z-index:400` (expanded: 650 to cover map pills).
- **Year tabs** — `racesYearFilter` state, `renderRacesYearTabs()`, `setRacesYear()`. Generated from race data.
- **Compact/Detailed toggle** — `racesViewMode` state; `buildCompactRow()` + `buildDetailedRow()`. PB rows get `.is-pb` class with orange left-border gradient.
- **Arc connections** — `_greatCirclePoints(from, to, n=12)` uses `sin(π·t)` midpoint lift for curved great-circle arcs. Replaces straight Leaflet polylines.
- **Share Race Log** — `openRaceShareCard()` + `drawShareCard()` + `_countryToFlag()`. Canvas 2D 1200×630 export; `copyShareCard()` wraps async clipboard write in inner try/catch.
- **Map loading overlay** — moved to `z-index:200` (below sheet at 400) so sheet is immediately visible. `_loadTimeout` setTimeout clears when map finishes or on early return.
- **Fixes from pre-landing review**: `ms-races/ms-countries/ms-cities/ms-km` null crash removed; `r.time` XSS escaped; empty-city geocoding filtered; `map-empty-state` orphan cleaned up.
- **Tests** — `tests/spa-loader.js` stubs updated with `.races-sheet`, `#raceSheetList`, stat tiles. 241/241 pass.
- **Version:** v0.3.1.3 → v0.4.0.0

#### Key learnings
- Map loading overlay must be `z-index` lower than the bottom sheet — if the overlay covers the full page (inset:0), the sheet will be invisible until map tiles load. Put overlay at z-index < sheet z-index.
- `#page-races` height must subtract BOTH `--header-base-height` AND `--bottom-nav-base-height` — subtracting only the header lets the map overflow into the bottom nav area.
- After removing floating stat elements (map pills), always grep for all JS references — `renderMap()` had 4 `getElementById` calls to the removed elements that would have crashed on every invocation.
- Canvas `fillStyle` does not resolve CSS custom properties (`var(--orange)`) — use hardcoded hex values in canvas draw functions.
- `canvas.toBlob()` is not a Promise — async errors inside the callback are not caught by an outer `try/catch`; wrap the async work inside the callback in its own `try/catch`.

---

### Session 17 (2026-04-16) — Dashboard analytics widgets + Profile page redesign (v0.5.1.0)

**Branch:** `staging` → main (PR #113)

#### Changes shipped
- **PreRaceBriefing hero card** — four states: PRE-RACE (countdown + last race pill), JUST RACED (days since + finish time), ADD YOUR FIRST RACE (onboarding), WHAT'S NEXT (no upcoming race). Orange pin icon + briefing tag pattern.
- **10 new dashboard analytics widgets** — SeasonPlannerWidget (90-day race lineup with taper days), RecoveryIntelWidget (days remaining + load score with large numeral), TrainingCorrelWidget (Strava-gated dashed locked), BostonQualWidget (live BQ gap vs marathon PB), PacingIQWidget (FADER/NEGATIVE SPLITTER/EVEN PACER from splits), CareerMomentumWidget (form trend score + HOT/RISING badge), AgeGradeWidget (WA gate on DOB+gender), RaceDNAWidget (temperature fit + fade rate), PatternScanWidget (deep trends + EXPLAIN WITH AI), WhyResultWidget (COACH BRIEF).
- **DashCustomizeModal redesigned** — bottom sheet with zone sections, PRO badges per widget, iOS-style toggle switches (pure CSS/JSX), ▲/▼ reorder within zones, sticky DONE button.
- **Profile page full redesign** — AchievementsSection (green gradient hero, 19 achievements, SPECIAL/MILESTONE/EVENT groups), RaceActivityHeatmap (2yr × 12mo clickable grid → race list), MajorsQualifiers (7 WMM board with COMPLETED/IN PROGRESS stats), RacePersonality (STARTER/DIESEL/BIG-DAY PERFORMER), CountriesRaced pills, PersonalBests grid, AgeGradeTrajectory card.
- **Infinite render loop fix** — `selectDashLayout` and `selectDashZoneCollapse` in `selectors.ts` were calling `getDashLayout()` / `getDashZoneCollapse()` inline. Both functions return new arrays/objects every call, causing Zustand's `useSyncExternalStore` to force infinite re-renders. Fixed: selectors now return raw `s.widgets` / `s.zoneCollapse`; components compute merged layout via `useMemo([storeWidgets, getDashLayout])`.

#### Key learnings
- Zustand selectors MUST return stable references — if a selector function returns a new object/array on every call (via spread operator or object creation), `useSyncExternalStore` sees a changed reference and triggers an infinite re-render loop. Never call store methods that return derived data as selectors; either return raw state or use `useMemo` in the component.
- `computePersonality()` and similar aggregation functions must guard all division with `> 0` checks — avoid divide-by-zero when race list is empty.
- `DashCustomizeModal` must read `s.widgets` (not `s.getDashLayout()`) and compute merged layout via `useMemo` — same infinite loop risk if getDashLayout is called in a Zustand selector.

---

### Session 18 (2026-04-16) — Race past/upcoming architecture + modal polish

**Branch:** `staging` (direct commits — not merged to main yet)

#### Changes shipped (commits `6fb1ed7`, `a04e5db`, `feb159f`)

- **Race past/upcoming architecture** — `useRaceStore` gets `addUpcomingRace(race)` and `autoMoveExpiredUpcoming()`. On every app rehydration, upcoming races whose date is in the past are automatically moved to `races`. Dashboard RACE DAY empty state and season planner CTAs open the upcoming tab; all other "log race" CTAs open the past tab.
- **Two-tab AddRaceModal** — "🏁 LOG A RACE" (full form: outcome, time, placing, medal → saves via `addRace`) and "📅 ADD UPCOMING" (simplified, no result fields → saves via `addUpcomingRace`). Tabs are orange/green themed. Save button label switches between "LOG RACE" and "ADD TO CALENDAR".
- **Rich autocomplete dropdown** — two-line entries: race name + sport type badge on line 1; city · country · distance · date on line 2. Searches both past races AND upcoming races alongside the catalog.
- **BQ safe buffer** — 5 min → **7 min** (420 sec); label updated to "SAFE BUFFER (−7 MIN)".
- **Modal scroll lock** — All 3 modals (`AddRaceModal`, `ViewEditRaceModal`, `EditProfileModal`) now call `document.body.style.overflow = 'hidden'` via `useEffect` on mount (restored on unmount). `overscrollBehavior: 'contain'` added to each modal's scroll container. Fixes background scrolling on iOS.
- **Country + City side by side** — `1fr 1fr` grid in AddRaceModal. Shortened placeholder text ("Country...", "City...") to fit.
- **Date input iOS overflow fix** — `WebkitAppearance: none` + `appearance: none` + `maxWidth: 100%` on `input[type=date]` strips native iOS date picker intrinsic width that was overflowing the container.
- **Stale branch cleanup** — Deleted 13 stale local branches (all squash-merged or pre-React migration). Removed 3 stale worktrees. Repo now has only `main` and `staging` local branches.

#### Key learnings
- `input[type=date]` on iOS Safari has an intrinsic minimum width tied to the native date display — `width: 100%` alone does NOT constrain it. Must add `WebkitAppearance: none` + `appearance: none` to opt out of native styling, plus `maxWidth: 100%` as a safety net.
- Body scroll lock in React modals: `document.body.style.overflow = 'hidden'` in a `useEffect` with cleanup is the most reliable cross-browser approach. `overscrollBehavior: contain` on the scroll container is a required complement — it prevents rubber-banding at scroll edges from propagating to the body on iOS.
- React passive event listeners: `e.preventDefault()` on `onTouchMove` does NOT work in React (all touch listeners are passive by default since React 17). The body lock approach is the correct iOS scroll isolation pattern.
- `autoMoveExpiredUpcoming()` uses lexicographic date comparison (`date < today` where both are `YYYY-MM-DD`) — correct and zero-cost. No Date parsing needed.

---

### Session 19 (2026-04-16) — Upcoming Races Modal + Set Next Race Modal (v0.6.1.0)

**Branch:** `claude/condescending-haibt` → staging (PR #115)

#### Changes shipped (commits `79fd098`, `91ee8cc`, `2b61ac4`)

- **UpcomingRacesModal** — full-screen bottom sheet listing all future upcoming races sorted by date. Features: A/B/C priority badges (orange/amber/muted), ACTIVE pill on current `nextRace`, days-between-races separators, "+ ADD RACE" button. Opened by tapping "ALL UPCOMING RACES →" on the CountdownCard.
- **SetNextRaceModal** — slide-up edit sheet for any upcoming race. Fields: priority (A/B/C select), goal time HRS/MIN/SEC spinners with ▲/▼ buttons, auto-calculated pace target (min/km). UPCOMING INSIGHTS panel: location, course summary, weather forecast (Nominatim geocode → Open-Meteo API), Race DNA outlook comparing expected temperature to past race weather history. CANCEL / REMOVE / SAVE RACE action bar.
- **`setNextRace` action** in `useRaceStore` — allows explicitly setting any race as the dashboard focus race, decoupled from automatic "nearest upcoming" logic.
- **RH-5 fix** — `AddRaceModal` `handleSave` wrapped in `try/catch`; save button clears error state on retry.
- **RH-24 fix** — `Profile.tsx` `PersonalBests` section groups by sport via `buildPBBySport()` with `SPORT_ORDER` priority sort.
- **7 Linear issues resolved**: RH-5, RH-20, RH-21, RH-22, RH-23, RH-24, RH-25.
- **Branch cleanup** — deleted 4 stale remote branches (`claude/compassionate-nash`, `claude/fix-autofill-supabase`, `claude/flamboyant-bhaskara`, `claude/modest-hodgkin`) and 1 stale local branch.

#### Key learnings
- `WebkitOverflowScrolling` in React inline styles requires `'touch' as React.CSSProperties['WebkitOverflowScrolling']` — `'touch' as unknown as undefined` compiles but emits a TS warning.
- Open-Meteo forecast API (`/v1/forecast`) only supports up to 16 days in the future; for races further out, use the archive endpoint or show a "forecast not available yet" state gracefully.
- Cancel token pattern (`cancelledRef`) is essential for weather fetch in modals — the fetch may resolve after the user closes the modal; without cleanup the state update will fire on an unmounted component.
- Zustand `useRaceStore.setState({ nextRace: null })` can be called directly from component handlers without importing an action — useful for one-off state clears outside the store's own action methods.
- `buildPBBySport()` in Profile.tsx must handle missing `r.sport` gracefully (`?? 'Running'` fallback) — AI-parsed races before sport validation was enforced may have `sport: undefined`.

---

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health

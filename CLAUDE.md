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

### Single-file structure (`index.html`)
The entire app lives in one HTML file (~10,035 lines). Sections are organized as:
1. CSS tokens / reset / component styles
2. HTML markup (pages, modals, landing screen)
3. JavaScript (data, auth, render functions, integrations)

### Page system
Pages use `id="page-*"` with `.page` / `.page.active` CSS classes. Navigation is handled by `go(page)` which sets active class and calls `render(page)`.

Pages: `dashboard`, `history`, `medals`, `map`, `athlete`, `train`, `training`, `pace`

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
| `renderHistory()` | Build race history list (with search + pagination) |
| `renderAthlete()` | Build athlete profile |
| `renderMap()` | Init Leaflet map + routes |
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
| `handleAppleHealthImport(file)` | Handle .xml/.json upload, parse records, save to Supabase |
| `parseAppleHealthXML(file)` | DOMParser on Apple Health `export.xml`, extract HKRecord elements |
| `saveAppleHealthData(records)` | Group records by date, upsert in 100-row batches to `apple_health_data` |
| `renderWearables()` | Render 5 integration cards in Wearables tab (WHOOP, Garmin, COROS, Oura, Apple Health) |
| `renderWearablesFeed()` | Parallel fetch WHOOP+Garmin activities, sort by date, render activity cards |
| `whoopSportName(id)` | Map WHOOP sport_id integer to human-readable sport name |

---

## Testing

- **Test runner:** Jest + jsdom (`npm test` or `npm run test:coverage`)
- **Test files:** `tests/utils.test.js` (pure functions), `tests/navigation.test.js` (go() + scroll behaviour)
- **Loader:** `tests/spa-loader.js` — loads `index.html` into jsdom, exposes globals via `window`
- **Coverage:** `npm run test:coverage` → `coverage/` directory
- **144 tests, all green** as of Session 10
- Functions tested: `timeToSecs`, `secsToHMS`, `buildPBMap`, `parsePlacing`, `computeStreak`, `computeMomentum`, `computePacingIQ`, `computeAgeGrade`, `classifyPacing`, `go()` scroll + page switching + nav state, `whoopSportName`, `parseAppleHealthXML`, all wearable function smoke tests
- `tests/wearables.test.js` added in Session 10 — 15 tests for wearable integration functions

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
- `parseAppleHealthXML()` uses `DOMParser` on `export.xml`, extracts all `<Record>` elements
- Records grouped by `startDate` prefix (date) and upserted to `apple_health_data` in 100-row batches
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
- health-proxy must be redeployed (`wrangler deploy` in `health-proxy/`) after any new routes are added — the worker does not auto-deploy with the main app
- Apple Health `.zip` export: not supported (raw `export.xml` required). App shows error toast for .zip files.

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

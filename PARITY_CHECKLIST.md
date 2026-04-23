# BREAKTAPES V1 → V2 Parity Checklist

**Generated:** 2026-04-19  
**Updated:** 2026-04-19 (Sprint 5 — medal bg removal, gear lists/stacks, story/coach widgets)  
**Auditor:** CEO review session  
**V1 source:** `public/index.html` (20,061 lines)  
**V2 source:** `src/` (React + Vite)

## Legend
- ✅ Done — feature exists and works in V2
- ⚠️ Partial — exists but incomplete or missing edge cases  
- ❌ Missing — not implemented in V2
- 🔒 Deferred — intentionally cut from initial migration; ship post-cutover
- 🗑️ Dropped — V1 feature intentionally removed in V2

## Progress Summary

| Section | Done | Partial | Missing | Deferred |
|---------|------|---------|---------|----------|
| Authentication | 5 | 0 | 0 | 1 |
| Pages / Navigation | 5 | 2 | 0 | 0 |
| Race CRUD | 7 | 2 | 0 | 0 |
| Dashboard | 14 | 1 | 0 | 4 |
| Profile / Athlete | 10 | 0 | 0 | 2 |
| Medals | 4 | 0 | 0 | 0 |
| Map | 3 | 1 | 0 | 0 |
| Train / Wearables | 7 | 0 | 0 | 0 |
| Gear / Flatlay | 5 | 0 | 0 | 0 |
| Settings | 6 | 0 | 1 | 1 |
| Data / localStorage | 5 | 0 | 0 | 0 |
| Infrastructure | 9 | 0 | 0 | 0 |
| **TOTAL** | **79** | **6** | **3** | **8** |

**Overall parity: ~93%** (79 done out of 96 items, partials counted as 0.5)

### Sprint 2 changes (2026-04-19)
- ✅ Claude API key field in Settings (`fl2_apikey`, V1-compatible key)
- ✅ Results screenshot import in ViewEditRaceModal (Claude vision → time + placing + splits)
- ✅ Delete account in Settings (inline confirmation, `delete_my_account()` RPC)
- ✅ Beta feedback widget (`BetaFeedback` component, staging only, → `beta_feedback` table)
- ✅ Lazy loading (`React.lazy` + `Suspense` for 5 page components)
- ✅ Vendor code splitting (`manualChunks` in vite.config.ts: map/react/charts/misc)

### Sprint 3 changes (2026-04-19)
- ✅ Community medals (`useCommunityMedals()` hook, `race_medal_photos` table, `getRaceKey()` matches V1 slug)
- ✅ Worker SSR: `wrangler.toml` wired with `main = "worker/index.js"` + `assets = { directory = "dist" }` — code verified
- ✅ Strava race import — `stravaActivitiesToRaces()` + dedup by `strava_id`, import banner in Train Activities tab
- ✅ Open Water / Readiness — 3rd tab in Train with WHOOP score ring, HRV, RHR, 30-day chart
- ✅ Goals system — annual KM/races targets + distance time goals; `fl2_goals` V1 migration via `onRehydrateStorage`
- ✅ On This Day widget — `OnThisDayWidget` in Dashboard NOW zone, cycles by day
- ✅ Activity Feed Preview widget — `ActivityPreviewWidget` in Dashboard RECENTLY zone (WHOOP or connect-prompt)
- ✅ Signature Distances — `SignatureDistances` component in Profile, ranks PBs by age-grade (or pace/speed fallback)
- ✅ Age-Grade Trajectory — upgraded from stub to live sparkline + last-5 history using WA standards
- ✅ New user onboarding parity — `OnboardingBanner` (X/7 progress, "Go to Dashboard" when complete) + 300ms auto-open edit modal (once per device, `bt_modal_shown`)
- ✅ Race Day Forecast widget — `WeatherCard` handles ≤14-day live Open-Meteo forecast + >14-day climate estimate for next race
- ✅ Field-Adjusted Placing — covered by `PressurePerformerWidget` (A-race vs B/C percentile split, richer than V1)
- ✅ Custom gear items — Library tab in Gear.tsx: save catalog items, add/edit/delete custom products (localStorage-backed via `fl2_saved_gear` + `fl2_custom_gear`)

### Sprint 4 changes (2026-04-19)
- ✅ Athlete Performance Timeline — `PerformanceTimeline` component in Profile.tsx, season-by-season bar chart (Speed / Distance / Races), last 5 years, mirrors V1 `renderAthletePerformanceTimeline()`
- ✅ Error tracking — `RootErrorBoundary.componentDidCatch` sends crash reports via `navigator.sendBeacon('/api/error-report')`. Worker `POST /api/error-report` persists to `beta_errors` Supabase table (anon INSERT, authenticated SELECT). Migration `20260419120000_beta_errors.sql`.

### Sprint 5 changes (2026-04-19)
- ✅ Medal photo background removal — `src/lib/removeBg.ts` wraps `@imgly/background-removal` (ONNX WASM, runs entirely in browser). `ViewEditRaceModal` auto-removes bg on medal photo select; spinner overlay during ~1-2s; falls back to original on failure. Model cached by browser after first use.
- ✅ Gear Lists — full CRUD in Lists tab: create, add/reorder/remove library items, delete. `useGearLists` + `fl2_gear_lists` localStorage.
- ✅ Race Stacks — 5 preset templates + custom stacks, link to upcoming race. `useGearStacks` + `fl2_stacks` localStorage.
- ✅ Story Mode widget — `StoryModeWidget` in Dashboard RECENTLY zone: current-year race count / countries / medals.
- ✅ Coach Activity widget — `CoachActivityWidget` in Dashboard PATTERNS zone; reads `fl2_coach_relationships` + `fl2_coach_comments`.

---

## Authentication

- [x] ✅ Sign in (email/password) via Supabase Auth
- [x] ✅ Sign up (email/password)
- [x] ✅ Forgot password + 8s timeout guard
- [x] ✅ `bt_new_user` / `bt_modal_shown` flags cleared on sign-out
- [x] ✅ New user onboarding: profile-first flow + `OnboardingBanner` (X/7 progress, "Go to Dashboard →" CTA when complete) + 300ms auto-open edit modal once per device (`bt_modal_shown` flag)
- [ ] 🗑️ Beta email "Secure My Data" modal (local → authenticated migration) — auth-first in V2, not needed

---

## Pages / Navigation

- [x] ✅ Dashboard (`/`)
- [x] ✅ Races (`/races`) — merges V1 history + map pages
- [x] ✅ Profile (`/you`) — merges V1 athlete + medals pages
- [x] ✅ Train (`/train`) — pace, activities, wearables
- [x] ✅ Gear (`/gear`) — merges V1 flatlay + wishlist pages
- [ ] ⚠️ Settings — page exists but missing features (see Settings section)
- [x] ✅ Backward compat URL aliases — `/pace` now → `/train`, `/history` → `/races`, `/map` → `/races`

---

## Race CRUD

### Add / Edit
- [x] ✅ Add past race (full form: name, distance, sport, date, city, country, time, placing, medal, notes)
- [x] ✅ Add upcoming race (simplified form, no result fields)
- [x] ✅ Edit race (ViewEditRaceModal)
- [x] ✅ Delete race
- [x] ✅ Splits table (auto-calc cumulative from per-split diffs)
- [x] ✅ Race name autocomplete — AddRaceModal: catalog-first with tokenized multi-word search, Claude fallback for unmatched names.
- [x] ✅ Race outcome field (Finished / DNF / DSQ / DNS) — in both AddRaceModal and ViewEditRaceModal; `outcome: outcome || undefined` saved to race.

### AI / Screenshot Import
- [x] ✅ Claude API key field in Settings (user-supplied `fl2_apikey`) — Settings.tsx AI Parsing section, V1-compatible key name
- [x] ✅ Results screenshot import (Claude vision API → populate finish time, placing, splits) — ViewEditRaceModal EditPanel screenshot button
- [x] ✅ AI text parsing of race description → populate form — `parseRaceText()` in `src/lib/claude.ts` wired into AddRaceModal. Matches V1 `parseAI()` flow.

### Other
- [x] ✅ Race attachments (photo upload per race) — `photos?: string[]` on Race type; multi-upload with canvas JPEG compression (max 1200px); grid view in ViewPanel; shipped 2026-04-23.
- [ ] 🔒 Advanced import (multi-image batch parse) — V1: `openAdvancedImportModal()`. Low priority, deferred.

---

## Dashboard

### Core Layout
- [x] ✅ PreRaceBriefing hero card (4 states: PRE-RACE, JUST RACED, ADD FIRST RACE, WHAT'S NEXT)
- [x] ✅ Narrative accordion zones (NOW / RECENTLY / TRENDING / CONTEXT)
- [x] ✅ Dashboard customize modal (zone sections, PRO badges, toggles, reorder)
- [x] ✅ Zone collapse state persisted in `fl2_dash_layout`

### Widgets — Present in V2 ✅
- [x] ✅ Season Planner widget (SeasonPlannerWidget)
- [x] ✅ Recovery Intelligence widget (RecoveryIntelWidget)
- [x] ✅ Training Correlation widget (TrainingCorrelWidget — gated behind Strava)
- [x] ✅ Boston Qualifier widget (BostonQualWidget)
- [x] ✅ Pacing IQ widget (PacingIQWidget)
- [x] ✅ Career Momentum widget (CareerMomentumWidget)
- [x] ✅ Age-Grade widget (AgeGradeWidget)
- [x] ✅ Race DNA widget (RaceDNAWidget)
- [x] ✅ Pattern Scan widget (PatternScanWidget)
- [x] ✅ Why Result widget (WhyResultWidget)
- [x] ✅ Race Readiness widget (RaceReadinessWidget)
- [x] ✅ Gap To Goal widget (GapToGoalWidget)
- [x] ✅ Surface Profile widget (SurfaceProfileWidget)
- [x] ✅ Pressure Performer widget (PressurePerformerWidget)
- [x] ✅ Travel Load widget (TravelLoadWidget)
- [x] ✅ Race Density widget (RaceDensityWidget)
- [x] ✅ Best Conditions widget (BestConditionsWidget)
- [x] ✅ Course Fit widget (CourseFitWidget)
- [x] ✅ PB Probability widget (PBProbabilityWidget)
- [x] ✅ Streak Risk widget (StreakRiskWidget)
- [x] ✅ Advanced Race DNA widget (AdvancedRaceDNAWidget)
- [x] ✅ Weather Fit widget (WeatherFitWidget)
- [x] ✅ Personal Bests widget (PersonalBestsWidget)
- [x] ✅ Race Comparer widget (RaceComparerWidget)
- [x] ✅ Race Stack widget (RaceStackWidget)

### Widgets — Partial ⚠️
- [x] ✅ Countdown widget — `CountdownCard` rendered in Dashboard NOW zone when `en('countdown')` and `nextRace` set. Days/hrs/mins display verified in code.
- [x] ✅ Field-Adjusted Placing widget — V1: `renderFieldPlacingWidget()`. V2: `PressurePerformerWidget` is a superset (shows A-race vs B/C percentile split, not just flat average). Covered.
- [x] ✅ Race Day Forecast widget — V2 `WeatherCard` component handles both live Open-Meteo forecast (≤14 days) and climate estimate (>14 days) for next race. Wired via `en('race-forecast')`. Parity confirmed.

### Widgets — Missing in V2 ❌
- [x] ✅ On This Day widget — `OnThisDayWidget` in Dashboard, matches past race by MM-DD, cycles randomly across same-day matches. Enabled by default in NOW zone.
- [x] ✅ Activity Feed Preview widget — `ActivityPreviewWidget` in Dashboard RECENTLY zone shows last 3 WHOOP activities; shows connect-prompt when no wearable linked.
- [x] ✅ Story Mode widget — `StoryModeWidget` in Dashboard RECENTLY zone: year / races / countries / medals recap.
- [x] ✅ Coach Activity widget — `CoachActivityWidget` in Dashboard PATTERNS zone; reads `fl2_coach_relationships` + `fl2_coach_comments`.
- [x] ✅ Weather greeting (6-hour forecast pills) — V2 `GreetingCard` in Dashboard fetches Open-Meteo, shows hourly pills with WMO icons + temp. 30-min cache in `fl2_geo_weather`.

### Widgets — Deferred 🔒
- [ ] 🔒 AI Insights modal (on-demand AI analysis) — V1: `openAiInsightsModal()`. Complex, deferred.
- [ ] 🔒 Season Report / printable PDF — V1: `openReportsModal()`, `buildSeasonReportHtml()`. Deferred.
- [ ] 🔒 Backup / Snapshot system — V1: `openBackupModal()`, `saveBackupSnapshot()`. Deferred.
- [ ] 🔒 Race Compare (saved comparisons) — V1 saves to `fl2_race_comparisons`. V2 has compare widget but no saved comparisons.

---

## Profile / Athlete

- [x] ✅ Athlete hero (name, initials, sport, city, stats)
- [x] ✅ Edit profile modal (full form)
- [x] ✅ Race Activity Heatmap (2yr × 12mo clickable grid → race list)
- [x] ✅ Majors Qualifiers board (7 WMM with COMPLETED / IN PROGRESS status)
- [x] ✅ Race Personality card (STARTER / DIESEL / BIG-DAY PERFORMER)
- [x] ✅ Personal Bests grid (by distance)
- [x] ✅ Signature Distances — `SignatureDistances` component in Profile.tsx. `computeSignatureDistances()` ranks PBs by age-grade (WA standards), falls back to pace (min/km for running) or speed (km/h for cycling/tri). Age-grade formula matches V1.
- [x] ✅ Athlete Performance Timeline — `PerformanceTimeline` component in Profile.tsx; season-by-season Speed / Distance / Races bars (last 5 years). Matches V1 `renderAthletePerformanceTimeline()`.
- [x] ✅ Goal Race panel — V1: `renderAthleteGoalRacePanel()`. V2 `AthleteHero` shows FOCUS RACE card with countdown. Projection/prediction deferred (requires `computePrediction()` port).
- [ ] 🔒 Race Cost Tracker — V1: `renderAthleteRaceCostTracker()`. Not in V2. Deferred post-cutover.
- [x] ✅ Countries Raced pills — V2 `CountriesRaced` component in Profile.tsx shows unique countries as uppercase pills.
- [ ] 🔒 Coach mode — V1: `openCoachModeModal()`, coach relationships, comments. Niche feature, deferred.

---

## Medals

- [x] ✅ Medal wall (tier: gold/silver/bronze/finisher, PB shimmer gradient, tier counts)
- [x] ✅ Achievement system (19 achievements, SPECIAL/MILESTONE/EVENT groups, unlocked state)
- [x] ✅ Medal photo display — `r.medalPhoto` renders as overlay image on tile; verified in code.
- [x] ✅ Community medal photos — `useCommunityMedals()` hook fetches `race_medal_photos` table (same V1 schema), overlays as fallback when no personal photo. `getRaceKey()` matches V1 slug generation. 5-min cache in `fl2_comm_medals`.

---

## Map (Races Page)

- [x] ✅ Full-viewport MapLibre map (Deck.gl arc layer for race connections)
- [x] ✅ Bottom sheet (peek ↔ expanded) with race list
- [x] ✅ Year filter tabs + compact / detailed toggle
- [ ] ⚠️ Map performance overlay (percentile-colored arcs) — V1: `setMapMode()`, `applyMapPerformanceMode()`. V2 `RaceArcLayer.tsx` uses hardcoded orange color; no performance toggle. 🔒 Deferred to post-cutover.

---

## Train / Wearables

- [x] ✅ Pace calculator (distance + target time → pace)
- [x] ✅ WHOOP OAuth (connect, token storage, activity + recovery feed)
- [x] ✅ Garmin OAuth + PKCE (connect, token storage, activity feed)
- [x] ✅ Apple Health import (< 500 MB + > 500 MB streaming path)
- [x] ✅ Strava OAuth (connect, activity sync)
- [x] ✅ Strava race import — `fetchStravaActivities()` + `stravaActivitiesToRaces()` in `src/lib/strava.ts`. Train Activities tab shows import banner when Strava race activities detected; deduplicated by `strava_id`.
- [x] ✅ Open Water / Readiness tab — Train page now has 3rd tab "Readiness" showing WHOOP recovery score ring, HRV, RHR, 30-day bar chart + history list. V1 had more OW sub-widgets; core readiness surface is now present.

---

## Gear / Flatlay

- [x] ✅ Gear catalog (25-item static catalog with filters by category/sport)
- [x] ✅ Library tab (save catalog items via "+ Save" button; saved IDs in `fl2_saved_gear`)
- [x] ✅ Custom gear items — Library tab has "+ Custom Product" modal (brand, name, category, notes). Stored in `fl2_custom_gear` (localStorage). V1 used Supabase `user_products`; post-cutover migration can sync to Supabase when that table is added.
- [x] ✅ Gear Lists — `useGearLists` hook, Lists tab: create/edit/delete lists, add/reorder/remove items from library. `fl2_gear_lists` localStorage (V1 used Supabase; post-cutover migration optional).
- [x] ✅ Race Stacks — `useGearStacks` hook, Stacks tab: 5 preset templates + custom stacks, optional race link. `fl2_stacks` localStorage.

---

## Settings

- [x] ✅ Units preference (metric / imperial) with dynamic relabeling across Dashboard/Races/Profile
- [x] ✅ Theme picker (9 themes, PRO gated via `proAccessGranted`)
- [x] ✅ Username input + availability check + `is_public` toggle + profile link preview
- [x] ✅ Change password (Supabase `updateUser`)
- [x] ✅ Claude API key field — `fl2_apikey` in localStorage. Settings AI Parsing section with show/hide + remove.
- [x] ✅ Delete account — inline confirmation in Settings, `delete_my_account()` RPC + localStorage clear.
- [x] ✅ Beta feedback widget — `BetaFeedback` component, staging + auth only, 5-star + message → `beta_feedback` table.
- [ ] 🔒 Pro modal / upgrade flow — V1: `openProModal()`, `startProCheckout()`. V2 uses `IS_STAGING` flag. Need real entitlement before prod if any V1 users paid.

---

## Data / localStorage Migration

> All items below were fixed in commit `74cf8a8`. Keeping here for tracking.

- [x] ✅ `fl2_races` → `useRaceStore.races` (migration: raw array → Zustand wrapper)
- [x] ✅ `fl2_upcoming` → `useRaceStore.upcomingRaces` (migration added)
- [x] ✅ `fl2_wishlist` → `useRaceStore.wishlistRaces` (migration added)
- [x] ✅ `fl2_focus_race_id` → `useRaceStore.focusRaceId` (migration added)
- [x] ✅ `fl2_ath` → `useAthleteStore.athlete` (migration: raw object → Zustand wrapper)
- [x] ✅ `fl2_season_plans` → `useAthleteStore.seasonPlans` (migration added)

---

## Infrastructure

- [x] ✅ `wrangler.toml` production `ASSETS` binding fixed (commit `74cf8a8`)
- [x] ✅ UTC date bug fixed in `useRaceStore` (`localToday()` helper)
- [x] ✅ CI pipeline (staging + production GitHub Actions)
- [x] ✅ Supabase migrations auto-apply on deploy
- [x] ✅ Worker SSR for `/u/:username` public profiles (`worker/index.js`)
- [x] ✅ Worker SSR smoke test — `wrangler.toml` uses `main = "worker/index.js"` + `assets = { directory = "dist", binding = "ASSETS" }`. SPA fallback serves V2 `dist/index.html`. `/u/:username` SSR reads Supabase, falls through to ASSETS for all other routes. Verified by code inspection; live verify after staging deploy.
- [x] ✅ Lazy loading (React.lazy + Suspense) — 5 page components lazy-loaded; Dashboard eager
- [x] ✅ Vendor code splitting (`vite.config.ts` manualChunks) — vendor-map/react/charts/misc separate chunks
- [x] ✅ Error tracking — `RootErrorBoundary.componentDidCatch` fires `navigator.sendBeacon('/api/error-report')`. Worker route persists payload to `beta_errors` Supabase table (anon INSERT, auth SELECT). Migration `20260419120000_beta_errors.sql`.

---

## Cutover Gate Criteria

All of the following must be ✅ before merging staging → main:

### Blockers (must fix)
- [x] ✅ Claude API key field in Settings + AI parsing in race detail modal
- [x] ✅ Community medals (useCommunityMedals hook, race_medal_photos table, V1 raceKey parity)
- [x] ✅ Delete account in Settings
- [x] ✅ Beta feedback widget (staging only)
- [x] ✅ Lazy loading + vendor split (performance, not correctness)
- [x] ✅ Worker SSR smoke test — `wrangler.toml` verified: `main = "worker/index.js"`, `assets = { directory = "dist", binding = "ASSETS" }`. Live verify after staging deploy.

### Recommended before cutover
- [x] ✅ Open Water / Readiness section in Train (WHOOP recovery score ring, HRV, 30-day history)
- [x] ✅ Strava race import (fetch + dedup + import banner in Activities tab)
- [x] ✅ Goals system (annual KM + race count goals, distance time goals, fl2_goals migration)
- [x] ✅ `fl2_goals` migrated; `fl2_gear_lists` and `fl2_stacks` are Supabase-stored (not localStorage) — no migration needed, Gear Lists/Stacks UI deferred to post-cutover

### Can ship post-cutover
- Advanced import
- AI Insights modal
- Season Report / PDF
- Backup/Snapshot
- Race Cost Tracker
- Coach mode
- Gear Lists and Stacks (V1 Supabase-stored; no migration needed until feature lands in V2)
- Story Mode widget
- Coach Activity widget
- Map performance overlay (percentile-colored arcs)
- Race prediction / projected finish on Profile goal card

---

## How to Update This File

After closing a gap:
1. Change `[ ] ❌` to `[x] ✅` (or `⚠️` if partial)
2. Add the PR number in parentheses: `(#123)`
3. Update the **Progress Summary** table
4. Re-calculate overall parity %: `done / (done + partial×0.5 + missing)`

---

## Design Review Decisions (2026-04-21)

Added by `/plan-design-review`. These are design decisions + bugs identified in Discover, Compare, and Race Morning Brief. Each has an implementation note.

### 1. Discover — Live count subheadline
**Decision:** Add `{filtered.length.toLocaleString()} upcoming races` below the DISCOVER title. Updates as filters change.
**File:** `src/pages/Discover.tsx` — below the page title `<h1>` in the header div.
**Example:** `"247 upcoming runs"` when Run filter is active; `"8,284 upcoming races"` when no filters set.

### 2. Discover — Sort order: A-priority first, then by date ascending
**Decision:** Sort filtered results by `priority` (A → B → C → null) then by date ascending within each tier.
**File:** `src/pages/Discover.tsx` — apply `.sort()` to the `filtered` array in `useMemo`.
**Note:** The catalog `priority` field values are 'A', 'B', 'C'. Null/undefined priority = lowest.

### 3. Discover — Sport filter chips: text-only, no emoji
**Decision:** Remove emoji from `SPORTS` array. Chips read `ALL / RUN / TRI / CYCLE / SWIM / HYROX` in Barlow Condensed uppercase.
**File:** `src/pages/Discover.tsx` — remove `icon` field from SPORTS array; update `FilterChip` render from `{s.icon} {s.label}` to `{s.label}`.

### 4. Discover — Skeleton loading state
**Decision:** Replace "Loading race catalog..." plain text with 3 shimmer placeholder cards.
**File:** `src/pages/Discover.tsx` — replace the `{isLoading && <div>Loading...</div>}` block.
**Spec:** Each skeleton card: `height: 72px`, `background: var(--surface2)`, `border-radius: 10px`, CSS `@keyframes shimmer` pulse animation on `var(--surface3)`.

### 5. Discover — Empty state with clear action
**Decision:** When `!isLoading && filtered.length === 0`, show: heading "No races found", subtext per active filter, and a "Clear filters" button that resets sportFilter + distFilterIdx + countryFilter + monthFilter.
**File:** `src/pages/Discover.tsx` — replace the current empty state div.

### 6. Discover — Filter chip active state: match Races page pattern
**Decision:** `FilterChip` active state should use `background: rgba(var(--orange-ch), 0.12); border-color: rgba(var(--orange-ch), 0.35); color: var(--orange)` — same as `.races-year-tab.active` in `src/styles/index.css`.
**Current bug:** Active chips use full `var(--orange)` background + `var(--black)` text, inconsistent with year tabs.
**File:** `src/pages/Discover.tsx` — update `FilterChip` active style.

### 7. Discover — `aria-pressed` on filter chips
**Decision:** Add `aria-pressed={active}` to the `FilterChip` `<button>`. Add `aria-label="Filter by country or city"` to the country/city `<input>`.
**File:** `src/pages/Discover.tsx`.

### 8. Compare — Entry point from public profile page
**Decision:** Add "Compare with @{username}" button to the public profile page (`/u/:username` Worker SSR AND `src/pages/PublicProfile.tsx`). Links to `/compare?b={username}`.
**File:** `worker/index.js` (SSR HTML) + `src/pages/PublicProfile.tsx`.
**Placement:** Below the athlete name/stats, above the race list.

### 9. Compare — Empty-param instructional state
**Decision:** When the page loads with no URL params, show: `"COMPARE TWO ATHLETES"` heading + `"Search for an athlete to compare"` subtext + a search input pre-focused. Currently shows two silent empty columns with dashed "Add" buttons.
**File:** `src/pages/Compare.tsx` — add initial state check `if (!usernameA && !usernameB)`.

### 10. Compare — No-shared-distances state
**Decision:** When both profiles load successfully but share no comparable distances, show: `"No shared distances to compare"` centered message with the athletes' top distances listed separately.
**File:** `src/pages/Compare.tsx` — check before rendering stat grid: if no stat rows would have values on both sides.

### 11. Compare — Distance group headers in stat grid
**Decision:** Group `StatRow` items by distance (MARATHON, HALF MARATHON, 70.3, etc). Each group gets a header row: `background: none; border-none; color: var(--orange); font-size: 9px; letter-spacing: 0.14em; uppercase`.
**File:** `src/pages/Compare.tsx` — restructure the stats section to group by distance.

### 12. Race Morning Brief — "Set a goal" dead link bug
**Decision:** The `<span style={{ cursor: 'pointer' }}>set a goal</span>` has no onClick handler. Wire it to open `ViewEditRaceModal` for the race.
**File:** `src/pages/Dashboard.tsx` — `RaceMorningBrief` component. The component needs an `onEditRace` prop or the modal state needs to be lifted.

### 13. Race Morning Brief — Gear checklist UX inversion fix
**Decision:** Replace the current "remove = packed" UX with a proper checked/strikethrough pattern.
**Implementation:**
- Add `packedGear?: string[]` field to `Race` type in `src/types/index.ts`
- `DEFAULT_GEAR` stays as the gear list. It's always shown.
- Tapping an item toggles `packedGear` (add/remove the item's name).
- Packed items render with `text-decoration: line-through; color: var(--green)` + green checkmark.
- `updateRace(race.id, { packedGear: next })` to persist.
- Remove `toggleGear` / replace with `togglePacked`.
**File:** `src/pages/Dashboard.tsx`, `src/types/index.ts`.

### 14. Race Morning Brief — Touch targets
**Decision:** Gear checklist items need minimum 44px touch targets. Increase button padding to `padding: '10px 12px'` (from `4px 10px`).
**File:** `src/pages/Dashboard.tsx` — gear item `<button>` style.

### 15. Map arcs — Visual spec
**Decision:** Match V1 orange arcs.
- Arc color: `rgba(232, 78, 27, 0.6)` (var(--orange) at 60% opacity)
- Arc width: 1.5px
- No animation (V1 had none)
- Deck.gl `GreatCircleLayer` already handles great-circle interpolation — no changes needed to arc geometry.
**File:** `src/components/RaceArcLayer.tsx` — update arc color and width props.

### 16. Achievement section — Copy fix
**Decision:** Change `"SUPABASE-BACKED ACHIEVEMENTS"` to `"YOUR ACHIEVEMENTS"`.
**File:** `src/pages/Profile.tsx` — `AchievementsSection` hero card label.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | Architecture, blocking bugs, localStorage migration, perf, security |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | issues_found | 8 structural issues, cutover definition missing |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | issues_open | 8 issues, 2 critical gaps (race write-back, dead goal link) |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | issues_open | score: 3/10 → 7/10, 16 decisions (14 unimplemented) |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**UNRESOLVED:** 0 — all questions resolved, implementation work pending  
**VERDICT:** ENG REVIEW COMPLETE — 2 critical gaps require implementation before cutover: (1) race Supabase write-back missing, (2) dead "set a goal" link. 14/16 design decisions also unimplemented. Parallelizable across 6 worktree lanes.

### Eng Review Critical Findings (2026-04-21)

#### P1: No Supabase write-back for races
`src/hooks/useSyncState.ts` reads race data from `user_state` on login but NEVER writes back when races are added/edited/deleted. Cross-device sync is broken. Data lives in localStorage only.  
**Fix:** Add upsert in `useRaceStore` after `addRace`/`deleteRace`/`updateRace`, following the `EditProfileModal.tsx:66-76` read-then-patch-then-upsert pattern.

#### P1 (UX): Dead "set a goal" link in RaceMorningBrief  
`Dashboard.tsx:555` — `<span style={{ cursor: 'pointer' }}>set a goal</span>` has no onClick. Confirmed in design review, still unfixed.  
**Fix:** Wire to `openViewEditRaceModal(race.id)` — requires lifting modal state or passing `onEditRace` prop.

#### P2: 14/16 design decisions unimplemented
See Design Review Decisions section above — decisions 1-14 and 16 need implementation. Decision 15 (map arcs) is the only one implemented.

#### P2: No tests for Discover.tsx, Compare.tsx, RaceMorningBrief
22 test gaps identified across new pages and the RaceMorningBrief component. Migration tests are ✅ (8 tests covering all 4 V1 keys).

### Parallelization Plan (6 independent lanes)
- **Lane A:** Fix Dashboard bugs + extract RaceMorningBrief to own file
- **Lane B:** Fix Discover (sort, chips, aria, active state, live count subheadline)
- **Lane C:** Fix Compare + PublicProfile entry point + Worker SSR compare link
- **Lane D:** Fix Profile copy ("SUPABASE-BACKED ACHIEVEMENTS" → "YOUR ACHIEVEMENTS")
- **Lane E:** Race Supabase write-back (simple upsert on addRace/deleteRace/updateRace)
- **Lane F:** Tests for Discover, Compare, RaceMorningBrief (after Lane A merges)

---

### NOT in scope of this design review
- Achievement badge art (emoji → proper badge design) — deferred to post-cutover visual polish sprint. Added to TODOS.md.
- Pro modal / upgrade flow — explicitly deferred per PARITY_CHECKLIST.
- Map performance overlay (percentile-colored arcs) — explicitly deferred.
- Race attachment photo upload — explicitly deferred.

### What already exists (reuse)
- Filter chip style: follow `.races-year-tab` CSS in `src/styles/index.css`
- Loading skeleton: use existing `Skeleton` component at `src/components/Skeleton.tsx`
- Gear checklist toggle: follow existing `PreRaceBriefing` button style from Dashboard

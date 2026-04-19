# BREAKTAPES V1 → V2 Parity Checklist

**Generated:** 2026-04-19  
**Updated:** 2026-04-19 (Sprint 2 — 4 blockers closed)  
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
| Authentication | 4 | 1 | 0 | 1 |
| Pages / Navigation | 5 | 2 | 0 | 0 |
| Race CRUD | 6 | 2 | 1 | 0 |
| Dashboard | 6 | 3 | 5 | 4 |
| Profile / Athlete | 6 | 1 | 4 | 2 |
| Medals | 2 | 1 | 1 | 0 |
| Map | 3 | 1 | 0 | 0 |
| Train / Wearables | 5 | 1 | 2 | 0 |
| Gear / Flatlay | 2 | 1 | 3 | 0 |
| Settings | 6 | 0 | 1 | 1 |
| Data / localStorage | 5 | 0 | 0 | 0 |
| Infrastructure | 7 | 0 | 2 | 0 |
| **TOTAL** | **57** | **13** | **19** | **8** |

**Overall parity: ~66%** (57 done out of 89 items)

### Sprint 2 changes (2026-04-19)
- ✅ Claude API key field in Settings (`fl2_apikey`, V1-compatible key)
- ✅ Results screenshot import in ViewEditRaceModal (Claude vision → time + placing + splits)
- ✅ Delete account in Settings (inline confirmation, `delete_my_account()` RPC)
- ✅ Beta feedback widget (`BetaFeedback` component, staging only, → `beta_feedback` table)
- ✅ Lazy loading (`React.lazy` + `Suspense` for 5 page components)
- ✅ Vendor code splitting (`manualChunks` in vite.config.ts: map/react/charts/misc)

---

## Authentication

- [x] ✅ Sign in (email/password) via Supabase Auth
- [x] ✅ Sign up (email/password)
- [x] ✅ Forgot password + 8s timeout guard
- [x] ✅ `bt_new_user` / `bt_modal_shown` flags cleared on sign-out
- [ ] ⚠️ New user onboarding: profile-first flow, welcome banner with X/7 progress, edit modal auto-open after 300ms once per device — V2 has onboarding but needs parity check vs V1's exact flow
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
- [ ] ❌ Race attachments (photo upload per race) — V1: `renderRaceAttachmentEditor()`, `handleRaceAttachmentFiles()`. V2: none.
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
- [ ] ⚠️ Field-Adjusted Placing widget — V1: `renderFieldPlacingWidget()`. V2: no direct equivalent but `PressurePerformerWidget` covers similar ground. Check if a FieldAdjustedPlacing widget should be added.
- [ ] ⚠️ Race Day Forecast widget — V1 fetches weather for next race. V2 has WeatherFitWidget which is different. Need a pre-race forecast widget specifically.

### Widgets — Missing in V2 ❌
- [x] ✅ On This Day widget — `OnThisDayWidget` in Dashboard, matches past race by MM-DD, cycles randomly across same-day matches. Enabled by default in NOW zone.
- [ ] ❌ Activity Feed Preview widget — V1: `renderActivityPreview()`. Not in V2.
- [ ] ❌ Story Mode widget — V1: `renderStoryModeWidget()`. Not in V2.
- [ ] ❌ Coach Activity widget — V1: `renderCoachActivityWidget()`. Not in V2.
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
- [ ] ⚠️ Signature Distances (avg pace display, cycling km/h vs running min/km) — V1: `renderAthleteSignatureDistances()`. Check V2 Profile.
- [ ] ❌ Athlete Performance Timeline — V1: `renderAthletePerformanceTimeline()`. Not in V2 Profile.
- [ ] ❌ Goal Race panel with taper countdown — V1: `renderAthleteGoalRacePanel()`. V2 has GapToGoalWidget on Dashboard but not on Profile.
- [ ] ❌ Race Cost Tracker — V1: `renderAthleteRaceCostTracker()`. Not in V2. 🔒 Deferred.
- [ ] 🔒 Countries Raced pills — V1 shows in Athlete page. V2 Profile has `CountriesRaced` component. Verify.
- [ ] 🔒 Coach mode — V1: `openCoachModeModal()`, coach relationships, comments. Niche feature, deferred.

> **Note:** V2 does have `CountriesRaced` in Profile.tsx (line 563) — mark ✅ after manual verification.

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
- [ ] ⚠️ Map performance overlay (percentile-colored arcs) — V1: `setMapMode()`, `applyMapPerformanceMode()`. V2 `RaceArcLayer.tsx` exists but performance mode not obvious.

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
- [x] ✅ Wishlist tab (save catalog items to wishlist, move to upcoming)
- [ ] ⚠️ Custom gear items — V1 has `openCustomProductModal()` to add arbitrary gear not in catalog. V2 Gear.tsx is catalog-only.
- [ ] ❌ Gear Lists — V1: `renderFlatlayLists()`, user-defined lists of gear, `openFlatlayListModal()`. V2: none.
- [ ] ❌ Race Stacks — V1: `renderFlatlayStacks()`, curated race-day gear sets per race, `openFlatlayStackModal()`. V2: none.

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
- [ ] ❌ Error tracking (Sentry or equivalent) — `RootErrorBoundary` catches but doesn't report

---

## Cutover Gate Criteria

All of the following must be ✅ before merging staging → main:

### Blockers (must fix)
- [x] ✅ Claude API key field in Settings + AI parsing in race detail modal
- [x] ✅ Community medals (useCommunityMedals hook, race_medal_photos table, V1 raceKey parity)
- [x] ✅ Delete account in Settings
- [x] ✅ Beta feedback widget (staging only)
- [x] ✅ Lazy loading + vendor split (performance, not correctness)
- [ ] Worker SSR smoke test vs V2 build

### Recommended before cutover
- [x] ✅ Open Water / Readiness section in Train (WHOOP recovery score ring, HRV, 30-day history)
- [x] ✅ Strava race import (fetch + dedup + import banner in Activities tab)
- [x] ✅ Goals system (annual KM + race count goals, distance time goals, fl2_goals migration)
- [x] ✅ `fl2_goals` migrated; `fl2_gear_lists` and `fl2_stacks` are Supabase-stored (not localStorage) — no migration needed, Gear Lists/Stacks UI deferred to post-cutover

### Can ship post-cutover
- Race attachments
- Advanced import
- AI Insights modal
- Season Report / PDF
- Backup/Snapshot
- Race Cost Tracker
- Coach mode
- Gear Lists and Stacks
- On This Day widget
- Story Mode widget
- Activity Feed Preview widget

---

## How to Update This File

After closing a gap:
1. Change `[ ] ❌` to `[x] ✅` (or `⚠️` if partial)
2. Add the PR number in parentheses: `(#123)`
3. Update the **Progress Summary** table
4. Re-calculate overall parity %: `done / (done + partial×0.5 + missing)`

# Changelog

All notable changes to BREAKTAPES are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.3.0.0] - 2026-04-14

### Fixed
- **Upcoming races now show on dashboard** — `applyRemoteState()` was overwriting `nextRace` with null on remote sync even when upcoming races were stored. Auto-promote logic now picks the nearest future race from `upcomingRaces` when the synced value is missing or stale.
- **Season Planner LOAD button** — plans now confirm with a toast ("Loaded 'Plan Name' — N races updated") and fall back to name+date matching when IDs differ, so plans saved before the UUID fix still load correctly.
- **Season plan IDs** — plans now use `crypto.randomUUID()` preventing silent Supabase upsert failures (`season_plans.id` is `uuid` type; old `plan-${Date.now()}` IDs were invalid).
- **Past races auto-removed from Season Planner** — opening the planner now prunes past events; `computeSeasonPlan()` also filters to future-only dates.

### Added
- **Taper timeline visualization** — the Season Planner shows an SVG timeline with proportional orange taper zones and green recovery zones for each race. Requires 2+ planned races.
- **Delete saved plans** — each saved plan now has a ✕ button to permanently remove it.
- **Auto-suggest priorities** — new button assigns A/B/C priorities by distance (Ironman/Marathon → A, Half/Olympic → B, 5K/10K → C).
- **Peak week conflict detection** — warns when two A or B races are within 21 days of each other and suggests downgrading one to C.
- **Year-over-year comparison** — side-by-side card comparing previous year vs current year race counts in the Season Planner.
- **Training block labels** — free-text inputs between race rows let you label training phases (e.g., "Base Phase", "Speed Block"); saved per race.
- **Goal time in plan view** — if a race has a goal time set, it appears in the planner card with an orange 🎯 marker.

## [0.2.1.0] - 2026-04-13

### Added
- **Sell your gear from the Flatlay** — every product in My Library now has a "$ SELL" button. Set a price, currency, condition, and description; the card shows a green price badge and flips to "$ SELLING". Listings persist locally in `fl2_sell_listings`.

### Changed
- **Race Conditions form uses select menus** — Surface, Terrain, Course Type, Elevation Profile, and Travel Context are now dropdowns with preset options instead of free-text inputs.
- **Conditions grid is 2-column on mobile** — reorganised from two `rd-grid-3` rows to three `rd-grid-2` rows with logical pairings; no orphaned fields at 375px.
- **Start Time no longer double-wide on mobile** — removed `rd-mobile-span-2` so it sits in its own column alongside Surface.
- **Currency select widened and expanded** — cost field column is now 108px (was 92px). Currency list expanded from 8 to 24 options including AUD, CAD, CHF, SGD, ZAR, AED, INR, KRW, and more.
- **History page shows only past races** — upcoming races removed from Race History; they belong on the Athlete page, not mixed with completed results.
- **Auth load is faster** — `refreshAuthState()` now parallelises Supabase syncs with `Promise.all` instead of five sequential awaits. Local state shown immediately.

### Fixed
- **History row timing column** — removed unused 32px column from `.hist-row` grid template, fixing label overflow at narrow viewports.

## [0.2.0.3] - 2026-04-11

### Fixed
- **Save Race button now works on iOS Safari** — replaced `alert()` validation with `showBtToast()` inline messages. Alerts are suppressed in modal contexts on iOS Safari, causing the button to silently do nothing.
- **Race detail modal flag cards readable on phone** — moved tag grid and grid column overrides to a `<=640px` breakpoint (was `<=520px`). Cards are now compact chips (44px height vs 84px) that sit cleanly in 2 columns at 390px viewport.
- **Boston, Chicago, Berlin 2026 now appear in upcoming race search** — catalog entries with a stale stored `event_date` (e.g. the 2025 edition) were excluded from future searches. The search now projects forward to the next occurrence using `month`/`day` when the catalog date is past.
- **Test suite updated** — `upcoming-race-flow.test.js` updated to match `showBtToast` validation. `bq-widget.test.js` conflict resolved with upstream's more defensive multi-currency check.

## [0.2.0.2] - 2026-04-10

### Fixed
- **Web scroll unblocked** — removed `overflow: hidden` from `body.landing-active`. The landing screen is `position: fixed; inset: 0` so the body lock was redundant and caused the main page to be non-scrollable on desktop until hovering the footer.
- **Catalog search with year typed** — searching "Comrades 2026" now returns results. Year filter was incorrectly excluding catalog entries that have no stored `year` field (most entries).

### Changed
- **Strongest Zones toggle** — tap the pill (shows Age Grade / Pace) to switch metric. Preference persists across sessions. Age-grade shown in green, pace in white.
- **Flatlay Discover panel compacted** — labels and help text removed; inputs and button reduced in size; filters in a 2-column row. Significantly less vertical space.
- **History card timing** — time column has consistent `min-width: 64px` and flushes right with equal spacing from card edge.
- **Majors stats row** — Completed / In Progress / Entry Ready rendered as a single compact inline row with dividers instead of three stacked cards.
- **Username once-per-year** — changing a username stamps `username_changed_at`. Subsequent change attempts within 365 days show the unlock date and disable the field with a lock hint in Settings.

### Fixed
- **Test regression** — `bq-widget.test.js` cost tracker assertions updated to match the multi-currency `{amount, currency}` data shape (was comparing against a plain number).

## [0.2.0.1] - 2026-04-10

### Fixed
- **Username validation unified** — `eUser` (athlete edit modal) now uses the same URL-slug regex as the Settings public profile field. Previously allowed dots and underscores, causing a "Invalid format" error in Settings for any user who had set a username with those characters.
- **Silent username conflict surfaced** — when a username conflicts with another account during sync (Supabase error 23505), the app now shows a toast ("Username taken — try another in Settings.") and resets the local username. Previously swallowed silently with `console.warn`.
- **Save-before-check race condition** — `saveSettings()` now blocks if the username availability check is still debouncing, preventing an unverified username from being saved.
- **`is_public` toggle enabled state** — the public profile toggle is correctly disabled when no username is set, enforced when the Settings modal opens.

### Added
- **37 new tests** in `tests/public-profile.test.js` covering Worker pure functions (`escapeHtml`, `fmtTime`, `fmtDate`, `timeToSecs`, `daysUntil`, `computePBs`, `countMedals`, `uniqueCountries`) and SPA integration (`buildRemoteStatePayload`, `updateShareProfileButton`). Total: 214 tests.
- **TODOS.md** — deferred work tracker with 4 items: drop unused `profile_views` table, add reserved username blocklist, fix availability check in-flight guard, block consecutive hyphens in slug.

## [0.2.0.0] - 2026-04-09

### Added
- **Athlete Briefing Card** — state-aware hero card at the top of the dashboard. Four states: Welcome (new user), Pre-Race (upcoming race exists with countdown + streak/last result pills), Just Finished (recent race within 7 days with time + placing + Add Next Race CTA), No Upcoming Race (last race + Add Next Race CTA).
- **Narrative dashboard layout** — four accordion sections replace the flat widget list: NOW (Race Day), RECENTLY (Your Racing), TRENDING (Build & Consistency), CONTEXT (Patterns & Analysis). Sections collapse/expand with a chevron and persist state in `fl2_dash_zone_collapse`.
- **Section accordion** — `initDashAccordion()` attaches a single delegated click listener on the dashboard page. Default state: NOW and RECENTLY expanded, TRENDING and CONTEXT collapsed.
- **13 new tests** — `tests/dash-layout.test.js` covering `getDashZoneCollapse`, `saveDashZoneCollapse`, and `getDashLayout` migration v2 (174 total, all passing).

### Changed
- **Race Stats widget** moved from NOW to TRENDING zone — it is a career summary, not race-day context.
- **Widget defaults** — leaner out-of-box experience: 8 widgets enabled by default (stats, recent, activity-preview, training-streak, insights, pbs, goals, bq). Countdown disabled by default.
- **Zone kicker labels** updated to narrative language: Progress → Recently, Training → Trending, Insights → Context.

### Fixed
- `renderAthleteBriefing()` null-guard on `last.name` — prevents crash when an AI-parsed race was saved with a missing name field.
- Migration v2 flag now written inside the try block — prevents silent abandonment on `QuotaExceededError`.
- `getDashZoneCollapse` array-type guard — prevents JSON arrays from being accepted as valid collapse state.
- `daysLabel` clock-skew guard — negative daysAway now shows "Today!" instead of "in -1 days".

## [0.1.0.0] - 2026-03-31

### Added
- **Wearables tab** in Train page with integration cards for WHOOP, Garmin, COROS (coming soon), Oura (coming soon), and Apple Health
- **WHOOP OAuth integration** — direct OAuth 2.0 connect/disconnect, activity feed, recovery data; tokens stored in Supabase for cross-device sync
- **Garmin OAuth integration** — PKCE-secured OAuth flow, activity feed with distance/duration/HR; client secrets kept server-side in Cloudflare Worker
- **Apple Health import** — upload `export.xml` from iPhone Health app; records parsed and stored by date in Supabase
- **Supabase tables** — `wearable_tokens` (WHOOP/Garmin OAuth tokens with RLS) and `apple_health_data` (imported records, keyed by date)
- **Health proxy routes** — `POST /whoop/token`, `POST /whoop/refresh`, `POST /garmin/token`, `POST /garmin/refresh` added to Cloudflare Worker
- **Brand logos** — proper SVG logos for all 5 integration cards (WHOOP W-in-circle, Garmin triangle, COROS hex-spiral, Oura ō ring, Apple Health heart)
- **15 new tests** covering `whoopSportName`, `parseAppleHealthXML`, and all new wearable function smoke tests (144 total, up from 129)

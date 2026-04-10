# Changelog

All notable changes to BREAKTAPES are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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

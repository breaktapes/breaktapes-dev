# Changelog

All notable changes to BREAKTAPES are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
## [0.6.5.0] - 2026-04-27

### Added
- **You page — multi-club support:** Edit Profile now accepts multiple clubs/teams as pills (Enter or comma to add, × to remove, max 8). Clubs display as orange pills in the profile hero card. Backward-compatible with the existing single `club` field.
- **Goals — sport + distance chip picker:** Selecting a distance goal now uses a 2-step flow: pick a sport (Running, Triathlon, Cycling, Swimming, HYROX), then pick from predefined canonical distances in ascending order. No more raw km values or race-history-derived options.
- **Goals — infinite-scroll time wheel:** Target time for distance goals now uses the `TimePickerWheel` drum-roll component instead of plain number inputs.
- **Goals — custom distance:** A "Custom +" chip lets users enter any distance in km or miles with a unit toggle.
- **Goals — 21 new unit tests:** Coverage for `saveDist` logic, `GOAL_DISTANCES` preset structure, clubs init backward-compat split, and save-patch round-trip.

### Changed
- **You page — hero card redesign:** Removed redundant detail rows (city/country/age/sport already shown in subtitle and badges). Bio gains an orange left-border accent. Stats cells use a subtle gradient. Focus Race card has a left orange border. Action buttons are now in a 2-column grid.
- **Race Activity heatmap:** Removed `overflowX: auto` and fixed `minWidth` so the grid fills the container at any viewport width without horizontal scroll. Date format in race cards changed to DDMMMYYYY. Country abbreviated to 3-letter code.
- **Goals — date input:** Deadline field now stays within the widget box (`width:100%`, `boxSizing:border-box`, `appearance:none`).

### Fixed
- Total KM in hero card now excludes DNF/DSQ/DNS races and correctly resolves named distances ("Marathon" → 42.195 km) to match the Races tab StatsStrip.

## [0.6.4.3] - 2026-04-25

### Changed
- Strava: `fetchStravaActivities` paginates the Strava API (was capped at 100 activities, now walks pages until limit/empty)
- Strava: token refresh threshold widened from 60s to 300s — fewer race conditions under burst calls
- Strava: token exchange now captures the athlete profile (firstname, lastname, profile_medium) returned by Strava and persists it on `wearable_tokens.profile`
- Strava: failed activity fetches and refreshes now log to console with status + body; 401 responses clear the stale token
- Strava: surfaces a clear "app pending approval — beta users may not be able to connect yet" toast when Strava returns a `limit:reached` athlete-cap error during token exchange

## [0.6.4.2] - 2026-04-23

### Changed
- Settings: account section replaced with profile card (avatar initials, display name, "Manage account" subtitle) — tapping opens Clerk's native account management modal

## [0.6.4.1] - 2026-04-23

### Changed
- Account settings: "Change Password" replaced with "Manage Account" — opens Clerk's built-in account management modal (password change, security settings)
- Delete account confirmation now lists every category of data that will be permanently removed (races, medals, wearable data, season plans)
- Account deletion now removes the Clerk login in addition to all Supabase data, completing the full account teardown

## [0.6.4.0] - 2026-04-23

### Added
- Pace calculator: splits table (Race/KM/Mile tabs) appears after calculating
- Triathlon calculator: dual-mode toggle — enter pace to see time, or enter time to see pace
- Race catalog: 10-page parallel fetch covers all 8,284 catalog races (was capped at 1,000)
- AddRaceModal: year pills now derived from actual catalog entries (no generic year fallback)
- AddRaceModal: selecting a year auto-fills date, distance, sport, city, country

### Changed
- Pace calculator: distance dropdown no longer shows PB suffix; goal time defaults to 0:00:00
- Triathlon calculator: pace input and time display now same font size (16px)
- Triathlon segment bar: fixed 5-column grid so T1/T2 labels are always visible
- AddRaceModal: warns when logging a future-dated race in 'Log a Race' tab with 'Move to Upcoming' CTA



## [0.6.3.0] - 2026-04-23

### Added
- **Pace calculator — Running/Triathlon split**: the Train page now has a sport selector. Running shows 8 distance chips (5K, 10K, 10 Mile, Half Marathon, Marathon, 50K, 100K, Custom) with per-distance PB auto-fill. Triathlon shows Sprint Triathlon, Olympic Triathlon, 70.3/Middle Distance, and IRONMAN/Full Distance cards — full names, not abbreviations.
- **Goal time wheel**: the pace calculator uses a drum-roll scroll wheel for hours (0–99), minutes (0–59), and seconds (0–59). Scrolls infinitely in both directions. All three columns are independent — no boundaries between min and max values.
- **"Use My PB" auto-fill**: each running distance shows a button with the user's personal best time. Tapping it fills the goal time wheel so users can plan paces relative to their best result.
- **Custom distance field**: running mode adds a Custom chip that reveals a number input with a KM/MI toggle. The pace calculator derives pace from any user-supplied distance.
- **Triathlon segment calculator**: modelled on tricalculator.com. Inputs for swim pace (min/100m), T1 (mm:ss), bike speed (km/h), T2 (mm:ss), and run pace (min/km). Results update live — no Calculate button. Shows each segment's split time, total finish time, and a proportional colour-coded segment bar.

### Changed
- **Date picker in Add Race moved under Race Name**: year chips (last 10 years) appear directly below the race name field. Tap a year to set the date. "Add manually →" reveals the full date input; "← pick year" returns to chip mode.

### Fixed
- **Tapping a race row in compact or detailed view now opens the detail sheet**: both CompactRow and DetailedRow onClick handlers now also expand the bottom sheet, so the race card is visible after tap.

## [0.6.1.0] - 2026-04-21

### Fixed
- **Profile links on staging now point to the right URL**: sharing your profile from `dev.breaktapes.com` used to copy an `app.breaktapes.com` link. Fixed — staging generates `dev.breaktapes.com/u/...`, production generates `app.breaktapes.com/u/...`.
- **Race import error feedback**: when UltraSignup or MarathonView fails to respond, a red banner now names which source(s) failed with a RETRY button. Previously the failure was silent.
- **Activity widget empty state**: the Recent Training widget now shows "No activities yet — sync your wearable to see recent training." instead of rendering nothing.

## [0.6.0.1] - 2026-04-20

### Added
- **Theme packs for all 9 themes**: every color-bearing UI element (widget cards, buttons, animations, tags, badges, map pills, PB rows, year dividers, passport modal) now derives its color from CSS custom properties. Switching theme changes everything — not just the background.
- **New CSS variables**: `--gold-ch` (RGB channels for gold), `--grad-primary`, `--grad-secondary`, `--shell-gradient` added globally and overridden per-theme for Deep Space, Race Night, Obsidian, Acid Track, Titanium, Ember, and Polar Circuit.

### Fixed
- Widget card gradients were always orange regardless of active theme — converted all hardcoded `rgba(232,78,27,...)`, `rgba(0,255,136,...)`, and `rgba(200,150,60,...)` values to `rgba(var(--orange-ch),...)`, `rgba(var(--green-ch),...)`, and `rgba(var(--gold-ch),...)`.
- Removed beta feedback floating button.
- Fixed CI: pinned `onnxruntime-web` to 1.21.0, added `.npmrc` legacy-peer-deps for `@imgly/background-removal` compatibility.
- Fixed two Dashboard test matchers that had drifted from refactored component text.
- Safari: added `border-left-color: var(--orange)` fallback on PB race rows — `border-image` with `var()` is unsupported in Safari so the solid fallback now renders in the correct theme color.
- **Athlete Dossier share card** now exports in the active theme's colors. The canvas 2D API bypasses CSS custom properties, so the card was always rendering in default Carbon+Chrome orange. Fixed by reading `--orange-ch`, `--green-ch`, `--gold-ch`, `--black`, `--white`, `--muted`, `--muted2`, and `--gold` from `getComputedStyle` at draw time. Deep Space users get a blue dossier, Race Night gets yellow, etc.
- **Garmin token auto-refresh**: tokens now refresh automatically when expiring within 5 minutes. `refreshGarminToken()` calls `POST /garmin/refresh` on health-proxy, saves the updated token, and clears stale tokens on failure so users see a reconnect prompt instead of silent errors.

## [0.6.0.0] - 2026-04-16

### Added
- **WHOOP OAuth 2.0 integration**: connect your WHOOP band to see workout activity + recovery scores in the Train tab. Token exchange via health-proxy, auto-refresh 60s before expiry, tokens stored in Supabase `wearable_tokens`.
- **Garmin OAuth + PKCE integration**: secure authorization using SHA-256 code challenge via `crypto.subtle.digest`. Workout activities pulled from Garmin Wellness API (90-day window), PKCE verifier stored in `sessionStorage`.
- **Strava OAuth integration**: read-only activity sync via `activity:read_all` scope.
- **Apple Health XML import**: upload your `export.xml` — files < 500 MB parse inline; files > 500 MB stream in 8 MB chunks with incremental Supabase upserts so even 2 GB exports never OOM.
- **Claude AI race parsing** (`src/lib/claude.ts`): paste race result text or upload a screenshot and the form auto-fills name, date, city, country, distance, sport, finish time, placing, and splits. Uses `claude-haiku-4-5-20251001` with user-supplied API key.
- **Race Share Card** (`src/components/RaceShareCard.tsx`): 1200×630 canvas card showing race name, location, date, finish time, distance, placing, and medal badge. Download as PNG or copy to clipboard.
- **Wearable activity feed in Train**: parallel WHOOP + Garmin activity fetch, merged and sorted by date, with OAuth callback handling for `?state=whoop|garmin|strava` return URLs.
- **Live wearable Connect/Disconnect buttons in Settings**: shows ● Connected status in green with real token state from Zustand; Apple Health card has file upload with streaming progress bar.
- **Race search + pagination in Races sheet**: search bar filters by name/city/country with 150ms debounce and × clear; results paginated 20 per page with "Show more" button.
- **Share Profile button on Athlete page**: visible when `username` + `isPublic` are both set, copies `https://app.breaktapes.com/u/{username}` to clipboard.
- **`addUpcomingRace` + `autoMoveExpiredUpcoming`** in `useRaceStore`: upcoming races whose date passes automatically move to the past races list on every rehydration.
- **Map pin markers**: replaced arc routes with MapLibre `<Marker>` pin dots (orange circles), removing the deck.gl dependency entirely.

### Fixed
- **TypeScript `Record<MedalTier, number>` indexing error** in `Profile.tsx`: added explicit `MedalTier` union type so `tierCounts` is correctly typed.

## [0.5.1.0] - 2026-04-16

### Added
- **Dashboard PreRaceBriefing card**: context-aware hero card with four states — PRE-RACE (countdown + last race pill), JUST RACED (days since + finish time), ADD YOUR FIRST RACE (onboarding CTA), and WHAT'S NEXT (no upcoming race).
- **10 new dashboard analytics widgets**: Season Planner (90-day race lineup with taper/recover days), Recovery Intelligence (estimated recovery days remaining with load score), Training Correlation (Strava-connected gate), Boston Qualifier (live BQ gap vs personal marathon PB), Pacing IQ (FADER/NEGATIVE SPLITTER/EVEN PACER from splits data), Career Momentum (form trend score + HOT/RISING/NEUTRAL/COOLING badge), Age-Grade Score (WA standards gate on DOB+gender), Race DNA (temperature fit + fade rate), Pattern Scan (deep pacing trends + EXPLAIN WITH AI), Why Result (COACH BRIEF for last race).
- **Dashboard Customize modal redesigned**: bottom sheet with zone sections (NOW / RECENTLY / CONSISTENCY / PATTERNS), per-widget PRO badges, iOS-style toggle switches, ▲/▼ reorder buttons.
- **Profile page full redesign**: Achievements hero card (green gradient, 19 achievements, SPECIAL/MILESTONE/EVENT groups), Countries Raced pill chips, Age-Grade Trajectory, Race Activity Heatmap (2-year × 12-month clickable grid), World Marathon Majors board (7 majors with COMPLETED/IN PROGRESS/ENTRY READY stats), Race Personality widget (STARTER/DIESEL/BIG-DAY PERFORMER computed from race history), Personal Bests grid.

### Fixed
- **Zustand infinite render loop**: `selectDashLayout` and `selectDashZoneCollapse` selectors were calling `getDashLayout()` / `getDashZoneCollapse()` inline which returned new object references on every render, triggering `useSyncExternalStore` to force re-renders infinitely. Selectors now return stable `s.widgets` / `s.zoneCollapse` references; components compute merged layout via `useMemo`.

## [0.4.0.0] - 2026-04-16

### Added
- **Races page rebuilt — Flighty Passport style**: the globe is now the primary full-viewport layer with a bottom sheet sliding up from the bottom. Tap the handle to peek race history; swipe up or tap again to expand fully.
- **Year-wise filtering**: tap All · 2026 · 2025 · ... tabs in the sheet header to filter the race list and stats in one tap.
- **Compact and Detailed view modes**: Compact shows name + city/date | time + distance in a clean single row; Detailed shows full cards with PB, medal, terrain, and A-Race tags.
- **PB gradient rows**: personal-best races get an orange left-border gradient highlight in compact view.
- **Arc map connections**: race cities are connected by curved great-circle arcs instead of straight lines.
- **Share Race Log**: canvas-based 1200×630 race passport card (stats + country flags + athlete name) with Download and Copy Image.
- **Pace Calculator widget**: expandable dashboard widget for target-pace and finish-time calculations with VDOT training zones.
- **Athlete focus card redesign**: race name on its own line, status pill top-right, countdown bottom-left — cleaner hierarchy on narrow screens.

### Changed
- Map stat pills (Races, Countries, Cities, KM) removed from the floating overlay — stats now live exclusively in the bottom sheet.
- Map loading spinner now sits behind the sheet (lower z-index) so the race list is immediately usable while tiles load; 5-second fallback auto-dismisses the spinner on slow or offline connections.
- Races page height calculation now correctly subtracts both header and bottom nav, keeping all chrome visible.

### Fixed
- `renderMap()` no longer crashes when the map pill elements are absent from the DOM.
- `r.time` is now escaped with `escapeHtml()` in compact and detailed race rows (XSS fix).
- `_loadTimeout` is cleared on the zero-races early-return path.
- Stale `map-empty-state` overlay is removed when the user logs their first race.
- Geocoding loop skips races with no city/country instead of sending empty queries to Nominatim.
- `copyShareCard()` async clipboard error is caught inside the `toBlob` callback.

## [0.3.1.3] - 2026-04-15

### Changed
- Bottom nav labels are now larger (10px) and higher contrast, including 360px devices
- Side menu items show brief descriptions under each label
- All feature descriptions shortened across Flatlay, Open Wearables, Fatigue chart, and integration help
- Dashboard zone titles simplified: "Build & Consistency" → "Consistency", "Patterns & Analysis" → "Patterns"

### Fixed
- All 6 pages fit within 375px viewport with no horizontal scroll on iOS Safari
- Side menu: `transform:translateX(100%)` + `display:none` replaces `right:-310px` to stop iOS from inflating `body.scrollWidth`
- `.wrap > * { min-width: 0 }` blanket rule prevents any grid child from overflowing its 1fr column (fixes Activities tab cutoff)
- Dashboard PB strip and athlete profile grids: `min-width:0` cascade prevents flex containers from expanding past their grid column
- Athlete hero: `minmax(140px, 0.75fr)` floor prevents right column collapse on narrow viewports
- Menu rapid-toggle race condition: `_menuCloseTimer` stored and cleared on re-open
- Side menu `aria-expanded` and `aria-hidden` now toggle correctly for screen readers
- Recent Training Strava placeholder text no longer truncates — `.ap-name` uses `flex:1; min-width:0` instead of `max-width:160px`
- FIT file upload shows a clear error toast instead of crashing when the parser is not loaded or file exceeds 100 MB
- `initAuth()` races against a 4-second timeout — slow Supabase no longer causes a blank screen

### Added
- Page title bar (mobile-only): sticky label showing the current page name
- Loading spinner on the landing screen while auth resolves

## [0.3.0.2] - 2026-04-15

### Changed
- Unified all layout containers to `display: grid; grid-template-columns: 1fr; gap: 1rem` — replaces inconsistent flex-column gaps (0.6–1.5rem) across `.wrap`, `.dash-shell`, `.dash-zone`, and `.dash-zone-grid`
- Layout uniformity rule documented in `DESIGN.md` — applies to all current and future components

## [0.3.0.1] - 2026-04-15

### Fixed
- **WHOOP OAuth — "Strava authorization was denied" false error** — the Strava callback handler was intercepting WHOOP error redirects when WHOOP returned `?error=access_denied` without echoing back `?state=whoop`. Fixed by gating the Strava callback on `state=strava` (added to `startStravaOAuth()`) and explicitly handling WHOOP denial with a clear "WHOOP authorization was denied." toast.
- **WHOOP OAuth — health proxy DNS was unreachable** — `health.breaktapes.com` had no DNS record; the Worker route pattern was deployed but the custom domain DNS entry was never provisioned. Fixed by switching `health-proxy/wrangler.toml` from a zone route pattern to `custom_domain = true`, which auto-provisions the DNS record on deploy. Redeployed — `health.breaktapes.com` is now live.
- **WHOOP OAuth — refresh tokens not returned** — the `offline` scope was missing from `WHOOP_SCOPES`, so WHOOP never issued a refresh token. Added `offline` to the scope list.
- **Apple Health import crashes mobile Safari (< 500 MB)** — `parseAppleHealthXML()` used `DOMParser` which builds a full XML DOM from the file, tripling memory usage. Replaced with a regex-based attribute extractor that never materialises the DOM tree.
- **Apple Health import crashes for files > 500 MB** — even the regex approach called `file.text()` which loads the entire file as a JS string, fatal for 1–2 GB exports. Added `importAppleHealthXMLStreaming()` for files over 500 MB: reads in 8 MB chunks via `FileReader`, processes records per-chunk, and upserts to Supabase incrementally using chronological date flushing. Peak memory is ~2 chunks regardless of file size. Shows live `Importing… N%` progress.

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

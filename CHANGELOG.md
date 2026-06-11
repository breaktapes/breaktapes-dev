# Changelog

All notable changes to BREAKTAPES are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.7.7.13] - 2026-06-11

### Changed
- **Sporthive search recall headroom.** Speedhive name-search `count` raised 40 → 100 (upstream's max, verified). With quoted AND-mode search (v0.7.7.10) the top results are already real matches; this widens the candidate pool for very common names with more than 40 namesakes. Per-result fetch fan-out stays capped at 25.

## [0.7.7.12] - 2026-06-11

### Added
- **Search-term shape on import analytics (PII-safe).** Every `race import searched` event (all six providers) now carries `term_tokens` + `term_length` — the shape of what was searched, never the name itself. Diagnosing the v0.7.7.10 sporthive incident required manually brute-forcing name patterns because the events carried no signal about the query; with shape props, a pattern like "common two-token names always return zero" is visible directly in PostHog.

## [0.7.7.11] - 2026-06-11

### Fixed
- **Race-import analytics now tie to real users.** The import wizard's six provider fetches never sent PostHog identity, so every server-side `race import searched` event logged as `anonymous`/`anon` — funnels couldn't connect search → select → complete to a user or session. `RaceImportModal` now forwards `X-POSTHOG-DISTINCT-ID` + `X-POSTHOG-SESSION-ID` (already CORS-allowlisted), and the three worker routes that shadowed the shared distinct-id with their own `'anon'` default (sporthive, hopasports, runsignup) use the shared one.
- **MarathonView page-shape changes no longer masquerade as zero results.** A missing/unparseable `const json=` payload returned `status: ok, results: []` — indistinguishable from a real no-match (verified zero-result pages still carry the payload). Now throws → `status: error`, frontend flags the source, exception captured.
- **Import diagnostics in analytics.** `race import searched` gains per-provider props: marathonview `raw_rows`/`filtered_rows` (namesake-filter visibility), ultrasignup `persons_matched`, sporthive `fetch_failures` (partial per-result fetch loss was invisible), runsignup `$session_id`.
- health-proxy redeployed to prod + staging workers; routes verified live.

## [0.7.7.10] - 2026-06-10

### Fixed
- **Sporthive race import returned 0 results for common names.** PostHog showed 8/8 sporthive searches with `result_count=0` in the week of 2026-06-08. Root cause: the Speedhive search API (`search.speedhive.com/api/search`) ranks by OR-semantics relevance — an unquoted two-token term like "Maria Santos" fills the top 40 hits with single-token matches, and the worker's every-token name filter then discards all of them. Rare names ranked their exact match high enough to survive, which is why spot checks passed while real users got nothing. Fix in `health-proxy/src/index.js`: search with the term **quoted** first (`term="Maria Santos"` switches upstream to all-tokens-required mode; verified "Maria Santos" goes 0 → 25 results), fall back to the unquoted search when the quoted pass matches nothing.
- **Sporthive upstream failures no longer masquerade as empty results.** The search fetch swallowed non-OK responses and timeouts into `[]`, logging `result_count: 0, status: ok` — outages were indistinguishable from no-data in analytics. Now, if every search attempt fails upstream, the route returns `status: error` (frontend flags the source as errored) and the exception is captured. The `race import searched` event also gains `search_hits`, `matched_count`, and `fallback_used` properties for future diagnosis.
- health-proxy worker redeployed manually to both prod (`breaktapes-health`) and staging (`breaktapes-health-staging`); fix verified live on `health.breaktapes.com`.

## [0.7.7.9] - 2026-06-10

### Fixed
- **Tour analytics are now trustworthy.** `tour_step_viewed` fires exactly once per step per run (Back-button revisits and dev double-mounts no longer inflate the funnel); a mid-tour page refresh reports `restart: true` on `tour_started` instead of looking like a second new user; `tour_skipped` and `tour_completed` carry `steps_shown` (+ `steps_total`) so a "completion" where steps auto-skipped — e.g. a broken spotlight selector — is visible in the data instead of counting as a full tour.

## [0.7.7.8] - 2026-06-10

### Added
- **Onboarding tour.** New users get a 6-step spotlight walkthrough on their first dashboard visit: welcome, log/import your first race, tappable dashboard widgets, the customize button, and the Races and You tabs. Steps spotlight the real UI with a dimmed backdrop and a card explaining each stop; anything not on screen is skipped automatically. Replayable anytime from Settings → About → "Take the App Tour". Finishing or skipping the tour is remembered across devices, and signing out hands the next account on the device a fresh tour. Instrumented end to end (`tour_started` / `tour_step_viewed` / `tour_skipped` / `tour_completed`) so the new-user funnel is measurable.

### Fixed
- **Tour can never clobber an existing profile.** The tour only auto-starts (and only writes its done-flag to the synced profile) after the remote-state pull has landed — finishing or skipping it on a fresh device before sync completes can no longer create a skeleton profile that would win the last-write merge and wipe the real one.
- **Tour overlay hardening.** The explainer card (with its Skip button) stays on screen while a step's target is still loading instead of briefly dimming the app with no controls; the spotlight no longer jumps to a corner if its target disappears mid-step; the card stays fully on-screen on short viewports; keyboard focus follows the tour so Tab can't operate the page underneath; all tour buttons meet the 44px touch minimum.

## [0.7.7.7] - 2026-06-09

### Docs
- **Documented the Strava production enablement (v0.7.7.4).** Added a Session 43 entry to `CLAUDE.md` session history and a "Production enablement" note to the Strava section of `docs/memory/integrations.md`. Captures that the `stagingOnly` gate was removed (no connect-flow logic changed) and the two config-not-code prerequisites that keep prod connect dead until set: `VITE_STRAVA_CLIENT_ID` in the production Cloudflare Pages env, and `https://app.breaktapes.com/train` registered as a Strava Authorized Callback Domain. Docs only — no code or behavior change.

## [0.7.7.5] - 2026-06-09

### Added
- **Isolated staging instance for the health-proxy Worker.** `health.breaktapes.com` was a single shared worker with no staging copy (it carries OAuth callbacks, registered once per provider). Added `[env.staging]` → `wrangler deploy --env staging` publishes a separate `breaktapes-health-staging` worker on `*.workers.dev` (no custom domain, no OAuth routes) so the retention cron can be tested against the staging Supabase without touching production. Plus a `GET /retention/run` manual trigger **gated on `RETENTION_TEST_ENABLED=1`** — set only in `[env.staging.vars]`, so the route returns 404 in production and never runs on `health.breaktapes.com`. Used to validate the full retention chain end-to-end (reminder send → `reminder_sends` idempotency → unsubscribe → opt-out filtering) on staging.

## [0.7.7.4] - 2026-06-09

### Changed
- **Strava integration now live on production.** The Strava connect card in Train → Wearables was gated to staging/localhost only (`stagingOnly: true` + `isStagingHost()`), because the Strava API app was capped at 1 athlete pending a rate-limit increase. The cap has been raised (10 users already authenticated), so the gate is removed — Strava now shows on `app.breaktapes.com` exactly like WHOOP. Connect flow (`startStravaOAuth` → `handleStravaCallback` → `fetchStravaActivities`) was already fully wired; no logic changed. The `stagingOnly` field + host filter are kept for future gated providers.
  - **Deploy-time prerequisites** (config, not code): `VITE_STRAVA_CLIENT_ID` must be set in the production Cloudflare Pages env, and `https://app.breaktapes.com/train` must be a registered Authorized Callback Domain in the Strava API app settings.

## [0.7.7.3] - 2026-06-09

### Fixed
- **Triathlon distance "70.3"/"140.6" mis-classified as the wrong band.** `parseDistKm()` ran `parseFloat` before the label map, so `"70.3"` (a race name in MILES) was read as **70.3 km** → `detectTriType()` bucketed it as **Olympic** instead of 70.3. This silently corrupted the Triathlon Predictor: a real 70.3 used as the source showed the Olympic tab same-band (Riegel identity → swim/bike unscaled, e.g. raw 43:37 swim / 3:38:00 bike) and the IRONMAN tab cross-band, with mis-weighted `alpha`. Fix: `parseDistKm` is now **map-first** — known race-name labels resolve before the numeric fallback. Added `'140.6'`, `'ironman 70.3'`, `'im 70.3'` aliases. Incidentally also fixes `"50mi"/"100mi"/"10 mile"` (previously read as 50/100/10 km).
- **Demo data normalized.** 11 demo triathlon `distance` fields stored the literal `"70.3"` → changed to canonical `"113"` (km, matching the AddRaceModal dropdown). Race names containing "70.3" left untouched.

### Tests
- `src/lib/__tests__/raceFormulas.test.ts` — regression coverage for `parseDistKm` (mile labels, word labels, genuine numeric km, garbage).

## [0.7.7.2] - 2026-06-09

### Added
- **Retention emails — race-day reminders + weekly digest.** PostHog showed usage is spike-then-dead with zero re-engagement triggers. A daily Cloudflare cron (health-proxy `scheduled` handler, 13:00 UTC) emails opted-in users a reminder when an upcoming race is within 3 days, and a weekly digest every Monday (next race + prompt). Pure selection logic lives in `health-proxy/src/retention.mjs` (unit-tested in `src/lib/__tests__/retention.test.ts`); `reminder_sends` (new table) gives per-(user, kind, race) idempotency so nothing double-sends.
  - **Opt-in: default ON** with a one-click **Unsubscribe** link in every email (`GET /email/unsubscribe?token=…`, flips `email_opt_in` on the column and in `state_json.athlete` so the client never re-enrolls). A toggle in Settings → Preferences ("Email reminders") lets users turn it off in-app.
  - **Schema** (`20260609120000_retention_email.sql`): `user_state` gains `email`, `email_opt_in` (default true), `unsubscribe_token`; `reminder_sends` table for audit/idempotency. **Applied to staging only** — prod migration is gated.
  - **Email plumbing:** the client now syncs `email` (from Clerk) + `email_opt_in` through `/api/sync` (Worker writes them as columns, omitted-key-safe so a stale client can't clobber an unsubscribe). The existing `/email/send` Resend path was refactored into a shared `sendEmail()`.
  - **Gated on setup:** the cron no-ops until `SUPABASE_SERVICE_ROLE_KEY` + `RESEND_API_KEY` are set on the health-proxy Worker and the Resend sending domain is verified. Nothing emails real users until then.

## [0.7.7.1] - 2026-06-09

### Added
- **Logging a race now auto-opens the share card.** PostHog showed the share loop was effectively dead (5 profile toggles / 5 views in 90d) while logging was the one healthy action (53 in the burst week). After saving a new past race, the share-card passport opens automatically so every result becomes a chance to share; closing it closes the modal. Upcoming races and edits to existing races are unaffected.
- **Share-loop instrumentation.** `RaceShareCard` now emits `race share card opened` (with `trigger: post_log | race_detail`), `race share copied`, and `race share downloaded` — previously the share card fired nothing, so the funnel was blind.

### Changed
- The post-save "Race added" toast in the log form is replaced by the share card itself.

## [0.7.7.0] - 2026-06-09

### Changed
- **Race import is now 1-tap.** PostHog showed the import funnel leaking ~86% (search → completed). The modal was already zero-form, so the leak was the non-obvious two-step (tick a row, then press IMPORT) and dead-end empty searches. On results, the single best non-duplicate match is now auto-selected and floated to the top of the list, so the user lands ready to commit in one confirm tap (we never auto-save — guards against a wrong namesake). Best-match ranking (`src/lib/importRank.ts`, unit-tested) favours richer payloads (splits/placing/time), exact name match, then recency.
- **Empty-results dead-end replaced with a handoff.** "No results" now shows a primary **+ ADD RACE MANUALLY** CTA that opens the manual add-race form, instead of a back button only.

### Added
- **Import funnel instrumentation.** New client-side PostHog events the server-side per-provider events can't see: `race import results shown` (total/has_results/provider_counts), `race import no results`, `race import row selected` (with `was_auto`), and `race import add manual clicked`. These pin whether the real drop is no-results vs results-but-no-select vs select-but-no-import. IronmanRacePicker emits the same events for funnel parity.
## [0.7.6.12] - 2026-06-05

### Fixed
- **Permanent fix for the recurring cross-device race data-loss bug** (races disappearing from history, races duplicating/resurrecting, upcoming races vanishing). Root cause across every prior recurrence: `/api/sync` did a full `state_json` REPLACE, so the client — which always syncs its entire state — could wipe the server row whenever it wrote with empty/partial local state (fresh device, cleared cache, incognito, a pull-error escape hatch, or any future mount-time write). Gating individual write paths was a deny-list that kept missing new paths.
  - **Server-side merge (the gun removed):** `/api/sync` now MERGES incoming state into the existing row instead of replacing it — races/upcoming union by `id`+`updatedAt` (last-write-wins) minus tombstoned ids; lists/goals/athlete keep existing data when the incoming slice is empty. An empty/partial flush can no longer reduce a populated row. Delete intent travels only via tombstones, never via "absent from the list". Logic lives in `src/lib/stateMerge.ts`, imported by both the Worker and the tests (single source of truth, no client/server drift).
  - **Write-gate belt:** the 8s offline fallback no longer opens the write gate on a pull error when local state is empty — nothing worth persisting, and a later successful pull opens it with real data.
  - **Resurrection fix:** `autoMoveExpiredUpcoming` (fires automatically on every rehydrate) no longer re-stamps `updatedAt` or clears tombstones — that let an automatic move beat a genuine cross-device delete and resurrect it. The deliberate user-action path (`dismissExpiredRace`) keeps its tombstone-clear.
  - **Regression guard:** `src/lib/__tests__/stateMerge.test.ts` asserts the core invariant — *a sync write with empty local state must never reduce the server race count* — so any future reintroduction of full-replace fails CI loud.

## [0.7.6.11] - 2026-06-05

### Added
- **T100 import via our own DB (`t100_results` table).** T100 results live on sportstats.one, which is bot-protected (DataDome-style) — live scraping from a Worker gets an empty shell. So instead we harvest results into a Supabase table and the import queries our own DB: type your name → your T100 races appear in the Import dialog (finish time, swim/T1/bike/T2/run splits, overall/gender placing, category). This decouples the hard, occasional harvest (one pull per event, ~8/year, done out-of-band with a real browser) from the runtime import (a fast, robust public-read query). Migration `20260605000000_t100_results.sql` adds the table (anon SELECT, pg_trgm name index, dedupe unique index); `RaceImportModal` queries it via `supabaseAnon` in the name fan-out. Table seeds out-of-band; the wiring is live and serves the moment rows land.

## [0.7.6.10] - 2026-06-05

### Added
- **Sporthive / Speedhive (MYLAPS) race import — true global name search.** Type your first + last name in the Import dialog and your races appear inline next to MarathonView, with finish time, placing, distance and (for triathlons) per-leg splits. Works for any finisher across the whole MYLAPS network, not just claimed accounts. Two open JSON GETs: `search.speedhive.com/api/search?term={name}` returns every race the person ran (event, race, date, raceId, bib), then `eventresults-api.speedhive.com/sporthive/races/{raceId}/bibs/{bib}` returns the finisher's chip time (gun fallback), overall/gender placing, category and splits. Wired into the existing `RaceImportModal` name fan-out as `POST /import/sporthive`. Results are name-token filtered (fuzzy search is loose) and capped at 25 races per search to bound the per-result fetch fan-out.

## [0.7.6.9] - 2026-06-04

### Added
- **Hopasports race import (UAE / MENA).** New import source covering the regional timer behind RAK, Dubai, Khorfakkan and other UAE events — races MarathonView (marathon-only) never carried. In the Import dialog, enter your name, then search and pick your Hopasports event; the worker parses the event's race list, scans every race (21km/10km/5km…) in parallel for your name, and pulls finish time, placing and distance. Finish times are chip/net (no gun-time inflation). Worker routes: `POST /import/hopasports-events` (event search via the public listing) and `POST /import/hopasports` (results by event + name).
  - Event-scoped by necessity: Hopasports has no public global athlete search (its site search is Livewire, not callable from a Worker), so import is event-first rather than pure name fan-out.
  - Hopasports exposes no machine-readable event date; the imported race is stamped with the year from the event (e.g. `2026-01-01`) for you to adjust the exact day in race detail.
- **Speedhive/Sporthive investigated, deferred.** Its search + events APIs are open, but finisher-row (classification) results are gated behind a non-public SPA route and per-athlete aggregation needs a claimed MYLAPS profile — not reliably importable from a Worker. Documented for a future pass.

## [0.7.6.8] - 2026-06-04

### Fixed
- **Age-Grade Pace Projection used current age instead of age-at-PB.** The Train → Pace projection graded every PB against the athlete's *current* profile age, so an old PB set at 47 was projected as if it had been run at 54 — overstating how much faster the athlete would be at a younger target age. For a 4:18:16 marathon PB set at 47, projecting to age 30 showed `3:27:51` (19.5% faster) when the correct value is `3:47:04` (12.1% faster). Each PB is now graded from the age it was actually set at (race date − DOB), per-row, with the achievement age shown under each PB time. Falls back to the manual/profile age only when a PB has no race date or DOB is unknown.

## [0.7.6.7] - 2026-06-04

### Fixed
- **MarathonView import used gun time instead of net (chip) time.** The scraper read `result` (official gun time) and ignored `personal_time` (the runner's chip time). For big-corral majors like Berlin and Tokyo, a back-of-pack runner's gun→net gap reaches 15+ min, so imported finish times came in inflated (e.g. Berlin 2018 imported as 5:02:57 when the net time was 4:32:15). Now prefers `personal_time`, falls back to `result` only when net is absent, and rounds the fractional seconds MarathonView sometimes returns. Existing saved races keep their old values — re-import to pick up net times.

### Added
- **Age/gender namesake filter on name-based import.** MarathonView name search returns every namesake; results are now soft-filtered against the signed-in athlete's DOB-derived birth year and gender (`RaceImportModal` passes `birthYear` + `gender`; the worker filters). Conservative by design — a row is dropped only on a real conflict, never when the source leaves the field blank, so the user's own races (which MarathonView often leaves age/gender-null) are never discarded. Wired for MarathonView; other sources unchanged.

## [0.7.6.6] - 2026-06-04

### Performance
- **Core Web Vitals pass on the auth + landing surfaces.** Real-user monitoring (Cloudflare Web Analytics, bots excluded) flagged poor INP on the Clerk password field (P-worst 5,816 ms), a 0.251 CLS on the Clerk sign-up box, LCP P50 of 3,280 ms (36% Poor), and an LCP P99 of 11 s. Root cause was a single chain: the app gated all paint on Clerk `isLoaded`, and the root `index.html` shipped zero render hints, so first paint and first auth interaction both waited on a cold Clerk init plus a render-blocking, CSS-`@import`'d font fetch. Fixes:
  - **`index.html`** — `preconnect` + `dns-prefetch` to `clerk.breaktapes.com`; `preconnect` to Google Fonts and load the two families via `<link>` instead of a CSS `@import` (which chained behind the CSS bundle download). Warms Clerk and fonts before first paint/tap.
  - **`AuthGate.tsx`** — render the real login screen during `!isLoaded` for logged-out visitors (gated on the `__client_uat` Clerk cookie hint), so the headline text is the LCP element instead of a pulsing dot. Reserve the Clerk card footprint (`rootBox`/`card` `minHeight`) and top-anchor the modal overlay so the empty→filled form can't recenter and push painted content (closes the 0.251 CLS). Replace the full-viewport `backdrop-filter: blur(8px)` with a solid overlay — the blur forced a GPU recomposite on every keystroke behind the password field.
  - **`posthog.ts`** — `disable_session_recording` so rrweb instrumentation doesn't compete for the main thread during the login cold-start window (autocapture kept).
  - **`LandingPage.tsx` / `index.css`** — drive the scroll-progress bar from a `--pl-progress` CSS variable instead of per-frame React state (no full-tree re-render of the 1,400-line landing on every scroll frame); commit `navVisible`/`screen` only on change; `will-change: transform` on `.pl-parallax` so its GSAP transform is GPU-composited and not counted as CLS.

## [0.7.6.4] - 2026-06-03

### Fixed
- **`QuotaExceededError` tab crash — root cause closed.** Production logged 48 `QuotaExceededError: The quota has been exceeded.` reports in two hours. Cause: legacy races still carry base64 photo data URLs embedded in the persisted `fl2_races` localStorage blob, pushing it past the ~5 MB quota. Once over quota, *every* Zustand persist write threw straight out of the React event handler (`pinFocusRace`, `addUpcomingRace` via `ViewEditRaceModal`, etc.) — the function that wrote was incidental; localStorage was simply full. The v0.7.6.3 lazy-on-save migration could not rescue these users: saving one race rewrites the whole still-over-quota blob, so the write threw before the strip landed. Two-part fix:
  - **Quota-safe persist storage** (`src/lib/safeStorage.ts`) — wraps `localStorage` for both the race and athlete stores; `setItem` now swallows `QuotaExceededError` instead of throwing. A rejected cache write no longer crashes the tab (the canonical copy is the synced Supabase row, not localStorage).
  - **Boot-time bulk photo migration** (`src/lib/migratePhotos.ts`) — runs once per session after the Clerk token is installed: uploads *every* embedded base64 photo to the `race-photos` Storage bucket, replaces each with its URL in memory, then writes back a single tiny blob. Stripping all photos before one write is what actually frees the quota. Idempotent and retry-safe — re-runs next boot if uploads failed (Worker down / offline), and never loses a photo.

## [0.7.6.3] - 2026-06-03

### Fixed
- **Race data duplication & deletion — root causes closed.** Three independent bugs that corrupted upcoming/past race lists:
  - **Double-save duplication** — `AddRaceModal` had no re-entry guard, so a fast double-tap created two races with different UUIDs before `saving` re-rendered. Added `if (saving) return`.
  - **Concurrent write race** — every mutation fired `syncStateToSupabase()` immediately; rapid edits produced overlapping full-state writes where the last to land discarded the others. Added a 600 ms debounce so successive mutations coalesce into one write.
  - **Cross-user data bleed** — Zustand stores were never cleared on sign-out, so a different user signing in on the same device had the previous user's races merged into their account by the pull-merge. Added `clearAll()` to the race + athlete stores, called on sign-out.

### Changed
- **Race & medal photos moved to object storage.** Photos were stored as base64 data URLs *inside* each race object, which lives in the synced `state_json` blob and in localStorage. Every save re-serialized the entire photo-laden state synchronously (main-thread freeze) and re-uploaded it, and could blow the ~5 MB localStorage quota → tab crash. Photos now upload to a public Supabase Storage bucket (`race-photos`) via a new Worker route `POST /api/upload-photo` (service role), and only the URL is stored. Existing embedded base64 photos lazy-migrate on the next save. This is what makes saves fast again and stops the crash for photo-heavy histories.

## [0.7.6.2] - 2026-06-03

### Fixed
- **Course Fit widget no longer stuck on "Log 3+ races"** — race results imported from UltraSignup (Comrades, Western States, ultras) now carry placing data correctly. A field-name mismatch was silently dropping finish position on every UltraSignup import, preventing the Course Fit widget from ever meeting its 3-race threshold.
- **Triathlon Predictor hidden for non-triathletes** — the widget now returns nothing when the athlete has no past or upcoming triathlon logged, so it no longer appears as an empty card on pure-running dashboards.

### Changed
- **Triathlon Predictor uses all discipline data** — swim and bike predictions now draw from standalone swim and cycling races in addition to triathlon splits, using the same recency-weighted Riegel + blend model as the run leg (α = empirical / (empirical + 2)). Athletes with pool swim results or sportive ride history get meaningful swim and bike estimates even before their first tri.

## [0.7.6.0] - 2026-06-03

### Security
- **XSS fix** — `r.city` in public profile race rows was interpolated into HTML without escaping. Fixed with `escapeHtml()`.
- **CSP + X-Frame-Options** — all public profile SSR responses now include `Content-Security-Policy: script-src 'none'; frame-ancestors 'none'`, `X-Frame-Options: DENY`, and `Referrer-Policy: strict-origin-when-cross-origin`.
- **Admin CORS** — admin endpoints (`/api/admin/*`) restricted from `Access-Control-Allow-Origin: *` to known app origins only.
- **API sync + state CORS** — `/api/sync` and `/api/state` restricted from wildcard ACAO to known origins.
- **JWT expiry** — `verifyClerkJwt` now rejects tokens with no `exp` claim (previously optional field allowed non-expiring tokens through).
- **Payload size cap** — `/api/sync` enforces 512 KB body limit using post-parse text length (Content-Length header is unreliable on chunked transfers).
- **Error report auth** — `/api/error-report` now requires a valid Clerk JWT; unauthenticated requests are silently dropped.
- **`get_public_card` RPC** — replaced raw `athlete` JSONB passthrough with an explicit field allowlist; DOB, injury dates, OW user ID, club join dates no longer exposed to anon callers.
- **Bio visibility** — bio and clubs on public profiles now require `profileVisibility.bio === true` (was default ON).
- **Admin OPTIONS preflight** — `adminCors()` was refactored to accept a `request` arg but call sites were left without arguments, causing TypeError → 500 on every OPTIONS preflight, breaking the admin UI. Fixed.
- **OW proxy IDOR** — `/ow/*` routes trusted client-supplied `ow_user_id` with no ownership check, letting any user read another's wearable data. Added Clerk JWT verification + `verifyOwOwner()` (sub == OW external_user_id) to every OW route; frontend `owFetch` attaches the Clerk JWT.

### Fixed
- **Sign-out data leak** — sign-out now clears persisted Zustand stores (`fl2_races`, `fl2_ath`, `fl2_strava`) and resets in-memory state including injuries and wearable tokens. Without this, user B on the same device inherited user A's full race history.
- **`autoMoveExpiredUpcoming` never ran** — the function existed but was never called. Now invoked from `onRehydrateStorage` so expired upcoming races are promoted to past race history on every app load.
- **`hasLocalData` guard** — extended to include `seasonPlans` and `goals` so users whose only data is season plans or annual goals get their state backed up to Supabase without needing to log a race first.
- **`resetRemotePullGate` on sign-out** — the write gate is now re-armed on sign-out so the next user's bootstrap sync defers until their remote pull completes.
- **Admin analytics `goalCount`** — was always 0 because goals is a `{annual, distGoals}` object, not an array. Fixed to count entries correctly.
- **`showBio` default** — bio visibility now defaults to OFF (matching all other profile visibility flags), with `=== true` opt-in.
- **Wearable + Apple Health token persistence** — `saveWearableToken`/`removeWearableToken`/Apple Health imports used `supabase.auth.getUser()` (always null under Clerk), making every write a silent no-op. Switched to the Clerk user id from the auth store.

## [0.7.5.5] - 2026-06-03

### Changed
- **Import more prominent in onboarding** — new users now see a "↓ Import" button alongside "Log a Race" as co-equal primary CTAs in the onboarding card on the dashboard. The Races page empty state (zero races logged) now shows an "↓ Import your results" button instead of plain muted text, reducing friction for athletes with existing race history.
- **IronmanRacePicker wired to dashboard import** — the IRONMAN/70.3 race-picker flow is now accessible when opening the import modal from the onboarding card, matching the entry point in the Races page.
## [0.7.5.4] - 2026-06-03

### Fixed
- **Admin dashboard scroll on mobile** — `admin.breaktapes.com` runs without the athlete Layout, so the global `#root { overflow: hidden }` left the dashboard clipped and unscrollable on phones. Wrapped the standalone Admin in its own fixed scroll container (matches Layout's inner `<main>`). The 5-tab bar is now horizontally scrollable on narrow screens too.

## [0.7.5.3] - 2026-06-03

### Changed
- **Injury body part picker** — removed emoji icons; each option now shows the common name with its anatomical name in brackets (e.g. "Calf (gastrocnemius)", "IT Band (iliotibial band)", "Shin (tibia)"). Injury cards on the You page show the short common name.

## [0.7.5.2] - 2026-06-03

### Added
- **Injury Tracker** — athletes can now log injuries by body part, type, and severity directly from the You page. A 3-step modal (body part → type/severity → dates/phase/notes) captures the injury with a manual rehab phase picker (Rest → Cross-training → Building → Training → Racing) and an optional physio-provided return date. No auto-advance from time; all phase transitions are user-driven.
- **Phase progress bar** on each active injury card — 5-segment bar shows current rehab phase at a glance.
- **Recovery Mode on Race Readiness widget** — when an active injury is logged, the readiness score is hidden entirely and replaced with a Recovery Mode state showing the injured body part, current phase, and estimated return date. The score returns (with easing) after the injury is resolved.
- **Resolved injury archive** — resolved injuries collapse into a "RECOVERED · N" section, preserving history without cluttering the active view.
- **Cross-device sync** — injuries stored in the existing `state_json` JSONB column; no new Supabase migration required. Sync follows the same last-write-wins pattern as season plans.

### Changed
- **Edit Profile modal** — injury break date fields replaced with a "Manage injuries →" link to the You page injury tracker. Legacy `injuryBreakStart`/`injuryBreakEnd` fields preserved in the save payload for the `comeback_run` achievement.

## [0.7.5.1] - 2026-06-03

### Changed
- **Admin authorization is now server-only** — removed the client-side `VITE_ADMIN_USER_IDS` allowlist (it shipped admin Clerk IDs in the public JS bundle). The admin gate now probes a new `GET /api/admin/check` endpoint; the Worker's signature-verified Clerk JWT check against the `ADMIN_USER_IDS` secret is the single source of truth. No admin identities are exposed in the bundle. `isAdminUser()` and its baked-in list are deleted.

## [0.7.5.0] - 2026-06-03

### Added
- **admin.breaktapes.com — dedicated admin subdomain** — the full admin dashboard now lives on its own locked subdomain, off the production athlete app. Same Worker + bundle; the app detects the host at runtime (`IS_ADMIN_HOST`) and renders an admin-only shell: Clerk sign-in → admin allowlist check (`VITE_ADMIN_USER_IDS`) → dashboard. Non-allowlisted accounts get a 403 with sign-out. No athlete chrome, no athlete data sync (signing in here never touches the user's race/profile row). `?admin=1` forces the admin render locally.
- **`src/components/AdminApp.tsx`** — self-contained admin gate with its own lightweight Clerk auth (installs JWT + sets authUser only) and standalone Admin render.
- **wrangler.toml** — `admin.breaktapes.com` added to the production Worker as a `custom_domain` route, which auto-provisions the Cloudflare DNS record + TLS cert on deploy (no manual DNS step).

### Changed
- **`/admin` removed from the athlete app** — no longer a route on `app.breaktapes.com`; the Settings "Admin Panel" link is gone. Admin is reachable only at `admin.breaktapes.com`.
- **Admin page** — accepts `standalone` + `onSignOut` props; standalone mode swaps the back button for a sign-out button.

## [0.7.4.0] - 2026-06-03

### Added
- **Admin Analytics deep-dive** — Analytics tab now shows: 30-day signup growth bar chart, engagement segments (power 10+ / active 1–9 / dormant 0 races), feature adoption % (public profiles, upcoming races, goals set, wearable linked), activity recency buckets (today/week/month/dormant), wearable connection breakdown (WHOOP/Garmin/Strava), top race countries, top sports, top distances.
- **CSV export** — Users, Feedback, and Errors tabs each get a one-click CSV download of the loaded rows.
- **Per-tab refresh** — every admin tab has a ↻ Refresh button to re-pull without a full page reload.
- **`created_at` on user_state** — migration `20260603000000` adds the column (defaults to now()) so signup-growth tracking is accurate from deploy onward; pre-deploy rows are backfilled to `updated_at` as an approximate floor.

### Changed
- **Worker `/api/admin/analytics`** — now aggregates engagement segments, feature adoption, activity recency, wearable adoption (joins `wearable_tokens`), top countries, and a 30-day daily signup series.
- **Worker `/api/admin/users`** — returns `created_at`, `goal_count`, and `country` per user; CSV export includes all fields.

## [0.7.3.0] - 2026-06-03

### Added
- **Admin dashboard** — `/admin` now has 5 tabs: Analytics (DAU/WAU/MAU, race stats, top sports/distances), Users (list with last-seen + race count + public status), Feedback (all beta feedback with star ratings), Errors (client crash log from `beta_errors`), Catalog (existing submissions queue).
- **Worker admin routes** — `GET /api/admin/users`, `/api/admin/feedback`, `/api/admin/errors`, `/api/admin/analytics` — all require admin JWT, served via service role key.
- **PostHog event tracking** — `page_viewed` on Dashboard/Races/Train/Profile mount; `modal_opened` for add-race and import-race modals; `widget_detail_opened` and `dashboard_customize_opened` on Dashboard; `train_tab_changed` in Train page; `admin_page_viewed` and `admin_tab_viewed` in Admin.
- **Global error capture** — `window.onerror` and `window.onunhandledrejection` in `main.tsx` → `sendBeacon('/api/error-report')` → `beta_errors` table (existing table, existing Worker route, now wired up).

## [0.7.2.4] - 2026-06-02

### Changed
- **Final OG share image** — replaced with the designed share card: BREAK/TAPES wordmark, "EVERY FINISH LINE, REMEMBERED." headline (orange emphasis), tagline, and `www.breaktapes.com` pill on solid black.

## [0.7.2.3] - 2026-06-02

### Fixed
- **OG image now renders in Barlow Condensed** — the share card was rendering the wordmark in a fallback system font instead of the brand typeface. Now uses the correct condensed brand font for the BREAK/TAPES wordmark, tagline, and URL.

## [0.7.2.2] - 2026-06-02

### Changed
- **OG image cleanup** — removed the decorative slash bars that overlapped the wordmark in link previews. The share card is now the centered BREAK/TAPES wordmark, tagline, and URL pill on a dark background — cleaner and on-brand.

## [0.7.2.1] - 2026-06-02

### Changed
- **Branded OG image** — link previews (WhatsApp, iMessage, Twitter, Slack) now show the BREAK/TAPES wordmark in Barlow Condensed on a dark background with the orange slash, replacing the plain black placeholder.
- **Favicon color fix** — browser tab icon is now black background with orange slash (was inverted: orange background with black slash).

## [0.7.2.0] - 2026-06-02

### Added
- **Triathlon Predictor dashboard widget** — predicts swim / T1 / bike / T2 / run splits and finish time for a target triathlon (Sprint / Olympic / 70.3 / IRONMAN). Blends two signals: recency-weighted Riegel projection from the athlete's own recent tri leg splits (captures real race pacing + brick fatigue) and an engine fallback for the run leg derived from a standalone running PB. Blend weight `α = n / (n + 2)` grows with how much real tri data the athlete has logged, so cold-start leans on the engine model and seasoned triathletes lean on their own data. Cross-distance projections are downweighted and widen the confidence band. New pure library `src/lib/triFormulas.ts` (20 unit tests). Small view shows the finish numeral; medium adds a distance selector, per-leg bars, and confidence range; large adds per-leg distances. Links a prediction to an upcoming triathlon as its goal time (mirrors Race Predictor). Lives in the RECENTLY zone next to Race Predictor; supports small/medium/large sizes.

## [0.7.1.3] - 2026-06-02

### Fixed
- **Set Goal Pace sheet** — race name now renders larger and in the heading font, fixing a hierarchy bug where the date/distance line looked bigger than the race name.
- **Boston Qualifier widget** — qualifying-race finish times bumped 1px for readability.
- **Gap To Goal widget (small size)** — added a dedicated small-size layout. Previously the small tile reused the medium layout and clipped the Course PB time off the right edge; it now shows the goal time and gap label cleanly.

## [0.7.1.2] - 2026-06-02

### Fixed
- **Landing/login grain no longer pixelates on wide screens** — the film-grain texture had no fixed tile size, so it stretched to fill the full (very tall) landing and turned into big blocky noise on large viewports. Now tiled at a fixed 160px repeat so it stays fine.

## [0.7.1.1] - 2026-06-02

### Fixed
- **Landing + login always use the default Carbon+Chrome theme** — a logged-in user's saved custom/Pro theme no longer tints the marketing landing or the logged-out login screen. The saved theme is untouched and returns once they sign in. Implemented via a transient `forceDefault` flag in the theme store (never persisted), set while not signed in (`AuthGate`) and on the marketing landing (`MarketingLanding`).

## [0.7.1.0] - 2026-06-02

### Changed
- **Marketing landing moved to breaktapes.com; app.breaktapes.com is login-only again** — the cinematic landing now renders on the apex marketing domain (`breaktapes.com`). `app.breaktapes.com` logged-out shows the simple login screen it had before. The app detects the apex host (`App.tsx` `MarketingLanding`) and renders the marketing page with no Clerk; Get Started / Sign in send visitors to `app.breaktapes.com/?auth=signup|signin`, which auto-opens the matching auth modal.
- **breaktapes.com worker is now a reverse-proxy** — `landing-worker` proxies the app instead of 301-redirecting, so the apex serves the SPA (which then shows the marketing landing). Requires a one-time `wrangler deploy` of `landing-worker`.

## [0.7.0.0] - 2026-06-02

### Added
- **New production landing page** — the logged-out screen is now a cinematic, scroll-driven marketing page. Intro "finish-tape" loader (stopwatch counts up, then the tape snaps), animated hero ("Every Finish Line, Remembered."), floating top nav, and a scroll-progress bar. Built with Framer Motion + GSAP; respects `prefers-reduced-motion`.
- **"I am a…" audience selector** — Marathoner / Triathlete / Everyday. Picking one re-themes the feature showcases and their content (copy, PRs, and the race map's cities) to that athlete type.
- **Accurate world map** — the Race History showcase renders a real equirectangular world map (Natural Earth land) with race cities projected from actual lat/lng (`src/lib/worldMap.ts`).
- **Phone-scroll centerpiece** — a pinned device cycles through Dashboard → Medal Wall → Map → Analytics as you scroll.
- **How it works / Testimonials / FAQ** — 3-step how-it-works with mini-mockups, a rotating testimonial spotlight (placeholder quotes), and an accordion FAQ (free, no AI key, wearables, data privacy).
- **Live interactive demo** — new public `/demo` route: a self-contained, clickable app shell (persona switcher + Dashboard/Races/Profile tabs) with demo data. No auth, no real stores, no persistence — fully isolated from real user data. Embedded on the landing in a framed window with an "Open full demo" escape.

## [0.6.14.3] - 2026-06-01

### Fixed
- **Profile data now loads correctly on new devices** — signing in on a second device now shows your full profile (name, bio, clubs, teams, etc.) instead of a blank profile. Root cause: Clerk identity fields were stamping `updatedAt` to the current time, causing the last-write-wins merge to reject the server-side profile in favor of the empty new-device state.
- **Username changes propagate to public profile** — changing your Clerk username now syncs to Supabase so your public `/u/username` profile URL updates immediately.
- **Goals (You page) now persist across devices and relaunches** — annual KM/race targets and distance time goals are included in the Supabase sync payload, so they survive new device sign-ins and are never lost.
- **Dashboard widgets default to medium size for new users** — all resizable widgets now start at medium; previously some were small or large, leading to an inconsistent first impression.

## [0.6.14.1] - 2026-05-25

### Added
- **Race Comparer widget** — restored: pick any 2 past races from your history, compare finish times side by side with delta highlighted in green for the faster race
- **What to Race Next widget** — restored: shows upcoming races with A/B/C priority labels and a surface-match recommendation based on where you run your PBs

## [0.6.12.2] - 2026-05-24

### Changed
- **Collapsible split targets** — SPLIT TARGETS section in the Goal Pace widget now collapses/expands with a toggle; collapsed by default to reduce scroll length

## [0.6.12.1] - 2026-05-24

### Fixed
- **Sign-in accepts username or email** — replaced custom sign-in form with Clerk's native `<SignIn>` component; Clerk handles both email address and username login natively
- **Shared credentials across environments** — removed staging-only `hasStagingAccess` gate; any account created on `app.breaktapes.com` is now valid on `dev.breaktapes.com` (both share the same Clerk instance)
- **Forgot password OTP flow** — Clerk's built-in forgot password sends a one-time code to the registered email; user enters the code inline and resets password without leaving the page
- **"Secured by Clerk" branding** — using the native `<SignIn>` / `<SignUp>` components shows Clerk's branding automatically

## [0.6.12.0] - 2026-05-24

### Added
- **Widget resize controls** — every widget now has S / M / L size buttons in edit mode; small widgets stack two-per-row, medium/large span full width
- **Drag-and-drop reordering** — widgets can be dragged within and between zones in edit mode using @dnd-kit; order persists across sessions
- **Toggle-based widget panel** — "WIDGETS" sheet now shows all widgets grouped by zone with iOS-style toggle switches; users can freely enable/disable without closing the sheet
- **RECENTLY zone small layout** — all RECENTLY zone widgets default to small size and stack side-by-side for a compact two-column grid
- **"All Widgets" chip** — one-tap button in the edit bar enables every widget at once
- **Zone separator borders** — non-first zones get a subtle border-top for visual separation
- **Weather and course info embedded in countdown** — race day forecast and course surface/elevation tags now appear inside the countdown card; no longer separate widgets
- **Stats strip as DnD widget** — career stats strip is now a proper dashboard widget (id: stats-strip) that can be moved and toggled like any other

### Changed
- RECENTLY zone widgets default to `size: 'small'` (stacked two-per-row); all other zones default to `size: 'medium'`
- "Race Day Forecast" hidden from widget toggle panel (embedded inside countdown widget)
- Small widgets render at equal height via `height: 100%` on the card container
- GapToGoalWidget race name label tightened — no gap between zone label and race name
- Zone headers span full width regardless of grid layout

### Fixed
- Equal-height small widgets in the same row — `glowCard` now uses `height: 100%` + `box-sizing: border-box` so paired widgets match

## [0.6.11.1] - 2026-05-20

### Changed
- Removed emoji section headers across Race DNA and Pattern Scan widgets (temp, pacing, surface, country, season, distance sections now use plain text labels)
- Removed decorative emoji from onboarding status indicators in Profile — replaced with colored dot (green/orange)
- Replaced "unlock your X" / "to unlock X" copy with "see X" / "to see X" throughout Dashboard widgets and Profile page
- Changed locked pacing box title from "UNLOCK YOUR PACING PATTERN" to "NO SPLIT DATA"
- Removed emoji from medal photo upload button and bg-remove spinner overlay
- Changed season performance row labels to plain text (no emoji prefix) for consistent alignment

## [0.6.10.0] - 2026-04-30

### Changed
- **Emoji-free UI** — all decorative emoji removed app-wide and replaced with styled text codes, ASCII punctuation, and inline SVG. Affects widget icon boxes, achievement tiles, gear empty states, race stack headers, story mode labels, weather impact face icons, and scheduling conflict indicators. Eliminates rendering inconsistency across Android/iOS/Windows.
- **Widget icon system** — all 51 dashboard widget `icon` fields changed from emoji to 2-3 char text codes (e.g., `CD` for countdown, `WX` for weather, `DNA` for Race DNA). Icons render at 9px in the widget customize modal with headline font for a consistent, branded look.
- **Achievement display** — achievement emoji icons removed from tile headers, inline pills, and the 52px popup badge. Popup now renders a styled `ACHV` badge at 64px.
- **BetaFeedback star rating** — `⭐` replaced with `★` (Unicode star) styled with CSS font weight and colour so it matches the app's design system.
- **WHOOP card empty state** — `💚` heart emoji replaced with `WHOOP` text label in headline font.

## [0.6.9.1] - 2026-04-30

### Changed
- **Design system: CSS variable sweep** — all hardcoded RGBA colours across every page and component replaced with CSS custom properties (`--orange-ch`, `--green-ch`, `--gold-ch`, `--purple-ch`, `--error-ch`). Theme switching now correctly retints modal borders, PB badges, sport accents, error states, and sparklines across all 9 themes.
- **Modal polish** — all popups and bottom-sheet modals now share a consistent `backdrop-filter: blur(8px)` frosted glass overlay, `border-top: 2px solid var(--orange)` header edge, and `border-radius: 16px 16px 0 0`. Applies to AddRaceModal, ViewEditRaceModal, EditProfileModal, RaceImportModal, BetaFeedback, DashCustomizeModal, AllUpcomingModal, Compare search sheet, and all Profile achievement/config popups.
- **Font scale tokens** — `10px` / `11px` field labels now use `var(--text-xs)` everywhere (AddRaceModal, ViewEditRaceModal, EditProfileModal). Base body font bumped 14px → 16px; `--text-xs` 10px → 11px; `--text-sm` 12px → 13px for improved legibility on mobile.
- **SVG icon system** — decorative emoji (landing page icons, sport icons, proof-strip icons) replaced with purpose-built inline SVGs and text labels. Eliminates emoji rendering inconsistency across Android/iOS/Windows.
- **Accessibility** — Profile page root promoted to `<main role="main" aria-label="Athlete profile">`. All 11 section headings promoted from `<div>` to `<h2>` for correct landmark/heading hierarchy.
- **1024px breakpoint** — desktop layout breakpoint raised from 768px to 1024px; grid proof strip uses `1fr` columns with `flex-wrap: wrap` for resilient overflow on mid-size screens.

## [0.6.9.0] - 2026-04-29

### Added
- **Privacy Policy** (`/privacy`): Full 13-section privacy policy covering data collection, wearable integrations, public profiles, third-party services, and user rights. Accessible without authentication.
- **Terms & Conditions** (`/terms`): Full 18-section T&C covering eligibility, permitted use, prohibited conduct, content ownership, wearable integrations, IP, warranty disclaimers, and governing law (India/Bangalore). Accessible without authentication.
- **Help & Contact form** (`/help`): Contact form with Name, Email, Subject (5-option dropdown), and Message fields. Submits to Supabase `contact_submissions` table. Replaces any need to expose personal email addresses publicly. Accessible without authentication.
- **Supabase migration `20260429100000`:** `contact_submissions` table with anon insert-only RLS and input length constraints (name ≤ 200, email ≤ 320, subject ≤ 200, message ≤ 5000).
- **Settings — legal links:** About section now includes a "Help & Contact" card and a Privacy Policy / Terms & Conditions 2-column grid.

## [0.6.8.0] - 2026-04-29

### Added
- **Upcoming race edit — Race Start Time field:** Users can now set the wall-clock race start time directly from the upcoming race edit sheet. The value is saved to the race and automatically contributed to the race catalog (fills `start_time` on the matching catalog entry when currently unset).
- **Supabase migration `20260429000000`:** New `contribute_race_start_time` SECURITY DEFINER RPC that lets authenticated users write start time knowledge back to the race catalog without direct table access.

### Changed
- **Upcoming race edit — header spacing:** Increased top padding, handle margin, and header bottom margin so the race name and subtitle are no longer cramped at the top of the sheet.
- **Upcoming race edit — modal height:** Raised `maxHeight` from `85vh` to `90vh` to prevent content clipping on smaller screens.

## [0.6.7.0] - 2026-04-28

### Added
- **Race Detail — More Stats fields visible in view mode:** Start Time, Avg Heart Rate, Terrain, Shoe/Kit, and Role now appear in the info rows when set.

### Changed
- **Race Detail — stat cards** now show only Finish Time, Distance, and Pace. Overall/Gender/Age Group results moved to pill chips below the location row.
- **Race Detail — PB highlight:** When a race is a Personal Best, the entire modal gets a gold glow border and a "⭐ PERSONAL BEST" banner (previously only the time card was tinted).
- **Race Detail — country abbreviation:** Long country names in the location pill now show as abbreviations (UAE, USA, UK, NZ, SA, KSA, etc.).
- **Race Detail — surface/terrain capitalization:** Values now display with a capital first letter (Road, Trail, etc.).
- **Race Detail — edit saves persist:** Fixed a stale prop bug where Start Time, Terrain, Surface, and Role at Race reverted after saving. Race detail now reads live from the store by ID.
- **Weather auto-fill — performance:** Races within the last 92 days now use the forecast API (~200ms) instead of the ERA5 archive (~3-5s).
- **Edit Race — start time field height** normalized to match all other input fields (was taller due to native time picker intrinsic size).

## [0.6.6.0] - 2026-04-28

### Changed
- **Edit Race modal — title** font size bumped for stronger hierarchy.
- **Edit Race modal — removed "Editing: …" subtitle** from header (redundant with form context).
- **Edit Race modal — screenshot import removed** (requires Anthropic API key; surfaced when unavailable).
- **Edit Race modal — Priority field** moved below City/Country, above Placing (better form flow).
- **Edit Race modal — More Stats collapsible section** added below Notes. Contains: Bib Number, Goal Time, Start Time, Avg Heart Rate, Surface, Terrain, Elevation, Shoe/Kit, Role at Race, Weather (Temp/Conditions/Wind/Humidity).
- **Edit Race modal — Weather auto-fill** fetches historical weather from Open-Meteo archive API using race lat/lng + date. Averages readings across the race duration window (start time to finish). Requires city to be selected via the city picker (to get coordinates).
- **Race type** — added `avgHeartRate`, `terrain`, and `shoe` fields.

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

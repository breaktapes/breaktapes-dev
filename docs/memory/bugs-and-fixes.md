# BREAKTAPES — Bugs & Fixes Log

> Running log of bugs encountered and their fixes. Add new entries at the top.

---

## 2026-06-04

### Poor Core Web Vitals on auth + landing (INP 5.8s, CLS 0.251, LCP P50 3.3s/P99 11s)
- **Symptom:** Cloudflare Web Analytics RUM (bots excluded): `#password-field` INP 5,816 ms, Clerk sign-up box CLS 0.251, LCP P50 3,280 ms (36% Poor), P99 11,164 ms (32s spike @13:00 GST).
- **Root cause (single chain):** App gated all paint on Clerk `isLoaded` (LCP = the `AuthLoadingScreen` pulsing dot), and root `index.html` shipped zero render hints — so first paint + first auth interaction both waited on a cold Clerk init plus a render-blocking, CSS-`@import`'d font fetch. `#password-field` is Clerk's native input id (no custom field); INP = Clerk cold-load + main-thread contention. CLS = the Clerk widget mounting empty (~0 height) then injecting the form and recentering in the flex overlay. PostHog session recording (rrweb) added main-thread weight during the login cold-start window.
- **Fix (v0.7.6.6):** (1) `index.html` preconnect/dns-prefetch `clerk.breaktapes.com` + fonts via `<link>` (dropped CSS `@import`). (2) `AuthGate` renders `<LandingScreen>` during `!isLoaded` for logged-out visitors (gated on `__client_uat` cookie) → text LCP, not dot. (3) Reserve Clerk card `minHeight` via `clerkAppearance.elements` + top-anchor overlay → no recenter (CLS). (4) Drop `backdrop-filter: blur(8px)` → solid overlay (INP). (5) PostHog `disable_session_recording`. (6) Landing scroll progress → `--pl-progress` CSS var (no per-frame React re-render); `.pl-parallax { will-change: transform }`.
- **Diagnosis method:** 3 parallel investigation subagents (LCP / CLS / INP), then 1 adversarial review subagent on the diff. All four metrics traced to the same root chain.

## 2026-06-02

### New enabled widget without a WIDGET_CONTENT entry fails the guardrail test
- **Symptom:** After adding `tri-predictor` to `DEFAULT_WIDGETS`, `tests/widget-content.test.js` failed: "enabled widget tri-predictor has an authored WIDGET_CONTENT entry".
- **Root cause:** `tests/widget-content.test.js` asserts every `enabled: true` widget in `useDashStore.ts` `DEFAULT_WIDGETS` has a matching top-level key in `WIDGET_CONTENT` (`src/lib/widgetContent.ts`) — otherwise users tapping the widget detail get the generic "coming soon" fallback.
- **Fix:** Add the `WIDGET_CONTENT['<id>']` entry (title/tagline/whatItIs/howToRead/howItImpactsPerformance/relatedActions) in the same change as the new enabled widget.
- **Watch:** Any new enabled widget needs three touch-points together — `DEFAULT_WIDGETS`, `WIDGET_SIZES`, render dispatch — plus the `WIDGET_CONTENT` entry, or the suite goes red.

---

## 2026-04-26

### Cross-device sync silently broken since Clerk migration
- **Symptom:** Edits made on laptop (goal time, gear checklist, focus race priority) never appeared on phone for the same Clerk-authenticated user. Each device kept its own state forever.
- **Root cause:** `syncStateToSupabase()` writes to a `state_json` JSONB column on `public.user_state`, but no migration ever created that column. Every upsert returned PostgREST `42703 column does not exist`. The catch block in `src/lib/syncState.ts` swallowed the error. After the Clerk migration's `TRUNCATE` on 2026-04-23, all writes silently failed and each device ran off its own Zustand `localStorage` persist.
- **Verification:** Direct query confirmed schema columns + `count(*) = 0` on both prod and staging.
- **Fix:** New migration `supabase/migrations/20260426000000_user_state_state_json.sql` adds `state_json jsonb` and idempotently backfills from the legacy per-slice columns. Added `focusRaceId` to the synced payload via the `pinFocusRace` action so focus pin crosses devices too.
- **Commits:** `5a1b7c5` (PR #230)

### Pre-existing local mods regressed `pinFocusRace` → `setFocusRaceId`
- **Symptom:** Caught during ship of race-day completion feature (next session) — local Dashboard had renamed all `pinFocusRace` call sites to `setFocusRaceId`, which would have stripped sync from focus-pin user actions.
- **Root cause:** Two store setters share the same backing field but different semantics — `setFocusRaceId` is silent (used by remote-pull path so applying remote state never echoes back) and `pinFocusRace` syncs (user actions). A local edit collapsed the distinction.
- **Fix:** Reverted the renames in Dashboard.tsx before commit. Only the intentional 2-file diff (Dashboard + ViewEditRaceModal) shipped.
- **Commit:** `a80d7e3` (PR #231)

---

## 2026-03-24

### OW test connection hitting missing `/test` endpoint
- **Symptom:** Open Wearables connection test always returned 404
- **Root cause:** Test was hitting `/api/v1/test` which doesn't exist in OW API
- **Fix:** Changed test to hit `/api/v1/users/{uid}/summaries/activity` with a 30-day window — real endpoint, verifies both key and uid
- **Commit:** `4c338ee`

### Duplicate `const` declarations in `fetchWeather`
- **Symptom:** Script parse error on page load — app wouldn't start
- **Root cause:** Two separate code blocks (original weather + new 6-hour forecast) both used `const { latitude, longitude }` inside the same function scope
- **Fix:** Merged the two blocks, renamed one set of variables
- **Commit:** `3b2a238`

### 6-hour weather forecast showing wrong hours
- **Symptom:** Forecast pills showed incorrect hours (off by timezone or index)
- **Root cause:** Open-Meteo returns hourly data for full 2-day window; code was not correctly slicing from current hour
- **Fix:** Find current hour index in the returned `time` array, slice 6 entries from there
- **Commit:** `235a621`

### Pre-2000 race dates failing to parse
- **Symptom:** Races from the 1990s showed "Invalid Date" or wrong year
- **Root cause:** `new Date('1995-04-15')` can return off-by-one or invalid results in some JS environments due to UTC vs local time interpretation
- **Fix:** Manual date parsing — split string on `-`, construct `new Date(year, month-1, day)`
- **Commit:** `b771ef0`

### Country hover highlight not working on click-through
- **Symptom:** Country highlight worked on first hover but not subsequent ones after map interactions
- **Root cause:** Leaflet layer event handlers were being re-added on each `fetchAndAddCountries()` call
- **Fix:** Guard against re-adding layers; reset highlight state in `resetCountry()`
- **Commit:** `235a621`

### Safari autofill popup on page load
- **Symptom:** macOS/Safari showed autofill suggestion popup immediately on page load, covering the UI
- **Root cause:** Safari scans for `type="password"` inputs and triggers autofill before user interaction
- **Fix:** Add `autocomplete="new-password"` to all password inputs; temporarily set `readonly` attribute, remove on focus
- **Commits:** `2fa1d33`, `742d179`, `7b1f9f6`

### Dashboard renders before auth confirmed
- **Symptom:** Brief flash of empty dashboard (no races, no name) before Supabase session loads
- **Root cause:** `renderDash()` was called synchronously on page load before `initAuth()` resolved
- **Fix:** Hide dashboard with CSS guard; only reveal after `refreshAuthState()` is called
- **Commits:** `12ff4c7`, `3193287`

### Custom distance sorting in PR strip (90K after Marathon)
- **Symptom:** "90K" appeared before "Marathon" in the personal bests strip
- **Root cause:** Sorting was alphabetical or by km value, but "90K" = 90km > Marathon = 42.2km numerically, yet convention puts Marathon before ultra distances in a racing context
- **Fix:** Explicit sort order for known distances, custom distances appended after
- **Commit:** `fc90deb`

### Duplicate race entries after Strava sync
- **Symptom:** Importing Strava activities created duplicate race entries if the same activity was synced twice
- **Root cause:** No deduplication check on import
- **Fix:** Check for existing race with same date + distance before inserting
- **Commit:** (part of Strava integration work)

### Pre-pull updateAthlete wipes the user's profile (caught pre-merge, Session 45)
- **Symptom (would-have-been):** skipping/completing the onboarding tour during the first ~2s of a session (before remote sync lands) silently erased the user's profile (name, DOB, units, clubs) on every device
- **Root cause:** athlete merges by whole-object last-write-wins on `updatedAt` in both `applyRemoteSafe` (client) and `stateMerge.ts` (server). `updateAthlete({tourCompletedAt})` on a null/skeleton athlete creates a fresh-`updatedAt` object that wins both merges. The sync write gate only defers the POST — it does not prevent the local LWW loss
- **Fix:** gate the write on `isRemotePullComplete()` (now exported from `src/lib/syncState.ts`); tour retries the auto-start when the pull is pending. Regression tests in `useTourStore.test.ts`
- **Commit:** PR #535 (v0.7.7.8)

---

## Patterns to Watch

- **Safari vs Chrome date parsing:** Always use manual `new Date(y, m-1, d)` construction, never `new Date(dateString)` for dates that need to be reliable
- **Supabase RLS:** If a Supabase query returns empty instead of error when data should exist, check RLS policies first
- **OW field names:** Wearable providers use different field names for the same metric — always use `??` fallback chains
- **Leaflet event handlers:** Avoid adding event handlers inside functions that may be called multiple times (re-renders) — use one-time init or guard with a flag

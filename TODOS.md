# BREAKTAPES — Deferred Work

Items captured during eng reviews. Each entry includes context so future sessions don't have to reconstruct the reasoning.

---

## Drop unused `profile_views` Supabase table

**What:** Write a new Supabase migration to `DROP TABLE IF EXISTS profile_views`.

**Why:** The migration `20260409120000_public_profiles.sql` created a `profile_views` table intended to store per-username view counts. However, `worker/index.js` uses Cloudflare KV (`PROFILE_KV`) for view counts instead (`incrementViewCount()` writes to KV key `views:{username}`). The Worker uses the anon key and has no INSERT/UPDATE policy on `profile_views` — it can never write to the table. The table is dead code and creates confusion.

**Where to start:** Add `supabase/migrations/YYYYMMDDHHMMSS_drop_profile_views.sql` with `DROP TABLE IF EXISTS profile_views;`.

**Depends on:** Nothing. Purely additive migration, no code changes needed.

---

## Add reserved username blocklist

**What:** Add a `RESERVED_USERNAMES` constant array in `index.html` and check it in `onUsernameInput()` before the availability check.

**Why:** Users can currently claim usernames like `admin`, `api`, `u`, `health`, `og`, `support`, `help`, `breaktapes`. Not a security risk (profiles are read-only via RLS), but creates support confusion — e.g., `app.breaktapes.com/u/api` would render a profile for a user named "api".

**Where to start:** Near `onUsernameInput()` (~line 19420 in index.html), add:
```js
const RESERVED_USERNAMES = ['admin','api','u','health','og','support','help','breaktapes','www','app','dev','staging','blog','mail'];
```
Then in `onUsernameInput()` after format validation: `if (RESERVED_USERNAMES.includes(val)) { hint.textContent = 'That username is reserved.'; ... return; }`.

**Depends on:** Nothing. Self-contained.

---

## Fix username availability check in-flight guard

**What:** Replace the `_usernameCheckTimer` guard in `saveSettings()` with a separate `_usernameCheckInFlight` boolean set before the fetch starts and cleared on completion.

**Why:** `_usernameCheckTimer` is cleared when the debounce fires — not when the async fetch completes. A user who clicks Save during the fetch window (after the 500ms debounce but before the Supabase response) bypasses the guard and may save an unverified username.

**Where to start:** In `checkUsernameAvailability()`, set `_usernameCheckInFlight = true` at the top and `_usernameCheckInFlight = false` in both the success and catch branches. In `saveSettings()`, check `_usernameCheckInFlight` instead of (or in addition to) `_usernameCheckTimer`.

**Depends on:** Nothing. Self-contained.

---

## Block consecutive hyphens in username slug

**What:** Update the username regex in both `eUser` (saveAth) and `settingsUsername` (saveSettings + onUsernameInput) to disallow consecutive hyphens.

**Why:** The current regex `^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$` allows `a--b` as a valid slug. Double-hyphen URLs may behave unexpectedly in Cloudflare routing or cause confusing-looking profile URLs.

**Where to start:** Change regex to `^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){1,18}[a-z0-9]$` (lookahead prevents consecutive hyphens) or simpler: add a `.includes('--')` check after the regex test.

**Depends on:** Nothing. Self-contained.

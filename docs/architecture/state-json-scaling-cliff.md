# The `state_json` single-blob scaling cliff

**Status:** Not scheduled. This is a planned future project, documented here so the
eventual per-race-rows migration is something we do deliberately — not an incident
we react to when the first power user silently stops being able to save.

---

## 1. Summary

Every user's entire app state is stored and synced as **one `state_json` JSONB
column** on `public.user_state` (one row per user). That single blob holds *all*
of:

- `races` — full past-race log (splits, weather, placings, photos-as-URLs, notes…)
- `upcoming_races`, `wishlist_races`
- `season_plans`, `injuries`, `goals`
- `athlete` profile
- pointers + tombstones: `next_race`, `focus_race_id`, `deleted_race_ids`

The column is defined in
[`supabase/migrations/20260426000000_user_state_state_json.sql`](../../supabase/migrations/20260426000000_user_state_state_json.sql)
(a single `jsonb` column, backfilled from the old per-slice columns).

Both ends of sync transfer and process the **whole object** every time:

- **Write** — the client assembles the complete blob and POSTs it on *every*
  mutation. See `stateJson` assembled in
  [`src/lib/syncState.ts:87-98`](../../src/lib/syncState.ts#L87) and POSTed to
  `/api/sync` at [`src/lib/syncState.ts:106-121`](../../src/lib/syncState.ts#L106).
- **Read** — the pull fetches `state_json` and applies it wholesale. The Worker
  read path is `handleApiState` at
  [`worker/index.js:1959`](../../worker/index.js#L1959) (`select=state_json&limit=1`),
  consumed by `useSyncState` ([`src/hooks/useSyncState.ts`](../../src/hooks/useSyncState.ts)).

There is no per-record granularity anywhere. A one-field edit to a single race
serializes, transfers, and re-merges the user's entire history.

---

## 2. Why it exists (and why it was the right v1)

Single-blob was a deliberate, correct v1 tradeoff. It is also load-bearing for the
**server-side merge engine** that finally killed the recurring cross-device
data-loss bug.

`mergeUserState()` in
[`src/lib/stateMerge.ts:128`](../../src/lib/stateMerge.ts#L128) guarantees a
**no-shrink invariant**:

> An incoming state can NEVER reduce a populated server slice unless a tombstone
> explicitly authorises the removal. ([`stateMerge.ts:14-24`](../../src/lib/stateMerge.ts#L14))

To honour that invariant the merge needs to see the **whole** existing object *and*
the **whole** incoming object in one place: it unions `races`/`upcoming_races` by
`id` + `updatedAt` ([`stateMerge.ts:78-105`](../../src/lib/stateMerge.ts#L78)),
applies tombstones, and falls back to the existing slice whenever an incoming slice
is empty ([`stateMerge.ts:146-150`](../../src/lib/stateMerge.ts#L146)). "Absence
means this device didn't load it, not delete it" only works because absence is
evaluated against the *complete* server blob. The Worker wires this in at
[`worker/index.js:1911-1921`](../../worker/index.js#L1911) (read current row →
`mergeUserState(existing, incoming)` → upsert).

So: single-blob made the merge engine simple, pure, dependency-free, and
trivially testable (`stateMerge.test.ts` is the regression guard). For a few
hundred users with modest race logs, transferring the whole blob per edit is
cheap and the simplicity is worth far more than the bytes. **This document is not
arguing the v1 was wrong — it's marking where v1 runs out of road.**

---

## 3. The cliff

This is a **hard ceiling, not graceful degradation.**

The Worker reads the sync body as text and enforces a fixed size cap *after*
buffering and *before* parsing:

```js
// worker/index.js:1879-1882
// Content-Length is client-controlled and absent on chunked transfers —
// post-parse check is the only reliable gate.
if (bodyText.length > 512_000) return new Response('Payload too large', { status: 413 });
```

[`worker/index.js:1882`](../../worker/index.js#L1882) — **512 KB.**

When a user's serialized `state_json` approaches ~512 KB, the next `/api/sync`
returns **413** and the write is rejected outright. There is no partial save, no
truncation, no "save what fits." The client's `_doSync` logs the failed status and
sets sync status to error/warn
([`src/lib/syncState.ts:122-129`](../../src/lib/syncState.ts#L122)) — but from the
user's seat it just looks like nothing saved, **silently**. A heavy user (large
race history, many splits per race, long notes) is exactly who hits this first, and
they get no actionable signal.

Two more costs scale with total data, independent of the hard cap:

- **O(total-data) write per edit.** Editing one field re-serializes, transfers, and
  re-merges the entire blob. The Worker also does a **read-merge-write of the full
  row** on every sync ([`worker/index.js:1911-1945`](../../worker/index.js#L1911)):
  fetch the whole `state_json`, run `mergeUserState` over the whole object, upsert
  the whole object back. Cost per keystroke-level mutation grows with lifetime data,
  not with the size of the change.
- **Admin endpoints parse up to ~1000 blobs in JS.** `handleAdminAnalytics`
  pulls `state_json` for up to 1000 users in one query and walks every blob in
  memory to aggregate sport/distance/country counts and engagement segments
  ([`worker/index.js:1519`](../../worker/index.js#L1519),
  [`1555-1560`](../../worker/index.js#L1555)). The data-integrity endpoint pulls
  `state_json` for up to **5000** users
  ([`worker/index.js:1702`](../../worker/index.js#L1702)). As blobs grow, these
  hot paths buffer and JSON-parse an unbounded multiple of the per-user size — a
  Worker-memory / CPU-time risk well before any single user hits 512 KB.

---

## 4. Trigger threshold / early warning

The failure mode today is invisible until 413. **Instrument blob size now** so we
get a runway warning long before the cap, while the migration is still optional.

Recommended: log/alert at **256 KB (50% of the cap)** so we see the distribution
climbing and can schedule the migration as planned work rather than firefight a
stuck power user.

Where to add it:

- **Client, before POST** — in `_doSync`
  ([`src/lib/syncState.ts:77`](../../src/lib/syncState.ts#L77)) measure
  `JSON.stringify(stateJson).length` (it's already serialized for the body at
  [`syncState.ts:112-120`](../../src/lib/syncState.ts#L112)) and emit a PostHog
  event / `console.warn` past 256 KB. This catches the leading edge per device
  and lets us see *which* users are approaching the wall.
- **Worker, post-parse** — in `handleApiSync`, right after the existing cap check
  ([`worker/index.js:1882`](../../worker/index.js#L1882)), emit a structured warn
  when `bodyText.length` crosses 256 KB. This is the authoritative server-side
  signal (the client can be stale) and the natural place to wire an alert.

A blob-size histogram across the user base is the single best input for deciding
*when* the section-5 migration stops being optional.

---

## 5. Migration sketch (the planned fix)

The fix is to stop storing races inside the blob and give each race its own row.

**Shape:**

- A **`races` table** — one row per race (`user_id`, `race_id`, `updated_at`,
  `deleted_at`/tombstone, payload). Reads and writes become **per-row upserts**;
  an edit transfers one race, not the whole history.
- Move the merge to **per-row last-write-wins + per-row tombstones**, preserving
  the same no-shrink invariant `mergeUserState` guarantees today, but at row
  granularity instead of blob granularity. (Other slices — `athlete`, `goals`,
  `season_plans`, `injuries` — can stay in a smaller `state_json` initially and be
  peeled off later; races are the dominant growth term and the right first cut.)

**Files that change** (every one is on the persistence critical path):

- [`src/lib/stateMerge.ts`](../../src/lib/stateMerge.ts) — re-target the merge from
  whole-blob to per-row LWW + tombstones (this is the core logic change; keep it
  pure + unit-tested, same as today).
- [`src/lib/syncState.ts`](../../src/lib/syncState.ts) — write per-row instead of
  the single full-blob POST; the pull/gate machinery
  (`markRemotePullComplete`, debounce) stays but operates per-record.
- [`src/hooks/useSyncState.ts`](../../src/hooks/useSyncState.ts) — pull races by
  row; `applyRemoteSafe` reconciles row-by-row.
- The **Zustand stores** (`useRaceStore`, `useAthleteStore`) — mutations dispatch
  per-record syncs, not a whole-state flush.
- [`worker/index.js`](../../worker/index.js) — `/api/sync`, `/api/state`, and the
  admin/analytics + data-integrity endpoints all stop reading/writing/parsing the
  monolithic blob; the 512 KB body cap becomes a per-row cap (much harder to hit).
- A **new migration** under `supabase/migrations/` creating the `races` table
  (+ indexes, RLS, realtime).

**Backfill + rollout.** This needs a backfill that explodes **every existing
user's `state_json.races`** into rows, run idempotently. Do a **staging dry-run**
first (staging fixtures, then a copy of prod data if feasible) and verify the
merge produces identical reads before/after for a sample of users.

**Risk: HIGH.** This touches all of persistence — the exact same surface the merge
engine just stabilised after a string of data-loss recurrences (see the history in
[`stateMerge.ts:1-29`](../../src/lib/stateMerge.ts#L1)). A regression here can lose
user races. Treat it with the same caution: keep the merge pure and exhaustively
tested, ship behind a staging dry-run, and verify the no-shrink invariant survives
the move to per-row granularity.

---

## 6. Status / recommendation

**Not scheduled.** Do this as its own dedicated project — not crammed into an
unrelated feature PR. The right sequencing is:

1. Land the section-4 instrumentation (cheap, low-risk) so we have data.
2. Watch the blob-size distribution; when users cross the 256 KB warning line in
   meaningful numbers, scope section 5 as a standalone, HIGH-risk migration with a
   staging dry-run and the merge-engine test suite as the gate.

The whole point of writing this down is that the 413 hard-fail should never be a
surprise.

/**
 * Server-side user-state MERGE — the permanent fix for the recurring
 * cross-device data-loss bug.
 *
 * Background: the client always syncs its ENTIRE app state as a single
 * `state_json` blob. The /api/sync Worker used to REPLACE the server row with
 * that blob. So any write fired with empty/partial local state — fresh device,
 * cleared cache, incognito, a pull-error escape hatch, or any future mount-time
 * write nobody anticipated — overwrote the server row and wiped the user's
 * races + upcoming. Gating individual write paths is a deny-list that keeps
 * missing new paths; that is why the data loss kept coming back.
 *
 * This module MERGES the incoming state into the existing row instead of
 * replacing it. The core invariant it guarantees:
 *
 *   An incoming state can NEVER reduce a populated server slice unless a
 *   tombstone explicitly authorises the removal.
 *
 * Delete intent therefore travels ONLY through tombstones (`deleted_race_ids`),
 * never through "this id is absent from the list". Absence means "this device
 * didn't load it", not "delete it". That removes the data-loss class
 * structurally rather than gating it — see the invariant test in
 * `stateMerge.test.ts`, which is the regression guard for every future
 * recurrence.
 *
 * Used by both the Cloudflare Worker (`worker/index.js`, the production write
 * path) and the unit tests. Keep it pure + dependency-free so the Worker bundle
 * stays tiny and the logic has a single source of truth (no client/server drift).
 */

export interface Tomb {
  id: string
  at: number
}

interface HasIdAndUpdatedAt {
  id: string
  updatedAt?: number
}

export interface UserState {
  races?: HasIdAndUpdatedAt[]
  upcoming_races?: HasIdAndUpdatedAt[]
  wishlist_races?: unknown[]
  season_plans?: unknown[]
  injuries?: unknown[]
  goals?: { annual?: Record<string, unknown>; distGoals?: unknown[] } | null
  athlete?: { updatedAt?: number } & Record<string, unknown>
  deleted_race_ids?: Tomb[]
  next_race?: unknown
  focus_race_id?: string | null
  [key: string]: unknown
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

/** Merge two tombstone lists (newest `at` per id) and prune entries older than 90d. */
export function mergeTombs(a: Tomb[] | undefined, b: Tomb[] | undefined, now: number): Tomb[] {
  const m = new Map<string, number>()
  for (const t of [...(a ?? []), ...(b ?? [])]) {
    if (t && typeof t.id === 'string' && typeof t.at === 'number') {
      m.set(t.id, Math.max(m.get(t.id) ?? 0, t.at))
    }
  }
  const out: Tomb[] = []
  for (const [id, at] of m) {
    if (now - at < NINETY_DAYS_MS) out.push({ id, at })
  }
  return out
}

/**
 * Union two race lists by id. On id collision keep the strictly-newer
 * `updatedAt`; ties (and both-legacy `updatedAt: 0`) keep `existing` so a stale
 * full-state writer can never clobber a fresher edit already on the server.
 * Then drop any race a tombstone deleted AFTER its last edit.
 */
export function mergeRaceListsServer<T extends HasIdAndUpdatedAt>(
  existing: T[] | undefined,
  incoming: T[] | undefined,
  tombs: Tomb[],
): T[] {
  const ex = Array.isArray(existing) ? existing : []
  const inc = Array.isArray(incoming) ? incoming : []
  const tombAt = new Map(tombs.map(t => [t.id, t.at]))
  const byId = new Map<string, T>()
  for (const r of ex) {
    if (r && typeof r.id === 'string') byId.set(r.id, r)
  }
  for (const r of inc) {
    if (!r || typeof r.id !== 'string') continue
    const prev = byId.get(r.id)
    if (!prev) { byId.set(r.id, r); continue }
    const pu = prev.updatedAt ?? 0
    const ru = r.updatedAt ?? 0
    if (ru > pu) byId.set(r.id, r) // strictly newer incoming wins; else keep existing
  }
  const out: T[] = []
  for (const r of byId.values()) {
    const tAt = tombAt.get(r.id)
    if (tAt != null && tAt > (r.updatedAt ?? 0)) continue // deleted after last edit → drop
    out.push(r)
  }
  return out
}

function listHasData(v: unknown): v is unknown[] {
  return Array.isArray(v) && v.length > 0
}

function goalsHaveData(g: UserState['goals']): boolean {
  return !!g && (
    Object.keys(g.annual ?? {}).length > 0 ||
    (Array.isArray(g.distGoals) && g.distGoals.length > 0)
  )
}

/**
 * Merge the incoming user state into the existing server row.
 *
 * Guarantees: races/upcoming are a union by id+updatedAt minus tombstoned ids;
 * an empty/partial incoming slice can never shrink a populated existing slice;
 * athlete is last-write-wins by updatedAt (existing wins on tie); lists and
 * goals prefer incoming only when incoming actually carries data.
 *
 * @param now epoch ms — injectable so the tombstone-prune window is testable.
 */
export function mergeUserState(
  existing: UserState | null | undefined,
  incoming: UserState | null | undefined,
  now: number = Date.now(),
): UserState {
  const ex: UserState = existing && typeof existing === 'object' ? existing : {}
  const inc: UserState = incoming && typeof incoming === 'object' ? incoming : {}

  const tombs = mergeTombs(ex.deleted_race_ids, inc.deleted_race_ids, now)

  const races = mergeRaceListsServer(ex.races, inc.races, tombs)
  let upcoming = mergeRaceListsServer(ex.upcoming_races, inc.upcoming_races, tombs)
  // A race moved upcoming→past (now in `races`) must not linger in upcoming.
  const pastIds = new Set(races.map(r => r.id))
  upcoming = upcoming.filter(u => !pastIds.has(u.id))

  // Lists without per-item updatedAt: incoming when it has data, else keep
  // existing (an empty incoming slice must never wipe a populated server slice).
  const pickList = (incVal: unknown, exVal: unknown): unknown[] | undefined =>
    listHasData(incVal) ? incVal
      : Array.isArray(exVal) ? exVal
        : Array.isArray(incVal) ? incVal
          : undefined

  // Athlete: LWW by updatedAt; existing wins on tie / when newer.
  let athlete = inc.athlete ?? ex.athlete
  if (ex.athlete && inc.athlete) {
    const eu = ex.athlete.updatedAt ?? 0
    const iu = inc.athlete.updatedAt ?? 0
    athlete = iu > eu ? inc.athlete : ex.athlete
  }

  const goals = goalsHaveData(inc.goals) ? inc.goals : (ex.goals ?? inc.goals)

  return {
    ...ex,
    ...inc,
    races,
    upcoming_races: upcoming,
    wishlist_races: pickList(inc.wishlist_races, ex.wishlist_races) as unknown[] | undefined,
    season_plans: pickList(inc.season_plans, ex.season_plans) as unknown[] | undefined,
    injuries: pickList(inc.injuries, ex.injuries) as unknown[] | undefined,
    goals,
    athlete,
    deleted_race_ids: tombs,
    // next_race / focus_race_id are pointers — incoming wins when provided.
    next_race: inc.next_race ?? ex.next_race ?? null,
    focus_race_id: inc.focus_race_id ?? ex.focus_race_id ?? null,
  }
}

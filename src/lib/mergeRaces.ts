/**
 * Cross-device race merge — last-write-wins by `updatedAt`, with tombstones for
 * deletes. Pure + deterministic so it can be unit-tested exhaustively.
 *
 * Why this exists: the old pull merge was union-by-id (keep all local, add
 * remote-only). That preserved offline-added races but meant an EDIT or DELETE
 * on device B never reached device A — A kept its stale copy forever. This adds
 * proper propagation while staying conservative so it can never resurrect the
 * "empty state wipes everything" data-loss class:
 *   - empty remote + local data  → mergeRaceLists keeps all local (no tombstones)
 *   - offline-added local race    → kept (no tombstone covers it)
 *   - legacy race (no updatedAt)  → treated as oldest; only dropped by a real
 *                                   tombstone, never silently lost
 */

export interface Tomb {
  id: string
  at: number // epoch ms the race was deleted
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

/** Merge two tombstone lists (keep the newest delete per id) and prune old ones. */
export function mergeTombstones(a: Tomb[], b: Tomb[], now: number): Tomb[] {
  const m = new Map<string, number>()
  for (const t of [...(a ?? []), ...(b ?? [])]) {
    if (!t || typeof t.id !== 'string' || typeof t.at !== 'number') continue
    m.set(t.id, Math.max(m.get(t.id) ?? 0, t.at))
  }
  const out: Tomb[] = []
  for (const [id, at] of m) {
    if (now - at < NINETY_DAYS_MS) out.push({ id, at }) // drop stale tombstones
  }
  return out
}

/** Pick the more recently edited of two versions. Ties / both-legacy prefer
 *  `a` (the local copy) so a stale remote snapshot never clobbers local. */
function newer<T extends { updatedAt?: number }>(a: T | undefined, b: T | undefined): T | undefined {
  if (!a) return b
  if (!b) return a
  const au = a.updatedAt ?? 0
  const bu = b.updatedAt ?? 0
  return bu > au ? b : a
}

/**
 * Merge local + remote race lists with last-write-wins, dropping any race a
 * tombstone says was deleted after its last edit. `tombs` must already be the
 * merged local+remote tombstone set.
 */
export function mergeRaceLists<T extends { id: string; updatedAt?: number }>(
  local: T[],
  remote: T[],
  tombs: Tomb[],
): T[] {
  const tombAt = new Map(tombs.map(t => [t.id, t.at]))
  const localById = new Map(local.map(r => [r.id, r]))
  const remoteById = new Map(remote.map(r => [r.id, r]))
  const ids = new Set<string>([...localById.keys(), ...remoteById.keys()])
  const out: T[] = []
  for (const id of ids) {
    const pick = newer(localById.get(id), remoteById.get(id))
    if (!pick) continue
    const tAt = tombAt.get(id)
    // Deleted after its last edit → drop. A re-add/edit after the delete
    // (updatedAt > tombstone) wins and survives.
    if (tAt != null && tAt > (pick.updatedAt ?? 0)) continue
    out.push(pick)
  }
  return out
}

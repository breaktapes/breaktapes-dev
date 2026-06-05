import { describe, it, expect } from 'vitest'
import { mergeUserState, mergeRaceListsServer, mergeTombs, type UserState } from '@/lib/stateMerge'

const race = (id: string, updatedAt?: number, extra: Record<string, unknown> = {}) =>
  ({ id, updatedAt, ...extra })

const NOW = 1_700_000_000_000
// Recent, ordered timestamps so the 90-day tombstone-prune window never fires.
const T = (n: number) => NOW - 1_000_000 + n

describe('mergeUserState — THE invariant: an empty/partial client flush must never reduce a populated server row', () => {
  // This is the regression guard for the recurring cross-device data-loss bug.
  // Every prior fix gated one write path; this asserts the structural property
  // that makes ALL such paths non-destructive. If this test ever fails, the
  // full-replace data-loss class has been reintroduced.

  it('empty incoming state preserves every existing race', () => {
    const existing: UserState = {
      races: [race('a', 1), race('b', 2), race('c', 3)],
      upcoming_races: [race('u1', 4)],
    }
    const merged = mergeUserState(existing, {}, NOW)
    expect(merged.races!.map(r => r.id).sort()).toEqual(['a', 'b', 'c'])
    expect(merged.upcoming_races!.map(r => r.id)).toEqual(['u1'])
  })

  it('incoming with FEWER races (no tombstones) never drops the missing ones', () => {
    const existing: UserState = { races: [race('a', 1), race('b', 2), race('c', 3)] }
    const incoming: UserState = { races: [race('a', 1)] } // b, c absent but NOT tombstoned
    const merged = mergeUserState(existing, incoming, NOW)
    expect(merged.races!.map(r => r.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('completely empty incoming (fresh-device flush) yields the existing row unchanged in race count', () => {
    const existing: UserState = {
      races: [race('a', 1), race('b', 2)],
      upcoming_races: [race('u1', 3), race('u2', 4)],
      wishlist_races: [{ id: 'w1' }],
      season_plans: [{ id: 's1' }],
      injuries: [{ id: 'i1' }],
      goals: { annual: { '2026': 10 }, distGoals: [{ id: 'g1' }] },
    }
    const merged = mergeUserState(existing, {}, NOW)
    expect(merged.races!.length).toBe(2)
    expect(merged.upcoming_races!.length).toBe(2)
    expect(merged.wishlist_races!.length).toBe(1)
    expect(merged.season_plans!.length).toBe(1)
    expect(merged.injuries!.length).toBe(1)
    expect(merged.goals).toEqual(existing.goals)
  })
})

describe('mergeUserState — deletes still work (only via tombstones)', () => {
  it('a tombstone newer than the race removes it', () => {
    const existing: UserState = { races: [race('a', T(1)), race('b', T(2))] }
    const incoming: UserState = {
      races: [race('a', T(1))],
      deleted_race_ids: [{ id: 'b', at: T(5) }], // deleted after b's last edit
    }
    const merged = mergeUserState(existing, incoming, NOW)
    expect(merged.races!.map(r => r.id)).toEqual(['a'])
    expect(merged.deleted_race_ids).toEqual([{ id: 'b', at: T(5) }])
  })

  it('a re-add/edit AFTER the delete survives (updatedAt > tombstone.at)', () => {
    const existing: UserState = {
      races: [race('a', T(1))],
      deleted_race_ids: [{ id: 'b', at: T(5) }],
    }
    const incoming: UserState = { races: [race('a', T(1)), race('b', T(9))] } // b re-added, edited after delete
    const merged = mergeUserState(existing, incoming, NOW)
    expect(merged.races!.map(r => r.id).sort()).toEqual(['a', 'b'])
  })
})

describe('mergeUserState — last-write-wins protects fresher server edits', () => {
  it('a stale full-state writer cannot clobber a newer edit already on the server', () => {
    const existing: UserState = { races: [race('a', 100, { time: '3:30:00' })] } // fresh edit
    const incoming: UserState = { races: [race('a', 50, { time: '4:00:00' })] }  // stale device
    const merged = mergeUserState(existing, incoming, NOW)
    expect(merged.races!.find(r => r.id === 'a')).toMatchObject({ time: '3:30:00', updatedAt: 100 })
  })

  it('a strictly-newer incoming edit propagates', () => {
    const existing: UserState = { races: [race('a', 50, { time: '4:00:00' })] }
    const incoming: UserState = { races: [race('a', 100, { time: '3:30:00' })] }
    const merged = mergeUserState(existing, incoming, NOW)
    expect(merged.races!.find(r => r.id === 'a')).toMatchObject({ time: '3:30:00', updatedAt: 100 })
  })

  it('athlete merge is LWW by updatedAt; existing wins on tie', () => {
    const existing: UserState = { athlete: { updatedAt: 10, name: 'fresh' } }
    const incoming: UserState = { athlete: { updatedAt: 10, name: 'stale' } }
    expect(mergeUserState(existing, incoming, NOW).athlete).toMatchObject({ name: 'fresh' })
    expect(
      mergeUserState(existing, { athlete: { updatedAt: 11, name: 'newer' } }, NOW).athlete,
    ).toMatchObject({ name: 'newer' })
  })
})

describe('mergeUserState — upcoming↔past consistency', () => {
  it('a race moved to past is removed from upcoming (no duplicate across lists)', () => {
    const existing: UserState = { upcoming_races: [race('x', 1)] }
    const incoming: UserState = { races: [race('x', 2)], upcoming_races: [] }
    const merged = mergeUserState(existing, incoming, NOW)
    expect(merged.races!.map(r => r.id)).toEqual(['x'])
    expect(merged.upcoming_races!.map(r => r.id)).toEqual([]) // not duplicated into upcoming
  })

  it('an auto-moved past race (preserved updatedAt) does NOT resurrect a newer cross-device delete', () => {
    // Device B deleted x as past at t=20. Device A still has x as upcoming with
    // its original updatedAt=5 and auto-moves it to past WITHOUT re-stamping.
    const existing: UserState = { races: [], deleted_race_ids: [{ id: 'x', at: T(20) }] }
    const incoming: UserState = { races: [race('x', T(5))], upcoming_races: [] } // moved, original stamp
    const merged = mergeUserState(existing, incoming, NOW)
    expect(merged.races!.map(r => r.id)).toEqual([]) // tombstone(T20) > updatedAt(T5) → stays deleted
  })
})

describe('mergeTombs / mergeRaceListsServer units', () => {
  it('mergeTombs prunes entries older than 90 days', () => {
    const old = NOW - 91 * 24 * 60 * 60 * 1000
    const recent = NOW - 1 * 24 * 60 * 60 * 1000
    const out = mergeTombs([{ id: 'old', at: old }], [{ id: 'new', at: recent }], NOW)
    expect(out.map(t => t.id)).toEqual(['new'])
  })

  it('mergeRaceListsServer keeps existing on a legacy-vs-legacy tie (both updatedAt undefined)', () => {
    const out = mergeRaceListsServer(
      [race('a', undefined, { tag: 'existing' })],
      [race('a', undefined, { tag: 'incoming' })],
      [],
    )
    expect(out[0]).toMatchObject({ tag: 'existing' })
  })
})

import { describe, it, expect } from 'vitest'
import { mergeRaceLists, mergeTombstones, type Tomb } from '../mergeRaces'

type R = { id: string; updatedAt?: number; tag?: string }
const r = (id: string, updatedAt?: number, tag?: string): R => ({ id, updatedAt, tag })

const NOW = 1_700_000_000_000

describe('mergeRaceLists — last-write-wins', () => {
  it('keeps all local when remote is empty (no data-loss on empty pull)', () => {
    const local = [r('a', 1), r('b', 2)]
    const out = mergeRaceLists(local, [], [])
    expect(out.map(x => x.id).sort()).toEqual(['a', 'b'])
  })

  it('adds remote-only races (cross-device new races)', () => {
    const out = mergeRaceLists([r('a', 1)], [r('a', 1), r('b', 2)], [])
    expect(out.map(x => x.id).sort()).toEqual(['a', 'b'])
  })

  it('keeps offline-added local race not present in remote', () => {
    const out = mergeRaceLists([r('a', 1), r('new', 5)], [r('a', 1)], [])
    expect(out.find(x => x.id === 'new')).toBeTruthy()
  })

  it('remote edit (newer updatedAt) wins over stale local', () => {
    const out = mergeRaceLists([r('a', 1, 'old')], [r('a', 2, 'new')], [])
    expect(out.find(x => x.id === 'a')?.tag).toBe('new')
  })

  it('local edit (newer updatedAt) wins over stale remote', () => {
    const out = mergeRaceLists([r('a', 5, 'local')], [r('a', 2, 'remote')], [])
    expect(out.find(x => x.id === 'a')?.tag).toBe('local')
  })

  it('tie on updatedAt prefers local (stale remote never clobbers)', () => {
    const out = mergeRaceLists([r('a', 3, 'local')], [r('a', 3, 'remote')], [])
    expect(out.find(x => x.id === 'a')?.tag).toBe('local')
  })

  it('both legacy (no updatedAt) prefers local', () => {
    const out = mergeRaceLists([r('a', undefined, 'local')], [r('a', undefined, 'remote')], [])
    expect(out.find(x => x.id === 'a')?.tag).toBe('local')
  })

  it('a versioned edit beats a legacy copy (updatedAt > undefined=0)', () => {
    const out = mergeRaceLists([r('a', undefined, 'legacy')], [r('a', 5, 'edited')], [])
    expect(out.find(x => x.id === 'a')?.tag).toBe('edited')
  })
})

describe('mergeRaceLists — tombstones (deletes)', () => {
  it('drops a race deleted after its last edit', () => {
    const tombs: Tomb[] = [{ id: 'a', at: 10 }]
    const out = mergeRaceLists([r('a', 5)], [], tombs)
    expect(out.find(x => x.id === 'a')).toBeFalsy()
  })

  it('propagates a delete to a device that still has the stale copy', () => {
    // device A still has race a (edited at 5); device B deleted it at 10
    const tombs: Tomb[] = [{ id: 'a', at: 10 }]
    const out = mergeRaceLists([r('a', 5), r('b', 1)], [r('b', 1)], tombs)
    expect(out.map(x => x.id)).toEqual(['b'])
  })

  it('a re-add/edit AFTER the delete survives (updatedAt > tombstone)', () => {
    const tombs: Tomb[] = [{ id: 'a', at: 10 }]
    const out = mergeRaceLists([r('a', 20, 'readded')], [], tombs)
    expect(out.find(x => x.id === 'a')?.tag).toBe('readded')
  })

  it('drops a legacy race (updatedAt undefined=0) when a tombstone exists', () => {
    const tombs: Tomb[] = [{ id: 'a', at: 10 }]
    const out = mergeRaceLists([r('a')], [], tombs)
    expect(out.find(x => x.id === 'a')).toBeFalsy()
  })

  it('tombstone for an absent race is a no-op', () => {
    const tombs: Tomb[] = [{ id: 'ghost', at: 10 }]
    const out = mergeRaceLists([r('a', 1)], [r('a', 1)], tombs)
    expect(out.map(x => x.id)).toEqual(['a'])
  })
})

describe('mergeTombstones', () => {
  const t1 = NOW - 5000
  const t2 = NOW - 1000 // newer

  it('keeps the newest delete per id', () => {
    const out = mergeTombstones([{ id: 'a', at: t1 }], [{ id: 'a', at: t2 }], NOW)
    expect(out).toEqual([{ id: 'a', at: t2 }])
  })

  it('unions distinct ids', () => {
    const out = mergeTombstones([{ id: 'a', at: t1 }], [{ id: 'b', at: t2 }], NOW)
    expect(out.map(t => t.id).sort()).toEqual(['a', 'b'])
  })

  it('prunes tombstones older than 90 days', () => {
    const old = NOW - 91 * 24 * 60 * 60 * 1000
    const out = mergeTombstones([{ id: 'old', at: old }], [{ id: 'fresh', at: NOW - 1000 }], NOW)
    expect(out.map(t => t.id)).toEqual(['fresh'])
  })

  it('ignores malformed entries', () => {
    // @ts-expect-error testing bad input
    const out = mergeTombstones([{ id: 'a' }, null, { at: t1 }], [{ id: 'b', at: t2 }], NOW)
    expect(out.map(t => t.id)).toEqual(['b'])
  })
})

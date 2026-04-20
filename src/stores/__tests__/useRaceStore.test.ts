import { describe, it, expect, beforeEach } from 'vitest'
import { useRaceStore } from '../useRaceStore'
import type { Race } from '@/types'

function makeRace(overrides: Partial<Race> = {}): Race {
  return {
    id: crypto.randomUUID(),
    name: 'Test Race',
    date: '2027-06-15',
    city: 'London',
    country: 'GB',
    distance: '42.2',
    sport: 'running',
    ...overrides,
  }
}

function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const TODAY = localToday()
const FUTURE = '2099-01-01'
const PAST   = '2000-01-01'

beforeEach(() => {
  useRaceStore.setState({
    races: [],
    upcomingRaces: [],
    wishlistRaces: [],
    nextRace: null,
  })
})

describe('useRaceStore — addRace', () => {
  it('adds race to store', () => {
    const r = makeRace()
    useRaceStore.getState().addRace(r)
    expect(useRaceStore.getState().races).toHaveLength(1)
    expect(useRaceStore.getState().races[0].id).toBe(r.id)
  })

  it('persists to localStorage under fl2_races key', () => {
    const r = makeRace()
    useRaceStore.getState().addRace(r)
    const stored = JSON.parse(window.localStorage.getItem('fl2_races') ?? '{}')
    const races = stored?.state?.races ?? []
    expect(races.some((x: Race) => x.id === r.id)).toBe(true)
  })
})

describe('useRaceStore — deleteRace', () => {
  it('removes race from store', () => {
    const r = makeRace()
    useRaceStore.setState({ races: [r] })
    useRaceStore.getState().deleteRace(r.id)
    expect(useRaceStore.getState().races).toHaveLength(0)
  })

  it('also removes from upcomingRaces', () => {
    const r = makeRace({ date: FUTURE })
    useRaceStore.setState({ races: [r], upcomingRaces: [r] })
    useRaceStore.getState().deleteRace(r.id)
    expect(useRaceStore.getState().upcomingRaces).toHaveLength(0)
  })

  it('updates localStorage under fl2_races key', () => {
    const r = makeRace()
    useRaceStore.setState({ races: [r] })
    useRaceStore.getState().deleteRace(r.id)
    const stored = JSON.parse(window.localStorage.getItem('fl2_races') ?? '{}')
    const races = stored?.state?.races ?? []
    expect(races.some((x: Race) => x.id === r.id)).toBe(false)
  })
})

describe('useRaceStore — nextRace auto-promote (Session 13 regression)', () => {
  it('promotes nearest future race when nextRace is null', () => {
    const soon = makeRace({ date: FUTURE })
    useRaceStore.setState({ nextRace: null, upcomingRaces: [soon] })
    useRaceStore.getState().promoteNextRace()
    expect(useRaceStore.getState().nextRace?.id).toBe(soon.id)
  })

  it('promotes when nextRace is in the past', () => {
    const old = makeRace({ date: PAST })
    const future = makeRace({ date: FUTURE })
    useRaceStore.setState({ nextRace: old, upcomingRaces: [old, future] })
    useRaceStore.getState().promoteNextRace()
    expect(useRaceStore.getState().nextRace?.id).toBe(future.id)
  })

  it('does not replace a valid future nextRace', () => {
    const near = makeRace({ id: 'near', date: FUTURE })
    const far  = makeRace({ id: 'far',  date: '2099-12-31' })
    useRaceStore.setState({ nextRace: near, upcomingRaces: [near, far] })
    useRaceStore.getState().promoteNextRace()
    expect(useRaceStore.getState().nextRace?.id).toBe('near')
  })

  it('setUpcomingRaces triggers auto-promote', () => {
    const future = makeRace({ date: FUTURE })
    useRaceStore.setState({ nextRace: null })
    useRaceStore.getState().setUpcomingRaces([future])
    expect(useRaceStore.getState().nextRace?.id).toBe(future.id)
  })

  it('returns null when no future races exist', () => {
    useRaceStore.setState({ nextRace: makeRace({ date: PAST }), upcomingRaces: [] })
    useRaceStore.getState().promoteNextRace()
    expect(useRaceStore.getState().nextRace).toBeNull()
  })

  it('guard: today is treated as a valid future race', () => {
    const todayRace = makeRace({ date: TODAY })
    useRaceStore.setState({ nextRace: null, upcomingRaces: [todayRace] })
    useRaceStore.getState().promoteNextRace()
    expect(useRaceStore.getState().nextRace?.id).toBe(todayRace.id)
  })
})

// ── V1 → V2 localStorage migration (cutover safety) ──────────────────────────
// Uses persist.rehydrate() to trigger the real onRehydrateStorage path.
// Setup: write empty Zustand wrapper to fl2_races so rehydrate has a valid base.

function emptyRaceStorage() {
  window.localStorage.setItem('fl2_races', JSON.stringify({
    state: { races: [], upcomingRaces: [], wishlistRaces: [], nextRace: null, focusRaceId: null },
    version: 0,
  }))
}

describe('useRaceStore — V1 localStorage migration', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useRaceStore.setState({
      races: [],
      upcomingRaces: [],
      wishlistRaces: [],
      nextRace: null,
      focusRaceId: null,
    })
  })

  it('migrates fl2_upcoming → upcomingRaces on rehydration', async () => {
    const upcoming = [makeRace({ date: FUTURE, name: 'Upcoming Race' })]
    emptyRaceStorage()
    window.localStorage.setItem('fl2_upcoming', JSON.stringify(upcoming))

    await useRaceStore.persist.rehydrate()

    expect(useRaceStore.getState().upcomingRaces).toHaveLength(1)
    expect(useRaceStore.getState().upcomingRaces[0].name).toBe('Upcoming Race')
  })

  it('does not overwrite existing upcomingRaces with fl2_upcoming', async () => {
    const existing = makeRace({ date: FUTURE, name: 'Already migrated' })
    window.localStorage.setItem('fl2_races', JSON.stringify({
      state: { races: [], upcomingRaces: [existing], wishlistRaces: [], nextRace: null, focusRaceId: null },
      version: 0,
    }))
    window.localStorage.setItem('fl2_upcoming', JSON.stringify([makeRace({ name: 'Old V1 race' })]))

    await useRaceStore.persist.rehydrate()

    expect(useRaceStore.getState().upcomingRaces[0].name).toBe('Already migrated')
  })

  it('migrates fl2_wishlist → wishlistRaces on rehydration', async () => {
    const wishlist = [makeRace({ name: 'Dream Race' })]
    emptyRaceStorage()
    window.localStorage.setItem('fl2_wishlist', JSON.stringify(wishlist))

    await useRaceStore.persist.rehydrate()

    expect(useRaceStore.getState().wishlistRaces).toHaveLength(1)
    expect(useRaceStore.getState().wishlistRaces[0].name).toBe('Dream Race')
  })

  it('migrates fl2_focus_race_id → focusRaceId on rehydration', async () => {
    emptyRaceStorage()
    window.localStorage.setItem('fl2_focus_race_id', 'race-abc-123')

    await useRaceStore.persist.rehydrate()

    expect(useRaceStore.getState().focusRaceId).toBe('race-abc-123')
  })

  it('does not overwrite existing focusRaceId with fl2_focus_race_id', async () => {
    window.localStorage.setItem('fl2_races', JSON.stringify({
      state: { races: [], upcomingRaces: [], wishlistRaces: [], nextRace: null, focusRaceId: 'already-set' },
      version: 0,
    }))
    window.localStorage.setItem('fl2_focus_race_id', 'old-v1-id')

    await useRaceStore.persist.rehydrate()

    expect(useRaceStore.getState().focusRaceId).toBe('already-set')
  })

  it('handles missing or malformed fl2_upcoming gracefully', async () => {
    emptyRaceStorage()
    window.localStorage.setItem('fl2_upcoming', 'not-valid-json{{{')

    await expect(useRaceStore.persist.rehydrate()).resolves.not.toThrow()

    expect(useRaceStore.getState().upcomingRaces).toHaveLength(0)
  })
})

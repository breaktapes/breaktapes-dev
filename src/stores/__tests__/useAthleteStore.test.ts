import { describe, it, expect, beforeEach } from 'vitest'
import { useAthleteStore } from '../useAthleteStore'
import type { Athlete, SeasonPlan } from '@/types'

function makePlan(overrides: Partial<SeasonPlan> = {}): SeasonPlan {
  return {
    id: crypto.randomUUID(),
    name: 'Test Plan',
    createdAt: new Date().toISOString(),
    items: [],
    ...overrides,
  }
}

beforeEach(() => {
  useAthleteStore.setState({ athlete: null, seasonPlans: [] })
  window.localStorage.removeItem('fl2_ath')
  window.localStorage.removeItem('fl2_season_plans')
})

// ── updateAthlete ─────────────────────────────────────────────────────────────

describe('useAthleteStore — updateAthlete', () => {
  it('sets athlete from null', () => {
    useAthleteStore.getState().updateAthlete({ firstName: 'Alex' })
    expect(useAthleteStore.getState().athlete?.firstName).toBe('Alex')
  })

  it('merges into existing athlete', () => {
    useAthleteStore.setState({ athlete: { firstName: 'Alex', lastName: 'Smith' } as Athlete })
    useAthleteStore.getState().updateAthlete({ lastName: 'Jones' })
    expect(useAthleteStore.getState().athlete?.firstName).toBe('Alex')
    expect(useAthleteStore.getState().athlete?.lastName).toBe('Jones')
  })

  it('does not clear fields set to undefined', () => {
    useAthleteStore.setState({ athlete: { firstName: 'Alex', city: 'London' } as Athlete })
    useAthleteStore.getState().updateAthlete({ city: undefined })
    expect(useAthleteStore.getState().athlete?.city).toBe('London')
  })

  it('clears field when explicitly set to null', () => {
    useAthleteStore.setState({ athlete: { firstName: 'Alex', city: 'London' } as Athlete })
    useAthleteStore.getState().updateAthlete({ city: null as unknown as string })
    expect(useAthleteStore.getState().athlete?.city).toBeNull()
  })
})

// ── seasonPlans ───────────────────────────────────────────────────────────────

describe('useAthleteStore — seasonPlans', () => {
  it('adds a plan', () => {
    const plan = makePlan({ name: 'Spring 2026' })
    useAthleteStore.getState().addSeasonPlan(plan)
    expect(useAthleteStore.getState().seasonPlans).toHaveLength(1)
    expect(useAthleteStore.getState().seasonPlans[0].name).toBe('Spring 2026')
  })

  it('deletes a plan by id', () => {
    const a = makePlan({ id: 'aaa' })
    const b = makePlan({ id: 'bbb' })
    useAthleteStore.setState({ seasonPlans: [a, b] })
    useAthleteStore.getState().deleteSeasonPlan('aaa')
    expect(useAthleteStore.getState().seasonPlans).toHaveLength(1)
    expect(useAthleteStore.getState().seasonPlans[0].id).toBe('bbb')
  })
})

// ── V1 → V2 localStorage migration ───────────────────────────────────────────

function emptyAthleteStorage() {
  window.localStorage.setItem('fl2_ath', JSON.stringify({
    state: { athlete: null, seasonPlans: [] },
    version: 0,
  }))
}

describe('useAthleteStore — V1 localStorage migration', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAthleteStore.setState({ athlete: null, seasonPlans: [] })
  })

  it('migrates fl2_season_plans → seasonPlans on rehydration', async () => {
    const plans = [makePlan({ name: 'Migrated Plan' })]
    emptyAthleteStorage()
    window.localStorage.setItem('fl2_season_plans', JSON.stringify(plans))

    await useAthleteStore.persist.rehydrate()

    expect(useAthleteStore.getState().seasonPlans).toHaveLength(1)
    expect(useAthleteStore.getState().seasonPlans[0].name).toBe('Migrated Plan')
  })

  it('does not overwrite existing seasonPlans with fl2_season_plans', async () => {
    const existing = makePlan({ name: 'Already in V2' })
    window.localStorage.setItem('fl2_ath', JSON.stringify({
      state: { athlete: null, seasonPlans: [existing] },
      version: 0,
    }))
    window.localStorage.setItem('fl2_season_plans', JSON.stringify([makePlan({ name: 'Old V1 plan' })]))

    await useAthleteStore.persist.rehydrate()

    expect(useAthleteStore.getState().seasonPlans[0].name).toBe('Already in V2')
  })

  it('migrates V1 athlete object from fl2_ath (no Zustand wrapper)', async () => {
    // V1 format: raw object, not wrapped in {state:{...}}
    const v1Athlete = { firstName: 'Jane', lastName: 'Doe', mainSport: 'running' }
    window.localStorage.setItem('fl2_ath', JSON.stringify(v1Athlete))

    await useAthleteStore.persist.rehydrate()

    expect(useAthleteStore.getState().athlete?.firstName).toBe('Jane')
    expect(useAthleteStore.getState().athlete?.mainSport).toBe('running')
  })

  it('does not overwrite existing athlete with V1 fl2_ath data', async () => {
    window.localStorage.setItem('fl2_ath', JSON.stringify({
      state: { athlete: { firstName: 'Already Set' }, seasonPlans: [] },
      version: 0,
    }))
    // V1 key present too — should be ignored since athlete already set
    window.localStorage.setItem('fl2_ath', JSON.stringify({ firstName: 'Old V1 data' }))

    // Athlete already set in store
    useAthleteStore.setState({ athlete: { firstName: 'Already Set' } as Athlete })
    await useAthleteStore.persist.rehydrate()

    expect(useAthleteStore.getState().athlete?.firstName).toBe('Already Set')
  })

  it('handles missing fl2_season_plans gracefully (no key set)', async () => {
    emptyAthleteStorage()

    await expect(useAthleteStore.persist.rehydrate()).resolves.not.toThrow()

    expect(useAthleteStore.getState().seasonPlans).toHaveLength(0)
  })

  it('handles malformed fl2_season_plans JSON gracefully', async () => {
    emptyAthleteStorage()
    window.localStorage.setItem('fl2_season_plans', '[[invalid json')

    await expect(useAthleteStore.persist.rehydrate()).resolves.not.toThrow()

    expect(useAthleteStore.getState().seasonPlans).toHaveLength(0)
  })
})

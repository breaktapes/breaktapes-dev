import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/posthog', () => ({ posthog: { capture: vi.fn() } }))
vi.mock('@/lib/syncState', () => ({ syncStateToSupabase: vi.fn() }))

import { useTourStore, hasFinishedTour } from '../useTourStore'
import { useAthleteStore } from '../useAthleteStore'
import { TOUR_STEPS } from '@/lib/tourSteps'
import { posthog } from '@/lib/posthog'

beforeEach(() => {
  localStorage.clear()
  useTourStore.setState({ active: false, step: 0 })
  useAthleteStore.setState({ athlete: null })
  vi.clearAllMocks()
})

describe('TOUR_STEPS registry', () => {
  it('has unique step ids', () => {
    const ids = TOUR_STEPS.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every step has title and body', () => {
    for (const s of TOUR_STEPS) {
      expect(s.title.length).toBeGreaterThan(0)
      expect(s.body.length).toBeGreaterThan(0)
    }
  })

  it('first step is a centered welcome (no target)', () => {
    expect(TOUR_STEPS[0].target).toBeNull()
  })

  it('targeted steps use attribute selectors', () => {
    for (const s of TOUR_STEPS.slice(1)) {
      expect(s.target).toMatch(/^\[data-/)
    }
  })
})

describe('useTourStore — lifecycle', () => {
  it('startTour activates at step 0 and captures analytics', () => {
    useTourStore.getState().startTour('auto')
    expect(useTourStore.getState().active).toBe(true)
    expect(useTourStore.getState().step).toBe(0)
    expect(posthog.capture).toHaveBeenCalledWith('tour_started', { trigger: 'auto' })
  })

  it('nextStep advances through steps', () => {
    useTourStore.getState().startTour('auto')
    useTourStore.getState().nextStep()
    expect(useTourStore.getState().step).toBe(1)
  })

  it('prevStep goes back but not below 0', () => {
    useTourStore.getState().startTour('auto')
    useTourStore.getState().prevStep()
    expect(useTourStore.getState().step).toBe(0)
    useTourStore.getState().nextStep()
    useTourStore.getState().prevStep()
    expect(useTourStore.getState().step).toBe(0)
  })

  it('nextStep on the last step completes the tour', () => {
    useTourStore.getState().startTour('auto')
    useTourStore.setState({ step: TOUR_STEPS.length - 1 })
    useTourStore.getState().nextStep()
    expect(useTourStore.getState().active).toBe(false)
    expect(posthog.capture).toHaveBeenCalledWith('tour_completed')
  })

  it('skipMissingStep advances without analytics noise', () => {
    useTourStore.getState().startTour('auto')
    vi.clearAllMocks()
    useTourStore.getState().skipMissingStep()
    expect(useTourStore.getState().step).toBe(1)
    expect(posthog.capture).not.toHaveBeenCalled()
  })
})

describe('useTourStore — persistence + suppression', () => {
  it('hasFinishedTour is false for a fresh user', () => {
    expect(hasFinishedTour()).toBe(false)
  })

  it('completeTour persists locally and stamps athlete.tourCompletedAt', () => {
    useTourStore.getState().startTour('auto')
    useTourStore.getState().completeTour()
    expect(hasFinishedTour()).toBe(true)
    const saved = JSON.parse(localStorage.getItem('fl2_tour_state')!)
    expect(saved.completedAt).toBeGreaterThan(0)
    expect(useAthleteStore.getState().athlete?.tourCompletedAt).toBeGreaterThan(0)
  })

  it('skipTour persists the skip step and suppresses re-runs', () => {
    useTourStore.getState().startTour('auto')
    useTourStore.getState().nextStep()
    useTourStore.getState().skipTour()
    expect(useTourStore.getState().active).toBe(false)
    expect(hasFinishedTour()).toBe(true)
    const saved = JSON.parse(localStorage.getItem('fl2_tour_state')!)
    expect(saved.skippedAtStep).toBe(1)
    expect(posthog.capture).toHaveBeenCalledWith('tour_skipped', { step: 1, step_id: TOUR_STEPS[1].id })
  })

  it('remote athlete.tourCompletedAt suppresses auto-start on a fresh device', () => {
    // simulates a synced athlete arriving with the flag set, empty localStorage
    useAthleteStore.setState({ athlete: { tourCompletedAt: 1234567890 } })
    expect(hasFinishedTour()).toBe(true)
  })

  it('corrupt localStorage is treated as not finished', () => {
    localStorage.setItem('fl2_tour_state', '[not an object')
    expect(hasFinishedTour()).toBe(false)
  })

  it('JSON array in localStorage does not corrupt state', () => {
    localStorage.setItem('fl2_tour_state', '[]')
    expect(hasFinishedTour()).toBe(false)
  })
})

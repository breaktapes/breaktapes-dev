import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/posthog', () => ({ posthog: { capture: vi.fn() } }))
const mockPullComplete = vi.fn(() => true)
vi.mock('@/lib/syncState', () => ({
  syncStateToSupabase: vi.fn(),
  isRemotePullComplete: () => mockPullComplete(),
}))

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useTourStore, hasFinishedTour, maybeAutoStartTour } from '../useTourStore'
import { useAthleteStore } from '../useAthleteStore'
import { TOUR_STEPS } from '@/lib/tourSteps'
import { FIXED_SIZE_WIDGETS, WIDGET_SIZES } from '../useDashStore'
import { posthog } from '@/lib/posthog'

beforeEach(() => {
  localStorage.clear()
  useTourStore.setState({ active: false, step: 0, viewed: [] })
  useAthleteStore.setState({ athlete: null })
  vi.clearAllMocks()
  mockPullComplete.mockReturnValue(true)
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

  // Selector contract — a rename of these anchors silently deletes tour steps
  // (the overlay auto-skips missing targets), so pin them at the source level.
  it('dashboard anchors referenced by TOUR_STEPS exist in Dashboard.tsx', () => {
    const src = readFileSync(resolve(__dirname, '../../pages/Dashboard.tsx'), 'utf8')
    expect(src).toContain('data-tour="get-started"')
    expect(src).toContain('data-tour="customize"')
  })

  it('stats-strip widget targeted by TOUR_STEPS is a registered dashboard widget', () => {
    expect(TOUR_STEPS.some(s => s.target === '[data-widget-id="stats-strip"]')).toBe(true)
    expect(FIXED_SIZE_WIDGETS.has('stats-strip')).toBe(true)
    expect(Object.keys(WIDGET_SIZES)).toContain('stats-strip')
  })
})

describe('useTourStore — lifecycle', () => {
  it('startTour activates at step 0 and captures analytics', () => {
    useTourStore.getState().startTour('auto')
    expect(useTourStore.getState().active).toBe(true)
    expect(useTourStore.getState().step).toBe(0)
    expect(posthog.capture).toHaveBeenCalledWith('tour_started', { trigger: 'auto', restart: false })
  })

  it('a second startTour reports restart: true (mid-tour refresh dedup)', () => {
    useTourStore.getState().startTour('auto')
    useTourStore.getState().startTour('auto')
    expect(posthog.capture).toHaveBeenLastCalledWith('tour_started', { trigger: 'auto', restart: true })
  })

  it('markStepViewed captures once per step per run', () => {
    useTourStore.getState().startTour('auto')
    vi.clearAllMocks()
    useTourStore.getState().markStepViewed(0)
    useTourStore.getState().markStepViewed(0) // StrictMode double-mount / Back revisit
    useTourStore.getState().markStepViewed(1)
    expect(posthog.capture).toHaveBeenCalledTimes(2)
    expect(posthog.capture).toHaveBeenCalledWith('tour_step_viewed', { step: 0, step_id: TOUR_STEPS[0].id })
    expect(posthog.capture).toHaveBeenCalledWith('tour_step_viewed', { step: 1, step_id: TOUR_STEPS[1].id })
  })

  it('startTour resets the viewed set for a fresh run', () => {
    useTourStore.getState().startTour('auto')
    useTourStore.getState().markStepViewed(0)
    useTourStore.getState().startTour('settings')
    vi.clearAllMocks()
    useTourStore.getState().markStepViewed(0)
    expect(posthog.capture).toHaveBeenCalledTimes(1)
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

  it('nextStep on the last step completes the tour with steps_shown', () => {
    useTourStore.getState().startTour('auto')
    useTourStore.getState().markStepViewed(0)
    useTourStore.getState().markStepViewed(1)
    useTourStore.setState({ step: TOUR_STEPS.length - 1 })
    useTourStore.getState().nextStep()
    expect(useTourStore.getState().active).toBe(false)
    expect(posthog.capture).toHaveBeenCalledWith('tour_completed', { steps_shown: 2, steps_total: TOUR_STEPS.length })
  })

  it('skipMissingStep advances without analytics noise', () => {
    useTourStore.getState().startTour('auto')
    vi.clearAllMocks()
    useTourStore.getState().skipMissingStep()
    expect(useTourStore.getState().step).toBe(1)
    expect(posthog.capture).not.toHaveBeenCalled()
  })

  it('skipMissingStep on the last step completes the tour — steps_shown exposes an all-skipped run', () => {
    useTourStore.getState().startTour('auto')
    useTourStore.setState({ step: TOUR_STEPS.length - 1 })
    useTourStore.getState().skipMissingStep()
    expect(useTourStore.getState().active).toBe(false)
    expect(hasFinishedTour()).toBe(true)
    // nothing was ever shown — the completion is visibly hollow in the funnel
    expect(posthog.capture).toHaveBeenCalledWith('tour_completed', { steps_shown: 0, steps_total: TOUR_STEPS.length })
  })

  it('startTour from Settings captures the settings trigger', () => {
    useTourStore.getState().startTour('settings')
    expect(useTourStore.getState().active).toBe(true)
    expect(posthog.capture).toHaveBeenCalledWith('tour_started', { trigger: 'settings', restart: false })
  })

  it('startTour resets to step 0 when replayed mid-state', () => {
    useTourStore.setState({ active: false, step: 3 })
    useTourStore.getState().startTour('settings')
    expect(useTourStore.getState().step).toBe(0)
    expect(useTourStore.getState().active).toBe(true)
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
    expect(posthog.capture).toHaveBeenCalledWith('tour_skipped', { step: 1, step_id: TOUR_STEPS[1].id, steps_shown: 0 })
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

  it('skipTour at step 0 (skippedAtStep = 0) still suppresses re-runs', () => {
    useTourStore.getState().startTour('auto')
    useTourStore.getState().skipTour()
    const saved = JSON.parse(localStorage.getItem('fl2_tour_state')!)
    expect(saved.skippedAtStep).toBe(0)
    // falsy 0 must not defeat the !== undefined check
    expect(hasFinishedTour()).toBe(true)
    expect(posthog.capture).toHaveBeenCalledWith('tour_skipped', { step: 0, step_id: TOUR_STEPS[0].id, steps_shown: 0 })
  })

  it('non-object JSON primitives in localStorage are treated as not finished', () => {
    localStorage.setItem('fl2_tour_state', 'null')
    expect(hasFinishedTour()).toBe(false)
    localStorage.setItem('fl2_tour_state', '5')
    expect(hasFinishedTour()).toBe(false)
  })

  it('localStorage write failure still suppresses via the athlete stamp', () => {
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation((key: string) => {
      if (key === 'fl2_tour_state') throw new Error('QuotaExceededError')
    })
    try {
      useTourStore.getState().startTour('auto')
      useTourStore.getState().completeTour()
      // local write failed silently...
      expect(localStorage.getItem('fl2_tour_state')).toBeNull()
      // ...but the synced athlete stamp still marks the tour finished
      expect(useAthleteStore.getState().athlete?.tourCompletedAt).toBeGreaterThan(0)
      expect(hasFinishedTour()).toBe(true)
      expect(posthog.capture).toHaveBeenCalledWith('tour_completed', expect.objectContaining({ steps_total: TOUR_STEPS.length }))
    } finally {
      spy.mockRestore()
    }
  })

  it('maybeAutoStartTour starts the tour for a truly-new user', () => {
    expect(maybeAutoStartTour({ races: 0, upcoming: 0 })).toBe('started')
    expect(useTourStore.getState().active).toBe(true)
    expect(posthog.capture).toHaveBeenCalledWith('tour_started', { trigger: 'auto', restart: false })
  })

  it('maybeAutoStartTour suppresses when the user has races', () => {
    expect(maybeAutoStartTour({ races: 3, upcoming: 0 })).toBe('suppressed')
    expect(maybeAutoStartTour({ races: 0, upcoming: 1 })).toBe('suppressed')
    expect(useTourStore.getState().active).toBe(false)
  })

  it('maybeAutoStartTour suppresses when the tour was already finished', () => {
    useTourStore.getState().startTour('auto')
    useTourStore.getState().completeTour()
    expect(maybeAutoStartTour({ races: 0, upcoming: 0 })).toBe('suppressed')
    expect(useTourStore.getState().active).toBe(false)
  })

  it('maybeAutoStartTour suppresses when a synced athlete stamp arrives', () => {
    useAthleteStore.setState({ athlete: { tourCompletedAt: 1234567890 } })
    expect(maybeAutoStartTour({ races: 0, upcoming: 0 })).toBe('suppressed')
  })

  it('maybeAutoStartTour is a no-op while the tour is already active', () => {
    useTourStore.getState().startTour('settings')
    useTourStore.getState().nextStep()
    expect(maybeAutoStartTour({ races: 0, upcoming: 0 })).toBe('suppressed')
    expect(useTourStore.getState().step).toBe(1) // not reset to 0
  })

  it('maybeAutoStartTour defers until the remote pull lands (profile-wipe guard)', () => {
    mockPullComplete.mockReturnValue(false)
    expect(maybeAutoStartTour({ races: 0, upcoming: 0 })).toBe('pull-pending')
    expect(useTourStore.getState().active).toBe(false)
    mockPullComplete.mockReturnValue(true)
    expect(maybeAutoStartTour({ races: 0, upcoming: 0 })).toBe('started')
  })

  it('finishing the tour before the pull lands writes localStorage but never stamps the athlete', () => {
    mockPullComplete.mockReturnValue(false)
    useTourStore.getState().startTour('settings')
    useTourStore.getState().completeTour()
    // local suppression works...
    expect(JSON.parse(localStorage.getItem('fl2_tour_state')!).completedAt).toBeGreaterThan(0)
    expect(hasFinishedTour()).toBe(true)
    // ...but no skeleton athlete was created (would win LWW and wipe the real profile)
    expect(useAthleteStore.getState().athlete).toBeNull()
  })

  it('completeTour after an earlier skip preserves skippedAtStep (merge semantics)', () => {
    useTourStore.getState().startTour('auto')
    useTourStore.getState().nextStep()
    useTourStore.getState().skipTour()
    // user replays from Settings and finishes this time
    useTourStore.getState().startTour('settings')
    useTourStore.getState().completeTour()
    const saved = JSON.parse(localStorage.getItem('fl2_tour_state')!)
    expect(saved.skippedAtStep).toBe(1)
    expect(saved.completedAt).toBeGreaterThan(0)
  })
})

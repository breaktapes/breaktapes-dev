import { create } from 'zustand'
import { posthog } from '@/lib/posthog'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { TOUR_STEPS } from '@/lib/tourSteps'

// Local finished-flag (per device). Cross-device suppression rides on
// athlete.tourCompletedAt, which syncs with the whole athlete object.
const LS_KEY = 'fl2_tour_state'

interface TourLocalState {
  completedAt?: number
  skippedAtStep?: number
}

function readLocal(): TourLocalState {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function writeLocal(state: TourLocalState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state))
  } catch {
    // quota exceeded — non-critical, athlete.tourCompletedAt still suppresses re-runs
  }
}

/** True when the tour was completed or skipped on this device or any synced device. */
export function hasFinishedTour(): boolean {
  const local = readLocal()
  if (local.completedAt || local.skippedAtStep !== undefined) return true
  return !!useAthleteStore.getState().athlete?.tourCompletedAt
}

function markFinished() {
  // Stamp the athlete so other devices never auto-start the tour again.
  // updateAthlete strips undefined, stamps updatedAt, and triggers sync.
  useAthleteStore.getState().updateAthlete({ tourCompletedAt: Date.now() })
}

export interface TourState {
  active: boolean
  step: number
  startTour: (trigger: 'auto' | 'settings') => void
  nextStep: () => void
  prevStep: () => void
  /** Advance past a step whose target element is absent — no analytics noise. */
  skipMissingStep: () => void
  skipTour: () => void
  completeTour: () => void
}

export const useTourStore = create<TourState>()((set, get) => ({
  active: false,
  step: 0,

  startTour: (trigger) => {
    set({ active: true, step: 0 })
    posthog.capture('tour_started', { trigger })
  },

  nextStep: () => {
    const { step } = get()
    if (step >= TOUR_STEPS.length - 1) {
      get().completeTour()
      return
    }
    set({ step: step + 1 })
  },

  prevStep: () => {
    const { step } = get()
    if (step > 0) set({ step: step - 1 })
  },

  skipMissingStep: () => {
    const { step } = get()
    if (step >= TOUR_STEPS.length - 1) {
      get().completeTour()
      return
    }
    set({ step: step + 1 })
  },

  skipTour: () => {
    const { step } = get()
    set({ active: false, step: 0 })
    writeLocal({ ...readLocal(), skippedAtStep: step })
    markFinished()
    posthog.capture('tour_skipped', { step, step_id: TOUR_STEPS[step]?.id })
  },

  completeTour: () => {
    set({ active: false, step: 0 })
    writeLocal({ ...readLocal(), completedAt: Date.now() })
    markFinished()
    posthog.capture('tour_completed')
  },
}))

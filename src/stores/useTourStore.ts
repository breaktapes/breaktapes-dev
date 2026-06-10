import { create } from 'zustand'
import { posthog } from '@/lib/posthog'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { isRemotePullComplete } from '@/lib/syncState'
import { TOUR_STEPS } from '@/lib/tourSteps'

// Local finished-flag (per device). Cross-device suppression rides on
// athlete.tourCompletedAt, which syncs with the whole athlete object.
const LS_KEY = 'fl2_tour_state'

interface TourLocalState {
  completedAt?: number
  skippedAtStep?: number
  /** Set on first tour_started — lets a mid-tour refresh report restart: true
   *  so the funnel can distinguish genuine first starts from re-entries. */
  startedAt?: number
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
  //
  // SAFETY: never stamp before the remote pull has landed. updateAthlete on a
  // null/skeleton athlete creates an object with a fresh updatedAt that wins
  // the whole-object LWW merge (applyRemoteSafe + stateMerge) and would wipe
  // the user's real profile on every device. The localStorage flag alone
  // suppresses re-runs on this device until a later finish re-stamps.
  if (!isRemotePullComplete()) return
  useAthleteStore.getState().updateAthlete({ tourCompletedAt: Date.now() })
}

/** Delay before the auto-start check so the remote-state pull can land first —
 *  an existing user on a fresh device briefly has 0 races until sync completes. */
export const TOUR_AUTOSTART_DELAY_MS = 1800

/** Auto-start gate: tour brand-new users only. Called from the Dashboard mount
 *  effect after TOUR_AUTOSTART_DELAY_MS. Returns 'started', 'suppressed', or
 *  'pull-pending' (remote state not yet landed — caller should retry). The
 *  pull gate is load-bearing: starting before the pull can tour an existing
 *  user AND lets a skip stamp a skeleton athlete (see markFinished). */
export function maybeAutoStartTour(
  raceCounts: { races: number; upcoming: number },
): 'started' | 'suppressed' | 'pull-pending' {
  if (!isRemotePullComplete()) return 'pull-pending'
  if (raceCounts.races > 0 || raceCounts.upcoming > 0) return 'suppressed'
  if (hasFinishedTour()) return 'suppressed'
  if (useTourStore.getState().active) return 'suppressed'
  useTourStore.getState().startTour('auto')
  return 'started'
}

export interface TourState {
  active: boolean
  step: number
  /** Step indices the user actually saw this run — drives tour_step_viewed
   *  dedup (Back revisits, StrictMode double-mounts) and steps_shown. */
  viewed: number[]
  startTour: (trigger: 'auto' | 'settings') => void
  /** Capture tour_step_viewed exactly once per step per tour run. Called by
   *  TourOverlay when a step actually renders (target resolved or no-target). */
  markStepViewed: (step: number) => void
  nextStep: () => void
  prevStep: () => void
  /** Advance past a step whose target element is absent. Same state change as
   *  nextStep — the overlay never showed the step, so there's nothing extra to do. */
  skipMissingStep: () => void
  skipTour: () => void
  completeTour: () => void
}

export const useTourStore = create<TourState>()((set, get) => ({
  active: false,
  step: 0,
  viewed: [],

  startTour: (trigger) => {
    const restart = readLocal().startedAt !== undefined
    set({ active: true, step: 0, viewed: [] })
    writeLocal({ ...readLocal(), startedAt: Date.now() })
    posthog.capture('tour_started', { trigger, restart })
  },

  markStepViewed: (step) => {
    const { viewed } = get()
    if (viewed.includes(step)) return
    set({ viewed: [...viewed, step] })
    posthog.capture('tour_step_viewed', { step, step_id: TOUR_STEPS[step]?.id })
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

  skipMissingStep: () => { get().nextStep() },

  skipTour: () => {
    const { step, viewed } = get()
    set({ active: false, step: 0 })
    writeLocal({ ...readLocal(), skippedAtStep: step })
    markFinished()
    posthog.capture('tour_skipped', { step, step_id: TOUR_STEPS[step]?.id, steps_shown: viewed.length })
  },

  completeTour: () => {
    const { viewed } = get()
    set({ active: false, step: 0 })
    writeLocal({ ...readLocal(), completedAt: Date.now() })
    markFinished()
    // steps_shown makes the funnel honest: a "completion" where most steps
    // auto-skipped (broken selectors) is visible as steps_shown < total.
    posthog.capture('tour_completed', { steps_shown: viewed.length, steps_total: TOUR_STEPS.length })
  },
}))

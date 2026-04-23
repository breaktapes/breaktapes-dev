// Widget data contract selectors
// These replace module-scoped globals: RACES, authUser, nextRace, athlete, etc.
// Each dashboard widget uses: const races = useRaceStore(selectRaces)
// Defined in Phase 2 — NOT discovered during Phase 4e implementation.

import type { RaceState } from './useRaceStore'
import type { AthleteState } from './useAthleteStore'
import type { AuthState } from './useAuthStore'
import type { DashState } from './useDashStore'

// Race store selectors
export const selectRaces          = (s: RaceState) => s.races
export const selectNextRace       = (s: RaceState) => s.nextRace
export const selectUpcomingRaces  = (s: RaceState) => s.upcomingRaces
export const selectWishlistRaces  = (s: RaceState) => s.wishlistRaces
export const selectFocusRaceId    = (s: RaceState) => s.focusRaceId
// Resolves focus race → falls back to nearest upcoming if no focus set
export const selectFocusRace      = (s: RaceState): import('@/types').Race | null => {
  if (s.focusRaceId) {
    const r = s.upcomingRaces.find(r => r.id === s.focusRaceId)
    if (r) return r
  }
  return s.nextRace
}

// Athlete store selectors
export const selectAthlete = (s: AthleteState) => s.athlete
export const selectSeasonPlans = (s: AthleteState) => s.seasonPlans

// Auth store selectors
export const selectAuthUser = (s: AuthState) => s.authUser
export const selectProAccess = (s: AuthState) => s.proAccessGranted

// Dash store selectors — return raw state (stable references, no new objects)
export const selectDashLayout = (s: DashState) => s.widgets
export const selectDashZoneCollapse = (s: DashState) => s.zoneCollapse

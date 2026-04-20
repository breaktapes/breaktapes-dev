import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Race } from '@/types'

export interface RaceState {
  races: Race[]
  upcomingRaces: Race[]
  wishlistRaces: Race[]
  nextRace: Race | null
  focusRaceId: string | null
  addRace: (race: Race) => void
  addUpcomingRace: (race: Race) => void
  autoMoveExpiredUpcoming: () => void
  updateRace: (id: string, patch: Partial<Race>) => void
  deleteRace: (id: string) => void
  setRaces: (races: Race[]) => void
  setUpcomingRaces: (races: Race[]) => void
  setWishlistRaces: (races: Race[]) => void
  promoteNextRace: () => void
  setFocusRaceId: (id: string | null) => void
  addToWishlist: (race: Race) => void
  removeFromWishlist: (id: string) => void
  moveToUpcoming: (id: string) => void
}

/** Returns YYYY-MM-DD in local time (not UTC). */
function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function findNextRace(upcoming: Race[]): Race | null {
  const today = localToday()
  const future = upcoming
    .filter(r => r.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
  return future[0] ?? null
}

export const useRaceStore = create<RaceState>()(
  persist(
    (set, get) => ({
      races: [],
      upcomingRaces: [],
      wishlistRaces: [],
      nextRace: null,
      focusRaceId: null,

      addRace: (race) => set(s => ({ races: [...s.races, race] })),

      addUpcomingRace: (race) => {
        set(s => ({ upcomingRaces: [...s.upcomingRaces, race] }))
        get().promoteNextRace()
      },

      autoMoveExpiredUpcoming: () => {
        const today = localToday()
        const { upcomingRaces, races } = get()
        const expired = upcomingRaces.filter(r => r.date < today)
        if (expired.length === 0) return
        set({
          races: [...races, ...expired],
          upcomingRaces: upcomingRaces.filter(r => r.date >= today),
        })
        get().promoteNextRace()
      },

      updateRace: (id, patch) => set(s => ({
        races: s.races.map(r => r.id === id ? { ...r, ...patch } : r),
        upcomingRaces: s.upcomingRaces.map(r => r.id === id ? { ...r, ...patch } : r),
        // Keep nextRace in sync — otherwise goal time / priority edits don't surface in dashboard widgets
        nextRace: s.nextRace?.id === id ? { ...s.nextRace, ...patch } : s.nextRace,
      })),

      deleteRace: (id) => set(s => ({
        races: s.races.filter(r => r.id !== id),
        upcomingRaces: s.upcomingRaces.filter(r => r.id !== id),
        // Clear focus if the focused race is deleted
        focusRaceId: s.focusRaceId === id ? null : s.focusRaceId,
      })),

      setFocusRaceId: (id) => set({ focusRaceId: id }),

      setRaces: (races) => set({ races }),

      setWishlistRaces: (wishlistRaces) => set({ wishlistRaces }),

      setUpcomingRaces: (upcomingRaces) => {
        set({ upcomingRaces })
        // Auto-promote nextRace from upcoming (regression fix: Session 13)
        get().promoteNextRace()
      },

      promoteNextRace: () => {
        const { nextRace, upcomingRaces } = get()
        const today = localToday()
        if (!nextRace || nextRace.date < today) {
          set({ nextRace: findNextRace(upcomingRaces) })
        }
      },

      addToWishlist: (race) => set(s => ({
        wishlistRaces: s.wishlistRaces.some(r => r.id === race.id)
          ? s.wishlistRaces
          : [...s.wishlistRaces, race],
      })),

      removeFromWishlist: (id) => set(s => ({
        wishlistRaces: s.wishlistRaces.filter(r => r.id !== id),
      })),

      moveToUpcoming: (id) => {
        const { wishlistRaces } = get()
        const race = wishlistRaces.find(r => r.id === id)
        if (!race) return
        set(s => ({ wishlistRaces: s.wishlistRaces.filter(r => r.id !== id) }))
        get().addUpcomingRace(race)
      },
    }),
    {
      name: 'fl2_races',  // must match existing localStorage key
      // Migrate old SPA format: raw array stored directly, not wrapped in {state:{...}}
      onRehydrateStorage: () => (state) => {
        if (!state) return

        // Migrate V1 SPA format: raw array stored directly (no Zustand wrapper)
        if (state.races.length === 0) {
          try {
            const raw = localStorage.getItem('fl2_races')
            if (raw) {
              const parsed = JSON.parse(raw)
              if (Array.isArray(parsed) && parsed.length > 0) {
                state.setRaces(parsed)
              }
            }
          } catch {}
        }

        // Migrate V1 upcoming races (stored separately as fl2_upcoming)
        if (state.upcomingRaces.length === 0) {
          try {
            const raw = localStorage.getItem('fl2_upcoming')
            if (raw) {
              const parsed = JSON.parse(raw)
              if (Array.isArray(parsed) && parsed.length > 0) {
                state.setUpcomingRaces(parsed)
              }
            }
          } catch {}
        }

        // Migrate V1 wishlist (stored separately as fl2_wishlist)
        if (state.wishlistRaces.length === 0) {
          try {
            const raw = localStorage.getItem('fl2_wishlist')
            if (raw) {
              const parsed = JSON.parse(raw)
              if (Array.isArray(parsed) && parsed.length > 0) {
                state.setWishlistRaces(parsed)
              }
            }
          } catch {}
        }

        // Migrate V1 focus race ID (stored as plain string, not JSON)
        if (!state.focusRaceId) {
          try {
            const raw = localStorage.getItem('fl2_focus_race_id')
            if (raw) state.setFocusRaceId(raw)
          } catch {}
        }

        // Auto-move any expired upcoming races to past on app load
        state.autoMoveExpiredUpcoming()
      },
    }
  ),
)

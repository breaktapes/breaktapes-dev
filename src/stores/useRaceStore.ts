import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Race } from '@/types'

export interface RaceState {
  races: Race[]
  upcomingRaces: Race[]
  wishlistRaces: Race[]
  nextRace: Race | null
  addRace: (race: Race) => void
  addUpcomingRace: (race: Race) => void
  autoMoveExpiredUpcoming: () => void
  updateRace: (id: string, patch: Partial<Race>) => void
  deleteRace: (id: string) => void
  setRaces: (races: Race[]) => void
  setUpcomingRaces: (races: Race[]) => void
  promoteNextRace: () => void
}

function findNextRace(upcoming: Race[]): Race | null {
  const today = new Date().toISOString().split('T')[0]
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

      addRace: (race) => set(s => ({ races: [...s.races, race] })),

      addUpcomingRace: (race) => {
        set(s => ({ upcomingRaces: [...s.upcomingRaces, race] }))
        get().promoteNextRace()
      },

      autoMoveExpiredUpcoming: () => {
        const today = new Date().toISOString().split('T')[0]
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
      })),

      deleteRace: (id) => set(s => ({
        races: s.races.filter(r => r.id !== id),
        upcomingRaces: s.upcomingRaces.filter(r => r.id !== id),
      })),

      setRaces: (races) => set({ races }),

      setUpcomingRaces: (upcomingRaces) => {
        set({ upcomingRaces })
        // Auto-promote nextRace from upcoming (regression fix: Session 13)
        get().promoteNextRace()
      },

      promoteNextRace: () => {
        const { nextRace, upcomingRaces } = get()
        const today = new Date().toISOString().split('T')[0]
        if (!nextRace || nextRace.date < today) {
          set({ nextRace: findNextRace(upcomingRaces) })
        }
      },
    }),
    {
      name: 'fl2_races',  // must match existing localStorage key
      // Migrate old SPA format: raw array stored directly, not wrapped in {state:{...}}
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // Migrate old SPA format: raw array stored directly
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
        // Auto-move any expired upcoming races to past on app load
        state.autoMoveExpiredUpcoming()
      },
    }
  ),
)

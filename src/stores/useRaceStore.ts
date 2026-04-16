import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Race } from '@/types'

export interface RaceState {
  races: Race[]
  upcomingRaces: Race[]
  wishlistRaces: Race[]
  nextRace: Race | null
  addRace: (race: Race) => void
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
        if (!state || state.races.length > 0) return
        try {
          const raw = localStorage.getItem('fl2_races')
          if (!raw) return
          const parsed = JSON.parse(raw)
          // Old SPA stored: [{id:"...",name:"...",...}, ...] (plain array, no "state" wrapper)
          if (Array.isArray(parsed) && parsed.length > 0) {
            state.setRaces(parsed)
          }
        } catch {}
      },
    }
  ),
)

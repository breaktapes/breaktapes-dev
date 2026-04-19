import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Athlete, SeasonPlan } from '@/types'

export interface AthleteState {
  athlete: Athlete | null
  seasonPlans: SeasonPlan[]
  setAthlete: (athlete: Athlete | null) => void
  updateAthlete: (partial: Partial<Athlete>) => void
  setSeasonPlans: (plans: SeasonPlan[]) => void
  addSeasonPlan: (plan: SeasonPlan) => void
  deleteSeasonPlan: (id: string) => void
}

export const useAthleteStore = create<AthleteState>()(
  persist(
    (set, get) => ({
      athlete: null,
      seasonPlans: [],

      setAthlete: (athlete) => set({ athlete }),

      updateAthlete: (partial) => {
        const current = get().athlete
        // Strip undefined values so existing data is never silently cleared.
        // To intentionally clear a field, callers must pass null or ''.
        const defined = Object.fromEntries(
          Object.entries(partial).filter(([, v]) => v !== undefined)
        ) as Partial<Athlete>
        if (!current) {
          set({ athlete: defined as Athlete })
        } else {
          set({ athlete: { ...current, ...defined } })
        }
      },

      setSeasonPlans: (seasonPlans) => set({ seasonPlans }),

      addSeasonPlan: (plan) => set(s => ({ seasonPlans: [...s.seasonPlans, plan] })),

      deleteSeasonPlan: (id) =>
        set(s => ({ seasonPlans: s.seasonPlans.filter(p => p.id !== id) })),
    }),
    {
      name: 'fl2_ath',  // must match existing localStorage key
      // Migrate old SPA format: raw athlete object stored at root, not wrapped in {state:{...}}
      onRehydrateStorage: () => (state) => {
        if (!state) return

        // Migrate V1 athlete object (stored directly, no Zustand wrapper)
        if (state.athlete === null) {
          try {
            const raw = localStorage.getItem('fl2_ath')
            if (raw) {
              const parsed = JSON.parse(raw)
              // Old SPA stored: {"firstName":"...","lastName":"...",...} (no "state" wrapper)
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && !('state' in parsed)) {
                if (parsed.firstName !== undefined || parsed.lastName !== undefined || parsed.mainSport !== undefined) {
                  state.setAthlete(parsed)
                }
              }
            }
          } catch {}
        }

        // Migrate V1 season plans (stored separately as fl2_season_plans)
        if (state.seasonPlans.length === 0) {
          try {
            const raw = localStorage.getItem('fl2_season_plans')
            if (raw) {
              const parsed = JSON.parse(raw)
              if (Array.isArray(parsed) && parsed.length > 0) {
                state.setSeasonPlans(parsed)
              }
            }
          } catch {}
        }
      },
    }
  ),
)

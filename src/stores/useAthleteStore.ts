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
        if (!current) {
          set({ athlete: partial as Athlete })
        } else {
          set({ athlete: { ...current, ...partial } })
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
        if (!state || state.athlete !== null) return
        try {
          const raw = localStorage.getItem('fl2_ath')
          if (!raw) return
          const parsed = JSON.parse(raw)
          // Old SPA stored: {"firstName":"...","lastName":"...",...} (no "state" wrapper)
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && !('state' in parsed)) {
            if (parsed.firstName !== undefined || parsed.lastName !== undefined || parsed.mainSport !== undefined) {
              state.setAthlete(parsed)
            }
          }
        } catch {}
      },
    }
  ),
)

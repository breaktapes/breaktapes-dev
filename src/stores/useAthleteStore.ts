import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Athlete, SeasonPlan } from '@/types'
import { syncStateToSupabase } from '@/lib/syncState'

export interface DistGoal {
  id: string
  dist: string        // e.g. "Half Marathon"
  targetSecs: number  // target finish time in seconds
  deadline?: string   // YYYY-MM-DD optional
}

export interface AnnualGoals {
  km?: number     // annual km target
  races?: number  // annual race count target
}

export interface GoalsState {
  annual: Record<string, AnnualGoals>   // year string → targets
  distGoals: DistGoal[]
}

export interface AthleteState {
  athlete: Athlete | null
  seasonPlans: SeasonPlan[]
  goals: GoalsState
  setAthlete: (athlete: Athlete | null) => void
  updateAthlete: (partial: Partial<Athlete>) => void
  setSeasonPlans: (plans: SeasonPlan[]) => void
  addSeasonPlan: (plan: SeasonPlan) => void
  deleteSeasonPlan: (id: string) => void
  setGoals: (goals: GoalsState) => void
  setAnnualGoal: (year: number, partial: Partial<AnnualGoals>) => void
  addDistGoal: (goal: Omit<DistGoal, 'id'>) => void
  deleteDistGoal: (id: string) => void
}

export const useAthleteStore = create<AthleteState>()(
  persist(
    (set, get) => ({
      athlete: null,
      seasonPlans: [],
      goals: { annual: {}, distGoals: [] },

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
        // Persist athlete edits — without this, username / isPublic / units
        // never reach Supabase, and the user_state row is never seeded for
        // users whose only mutation has been to their profile.
        void syncStateToSupabase()
      },

      setSeasonPlans: (seasonPlans) => set({ seasonPlans }),

      addSeasonPlan: (plan) => {
        set(s => ({ seasonPlans: [...s.seasonPlans, plan] }))
        void syncStateToSupabase()
      },

      deleteSeasonPlan: (id) => {
        set(s => ({ seasonPlans: s.seasonPlans.filter(p => p.id !== id) }))
        void syncStateToSupabase()
      },

      setGoals: (goals) => set({ goals }),

      setAnnualGoal: (year, partial) =>
        set(s => ({
          goals: {
            ...s.goals,
            annual: { ...s.goals.annual, [String(year)]: { ...s.goals.annual[String(year)], ...partial } },
          },
        })),

      addDistGoal: (goal) =>
        set(s => ({
          goals: {
            ...s.goals,
            distGoals: [...s.goals.distGoals, { ...goal, id: crypto.randomUUID() }],
          },
        })),

      deleteDistGoal: (id) =>
        set(s => ({
          goals: { ...s.goals, distGoals: s.goals.distGoals.filter(g => g.id !== id) },
        })),
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

        // Migrate V1 goals (stored separately as fl2_goals)
        const goalsEmpty = !state.goals || (!Object.keys(state.goals.annual ?? {}).length && !(state.goals.distGoals ?? []).length)
        if (goalsEmpty) {
          try {
            const raw = localStorage.getItem('fl2_goals')
            if (raw) {
              const parsed = JSON.parse(raw)
              if (parsed && typeof parsed === 'object') {
                const distGoals: DistGoal[] = (parsed.distGoals ?? []).map((g: Record<string, unknown>) => ({
                  id: crypto.randomUUID(),
                  dist: String(g.dist ?? ''),
                  targetSecs: Number(g.targetSecs ?? 0),
                  deadline: g.deadline ? String(g.deadline) : undefined,
                }))
                state.setGoals({ annual: parsed.annual ?? {}, distGoals })
              }
            }
          } catch {}
        }
      },
    }
  ),
)

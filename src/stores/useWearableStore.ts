import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WearableToken } from '@/types'

interface WhoopActivity {
  id: string
  sport_id: number
  start: string
  end?: string
  strain?: number
  kilojoules?: number
}

interface WhoopRecovery {
  cycle_id: number
  created_at: string
  updated_at: string
  score?: {
    recovery_score: number
    resting_heart_rate?: number
    hrv_rmssd_milli?: number
    sleep_needed?: { baseline_milli: number }
  }
}

interface GarminActivity {
  activityId: number
  activityName: string
  startTimeGmt: string
  activityType: { typeKey: string }
  distance?: number
  duration?: number
  averageHR?: number
}

interface AppleHealthSummary {
  totalWorkouts: number
  totalSteps: number
  lastSyncDate: string
}

interface WearableState {
  whoopToken: WearableToken | null
  garminToken: WearableToken | null
  stravaToken: WearableToken | null
  whoopActivities: WhoopActivity[]
  whoopRecovery: WhoopRecovery[]
  garminActivities: GarminActivity[]
  appleHealthSummary: AppleHealthSummary | null
  setToken: (provider: WearableToken['provider'], token: WearableToken | null) => void
  setWhoopActivities: (activities: WhoopActivity[]) => void
  setWhoopRecovery: (recovery: WhoopRecovery[]) => void
  setGarminActivities: (activities: GarminActivity[]) => void
  setAppleHealthSummary: (summary: AppleHealthSummary | null) => void
  clearToken: (provider: WearableToken['provider']) => void
}

export const useWearableStore = create<WearableState>()(
  persist(
    (set) => ({
      whoopToken: null,
      garminToken: null,
      stravaToken: null,
      whoopActivities: [],
      whoopRecovery: [],
      garminActivities: [],
      appleHealthSummary: null,

      setToken: (provider, token) => {
        if (provider === 'whoop')  set({ whoopToken: token })
        if (provider === 'garmin') set({ garminToken: token })
        if (provider === 'strava') set({ stravaToken: token })
      },

      setWhoopActivities: (whoopActivities) => set({ whoopActivities }),
      setWhoopRecovery: (whoopRecovery) => set({ whoopRecovery }),
      setGarminActivities: (garminActivities) => set({ garminActivities }),
      setAppleHealthSummary: (appleHealthSummary) => set({ appleHealthSummary }),

      clearToken: (provider) => {
        if (provider === 'whoop')  set({ whoopToken: null, whoopActivities: [], whoopRecovery: [] })
        if (provider === 'garmin') set({ garminToken: null, garminActivities: [] })
        if (provider === 'strava') set({ stravaToken: null })
      },
    }),
    {
      name: 'fl2_strava',  // must match existing localStorage key (primary wearable key)
      // The original code also used fl2_whoop and fl2_garmin as separate keys.
      // We consolidate here — the key name is for the merged store.
      // TODO Phase 2: verify if split keys are needed for compatibility with existing data.
    },
  ),
)

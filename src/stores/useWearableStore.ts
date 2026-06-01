import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WearableToken } from '@/types'
import type { OWWorkout, OWRecovery, OWConnection } from '@/lib/openWearables'

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
  // Legacy per-provider tokens (Strava still uses direct OAuth)
  whoopToken: WearableToken | null
  garminToken: WearableToken | null
  stravaToken: WearableToken | null
  stravaExpired: boolean
  whoopActivities: WhoopActivity[]
  whoopRecovery: WhoopRecovery[]
  garminActivities: GarminActivity[]
  appleHealthSummary: AppleHealthSummary | null

  // Open Wearables unified layer
  owUserId: string | null
  owWorkouts: OWWorkout[]
  owRecovery: OWRecovery[]
  owConnections: OWConnection[]

  // Legacy actions
  setToken: (provider: WearableToken['provider'], token: WearableToken | null) => void
  setStravaExpired: (expired: boolean) => void
  setWhoopActivities: (activities: WhoopActivity[]) => void
  setWhoopRecovery: (recovery: WhoopRecovery[]) => void
  setGarminActivities: (activities: GarminActivity[]) => void
  setAppleHealthSummary: (summary: AppleHealthSummary | null) => void
  clearToken: (provider: WearableToken['provider']) => void

  // OW actions
  setOwUserId: (id: string | null) => void
  setOwWorkouts: (workouts: OWWorkout[]) => void
  setOwRecovery: (recovery: OWRecovery[]) => void
  setOwConnections: (connections: OWConnection[]) => void
}

export const useWearableStore = create<WearableState>()(
  persist(
    (set) => ({
      whoopToken: null,
      garminToken: null,
      stravaToken: null,
      stravaExpired: false,
      whoopActivities: [],
      whoopRecovery: [],
      garminActivities: [],
      appleHealthSummary: null,

      owUserId: null,
      owWorkouts: [],
      owRecovery: [],
      owConnections: [],

      setToken: (provider, token) => {
        if (provider === 'whoop')  set({ whoopToken: token })
        if (provider === 'garmin') set({ garminToken: token })
        if (provider === 'strava') set({ stravaToken: token, stravaExpired: false })
      },

      setStravaExpired: (expired) => set({ stravaExpired: expired }),

      setWhoopActivities: (whoopActivities) => set({ whoopActivities }),
      setWhoopRecovery: (whoopRecovery) => set({ whoopRecovery }),
      setGarminActivities: (garminActivities) => set({ garminActivities }),
      setAppleHealthSummary: (appleHealthSummary) => set({ appleHealthSummary }),

      clearToken: (provider) => {
        if (provider === 'whoop')  set({ whoopToken: null, whoopActivities: [], whoopRecovery: [] })
        if (provider === 'garmin') set({ garminToken: null, garminActivities: [] })
        if (provider === 'strava') set({ stravaToken: null })
      },

      setOwUserId: (owUserId) => set({ owUserId }),
      setOwWorkouts: (owWorkouts) => set({ owWorkouts }),
      setOwRecovery: (owRecovery) => set({ owRecovery }),
      setOwConnections: (owConnections) => set({ owConnections }),
    }),
    {
      name: 'fl2_strava',  // existing localStorage key — stable across versions
    },
  ),
)

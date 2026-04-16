// Wearable API response types — used by lib/whoop.ts, lib/garmin.ts, Train.tsx

export interface WhoopActivity {
  id: string | number
  sport_id: number
  start: string
  end?: string
  strain?: number
  score?: {
    average_heart_rate?: number
    max_heart_rate?: number
    distance_meter?: number
  }
}

export interface WhoopRecovery {
  id: string | number
  score?: {
    recovery_score: number
    hrv_rmssd_milli?: number
    resting_heart_rate?: number
  }
  created_at: string
}

export interface GarminActivity {
  activityId: number
  activityName?: string
  startTimeGmt: string
  activityType?: { typeKey: string }
  distance?: number
  duration?: number
  averageHR?: number
}

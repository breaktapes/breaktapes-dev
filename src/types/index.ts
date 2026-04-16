// =============================================
// BREAKTAPES — Core TypeScript Types
// Extracted from index.html data shapes
// =============================================

export interface Race {
  id: string
  name: string
  date: string           // YYYY-MM-DD
  city: string
  country: string
  distance: string       // e.g. "42.2", "21.1", "10"
  distanceUnit?: string  // "km" | "mi"
  sport: string          // "running" | "triathlon" | "cycling" | "swim" | "hyrox"
  time?: string          // "HH:MM:SS"
  placing?: string       // "342/5000" or "3rd AG"
  medal?: string         // "gold" | "silver" | "bronze" | "finisher"
  medalPhoto?: string    // URL
  splits?: Split[]
  elevation?: number
  surface?: string       // "road" | "trail" | "track"
  weather?: RaceWeather
  notes?: string
  isArace?: boolean
  priority?: 'A' | 'B' | 'C'
  goalTime?: string
  bibNumber?: string
  lat?: number
  lng?: number
}

export interface Split {
  label: string   // "5K", "10K", "T1", "Swim", etc.
  split?: string  // split time HH:MM:SS
  cumulative?: string
}

export interface RaceWeather {
  temp?: number
  condition?: string
  humidity?: number
  wind?: number
}

export interface Athlete {
  firstName?: string
  lastName?: string
  dob?: string          // YYYY-MM-DD
  gender?: string       // "M" | "F" | "NB"
  club?: string
  city?: string
  country?: string
  bio?: string
  focusRace?: string    // race id
  mainSport?: string
  weeklyKm?: number
  username?: string
  isPublic?: boolean
}

export interface WearableToken {
  provider: 'whoop' | 'garmin' | 'strava' | 'coros' | 'oura'
  access_token: string
  refresh_token?: string
  expires_at?: number   // unix timestamp
}

export interface DashWidget {
  id: string
  label: string
  icon: string
  zone: 'now' | 'recently' | 'trending' | 'context'
  enabled: boolean
  pro?: boolean
}

export interface DashZoneCollapse {
  now: boolean
  recently: boolean
  trending: boolean
  context: boolean
}

export interface SeasonPlan {
  id: string            // UUID (crypto.randomUUID())
  name: string
  items: SeasonPlanItem[]
  createdAt: string     // ISO timestamp
}

export interface SeasonPlanItem {
  raceId: string
  priority: 'A' | 'B' | 'C'
  goalTime?: string
  goalPace?: string
  trainingBlockLabel?: string
  taperDays?: number
  recoveryDays?: number
}

export type ThemeId =
  | 'carbon'
  | 'light'
  | 'deep-space'
  | 'race-night'
  | 'obsidian'
  | 'acid-track'
  | 'titanium'
  | 'ember'
  | 'polar-circuit'

export interface Theme {
  id: ThemeId
  label: string
  pro: boolean
}

export const THEMES: Theme[] = [
  { id: 'carbon',        label: 'Carbon + Chrome', pro: false },
  { id: 'light',         label: 'Light Mode',      pro: false },
  { id: 'deep-space',    label: 'Deep Space',      pro: true  },
  { id: 'race-night',    label: 'Race Night',       pro: true  },
  { id: 'obsidian',      label: 'Obsidian',         pro: true  },
  { id: 'acid-track',    label: 'Acid Track',       pro: true  },
  { id: 'titanium',      label: 'Titanium',         pro: true  },
  { id: 'ember',         label: 'Ember',            pro: true  },
  { id: 'polar-circuit', label: 'Polar Circuit',    pro: true  },
]

export interface PBMap {
  [distanceKey: string]: Race
}

export interface PlacingResult {
  pos: number
  total: number
  percentile: number
}

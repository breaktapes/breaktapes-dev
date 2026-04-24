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
  placing?: string       // overall placing — "342/5000"
  genderPlacing?: string // gender placing — "47/2400"
  agPlacing?: string     // age-group placing value — "3/120"
  agLabel?: string       // age-group label — "M30-34"
  medal?: string         // "gold" | "silver" | "bronze" | "finisher"
  medalPhoto?: string    // URL
  splits?: Split[]
  elevation?: number
  surface?: string       // "road" | "trail" | "track"
  weather?: RaceWeather
  notes?: string
  isArace?: boolean
  priority?: 'A' | 'B' | 'C'
  outcome?: string          // "Finished" | "DNF" | "DSQ" | "DNS"
  goalTime?: string
  bibNumber?: string
  lat?: number
  lng?: number
  strava_id?: number    // Strava activity ID — used to de-duplicate imports
  gear?: string[]       // race day gear checklist items (custom items only)
  packedGear?: string[] // items checked off as packed
  photos?: string[]     // race day / finish line photos (compressed base64 data URLs)
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
  usernameSetAt?: string  // ISO timestamp — username locked for 1 year after this
  isPublic?: boolean
  units?: 'metric' | 'imperial'  // distance + pace display preference (default: metric)
  profileVisibility?: {
    races?: boolean       // race history & finish times (default true)
    pbs?: boolean         // personal bests (default true)
    medals?: boolean      // medal wall (default true)
    upcoming?: boolean    // upcoming races (default false)
    stats?: boolean       // overall stats & countries (default true)
    wearables?: boolean   // wearable activity feed (default false)
  }
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
  comingSoon?: boolean
}

export const THEMES: Theme[] = [
  { id: 'carbon',        label: 'Carbon + Chrome', pro: false },
  { id: 'light',         label: 'Light Mode',      pro: false },
  { id: 'deep-space',    label: 'Deep Space',      pro: false },
  { id: 'race-night',    label: 'Race Night',      pro: false },
  { id: 'obsidian',      label: 'Obsidian',        pro: false },
  { id: 'acid-track',    label: 'Acid Track',      pro: false, comingSoon: true },
  { id: 'titanium',      label: 'Titanium',        pro: false },
  { id: 'ember',         label: 'Ember',           pro: false, comingSoon: true },
  { id: 'polar-circuit', label: 'Polar Circuit',   pro: false, comingSoon: true },
]

export interface PBMap {
  [distanceKey: string]: Race
}

export interface PlacingResult {
  pos: number
  total: number
  percentile: number
}

// =============================================
// BREAKTAPES — Core TypeScript Types
// Extracted from index.html data shapes
// =============================================

export interface Race {
  id: string
  /** Epoch ms of the last local mutation. Drives cross-device last-write-wins
   *  merge. Absent on legacy races (predates the feature) — treated as oldest. */
  updatedAt?: number
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
  medal?: string         // "gold" | "silver" | "bronze" | "finisher" | "custom"
  medalPhoto?: string    // URL
  splits?: Split[]
  elevation?: number
  surface?: string       // "road" | "trail" | "track" | "desert" | "coastal"
  weather?: RaceWeather
  notes?: string
  isArace?: boolean
  priority?: 'A' | 'B' | 'C'
  outcome?: string          // "Finished" | "DNF" | "DSQ" | "DNS"
  goalTime?: string
  startTime?: string        // race-day wall-clock start time "HH:MM" or "HH:MM:SS" (local race-city time)
  bibNumber?: string
  roleAtRace?: 'runner' | 'pacer' | 'guide'  // role the athlete played at this race
  lat?: number
  lng?: number
  strava_id?: number    // Strava activity ID — used to de-duplicate imports
  gear?: string[]       // race day gear checklist items (custom items only)
  packedGear?: string[] // items checked off as packed
  photos?: string[]     // race day / finish line photos (compressed base64 data URLs)
  avgHeartRate?: number  // average HR in bpm
  terrain?: string       // "flat" | "rolling" | "hilly" | "mountainous"
  shoe?: string          // shoe / kit worn
  hyroxPartner?: string  // username of doubles partner (HYROX only)
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
  /** Epoch ms of the last local profile edit — cross-device last-write-wins. */
  updatedAt?: number
  firstName?: string
  lastName?: string
  dob?: string          // YYYY-MM-DD
  gender?: string       // "M" | "F" | "NB"
  club?: string
  clubs?: string[]
  clubJoinDates?: Record<string, string>  // club name → YYYY-MM-DD join date
  city?: string
  country?: string
  bio?: string
  focusRace?: string    // race id
  mainSport?: string
  weeklyKm?: number
  username?: string
  injuryBreakStart?: string  // YYYY-MM-DD — start of injury break
  injuryBreakEnd?: string    // YYYY-MM-DD — end of injury break (comeback_run unlocks for races after this)
  usernameSetAt?: string  // ISO timestamp — username locked for 1 year after this
  isPublic?: boolean
  imageUrl?: string              // Clerk profile photo URL — synced on login
  units?: 'metric' | 'imperial'  // distance + pace display preference (default: metric)
  emailOptIn?: boolean           // race reminders + weekly digest emails (default: true / on)
  pbHiddenKeys?: string[]        // PB distance keys hidden via the ⚙ EDIT button on the You page
  owUserId?: string              // Open Wearables user ID — set once on first OW connection
  tourCompletedAt?: number       // epoch ms — onboarding tour finished/skipped; suppresses auto-start on every device
  profileVisibility?: {
    races?: boolean       // race history & finish times (default true)
    pbs?: boolean         // personal bests (default true)
    medals?: boolean      // medal wall (default true)
    upcoming?: boolean    // upcoming races (default false)
    stats?: boolean       // overall stats & countries (default true)
    wearables?: boolean   // wearable activity feed (default false)
  }
}

export type InjuryBodyPart =
  | 'achilles' | 'ankle' | 'knee' | 'it_band' | 'hip' | 'hamstring'
  | 'calf' | 'shin' | 'foot' | 'plantar' | 'lower_back' | 'shoulder'
  | 'quad' | 'groin' | 'other'

export type InjuryType =
  | 'tendinopathy' | 'stress_fracture' | 'muscle_strain' | 'ligament_sprain'
  | 'bursitis' | 'it_band_syndrome' | 'plantar_fasciitis' | 'shin_splints'
  | 'stress_reaction' | 'overuse' | 'other'

export type InjuryPhase =
  | 'rest'           // Not training — rest only
  | 'cross_training' // Pool, bike, elliptical — no impact
  | 'building'       // Walk-jog, gradual load
  | 'training'       // Structured runs, no race goals
  | 'racing'         // Cleared for race starts
  | 'resolved'       // Back to normal

export const INJURY_PHASES: { key: InjuryPhase; label: string }[] = [
  { key: 'rest',           label: 'Rest' },
  { key: 'cross_training', label: 'Cross-training' },
  { key: 'building',       label: 'Building' },
  { key: 'training',       label: 'Training' },
  { key: 'racing',         label: 'Racing' },
  { key: 'resolved',       label: 'Resolved' },
]

export const INJURY_BODY_PARTS: { key: InjuryBodyPart; label: string }[] = [
  { key: 'achilles',   label: 'Achilles (Achilles tendon)' },
  { key: 'ankle',      label: 'Ankle' },
  { key: 'knee',       label: 'Knee (patella)' },
  { key: 'it_band',    label: 'IT Band (iliotibial band)' },
  { key: 'hip',        label: 'Hip' },
  { key: 'hamstring',  label: 'Hamstring (biceps femoris)' },
  { key: 'calf',       label: 'Calf (gastrocnemius)' },
  { key: 'shin',       label: 'Shin (tibia)' },
  { key: 'foot',       label: 'Foot' },
  { key: 'plantar',    label: 'Plantar (plantar fascia)' },
  { key: 'lower_back', label: 'Lower Back (lumbar spine)' },
  { key: 'shoulder',   label: 'Shoulder (rotator cuff)' },
  { key: 'quad',       label: 'Quad (quadriceps)' },
  { key: 'groin',      label: 'Groin (adductor)' },
  { key: 'other',      label: 'Other' },
]

export const INJURY_TYPES: { key: InjuryType; label: string }[] = [
  { key: 'tendinopathy',      label: 'Tendinopathy' },
  { key: 'stress_fracture',   label: 'Stress fracture' },
  { key: 'muscle_strain',     label: 'Muscle strain' },
  { key: 'ligament_sprain',   label: 'Ligament sprain' },
  { key: 'bursitis',          label: 'Bursitis' },
  { key: 'it_band_syndrome',  label: 'IT band syndrome' },
  { key: 'plantar_fasciitis', label: 'Plantar fasciitis' },
  { key: 'shin_splints',      label: 'Shin splints' },
  { key: 'stress_reaction',   label: 'Stress reaction' },
  { key: 'overuse',           label: 'Overuse' },
  { key: 'other',             label: 'Other' },
]

export interface Injury {
  id: string
  createdAt: string                  // YYYY-MM-DD
  bodyPart: InjuryBodyPart
  injuryType: InjuryType
  severity: 'mild' | 'moderate' | 'severe'
  phase: InjuryPhase
  startDate: string                  // YYYY-MM-DD
  returnDate?: string                // YYYY-MM-DD — physio's target (user-entered)
  notes?: string
  resolved: boolean
}

export interface WearableToken {
  provider: 'whoop' | 'garmin' | 'strava' | 'coros' | 'oura'
  access_token: string
  refresh_token?: string
  expires_at?: number   // unix timestamp
  profile?: Record<string, any>
}

export type WidgetSize = 'small' | 'medium' | 'large'

export interface DashWidget {
  id: string
  label: string
  icon: string
  zone: 'now' | 'recently' | 'trending' | 'context'  // metadata only — not used for layout order
  enabled: boolean
  pro?: boolean
  size: WidgetSize  // user-set, default: 'medium'
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

// V4 §10b — 2 free + 7 Pro. CSS for all 9 themes lives in styles/tokens.css.
// Staging unlocks Pro via IS_STAGING in useAuthStore.
export const THEMES: Theme[] = [
  { id: 'carbon',        label: 'Carbon + Chrome', pro: false },
  { id: 'light',         label: 'Light Mode',      pro: false },
  { id: 'deep-space',    label: 'Deep Space',      pro: true  },
  { id: 'race-night',    label: 'Race Night',      pro: true  },
  { id: 'obsidian',      label: 'Obsidian',        pro: true  },
  { id: 'titanium',      label: 'Titanium',        pro: true  },
  { id: 'acid-track',    label: 'Acid Track',      pro: true  },
  { id: 'ember',         label: 'Ember',           pro: true  },
  { id: 'polar-circuit', label: 'Polar Circuit',   pro: true  },
]

export interface PBMap {
  [distanceKey: string]: Race
}

export interface PlacingResult {
  pos: number
  total: number
  percentile: number
}

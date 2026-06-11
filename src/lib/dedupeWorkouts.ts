/**
 * Cross-provider workout dedupe.
 *
 * A user who connects both WHOOP and Strava (and especially one who also uses
 * WHOOP's own Strava push) sees the same workout 2-3× in the unified OW feed.
 * Two workouts are considered the same physical session when their start times
 * are within START_WINDOW_MS and their durations are within DURATION_TOLERANCE
 * of each other.
 *
 * On collision we keep the richest record (distance > name > anything) and fold
 * the missing metrics (heart rate, distance, name) in from the duplicates. All
 * contributing providers are reported in `sources` so the UI can badge them.
 */

import type { OWProvider, OWWorkout } from '@/lib/openWearables'

export interface MergedWorkout extends OWWorkout {
  sources: OWProvider[]
}

const START_WINDOW_MS = 5 * 60 * 1000 // ±5 min
const DURATION_TOLERANCE = 0.10       // ±10%

// Providers more likely to carry GPS distance + a meaningful activity name win
// the base-record election on an otherwise equal-richness tie.
const PROVIDER_PRIORITY: Record<string, number> = {
  strava: 0, garmin: 1, suunto: 2, polar: 3, fitbit: 4, ultrahuman: 5, whoop: 6,
}

function richness(w: OWWorkout): number {
  let score = 0
  if (w.distance_meters) score += 4
  if (w.name) score += 2
  if (w.average_heart_rate) score += 1
  return score
}

// Bucket messy provider sport labels ("running" vs "Run" vs "jog") so the
// sport check below doesn't block real duplicates over naming differences.
function sportBucket(sport: string): string | null {
  const s = (sport ?? '').toLowerCase()
  if (!s) return null // unknown — don't block a merge on it
  if (s.includes('run') || s.includes('jog')) return 'run'
  if (s.includes('cycl') || s.includes('bike') || s.includes('ride')) return 'bike'
  if (s.includes('swim')) return 'swim'
  if (s.includes('tri')) return 'tri'
  if (s.includes('hike') || s.includes('walk')) return 'walk'
  if (s.includes('strength') || s.includes('weight') || s.includes('lift')) return 'strength'
  return null // unrecognized label — treat as unknown
}

function isSameSession(a: OWWorkout, b: OWWorkout): boolean {
  const startA = Date.parse(a.started_at)
  const startB = Date.parse(b.started_at)
  if (!Number.isFinite(startA) || !Number.isFinite(startB)) return false
  if (Math.abs(startA - startB) > START_WINDOW_MS) return false
  // Two clearly different sports are never the same session, even with
  // matching times (e.g. WHOOP auto-detects "weightlifting" while Strava
  // records the actual ride). Unknown/unrecognized sports don't block.
  const sA = sportBucket(a.sport_type)
  const sB = sportBucket(b.sport_type)
  if (sA && sB && sA !== sB) return false
  const dA = a.duration_seconds
  const dB = b.duration_seconds
  if (!dA || !dB) return true // start-time match alone is enough when a duration is missing
  const longer = Math.max(dA, dB)
  return Math.abs(dA - dB) / longer <= DURATION_TOLERANCE
}

function pickBase(group: OWWorkout[]): OWWorkout {
  return group.reduce((best, w) => {
    const rw = richness(w)
    const rb = richness(best)
    if (rw !== rb) return rw > rb ? w : best
    const pw = PROVIDER_PRIORITY[w.provider] ?? 99
    const pb = PROVIDER_PRIORITY[best.provider] ?? 99
    return pw < pb ? w : best
  })
}

/**
 * Collapse duplicate workouts across providers. Input order is preserved by
 * each group's earliest position; output keeps the feed's newest-first order
 * as long as the input is sorted that way.
 */
export function dedupeWorkouts(workouts: OWWorkout[]): MergedWorkout[] {
  const groups: OWWorkout[][] = []
  for (const w of workouts) {
    // Anchor matching to each group's FIRST member, not any member —
    // otherwise groups chain transitively (A↔B, B↔C merges A with C even
    // though A and C are outside the window of each other).
    const group = groups.find(g => isSameSession(g[0], w))
    if (group) group.push(w)
    else groups.push([w])
  }
  return groups.map(group => {
    const base = pickBase(group)
    const sources = [...new Set(group.map(w => w.provider))]
      .sort((a, b) => (PROVIDER_PRIORITY[a] ?? 99) - (PROVIDER_PRIORITY[b] ?? 99))
    const merged: MergedWorkout = { ...base, sources }
    for (const w of group) {
      if (w === base) continue
      if (!merged.distance_meters && w.distance_meters) merged.distance_meters = w.distance_meters
      if (!merged.average_heart_rate && w.average_heart_rate) merged.average_heart_rate = w.average_heart_rate
      if (!merged.name && w.name) merged.name = w.name
      if (!merged.duration_seconds && w.duration_seconds) merged.duration_seconds = w.duration_seconds
    }
    return merged
  })
}

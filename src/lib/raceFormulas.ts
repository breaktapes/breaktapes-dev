// ─── BREAKTAPES Race Formula Library ──────────────────────────────────────────
// Pure functions — no React, no imports except types.
// All timing in seconds. All distances in km.

import type { Race, Athlete } from '@/types'

// ─── Low-level helpers ────────────────────────────────────────────────────────

export function parseTimeSecs(time: string | undefined): number | null {
  if (!time) return null
  const parts = time.trim().split(':').map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
}

const DIST_KM_MAP: Record<string, number> = {
  marathon: 42.195, 'full marathon': 42.195,
  'half marathon': 21.0975, half: 21.0975,
  ironman: 226, 'full ironman': 226,
  'half ironman': 113, '70.3': 113,
  olympic: 51.5, 'olympic triathlon': 51.5,
  sprint: 25.75, 'sprint triathlon': 25.75,
  '5k': 5, '10k': 10, '15k': 15, '20k': 20, '25k': 25,
  '30k': 30, '50k': 50, '60k': 60, '80k': 80, '90k': 90,
  '100k': 100, '160k': 160,
  '50mi': 80.47, '100mi': 160.93,
  ultra: 50, ultramarathon: 50,
  mile: 1.609, '1 mile': 1.609, '5 mile': 8.047, '10 mile': 16.09,
}

export function parseDistKm(d: string | undefined): number {
  if (!d) return 0
  const n = parseFloat(d)
  if (!isNaN(n) && n > 0) return n
  return DIST_KM_MAP[d.toLowerCase().trim()] ?? 0
}

export function secsToHMS(secs: number): string {
  const s = Math.max(0, Math.round(secs))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

function fmtPace(secPerKm: number, units: 'metric' | 'imperial'): string {
  const s = units === 'imperial' ? secPerKm * 1.60934 : secPerKm
  const m = Math.floor(s / 60)
  const ss = Math.round(s % 60)
  return `${m}:${String(ss).padStart(2, '0')} /${units === 'imperial' ? 'mi' : 'km'}`
}

const RUNNING_SPORTS = /^(running|trail|road|cross.?country|track|fell|mountain run)/i

function isRunningRace(r: Race): boolean {
  const s = (r.sport ?? 'Running').toLowerCase()
  return RUNNING_SPORTS.test(s) && !s.includes('tri') && !s.includes('duathlon') &&
    !s.includes('cycl') && !s.includes('bike') && !s.includes('swim')
}

// Best running race: most recent PB effort (best pace for its distance, ties broken by date desc)
function bestRaceByDistance(races: Race[]): Race | null {
  const running = races.filter(
    r => isRunningRace(r) && r.time && parseDistKm(r.distance) > 0 &&
      r.outcome !== 'DNF' && r.outcome !== 'DNS' && r.outcome !== 'DSQ'
  )
  if (!running.length) return null

  // Build per-distance PB map (best sec/km for each distance bucket)
  const pbPace = new Map<number, number>()
  for (const r of running) {
    const d = parseDistKm(r.distance)
    const t = parseTimeSecs(r.time)!
    const pace = t / d
    const existing = pbPace.get(d)
    if (existing === undefined || pace < existing) pbPace.set(d, pace)
  }

  // Keep only races that are PBs at their distance, then pick most recent
  const pbRaces = running.filter(r => {
    const d = parseDistKm(r.distance)
    const t = parseTimeSecs(r.time)!
    return Math.abs(t / d - pbPace.get(d)!) < 0.01
  })

  return pbRaces.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
}

// ─── Riegel Predictor ─────────────────────────────────────────────────────────
// T2 = T1 × (D2/D1)^1.06

export function riegelPredict(
  knownTimeSecs: number,
  knownDistKm: number,
  targetDistKm: number,
): number {
  return knownTimeSecs * Math.pow(targetDistKm / knownDistKm, 1.06)
}

export const RIEGEL_DISTANCES = [
  { label: '5K',            km: 5 },
  { label: '10K',           km: 10 },
  { label: 'Half Marathon', km: 21.0975 },
  { label: 'Marathon',      km: 42.195 },
  { label: '50K',           km: 50 },
  { label: '100K',          km: 100 },
]

export interface RiegelRow {
  distance: string
  distKm: number
  predictedSecs: number
  predictedTime: string
  isSameAsInput: boolean
}

export function riegelTable(race: Race): RiegelRow[] | null {
  const timeSecs = parseTimeSecs(race.time)
  const distKm   = parseDistKm(race.distance)
  if (!timeSecs || !distKm) return null
  return RIEGEL_DISTANCES.map(d => {
    const predicted = riegelPredict(timeSecs, distKm, d.km)
    return {
      distance: d.label,
      distKm: d.km,
      predictedSecs: predicted,
      predictedTime: secsToHMS(predicted),
      isSameAsInput: Math.abs(d.km - distKm) < 0.1,
    }
  })
}

export function bestRiegelTable(races: Race[]): { race: Race; table: RiegelRow[] } | null {
  const best = bestRaceByDistance(races)
  if (!best) return null
  const table = riegelTable(best)
  if (!table) return null
  return { race: best, table }
}

// ─── VDOT (Jack Daniels) ─────────────────────────────────────────────────────

export function computeVDOT(timeSecs: number, distKm: number): number | null {
  if (timeSecs <= 0 || distKm <= 0) return null
  const t = timeSecs / 60              // minutes
  const d = distKm * 1000              // meters
  const V = d / t                      // meters per minute
  const VO2    = -4.60 + 0.182258 * V + 0.000104 * V * V
  const pctVO2 = 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t)
  if (pctVO2 <= 0) return null
  const vdot = VO2 / pctVO2
  return Math.round(vdot * 10) / 10
}

// Binary search: find time such that computeVDOT(time, distKm) ≈ targetVDOT
export function vdotEquivTime(targetVDOT: number, distKm: number): number {
  let lo = distKm * 45   // ~45 sec/km absolute minimum
  let hi = distKm * 1800 // ~30 min/km extreme slow
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2
    const v = computeVDOT(mid, distKm)
    // Higher VDOT = faster time = lower seconds
    if (v !== null && v > targetVDOT) lo = mid
    else hi = mid
  }
  return Math.round((lo + hi) / 2)
}

export interface VDOTPoint {
  date: string
  vdot: number
  raceName: string
}

export function vdotHistory(races: Race[]): VDOTPoint[] {
  return races
    .filter(r =>
      isRunningRace(r) &&
      r.time && r.distance &&
      r.outcome !== 'DNF' && r.outcome !== 'DNS' && r.outcome !== 'DSQ'
    )
    .map(r => {
      const timeSecs = parseTimeSecs(r.time)
      const distKm   = parseDistKm(r.distance)
      // Exclude ultra distances — Daniels formula is only valid up to marathon
      if (!timeSecs || !distKm || distKm > 42.3) return null
      const vdot = computeVDOT(timeSecs, distKm)
      if (!vdot) return null
      return { date: r.date, vdot, raceName: r.name }
    })
    .filter(Boolean)
    .sort((a, b) => a!.date.localeCompare(b!.date)) as VDOTPoint[]
}

/** Peak all-time VDOT (best score ever). */
export function bestVDOT(races: Race[]): VDOTPoint | null {
  const history = vdotHistory(races)
  if (!history.length) return null
  return history.reduce((best, cur) => cur.vdot > best.vdot ? cur : best)
}

/** Current fitness VDOT — most recent running PB (last 90 days if available, else all-time most recent). */
export function recentVDOT(races: Race[]): VDOTPoint | null {
  const history = vdotHistory(races)
  if (!history.length) return null
  return history[history.length - 1]
}

/**
 * VDOT from the most recently set running PB.
 * Computes the best time per distance bin, then returns the PB race
 * that was set most recently. This keeps the score reflecting actual
 * current fitness without dropping whenever a non-PB race is run.
 */
export function latestPBVDOT(races: Race[]): VDOTPoint | null {
  // One pass: track best time (and associated VDOT) per distance bin
  const pbByBin = new Map<string, { secs: number; vdot: number; date: string; raceName: string }>()
  for (const r of races) {
    if (!r.time || !r.distance) continue
    if (!isRunningRace(r)) continue
    if (r.outcome === 'DNF' || r.outcome === 'DNS' || r.outcome === 'DSQ') continue
    const secs = parseTimeSecs(r.time)
    const distKm = parseDistKm(r.distance)
    if (!secs || !distKm || distKm > 42.3) continue
    const vdot = computeVDOT(secs, distKm)
    if (!vdot) continue
    const bin = String(Math.round(distKm * 10))
    const existing = pbByBin.get(bin)
    if (!existing || secs < existing.secs) {
      pbByBin.set(bin, { secs, vdot, date: r.date, raceName: r.name ?? r.date })
    }
  }
  if (!pbByBin.size) return null
  // Return the PB race that was most recently set
  const pbs = Array.from(pbByBin.values()).sort((a, b) => b.date.localeCompare(a.date))
  const latest = pbs[0]
  return { date: latest.date, vdot: Math.round(latest.vdot * 10) / 10, raceName: latest.raceName }
}

export interface EquivPerf {
  distance: string
  distKm: number
  timeSecs: number
  timeStr: string
}

const EQUIV_PERF_DISTANCES = [
  { label: '800m',          km: 0.8 },
  { label: '1 Mile',        km: 1.60934 },
  ...RIEGEL_DISTANCES,
]

export function equivalentPerformances(vdot: number): EquivPerf[] {
  return EQUIV_PERF_DISTANCES.map(d => {
    const timeSecs = vdotEquivTime(vdot, d.km)
    return { distance: d.label, distKm: d.km, timeSecs, timeStr: secsToHMS(timeSecs) }
  })
}

// ─── Pace Zones (Jack Daniels) ───────────────────────────────────────────────

export interface PaceZone {
  zone: number
  label: string
  abbr: string
  description: string
  minSecPerKm: number
  maxSecPerKm: number
  minPaceStr: string
  maxPaceStr: string
}

export function paceZones(vdot: number, units: 'metric' | 'imperial' = 'metric'): PaceZone[] {
  // Jack Daniels intensity factors as fraction of VDOT
  const zones: Array<{ zone: number; label: string; abbr: string; description: string; loFactor: number; hiFactor: number }> = [
    { zone: 1, label: 'Easy',      abbr: 'E', description: 'Recovery + base building', loFactor: 0.59, hiFactor: 0.74 },
    { zone: 2, label: 'Marathon',  abbr: 'M', description: 'Marathon race pace',       loFactor: 0.75, hiFactor: 0.84 },
    { zone: 3, label: 'Threshold', abbr: 'T', description: 'Comfortably hard (tempo)', loFactor: 0.83, hiFactor: 0.88 },
    { zone: 4, label: 'Interval',  abbr: 'I', description: 'VO2max intervals',         loFactor: 0.95, hiFactor: 1.00 },
    { zone: 5, label: 'Repetition',abbr: 'R', description: 'Speed + economy',          loFactor: 1.03, hiFactor: 1.10 },
  ]
  return zones.map(z => {
    // lo factor = less intense = slower pace = more sec/km (so we use hiPace for lo intensity)
    const maxSecPerKm = vdotEquivTime(vdot * z.loFactor, 1)
    const minSecPerKm = vdotEquivTime(vdot * z.hiFactor, 1)
    return {
      zone: z.zone,
      label: z.label,
      abbr: z.abbr,
      description: z.description,
      minSecPerKm,
      maxSecPerKm,
      minPaceStr: fmtPace(minSecPerKm, units),
      maxPaceStr: fmtPace(maxSecPerKm, units),
    }
  })
}

// ─── Goal Pace Calculator ─────────────────────────────────────────────────────

export interface GoalPaceResult {
  distKm: number
  goalTimeSecs: number
  paceSecPerKm: number
  pacePaceStr: string
  paceSecPerMile: number
  paceMileStr: string
  splitTargets: Array<{ label: string; cumSecs: number; cumStr: string }>
  vsCurrentVDOT: number | null  // seconds faster (+) or slower (-) vs current fitness
  requiredVDOT: number | null
}

export function goalPaceCalc(
  goalTimeSecs: number,
  distKm: number,
  units: 'metric' | 'imperial',
  currentVDOT?: number,
): GoalPaceResult | null {
  if (goalTimeSecs <= 0 || distKm <= 0) return null

  const paceSecPerKm   = goalTimeSecs / distKm
  const paceSecPerMile = paceSecPerKm * 1.60934
  const requiredVDOT   = computeVDOT(goalTimeSecs, distKm)

  // Split targets every 5K, plus half and finish
  const splitKms: Array<{ label: string; km: number }> = []
  let k = 5
  while (k < distKm - 2) {
    splitKms.push({ label: `${k}K`, km: k })
    k += 5
  }
  if (distKm >= 20) {
    const halfKm = distKm / 2
    if (!splitKms.some(s => Math.abs(s.km - halfKm) < 0.5)) {
      splitKms.push({ label: 'Halfway', km: halfKm })
    }
  }
  splitKms.push({ label: 'Finish', km: distKm })
  splitKms.sort((a, b) => a.km - b.km)

  const splitTargets = splitKms.map(s => {
    const cumSecs = paceSecPerKm * s.km
    return { label: s.label, cumSecs, cumStr: secsToHMS(cumSecs) }
  })

  const vsCurrentVDOT = (currentVDOT && requiredVDOT)
    ? (() => {
        const currentEquiv = vdotEquivTime(currentVDOT, distKm)
        return currentEquiv - goalTimeSecs  // positive = goal is faster than current fitness
      })()
    : null

  return {
    distKm,
    goalTimeSecs,
    paceSecPerKm,
    pacePaceStr: fmtPace(paceSecPerKm, units),
    paceSecPerMile,
    paceMileStr: fmtPace(paceSecPerMile, 'imperial'),
    splitTargets,
    vsCurrentVDOT,
    requiredVDOT,
  }
}

// ─── Weather Adjustment ───────────────────────────────────────────────────────
// adjusted = actual / (1 + 0.004×max(0,T-10) + 0.001×max(0,H-50))
// where T = temp in °C, H = humidity %
// Gives the time you "would have run" in ideal conditions (10°C, 50% humidity)

export interface WeatherImpact {
  actualSecs: number
  adjustedSecs: number
  tempC: number
  humidityPct: number
  improvementSecs: number   // positive = actual was slower due to heat/humidity
  impactPct: number         // % slower due to conditions
  label: string
}

export function weatherAdjustedTime(race: Race): WeatherImpact | null {
  const timeSecs = parseTimeSecs(race.time)
  if (!timeSecs) return null
  const tempC     = race.weather?.temp ?? null
  const humidity  = race.weather?.humidity ?? null
  if (tempC === null && humidity === null) return null

  const t = tempC ?? 15
  const h = humidity ?? 60
  const factor = 1 + 0.004 * Math.max(0, t - 10) + 0.001 * Math.max(0, h - 50)
  const adjustedSecs = Math.round(timeSecs / factor)
  const improvementSecs = timeSecs - adjustedSecs

  let label: string
  if (improvementSecs <= 30) label = 'Near ideal conditions'
  else if (improvementSecs <= 120) label = 'Mild conditions impact'
  else if (improvementSecs <= 300) label = 'Moderate heat impact'
  else label = 'Significant heat/humidity'

  return {
    actualSecs: timeSecs,
    adjustedSecs,
    tempC: t,
    humidityPct: h,
    improvementSecs,
    impactPct: Math.round((improvementSecs / timeSecs) * 1000) / 10,
    label,
  }
}

export function bestWeatherImpact(races: Race[]): { race: Race; impact: WeatherImpact } | null {
  for (const r of [...races].sort((a, b) => b.date.localeCompare(a.date))) {
    const impact = weatherAdjustedTime(r)
    if (impact) return { race: r, impact }
  }
  return null
}

// ─── Course Repeats ───────────────────────────────────────────────────────────

export function findCourseRepeats(races: Race[]): Map<string, Race[]> {
  const groups = new Map<string, Race[]>()
  for (const r of races) {
    // Key: normalized race name (lowercase, strip year-like 4-digit numbers)
    const key = r.name.toLowerCase()
      .replace(/\b(20\d{2}|19\d{2})\b/g, '')
      .replace(/[^\w\s]/g, '')
      .trim()
      .replace(/\s+/g, ' ')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }
  // Only keep groups with 2+ entries that have a time
  const result = new Map<string, Race[]>()
  for (const [key, group] of groups) {
    const withTime = group.filter(r => r.time)
    if (withTime.length >= 2) result.set(key, withTime.sort((a, b) => a.date.localeCompare(b.date)))
  }
  return result
}

export function findPriorResult(upcoming: Race, allRaces: Race[]): Race | null {
  const upKey = upcoming.name.toLowerCase()
    .replace(/\b(20\d{2}|19\d{2})\b/g, '')
    .replace(/[^\w\s]/g, '').trim().replace(/\s+/g, ' ')
  const match = allRaces
    .filter(r => r.time && r.date < upcoming.date)
    .find(r => {
      const k = r.name.toLowerCase()
        .replace(/\b(20\d{2}|19\d{2})\b/g, '')
        .replace(/[^\w\s]/g, '').trim().replace(/\s+/g, ' ')
      return k === upKey
    })
  return match ?? null
}

// ─── Personal League Table ────────────────────────────────────────────────────

const AGE_GRADE_STANDARDS: Record<string, Record<string, number>> = {
  M: { '5K': 780, '10K': 1628, 'Half Marathon': 3600, Marathon: 7377 },
  F: { '5K': 891, '10K': 1856, 'Half Marathon': 4104, Marathon: 8417 },
}

function distLabel(distKm: number): string | null {
  if (distKm >= 4.9 && distKm <= 5.1) return '5K'
  if (distKm >= 9.9 && distKm <= 10.1) return '10K'
  if (distKm >= 21.0 && distKm <= 21.2) return 'Half Marathon'
  if (distKm >= 42.0 && distKm <= 42.4) return 'Marathon'
  return null
}

export interface LeagueEntry {
  race: Race
  ageGrade: number
  rank: number
}

export function personalLeagueTable(races: Race[], athlete: Athlete): LeagueEntry[] {
  const gender = athlete.gender === 'F' ? 'F' : 'M'
  const entries: Array<{ race: Race; ageGrade: number }> = []

  for (const r of races) {
    const timeSecs = parseTimeSecs(r.time)
    const distKm   = parseDistKm(r.distance)
    const label    = distLabel(distKm)
    if (!timeSecs || !label) continue

    const worldRecord = AGE_GRADE_STANDARDS[gender]?.[label]
    if (!worldRecord) continue

    // Age-grade = (world record / athlete time) * 100
    const ageGrade = Math.min(100, Math.round((worldRecord / timeSecs) * 1000) / 10)
    if (ageGrade > 0) entries.push({ race: r, ageGrade })
  }

  return entries
    .sort((a, b) => b.ageGrade - a.ageGrade)
    .slice(0, 10)
    .map((e, i) => ({ ...e, rank: i + 1 }))
}

// ─── Completion Stats (DNF/DNS Tracker) ──────────────────────────────────────

export interface CompletionStats {
  total: number
  finished: number
  dnf: number
  dns: number
  dsq: number
  completionRate: number   // 0–100
  dnfList: Race[]
}

export function completionStats(races: Race[]): CompletionStats {
  const dnf  = races.filter(r => r.outcome === 'DNF')
  const dns  = races.filter(r => r.outcome === 'DNS')
  const dsq  = races.filter(r => r.outcome === 'DSQ')
  const finished = races.length - dnf.length - dns.length - dsq.length
  return {
    total: races.length,
    finished,
    dnf: dnf.length,
    dns: dns.length,
    dsq: dsq.length,
    completionRate: races.length > 0 ? Math.round((finished / races.length) * 1000) / 10 : 100,
    dnfList: dnf,
  }
}

// ─── Distance Milestones ──────────────────────────────────────────────────────

const MILESTONES = [
  { km: 100,   label: '100 KM' },
  { km: 500,   label: '500 KM' },
  { km: 1000,  label: '1,000 KM' },
  { km: 2500,  label: '2,500 KM' },
  { km: 5000,  label: '5,000 KM' },
  { km: 10000, label: '10,000 KM' },
  { km: 20000, label: '20,000 KM' },
  { km: 42195, label: 'Moon Shot (42,195 KM)' },
]

const FUN_FACTS: Record<number, string> = {
  100:   'You\'ve run the length of Iceland',
  500:   'That\'s London → Madrid on foot',
  1000:  'The distance from Paris to Warsaw',
  2500:  'New York City → Los Angeles distance',
  5000:  'Coast of Spain + Portugal + France',
  10000: '¼ of the Earth\'s circumference',
  20000: 'Halfway around the world',
  42195: 'Distance to the Moon',
}

export interface MilestoneResult {
  totalKm: number
  lastMilestone: { km: number; label: string } | null
  nextMilestone: { km: number; label: string } | null
  progressPct: number
  kmToNext: number
  funFact: string
}

export function distanceMilestones(races: Race[]): MilestoneResult {
  const totalKm = races.reduce((s, r) => {
    const km = parseDistKm(r.distance)
    return km > 0 ? s + km : s
  }, 0)

  const last = [...MILESTONES].reverse().find(m => m.km <= totalKm) ?? null
  const next = MILESTONES.find(m => m.km > totalKm) ?? null

  const progressPct = last && next
    ? Math.round(((totalKm - last.km) / (next.km - last.km)) * 100)
    : next ? Math.round((totalKm / next.km) * 100)
    : 100

  const kmToNext = next ? Math.round(next.km - totalKm) : 0

  return {
    totalKm: Math.round(totalKm),
    lastMilestone: last,
    nextMilestone: next,
    progressPct: Math.min(100, progressPct),
    kmToNext,
    funFact: next ? (FUN_FACTS[next.km] ?? `${next.label} total`) : 'You\'ve run the world!',
  }
}

// ─── Distance Distribution ────────────────────────────────────────────────────

export interface DistributionEntry {
  label: string
  count: number
  pct: number
  totalKm: number
}

export function distanceDistribution(races: Race[]): DistributionEntry[] {
  const buckets: Record<string, { count: number; km: number }> = {}
  for (const r of races) {
    const km = parseDistKm(r.distance)
    let bucket: string
    if (km <= 0) bucket = 'Other'
    else if (km <= 5.1) bucket = '5K & Under'
    else if (km <= 10.1) bucket = '6–10K'
    else if (km <= 21.2) bucket = 'Half Marathon'
    else if (km <= 42.4) bucket = 'Marathon'
    else if (km <= 113) bucket = 'Triathlon'
    else bucket = 'Ultra / Iron'
    if (!buckets[bucket]) buckets[bucket] = { count: 0, km: 0 }
    buckets[bucket].count++
    buckets[bucket].km += km
  }
  const total = races.length || 1
  return Object.entries(buckets)
    .map(([label, { count, km }]) => ({
      label,
      count,
      pct: Math.round((count / total) * 100),
      totalKm: Math.round(km),
    }))
    .sort((a, b) => b.count - a.count)
}

// ─── Podium Detector ─────────────────────────────────────────────────────────

export interface PodiumResult {
  overall: Race[]
  ageGroup: Race[]
  total: number
}

function isPodiumPlacing(placing: string | undefined, scope: 'overall' | 'ag'): boolean {
  if (!placing) return false
  const p = placing.toLowerCase()
  if (scope === 'ag') {
    if (/\bag\b|\bage.?group\b|\bage.?cat/i.test(p)) {
      const m = p.match(/(\d+)\s*\//)
      if (m) return parseInt(m[1]) <= 3
      if (/\b[123](st|nd|rd)\b/.test(p)) return true
    }
    return false
  }
  // overall: "1/500", "3rd", "2nd overall", top 3
  const m = placing.match(/^(\d+)\s*\//)
  if (m && parseInt(m[1]) <= 3) return true
  if (/\b[123](st|nd|rd)\b/i.test(placing) && !/ag|age/i.test(placing)) return true
  return false
}

export function detectPodiums(races: Race[]): PodiumResult {
  const overall  = races.filter(r => isPodiumPlacing(r.placing, 'overall'))
  const ageGroup = races.filter(r => isPodiumPlacing(r.placing, 'ag'))
  return { overall, ageGroup, total: overall.length + ageGroup.length }
}

// ─── Extended Streaks ─────────────────────────────────────────────────────────

export interface ExtendedStreaks {
  currentMonthlyStreak: number   // consecutive months with at least 1 race
  longestMonthlyStreak: number
  currentAnnualStreak: number    // consecutive years with at least 1 race
  longestAnnualStreak: number
  racedEveryQuarter: boolean     // all 4 quarters of current year have a race
  currentYearRaceCount: number
  lastRaceDate: string | null
}

export function computeExtendedStreaks(races: Race[]): ExtendedStreaks {
  const sorted = [...races].sort((a, b) => a.date.localeCompare(b.date))
  const today  = new Date()
  const currYr = today.getFullYear()
  const currMo = today.getFullYear() * 100 + today.getMonth() + 1  // YYYYMM

  // Build sets of YYYYMM and YYYY with at least 1 race
  const monthSet = new Set<number>()
  const yearSet  = new Set<number>()
  for (const r of sorted) {
    const d = new Date(r.date + 'T00:00:00')
    monthSet.add(d.getFullYear() * 100 + d.getMonth() + 1)
    yearSet.add(d.getFullYear())
  }

  // Monthly streak (walk backwards from current month)
  let currentMonthlyStreak = 0
  let m = currMo
  while (monthSet.has(m)) {
    currentMonthlyStreak++
    // decrement month
    const yr = Math.floor(m / 100)
    const mo = m % 100
    m = mo === 1 ? (yr - 1) * 100 + 12 : yr * 100 + (mo - 1)
  }

  // Longest monthly streak
  const allMonths = [...monthSet].sort()
  let longest = 0, streak = 0
  for (let i = 0; i < allMonths.length; i++) {
    if (i === 0) { streak = 1; continue }
    const prev = allMonths[i - 1]
    const prevYr = Math.floor(prev / 100), prevMo = prev % 100
    const expected = prevMo === 12 ? (prevYr + 1) * 100 + 1 : prevYr * 100 + prevMo + 1
    streak = allMonths[i] === expected ? streak + 1 : 1
    longest = Math.max(longest, streak)
  }
  longest = Math.max(longest, streak, currentMonthlyStreak)

  // Annual streak
  let currentAnnualStreak = 0
  let y = currYr
  while (yearSet.has(y)) { currentAnnualStreak++; y-- }

  // Longest annual streak
  const allYears = [...yearSet].sort()
  let longestAnnual = 0, annualStreak = 0
  for (let i = 0; i < allYears.length; i++) {
    if (i === 0) { annualStreak = 1; continue }
    annualStreak = allYears[i] === allYears[i - 1] + 1 ? annualStreak + 1 : 1
    longestAnnual = Math.max(longestAnnual, annualStreak)
  }
  longestAnnual = Math.max(longestAnnual, annualStreak, currentAnnualStreak)

  // Quarterly coverage this year
  const quartersThisYear = new Set<number>()
  for (const r of sorted) {
    if (!r.date.startsWith(String(currYr))) continue
    const mo = parseInt(r.date.slice(5, 7))
    quartersThisYear.add(Math.ceil(mo / 3))
  }
  const racedEveryQuarter = quartersThisYear.size >= 4

  const currentYearRaceCount = sorted.filter(r => r.date.startsWith(String(currYr))).length
  const lastRaceDate = sorted.length > 0 ? sorted[sorted.length - 1].date : null

  return {
    currentMonthlyStreak,
    longestMonthlyStreak: longest,
    currentAnnualStreak,
    longestAnnualStreak: longestAnnual,
    racedEveryQuarter,
    currentYearRaceCount,
    lastRaceDate,
  }
}

// ─── Race Density Warnings ────────────────────────────────────────────────────

export interface DensityWarning {
  races: Race[]
  windowDays: number
  severity: 'warning' | 'danger'
  message: string
}

export function raceDensityWarnings(upcomingRaces: Race[]): DensityWarning[] {
  const sorted   = [...upcomingRaces].sort((a, b) => a.date.localeCompare(b.date))
  const warnings: DensityWarning[] = []

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const d1  = new Date(sorted[i].date + 'T00:00:00')
      const d2  = new Date(sorted[j].date + 'T00:00:00')
      const gap = Math.round((d2.getTime() - d1.getTime()) / 86400000)

      const priority1 = sorted[i].priority
      const priority2 = sorted[j].priority
      const bothAB = ['A', 'B'].includes(priority1 ?? '') && ['A', 'B'].includes(priority2 ?? '')

      if (gap <= 7) {
        warnings.push({
          races: [sorted[i], sorted[j]],
          windowDays: gap,
          severity: 'danger',
          message: `${sorted[i].name} and ${sorted[j].name} are only ${gap} day${gap !== 1 ? 's' : ''} apart — recovery risk`,
        })
      } else if (gap <= 21 && bothAB) {
        warnings.push({
          races: [sorted[i], sorted[j]],
          windowDays: gap,
          severity: 'warning',
          message: `Two A/B races ${gap} days apart — consider tapering strategy`,
        })
      }
    }
  }

  return warnings
}

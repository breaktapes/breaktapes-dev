// ─── BREAKTAPES Triathlon Predictor Library ────────────────────────────────────
// Pure functions — no React. All timing in seconds. All distances in km.
//
// Predicts swim / T1 / bike / T2 / run splits + finish time for a target
// triathlon distance by blending two signals:
//   • EMPIRICAL — recency-weighted Riegel projection from the athlete's own
//     recent triathlon leg splits (captures real race pacing + brick fatigue).
//   • ENGINE — cold-start fallback (run leg from standalone running PB).
// Blend weight α grows with how much real tri data exists:  α = n / (n + K).

import type { Race } from '@/types'
import { parseTimeSecs, parseDistKm, secsToHMS } from './raceFormulas'

// ─── Triathlon distance definitions ────────────────────────────────────────────

export type TriTypeKey = 'sprint' | 'olympic' | '70.3' | 'ironman'

export interface TriType {
  key: TriTypeKey
  label: string
  swimKm: number
  bikeKm: number
  runKm: number
  totalKm: number
  /** Default transition times (seconds) when the athlete has no T1/T2 history. */
  t1Default: number
  t2Default: number
}

export const TRI_TYPES: TriType[] = [
  { key: 'sprint',  label: 'Sprint',  swimKm: 0.75, bikeKm: 20,  runKm: 5,       totalKm: 25.75, t1Default: 120, t2Default: 75 },
  { key: 'olympic', label: 'Olympic', swimKm: 1.5,  bikeKm: 40,  runKm: 10,      totalKm: 51.5,  t1Default: 150, t2Default: 90 },
  { key: '70.3',    label: '70.3',    swimKm: 1.9,  bikeKm: 90,  runKm: 21.0975, totalKm: 113,   t1Default: 300, t2Default: 180 },
  { key: 'ironman', label: 'IRONMAN', swimKm: 3.8,  bikeKm: 180, runKm: 42.195,  totalKm: 226,   t1Default: 420, t2Default: 300 },
]

export function triTypeByKey(key: TriTypeKey): TriType {
  return TRI_TYPES.find(t => t.key === key)!
}

/** Map a total race distance (km) to its nearest canonical triathlon type. */
export function detectTriType(distKm: number): TriType | null {
  if (distKm <= 0) return null
  if (distKm < 40)  return triTypeByKey('sprint')
  if (distKm < 80)  return triTypeByKey('olympic')
  if (distKm < 170) return triTypeByKey('70.3')
  return triTypeByKey('ironman')
}

export function isTriRace(r: Race): boolean {
  const s = (r.sport ?? '').toLowerCase()
  return s.includes('tri') || s.includes('iron')
}

// ─── Leg extraction ─────────────────────────────────────────────────────────────

export type LegKey = 'swim' | 't1' | 'bike' | 't2' | 'run'

export const LEG_ORDER: LegKey[] = ['swim', 't1', 'bike', 't2', 'run']

export const LEG_LABELS: Record<LegKey, string> = {
  swim: 'Swim', t1: 'T1', bike: 'Bike', t2: 'T2', run: 'Run',
}

// Riegel fatigue exponents per discipline (swim least sensitive, run most).
const LEG_EXP: Record<'swim' | 'bike' | 'run', number> = { swim: 1.02, bike: 1.04, run: 1.06 }

function legFromLabel(label: string): LegKey | null {
  const l = (label || '').toLowerCase().trim()
  if (!l) return null
  if (l.includes('swim')) return 'swim'
  if (l === 't1' || l.includes('transition 1') || l.includes('transition1') || l === 'transition') return 't1'
  if (l === 't2' || l.includes('transition 2') || l.includes('transition2')) return 't2'
  if (l.includes('bike') || l.includes('cycl') || l.includes('ride')) return 'bike'
  if (l.includes('run')) return 'run'
  return null
}

/** Parse a triathlon race's splits into per-leg seconds. Prefers per-segment
 *  `split` times; falls back to cumulative deltas in label order. */
export function extractTriLegs(race: Race): Partial<Record<LegKey, number>> {
  const out: Partial<Record<LegKey, number>> = {}
  const splits = race.splits
  if (!splits || !splits.length) return out

  // Pass 1 — per-segment split times.
  for (const s of splits) {
    const leg = legFromLabel(s.label)
    if (!leg) continue
    const sec = s.split ? parseTimeSecs(s.split) : null
    if (sec != null && sec > 0) out[leg] = sec
  }
  if (Object.keys(out).length > 0) return out

  // Pass 2 — derive from cumulative times in document order.
  const cum: Array<{ leg: LegKey; c: number }> = []
  for (const s of splits) {
    const leg = legFromLabel(s.label)
    if (!leg) continue
    const c = s.cumulative ? parseTimeSecs(s.cumulative) : null
    if (c != null && c > 0) cum.push({ leg, c })
  }
  let prev = 0
  for (const { leg, c } of cum) {
    const d = c - prev
    if (d > 0) out[leg] = d
    prev = c
  }
  return out
}

// ─── Prediction ──────────────────────────────────────────────────────────────────

export interface TriLegPrediction {
  key: LegKey
  label: string
  secs: number
  time: string
  distKm?: number                                  // swim/bike/run only
  source: 'empirical' | 'engine' | 'blend' | 'default'
}

export interface TriPrediction {
  type: TriType
  legs: TriLegPrediction[]                          // swim, t1, bike, t2, run (in order)
  totalSecs: number
  totalTime: string
  alpha: number                                     // empirical weight 0..1
  sampleCount: number                               // distinct tri races used
  hasCrossBand: boolean                             // any sample from a different tri distance
  band: { lowSecs: number; highSecs: number; lowTime: string; highTime: string }
  basis: string                                     // human-readable description
}

const DAY_MS = 86_400_000
const LAMBDA = Math.LN2 / 365   // ~1yr half-life recency decay

const RUNNING_SPORTS = /^(running|trail|road|cross.?country|track|fell|mountain run|run)$/i
function isRunningRace(r: Race): boolean {
  const s = (r.sport ?? 'running').toLowerCase().trim()
  if (s === '') return true
  return RUNNING_SPORTS.test(s) && !s.includes('tri') && !s.includes('iron') &&
    !s.includes('cycl') && !s.includes('bike') && !s.includes('swim')
}

/** Fastest standalone running effort (best pace) → used to estimate the run leg
 *  when the athlete has no triathlon run-split history. */
function bestRunningEffort(races: Race[]): { secs: number; km: number } | null {
  let best: { secs: number; km: number; pace: number } | null = null
  for (const r of races) {
    if (!isRunningRace(r)) continue
    if (r.outcome === 'DNF' || r.outcome === 'DNS' || r.outcome === 'DSQ') continue
    const secs = parseTimeSecs(r.time)
    const km = parseDistKm(r.distance)
    if (!secs || km <= 0) continue
    const pace = secs / km
    if (!best || pace < best.pace) best = { secs, km, pace }
  }
  return best ? { secs: best.secs, km: best.km } : null
}

function riegel(knownSecs: number, knownKm: number, targetKm: number, exp: number): number {
  return knownSecs * Math.pow(targetKm / knownKm, exp)
}

interface LegSample {
  projected: number   // seconds projected to the target leg distance
  weight: number      // recency × cross-band weight
  crossBand: boolean
}

/**
 * Predict a triathlon's splits + finish for `targetKey`, blending the athlete's
 * recent tri leg data (empirical) with an engine fallback for the run.
 * Returns null when there is no usable data at all.
 */
export function predictTriathlon(
  races: Race[],
  targetKey: TriTypeKey,
  nowMs: number = Date.now(),
): TriPrediction | null {
  const type = triTypeByKey(targetKey)
  const legKm: Record<'swim' | 'bike' | 'run', number> = {
    swim: type.swimKm, bike: type.bikeKm, run: type.runKm,
  }

  // Gather usable tri races with at least one extractable leg.
  const triRaces = races
    .filter(r => isTriRace(r) && r.outcome !== 'DNF' && r.outcome !== 'DNS' && r.outcome !== 'DSQ')
    .map(r => ({ race: r, srcType: detectTriType(parseDistKm(r.distance)), legs: extractTriLegs(r) }))
    .filter(x => x.srcType != null && Object.keys(x.legs).length > 0) as Array<{
      race: Race; srcType: TriType; legs: Partial<Record<LegKey, number>>
    }>

  // Per-discipline empirical samples (swim/bike/run).
  const samples: Record<'swim' | 'bike' | 'run', LegSample[]> = { swim: [], bike: [], run: [] }
  const t1Samples: Array<{ secs: number; weight: number }> = []
  const t2Samples: Array<{ secs: number; weight: number }> = []
  const usedRaces = new Set<string>()
  let hasCrossBand = false

  for (const { race, srcType, legs } of triRaces) {
    const ageDays = race.date ? Math.max(0, (nowMs - new Date(race.date + 'T00:00:00').getTime()) / DAY_MS) : 365
    const recency = Number.isFinite(ageDays) ? Math.exp(-LAMBDA * ageDays) : 0.5
    const crossBand = srcType.key !== targetKey
    if (crossBand) hasCrossBand = true
    const w = recency * (crossBand ? 0.6 : 1)
    let contributed = false

    ;(['swim', 'bike', 'run'] as const).forEach(disc => {
      const legSecs = legs[disc]
      if (legSecs == null || legSecs <= 0) return
      const srcKm = disc === 'swim' ? srcType.swimKm : disc === 'bike' ? srcType.bikeKm : srcType.runKm
      const projected = riegel(legSecs, srcKm, legKm[disc], LEG_EXP[disc])
      samples[disc].push({ projected, weight: w, crossBand })
      contributed = true
    })
    if (legs.t1 != null && legs.t1 > 0) t1Samples.push({ secs: legs.t1, weight: w })
    if (legs.t2 != null && legs.t2 > 0) t2Samples.push({ secs: legs.t2, weight: w })
    if (contributed) usedRaces.add(race.id)
  }

  const engineRun = bestRunningEffort(races)

  function weightedMean(arr: Array<{ projected?: number; secs?: number; weight: number }>): number | null {
    let sw = 0, swx = 0
    for (const a of arr) { const v = a.projected ?? a.secs ?? 0; sw += a.weight; swx += a.weight * v }
    return sw > 0 ? swx / sw : null
  }

  // Effective same-band sample count drives the blend weight α.
  const distinctSameBand = new Set(
    triRaces.filter(x => x.srcType.key === targetKey).map(x => x.race.id),
  ).size
  const distinctCross = usedRaces.size - distinctSameBand
  const nEff = distinctSameBand + 0.5 * Math.max(0, distinctCross)
  const K = 2
  const alpha = nEff > 0 ? nEff / (nEff + K) : 0

  const legPreds: TriLegPrediction[] = []
  let anyLeg = false

  for (const disc of ['swim', 'bike', 'run'] as const) {
    const emp = weightedMean(samples[disc])
    let secs: number | null = null
    let source: TriLegPrediction['source'] = 'empirical'

    if (disc === 'run') {
      const engine = engineRun ? riegel(engineRun.secs, engineRun.km, legKm.run, LEG_EXP.run) : null
      if (emp != null && engine != null) { secs = alpha * emp + (1 - alpha) * engine; source = 'blend' }
      else if (emp != null) { secs = emp; source = 'empirical' }
      else if (engine != null) { secs = engine; source = 'engine' }
    } else {
      // No reliable engine model for swim/bike yet — empirical only.
      if (emp != null) { secs = emp; source = 'empirical' }
    }

    if (secs != null) anyLeg = true
    legPreds.push({
      key: disc, label: LEG_LABELS[disc],
      secs: secs ?? 0, time: secs != null ? secsToHMS(secs) : '—',
      distKm: legKm[disc], source,
    })
  }

  if (!anyLeg) return null

  // Transitions — empirical average or type default.
  const t1 = weightedMean(t1Samples) ?? type.t1Default
  const t2 = weightedMean(t2Samples) ?? type.t2Default
  const transitions: Record<'t1' | 't2', TriLegPrediction> = {
    t1: { key: 't1', label: 'T1', secs: t1, time: secsToHMS(t1), source: t1Samples.length ? 'empirical' : 'default' },
    t2: { key: 't2', label: 'T2', secs: t2, time: secsToHMS(t2), source: t2Samples.length ? 'empirical' : 'default' },
  }

  // Assemble in race order: swim, T1, bike, T2, run.
  const swim = legPreds.find(l => l.key === 'swim')!
  const bike = legPreds.find(l => l.key === 'bike')!
  const run = legPreds.find(l => l.key === 'run')!
  const orderedLegs: TriLegPrediction[] = [swim, transitions.t1, bike, transitions.t2, run]

  const totalSecs = orderedLegs.reduce((sum, l) => sum + l.secs, 0)

  // Confidence band: base + low-data widening + cross-band penalty.
  const u = 0.04 + (1 - alpha) * 0.10 + (hasCrossBand ? 0.05 : 0)
  const lowSecs = totalSecs * (1 - u)
  const highSecs = totalSecs * (1 + u)

  const basis = usedRaces.size > 0
    ? `${usedRaces.size} tri${usedRaces.size === 1 ? '' : 's'} with splits${hasCrossBand ? ' (some other distances)' : ''}`
    : 'standalone running PB (engine estimate)'

  return {
    type,
    legs: orderedLegs,
    totalSecs,
    totalTime: secsToHMS(totalSecs),
    alpha,
    sampleCount: usedRaces.size,
    hasCrossBand,
    band: { lowSecs, highSecs, lowTime: secsToHMS(lowSecs), highTime: secsToHMS(highSecs) },
    basis,
  }
}

/** Pick the most relevant target type to show by default: the next upcoming
 *  triathlon if any, else the athlete's most-raced tri type, else Olympic. */
export function defaultTriTarget(races: Race[], upcoming: Race[]): TriTypeKey {
  const nextTri = [...upcoming]
    .filter(isTriRace)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))[0]
  if (nextTri) {
    const t = detectTriType(parseDistKm(nextTri.distance))
    if (t) return t.key
  }
  const counts = new Map<TriTypeKey, number>()
  for (const r of races) {
    if (!isTriRace(r)) continue
    const t = detectTriType(parseDistKm(r.distance))
    if (t) counts.set(t.key, (counts.get(t.key) ?? 0) + 1)
  }
  let bestKey: TriTypeKey | null = null, bestN = 0
  for (const [k, n] of counts) if (n > bestN) { bestN = n; bestKey = k }
  return bestKey ?? 'olympic'
}

/** Whether the athlete has any triathlon race with usable split data. */
export function hasTriSplitData(races: Race[]): boolean {
  return races.some(r => isTriRace(r) && Object.keys(extractTriLegs(r)).length > 0)
}

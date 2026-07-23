import React, { useState, useEffect, useMemo } from 'react'
import { useRaceStore } from '@/stores/useRaceStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { posthog } from '@/lib/posthog'
import { computeVDOT, equivalentPerformances, paceZones, parseDistKm, parseTimeSecs, secsToHMS, type PaceZone } from '@/lib/raceFormulas'
import { useUnits } from '@/lib/units'
import { buildWorkoutSuggestions, type GoalFocus, type WorkoutType } from '@/lib/workoutGenerator'
import { TimePickerWheel } from '@/components/TimePickerWheel'
import type { HMS } from '@/components/TimePickerWheel'
import type { Race, SavedWorkout } from '@/types'

// WA age-grading factors — lookup table with linear interpolation
// Source: WA Masters Athletics 2023 (marathon, representative for road running)
// Factor > 1.0 means that age is slower than peak; 1.0 = peak performance age (~25–30)
const WA_FACTORS_M: [number, number][] = [
  [15, 1.150], [20, 1.030], [25, 1.000], [30, 1.000],
  [35, 1.021], [40, 1.060], [45, 1.111], [50, 1.177],
  [55, 1.259], [60, 1.369], [65, 1.508], [70, 1.683],
  [75, 1.903], [80, 2.174], [85, 2.505],
]
const WA_FACTORS_F: [number, number][] = [
  [15, 1.120], [20, 1.020], [25, 1.000], [30, 1.000],
  [35, 1.016], [40, 1.054], [45, 1.107], [50, 1.179],
  [55, 1.274], [60, 1.394], [65, 1.550], [70, 1.742],
  [75, 1.979], [80, 2.271], [85, 2.629],
]

function waAgeFactor(age: number, gender: 'M' | 'F' | string): number {
  const table = gender === 'F' ? WA_FACTORS_F : WA_FACTORS_M
  const clamped = Math.min(Math.max(age, 15), 85)
  for (let i = 0; i < table.length - 1; i++) {
    const [a0, f0] = table[i]
    const [a1, f1] = table[i + 1]
    if (clamped >= a0 && clamped <= a1) {
      const t = (clamped - a0) / (a1 - a0)
      return f0 + t * (f1 - f0)
    }
  }
  return table[table.length - 1][1]
}

const btnMain: React.CSSProperties = {
  background: 'var(--orange)',
  color: 'var(--black)',
  border: 'none',
  borderRadius: 'var(--radius-xs)',
  padding: '0.8rem 1.25rem',
  fontFamily: 'var(--headline)',
  fontWeight: 900,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontSize: 'var(--text-sm)',
}

const card: React.CSSProperties = {
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '1rem',
}

const sectionLabel: React.CSSProperties = {
  fontFamily: 'var(--headline)',
  fontWeight: 900,
  fontSize: 'var(--text-xs)',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  marginBottom: '0.75rem',
}

const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--text-xs)',
  color: 'var(--muted)',
  marginBottom: '6px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontFamily: 'var(--headline)',
  fontWeight: 700,
}

const textInput: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface3)',
  border: '1px solid var(--border2)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--white)',
  fontSize: 'var(--text-base)',
  padding: '0.65rem 0.85rem',
  fontFamily: 'var(--body)',
  boxSizing: 'border-box' as const,
}

// ─── Running distances ────────────────────────────────────────────────────────

type RunDistId = '5k' | '10k' | '10mi' | 'hm' | 'm' | '50k' | '100k' | 'custom'

interface RunDist { id: RunDistId; label: string; km: number }

const RUN_DISTANCES: RunDist[] = [
  { id: '5k',    label: '5K',           km: 5 },
  { id: '10k',   label: '10K',          km: 10 },
  { id: '10mi',  label: '10 Mile',      km: 16.09 },
  { id: 'hm',    label: 'Half Marathon',km: 21.0975 },
  { id: 'm',     label: 'Marathon',     km: 42.195 },
  { id: '50k',   label: '50K',          km: 50 },
  { id: '100k',  label: '100K',         km: 100 },
  { id: 'custom',label: 'Custom',       km: 0 },
]

// ─── Triathlon distances ──────────────────────────────────────────────────────

type TriDistId = 'sprint' | 'olympic' | 'ptot100' | '703' | 'ironman'

interface TriDist { id: TriDistId; label: string; swimM: number; bikeKm: number; runKm: number; totalKm: number }

const TRI_DISTANCES: TriDist[] = [
  { id: 'sprint',  label: 'Sprint Triathlon',       swimM: 750,  bikeKm: 20,  runKm: 5,    totalKm: 25.75 },
  { id: 'olympic', label: 'Olympic Triathlon',      swimM: 1500, bikeKm: 40,  runKm: 10,   totalKm: 51.5  },
  { id: 'ptot100', label: 'PTO 100',                swimM: 2000, bikeKm: 80,  runKm: 18,   totalKm: 100   },
  { id: '703',     label: '70.3 / Middle Distance', swimM: 1900, bikeKm: 90,  runKm: 21.1, totalKm: 113   },
  { id: 'ironman', label: 'IRONMAN / Full Distance', swimM: 3800, bikeKm: 180, runKm: 42.2, totalKm: 226  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function secsToMMSS(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.round(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function hmsToSecs(hms: HMS): number {
  return hms.h * 3600 + hms.m * 60 + hms.s
}

function secsToHMS_obj(secs: number): HMS {
  const s = Math.max(0, Math.round(secs))
  return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 }
}

function fmtDateCompact(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}


// Find fastest race at a given distance (with tolerance ±tolerance km)
function findRunPB(races: Race[], targetKm: number, tolerance = 0.5): Race | null {
  const matching = races.filter(r =>
    r.time &&
    r.outcome !== 'DNF' && r.outcome !== 'DNS' && r.outcome !== 'DSQ' &&
    (() => { const km = parseDistKm(r.distance); return km > 0 && Math.abs(km - targetKm) <= tolerance })()
  )
  if (!matching.length) return null
  return matching.reduce((best, r) => {
    const ta = parseTimeSecs(r.time ?? '') ?? Infinity
    const tb = parseTimeSecs(best.time ?? '') ?? Infinity
    return ta < tb ? r : best
  })
}

// Find triathlon PB for a given total km
function findTriPB(races: Race[], targetKm: number, tolerance = 5): Race | null {
  const tri = races.filter(r =>
    r.time &&
    r.outcome !== 'DNF' && r.outcome !== 'DNS' &&
    (r.sport?.toLowerCase().includes('tri') || r.distance?.toLowerCase().includes('ironman'))
  )
  if (!tri.length) return null
  const matching = tri.filter(r => {
    const km = parseDistKm(r.distance)
    return km > 0 && Math.abs(km - targetKm) <= tolerance
  })
  if (!matching.length) return null
  return matching.reduce((best, r) => {
    const ta = parseTimeSecs(r.time ?? '') ?? Infinity
    const tb = parseTimeSecs(best.time ?? '') ?? Infinity
    return ta < tb ? r : best
  })
}

type Tab = 'benchmark' | 'pacing' | 'builder'

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: 'benchmark', label: 'Benchmark' },
  { id: 'pacing',    label: 'Pacing' },
  { id: 'builder',   label: 'Builder' },
]

// ─── Triathlon result type ────────────────────────────────────────────────────

interface TriResult {
  swimSec: number
  t1Sec: number
  bikeSec: number
  t2Sec: number
  runSec: number
  totalSec: number
}

interface BenchmarkResult {
  raceName: string
  dateLabel?: string
  distLabel: string
  timeLabel: string
  vdot: number
  zones: PaceZone[]
}

export function Train() {
  const [activeTab, setActiveTab] = useState<Tab>('benchmark')
  const units = useUnits()
  const athlete = useAthleteStore(s => s.athlete)
  const updateAthlete = useAthleteStore(s => s.updateAthlete)

  // ── Pace tab: sport selector ───────────────────────────────────────────────
  const [sport, setSport] = useState<'running' | 'triathlon'>('running')

  // ── Running calculator state ───────────────────────────────────────────────
  const [runDistId, setRunDistId]     = useState<RunDistId>('hm')
  const [customVal, setCustomVal]     = useState('')
  const [customUnit, setCustomUnit]   = useState<'km' | 'mi'>('km')
  const [goalHMS, setGoalHMS]         = useState<HMS>({ h: 0, m: 0, s: 0 })
  const [splitsTab, setSplitsTab]     = useState<'km' | 'mile' | 'race'>('race')
  const [splitStrategy, setSplitStrategy] = useState<'even' | 'negative' | 'positive'>('even')
  const [splitVariancePct, setSplitVariancePct] = useState(3)
  const [runResult, setRunResult]     = useState<{ km: string; mi: string } | null>(null)
  const [runZones, setRunZones]       = useState<ReturnType<typeof paceZones> | null>(null)
  const [benchmarkMode, setBenchmarkMode] = useState<'race' | 'manual'>('race')
  const [benchmarkRaceId, setBenchmarkRaceId] = useState('')
  const [benchmarkDistId, setBenchmarkDistId] = useState<RunDistId>('10k')
  const [benchmarkCustomVal, setBenchmarkCustomVal] = useState('')
  const [benchmarkCustomUnit, setBenchmarkCustomUnit] = useState<'km' | 'mi'>('km')
  const [benchmarkHMS, setBenchmarkHMS] = useState<HMS>({ h: 0, m: 45, s: 0 })
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null)
  const [workoutType, setWorkoutType] = useState<WorkoutType>('tempo')
  const [workoutMinutes, setWorkoutMinutes] = useState<number>(45)
  const [goalFocus, setGoalFocus] = useState<GoalFocus>('10k')
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null)

  // Age-grade pace projection
  const currentAge = useMemo(() => {
    if (!athlete?.dob) return null
    const dob = new Date(athlete.dob)
    const today = new Date()
    let age = today.getFullYear() - dob.getFullYear()
    if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--
    return age
  }, [athlete?.dob])
  const [ageCalcCurrentAge, setAgeCalcCurrentAge] = useState<string>('')
  const [ageCalcTargetAge, setAgeCalcTargetAge]   = useState<string>('30')

  // ── Triathlon calculator state ─────────────────────────────────────────────
  const [triDistId, setTriDistId]     = useState<TriDistId>('olympic')
  const [swimM, setSwimM]   = useState(2);   const [swimS, setSwimS]   = useState(0)
  const [t1M,   setT1M]     = useState(2);   const [t1S,   setT1S]     = useState(0)
  const [bikeKmh, setBikeKmh] = useState(30)
  const [t2M,   setT2M]     = useState(1);   const [t2S,   setT2S]     = useState(30)
  const [runM,  setRunM]    = useState(5);   const [runS,  setRunS]    = useState(15)
  const [triResult, setTriResult]     = useState<TriResult | null>(null)
  const [triMode, setTriMode]         = useState<'pace' | 'time'>('pace')
  // Time-mode inputs (total duration per segment)
  const [swimTM, setSwimTM] = useState(36);  const [swimTS, setSwimTS] = useState(0)
  const [bikeTH, setBikeTH] = useState(2);   const [bikeTM2, setBikeTM2] = useState(30)
  const [runTH,  setRunTH]  = useState(1);   const [runTM2, setRunTM2]   = useState(45);  const [runTS, setRunTS] = useState(0)

  const races = useRaceStore(s => s.races)
  const benchmarkCandidates = useMemo(() => {
    return races
      .filter(r => Boolean(r.id && r.time && r.date))
      .filter(r => !r.outcome || r.outcome === 'Finished')
      .filter(r => {
        const km = parseDistKm(r.distance)
        return km > 0 && km <= 42.3 && (r.sport?.toLowerCase().includes('run') || !r.sport)
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [races])

  useEffect(() => {
    if (!benchmarkCandidates.length) return
    setBenchmarkRaceId(prev => prev || benchmarkCandidates[0].id)
  }, [benchmarkCandidates])

  const activeVdot = benchmarkResult?.vdot ?? athlete?.currentVdot ?? null
  const activeVdotSourceLabel = benchmarkResult?.raceName ?? athlete?.currentVdotRaceName ?? null
  const activeZones = useMemo(() => {
    if (benchmarkResult?.zones) return benchmarkResult.zones
    if (athlete?.currentVdot) return paceZones(athlete.currentVdot, units)
    return null
  }, [benchmarkResult, athlete?.currentVdot, units])
  const workoutSuggestions = useMemo(() => {
    if (!activeZones) return null
    return buildWorkoutSuggestions({
      type: workoutType,
      minutes: workoutMinutes,
      goal: goalFocus,
      zones: activeZones,
    })
  }, [activeZones, workoutType, workoutMinutes, goalFocus])
  const workoutSuggestion = useMemo(() => {
    if (!workoutSuggestions?.length) return null
    return workoutSuggestions.find(w => w.id === selectedWorkoutId) ?? workoutSuggestions[0]
  }, [workoutSuggestions, selectedWorkoutId])
  const savedWorkouts = athlete?.savedWorkouts ?? []

  useEffect(() => {
    if (!workoutSuggestions?.length) {
      setSelectedWorkoutId(null)
      return
    }
    setSelectedWorkoutId(prev =>
      prev && workoutSuggestions.some(s => s.id === prev) ? prev : workoutSuggestions[0].id
    )
  }, [workoutSuggestions])

  // Track page view on mount
  useEffect(() => { posthog.capture('page_viewed', { page: 'train' }) }, [])

  // ── Running calculation ────────────────────────────────────────────────────

  function getRunKm(): number {
    if (runDistId === 'custom') {
      const n = parseFloat(customVal)
      if (isNaN(n) || n <= 0) return 0
      return customUnit === 'mi' ? n * 1.60934 : n
    }
    return RUN_DISTANCES.find(d => d.id === runDistId)!.km
  }

  function getBenchmarkKm(): number {
    if (benchmarkDistId === 'custom') {
      const n = parseFloat(benchmarkCustomVal)
      if (isNaN(n) || n <= 0) return 0
      return benchmarkCustomUnit === 'mi' ? n * 1.60934 : n
    }
    return RUN_DISTANCES.find(d => d.id === benchmarkDistId)?.km ?? 0
  }

  function calcRun() {
    const totalSecs = hmsToSecs(goalHMS)
    if (!totalSecs) return
    const km = getRunKm()
    if (!km) return
    const paceKm = totalSecs / km
    const paceMi = totalSecs / (km / 1.60934)
    setRunResult({ km: secsToMMSS(paceKm), mi: secsToMMSS(paceMi) })
    const vdot = computeVDOT(totalSecs, km)
    setRunZones(vdot ? paceZones(vdot, units) : null)
  }

  function calcBenchmark() {
    if (benchmarkMode === 'race') {
      const race = benchmarkCandidates.find(r => r.id === benchmarkRaceId)
      if (!race?.time) return
      const timeSecs = parseTimeSecs(race.time)
      const distKm = parseDistKm(race.distance)
      if (!timeSecs || !distKm) return
      const vdot = computeVDOT(timeSecs, distKm)
      if (!vdot) return
      setBenchmarkResult({
        raceName: race.name,
        dateLabel: fmtDateCompact(race.date),
        distLabel: race.distance,
        timeLabel: race.time,
        vdot,
        zones: paceZones(vdot, units),
      })
      const nextBenchmark = {
        currentVdot: vdot,
        currentVdotSource: 'race' as const,
        currentVdotRaceName: race.name,
      }
      const benchmarkChanged =
        athlete?.currentVdot !== nextBenchmark.currentVdot ||
        athlete?.currentVdotSource !== nextBenchmark.currentVdotSource ||
        athlete?.currentVdotRaceName !== nextBenchmark.currentVdotRaceName
      if (benchmarkChanged) {
        updateAthlete({
          ...nextBenchmark,
          currentVdotUpdatedAt: todayStr(),
        })
      }
      return
    }

    const totalSecs = hmsToSecs(benchmarkHMS)
    const km = getBenchmarkKm()
    if (!totalSecs || !km) return
    const vdot = computeVDOT(totalSecs, km)
    if (!vdot) return
    setBenchmarkResult({
      raceName: 'Custom benchmark',
      distLabel: benchmarkDistId === 'custom'
        ? `${benchmarkCustomVal}${benchmarkCustomUnit}`
        : RUN_DISTANCES.find(d => d.id === benchmarkDistId)?.label ?? 'Custom',
      timeLabel: secsToHMS(totalSecs),
      vdot,
      zones: paceZones(vdot, units),
    })
    const nextBenchmark = {
      currentVdot: vdot,
      currentVdotSource: 'manual' as const,
      currentVdotRaceName: 'Custom benchmark',
    }
    const benchmarkChanged =
      athlete?.currentVdot !== nextBenchmark.currentVdot ||
      athlete?.currentVdotSource !== nextBenchmark.currentVdotSource ||
      athlete?.currentVdotRaceName !== nextBenchmark.currentVdotRaceName
    if (benchmarkChanged) {
      updateAthlete({
        ...nextBenchmark,
        currentVdotUpdatedAt: todayStr(),
      })
    }
  }

  function saveWorkout() {
    if (!workoutSuggestion) return
    const savedAt = todayStr()
    const workout: SavedWorkout = {
      id: crypto.randomUUID(),
      workoutId: workoutSuggestion.id,
      title: workoutSuggestion.title,
      subtitle: workoutSuggestion.subtitle,
      rationale: workoutSuggestion.rationale,
      totalMinutes: workoutSuggestion.totalMinutes,
      goalFocus,
      workoutType,
      benchmarkLabel: activeVdotSourceLabel ?? undefined,
      savedAt,
      segments: workoutSuggestion.segments,
      notes: workoutSuggestion.notes,
    }
    updateAthlete({
      savedWorkouts: [workout, ...savedWorkouts.filter(w => w.workoutId !== workout.workoutId)].slice(0, 12),
    })
    posthog.capture('workout_saved', { workout_id: workout.workoutId, workout_type: workoutType, goal_focus: goalFocus })
  }

  function applyRunPB(pb: Race) {
    const secs = parseTimeSecs(pb.time ?? '')
    if (!secs) return
    setGoalHMS(secsToHMS_obj(secs))
    setRunResult(null)
    setRunZones(null)
  }

  function applyTriPB(pb: Race, dist: typeof TRI_DISTANCES[number]) {
    const totalSec = parseTimeSecs(pb.time ?? '')
    if (!totalSec) return
    // Approximate split percentages per distance
    const splits: Record<TriDistId, { swim: number; t1: number; bike: number; t2: number; run: number }> = {
      sprint:   { swim: 0.11, t1: 0.03, bike: 0.48, t2: 0.02, run: 0.36 },
      olympic:  { swim: 0.12, t1: 0.03, bike: 0.46, t2: 0.02, run: 0.37 },
      ptot100:  { swim: 0.04, t1: 0.02, bike: 0.52, t2: 0.02, run: 0.40 },
      '703':    { swim: 0.11, t1: 0.03, bike: 0.50, t2: 0.02, run: 0.34 },
      ironman:  { swim: 0.10, t1: 0.02, bike: 0.51, t2: 0.01, run: 0.36 },
    }
    const pct = splits[dist.id]
    const swimSec  = totalSec * pct.swim
    const bikeSec  = totalSec * pct.bike
    const runSec   = totalSec * pct.run
    const t1Sec    = totalSec * pct.t1
    const t2Sec    = totalSec * pct.t2
    const swimPace = swimSec / (dist.swimM / 100)
    const bikeKph  = dist.bikeKm / (bikeSec / 3600)
    const runPace  = runSec / dist.runKm
    setSwimM(Math.max(0, Math.floor(swimPace / 60)))
    setSwimS(Math.min(59, Math.round(swimPace % 60)))
    setBikeKmh(Math.min(60, Math.max(15, Math.round(bikeKph))))
    setRunM(Math.max(3, Math.floor(runPace / 60)))
    setRunS(Math.min(59, Math.round(runPace % 60)))
    setT1M(Math.floor(t1Sec / 60)); setT1S(Math.min(59, Math.round(t1Sec % 60)))
    setT2M(Math.floor(t2Sec / 60)); setT2S(Math.min(59, Math.round(t2Sec % 60)))
    // Also populate time-mode fields
    const swimR = Math.round(swimSec); setSwimTM(Math.floor(swimR / 60)); setSwimTS(swimR % 60)
    const bikeR = Math.round(bikeSec); setBikeTH(Math.floor(bikeR / 3600)); setBikeTM2(Math.floor((bikeR % 3600) / 60))
    const runR  = Math.round(runSec);  setRunTH(Math.floor(runR / 3600));  setRunTM2(Math.floor((runR % 3600) / 60)); setRunTS(runR % 60)
  }

  // ── Triathlon calculation (live) ───────────────────────────────────────────

  useEffect(() => {
    calcTri()
  }, [swimM, swimS, t1M, t1S, bikeKmh, t2M, t2S, runM, runS, triDistId, triMode, swimTM, swimTS, bikeTH, bikeTM2, runTH, runTM2, runTS]) // eslint-disable-line react-hooks/exhaustive-deps

  function calcTri() {
    const dist = TRI_DISTANCES.find(d => d.id === triDistId)!
    const t1Sec = t1M * 60 + t1S
    const t2Sec = t2M * 60 + t2S

    if (triMode === 'time') {
      const swimSec = swimTM * 60 + swimTS
      const bikeSec = bikeTH * 3600 + bikeTM2 * 60
      const runSec  = runTH  * 3600 + runTM2  * 60 + runTS
      if (swimSec <= 0 || bikeSec <= 0 || runSec <= 0) { setTriResult(null); return }
      setTriResult({ swimSec, t1Sec, bikeSec, t2Sec, runSec, totalSec: swimSec + t1Sec + bikeSec + t2Sec + runSec })
      return
    }

    const paceSecPer100m = swimM * 60 + swimS
    const swimSec = paceSecPer100m > 0 ? (dist.swimM / 100) * paceSecPer100m : null
    const bikeSec = bikeKmh > 0 ? (dist.bikeKm / bikeKmh) * 3600 : null
    const paceSecPerKm = runM * 60 + runS
    const runSec = paceSecPerKm > 0 ? dist.runKm * paceSecPerKm : null

    if (swimSec == null || bikeSec == null || runSec == null) {
      setTriResult(null)
      return
    }

    setTriResult({
      swimSec,
      t1Sec,
      bikeSec,
      t2Sec,
      runSec,
      totalSec: swimSec + t1Sec + bikeSec + t2Sec + runSec,
    })
  }

  // Set default paces when tri distance changes
  useEffect(() => {
    type Def = { swimM: number; swimS: number; bike: number; runM: number; runS: number; t1M: number; t1S: number; t2M: number; t2S: number }
    const defaults: Record<TriDistId, Def> = {
      sprint:   { swimM: 2,   swimS: 0,  bike: 28, runM: 5, runS: 30, t1M: 1, t1S: 30, t2M: 1, t2S: 0  },
      olympic:  { swimM: 2,   swimS: 0,  bike: 30, runM: 5, runS: 15, t1M: 2, t1S: 0,  t2M: 1, t2S: 30 },
      ptot100:  { swimM: 1,   swimS: 55, bike: 34, runM: 4, runS: 45, t1M: 3, t1S: 0,  t2M: 2, t2S: 0  },
      '703':    { swimM: 1,   swimS: 55, bike: 32, runM: 5, runS: 0,  t1M: 4, t1S: 0,  t2M: 3, t2S: 0  },
      ironman:  { swimM: 1,   swimS: 50, bike: 33, runM: 5, runS: 30, t1M: 6, t1S: 0,  t2M: 4, t2S: 0  },
    }
    const d = defaults[triDistId]
    setSwimM(d.swimM); setSwimS(d.swimS)
    setBikeKmh(d.bike)
    setRunM(d.runM); setRunS(d.runS)
    setT1M(d.t1M); setT1S(d.t1S)
    setT2M(d.t2M); setT2S(d.t2S)
    setTriResult(null)
  }, [triDistId])

  const tabStyle = (id: Tab): React.CSSProperties => ({
    background: 'none',
    border: 'none',
    borderBottom: activeTab === id ? '2px solid var(--orange)' : '2px solid transparent',
    color: activeTab === id ? 'var(--white)' : 'var(--muted)',
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: 'var(--text-sm)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '0.6rem 0.75rem',
    cursor: 'pointer',
    transition: 'color 0.15s',
  })

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h1 style={{
        fontFamily: 'var(--headline)',
        fontSize: 'var(--text-xl)',
        fontWeight: 900,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'var(--white)',
        margin: 0,
      }}>
        Train
      </h1>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '0.25rem', gap: '0.25rem' }}>
        {TAB_LABELS.map(t => (
          <button key={t.id} style={tabStyle(t.id)} onClick={() => {
            setActiveTab(t.id)
            if (t.id !== 'pacing') setSport('running')
            posthog.capture('train_tab_changed', { tab: t.id })
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════ TRAIN TOOLS ═══════════════════════════════════ */}
      {activeTab && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Sport selector */}
          {activeTab === 'pacing' && (
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            {(['running', 'triathlon'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSport(s)}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  border: `1px solid ${sport === s ? 'var(--orange)' : 'var(--border2)'}`,
                  borderRadius: 'var(--radius-sm)',
                  background: sport === s ? 'rgba(var(--orange-ch),0.12)' : 'var(--surface2)',
                  color: sport === s ? 'var(--orange)' : 'var(--muted)',
                  fontFamily: 'var(--headline)',
                  fontWeight: 900,
                  fontSize: 'var(--text-sm)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {s === 'running' ? 'Running' : 'Triathlon'}
              </button>
            ))}
          </div>
          )}

          {/* ─── RUNNING CALCULATOR ─── */}
          {sport === 'running' && (
            <>
              {activeTab === 'benchmark' && (
              <div style={card}>
                <p style={sectionLabel}>VDOT Benchmark</p>
                <p style={{ margin: '0 0 12px', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                  Start with a recent race result. We&apos;ll estimate your VDOT and turn it into usable training paces.
                </p>

                <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                  {([
                    { id: 'race', label: 'Use a race' },
                    { id: 'manual', label: 'Enter manually' },
                  ] as const).map(option => (
                    <button
                      key={option.id}
                      onClick={() => setBenchmarkMode(option.id)}
                      style={{
                        flex: 1,
                        padding: '7px 0',
                        background: benchmarkMode === option.id ? 'rgba(var(--orange-ch),0.12)' : 'var(--surface3)',
                        border: `1px solid ${benchmarkMode === option.id ? 'rgba(var(--orange-ch),0.4)' : 'var(--border2)'}`,
                        borderRadius: 'var(--radius-sm)',
                        color: benchmarkMode === option.id ? 'var(--orange)' : 'var(--muted)',
                        fontFamily: 'var(--headline)',
                        fontWeight: 700,
                        fontSize: 'var(--text-xs)',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {benchmarkMode === 'race' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={fieldLabel}>Benchmark Race</label>
                      <div style={{ position: 'relative' }}>
                        <select
                          value={benchmarkRaceId}
                          onChange={e => setBenchmarkRaceId(e.target.value)}
                          style={{
                            width: '100%',
                            background: 'var(--surface3)',
                            border: '1px solid var(--border2)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--white)',
                            fontFamily: 'var(--headline)',
                            fontWeight: 700,
                            fontSize: 'var(--text-compact)',
                            letterSpacing: '0.04em',
                            padding: '0.75rem 2.5rem 0.75rem 0.85rem',
                            cursor: 'pointer',
                            appearance: 'none',
                            WebkitAppearance: 'none' as any,
                            boxSizing: 'border-box',
                          } as React.CSSProperties}
                        >
                          {benchmarkCandidates.length === 0 && <option value="">No running races logged yet</option>}
                          {benchmarkCandidates.map(r => (
                            <option key={r.id} value={r.id}>
                              {r.name} — {r.time} · {r.distance}
                            </option>
                          ))}
                        </select>
                        <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted)', fontSize: 'var(--text-compact)' }}>▾</span>
                      </div>
                    </div>
                    {benchmarkCandidates.length === 0 && (
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                        Log a finished running race up to marathon distance to use it as a benchmark, or switch to manual entry.
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={fieldLabel}>Distance</label>
                      <div style={{ position: 'relative' }}>
                        <select
                          value={benchmarkDistId}
                          onChange={e => setBenchmarkDistId(e.target.value as RunDistId)}
                          style={{
                            width: '100%',
                            background: 'var(--surface3)',
                            border: '1px solid var(--border2)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--white)',
                            fontFamily: 'var(--headline)',
                            fontWeight: 700,
                            fontSize: 'var(--text-compact)',
                            letterSpacing: '0.05em',
                            padding: '0.75rem 2.5rem 0.75rem 0.85rem',
                            cursor: 'pointer',
                            appearance: 'none',
                            WebkitAppearance: 'none' as any,
                            boxSizing: 'border-box',
                          } as React.CSSProperties}
                        >
                          {RUN_DISTANCES.map(d => (
                            <option key={d.id} value={d.id}>{d.label}</option>
                          ))}
                        </select>
                        <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted)', fontSize: 'var(--text-compact)' }}>▾</span>
                      </div>
                    </div>

                    {benchmarkDistId === 'custom' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--sp-2)' }}>
                        <input
                          type="number"
                          inputMode="decimal"
                          placeholder="Distance"
                          value={benchmarkCustomVal}
                          onChange={e => setBenchmarkCustomVal(e.target.value)}
                          style={textInput}
                        />
                        <select
                          value={benchmarkCustomUnit}
                          onChange={e => setBenchmarkCustomUnit(e.target.value as 'km' | 'mi')}
                          style={{ ...textInput, width: '84px', paddingRight: '0.75rem' }}
                        >
                          <option value="km">km</option>
                          <option value="mi">mi</option>
                        </select>
                      </div>
                    )}

                    <div>
                      <label style={fieldLabel}>Benchmark Time</label>
                      <TimePickerWheel value={benchmarkHMS} onChange={setBenchmarkHMS} maxHours={9} />
                    </div>
                  </div>
                )}

                <button
                  style={{ ...btnMain, width: '100%', marginTop: '12px' }}
                  onClick={calcBenchmark}
                  disabled={benchmarkMode === 'race' ? benchmarkCandidates.length === 0 : false}
                >
                  Calculate VDOT
                </button>

                {benchmarkResult && (
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--sp-3)' }}>
                        <div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            {benchmarkResult.raceName}
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted2)', marginTop: '3px' }}>
                            {benchmarkResult.distLabel} · {benchmarkResult.timeLabel}{benchmarkResult.dateLabel ? ` · ${benchmarkResult.dateLabel}` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '36px', lineHeight: 1, color: 'var(--orange)' }}>
                            {benchmarkResult.vdot.toFixed(1)}
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            VDOT
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)' }}>
                      {equivalentPerformances(benchmarkResult.vdot).filter(p => ['5K', '10K', 'Half Marathon', 'Marathon'].includes(p.distance)).map(perf => (
                        <div key={perf.distance} style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 'var(--sp-3)' }}>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            {perf.distance}
                          </div>
                          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-lg)', color: 'var(--white)', marginTop: '4px' }}>
                            {perf.timeStr}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              )}

              {activeTab === 'pacing' && (
              <div style={card}>
                <p style={sectionLabel}>Pace Calculator</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                  {/* Distance dropdown */}
                  <div>
                    <label style={fieldLabel}>Distance</label>
                    <div style={{ position: 'relative' }}>
                      <select
                        value={runDistId}
                        onChange={e => { setRunDistId(e.target.value as RunDistId); setRunResult(null); setRunZones(null); setGoalHMS({ h: 0, m: 0, s: 0 }) }}
                        style={{
                          width: '100%',
                          background: 'var(--surface3)',
                          border: '1px solid var(--border2)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--white)',
                          fontFamily: 'var(--headline)',
                          fontWeight: 700,
                          fontSize: 'var(--text-compact)',
                          letterSpacing: '0.05em',
                          padding: '0.75rem 2.5rem 0.75rem 0.85rem',
                          cursor: 'pointer',
                          appearance: 'none',
                          WebkitAppearance: 'none' as any,
                          boxSizing: 'border-box',
                        } as React.CSSProperties}
                      >
                        {RUN_DISTANCES.map(d => (
                          <option key={d.id} value={d.id}>{d.label}</option>
                        ))}
                      </select>
                      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted)', fontSize: 'var(--text-compact)' }}>▾</span>
                    </div>
                  </div>

                  {/* Custom distance input */}
                  {runDistId === 'custom' && (
                    <div>
                      <label style={fieldLabel}>Custom Distance</label>
                      <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
                        <input
                          type="number"
                          placeholder="e.g. 15"
                          value={customVal}
                          onChange={e => { setCustomVal(e.target.value); setRunResult(null) }}
                          style={{ ...textInput, flex: 1 }}
                        />
                        <div style={{ display: 'flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border2)', flexShrink: 0 }}>
                          {(['km', 'mi'] as const).map(u => (
                            <button
                              key={u}
                              onClick={() => setCustomUnit(u)}
                              style={{
                                padding: '0.65rem 0.9rem',
                                background: customUnit === u ? 'var(--orange)' : 'var(--surface3)',
                                color: customUnit === u ? 'var(--black)' : 'var(--muted)',
                                border: 'none',
                                fontFamily: 'var(--headline)',
                                fontWeight: 900,
                                fontSize: 'var(--text-xs)',
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                cursor: 'pointer',
                              }}
                            >
                              {u}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Goal time wheel */}
                  <div>
                    <label style={fieldLabel}>Goal Time</label>
                    <TimePickerWheel value={goalHMS} onChange={setGoalHMS} maxHours={99} />
                    <p style={{ margin: '6px 0 0', fontSize: 'var(--text-sm)', color: 'var(--muted)', textAlign: 'center' }}>
                      {secsToHMS(hmsToSecs(goalHMS))}
                    </p>
                  </div>

                  {/* Use PB button (for selected distance) */}
                  {(() => {
                    if (runDistId === 'custom') return null
                    const dist = RUN_DISTANCES.find(d => d.id === runDistId)!
                    const pb = findRunPB(races, dist.km)
                    if (!pb) return null
                    return (
                      <button
                        onClick={() => applyRunPB(pb)}
                        style={{
                          background: 'rgba(var(--orange-ch),0.1)',
                          border: '1px solid rgba(var(--orange-ch),0.3)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.6rem 1rem',
                          color: 'var(--orange)',
                          fontFamily: 'var(--headline)',
                          fontWeight: 700,
                          fontSize: 'var(--text-xs)',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          width: '100%',
                        }}
                      >
                        Use My PB — {pb.time}
                      </button>
                    )
                  })()}

                  <button style={{ ...btnMain, width: '100%' }} onClick={calcRun}>
                    Calculate
                  </button>

                  {/* Result */}
                  {runResult && (
                    <div style={{
                      background: 'var(--surface3)',
                      border: '1px solid var(--border2)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '1rem',
                    }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Per km</p>
                        <p style={{ margin: '4px 0 0', fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-xl)', color: units !== 'imperial' ? 'var(--orange)' : 'var(--white)' }}>
                          {runResult.km}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>min/km{units !== 'imperial' && ' ✓'}</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Per mile</p>
                        <p style={{ margin: '4px 0 0', fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-xl)', color: units === 'imperial' ? 'var(--orange)' : 'var(--white)' }}>
                          {runResult.mi}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>min/mi{units === 'imperial' && ' ✓'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              )}

              {/* Splits table — shown after Calculate */}
              {activeTab === 'pacing' && runResult && (() => {
                const totalSecs = hmsToSecs(goalHMS)
                const km = getRunKm()
                if (!totalSecs || !km) return null
                const avgPacePerKm = totalSecs / km
                const milesTotal   = km / 1.60934

                // Pace per km for each half based on strategy
                // even:     all same
                // negative: first half slower, second half faster (runner's negative split)
                // positive: first half faster, second half slower (positive split / fade)
                const halfKm = km / 2
                const variance = splitStrategy === 'even' ? 0 : splitVariancePct / 100
                // firstFactor/secondFactor preserve total time
                const firstFactor  = splitStrategy === 'negative' ? 1 + variance : splitStrategy === 'positive' ? 1 - variance : 1
                const secondFactor = splitStrategy === 'negative' ? 1 - variance : splitStrategy === 'positive' ? 1 + variance : 1

                function paceAtKm(distFromStart: number): number {
                  if (splitStrategy === 'even') return avgPacePerKm
                  return distFromStart <= halfKm ? avgPacePerKm * firstFactor : avgPacePerKm * secondFactor
                }

                function cumulativeSecsAt(distKm: number): number {
                  if (splitStrategy === 'even') return avgPacePerKm * distKm
                  if (distKm <= halfKm) return avgPacePerKm * firstFactor * distKm
                  return avgPacePerKm * firstFactor * halfKm + avgPacePerKm * secondFactor * (distKm - halfKm)
                }

                type SplitRow = { marker: string; split: string; cumulative: string; isFast?: boolean; isSlow?: boolean }
                const rows: SplitRow[] = []

                if (splitsTab === 'km') {
                  const full = Math.floor(km)
                  for (let i = 1; i <= full; i++) {
                    const p = paceAtKm(i - 0.5)
                    const isFast = splitStrategy !== 'even' && p < avgPacePerKm
                    const isSlow = splitStrategy !== 'even' && p > avgPacePerKm
                    rows.push({ marker: `${i} km`, split: secsToMMSS(p), cumulative: secsToHMS(Math.round(cumulativeSecsAt(i))), isFast, isSlow })
                  }
                  const rem = km - full
                  if (rem > 0.01) {
                    const p = paceAtKm(km - rem / 2)
                    rows.push({ marker: `${km % 1 === 0 ? km : km.toFixed(3).replace(/0+$/, '')} km`, split: secsToMMSS(p * rem), cumulative: secsToHMS(totalSecs) })
                  }
                } else if (splitsTab === 'mile') {
                  const full = Math.floor(milesTotal)
                  for (let i = 1; i <= full; i++) {
                    const midKm = (i - 0.5) * 1.60934
                    const p = paceAtKm(midKm) * 1.60934
                    const isFast = splitStrategy !== 'even' && paceAtKm(midKm) < avgPacePerKm
                    const isSlow = splitStrategy !== 'even' && paceAtKm(midKm) > avgPacePerKm
                    rows.push({ marker: `${i} mi`, split: secsToMMSS(p), cumulative: secsToHMS(Math.round(cumulativeSecsAt(i * 1.60934))), isFast, isSlow })
                  }
                  const rem = milesTotal - full
                  if (rem > 0.01) rows.push({ marker: `${milesTotal.toFixed(2)} mi`, split: secsToMMSS(paceAtKm(km) * 1.60934 * rem), cumulative: secsToHMS(totalSecs) })
                } else {
                  const full5 = Math.floor(km / 5)
                  for (let i = 1; i <= full5; i++) {
                    const midKm = (i - 0.5) * 5
                    const p = paceAtKm(midKm) * 5
                    const isFast = splitStrategy !== 'even' && paceAtKm(midKm) < avgPacePerKm
                    const isSlow = splitStrategy !== 'even' && paceAtKm(midKm) > avgPacePerKm
                    rows.push({ marker: `${i * 5} km`, split: secsToMMSS(p), cumulative: secsToHMS(Math.round(cumulativeSecsAt(i * 5))), isFast, isSlow })
                  }
                  const rem = km - full5 * 5
                  if (rem > 0.01) rows.push({ marker: `${km % 1 === 0 ? km : km.toFixed(1)} km`, split: secsToMMSS(paceAtKm(km) * rem), cumulative: secsToHMS(totalSecs) })
                }

                const SPLIT_TABS: { id: typeof splitsTab; label: string }[] = [
                  { id: 'race', label: 'Race Splits' },
                  { id: 'km',   label: 'KM Splits' },
                  { id: 'mile', label: 'Mile Splits' },
                ]

                return (
                  <div style={card}>
                    <p style={sectionLabel}>Splits</p>

                    {/* Split strategy selector */}
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
                      {(['even', 'negative', 'positive'] as const).map(s => (
                        <button key={s} onClick={() => setSplitStrategy(s)} style={{
                          flex: 1, padding: '5px 4px',
                          background: splitStrategy === s ? 'rgba(var(--orange-ch),0.12)' : 'var(--surface3)',
                          border: `1px solid ${splitStrategy === s ? 'rgba(var(--orange-ch),0.4)' : 'var(--border2)'}`,
                          borderRadius: 'var(--radius-sm)',
                          color: splitStrategy === s ? 'var(--orange)' : 'var(--muted)',
                          fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-xs)',
                          letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
                        }}>
                          {s === 'even' ? 'Even' : s === 'negative' ? '↗ Neg Split' : '↘ Pos Split'}
                        </button>
                      ))}
                    </div>

                    {/* Variance % input for pos/neg */}
                    {splitStrategy !== 'even' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: '10px' }}>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          {splitStrategy === 'negative' ? 'Second half faster by' : 'Second half slower by'}
                        </span>
                        <input
                          type="number" min={1} max={15} value={splitVariancePct}
                          onChange={e => setSplitVariancePct(Math.min(15, Math.max(1, parseInt(e.target.value) || 1)))}
                          style={{ width: '48px', textAlign: 'center', background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--orange)', fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-compact)', padding: 'var(--sp-1)' }}
                        />
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>%</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                      {SPLIT_TABS.map(t => (
                        <button
                          key={t.id}
                          onClick={() => setSplitsTab(t.id)}
                          style={{
                            flex: 1,
                            padding: '6px 4px',
                            background: splitsTab === t.id ? 'rgba(var(--orange-ch),0.12)' : 'var(--surface3)',
                            border: `1px solid ${splitsTab === t.id ? 'rgba(var(--orange-ch),0.4)' : 'var(--border2)'}`,
                            borderRadius: 'var(--radius-sm)',
                            color: splitsTab === t.id ? 'var(--orange)' : 'var(--muted)',
                            fontFamily: 'var(--headline)',
                            fontWeight: 700,
                            fontSize: 'var(--text-xs)',
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {/* Header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', padding: '4px 0 8px', borderBottom: '1px solid var(--border2)' }}>
                      {['Split', 'Time', 'Cumulative'].map(h => (
                        <span key={h} style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>{h}</span>
                      ))}
                    </div>
                    {/* Rows */}
                    <div style={{ maxHeight: '260px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                      {rows.map((row, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', padding: '6px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                          <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', color: 'var(--white)' }}>{row.marker}</span>
                          <span style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-sm)', color: row.isFast ? 'var(--green)' : row.isSlow ? '#f97316' : 'var(--muted)' }}>{row.split}</span>
                          <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', color: i === rows.length - 1 ? 'var(--orange)' : 'var(--white)' }}>{row.cumulative}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Training zones */}
              {activeTab === 'pacing' && runZones && (
                <div style={card}>
                  <p style={sectionLabel}>Goal-Time Zones</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                    {runZones.map(z => {
                      const zoneColors = ['#4ade80','#60a5fa','#facc15','#f97316','#ef4444']
                      const color = zoneColors[z.zone - 1] ?? 'var(--orange)'
                      return (
                        <div key={z.zone} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', background: color + '22', border: `1px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', color }}>{z.abbr}</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{z.description}</span>
                              <span style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--white)', flexShrink: 0, marginLeft: '6px' }}>
                                {z.minPaceStr} – {z.maxPaceStr}
                              </span>
                            </div>
                            <div style={{ height: '4px', background: 'var(--surface3)', borderRadius: 'var(--radius-xs)', marginTop: '4px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${(z.zone / 5) * 100}%`, background: color, borderRadius: 'var(--radius-xs)' }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'benchmark' && benchmarkResult && (
                <div style={card}>
                  <p style={sectionLabel}>Benchmark Training Zones</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                    {benchmarkResult.zones.map(z => {
                      const zoneColors = ['#4ade80', '#60a5fa', '#facc15', '#f97316', '#ef4444']
                      const color = zoneColors[z.zone - 1] ?? 'var(--orange)'
                      return (
                        <div key={z.zone} style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 'var(--sp-3)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-2)', alignItems: 'flex-start' }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                                <span style={{ width: '26px', height: '26px', borderRadius: 'var(--radius-sm)', background: `${color}22`, border: `1px solid ${color}55`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', color }}>
                                  {z.abbr}
                                </span>
                                <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', color: 'var(--white)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                  {z.label}
                                </div>
                              </div>
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '6px', lineHeight: 1.4 }}>
                                {z.description}
                              </div>
                            </div>
                            <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {z.minPaceStr} – {z.maxPaceStr}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'builder' && (
              <div style={card}>
                <p style={sectionLabel}>Workout Generator</p>
                <p style={{ margin: '0 0 12px', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                  Use your saved benchmark fitness to get a session with exact paces for today&apos;s intent.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)', marginBottom: '12px' }}>
                  <div>
                    <label style={fieldLabel}>Session Type</label>
                    <div style={{ position: 'relative' }}>
                      <select
                        value={workoutType}
                        onChange={e => setWorkoutType(e.target.value as WorkoutType)}
                        style={{ ...textInput, paddingRight: '2.5rem', appearance: 'none', WebkitAppearance: 'none' as any }}
                      >
                        <option value="recovery">Recovery Run</option>
                        <option value="tempo">Tempo / Threshold</option>
                        <option value="vo2">VO2 Max</option>
                        <option value="long">Long Run</option>
                        <option value="race-pace">Goal Pace</option>
                      </select>
                      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted)', fontSize: 'var(--text-compact)' }}>▾</span>
                    </div>
                  </div>
                  <div>
                    <label style={fieldLabel}>Time Available</label>
                    <div style={{ position: 'relative' }}>
                      <select
                        value={String(workoutMinutes)}
                        onChange={e => setWorkoutMinutes(parseInt(e.target.value, 10))}
                        style={{ ...textInput, paddingRight: '2.5rem', appearance: 'none', WebkitAppearance: 'none' as any }}
                      >
                        {[30, 45, 60, 75, 90].map(minutes => (
                          <option key={minutes} value={minutes}>{minutes} min</option>
                        ))}
                      </select>
                      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted)', fontSize: 'var(--text-compact)' }}>▾</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={fieldLabel}>Goal Focus</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
                    {([
                      ['5k', '5K'],
                      ['10k', '10K'],
                      ['half', 'Half'],
                      ['marathon', 'Full'],
                      ['general', 'General'],
                    ] as Array<[GoalFocus, string]>).map(([value, label]) => (
                      <button
                        key={value}
                        onClick={() => setGoalFocus(value)}
                        style={{
                          padding: '6px 4px',
                          background: goalFocus === value ? 'rgba(var(--orange-ch),0.12)' : 'var(--surface3)',
                          border: `1px solid ${goalFocus === value ? 'rgba(var(--orange-ch),0.4)' : 'var(--border2)'}`,
                          borderRadius: 'var(--radius-sm)',
                          color: goalFocus === value ? 'var(--orange)' : 'var(--muted)',
                          fontFamily: 'var(--headline)',
                          fontWeight: 700,
                          fontSize: 'var(--text-xs)',
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {activeVdot && activeZones && workoutSuggestion ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                    {workoutSuggestions && workoutSuggestions.length > 1 && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)' }}>
                        {workoutSuggestions.map(option => {
                          const selected = option.id === workoutSuggestion.id
                          return (
                            <button
                              key={option.id}
                              onClick={() => setSelectedWorkoutId(option.id)}
                              style={{
                                textAlign: 'left',
                                padding: 'var(--sp-3)',
                                background: selected ? 'rgba(var(--orange-ch),0.12)' : 'var(--surface3)',
                                border: `1px solid ${selected ? 'rgba(var(--orange-ch),0.4)' : 'var(--border2)'}`,
                                borderRadius: 'var(--radius-sm)',
                                color: selected ? 'var(--white)' : 'var(--muted)',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', letterSpacing: '0.04em', textTransform: 'uppercase', color: selected ? 'var(--orange)' : 'var(--white)' }}>
                                {option.title}
                              </div>
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '4px' }}>
                                {option.subtitle}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}

                    <div style={{ background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-3)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--sp-2)' }}>
                        <div>
                          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', color: 'var(--white)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            {workoutSuggestion.title}
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '4px' }}>
                            {workoutSuggestion.subtitle}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-lg)', color: 'var(--orange)' }}>
                            {activeVdot.toFixed(1)}
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            VDOT
                          </div>
                        </div>
                      </div>
                      {activeVdotSourceLabel && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted2)', marginTop: '8px' }}>
                          Using benchmark: {activeVdotSourceLabel}
                        </div>
                      )}
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '8px', lineHeight: 1.5 }}>
                        {workoutSuggestion.rationale}
                      </div>
                      <button
                        onClick={saveWorkout}
                        style={{ ...btnMain, width: '100%', marginTop: '12px' }}
                      >
                        Save Workout
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                      {workoutSuggestion.segments.map(segment => (
                        <div key={`${segment.label}-${segment.detail}`} style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 'var(--sp-3)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--sp-2)' }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', color: 'var(--white)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                {segment.label}
                              </div>
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '4px' }}>
                                {segment.detail}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                {segment.zone} pace
                              </div>
                              <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', color: 'var(--orange)', marginTop: '4px' }}>
                                {segment.pace}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 'var(--sp-3)' }}>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--headline)', fontWeight: 700, marginBottom: '6px' }}>
                        Session Notes
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {workoutSuggestion.notes.map(note => (
                          <div key={note} style={{ fontSize: 'var(--text-xs)', color: 'var(--white)', lineHeight: 1.5 }}>
                            {note}
                          </div>
                        ))}
                      </div>
                    </div>

                    {savedWorkouts.length > 0 && (
                      <div style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 'var(--sp-3)' }}>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--headline)', fontWeight: 700, marginBottom: '8px' }}>
                          Saved Workouts
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {savedWorkouts.slice(0, 3).map(workout => (
                            <div key={workout.id} style={{ padding: '8px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-2)', alignItems: 'baseline' }}>
                                <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', color: 'var(--white)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                  {workout.title}
                                </div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted2)', whiteSpace: 'nowrap' }}>
                                  {workout.savedAt}
                                </div>
                              </div>
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '4px' }}>
                                {workout.subtitle}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                    Calculate and save a VDOT benchmark first to unlock session suggestions.
                  </div>
                )}
              </div>
              )}
              {/* Age-Grade Pace Projection */}
              {activeTab === 'pacing' && (() => {
                const resolvedCurrentAge = ageCalcCurrentAge !== '' ? parseInt(ageCalcCurrentAge) : currentAge
                const targetAge = parseInt(ageCalcTargetAge)
                const gender = athlete?.gender ?? 'M'

                // Find PBs at standard distances from logged races
                const PB_DISTS = [
                  { label: '5K',           km: 5 },
                  { label: '10K',          km: 10 },
                  { label: 'Half Marathon',km: 21.0975 },
                  { label: 'Marathon',     km: 42.195 },
                ]
                // Age the athlete was on a given race date (for age-at-PB grading).
                const dobDate = athlete?.dob ? new Date(athlete.dob) : null
                const ageOnDate = (raceDate?: string): number | null => {
                  if (!dobDate || isNaN(dobDate.getTime()) || !raceDate) return null
                  const d = new Date(raceDate)
                  if (isNaN(d.getTime())) return null
                  let a = d.getFullYear() - dobDate.getFullYear()
                  if (d.getMonth() < dobDate.getMonth() || (d.getMonth() === dobDate.getMonth() && d.getDate() < dobDate.getDate())) a--
                  return a >= 5 && a <= 100 ? a : null
                }

                const pbRows = PB_DISTS.map(d => {
                  const pb = findRunPB(races, d.km)
                  if (!pb?.time) return null
                  const timeSecs = parseTimeSecs(pb.time)
                  if (!timeSecs) return null
                  // Grade each PB from the age it was actually SET at (race date − DOB),
                  // not the athlete's current age — a PB run at 47 must not be projected
                  // as if it were run at 54. Fall back to the manual/profile age only when
                  // the race has no date or DOB is unknown.
                  const ageAtPB = ageOnDate(pb.date) ?? (resolvedCurrentAge || null)
                  return { label: d.label, km: d.km, timeSecs, timeStr: pb.time, ageAtPB }
                }).filter(Boolean) as { label: string; km: number; timeSecs: number; timeStr: string; ageAtPB: number | null }[]

                if (!pbRows.length && !resolvedCurrentAge) return null

                const canProject = !isNaN(targetAge) && targetAge >= 15 && targetAge <= 90 && pbRows.some(r => r.ageAtPB)

                return (
                  <div style={card}>
                    <p style={sectionLabel}>Age-Grade Pace Projection</p>
                    <p style={{ margin: '0 0 12px', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                      See what your PB paces would look like at a different age, based on WA masters age-grading factors.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)', marginBottom: '12px' }}>
                      <div>
                        <label style={fieldLabel}>Current Age</label>
                        <input
                          type="number" min={15} max={90}
                          placeholder={currentAge ? String(currentAge) : 'e.g. 32'}
                          value={ageCalcCurrentAge}
                          onChange={e => setAgeCalcCurrentAge(e.target.value)}
                          style={{ ...textInput, fontSize: 'var(--text-base)' }}
                        />
                        {currentAge && !ageCalcCurrentAge && (
                          <p style={{ margin: '3px 0 0', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>From your profile</p>
                        )}
                      </div>
                      <div>
                        <label style={fieldLabel}>Target Age</label>
                        <input
                          type="number" min={15} max={90}
                          value={ageCalcTargetAge}
                          onChange={e => setAgeCalcTargetAge(e.target.value)}
                          style={{ ...textInput, fontSize: 'var(--text-base)' }}
                        />
                      </div>
                    </div>

                    {canProject && pbRows.length > 0 && (() => {
                      const toFactor = waAgeFactor(targetAge, gender)

                      return (
                        <>
                          <div style={{ marginBottom: '10px', padding: '7px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--surface3)', border: '1px solid var(--border)' }}>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', lineHeight: 1.4 }}>
                              Each PB is projected from the age you set it at to age {targetAge}.
                            </span>
                          </div>

                          {/* PB projection table */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--sp-2)', padding: '4px 0 8px', borderBottom: '1px solid var(--border2)' }}>
                            {['Distance', 'Your PB', `Age ${targetAge}`].map(h => (
                              <span key={h} style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>{h}</span>
                            ))}
                          </div>
                          {pbRows.map(row => {
                            if (!row.ageAtPB) return null
                            const ratio = toFactor / waAgeFactor(row.ageAtPB, gender)
                            const projSecs = row.timeSecs * ratio
                            const projStr  = secsToHMS(Math.round(projSecs))
                            const projPaceKm = secsToMMSS(projSecs / row.km)
                            return (
                              <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--sp-2)', padding: '10px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--headline)', fontWeight: 700 }}>{row.label}</span>
                                <div>
                                  <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-compact)', color: 'var(--white)' }}>{row.timeStr}</div>
                                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '2px' }}>at age {row.ageAtPB}</div>
                                </div>
                                <div>
                                  <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-compact)', color: ratio < 1 ? 'var(--green)' : ratio > 1 ? '#f97316' : 'var(--white)' }}>{projStr}</div>
                                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '2px' }}>{projPaceKm}/km</div>
                                </div>
                              </div>
                            )
                          })}

                          {/* How it works */}
                          <div style={{ marginTop: '14px', padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)', background: 'var(--surface3)', border: '1px solid var(--border)' }}>
                            <p style={{ margin: '0 0 8px', fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>How it works</p>
                            <p style={{ margin: '0 0 6px', fontSize: 'var(--text-xs)', color: 'var(--muted)', lineHeight: 1.5 }}>
                              Formula: <span style={{ color: 'var(--white)', fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>projected = current × (factor_target / factor_current)</span>
                            </p>
                            <p style={{ margin: '0 0 10px', fontSize: 'var(--text-xs)', color: 'var(--muted)', lineHeight: 1.5 }}>
                              Age factors are from the <strong style={{ color: 'var(--white)' }}>World Athletics Masters Age-Grading Tables 2023</strong>. Factor 1.000 = peak performance zone (ages 25–30). Values above 1.0 reflect natural physiological changes from that peak.
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', marginBottom: '10px' }}>
                              {([15,20,25,35,40,45,50,55,60,65] as number[]).map(a => {
                                const f = waAgeFactor(a, gender)
                                return (
                                  <div key={a} style={{ textAlign: 'center', padding: '5px 2px', borderRadius: 'var(--radius-sm)', background: f <= 1.0 ? 'rgba(0,255,136,0.08)' : 'var(--surface2)', border: `1px solid ${f <= 1.0 ? 'rgba(0,255,136,0.2)' : 'var(--border)'}` }}>
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700 }}>Age {a}</div>
                                    <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 900, color: f <= 1.0 ? 'var(--green)' : 'var(--white)' }}>{f.toFixed(3)}</div>
                                  </div>
                                )
                              })}
                            </div>
                            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--muted)', lineHeight: 1.4 }}>
                              Note: ages 25–30 are all 1.000 (identical peak zone) — no change between these ages is correct per the WA standard. Source: <a href="https://worldathletics.org/masters/masters-age-grading" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--orange)', textDecoration: 'none' }}>worldathletics.org/masters</a>
                            </p>
                          </div>
                        </>
                      )
                    })()}

                    {canProject && pbRows.length === 0 && (
                      <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>Log timed races at 5K–Marathon distances to see pace projections.</p>
                    )}
                    {!canProject && (
                      <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>Enter a target age above. PBs are graded from the age you set them at (needs your date of birth in your profile, or a fallback current age).</p>
                    )}
                  </div>
                )
              })()}
            </>
          )}

          {/* ─── TRIATHLON CALCULATOR ─── */}
          {activeTab === 'pacing' && sport === 'triathlon' && (
            <div style={card}>
              <p style={sectionLabel}>Triathlon Calculator</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* Tri distance dropdown */}
                {(() => {
                  const activeDist = TRI_DISTANCES.find(d => d.id === triDistId)!
                  const triDistPB = findTriPB(races, activeDist.totalKm)
                  return (
                    <div>
                      <label style={fieldLabel}>Distance</label>
                      <div style={{ position: 'relative' }}>
                        <select
                          value={triDistId}
                          onChange={e => setTriDistId(e.target.value as TriDistId)}
                          style={{
                            width: '100%',
                            background: 'var(--surface3)',
                            border: '1px solid var(--border2)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--white)',
                            fontFamily: 'var(--headline)',
                            fontWeight: 700,
                            fontSize: 'var(--text-compact)',
                            letterSpacing: '0.05em',
                            padding: '0.75rem 2.5rem 0.75rem 0.85rem',
                            cursor: 'pointer',
                            appearance: 'none',
                            WebkitAppearance: 'none' as any,
                            boxSizing: 'border-box',
                          } as React.CSSProperties}
                        >
                          {TRI_DISTANCES.map(d => {
                            const pb = findTriPB(races, d.totalKm)
                            return (
                              <option key={d.id} value={d.id}>
                                {d.label}{pb ? `  —  PB ${pb.time}` : ''}
                              </option>
                            )
                          })}
                        </select>
                        <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted)', fontSize: 'var(--text-compact)' }}>▾</span>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                        Swim {activeDist.swimM >= 1000 ? `${activeDist.swimM / 1000}km` : `${activeDist.swimM}m`} · Bike {activeDist.bikeKm}km · Run {activeDist.runKm}km
                      </p>
                      {triDistPB && (
                        <button
                          onClick={() => applyTriPB(triDistPB, activeDist)}
                          style={{
                            marginTop: '8px',
                            width: '100%',
                            background: 'rgba(var(--orange-ch),0.1)',
                            border: '1px solid rgba(var(--orange-ch),0.3)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.6rem 1rem',
                            color: 'var(--orange)',
                            fontFamily: 'var(--headline)',
                            fontWeight: 700,
                            fontSize: 'var(--text-xs)',
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                          }}
                        >
                          Use My PB — {triDistPB.time}
                        </button>
                      )}
                    </div>
                  )
                })()}

                {/* Segment inputs — compact pace table */}
                {(() => {
                  const dist = TRI_DISTANCES.find(d => d.id === triDistId)!
                  const triPB = findTriPB(races, dist.totalKm)
                  const swimDistLabel = dist.swimM >= 1000 ? `${dist.swimM / 1000}km` : `${dist.swimM}m`

                  const numInput = (
                    val: number, setter: (v: number) => void,
                    min: number, max: number, w = 44
                  ) => (
                    <input
                      type="number" min={min} max={max} value={val}
                      onChange={e => {
                        const n = parseInt(e.target.value, 10)
                        if (!isNaN(n)) setter(Math.min(max, Math.max(min, n)))
                      }}
                      style={{
                        width: `${w}px`, textAlign: 'center',
                        background: 'var(--surface)', border: '1px solid var(--border2)',
                        borderRadius: 'var(--radius-sm)', color: 'var(--white)',
                        fontFamily: 'var(--headline)', fontWeight: 900,
                        fontSize: 'var(--text-base)', padding: '6px 4px',
                        MozAppearance: 'textfield',
                      } as React.CSSProperties}
                    />
                  )
                  const sep = <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-base)', color: 'var(--muted)', padding: '0 2px' }}>:</span>
                  const estTime = (sec: number | null) => sec && sec > 0
                    ? <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-base)', color: 'var(--orange)', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>{secsToHMS(sec)}</span>
                    : <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>—</span>
                  const estPace = (label: string) =>
                    <span style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{label}</span>

                  const row = (
                    emoji: string, label: string, sub: string,
                    pace: React.ReactNode, unit: string,
                    sec: number | null, isLast = false,
                    rightOverride?: React.ReactNode,
                  ) => (
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr auto auto',
                      gap: 'var(--sp-2)', alignItems: 'center',
                      padding: '10px 0',
                      borderBottom: isLast ? 'none' : '1px solid var(--border)',
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)', fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', color: 'var(--white)', letterSpacing: '0.04em' }}>
                          <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-xs)', letterSpacing: '0.06em', color: 'var(--orange)', background: 'rgba(var(--orange-ch),0.12)', borderRadius: 'var(--radius-xs)', padding: '1px 4px' }}>{emoji}</span>
                          {label}
                        </span>
                        {sub && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginLeft: '6px' }}>{sub}</span>}
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', letterSpacing: '0.04em', marginTop: '1px' }}>{unit}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>{pace}</div>
                      <div style={{ textAlign: 'right', minWidth: '64px' }}>{rightOverride !== undefined ? rightOverride : estTime(sec)}</div>
                    </div>
                  )

                  // Derived paces for time mode right column
                  const swimSecTM = swimTM * 60 + swimTS
                  const bikeSecTM = bikeTH * 3600 + bikeTM2 * 60
                  const runSecTM  = runTH  * 3600 + runTM2  * 60 + runTS
                  const swimPaceLabel = swimSecTM > 0 ? `${secsToMMSS(swimSecTM / (dist.swimM / 100))} /100m` : '—'
                  const bikeSpeedLabel = bikeSecTM > 0 ? `${(dist.bikeKm / (bikeSecTM / 3600)).toFixed(1)} km/h` : '—'
                  const runPaceLabel  = runSecTM  > 0 ? `${secsToMMSS(runSecTM / dist.runKm)} /km` : '—'

                  return (
                    <div>
                      {/* Mode toggle */}
                      <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: '12px' }}>
                        {(['pace', 'time'] as const).map(m => (
                          <button key={m} onClick={() => setTriMode(m)} style={{
                            flex: 1, padding: '7px 0',
                            background: triMode === m ? 'rgba(var(--orange-ch),0.12)' : 'var(--surface3)',
                            border: `1px solid ${triMode === m ? 'rgba(var(--orange-ch),0.4)' : 'var(--border2)'}`,
                            borderRadius: 'var(--radius-sm)',
                            color: triMode === m ? 'var(--orange)' : 'var(--muted)',
                            fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-xs)',
                            letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
                          }}>
                            {m === 'pace' ? 'Enter Pace → Time' : 'Enter Time → Pace'}
                          </button>
                        ))}
                      </div>

                      {/* Column headers */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 'var(--sp-2)', paddingBottom: '6px', borderBottom: '2px solid var(--border2)' }}>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Segment</span>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{triMode === 'pace' ? 'Pace' : 'Time'}</span>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', minWidth: '64px', textAlign: 'right' }}>{triMode === 'pace' ? 'Time' : 'Pace'}</span>
                      </div>

                      {triMode === 'pace' ? (<>
                        {row('SW', 'Swim', swimDistLabel, <>{numInput(swimM,setSwimM,1,10)}{sep}{numInput(swimS,setSwimS,0,59)}</>, 'min / 100m', triResult?.swimSec ?? null)}
                        {row('T1', 'T1', '', <>{numInput(t1M,setT1M,0,15)}{sep}{numInput(t1S,setT1S,0,59)}</>, 'mm : ss', triResult?.t1Sec ?? null)}
                        {row('BK', 'Bike', `${dist.bikeKm}km`, numInput(bikeKmh,setBikeKmh,10,60,52), 'km / h', triResult?.bikeSec ?? null)}
                        {row('T2', 'T2', '', <>{numInput(t2M,setT2M,0,15)}{sep}{numInput(t2S,setT2S,0,59)}</>, 'mm : ss', triResult?.t2Sec ?? null)}
                        {row('RN', 'Run', `${dist.runKm}km`, <>{numInput(runM,setRunM,3,20)}{sep}{numInput(runS,setRunS,0,59)}</>, 'min / km', triResult?.runSec ?? null, true)}
                      </>) : (<>
                        {row('SW', 'Swim', swimDistLabel, <>{numInput(swimTM,setSwimTM,0,59)}{sep}{numInput(swimTS,setSwimTS,0,59)}</>, 'mm : ss', null, false, estPace(swimPaceLabel))}
                        {row('T1', 'T1', '', <>{numInput(t1M,setT1M,0,15)}{sep}{numInput(t1S,setT1S,0,59)}</>, 'mm : ss', triResult?.t1Sec ?? null)}
                        {row('BK', 'Bike', `${dist.bikeKm}km`, <>{numInput(bikeTH,setBikeTH,0,9,32)}h{' '}{numInput(bikeTM2,setBikeTM2,0,59)}</>, 'h : mm', null, false, estPace(bikeSpeedLabel))}
                        {row('T2', 'T2', '', <>{numInput(t2M,setT2M,0,15)}{sep}{numInput(t2S,setT2S,0,59)}</>, 'mm : ss', triResult?.t2Sec ?? null)}
                        {row('RN', 'Run', `${dist.runKm}km`, <>{numInput(runTH,setRunTH,0,9,32)}h{' '}{numInput(runTM2,setRunTM2,0,59)}{sep}{numInput(runTS,setRunTS,0,59)}</>, 'h : mm : ss', null, true, estPace(runPaceLabel))}
                      </>)}

                      {/* Total row */}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 0 0', borderTop: '2px solid var(--border2)', marginTop: '4px',
                      }}>
                        <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--white)' }}>
                          Total Finish Time
                        </span>
                        {triResult
                          ? <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '28px', color: 'var(--orange)' }}>{secsToHMS(triResult.totalSec)}</span>
                          : <span style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>Fill in paces above</span>
                        }
                      </div>

                      {/* PB reference */}
                      {triPB && (
                        <div style={{ background: 'rgba(var(--orange-ch),0.06)', border: '1px solid rgba(var(--orange-ch),0.2)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>Your best at this distance</span>
                          <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-compact)', color: 'var(--orange)' }}>{triPB.time}</span>
                        </div>
                      )}

                      {/* Segment breakdown bar */}
                      {triResult && triResult.totalSec > 0 && (() => {
                        const segs = [
                          { label: 'Swim', sec: triResult.swimSec, color: '#60a5fa' },
                          { label: 'T1',   sec: triResult.t1Sec,   color: '#94a3b8' },
                          { label: 'Bike', sec: triResult.bikeSec, color: '#f97316' },
                          { label: 'T2',   sec: triResult.t2Sec,   color: '#94a3b8' },
                          { label: 'Run',  sec: triResult.runSec,  color: '#4ade80' },
                        ]
                        return (
                          <div>
                            <p style={{ margin: '0 0 8px', fontSize: 'var(--text-xs)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--headline)', fontWeight: 700 }}>Time Split</p>
                            <div style={{ display: 'flex', height: '12px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', gap: '1px' }}>
                              {segs.map(seg => <div key={seg.label} style={{ width: `${(seg.sec / triResult.totalSec) * 100}%`, background: seg.color, minWidth: seg.sec > 0 ? '2px' : '0' }} />)}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', marginTop: '8px' }}>
                              {segs.map(seg => (
                                <div key={seg.label}>
                                  <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 700, color: seg.color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{seg.label}</div>
                                  <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 900, color: 'var(--white)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{secsToHMS(seg.sec)}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

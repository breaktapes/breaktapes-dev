import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useRaceStore } from '@/stores/useRaceStore'
import { useWearableStore } from '@/stores/useWearableStore'
import { handleWhoopCallback, fetchWhoopActivities, fetchWhoopRecovery } from '@/lib/whoop'
import { handleGarminCallback, fetchGarminActivities } from '@/lib/garmin'
import { handleStravaCallback, fetchStravaActivities, stravaActivitiesToRaces } from '@/lib/strava'
import { computeVDOT, paceZones, parseDistKm, parseTimeSecs, secsToHMS } from '@/lib/raceFormulas'
import { useUnits } from '@/lib/units'
import { TimePickerWheel } from '@/components/TimePickerWheel'
import type { HMS } from '@/components/TimePickerWheel'
import type { Race } from '@/types'

const btnMain: React.CSSProperties = {
  background: 'var(--orange)',
  color: 'var(--black)',
  border: 'none',
  borderRadius: '4px',
  padding: '0.8rem 1.25rem',
  fontFamily: 'var(--headline)',
  fontWeight: 900,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontSize: '13px',
}

const card: React.CSSProperties = {
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
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
  borderRadius: '6px',
  color: 'var(--white)',
  fontSize: '15px',
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

type TriDistId = 'sprint' | 'olympic' | '703' | 'ironman'

interface TriDist { id: TriDistId; label: string; swimM: number; bikeKm: number; runKm: number; totalKm: number }

const TRI_DISTANCES: TriDist[] = [
  { id: 'sprint',  label: 'Sprint Triathlon',       swimM: 750,  bikeKm: 20,  runKm: 5,    totalKm: 25.75 },
  { id: 'olympic', label: 'Olympic Triathlon',      swimM: 1500, bikeKm: 40,  runKm: 10,   totalKm: 51.5  },
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

type Tab = 'pace' | 'activities' | 'readiness'

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: 'pace',       label: 'Pace' },
  { id: 'activities', label: 'Activities' },
  { id: 'readiness',  label: 'Readiness' },
]

// ── Activity feed types ────────────────────────────────────────────────────

interface ActivityItem {
  id: string
  source: 'WHOOP' | 'Garmin' | 'Strava'
  name: string
  date: string
  distanceKm?: number
  durationMin?: number
  avgHR?: number
  strain?: number
}


function whoopSportName(id: number): string {
  const names: Record<number, string> = {
    0: 'Activity', 1: 'Running', 2: 'Cycling', 3: 'Swimming',
    44: 'Weightlifting', 45: 'Yoga', 63: 'Hiking', 71: 'Triathlon',
    72: 'Rowing', 73: 'Walking', 74: 'HIIT',
  }
  return names[id] ?? 'Activity'
}

// ─── Triathlon result type ────────────────────────────────────────────────────

interface TriResult {
  swimSec: number
  t1Sec: number
  bikeSec: number
  t2Sec: number
  runSec: number
  totalSec: number
}

export function Train() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<Tab>('pace')
  const units = useUnits()
  const [oauthStatus, setOauthStatus] = useState<string | null>(null)

  // ── Pace tab: sport selector ───────────────────────────────────────────────
  const [sport, setSport] = useState<'running' | 'triathlon'>('running')

  // ── Running calculator state ───────────────────────────────────────────────
  const [runDistId, setRunDistId]     = useState<RunDistId>('hm')
  const [customVal, setCustomVal]     = useState('')
  const [customUnit, setCustomUnit]   = useState<'km' | 'mi'>('km')
  const [goalHMS, setGoalHMS]         = useState<HMS>({ h: 0, m: 0, s: 0 })
  const [splitsTab, setSplitsTab]     = useState<'km' | 'mile' | 'race'>('race')
  const [runResult, setRunResult]     = useState<{ km: string; mi: string } | null>(null)
  const [runZones, setRunZones]       = useState<ReturnType<typeof paceZones> | null>(null)

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

  // Activity feed state
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [stravaRaceCount, setStravaRaceCount] = useState(0)
  const [importingRaces, setImportingRaces] = useState(false)
  const [importDone, setImportDone] = useState<string | null>(null)
  const [recoveryData, setRecoveryData] = useState<Array<{ date: string; score: number; hrv?: number; rhr?: number }>>([])
  const [recoveryLoading, setRecoveryLoading] = useState(false)

  const races = useRaceStore(s => s.races)
  const addRace = useRaceStore(s => s.addRace)
  const whoopToken  = useWearableStore(s => s.whoopToken)
  const garminToken = useWearableStore(s => s.garminToken)
  const stravaToken = useWearableStore(s => s.stravaToken)
  const hasAnyWearable = !!(whoopToken || garminToken || stravaToken)

  // Handle OAuth callbacks
  useEffect(() => {
    const state    = searchParams.get('state')
    const code     = searchParams.get('code')
    const oauthErr = searchParams.get('error')

    if (!state) return

    window.history.replaceState({}, '', window.location.pathname)

    if (oauthErr) {
      const provider = state.split(':')[0]
      const desc = searchParams.get('error_description') ?? oauthErr
      setOauthStatus(`Failed to connect ${provider}: ${desc}`)
      return
    }

    if (!code) return

    async function finish() {
      try {
        const provider = state?.split(':')[0]
        if (provider === 'whoop')  await handleWhoopCallback(code!, state!)
        if (provider === 'garmin') await handleGarminCallback(code!, state!)
        if (provider === 'strava') await handleStravaCallback(code!, state!)
        if (!provider || !['whoop', 'garmin', 'strava'].includes(provider)) return
        setOauthStatus(`${provider.charAt(0).toUpperCase() + provider.slice(1)} connected! ✓`)
        setActiveTab('activities')
      } catch (err) {
        const provider = state?.split(':')[0] ?? state
        console.error('OAuth callback failed:', err)
        const msg = err instanceof Error ? err.message : String(err)
        setOauthStatus(`Failed to connect ${provider}: ${msg}`)
      }
    }
    finish()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load activity feed
  useEffect(() => {
    if (activeTab !== 'activities' || !hasAnyWearable) return
    let cancelled = false
    async function load() {
      setFeedLoading(true)
      try {
        const [whoopActs, garminActs, stravaActs] = await Promise.all([
          whoopToken  ? fetchWhoopActivities(20)    : Promise.resolve([]),
          garminToken ? fetchGarminActivities(20)   : Promise.resolve([]),
          stravaToken ? fetchStravaActivities(100)  : Promise.resolve([]),
        ])
        if (cancelled) return

        const newRaces = stravaActivitiesToRaces(stravaActs, races)
        setStravaRaceCount(newRaces.length)

        const merged: ActivityItem[] = [
          ...whoopActs.map(a => ({
            id: String(a.id),
            source: 'WHOOP' as const,
            name: whoopSportName(a.sport_id),
            date: a.start,
            durationMin: a.end ? Math.round((new Date(a.end).getTime() - new Date(a.start).getTime()) / 60000) : undefined,
            strain: a.strain,
          })),
          ...garminActs.map(a => ({
            id: String(a.activityId),
            source: 'Garmin' as const,
            name: a.activityName || a.activityType?.typeKey || 'Activity',
            date: a.startTimeGmt,
            distanceKm: a.distance ? a.distance / 1000 : undefined,
            durationMin: a.duration ? Math.round(a.duration / 60) : undefined,
            avgHR: a.averageHR,
          })),
          ...stravaActs.map(a => ({
            id: `strava-${a.id}`,
            source: 'Strava' as const,
            name: a.name,
            date: a.start_date_local ?? '',
            distanceKm: a.distance ? Math.round(a.distance / 100) / 10 : undefined,
            durationMin: a.elapsed_time ? Math.round(a.elapsed_time / 60) : undefined,
          })),
        ]
        merged.sort((a, b) => b.date.localeCompare(a.date))
        setActivities(merged)
      } finally {
        if (!cancelled) setFeedLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [activeTab, hasAnyWearable, whoopToken, garminToken, stravaToken]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleImportStravaRaces() {
    setImportingRaces(true)
    setImportDone(null)
    try {
      const stravaActs = await fetchStravaActivities(100)
      const newRaces = stravaActivitiesToRaces(stravaActs, races)
      for (const r of newRaces) {
        addRace({ ...r, id: crypto.randomUUID() } as import('@/types').Race)
      }
      setStravaRaceCount(0)
      setImportDone(
        newRaces.length > 0
          ? `${newRaces.length} race${newRaces.length > 1 ? 's' : ''} imported from Strava`
          : 'No new races to import'
      )
    } catch {
      setImportDone('Import failed — try again')
    } finally {
      setImportingRaces(false)
    }
  }

  useEffect(() => {
    if (activeTab !== 'readiness' || !whoopToken) return
    let cancelled = false
    async function loadRecovery() {
      setRecoveryLoading(true)
      try {
        const records = await fetchWhoopRecovery(30)
        if (cancelled) return
        const parsed = records
          .map(r => ({
            date: r.created_at?.slice(0, 10) ?? '',
            score: r.score?.recovery_score ?? 0,
            hrv: r.score?.hrv_rmssd_milli,
            rhr: r.score?.resting_heart_rate,
          }))
          .filter(r => r.date && r.score > 0)
          .sort((a, b) => b.date.localeCompare(a.date))
        setRecoveryData(parsed)
      } finally {
        if (!cancelled) setRecoveryLoading(false)
      }
    }
    loadRecovery()
    return () => { cancelled = true }
  }, [activeTab, whoopToken]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Running calculation ────────────────────────────────────────────────────

  function getRunKm(): number {
    if (runDistId === 'custom') {
      const n = parseFloat(customVal)
      if (isNaN(n) || n <= 0) return 0
      return customUnit === 'mi' ? n * 1.60934 : n
    }
    return RUN_DISTANCES.find(d => d.id === runDistId)!.km
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
      sprint:  { swim: 0.11, t1: 0.03, bike: 0.48, t2: 0.02, run: 0.36 },
      olympic: { swim: 0.12, t1: 0.03, bike: 0.46, t2: 0.02, run: 0.37 },
      '703':   { swim: 0.11, t1: 0.03, bike: 0.50, t2: 0.02, run: 0.34 },
      ironman: { swim: 0.10, t1: 0.02, bike: 0.51, t2: 0.01, run: 0.36 },
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
      sprint:  { swimM: 2,   swimS: 0,  bike: 28, runM: 5, runS: 30, t1M: 1, t1S: 30, t2M: 1, t2S: 0  },
      olympic: { swimM: 2,   swimS: 0,  bike: 30, runM: 5, runS: 15, t1M: 2, t1S: 0,  t2M: 1, t2S: 30 },
      '703':   { swimM: 1,   swimS: 55, bike: 32, runM: 5, runS: 0,  t1M: 4, t1S: 0,  t2M: 3, t2S: 0  },
      ironman: { swimM: 1,   swimS: 50, bike: 33, runM: 5, runS: 30, t1M: 6, t1S: 0,  t2M: 4, t2S: 0  },
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
        fontSize: '22px',
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
          <button key={t.id} style={tabStyle(t.id)} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════ PACE TAB ══════════════════════════════════════ */}
      {activeTab === 'pace' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Sport selector */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['running', 'triathlon'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSport(s)}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  border: `1px solid ${sport === s ? 'var(--orange)' : 'var(--border2)'}`,
                  borderRadius: '6px',
                  background: sport === s ? 'rgba(var(--orange-ch),0.12)' : 'var(--surface2)',
                  color: sport === s ? 'var(--orange)' : 'var(--muted)',
                  fontFamily: 'var(--headline)',
                  fontWeight: 900,
                  fontSize: '13px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {s === 'running' ? '🏃 Running' : '🏊 Triathlon'}
              </button>
            ))}
          </div>

          {/* ─── RUNNING CALCULATOR ─── */}
          {sport === 'running' && (
            <>
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
                          borderRadius: '8px',
                          color: 'var(--white)',
                          fontFamily: 'var(--headline)',
                          fontWeight: 700,
                          fontSize: '14px',
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
                      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted)', fontSize: '14px' }}>▾</span>
                    </div>
                  </div>

                  {/* Custom distance input */}
                  {runDistId === 'custom' && (
                    <div>
                      <label style={fieldLabel}>Custom Distance</label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="number"
                          placeholder="e.g. 15"
                          value={customVal}
                          onChange={e => { setCustomVal(e.target.value); setRunResult(null) }}
                          style={{ ...textInput, flex: 1 }}
                        />
                        <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border2)', flexShrink: 0 }}>
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
                                fontSize: '12px',
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
                    <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--muted)', textAlign: 'center' }}>
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
                          borderRadius: '6px',
                          padding: '0.6rem 1rem',
                          color: 'var(--orange)',
                          fontFamily: 'var(--headline)',
                          fontWeight: 700,
                          fontSize: '12px',
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
                      borderRadius: '8px',
                      padding: '1rem',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '1rem',
                    }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Per km</p>
                        <p style={{ margin: '4px 0 0', fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '24px', color: units !== 'imperial' ? 'var(--orange)' : 'var(--white)' }}>
                          {runResult.km}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--muted)' }}>min/km{units !== 'imperial' && ' ✓'}</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Per mile</p>
                        <p style={{ margin: '4px 0 0', fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '24px', color: units === 'imperial' ? 'var(--orange)' : 'var(--white)' }}>
                          {runResult.mi}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--muted)' }}>min/mi{units === 'imperial' && ' ✓'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Splits table — shown after Calculate */}
              {runResult && (() => {
                const totalSecs = hmsToSecs(goalHMS)
                const km = getRunKm()
                if (!totalSecs || !km) return null
                const pacePerKm   = totalSecs / km
                const milesTotal  = km / 1.60934
                const pacePerMile = totalSecs / milesTotal

                type SplitRow = { marker: string; split: string; cumulative: string }
                const rows: SplitRow[] = []

                if (splitsTab === 'km') {
                  const full = Math.floor(km)
                  for (let i = 1; i <= full; i++) {
                    rows.push({ marker: `${i} km`, split: secsToMMSS(pacePerKm), cumulative: secsToHMS(Math.round(pacePerKm * i)) })
                  }
                  const rem = km - full
                  if (rem > 0.01) rows.push({ marker: `${km % 1 === 0 ? km : km.toFixed(3).replace(/0+$/, '')} km`, split: secsToMMSS(pacePerKm * rem), cumulative: secsToHMS(totalSecs) })
                } else if (splitsTab === 'mile') {
                  const full = Math.floor(milesTotal)
                  for (let i = 1; i <= full; i++) {
                    rows.push({ marker: `${i} mi`, split: secsToMMSS(pacePerMile), cumulative: secsToHMS(Math.round(pacePerMile * i)) })
                  }
                  const rem = milesTotal - full
                  if (rem > 0.01) rows.push({ marker: `${milesTotal.toFixed(2)} mi`, split: secsToMMSS(pacePerMile * rem), cumulative: secsToHMS(totalSecs) })
                } else {
                  const full5 = Math.floor(km / 5)
                  for (let i = 1; i <= full5; i++) {
                    rows.push({ marker: `${i * 5} km`, split: secsToMMSS(pacePerKm * 5), cumulative: secsToHMS(Math.round(pacePerKm * i * 5)) })
                  }
                  const rem = km - full5 * 5
                  if (rem > 0.01) rows.push({ marker: `${km % 1 === 0 ? km : km.toFixed(1)} km`, split: secsToMMSS(pacePerKm * rem), cumulative: secsToHMS(totalSecs) })
                }

                const SPLIT_TABS: { id: typeof splitsTab; label: string }[] = [
                  { id: 'race', label: 'Race Splits' },
                  { id: 'km',   label: 'KM Splits' },
                  { id: 'mile', label: 'Mile Splits' },
                ]

                return (
                  <div style={card}>
                    <p style={sectionLabel}>Splits</p>
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
                            borderRadius: '6px',
                            color: splitsTab === t.id ? 'var(--orange)' : 'var(--muted)',
                            fontFamily: 'var(--headline)',
                            fontWeight: 700,
                            fontSize: '10px',
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
                        <span key={h} style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>{h}</span>
                      ))}
                    </div>
                    {/* Rows */}
                    <div style={{ maxHeight: '260px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                      {rows.map((row, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', padding: '6px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                          <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '13px', color: 'var(--white)' }}>{row.marker}</span>
                          <span style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '13px', color: 'var(--muted)' }}>{row.split}</span>
                          <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '13px', color: i === rows.length - 1 ? 'var(--orange)' : 'var(--white)' }}>{row.cumulative}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Training zones */}
              {runZones && (
                <div style={card}>
                  <p style={sectionLabel}>Training Zones</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {runZones.map(z => {
                      const zoneColors = ['#4ade80','#60a5fa','#facc15','#f97316','#ef4444']
                      const color = zoneColors[z.zone - 1] ?? 'var(--orange)'
                      return (
                        <div key={z.zone} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: color + '22', border: `1px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '13px', color }}>{z.abbr}</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                              <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{z.description}</span>
                              <span style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '13px', color: 'var(--white)', flexShrink: 0, marginLeft: '6px' }}>
                                {z.minPaceStr} – {z.maxPaceStr}
                              </span>
                            </div>
                            <div style={{ height: '4px', background: 'var(--surface3)', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${(z.zone / 5) * 100}%`, background: color, borderRadius: '2px' }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ─── TRIATHLON CALCULATOR ─── */}
          {sport === 'triathlon' && (
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
                            borderRadius: '8px',
                            color: 'var(--white)',
                            fontFamily: 'var(--headline)',
                            fontWeight: 700,
                            fontSize: '14px',
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
                        <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted)', fontSize: '14px' }}>▾</span>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
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
                            borderRadius: '6px',
                            padding: '0.6rem 1rem',
                            color: 'var(--orange)',
                            fontFamily: 'var(--headline)',
                            fontWeight: 700,
                            fontSize: '12px',
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
                        borderRadius: '6px', color: 'var(--white)',
                        fontFamily: 'var(--headline)', fontWeight: 900,
                        fontSize: '16px', padding: '6px 4px',
                        MozAppearance: 'textfield',
                      } as React.CSSProperties}
                    />
                  )
                  const sep = <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '16px', color: 'var(--muted)', padding: '0 2px' }}>:</span>
                  const estTime = (sec: number | null) => sec && sec > 0
                    ? <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '16px', color: 'var(--orange)', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>{secsToHMS(sec)}</span>
                    : <span style={{ fontSize: '12px', color: 'var(--muted)' }}>—</span>
                  const estPace = (label: string) =>
                    <span style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '13px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{label}</span>

                  const row = (
                    emoji: string, label: string, sub: string,
                    pace: React.ReactNode, unit: string,
                    sec: number | null, isLast = false,
                    rightOverride?: React.ReactNode,
                  ) => (
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr auto auto',
                      gap: '10px', alignItems: 'center',
                      padding: '10px 0',
                      borderBottom: isLast ? 'none' : '1px solid var(--border)',
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '13px', color: 'var(--white)', letterSpacing: '0.04em' }}>
                          {emoji} {label}
                        </span>
                        {sub && <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '6px' }}>{sub}</span>}
                        <div style={{ fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.04em', marginTop: '1px' }}>{unit}</div>
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
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                        {(['pace', 'time'] as const).map(m => (
                          <button key={m} onClick={() => setTriMode(m)} style={{
                            flex: 1, padding: '7px 0',
                            background: triMode === m ? 'rgba(var(--orange-ch),0.12)' : 'var(--surface3)',
                            border: `1px solid ${triMode === m ? 'rgba(var(--orange-ch),0.4)' : 'var(--border2)'}`,
                            borderRadius: '6px',
                            color: triMode === m ? 'var(--orange)' : 'var(--muted)',
                            fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '11px',
                            letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
                          }}>
                            {m === 'pace' ? 'Enter Pace → Time' : 'Enter Time → Pace'}
                          </button>
                        ))}
                      </div>

                      {/* Column headers */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '10px', paddingBottom: '6px', borderBottom: '2px solid var(--border2)' }}>
                        <span style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Segment</span>
                        <span style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{triMode === 'pace' ? 'Pace' : 'Time'}</span>
                        <span style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', minWidth: '64px', textAlign: 'right' }}>{triMode === 'pace' ? 'Time' : 'Pace'}</span>
                      </div>

                      {triMode === 'pace' ? (<>
                        {row('🏊', 'Swim', swimDistLabel, <>{numInput(swimM,setSwimM,1,10)}{sep}{numInput(swimS,setSwimS,0,59)}</>, 'min / 100m', triResult?.swimSec ?? null)}
                        {row('↔', 'T1', '', <>{numInput(t1M,setT1M,0,15)}{sep}{numInput(t1S,setT1S,0,59)}</>, 'mm : ss', triResult?.t1Sec ?? null)}
                        {row('🚴', 'Bike', `${dist.bikeKm}km`, numInput(bikeKmh,setBikeKmh,10,60,52), 'km / h', triResult?.bikeSec ?? null)}
                        {row('↔', 'T2', '', <>{numInput(t2M,setT2M,0,15)}{sep}{numInput(t2S,setT2S,0,59)}</>, 'mm : ss', triResult?.t2Sec ?? null)}
                        {row('🏃', 'Run', `${dist.runKm}km`, <>{numInput(runM,setRunM,3,20)}{sep}{numInput(runS,setRunS,0,59)}</>, 'min / km', triResult?.runSec ?? null, true)}
                      </>) : (<>
                        {row('🏊', 'Swim', swimDistLabel, <>{numInput(swimTM,setSwimTM,0,59)}{sep}{numInput(swimTS,setSwimTS,0,59)}</>, 'mm : ss', null, false, estPace(swimPaceLabel))}
                        {row('↔', 'T1', '', <>{numInput(t1M,setT1M,0,15)}{sep}{numInput(t1S,setT1S,0,59)}</>, 'mm : ss', triResult?.t1Sec ?? null)}
                        {row('🚴', 'Bike', `${dist.bikeKm}km`, <>{numInput(bikeTH,setBikeTH,0,9,32)}h{' '}{numInput(bikeTM2,setBikeTM2,0,59)}</>, 'h : mm', null, false, estPace(bikeSpeedLabel))}
                        {row('↔', 'T2', '', <>{numInput(t2M,setT2M,0,15)}{sep}{numInput(t2S,setT2S,0,59)}</>, 'mm : ss', triResult?.t2Sec ?? null)}
                        {row('🏃', 'Run', `${dist.runKm}km`, <>{numInput(runTH,setRunTH,0,9,32)}h{' '}{numInput(runTM2,setRunTM2,0,59)}{sep}{numInput(runTS,setRunTS,0,59)}</>, 'h : mm : ss', null, true, estPace(runPaceLabel))}
                      </>)}

                      {/* Total row */}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 0 0', borderTop: '2px solid var(--border2)', marginTop: '4px',
                      }}>
                        <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--white)' }}>
                          Total Finish Time
                        </span>
                        {triResult
                          ? <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '28px', color: 'var(--orange)' }}>{secsToHMS(triResult.totalSec)}</span>
                          : <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Fill in paces above</span>
                        }
                      </div>

                      {/* PB reference */}
                      {triPB && (
                        <div style={{ background: 'rgba(var(--orange-ch),0.06)', border: '1px solid rgba(var(--orange-ch),0.2)', borderRadius: '6px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Your best at this distance</span>
                          <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '14px', color: 'var(--orange)' }}>{triPB.time}</span>
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
                            <p style={{ margin: '0 0 8px', fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--headline)', fontWeight: 700 }}>Time Split</p>
                            <div style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden', gap: '1px' }}>
                              {segs.map(seg => <div key={seg.label} style={{ width: `${(seg.sec / triResult.totalSec) * 100}%`, background: seg.color, minWidth: seg.sec > 0 ? '2px' : '0' }} />)}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', marginTop: '8px' }}>
                              {segs.map(seg => (
                                <div key={seg.label}>
                                  <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, color: seg.color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{seg.label}</div>
                                  <div style={{ fontSize: '11px', fontFamily: 'var(--headline)', fontWeight: 900, color: 'var(--white)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{secsToHMS(seg.sec)}</div>
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

      {/* ══════════════════════ ACTIVITIES TAB ════════════════════════════════ */}
      {activeTab === 'activities' && (
        <>
          {oauthStatus && (
            <div style={{
              background: oauthStatus.includes('Failed') ? 'rgba(255,80,80,0.12)' : 'rgba(var(--green-ch),0.12)',
              border: `1px solid ${oauthStatus.includes('Failed') ? 'rgba(255,80,80,0.3)' : 'rgba(var(--green-ch),0.3)'}`,
              borderRadius: '6px', padding: '0.75rem 1rem',
              fontSize: 'var(--text-sm)',
              color: oauthStatus.includes('Failed') ? '#ff8080' : 'var(--green)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>{oauthStatus}</span>
              <button onClick={() => setOauthStatus(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '16px', padding: '0 0 0 8px' }}>✕</button>
            </div>
          )}

          {stravaToken && stravaRaceCount > 0 && (
            <div style={{
              background: 'rgba(252,76,2,0.08)',
              border: '1px solid rgba(252,76,2,0.3)',
              borderRadius: '8px',
              padding: '0.85rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--white)', lineHeight: 1.4 }}>
                <span style={{ color: '#fc4c02', fontWeight: 700 }}>Strava</span>{' '}
                found {stravaRaceCount} race{stravaRaceCount > 1 ? 's' : ''} not in BREAKTAPES
              </p>
              <button
                onClick={handleImportStravaRaces}
                disabled={importingRaces}
                style={{ ...btnMain, padding: '0.5rem 0.85rem', fontSize: '11px', flexShrink: 0, opacity: importingRaces ? 0.6 : 1 }}
              >
                {importingRaces ? 'Importing…' : `Import ${stravaRaceCount}`}
              </button>
            </div>
          )}
          {importDone && (
            <div style={{
              background: importDone.includes('failed') ? 'rgba(255,80,80,0.12)' : 'rgba(var(--green-ch),0.12)',
              border: `1px solid ${importDone.includes('failed') ? 'rgba(255,80,80,0.3)' : 'rgba(var(--green-ch),0.3)'}`,
              borderRadius: '6px', padding: '0.75rem 1rem',
              fontSize: 'var(--text-sm)',
              color: importDone.includes('failed') ? '#ff8080' : 'var(--green)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>{importDone}</span>
              <button onClick={() => setImportDone(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '16px', padding: '0 0 0 8px' }}>✕</button>
            </div>
          )}

          {!hasAnyWearable ? (
            <div style={card}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem 1rem', textAlign: 'center' }}>
                <div style={{ display: 'flex', gap: '1rem', opacity: 0.5 }}>
                  {['W', 'G', 'S'].map((l, i) => (
                    <div key={i} style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--surface3)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '16px', color: 'var(--muted)' }}>
                      {l}
                    </div>
                  ))}
                </div>
                <p style={{ margin: 0, fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '15px', color: 'var(--white)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Connect a wearable
                </p>
                <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--muted)', maxWidth: '260px', lineHeight: 1.5 }}>
                  Link WHOOP, Garmin, or Strava to see your activity feed here.
                </p>
                <button style={btnMain} onClick={() => navigate('/settings')}>
                  Go to Settings → Wearables
                </button>
              </div>
            </div>
          ) : feedLoading ? (
            <div style={{ ...card, textAlign: 'center', padding: '2rem', color: 'var(--muted)', fontSize: '13px', fontFamily: 'var(--headline)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Loading activities…
            </div>
          ) : activities.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: '2rem', color: 'var(--muted)', fontSize: '13px', fontFamily: 'var(--headline)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              No recent activities found
            </div>
          ) : (
            <div style={card}>
              <p style={sectionLabel}>Recent Activities</p>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {activities.slice(0, 20).map(a => {
                  const d = new Date(a.date)
                  const dateStr = isNaN(d.getTime()) ? '' : d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
                  return (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--white)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {a.name}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                          {a.source} · {dateStr}
                          {a.durationMin ? ` · ${a.durationMin}min` : ''}
                          {a.distanceKm ? ` · ${a.distanceKm.toFixed(1)}km` : ''}
                        </p>
                      </div>
                      {(a.avgHR || a.strain) && (
                        <p style={{ margin: 0, fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '14px', color: 'var(--orange)', flexShrink: 0, marginLeft: '0.5rem' }}>
                          {a.strain ? `${a.strain.toFixed(1)} strain` : `${a.avgHR} bpm`}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════ READINESS TAB ═════════════════════════════════ */}
      {activeTab === 'readiness' && (
        <>
          {!whoopToken ? (
            <div style={card}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem 1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '36px', opacity: 0.5 }}>💚</div>
                <p style={{ margin: 0, fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '15px', color: 'var(--white)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Connect WHOOP</p>
                <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--muted)', maxWidth: '260px', lineHeight: 1.5 }}>
                  Link your WHOOP to see recovery scores, HRV, and resting heart rate trends.
                </p>
                <button style={btnMain} onClick={() => navigate('/settings')}>Go to Settings → Wearables</button>
              </div>
            </div>
          ) : recoveryLoading ? (
            <div style={{ ...card, textAlign: 'center', padding: '2rem', color: 'var(--muted)', fontSize: '13px', fontFamily: 'var(--headline)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Loading recovery data…
            </div>
          ) : recoveryData.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: '2rem', color: 'var(--muted)', fontSize: '13px', fontFamily: 'var(--headline)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              No recovery data found
            </div>
          ) : (
            <>
              {(() => {
                const today = recoveryData[0]
                const score = today.score
                const color = score >= 67 ? 'var(--green)' : score >= 34 ? '#FFD770' : '#ff8080'
                const label = score >= 67 ? 'READY' : score >= 34 ? 'MODERATE' : 'RECOVER'
                return (
                  <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <svg width="80" height="80" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="33" fill="none" stroke="var(--surface3)" strokeWidth="8" />
                        <circle
                          cx="40" cy="40" r="33" fill="none"
                          stroke={color} strokeWidth="8"
                          strokeDasharray={`${2 * Math.PI * 33 * score / 100} ${2 * Math.PI * 33}`}
                          strokeLinecap="round"
                          transform="rotate(-90 40 40)"
                        />
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                        <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '22px', color, lineHeight: 1 }}>{score}</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color, marginBottom: '4px' }}>
                        {label}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--white)', fontWeight: 600 }}>Today's Recovery</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px', display: 'flex', gap: '10px' }}>
                        {today.hrv !== undefined && <span>HRV {Math.round(today.hrv)}ms</span>}
                        {today.rhr !== undefined && <span>RHR {Math.round(today.rhr)}bpm</span>}
                      </div>
                    </div>
                  </div>
                )
              })()}

              <div style={card}>
                <p style={sectionLabel}>Recovery History (30 days)</p>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '56px', marginBottom: '8px' }}>
                  {recoveryData.slice(0, 30).reverse().map((r, i) => {
                    const h = Math.max(4, Math.round(r.score * 0.54))
                    const c = r.score >= 67 ? 'var(--green)' : r.score >= 34 ? '#FFD770' : '#ff8080'
                    return (
                      <div key={i} style={{ flex: 1, height: `${h}px`, background: c, borderRadius: '2px 2px 0 0', opacity: 0.85, minWidth: 0 }} title={`${r.date}: ${r.score}%`} />
                    )
                  })}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                  {recoveryData.slice(0, 7).map(r => {
                    const d = new Date(r.date + 'T00:00:00')
                    const dateStr = isNaN(d.getTime()) ? r.date : d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
                    const color = r.score >= 67 ? 'var(--green)' : r.score >= 34 ? '#FFD770' : '#ff8080'
                    return (
                      <div key={r.date} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>{dateStr}</div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          {r.hrv !== undefined && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>{Math.round(r.hrv)}ms HRV</span>}
                          <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '13px', color }}>{r.score}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

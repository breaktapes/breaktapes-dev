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

// Parse "1:30" or "90" as total seconds
function parseMinSec(str: string): number | null {
  const s = str.trim()
  if (!s) return null
  if (s.includes(':')) {
    const parts = s.split(':').map(Number)
    if (parts.length === 2 && !parts.some(isNaN)) return parts[0] * 60 + parts[1]
    if (parts.length === 3 && !parts.some(isNaN)) return parts[0] * 3600 + parts[1] * 60 + parts[2]
    return null
  }
  const n = parseFloat(s)
  return isNaN(n) ? null : n
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
  const [goalHMS, setGoalHMS]         = useState<HMS>({ h: 1, m: 45, s: 0 })
  const [runResult, setRunResult]     = useState<{ km: string; mi: string } | null>(null)
  const [runZones, setRunZones]       = useState<ReturnType<typeof paceZones> | null>(null)

  // ── Triathlon calculator state ─────────────────────────────────────────────
  const [triDistId, setTriDistId]     = useState<TriDistId>('olympic')
  const [swimPace, setSwimPace]       = useState('2:00')   // min:sec per 100m
  const [t1Time, setT1Time]           = useState('2:00')   // MM:SS
  const [bikeSpeed, setBikeSpeed]     = useState('30')     // km/h
  const [t2Time, setT2Time]           = useState('1:30')   // MM:SS
  const [runPace, setRunPace]         = useState('5:30')   // min:sec per km
  const [triResult, setTriResult]     = useState<TriResult | null>(null)

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

  // ── Triathlon calculation (live) ───────────────────────────────────────────

  useEffect(() => {
    calcTri()
  }, [swimPace, t1Time, bikeSpeed, t2Time, runPace, triDistId]) // eslint-disable-line react-hooks/exhaustive-deps

  function calcTri() {
    const dist = TRI_DISTANCES.find(d => d.id === triDistId)!
    const swimSec = (() => {
      const paceSecPer100m = parseMinSec(swimPace)
      if (!paceSecPer100m || paceSecPer100m <= 0) return null
      return (dist.swimM / 100) * paceSecPer100m
    })()
    const t1Sec = parseMinSec(t1Time) ?? 0
    const bikeSec = (() => {
      const speedKmh = parseFloat(bikeSpeed)
      if (isNaN(speedKmh) || speedKmh <= 0) return null
      return (dist.bikeKm / speedKmh) * 3600
    })()
    const t2Sec = parseMinSec(t2Time) ?? 0
    const runSec = (() => {
      const paceSecPerKm = parseMinSec(runPace)
      if (!paceSecPerKm || paceSecPerKm <= 0) return null
      return dist.runKm * paceSecPerKm
    })()

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
    const defaults: Record<TriDistId, { swim: string; bike: string; run: string }> = {
      sprint:  { swim: '2:00', bike: '28', run: '5:30' },
      olympic: { swim: '2:00', bike: '30', run: '5:15' },
      '703':   { swim: '1:55', bike: '32', run: '5:00' },
      ironman: { swim: '1:50', bike: '33', run: '5:30' },
    }
    const d = defaults[triDistId]
    setSwimPace(d.swim)
    setBikeSpeed(d.bike)
    setRunPace(d.run)
    setT1Time(triDistId === 'sprint' ? '1:30' : triDistId === 'olympic' ? '2:00' : '4:00')
    setT2Time(triDistId === 'sprint' ? '1:00' : triDistId === 'olympic' ? '1:30' : '3:00')
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

                  {/* Distance chips */}
                  <div>
                    <label style={fieldLabel}>Distance</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {RUN_DISTANCES.map(d => {
                        const pb = d.id !== 'custom' ? findRunPB(races, d.km) : null
                        const isActive = runDistId === d.id
                        return (
                          <div key={d.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                            <button
                              onClick={() => { setRunDistId(d.id); setRunResult(null); setRunZones(null) }}
                              style={{
                                padding: '7px 14px',
                                borderRadius: '20px',
                                border: `1px solid ${isActive ? 'var(--orange)' : 'var(--border2)'}`,
                                background: isActive ? 'rgba(var(--orange-ch),0.15)' : 'var(--surface3)',
                                color: isActive ? 'var(--orange)' : 'var(--white)',
                                fontFamily: 'var(--headline)',
                                fontWeight: 700,
                                fontSize: '12px',
                                letterSpacing: '0.06em',
                                cursor: 'pointer',
                                transition: 'all 0.12s',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {d.label}
                            </button>
                            {pb && (
                              <button
                                onClick={() => { setRunDistId(d.id); applyRunPB(pb) }}
                                title={`Use your PB: ${pb.time}`}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--orange)',
                                  fontSize: '10px',
                                  fontFamily: 'var(--body)',
                                  cursor: 'pointer',
                                  padding: '0',
                                  opacity: 0.8,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                PB {pb.time}
                              </button>
                            )}
                          </div>
                        )
                      })}
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

                {/* Tri distance chips */}
                <div>
                  <label style={fieldLabel}>Distance</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {TRI_DISTANCES.map(d => {
                      const pb = findTriPB(races, d.totalKm)
                      const isActive = triDistId === d.id
                      return (
                        <button
                          key={d.id}
                          onClick={() => setTriDistId(d.id)}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: `1px solid ${isActive ? 'var(--orange)' : 'var(--border2)'}`,
                            background: isActive ? 'rgba(var(--orange-ch),0.12)' : 'var(--surface3)',
                            color: isActive ? 'var(--orange)' : 'var(--white)',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'all 0.12s',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '13px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{d.label}</span>
                            {pb && <span style={{ fontSize: '11px', color: 'var(--orange)', opacity: 0.8 }}>PB {pb.time}</span>}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px' }}>
                            Swim {d.swimM >= 1000 ? `${d.swimM / 1000}km` : `${d.swimM}m`} · Bike {d.bikeKm}km · Run {d.runKm}km
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Segment inputs */}
                {(() => {
                  const dist = TRI_DISTANCES.find(d => d.id === triDistId)!
                  const triPB = findTriPB(races, dist.totalKm)

                  const segRow = (
                    label: string,
                    distLabel: string,
                    unitLabel: string,
                    value: string,
                    onChange: (v: string) => void,
                    placeholder: string,
                    estimatedSec: number | null,
                    hint: string,
                  ) => (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', alignItems: 'end', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                      <div>
                        <label style={{ ...fieldLabel, marginBottom: '4px' }}>
                          {label}
                          {distLabel && <span style={{ fontWeight: 400, marginLeft: '6px', opacity: 0.7 }}>({distLabel})</span>}
                        </label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="text"
                            placeholder={placeholder}
                            value={value}
                            onChange={e => onChange(e.target.value)}
                            style={{ ...textInput, flex: 1 }}
                          />
                          <span style={{ fontSize: '11px', color: 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{unitLabel}</span>
                        </div>
                        <p style={{ margin: '3px 0 0', fontSize: '10px', color: 'var(--muted)' }}>{hint}</p>
                      </div>
                      <div style={{ textAlign: 'right', paddingBottom: '18px' }}>
                        {estimatedSec != null && estimatedSec > 0
                          ? <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '14px', color: 'var(--orange)' }}>{secsToHMS(estimatedSec)}</span>
                          : <span style={{ fontSize: '12px', color: 'var(--muted)' }}>—</span>
                        }
                      </div>
                    </div>
                  )

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                      {/* Header */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--headline)', fontWeight: 700 }}>Segment</span>
                        <span style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--headline)', fontWeight: 700 }}>Est. Time</span>
                      </div>

                      <div style={{ paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {segRow(
                          '🏊 Swim', dist.swimM >= 1000 ? `${dist.swimM / 1000}km` : `${dist.swimM}m`,
                          'min/100m', swimPace, setSwimPace, '1:45',
                          triResult ? triResult.swimSec : null,
                          'e.g. 1:45 for 1 min 45 sec per 100m',
                        )}
                        {segRow(
                          'T1 Transition', '', 'mm:ss',
                          t1Time, setT1Time, '2:00',
                          triResult ? triResult.t1Sec : null, '',
                        )}
                        {segRow(
                          '🚴 Bike', `${dist.bikeKm}km`,
                          'km/h', bikeSpeed, setBikeSpeed, '30',
                          triResult ? triResult.bikeSec : null,
                          'Average speed in km/h',
                        )}
                        {segRow(
                          'T2 Transition', '', 'mm:ss',
                          t2Time, setT2Time, '1:30',
                          triResult ? triResult.t2Sec : null, '',
                        )}
                        {segRow(
                          '🏃 Run', `${dist.runKm}km`,
                          'min/km', runPace, setRunPace, '5:30',
                          triResult ? triResult.runSec : null,
                          'e.g. 5:30 for 5 min 30 sec per km',
                        )}

                        {/* Total row */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 0 0',
                          borderTop: '2px solid var(--border2)',
                          marginTop: '4px',
                        }}>
                          <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--white)' }}>
                            Total Finish Time
                          </span>
                          {triResult
                            ? <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '22px', color: 'var(--orange)' }}>{secsToHMS(triResult.totalSec)}</span>
                            : <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Fill in paces above</span>
                          }
                        </div>

                        {/* PB reference */}
                        {triPB && (
                          <div style={{
                            background: 'rgba(var(--orange-ch),0.06)',
                            border: '1px solid rgba(var(--orange-ch),0.2)',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}>
                            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Your best at this distance</span>
                            <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '14px', color: 'var(--orange)' }}>{triPB.time}</span>
                          </div>
                        )}

                        {/* Segment breakdown bar */}
                        {triResult && triResult.totalSec > 0 && (
                          <div>
                            <p style={{ margin: '0 0 6px', fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--headline)', fontWeight: 700 }}>
                              Time Split
                            </p>
                            <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden', gap: '1px' }}>
                              {[
                                { sec: triResult.swimSec,  color: '#60a5fa', label: 'Swim' },
                                { sec: triResult.t1Sec,    color: '#94a3b8', label: 'T1' },
                                { sec: triResult.bikeSec,  color: '#f97316', label: 'Bike' },
                                { sec: triResult.t2Sec,    color: '#94a3b8', label: 'T2' },
                                { sec: triResult.runSec,   color: '#4ade80', label: 'Run' },
                              ].map(seg => (
                                <div
                                  key={seg.label}
                                  title={`${seg.label}: ${secsToHMS(seg.sec)}`}
                                  style={{
                                    height: '100%',
                                    width: `${(seg.sec / triResult.totalSec) * 100}%`,
                                    background: seg.color,
                                    minWidth: seg.sec > 0 ? '2px' : '0',
                                  }}
                                />
                              ))}
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
                              {[
                                { label: 'Swim', sec: triResult.swimSec,  color: '#60a5fa' },
                                { label: 'T1',   sec: triResult.t1Sec,    color: '#94a3b8' },
                                { label: 'Bike', sec: triResult.bikeSec,  color: '#f97316' },
                                { label: 'T2',   sec: triResult.t2Sec,    color: '#94a3b8' },
                                { label: 'Run',  sec: triResult.runSec,   color: '#4ade80' },
                              ].map(seg => (
                                <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: seg.color, flexShrink: 0 }} />
                                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{seg.label}</span>
                                  <span style={{ fontSize: '11px', color: 'var(--white)', fontFamily: 'var(--headline)', fontWeight: 700 }}>{secsToHMS(seg.sec)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
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

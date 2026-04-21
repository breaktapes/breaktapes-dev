import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useRaceStore } from '@/stores/useRaceStore'
import { useWearableStore } from '@/stores/useWearableStore'
import { handleWhoopCallback, fetchWhoopActivities, fetchWhoopRecovery } from '@/lib/whoop'
import { handleGarminCallback, fetchGarminActivities } from '@/lib/garmin'
import { handleStravaCallback, fetchStravaActivities, stravaActivitiesToRaces } from '@/lib/strava'
import { computeVDOT, paceZones } from '@/lib/raceFormulas'
import { useUnits } from '@/lib/units'

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

const DISTANCES: { label: string; km: number }[] = [
  { label: '5K',            km: 5 },
  { label: '10K',           km: 10 },
  { label: '10 Mile',       km: 16.09 },
  { label: 'Half Marathon', km: 21.0975 },
  { label: 'Marathon',      km: 42.195 },
  { label: '50K',           km: 50 },
  { label: '100K',          km: 100 },
  { label: 'Sprint Tri',    km: 25.75 },
  { label: 'Olympic Tri',   km: 51.5 },
  { label: '70.3',          km: 113 },
  { label: 'Ironman',       km: 226 },
]

function secsToMMSS(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.round(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function parseHMS(str: string): number | null {
  const parts = str.trim().split(':').map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
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

export function Train() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<Tab>('pace')
  const [distanceIdx, setDistanceIdx] = useState(2) // HM default
  const [goalTime, setGoalTime] = useState('')
  const [paceResult, setPaceResult] = useState<{ km: string; mi: string } | null>(null)
  const [paceZoneResult, setPaceZoneResult] = useState<ReturnType<typeof paceZones> | null>(null)
  const units = useUnits()
  const [oauthStatus, setOauthStatus] = useState<string | null>(null)

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

  // Handle OAuth callbacks — detect ?state=whoop|garmin|strava&code=
  // Also handles ?error=... returned by providers on denied/failed auth
  useEffect(() => {
    const state    = searchParams.get('state')
    const code     = searchParams.get('code')
    const oauthErr = searchParams.get('error')

    if (!state) return

    // Strip query params from URL without reload
    window.history.replaceState({}, '', window.location.pathname)

    // Provider rejected the OAuth — e.g. user denied or invalid client_id
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

  // Load activity feed when activities tab is active and a wearable is connected
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

        // Count Strava race activities not yet imported
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

  // Load WHOOP recovery data for Readiness tab
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

  function calcPace() {
    const totalSecs = parseHMS(goalTime)
    if (!totalSecs) return
    const dist = DISTANCES[distanceIdx]
    const paceKm = totalSecs / dist.km
    const paceMi = totalSecs / (dist.km / 1.60934)
    setPaceResult({ km: secsToMMSS(paceKm), mi: secsToMMSS(paceMi) })
    const vdot = computeVDOT(totalSecs, dist.km)
    setPaceZoneResult(vdot ? paceZones(vdot, units) : null)
  }

  // Last 3 races with a time (fastest first per group, simplified)
  const recentTimed = races
    .filter(r => r.time)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)

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
      {/* Page heading */}
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
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        marginBottom: '0.25rem',
        gap: '0.25rem',
      }}>
        {TAB_LABELS.map(t => (
          <button key={t.id} style={tabStyle(t.id)} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Pace tab ── */}
      {activeTab === 'pace' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={card}>
            <p style={sectionLabel}>Pace Calculator</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Distance select */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--muted)', marginBottom: '4px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Distance
                </label>
                <select
                  value={distanceIdx}
                  onChange={e => { setDistanceIdx(Number(e.target.value)); setPaceResult(null) }}
                  style={{
                    width: '100%',
                    background: 'var(--surface3)',
                    border: '1px solid var(--border2)',
                    borderRadius: '4px',
                    color: 'var(--white)',
                    fontSize: 'var(--text-sm)',
                    padding: '0.6rem 0.75rem',
                    fontFamily: 'var(--body)',
                  }}
                >
                  {DISTANCES.map((d, i) => (
                    <option key={d.label} value={i}>{d.label}</option>
                  ))}
                </select>
              </div>

              {/* Goal time input */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--muted)', marginBottom: '4px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Goal Time (HH:MM:SS)
                </label>
                <input
                  type="text"
                  placeholder="1:45:00"
                  value={goalTime}
                  onChange={e => { setGoalTime(e.target.value); setPaceResult(null) }}
                  style={{
                    width: '100%',
                    background: 'var(--surface3)',
                    border: '1px solid var(--border2)',
                    borderRadius: '4px',
                    color: 'var(--white)',
                    fontSize: 'var(--text-sm)',
                    padding: '0.6rem 0.75rem',
                    fontFamily: 'var(--body)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button style={btnMain} onClick={calcPace}>
                Calculate
              </button>

              {paceResult && (
                <div style={{
                  background: 'var(--surface3)',
                  border: '1px solid var(--border2)',
                  borderRadius: '6px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  gap: '2rem',
                }}>
                  {/* Preferred unit shown in orange, other in white */}
                  <div>
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Per km</p>
                    <p style={{ margin: '4px 0 0', fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '22px', color: units !== 'imperial' ? 'var(--orange)' : 'var(--white)', letterSpacing: '0.04em' }}>
                      {paceResult.km}
                    </p>
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>min/km{units !== 'imperial' && ' ✓'}</p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Per mile</p>
                    <p style={{ margin: '4px 0 0', fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '22px', color: units === 'imperial' ? 'var(--orange)' : 'var(--white)', letterSpacing: '0.04em' }}>
                      {paceResult.mi}
                    </p>
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>min/mi{units === 'imperial' && ' ✓'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pace zones */}
          {paceZoneResult && (
            <div style={card}>
              <p style={sectionLabel}>Training Zones</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {paceZoneResult.map(z => {
                  const zoneColors = ['#4ade80','#60a5fa','#facc15','#f97316','#ef4444']
                  const color = zoneColors[z.zone - 1] ?? 'var(--orange)'
                  return (
                    <div key={z.zone} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: color + '22', border: `1px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '13px', color }}>{z.abbr}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{z.description}</span>
                          <span style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '13px', color: 'var(--white)' }}>
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

          {/* Recent PBs */}
          {recentTimed.length > 0 && (
            <div style={card}>
              <p style={sectionLabel}>Recent Results</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {recentTimed.map(r => (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.5rem 0',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--white)', fontWeight: 600 }}>
                        {r.name || r.distance + 'km'}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                        {r.date}
                      </p>
                    </div>
                    <p style={{ margin: 0, fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '15px', color: 'var(--orange)' }}>
                      {r.time}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Activities tab ── */}
      {activeTab === 'activities' && (
        <>
          {/* OAuth status toast */}
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

          {/* Strava race import banner */}
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
              {/* Today's readiness hero */}
              {(() => {
                const today = recoveryData[0]
                const score = today.score
                const color = score >= 67 ? 'var(--green)' : score >= 34 ? '#FFD770' : '#ff8080'
                const label = score >= 67 ? 'READY' : score >= 34 ? 'MODERATE' : 'RECOVER'
                return (
                  <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    {/* Score ring */}
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

              {/* Rolling 30-day history */}
              <div style={card}>
                <p style={sectionLabel}>Recovery History (30 days)</p>
                {/* Mini bar chart */}
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

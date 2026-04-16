import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useRaceStore } from '@/stores/useRaceStore'
import { useWearableStore } from '@/stores/useWearableStore'
import { handleWhoopCallback, fetchWhoopActivities } from '@/lib/whoop'
import { handleGarminCallback, fetchGarminActivities } from '@/lib/garmin'
import { handleStravaCallback } from '@/lib/strava'

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
  { label: '5K',       km: 5 },
  { label: '10K',      km: 10 },
  { label: 'Half Marathon', km: 21.0975 },
  { label: 'Marathon', km: 42.195 },
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

type Tab = 'pace' | 'activities'

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: 'pace',       label: 'Pace' },
  { id: 'activities', label: 'Activities' },
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
  const [oauthStatus, setOauthStatus] = useState<string | null>(null)

  // Activity feed state
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [feedLoading, setFeedLoading] = useState(false)

  const races = useRaceStore(s => s.races)
  const whoopToken  = useWearableStore(s => s.whoopToken)
  const garminToken = useWearableStore(s => s.garminToken)
  const stravaToken = useWearableStore(s => s.stravaToken)
  const hasAnyWearable = !!(whoopToken || garminToken || stravaToken)

  // Handle OAuth callbacks — detect ?state=whoop|garmin|strava&code=
  useEffect(() => {
    const state = searchParams.get('state')
    const code  = searchParams.get('code')
    if (!code || !state) return

    // Strip query params from URL without reload
    window.history.replaceState({}, '', window.location.pathname)

    async function finish() {
      try {
        const provider = state?.split(':')[0]
        if (provider === 'whoop')  await handleWhoopCallback(code!, state!)
        if (provider === 'garmin') await handleGarminCallback(code!, state!)
        if (provider === 'strava') await handleStravaCallback(code!, state!)
        if (!provider || !['whoop', 'garmin', 'strava'].includes(provider)) return
        setOauthStatus(`${provider} connected!`)
        setActiveTab('activities')
      } catch (err) {
        const provider = state?.split(':')[0] ?? state
        console.error('OAuth callback failed:', err)
        setOauthStatus(`Failed to connect ${provider}. Please try again.`)
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
        const [whoopActs, garminActs] = await Promise.all([
          whoopToken  ? fetchWhoopActivities(20) : Promise.resolve([]),
          garminToken ? fetchGarminActivities(20) : Promise.resolve([]),
        ])
        if (cancelled) return
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
        ]
        merged.sort((a, b) => b.date.localeCompare(a.date))
        setActivities(merged)
      } finally {
        if (!cancelled) setFeedLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [activeTab, hasAnyWearable, whoopToken, garminToken]) // eslint-disable-line react-hooks/exhaustive-deps

  function calcPace() {
    const totalSecs = parseHMS(goalTime)
    if (!totalSecs) return
    const dist = DISTANCES[distanceIdx]
    const paceKm = totalSecs / dist.km
    const paceMi = totalSecs / (dist.km / 1.60934)
    setPaceResult({ km: secsToMMSS(paceKm), mi: secsToMMSS(paceMi) })
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
                  <div>
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Per km
                    </p>
                    <p style={{ margin: '4px 0 0', fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '22px', color: 'var(--orange)', letterSpacing: '0.04em' }}>
                      {paceResult.km}
                    </p>
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>min/km</p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Per mile
                    </p>
                    <p style={{ margin: '4px 0 0', fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '22px', color: 'var(--white)', letterSpacing: '0.04em' }}>
                      {paceResult.mi}
                    </p>
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>min/mi</p>
                  </div>
                </div>
              )}
            </div>
          </div>

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
    </div>
  )
}

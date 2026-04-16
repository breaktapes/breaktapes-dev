import { useState } from 'react'
import { useRaceStore } from '@/stores/useRaceStore'

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

type Tab = 'pace' | 'activities' | 'wearables'

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: 'pace',       label: 'Pace' },
  { id: 'activities', label: 'Activities' },
  { id: 'wearables',  label: 'Wearables' },
]

const WEARABLES = [
  {
    id: 'whoop',
    name: 'WHOOP',
    desc: 'Recovery, strain & sleep coaching',
    status: 'connect' as const,
  },
  {
    id: 'garmin',
    name: 'Garmin',
    desc: 'GPS activities & performance metrics',
    status: 'connect' as const,
  },
  {
    id: 'coros',
    name: 'COROS',
    desc: 'Training load & endurance data',
    status: 'soon' as const,
  },
  {
    id: 'oura',
    name: 'Oura',
    desc: 'Readiness, sleep & HRV',
    status: 'soon' as const,
  },
  {
    id: 'apple',
    name: 'Apple Health',
    desc: 'Import export.xml from the Health app',
    status: 'connect' as const,
  },
]

export function Train() {
  const [activeTab, setActiveTab] = useState<Tab>('pace')
  const [distanceIdx, setDistanceIdx] = useState(2) // HM default
  const [goalTime, setGoalTime] = useState('')
  const [paceResult, setPaceResult] = useState<{ km: string; mi: string } | null>(null)

  const races = useRaceStore(s => s.races)

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
        <div style={card}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            padding: '2rem 1rem',
            textAlign: 'center',
          }}>
            <div style={{ display: 'flex', gap: '1rem', opacity: 0.5 }}>
              {['W', 'G', ''].map((l, i) => (
                <div
                  key={i}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    background: 'var(--surface3)',
                    border: '1px solid var(--border2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--headline)',
                    fontWeight: 900,
                    fontSize: '16px',
                    color: 'var(--muted)',
                  }}
                >
                  {l || '♡'}
                </div>
              ))}
            </div>
            <p style={{ margin: 0, fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '15px', color: 'var(--white)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Connect a wearable
            </p>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--muted)', maxWidth: '260px', lineHeight: 1.5 }}>
              Link WHOOP, Garmin, or Apple Health to see your activity feed here.
            </p>
            <button
              style={btnMain}
              onClick={() => setActiveTab('wearables')}
            >
              Go to Wearables
            </button>
          </div>
        </div>
      )}

      {/* ── Wearables tab ── */}
      {activeTab === 'wearables' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {WEARABLES.map(w => (
            <div
              key={w.id}
              style={{
                ...card,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0,
                  fontFamily: 'var(--headline)',
                  fontWeight: 900,
                  fontSize: '15px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--white)',
                }}>
                  {w.name}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                  {w.desc}
                </p>
              </div>
              {w.status === 'soon' ? (
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '4px',
                  background: 'var(--surface3)',
                  border: '1px solid var(--border)',
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'var(--headline)',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                  whiteSpace: 'nowrap',
                }}>
                  Coming Soon
                </span>
              ) : (
                <button
                  style={{
                    ...btnMain,
                    padding: '0.5rem 1rem',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                  onClick={() => console.log(`Connect ${w.name}`)}
                >
                  Connect
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRaceStore } from '@/stores/useRaceStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { useDashStore } from '@/stores/useDashStore'
import { selectRaces, selectNextRace, selectAthlete, selectDashZoneCollapse } from '@/stores/selectors'
import { Skeleton } from '@/components/Skeleton'
import { AddRaceModal } from '@/components/AddRaceModal'
import type { Race } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().split('T')[0] }

function daysUntil(dateStr: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((new Date(dateStr + 'T00:00:00').getTime() - now.getTime()) / 86400000))
}

function daysAgo(dateStr: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  return Math.round((now.getTime() - new Date(dateStr + 'T00:00:00').getTime()) / 86400000)
}

function fmtDateIntl(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

function fmtShortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function distBadge(d: string | undefined): string {
  if (!d) return ''
  const n = parseFloat(d)
  if (isNaN(n)) return d
  if (n >= 42 && n <= 42.3) return 'Marathon'
  if (n >= 21 && n <= 21.2) return 'Half Marathon'
  if (n >= 10 && n <= 10.1) return '10K'
  if (n >= 5 && n <= 5.1) return '5K'
  return `${n}K`
}

function buildPBMap(races: Race[]): Record<string, Race> {
  const pb: Record<string, Race> = {}
  for (const r of races) {
    if (!r.time || !r.distance) continue
    if (!pb[r.distance] || r.time < pb[r.distance].time!) pb[r.distance] = r
  }
  return pb
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'GOOD MORNING'
  if (h < 17) return 'GOOD AFTERNOON'
  return 'GOOD EVENING'
}

function uniqueCountries(races: Race[]) {
  return new Set(races.map(r => r.country).filter(Boolean)).size
}
function totalKm(races: Race[]) {
  return races.reduce((s, r) => { const d = parseFloat(r.distance); return s + (isNaN(d) ? 0 : d) }, 0)
}
function medalCount(races: Race[]) {
  return races.filter(r => r.medal && r.medal !== 'finisher').length
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconGrid = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    {[4,8,12].flatMap(x => [4,8,12].map(y =>
      <circle key={`${x}${y}`} cx={x} cy={y} r={1.4}/>
    ))}
  </svg>
)

const IconPin = ({ color = 'var(--orange)', size = 12 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
  </svg>
)

const IconEdit = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

// ─── Greeting Card ────────────────────────────────────────────────────────────

function GreetingCard({ onCustomize }: { onCustomize: () => void }) {
  const athlete = useAthleteStore(selectAthlete)
  const firstName = (athlete?.firstName ?? 'Athlete').toUpperCase()

  return (
    <div style={st.greetingCard}>
      <div style={st.greetingContent}>
        <div style={st.greetingLine}>
          <span style={st.greetingText}>{getGreeting()},&nbsp;</span>
          <span style={st.greetingName}>{firstName}</span>
        </div>
        <div style={st.greetingSubtext}>Enable location to show local weather</div>
      </div>
      <button style={st.gridBtn} onClick={onCustomize} aria-label="Customise dashboard">
        <IconGrid />
      </button>
    </div>
  )
}

// ─── Pre-Race Briefing ────────────────────────────────────────────────────────

function PreRaceBriefing({ onAddRace }: { onAddRace: () => void }) {
  const races   = useRaceStore(selectRaces)
  const nextRace = useRaceStore(selectNextRace)
  const today   = todayStr()
  const pbMap   = useMemo(() => buildPBMap(races), [races])

  const lastRace = useMemo(
    () => races.filter(r => r.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0],
    [races, today],
  )

  const lastPill = useMemo(() => {
    if (!lastRace?.time) return null
    const isPB = pbMap[lastRace.distance]?.id === lastRace.id
    return { text: `Last: ${lastRace.time} ${distBadge(lastRace.distance)}`, isPB }
  }, [lastRace, pbMap])

  if (!nextRace) {
    // JUST RACED state: last race was within 7 days
    if (lastRace && daysAgo(lastRace.date) <= 7) {
      const d = daysAgo(lastRace.date)
      const dLabel = d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`
      return (
        <div style={st.briefingCard}>
          <div style={st.briefingInner}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <IconPin />
              <span style={st.briefingTag}>JUST RACED</span>
            </div>
            <div style={st.briefingTitle}>{(lastRace.name ?? '').toUpperCase()}</div>
            <div style={st.briefingMeta}>{dLabel} · {distBadge(lastRace.distance) || (lastRace.distance + 'K')}</div>
            {lastRace.time && <div style={st.lastRacePill}>Finish: {lastRace.time}</div>}
            <button style={{ ...st.ctaPrimary, marginTop: '12px' }} onClick={onAddRace}>+ Add Next Race</button>
          </div>
        </div>
      )
    }
    // No races at all (or last race was >7 days ago)
    return (
      <div style={st.briefingCard}>
        <div style={st.briefingInner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <IconPin />
            <span style={st.briefingTag}>{races.length === 0 ? 'ADD YOUR FIRST RACE' : 'WHAT\'S NEXT?'}</span>
          </div>
          <div style={st.briefingTitle}>{races.length === 0 ? 'Your race story awaits' : 'No upcoming race'}</div>
          <button style={st.ctaPrimary} onClick={onAddRace}>+ Log First Race</button>
        </div>
      </div>
    )
  }

  const days = daysUntil(nextRace.date)
  const dayLabel = days === 0 ? 'TODAY!' : days === 1 ? 'IN 1 DAY' : `IN ${days} DAYS`

  return (
    <div style={st.briefingCard}>
      <div style={st.briefingInner}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <IconPin />
          <span style={st.briefingTag}>PRE-RACE</span>
        </div>
        <div style={st.briefingTitle}>
          {(nextRace.name ?? '').toUpperCase()} {dayLabel}
        </div>
        <div style={st.briefingMeta}>
          {fmtDateIntl(nextRace.date)}
          {nextRace.distance ? ` · ${distBadge(nextRace.distance) || nextRace.distance + 'K'}` : ''}
        </div>
        {lastPill && (
          <div style={st.lastRacePill}>
            {lastPill.text}
            {lastPill.isPB && <span style={{ marginLeft: '5px' }}>↑ PB</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Live Countdown Card ──────────────────────────────────────────────────────

function CountdownCard({ race }: { race: Race }) {
  const navigate = useNavigate()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const diff  = Math.max(0, new Date(race.date + 'T00:00:00').getTime() - now)
  const days  = Math.floor(diff / 86400000)
  const hrs   = Math.floor((diff % 86400000) / 3600000)
  const mins  = Math.floor((diff % 3600000) / 60000)
  const secs  = Math.floor((diff % 60000) / 1000)
  const p2    = (n: number) => n.toString().padStart(2, '0')

  const priority = race.priority ?? 'A'

  return (
    <div style={st.countdownCard}>
      {/* Header row */}
      <div style={st.countdownHeader}>
        <div style={st.countdownHeaderLeft}>
          <span style={st.countdownDash}>—</span>
          <span style={st.aBadge}>{priority}</span>
          <span style={st.aRaceLabel}>{priority} RACE</span>
        </div>
        <button style={st.editBtn} onClick={() => navigate('/races')}>
          <IconEdit />
          <span>EDIT</span>
        </button>
      </div>

      {/* Race name */}
      <div style={st.countdownRaceName}>{(race.name ?? '').toUpperCase()}</div>

      {/* Location */}
      <div style={st.countdownLocation}>
        <IconPin size={11} />
        <span style={{ color: 'var(--orange)' }}>
          {[race.city, race.country].filter(Boolean).join(', ')}
        </span>
        {race.distance && (
          <span style={{ color: 'var(--muted)' }}>
            &nbsp;·&nbsp;{distBadge(race.distance) || race.distance + 'K'}
          </span>
        )}
        <span style={{ color: 'var(--muted)' }}>
          &nbsp;·&nbsp;{fmtDateIntl(race.date)}
        </span>
      </div>

      {/* Countdown digits */}
      <div style={st.countdownRow}>
        <div style={st.countdownUnit}>
          <div style={st.countdownNum}>{days}</div>
          <div style={st.countdownUnitLabel}>DAYS</div>
        </div>
        <div style={st.countdownSep}>:</div>
        <div style={st.countdownUnit}>
          <div style={st.countdownNum}>{p2(hrs)}</div>
          <div style={st.countdownUnitLabel}>HRS</div>
        </div>
        <div style={st.countdownSep}>:</div>
        <div style={st.countdownUnit}>
          <div style={st.countdownNum}>{p2(mins)}</div>
          <div style={st.countdownUnitLabel}>MINS</div>
        </div>
        <div style={st.countdownSep}>:</div>
        <div style={st.countdownUnit}>
          <div style={st.countdownNum}>{p2(secs)}</div>
          <div style={st.countdownUnitLabel}>SECS</div>
        </div>
      </div>

      <div style={st.countdownDivider} />

      {/* All upcoming link */}
      <button style={st.allRacesBtn} onClick={() => navigate('/races')}>
        ALL UPCOMING RACES →
      </button>
    </div>
  )
}

// ─── Course Info Card ─────────────────────────────────────────────────────────

function CourseInfoCard({ race }: { race: Race }) {
  const tags = useMemo(() => {
    const t: string[] = []
    if (race.surface) t.push(race.surface.toUpperCase())
    if (typeof race.elevation === 'number') {
      t.push(race.elevation > 300 ? 'HILLY' : 'FLAT')
    }
    return t
  }, [race])

  if (!race.notes && tags.length === 0) return null

  return (
    <div style={st.infoCard}>
      {tags.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {tags.map(tag => <span key={tag} style={st.terrainTag}>{tag}</span>)}
        </div>
      )}
      {race.notes && <p style={st.infoText}>{race.notes}</p>}
    </div>
  )
}

// ─── Weather Card ─────────────────────────────────────────────────────────────

function WeatherCard({ race }: { race: Race }) {
  const days = daysUntil(race.date)
  const location = [race.city, race.country].filter(Boolean).join(', ').toUpperCase()

  return (
    <div style={st.weatherCard}>
      <div style={{ fontSize: '11px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
        {location}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '32px', lineHeight: 1, flexShrink: 0 }}>🌤</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: '15px', color: 'var(--white)', letterSpacing: '0.02em' }}>
            −° − −°C
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '2px', lineHeight: 1.4 }}>
            {days > 14
              ? 'Forecast becomes available 14 days before race day.'
              : 'Loading forecast…'}
          </div>
        </div>
        <div style={st.daysPill}>{days} DAYS</div>
      </div>
    </div>
  )
}

// ─── Recent Races ─────────────────────────────────────────────────────────────

function RecentRaces({ onAddRace }: { onAddRace: () => void }) {
  const races = useRaceStore(selectRaces)
  const today = todayStr()
  const pbMap = useMemo(() => buildPBMap(races), [races])
  const recent = useMemo(
    () => races.filter(r => r.date <= today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3),
    [races, today],
  )

  if (races.length === 0) {
    return (
      <div style={st.sectionCard}>
        <div style={st.sectionHeader}>RECENT RACES</div>
        <div style={st.emptyState}>
          <div style={{ fontSize: '28px' }}>🏁</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', maxWidth: '240px', lineHeight: 1.5, textAlign: 'center' }}>
            No races yet.
          </div>
          <button style={st.ctaOutline} onClick={onAddRace}>+ Add Race</button>
        </div>
      </div>
    )
  }

  return (
    <div style={st.sectionCard}>
      <div style={st.sectionHeader}>RECENT RACES</div>
      {recent.map((r, i) => {
        const isPB = !!r.time && pbMap[r.distance]?.id === r.id
        return (
          <div key={r.id} style={{
            ...st.raceRow,
            borderBottom: i < recent.length - 1 ? '1px solid var(--border)' : 'none',
            ...(isPB ? st.raceRowPB : {}),
          }}>
            <div style={st.raceDate}>{r.date ? fmtShortDate(r.date) : '—'}</div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--white)' }}>
                {r.name}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {[r.city, r.country].filter(Boolean).join(', ')}
                {distBadge(r.distance) ? ` · ${distBadge(r.distance)}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
              {r.time && <div style={st.raceTime}>{r.time}</div>}
              {isPB && <div style={st.pbTag}>PB</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Stats Strip ─────────────────────────────────────────────────────────────

function StatsStrip() {
  const races = useRaceStore(selectRaces)
  const stats = useMemo(() => [
    { label: 'RACES',     value: races.length.toString() },
    { label: 'COUNTRIES', value: uniqueCountries(races).toString() },
    { label: 'TOTAL KM',  value: Math.round(totalKm(races)).toLocaleString() },
    { label: 'MEDALS',    value: medalCount(races).toString() },
  ], [races])

  return (
    <div style={st.statsStrip}>
      {stats.map(s => (
        <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--headline)', fontSize: '22px', fontWeight: 900, lineHeight: 1, color: 'var(--white)', letterSpacing: '0.02em' }}>
            {s.value}
          </div>
          <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Zone accordion ───────────────────────────────────────────────────────────

interface ZoneProps {
  id:       'now' | 'recently' | 'trending' | 'context'
  tag:      string   // small orange label e.g. "NOW"
  label:    string   // large white label e.g. "RACE DAY"
  children: React.ReactNode
}

function DashZone({ id, tag, label, children }: ZoneProps) {
  const zoneCollapse    = useDashStore(selectDashZoneCollapse)
  const setZoneCollapse = useDashStore(s => s.setZoneCollapse)
  const isCollapsed     = zoneCollapse[id] ?? false

  return (
    <div style={st.zone}>
      <button
        style={st.zoneBtn}
        onClick={() => setZoneCollapse(id, !isCollapsed)}
        aria-expanded={!isCollapsed}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={st.zoneTag}>{tag}</span>
          <span style={st.zoneLabel}>{label}</span>
        </div>
        <span style={{
          ...st.zoneChevron,
          transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
        }}>▾</span>
      </button>
      {!isCollapsed && (
        <div style={st.zoneContent}>{children}</div>
      )}
    </div>
  )
}

// ─── Widget placeholder ───────────────────────────────────────────────────────

function WidgetShell({ label }: { label: string }) {
  return (
    <div style={st.widgetShell}>
      <div style={st.widgetShellLabel}>{label}</div>
      <Skeleton height={44} borderRadius={8} />
    </div>
  )
}

// ─── Pace Calculator ─────────────────────────────────────────────────────────

const PACE_DISTS = [
  { label: '5K',            km: 5 },
  { label: '10K',           km: 10 },
  { label: 'Half Marathon', km: 21.0975 },
  { label: 'Marathon',      km: 42.195 },
]

function secsToMMSS(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${Math.round(s % 60).toString().padStart(2, '0')}`
}

function parseHMS(str: string): number | null {
  const p = str.trim().split(':').map(Number)
  if (p.some(isNaN)) return null
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2]
  if (p.length === 2) return p[0] * 60 + p[1]
  return null
}

function PaceCalculator() {
  const [distIdx, setDistIdx] = useState(2)
  const [goalTime, setGoalTime] = useState('')
  const [result, setResult] = useState<{ km: string; mi: string } | null>(null)

  return (
    <div style={st.sectionCard}>
      <div style={st.sectionHeader}>PACE CALCULATOR</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', minWidth: 0 }}>
          <div>
            <label style={st.inputLabel}>Distance</label>
            <select value={distIdx} onChange={e => { setDistIdx(+e.target.value); setResult(null) }} style={st.select}>
              {PACE_DISTS.map((d, i) => <option key={d.label} value={i}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label style={st.inputLabel}>Goal Time</label>
            <input type="text" placeholder="1:45:00" value={goalTime}
              onChange={e => { setGoalTime(e.target.value); setResult(null) }} style={st.input} />
          </div>
        </div>
        <button style={st.ctaPrimary} onClick={() => {
          const secs = parseHMS(goalTime)
          if (!secs) return
          const d = PACE_DISTS[distIdx]
          setResult({ km: secsToMMSS(secs / d.km), mi: secsToMMSS(secs / (d.km / 1.60934)) })
        }}>Calculate</button>
        {result && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', minWidth: 0 }}>
            <div style={st.paceResult}>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '24px', color: 'var(--orange)', letterSpacing: '0.02em', lineHeight: 1.1 }}>{result.km}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>min/km</div>
            </div>
            <div style={st.paceResult}>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '24px', color: 'var(--white)', letterSpacing: '0.02em', lineHeight: 1.1 }}>{result.mi}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>min/mi</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Customize modal ──────────────────────────────────────────────────────────

function DashCustomizeModal({ onClose }: { onClose: () => void }) {
  const widgets        = useDashStore(s => s.widgets)
  const setWidgetEnabled = useDashStore(s => s.setWidgetEnabled)

  return (
    <div style={st.modalOverlay} onClick={onClose}>
      <div style={st.modalSheet} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '15px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--white)' }}>
            CUSTOMISE DASHBOARD
          </span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '16px', cursor: 'pointer', padding: '4px 8px' }}>✕</button>
        </div>
        {widgets.map(w => (
          <label key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', minWidth: 0 }}>
            <span style={{ fontSize: '16px', flexShrink: 0, width: '20px', textAlign: 'center' }}>{w.icon}</span>
            <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--white)', fontFamily: 'var(--body)', fontWeight: 500, minWidth: 0 }}>{w.label}</span>
            <span style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', flexShrink: 0 }}>{w.zone}</span>
            <input type="checkbox" checked={w.enabled} onChange={e => setWidgetEnabled(w.id, e.target.checked)}
              style={{ accentColor: 'var(--orange)', width: '16px', height: '16px', flexShrink: 0 }} />
          </label>
        ))}
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function Dashboard() {
  const [showCustomize, setShowCustomize] = useState(false)
  const [showAddRace,   setShowAddRace]   = useState(false)
  const nextRace = useRaceStore(selectNextRace)

  const openAddRace = () => setShowAddRace(true)

  return (
    <div style={st.page}>
      {showCustomize && <DashCustomizeModal onClose={() => setShowCustomize(false)} />}
      {showAddRace   && <AddRaceModal       onClose={() => setShowAddRace(false)} />}

      <GreetingCard onCustomize={() => setShowCustomize(true)} />
      <PreRaceBriefing onAddRace={openAddRace} />

      <DashZone id="now" tag="NOW" label="RACE DAY">
        {nextRace
          ? <CountdownCard race={nextRace} />
          : <WidgetShell label="No upcoming race — add one to start the countdown" />
        }
        {nextRace && <CourseInfoCard race={nextRace} />}
        {nextRace && <WeatherCard race={nextRace} />}
      </DashZone>

      <DashZone id="recently" tag="RECENTLY" label="YOUR SEASON">
        <StatsStrip />
        <RecentRaces onAddRace={openAddRace} />
        <WidgetShell label="Personal Bests" />
      </DashZone>

      <DashZone id="trending" tag="CONSISTENCY" label="BUILD">
        <WidgetShell label="Training Streak" />
        <WidgetShell label="Pacing IQ" />
        <WidgetShell label="Career Momentum" />
      </DashZone>

      <DashZone id="context" tag="PATTERNS" label="ANALYSIS">
        <WidgetShell label="Race DNA" />
        <WidgetShell label="Age Grade" />
        <WidgetShell label="On This Day" />
      </DashZone>

      <PaceCalculator />
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = {
  page: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '1rem',
    padding: '16px',
    paddingBottom: '96px',
    fontFamily: 'var(--body)',
    color: 'var(--white)',
    minWidth: 0,
  } as React.CSSProperties,

  // ── Greeting
  greetingCard: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    minWidth: 0,
  } as React.CSSProperties,

  greetingContent: {
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,

  greetingLine: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'baseline',
    lineHeight: 1.1,
  } as React.CSSProperties,

  greetingText: {
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '22px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    color: 'var(--white)',
  } as React.CSSProperties,

  greetingName: {
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '22px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    color: 'var(--orange)',
  } as React.CSSProperties,

  greetingSubtext: {
    fontSize: 'var(--text-sm)',
    color: 'var(--muted)',
    marginTop: '6px',
    lineHeight: 1.4,
  } as React.CSSProperties,

  gridBtn: {
    width: '40px',
    height: '40px',
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: '10px',
    color: 'var(--muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  } as React.CSSProperties,

  // ── Pre-race briefing
  briefingCard: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '20px',
    minWidth: 0,
  } as React.CSSProperties,

  briefingInner: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  } as React.CSSProperties,

  briefingTag: {
    fontFamily: 'var(--headline)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.14em',
    color: 'var(--orange)',
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,

  briefingTitle: {
    fontFamily: 'var(--headline)',
    fontSize: '26px',
    fontWeight: 900,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    lineHeight: 1.1,
    color: 'var(--white)',
  } as React.CSSProperties,

  briefingMeta: {
    fontSize: 'var(--text-sm)',
    color: 'var(--muted)',
  } as React.CSSProperties,

  lastRacePill: {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'rgba(var(--green-ch), 0.12)',
    border: '1px solid rgba(var(--green-ch), 0.25)',
    color: 'var(--green)',
    borderRadius: '100px',
    padding: '5px 12px',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    width: 'fit-content',
  } as React.CSSProperties,

  // ── Countdown
  countdownCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    minWidth: 0,
  } as React.CSSProperties,

  countdownHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as React.CSSProperties,

  countdownHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
  } as React.CSSProperties,

  countdownDash: {
    color: 'var(--muted)',
    fontWeight: 700,
    fontSize: '14px',
  } as React.CSSProperties,

  aBadge: {
    background: 'var(--orange)',
    color: '#000',
    borderRadius: '4px',
    padding: '2px 8px',
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '13px',
    letterSpacing: '0.04em',
    lineHeight: 1.4,
  } as React.CSSProperties,

  aRaceLabel: {
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    fontSize: '12px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--muted)',
  } as React.CSSProperties,

  editBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    background: 'transparent',
    border: '1px solid var(--border2)',
    borderRadius: '6px',
    color: 'var(--muted)',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    fontSize: '11px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    padding: '5px 10px',
    cursor: 'pointer',
  } as React.CSSProperties,

  countdownRaceName: {
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '26px',
    letterSpacing: '0.03em',
    textTransform: 'uppercase' as const,
    color: 'var(--white)',
    lineHeight: 1.1,
  } as React.CSSProperties,

  countdownLocation: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: '2px',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--body)',
  } as React.CSSProperties,

  countdownRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '2px',
    marginTop: '4px',
    minWidth: 0,
  } as React.CSSProperties,

  countdownUnit: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    minWidth: 0,
  } as React.CSSProperties,

  countdownNum: {
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '52px',
    color: 'var(--white)',
    lineHeight: 1,
    letterSpacing: '-0.02em',
  } as React.CSSProperties,

  countdownUnitLabel: {
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    fontSize: '9px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--muted)',
    marginTop: '4px',
  } as React.CSSProperties,

  countdownSep: {
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '36px',
    color: 'var(--muted)',
    lineHeight: 1,
    paddingTop: '8px',
    flexShrink: 0,
  } as React.CSSProperties,

  countdownDivider: {
    height: '1px',
    background: 'var(--border)',
    margin: '2px 0',
  } as React.CSSProperties,

  allRacesBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--muted)',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    fontSize: '11px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    textAlign: 'left' as const,
    padding: 0,
    display: 'block',
  } as React.CSSProperties,

  // ── Course info
  infoCard: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    minWidth: 0,
  } as React.CSSProperties,

  terrainTag: {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'transparent',
    border: '1px solid var(--border2)',
    borderRadius: '100px',
    padding: '4px 12px',
    fontSize: '11px',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--white)',
  } as React.CSSProperties,

  infoText: {
    margin: 0,
    fontSize: 'var(--text-sm)',
    color: 'var(--muted)',
    lineHeight: 1.55,
  } as React.CSSProperties,

  // ── Weather
  weatherCard: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '14px',
    minWidth: 0,
  } as React.CSSProperties,

  daysPill: {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'var(--orange)',
    color: '#000',
    borderRadius: '100px',
    padding: '6px 14px',
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '12px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    flexShrink: 0,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  // ── Recent races
  sectionCard: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    minWidth: 0,
  } as React.CSSProperties,

  sectionHeader: {
    fontFamily: 'var(--headline)',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: 'var(--muted)',
  } as React.CSSProperties,

  raceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 0',
    minWidth: 0,
  } as React.CSSProperties,

  raceRowPB: {
    borderLeft: '3px solid var(--green)',
    paddingLeft: '10px',
    marginLeft: '-10px',
  } as React.CSSProperties,

  raceDate: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    letterSpacing: '0.06em',
    color: 'var(--muted)',
    whiteSpace: 'nowrap' as const,
    textTransform: 'uppercase' as const,
    width: '52px',
    flexShrink: 0,
  } as React.CSSProperties,

  raceTime: {
    fontFamily: 'var(--headline)',
    fontSize: 'var(--text-sm)',
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: 'var(--white)',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  pbTag: {
    background: 'rgba(var(--green-ch), 0.15)',
    color: 'var(--green)',
    fontSize: '10px',
    fontFamily: 'var(--headline)',
    fontWeight: 800,
    letterSpacing: '0.06em',
    padding: '2px 6px',
    borderRadius: '4px',
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,

  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '12px',
    padding: '20px 0',
  } as React.CSSProperties,

  // ── Stats strip
  statsStrip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1rem',
    background: 'var(--surface3)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '14px 12px',
    minWidth: 0,
  } as React.CSSProperties,

  // ── Zone
  zone: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    overflow: 'hidden',
    minWidth: 0,
  } as React.CSSProperties,

  zoneBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left' as const,
  } as React.CSSProperties,

  zoneTag: {
    fontFamily: 'var(--headline)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    color: 'var(--orange)',
  } as React.CSSProperties,

  zoneLabel: {
    fontFamily: 'var(--headline)',
    fontSize: '17px',
    fontWeight: 900,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: 'var(--white)',
    lineHeight: 1.1,
  } as React.CSSProperties,

  zoneChevron: {
    fontSize: '14px',
    color: 'var(--muted)',
    transition: 'transform 0.2s ease',
    display: 'inline-block',
    flexShrink: 0,
  } as React.CSSProperties,

  zoneContent: {
    padding: '0 12px 12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
    minWidth: 0,
  } as React.CSSProperties,

  // ── Widget shell
  widgetShell: {
    background: 'var(--surface3)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    minWidth: 0,
  } as React.CSSProperties,

  widgetShellLabel: {
    fontFamily: 'var(--headline)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--muted)',
  } as React.CSSProperties,

  // ── Pace calc
  inputLabel: {
    display: 'block',
    fontSize: '11px',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--muted)',
    marginBottom: '4px',
  } as React.CSSProperties,

  select: {
    width: '100%',
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: '6px',
    color: 'var(--white)',
    fontSize: 'var(--text-sm)',
    padding: '0.55rem 0.75rem',
    fontFamily: 'var(--body)',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  input: {
    width: '100%',
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: '6px',
    color: 'var(--white)',
    fontSize: 'var(--text-sm)',
    padding: '0.55rem 0.75rem',
    fontFamily: 'var(--body)',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  paceResult: {
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    minWidth: 0,
  } as React.CSSProperties,

  // ── CTAs
  ctaPrimary: {
    marginTop: '4px',
    background: 'var(--orange)',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 18px',
    fontFamily: 'var(--headline)',
    fontWeight: 800,
    fontSize: '13px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    alignSelf: 'flex-start',
  } as React.CSSProperties,

  ctaOutline: {
    marginTop: '4px',
    background: 'transparent',
    color: 'var(--orange)',
    border: '1px solid rgba(var(--orange-ch), 0.5)',
    borderRadius: '8px',
    padding: '10px 18px',
    fontFamily: 'var(--headline)',
    fontWeight: 800,
    fontSize: '13px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    alignSelf: 'flex-start',
  } as React.CSSProperties,

  // ── Modal
  modalOverlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    zIndex: 900,
    display: 'flex',
    alignItems: 'flex-end',
  } as React.CSSProperties,

  modalSheet: {
    width: '100%',
    maxHeight: '80vh',
    overflowY: 'auto' as const,
    background: 'var(--surface2)',
    borderTop: '1px solid var(--border2)',
    borderRadius: '16px 16px 0 0',
    padding: '20px 16px 32px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0',
  } as React.CSSProperties,
} as const

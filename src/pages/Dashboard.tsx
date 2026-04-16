import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRaceStore } from '@/stores/useRaceStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { useDashStore } from '@/stores/useDashStore'
import { selectRaces, selectNextRace, selectAthlete, selectDashZoneCollapse } from '@/stores/selectors'
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

// Canonical label → km mapping (covers both numeric strings and named distances)
const DIST_LABEL_KM: Record<string, number> = {
  'marathon': 42.195,
  'full marathon': 42.195,
  'half marathon': 21.0975,
  'half': 21.0975,
  'ironman': 226,
  'full ironman': 226,
  'half ironman': 113,
  '70.3': 113,
  'olympic': 51.5,
  'olympic triathlon': 51.5,
  'sprint': 25.75,
  'sprint triathlon': 25.75,
  '5k': 5,
  '10k': 10,
  '15k': 15,
  '20k': 20,
  '25k': 25,
  '30k': 30,
  '50k': 50,
  '60k': 60,
  '80k': 80,
  '90k': 90,
  '100k': 100,
  '160k': 160,
  '50mi': 80.47,
  '100mi': 160.93,
  'ultra': 50,
  'ultramarathon': 50,
  'mile': 1.609,
  '1 mile': 1.609,
  '5 mile': 8.047,
  '10 mile': 16.09,
}

function distanceToKm(d: string | undefined): number {
  if (!d) return 0
  const n = parseFloat(d)
  if (!isNaN(n)) return n
  return DIST_LABEL_KM[d.toLowerCase().trim()] ?? 0
}

// Normalize different representations of the same distance to one canonical key
function normalizeDistKey(d: string | undefined): string {
  if (!d) return ''
  const km = distanceToKm(d)
  if (km <= 0) return d.toLowerCase().trim()
  if (km >= 42 && km <= 42.3) return 'Marathon'
  if (km >= 21 && km <= 21.2) return 'Half Marathon'
  if (km >= 10 && km <= 10.1) return '10K'
  if (km >= 5 && km <= 5.1) return '5K'
  return `${km}`
}

function distBadge(d: string | undefined): string {
  if (!d) return ''
  const n = distanceToKm(d)
  if (n === 0) return d
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
    const key = normalizeDistKey(r.distance)
    if (!pb[key] || r.time < pb[key].time!) pb[key] = r
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
  return races.reduce((s, r) => s + distanceToKm(r.distance), 0)
}
function medalCount(races: Race[]) {
  return races.filter(r => r.medal && r.medal !== 'finisher').length
}

function computeAge(dob: string | undefined): number | null {
  if (!dob) return null
  const birth = new Date(dob + 'T00:00:00')
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

function parseHMS(str: string): number | null {
  const p = str.trim().split(':').map(Number)
  if (p.some(isNaN)) return null
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2]
  if (p.length === 2) return p[0] * 60 + p[1]
  return null
}

function secsToHMS(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.round(s % 60)
  return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

function computeMomentum(races: Race[]): { score: number; badge: string } {
  const past = races.filter(r => r.date <= todayStr() && r.time && r.distance)
    .sort((a, b) => b.date.localeCompare(a.date))
  if (past.length < 2) return { score: 1.0, badge: 'NEUTRAL' }
  const pbMap = buildPBMap(past)
  const last = past[0]
  const pb = pbMap[normalizeDistKey(last.distance)]
  if (!pb?.time || !last.time) return { score: 1.0, badge: 'NEUTRAL' }
  const lastSecs = parseHMS(last.time)
  const pbSecs = parseHMS(pb.time)
  if (!lastSecs || !pbSecs || pbSecs === 0) return { score: 1.0, badge: 'NEUTRAL' }
  const ratio = Math.min(1.0, pbSecs / lastSecs)
  const badge = ratio >= 1.0 ? 'HOT' : ratio >= 0.97 ? 'RISING' : ratio >= 0.93 ? 'NEUTRAL' : 'COOLING'
  return { score: parseFloat(ratio.toFixed(2)), badge }
}

// Boston Qualifying standards (2027, seconds)
const BQ_TIMES: Record<string, number> = {
  M18: 10800, M35: 11100, M40: 11400, M45: 12000, M50: 12300,
  M55: 12900, M60: 13800, M65: 14700, M70: 15600, M75: 16500, M80: 17400,
  F18: 12600, F35: 12900, F40: 13200, F45: 13800, F50: 14100,
  F55: 14700, F60: 15600, F65: 16500, F70: 17400, F75: 18300, F80: 19200,
}

function getBQTarget(dob: string | undefined, gender: string | undefined): number | null {
  const age = computeAge(dob)
  if (age === null || !gender) return null
  const g = gender === 'M' ? 'M' : 'F'
  const brackets = [80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 18]
  const bracket = brackets.find(b => age >= b) ?? 18
  return BQ_TIMES[`${g}${bracket}`] ?? null
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

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      style={{
        width: '46px', height: '27px',
        background: checked ? 'var(--orange)' : 'var(--surface3)',
        borderRadius: '14px',
        border: `1px solid ${checked ? 'rgba(var(--orange-ch), 0.5)' : 'var(--border2)'}`,
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.2s ease, border-color 0.2s ease',
        flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute',
        top: '3px',
        left: checked ? '22px' : '3px',
        width: '19px', height: '19px',
        background: '#fff',
        borderRadius: '50%',
        transition: 'left 0.2s ease',
        boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
      }} />
    </div>
  )
}

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
  const races    = useRaceStore(selectRaces)
  const nextRace = useRaceStore(selectNextRace)
  const today    = todayStr()
  const pbMap    = useMemo(() => buildPBMap(races), [races])

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

// ─── Countdown Card ───────────────────────────────────────────────────────────

function CountdownCard({ race }: { race: Race }) {
  const navigate = useNavigate()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const diff = Math.max(0, new Date(race.date + 'T00:00:00').getTime() - now)
  const days = Math.floor(diff / 86400000)
  const hrs  = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  const secs = Math.floor((diff % 60000) / 1000)
  const p2   = (n: number) => n.toString().padStart(2, '0')
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
        <span style={{ color: 'var(--muted)' }}>&nbsp;·&nbsp;{fmtDateIntl(race.date)}</span>
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
      <button style={st.allRacesBtn} onClick={() => navigate('/races')}>ALL UPCOMING RACES →</button>
    </div>
  )
}

// ─── Course Info Card ─────────────────────────────────────────────────────────

function CourseInfoCard({ race }: { race: Race }) {
  const tags = useMemo(() => {
    const t: string[] = []
    if (race.surface) t.push(race.surface.toUpperCase())
    if (typeof race.elevation === 'number') t.push(race.elevation > 300 ? 'HILLY' : 'FLAT')
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
            {days > 14 ? 'Forecast available 14 days before race day.' : 'Loading forecast…'}
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
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', maxWidth: '240px', lineHeight: 1.5, textAlign: 'center' }}>No races yet.</div>
          <button style={st.ctaOutline} onClick={onAddRace}>+ Add Race</button>
        </div>
      </div>
    )
  }

  return (
    <div style={st.sectionCard}>
      <div style={st.sectionHeader}>RECENT RACES</div>
      {recent.map((r, i) => {
        const isPB = !!r.time && pbMap[normalizeDistKey(r.distance)]?.id === r.id
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
          <div style={{ fontFamily: 'var(--headline)', fontSize: '22px', fontWeight: 900, lineHeight: 1, color: 'var(--green)', letterSpacing: '0.02em' }}>
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

// ─── Season Planner Widget ────────────────────────────────────────────────────

function SeasonPlannerWidget({ onAddRace }: { onAddRace: () => void }) {
  const races = useRaceStore(selectRaces)
  const navigate = useNavigate()
  const today = todayStr()

  const upcoming90 = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + 90)
    const cutoffStr = cutoff.toISOString().split('T')[0]
    return races.filter(r => r.date > today && r.date <= cutoffStr)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [races, today])

  const taperFor = (dist: string) => {
    const n = distanceToKm(dist)
    if (n >= 42) return { taper: 14, recover: 12 }
    if (n >= 21) return { taper: 10, recover: 7 }
    if (n >= 10) return { taper: 7, recover: 5 }
    return { taper: 5, recover: 3 }
  }

  const badge = upcoming90.length >= 3 ? 'HIGH' : upcoming90.length >= 1 ? 'MEDIUM' : 'LOW'
  const badgeColors = { HIGH: 'var(--orange)', MEDIUM: '#FFD770', LOW: 'var(--muted)' }
  const bc = badgeColors[badge]

  return (
    <div style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>SEASON PLANNER</div>
          <div style={st.widgetTitle}>NEXT 90 DAYS</div>
        </div>
        <span style={{ ...st.badgePill, background: `${bc}22`, color: bc, border: `1px solid ${bc}55`, flexShrink: 0 }}>{badge}</span>
      </div>

      {upcoming90.length === 0 ? (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', lineHeight: 1.6 }}>
          No races in the next 90 days.
          <br />
          <button style={st.ghostLink} onClick={onAddRace}>+ Add a race</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {upcoming90.slice(0, 3).map(r => {
              const { taper, recover } = taperFor(r.distance)
              const p = r.priority ?? 'C'
              return (
                <div key={r.id} style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>
                  <span style={{ color: p === 'A' ? 'var(--white)' : p === 'B' ? 'rgba(245,245,245,0.6)' : 'var(--muted)' }}>{p}</span>
                  {` · ${r.name} · taper ${taper}d / recover ${recover}d`}
                </div>
              )
            })}
          </div>
          <div style={st.widgetDivider} />
          <button style={st.ghostOutlineBtn} onClick={() => navigate('/races')}>OPEN PLANNER</button>
        </>
      )}
    </div>
  )
}

// ─── Recovery Intelligence Widget ────────────────────────────────────────────

function RecoveryIntelWidget() {
  const races = useRaceStore(selectRaces)
  const today = todayStr()

  const lastRace = useMemo(
    () => races.filter(r => r.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0],
    [races, today],
  )

  if (!lastRace) {
    return (
      <div style={st.glowCard}>
        <div style={st.widgetLabel}>RECOVERY INTELLIGENCE</div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '6px' }}>Log your first race to track recovery.</div>
      </div>
    )
  }

  const dist = distanceToKm(lastRace.distance)
  const recoveryDays = dist >= 42 ? 14 : dist >= 21 ? 7 : dist >= 10 ? 3 : 2
  const daysSince = daysAgo(lastRace.date)
  const daysLeft = Math.max(0, recoveryDays - daysSince)
  const loadScore = Math.min(100, Math.round(dist * 2))
  const badge = recoveryDays >= 14 ? 'HIGH' : recoveryDays >= 7 ? 'MEDIUM' : 'LOW'
  const bc = badge === 'HIGH' ? 'var(--orange)' : badge === 'MEDIUM' ? '#FFD770' : 'var(--green)'

  return (
    <div style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>RECOVERY INTELLIGENCE</div>
          <div style={st.widgetTitle}>{(lastRace.name ?? '').toUpperCase()}</div>
        </div>
        <span style={{ ...st.badgePill, background: `${bc}22`, color: bc, border: `1px solid ${bc}55`, flexShrink: 0 }}>{badge}</span>
      </div>

      <div>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '68px', lineHeight: 1, color: 'var(--white)', letterSpacing: '-0.02em' }}>
          {daysLeft}d
        </div>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: '4px' }}>
          ESTIMATED RECOVERY
        </div>
      </div>

      <div style={st.widgetDivider} />

      <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.55 }}>
        Recent race load score: {loadScore}. Use this to avoid stacking hard events too closely.
      </div>
    </div>
  )
}

// ─── Training Correlation Widget (locked) ─────────────────────────────────────

function TrainingCorrelWidget() {
  return (
    <div style={{ ...st.glowCard, border: '1px dashed var(--border2)' }}>
      <div style={st.widgetLabel}>TRAINING CORRELATION</div>
      <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6, marginTop: '6px' }}>
        Connect Strava and build a few matched race windows to see how load tracks with outcomes.
      </div>
    </div>
  )
}

// ─── Boston Qualifier Widget ──────────────────────────────────────────────────

function BostonQualWidget() {
  const athlete = useAthleteStore(selectAthlete)
  const races   = useRaceStore(selectRaces)

  const marathonPB = useMemo(() => {
    const ms = races.filter(r => {
      const d = distanceToKm(r.distance); return d >= 42 && d <= 42.3 && r.time
    })
    return ms.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))[0] ?? null
  }, [races])

  const bqTarget = useMemo(() => getBQTarget(athlete?.dob, athlete?.gender), [athlete])
  const hasProfile = !!(athlete?.dob && athlete?.gender)

  return (
    <div style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>B.A.A.</div>
          <div style={st.widgetTitle}>BOSTON QUALIFIER</div>
        </div>
        <span style={{ ...st.badgePill, background: 'rgba(var(--orange-ch), 0.12)', color: 'var(--orange)', border: '1px solid rgba(var(--orange-ch), 0.3)', flexShrink: 0 }}>2027</span>
      </div>

      {!hasProfile ? (
        <div style={st.lockedBox}>
          <div style={st.lockedTitle}>PROFILE NEEDED</div>
          <div style={st.lockedText}>Add age group and gender in your athlete profile to unlock your official Boston qualifying target.</div>
        </div>
      ) : bqTarget && marathonPB ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '28px', color: 'var(--white)', lineHeight: 1 }}>
            {secsToHMS(bqTarget)}
          </div>
          <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase' }}>BQ TARGET</div>
          {(() => {
            const pbSecs = parseHMS(marathonPB.time!)
            if (!pbSecs) return null
            const gap = pbSecs - bqTarget
            const color = gap <= 0 ? 'var(--green)' : 'var(--orange)'
            const label = gap <= 0 ? `${secsToHMS(Math.abs(gap))} under BQ ✓` : `${secsToHMS(gap)} over BQ`
            return <div style={{ fontSize: 'var(--text-sm)', color, fontWeight: 600, marginTop: '4px' }}>{label}</div>
          })()}
        </div>
      ) : (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '6px' }}>Log a marathon to see your BQ gap.</div>
      )}
    </div>
  )
}

// ─── Pacing IQ Widget ─────────────────────────────────────────────────────────

function PacingIQWidget() {
  const races = useRaceStore(selectRaces)

  const analysis = useMemo(() => {
    const withSplits = races.filter(r => r.splits && r.splits.length >= 2)
    if (!withSplits.length) return null
    let faded = 0, negative = 0, even = 0
    for (const r of withSplits) {
      const splits = (r.splits ?? []).filter(s => s.split)
      if (splits.length < 2) continue
      const first = parseHMS(splits[0].split!) ?? 0
      const last  = parseHMS(splits[splits.length - 1].split!) ?? 0
      if (last > first * 1.02) faded++
      else if (last < first * 0.98) negative++
      else even++
    }
    const total = faded + negative + even
    if (total === 0) return null
    const dominant = faded > negative && faded > even ? 'FADER' :
      negative > even ? 'NEGATIVE SPLITTER' : 'EVEN PACER'
    return { faded, negative, even, total, dominant }
  }, [races])

  return (
    <div style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>PACING IQ</div>
          <div style={st.widgetTitle}>RACE RHYTHM</div>
        </div>
        <span style={st.iconBox}>🧠</span>
      </div>

      {!analysis ? (
        <div style={st.lockedBox}>
          <div style={st.lockedTitle}>UNLOCK YOUR PACING PATTERN</div>
          <div style={st.lockedText}>Add splits when logging races to reveal whether you pace aggressively, evenly, or fade late.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '22px', color: 'var(--green)', letterSpacing: '0.04em' }}>
            {analysis.dominant}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>
            Based on {analysis.total} races with split data.
            Fade rate: {Math.round((analysis.faded / analysis.total) * 100)}%.
            Negative splits: {Math.round((analysis.negative / analysis.total) * 100)}%.
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Career Momentum Widget ───────────────────────────────────────────────────

function CareerMomentumWidget() {
  const races = useRaceStore(selectRaces)
  const { score, badge } = useMemo(() => computeMomentum(races), [races])

  const bc = badge === 'HOT' ? 'var(--orange)' : badge === 'RISING' ? '#FFD770' :
    badge === 'NEUTRAL' ? 'var(--muted)' : 'rgba(var(--orange-ch), 0.4)'

  return (
    <div style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>CAREER MOMENTUM</div>
          <div style={st.widgetTitle}>FORM TREND</div>
        </div>
        <span style={{ ...st.badgePill, background: `${bc}22`, color: bc, border: `1px solid ${bc}55`, flexShrink: 0 }}>{badge}</span>
      </div>

      <div>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '64px', lineHeight: 1, color: 'var(--green)', letterSpacing: '-0.02em' }}>
          {score.toFixed(2)}
        </div>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: '4px' }}>
          MOMENTUM
        </div>
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>→ vs last block</div>
        <div style={{ height: '3px', background: 'var(--surface3)', borderRadius: '2px', marginTop: '10px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.round(score * 100)}%`, background: 'var(--green)', borderRadius: '2px' }} />
        </div>
      </div>

      <div style={st.widgetDivider} />
      <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.55 }}>
        Weighted against your recent personal-best equivalents, this shows whether your results are trending stronger or softer over time.
      </div>
    </div>
  )
}

// ─── Age Grade Widget ─────────────────────────────────────────────────────────

function AgeGradeWidget() {
  const athlete = useAthleteStore(selectAthlete)
  const hasProfile = !!(athlete?.dob && athlete?.gender)

  return (
    <div style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>AGE-GRADE SCORE</div>
          <div style={st.widgetTitle}>PERFORMANCE CONTEXT</div>
        </div>
        <span style={{ ...st.badgePill, background: 'rgba(var(--orange-ch), 0.12)', color: 'var(--orange)', border: '1px solid rgba(var(--orange-ch), 0.3)', flexShrink: 0 }}>WA</span>
      </div>

      {!hasProfile ? (
        <div style={st.lockedBox}>
          <div style={st.lockedTitle}>PROFILE NEEDED</div>
          <div style={st.lockedText}>Add your date of birth and gender in athlete profile to unlock age-grade scoring.</div>
        </div>
      ) : (
        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Age-grade analysis requires race times. Keep logging!</div>
      )}
    </div>
  )
}

// ─── Race DNA Widget ──────────────────────────────────────────────────────────

function RaceDNAWidget() {
  const races  = useRaceStore(selectRaces)
  const today  = todayStr()
  const past   = useMemo(() => races.filter(r => r.date <= today), [races, today])

  const { fadeRate, travelCount } = useMemo(() => {
    const withSplits = past.filter(r => (r.splits ?? []).length >= 2)
    let faded = 0
    for (const r of withSplits) {
      const splits = (r.splits ?? []).filter(s => s.split)
      if (splits.length < 2) continue
      const first = parseHMS(splits[0].split!) ?? 0
      const last  = parseHMS(splits[splits.length - 1].split!) ?? 0
      if (last > first * 1.02) faded++
    }
    const fr = withSplits.length > 0 ? Math.round((faded / withSplits.length) * 100) : 0
    const tc = past.filter(r => r.country && r.country !== (past[0]?.country ?? '')).length
    return { fadeRate: fr, travelCount: tc }
  }, [past])

  return (
    <div style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>RACE DNA</div>
          <div style={st.widgetTitle}>TEMPERATURE FIT</div>
        </div>
        <span style={{ ...st.badgePill, background: 'rgba(var(--orange-ch), 0.12)', color: 'var(--orange)', border: '1px solid rgba(var(--orange-ch), 0.3)', flexShrink: 0 }}>{past.length} RACES</span>
      </div>

      {past.length === 0 ? (
        <div style={st.lockedBox}>
          <div style={st.lockedTitle}>NO DATA YET</div>
          <div style={st.lockedText}>Log your first race to start building your race DNA profile.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
            Negative split rate: {100 - fadeRate}%<br />
            Fade rate: {fadeRate}%<br />
            {travelCount > 0 && <>{travelCount} travel races<br /></>}
            No hot-weather baseline
          </div>
          <div style={st.widgetDivider} />
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
            {past.length < 5 ? `Log ${5 - past.length} more races to unlock temperature fit analysis.` : 'No comeback tags yet.'}
          </div>
          <button style={st.ghostOutlineBtn}>EXPLAIN WITH AI</button>
        </div>
      )}
    </div>
  )
}

// ─── Pattern Scan Widget ──────────────────────────────────────────────────────

function PatternScanWidget() {
  const races = useRaceStore(selectRaces)
  const today = todayStr()
  const past  = useMemo(() => races.filter(r => r.date <= today), [races, today])

  const negSplitRate = useMemo(() => {
    const w = past.filter(r => (r.splits ?? []).length >= 2)
    if (!w.length) return 0
    const neg = w.filter(r => {
      const s = (r.splits ?? []).filter(x => x.split)
      if (s.length < 2) return false
      const first = parseHMS(s[0].split!) ?? 0
      const last  = parseHMS(s[s.length - 1].split!) ?? 0
      return last < first * 0.98
    })
    return Math.round((neg.length / w.length) * 100)
  }, [past])

  return (
    <div style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>DEEP TRENDS</div>
          <div style={st.widgetTitle}>PATTERN SCAN</div>
        </div>
        <span style={{ ...st.badgePill, background: 'rgba(var(--orange-ch), 0.12)', color: 'var(--orange)', border: '1px solid rgba(var(--orange-ch), 0.3)', flexShrink: 0 }}>{past.length}</span>
      </div>

      <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.7 }}>
        Negative split rate: {negSplitRate}%<br />
        Fade rate: {100 - negSplitRate}%<br />
        {past.length} total races logged<br />
        No hot-weather baseline
      </div>

      <div style={st.widgetDivider} />

      <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '10px' }}>
        {past.length < 3 ? 'Log more races to see deep pattern analysis.' : 'No comeback tags yet.'}
      </div>
      <button style={st.ghostOutlineBtn}>EXPLAIN WITH AI</button>
    </div>
  )
}

// ─── Why Result Widget ────────────────────────────────────────────────────────

function WhyResultWidget() {
  const races = useRaceStore(selectRaces)
  const today = todayStr()

  const lastRace = useMemo(
    () => races.filter(r => r.date <= today && r.time).sort((a, b) => b.date.localeCompare(a.date))[0],
    [races, today],
  )

  if (!lastRace) {
    return (
      <div style={st.glowCard}>
        <div style={st.widgetLabel}>WHY RESULT</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px' }}>Log a timed race to unlock result analysis.</div>
      </div>
    )
  }

  return (
    <div style={st.glowCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={st.widgetLabel}>WHY RESULT</div>
          <div style={st.widgetTitle}>{(lastRace.name ?? '').toUpperCase()}</div>
        </div>
        <span style={{ ...st.badgePill, background: 'rgba(var(--orange-ch), 0.12)', color: 'var(--orange)', border: '1px solid rgba(var(--orange-ch), 0.3)', flexShrink: 0 }}>EXPLAIN</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Best: execution and context aligned well</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Tough day: course and pacing demands stacked up</div>
      </div>

      <div style={st.widgetDivider} />
      <button style={st.ghostOutlineBtn}>COACH BRIEF</button>
    </div>
  )
}

// ─── Zone accordion ───────────────────────────────────────────────────────────

interface ZoneProps {
  id:       'now' | 'recently' | 'trending' | 'context'
  tag:      string
  label:    string
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
        <span style={{ ...st.zoneChevron, transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▾</span>
      </button>
      {!isCollapsed && <div style={st.zoneContent}>{children}</div>}
    </div>
  )
}

// ─── Widget placeholder ───────────────────────────────────────────────────────

function WidgetShell({ label }: { label: string }) {
  return (
    <div style={st.widgetShell}>
      <div style={st.widgetShellLabel}>{label}</div>
      <div style={{ height: '44px', background: 'var(--surface)', borderRadius: '8px', opacity: 0.4 }} />
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

// ─── Customize Modal ──────────────────────────────────────────────────────────

const ZONE_META: Record<string, { tag: string; label: string }> = {
  now:      { tag: 'NOW',          label: 'RACE CONTEXT'   },
  recently: { tag: 'RECENTLY',     label: 'YOUR RACING'    },
  trending: { tag: 'CONSISTENCY',  label: 'BUILD'          },
  context:  { tag: 'PATTERNS',     label: 'ANALYSIS'       },
}

const ZONE_ORDER = ['now', 'recently', 'trending', 'context'] as const

function DashCustomizeModal({ onClose }: { onClose: () => void }) {
  const storeWidgets     = useDashStore(s => s.widgets)
  const getDashLayout    = useDashStore(s => s.getDashLayout)
  const setWidgetEnabled = useDashStore(s => s.setWidgetEnabled)
  const reorderWidget    = useDashStore(s => s.reorderWidget)
  const widgets          = useMemo(() => getDashLayout(), [storeWidgets, getDashLayout])

  const byZone = useMemo(() =>
    ZONE_ORDER.reduce((acc, z) => {
      acc[z] = widgets.filter(w => w.zone === z)
      return acc
    }, {} as Record<string, typeof widgets>),
    [widgets],
  )

  return (
    <div style={st.modalOverlay} onClick={onClose}>
      <div style={st.customizeSheet} onClick={e => e.stopPropagation()}>
        {/* Handle pill */}
        <div style={{ width: '40px', height: '4px', background: 'var(--border2)', borderRadius: '2px', margin: '0 auto 20px' }} />

        {/* Header */}
        <div style={{ marginBottom: '6px' }}>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '22px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--white)', lineHeight: 1.1 }}>
            CUSTOMIZE DASHBOARD
          </div>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px', lineHeight: 1.5 }}>
            Turn widgets on or off, reorder them within a section.
          </div>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--muted2)', lineHeight: 1.5, padding: '10px 12px', background: 'var(--surface3)', borderRadius: '8px', marginBottom: '4px' }}>
          Use ▲ and ▼ on a widget to reorder it within its section.
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '80px' }}>
          {ZONE_ORDER.map(zoneId => {
            const meta = ZONE_META[zoneId]
            const zWidgets = byZone[zoneId] ?? []
            return (
              <div key={zoneId} style={{ marginTop: '16px' }}>
                {/* Section header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 8px', borderTop: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--headline)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--orange)', textTransform: 'uppercase' }}>
                      SECTION
                    </div>
                    <div style={{ fontFamily: 'var(--headline)', fontSize: '15px', fontWeight: 900, letterSpacing: '0.06em', color: 'var(--white)', textTransform: 'uppercase' }}>
                      {meta.tag} — {meta.label}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={st.arrowBtn}>▲</div>
                    <div style={st.arrowBtn}>▼</div>
                  </div>
                </div>

                {/* Widget rows */}
                {zWidgets.map((w, idx) => (
                  <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 0', borderBottom: '1px solid var(--border)', minWidth: 0 }}>
                    {/* Icon box */}
                    <div style={{ width: '38px', height: '38px', background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                      {w.icon}
                    </div>
                    {/* Label + PRO badge */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--white)', fontFamily: 'var(--body)', fontWeight: 500 }}>{w.label}</span>
                        {w.pro && (
                          <span style={{ fontSize: '9px', fontFamily: 'var(--headline)', fontWeight: 800, letterSpacing: '0.08em', color: 'var(--orange)', border: '1px solid rgba(var(--orange-ch), 0.5)', borderRadius: '100px', padding: '2px 6px', flexShrink: 0 }}>
                            PRO
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Reorder buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flexShrink: 0 }}>
                      <button
                        style={{ ...st.arrowBtn, opacity: idx === 0 ? 0.25 : 1, cursor: idx === 0 ? 'default' : 'pointer' }}
                        onClick={() => idx > 0 && reorderWidget(w.id, 'up')}
                        disabled={idx === 0}
                      >▲</button>
                      <button
                        style={{ ...st.arrowBtn, opacity: idx === zWidgets.length - 1 ? 0.25 : 1, cursor: idx === zWidgets.length - 1 ? 'default' : 'pointer' }}
                        onClick={() => idx < zWidgets.length - 1 && reorderWidget(w.id, 'down')}
                        disabled={idx === zWidgets.length - 1}
                      >▼</button>
                    </div>
                    {/* Toggle */}
                    <ToggleSwitch checked={w.enabled} onChange={v => setWidgetEnabled(w.id, v)} />
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {/* DONE button — sticky at bottom */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 20px 28px', background: 'var(--surface2)', borderTop: '1px solid var(--border)' }}>
          <button style={st.doneBtn} onClick={onClose}>DONE</button>
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function isEnabled(widgets: ReturnType<typeof useDashStore.getState>['widgets'], id: string) {
  return widgets.find(w => w.id === id)?.enabled !== false
}

export function Dashboard() {
  const [showCustomize, setShowCustomize] = useState(false)
  const [showAddRace,   setShowAddRace]   = useState(false)
  const nextRace      = useRaceStore(selectNextRace)
  const storeWidgets  = useDashStore(s => s.widgets)
  const getDashLayout = useDashStore(s => s.getDashLayout)
  const widgets       = useMemo(() => getDashLayout(), [storeWidgets, getDashLayout])

  const openAddRace = () => setShowAddRace(true)
  const en = (id: string) => isEnabled(widgets, id)

  return (
    <div style={st.page}>
      {showCustomize && <DashCustomizeModal onClose={() => setShowCustomize(false)} />}
      {showAddRace   && <AddRaceModal       onClose={() => setShowAddRace(false)} />}

      <GreetingCard onCustomize={() => setShowCustomize(true)} />
      <PreRaceBriefing onAddRace={openAddRace} />

      {/* NOW — RACE DAY */}
      <DashZone id="now" tag="NOW" label="RACE DAY">
        {nextRace
          ? <>{en('countdown') && <CountdownCard race={nextRace} />}
              {en('race-forecast') && <WeatherCard race={nextRace} />}
              <CourseInfoCard race={nextRace} /></>
          : <WidgetShell label="No upcoming race — add one to start the countdown" />
        }
      </DashZone>

      {/* RECENTLY — YOUR SEASON */}
      <DashZone id="recently" tag="RECENTLY" label="YOUR SEASON">
        <StatsStrip />
        {en('recent-races') && <RecentRaces onAddRace={openAddRace} />}
        {en('personal-bests') && <WidgetShell label="Personal Bests" />}
      </DashZone>

      {/* CONSISTENCY — BUILD */}
      <DashZone id="trending" tag="CONSISTENCY" label="BUILD">
        {en('season-planner')  && <SeasonPlannerWidget onAddRace={openAddRace} />}
        {en('recovery-intel')  && <RecoveryIntelWidget />}
        {en('training-correl') && <TrainingCorrelWidget />}
      </DashZone>

      {/* PATTERNS — ANALYSIS */}
      <DashZone id="context" tag="PATTERNS" label="ANALYSIS">
        {en('boston-qual')     && <BostonQualWidget />}
        {en('pacing-iq')       && <PacingIQWidget />}
        {en('career-momentum') && <CareerMomentumWidget />}
        {en('age-grade')       && <AgeGradeWidget />}
        {en('race-dna')        && <RaceDNAWidget />}
        {en('pattern-scan')    && <PatternScanWidget />}
        {en('why-result')      && <WhyResultWidget />}
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

  greetingContent: { flex: 1, minWidth: 0 } as React.CSSProperties,

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
    width: '44px',
    height: '44px',
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: '50%',
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

  // ── Countdown card
  countdownCard: {
    background: 'radial-gradient(ellipse at 20% 80%, rgba(var(--orange-ch), 0.15) 0%, transparent 65%), var(--surface)',
    border: '1px solid var(--border)',
    borderTop: '1px solid rgba(var(--orange-ch), 0.35)',
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
    fontSize: '28px',
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
    fontSize: '56px',
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
    color: 'rgba(var(--orange-ch), 0.5)',
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

  // ── Section card
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

  // ── Widget shell (placeholder)
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

  // ── Glow card (analytics widgets)
  glowCard: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderTop: '1px solid rgba(var(--orange-ch), 0.3)',
    borderRadius: '14px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '14px',
    minWidth: 0,
  } as React.CSSProperties,

  widgetLabel: {
    fontFamily: 'var(--headline)',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.16em',
    textTransform: 'uppercase' as const,
    color: 'var(--orange)',
    marginBottom: '2px',
  } as React.CSSProperties,

  widgetTitle: {
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '20px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    color: 'var(--white)',
    lineHeight: 1.1,
  } as React.CSSProperties,

  badgePill: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '100px',
    padding: '4px 12px',
    fontFamily: 'var(--headline)',
    fontWeight: 800,
    fontSize: '11px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  iconBox: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '38px',
    height: '38px',
    background: 'rgba(var(--orange-ch), 0.1)',
    border: '1px solid rgba(var(--orange-ch), 0.2)',
    borderRadius: '10px',
    fontSize: '20px',
    flexShrink: 0,
  } as React.CSSProperties,

  lockedBox: {
    background: 'var(--surface3)',
    border: '1px dashed var(--border2)',
    borderRadius: '10px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  } as React.CSSProperties,

  lockedTitle: {
    fontFamily: 'var(--headline)',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: 'var(--white)',
  } as React.CSSProperties,

  lockedText: {
    fontSize: '13px',
    color: 'var(--muted)',
    lineHeight: 1.55,
  } as React.CSSProperties,

  widgetDivider: {
    height: '1px',
    background: 'var(--border)',
    margin: '0',
  } as React.CSSProperties,

  ghostOutlineBtn: {
    background: 'transparent',
    border: '1px solid var(--border2)',
    borderRadius: '8px',
    color: 'var(--white)',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    fontSize: '12px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    padding: '9px 16px',
    cursor: 'pointer',
    alignSelf: 'flex-start' as const,
  } as React.CSSProperties,

  ghostLink: {
    background: 'transparent',
    border: 'none',
    color: 'var(--orange)',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    fontSize: '12px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    padding: 0,
    display: 'inline',
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
    alignSelf: 'flex-start' as const,
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
    alignSelf: 'flex-start' as const,
  } as React.CSSProperties,

  // ── Customize modal
  modalOverlay: {
    position: 'fixed' as const,
    top: 'calc(var(--header-base-height) + var(--safe-top))',
    left: 0,
    right: 0,
    bottom: 'calc(var(--bottom-nav-base-height) + var(--safe-bottom))',
    background: 'rgba(0,0,0,0.75)',
    zIndex: 900,
    display: 'flex',
    alignItems: 'flex-end',
  } as React.CSSProperties,

  customizeSheet: {
    width: '100%',
    maxHeight: '100%',
    background: 'var(--surface2)',
    borderTop: '1px solid var(--border2)',
    borderRadius: '20px 20px 0 0',
    padding: '16px 20px 0',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0',
    position: 'relative' as const,
    overflowY: 'auto' as const,
  } as React.CSSProperties,

  arrowBtn: {
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: '5px',
    color: 'var(--muted)',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    fontSize: '10px',
    padding: '3px 6px',
    cursor: 'pointer',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,

  doneBtn: {
    width: '100%',
    background: 'var(--orange)',
    color: '#000',
    border: 'none',
    borderRadius: '12px',
    padding: '16px',
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '15px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
  } as React.CSSProperties,
} as const

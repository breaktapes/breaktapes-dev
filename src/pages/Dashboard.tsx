import { useMemo } from 'react'
import { useRaceStore } from '@/stores/useRaceStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { useDashStore } from '@/stores/useDashStore'
import { selectRaces, selectNextRace, selectAthlete, selectDashZoneCollapse } from '@/stores/selectors'
import { Skeleton } from '@/components/Skeleton'
import type { Race } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function daysUntil(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.max(0, Math.round((target.getTime() - now.getTime()) / 86400000))
}

function daysAgo(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.round((now.getTime() - target.getTime()) / 86400000)
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtShortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  })
}

function distLabel(d: string | undefined): string {
  if (!d) return ''
  const n = parseFloat(d)
  if (isNaN(n)) return d
  if (n >= 42 && n <= 42.3) return 'Marathon'
  if (n >= 21 && n <= 21.2) return 'Half Marathon'
  if (n === 10) return '10K'
  if (n === 5) return '5K'
  return `${n} km`
}

function uniqueCountries(races: Race[]): number {
  return new Set(races.map(r => r.country).filter(Boolean)).size
}

function totalKm(races: Race[]): number {
  return races.reduce((sum, r) => {
    const d = parseFloat(r.distance)
    return sum + (isNaN(d) ? 0 : d)
  }, 0)
}

function medalCount(races: Race[]): number {
  return races.filter(r => r.medal && r.medal !== 'finisher').length
}

function buildPBMap(races: Race[]): Record<string, Race> {
  const pb: Record<string, Race> = {}
  for (const r of races) {
    if (!r.time || !r.distance) continue
    const key = r.distance
    if (!pb[key] || r.time < pb[key].time!) {
      pb[key] = r
    }
  }
  return pb
}

// ─── AthleteBriefing Card ────────────────────────────────────────────────────

function AthleteBriefing() {
  const races = useRaceStore(selectRaces)
  const nextRace = useRaceStore(selectNextRace)
  const athlete = useAthleteStore(selectAthlete)
  const today = todayStr()

  // State 1: No races
  if (races.length === 0) {
    return (
      <div style={st.briefingCard}>
        <div style={st.briefingInner}>
          <div style={st.briefingTag}>YOUR STORY STARTS HERE</div>
          <div style={st.briefingTitle}>
            {athlete?.firstName ? `Welcome, ${athlete.firstName}!` : 'Welcome, Athlete!'}
          </div>
          <p style={st.briefingSubtext}>
            Every champion's journey begins with race one. Log it here.
          </p>
          <button style={st.ctaPrimary} onClick={() => console.log('open add race modal')}>
            + Log First Race
          </button>
        </div>
        <div style={st.briefingGlow} />
      </div>
    )
  }

  // State 2: Just finished (race within past 7 days)
  const recentlyFinished = races
    .filter(r => r.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .find(r => daysAgo(r.date) <= 7)

  if (recentlyFinished) {
    const ago = daysAgo(recentlyFinished.date)
    return (
      <div style={{ ...st.briefingCard, borderColor: 'rgba(var(--orange-ch), 0.4)' }}>
        <div style={st.briefingInner}>
          <div style={{ ...st.briefingTag, color: 'var(--orange)' }}>JUST RACED</div>
          <div style={st.briefingTitle}>{recentlyFinished.name}</div>
          <div style={st.briefingMeta}>
            {[recentlyFinished.city, recentlyFinished.country].filter(Boolean).join(', ')}
            {' · '}
            {ago === 0 ? 'Today' : ago === 1 ? 'Yesterday' : `${ago} days ago`}
          </div>
          <div style={st.pills}>
            {recentlyFinished.time && <span style={st.pill}>{recentlyFinished.time}</span>}
            {recentlyFinished.placing && <span style={st.pill}>{recentlyFinished.placing}</span>}
            {recentlyFinished.medal && (
              <span style={{ ...st.pill, background: 'rgba(255,215,0,0.15)', color: '#FFD770', border: '1px solid rgba(255,215,0,0.25)' }}>
                {recentlyFinished.medal.toUpperCase()}
              </span>
            )}
          </div>
          <button style={st.ctaOutline} onClick={() => console.log('open add race modal')}>
            + Add Next Race
          </button>
        </div>
        <div style={{ ...st.briefingGlow, background: 'var(--orange)', opacity: 0.08 }} />
      </div>
    )
  }

  // State 3: Upcoming race
  if (nextRace) {
    const days = daysUntil(nextRace.date)
    const lastRace = races
      .filter(r => r.date <= today)
      .sort((a, b) => b.date.localeCompare(a.date))[0]

    return (
      <div style={st.briefingCard}>
        <div style={st.briefingInner}>
          <div style={st.briefingTag}>NEXT RACE</div>
          <div style={st.briefingTitle}>{nextRace.name}</div>
          <div style={st.briefingMeta}>
            {[nextRace.city, nextRace.country].filter(Boolean).join(', ')} · {fmtDate(nextRace.date)}
          </div>
          <div style={st.pills}>
            <span style={{ ...st.pill, background: 'rgba(var(--orange-ch), 0.18)', color: 'var(--orange)', border: '1px solid rgba(var(--orange-ch), 0.3)', fontSize: '15px', fontWeight: 800 }}>
              {days === 0 ? 'TODAY!' : `${days} days away`}
            </span>
            {distLabel(nextRace.distance) && <span style={st.pill}>{distLabel(nextRace.distance)}</span>}
            {lastRace && (
              <span style={{ ...st.pill, background: 'rgba(0,255,136,0.1)', color: 'var(--green)', border: '1px solid rgba(0,255,136,0.2)' }}>
                Last: {(lastRace.name ?? '').split(' ')[0] || 'Race'}
              </span>
            )}
          </div>
        </div>
        <div style={st.briefingGlow} />
      </div>
    )
  }

  // State 4: No upcoming, has history
  const lastRace = races
    .filter(r => r.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))[0]

  return (
    <div style={st.briefingCard}>
      <div style={st.briefingInner}>
        <div style={st.briefingTag}>LAST RACE</div>
        <div style={st.briefingTitle}>{lastRace?.name ?? 'No recent race'}</div>
        {lastRace && (
          <div style={st.briefingMeta}>
            {[lastRace.city, lastRace.country].filter(Boolean).join(', ')} · {fmtDate(lastRace.date)}
          </div>
        )}
        <div style={st.pills}>
          {lastRace?.time && <span style={st.pill}>{lastRace.time}</span>}
        </div>
        <button style={st.ctaOutline} onClick={() => console.log('open add race modal')}>
          + Add Next Race
        </button>
      </div>
      <div style={st.briefingGlow} />
    </div>
  )
}

// ─── Stats Strip ─────────────────────────────────────────────────────────────

function StatsStrip() {
  const races = useRaceStore(selectRaces)

  const stats = useMemo(() => [
    { label: 'RACES', value: races.length.toString() },
    { label: 'COUNTRIES', value: uniqueCountries(races).toString() },
    { label: 'TOTAL KM', value: Math.round(totalKm(races)).toLocaleString() },
    { label: 'MEDALS', value: medalCount(races).toString() },
  ], [races])

  return (
    <div style={st.statsStrip}>
      {stats.map(s => (
        <div key={s.label} style={st.statCell}>
          <div style={st.statValue}>{s.value}</div>
          <div style={st.statLabel}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Recent Races Section ─────────────────────────────────────────────────────

function RecentRaces() {
  const races = useRaceStore(selectRaces)
  const today = todayStr()

  const pbMap = useMemo(() => buildPBMap(races), [races])

  const recent = useMemo(() =>
    races
      .filter(r => r.date <= today)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3),
    [races, today]
  )

  if (races.length === 0) {
    return (
      <div style={st.sectionCard}>
        <div style={st.sectionHeader}>RECENT RACES</div>
        <div style={st.emptyState}>
          <div style={st.emptyIcon}>🏁</div>
          <div style={st.emptyText}>No races yet. Log your first to get started.</div>
          <button style={st.ctaOutline} onClick={() => console.log('open add race modal')}>
            + Add Race
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={st.sectionCard}>
      <div style={st.sectionHeader}>RECENT RACES</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {recent.map((r, i) => {
          const isPB = !!r.time && pbMap[r.distance]?.id === r.id
          return (
            <div
              key={r.id}
              style={{
                ...st.raceRow,
                borderBottom: i < recent.length - 1 ? '1px solid var(--border)' : 'none',
                ...(isPB ? st.raceRowPB : {}),
              }}
            >
              <div style={st.raceDate}>{r.date ? fmtShortDate(r.date) : '—'}</div>
              <div style={st.raceCenter}>
                <div style={st.raceName}>{r.name}</div>
                <div style={st.raceMeta}>
                  {[r.city, r.country].filter(Boolean).join(', ')}
                  {distLabel(r.distance) ? ` · ${distLabel(r.distance)}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                {r.time && <div style={st.raceTime}>{r.time}</div>}
                {isPB && <div style={st.pbTag}>PB</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Dashboard Zone Accordion ─────────────────────────────────────────────────

interface ZoneProps {
  id: 'now' | 'recently' | 'trending' | 'context'
  label: string
  children: React.ReactNode
}

function DashZone({ id, label, children }: ZoneProps) {
  const zoneCollapse = useDashStore(selectDashZoneCollapse)
  const setZoneCollapse = useDashStore(s => s.setZoneCollapse)
  const isCollapsed = zoneCollapse[id] ?? false

  return (
    <div style={st.zone}>
      <button
        style={st.zoneBtn}
        onClick={() => setZoneCollapse(id, !isCollapsed)}
        aria-expanded={!isCollapsed}
      >
        <span style={st.zoneLabel}>{label}</span>
        <span style={{
          ...st.zoneChevron,
          transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
        }}>
          ▼
        </span>
      </button>
      {!isCollapsed && (
        <div style={st.zoneContent}>
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Widget placeholder (for zones not yet wired) ────────────────────────────

function WidgetShell({ label }: { label: string }) {
  return (
    <div style={st.widgetShell}>
      <div style={st.widgetShellLabel}>{label}</div>
      <Skeleton height={44} borderRadius={8} />
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function Dashboard() {
  return (
    <div style={st.page}>
      <AthleteBriefing />
      <StatsStrip />

      <DashZone id="now" label="NOW">
        <RecentRaces />
        <WidgetShell label="Race Day Forecast" />
      </DashZone>

      <DashZone id="recently" label="RECENTLY">
        <RecentRaces />
        <WidgetShell label="Personal Bests" />
      </DashZone>

      <DashZone id="trending" label="CONSISTENCY">
        <WidgetShell label="Training Streak" />
        <WidgetShell label="Pacing IQ" />
        <WidgetShell label="Career Momentum" />
      </DashZone>

      <DashZone id="context" label="PATTERNS">
        <WidgetShell label="Race DNA" />
        <WidgetShell label="Age Grade" />
        <WidgetShell label="On This Day" />
      </DashZone>
    </div>
  )
}

// ─── Style object ─────────────────────────────────────────────────────────────

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

  // ── Briefing
  briefingCard: {
    background: 'var(--surface2)',
    border: '1px solid var(--border2)',
    borderRadius: '16px',
    padding: '24px',
    position: 'relative',
    overflow: 'hidden',
    minWidth: 0,
  } as React.CSSProperties,

  briefingInner: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  } as React.CSSProperties,

  briefingGlow: {
    position: 'absolute',
    top: '-20px',
    right: '-20px',
    width: '140px',
    height: '140px',
    background: 'var(--surface3)',
    borderRadius: '50%',
    opacity: 0.6,
    pointerEvents: 'none',
  } as React.CSSProperties,

  briefingTag: {
    fontFamily: 'var(--headline)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.14em',
    color: 'var(--muted)',
    textTransform: 'uppercase',
  } as React.CSSProperties,

  briefingTitle: {
    fontFamily: 'var(--headline)',
    fontSize: '26px',
    fontWeight: 900,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    lineHeight: 1.1,
    color: 'var(--white)',
  } as React.CSSProperties,

  briefingSubtext: {
    fontSize: 'var(--text-sm)',
    color: 'var(--muted)',
    margin: 0,
    lineHeight: 1.5,
  } as React.CSSProperties,

  briefingMeta: {
    fontSize: 'var(--text-sm)',
    color: 'var(--muted)',
    lineHeight: 1.4,
  } as React.CSSProperties,

  pills: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '4px',
  } as React.CSSProperties,

  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: '100px',
    padding: '4px 10px',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--white)',
  } as React.CSSProperties,

  ctaPrimary: {
    marginTop: '8px',
    background: 'var(--orange)',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 18px',
    fontFamily: 'var(--headline)',
    fontWeight: 800,
    fontSize: '13px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    alignSelf: 'flex-start',
  } as React.CSSProperties,

  ctaOutline: {
    marginTop: '8px',
    background: 'transparent',
    color: 'var(--orange)',
    border: '1px solid rgba(var(--orange-ch), 0.5)',
    borderRadius: '8px',
    padding: '10px 18px',
    fontFamily: 'var(--headline)',
    fontWeight: 800,
    fontSize: '13px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    alignSelf: 'flex-start',
  } as React.CSSProperties,

  // ── Stats strip
  statsStrip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1rem',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '16px 12px',
    minWidth: 0,
  } as React.CSSProperties,

  statCell: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '3px',
    minWidth: 0,
  } as React.CSSProperties,

  statValue: {
    fontFamily: 'var(--headline)',
    fontSize: '22px',
    fontWeight: 900,
    lineHeight: 1,
    color: 'var(--white)',
    letterSpacing: '0.02em',
  } as React.CSSProperties,

  statLabel: {
    fontSize: '10px',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
  } as React.CSSProperties,

  // ── Section card
  sectionCard: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minWidth: 0,
  } as React.CSSProperties,

  sectionHeader: {
    fontFamily: 'var(--headline)',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
  } as React.CSSProperties,

  // ── Race row
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
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
    width: '52px',
    flexShrink: 0,
  } as React.CSSProperties,

  raceCenter: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  } as React.CSSProperties,

  raceName: {
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: 'var(--white)',
  } as React.CSSProperties,

  raceMeta: {
    fontSize: 'var(--text-xs)',
    color: 'var(--muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as React.CSSProperties,

  raceTime: {
    fontFamily: 'var(--headline)',
    fontSize: 'var(--text-sm)',
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: 'var(--white)',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  pbTag: {
    background: 'rgba(0, 255, 136, 0.15)',
    color: 'var(--green)',
    fontSize: '10px',
    fontFamily: 'var(--headline)',
    fontWeight: 800,
    letterSpacing: '0.06em',
    padding: '2px 6px',
    borderRadius: '4px',
    textTransform: 'uppercase',
  } as React.CSSProperties,

  // ── Empty state
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '28px 16px',
    textAlign: 'center',
  } as React.CSSProperties,

  emptyIcon: {
    fontSize: '32px',
    lineHeight: 1,
  } as React.CSSProperties,

  emptyText: {
    fontSize: 'var(--text-sm)',
    color: 'var(--muted)',
    maxWidth: '260px',
    lineHeight: 1.5,
  } as React.CSSProperties,

  // ── Zone accordion
  zone: {
    background: 'var(--surface)',
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
    color: 'var(--white)',
    fontFamily: 'var(--headline)',
    fontSize: '13px',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    textAlign: 'left',
  } as React.CSSProperties,

  zoneLabel: {
    letterSpacing: '0.12em',
  } as React.CSSProperties,

  zoneChevron: {
    fontSize: '9px',
    color: 'var(--muted)',
    transition: 'transform 0.2s ease',
    display: 'inline-block',
    flexShrink: 0,
  } as React.CSSProperties,

  zoneContent: {
    padding: '0 12px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    minWidth: 0,
  } as React.CSSProperties,

  // ── Widget shell (placeholder)
  widgetShell: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    minWidth: 0,
  } as React.CSSProperties,

  widgetShellLabel: {
    fontFamily: 'var(--headline)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
  } as React.CSSProperties,
} as const

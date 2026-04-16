import { useMemo } from 'react'
import { useRaceStore } from '@/stores/useRaceStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { selectRaces, selectNextRace, selectAthlete, selectAuthUser } from '@/stores/selectors'
import { Skeleton } from '@/components/Skeleton'
import type { Race } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.max(0, Math.round((target.getTime() - now.getTime()) / 86400000))
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
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

function ageGroup(dob: string | undefined, gender: string | undefined): string | null {
  const age = computeAge(dob)
  if (age === null) return null
  const g = gender === 'M' ? 'M' : gender === 'F' ? 'F' : ''
  const bracket = Math.floor(age / 5) * 5
  return `${g}${bracket > 0 ? bracket : '18'}`
}

function yearsActive(races: Race[]): number {
  if (races.length === 0) return 0
  const years = races.map(r => parseInt(r.date?.slice(0, 4) ?? '0'))
  return new Date().getFullYear() - Math.min(...years) + 1
}

function totalKm(races: Race[]): number {
  return races.reduce((sum, r) => {
    const d = parseFloat(r.distance)
    return sum + (isNaN(d) ? 0 : d)
  }, 0)
}

function uniqueCountries(races: Race[]): number {
  return new Set(races.map(r => r.country).filter(Boolean)).size
}

function athleteLevel(raceCount: number): string {
  if (raceCount >= 50) return 'ELITE'
  if (raceCount >= 20) return 'PRO'
  if (raceCount >= 10) return 'COMP'
  if (raceCount >= 5) return 'FIT'
  return 'NEW'
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

// Canonical distance ordering for PB grouping
const DIST_ORDER: string[] = ['5', '10', '21.1', '42.2', '1.5', '3', '15', '20', '25', '30', '50', '100']

function buildPBByDist(races: Race[]): Array<{ key: string; label: string; race: Race }> {
  const map: Record<string, Race> = {}
  for (const r of races) {
    if (!r.time || !r.distance) continue
    const key = r.distance
    if (!map[key] || r.time < map[key].time!) {
      map[key] = r
    }
  }
  const entries = Object.entries(map)
  // Sort: known distances first in order, then remaining alphabetically
  entries.sort(([a], [b]) => {
    const ai = DIST_ORDER.indexOf(a)
    const bi = DIST_ORDER.indexOf(b)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return parseFloat(a) - parseFloat(b)
  })
  return entries.map(([key, race]) => ({ key, label: distLabel(key), race }))
}

function medalColor(medal: string): { bg: string; color: string; border: string } {
  switch (medal) {
    case 'gold': return { bg: 'rgba(255,215,0,0.12)', color: '#FFD770', border: 'rgba(255,215,0,0.25)' }
    case 'silver': return { bg: 'rgba(200,212,220,0.1)', color: '#C8D4DC', border: 'rgba(200,212,220,0.2)' }
    case 'bronze': return { bg: 'rgba(205,140,90,0.12)', color: '#CD8C5A', border: 'rgba(205,140,90,0.2)' }
    default: return { bg: 'rgba(var(--orange-ch), 0.1)', color: 'var(--orange)', border: 'rgba(var(--orange-ch), 0.2)' }
  }
}

function medalEmoji(medal: string): string {
  switch (medal) {
    case 'gold': return '🥇'
    case 'silver': return '🥈'
    case 'bronze': return '🥉'
    default: return '🏅'
  }
}

// ─── Athlete Hero Card ────────────────────────────────────────────────────────

function AthleteHero() {
  const athlete = useAthleteStore(selectAthlete)
  const races = useRaceStore(selectRaces)
  const nextRace = useRaceStore(selectNextRace)

  const initials = useMemo(() => {
    const f = athlete?.firstName?.slice(0, 1) ?? ''
    const l = athlete?.lastName?.slice(0, 1) ?? ''
    return (f + l).toUpperCase() || '?'
  }, [athlete])

  const fullName = athlete
    ? [athlete.firstName, athlete.lastName].filter(Boolean).join(' ') || 'Athlete'
    : 'Athlete'

  const sportCity = [athlete?.mainSport, [athlete?.city, athlete?.country].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(' · ')

  const level = athleteLevel(races.length)
  const years = yearsActive(races)
  const km = Math.round(totalKm(races))
  const countries = uniqueCountries(races)

  const stats = [
    { label: 'Races', value: races.length.toString() },
    { label: 'Total KM', value: km.toLocaleString() },
    { label: 'Countries', value: countries.toString() },
    { label: 'Years', value: years.toString() },
  ]

  return (
    <div style={st.heroCard}>
      {/* Avatar */}
      <div style={st.avatarRow}>
        <div style={st.avatar}>
          <span style={st.avatarInitials}>{initials}</span>
        </div>
        <div style={st.avatarInfo}>
          <div style={st.athleteName}>{fullName}</div>
          {sportCity && <div style={st.athleteSub}>{sportCity}</div>}
          <div style={st.levelBadge}>{level}</div>
        </div>
      </div>

      {/* Stats row */}
      <div style={st.heroStats}>
        {stats.map(s => (
          <div key={s.label} style={st.heroStatCell}>
            <div style={st.heroStatValue}>{s.value}</div>
            <div style={st.heroStatLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Focus race card */}
      {nextRace && (() => {
        const days = daysUntil(nextRace.date)
        return (
          <div style={st.focusCard}>
            <div style={st.focusLabel}>FOCUS RACE</div>
            <div style={st.focusName}>{nextRace.name}</div>
            <div style={st.focusMeta}>
              {distLabel(nextRace.distance)} · {fmtDate(nextRace.date)}
            </div>
            <div style={st.focusDays}>
              {days === 0 ? 'TODAY' : `${days} days away`}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Personal Bests Section ───────────────────────────────────────────────────

function PersonalBests() {
  const races = useRaceStore(selectRaces)
  const pbs = useMemo(() => buildPBByDist(races), [races])

  if (races.length === 0 || pbs.length === 0) {
    return (
      <div style={st.section}>
        <div style={st.sectionHeader}>PERSONAL BESTS</div>
        <div style={st.emptyState}>
          <div style={st.emptyIcon}>⏱</div>
          <div style={st.emptyText}>No PBs yet. Log a timed race to start tracking.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={st.section}>
      <div style={st.sectionHeader}>PERSONAL BESTS</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', minWidth: 0 }}>
        {pbs.slice(0, 8).map(({ key, label, race }) => (
          <div key={key} style={st.pbCard}>
            <div style={st.pbDist}>{label}</div>
            <div style={st.pbTime}>{race.time}</div>
            <div style={st.pbRaceName} title={race.name}>{race.name}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Recent Medals Section ────────────────────────────────────────────────────

function RecentMedals() {
  const races = useRaceStore(selectRaces)

  const medals = useMemo(() =>
    races
      .filter(r => r.medal)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 4),
    [races]
  )

  if (medals.length === 0) {
    return (
      <div style={st.section}>
        <div style={st.sectionHeader}>MEDALS</div>
        <div style={st.emptyState}>
          <div style={st.emptyIcon}>🏅</div>
          <div style={st.emptyText}>No medals logged yet. Add a race with a medal to see it here.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={st.section}>
      <div style={st.sectionHeader}>MEDALS</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', minWidth: 0 }}>
        {medals.map(r => {
          const mc = medalColor(r.medal!)
          return (
            <div
              key={r.id}
              style={{
                ...st.medalCard,
                background: mc.bg,
                border: `1px solid ${mc.border}`,
              }}
            >
              <div style={{ fontSize: '28px', lineHeight: 1, marginBottom: '6px' }}>
                {medalEmoji(r.medal!)}
              </div>
              <div style={{ ...st.medalType, color: mc.color }}>{r.medal!.toUpperCase()}</div>
              <div style={st.medalRaceName} title={r.name}>{r.name}</div>
              <div style={st.medalDate}>{r.date ? fmtDate(r.date) : ''}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Bio / Details Section ────────────────────────────────────────────────────

function BioDetails() {
  const athlete = useAthleteStore(selectAthlete)

  const ag = ageGroup(athlete?.dob, athlete?.gender)
  const age = computeAge(athlete?.dob)

  const fields: Array<{ label: string; value: string | null | undefined }> = [
    { label: 'City', value: athlete?.city },
    { label: 'Country', value: athlete?.country },
    { label: 'Age', value: age !== null ? `${age}${ag ? ` · ${ag}` : ''}` : null },
    { label: 'Main Sport', value: athlete?.mainSport },
    { label: 'Club', value: athlete?.club },
  ]

  const visibleFields = fields.filter(f => f.value)

  return (
    <div style={st.section}>
      <div style={st.sectionHeaderRow}>
        <div style={st.sectionHeader}>DETAILS</div>
        <button
          style={st.editBtn}
          onClick={() => console.log('open edit modal')}
        >
          Edit
        </button>
      </div>

      {visibleFields.length === 0 ? (
        <div style={st.emptyState}>
          <div style={st.emptyText}>Add your details to complete your profile.</div>
          <button style={st.ctaOutline} onClick={() => console.log('open edit modal')}>
            Set Up Profile
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {visibleFields.map(f => (
            <div key={f.label} style={st.detailRow}>
              <div style={st.detailLabel}>{f.label}</div>
              <div style={st.detailValue}>{f.value}</div>
            </div>
          ))}
          {athlete?.bio && (
            <div style={st.bio}>{athlete.bio}</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Profile Page ─────────────────────────────────────────────────────────────

export function Profile() {
  const athlete = useAthleteStore(selectAthlete)
  const authUser = useAuthStore(selectAuthUser)

  // Loading state — auth resolved but athlete not yet loaded
  if (authUser && athlete === null) {
    return (
      <div style={st.page}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Skeleton height={200} borderRadius={16} />
          <Skeleton height={140} borderRadius={12} />
          <Skeleton height={120} borderRadius={12} />
        </div>
      </div>
    )
  }

  // Not authenticated
  if (!authUser) {
    return (
      <div style={st.page}>
        <div style={st.emptyState}>
          <div style={st.emptyIcon}>👤</div>
          <div style={st.emptyText}>Sign in to view your athlete profile.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={st.page}>
      <AthleteHero />
      <PersonalBests />
      <RecentMedals />
      <BioDetails />
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

  // ── Hero card
  heroCard: {
    background: 'var(--surface2)',
    border: '1px solid var(--border2)',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    minWidth: 0,
  } as React.CSSProperties,

  avatarRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    minWidth: 0,
  } as React.CSSProperties,

  avatar: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: 'var(--surface3)',
    border: '2px solid var(--orange)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as React.CSSProperties,

  avatarInitials: {
    fontFamily: 'var(--headline)',
    fontSize: '26px',
    fontWeight: 900,
    color: 'var(--orange)',
    letterSpacing: '0.04em',
  } as React.CSSProperties,

  avatarInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  } as React.CSSProperties,

  athleteName: {
    fontFamily: 'var(--headline)',
    fontSize: '22px',
    fontWeight: 900,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    lineHeight: 1.1,
    color: 'var(--white)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  athleteSub: {
    fontSize: 'var(--text-xs)',
    color: 'var(--muted)',
    textTransform: 'capitalize',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  levelBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'rgba(var(--orange-ch), 0.15)',
    border: '1px solid rgba(var(--orange-ch), 0.3)',
    color: 'var(--orange)',
    borderRadius: '100px',
    padding: '3px 10px',
    fontSize: '10px',
    fontFamily: 'var(--headline)',
    fontWeight: 800,
    letterSpacing: '0.1em',
    alignSelf: 'flex-start',
  } as React.CSSProperties,

  // ── Hero stats row
  heroStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
    minWidth: 0,
  } as React.CSSProperties,

  heroStatCell: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '3px',
    background: 'var(--surface3)',
    borderRadius: '10px',
    padding: '12px 8px',
    minWidth: 0,
  } as React.CSSProperties,

  heroStatValue: {
    fontFamily: 'var(--headline)',
    fontSize: '20px',
    fontWeight: 900,
    lineHeight: 1,
    color: 'var(--white)',
    letterSpacing: '0.02em',
  } as React.CSSProperties,

  heroStatLabel: {
    fontSize: '10px',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
    textAlign: 'center',
  } as React.CSSProperties,

  // ── Focus race card
  focusCard: {
    background: 'rgba(var(--orange-ch), 0.08)',
    border: '1px solid rgba(var(--orange-ch), 0.2)',
    borderRadius: '10px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  } as React.CSSProperties,

  focusLabel: {
    fontFamily: 'var(--headline)',
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.14em',
    color: 'var(--orange)',
    textTransform: 'uppercase',
  } as React.CSSProperties,

  focusName: {
    fontFamily: 'var(--headline)',
    fontSize: '16px',
    fontWeight: 900,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--white)',
    lineHeight: 1.1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  focusMeta: {
    fontSize: 'var(--text-xs)',
    color: 'var(--muted)',
  } as React.CSSProperties,

  focusDays: {
    fontFamily: 'var(--headline)',
    fontSize: '13px',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--orange)',
    marginTop: '4px',
  } as React.CSSProperties,

  // ── Section
  section: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
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

  sectionHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as React.CSSProperties,

  editBtn: {
    background: 'transparent',
    border: '1px solid var(--border2)',
    borderRadius: '6px',
    color: 'var(--muted)',
    padding: '4px 12px',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--body)',
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '0.02em',
  } as React.CSSProperties,

  // ── PB cards
  pbCard: {
    background: 'var(--surface3)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0,
  } as React.CSSProperties,

  pbDist: {
    fontFamily: 'var(--headline)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
  } as React.CSSProperties,

  pbTime: {
    fontFamily: 'var(--headline)',
    fontSize: '20px',
    fontWeight: 900,
    letterSpacing: '0.04em',
    color: 'var(--white)',
    lineHeight: 1.1,
  } as React.CSSProperties,

  pbRaceName: {
    fontSize: 'var(--text-xs)',
    color: 'var(--muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  // ── Medal cards
  medalCard: {
    borderRadius: '10px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  } as React.CSSProperties,

  medalType: {
    fontFamily: 'var(--headline)',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  } as React.CSSProperties,

  medalRaceName: {
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    color: 'var(--white)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginTop: '4px',
  } as React.CSSProperties,

  medalDate: {
    fontSize: 'var(--text-xs)',
    color: 'var(--muted)',
  } as React.CSSProperties,

  // ── Details
  detailRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '10px',
  } as React.CSSProperties,

  detailLabel: {
    fontFamily: 'var(--headline)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
    width: '80px',
    flexShrink: 0,
  } as React.CSSProperties,

  detailValue: {
    fontSize: 'var(--text-sm)',
    color: 'var(--white)',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  bio: {
    fontSize: 'var(--text-sm)',
    color: 'var(--muted)',
    lineHeight: 1.6,
    fontStyle: 'italic',
    padding: '10px 0 0',
  } as React.CSSProperties,

  // ── CTA
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
    textTransform: 'uppercase',
    cursor: 'pointer',
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
} as const

import { useMemo, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRaceStore } from '@/stores/useRaceStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { selectRaces, selectNextRace, selectAthlete, selectAuthUser } from '@/stores/selectors'
import { EditProfileModal } from '@/components/EditProfileModal'
import type { Race } from '@/types'
import { useUnits, distUnit } from '@/lib/units'
import { APP_URL } from '@/env'
import { supabase } from '@/lib/supabase'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((new Date(dateStr + 'T00:00:00').getTime() - now.getTime()) / 86400000))
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtMonthYear(year: number, month: number): string {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  return `${months[month]} ${year}`
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

function uniqueCountries(races: Race[]): string[] {
  return [...new Set(races.map(r => r.country).filter(Boolean))]
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

const DIST_ORDER: string[] = ['5', '10', '21.1', '42.2', '1.5', '3', '15', '20', '25', '30', '50', '100']

// ─── Age-Grade Standards (WA road-race tables) ────────────────────────────────

const AGE_GRADE_STANDARDS: Record<string, Record<string, Array<[number, number]>>> = {
  M: {
    '5K':           [[18,757],[35,780],[40,808],[45,852],[50,913],[55,1002],[60,1110],[65,1254],[70,1440]],
    '10K':          [[18,1571],[35,1620],[40,1680],[45,1770],[50,1890],[55,2070],[60,2295],[65,2580],[70,2970]],
    'Half Marathon':[[18,3561],[35,3660],[40,3810],[45,4020],[50,4290],[55,4680],[60,5190],[65,5820],[70,6720]],
    'Marathon':     [[18,7377],[35,7560],[40,7890],[45,8340],[50,8910],[55,9720],[60,10800],[65,12060],[70,13920]],
  },
  F: {
    '5K':           [[18,855],[35,885],[40,922],[45,975],[50,1050],[55,1155],[60,1290],[65,1470],[70,1710]],
    '10K':          [[18,1771],[35,1830],[40,1908],[45,2010],[50,2160],[55,2370],[60,2640],[65,3000],[70,3480]],
    'Half Marathon':[[18,3975],[35,4110],[40,4290],[45,4530],[50,4890],[55,5370],[60,6000],[65,6840],[70,7920]],
    'Marathon':     [[18,8231],[35,8520],[40,8910],[45,9420],[50,10140],[55,11100],[60,12420],[65,14100],[70,16320]],
  },
}

function getAgeGradeStandard(gender: string, distLabel: string, age: number): number | null {
  const table = (AGE_GRADE_STANDARDS[gender] ?? {})[distLabel]
  if (!table) return null
  let std: number | null = null
  for (const [ageFrom, secs] of table) {
    if (age >= ageFrom) std = secs
  }
  return std
}

function parseTimeToSecs(str: string | undefined): number | null {
  if (!str) return null
  const p = str.trim().split(':').map(Number)
  if (p.some(isNaN) || p.length === 0) return null
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2]
  if (p.length === 2) return p[0] * 60 + p[1]
  return null
}

interface AgeGradeResult { pct: number; distance: string; raceName: string; raceDate: string }

function computeAgeGradeForRace(
  race: Race,
  gender: string | undefined,
  age: number | null,
): number | null {
  if (!gender || !age) return null
  const dl = distLabel(race.distance)
  const std = getAgeGradeStandard(gender, dl, age)
  if (!std || !race.time) return null
  const secs = parseTimeToSecs(race.time)
  if (!secs) return null
  return Math.min(100, (std / secs) * 100)
}

interface SigDistEntry {
  distance: string
  race: Race
  score: number
  label: string
  metric: 'age-grade' | 'pace' | 'speed'
}

function computeSignatureDistances(
  races: Race[],
  gender: string | undefined,
  age: number | null,
): SigDistEntry[] {
  // build PBs by distance
  const pbMap: Record<string, Race> = {}
  for (const r of races) {
    if (!r.time || !r.distance) continue
    if (!pbMap[r.distance] || r.time < pbMap[r.distance].time!) pbMap[r.distance] = r
  }

  const entries: SigDistEntry[] = []
  for (const [, race] of Object.entries(pbMap)) {
    const ageGrade = computeAgeGradeForRace(race, gender, age)
    const secs = parseTimeToSecs(race.time)
    const distKm = parseFloat(race.distance) || 0
    const isRunning = ['run', 'ultra', 'hyrox'].includes(race.sport ?? 'run')
    const speedScore = secs && distKm ? distKm / (secs / 3600) : 0
    const paceSecsPerKm = isRunning && distKm > 0 && secs ? secs / distKm : 0
    const paceLabel = paceSecsPerKm > 0
      ? `${Math.floor(paceSecsPerKm / 60)}:${String(Math.round(paceSecsPerKm % 60)).padStart(2, '0')}/km`
      : `${speedScore.toFixed(1)} km/h`
    entries.push({
      distance: distLabel(race.distance),
      race,
      score: ageGrade ?? speedScore,
      label: ageGrade ? `${ageGrade.toFixed(1)}% age-grade` : paceLabel,
      metric: ageGrade ? 'age-grade' : isRunning ? 'pace' : 'speed',
    })
  }
  return entries.sort((a, b) => b.score - a.score).slice(0, 3)
}

function computeAgeGradeHistory(
  races: Race[],
  gender: string | undefined,
  age: number | null,
): AgeGradeResult[] {
  const COVERED = new Set(['5K', '10K', 'Half Marathon', 'Marathon'])
  return races
    .filter(r => r.time && r.date && COVERED.has(distLabel(r.distance)))
    .map(r => {
      const pct = computeAgeGradeForRace(r, gender, age)
      return pct ? { pct, distance: distLabel(r.distance), raceName: r.name ?? '', raceDate: r.date } : null
    })
    .filter((x): x is AgeGradeResult => x !== null)
    .sort((a, b) => a.raceDate.localeCompare(b.raceDate))
}

function buildPBByDist(races: Race[]): Array<{ key: string; label: string; race: Race }> {
  const map: Record<string, Race> = {}
  for (const r of races) {
    if (!r.time || !r.distance) continue
    const key = r.distance
    if (!map[key] || r.time < map[key].time!) map[key] = r
  }
  const entries = Object.entries(map)
  entries.sort(([a], [b]) => {
    const ai = DIST_ORDER.indexOf(a); const bi = DIST_ORDER.indexOf(b)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1; if (bi !== -1) return 1
    return parseFloat(a) - parseFloat(b)
  })
  return entries.map(([key, race]) => ({ key, label: distLabel(key), race }))
}

function parseHMS(str: string): number | null {
  const p = str.trim().split(':').map(Number)
  if (p.some(isNaN)) return null
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2]
  if (p.length === 2) return p[0] * 60 + p[1]
  return null
}

// ─── Achievement Definitions ──────────────────────────────────────────────────

interface Achievement {
  id: string
  icon: string
  name: string
  group: 'special' | 'milestone' | 'event'
  check: (races: Race[], athlete: ReturnType<typeof selectAthlete>) => boolean
}

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-finish',      icon: '🏁', name: 'FIRST FINISH',          group: 'milestone', check: r => r.length >= 1 },
  { id: 'half-starter',      icon: '🌓', name: 'HALF STARTER',          group: 'milestone', check: r => r.some(x => parseFloat(x.distance) >= 21) },
  { id: 'full-marathon',     icon: '🔥', name: 'MARATHON FINISHER',     group: 'milestone', check: r => r.some(x => parseFloat(x.distance) >= 42) },
  { id: 'photo-finish',      icon: '📷', name: 'PHOTO FINISH',          group: 'special',   check: r => r.some(x => x.medalPhoto) },
  { id: 'pb-streak',         icon: '⚡', name: 'PB STREAK',             group: 'special',   check: r => r.filter(x => x.time).length >= 3 },
  { id: '5-races',           icon: '5️⃣', name: 'FIVE FINISHER',        group: 'milestone', check: r => r.length >= 5 },
  { id: '10-races',          icon: '🔟', name: 'TEN DONE',              group: 'milestone', check: r => r.length >= 10 },
  { id: 'globe-trotter',     icon: '🌍', name: 'GLOBE TROTTER',         group: 'special',   check: r => new Set(r.map(x => x.country).filter(Boolean)).size >= 3 },
  { id: 'comrades',          icon: '🔥', name: 'COMRADES MARATHON FINISHER', group: 'event', check: r => r.some(x => (x.name ?? '').toLowerCase().includes('comrades')) },
  // Locked achievements
  { id: 'climb-crusher',     icon: '🏔', name: 'CLIMB CRUSHER',        group: 'special',   check: r => r.some(x => (x.elevation ?? 0) > 1000) },
  { id: 'heat-warrior',      icon: '🔥', name: 'HEAT WARRIOR',         group: 'special',   check: r => r.some(x => (x.weather?.temp ?? 0) > 30) },
  { id: 'night-runner',      icon: '🌙', name: 'NIGHT RUNNER',         group: 'special',   check: () => false },
  { id: 'neg-split',         icon: '⚡', name: 'NEGATIVE SPLIT MASTER', group: 'special',  check: () => false },
  { id: 'no-quit',           icon: '❤️', name: 'NO QUIT',              group: 'special',   check: r => r.some(x => x.outcome === 'Finished' && (x.elevation ?? 0) > 500) },
  { id: 'pain-cave',         icon: '💗', name: 'PAIN CAVE',            group: 'special',   check: () => false },
  { id: 'comeback-run',      icon: '🔄', name: 'COMEBACK RUN',         group: 'special',   check: () => false },
  { id: 'solo-warrior',      icon: '🪖', name: 'SOLO WARRIOR',         group: 'special',   check: () => false },
  { id: 'desert-runner',     icon: '🏜', name: 'DESERT RUNNER',        group: 'special',   check: () => false },
]

// World Marathon Majors
const MAJORS = [
  { id: 'tokyo',    name: 'TOKYO' },
  { id: 'boston',   name: 'BOSTON' },
  { id: 'london',   name: 'LONDON' },
  { id: 'berlin',   name: 'BERLIN' },
  { id: 'chicago',  name: 'CHICAGO' },
  { id: 'nyc',      name: 'NEW YORK CITY' },
  { id: 'sydney',   name: 'SYDNEY' },
]

function matchesMajor(race: Race, major: { id: string; name: string }): boolean {
  const nameLower = (race.name ?? '').toLowerCase()
  const cityLower = (race.city ?? '').toLowerCase()
  return nameLower.includes(major.id) || cityLower.includes(major.id) ||
    nameLower.includes(major.name.toLowerCase())
}

// Race Personality traits
function computePersonality(races: Race[]): Array<{ trait: string; score: number; desc: string }> {
  const past = races.filter(r => r.date <= new Date().toISOString().split('T')[0])
  const total = past.length

  // STARTER: low fade rate
  const withSplits = past.filter(r => (r.splits ?? []).length >= 2)
  let fadeCount = 0
  for (const r of withSplits) {
    const s = (r.splits ?? []).filter(x => x.split)
    if (s.length < 2) continue
    const first = parseHMS(s[0].split!) ?? 0
    const last  = parseHMS(s[s.length - 1].split!) ?? 0
    if (last > first * 1.02) fadeCount++
  }
  const fadeRate = withSplits.length > 0 ? fadeCount / withSplits.length : 0
  const starterScore = Math.round((1 - fadeRate) * 100)

  // DIESEL: proportion of long races
  const longRaces = past.filter(r => parseFloat(r.distance) >= 21).length
  const dieselScore = total > 0 ? Math.min(100, Math.round((longRaces / total) * 100 + (total >= 3 ? 35 : 0))) : 0

  // BIG-DAY PERFORMER: PBs + race count milestones
  const majorMatches = past.filter(r => MAJORS.some(m => matchesMajor(r, m))).length
  const pbCount = buildPBByDist(past).length
  const bigDayScore = Math.min(100, majorMatches * 20 + pbCount * 10)

  return [
    { trait: 'STARTER',           score: starterScore, desc: `${fadeRate === 0 ? '0' : Math.round(fadeRate * 100)}% fade rate suggests how often early effort stays under control.` },
    { trait: 'DIESEL',            score: dieselScore,  desc: `${longRaces} longer races and a consistency score of ${starterScore} point to durable endurance.` },
    { trait: 'BIG-DAY PERFORMER', score: bigDayScore,  desc: `${majorMatches} majors logged and ${pbCount} personal-best categories banked.` },
  ]
}

// ─── Athlete Hero Card ────────────────────────────────────────────────────────

function AthleteHero({ onEdit }: { onEdit: () => void }) {
  const athlete = useAthleteStore(selectAthlete)
  const races   = useRaceStore(selectRaces)
  const navigate = useNavigate()
  const units   = useUnits()
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
    .filter(Boolean).join(' · ')

  const level    = athleteLevel(races.length)
  const years    = yearsActive(races)
  const rawKm    = totalKm(races)
  const dist     = Math.round(units === 'imperial' ? rawKm * 0.621371 : rawKm)
  const ctrCount = uniqueCountries(races).length

  const stats = [
    { label: 'Races',                   value: races.length.toString() },
    { label: `Total ${distUnit(units)}`, value: dist.toLocaleString() },
    { label: 'Countries', value: ctrCount.toString() },
    { label: 'Years',    value: years.toString() },
  ]

  const ag = ageGroup(athlete?.dob, athlete?.gender)
  const age = computeAge(athlete?.dob)

  return (
    <div style={st.heroCard}>
      {/* Avatar row */}
      <div style={st.avatarRow}>
        <div style={st.avatar}>
          <span style={st.avatarInitials}>{initials}</span>
        </div>
        <div style={st.avatarInfo}>
          <div style={st.athleteName}>{fullName}</div>
          {sportCity && <div style={st.athleteSub}>{sportCity}</div>}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
            <span style={st.levelBadge}>{level}</span>
            {age !== null && <span style={st.levelBadge}>{age}yr{ag ? ` · ${ag}` : ''}</span>}
          </div>
        </div>
        <button style={st.editBtnSmall} onClick={onEdit}>Edit</button>
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

      {/* Focus race */}
      {nextRace && (() => {
        const days = daysUntil(nextRace.date)
        return (
          <div style={st.focusCard}>
            <div style={st.focusLabel}>FOCUS RACE</div>
            <div style={st.focusName}>{nextRace.name}</div>
            <div style={st.focusMeta}>{distLabel(nextRace.distance)} · {fmtDate(nextRace.date)}</div>
            <div style={st.focusDays}>{days === 0 ? 'TODAY' : `${days} days away`}</div>
          </div>
        )
      })()}

      {/* Share Profile button — visible when username set + is_public */}
      {athlete?.username && athlete?.isPublic && (
        <button
          style={{
            background: 'transparent',
            border: '1px solid var(--border2)',
            borderRadius: '6px',
            color: 'var(--muted)',
            padding: '8px 16px',
            fontFamily: 'var(--headline)',
            fontWeight: 700,
            fontSize: '12px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            alignSelf: 'flex-start',
          }}
          onClick={() => {
            const url = `${APP_URL}/u/${athlete.username}`
            navigator.clipboard.writeText(url).catch(() => {})
          }}
        >
          Share Profile ↗
        </button>
      )}
      {/* Compare button — always visible */}
      <button
        style={{
          background: 'transparent',
          border: '1px solid var(--border2)',
          borderRadius: '6px',
          color: 'var(--muted)',
          padding: '8px 16px',
          fontFamily: 'var(--headline)',
          fontWeight: 700,
          fontSize: '12px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          alignSelf: 'flex-start',
        }}
        onClick={() => {
          const params = athlete?.username && athlete?.isPublic
            ? `?a=${encodeURIComponent(athlete.username)}`
            : ''
          navigate(`/compare${params}`)
        }}
      >
        Compare ↔
      </button>
    </div>
  )
}

// ─── Community medals ─────────────────────────────────────────────────────────

const COMM_CACHE_TTL = 5 * 60 * 1000 // 5 min

/** Matches V1 getRaceKey: slug from race name + year */
function getRaceKey(race: Race): string {
  const year = (race.date || '').slice(0, 4)
  const slug = (race.name || '')
    .replace(/\s+\d{4}$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return year ? `${slug}-${year}` : slug
}

/** Returns map of raceKey → photo_url loaded from race_medal_photos table. */
function useCommunityMedals(raceKeys: string[]): Record<string, string> {
  const [photos, setPhotos] = useState<Record<string, string>>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('fl2_comm_medals') ?? 'null')
      if (raw && typeof raw === 'object' && Date.now() - (raw.ts ?? 0) < COMM_CACHE_TTL) {
        return raw.data ?? {}
      }
    } catch { /* ignore */ }
    return {}
  })
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!raceKeys.length || fetchedRef.current) return
    // Check cache freshness
    try {
      const raw = JSON.parse(localStorage.getItem('fl2_comm_medals') ?? 'null')
      if (raw && typeof raw === 'object' && Date.now() - (raw.ts ?? 0) < COMM_CACHE_TTL) return
    } catch { /* ignore */ }
    fetchedRef.current = true
    supabase
      .from('race_medal_photos')
      .select('race_key, variant, photo_url')
      .in('race_key', raceKeys)
      .then(({ data, error }) => {
        if (error || !data) return
        const map: Record<string, string> = {}
        data.forEach(row => {
          const k = row.variant ? `${row.race_key}::${row.variant}` : row.race_key
          map[k] = row.photo_url
        })
        setPhotos(map)
        localStorage.setItem('fl2_comm_medals', JSON.stringify({ ts: Date.now(), data: map }))
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceKeys.join(',')])

  return photos
}

// ─── Medal Wall ───────────────────────────────────────────────────────────────

const MEDAL_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  gold:     { bg: 'rgba(255,215,112,0.12)', border: 'rgba(255,215,112,0.35)', text: '#FFD770', label: 'GOLD' },
  silver:   { bg: 'rgba(200,212,220,0.12)', border: 'rgba(200,212,220,0.35)', text: '#C8D4DC', label: 'SILVER' },
  bronze:   { bg: 'rgba(205,140,90,0.12)',  border: 'rgba(205,140,90,0.35)',  text: '#CD8C5A', label: 'BRONZE' },
  finisher: { bg: 'rgba(var(--orange-ch),0.10)', border: 'rgba(var(--orange-ch),0.3)', text: 'var(--orange)', label: 'FINISHER' },
}

type MedalTier = 'gold' | 'silver' | 'bronze' | 'finisher'

function medalTier(medal: string): MedalTier {
  const m = medal.toLowerCase()
  if (m === 'gold')     return 'gold'
  if (m === 'silver')   return 'silver'
  if (m === 'bronze')   return 'bronze'
  return 'finisher'
}

function MedalWall() {
  const races  = useRaceStore(selectRaces)

  const medalRaces = useMemo(
    () => races.filter(r => r.medal && r.medal !== '').sort((a, b) => b.date.localeCompare(a.date)),
    [races],
  )

  // PB map so we can show shimmer on PB races
  const pbMap = useMemo(() => {
    const map: Record<string, string> = {} // distance → best time
    for (const r of races) {
      if (!r.time || !r.distance) continue
      if (!map[r.distance] || r.time < map[r.distance]) map[r.distance] = r.time
    }
    return map
  }, [races])

  // Community photos — keyed by raceKey (or raceKey::variant for Comrades)
  const raceKeys = useMemo(() => medalRaces.map(getRaceKey), [medalRaces])
  const communityPhotos = useCommunityMedals(raceKeys)

  const tierCounts = useMemo(() => {
    const counts: Record<MedalTier, number> = { gold: 0, silver: 0, bronze: 0, finisher: 0 }
    for (const r of medalRaces) {
      const tier = medalTier(r.medal!)
      counts[tier]++
    }
    return counts
  }, [medalRaces])

  return (
    <div style={st.section}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={st.sectionTitle}>MEDALS</div>
        <div style={{ height: '1px', flex: 1, background: 'var(--border)', marginLeft: '16px' }} />
      </div>

      {medalRaces.length === 0 ? (
        <div style={st.emptyState}>
          <div style={st.emptyIcon}>🥇</div>
          <div style={st.emptyText}>Your medal wall is empty. Log a race with a medal to start your collection.</div>
        </div>
      ) : (
        <>
          {/* Stats strip */}
          <div className="medal-row" style={{ marginBottom: '14px' }}>
            {(Object.keys(MEDAL_COLORS) as (keyof typeof MEDAL_COLORS)[]).map(tier => {
              const count = tierCounts[tier as keyof typeof tierCounts]
              if (count === 0) return null
              const col = MEDAL_COLORS[tier]
              return (
                <div key={tier} className={`medal-chip medal-${tier}`} style={{ padding: '6px 14px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 900, fontSize: '14px', lineHeight: 1 }}>{count}</span>
                  <span>{col.label}</span>
                </div>
              )
            })}
          </div>

          {/* Medal grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            {medalRaces.map(r => {
              const tier  = medalTier(r.medal!)
              const col   = MEDAL_COLORS[tier]
              const isPB  = r.time && r.distance && pbMap[r.distance] === r.time
              // Personal upload first; community photo as fallback
              const communityUrl = communityPhotos[getRaceKey(r)] ?? null
              const displayPhoto = r.medalPhoto || communityUrl
              const hasPhoto = !!displayPhoto

              return (
                <div
                  key={r.id}
                  style={{
                    background: hasPhoto ? 'transparent' : col.bg,
                    border: `1px solid ${isPB ? col.border : 'var(--border)'}`,
                    borderRadius: '12px',
                    overflow: 'hidden',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                    // PB shimmer via box-shadow glow
                    boxShadow: isPB ? `0 0 0 1px ${col.border}, 0 0 16px ${col.bg}` : undefined,
                  }}
                >
                  {/* Medal photo — personal upload or community fallback */}
                  {hasPhoto && (
                    <img
                      src={displayPhoto!}
                      alt={r.name}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35, mixBlendMode: 'multiply' }}
                    />
                  )}

                  <div style={{ padding: '14px', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                    {/* Tier badge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: col.text }}>
                        {col.label}
                      </span>
                      {isPB && (
                        <span style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: col.text, background: col.bg, border: `1px solid ${col.border}`, borderRadius: '100px', padding: '2px 7px' }}>
                          PB
                        </span>
                      )}
                    </div>

                    {/* Race name */}
                    <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '13px', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name}
                    </div>

                    {/* Meta */}
                    <div style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: 1.4 }}>
                      {[distLabel(r.distance), r.time].filter(Boolean).join(' · ')}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--muted)' }}>
                      {r.date ? new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}
                      {r.city ? ` · ${r.city}` : ''}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Achievements Section ─────────────────────────────────────────────────────

function AchievementsSection() {
  const races   = useRaceStore(selectRaces)
  const athlete = useAthleteStore(selectAthlete)

  const unlocked = useMemo(
    () => ACHIEVEMENTS.filter(a => a.check(races, athlete)),
    [races, athlete],
  )

  const unlockedIds = new Set(unlocked.map(a => a.id))
  const totalCount  = ACHIEVEMENTS.length

  // Recent unlocked pills (last 3)
  const recentPills = unlocked.slice(-3).reverse()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Hero achievement card */}
      <div style={st.achievementHero}>
        <div style={{ fontSize: '11px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(var(--green-ch), 0.6)', textTransform: 'uppercase', marginBottom: '8px' }}>
          YOUR ACHIEVEMENTS
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '10px' }}>
          <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '56px', color: 'var(--white)', lineHeight: 1, letterSpacing: '-0.02em' }}>
            {unlocked.length}
          </span>
          <span style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '20px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            OF {totalCount} UNLOCKED
          </span>
        </div>
        <div style={{ fontSize: '14px', color: 'rgba(245,245,245,0.55)', lineHeight: 1.55, marginBottom: '16px', maxWidth: '340px' }}>
          Track special race moments, milestone ladders, and major-event progress from one synced wall.
        </div>
        {recentPills.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {recentPills.map(a => (
              <div key={a.id} style={st.achievementPill}>
                <span style={{ fontSize: '16px' }}>{a.icon}</span>
                <span>{a.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Achievement icons grid */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0 10px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '14px' }}>🏆</span>
          <span style={{ fontFamily: 'var(--headline)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--muted)', textTransform: 'uppercase' }}>
            ACHIEVEMENT ICONS
          </span>
        </div>

        {/* Special achievements */}
        <div style={{ ...st.achievementGroup, marginTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '14px', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)' }}>
              SPECIAL ACHIEVEMENTS
            </span>
            <span style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700 }}>
              {unlocked.filter(a => a.group === 'special').length}/{ACHIEVEMENTS.filter(a => a.group === 'special').length}
            </span>
          </div>
          <div style={st.achievementGrid}>
            {ACHIEVEMENTS.filter(a => a.group === 'special').map(a => {
              const isUnlocked = unlockedIds.has(a.id)
              return (
                <div key={a.id} style={{ ...st.achievementTile, opacity: isUnlocked ? 1 : 0.7 }}>
                  <div style={{ ...st.achievementIconBox, background: isUnlocked ? 'rgba(var(--green-ch), 0.12)' : 'var(--surface)' }}>
                    <span style={{ fontSize: '24px' }}>{a.icon}</span>
                  </div>
                  <div style={st.achievementName}>{a.name}</div>
                  <div style={{ ...st.achievementStatus, background: isUnlocked ? 'rgba(var(--green-ch), 0.1)' : 'var(--surface)', color: isUnlocked ? 'var(--green)' : 'var(--muted)' }}>
                    {isUnlocked ? 'UNLOCKED' : 'LOCKED'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Milestone achievements */}
        <div style={{ ...st.achievementGroup, marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '14px', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)' }}>
              MILESTONES
            </span>
            <span style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700 }}>
              {unlocked.filter(a => a.group === 'milestone').length}/{ACHIEVEMENTS.filter(a => a.group === 'milestone').length}
            </span>
          </div>
          <div style={st.achievementGrid}>
            {ACHIEVEMENTS.filter(a => a.group === 'milestone' || a.group === 'event').map(a => {
              const isUnlocked = unlockedIds.has(a.id)
              return (
                <div key={a.id} style={{ ...st.achievementTile, opacity: isUnlocked ? 1 : 0.7 }}>
                  <div style={{ ...st.achievementIconBox, background: isUnlocked ? 'rgba(var(--orange-ch), 0.1)' : 'var(--surface)' }}>
                    <span style={{ fontSize: '24px' }}>{a.icon}</span>
                  </div>
                  <div style={st.achievementName}>{a.name}</div>
                  <div style={{ ...st.achievementStatus, background: isUnlocked ? 'rgba(var(--orange-ch), 0.08)' : 'var(--surface)', color: isUnlocked ? 'var(--orange)' : 'var(--muted)' }}>
                    {isUnlocked ? 'UNLOCKED' : 'LOCKED'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Countries Raced ──────────────────────────────────────────────────────────

function CountriesRaced() {
  const races    = useRaceStore(selectRaces)
  const countries = useMemo(() => uniqueCountries(races), [races])

  return (
    <div style={st.section}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
        <div style={st.sectionTitle}>COUNTRIES RACED</div>
        <div style={{ height: '1px', flex: 1, background: 'var(--border)', marginLeft: '16px' }} />
      </div>
      {countries.length === 0 ? (
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', padding: '8px 0' }}>
          Log a race to see your countries.
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
          {countries.map(c => (
            <div key={c} style={st.countryPill}>{(c ?? '').toUpperCase()}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Personal Bests ───────────────────────────────────────────────────────────

function PersonalBests() {
  const races = useRaceStore(selectRaces)
  const pbs = useMemo(() => buildPBByDist(races), [races])

  if (pbs.length === 0) {
    return (
      <div style={st.section}>
        <div style={st.sectionTitle}>PERSONAL BESTS</div>
        <div style={st.emptyState}>
          <div style={st.emptyIcon}>⏱</div>
          <div style={st.emptyText}>No PBs yet. Log a timed race to start tracking.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={st.section}>
      <div style={st.sectionTitle}>PERSONAL BESTS</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', minWidth: 0, marginTop: '4px' }}>
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

// ─── Signature Distances ──────────────────────────────────────────────────────

function SignatureDistances() {
  const races   = useRaceStore(selectRaces)
  const athlete = useAthleteStore(selectAthlete)

  const age    = useMemo(() => computeAge(athlete?.dob), [athlete?.dob])
  const gender = athlete?.gender

  const top = useMemo(
    () => computeSignatureDistances(races, gender, age),
    [races, gender, age],
  )

  if (top.length === 0) {
    return (
      <div style={st.section}>
        <div style={st.sectionTitle}>SIGNATURE DISTANCES</div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', padding: '8px 0', lineHeight: 1.6 }}>
          Log a few more timed races to see which distances are becoming your signature.
        </div>
      </div>
    )
  }

  const rankColors = ['var(--orange)', 'var(--white)', 'var(--muted)']

  return (
    <div style={st.section}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
        <div style={st.sectionTitle}>SIGNATURE DISTANCES</div>
        <div style={{ height: '1px', flex: 1, background: 'var(--border)' }} />
      </div>
      <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '12px', fontFamily: 'var(--headline)', fontWeight: 600, letterSpacing: '0.06em' }}>
        {gender && age ? 'RANKED BY AGE-GRADE WHEN AVAILABLE' : 'RANKED BY PACE / SPEED'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {top.map((item, i) => (
          <div
            key={item.distance}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'var(--surface2)',
              border: `1px solid ${i === 0 ? 'rgba(var(--orange-ch),0.3)' : 'var(--border)'}`,
              borderRadius: '10px',
              padding: '12px 14px',
            }}
          >
            <div style={{
              fontFamily: 'var(--headline)',
              fontWeight: 900,
              fontSize: '22px',
              color: rankColors[i],
              width: '20px',
              flexShrink: 0,
              textAlign: 'center',
              lineHeight: 1,
            }}>
              {i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '14px', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)', lineHeight: 1.1 }}>
                {item.distance}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.race.name ?? ''} · {item.race.time}
              </div>
            </div>
            <div style={{
              fontFamily: 'var(--headline)',
              fontWeight: 800,
              fontSize: '12px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: item.metric === 'age-grade' ? 'var(--orange)' : 'var(--white)',
              flexShrink: 0,
              textAlign: 'right',
            }}>
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Age-Grade Trajectory ─────────────────────────────────────────────────────

function AgeGradeTrajectory() {
  const athlete    = useAthleteStore(selectAthlete)
  const races      = useRaceStore(selectRaces)
  const hasProfile = !!(athlete?.dob && athlete?.gender)
  const age        = useMemo(() => computeAge(athlete?.dob), [athlete?.dob])

  const history = useMemo(
    () => hasProfile ? computeAgeGradeHistory(races, athlete?.gender, age) : [],
    [races, athlete?.gender, age, hasProfile],
  )

  if (!hasProfile) {
    return (
      <div style={st.section}>
        <div style={st.sectionTitle}>AGE-GRADE TRAJECTORY</div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', padding: '8px 0', lineHeight: 1.6 }}>
          Add your date of birth and gender in profile to unlock age-grade scoring.
        </div>
      </div>
    )
  }

  if (history.length < 2) {
    return (
      <div style={st.section}>
        <div style={st.sectionTitle}>AGE-GRADE TRAJECTORY</div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', padding: '8px 0', lineHeight: 1.6 }}>
          Log at least two 5K / 10K / Half / Marathon results to see your age-grade trend.
        </div>
      </div>
    )
  }

  // SVG sparkline
  const W = 300; const H = 56
  const pcts = history.map(h => h.pct)
  const minP = Math.min(...pcts); const maxP = Math.max(...pcts)
  const range = maxP - minP || 1
  const pts = history.map((h, i) => {
    const x = (i / (history.length - 1)) * W
    const y = H - ((h.pct - minP) / range) * (H - 8) - 4
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const latestPct = pcts[pcts.length - 1]

  return (
    <div style={st.section}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
        <div style={st.sectionTitle}>AGE-GRADE</div>
        <div style={{ height: '1px', flex: 1, background: 'var(--border)' }} />
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '22px', color: 'var(--orange)', letterSpacing: '0.02em' }}>
          {latestPct.toFixed(1)}%
        </div>
      </div>
      <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 600, letterSpacing: '0.08em', marginBottom: '12px' }}>
        WA ROAD-RACE STANDARD · {history.length} RESULTS
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: `${H}px`, display: 'block', marginBottom: '14px' }}>
        <polyline
          points={pts}
          fill="none"
          stroke="var(--orange)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {history.map((h, i) => {
          const x = (i / (history.length - 1)) * W
          const y = H - ((h.pct - minP) / range) * (H - 8) - 4
          return (
            <circle key={i} cx={x} cy={y} r="3" fill="var(--orange)" />
          )
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {history.slice(-5).reverse().map((h, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
            <div style={{ color: 'var(--muted)', width: '80px', flexShrink: 0, fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h.raceDate.slice(0, 7)}</div>
            <div style={{ color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.distance} · {h.raceName}</div>
            <div style={{ color: 'var(--orange)', fontFamily: 'var(--headline)', fontWeight: 800, fontSize: '12px', flexShrink: 0 }}>{h.pct.toFixed(1)}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Performance Timeline ────────────────────────────────────────────────────

interface TimelineYear {
  year: string
  raceCount: number
  avgSpeedKmh: number
  avgDistKm: number
  metrics: { speed: number; endurance: number; frequency: number }
  labels:  { speed: string; endurance: string; frequency: string }
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v))
}

function computeTimeline(races: Race[]): TimelineYear[] {
  const byYear: Record<string, Race[]> = {}
  for (const r of races) {
    if (!r.date) continue
    const y = r.date.slice(0, 4)
    if (!byYear[y]) byYear[y] = []
    byYear[y].push(r)
  }
  return Object.entries(byYear)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-5)
    .map(([year, yr]) => {
      const timed = yr.filter(r => r.time && r.distance)
      const speeds = timed.map(r => {
        const secs = parseTimeToSecs(r.time)
        const km   = parseFloat(r.distance) || 0
        return secs && km ? km / (secs / 3600) : null
      }).filter((v): v is number => v !== null && isFinite(v))

      const avgSpeed = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0
      const avgDist  = yr.reduce((sum, r) => sum + (parseFloat(r.distance) || 0), 0) / yr.length

      return {
        year,
        raceCount: yr.length,
        avgSpeedKmh: avgSpeed,
        avgDistKm: avgDist,
        metrics: {
          speed:     clamp((avgSpeed / 18) * 100),
          endurance: clamp((avgDist  / 50) * 100),
          frequency: clamp((yr.length / 10) * 100),
        },
        labels: {
          speed:     avgSpeed > 0 ? `${Math.round(avgSpeed)} km/h` : '—',
          endurance: avgDist  > 0 ? `${Math.round(avgDist)} km avg` : '—',
          frequency: `${yr.length} race${yr.length !== 1 ? 's' : ''}`,
        },
      }
    })
}

const TIMELINE_METRICS: Array<{ key: keyof TimelineYear['metrics']; label: string }> = [
  { key: 'speed',     label: 'Speed' },
  { key: 'endurance', label: 'Distance' },
  { key: 'frequency', label: 'Races' },
]

function PerformanceTimeline() {
  const races = useRaceStore(selectRaces)
  const timeline = useMemo(() => computeTimeline(races), [races])

  if (timeline.length < 2) {
    return (
      <div style={st.section}>
        <div style={st.sectionTitle}>PERFORMANCE TIMELINE</div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', padding: '8px 0', lineHeight: 1.6 }}>
          Log races across two or more seasons to unlock your season-by-season story.
        </div>
      </div>
    )
  }

  return (
    <div style={st.section}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <div style={st.sectionTitle}>PERFORMANCE TIMELINE</div>
        <div style={{ height: '1px', flex: 1, background: 'var(--border)' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {timeline.map(row => (
          <div key={row.year} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '16px', letterSpacing: '0.04em', color: 'var(--orange)' }}>
              {row.year}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {TIMELINE_METRICS.map(({ key, label }) => (
                <div key={key} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 70px', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>{label}</div>
                  <div style={{ height: '5px', background: 'var(--surface3)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${row.metrics[key]}%`, background: 'var(--orange)', borderRadius: '3px', transition: 'width 0.4s ease' }} />
                  </div>
                  <div style={{ fontSize: '11px', fontFamily: 'var(--headline)', fontWeight: 700, color: 'var(--white)', textAlign: 'right' }}>{row.labels[key]}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Race Activity Heatmap ────────────────────────────────────────────────────

function RaceActivityHeatmap() {
  const races = useRaceStore(selectRaces)
  const [selectedCell, setSelectedCell] = useState<{ year: number; month: number } | null>(null)

  const currentYear = new Date().getFullYear()
  const years = [currentYear, currentYear - 1]
  const months = [0,1,2,3,4,5,6,7,8,9,10,11]
  const MONTH_LABELS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

  // Build race map keyed by YYYY-MM
  const raceMap = useMemo(() => {
    const m: Record<string, Race[]> = {}
    for (const r of races) {
      if (!r.date) continue
      const key = r.date.slice(0, 7) // "YYYY-MM"
      if (!m[key]) m[key] = []
      m[key].push(r)
    }
    return m
  }, [races])

  const selectedKey = selectedCell ? `${selectedCell.year}-${String(selectedCell.month + 1).padStart(2, '0')}` : null
  const selectedRaces = selectedKey ? (raceMap[selectedKey] ?? []) : []

  return (
    <div style={st.section}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '18px', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)' }}>
          RACE ACTIVITY
        </div>
        <div style={{ height: '1px', flex: 1, background: 'var(--border)', marginLeft: '16px' }} />
      </div>

      <div style={{ background: 'var(--surface3)', borderRadius: '12px', padding: '14px', marginTop: '10px', overflowX: 'auto' }}>
        {/* Month headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '42px repeat(12, 1fr)', gap: '4px', marginBottom: '6px', minWidth: '480px' }}>
          <div />
          {MONTH_LABELS.map(m => (
            <div key={m} style={{ fontFamily: 'var(--headline)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--muted)', textAlign: 'center', textTransform: 'uppercase' }}>
              {m}
            </div>
          ))}
        </div>

        {/* Year rows */}
        {years.map(year => (
          <div key={year} style={{ display: 'grid', gridTemplateColumns: '42px repeat(12, 1fr)', gap: '4px', marginBottom: '4px', minWidth: '480px' }}>
            <div style={{ fontFamily: 'var(--headline)', fontSize: '10px', fontWeight: 700, color: 'var(--muted)', display: 'flex', alignItems: 'center' }}>
              {year}
            </div>
            {months.map(month => {
              const key = `${year}-${String(month + 1).padStart(2, '0')}`
              const count = raceMap[key]?.length ?? 0
              const isSelected = selectedCell?.year === year && selectedCell?.month === month
              const isFuture = new Date(year, month) > new Date()
              return (
                <div
                  key={month}
                  onClick={() => !isFuture && count > 0 && setSelectedCell(isSelected ? null : { year, month })}
                  style={{
                    height: '32px',
                    borderRadius: '6px',
                    background: isSelected
                      ? 'var(--green)'
                      : count > 0
                        ? 'rgba(var(--green-ch), 0.5)'
                        : isFuture ? 'rgba(245,245,245,0.03)' : 'var(--surface2)',
                    border: isSelected ? '1px solid var(--green)' : '1px solid transparent',
                    cursor: count > 0 && !isFuture ? 'pointer' : 'default',
                    transition: 'background 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {count > 1 && (
                    <span style={{ fontSize: '9px', fontFamily: 'var(--headline)', fontWeight: 800, color: isSelected ? '#000' : 'rgba(var(--green-ch), 0.9)' }}>
                      {count}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {/* Selected month details */}
        {selectedCell && selectedRaces.length > 0 && (
          <div style={{ marginTop: '12px', background: 'var(--surface2)', borderRadius: '10px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '18px', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)' }}>
                {fmtMonthYear(selectedCell.year, selectedCell.month)}
              </div>
              <div style={{ fontFamily: 'var(--headline)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase' }}>
                {selectedRaces.length} RACE{selectedRaces.length !== 1 ? 'S' : ''}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedRaces.sort((a, b) => a.date.localeCompare(b.date)).map(r => (
                <div key={r.id} style={{ background: 'var(--surface3)', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '14px', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)', lineHeight: 1.2 }}>
                        {r.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>
                        {[distLabel(r.distance), r.city, r.country].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', flexShrink: 0 }}>
                      {fmtDate(r.date)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Majors & Qualifiers ──────────────────────────────────────────────────────

function MajorsQualifiers() {
  const races = useRaceStore(selectRaces)
  const today = new Date().toISOString().split('T')[0]

  const majorStatus = useMemo(() => {
    return MAJORS.map(major => {
      const allMatches = races.filter(r => matchesMajor(r, major))
      const completed = allMatches.filter(r => r.date <= today)
      const upcoming  = allMatches.filter(r => r.date > today)
      const status = completed.length > 0 ? 'completed' : upcoming.length > 0 ? 'in-progress' : 'not-tracked'
      return { ...major, status, completed, upcoming }
    })
  }, [races, today])

  const completedCount  = majorStatus.filter(m => m.status === 'completed').length
  const inProgressCount = majorStatus.filter(m => m.status === 'in-progress').length

  return (
    <div style={st.section}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '18px', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)' }}>
          MAJORS & QUALIFIERS
        </div>
        <div style={{ height: '1px', flex: 1, background: 'var(--border)', marginLeft: '16px' }} />
      </div>

      {/* BQ / Championship tracker card */}
      <div style={{ ...st.subsection, marginTop: '12px' }}>
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
            BQ / CHAMPIONSHIP TRACKER
          </div>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '18px', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)', lineHeight: 1.1 }}>
            WORLD MARATHON MAJORS BOARD
          </div>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '10px', lineHeight: 1.6, maxWidth: '360px', margin: '10px auto 0' }}>
            Every major lives here. Completed races surface your result and details, while upcoming majors stay highlighted in progress with a live countdown. Qualification is tracked where useful, but it is not treated as the only way in. Ballot, charity, tour, and qualifier paths all count.
          </div>
        </div>

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '14px' }}>
          {[
            { label: 'COMPLETED',   value: `${completedCount}/${MAJORS.length}` },
            { label: 'IN PROGRESS', value: inProgressCount.toString() },
            { label: 'ENTRY READY', value: '0' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface3)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: '9px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase' }}>
                {s.label}
              </div>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '20px', color: 'var(--white)', lineHeight: 1 }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Individual majors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {majorStatus.map(m => (
            <div key={m.id} style={{
              background: 'var(--surface)',
              border: `1px solid ${m.status === 'completed' ? 'rgba(var(--green-ch), 0.3)' : m.status === 'in-progress' ? 'rgba(var(--orange-ch), 0.3)' : 'var(--border)'}`,
              borderRadius: '10px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: '52px',
              gap: '12px',
            }}>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '16px', letterSpacing: '0.06em', textTransform: 'uppercase', color: m.status === 'completed' ? 'var(--white)' : m.status === 'in-progress' ? 'var(--orange)' : 'var(--muted)' }}>
                {m.name}
              </div>
              <div style={{
                fontFamily: 'var(--headline)',
                fontWeight: 700,
                fontSize: '11px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '5px 12px',
                borderRadius: '100px',
                border: `1px solid ${m.status === 'completed' ? 'rgba(var(--green-ch), 0.3)' : m.status === 'in-progress' ? 'rgba(var(--orange-ch), 0.3)' : 'var(--border2)'}`,
                color: m.status === 'completed' ? 'var(--green)' : m.status === 'in-progress' ? 'var(--orange)' : 'var(--muted)',
                background: 'transparent',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}>
                {m.status === 'completed' ? 'COMPLETED' : m.status === 'in-progress' ? 'IN PROGRESS' : 'NOT TRACKED'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Race Personality ─────────────────────────────────────────────────────────

function RacePersonality() {
  const races = useRaceStore(selectRaces)
  const traits = useMemo(() => computePersonality(races), [races])

  return (
    <div style={st.section}>
      {/* Outer card with orange top glow */}
      <div style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderTop: '1px solid rgba(var(--orange-ch), 0.4)', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ textAlign: 'center', marginBottom: '4px' }}>
          <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.16em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
            RACE PERSONALITY
          </div>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '20px', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)', lineHeight: 1.1 }}>
            WHAT KIND OF RACER ARE YOU?
          </div>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '8px', lineHeight: 1.5 }}>
            A fun but useful read on the traits that keep showing up in your results.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {traits.map(t => (
            <div key={t.trait} style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '16px', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)' }}>
                  {t.trait}
                </div>
                <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '20px', color: 'var(--orange)', letterSpacing: '0.02em' }}>
                  {t.score}
                </div>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>{t.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Bio / Details Section ────────────────────────────────────────────────────

function BioDetails({ onEdit }: { onEdit: () => void }) {
  const athlete = useAthleteStore(selectAthlete)
  const ag  = ageGroup(athlete?.dob, athlete?.gender)
  const age = computeAge(athlete?.dob)

  const fields: Array<{ label: string; value: string | null | undefined }> = [
    { label: 'City',       value: athlete?.city },
    { label: 'Country',    value: athlete?.country },
    { label: 'Age',        value: age !== null ? `${age}${ag ? ` · ${ag}` : ''}` : null },
    { label: 'Main Sport', value: athlete?.mainSport },
    { label: 'Club',       value: athlete?.club },
  ]
  const visibleFields = fields.filter(f => f.value)

  return (
    <div style={st.section}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={st.sectionTitle}>DETAILS</div>
        <button style={st.editBtnSmall} onClick={onEdit}>Edit</button>
      </div>

      {visibleFields.length === 0 ? (
        <div style={st.emptyState}>
          <div style={st.emptyText}>Add your details to complete your profile.</div>
          <button style={st.ctaOutline} onClick={onEdit}>Set Up Profile</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
          {visibleFields.map(f => (
            <div key={f.label} style={st.detailRow}>
              <div style={st.detailLabel}>{f.label}</div>
              <div style={st.detailValue}>{f.value}</div>
            </div>
          ))}
          {athlete?.bio && <div style={st.bio}>{athlete.bio}</div>}
        </div>
      )}
    </div>
  )
}

// ─── Goals Section ────────────────────────────────────────────────────────────

function secsToHMS(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${m}:${String(s).padStart(2,'0')}`
}

function GoalsSection() {
  const races = useRaceStore(selectRaces)
  const goals = useAthleteStore(s => s.goals)
  const setAnnualGoal = useAthleteStore(s => s.setAnnualGoal)
  const addDistGoal = useAthleteStore(s => s.addDistGoal)
  const deleteDistGoal = useAthleteStore(s => s.deleteDistGoal)

  const year = new Date().getFullYear()
  const ag = goals.annual[String(year)] ?? {}

  const yrRaces = races.filter(r => (r.date ?? '').startsWith(String(year)))
  const yrCount = yrRaces.length
  const yrKm = yrRaces.reduce((sum, r) => {
    // resolve distance to km
    const KM_MAP: Record<string, number> = {
      '5KM': 5, '10KM': 10, '10 Mile': 16.1, 'Half Marathon': 21.1, 'Marathon': 42.2,
      '50KM': 50, '50 Mile': 80.5, '100KM': 100, '100 Mile': 161,
    }
    return sum + (KM_MAP[r.distance] ?? parseFloat(r.distance) ?? 0)
  }, 0)

  // Per-distance PBs for dist goals
  const pbByDist: Record<string, number> = {}
  for (const r of races) {
    if (!r.time || !r.distance) continue
    const secs = r.time.split(':').reduce((s, v, i, a) => s + Number(v) * Math.pow(60, a.length - 1 - i), 0)
    if (!pbByDist[r.distance] || secs < pbByDist[r.distance]) pbByDist[r.distance] = secs
  }

  // Add-goal form state
  const [addMode, setAddMode] = useState<'km' | 'races' | 'dist' | null>(null)
  const [annualVal, setAnnualVal] = useState('')
  const [distTarget, setDistTarget] = useState({ dist: '', h: '', m: '', s: '', deadline: '' })

  const distOptions = [...new Set(races.map(r => r.distance).filter(Boolean))].sort()

  function saveAnnual() {
    const v = parseInt(annualVal)
    if (!v || !addMode || (addMode !== 'km' && addMode !== 'races')) return
    setAnnualGoal(year, { [addMode]: v })
    setAnnualVal('')
    setAddMode(null)
  }

  function saveDist() {
    const h = parseInt(distTarget.h) || 0
    const m = parseInt(distTarget.m) || 0
    const s = parseInt(distTarget.s) || 0
    const secs = h * 3600 + m * 60 + s
    if (!distTarget.dist || secs <= 0) return
    addDistGoal({ dist: distTarget.dist, targetSecs: secs, deadline: distTarget.deadline || undefined })
    setDistTarget({ dist: '', h: '', m: '', s: '', deadline: '' })
    setAddMode(null)
  }

  const inputSt: React.CSSProperties = {
    background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: '6px',
    color: 'var(--white)', fontSize: '14px', padding: '0.5rem 0.75rem', fontFamily: 'var(--body)',
  }
  const smallBtn: React.CSSProperties = {
    background: 'var(--orange)', color: 'var(--black)', border: 'none', borderRadius: '4px',
    padding: '0.45rem 0.9rem', fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '11px',
    letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
  }

  return (
    <div style={st.section}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={st.sectionTitle}>GOALS</div>
        <div style={{ height: '1px', flex: 1, background: 'var(--border)', marginLeft: '16px' }} />
      </div>

      {/* Annual cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
        {(['km', 'races'] as const).map(type => {
          const target = type === 'km' ? (ag.km ?? 0) : (ag.races ?? 0)
          const current = type === 'km' ? Math.round(yrKm) : yrCount
          const pct = target ? Math.min(100, Math.round(current / target * 100)) : 0
          const achieved = target > 0 && current >= target
          return (
            <div key={type} style={{ background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: '10px', padding: '12px', position: 'relative' }}>
              <button
                onClick={() => { setAddMode(type); setAnnualVal(target ? String(target) : '') }}
                style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}
              >Edit</button>
              <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
                {year} · {type === 'km' ? 'KM' : 'RACES'}
              </div>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '22px', color: 'var(--white)', lineHeight: 1 }}>
                {current}
                <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 400 }}> / {target || '—'}{type === 'km' ? ' km' : ''}</span>
              </div>
              {target > 0 ? (
                <>
                  <div style={{ height: '4px', background: 'var(--surface)', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: achieved ? 'var(--green)' : 'var(--orange)', borderRadius: '2px', transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ fontSize: '10px', color: achieved ? 'var(--green)' : 'var(--muted)', marginTop: '4px', fontFamily: 'var(--headline)', fontWeight: 700 }}>
                    {pct}%{achieved ? ' · Achieved!' : ''}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '6px', fontFamily: 'var(--headline)' }}>Tap Edit to set target</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Distance time goals */}
      {goals.distGoals.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
          {goals.distGoals.map(g => {
            const pb = pbByDist[g.dist]
            const done = pb !== undefined && pb <= g.targetSecs
            return (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: '8px', padding: '10px 12px', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>🎯</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: 'var(--white)', fontWeight: 600, lineHeight: 1.2 }}>{g.dist}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                    Sub {secsToHMS(g.targetSecs)}{g.deadline ? ` · ${fmtDate(g.deadline)}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '13px', color: done ? 'var(--green)' : 'var(--orange)' }}>
                    {done ? '✓ Done' : pb !== undefined ? secsToHMS(pb) : '—'}
                  </div>
                  <button onClick={() => deleteDistGoal(g.id)} style={{ background: 'none', border: 'none', color: 'var(--muted2)', cursor: 'pointer', fontSize: '10px', marginTop: '2px' }}>✕ Remove</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add goal button */}
      {!addMode && (
        <button onClick={() => setAddMode('dist')} style={{ ...st.ctaOutline, width: '100%', marginTop: '4px' }}>
          + Add Distance Goal
        </button>
      )}

      {/* Add-goal inline form */}
      {addMode === 'km' && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
          <input type="number" placeholder={`${year} KM target`} value={annualVal} onChange={e => setAnnualVal(e.target.value)} style={{ ...inputSt, flex: 1 }} />
          <button onClick={saveAnnual} style={smallBtn}>Save</button>
          <button onClick={() => setAddMode(null)} style={{ ...smallBtn, background: 'var(--surface3)', color: 'var(--muted)' }}>✕</button>
        </div>
      )}
      {addMode === 'races' && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
          <input type="number" placeholder={`${year} race count target`} value={annualVal} onChange={e => setAnnualVal(e.target.value)} style={{ ...inputSt, flex: 1 }} />
          <button onClick={saveAnnual} style={smallBtn}>Save</button>
          <button onClick={() => setAddMode(null)} style={{ ...smallBtn, background: 'var(--surface3)', color: 'var(--muted)' }}>✕</button>
        </div>
      )}
      {addMode === 'dist' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: '8px', padding: '12px' }}>
          <select value={distTarget.dist} onChange={e => setDistTarget(d => ({ ...d, dist: e.target.value }))} style={{ ...inputSt, width: '100%' }}>
            <option value="">Select distance…</option>
            {distOptions.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700 }}>TARGET</span>
            <input type="number" placeholder="H" min={0} value={distTarget.h} onChange={e => setDistTarget(d => ({ ...d, h: e.target.value }))} style={{ ...inputSt, width: '50px' }} />
            <input type="number" placeholder="M" min={0} max={59} value={distTarget.m} onChange={e => setDistTarget(d => ({ ...d, m: e.target.value }))} style={{ ...inputSt, width: '50px' }} />
            <input type="number" placeholder="S" min={0} max={59} value={distTarget.s} onChange={e => setDistTarget(d => ({ ...d, s: e.target.value }))} style={{ ...inputSt, width: '50px' }} />
          </div>
          <input type="date" placeholder="Deadline (optional)" value={distTarget.deadline} onChange={e => setDistTarget(d => ({ ...d, deadline: e.target.value }))} style={{ ...inputSt, width: '100%' }} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={saveDist} style={{ ...smallBtn, flex: 1 }}>Add Goal</button>
            <button onClick={() => setAddMode(null)} style={{ ...smallBtn, background: 'var(--surface3)', color: 'var(--muted)', flex: 1 }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Profile Page ─────────────────────────────────────────────────────────────

// ─── Onboarding Banner ───────────────────────────────────────────────────────

function getProfileCompleteness(ath: ReturnType<typeof selectAthlete>): { filled: number; total: number } {
  const fields = [
    ath?.firstName, ath?.lastName, ath?.mainSport,
    ath?.city, ath?.country, ath?.dob, ath?.gender,
  ]
  return { filled: fields.filter(Boolean).length, total: fields.length }
}

function OnboardingBanner({ onEdit }: { onEdit: () => void }) {
  const athlete  = useAthleteStore(selectAthlete)
  const navigate = useNavigate()
  const isNew = !!localStorage.getItem('bt_new_user')

  if (!isNew) return null

  const { filled, total } = getProfileCompleteness(athlete)
  const complete = filled >= total

  return (
    <div style={{
      background: complete ? 'rgba(var(--green-ch),0.08)' : 'rgba(var(--orange-ch),0.08)',
      border: `1px solid ${complete ? 'rgba(var(--green-ch),0.3)' : 'rgba(var(--orange-ch),0.3)'}`,
      borderRadius: '12px',
      padding: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '4px',
    }}>
      <span style={{ fontSize: '20px' }}>{complete ? '✅' : '👋'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '14px', letterSpacing: '0.04em', textTransform: 'uppercase', color: complete ? 'var(--green)' : 'var(--orange)', lineHeight: 1.1 }}>
          {complete ? 'Profile Complete' : `Profile ${filled}/${total} Complete`}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px', lineHeight: 1.4 }}>
          {complete
            ? 'Your profile is ready.'
            : 'Fill in your details to unlock the full experience.'}
        </div>
      </div>
      <button
        onClick={() => {
          if (complete) {
            localStorage.removeItem('bt_new_user')
            navigate('/')
          } else {
            onEdit()
          }
        }}
        style={{
          flexShrink: 0,
          background: complete ? 'var(--green)' : 'var(--orange)',
          color: '#000',
          border: 'none',
          borderRadius: '8px',
          padding: '8px 14px',
          fontFamily: 'var(--headline)',
          fontWeight: 800,
          fontSize: '12px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {complete ? 'Go to Dashboard →' : 'Edit Profile'}
      </button>
    </div>
  )
}

// ─── Profile Page ─────────────────────────────────────────────────────────────

export function Profile() {
  const authUser = useAuthStore(selectAuthUser)
  const [showEdit, setShowEdit] = useState(false)

  // Auto-open edit modal 300ms after mount for new users (once per device)
  useEffect(() => {
    if (!authUser) return
    if (localStorage.getItem('bt_new_user') && !localStorage.getItem('bt_modal_shown')) {
      const t = setTimeout(() => {
        localStorage.setItem('bt_modal_shown', '1')
        setShowEdit(true)
      }, 300)
      return () => clearTimeout(t)
    }
  }, [authUser])

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
      {showEdit && <EditProfileModal onClose={() => setShowEdit(false)} />}
      <OnboardingBanner onEdit={() => { localStorage.setItem('bt_modal_shown', '1'); setShowEdit(true) }} />
      <AthleteHero onEdit={() => setShowEdit(true)} />
      <MedalWall />
      <AchievementsSection />
      <CountriesRaced />
      <PersonalBests />
      <SignatureDistances />
      <AgeGradeTrajectory />
      <PerformanceTimeline />
      <RaceActivityHeatmap />
      <MajorsQualifiers />
      <RacePersonality />
      <GoalsSection />
      <BioDetails onEdit={() => setShowEdit(true)} />
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
  } as React.CSSProperties,

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

  focusMeta: { fontSize: 'var(--text-xs)', color: 'var(--muted)' } as React.CSSProperties,

  focusDays: {
    fontFamily: 'var(--headline)',
    fontSize: '13px',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--orange)',
    marginTop: '4px',
  } as React.CSSProperties,

  // ── Achievements hero
  achievementHero: {
    background: 'linear-gradient(135deg, rgba(0,40,20,0.9) 0%, rgba(0,25,12,0.95) 60%, rgba(5,15,8,1) 100%)',
    border: '1px solid rgba(var(--green-ch), 0.2)',
    borderRadius: '16px',
    padding: '22px',
    minWidth: 0,
  } as React.CSSProperties,

  achievementPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(245,245,245,0.06)',
    border: '1px solid rgba(245,245,245,0.12)',
    borderRadius: '100px',
    padding: '7px 14px',
    fontSize: '11px',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--white)',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  achievementGroup: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '16px',
  } as React.CSSProperties,

  achievementGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
  } as React.CSSProperties,

  achievementTile: {
    background: 'var(--surface3)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '14px 10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0,
  } as React.CSSProperties,

  achievementIconBox: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(245,245,245,0.06)',
  } as React.CSSProperties,

  achievementName: {
    fontFamily: 'var(--headline)',
    fontSize: '9px',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--white)',
    textAlign: 'center',
    lineHeight: 1.3,
  } as React.CSSProperties,

  achievementStatus: {
    fontFamily: 'var(--headline)',
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '4px 8px',
    borderRadius: '100px',
    border: '1px solid rgba(245,245,245,0.08)',
  } as React.CSSProperties,

  // ── Countries
  countryPill: {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: '100px',
    padding: '7px 16px',
    fontFamily: 'var(--headline)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--white)',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  // ── Section containers
  section: {
    minWidth: 0,
  } as React.CSSProperties,

  subsection: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minWidth: 0,
  } as React.CSSProperties,

  sectionTitle: {
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '18px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--white)',
  } as React.CSSProperties,

  // ── PB cards
  pbCard: {
    background: 'var(--surface2)',
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

  editBtnSmall: {
    background: 'transparent',
    border: '1px solid var(--border2)',
    borderRadius: '6px',
    color: 'var(--muted)',
    padding: '5px 14px',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--body)',
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
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
    textTransform: 'uppercase',
    cursor: 'pointer',
  } as React.CSSProperties,

  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '28px 16px',
    textAlign: 'center',
  } as React.CSSProperties,

  emptyIcon: { fontSize: '32px', lineHeight: 1 } as React.CSSProperties,

  emptyText: {
    fontSize: 'var(--text-sm)',
    color: 'var(--muted)',
    maxWidth: '260px',
    lineHeight: 1.5,
  } as React.CSSProperties,
} as const

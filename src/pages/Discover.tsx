import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRaceCatalog } from '@/hooks/useRaceCatalog'
import type { CatalogRace } from '@/hooks/useRaceCatalog'
import { useRaceStore } from '@/stores/useRaceStore'
import { TimePickerWheel, type HMS } from '@/components/TimePickerWheel'
import { posthog } from '@/lib/posthog'
import type { Race } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const SPORTS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'run', label: 'Run' },
  { value: 'tri', label: 'Tri' },
  { value: 'cycle', label: 'Cycle' },
  { value: 'swim', label: 'Swim' },
  { value: 'hyrox', label: 'Hyrox' },
]

// Distance chips per sport type
const RUN_DIST_FILTERS: { label: string; match: (r: CatalogRace) => boolean }[] = [
  { label: 'All Distances', match: () => true },
  { label: '5K',           match: r => r.dist_km != null && r.dist_km >= 4.5 && r.dist_km <= 5.5 },
  { label: '10K',          match: r => r.dist_km != null && r.dist_km >= 9.5 && r.dist_km <= 10.5 },
  { label: 'Half Marathon', match: r => r.dist_km != null && r.dist_km >= 20.5 && r.dist_km <= 21.5 },
  { label: 'Marathon',      match: r => r.dist_km != null && r.dist_km >= 42.1 && r.dist_km <= 42.3 },
  { label: 'Ultra',         match: r => r.dist_km != null && r.dist_km > 42.3 && r.dist_km < 113 },
]

const TRI_DIST_FILTERS: { label: string; match: (r: CatalogRace) => boolean }[] = [
  { label: 'All Distances',              match: () => true },
  { label: 'Super Sprint',               match: r => r.dist_km != null && r.dist_km >= 10 && r.dist_km <= 16 },
  { label: 'Sprint',                     match: r => r.dist_km != null && r.dist_km >= 24 && r.dist_km <= 27 },
  { label: 'Olympic',                    match: r => r.dist_km != null && r.dist_km >= 50 && r.dist_km <= 53 },
  { label: 'PTO 100',                    match: r => r.dist_km != null && r.dist_km >= 99 && r.dist_km <= 101 },
  { label: '70.3 / Middle Distance',     match: r => r.dist_km != null && r.dist_km >= 112 && r.dist_km <= 114 },
  { label: 'IRONMAN / Full Distance',    match: r => r.dist_km != null && r.dist_km >= 225 && r.dist_km <= 227 },
]

const GENERIC_DIST_FILTERS: { label: string; match: (r: CatalogRace) => boolean }[] = [
  { label: 'All Distances', match: () => true },
]

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentYearMonth(): { year: number; month: number } {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

/** Returns true if the catalog race is upcoming (future-dated or undated). */
function isUpcoming(r: CatalogRace): boolean {
  const { year: cy, month: cm } = currentYearMonth()
  // No date info — include it (we don't know when it is)
  if (!r.month) return true
  // Specific year set — compare properly
  if (r.year) {
    if (r.year > cy) return true
    if (r.year < cy) return false
    // Same year — compare month (and day if available)
    if (r.month > cm) return true
    if (r.month < cm) return false
    // Same month — check day
    if (r.day) return r.day >= new Date().getDate()
    return true
  }
  // Month-only (recurring annual) — upcoming if month >= current month
  return r.month >= cm
}

/** Human-readable date for a catalog race */
function raceDate(r: CatalogRace): string {
  if (!r.month) return ''
  const monthName = MONTHS[r.month - 1]
  if (r.year) return r.day ? `${r.day} ${monthName} ${r.year}` : `${monthName} ${r.year}`
  return monthName
}

function sportLabel(type?: string): string {
  const map: Record<string, string> = {
    run: 'RUN', tri: 'TRI', cycle: 'CYCLE', swim: 'SWIM', hyrox: 'HYROX',
  }
  return type ? (map[type] ?? type.toUpperCase()) : 'RACE'
}

function sportColor(type?: string): string {
  const map: Record<string, string> = {
    run: 'var(--orange)', tri: '#00b4d8', cycle: '#48cae4',
    swim: '#0077b6', hyrox: '#f72585',
  }
  return type ? (map[type] ?? 'var(--muted)') : 'var(--muted)'
}

function distDisplay(r: CatalogRace): string {
  if (!r.dist_km) return r.dist ?? '—'
  const km = r.dist_km
  // Running
  if (km >= 42.1 && km <= 42.3) return 'Marathon'
  if (km >= 20.5 && km <= 21.5) return 'Half Marathon'
  if (km >= 9.5 && km <= 10.5) return '10K'
  if (km >= 4.5 && km <= 5.5) return '5K'
  if (km > 42.3 && km < 99) return 'Ultra'
  // Triathlon
  if (km >= 225 && km <= 227) return 'IRONMAN / Full Distance'
  if (km >= 112 && km <= 114) return '70.3 / Middle Distance'
  if (km >= 99 && km <= 101) return 'PTO 100'
  if (km >= 50 && km <= 53) return 'Olympic'
  if (km >= 24 && km <= 27) return 'Sprint'
  if (km >= 10 && km <= 16) return 'Super Sprint'
  return r.dist ?? `${km}km`
}

function catalogToRace(r: CatalogRace): Race {
  const dateStr = r.year && r.month && r.day
    ? `${r.year}-${String(r.month).padStart(2, '0')}-${String(r.day).padStart(2, '0')}`
    : r.year && r.month
    ? `${r.year}-${String(r.month).padStart(2, '0')}-01`
    : ''

  const sportMap: Record<string, string> = {
    run: 'running', tri: 'triathlon', cycle: 'cycling',
    swim: 'swim', hyrox: 'hyrox',
  }

  return {
    id: crypto.randomUUID(),
    name: r.name,
    date: dateStr,
    city: r.city ?? '',
    country: r.country ?? '',
    distance: r.dist_km != null ? String(r.dist_km) : r.dist ?? '',
    sport: r.type ? (sportMap[r.type] ?? r.type) : 'running',
  }
}

// ── Quick Plan Sheet ──────────────────────────────────────────────────────────

function QuickPlanSheet({
  race,
  onClose,
  onSave,
}: {
  race: Race
  onClose: () => void
  onSave: (goalTime: string | undefined, priority: 'A' | 'B' | 'C' | undefined) => void
}) {
  const [goalHMS, setGoalHMS] = useState<HMS>({ h: 0, m: 0, s: 0 })
  const [priority, setPriority] = useState<'A' | 'B' | 'C' | ''>('')

  function handleSave() {
    const totalSecs = goalHMS.h * 3600 + goalHMS.m * 60 + goalHMS.s
    const goalTime = totalSecs > 0
      ? `${goalHMS.h}:${String(goalHMS.m).padStart(2, '0')}:${String(goalHMS.s).padStart(2, '0')}`
      : undefined
    onSave(goalTime, (priority as 'A' | 'B' | 'C') || undefined)
  }

  // Format date for display
  const dateDisplay = race.date
    ? new Date(race.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 800,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
          border: '1px solid var(--border2)',
          padding: '1.25rem 1rem 2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {/* Drag handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'var(--border2)',
          alignSelf: 'center',
          marginBottom: '0.25rem',
        }} />

        {/* Race info header */}
        <div>
          <div style={{
            fontFamily: 'var(--headline)',
            fontWeight: 900,
            fontSize: 'var(--text-lg)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--white)',
          }}>
            {race.name}
          </div>
          <div style={{
            fontFamily: 'var(--body)',
            fontSize: 'var(--text-sm)',
            color: 'var(--muted)',
            marginTop: '0.2rem',
          }}>
            {[race.city, race.country].filter(Boolean).join(' · ')}
            {dateDisplay ? <span style={{ color: 'var(--orange)', marginLeft: '0.5rem' }}>{dateDisplay}</span> : null}
          </div>
        </div>

        {/* Goal time */}
        <div>
          <div style={{
            fontFamily: 'var(--headline)',
            fontWeight: 800,
            fontSize: 'var(--text-xs)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginBottom: '0.5rem',
          }}>
            Goal Time <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </div>
          <TimePickerWheel value={goalHMS} onChange={setGoalHMS} maxHours={99} />
          <div style={{
            fontFamily: 'var(--body)',
            fontSize: 'var(--text-xs)',
            color: 'var(--muted)',
            marginTop: '0.4rem',
          }}>
            Used by Gap to Goal widget
          </div>
        </div>

        {/* Priority */}
        <div>
          <div style={{
            fontFamily: 'var(--headline)',
            fontWeight: 800,
            fontSize: 'var(--text-xs)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginBottom: '0.5rem',
          }}>
            Race Priority <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(['A', 'B', 'C'] as const).map(p => {
              const desc = p === 'A' ? 'Peak — full taper' : p === 'B' ? 'Key — partial taper' : 'Training — no taper'
              const active = priority === p
              return (
                <button
                  key={p}
                  onClick={() => setPriority(active ? '' : p)}
                  style={{
                    flex: 1,
                    padding: '10px 8px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${active ? 'var(--orange)' : 'var(--border2)'}`,
                    background: active ? 'rgba(var(--orange-ch),0.12)' : 'var(--surface2)',
                    color: active ? 'var(--orange)' : 'var(--white)',
                    cursor: 'pointer',
                    fontFamily: 'var(--body)',
                    textAlign: 'center',
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                >
                  <div style={{
                    fontFamily: 'var(--headline)',
                    fontWeight: 900,
                    fontSize: 'var(--text-lg)',
                    letterSpacing: '0.04em',
                  }}>{p}</div>
                  <div style={{
                    fontSize: 'var(--text-xs)',
                    color: active ? 'var(--orange)' : 'var(--muted)',
                    marginTop: '2px',
                  }}>{desc}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: 'var(--orange)',
            color: '#000',
            fontFamily: 'var(--headline)',
            fontWeight: 900,
            fontSize: 'var(--text-base)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Add to Calendar
        </button>
      </div>
    </div>,
    document.body,
  )
}

// ── Components ────────────────────────────────────────────────────────────────

function FilterChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        background: active ? 'rgba(232,78,27,0.12)' : 'var(--surface2)',
        color: active ? 'var(--orange)' : 'var(--white)',
        border: `1px solid ${active ? 'rgba(232,78,27,0.4)' : 'var(--border2)'}`,
        borderRadius: 'var(--radius-pill)',
        padding: '5px 12px',
        fontFamily: 'var(--headline)',
        fontWeight: 800,
        fontSize: 'var(--text-xs)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {children}
    </button>
  )
}

function RaceCard({
  race,
  isWishlisted,
  onWishlist,
  onPlan,
  isPlanned,
}: {
  race: CatalogRace
  isWishlisted: boolean
  onWishlist: () => void
  onPlan: () => void
  isPlanned?: boolean
}) {
  const dateStr = raceDate(race)
  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '0.875rem 1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--headline)',
            fontWeight: 800,
            fontSize: 'var(--text-compact)',
            letterSpacing: '0.04em',
            color: 'var(--white)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {race.name}
          </div>
          <div style={{
            fontFamily: 'var(--body)',
            fontSize: 'var(--text-xs)',
            color: 'var(--muted)',
            marginTop: '2px',
          }}>
            {[race.city, race.country].filter(Boolean).join(' · ')}
            {dateStr
              ? <span style={{ color: 'var(--orange)', marginLeft: '6px' }}>{dateStr}</span>
              : <span style={{ background: 'var(--surface3)', color: 'var(--muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', borderRadius: 'var(--radius-xs)', padding: '2px 6px', marginLeft: '6px' }}>Date TBD</span>
            }
          </div>
        </div>
        {/* Sport badge */}
        <span style={{
          fontFamily: 'var(--headline)',
          fontWeight: 900,
          fontSize: 'var(--text-xs)',
          letterSpacing: '0.1em',
          color: sportColor(race.type),
          background: `${sportColor(race.type)}18`,
          border: `1px solid ${sportColor(race.type)}40`,
          borderRadius: 'var(--radius-xs)',
          padding: '2px 6px',
          flexShrink: 0,
        }}>
          {sportLabel(race.type)}
        </span>
      </div>

      {/* Distance + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{
          fontFamily: 'var(--headline)',
          fontWeight: 900,
          fontSize: 'var(--text-xs)',
          letterSpacing: '0.06em',
          color: 'var(--muted)',
          flex: 1,
        }}>
          {distDisplay(race)}
        </span>
        <button
          onClick={onWishlist}
          title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          style={{
            background: isWishlisted ? 'rgba(255,77,0,0.12)' : 'transparent',
            color: isWishlisted ? 'var(--orange)' : 'var(--muted)',
            border: `1px solid ${isWishlisted ? 'var(--orange)' : 'var(--border2)'}`,
            borderRadius: 'var(--radius-sm)',
            padding: '4px 10px',
            fontFamily: 'var(--headline)',
            fontWeight: 800,
            fontSize: 'var(--text-xs)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {isWishlisted ? '★ Saved' : '☆ Wish'}
        </button>
        <button
          onClick={onPlan}
          disabled={isPlanned}
          style={{
            background: isPlanned ? 'rgba(0,255,136,0.12)' : 'var(--surface3)',
            color: 'var(--green)',
            border: '1px solid rgba(var(--green-ch),0.25)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 10px',
            fontFamily: 'var(--headline)',
            fontWeight: 800,
            fontSize: 'var(--text-xs)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: isPlanned ? 'default' : 'pointer',
            opacity: isPlanned ? 0.9 : 1,
          }}
        >
          {isPlanned ? '✓ Planned' : '+ Plan'}
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function Discover() {
  const { data: catalog, isLoading } = useRaceCatalog()
  const wishlistRaces = useRaceStore(s => s.wishlistRaces)
  const addToWishlist = useRaceStore(s => s.addToWishlist)
  const removeFromWishlist = useRaceStore(s => s.removeFromWishlist)

  const [sportFilter, setSportFilter] = useState('')
  const [distFilterIdx, setDistFilterIdx] = useState(0)
  const [countryFilter, setCountryFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState(0) // 0 = all, 1–12 = month

  const addUpcomingRace = useRaceStore(s => s.addUpcomingRace)
  const upcomingRaces = useRaceStore(s => s.upcomingRaces)

  const [planRace, setPlanRace] = useState<Race | null>(null)

  // Distance chip set depends on selected sport
  const distFilters = sportFilter === 'run' ? RUN_DIST_FILTERS
    : sportFilter === 'tri' ? TRI_DIST_FILTERS
    : GENERIC_DIST_FILTERS

  // Reset dist filter when sport changes
  function handleSportChange(value: string) {
    setSportFilter(value)
    setDistFilterIdx(0)
  }

  // Wishlist lookup set
  const wishlistNames = useMemo(
    () => new Set(wishlistRaces.map(r => r.name.toLowerCase())),
    [wishlistRaces],
  )

  const filtered = useMemo(() => {
    if (!catalog) return []
    const now = new Date()
    const cy = now.getFullYear()
    const cm = now.getMonth() + 1
    const cd = now.getDate()

    // Build a numeric sort key (YYYYMMDD) for a catalog race.
    // Month-only recurring entries: use current year if month >= current month, else next year.
    // No date info → sort last.
    function dateKey(r: CatalogRace): number {
      if (r.year && r.month) {
        return r.year * 10000 + r.month * 100 + (r.day ?? 1)
      }
      if (r.month) {
        const y = r.month >= cm ? cy : cy + 1
        // Same month recurring → sort at today's date so it leads the list
        const d = (r.month === cm && y === cy) ? cd : (r.day ?? 1)
        return y * 10000 + r.month * 100 + d
      }
      return 99999999
    }

    const todayKey = cy * 10000 + cm * 100 + cd

    return catalog
      .filter(r => {
        if (!isUpcoming(r)) return false
        if (sportFilter && r.type !== sportFilter) return false
        if (!distFilters[distFilterIdx]?.match(r)) return false
        if (countryFilter) {
          const q = countryFilter.toLowerCase()
          if (!r.country?.toLowerCase().includes(q) && !r.city?.toLowerCase().includes(q)) return false
        }
        if (monthFilter && r.month !== monthFilter) return false
        // Exclude day-precise races already past today
        if (r.year && r.month && r.day && dateKey(r) < todayKey) return false
        return true
      })
      .sort((a, b) => dateKey(a) - dateKey(b))
  }, [catalog, sportFilter, distFilterIdx, distFilters, countryFilter, monthFilter])

  const visible = filtered.slice(0, 100)

  // Set of already-planned race names (date-keyed for dedupe)
  const plannedKeys = useMemo(
    () => new Set(upcomingRaces.map(r => `${r.name.toLowerCase()}|${r.date}`)),
    [upcomingRaces],
  )

  function isAlreadyPlanned(r: CatalogRace): boolean {
    const race = catalogToRace(r)
    return plannedKeys.has(`${race.name.toLowerCase()}|${race.date}`)
  }

  function handleQuickPlanSave(
    goalTime: string | undefined,
    priority: 'A' | 'B' | 'C' | undefined,
  ) {
    if (!planRace) return
    const race: Race = {
      ...planRace,
      ...(goalTime ? { goalTime } : {}),
      ...(priority ? { priority } : {}),
    }
    addUpcomingRace(race)
    posthog.capture('race planned', {
      race_name: race.name,
      race_priority: priority ?? null,
      has_goal_time: !!goalTime,
    })
    setPlanRace(null)
  }

  function handleWishlist(r: CatalogRace) {
    const key = r.name.toLowerCase()
    if (wishlistNames.has(key)) {
      const match = wishlistRaces.find(w => w.name.toLowerCase() === key)
      if (match) removeFromWishlist(match.id)
    } else {
      addToWishlist(catalogToRace(r))
      posthog.capture('race wishlisted', {
        race_name: r.name,
        race_type: r.type ?? null,
        race_country: r.country ?? null,
        race_distance: distDisplay(r),
      })
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      overflow: 'hidden',
      background: 'var(--surface)',
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 1rem 0.75rem',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: 'var(--headline)',
          fontWeight: 900,
          fontSize: 'var(--text-lg)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--white)',
          marginBottom: '0.75rem',
        }}>
          Upcoming Races
          {!isLoading && catalog && (
            <span style={{
              fontFamily: 'var(--body)',
              fontWeight: 400,
              fontSize: 'var(--text-xs)',
              color: 'var(--muted)',
              textTransform: 'none',
              letterSpacing: 0,
              marginLeft: '0.75rem',
            }}>
              {filtered.length.toLocaleString()} upcoming {sportFilter === 'run' ? 'runs' : 'races'}
            </span>
          )}
        </div>

        {/* Sport filter */}
        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
          {SPORTS.map(s => (
            <FilterChip
              key={s.value}
              active={sportFilter === s.value}
              onClick={() => handleSportChange(s.value)}
            >
              {s.label}
            </FilterChip>
          ))}
        </div>

        {/* Distance filter — sport-aware */}
        {distFilters.length > 1 && (
          <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {distFilters.map((d, i) => (
              <FilterChip
                key={d.label}
                active={distFilterIdx === i}
                onClick={() => setDistFilterIdx(i)}
              >
                {d.label}
              </FilterChip>
            ))}
          </div>
        )}

        {/* Country search + month filter row */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Country or city..."
            value={countryFilter}
            onChange={e => setCountryFilter(e.target.value)}
            style={{
              flex: 1,
              background: 'var(--surface2)',
              border: '1px solid var(--border2)',
              borderRadius: 'var(--radius-md)',
              padding: '7px 10px',
              fontFamily: 'var(--body)',
              fontSize: 'var(--text-sm)',
              color: 'var(--white)',
              outline: 'none',
            }}
          />
          <select
            value={monthFilter}
            onChange={e => setMonthFilter(Number(e.target.value))}
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border2)',
              borderRadius: 'var(--radius-md)',
              padding: '7px 10px',
              fontFamily: 'var(--headline)',
              fontWeight: 800,
              fontSize: 'var(--text-xs)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: monthFilter ? 'var(--orange)' : 'var(--muted)',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value={0}>All months</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0.75rem 1rem',
        paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.625rem',
      }}>
        {isLoading && (
          <div style={{
            textAlign: 'center',
            color: 'var(--muted)',
            fontFamily: 'var(--body)',
            fontSize: 'var(--text-sm)',
            paddingTop: '3rem',
          }}>
            Loading race catalog...
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: 'var(--muted)',
            fontFamily: 'var(--body)',
            fontSize: 'var(--text-sm)',
            paddingTop: '3rem',
          }}>
            No upcoming races found — try removing a filter.
          </div>
        )}

        {visible.map(r => (
          <RaceCard
            key={r.id}
            race={r}
            isWishlisted={wishlistNames.has(r.name.toLowerCase())}
            onWishlist={() => handleWishlist(r)}
            onPlan={() => {
              if (!isAlreadyPlanned(r)) setPlanRace(catalogToRace(r))
            }}
            isPlanned={isAlreadyPlanned(r)}
          />
        ))}

        {filtered.length > 100 && (
          <div style={{
            textAlign: 'center',
            color: 'var(--muted)',
            fontFamily: 'var(--body)',
            fontSize: 'var(--text-xs)',
            paddingTop: '0.5rem',
          }}>
            Showing 100 of {filtered.length.toLocaleString()} — add more filters to narrow results
          </div>
        )}
      </div>

      {planRace && (
        <QuickPlanSheet
          race={planRace}
          onClose={() => setPlanRace(null)}
          onSave={handleQuickPlanSave}
        />
      )}
    </div>
  )
}

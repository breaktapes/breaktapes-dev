import { useState, useMemo } from 'react'
import { useRaceCatalog } from '@/hooks/useRaceCatalog'
import type { CatalogRace } from '@/hooks/useRaceCatalog'
import { useRaceStore } from '@/stores/useRaceStore'
import { AddRaceModal } from '@/components/AddRaceModal'
import type { Race } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const SPORTS: { value: string; label: string; icon: string }[] = [
  { value: '', label: 'All', icon: '🏅' },
  { value: 'run', label: 'Run', icon: '🏃' },
  { value: 'tri', label: 'Tri', icon: '🏊' },
  { value: 'cycle', label: 'Cycle', icon: '🚴' },
  { value: 'swim', label: 'Swim', icon: '🌊' },
  { value: 'hyrox', label: 'Hyrox', icon: '⚡' },
]

// Distance chips per sport type
const RUN_DIST_FILTERS: { label: string; match: (r: CatalogRace) => boolean }[] = [
  { label: 'All Distances', match: () => true },
  { label: '5KM',           match: r => r.dist_km != null && r.dist_km >= 4.5 && r.dist_km <= 5.5 },
  { label: '10KM',          match: r => r.dist_km != null && r.dist_km >= 9.5 && r.dist_km <= 10.5 },
  { label: 'Half Marathon', match: r => r.dist_km != null && r.dist_km >= 20.5 && r.dist_km <= 21.5 },
  { label: 'Marathon',      match: r => r.dist_km != null && r.dist_km >= 42.1 && r.dist_km <= 42.3 },
  { label: 'Ultra',         match: r => r.dist_km != null && r.dist_km > 42.3 && r.dist_km < 113 },
]

const TRI_DIST_FILTERS: { label: string; match: (r: CatalogRace) => boolean }[] = [
  { label: 'All Distances',            match: () => true },
  { label: 'Sprint',                   match: r => r.dist_km != null && r.dist_km >= 24 && r.dist_km <= 27 },
  { label: 'Olympic',                  match: r => r.dist_km != null && r.dist_km >= 50 && r.dist_km <= 53 },
  { label: '70.3',    match: r => r.dist_km != null && r.dist_km >= 112 && r.dist_km <= 114 },
  { label: 'IRONMAN', match: r => r.dist_km != null && r.dist_km >= 225 && r.dist_km <= 227 },
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
  if (km >= 9.5 && km <= 10.5) return '10KM'
  if (km >= 4.5 && km <= 5.5) return '5KM'
  if (km > 42.3 && km < 113) return 'Ultra'
  // Triathlon
  if (km >= 225 && km <= 227) return 'IRONMAN'
  if (km >= 112 && km <= 114) return '70.3'
  if (km >= 50 && km <= 53) return 'Olympic'
  if (km >= 24 && km <= 27) return 'Sprint'
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

// ── Components ────────────────────────────────────────────────────────────────

function FilterChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'var(--orange)' : 'var(--surface2)',
        color: active ? 'var(--black)' : 'var(--white)',
        border: active ? 'none' : '1px solid var(--border2)',
        borderRadius: '20px',
        padding: '5px 12px',
        fontFamily: 'var(--headline)',
        fontWeight: 800,
        fontSize: '11px',
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
}: {
  race: CatalogRace
  isWishlisted: boolean
  onWishlist: () => void
  onPlan: () => void
}) {
  const dateStr = raceDate(race)
  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
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
            fontSize: '14px',
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
            fontSize: '12px',
            color: 'var(--muted)',
            marginTop: '2px',
          }}>
            {[race.city, race.country].filter(Boolean).join(' · ')}
            {dateStr && <span style={{ color: 'var(--orange)', marginLeft: '6px' }}>{dateStr}</span>}
          </div>
        </div>
        {/* Sport badge */}
        <span style={{
          fontFamily: 'var(--headline)',
          fontWeight: 900,
          fontSize: '9px',
          letterSpacing: '0.1em',
          color: sportColor(race.type),
          background: `${sportColor(race.type)}18`,
          border: `1px solid ${sportColor(race.type)}40`,
          borderRadius: '4px',
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
          fontSize: '11px',
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
            borderRadius: '6px',
            padding: '4px 10px',
            fontFamily: 'var(--headline)',
            fontWeight: 800,
            fontSize: '10px',
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
          style={{
            background: 'var(--surface3)',
            color: 'var(--green)',
            border: '1px solid rgba(0,255,136,0.25)',
            borderRadius: '6px',
            padding: '4px 10px',
            fontFamily: 'var(--headline)',
            fontWeight: 800,
            fontSize: '10px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          + Plan
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
    return catalog.filter(r => {
      // Upcoming only
      if (!isUpcoming(r)) return false
      if (sportFilter && r.type !== sportFilter) return false
      if (!distFilters[distFilterIdx]?.match(r)) return false
      if (countryFilter) {
        const q = countryFilter.toLowerCase()
        if (!r.country?.toLowerCase().includes(q) && !r.city?.toLowerCase().includes(q)) return false
      }
      if (monthFilter && r.month !== monthFilter) return false
      return true
    })
  }, [catalog, sportFilter, distFilterIdx, distFilters, countryFilter, monthFilter])

  const visible = filtered.slice(0, 100)

  function handleWishlist(r: CatalogRace) {
    const key = r.name.toLowerCase()
    if (wishlistNames.has(key)) {
      const match = wishlistRaces.find(w => w.name.toLowerCase() === key)
      if (match) removeFromWishlist(match.id)
    } else {
      addToWishlist(catalogToRace(r))
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
          fontSize: '20px',
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
              fontSize: '12px',
              color: 'var(--muted)',
              textTransform: 'none',
              letterSpacing: 0,
              marginLeft: '0.75rem',
            }}>
              {filtered.length.toLocaleString()} found
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
              {s.icon} {s.label}
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
              borderRadius: '8px',
              padding: '7px 10px',
              fontFamily: 'var(--body)',
              fontSize: '13px',
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
              borderRadius: '8px',
              padding: '7px 10px',
              fontFamily: 'var(--headline)',
              fontWeight: 800,
              fontSize: '11px',
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
            fontSize: '13px',
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
            fontSize: '13px',
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
            onPlan={() => setPlanRace(catalogToRace(r))}
          />
        ))}

        {filtered.length > 100 && (
          <div style={{
            textAlign: 'center',
            color: 'var(--muted)',
            fontFamily: 'var(--body)',
            fontSize: '12px',
            paddingTop: '0.5rem',
          }}>
            Showing 100 of {filtered.length.toLocaleString()} — add more filters to narrow results
          </div>
        )}
      </div>

      {/* AddRaceModal in upcoming mode */}
      {planRace && (
        <AddRaceModal
          defaultMode="upcoming"
          prefill={planRace}
          onClose={() => setPlanRace(null)}
        />
      )}
    </div>
  )
}

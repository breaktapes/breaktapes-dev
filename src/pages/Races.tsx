/**
 * Races page — full-viewport MapLibre map with race location pin markers
 * and a drag-able bottom sheet listing race history.
 *
 * The map uses CartoDB Dark Matter (no API key required).
 * Pin markers only — no arc routes between races.
 */
import { useRef, useState, useMemo, useEffect, Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { posthog } from '@/lib/posthog'
import Map, { Marker } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useRaceStore } from '@/stores/useRaceStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { ViewEditRaceModal } from '@/components/ViewEditRaceModal'
import { AddRaceModal } from '@/components/AddRaceModal'
import { RaceImportModal } from '@/components/RaceImportModal'
import { IronmanRacePicker } from '@/components/IronmanRacePicker'
import { RaceLogPassport } from '@/components/RaceLogPassport'
import type { Race } from '@/types'
import { useUnits, distUnit } from '@/lib/units'
import { geocodeCity } from '@/lib/geocode'
import { normalizeCityName } from '@/lib/cityNormalize'
import { distLabel as distLabelUtil } from '@/lib/utils'

// Error boundary for MapLibre — catches WebGL init failures, style errors, CSP blocks
class MapErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[MapLibre]', error, info.componentStack)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'var(--surface)', color: 'var(--muted)',
          fontFamily: 'var(--body)', fontSize: 'var(--text-compact)', textAlign: 'center', padding: '2rem',
        }}>
          Map unavailable on this device
        </div>
      )
    }
    return this.props.children
  }
}

const CARTO_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

const INITIAL_VIEW = {
  longitude: 10,
  latitude: 20,
  zoom: 1.6,
  pitch: 0,
  bearing: 0,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DIST_LABEL_KM: Record<string, number> = {
  'marathon': 42.195, 'full marathon': 42.195,
  'half marathon': 21.0975, 'half': 21.0975,
  'ironman': 226, 'full ironman': 226, 'full distance': 226,
  'half ironman': 113, '70.3': 113, 'middle distance': 113,
  'olympic': 51.5, 'olympic triathlon': 51.5,
  'sprint': 25.75, 'sprint triathlon': 25.75,
  '5k': 5, '10k': 10, '15k': 15, '20k': 20, '25k': 25, '30k': 30,
  '50k': 50, '60k': 60, '80k': 80, '90k': 90, '100k': 100,
  '160k': 160, '50mi': 80.47, '100mi': 160.93,
  'ultra': 50, 'ultramarathon': 50,
  'mile': 1.609, '1 mile': 1.609, '5 mile': 8.047, '10 mile': 16.09,
  'hyrox': 8,
}

function distanceToKm(d: string | undefined): number {
  if (!d) return 0
  const n = parseFloat(d)
  if (!isNaN(n)) return n
  return DIST_LABEL_KM[d.toLowerCase().trim()] ?? 0
}

/** Human-readable distance label for display. Pass sport so tri distances
 *  (Olympic/70.3/IRONMAN) only apply to triathlons, not same-km ultra runs. */
function distLabel(d: string | undefined, sport?: string): string {
  return distLabelUtil(d, sport)
}

/** Zero-pads hours in a time string: "5:09:49" → "05:09:49" */
function padTime(t: string | undefined): string | undefined {
  if (!t) return t
  const parts = t.split(':')
  if (parts.length === 3 && parts[0].length === 1) {
    return `0${parts[0]}:${parts[1]}:${parts[2]}`
  }
  return t
}

function normKey(d: string | undefined): string {
  const km = distanceToKm(d)
  if (km <= 0) return (d ?? '').toLowerCase().trim()
  if (km >= 42.1 && km <= 42.3) return 'marathon'
  if (km >= 21.0 && km <= 21.2) return 'half marathon'
  if (km >= 112.9 && km <= 113.1) return '70.3 / Middle Distance'
  if (km >= 225.9 && km <= 226.1) return 'ironman'
  return `${km}`
}

function buildPBMap(races: Race[]): Record<string, Race> {
  const pb: Record<string, Race> = {}
  for (const r of races) {
    if (!r.time || !r.distance) continue
    const secs = timeToSecs(r.time)
    if (secs == null) continue
    const key = normKey(r.distance)
    if (!pb[key] || timeToSecs(pb[key].time!)! > secs) {
      pb[key] = r
    }
  }
  return pb
}

function timeToSecs(t: string): number | null {
  const parts = t.split(':').map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
}

function parsePlacing(str: string | undefined): { pos: number; total: number; pct: number } | null {
  if (!str) return null
  const m = str.match(/(\d+)\s*[/\\]\s*(\d+)/)
  if (!m) return null
  const pos = parseInt(m[1], 10), total = parseInt(m[2], 10)
  if (!pos || !total || pos > total) return null
  return { pos, total, pct: Math.max(0, Math.min(100, Math.round((1 - (pos - 1) / total) * 100))) }
}

// ── Year-filter tabs ──────────────────────────────────────────────────────────

function YearTabs({
  races, active, onChange,
}: { races: Race[]; active: string; onChange: (y: string) => void }) {
  const years = [...new Set(races.map(r => r.date.slice(0, 4)))].sort((a, b) => Number(b) - Number(a))
  const tabs = [{ label: 'ALL', val: 'all' }, ...years.map(y => ({ label: y, val: y }))]
  return (
    <div className="races-year-tabs">
      {tabs.map(t => (
        <button
          key={t.val}
          className={`races-year-tab${active === t.val ? ' active' : ''}`}
          onClick={() => onChange(t.val)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Stats strip ───────────────────────────────────────────────────────────────

function StatsStrip({ races }: { races: Race[] }) {
  const units = useUnits()
  // KM and medals exclude DNF / DSQ / DNS — distance only counts when the
  // user actually finished, and you can't be awarded a medal you didn't earn.
  const finished = races.filter(r => !r.outcome || r.outcome === 'Finished')
  const km = finished.reduce((s, r) => s + distanceToKm(r.distance), 0)
  const totalDist = Math.round(units === 'imperial' ? km * 0.621371 : km)
  const countries = new Set(races.map(r => r.country).filter(Boolean)).size
  const cities = new Set(
    races
      .filter(r => r.city && r.city.trim())
      .map(r => `${r.city!.trim().toLowerCase()}|${(r.country || '').trim().toLowerCase()}`)
  ).size
  // 1 medal per finished race that has any medal logged, +1 extra for a
  // podium (gold/silver/bronze) — podium racers receive a separate medal.
  const finisherMedals = finished.filter(r => r.medal).length
  const podiumMedals = finished.filter(r =>
    ['gold', 'silver', 'bronze'].includes((r.medal || '').toLowerCase())
  ).length
  const medals = finisherMedals + podiumMedals

  const stats = [
    { val: races.length, label: 'RACES' },
    { val: cities,       label: 'CITIES' },
    { val: countries,    label: 'COUNTRIES' },
    { val: totalDist,    label: distUnit(units) },
    { val: medals,       label: 'MEDALS' },
  ]

  return (
    <div className="races-sheet-stats">
      {stats.map(s => (
        <div key={s.label} className="races-stat-cell">
          <div className="races-stat-val">{s.val}</div>
          <div className="races-stat-label">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Compact race row ──────────────────────────────────────────────────────────

function CompactRow({ race, isPB, onClick }: { race: Race; isPB: boolean; onClick: () => void }) {
  const d = new Date(race.date + 'T00:00:00')
  const mon = d.toLocaleString('en', { month: 'short' }).toUpperCase()
  const day = d.getDate()
  const city = [race.city, race.country].filter(Boolean).join(', ')
  const label = distLabel(race.distance, race.sport)
  const nonFinish = race.outcome && race.outcome !== 'Finished'
    ? race.outcome.toUpperCase()
    : null

  return (
    <div
      className={`race-row-compact${isPB ? ' is-pb' : ''}`}
      onClick={onClick}
      style={{
        cursor: 'pointer',
        // Extend PB gradient to full list width; calc(1rem - 3px) keeps content
        // column-aligned with non-PB rows (border-left: 3px eats back the 3px)
        ...(isPB ? { marginLeft: '-1rem', marginRight: '-1rem', paddingLeft: 'calc(1rem - 3px)', paddingRight: '1rem' } : {}),
      }}
    >
      <div className={`rrc-date-chip${isPB ? ' is-pb' : ''}`}>
        <div className="rrc-date-chip-mon">{mon}</div>
        <div className="rrc-date-chip-day">{day}</div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="rrc-name">{race.name}</div>
        {city && <div className="rrc-meta">{city}</div>}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div
          className="rrc-time"
          style={nonFinish ? { color: 'var(--muted)' } : undefined}
        >
          {nonFinish ?? (padTime(race.time) ?? '—')}
        </div>
        {label && <div className="rrc-dist">{label}</div>}
      </div>
    </div>
  )
}

// ── Detailed race row ─────────────────────────────────────────────────────────

function DetailedRow({ race, isPB, onClick }: { race: Race; isPB: boolean; onClick: () => void }) {
  const d = new Date(race.date + 'T00:00:00')
  const mon = d.toLocaleString('en', { month: 'short' }).toUpperCase()
  const day = d.getDate()
  const placing = parsePlacing(race.placing)
  const label = distLabel(race.distance, race.sport)
  const nonFinish = race.outcome && race.outcome !== 'Finished'
    ? race.outcome.toUpperCase()
    : null

  return (
    <div
      className={`race-row-detailed${isPB ? ' is-pb' : ''}`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      {/* Top row: date chip + name + time */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 'var(--sp-2)', alignItems: 'center' }}>
        <div className={`rrc-date-chip${isPB ? ' is-pb' : ''}`}>
          <div className="rrc-date-chip-mon">{mon}</div>
          <div className="rrc-date-chip-day">{day}</div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 'var(--text-compact)', color: 'var(--white)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {race.name}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[race.city, race.country].filter(Boolean).join(', ')}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--num)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1, "zero" 1', fontSize: '17px', color: nonFinish ? 'var(--muted)' : (isPB ? 'var(--green)' : 'var(--orange)'), letterSpacing: 'var(--num-track)' }}>
            {nonFinish ?? (padTime(race.time) ?? '—')}
          </div>
          {label && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', textAlign: 'right', marginTop: '1px' }}>{label}</div>}
        </div>
      </div>

      {/* Stats row: placing + percentile + distance badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginTop: '8px', flexWrap: 'wrap' }}>
        {isPB && <span className="tag tag-pb">PB</span>}
        {race.medal && (
          <span className={`medal-chip medal-${race.medal}`} style={{ padding: '3px 8px', fontSize: 'var(--text-xs)', borderRadius: 'var(--radius-sm)' }}>
            {race.medal.toUpperCase()}
          </span>
        )}
        {placing && (
          <span className="tag" style={{ fontFamily: 'var(--mono)', fontSize: 'var(--text-xs)' }}>
            {placing.pos}/{placing.total} <span style={{ color: 'var(--muted)', marginLeft: '2px' }}>· top {placing.pct}%</span>
          </span>
        )}
        {race.sport && !label.toLowerCase().includes(race.sport.toLowerCase()) && (
          <span className="tag">{race.sport}</span>
        )}
      </div>
    </div>
  )
}

// ── Wishlist row ──────────────────────────────────────────────────────────────

function WishlistRow({ race, onPlan, onRemove }: {
  race: Race
  onPlan: () => void
  onRemove: () => void
}) {
  return (
    <div style={{
      padding: '12px 14px',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--sp-2)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 'var(--text-compact)', color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {race.name}
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '2px' }}>
          {[race.distance ? distLabel(race.distance, race.sport) : null, race.city, race.country].filter(Boolean).join(' · ')}
        </div>
        {race.date && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '2px' }}>
            {new Date(race.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 'var(--sp-2)', flexShrink: 0 }}>
        <button
          onClick={onPlan}
          style={{ background: 'rgba(var(--green-ch),0.12)', border: '1px solid rgba(var(--green-ch),0.3)', color: 'var(--green)', borderRadius: 'var(--radius-sm)', padding: '5px 10px', fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 'var(--text-xs)', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}
        >
          PLAN
        </button>
        <button
          onClick={onRemove}
          style={{ background: 'transparent', border: '1px solid var(--border2)', color: 'var(--muted)', borderRadius: 'var(--radius-sm)', padding: '5px 8px', fontSize: 'var(--text-sm)', cursor: 'pointer' }}
          aria-label="Remove from wishlist"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// ── Races sheet ───────────────────────────────────────────────────────────────

function YearDivider({ year }: { year: string }) {
  // V4 §04 yr-b — orange dot + orange-gradient rule. CSS in styles/index.css.
  return (
    <div className="yr-b">
      <span className="yr-b-dot" aria-hidden="true" />
      <span className="yr-b-label">{year}</span>
    </div>
  )
}

type ViewMode = 'compact' | 'detailed' | 'wishlist'

function RacesSheet({ races, onAddRace, onImportRace, onOpenPassport, onDiscover }: { races: Race[]; onAddRace: () => void; onImportRace: () => void; onOpenPassport: (year: string) => void; onDiscover: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [yearFilter, setYearFilter] = useState('all')
  const [viewMode, setViewMode] = useState<ViewMode>('compact')
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null)
  const selectedRace = useMemo(
    () => selectedRaceId ? (races.find(r => r.id === selectedRaceId) ?? null) : null,
    [selectedRaceId, races]
  )
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(20)
  const startY = useRef(0)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const wishlistRaces    = useRaceStore(s => s.wishlistRaces)
  const removeFromWishlist = useRaceStore(s => s.removeFromWishlist)
  const moveToUpcoming   = useRaceStore(s => s.moveToUpcoming)

  const pbMap = useMemo(() => buildPBMap(races), [races])

  // Debounce search input 150ms
  function onSearchChange(val: string) {
    setSearch(val)
    clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => setDebouncedSearch(val), 150)
  }

  const filtered = useMemo(() => {
    let result = yearFilter === 'all' ? races : races.filter(r => r.date.startsWith(yearFilter))
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase()
      result = result.filter(r =>
        r.name?.toLowerCase().includes(q) ||
        r.city?.toLowerCase().includes(q) ||
        r.country?.toLowerCase().includes(q)
      )
    }
    return result
  }, [races, yearFilter, debouncedSearch])

  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date))

  function onTouchStart(e: React.TouchEvent) {
    startY.current = e.touches[0].clientY
  }
  function onTouchEnd(e: React.TouchEvent) {
    const dy = e.changedTouches[0].clientY - startY.current
    if (dy < -50) setExpanded(true)
    else if (dy > 50) setExpanded(false)
  }

  const showWishlist = viewMode === 'wishlist'

  return (
    <div
      className={`races-sheet${expanded ? ' expanded' : ''}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Handle */}
      <div className="races-sheet-handle" onClick={() => setExpanded(e => !e)} />

      {/* Action bar — primary CTAs always visible at top of sheet */}
      <div className="races-sheet-footer races-sheet-actions">
        <button
          style={{
            flex: 1, background: 'var(--orange)', color: 'var(--black)',
            border: 'none', borderRadius: 'var(--radius-md)', padding: '0.8rem',
            fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)',
            letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(232,78,27,0.35)',
            transition: 'box-shadow 0.18s, transform 0.18s',
          }}
          onClick={onAddRace}
        >
          + Log Race
        </button>
        <button
          style={{
            background: 'transparent', color: 'var(--muted)',
            border: '1px solid var(--border2)', borderRadius: 'var(--radius-md)', padding: '0.8rem',
            fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-xs)',
            letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}
          onClick={onImportRace}
        >
          ↓ Import
        </button>
        <button
          style={{
            background: 'transparent', color: 'var(--muted)',
            border: '1px solid var(--border2)', borderRadius: 'var(--radius-md)', padding: '0.8rem',
            fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-xs)',
            letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}
          onClick={onDiscover}
        >
          Discover
        </button>
        <button
          className="passport-dossier-btn"
          onClick={() => onOpenPassport(yearFilter)}
          title="Export Race Log Passport"
        >
          DOSSIER
        </button>
      </div>

      {/* Top bar: mode tabs + year filter (hidden in wishlist mode) + view toggle */}
      <div className="races-sheet-top">
        {!showWishlist && (
          <YearTabs races={races} active={yearFilter} onChange={y => { setYearFilter(y); setVisibleCount(20) }} />
        )}
        {showWishlist && (
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--orange)', padding: '0 4px', display: 'flex', alignItems: 'center' }}>
            ♡ WISHLIST · {wishlistRaces.length}
          </div>
        )}
        <div className="races-view-toggle">
          <button
            className={`races-view-btn${viewMode === 'compact' ? ' active' : ''}`}
            onClick={() => setViewMode('compact')}
            title="Compact"
          >≡</button>
          <button
            className={`races-view-btn${viewMode === 'detailed' ? ' active' : ''}`}
            onClick={() => setViewMode('detailed')}
            title="Detailed"
          >▤</button>
          <button
            className={`races-view-btn${viewMode === 'wishlist' ? ' active' : ''}`}
            onClick={() => setViewMode(v => v === 'wishlist' ? 'compact' : 'wishlist')}
            title="Wishlist"
            style={viewMode === 'wishlist' ? { color: 'var(--orange)' } : undefined}
          >♡</button>
        </div>
      </div>

      {/* Stats strip — scoped to the active year filter */}
      {!showWishlist && <StatsStrip races={filtered} />}

      {/* Search bar — below stats, above list (hidden in wishlist mode) */}
      {!showWishlist && (
        <div style={{ padding: '0 12px 6px', position: 'relative' }}>
          <input
            type="search"
            placeholder="Search races, cities, countries…"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--surface3)',
              border: '1px solid var(--border2)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--white)',
              fontSize: 'var(--text-sm)',
              padding: '7px 30px 7px 10px',
              fontFamily: 'var(--body)',
              outline: 'none',
            }}
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setDebouncedSearch('') }}
              style={{
                position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer',
                fontSize: 'var(--text-compact)', padding: 0, lineHeight: 1,
              }}
              aria-label="Clear search"
            >✕</button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="races-sheet-list">
        {showWishlist ? (
          wishlistRaces.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <div style={{ fontSize: '28px' }}>♡</div>
              <div style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', fontFamily: 'var(--headline)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Races you&rsquo;re dreaming of
              </div>
              <div style={{ color: 'var(--muted2)', fontSize: 'var(--text-xs)', fontFamily: 'var(--body)' }}>
                Add races while logging to save them here.
              </div>
            </div>
          ) : (
            wishlistRaces.map(r => (
              <WishlistRow
                key={r.id}
                race={r}
                onPlan={() => moveToUpcoming(r.id)}
                onRemove={() => removeFromWishlist(r.id)}
              />
            ))
          )
        ) : sorted.length === 0 ? (
          races.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-3)', padding: '2rem 1rem' }}>
              <div style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', fontFamily: 'var(--headline)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                No races yet
              </div>
              <button
                onClick={onImportRace}
                style={{ background: 'var(--surface3)', color: 'var(--white)', border: '1px solid rgba(var(--orange-ch),0.35)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-3) var(--sp-4)', fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 'var(--text-xs)', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                ↓ Import your results
              </button>
            </div>
          ) : (
            <div style={{
              textAlign: 'center', padding: '2rem 1rem',
              color: 'var(--muted)', fontSize: 'var(--text-sm)',
              fontFamily: 'var(--headline)', letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              No races in this year
            </div>
          )
        ) : viewMode === 'compact' ? (
          <>
            {(() => {
              const visible = sorted.slice(0, visibleCount)
              let lastYear = ''
              return visible.map(r => {
                const yr = r.date.slice(0, 4)
                const showDivider = yearFilter === 'all' && yr !== lastYear
                lastYear = yr
                return (
                  <div key={r.id}>
                    {showDivider && <YearDivider year={yr} />}
                    <CompactRow race={r} isPB={pbMap[normKey(r.distance)]?.id === r.id} onClick={() => { setSelectedRaceId(r.id); setExpanded(true) }} />
                  </div>
                )
              })
            })()}
            {sorted.length > visibleCount && (
              <button
                onClick={() => setVisibleCount(c => c + 20)}
                style={{ width: '100%', padding: 'var(--sp-3)', background: 'none', border: 'none', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-xs)', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Show more ({sorted.length - visibleCount} remaining)
              </button>
            )}
          </>
        ) : (
          <>
            {(() => {
              const visible = sorted.slice(0, visibleCount)
              let lastYear = ''
              return visible.map(r => {
                const yr = r.date.slice(0, 4)
                const showDivider = yearFilter === 'all' && yr !== lastYear
                lastYear = yr
                return (
                  <div key={r.id}>
                    {showDivider && <YearDivider year={yr} />}
                    <DetailedRow race={r} isPB={pbMap[normKey(r.distance)]?.id === r.id} onClick={() => { setSelectedRaceId(r.id); setExpanded(true) }} />
                  </div>
                )
              })
            })()}
            {sorted.length > visibleCount && (
              <button
                onClick={() => setVisibleCount(c => c + 20)}
                style={{ width: '100%', padding: 'var(--sp-3)', background: 'none', border: 'none', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-xs)', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Show more ({sorted.length - visibleCount} remaining)
              </button>
            )}
          </>
        )}
      </div>

      {/* Race detail / edit modal */}
      {selectedRace && (
        <ViewEditRaceModal
          race={selectedRace}
          onClose={() => setSelectedRaceId(null)}
        />
      )}
    </div>
  )
}

// ── Map cities pill ───────────────────────────────────────────────────────────
// Floating overlay on the Races map — shows distinct-city count and expands
// to a scrollable list. Tap a city row to fly the map to its first race.

type CityEntry = { city: string; country: string; count: number; lat?: number; lng?: number }

function MapCitiesPill({
  races,
  onFlyTo,
}: {
  races: Race[]
  onFlyTo: (lng: number, lat: number) => void
}) {
  const [open, setOpen] = useState(false)
  const cities = useMemo<CityEntry[]>(() => {
    // Local alias avoids shadowing react-map-gl/maplibre `Map` import
    const CityMap = globalThis.Map as MapConstructor
    const m: Map<string, CityEntry> = new CityMap()
    // Normalize key so "Ras al-Khaimah" and "Ras Al Khaimah" collapse to one
    const normKey = (s: string) => s.trim().toLowerCase().replace(/[-_\s]+/g, ' ')
    races.forEach(r => {
      if (!r.city?.trim()) return
      const key = `${normKey(r.city)}|${normKey(r.country || '')}`
      const cur = m.get(key)
      if (!cur) {
        m.set(key, {
          city: r.city.trim(),
          country: r.country || '',
          count: 1,
          lat: r.lat ?? undefined,
          lng: r.lng ?? undefined,
        })
      } else {
        cur.count += 1
        if (cur.lat == null && r.lat != null) cur.lat = r.lat
        if (cur.lng == null && r.lng != null) cur.lng = r.lng
      }
    })
    return [...m.values()].sort((a, b) => b.count - a.count || a.city.localeCompare(b.city))
  }, [races])

  if (cities.length === 0) return null

  return (
    <div className={`map-cities-pill${open ? ' open' : ''}`} role="region" aria-label="Cities raced">
      <button
        type="button"
        className="map-cities-pill-btn"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="map-cities-pill-val">{cities.length}</span>
        <span className="map-cities-pill-label">{cities.length === 1 ? 'CITY' : 'CITIES'}</span>
        <span className="map-cities-pill-caret" aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <ul className="map-cities-pill-list">
          {cities.map(c => {
            const hasGeo = c.lat != null && c.lng != null
            return (
              <li key={`${c.city}|${c.country}`}>
                <button
                  type="button"
                  className="map-cities-pill-row"
                  disabled={!hasGeo}
                  onClick={() => hasGeo && onFlyTo(c.lng!, c.lat!)}
                >
                  <span className="map-cities-pill-city">{c.city}</span>
                  {c.country && <span className="map-cities-pill-country">{c.country}</span>}
                  <span className="map-cities-pill-count">{c.count}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function Races() {
  const races = useRaceStore(s => s.races)
  const updateRace = useRaceStore(s => s.updateRace)
  const athlete = useAthleteStore(s => s.athlete)
  const { user } = useUser()
  const navigate = useNavigate()
  const [viewState, setViewState] = useState(INITIAL_VIEW)
  const mapRef = useRef<MapRef>(null)
  const [addRaceOpen, setAddRaceOpen]     = useState(false)
  const [importOpen, setImportOpen]       = useState(false)
  const [pickerOpen, setPickerOpen]       = useState(false)
  const [passportOpen, setPassportOpen]   = useState(false)
  const [passportYear, setPassportYear]   = useState<string>('all')

  // Track page view on mount
  useEffect(() => { posthog.capture('page_viewed', { page: 'races' }) }, [])

  // One-time normalization pass — collapse admin labels into canonical
  // city names ("Dubai Emirate" → "Dubai", "Mumbai Suburban" → "Mumbai").
  // Clearing lat/lng forces the geocode backfill to re-resolve under the
  // new key, replacing any stale coord. Runs whenever races change so
  // imports / future legacy data also get normalized.
  useEffect(() => {
    races.forEach(r => {
      if (!r.city) return
      const norm = normalizeCityName(r.city)
      if (norm && norm !== r.city) {
        updateRace(r.id, { city: norm, lat: undefined, lng: undefined })
      }
    })
  }, [races, updateRace])

  // Backfill missing lat/lng for races with a city — geocodes via Open-Meteo,
  // caches to localStorage, and persists the coord on the race so the pin
  // shows up immediately next visit. Rate-limited (500 ms between calls).
  useEffect(() => {
    const missing = races.filter(
      r => r.city?.trim() && (r.lat == null || r.lng == null)
    )
    if (missing.length === 0) return
    let cancelled = false
    ;(async () => {
      for (const r of missing) {
        if (cancelled) return
        const res = await geocodeCity(r.city!, r.country || undefined)
        if (cancelled) return
        if (res) updateRace(r.id, { lat: res.lat, lng: res.lng })
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    })()
    return () => { cancelled = true }
  }, [races, updateRace])

  // Fly-to bounds when races load
  useEffect(() => {
    const geoRaces = races.filter(r => r.lat != null && r.lng != null)
    if (geoRaces.length === 0 || !mapRef.current) return
    const lngs = geoRaces.map(r => r.lng!)
    const lats = geoRaces.map(r => r.lat!)
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ]
    mapRef.current.fitBounds(bounds, { padding: 80, maxZoom: 8, duration: 800 })
  }, [races.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const geoRaces = races.filter(r => r.lat != null && r.lng != null)

  return (
    <div id="page-races">
      {/* Map fills viewport — wrapped in error boundary for WebGL/CSP failures */}
      <MapErrorBoundary>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={e => setViewState(e.viewState)}
        mapStyle={CARTO_DARK}
        style={{ position: 'absolute', inset: 0 }}
        aria-label={`Race map showing ${races.length} races`}
      >
        {/* Race location pin markers */}
        {geoRaces.map(r => (
          <Marker
            key={r.id}
            longitude={r.lng!}
            latitude={r.lat!}
            anchor="center"
          >
            <div
              title={`${r.name} · ${r.city}`}
              style={{
                width: '10px',
                height: '10px',
                borderRadius: 'var(--radius-round)',
                background: '#E84E1B',
                border: '2px solid rgba(245,245,245,0.5)',
                boxShadow: '0 0 6px rgba(232,78,27,0.6)',
                cursor: 'pointer',
              }}
            />
          </Marker>
        ))}
      </Map>
      </MapErrorBoundary>

      {/* Floating city count + list overlay */}
      <MapCitiesPill
        races={races}
        onFlyTo={(lng, lat) => mapRef.current?.flyTo({ center: [lng, lat], zoom: 8, duration: 900 })}
      />

      {/* Bottom sheet */}
      <RacesSheet races={races} onAddRace={() => { setAddRaceOpen(true); posthog.capture('modal_opened', { modal: 'add_race', source: 'races' }) }} onImportRace={() => { setImportOpen(true); posthog.capture('modal_opened', { modal: 'import_race' }) }} onOpenPassport={(y) => { setPassportYear(y); setPassportOpen(true) }} onDiscover={() => navigate('/discover')} />

      {addRaceOpen  && <AddRaceModal     onClose={() => setAddRaceOpen(false)} />}
      {importOpen   && <RaceImportModal  onClose={() => setImportOpen(false)} onPickByRace={() => { setImportOpen(false); setPickerOpen(true) }} onAddManual={() => { setImportOpen(false); setAddRaceOpen(true); posthog.capture('modal_opened', { modal: 'add_race', source: 'import_no_results' }) }} />}
      {pickerOpen   && <IronmanRacePicker onClose={() => setPickerOpen(false)} />}

      {passportOpen && (
        <RaceLogPassport
          races={races}
          athlete={athlete ?? undefined}
          initialYear={passportYear}
          avatarUrl={user?.imageUrl ?? null}
          onClose={() => setPassportOpen(false)}
        />

      )}
    </div>
  )
}

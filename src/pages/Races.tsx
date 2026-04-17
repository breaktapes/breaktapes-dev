/**
 * Races page — full-viewport MapLibre map with race location pin markers
 * and a drag-able bottom sheet listing race history.
 *
 * The map uses CartoDB Dark Matter (no API key required).
 * Pin markers only — no arc routes between races.
 */
import { useRef, useState, useMemo, useEffect, Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import Map, { Marker } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useRaceStore } from '@/stores/useRaceStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { ViewEditRaceModal } from '@/components/ViewEditRaceModal'
import { AddRaceModal } from '@/components/AddRaceModal'
import { RaceLogPassport } from '@/components/RaceLogPassport'
import type { Race } from '@/types'
import { useUnits, distUnit } from '@/lib/units'

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
          fontFamily: 'var(--body)', fontSize: '14px', textAlign: 'center', padding: '2rem',
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

function buildPBMap(races: Race[]): Record<string, Race> {
  const pb: Record<string, Race> = {}
  for (const r of races) {
    if (!r.time || !r.distance) continue
    const secs = timeToSecs(r.time)
    if (secs == null) continue
    if (!pb[r.distance] || timeToSecs(pb[r.distance].time!)! > secs) {
      pb[r.distance] = r
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

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: '2-digit' })
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
  const km = races.reduce((s, r) => s + (parseFloat(r.distance) || 0), 0)
  const totalDist = Math.round(units === 'imperial' ? km * 0.621371 : km)
  const countries = new Set(races.map(r => r.country).filter(Boolean)).size
  const medals = races.filter(r => r.medal).length

  const stats = [
    { val: races.length, label: 'RACES' },
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

  return (
    <div className={`race-row-compact${isPB ? ' is-pb' : ''}`} onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className={`rrc-date-chip${isPB ? ' is-pb' : ''}`}>
        <div className="rrc-date-chip-mon">{mon}</div>
        <div className="rrc-date-chip-day">{day}</div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="rrc-name">{race.name}</div>
        {city && <div className="rrc-meta">{city}</div>}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div className="rrc-time">{race.time ?? '—'}</div>
        <div className="rrc-dist">{race.distance}</div>
      </div>
    </div>
  )
}

// ── Detailed race row ─────────────────────────────────────────────────────────

function DetailedRow({ race, isPB, onClick }: { race: Race; isPB: boolean; onClick: () => void }) {
  const medalColors: Record<string, string> = {
    gold:     'rgba(255,215,112,0.9)',
    silver:   'rgba(200,212,220,0.9)',
    bronze:   'rgba(205,140,90,0.9)',
    finisher: 'var(--orange)',
  }

  return (
    <div className="race-row-detailed" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--headline)', fontWeight: 800, fontSize: '14px',
            color: 'var(--white)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {race.name}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
            {[race.city, race.country].filter(Boolean).join(', ')} · {race.distance} · {fmtDate(race.date)}
          </div>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{
            fontFamily: 'var(--headline)', fontWeight: 800, fontSize: '15px',
            color: isPB ? 'var(--green)' : 'var(--white)',
          }}>
            {race.time ?? '—'}
          </div>
          {isPB && (
            <div style={{
              fontSize: '9px', fontFamily: 'var(--headline)', fontWeight: 800,
              color: 'var(--green)', letterSpacing: '0.1em',
            }}>PB</div>
          )}
        </div>
      </div>
      {(race.placing || race.medal || race.sport) && (
        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          {race.placing && (
            <span style={{ fontSize: '10px', color: 'var(--muted)', background: 'var(--surface3)', padding: '2px 6px', borderRadius: '4px' }}>
              {race.placing}
            </span>
          )}
          {race.medal && (
            <span style={{ fontSize: '10px', color: medalColors[race.medal] ?? 'var(--orange)', background: 'var(--surface3)', padding: '2px 6px', borderRadius: '4px' }}>
              {race.medal.toUpperCase()}
            </span>
          )}
          {race.sport && (
            <span style={{ fontSize: '10px', color: 'var(--muted)', background: 'var(--surface3)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
              {race.sport}
            </span>
          )}
        </div>
      )}
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
      gap: '10px',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: '14px', color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {race.name}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
          {[race.distance ? `${race.distance} km` : null, race.city, race.country].filter(Boolean).join(' · ')}
        </div>
        {race.date && (
          <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
            {new Date(race.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button
          onClick={onPlan}
          style={{ background: 'rgba(var(--green-ch),0.12)', border: '1px solid rgba(var(--green-ch),0.3)', color: 'var(--green)', borderRadius: '6px', padding: '5px 10px', fontFamily: 'var(--headline)', fontWeight: 800, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}
        >
          PLAN
        </button>
        <button
          onClick={onRemove}
          style={{ background: 'transparent', border: '1px solid var(--border2)', color: 'var(--muted)', borderRadius: '6px', padding: '5px 8px', fontSize: '13px', cursor: 'pointer' }}
          aria-label="Remove from wishlist"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// ── Races sheet ───────────────────────────────────────────────────────────────

type ViewMode = 'compact' | 'detailed' | 'wishlist'

function RacesSheet({ races, onAddRace, onOpenPassport }: { races: Race[]; onAddRace: () => void; onOpenPassport: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [yearFilter, setYearFilter] = useState('all')
  const [viewMode, setViewMode] = useState<ViewMode>('compact')
  const [selectedRace, setSelectedRace] = useState<Race | null>(null)
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

      {/* Search bar (hidden in wishlist mode) */}
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
              borderRadius: '6px',
              color: 'var(--white)',
              fontSize: '13px',
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
                fontSize: '14px', padding: 0, lineHeight: 1,
              }}
              aria-label="Clear search"
            >✕</button>
          )}
        </div>
      )}

      {/* Top bar: mode tabs + year filter (hidden in wishlist mode) + view toggle */}
      <div className="races-sheet-top">
        {!showWishlist && (
          <YearTabs races={races} active={yearFilter} onChange={y => { setYearFilter(y); setVisibleCount(20) }} />
        )}
        {showWishlist && (
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--orange)', padding: '0 4px', display: 'flex', alignItems: 'center' }}>
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

      {/* Stats strip — only for race history */}
      {!showWishlist && <StatsStrip races={races} />}

      {/* Content */}
      <div className="races-sheet-list">
        {showWishlist ? (
          wishlistRaces.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ fontSize: '28px' }}>♡</div>
              <div style={{ color: 'var(--muted)', fontSize: '13px', fontFamily: 'var(--headline)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Races you&rsquo;re dreaming of
              </div>
              <div style={{ color: 'var(--muted2)', fontSize: '12px', fontFamily: 'var(--body)' }}>
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
          <div style={{
            textAlign: 'center', padding: '2rem 1rem',
            color: 'var(--muted)', fontSize: '13px',
            fontFamily: 'var(--headline)', letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            {races.length === 0 ? 'No races yet — log your first one' : 'No races in this year'}
          </div>
        ) : viewMode === 'compact' ? (
          <>
            {sorted.slice(0, visibleCount).map(r => (
              <CompactRow key={r.id} race={r} isPB={pbMap[r.distance]?.id === r.id} onClick={() => setSelectedRace(r)} />
            ))}
            {sorted.length > visibleCount && (
              <button
                onClick={() => setVisibleCount(c => c + 20)}
                style={{ width: '100%', padding: '10px', background: 'none', border: 'none', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Show more ({sorted.length - visibleCount} remaining)
              </button>
            )}
          </>
        ) : (
          <>
            {sorted.slice(0, visibleCount).map(r => (
              <DetailedRow key={r.id} race={r} isPB={pbMap[r.distance]?.id === r.id} onClick={() => setSelectedRace(r)} />
            ))}
            {sorted.length > visibleCount && (
              <button
                onClick={() => setVisibleCount(c => c + 20)}
                style={{ width: '100%', padding: '10px', background: 'none', border: 'none', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Show more ({sorted.length - visibleCount} remaining)
              </button>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="races-sheet-footer">
        <button
          style={{
            flex: 1, background: 'var(--orange)', color: 'var(--black)',
            border: 'none', borderRadius: '8px', padding: '0.8rem',
            fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '13px',
            letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(232,78,27,0.35)',
            transition: 'box-shadow 0.18s, transform 0.18s',
          }}
          onClick={onAddRace}
        >
          + Log Race
        </button>
        <button
          className="passport-dossier-btn"
          onClick={onOpenPassport}
          title="Export Race Log Passport"
        >
          ⬛ DOSSIER
        </button>
      </div>

      {/* Race detail / edit modal */}
      {selectedRace && (
        <ViewEditRaceModal
          race={selectedRace}
          onClose={() => setSelectedRace(null)}
        />
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function Races() {
  const races = useRaceStore(s => s.races)
  const athlete = useAthleteStore(s => s.athlete)
  const [viewState, setViewState] = useState(INITIAL_VIEW)
  const mapRef = useRef<MapRef>(null)
  const [addRaceOpen, setAddRaceOpen] = useState(false)
  const [passportOpen, setPassportOpen] = useState(false)

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
                borderRadius: '50%',
                background: 'var(--orange)',
                border: '2px solid rgba(245,245,245,0.5)',
                boxShadow: '0 0 6px rgba(var(--orange-ch),0.6)',
                cursor: 'pointer',
              }}
            />
          </Marker>
        ))}
      </Map>
      </MapErrorBoundary>

      {/* Bottom sheet */}
      <RacesSheet races={races} onAddRace={() => setAddRaceOpen(true)} onOpenPassport={() => setPassportOpen(true)} />

      {addRaceOpen && <AddRaceModal onClose={() => setAddRaceOpen(false)} />}

      {passportOpen && (
        <RaceLogPassport
          races={races}
          athlete={athlete ?? undefined}
          onClose={() => setPassportOpen(false)}
        />

      )}
    </div>
  )
}

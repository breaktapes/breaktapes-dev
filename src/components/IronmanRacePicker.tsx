import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRaceStore } from '@/stores/useRaceStore'
import { useRaceCatalog, type CatalogRace } from '@/hooks/useRaceCatalog'
import { posthog } from '@/lib/posthog'
import type { Race, Split } from '@/types'

const HEALTH_PROXY = 'https://health.breaktapes.com'

type Step = 'pick' | 'find' | 'confirm'

interface EventResult {
  athlete: string
  firstName?: string
  lastName?: string
  city?: string
  country?: string
  agLabel?: string
  time?: string
  placing?: string
  genderPlacing?: string
  agPlacing?: string
  outcome?: string
  bibNumber?: string
  splits?: Split[]
}

// Distance label from the catalog dist field / dist_km for the saved race.
function distLabel(r: CatalogRace): string {
  if (r.dist) return r.dist
  const km = r.dist_km ?? 0
  if (Math.abs(km - 226) < 1) return 'IRONMAN'
  if (Math.abs(km - 113) < 1) return '70.3'
  if (Math.abs(km - 51.5) < 1) return 'Olympic'
  return km ? `${km}KM` : ''
}

// "2025 IRONMAN 70.3 Victoria" → year shown separately; keep full name on save.
function catalogYear(r: CatalogRace): string {
  if (r.year) return String(r.year)
  const m = r.name.match(/\b(19|20)\d{2}\b/)
  return m ? m[0] : ''
}

function catalogDate(r: CatalogRace): string {
  if (r.year && r.month && r.day) {
    return `${r.year}-${String(r.month).padStart(2, '0')}-${String(r.day).padStart(2, '0')}`
  }
  return ''
}

export function IronmanRacePicker({ onClose }: { onClose: () => void }) {
  const addRace        = useRaceStore(s => s.addRace)
  const existingRaces  = useRaceStore(s => s.races)
  const upcomingRaces  = useRaceStore(s => s.upcomingRaces)
  const { data: catalog = [], isLoading: catalogLoading } = useRaceCatalog()

  const [step, setStep]           = useState<Step>('pick')
  const [query, setQuery]         = useState('')
  const [picked, setPicked]       = useState<CatalogRace | null>(null)
  const [fetching, setFetching]   = useState(false)
  const [results, setResults]     = useState<EventResult[]>([])
  const [nameFilter, setNameFilter] = useState('')
  const [error, setError]         = useState('')

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Only catalog rows that carry a competitor event id are pickable.
  const pickable = useMemo(
    () => catalog.filter(r => r.competitor_event_id),
    [catalog],
  )

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return pickable
      .filter(r => r.name.toLowerCase().includes(q))
      .slice(0, 40)
  }, [pickable, query])

  async function pickRace(r: CatalogRace) {
    if (!r.competitor_event_id) return
    setPicked(r)
    setStep('find')
    setFetching(true)
    setError('')
    setResults([])
    try {
      const resp = await fetch(`${HEALTH_PROXY}/import/ironman-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: r.competitor_event_id }),
      })
      const data = await resp.json()
      if (data.status !== 'ok') throw new Error(data.message || 'Failed to load results')
      const rows = data.results ?? []
      setResults(rows)
      posthog.capture('race import results shown', { total_results: rows.length, has_results: rows.length > 0, provider_counts: { ironman: rows.length }, providers_errored: [] })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load results')
    } finally {
      setFetching(false)
    }
  }

  const filteredResults = useMemo(() => {
    const q = nameFilter.trim().toLowerCase()
    if (!q) return results.slice(0, 50)
    return results.filter(r => r.athlete.toLowerCase().includes(q)).slice(0, 50)
  }, [results, nameFilter])

  function saveResult(res: EventResult) {
    if (!picked) return
    const date = catalogDate(picked)
    // Dedupe: same date already logged
    const dupe = (date && (existingRaces.some(e => e.date === date) || upcomingRaces.some(e => e.date === date)))
    const race: Race = {
      id:      crypto.randomUUID(),
      name:    picked.name,
      date:    date || new Date().toISOString().split('T')[0],
      time:    res.time || undefined,
      distance: distLabel(picked),
      sport:   'Triathlon',
      city:    res.city || picked.city || '',
      country: res.country || picked.country || '',
      ...(res.splits && res.splits.length ? { splits: res.splits } : {}),
      ...(res.agLabel       ? { agLabel: res.agLabel }             : {}),
      ...(res.placing       ? { placing: res.placing }             : {}),
      ...(res.genderPlacing ? { genderPlacing: res.genderPlacing } : {}),
      ...(res.agPlacing     ? { agPlacing: res.agPlacing }         : {}),
      ...(res.outcome       ? { outcome: res.outcome }             : {}),
      ...(res.bibNumber     ? { bibNumber: res.bibNumber }         : {}),
    }
    if (dupe) { setError('A race on this date is already logged.'); return }
    posthog.capture('race import row selected', { source: 'ironman', was_auto: false })
    addRace(race)
    posthog.capture('race import completed', { imported_count: 1, source: 'ironman-picker' })
    onClose()
  }

  return createPortal(
    <div style={st.overlay} onClick={onClose}>
      <div role="dialog" aria-modal="true" style={st.sheet} onClick={e => e.stopPropagation()}>
        <div style={st.handle} />
        <div style={st.header}>
          <span style={st.title}>
            {step === 'pick' ? 'PICK AN IRONMAN RACE' : step === 'find' ? 'FIND YOUR RESULT' : 'CONFIRM'}
          </span>
          <button style={st.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div style={st.body}>
          {/* STEP 1 — pick a race from the catalog */}
          {step === 'pick' && (
            <>
              <p style={st.hint}>Search IRONMAN &amp; 70.3 races. Pick yours, then find your result with official splits.</p>
              <input
                style={st.input}
                placeholder="e.g. Victoria, Kona, Frankfurt…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoFocus
              />
              {catalogLoading && <p style={st.muted}>Loading race catalog…</p>}
              {!catalogLoading && pickable.length === 0 && (
                <p style={st.muted}>No IRONMAN races in the catalog yet.</p>
              )}
              {query.trim().length >= 2 && matches.length === 0 && !catalogLoading && (
                <p style={st.muted}>No matching races.</p>
              )}
              {matches.map(r => (
                <button key={r.id} style={st.row} onClick={() => pickRace(r)} type="button">
                  <div style={{ minWidth: 0 }}>
                    <p style={st.rowName}>{r.name}</p>
                    <p style={st.rowMeta}>
                      {distLabel(r)}{catalogYear(r) ? ` · ${catalogYear(r)}` : ''}{r.city ? ` · ${r.city}` : ''}
                    </p>
                  </div>
                  <span style={st.chev}>›</span>
                </button>
              ))}
            </>
          )}

          {/* STEP 2 — find yourself in the event results */}
          {step === 'find' && picked && (
            <>
              <p style={st.hint}>{picked.name}</p>
              {fetching && <p style={st.muted}>Loading {results.length ? '' : 'results'}… one moment.</p>}
              {error && <p style={st.errorText}>{error}</p>}
              {!fetching && !error && (
                <>
                  <input
                    style={st.input}
                    placeholder="Type your name to find your result…"
                    value={nameFilter}
                    onChange={e => setNameFilter(e.target.value)}
                    autoFocus
                  />
                  <p style={st.muted}>{results.length} finishers · showing {filteredResults.length}</p>
                  {filteredResults.map((res, i) => (
                    <button key={i} style={st.row} onClick={() => saveResult(res)} type="button">
                      <div style={{ minWidth: 0 }}>
                        <p style={st.rowName}>{res.athlete}</p>
                        <p style={st.rowMeta}>
                          {res.agLabel || '—'}{res.placing ? ` · Overall #${res.placing}` : ''}{res.outcome && res.outcome !== 'Finished' ? ` · ${res.outcome}` : ''}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {res.time && <div style={st.rowTime}>{res.time}</div>}
                        {(res.splits?.length ?? 0) > 0 && <div style={st.rowMeta}>{res.splits!.length} splits</div>}
                      </div>
                    </button>
                  ))}
                </>
              )}
              <button style={st.cancelBtn} onClick={() => { setStep('pick'); setResults([]); setNameFilter(''); setError(''); }} type="button">← BACK</button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

const st = {
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 960, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' } as React.CSSProperties,
  sheet:     { width: '100%', maxWidth: '680px', maxHeight: '85dvh', background: 'var(--surface2)', borderTop: '2px solid var(--orange)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' } as React.CSSProperties,
  handle:    { width: '36px', height: '4px', background: 'var(--border2)', borderRadius: 'var(--radius-xs)', margin: '12px auto 0', flexShrink: 0 } as React.CSSProperties,
  header:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 0', flexShrink: 0 } as React.CSSProperties,
  title:     { fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-lg)', letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'var(--white)' } as React.CSSProperties,
  closeBtn:  { background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 'var(--text-md)', cursor: 'pointer', padding: '4px 8px', lineHeight: 1 } as React.CSSProperties,
  body:      { padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', flex: 1, paddingBottom: 'calc(var(--safe-bottom) + 32px)' } as React.CSSProperties,
  hint:      { margin: 0, fontSize: 'var(--text-sm)', color: 'var(--muted)', fontFamily: 'var(--body)' } as React.CSSProperties,
  muted:     { margin: 0, fontSize: 'var(--text-xs)', color: 'var(--muted2)', fontFamily: 'var(--body)' } as React.CSSProperties,
  input:     { width: '100%', background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--white)', fontSize: 'var(--text-compact)', padding: '0.6rem 0.75rem', fontFamily: 'var(--body)', boxSizing: 'border-box' as const, minWidth: 0 } as React.CSSProperties,
  row:       { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-2)', background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-3)', cursor: 'pointer', textAlign: 'left' as const } as React.CSSProperties,
  rowName:   { margin: 0, fontWeight: 600, fontSize: 'var(--text-compact)', color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } as React.CSSProperties,
  rowMeta:   { margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--muted2)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const } as React.CSSProperties,
  rowTime:   { fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 'var(--text-base)', color: 'var(--orange)', letterSpacing: '0.02em', lineHeight: 1 } as React.CSSProperties,
  chev:      { color: 'var(--muted)', fontSize: 'var(--text-lg)', flexShrink: 0 } as React.CSSProperties,
  cancelBtn: { background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-3)', fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-compact)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, cursor: 'pointer', width: '100%', marginTop: 'var(--sp-2)' } as React.CSSProperties,
  errorText: { margin: 0, fontSize: 'var(--text-xs)', color: 'var(--error)' } as React.CSSProperties,
}

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRaceStore } from '@/stores/useRaceStore'
import { parseDistKm } from '@/lib/raceFormulas'
import type { Race } from '@/types'

const HEALTH_PROXY = 'https://health.breaktapes.com'

type Step = 'search' | 'results'

interface ImportResult {
  raceName: string
  date: string
  time?: string
  source: 'ultrasignup' | 'marathonview'
  raw?: string[]
}

function kmToDistLabel(km: number): string {
  if (km <= 0) return ''
  if (Math.abs(km - 42.195) < 0.1) return 'Marathon'
  if (Math.abs(km - 21.0975) < 0.1) return 'Half Marathon'
  if (Math.abs(km - 226) < 1) return 'IRONMAN'
  if (Math.abs(km - 113) < 1) return '70.3'
  if (Math.abs(km - 51.5) < 1) return 'Olympic Tri'
  if (Math.abs(km - 5) < 0.1) return '5K'
  if (Math.abs(km - 10) < 0.1) return '10K'
  if (Math.abs(km - 15) < 0.1) return '15K'
  if (Math.abs(km - 50) < 1) return '50K'
  if (Math.abs(km - 100) < 1) return '100K'
  if (Math.abs(km - 80.47) < 1) return '50 Mile'
  if (Math.abs(km - 160.93) < 1) return '100 Mile'
  return `${km}KM`
}

function normalizeDateStr(d: string): string {
  // Convert MM/DD/YYYY → YYYY-MM-DD; leave YYYY-MM-DD as-is
  const mmddyyyy = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mmddyyyy) return `${mmddyyyy[3]}-${mmddyyyy[1].padStart(2,'0')}-${mmddyyyy[2].padStart(2,'0')}`
  return d
}

export function RaceImportModal({ onClose }: { onClose: () => void }) {
  const addRace    = useRaceStore(s => s.addRace)
  const existingRaces = useRaceStore(s => s.races)

  const [step, setStep]               = useState<Step>('search')
  const [firstName, setFirstName]     = useState('')
  const [lastName, setLastName]       = useState('')
  const [searching, setSearching]     = useState(false)
  const [results, setResults]         = useState<ImportResult[]>([])
  const [selected, setSelected]       = useState<Set<number>>(new Set())
  const [importing, setImporting]     = useState(false)
  const [error, setError]             = useState('')
  const [skippedCount, setSkippedCount] = useState(0)
  const [sourceErrors, setSourceErrors] = useState<{ ultrasignup?: boolean; marathonview?: boolean }>({})


  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  async function handleSearch() {
    if (!firstName.trim() && !lastName.trim()) { setError('Enter at least a first or last name'); return }
    setSearching(true); setError(''); setResults([]); setSourceErrors({})

    const [us, mv] = await Promise.allSettled([
      fetch(`${HEALTH_PROXY}/import/ultrasignup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
      }).then(r => r.json()),
      fetch(`${HEALTH_PROXY}/import/marathonview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${firstName.trim()} ${lastName.trim()}`.trim() }),
      }).then(r => r.json()),
    ])

    const all: ImportResult[] = []
    const errs: { ultrasignup?: boolean; marathonview?: boolean } = {}

    if (us.status === 'fulfilled' && us.value.status === 'ok') {
      for (const r of (us.value.results ?? [])) {
        all.push({
          raceName: r.EventName ?? r.event_name ?? r.name ?? 'Unknown Race',
          date:     r.EventDate ?? r.date ?? '',
          time:     r.ChipTime ?? r.time ?? undefined,
          source:   'ultrasignup',
          raw:      Object.values(r).map(String),
        })
      }
    } else if (us.status === 'rejected' || us.value?.status === 'error') {
      errs.ultrasignup = true
    }

    if (mv.status === 'fulfilled' && mv.value.status === 'ok') {
      for (const r of (mv.value.results ?? [])) {
        if (!r.raceName || r.raceName.length < 3) continue
        all.push({ ...r, date: normalizeDateStr(r.date ?? ''), source: 'marathonview' })
      }
    } else if (mv.status === 'rejected' || mv.value?.status === 'error') {
      errs.marathonview = true
    }

    setSourceErrors(errs)
    setResults(all)
    setSearching(false)
    setStep('results')
  }

  function toggleSelect(i: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  async function handleImport() {
    if (selected.size === 0) return
    setImporting(true)
    let skipped = 0
    for (const i of selected) {
      const r = results[i]
      const date = r.date || new Date().toISOString().split('T')[0]
      const isDupe = existingRaces.some(
        ex => ex.name?.toLowerCase() === r.raceName.toLowerCase() && ex.date === date
      )
      if (isDupe) { skipped++; continue }
      const distKm = parseDistKm(r.raceName)
      const distance = kmToDistLabel(distKm)
      const race: Race = {
        id:       crypto.randomUUID(),
        name:     r.raceName,
        date,
        time:     r.time || undefined,
        distance,
        sport:    'Running',
        city:     '',
        country:  '',
      }
      addRace(race)
    }
    setSkippedCount(skipped)
    setImporting(false)
    if (skipped < selected.size) onClose()
  }

  return createPortal(
    <div style={st.overlay} onClick={onClose}>
      <div role="dialog" aria-modal="true" style={st.sheet} onClick={e => e.stopPropagation()}>
        <div style={st.handle} />
        <div style={st.header}>
          <span style={st.title}>
            {step === 'search' ? 'IMPORT RACES' : 'SELECT YOUR RACES'}
          </span>
          <button style={st.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div style={st.body}>
          {step === 'search' && (
            <>
              <p style={st.hint}>Search UltraSignup and MarathonView for races you've run.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={st.fieldLabel}>First Name</label>
                  <input
                    style={st.input}
                    placeholder="Alex"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={st.fieldLabel}>Last Name</label>
                  <input
                    style={st.input}
                    placeholder="Johnson"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <span style={st.sourcePill}>✓ UltraSignup</span>
                <span style={st.sourcePill}>✓ MarathonView</span>
                <span style={st.sourcePill}>✓ Athlinks <span style={{ fontSize: '9px', color: 'var(--muted)', fontWeight: 400, letterSpacing: '0.02em', textTransform: 'none', fontFamily: 'var(--body)' }}>— pending API access</span></span>
              </div>
              {error && <p style={st.errorText}>{error}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
                <button style={st.cancelBtn} onClick={onClose} type="button">CANCEL</button>
                <button
                  className="btn-v3 btn-primary-v3"
                  style={st.saveBtn}
                  onClick={handleSearch}
                  disabled={searching}
                  type="button"
                >
                  {searching ? 'SEARCHING…' : 'SEARCH'}
                </button>
              </div>
            </>
          )}

          {step === 'results' && (
            <>
              {(sourceErrors.ultrasignup || sourceErrors.marathonview) && (
                <div style={{ padding: '8px 12px', background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)', borderRadius: '8px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#ff6b6b' }}>
                    {[sourceErrors.ultrasignup && 'UltraSignup', sourceErrors.marathonview && 'MarathonView'].filter(Boolean).join(' & ')} failed to respond.
                  </p>
                  <button
                    style={{ background: 'none', border: '1px solid rgba(255,107,107,0.4)', color: '#ff6b6b', fontSize: '11px', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.06em', flexShrink: 0 }}
                    onClick={() => { setStep('search'); }}
                    type="button"
                  >
                    RETRY
                  </button>
                </div>
              )}
              {results.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <p style={{ color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 900, letterSpacing: '0.08em', fontSize: '14px' }}>
                    NO RESULTS FOUND
                  </p>
                  <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '8px' }}>
                    Try a different spelling or add your race manually.
                  </p>
                  <button style={{ ...st.cancelBtn, marginTop: '24px' }} onClick={() => setStep('search')}>← BACK</button>
                </div>
              ) : (
                <>
                  <p style={st.hint}>
                    Tap races to select them. Found {results.length} result{results.length !== 1 ? 's' : ''}.
                  </p>
                  {results.map((r, i) => (
                    <button
                      key={i}
                      style={{
                        ...st.resultRow,
                        background: selected.has(i) ? 'rgba(var(--orange-ch),0.1)' : 'var(--surface3)',
                        border: `1px solid ${selected.has(i) ? 'rgba(var(--orange-ch),0.4)' : 'var(--border2)'}`,
                      }}
                      onClick={() => toggleSelect(i)}
                      type="button"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '16px', flexShrink: 0 }}>{selected.has(i) ? '✓' : '○'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.raceName}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                            {[r.date, r.time].filter(Boolean).join(' · ')}
                            <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--muted2)', textTransform: 'uppercase', fontFamily: 'var(--headline)', fontWeight: 700 }}>
                              {r.source}
                            </span>
                          </p>
                          {(() => { const lbl = kmToDistLabel(parseDistKm(r.raceName)); return lbl ? (
                            <p style={{ margin: '2px 0 0', fontSize: '10px', color: 'var(--muted2)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                              {lbl}
                            </p>
                          ) : null })()}
                        </div>
                      </div>
                    </button>
                  ))}
                  {skippedCount > 0 && (
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)', textAlign: 'center' }}>
                      {skippedCount} already logged — skipped.
                    </p>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
                    <button style={st.cancelBtn} onClick={() => setStep('search')} type="button">← BACK</button>
                    <button
                      className="btn-v3 btn-primary-v3"
                      style={st.saveBtn}
                      onClick={handleImport}
                      disabled={selected.size === 0 || importing}
                      type="button"
                    >
                      {importing
                        ? 'IMPORTING…'
                        : `IMPORT ${selected.size > 0 ? selected.size : ''} RACE${selected.size !== 1 ? 'S' : ''}`}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

const st = {
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 960, display: 'flex', alignItems: 'flex-end' } as React.CSSProperties,
  sheet:      { width: '100%', maxHeight: '85vh', background: 'var(--surface2)', borderTop: '2px solid var(--orange)', borderRadius: '16px 16px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' } as React.CSSProperties,
  handle:     { width: '36px', height: '4px', background: 'var(--border2)', borderRadius: '2px', margin: '12px auto 0', flexShrink: 0 } as React.CSSProperties,
  header:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 0', flexShrink: 0 } as React.CSSProperties,
  title:      { fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '20px', letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'var(--white)' } as React.CSSProperties,
  closeBtn:   { background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '18px', cursor: 'pointer', padding: '4px 8px', lineHeight: 1 } as React.CSSProperties,
  body:       { padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', flex: 1, paddingBottom: '32px' } as React.CSSProperties,
  fieldLabel: { fontSize: '11px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--muted)' } as React.CSSProperties,
  input:      { width: '100%', background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: '6px', color: 'var(--white)', fontSize: '14px', padding: '0.6rem 0.75rem', fontFamily: 'var(--body)', boxSizing: 'border-box' as const, minWidth: 0 } as React.CSSProperties,
  hint:       { margin: 0, fontSize: '13px', color: 'var(--muted)', fontFamily: 'var(--body)' } as React.CSSProperties,
  sourcePill: { background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: '20px', padding: '4px 10px', fontSize: '11px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--green)' } as React.CSSProperties,
  resultRow:  { width: '100%', borderRadius: '8px', padding: '12px', cursor: 'pointer', textAlign: 'left' as const, transition: 'background 0.15s' } as React.CSSProperties,
  saveBtn:    { width: '100%', padding: '14px' } as React.CSSProperties,
  cancelBtn:  { background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border2)', borderRadius: '8px', padding: '14px', fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '14px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, cursor: 'pointer', width: '100%' } as React.CSSProperties,
  errorText:  { margin: 0, fontSize: '12px', color: '#ff6b6b' } as React.CSSProperties,
}

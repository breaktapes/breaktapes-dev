import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRaceStore } from '@/stores/useRaceStore'
import { useRaceCatalog, type CatalogRace } from '@/hooks/useRaceCatalog'
import type { Race, Split } from '@/types'

type Mode = 'past' | 'upcoming'

// ─── Sport / Distance / Option config ───────────────────────────────────────

const SPORTS = [
  { id: 'Running',   label: '🏃 Running' },
  { id: 'Cycling',   label: '🚴 Cycling' },
  { id: 'Swimming',  label: '🏊 Swimming' },
  { id: 'Triathlon', label: '🏆 Triathlon' },
  { id: 'HYROX',     label: '💪 HYROX' },
]

const DISTANCES_BY_SPORT: Record<string, { label: string; value: string }[]> = {
  Running: [
    { label: '5KM',           value: '5' },
    { label: '10KM',          value: '10' },
    { label: '10 Mile',       value: '16.09' },
    { label: 'Half Marathon', value: '21.1' },
    { label: 'Marathon',      value: '42.2' },
    { label: '50KM',          value: '50' },
    { label: '50 Mile',       value: '80.47' },
    { label: '100KM',         value: '100' },
    { label: '100 Mile',      value: '160.93' },
    { label: 'Custom...',     value: '__custom__' },
  ],
  Cycling: [
    { label: 'Gran Fondo (100km)', value: '100' },
    { label: 'Century (161km)',    value: '161' },
    { label: 'Randonneuring 200',  value: '200' },
    { label: 'Time Trial',         value: '__tt__' },
    { label: 'Track Cycling',      value: '__track__' },
    { label: 'Custom...',          value: '__custom__' },
  ],
  Swimming: [
    { label: '1KM',      value: '1' },
    { label: '3KM',      value: '3' },
    { label: '5KM',      value: '5' },
    { label: '10KM',     value: '10' },
    { label: '15KM',     value: '15' },
    { label: '25KM',     value: '25' },
    { label: 'Custom...', value: '__custom__' },
  ],
  Triathlon: [
    { label: 'Sprint (25.75km)',  value: '25.75' },
    { label: 'Olympic (51.5km)', value: '51.5' },
    { label: 'Half Iron (113km)', value: '113' },
    { label: 'Full Iron (226km)', value: '226' },
    { label: 'Custom...',         value: '__custom__' },
  ],
  HYROX: [
    { label: 'Solo Open',    value: 'Solo Open' },
    { label: 'Solo Pro',     value: 'Solo Pro' },
    { label: 'Doubles Open', value: 'Doubles Open' },
    { label: 'Doubles Pro',  value: 'Doubles Pro' },
    { label: 'Custom...',    value: '__custom__' },
  ],
}

const CUSTOM_DIST_VALUES = ['__custom__', '__tt__', '__track__']

const RACE_OUTCOMES = [
  { value: 'Finished', label: 'Finished' },
  { value: 'DNF',      label: 'DNF — Did Not Finish' },
  { value: 'DSQ',      label: 'DSQ — Disqualified' },
  { value: 'DNS',      label: 'DNS — Did Not Start' },
]

const RACE_PRIORITIES = [
  { value: '',  label: '— Unset —' },
  { value: 'A', label: '🎯 A Race — Goal Event' },
  { value: 'B', label: '⭐ B Race — Important' },
  { value: 'C', label: '🏃 C Race — Training / Fun' },
]

const MEDALS = [
  { value: '',           label: 'None' },
  { value: 'gold',       label: 'Gold' },
  { value: 'silver',     label: 'Silver' },
  { value: 'bronze',     label: 'Bronze' },
  { value: 'finisher',   label: 'Finisher' },
  { value: '__custom__', label: 'Custom...' },
]

const TRI_SEGMENTS = [
  { label: 'SWIM', emoji: '🏊', key: 'swim' },
  { label: 'T1',   emoji: '⚡', key: 't1' },
  { label: 'BIKE', emoji: '🚴', key: 'bike' },
  { label: 'T2',   emoji: '⚡', key: 't2' },
  { label: 'RUN',  emoji: '🏃', key: 'run' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad2(n: number) { return n.toString().padStart(2, '0') }
function hmsToSecs(h: number, m: number, s: number) { return h * 3600 + m * 60 + s }
function secsToHMS(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.round(secs % 60)
  return `${h}:${pad2(m)}:${pad2(s)}`
}

interface HMS { h: number; m: number; s: number }

// ─── Drum time picker ─────────────────────────────────────────────────────────

function TimePicker({ value, onChange }: { value: HMS; onChange: (v: HMS) => void }) {
  const { h, m, s } = value

  const cell = (val: number, label: string, onUp: () => void, onDown: () => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1 }}>
      <button style={drumBtn} type="button" onClick={onUp} aria-label={`Increase ${label}`}>▲</button>
      <span style={drumNum}>{label === 'HRS' ? val : pad2(val)}</span>
      <button style={drumBtn} type="button" onClick={onDown} aria-label={`Decrease ${label}`}>▼</button>
      <span style={drumLabel}>{label}</span>
    </div>
  )

  return (
    <div style={{ background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: '6px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
      {cell(h, 'HRS',
        () => onChange({ ...value, h: h + 1 }),
        () => onChange({ ...value, h: Math.max(0, h - 1) })
      )}
      <span style={colonStyle}>:</span>
      {cell(m, 'MIN',
        () => onChange({ ...value, m: (m + 1) % 60 }),
        () => onChange({ ...value, m: Math.max(0, m - 1) })
      )}
      <span style={colonStyle}>:</span>
      {cell(s, 'SEC',
        () => onChange({ ...value, s: (s + 1) % 60 }),
        () => onChange({ ...value, s: Math.max(0, s - 1) })
      )}
    </div>
  )
}

// ─── Compact split input for triathlon ────────────────────────────────────────

function SplitInput({ value, onChange }: { value: HMS; onChange: (v: HMS) => void }) {
  const numBox = (val: number, field: keyof HMS, max?: number) => (
    <input
      type="number" min={0} max={max} value={val}
      onChange={e => {
        let v = parseInt(e.target.value, 10)
        if (isNaN(v)) v = 0
        if (max !== undefined) v = Math.min(v, max)
        onChange({ ...value, [field]: Math.max(0, v) })
      }}
      style={{ width: '40px', textAlign: 'center', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: '4px', color: 'var(--white)', fontSize: '18px', fontFamily: 'var(--headline)', fontWeight: 700, padding: '5px 2px', MozAppearance: 'textfield' } as React.CSSProperties}
    />
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {numBox(value.h, 'h')}
      <span style={{ color: 'var(--muted)', fontWeight: 700, fontSize: '16px' }}>:</span>
      {numBox(value.m, 'm', 59)}
      <span style={{ color: 'var(--muted)', fontWeight: 700, fontSize: '16px' }}>:</span>
      {numBox(value.s, 's', 59)}
    </div>
  )
}

// ─── Triathlon splits panel ───────────────────────────────────────────────────

function TriathlonSplits({ splits, onChange }: {
  splits: Record<string, HMS>
  onChange: (key: string, v: HMS) => void
}) {
  const total = TRI_SEGMENTS.reduce((acc, seg) => {
    const t = splits[seg.key] ?? { h: 0, m: 0, s: 0 }
    return acc + hmsToSecs(t.h, t.m, t.s)
  }, 0)

  return (
    <div style={{ background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: '6px', overflow: 'hidden' }}>
      {TRI_SEGMENTS.map((seg, i) => {
        const t = splits[seg.key] ?? { h: 0, m: 0, s: 0 }
        return (
          <div key={seg.key} style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: i < TRI_SEGMENTS.length - 1 ? '1px solid var(--border)' : 'none', gap: '8px' }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>{seg.emoji}</span>
            <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '13px', letterSpacing: '0.08em', color: 'var(--white)', flex: 1 }}>{seg.label}</span>
            <SplitInput value={t} onChange={v => onChange(seg.key, v)} />
          </div>
        )
      })}
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px', borderTop: '1px solid var(--border2)', background: 'rgba(0,255,136,0.05)' }}>
        <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '13px', letterSpacing: '0.1em', color: 'var(--green)', flex: 1 }}>TOTAL</span>
        <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '18px', color: 'var(--green)', letterSpacing: '0.04em' }}>
          {Math.floor(total / 3600)}:{pad2(Math.floor((total % 3600) / 60))}:{pad2(total % 60)}
        </span>
      </div>
    </div>
  )
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
      <label style={st.fieldLabel}>{label}</label>
      {children}
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
  defaultMode?: Mode
}

export function AddRaceModal({ onClose, defaultMode = 'past' }: Props) {
  const [mode, setMode] = useState<Mode>(defaultMode)
  const addRace         = useRaceStore(s => s.addRace)
  const addUpcomingRace = useRaceStore(s => s.addUpcomingRace)
  const pastRaces       = useRaceStore(s => s.races)
  const upcomingRaces   = useRaceStore(s => s.upcomingRaces)
  const { data: catalog = [] } = useRaceCatalog()

  // When parent changes defaultMode (e.g. re-opens), sync
  useEffect(() => { setMode(defaultMode) }, [defaultMode])

  // Autocomplete
  const [query, setQuery]           = useState('')
  const [showSuggest, setShowSuggest] = useState(false)
  const [suggestions, setSuggestions] = useState<{ label: string; source: 'past' | 'catalog'; data?: CatalogRace; myRace?: Race }[]>([])

  // Core fields
  const [name, setName]             = useState('')
  const [sport, setSport]           = useState('Running')
  const [distance, setDistance]     = useState('42.2')
  const [customDist, setCustomDist] = useState('')
  const [outcome, setOutcome]       = useState('Finished')
  const [time, setTime]             = useState<HMS>({ h: 0, m: 0, s: 0 })
  const [triSplits, setTriSplits]   = useState<Record<string, HMS>>({
    swim: { h: 0, m: 0, s: 0 }, t1: { h: 0, m: 0, s: 0 },
    bike: { h: 0, m: 0, s: 0 }, t2: { h: 0, m: 0, s: 0 }, run: { h: 0, m: 0, s: 0 },
  })
  const [priority, setPriority]     = useState('')
  const [country, setCountry]       = useState('')
  const [citySelect, setCitySelect] = useState('')  // dropdown value
  const [cityText, setCityText]     = useState('')  // free-text (when "other" or no catalog)
  const [date, setDate]             = useState(() => new Date().toISOString().split('T')[0])
  const [placing, setPlacing]       = useState('')
  const [medal, setMedal]           = useState('')
  const [customMedal, setCustomMedal] = useState('')
  const [error, setError]           = useState('')
  const [saving, setSaving]         = useState(false)

  const debounceRef  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const nameWrapRef  = useRef<HTMLDivElement>(null)
  const [dropRect, setDropRect] = useState<{ top: number; left: number; width: number } | null>(null)

  // Derived: unique countries & cities from catalog
  const allCountries = useMemo(
    () => [...new Set(catalog.map(r => r.country).filter(Boolean))].sort() as string[],
    [catalog]
  )

  const citiesForCountry = useMemo(
    () => country
      ? ([...new Set(catalog.filter(r => r.country === country).map(r => r.city).filter(Boolean))].sort() as string[])
      : [],
    [catalog, country]
  )

  // Final city value
  const finalCity = citySelect === '__other__' ? cityText : (citySelect || cityText)

  // Reset distance preset when sport changes
  useEffect(() => {
    const presets = DISTANCES_BY_SPORT[sport] ?? []
    const first = presets.find(p => !CUSTOM_DIST_VALUES.includes(p.value))
    setDistance(first?.value ?? '__custom__')
    setCustomDist('')
  }, [sport])

  // Update dropdown portal position whenever suggestions open
  useEffect(() => {
    if (showSuggest && suggestions.length > 0 && nameWrapRef.current) {
      const r = nameWrapRef.current.getBoundingClientRect()
      setDropRect({ top: r.bottom + 4, left: r.left, width: r.width })
    } else {
      setDropRect(null)
    }
  }, [showSuggest, suggestions])

  // Autocomplete debounce
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (query.length < 2) { setSuggestions([]); setShowSuggest(false); return }
    debounceRef.current = setTimeout(() => {
      const q = query.toLowerCase()
      const catalogHits = catalog
        .filter(r =>
          r.name.toLowerCase().includes(q) ||
          (r.aliases ?? []).some(a => a.toLowerCase().includes(q))
        )
        .slice(0, 6)
        .map(r => ({ label: r.name, source: 'catalog' as const, data: r }))
      const allMyRaces = [...pastRaces, ...upcomingRaces]
      const myHits = allMyRaces
        .filter(r => r.name.toLowerCase().includes(q))
        .slice(0, 3)
        .map(r => ({ label: r.name, source: 'past' as const, myRace: r }))
      const all = [...myHits, ...catalogHits].slice(0, 8)
      setSuggestions(all)
      setShowSuggest(all.length > 0)
    }, 250)
    return () => clearTimeout(debounceRef.current)
  }, [query, catalog, pastRaces, upcomingRaces])

  function selectSuggestion(s: typeof suggestions[0]) {
    const TYPE_MAP: Record<string, string> = {
      run: 'Running', running: 'Running',
      tri: 'Triathlon', triathlon: 'Triathlon',
      cycle: 'Cycling', cycling: 'Cycling', bike: 'Cycling',
      swim: 'Swimming', swimming: 'Swimming',
      hyrox: 'HYROX',
    }

    if (s.myRace) {
      // Autofill from user's own past/upcoming race
      const r = s.myRace
      setQuery(r.name); setName(r.name)
      if (r.country) { setCountry(r.country); setCitySelect(''); setCityText('') }
      if (r.city)    { setCitySelect(r.city); setCityText(r.city) }
      if (r.sport)   setSport(r.sport)
      if (r.distance) {
        const presets = DISTANCES_BY_SPORT[r.sport ?? 'Running'] ?? []
        const match = presets.find(p => p.value === r.distance)
        if (match) { setDistance(r.distance) } else { setDistance('__custom__'); setCustomDist(r.distance) }
      }
      setShowSuggest(false)
      return
    }

    const raceName = s.data?.name ?? s.label
    setQuery(raceName); setName(raceName)
    if (s.data) {
      if (s.data.country) { setCountry(s.data.country); setCitySelect(''); setCityText('') }
      if (s.data.city)    { setCitySelect(s.data.city); setCityText(s.data.city) }
      const mappedSport = s.data.type ? (TYPE_MAP[s.data.type.toLowerCase()] ?? s.data.type) : null
      if (mappedSport) setSport(mappedSport)
      if (s.data.dist_km) {
        const distStr = String(s.data.dist_km)
        const presets = DISTANCES_BY_SPORT[mappedSport ?? 'Running'] ?? []
        const match = presets.find(p => p.value === distStr)
        if (match) { setDistance(distStr) } else { setDistance('__custom__'); setCustomDist(distStr) }
      }
      if (s.data.month && s.data.day) {
        const yr = new Date().getFullYear()
        setDate(`${yr}-${pad2(s.data.month)}-${pad2(s.data.day)}`)
      }
    }
    setShowSuggest(false)
  }

  function handleCountryChange(c: string) {
    setCountry(c)
    setCitySelect('')
    setCityText('')
  }

  const needsCustomDist = CUSTOM_DIST_VALUES.includes(distance)
  const finalDist = needsCustomDist ? customDist : distance
  const finalMedal = medal === '__custom__' ? customMedal : medal

  function buildSplits(): Split[] {
    if (sport !== 'Triathlon') return []
    return TRI_SEGMENTS.map(seg => {
      const t = triSplits[seg.key] ?? { h: 0, m: 0, s: 0 }
      const secs = hmsToSecs(t.h, t.m, t.s)
      if (secs === 0) return null
      return { label: seg.label, split: secsToHMS(secs) }
    }).filter(Boolean) as Split[]
  }

  function validate() {
    if (!name.trim())  { setError('Race name is required'); return false }
    if (!date)         { setError('Date is required'); return false }
    if (!finalDist)    { setError('Distance is required'); return false }
    setError('')
    return true
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)

    const totalSecs = hmsToSecs(time.h, time.m, time.s)
    let finalTime = outcome === 'Finished' && totalSecs > 0 ? secsToHMS(totalSecs) : undefined

    // Triathlon: auto-sum splits if no manual time entered
    if (sport === 'Triathlon' && outcome === 'Finished' && !finalTime) {
      const triTotal = TRI_SEGMENTS.reduce((acc, seg) => {
        const t = triSplits[seg.key] ?? { h: 0, m: 0, s: 0 }
        return acc + hmsToSecs(t.h, t.m, t.s)
      }, 0)
      if (triTotal > 0) finalTime = secsToHMS(triTotal)
    }

    const race: Race = {
      id: crypto.randomUUID(),
      name: name.trim(),
      date,
      city: finalCity.trim() || '',
      country: country.trim() || '',
      distance: finalDist,
      sport,
      time: finalTime,
      placing: placing.trim() || undefined,
      medal: finalMedal || undefined,
      priority: (priority as 'A' | 'B' | 'C') || undefined,
      outcome: outcome !== 'Finished' ? outcome : undefined,
      splits: buildSplits(),
    }

    if (mode === 'upcoming') {
      addUpcomingRace(race)
    } else {
      addRace(race)
    }
    setSaving(false)
    onClose()
  }

  const distancePresets = DISTANCES_BY_SPORT[sport] ?? []
  const hasCatalogCities = citiesForCountry.length > 0
  const cityIsOther = citySelect === '__other__'

  return (
    <div
      style={st.overlay}
      onClick={onClose}
      onTouchMove={e => e.stopPropagation()}
    >
      <div
        style={st.sheet}
        onClick={e => e.stopPropagation()}
        onTouchMove={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div style={st.handle} />

        {/* Header */}
        <div style={st.header}>
          <div>
            <span style={st.title}>{mode === 'past' ? 'LOG A RACE' : 'ADD UPCOMING RACE'}</span>
            <p style={st.subtitle}>{mode === 'past' ? 'Cross the line. Claim the medal.' : 'Plan ahead. Chase the goal.'}</p>
          </div>
          <button style={st.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Mode tabs */}
        <div style={{ padding: '12px 16px 0', flexShrink: 0, display: 'flex', gap: '8px' }}>
          <button
            style={{ ...st.tabBtn, ...(mode === 'past' ? st.tabBtnActive : {}) }}
            onClick={() => setMode('past')}
            type="button"
          >
            🏁 LOG A RACE
          </button>
          <button
            style={{ ...st.tabBtn, ...(mode === 'upcoming' ? st.tabBtnActiveGreen : {}) }}
            onClick={() => setMode('upcoming')}
            type="button"
          >
            📅 ADD UPCOMING
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ ...st.body, paddingTop: '12px' }}>

          {/* ── Race Name autocomplete ── */}
          <div ref={nameWrapRef}>
            <Field label="Race Name *">
              <input
                style={st.input}
                placeholder="Search a race or type your own..."
                value={query}
                onChange={e => { setQuery(e.target.value); setName(e.target.value); setShowSuggest(true) }}
                onBlur={() => setTimeout(() => setShowSuggest(false), 180)}
                autoFocus
              />
            </Field>
          </div>

          {/* Dropdown rendered via portal so it escapes overflow:hidden on the sheet */}
          {showSuggest && suggestions.length > 0 && dropRect && createPortal(
            <div style={{
              ...st.dropdown,
              position: 'fixed',
              top: dropRect.top,
              left: dropRect.left,
              width: dropRect.width,
              zIndex: 1200,
            }}>
              {suggestions.map((s, i) => {
                // Build meta line: city · country · distance · date
                const metaParts: string[] = []
                if (s.myRace) {
                  if (s.myRace.city)     metaParts.push(s.myRace.city)
                  if (s.myRace.country)  metaParts.push(s.myRace.country)
                  if (s.myRace.distance) metaParts.push(`${s.myRace.distance} km`)
                  if (s.myRace.date)     metaParts.push(s.myRace.date)
                } else if (s.data) {
                  if (s.data.city)     metaParts.push(s.data.city)
                  if (s.data.country)  metaParts.push(s.data.country)
                  if (s.data.dist_km)  metaParts.push(`${s.data.dist_km} km`)
                  if (s.data.month && s.data.day) {
                    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                    metaParts.push(`${months[s.data.month - 1]} ${s.data.day}`)
                  }
                }
                return (
                  <button
                    key={i}
                    style={{
                      ...st.dropdownItem,
                      borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '2px',
                    }}
                    onMouseDown={e => { e.preventDefault(); selectSuggestion(s) }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '8px' }}>
                      <span style={{
                        color: s.source === 'past' ? 'var(--orange)' : 'var(--green)',
                        fontSize: '11px',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}>
                        {s.source === 'past' ? '★' : '⚡'}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                        {s.label}
                      </span>
                      {s.data?.type && (
                        <span style={{ fontSize: '10px', color: 'var(--muted)', flexShrink: 0, textTransform: 'uppercase', fontFamily: 'var(--headline)', letterSpacing: '0.06em' }}>
                          {s.data.type}
                        </span>
                      )}
                    </div>
                    {metaParts.length > 0 && (
                      <div style={{ fontSize: '11px', color: 'var(--muted)', paddingLeft: '19px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                        {metaParts.join(' · ')}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>,
            document.body,
          )}

          {/* ── Race Type ── */}
          <Field label="Race Type">
            <select style={st.input} value={sport} onChange={e => setSport(e.target.value)}>
              {SPORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>

          {/* ── Distance ── */}
          <Field label="Distance *">
            <select style={st.input} value={distance} onChange={e => { setDistance(e.target.value); setCustomDist('') }}>
              {distancePresets.map(p => <option key={p.label} value={p.value}>{p.label}</option>)}
            </select>
            {needsCustomDist && (
              <input
                style={{ ...st.input, marginTop: '6px' }}
                placeholder="Enter distance in km"
                type="text"
                inputMode="decimal"
                value={customDist}
                onChange={e => setCustomDist(e.target.value)}
              />
            )}
          </Field>

          {/* ── Race Outcome (past only) ── */}
          {mode === 'past' && (
            <Field label="Race Outcome">
              <select style={st.input} value={outcome} onChange={e => setOutcome(e.target.value)}>
                {RACE_OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          )}

          {/* ── Finish Time (past only, drum) — hidden for DNF/DSQ/DNS ── */}
          {mode === 'past' && outcome === 'Finished' && (
            <Field label="Finish Time">
              <TimePicker value={time} onChange={setTime} />
            </Field>
          )}

          {/* ── Triathlon splits (past only) ── */}
          {mode === 'past' && sport === 'Triathlon' && outcome === 'Finished' && (
            <Field label="Splits">
              <TriathlonSplits
                splits={triSplits}
                onChange={(key, v) => setTriSplits(prev => ({ ...prev, [key]: v }))}
              />
            </Field>
          )}

          {/* ── Race Priority ── */}
          <Field label="Race Priority">
            <select style={st.input} value={priority} onChange={e => setPriority(e.target.value)}>
              {RACE_PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>

          {/* ── Country (dropdown from catalog) ── */}
          <Field label="Country">
            <select style={st.input} value={country} onChange={e => handleCountryChange(e.target.value)}>
              <option value="">Select a country...</option>
              {allCountries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          {/* ── City (dropdown filtered by country, then text if Other) ── */}
          <Field label="City">
            {hasCatalogCities ? (
              <>
                <select
                  style={st.input}
                  value={citySelect}
                  onChange={e => setCitySelect(e.target.value)}
                >
                  <option value="">Select a city...</option>
                  {citiesForCountry.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__other__">Other (type below)...</option>
                </select>
                {cityIsOther && (
                  <input
                    style={{ ...st.input, marginTop: '6px' }}
                    placeholder="Enter city name"
                    value={cityText}
                    onChange={e => setCityText(e.target.value)}
                    autoFocus
                  />
                )}
              </>
            ) : (
              <input
                style={st.input}
                placeholder="e.g. Berlin"
                value={cityText}
                onChange={e => setCityText(e.target.value)}
              />
            )}
          </Field>

          {/* ── Date ── */}
          <Field label="Date *">
            <input
              type="date"
              style={{ ...st.input, WebkitAppearance: 'none', appearance: 'none', maxWidth: '100%' } as React.CSSProperties}
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </Field>

          {/* ── Placing (past only) ── */}
          {mode === 'past' && (
            <Field label="Placing (Optional)">
              <input
                style={st.input}
                placeholder="e.g. 342/5000"
                value={placing}
                onChange={e => setPlacing(e.target.value)}
              />
            </Field>
          )}

          {/* ── Medal (past only) ── */}
          {mode === 'past' && (
            <Field label="Medal">
              <select style={st.input} value={medal} onChange={e => setMedal(e.target.value)}>
                {MEDALS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              {medal === '__custom__' && (
                <input
                  style={{ ...st.input, marginTop: '6px' }}
                  placeholder="e.g. Sub-3 Finisher, Age Group Winner..."
                  value={customMedal}
                  onChange={e => setCustomMedal(e.target.value)}
                />
              )}
            </Field>
          )}

          {error && (
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: '#ff6b6b', fontFamily: 'var(--body)' }}>
              {error}
            </p>
          )}

          {/* ── Actions ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
            <button style={st.cancelBtn} onClick={onClose} type="button">CANCEL</button>
            <button style={{ ...st.saveBtn, background: mode === 'upcoming' ? 'var(--green)' : 'var(--orange)', color: '#000' }} onClick={handleSave} disabled={saving} type="button">
              {saving ? 'SAVING…' : mode === 'past' ? 'LOG RACE' : 'ADD TO CALENDAR'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Shared style constants ───────────────────────────────────────────────────

const colonStyle: React.CSSProperties = {
  color: 'var(--muted)',
  fontSize: '20px',
  fontWeight: 700,
  alignSelf: 'center',
  paddingBottom: '20px',
}

const drumBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--muted)',
  fontSize: '12px',
  cursor: 'pointer',
  padding: '4px 8px',
  lineHeight: 1,
  minHeight: '28px',
  minWidth: '28px',
}

const drumNum: React.CSSProperties = {
  fontFamily: 'var(--headline)',
  fontWeight: 900,
  fontSize: '28px',
  color: 'var(--white)',
  letterSpacing: '0.02em',
  lineHeight: 1,
  minWidth: '36px',
  textAlign: 'center',
}

const drumLabel: React.CSSProperties = {
  fontSize: '10px',
  fontFamily: 'var(--headline)',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
}

const st = {
  overlay: {
    position: 'fixed',
    top: 'calc(var(--header-base-height) + var(--safe-top))',
    left: 0,
    right: 0,
    bottom: 'calc(var(--bottom-nav-base-height) + var(--safe-bottom))',
    background: 'rgba(0,0,0,0.75)',
    zIndex: 950,
    display: 'flex',
    alignItems: 'flex-end',
  } as React.CSSProperties,

  sheet: {
    width: '100%',
    maxHeight: '92vh',
    background: 'var(--surface2)',
    borderTop: '2px solid var(--orange)',
    borderRadius: '16px 16px 0 0',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  } as React.CSSProperties,

  handle: {
    width: '36px',
    height: '4px',
    background: 'var(--border2)',
    borderRadius: '2px',
    margin: '12px auto 0',
    flexShrink: 0,
  } as React.CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '12px 16px 0',
    flexShrink: 0,
  } as React.CSSProperties,

  title: {
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '22px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--white)',
    display: 'block',
  } as React.CSSProperties,

  subtitle: {
    margin: '2px 0 0',
    fontSize: '13px',
    color: 'var(--muted)',
    fontFamily: 'var(--body)',
  } as React.CSSProperties,

  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--muted)',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '4px 8px',
    lineHeight: 1,
    flexShrink: 0,
  } as React.CSSProperties,

  manualBadge: {
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: '8px',
    padding: '10px 16px',
    textAlign: 'center' as const,
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '14px',
    letterSpacing: '0.1em',
    color: 'var(--muted)',
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,

  body: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    paddingBottom: '32px',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    flex: 1,
  } as React.CSSProperties,

  fieldLabel: {
    fontSize: '11px',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
  } as React.CSSProperties,

  input: {
    width: '100%',
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: '6px',
    color: 'var(--white)',
    fontSize: 'var(--text-sm)',
    padding: '0.6rem 0.75rem',
    fontFamily: 'var(--body)',
    boxSizing: 'border-box',
    minWidth: 0,
  } as React.CSSProperties,

  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: '8px',
    zIndex: 200,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    overflow: 'hidden',
  } as React.CSSProperties,

  dropdownItem: {
    width: '100%',
    padding: '10px 12px',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--border)',
    color: 'var(--white)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--body)',
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
  } as React.CSSProperties,

  saveBtn: {
    background: 'var(--orange)',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    padding: '14px',
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '14px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    width: '100%',
  } as React.CSSProperties,

  cancelBtn: {
    background: 'transparent',
    color: 'var(--muted)',
    border: '1px solid var(--border2)',
    borderRadius: '8px',
    padding: '14px',
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '14px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    width: '100%',
  } as React.CSSProperties,

  tabBtn: {
    flex: 1,
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: '8px',
    color: 'var(--muted)',
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '12px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '10px 8px',
    cursor: 'pointer',
  } as React.CSSProperties,

  tabBtnActive: {
    background: 'rgba(var(--orange-ch),0.12)',
    border: '1px solid rgba(var(--orange-ch),0.4)',
    color: 'var(--orange)',
  } as React.CSSProperties,

  tabBtnActiveGreen: {
    background: 'rgba(0,255,136,0.1)',
    border: '1px solid rgba(0,255,136,0.35)',
    color: 'var(--green)',
  } as React.CSSProperties,
}

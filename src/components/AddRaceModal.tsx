import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRaceStore } from '@/stores/useRaceStore'
import { useRaceCatalog, type CatalogRace } from '@/hooks/useRaceCatalog'
import { DateInput } from '@/components/DateInput'
import { TimePickerWheel, type HMS } from '@/components/TimePickerWheel'
import { CustomDistInput } from '@/components/CustomDistInput'
import { CityPicker } from '@/components/CityPicker'
import { countryNameHaystack } from '@/lib/countries'
import { normalizeName, resolveDistKm, isAlreadyInCatalog, findSportDistMatch, distLabel as distLabelUtil } from '@/lib/utils'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/env'
import { useAuthStore } from '@/stores/useAuthStore'
import type { Race, Split } from '@/types'

type Mode = 'past' | 'upcoming'

// ─── Sport / Distance / Option config ───────────────────────────────────────

const SPORTS = [
  { id: 'Running',   label: 'Running' },
  { id: 'Cycling',   label: 'Cycling' },
  { id: 'Swimming',  label: 'Swimming' },
  { id: 'Triathlon', label: 'Triathlon' },
  { id: 'HYROX',     label: 'HYROX' },
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
    { label: 'Sprint',   value: '25.75' },
    { label: 'Olympic',  value: '51.5' },
    { label: '70.3',     value: '113' },
    { label: 'IRONMAN',  value: '226' },
    { label: 'PTO T100', value: '112' },
    { label: 'Custom...',                       value: '__custom__' },
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
  { value: 'A', label: 'A Race — Goal Event' },
  { value: 'B', label: 'B Race — Important' },
  { value: 'C', label: 'C Race — Training / Fun' },
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
  { label: 'SWIM', emoji: '', key: 'swim' },
  { label: 'T1',   emoji: '', key: 't1' },
  { label: 'BIKE', emoji: '', key: 'bike' },
  { label: 'T2',   emoji: '', key: 't2' },
  { label: 'RUN',  emoji: '', key: 'run' },
]

// Aliases by preset value — every synonym / common variant catalog rows
// (and race names) actually use in the wild. Matched case-insensitive,
// whole-word / substring-aware depending on context.
const DIST_ALIASES: Record<string, string[]> = {
  // Running
  '5':      ['5k', '5km', '5 k', '5-k', '5 kilometer', '5000m'],
  '10':     ['10k', '10km', '10 k', '10-k', '10 kilometer', '10000m'],
  '16.09':  ['10 mile', '10mile', '10mi', '10 miles', '10-mile'],
  '21.1':   ['half marathon', 'half-marathon', 'half mara', 'half', 'hm', '21.0975', '21.097', '21.1', '13.1 mi', '13.1'],
  '42.2':   ['marathon', 'full marathon', 'full-marathon', 'mara', '42.195', '42.2', '42km', '26.2', '26.2 mi'],
  '50':     ['50k', '50km', '50 k', '50-k'],
  '80.47':  ['50 mile', '50mi', '50 miles', '50-mile'],
  '100':    ['100k', '100km', '100 k', '100-k', 'century'],
  '160.93': ['100 mile', '100mi', '100 miles', '100-mile', 'centurion'],
  // Swimming
  '1':      ['1k swim', '1km swim', '1k', '1km'],
  '3':      ['3k swim', '3km swim', '3k', '3km'],
  '15':     ['15k swim', '15km swim', '15k', '15km'],
  '25':     ['25k swim', '25km swim', '25k', '25km'],
  // Triathlon
  '25.75':  ['sprint', 'sprint tri', 'sprint triathlon', 'sprint distance', 'super sprint'],
  '51.5':   ['olympic', 'olympic tri', 'olympic triathlon', 'olympic distance', 'standard', 'standard distance', 'standard tri'],
  '113':    ['70.3', 'half ironman', 'half-ironman', 'half iron', 'middle distance', 'middle', 'ironman 70.3', 'im 70.3', 'half distance'],
  '226':    ['ironman', 'full ironman', 'full-ironman', 'full iron', 'full distance', 'full ironman distance', 'im full', 'iron distance', '140.6', '140.6mi'],
  '112':    ['t100', 'pto t100', 'pto', 'professional triathletes organisation'],
  // Cycling
  '161':    ['century', 'century ride'],
  '200':    ['randonneur 200', 'brm 200', '200k brevet'],
  // HYROX string values
  'Solo Open':    ['solo open', 'open solo', 'solo'],
  'Solo Pro':     ['solo pro', 'pro solo'],
  'Doubles Open': ['doubles open', 'open doubles', 'doubles'],
  'Doubles Pro':  ['doubles pro', 'pro doubles'],
}

function normalizeTxt(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9. ]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Match a catalog distance to a preset value. Tries in order:
//   1. Exact normalized label OR alias match on the catalog `dist` string
//   2. Numeric match on `dist_km` within 3 % tolerance (catalog values drift)
//   3. Alias / label substring scan on the race `name` (e.g. "T100 Dubai Olympic")
// Returns the preset's value string if matched, otherwise null.
function matchCatalogDist(
  presets: { label: string; value: string }[],
  dist_km?: number,
  dist?: string,
  raceName?: string,
): string | null {
  const validPresets = presets.filter(p => !CUSTOM_DIST_VALUES.includes(p.value))

  // 1. Exact / alias match on the catalog distance text
  if (dist) {
    const norm = normalizeTxt(dist)
    const byLabel = validPresets.find(p => normalizeTxt(p.label) === norm)
    if (byLabel) return byLabel.value
    const byAlias = validPresets.find(p => (DIST_ALIASES[p.value] ?? []).some(a => normalizeTxt(a) === norm))
    if (byAlias) return byAlias.value
  }

  // 2. Numeric proximity on dist_km — 3 % tolerance is wide enough for
  // real-world catalog drift (42.195 vs 42.2, 21.0975 vs 21.1, etc.)
  if (typeof dist_km === 'number' && dist_km > 0) {
    const byKm = validPresets.find(p => {
      const pv = parseFloat(p.value)
      return !isNaN(pv) && Math.abs(pv - dist_km) / dist_km < 0.03
    })
    if (byKm) return byKm.value
  }

  // 3. Substring scan on race name — longest alias / label first so
  // "half marathon" wins over "half", "70.3" wins over "3", etc.
  if (raceName) {
    const hay = normalizeTxt(raceName)
    const candidates: { value: string; token: string }[] = []
    validPresets.forEach(p => {
      const tokens = [p.label, ...(DIST_ALIASES[p.value] ?? [])]
      tokens.forEach(t => {
        const tn = normalizeTxt(t)
        if (tn.length >= 2 && hay.includes(tn)) candidates.push({ value: p.value, token: tn })
      })
    })
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.token.length - a.token.length)
      return candidates[0].value
    }
  }

  return null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad2(n: number) { return n.toString().padStart(2, '0') }
function hmsToSecs(h: number, m: number, s: number) { return h * 3600 + m * 60 + s }
function secsToHMS(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.round(secs % 60)
  return `${h}:${pad2(m)}:${pad2(s)}`
}

// HMS imported from TimePickerWheel

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
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px', borderTop: '1px solid var(--border2)', background: 'rgba(var(--green-ch),0.05)' }}>
        <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '13px', letterSpacing: '0.1em', color: 'var(--green)', flex: 1 }}>TOTAL</span>
        <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '18px', color: 'var(--green)', letterSpacing: '0.04em' }}>
          {Math.floor(total / 3600)}:{pad2(Math.floor((total % 3600) / 60))}:{pad2(total % 60)}
        </span>
      </div>
    </div>
  )
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
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
  prefillDistance?: string
  prefill?: Partial<Race>
}

export function AddRaceModal({ onClose, defaultMode = 'past', prefillDistance, prefill }: Props) {
  const [mode, setMode] = useState<Mode>(defaultMode)
  const addRace         = useRaceStore(s => s.addRace)
  const addUpcomingRace = useRaceStore(s => s.addUpcomingRace)
  const pastRaces       = useRaceStore(s => s.races)
  const upcomingRaces   = useRaceStore(s => s.upcomingRaces)
  const authUser        = useAuthStore(s => s.authUser)
  const { data: catalog = [], isLoading: catalogLoading } = useRaceCatalog()
  const [toastMsg, setToastMsg] = useState('')

  // When parent changes defaultMode (e.g. re-opens), sync
  useEffect(() => { setMode(defaultMode) }, [defaultMode])

  // Pre-fill distance if provided (e.g. from Riegel predictor tap)
  useEffect(() => {
    if (!prefillDistance) return
    const LABEL_TO_KM: Record<string, string> = {
      '5K': '5', '10K': '10', 'Half Marathon': '21.1', 'Marathon': '42.2',
      '50K': '50', '100K': '100', '50 Mile': '80.5', '100 Mile': '161',
    }
    const km = LABEL_TO_KM[prefillDistance]
    if (km) setDistance(km)
  }, [prefillDistance])

  // Prefill from catalog race (e.g. from Discover page)
  useEffect(() => {
    if (!prefill) return
    if (prefill.name) setName(prefill.name)
    if (prefill.country) setCountry(prefill.country)
    if (prefill.city) { setCitySelect('__other__'); setCityText(prefill.city) }
    if (prefill.lat != null) setLat(prefill.lat)
    if (prefill.lng != null) setLng(prefill.lng)
    if (prefill.date) setDate(prefill.date)
    if (prefill.distance) setDistance(prefill.distance)
    const sportMap: Record<string, string> = {
      running: 'Running', triathlon: 'Triathlon', cycling: 'Cycling',
      swim: 'Swimming', hyrox: 'HYROX',
    }
    if (prefill.sport) setSport(sportMap[prefill.sport.toLowerCase()] ?? 'Running')
  }, [prefill])

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Autocomplete
  const [query, setQuery]           = useState('')
  const [showSuggest, setShowSuggest] = useState(false)
  const [suggestions, setSuggestions] = useState<{
    label: string
    source: 'past' | 'catalog'
    data?: CatalogRace
    allYears?: CatalogRace[]
    myRace?: Race
  }[]>([])
  const [catalogYearRows, setCatalogYearRows] = useState<CatalogRace[]>([])
  const [showOlderYears, setShowOlderYears]   = useState(false)

  // Core fields
  const [name, setName]             = useState('')
  const [sport, setSport]           = useState('')
  const [distance, setDistance]     = useState('')
  const [customDist, setCustomDist] = useState('')
  const [outcome, setOutcome]       = useState('Finished')
  const [time, setTime]             = useState<HMS>({ h: 0, m: 0, s: 0 })
  const [triSplits, setTriSplits]   = useState<Record<string, HMS>>({
    swim: { h: 0, m: 0, s: 0 }, t1: { h: 0, m: 0, s: 0 },
    bike: { h: 0, m: 0, s: 0 }, t2: { h: 0, m: 0, s: 0 }, run: { h: 0, m: 0, s: 0 },
  })
  const [priority, setPriority]     = useState('')
  const [goalHMS, setGoalHMS]       = useState<HMS>({ h: 0, m: 0, s: 0 })
  const [startTime, setStartTime]   = useState('')   // upcoming only — race-day wall clock "HH:MM"
  const [country, setCountry]       = useState('')
  const [citySelect, setCitySelect] = useState('')  // catalog-path preselect (now rarely used)
  const [cityText, setCityText]     = useState('')  // canonical city text, set by CityPicker
  const [lat, setLat]               = useState<number | undefined>(undefined)
  const [lng, setLng]               = useState<number | undefined>(undefined)
  const [date, setDate]             = useState(() => new Date().toISOString().split('T')[0])
  const [showManualDate, setShowManualDate] = useState(false)
  const [placing, setPlacing]            = useState('')
  const [genderPlacing, setGenderPlacing] = useState('')
  const [agPlacing, setAgPlacing]         = useState('')
  const [agLabel, setAgLabel]             = useState('')
  const [medal, setMedal]           = useState('')
  const [customMedal, setCustomMedal] = useState('')
  const [error, setError]           = useState('')
  const [saving, setSaving]         = useState(false)

  const debounceRef      = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const justSelectedRef  = useRef(false)
  const manualModeRef    = useRef(false)
  const nameWrapRef      = useRef<HTMLDivElement>(null)
  const [dropRect, setDropRect] = useState<{ top: number; left: number; width: number } | null>(null)

  // Final city value — kept for save payload + catalog contribution logic
  const finalCity = citySelect === '__other__' ? cityText : (citySelect || cityText)

  // Reset distance preset when sport changes — but only if current distance
  // isn't valid for the new sport (prevents catalog suggestion from being overwritten).
  useEffect(() => {
    if (!sport) { setDistance(''); setCustomDist(''); return }
    const presets = DISTANCES_BY_SPORT[sport] ?? []
    const isValid = presets.some(p => p.value === distance) || CUSTOM_DIST_VALUES.includes(distance)
    if (!isValid) { setDistance(''); setCustomDist('') }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport])

  // Update dropdown portal position — account for iOS visual viewport offset
  // (keyboard open shifts visual viewport; position:fixed uses visual coords but
  // getBoundingClientRect uses layout coords — subtract offsetTop to align them)
  function recalcDropRect() {
    // Show dropdown whenever query is active — even with 0 results, so the
    // "Add manually" escape hatch is always reachable.
    const shouldShow = showSuggest && query.length >= 2 && nameWrapRef.current
    if (shouldShow) {
      const r   = nameWrapRef.current!.getBoundingClientRect()
      const vv  = typeof window !== 'undefined' ? window.visualViewport : null
      const off = vv?.offsetTop ?? 0
      setDropRect({ top: r.bottom + 4 - off, left: r.left, width: r.width })
    } else {
      setDropRect(null)
    }
  }
  useEffect(() => {
    recalcDropRect()
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return
    vv.addEventListener('resize', recalcDropRect)
    vv.addEventListener('scroll', recalcDropRect)
    return () => {
      vv.removeEventListener('resize', recalcDropRect)
      vv.removeEventListener('scroll', recalcDropRect)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSuggest, suggestions, query, catalogLoading])

  // Run search immediately (no debounce) whenever catalog arrives after user already typed.
  // Also re-open the dropdown so results appear even if the user blurred while catalog was loading.
  useEffect(() => {
    if (catalog.length > 0 && query.length >= 2 && !showManualDate) {
      clearTimeout(debounceRef.current)
      setShowSuggest(true)
      runSearch(query, catalog)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog])

  function runSearch(q: string, cat: CatalogRace[]) {
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean)
    const fullQ  = tokens.join(' ')

    const matchesCatalog = (r: CatalogRace) => {
      const countryName = countryNameHaystack(r.country ?? '')
      const haystack = [r.name, r.city ?? '', r.country ?? '', countryName, ...(r.aliases ?? [])].join(' ').toLowerCase()
      return tokens.every(t => haystack.includes(t))
    }

    const nameMatchScore = (r: CatalogRace) => {
      if (r.name.toLowerCase().includes(fullQ)) return 2
      if ((r.aliases ?? []).some(a => a.toLowerCase().includes(fullQ))) return 2
      if (r.name.toLowerCase().includes(tokens[0])) return 1
      return 0
    }

    const isCityQuery = tokens.length === 1 &&
      cat.some(r => r.city?.toLowerCase() === fullQ || r.city?.toLowerCase().startsWith(fullQ))

    // Group by normalized name|city so sponsor variants + year rows collapse to one entry
    const grouped = new Map<string, CatalogRace[]>()
    cat.filter(matchesCatalog).forEach(r => {
      const key = `${normalizeName(r.name)}|${(r.city ?? '').toLowerCase()}`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(r)
    })

    const currentYear = new Date().getFullYear()

    // In upcoming mode, prefer future-dated entries as the representative.
    // Sort: future years ascending (nearest first), then past years descending.
    const sortForMode = (rows: CatalogRace[]) => {
      if (mode !== 'upcoming') return [...rows].sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
      const future = rows.filter(r => (r.year ?? 0) >= currentYear)
        .sort((a, b) => (a.year ?? 0) - (b.year ?? 0))
      const past = rows.filter(r => (r.year ?? 0) < currentYear)
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
      return [...future, ...past]
    }

    const catalogHits = Array.from(grouped.values())
      .map(rows => {
        const sorted = sortForMode(rows)
        // In upcoming mode, only show future year pills
        const relevantYears = mode === 'upcoming'
          ? sorted.filter(r => r.year == null || r.year >= currentYear)
          : sorted
        return {
          label:    sorted[0].name,
          source:   'catalog' as const,
          data:     sorted[0],
          allYears: relevantYears.length > 0 ? relevantYears : sorted,
        }
      })
      .sort((a, b) => nameMatchScore(b.data) - nameMatchScore(a.data))
      .slice(0, isCityQuery ? 8 : 6)

    // In upcoming mode, don't suggest completed past races — only upcoming ones
    const allMyRaces = mode === 'upcoming' ? upcomingRaces : [...pastRaces, ...upcomingRaces]
    const myHits = allMyRaces
      .filter(r => {
        const h = [r.name, r.city ?? '', r.country ?? ''].join(' ').toLowerCase()
        return tokens.every(t => h.includes(t))
      })
      .slice(0, 3)
      .map(r => ({ label: r.name, source: 'past' as const, myRace: r }))

    const all = [...myHits, ...catalogHits].slice(0, 10)
    setSuggestions(all)
    setShowSuggest(all.length > 0 || (q.length >= 2 && !catalogLoading))
  }

  // Autocomplete debounce — multi-word tokenized match across name, aliases, city, country
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (query.length < 2) { setSuggestions([]); setShowSuggest(false); return }
    // User picked a suggestion or tapped "Add manually" — skip re-search
    if (justSelectedRef.current) { justSelectedRef.current = false; return }
    if (manualModeRef.current) { setShowSuggest(false); return }
    // While catalog is loading, show the dropdown with a loading placeholder
    if (catalogLoading) {
      setSuggestions([])
      setShowSuggest(true)
      return
    }
    debounceRef.current = setTimeout(() => {
      runSearch(query, catalog)
    }, 200)
    return () => clearTimeout(debounceRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, catalog, pastRaces, upcomingRaces, catalogLoading])

  function selectSuggestion(s: typeof suggestions[0]) {
    clearTimeout(debounceRef.current)
    justSelectedRef.current = true
    const TYPE_MAP: Record<string, string> = {
      run: 'Running', running: 'Running',
      tri: 'Triathlon', triathlon: 'Triathlon',
      cycle: 'Cycling', cycling: 'Cycling', bike: 'Cycling',
      swim: 'Swimming', swimming: 'Swimming',
      hyrox: 'HYROX',
    }

    if (s.myRace) {
      // Autofill from user's own past/upcoming race
      clearTimeout(debounceRef.current)
      const r = s.myRace
      setQuery(r.name); setName(r.name)
      if (r.country) { setCountry(r.country); setCitySelect(''); setCityText('') }
      if (r.city)    { setCitySelect(r.city); setCityText(r.city) }
      if (r.lat != null) setLat(r.lat)
      if (r.lng != null) setLng(r.lng)
      if (r.sport)   setSport(r.sport)
      if (r.distance) {
        const presets = DISTANCES_BY_SPORT[r.sport ?? 'Running'] ?? []
        const matched = findSportDistMatch(r.distance, presets)
        if (matched) { setDistance(matched); setCustomDist('') }
        else { setDistance('__custom__'); setCustomDist(r.distance) }
      }
      if (r.date) setDate(r.date)
      setShowSuggest(false)
      return
    }

    const representative = s.data
    const raceName = representative?.name ?? s.label
    setQuery(raceName); setName(raceName)

    if (representative) {
      if (representative.country) { setCountry(representative.country); setCitySelect(''); setCityText('') }
      if (representative.city)    { setCitySelect(representative.city); setCityText(representative.city) }
      if ((representative as any).lat != null) setLat(Number((representative as any).lat))
      if ((representative as any).lng != null) setLng(Number((representative as any).lng))
      const mappedSport = representative.type ? (TYPE_MAP[representative.type.toLowerCase()] ?? representative.type) : null
      if (mappedSport) setSport(mappedSport)
      // Always try to resolve a distance preset — even when the catalog row
      // has no dist_km / dist, we can often infer it from the race name
      // (e.g. "T100 Dubai Olympic" → Olympic).
      {
        const presets = DISTANCES_BY_SPORT[mappedSport ?? 'Running'] ?? []
        const matched = matchCatalogDist(presets, representative.dist_km, representative.dist, raceName)
        if (matched) {
          setDistance(matched); setCustomDist('')
        } else if (representative.dist_km || representative.dist) {
          setDistance('__custom__')
          setCustomDist(representative.dist_km ? String(representative.dist_km) : (representative.dist ?? ''))
        }
      }
    }

    // Build catalog year rows — sorted by year descending (most recent first).
    // Only include rows that have a known year so pills are meaningful.
    const years = s.allYears ?? (representative ? [representative] : [])
    const sortedYears = [...years]
      .filter(r => r.year != null)
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
      // dedupe by year (same year may appear for aliases)
      .filter((r, i, arr) => arr.findIndex(x => x.year === r.year) === i)
    setCatalogYearRows(sortedYears)
    setShowOlderYears(false)
    setShowManualDate(false)

    // Auto-fill date from the most-recent catalog row.
    const firstRow = sortedYears[0] ?? representative
    if (firstRow?.month && firstRow?.day) {
      const yr = firstRow.year ?? new Date().getFullYear()
      const candidate = `${yr}-${pad2(firstRow.month)}-${pad2(firstRow.day)}`
      const today = new Date().toISOString().split('T')[0]
      if (mode !== 'upcoming' || candidate >= today) {
        setDate(candidate)
      }
    }

    // Autofill start time from catalog (HH:MM:SS → HH:MM for <input type="time">).
    const startTimeSrc = (firstRow as any)?.start_time ?? (representative as any)?.start_time
    if (mode === 'upcoming' && typeof startTimeSrc === 'string' && /^\d{2}:\d{2}/.test(startTimeSrc)) {
      setStartTime(startTimeSrc.slice(0, 5))
    }

    setShowSuggest(false)
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

  async function contributeIfNew(race: Race) {
    if (!authUser) return
    if (isAlreadyInCatalog(race, catalog)) return

    const [year, month, day] = race.date.split('-').map(Number)
    const distKm = race.distance ? resolveDistKm(race.distance) : null

    // Direct fetch bypasses the supabase-js client stack entirely — same as a curl call.
    void fetch(`${SUPABASE_URL}/rest/v1/rpc/upsert_catalog_contribution`, {
      method: 'POST',
      headers: {
        'apikey':       SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_name:           race.name,
        p_city:           race.city  || '',
        p_country:        race.country || '',
        p_sport:          race.sport  || '',
        p_dist_label:     race.distance || '',
        p_dist_km:        distKm,
        p_year:           year || null,
        p_event_date:     race.date || null,
        p_month:          month || null,
        p_day:            day || null,
        p_contributor_id: authUser.id,
      }),
    })
  }

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 5000)
  }

  function validate() {
    if (!name.trim())  { setError('Race name is required'); return false }
    if (!date)         { setError('Date is required'); return false }
    if (!sport)        { setError('Sport is required'); return false }
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
      lat,
      lng,
      distance: finalDist,
      sport,
      time: finalTime,
      placing: placing.trim() || undefined,
      genderPlacing: genderPlacing.trim() || undefined,
      agPlacing: agPlacing.trim() || undefined,
      agLabel: agLabel.trim() || undefined,
      medal: finalMedal || undefined,
      priority: (priority as 'A' | 'B' | 'C') || undefined,
      outcome: outcome !== 'Finished' ? outcome : undefined,
      splits: buildSplits(),
      ...(mode === 'upcoming' && (goalHMS.h > 0 || goalHMS.m > 0 || goalHMS.s > 0) ? {
        goalTime: `${goalHMS.h}:${String(goalHMS.m).padStart(2,'0')}:${String(goalHMS.s).padStart(2,'0')}`,
      } : {}),
      ...(mode === 'upcoming' && startTime ? { startTime } : {}),
    }

    if (mode === 'upcoming') {
      addUpcomingRace(race)
      void contributeIfNew(race)
      setSaving(false)
      onClose()
    } else {
      addRace(race)
      void contributeIfNew(race)
      setSaving(false)
      showToast('Race added · Submitted to catalog for review')
      setTimeout(onClose, 1200)
    }
  }

  const distancePresets = DISTANCES_BY_SPORT[sport] ?? []

  return createPortal((
    <div
      style={st.overlay}
      onClick={onClose}
      onTouchMove={e => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-race-modal-title"
        style={st.sheet}
        onClick={e => e.stopPropagation()}
        onTouchMove={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div style={st.handle} />

        {/* Toast */}
        {toastMsg && (
          <div style={st.toast}>{toastMsg}</div>
        )}

        {/* Header */}
        <div style={st.header}>
          <div>
            <span id="add-race-modal-title" style={st.title}>{mode === 'past' ? 'LOG A RACE' : 'ADD UPCOMING RACE'}</span>
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
            LOG A RACE
          </button>
          <button
            style={{ ...st.tabBtn, ...(mode === 'upcoming' ? st.tabBtnActiveGreen : {}) }}
            onClick={() => setMode('upcoming')}
            type="button"
          >
            ADD UPCOMING
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
                onChange={e => { manualModeRef.current = false; setQuery(e.target.value); setName(e.target.value); setShowSuggest(true); if (catalogYearRows.length > 0) setCatalogYearRows([]) }}
                onFocus={() => { if (query.length >= 2 && !showManualDate) { setShowSuggest(true); if (!catalogLoading) runSearch(query, catalog) } }}
                onBlur={() => setTimeout(() => setShowSuggest(false), 300)}
                autoFocus
              />
            </Field>
          </div>

          {/* Dropdown rendered via portal so it escapes overflow:hidden on the sheet */}
          {showSuggest && dropRect && createPortal(
            <div style={{
              ...st.dropdown,
              position: 'fixed',
              top: dropRect.top,
              left: dropRect.left,
              width: dropRect.width,
              zIndex: 1200,
            }}>
              {catalogLoading && (
                <div style={{ padding: '12px', fontSize: '12px', color: 'var(--muted)', textAlign: 'center', fontFamily: 'var(--body)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <span style={{ opacity: 0.6, fontFamily: 'var(--mono, var(--body))', fontSize: '10px', letterSpacing: '0.08em' }}>...</span> Searching race catalog…
                </div>
              )}
              {suggestions.length === 0 && !catalogLoading && (
                <div style={{ padding: '12px', fontSize: '12px', color: 'var(--muted)', textAlign: 'center', fontFamily: 'var(--body)' }}>
                  No matches in catalog for &ldquo;{query}&rdquo;
                </div>
              )}
              {suggestions.map((s, i) => {
                // Build meta line: city · country · distance
                const metaParts: string[] = []
                if (s.myRace) {
                  if (s.myRace.city)     metaParts.push(s.myRace.city)
                  if (s.myRace.country)  metaParts.push(s.myRace.country)
                  if (s.myRace.distance) metaParts.push(distLabelUtil(s.myRace.distance))
                  if (s.myRace.date) {
                    const [y, m, d] = s.myRace.date.split('-').map(Number)
                    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                    metaParts.push(`${months[m - 1]} ${d} ${y}`)
                  }
                } else if (s.data) {
                  if (s.data.city)    metaParts.push(s.data.city)
                  if (s.data.country) metaParts.push(s.data.country)
                  const dl = s.data.dist ? distLabelUtil(s.data.dist) : (s.data.dist_km ? distLabelUtil(String(s.data.dist_km)) : '')
                  if (dl) metaParts.push(dl)
                  if (s.allYears && s.allYears.length > 1) {
                    const _cy = new Date().getFullYear()
                    const yrs = [...new Set(s.allYears.map(r => r.year).filter(Boolean))]
                      .sort((a, b) => a! - b!)
                    const futureYrs = yrs.filter(y => y! >= _cy)
                    const displayYrs = (futureYrs.length > 0 ? futureYrs : yrs).slice(0, 3)
                    metaParts.push(displayYrs.join(', ') + (yrs.length > 3 ? '…' : ''))
                  } else if (s.data.month && s.data.day) {
                    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                    // In upcoming mode: advance displayed year past today if needed
                    let dispYear = s.data.year ?? new Date().getFullYear()
                    if (mode === 'upcoming' && s.data.month && s.data.day) {
                      const today = new Date().toISOString().split('T')[0]
                      let candidate = `${dispYear}-${pad2(s.data.month)}-${pad2(s.data.day)}`
                      while (candidate < today) { dispYear += 1; candidate = `${dispYear}-${pad2(s.data.month)}-${pad2(s.data.day)}` }
                    }
                    metaParts.push(`${months[s.data.month - 1]} ${s.data.day} ${dispYear}`)
                  }
                }
                return (
                  <button
                    key={i}
                    style={{
                      ...st.dropdownItem,
                      borderBottom: '1px solid var(--border)',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '2px',
                    }}
                    onMouseDown={e => { e.preventDefault(); selectSuggestion(s) }}
                    onTouchEnd={e => { e.preventDefault(); selectSuggestion(s) }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '8px' }}>
                      <span style={{
                        color: s.source === 'past' ? 'var(--orange)' : 'var(--green)',
                        fontSize: '11px',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}>
                        {s.source === 'past' ? '★' : '+'}
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
              {/* "Not finding it?" escape hatch — always last */}
              <button
                style={{
                  ...st.dropdownItem,
                  color: 'var(--orange)',
                  fontSize: '12px',
                  justifyContent: 'center',
                  fontStyle: 'italic',
                  borderTop: suggestions.length > 0 ? '1px solid var(--border2)' : 'none',
                }}
                onMouseDown={e => { e.preventDefault(); justSelectedRef.current = true; manualModeRef.current = true; setName(query.trim()); setShowSuggest(false); setCatalogYearRows([]); setShowManualDate(true) }}
                onTouchEnd={e => { e.preventDefault(); justSelectedRef.current = true; manualModeRef.current = true; setName(query.trim()); setShowSuggest(false); setCatalogYearRows([]); setShowManualDate(true) }}
              >
                + Add &ldquo;{query}&rdquo; manually →
              </button>
            </div>,
            document.body,
          )}

          {/* ── Date / Year picker — right under race name ── */}
          {(() => {
            const today = new Date().toISOString().split('T')[0]
            // Catalog-based pills: show up to 10 most-recent years that exist in catalog.
            // If race wasn't selected from catalog, no pills — just manual date input.
            const visibleRows = showOlderYears
              ? catalogYearRows
              : catalogYearRows.slice(0, 10)
            const hasMoreInCatalog = !showOlderYears && catalogYearRows.length > 10

            return (
              <Field label="Date *">
                {/* Future-race warning in "Log a Race" mode */}
                {mode === 'past' && date && date > today && (
                  <div style={{ marginBottom: '8px', padding: '10px 12px', background: 'rgba(var(--orange-ch),0.1)', border: '1px solid rgba(var(--orange-ch),0.35)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: 'var(--orange)', fontFamily: 'var(--body)', flex: 1 }}>
                      ⚠️ This race is in the future — log it as an upcoming race instead.
                    </span>
                    <button
                      type="button"
                      onClick={() => setMode('upcoming')}
                      style={{ fontSize: '11px', fontFamily: 'var(--headline)', fontWeight: 900, letterSpacing: '0.06em', background: 'var(--orange)', color: 'var(--black)', border: 'none', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      MOVE TO UPCOMING →
                    </button>
                  </div>
                )}
                {showManualDate ? (
                  <div>
                    <DateInput value={date} onChange={setDate} />
                    {catalogYearRows.length > 0 && (
                      <button
                        type="button"
                        style={{ fontSize: '11px', color: 'var(--muted)', background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', fontFamily: 'var(--body)' }}
                        onClick={() => setShowManualDate(false)}
                      >
                        ← pick year
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    {catalogYearRows.length > 0 ? (
                      /* Catalog-only year pills */
                      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', WebkitOverflowScrolling: 'touch', flexWrap: 'wrap' } as React.CSSProperties}>
                        {visibleRows.map((row, i) => {
                          const isSelected = row.year != null && date?.startsWith(String(row.year))
                          return (
                            <button
                              key={i}
                              type="button"
                              style={{
                                ...st.yearPill,
                                ...(isSelected ? { background: 'var(--orange)', color: 'var(--black)', borderColor: 'var(--orange)' } : {}),
                              }}
                              onMouseDown={e => {
                                e.preventDefault()
                                if (row.month && row.day && row.year != null) {
                                  setDate(`${row.year}-${pad2(row.month)}-${pad2(row.day)}`)
                                }
                              }}
                            >
                              {row.year}
                            </button>
                          )
                        })}
                        {hasMoreInCatalog && (
                          <button
                            type="button"
                            style={{ ...st.yearPill, color: 'var(--muted)', borderColor: 'var(--border2)', fontSize: '11px', whiteSpace: 'nowrap' }}
                            onMouseDown={e => { e.preventDefault(); setShowOlderYears(true) }}
                          >
                            Older →
                          </button>
                        )}
                        <button
                          type="button"
                          style={{ ...st.yearPill, color: 'var(--muted)', borderColor: 'var(--border2)', fontSize: '11px', whiteSpace: 'nowrap' }}
                          onMouseDown={e => { e.preventDefault(); setShowManualDate(true) }}
                        >
                          Other →
                        </button>
                      </div>
                    ) : (
                      /* No catalog match — manual date only */
                      <DateInput value={date} onChange={setDate} />
                    )}
                    {date && (
                      <p style={{ margin: '6px 0 0', fontSize: '15px', fontWeight: 600, color: 'var(--white)' }}>
                        {new Date(date + 'T00:00:00').toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    )}
                  </div>
                )}
                {mode === 'upcoming' && date && date < today && (
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--orange)', fontWeight: 600 }}>
                    ⚠️ This date is in the past — use "Log a Race" tab for completed races
                  </p>
                )}
              </Field>
            )
          })()}

          {/* ── City + Country — typeahead search (fills country + coords on pick) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="City">
              <CityPicker
                city={finalCity}
                country={country}
                placeholder="Type to search…"
                onSelect={({ city: c, country: co, lat, lng }) => {
                  setCityText(c)
                  setCitySelect('')
                  if (co) setCountry(co)
                  setLat(lat)
                  setLng(lng)
                }}
              />
            </Field>
            <Field label="Country">
              <input
                style={st.input}
                placeholder="Auto-filled"
                value={country}
                onChange={e => setCountry(e.target.value)}
              />
            </Field>
          </div>

          {/* ── Sport + Distance side by side ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="Sport *">
              <select style={st.input} value={sport} onChange={e => setSport(e.target.value)}>
                <option value="" disabled>Choose sport…</option>
                {SPORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Distance *">
              <select
                style={{ ...st.input, opacity: sport ? 1 : 0.45, cursor: sport ? 'pointer' : 'not-allowed' }}
                value={distance}
                disabled={!sport}
                onChange={e => { setDistance(e.target.value); setCustomDist('') }}
              >
                <option value="" disabled>{sport ? 'Choose distance…' : 'Choose sport first'}</option>
                {distancePresets.map(p => <option key={p.label} value={p.value}>{p.label}</option>)}
              </select>
            </Field>
          </div>
          {needsCustomDist && (
            <CustomDistInput value={customDist} onChange={setCustomDist} />
          )}

          {/* ── Race Outcome (past only) ── */}
          {mode === 'past' && (
            <Field label="Race Outcome">
              <select style={st.input} value={outcome} onChange={e => {
                const v = e.target.value
                setOutcome(v)
                if (v === 'Finished' && !medal) setMedal('Finisher')
                if (v !== 'Finished') setMedal('')
              }}>
                {RACE_OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          )}

          {/* ── Finish Time (past only, drum) — hidden for DNF/DSQ/DNS ── */}
          {mode === 'past' && outcome === 'Finished' && (
            <Field label="Finish Time">
              <TimePickerWheel value={time} onChange={setTime} />
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

          {/* ── Goal Time (upcoming only) ── */}
          {mode === 'upcoming' && (
            <Field label={<>Goal Time <span style={{ opacity: 0.5, fontWeight: 400, fontSize: '11px', textTransform: 'lowercase', letterSpacing: 0 }}>(optional)</span></>}>
              <TimePickerWheel value={goalHMS} onChange={setGoalHMS} maxHours={99} />
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px' }}>
                Scroll to set · Used by Gap To Goal widget
              </div>
            </Field>
          )}

          {mode === 'upcoming' && (
            <Field label={<>Start Time <span style={{ opacity: 0.5, fontWeight: 400, fontSize: '11px', textTransform: 'lowercase', letterSpacing: 0 }}>(local, optional)</span></>}>
              <input
                type="time"
                style={st.input}
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
              />
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px' }}>
                Race-day wall clock · Auto-filled from catalog when known
              </div>
            </Field>
          )}

          {/* ── Placing (past only) — Overall · Gender · Age Group ── */}
          {mode === 'past' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                  <label style={st.fieldLabel}>OVERALL</label>
                  <input style={st.input} placeholder="342/5000" value={placing} onChange={e => setPlacing(e.target.value)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                  <label style={st.fieldLabel}>GENDER</label>
                  <input style={st.input} placeholder="47/2400" value={genderPlacing} onChange={e => setGenderPlacing(e.target.value)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                  <label style={st.fieldLabel}>AGE GROUP</label>
                  <input style={st.input} placeholder="3/120" value={agPlacing} onChange={e => setAgPlacing(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                <label style={st.fieldLabel}>AGE GROUP LABEL</label>
                <input style={st.input} placeholder="e.g. M30-34, F35-39, M Open" value={agLabel} onChange={e => setAgLabel(e.target.value)} />
              </div>
            </div>
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
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--error)', fontFamily: 'var(--body)' }}>
              {error}
            </p>
          )}

          {/* ── Actions ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
            <button style={st.cancelBtn} onClick={onClose} type="button">CANCEL</button>
            <button className={`btn-v3 ${mode === 'upcoming' ? 'btn-health-v3' : 'btn-primary-v3'}`} style={st.saveBtn} onClick={handleSave} disabled={saving} type="button">
              {saving ? 'SAVING…' : mode === 'past' ? 'LOG RACE' : 'ADD TO CALENDAR'}
            </button>
          </div>
        </div>
      </div>
    </div>
  ), document.body)
}

const st = {
  // Full-viewport overlay (covers bottom nav). The sheet itself is bounded
  // by maxHeight: 100% and can scroll internally, so the form is reachable
  // without the bottom nav showing through.
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    backdropFilter: 'blur(8px)',
    zIndex: 950,
    display: 'flex',
    alignItems: 'flex-end',
  } as React.CSSProperties,

  sheet: {
    width: '100%',
    maxHeight: '100%',
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

  toast: {
    position: 'absolute',
    top: '60px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--surface3)',
    border: '1px solid var(--green)',
    color: 'var(--green)',
    borderRadius: '20px',
    padding: '8px 18px',
    fontSize: '13px',
    fontFamily: 'var(--body)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    zIndex: 10,
    pointerEvents: 'none',
  } as React.CSSProperties,

  yearPill: {
    flexShrink: 0,
    padding: '6px 14px',
    background: 'var(--surface3)',
    border: '1px solid var(--orange)',
    borderRadius: '20px',
    color: 'var(--orange)',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    fontSize: '13px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
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
    paddingBottom: 'calc(var(--safe-bottom) + 32px)',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain',
    flex: 1,
  } as React.CSSProperties,

  fieldLabel: {
    fontSize: 'var(--text-xs)',
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
    width: '100%',
    padding: '14px',
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
    background: 'rgba(var(--green-ch),0.1)',
    border: '1px solid rgba(var(--green-ch),0.35)',
    color: 'var(--green)',
  } as React.CSSProperties,
}

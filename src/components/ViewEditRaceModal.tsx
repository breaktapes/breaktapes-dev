import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRaceStore } from '@/stores/useRaceStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { RaceShareCard } from '@/components/RaceShareCard'
import { DateInput } from '@/components/DateInput'
import { CustomDistInput } from '@/components/CustomDistInput'
import { TimePickerWheel, type HMS } from '@/components/TimePickerWheel'
import type { Race, Split } from '@/types'
import { useUnits, fmtDistKm, distUnit, fmtPaceSecPerKm, computePaceSecPerKm } from '@/lib/units'
import { getClaudeApiKey, importRaceScreenshot } from '@/lib/claude'
import { removeMedalBackground } from '@/lib/removeBg'

// ─── Config (mirrors AddRaceModal) ──────────────────────────────────────────

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
    { label: '1KM',       value: '1' },
    { label: '3KM',       value: '3' },
    { label: '5KM',       value: '5' },
    { label: '10KM',      value: '10' },
    { label: '15KM',      value: '15' },
    { label: '25KM',      value: '25' },
    { label: 'Custom...', value: '__custom__' },
  ],
  Triathlon: [
    { label: 'Sprint',   value: '25.75' },
    { label: 'Olympic',  value: '51.5' },
    { label: '70.3',     value: '113' },
    { label: 'IRONMAN',  value: '226' },
    { label: 'Custom...',          value: '__custom__' },
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
  { value: '',         label: 'None' },
  { value: 'gold',     label: '🥇 Gold' },
  { value: 'silver',   label: '🥈 Silver' },
  { value: 'bronze',   label: '🥉 Bronze' },
  { value: 'finisher', label: 'Finisher' },
  { value: '__custom__', label: 'Custom...' },
]

const MEDAL_COLORS: Record<string, string> = {
  gold:     '#FFD770',
  silver:   '#C8D4DC',
  bronze:   '#CD8C5A',
  finisher: 'var(--orange)',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
}

// Flat map: label or value → numeric km string (e.g. "Half Marathon" → "21.1", "42.2" → "42.2")
const _DIST_KM_MAP: Record<string, string> = (() => {
  const m: Record<string, string> = {}
  for (const entries of Object.values(DISTANCES_BY_SPORT)) {
    for (const e of entries) {
      if (!CUSTOM_DIST_VALUES.includes(e.value)) {
        m[e.label.toLowerCase()] = e.value
        m[e.value.toLowerCase()] = e.value
      }
    }
  }
  return m
})()

/** Maps numeric km strings to friendly display labels for known named distances. */
const _KM_FRIENDLY: Record<string, string> = {
  '226': 'IRONMAN', '226.0': 'IRONMAN',
  '113': '70.3',    '113.0': '70.3',
  '51.5': 'Olympic',
  '25.75': 'Sprint',
  '42.195': 'Marathon', '42.2': 'Marathon',
  '21.1': 'Half Marathon', '21.0975': 'Half Marathon',
  '10': '10K', '5': '5K',
}

/** Resolve a distance string to its km display value.
 *  "Half Marathon" → "21.1",  "21.1" → "21.1",  "Solo Open" → "Solo Open" (HYROX) */
function resolveDistKm(dist: string): { km: string; isNumeric: boolean } {
  if (!dist) return { km: dist, isNumeric: false }
  const mapped = _DIST_KM_MAP[dist.toLowerCase()]
  if (mapped) {
    const n = parseFloat(mapped)
    return { km: mapped, isNumeric: !isNaN(n) }
  }
  // Already a numeric string?
  const n = parseFloat(dist)
  if (!isNaN(n)) return { km: dist, isNumeric: true }
  // Non-numeric label (HYROX category, etc.)
  return { km: dist, isNumeric: false }
}

/** Returns a friendly display label for a distance — "113" → "70.3", "21.1" → "Half Marathon" */
function distFriendly(dist: string): string {
  if (!dist) return dist
  const resolved = _DIST_KM_MAP[dist.toLowerCase()] ?? dist
  return _KM_FRIENDLY[resolved] ?? resolved
}

// ─── PB detection ────────────────────────────────────────────────────────────

function _timeToSecs(t: string): number | null {
  const parts = t.split(':').map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
}

function _normKey(d: string): string {
  const km = parseFloat(d)
  if (!isNaN(km)) {
    if (km >= 225.9 && km <= 226.1) return 'ironman'
    if (km >= 112.9 && km <= 113.1) return '70.3'
    if (km >= 51.4 && km <= 51.6) return 'olympic'
    if (km >= 42.1 && km <= 42.3) return 'marathon'
    if (km >= 21.0 && km <= 21.2) return 'half'
    return `${km}`
  }
  return d.toLowerCase()
}

function _checkIsPB(race: Race, allRaces: Race[]): boolean {
  if (!race.time || !race.distance) return false
  const key = _normKey(race.distance)
  const secs = _timeToSecs(race.time)
  if (secs == null) return false
  for (const r of allRaces) {
    if (r.id === race.id || !r.time || !r.distance) continue
    if (_normKey(r.distance) !== key) continue
    const s = _timeToSecs(r.time)
    if (s != null && s < secs) return false
  }
  return true
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  race: Race
  onClose: () => void
}

// ─── View panel (read mode) ───────────────────────────────────────────────────

function ViewPanel({ race, isPB, onEdit, onDelete, onShare }: { race: Race; isPB: boolean; onEdit: () => void; onDelete: () => void; onShare: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const medalColor = race.medal ? (MEDAL_COLORS[race.medal] ?? 'var(--orange)') : null
  const units = useUnits()

  return (
    <div style={st.body}>
      {/* Name + date — centered hero */}
      <div style={{ textAlign: 'center', paddingBottom: '4px' }}>
        <h2 style={{ ...st.raceName, textAlign: 'center', textTransform: 'uppercase' }}>{race.name || 'UNTITLED RACE'}</h2>
        <p style={{ ...st.raceMeta, textAlign: 'center' }}>{fmtDate(race.date)}</p>
      </div>

      {/* Key stats row */}
      <div style={st.statsRow}>
        {race.time && (
          <div style={{ ...st.statBox, ...(isPB ? { borderColor: 'rgba(200,150,60,0.45)', background: 'rgba(200,150,60,0.07)' } : {}) }}>
            <div style={{ ...st.statVal, color: isPB ? '#C8963C' : 'var(--orange)' }}>{race.time}</div>
            <div style={{ ...st.statLabel, ...(isPB ? { color: 'rgba(200,150,60,0.7)' } : {}) }}>
              {isPB ? '⭐ PERSONAL BEST' : 'FINISH TIME'}
            </div>
          </div>
        )}
        {race.distance && (() => {
          const friendly = distFriendly(race.distance)
          const { km, isNumeric } = resolveDistKm(race.distance)
          const isFriendlyLabel = friendly !== km
          const distDisplay = isFriendlyLabel ? friendly : (isNumeric ? fmtDistKm(km, units) : km)
          const distLabel = isFriendlyLabel ? 'DISTANCE' : (isNumeric ? distUnit(units) : 'DISTANCE')
          return (
            <div style={st.statBox}>
              <div style={st.statVal}>{distDisplay}</div>
              <div style={st.statLabel}>{distLabel}</div>
            </div>
          )
        })()}
        {/* Pace stat — computed from time + distance */}
        {race.time && race.distance && (() => {
          const { isNumeric } = resolveDistKm(race.distance)
          if (!isNumeric) return null
          const secPerKm = computePaceSecPerKm(race.distance, race.time)
          if (!secPerKm) return null
          const paceStr = fmtPaceSecPerKm(secPerKm, units)
          const [paceVal, paceUnitLabel] = paceStr.split(' ')
          return (
            <div style={st.statBox}>
              <div style={st.statVal}>{paceVal}</div>
              <div style={st.statLabel}>PACE {paceUnitLabel}</div>
            </div>
          )
        })()}
        {race.placing && (
          <div style={st.statBox}>
            <div style={st.statVal}>{race.placing}</div>
            <div style={st.statLabel}>OVERALL</div>
          </div>
        )}
        {race.genderPlacing && (
          <div style={st.statBox}>
            <div style={st.statVal}>{race.genderPlacing}</div>
            <div style={st.statLabel}>GENDER</div>
          </div>
        )}
        {race.agPlacing && (
          <div style={st.statBox}>
            <div style={st.statVal}>{race.agPlacing}</div>
            <div style={st.statLabel}>{race.agLabel || 'AGE GROUP'}</div>
          </div>
        )}
      </div>

      {/* Pill chips — location, priority, medal */}
      {(race.city || race.country || race.priority || race.medal) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {(race.city || race.country) && (
            <span style={st.infoPill}>
              📍 {[race.city, race.country].filter(Boolean).join(', ')}
            </span>
          )}
          {race.priority && (
            <span style={{ ...st.infoPill, ...(race.priority === 'A' ? { borderColor: 'rgba(var(--orange-ch),0.4)', color: 'var(--orange)' } : {}) }}>
              {race.priority === 'A' ? '🎯 A Race' : race.priority === 'B' ? '⭐ B Race' : '🏃 C Race'}
            </span>
          )}
          {race.medal && (
            <span style={{ ...st.infoPill, borderColor: `${medalColor}55`, color: medalColor ?? 'var(--white)' }}>
              {race.medal === 'gold' ? '🥇' : race.medal === 'silver' ? '🥈' : race.medal === 'bronze' ? '🥉' : '🏅'}{' '}
              {race.medal === '__custom__' ? 'Custom' : race.medal.charAt(0).toUpperCase() + race.medal.slice(1)}
            </span>
          )}
        </div>
      )}

      {/* Info rows — remaining details */}
      <div style={st.infoGrid}>
        {race.sport && <InfoRow label="Sport" value={race.sport} />}
        {race.outcome && <InfoRow label="Outcome" value={race.outcome} />}
        {race.bibNumber && <InfoRow label="Bib" value={race.bibNumber} />}
        {race.goalTime && <InfoRow label="Goal Time" value={race.goalTime} />}
        {race.elevation != null && <InfoRow label="Elevation" value={`${race.elevation}m`} />}
        {race.surface && <InfoRow label="Surface" value={race.surface} />}
      </div>

      {/* Splits */}
      {race.splits && race.splits.length > 0 && (
        <div>
          <p style={st.sectionLabel}>SPLITS</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {race.splits.map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</span>
                <span style={{ fontSize: '13px', fontFamily: 'var(--headline)', fontWeight: 700, color: 'var(--white)' }}>
                  {s.cumulative || s.split || '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weather */}
      {race.weather && (race.weather.temp != null || race.weather.condition) && (
        <div>
          <p style={st.sectionLabel}>CONDITIONS</p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {race.weather.temp != null && <InfoChip label="Temp" value={`${race.weather.temp}°C`} />}
            {race.weather.condition && <InfoChip label="Conditions" value={race.weather.condition} />}
            {race.weather.humidity != null && <InfoChip label="Humidity" value={`${race.weather.humidity}%`} />}
            {race.weather.wind != null && <InfoChip label="Wind" value={`${race.weather.wind} km/h`} />}
          </div>
        </div>
      )}

      {/* Notes */}
      {race.notes && (
        <div>
          <p style={st.sectionLabel}>NOTES</p>
          <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5, margin: 0 }}>{race.notes}</p>
        </div>
      )}

      {/* Race photos */}
      {race.photos && race.photos.length > 0 && (
        <div>
          <p style={st.sectionLabel}>PHOTOS</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '6px' }}>
            {race.photos.map((src, i) => (
              <img key={i} src={src} alt={`Photo ${i + 1}`} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        <button style={st.editBtn} onClick={onEdit}>Edit Race</button>
        <button
          style={{ ...st.editBtn, background: 'transparent', border: '1px solid var(--border2)', color: 'var(--muted)' }}
          onClick={onShare}
        >Share</button>
        {confirmDelete ? (
          <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
            <button
              style={{ ...st.deleteConfirmBtn, flex: 1 }}
              onClick={onDelete}
            >Confirm Delete</button>
            <button
              style={{ ...st.cancelBtn, flex: 1 }}
              onClick={() => setConfirmDelete(false)}
            >Cancel</button>
          </div>
        ) : (
          <button style={st.deleteBtn} onClick={() => setConfirmDelete(true)}>Delete</button>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--headline)', fontWeight: 700 }}>
        {label}
      </span>
      <span style={{ fontSize: '13px', color: valueColor ?? 'var(--white)', fontWeight: 500 }}>
        {value}
      </span>
    </div>
  )
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: '6px', padding: '6px 10px' }}>
      <div style={{ fontSize: '9px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: '13px', color: 'var(--white)', fontWeight: 600, marginTop: '2px' }}>{value}</div>
    </div>
  )
}

// ─── Edit panel ───────────────────────────────────────────────────────────────

function EditPanel({ race, onSave, onCancel }: { race: Race; onSave: (patch: Partial<Race>) => void; onCancel: () => void }) {
  const [name, setName]         = useState(race.name ?? '')
  const [sport, setSport]       = useState(race.sport ?? 'Running')
  const [date, setDate]         = useState(race.date ?? '')
  const [city, setCity]         = useState(race.city ?? '')
  const [country, setCountry]   = useState(race.country ?? '')
  const [distance, setDistance] = useState(() => {
    const sportDists = DISTANCES_BY_SPORT[race.sport ?? 'Running'] ?? []
    const match = sportDists.find(d => d.value === race.distance)
    return match ? match.value : '__custom__'
  })
  const [customDist, setCustomDist] = useState(() => {
    const sportDists = DISTANCES_BY_SPORT[race.sport ?? 'Running'] ?? []
    const match = sportDists.find(d => d.value === race.distance)
    return match ? '' : (race.distance ?? '')
  })
  const [outcome, setOutcome]   = useState(race.outcome ?? 'Finished')
  const [time, setTime]         = useState<HMS>(() => {
    const parts = (race.time ?? '').split(':').map(Number)
    return { h: parts[0] ?? 0, m: parts[1] ?? 0, s: parts[2] ?? 0 }
  })
  const [placing, setPlacing]            = useState(race.placing ?? '')
  const [genderPlacing, setGenderPlacing] = useState(race.genderPlacing ?? '')
  const [agPlacing, setAgPlacing]         = useState(race.agPlacing ?? '')
  const [agLabel, setAgLabel]             = useState(race.agLabel ?? '')
  const [medal, setMedal]       = useState(() => {
    if (!race.medal) return ''
    const known = MEDALS.find(m => m.value === race.medal)
    return known ? race.medal : '__custom__'
  })
  const [customMedal, setCustomMedal] = useState(() => {
    const known = MEDALS.find(m => m.value === race.medal)
    return known || !race.medal ? '' : race.medal
  })
  const [priority, setPriority] = useState<'' | 'A' | 'B' | 'C'>(race.priority ?? '')
  const [bibNumber, setBibNumber] = useState(race.bibNumber ?? '')
  const [goalTime, setGoalTime] = useState(race.goalTime ?? '')
  const [notes, setNotes]       = useState(race.notes ?? '')
  const [elevation, setElevation] = useState(race.elevation != null ? String(race.elevation) : '')
  const [surface, setSurface]   = useState(race.surface ?? '')
  const [splits, setSplits]     = useState<Split[]>(race.splits ?? [])
  const [medalPhoto, setMedalPhoto]   = useState<string | undefined>(race.medalPhoto)
  const [bgRemoving, setBgRemoving]   = useState(false)
  const medalInputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos]           = useState<string[]>(race.photos ?? [])
  const [photosUploading, setPhotosUploading] = useState(false)
  const photosInputRef = useRef<HTMLInputElement>(null)

  // Screenshot import state
  const [screenshotParsing, setScreenshotParsing] = useState(false)
  const [screenshotStatus, setScreenshotStatus]   = useState<{ ok: boolean; msg: string } | null>(null)
  const screenshotInputRef = useRef<HTMLInputElement>(null)

  const sportDists = DISTANCES_BY_SPORT[sport] ?? []
  const isCustomDist = CUSTOM_DIST_VALUES.includes(distance)
  const showTime = outcome === 'Finished'

  async function handleMedalPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    // Show original preview immediately
    const originalUrl = URL.createObjectURL(file)
    setMedalPhoto(originalUrl)
    // Auto-remove background
    setBgRemoving(true)
    try {
      const processed = await removeMedalBackground(file)
      setMedalPhoto(processed)
    } catch {
      // Keep original if removal fails — not a blocking error
    } finally {
      setBgRemoving(false)
      URL.revokeObjectURL(originalUrl)
    }
  }

  async function compressPhoto(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const MAX = 1200
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX }
          else { width = Math.round(width * MAX / height); height = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load failed')) }
      img.src = url
    })
  }

  async function handlePhotosSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    e.target.value = ''
    setPhotosUploading(true)
    try {
      const compressed = await Promise.all(files.map(compressPhoto))
      setPhotos(prev => [...prev, ...compressed])
    } catch {
      // silently skip failed compressions
    } finally {
      setPhotosUploading(false)
    }
  }

  async function handleScreenshotImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const apiKey = getClaudeApiKey()
    if (!apiKey) {
      setScreenshotStatus({ ok: false, msg: 'Add your Anthropic API key in Settings first.' })
      e.target.value = ''
      return
    }
    setScreenshotParsing(true)
    setScreenshotStatus(null)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      const parsed = await importRaceScreenshot(base64, file.type, apiKey)
      let fieldsImported = 0
      if (parsed.time) {
        const parts = parsed.time.split(':').map(Number)
        if (parts.length === 3 && !parts.some(isNaN)) {
          setTime({ h: parts[0], m: parts[1], s: parts[2] })
          fieldsImported++
        }
      }
      if (parsed.placing) { setPlacing(parsed.placing); fieldsImported++ }
      if (parsed.splits && parsed.splits.length > 0) { setSplits(parsed.splits); fieldsImported++ }
      setScreenshotStatus({ ok: true, msg: `Imported ${fieldsImported} fields + ${parsed.splits?.length ?? 0} splits` })
      setTimeout(() => setScreenshotStatus(null), 4000)
    } catch (err) {
      setScreenshotStatus({ ok: false, msg: err instanceof Error ? err.message : 'Could not parse. Check your API key.' })
    } finally {
      setScreenshotParsing(false)
      e.target.value = ''
    }
  }

  function handleSave() {
    const effectiveDist = isCustomDist ? customDist : distance
    const effectiveMedal = medal === '__custom__' ? customMedal : medal
    const patch: Partial<Race> = {
      name: name.trim() || undefined,
      sport,
      date,
      city: city.trim() || undefined,
      country: country.trim() || undefined,
      distance: effectiveDist || undefined,
      outcome: outcome || undefined,
      time: (showTime && (time.h || time.m || time.s))
        ? `${time.h}:${String(time.m).padStart(2,'0')}:${String(time.s).padStart(2,'0')}`
        : undefined,
      placing: placing.trim() || undefined,
      genderPlacing: genderPlacing.trim() || undefined,
      agPlacing: agPlacing.trim() || undefined,
      agLabel: agLabel.trim() || undefined,
      medal: effectiveMedal || undefined,
      priority: priority || undefined,
      bibNumber: bibNumber.trim() || undefined,
      goalTime: goalTime.trim() || undefined,
      notes: notes.trim() || undefined,
      elevation: elevation ? Number(elevation) : undefined,
      surface: surface || undefined,
      splits: splits.length > 0 ? splits : undefined,
      medalPhoto: medalPhoto ?? undefined,
      photos: photos.length > 0 ? photos : undefined,
    }
    onSave(patch)
  }

  return (
    <div style={st.body}>
      <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--headline)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        Editing: {race.name || 'Untitled Race'}
      </p>

      <Field label="Race Name">
        <input style={st.input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. London Marathon" />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <Field label="Sport">
          <select style={st.input} value={sport} onChange={e => { setSport(e.target.value); setDistance('') }}>
            {SPORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>

        <Field label="Distance">
          <select style={st.input} value={distance} onChange={e => setDistance(e.target.value)}>
            <option value="">— Select —</option>
            {sportDists.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </Field>
      </div>
      {isCustomDist && (
        <CustomDistInput value={customDist} onChange={setCustomDist} />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <Field label="Date">
          <DateInput value={date} onChange={setDate} />
        </Field>

        <Field label="Outcome">
          <select style={st.input} value={outcome} onChange={e => setOutcome(e.target.value)}>
            {RACE_OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>

      {showTime && (
        <Field label="Finish Time">
          <TimePickerWheel value={time} onChange={setTime} />
        </Field>
      )}

      {/* ── Results screenshot import ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <button
          onClick={() => screenshotInputRef.current?.click()}
          disabled={screenshotParsing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'transparent',
            border: '1px dashed var(--border2)',
            borderRadius: '6px',
            color: 'var(--muted)',
            fontSize: '12px',
            fontFamily: 'var(--body)',
            padding: '8px 12px',
            cursor: 'pointer',
            width: '100%',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: '14px' }}>📸</span>
          {screenshotParsing ? 'Parsing screenshot…' : 'Import results screenshot (auto-fill time + splits)'}
        </button>
        <input
          ref={screenshotInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleScreenshotImport}
        />
        {screenshotStatus && (
          <p style={{ margin: 0, fontSize: '11px', color: screenshotStatus.ok ? 'var(--green)' : '#ff6b6b', lineHeight: 1.4 }}>
            {screenshotStatus.ok ? '✓ ' : '✗ '}{screenshotStatus.msg}
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <Field label="Country">
          <input style={st.input} value={country} onChange={e => setCountry(e.target.value)} placeholder="UK" />
        </Field>
        <Field label="City">
          <input style={st.input} value={city} onChange={e => setCity(e.target.value)} placeholder="London" />
        </Field>
      </div>

      {/* Placing — Overall · Gender · Age Group, three inputs in one row */}
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
            <label style={st.fieldLabel}>OVERALL</label>
            <input style={st.input} value={placing} onChange={e => setPlacing(e.target.value)} placeholder="342/5000" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
            <label style={st.fieldLabel}>GENDER</label>
            <input style={st.input} value={genderPlacing} onChange={e => setGenderPlacing(e.target.value)} placeholder="47/2400" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
            <label style={st.fieldLabel}>AGE GROUP</label>
            <input style={st.input} value={agPlacing} onChange={e => setAgPlacing(e.target.value)} placeholder="3/120" />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
          <label style={st.fieldLabel}>AGE GROUP LABEL</label>
          <input style={st.input} value={agLabel} onChange={e => setAgLabel(e.target.value)} placeholder="e.g. M30-34, F35-39, M Open" />
        </div>
      </div>

      <Field label="Medal">
        <select style={st.input} value={medal} onChange={e => setMedal(e.target.value)}>
          {MEDALS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        {medal === '__custom__' && (
          <input
            style={{ ...st.input, marginTop: '6px' }}
            value={customMedal}
            onChange={e => setCustomMedal(e.target.value)}
            placeholder="e.g. Sub-3 Finisher"
          />
        )}
      </Field>

      {/* Medal Photo + Race Photos — side by side on >360px, stack on tiny screens */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <Field label="Medal Photo">
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            {/* Preview tile */}
            {medalPhoto && (
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <img
                  src={medalPhoto}
                  alt="Medal"
                  style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 6, background: 'var(--surface3)', border: '1px solid var(--border)' }}
                />
                {bgRemoving && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(13,13,13,0.7)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 18 }}>✨</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setMedalPhoto(undefined)}
                  style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--surface3)', border: '1px solid var(--border2)', color: 'var(--muted)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                >×</button>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
              <button
                type="button"
                onClick={() => medalInputRef.current?.click()}
                style={{ ...st.input, cursor: 'pointer', textAlign: 'left', color: 'var(--muted)', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {bgRemoving ? '✨ Removing…' : medalPhoto ? '↺ Replace' : '📷 Upload medal'}
              </button>
              <span style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>
                BG removed auto
              </span>
              <input ref={medalInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleMedalPhotoSelect} />
            </div>
          </div>
        </Field>

        <Field label="Race Photos">
          {photos.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {photos.map((src, i) => (
                <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                  <img src={src} alt={`Photo ${i + 1}`} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                  <button
                    type="button"
                    onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                    style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--surface3)', border: '1px solid var(--border2)', color: 'var(--muted)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                  >×</button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => photosInputRef.current?.click()}
            style={{ ...st.input, cursor: 'pointer', textAlign: 'left', color: 'var(--muted)', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {photosUploading ? '⏳ Compressing…' : '📷 Add photos'}
          </button>
          <input ref={photosInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotosSelect} />
        </Field>
      </div>

      <Field label="Priority">
        <select style={st.input} value={priority} onChange={e => setPriority(e.target.value as '' | 'A' | 'B' | 'C')}>
          {RACE_PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <Field label="Bib Number">
          <input style={st.input} value={bibNumber} onChange={e => setBibNumber(e.target.value)} placeholder="1234" />
        </Field>
        <Field label="Goal Time">
          <input style={st.input} value={goalTime} onChange={e => setGoalTime(e.target.value)} placeholder="3:30:00" />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <Field label="Elevation (m)">
          <input type="number" style={st.input} value={elevation} onChange={e => setElevation(e.target.value)} placeholder="450" />
        </Field>
        <Field label="Surface">
          <select style={st.input} value={surface} onChange={e => setSurface(e.target.value)}>
            <option value="">—</option>
            <option value="road">Road</option>
            <option value="trail">Trail</option>
            <option value="track">Track</option>
          </select>
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          style={{ ...st.input, minHeight: '72px', resize: 'vertical' }}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Anything worth remembering..."
        />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
        <button style={st.cancelBtn} onClick={onCancel}>Cancel</button>
        <button className="btn-v3 btn-primary-v3" style={st.saveBtn} onClick={handleSave}>Save Changes</button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
      <label style={st.fieldLabel}>{label}</label>
      {children}
    </div>
  )
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

export function ViewEditRaceModal({ race, onClose }: Props) {
  const updateRace  = useRaceStore(s => s.updateRace)
  const deleteRace  = useRaceStore(s => s.deleteRace)
  const allRaces    = useRaceStore(s => s.races)
  const athlete     = useAthleteStore(s => s.athlete)
  const [mode, setMode]       = useState<'view' | 'edit'>('view')
  const [showShare, setShowShare] = useState(false)

  const isPB = useMemo(() => _checkIsPB(race, allRaces), [race, allRaces])

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function handleSave(patch: Partial<Race>) {
    updateRace(race.id, patch)
    setMode('view')
  }

  function handleDelete() {
    deleteRace(race.id)
    onClose()
  }

  return createPortal((
    <>
    <div style={st.overlay} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="view-edit-race-modal-title"
        style={st.sheet}
        onClick={e => e.stopPropagation()}
      >
        <div style={st.handle} />

        {/* Header */}
        <div style={st.header}>
          <span id="view-edit-race-modal-title" style={mode === 'edit' ? st.title : st.titleMono}>
            {mode === 'edit' ? 'EDIT RACE' : 'RACE DETAIL'}
          </span>
          <button style={st.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Content — scrollable */}
        <div style={st.scrollBody} onTouchMove={e => e.stopPropagation()}>
          {mode === 'view' ? (
            <ViewPanel
              race={race}
              isPB={isPB}
              onEdit={() => setMode('edit')}
              onDelete={handleDelete}
              onShare={() => setShowShare(true)}
            />
          ) : (
            <EditPanel
              race={race}
              onSave={handleSave}
              onCancel={() => setMode('view')}
            />
          )}
        </div>
      </div>
    </div>

    {/* Share card overlay */}
    {showShare && (
      <RaceShareCard
        race={race}
        athleteName={[athlete?.firstName, athlete?.lastName].filter(Boolean).join(' ') || 'Athlete'}
        onClose={() => setShowShare(false)}
      />
    )}
    </>
  ), document.body)
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    zIndex: 900,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px 0',
    flexShrink: 0,
  } as React.CSSProperties,

  title: {
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '15px',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--white)',
  } as React.CSSProperties,

  titleMono: {
    fontFamily: 'var(--mono)',
    fontWeight: 400,
    fontSize: '11px',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
  } as React.CSSProperties,

  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--muted)',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '4px 8px',
    lineHeight: 1,
  } as React.CSSProperties,

  scrollBody: {
    overflowY: 'auto',
    flex: 1,
    WebkitOverflowScrolling: 'touch' as any,
    overscrollBehavior: 'contain',
  } as React.CSSProperties,

  body: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    paddingBottom: 'calc(var(--safe-bottom) + 32px)',
  } as React.CSSProperties,

  raceName: {
    margin: 0,
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '22px',
    letterSpacing: '0.04em',
    color: 'var(--white)',
  } as React.CSSProperties,

  raceMeta: {
    margin: '4px 0 0',
    fontSize: '13px',
    color: 'var(--muted)',
  } as React.CSSProperties,

  statsRow: {
    display: 'flex',
    gap: '0.75rem',
  } as React.CSSProperties,

  statBox: {
    flex: 1,
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: '8px',
    padding: '10px 12px',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  statVal: {
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '18px',
    color: 'var(--orange)',
  } as React.CSSProperties,

  statLabel: {
    fontSize: '9px',
    color: 'var(--muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    marginTop: '2px',
  } as React.CSSProperties,

  infoGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
  } as React.CSSProperties,

  infoPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 10px',
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: '20px',
    fontSize: '12px',
    color: 'var(--white)',
    fontWeight: 500,
    lineHeight: 1.2,
  } as React.CSSProperties,

  sectionLabel: {
    margin: '0 0 8px',
    fontSize: '10px',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: 'var(--muted)',
  } as React.CSSProperties,

  editBtn: {
    flex: 1,
    background: 'var(--surface3)',
    color: 'var(--orange)',
    border: '1px solid var(--orange)',
    borderRadius: '8px',
    padding: '13px',
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '13px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
  } as React.CSSProperties,

  deleteBtn: {
    background: 'transparent',
    color: '#ff6b6b',
    border: '1px solid rgba(255,107,107,0.4)',
    borderRadius: '8px',
    padding: '13px 16px',
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '12px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
  } as React.CSSProperties,

  deleteConfirmBtn: {
    background: '#ff6b6b',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    padding: '13px',
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '12px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
  } as React.CSSProperties,

  cancelBtn: {
    background: 'transparent',
    color: 'var(--white)',
    border: '1px solid var(--border2)',
    borderRadius: '8px',
    padding: '13px',
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '13px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
  } as React.CSSProperties,

  saveBtn: {
    padding: '13px',
  } as React.CSSProperties,

  fieldLabel: {
    fontSize: '10px',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--muted)',
  } as React.CSSProperties,

  input: {
    width: '100%',
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: '6px',
    color: 'var(--white)',
    fontSize: 'var(--text-sm)',
    // Explicit line-height + padding gives both <input> and <select>
    // the same rendered height regardless of native chrome.
    lineHeight: '1.4',
    padding: '0.6rem 0.75rem',
    height: '40px',
    fontFamily: 'var(--body)',
    boxSizing: 'border-box' as const,
    minWidth: 0,
  } as React.CSSProperties,
}

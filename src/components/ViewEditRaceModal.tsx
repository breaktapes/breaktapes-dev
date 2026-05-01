import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRaceStore } from '@/stores/useRaceStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/env'
import { RaceShareCard } from '@/components/RaceShareCard'
import { DateInput } from '@/components/DateInput'
import { CustomDistInput } from '@/components/CustomDistInput'
import { CityPicker } from '@/components/CityPicker'
import { TimePickerWheel, type HMS } from '@/components/TimePickerWheel'
import type { Race, Split } from '@/types'
import { useUnits, fmtDistKm, distUnit, fmtPaceSecPerKm, computePaceSecPerKm } from '@/lib/units'
import { removeMedalBackground } from '@/lib/removeBg'
import { findSportDistMatch, distLabel as distLabelUtil, fmtDateDDMM } from '@/lib/utils'

// ─── Config (mirrors AddRaceModal) ──────────────────────────────────────────

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
    { label: 'PTO T100', value: '112' },
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
  { value: 'A', label: 'A Race — Goal Event' },
  { value: 'B', label: 'B Race — Important' },
  { value: 'C', label: 'C Race — Training / Fun' },
]

const MEDALS = [
  { value: '',         label: 'None' },
  { value: 'gold',     label: 'Gold' },
  { value: 'silver',   label: 'Silver' },
  { value: 'bronze',   label: 'Bronze' },
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
  return fmtDateDDMM(dateStr) || '—'
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


function _wmoCondition(code: number): string {
  if (code === 0)             return 'Clear sky'
  if (code <= 3)              return 'Partly cloudy'
  if (code <= 49)             return 'Foggy'
  if (code <= 57)             return 'Drizzle'
  if (code <= 67)             return 'Rain'
  if (code <= 77)             return 'Snow'
  if (code <= 82)             return 'Rain showers'
  if (code <= 86)             return 'Snow showers'
  if (code <= 99)             return 'Thunderstorm'
  return 'Unknown'
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
  initialMode?: 'view' | 'edit'
  isUpcoming?: boolean
}

// ─── View panel (read mode) ───────────────────────────────────────────────────

function ViewPanel({ race, isPB, onEdit, onDelete, onShare }: { race: Race; isPB: boolean; onEdit: () => void; onDelete: () => void; onShare: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [resubmitting, setResubmitting]   = useState(false)
  const [resubmitDone, setResubmitDone]   = useState(false)
  const medalColor = race.medal ? (MEDAL_COLORS[race.medal] ?? 'var(--orange)') : null
  const units = useUnits()
  const authUser = useAuthStore(s => s.authUser)

  async function handleResubmit() {
    if (!authUser || resubmitting) return
    setResubmitting(true)
    try {
      const [year, month, day] = (race.date ?? '').split('-').map(Number)
      const distKm = race.distance ? parseFloat(resolveDistKm(race.distance).km) || null : null
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/upsert_catalog_contribution`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_name:           race.name        ?? '',
          p_city:           race.city        ?? '',
          p_country:        race.country     ?? '',
          p_sport:          race.sport       ?? '',
          p_dist_label:     race.distance    ?? '',
          p_dist_km:        distKm,
          p_year:           year   || null,
          p_event_date:     race.date        ?? null,
          p_month:          month  || null,
          p_day:            day    || null,
          p_contributor_id: authUser.id,
        }),
      })
      if (res.ok) setResubmitDone(true)
    } finally {
      setResubmitting(false)
    }
  }

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
          <div style={{ ...st.statBox, ...(isPB ? { borderColor: 'rgba(var(--gold-ch),0.45)', background: 'rgba(var(--gold-ch),0.07)' } : {}) }}>
            <div style={{ ...st.statVal, color: isPB ? 'var(--gold)' : 'var(--orange)' }}>{race.time}</div>
            <div style={{ ...st.statLabel, ...(isPB ? { color: 'rgba(var(--gold-ch),0.7)' } : {}) }}>
              {isPB ? '★ PERSONAL BEST' : 'FINISH TIME'}
            </div>
          </div>
        )}
        {race.distance && (() => {
          const friendly = distLabelUtil(race.distance)
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
              {[race.city, race.country].filter(Boolean).join(', ')}
            </span>
          )}
          {race.priority && (
            <span style={{ ...st.infoPill, ...(race.priority === 'A' ? { borderColor: 'rgba(var(--orange-ch),0.4)', color: 'var(--orange)' } : {}) }}>
              {race.priority === 'A' ? 'A Race' : race.priority === 'B' ? 'B Race' : 'C Race'}
            </span>
          )}
          {race.medal && (
            <span style={{ ...st.infoPill, borderColor: `${medalColor}55`, color: medalColor ?? 'var(--white)' }}>
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
      {/* Re-submit to catalog */}
      {race.name && (
        <button
          style={{
            width: '100%', marginTop: '0.5rem', padding: '10px',
            background: resubmitDone ? 'rgba(var(--green-ch),0.08)' : 'transparent',
            border: `1px solid ${resubmitDone ? 'rgba(var(--green-ch),0.3)' : 'var(--border2)'}`,
            borderRadius: 8, color: resubmitDone ? 'var(--green)' : 'var(--muted)',
            fontSize: '12px', cursor: resubmitting ? 'default' : 'pointer',
            fontFamily: 'var(--headline)', letterSpacing: '0.05em',
          }}
          onClick={handleResubmit}
          disabled={resubmitting || resubmitDone}
        >
          {resubmitDone ? '✓ Sent for re-approval' : resubmitting ? 'Submitting…' : '↑ Send for re-approval'}
        </button>
      )}
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

function EditPanel({ race, onSave, onCancel, isUpcoming = false }: { race: Race; onSave: (patch: Partial<Race>) => void; onCancel: () => void; isUpcoming?: boolean }) {
  const [name, setName]         = useState(race.name ?? '')
  const [sport, setSport]       = useState(race.sport ?? 'Running')
  const [date, setDate]         = useState(race.date ?? '')
  const [city, setCity]         = useState(race.city ?? '')
  const [country, setCountry]   = useState(race.country ?? '')
  const [lat, setLat]           = useState<number | undefined>(race.lat)
  const [lng, setLng]           = useState<number | undefined>(race.lng)
  const [distance, setDistance] = useState(() => {
    const sportDists = DISTANCES_BY_SPORT[race.sport ?? 'Running'] ?? []
    const matched = findSportDistMatch(race.distance ?? '', sportDists)
    return matched ?? '__custom__'
  })
  const [customDist, setCustomDist] = useState(() => {
    const sportDists = DISTANCES_BY_SPORT[race.sport ?? 'Running'] ?? []
    const matched = findSportDistMatch(race.distance ?? '', sportDists)
    return matched ? '' : (race.distance ?? '')
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
  const [goalHMS, setGoalHMS] = useState<HMS>(() => {
    const parts = (race.goalTime ?? '').split(':').map(Number)
    return { h: parts[0] || 0, m: parts[1] || 0, s: parts[2] || 0 }
  })
  const [notes, setNotes]       = useState(race.notes ?? '')
  const [elevation, setElevation] = useState(race.elevation != null ? String(race.elevation) : '')
  const [surface, setSurface]   = useState(race.surface ?? '')
  const [roleAtRace, setRoleAtRace] = useState<'' | 'runner' | 'pacer' | 'guide'>(race.roleAtRace ?? '')
  const [splits]                = useState<Split[]>(race.splits ?? [])
  // More Stats
  const [moreOpen, setMoreOpen]           = useState(false)
  const [startTime, setStartTime]         = useState(race.startTime ?? '')
  const [avgHeartRate, setAvgHeartRate]   = useState(race.avgHeartRate != null ? String(race.avgHeartRate) : '')
  const [terrain, setTerrain]             = useState(race.terrain ?? '')
  const [shoe, setShoe]                   = useState(race.shoe ?? '')
  const [weatherTemp, setWeatherTemp]     = useState(race.weather?.temp != null ? String(race.weather.temp) : '')
  const [weatherCond, setWeatherCond]     = useState(race.weather?.condition ?? '')
  const [weatherWind, setWeatherWind]     = useState(race.weather?.wind != null ? String(race.weather.wind) : '')
  const [weatherHum, setWeatherHum]       = useState(race.weather?.humidity != null ? String(race.weather.humidity) : '')
  const [weatherFetching, setWeatherFetching] = useState(false)
  const [weatherFetchMsg, setWeatherFetchMsg] = useState<{ ok: boolean; msg: string } | null>(null)
  const [medalPhoto, setMedalPhoto]   = useState<string | undefined>(race.medalPhoto)
  const [bgRemoving, setBgRemoving]   = useState(false)
  const medalInputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos]           = useState<string[]>(race.photos ?? [])
  const [photosUploading, setPhotosUploading] = useState(false)
  const photosInputRef = useRef<HTMLInputElement>(null)


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

  async function autoFillWeather() {
    if (!lat || !lng || !date) {
      setWeatherFetchMsg({ ok: false, msg: 'Need city + date first' })
      return
    }
    setWeatherFetching(true)
    setWeatherFetchMsg(null)
    try {
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${date}&end_date=${date}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&wind_speed_unit=kmh&timezone=auto`
      const res = await fetch(url)
      if (!res.ok) throw new Error('API error')
      const data = await res.json()

      // Use startTime hour if set, otherwise 9 AM default
      const startHour = startTime ? parseInt(startTime.split(':')[0], 10) : 9
      // Estimate race duration in hours from existing time state
      const totalSecs = time.h * 3600 + time.m * 60 + time.s
      const durationHrs = totalSecs > 0 ? Math.ceil(totalSecs / 3600) : 1
      const endHour = Math.min(startHour + durationHrs, 23)

      // Average hourly readings across race window
      const slice = (arr: number[]) => arr.slice(startHour, endHour + 1).filter(v => v != null)
      const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null

      const temps = slice(data.hourly.temperature_2m ?? [])
      const hums  = slice(data.hourly.relative_humidity_2m ?? [])
      const winds = slice(data.hourly.wind_speed_10m ?? [])
      const codes = slice(data.hourly.weather_code ?? [])

      const avgTemp = avg(temps)
      const avgHum  = avg(hums)
      const avgWind = avg(winds)
      const dominantCode = codes.length ? codes[Math.floor(codes.length / 2)] : null

      if (avgTemp != null) setWeatherTemp(String(avgTemp))
      if (avgHum  != null) setWeatherHum(String(avgHum))
      if (avgWind != null) setWeatherWind(String(avgWind))
      if (dominantCode != null) setWeatherCond(_wmoCondition(dominantCode))

      setWeatherFetchMsg({ ok: true, msg: `Filled from ${durationHrs}h window (${startHour}:00–${endHour}:00)` })
      setTimeout(() => setWeatherFetchMsg(null), 4000)
    } catch {
      setWeatherFetchMsg({ ok: false, msg: 'Could not fetch weather. Try manually.' })
    } finally {
      setWeatherFetching(false)
    }
  }

  function handleSave() {
    const effectiveDist = isCustomDist ? customDist : distance
    const effectiveMedal = medal === '__custom__' ? customMedal : medal
    const hasGoalHMS = goalHMS.h > 0 || goalHMS.m > 0 || goalHMS.s > 0
    // Sport required for ultra distances (>42.3km) — otherwise ultra achievements can't unlock
    if (!isUpcoming && parseFloat(effectiveDist) > 42.3 && !sport) {
      alert('Sport is required for ultra distances (>42km). Please select a sport.')
      return
    }
    const patch: Partial<Race> = {
      name: name.trim() || undefined,
      sport,
      date,
      city: city.trim() || undefined,
      country: country.trim() || undefined,
      lat,
      lng,
      distance: effectiveDist || undefined,
      outcome: isUpcoming ? undefined : (outcome || undefined),
      time: isUpcoming ? undefined : (showTime && (time.h || time.m || time.s))
        ? `${time.h}:${String(time.m).padStart(2,'0')}:${String(time.s).padStart(2,'0')}`
        : undefined,
      placing: isUpcoming ? undefined : placing.trim() || undefined,
      genderPlacing: isUpcoming ? undefined : genderPlacing.trim() || undefined,
      agPlacing: isUpcoming ? undefined : agPlacing.trim() || undefined,
      agLabel: isUpcoming ? undefined : agLabel.trim() || undefined,
      medal: isUpcoming ? undefined : effectiveMedal || undefined,
      priority: priority || undefined,
      bibNumber: isUpcoming ? undefined : bibNumber.trim() || undefined,
      goalTime: isUpcoming
        ? (hasGoalHMS ? `${goalHMS.h}:${String(goalHMS.m).padStart(2,'0')}:${String(goalHMS.s).padStart(2,'0')}` : undefined)
        : goalTime.trim() || undefined,
      notes: notes.trim() || undefined,
      elevation: isUpcoming ? undefined : elevation ? Number(elevation) : undefined,
      surface: isUpcoming ? undefined : surface || undefined,
      roleAtRace: isUpcoming ? undefined : (roleAtRace || undefined) as 'runner' | 'pacer' | 'guide' | undefined,
      splits: isUpcoming ? undefined : splits.length > 0 ? splits : undefined,
      medalPhoto: isUpcoming ? undefined : medalPhoto ?? undefined,
      photos: isUpcoming ? undefined : photos.length > 0 ? photos : undefined,
      startTime: isUpcoming ? undefined : startTime.trim() || undefined,
      avgHeartRate: isUpcoming ? undefined : avgHeartRate ? Number(avgHeartRate) : undefined,
      terrain: isUpcoming ? undefined : terrain || undefined,
      shoe: isUpcoming ? undefined : shoe.trim() || undefined,
      weather: isUpcoming ? undefined : (weatherTemp || weatherCond || weatherWind || weatherHum) ? {
        temp: weatherTemp ? Number(weatherTemp) : undefined,
        condition: weatherCond || undefined,
        wind: weatherWind ? Number(weatherWind) : undefined,
        humidity: weatherHum ? Number(weatherHum) : undefined,
      } : race.weather,
    }
    // Require sport for ultra distances
    if (!isUpcoming && effectiveDist && parseFloat(effectiveDist) > 42.3 && !sport) {
      alert('Sport is required for ultra distances (>42km). Please select a sport.')
      return
    }
    onSave(patch)
  }

  return (
    <div style={st.body}>
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

        {!isUpcoming && (
          <Field label="Outcome">
            <select style={st.input} value={outcome} onChange={e => setOutcome(e.target.value)}>
              {RACE_OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        )}
      </div>

      {!isUpcoming && showTime && (
        <Field label="Finish Time">
          <TimePickerWheel value={time} onChange={setTime} />
        </Field>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <Field label="City">
          <CityPicker
            city={city}
            country={country}
            placeholder="Type to search…"
            onSelect={({ city: c, country: co, lat: la, lng: ln }) => {
              setCity(c)
              if (co) setCountry(co)
              setLat(la)
              setLng(ln)
            }}
          />
        </Field>
        <Field label="Country">
          <input style={st.input} value={country} onChange={e => setCountry(e.target.value)} placeholder="Auto-filled" />
        </Field>
      </div>

      <Field label="Priority">
        <select style={st.input} value={priority} onChange={e => setPriority(e.target.value as '' | 'A' | 'B' | 'C')}>
          {RACE_PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </Field>

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

      {isUpcoming ? (
        <Field label={<>Goal Time <span style={{ opacity: 0.5, fontWeight: 400, fontSize: '11px', textTransform: 'lowercase', letterSpacing: 0 }}>(optional)</span></>}>
          <TimePickerWheel value={goalHMS} onChange={setGoalHMS} maxHours={99} />
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px' }}>Scroll to set · Used by Gap To Goal widget</div>
        </Field>
      ) : null}

      <Field label="Notes">
        <textarea
          style={{ ...st.input, minHeight: '72px', resize: 'vertical' }}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Anything worth remembering..."
        />
      </Field>

      {/* ── More Stats ── */}
      {!isUpcoming && (
        <div>
          <button
            type="button"
            onClick={() => setMoreOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'transparent', border: 'none', padding: '4px 0',
              color: 'var(--muted)', fontSize: '11px', fontFamily: 'var(--headline)',
              fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              cursor: 'pointer', width: '100%',
            }}
          >
            <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: moreOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
            More Stats
          </button>

          {moreOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Field label="Bib Number">
                  <input style={st.input} value={bibNumber} onChange={e => setBibNumber(e.target.value)} placeholder="1234" />
                </Field>
                <Field label="Goal Time">
                  <input style={st.input} value={goalTime} onChange={e => setGoalTime(e.target.value)} placeholder="3:30:00" />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Field label="Start Time">
                  <input type="time" style={st.input} value={startTime} onChange={e => setStartTime(e.target.value)} />
                </Field>
                <Field label="Avg Heart Rate (bpm)">
                  <input type="number" style={st.input} value={avgHeartRate} onChange={e => setAvgHeartRate(e.target.value)} placeholder="155" />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Field label="Surface">
                  <select style={st.input} value={surface} onChange={e => setSurface(e.target.value)}>
                    <option value="">—</option>
                    <option value="road">Road</option>
                    <option value="trail">Trail</option>
                    <option value="track">Track</option>
                    <option value="desert">Desert</option>
                    <option value="coastal">Coastal</option>
                  </select>
                </Field>
                <Field label="Terrain">
                  <select style={st.input} value={terrain} onChange={e => setTerrain(e.target.value)}>
                    <option value="">—</option>
                    <option value="flat">Flat</option>
                    <option value="rolling">Rolling</option>
                    <option value="hilly">Hilly</option>
                    <option value="mountainous">Mountainous</option>
                  </select>
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Field label="Elevation (m)">
                  <input type="number" style={st.input} value={elevation} onChange={e => setElevation(e.target.value)} placeholder="450" />
                </Field>
                <Field label="Shoe / Kit">
                  <input style={st.input} value={shoe} onChange={e => setShoe(e.target.value)} placeholder="e.g. Vaporfly 3" />
                </Field>
              </div>

              <Field label="Role at Race">
                <select style={st.input} value={roleAtRace} onChange={e => setRoleAtRace(e.target.value as '' | 'runner' | 'pacer' | 'guide')}>
                  <option value="">Runner (default)</option>
                  <option value="runner">Runner</option>
                  <option value="pacer">Pacer</option>
                  <option value="guide">Guide (first-timer guide)</option>
                </select>
              </Field>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <p style={{ margin: 0, fontSize: '10px', color: 'var(--muted)', fontFamily: 'var(--headline)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Weather</p>
                <button
                  type="button"
                  onClick={autoFillWeather}
                  disabled={weatherFetching || !lat || !lng || !date}
                  style={{
                    background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: '6px',
                    color: (!lat || !lng || !date) ? 'var(--muted2)' : 'var(--orange)',
                    fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700,
                    letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 10px',
                    cursor: (!lat || !lng || !date) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {weatherFetching ? 'Fetching…' : 'Auto-fill'}
                </button>
              </div>
              {weatherFetchMsg && (
                <p style={{ margin: '-8px 0 0', fontSize: '11px', color: weatherFetchMsg.ok ? 'var(--green)' : 'var(--error)' }}>
                  {weatherFetchMsg.msg}
                </p>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Field label="Temp (°C)">
                  <input type="number" style={st.input} value={weatherTemp} onChange={e => setWeatherTemp(e.target.value)} placeholder="18" />
                </Field>
                <Field label="Conditions">
                  <input style={st.input} value={weatherCond} onChange={e => setWeatherCond(e.target.value)} placeholder="Sunny, light wind" />
                </Field>
                <Field label="Wind (km/h)">
                  <input type="number" style={st.input} value={weatherWind} onChange={e => setWeatherWind(e.target.value)} placeholder="12" />
                </Field>
                <Field label="Humidity (%)">
                  <input type="number" style={st.input} value={weatherHum} onChange={e => setWeatherHum(e.target.value)} placeholder="65" />
                </Field>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
        <button style={st.cancelBtn} onClick={onCancel}>Cancel</button>
        <button className="btn-v3 btn-primary-v3" style={st.saveBtn} onClick={handleSave}>Save Changes</button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
      <label style={st.fieldLabel}>{label}</label>
      {children}
    </div>
  )
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

export function ViewEditRaceModal({ race, onClose, initialMode = 'view', isUpcoming = false }: Props) {
  const updateRace  = useRaceStore(s => s.updateRace)
  const deleteRace  = useRaceStore(s => s.deleteRace)
  const allRaces    = useRaceStore(s => s.races)
  const athlete     = useAthleteStore(s => s.athlete)
  const [mode, setMode]       = useState<'view' | 'edit'>(initialMode)
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
              isUpcoming={isUpcoming}
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
    backdropFilter: 'blur(8px)',
    zIndex: 900,
    display: 'flex',
    alignItems: 'flex-end',
  } as React.CSSProperties,

  sheet: {
    width: '100%',
    maxHeight: '92dvh',
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
    fontSize: '18px',
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
    fontSize: 'var(--text-xs)',
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
    color: 'var(--error)',
    border: '1px solid rgba(var(--error-ch),0.4)',
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
    background: 'var(--error)',
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
    fontSize: 'var(--text-xs)',
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

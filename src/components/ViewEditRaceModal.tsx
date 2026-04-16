import { useState } from 'react'
import { useRaceStore } from '@/stores/useRaceStore'
import type { Race } from '@/types'

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
    { label: 'Sprint (25.75km)',   value: '25.75' },
    { label: 'Olympic (51.5km)',   value: '51.5' },
    { label: 'Half Iron (113km)',  value: '113' },
    { label: 'Full Iron (226km)',  value: '226' },
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

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  race: Race
  onClose: () => void
}

// ─── View panel (read mode) ───────────────────────────────────────────────────

function ViewPanel({ race, onEdit, onDelete }: { race: Race; onEdit: () => void; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const medalColor = race.medal ? (MEDAL_COLORS[race.medal] ?? 'var(--orange)') : null

  return (
    <div style={st.body}>
      {/* Name + date */}
      <div>
        <h2 style={st.raceName}>{race.name || 'Untitled Race'}</h2>
        <p style={st.raceMeta}>{fmtDate(race.date)}</p>
      </div>

      {/* Key stats row */}
      <div style={st.statsRow}>
        {race.time && (
          <div style={st.statBox}>
            <div style={st.statVal}>{race.time}</div>
            <div style={st.statLabel}>FINISH TIME</div>
          </div>
        )}
        {race.distance && (
          <div style={st.statBox}>
            <div style={st.statVal}>{race.distance}</div>
            <div style={st.statLabel}>KM</div>
          </div>
        )}
        {race.placing && (
          <div style={st.statBox}>
            <div style={st.statVal}>{race.placing}</div>
            <div style={st.statLabel}>PLACING</div>
          </div>
        )}
      </div>

      {/* Info rows */}
      <div style={st.infoGrid}>
        {race.sport && <InfoRow label="Sport" value={race.sport} />}
        {(race.city || race.country) && <InfoRow label="Location" value={[race.city, race.country].filter(Boolean).join(', ')} />}
        {race.outcome && <InfoRow label="Outcome" value={race.outcome} />}
        {race.priority && (
          <InfoRow label="Priority" value={
            race.priority === 'A' ? '🎯 A Race' :
            race.priority === 'B' ? '⭐ B Race' : '🏃 C Race'
          } />
        )}
        {race.medal && (
          <InfoRow
            label="Medal"
            value={race.medal === '__custom__' ? 'Custom' : race.medal.charAt(0).toUpperCase() + race.medal.slice(1)}
            valueColor={medalColor ?? undefined}
          />
        )}
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

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
        <button style={st.editBtn} onClick={onEdit}>Edit Race</button>
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
  const [time, setTime]         = useState(race.time ?? '')
  const [placing, setPlacing]   = useState(race.placing ?? '')
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

  const sportDists = DISTANCES_BY_SPORT[sport] ?? []
  const isCustomDist = CUSTOM_DIST_VALUES.includes(distance)
  const showTime = outcome === 'Finished'

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
      time: (showTime && time.trim()) ? time.trim() : undefined,
      placing: placing.trim() || undefined,
      medal: effectiveMedal || undefined,
      priority: priority || undefined,
      bibNumber: bibNumber.trim() || undefined,
      goalTime: goalTime.trim() || undefined,
      notes: notes.trim() || undefined,
      elevation: elevation ? Number(elevation) : undefined,
      surface: surface || undefined,
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
        {isCustomDist && (
          <input
            style={{ ...st.input, marginTop: '6px' }}
            value={customDist}
            onChange={e => setCustomDist(e.target.value)}
            placeholder="e.g. 42.2"
          />
        )}
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <Field label="Date">
          <input type="date" style={st.input} value={date} onChange={e => setDate(e.target.value)} />
        </Field>
        <Field label="Outcome">
          <select style={st.input} value={outcome} onChange={e => setOutcome(e.target.value)}>
            {RACE_OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>

      {showTime && (
        <Field label="Finish Time (H:MM:SS)">
          <input style={st.input} value={time} onChange={e => setTime(e.target.value)} placeholder="3:45:00" />
        </Field>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <Field label="Country">
          <input style={st.input} value={country} onChange={e => setCountry(e.target.value)} placeholder="UK" />
        </Field>
        <Field label="City">
          <input style={st.input} value={city} onChange={e => setCity(e.target.value)} placeholder="London" />
        </Field>
      </div>

      <Field label="Placing">
        <input style={st.input} value={placing} onChange={e => setPlacing(e.target.value)} placeholder="342/5000 or 3rd AG" />
      </Field>

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
        <button style={st.saveBtn} onClick={handleSave}>Save Changes</button>
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
  const updateRace = useRaceStore(s => s.updateRace)
  const deleteRace = useRaceStore(s => s.deleteRace)
  const [mode, setMode] = useState<'view' | 'edit'>('view')

  function handleSave(patch: Partial<Race>) {
    updateRace(race.id, patch)
    setMode('view')
  }

  function handleDelete() {
    deleteRace(race.id)
    onClose()
  }

  return (
    <div style={st.overlay} onClick={onClose}>
      <div style={st.sheet} onClick={e => e.stopPropagation()}>
        <div style={st.handle} />

        {/* Header */}
        <div style={st.header}>
          <span style={st.title}>{mode === 'edit' ? 'EDIT RACE' : 'RACE DETAIL'}</span>
          <button style={st.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Content — scrollable */}
        <div style={st.scrollBody} onTouchMove={e => e.stopPropagation()}>
          {mode === 'view' ? (
            <ViewPanel
              race={race}
              onEdit={() => setMode('edit')}
              onDelete={handleDelete}
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
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = {
  overlay: {
    position: 'fixed',
    top: 'calc(var(--header-base-height) + var(--safe-top))',
    left: 0,
    right: 0,
    bottom: 'calc(var(--bottom-nav-base-height) + var(--safe-bottom))',
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
  } as React.CSSProperties,

  body: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    paddingBottom: '32px',
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
    background: 'var(--orange)',
    color: 'var(--black)',
    border: 'none',
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
    background: 'var(--orange)',
    color: 'var(--black)',
    border: 'none',
    borderRadius: '8px',
    padding: '13px',
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '13px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
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
    padding: '0.6rem 0.75rem',
    fontFamily: 'var(--body)',
    boxSizing: 'border-box' as const,
    minWidth: 0,
  } as React.CSSProperties,
}

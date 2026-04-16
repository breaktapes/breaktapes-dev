import { useState } from 'react'
import { useRaceStore } from '@/stores/useRaceStore'
import type { Race } from '@/types'

const SPORT_OPTIONS = ['Running', 'Triathlon', 'Cycling', 'Swimming', 'Trail Running', 'Ultra', 'Duathlon', 'Other']
const DISTANCE_PRESETS = ['5', '10', '21.1', '42.2', '1.5', '3', '5 (tri)', '25.75', '51.5', '113', '226']
const MEDAL_OPTIONS = ['', 'gold', 'silver', 'bronze', 'finisher']

interface Props {
  onClose: () => void
}

function secsToHMS(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.round(secs % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function AddRaceModal({ onClose }: Props) {
  const addRace = useRaceStore(s => s.addRace)

  const [name, setName]           = useState('')
  const [date, setDate]           = useState(() => new Date().toISOString().split('T')[0])
  const [city, setCity]           = useState('')
  const [country, setCountry]     = useState('')
  const [distance, setDistance]   = useState('42.2')
  const [customDist, setCustomDist] = useState('')
  const [sport, setSport]         = useState('Running')
  const [time, setTime]           = useState('')
  const [placing, setPlacing]     = useState('')
  const [medal, setMedal]         = useState('')
  const [error, setError]         = useState('')
  const [saving, setSaving]       = useState(false)

  const finalDist = distance === '__custom__' ? customDist : distance

  function validate(): boolean {
    if (!name.trim()) { setError('Race name is required'); return false }
    if (!date) { setError('Date is required'); return false }
    if (!finalDist) { setError('Distance is required'); return false }
    setError('')
    return true
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    const race: Race = {
      id: crypto.randomUUID(),
      name: name.trim(),
      date,
      city: city.trim() || undefined,
      country: country.trim() || undefined,
      distance: finalDist,
      sport,
      time: time.trim() || undefined,
      placing: placing.trim() || undefined,
      medal: (medal as Race['medal']) || undefined,
    }
    addRace(race)
    setSaving(false)
    onClose()
  }

  return (
    <div style={st.overlay} onClick={onClose}>
      <div style={st.sheet} onClick={e => e.stopPropagation()}>
        {/* Handle */}
        <div style={st.handle} />

        <div style={st.header}>
          <span style={st.title}>LOG A RACE</span>
          <button style={st.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div style={st.body}>
          {/* Name */}
          <Field label="Race Name *">
            <input
              style={st.input}
              placeholder="e.g. Berlin Marathon"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </Field>

          {/* Date */}
          <Field label="Date *">
            <input
              type="date"
              style={st.input}
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </Field>

          {/* Distance */}
          <Field label="Distance *">
            <select
              style={st.input}
              value={distance}
              onChange={e => setDistance(e.target.value)}
            >
              <option value="5">5K</option>
              <option value="10">10K</option>
              <option value="21.1">Half Marathon</option>
              <option value="42.2">Marathon</option>
              <option value="1.5">1.5K (swim)</option>
              <option value="3">3K</option>
              <option value="51.5">Olympic Tri (51.5K)</option>
              <option value="113">Half Iron (113K)</option>
              <option value="226">Full Iron (226K)</option>
              <option value="__custom__">Custom…</option>
            </select>
            {distance === '__custom__' && (
              <input
                style={{ ...st.input, marginTop: '6px' }}
                placeholder="Distance in km"
                type="number"
                value={customDist}
                onChange={e => setCustomDist(e.target.value)}
              />
            )}
          </Field>

          {/* Sport */}
          <Field label="Sport">
            <select style={st.input} value={sport} onChange={e => setSport(e.target.value)}>
              {SPORT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          {/* Location row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', minWidth: 0 }}>
            <Field label="City">
              <input style={st.input} placeholder="e.g. Berlin" value={city} onChange={e => setCity(e.target.value)} />
            </Field>
            <Field label="Country">
              <input style={st.input} placeholder="e.g. Germany" value={country} onChange={e => setCountry(e.target.value)} />
            </Field>
          </div>

          {/* Time */}
          <Field label="Finish Time">
            <input
              style={st.input}
              placeholder="H:MM:SS or MM:SS"
              value={time}
              onChange={e => setTime(e.target.value)}
            />
          </Field>

          {/* Placing + Medal row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', minWidth: 0 }}>
            <Field label="Placing">
              <input style={st.input} placeholder="e.g. 342/5000" value={placing} onChange={e => setPlacing(e.target.value)} />
            </Field>
            <Field label="Medal">
              <select style={st.input} value={medal} onChange={e => setMedal(e.target.value)}>
                <option value="">None</option>
                <option value="gold">Gold</option>
                <option value="silver">Silver</option>
                <option value="bronze">Bronze</option>
                <option value="finisher">Finisher</option>
              </select>
            </Field>
          </div>

          {error && (
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: '#ff6b6b', fontFamily: 'var(--body)' }}>
              {error}
            </p>
          )}

          <button style={st.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'SAVING…' : 'SAVE RACE'}
          </button>
        </div>
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

const st = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    zIndex: 950,
    display: 'flex',
    alignItems: 'flex-end',
  } as React.CSSProperties,

  sheet: {
    width: '100%',
    maxHeight: '90vh',
    background: 'var(--surface2)',
    borderTop: '1px solid var(--border2)',
    borderRadius: '16px 16px 0 0',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch' as any,
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
    padding: '16px 16px 0',
    flexShrink: 0,
  } as React.CSSProperties,

  title: {
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '16px',
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

  body: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    paddingBottom: '32px',
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
    marginTop: '4px',
  } as React.CSSProperties,
}

import React, { useState } from 'react'

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface3)',
  border: '1px solid var(--border2)',
  borderRadius: '6px',
  color: 'var(--white)',
  fontSize: 'var(--text-sm)',
  padding: '0.6rem 0.75rem',
  fontFamily: 'var(--body)',
  boxSizing: 'border-box',
}

interface Props {
  value: string          // stored as km string e.g. "42.2"
  onChange: (km: string) => void
  placeholder?: string
}

/** km ↔ mi helpers */
const KM_PER_MI = 1.60934
function miToKm(mi: number) { return (mi * KM_PER_MI).toFixed(2) }
function kmToMi(km: number) { return (km / KM_PER_MI).toFixed(2) }

export function CustomDistInput({ value, onChange, placeholder }: Props) {
  const [unit, setUnit] = useState<'km' | 'mi'>('km')

  // Display value: if unit is mi, convert stored km to miles
  const display = (() => {
    if (!value) return ''
    const n = parseFloat(value)
    if (isNaN(n)) return value
    return unit === 'mi' ? kmToMi(n) : value
  })()

  function handleChange(raw: string) {
    if (!raw) { onChange(''); return }
    const n = parseFloat(raw)
    if (isNaN(n)) { onChange(raw); return }
    onChange(unit === 'mi' ? miToKm(n) : raw)
  }

  function toggleUnit(next: 'km' | 'mi') {
    if (next === unit) return
    setUnit(next)
    // Re-derive display value — onChange already stores km, no re-conversion needed
  }

  return (
    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
      <input
        style={{ ...inputStyle, flex: 1 }}
        type="text"
        inputMode="decimal"
        value={display}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder ?? (unit === 'km' ? 'e.g. 42.2' : 'e.g. 26.2')}
      />
      <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border2)', flexShrink: 0 }}>
        {(['km', 'mi'] as const).map(u => (
          <button
            key={u}
            type="button"
            onClick={() => toggleUnit(u)}
            style={{
              padding: '0 12px',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--headline)',
              fontWeight: 700,
              fontSize: '12px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              background: unit === u ? 'var(--orange)' : 'var(--surface3)',
              color: unit === u ? 'var(--black)' : 'var(--muted)',
              transition: 'background 0.15s',
            }}
          >
            {u}
          </button>
        ))}
      </div>
    </div>
  )
}

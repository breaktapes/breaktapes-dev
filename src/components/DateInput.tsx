/**
 * DateInput — uniform date picker across iOS Safari and Android Chrome.
 *
 * input[type=date] on iOS Safari has an intrinsic min-width tied to the
 * native date display ("November 30, 2024" ≈ 220px) that overflows
 * narrow grid columns if you don't explicitly strip its native styling.
 *
 * Fix: -webkit-appearance: none + appearance: none removes the intrinsic
 * width while keeping the native date picker tap behaviour.
 * min-width: 0 + width: 100% + max-width: 100% ensures it fills its
 * container without blowing past it.
 */

import type { CSSProperties } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  style?: CSSProperties
  min?: string
  max?: string
  'aria-label'?: string
}

export const dateInputStyle: CSSProperties = {
  width:              '100%',
  minWidth:           0,
  maxWidth:           '100%',
  boxSizing:          'border-box',
  background:         'var(--surface3)',
  border:             '1px solid var(--border2)',
  borderRadius:       '6px',
  color:              'var(--white)',
  fontSize:           'var(--text-sm)',
  padding:            '0.6rem 0.5rem',
  fontFamily:         'var(--body)',
  // Strip native iOS styling that carries an intrinsic min-width
  WebkitAppearance:   'none',
  appearance:         'none',
  colorScheme:        'dark',   // ensures dark date-picker chrome on supported browsers
}

export function DateInput({ value, onChange, style, min, max, ...rest }: Props) {
  return (
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      min={min}
      max={max}
      style={{ ...dateInputStyle, ...style }}
      {...rest}
    />
  )
}

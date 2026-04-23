/**
 * TimePickerWheel — CSS snap-scroll drum-roll time picker.
 *
 * Works natively on iOS Safari (kinetic scroll) and Android Chrome.
 * Each column (HRS / MIN / SEC) is a fixed-height scroll container with
 * scroll-snap-type: y mandatory so items lock to the centre slot.
 *
 * Infinite scroll: values are repeated REPS times. Scroll initialises at the
 * centre repetition. When the user approaches either edge the container is
 * silently repositioned to the equivalent centre position — giving a seamless
 * wrap-around in both directions.
 *
 * Usage:
 *   <TimePickerWheel value={{ h, m, s }} onChange={v => setTime(v)} />
 */

import { useRef, useEffect, useCallback } from 'react'

export interface HMS { h: number; m: number; s: number }

const ITEM_H  = 44    // px — height of each option row
const VISIBLE = 3     // how many rows are visible (centre = selected)
const REPS    = 7     // times the values array is repeated for infinite scroll

// ─── helpers ─────────────────────────────────────────────────────────────────

function range(n: number) { return Array.from({ length: n }, (_, i) => i) }
function pad2(n: number)  { return n.toString().padStart(2, '0') }

// ─── Single wheel column ─────────────────────────────────────────────────────

function Wheel({
  values,
  selected,
  onChange,
  label,
  format = (v: number) => pad2(v),
}: {
  values: number[]
  selected: number
  onChange: (v: number) => void
  label: string
  format?: (v: number) => string
}) {
  const ref           = useRef<HTMLDivElement>(null)
  const settingRef    = useRef(false)   // guards against scroll-event → setState loop
  const raf           = useRef<number>(0)
  const lastEmitted   = useRef<number>(-999) // last value we called onChange with

  const n         = values.length
  const halfReps  = Math.floor(REPS / 2)
  const midOffset = n * halfReps          // index of value[0] in the centre repetition

  // Inflated array: values repeated REPS times
  const inflated = Array.from({ length: n * REPS }, (_, i) => values[i % n])

  // Scroll to `selected` whenever it changes — but skip if we triggered the change
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (lastEmitted.current === selected) return   // our own onChange, already there
    const idx = values.indexOf(selected)
    if (idx < 0) return
    settingRef.current = true
    el.scrollTop = (midOffset + idx) * ITEM_H
    raf.current = requestAnimationFrame(() => { settingRef.current = false })
  }, [selected, values, midOffset])

  // Cleanup on unmount
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const onScroll = useCallback(() => {
    if (settingRef.current) return
    const el = ref.current
    if (!el) return

    const rawIdx  = Math.round(el.scrollTop / ITEM_H)
    const total   = n * REPS
    const buffer  = n * 2   // stay at least 2 full repetitions from each edge

    // Near the top edge → jump to the equivalent position in the middle
    if (rawIdx < buffer) {
      settingRef.current = true
      el.scrollTop = (rawIdx + n * halfReps) * ITEM_H
      requestAnimationFrame(() => { settingRef.current = false })
      return
    }

    // Near the bottom edge → jump back towards the middle
    if (rawIdx >= total - buffer) {
      settingRef.current = true
      el.scrollTop = (rawIdx - n * halfReps) * ITEM_H
      requestAnimationFrame(() => { settingRef.current = false })
      return
    }

    const realValue = values[rawIdx % n]
    if (realValue !== selected) {
      lastEmitted.current = realValue
      onChange(realValue)
    }
  }, [values, selected, onChange, n, halfReps])

  const WHEEL_H = ITEM_H * VISIBLE

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0 }}>
      <div
        ref={ref}
        onScroll={onScroll}
        style={{
          height:              WHEEL_H,
          overflowY:           'scroll',
          scrollSnapType:      'y mandatory',
          WebkitOverflowScrolling: 'touch' as any,
          overscrollBehavior: 'contain',
          // Padding top/bottom = 1 item height so the first/last item can centre
          paddingTop:          ITEM_H,
          paddingBottom:       ITEM_H,
          boxSizing:           'border-box',
          scrollbarWidth:      'none',    // Firefox
          msOverflowStyle:     'none',    // IE
          position:            'relative',
          width:               '100%',
        } as React.CSSProperties}
      >
        {inflated.map((v, i) => (
          <div
            key={i}
            style={{
              height:          ITEM_H,
              scrollSnapAlign: 'center',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              fontFamily:      'var(--headline)',
              fontWeight:      900,
              fontSize:        '24px',
              letterSpacing:   '0.02em',
              color:           v === selected ? 'var(--white)' : 'rgba(245,245,245,0.25)',
              transition:      'color 0.15s',
              userSelect:      'none',
              cursor:          'pointer',
              flexShrink:      0,
            } as React.CSSProperties}
            onMouseDown={() => {
              const el = ref.current
              if (!el) return
              el.scrollTo({ top: i * ITEM_H, behavior: 'smooth' })
            }}
          >
            {format(v)}
          </div>
        ))}
      </div>

      {/* Label below wheel */}
      <div style={{
        fontSize:      '10px',
        fontFamily:    'var(--headline)',
        fontWeight:    700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color:         'var(--muted)',
        marginTop:     '4px',
      }}>
        {label}
      </div>
    </div>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

export function TimePickerWheel({
  value,
  onChange,
  maxHours = 23,   // 23 for time-of-day, 99 for race finish times
}: {
  value: HMS
  onChange: (v: HMS) => void
  maxHours?: number
}) {
  const WHEEL_H = ITEM_H * VISIBLE

  return (
    <div style={{
      background:   'var(--surface3)',
      border:       '1px solid var(--border2)',
      borderRadius: '10px',
      padding:      '0 12px 10px',
      display:      'flex',
      alignItems:   'flex-start',
      gap:          '4px',
      position:     'relative',
      overflow:     'hidden',
    }}>
      {/* Selection highlight band across the centre row */}
      <div style={{
        position:     'absolute',
        left:         0,
        right:        0,
        top:          ITEM_H,
        height:       ITEM_H,
        background:   'rgba(var(--orange-ch),0.08)',
        borderTop:    '1px solid rgba(var(--orange-ch),0.18)',
        borderBottom: '1px solid rgba(var(--orange-ch),0.18)',
        pointerEvents: 'none',
        zIndex:       1,
      }} />

      <Wheel
        values={range(maxHours + 1)}
        selected={Math.min(value.h, maxHours)}
        onChange={h => onChange({ ...value, h })}
        label="HRS"
        format={v => String(v)}
      />

      <div style={{ color: 'var(--muted)', fontSize: '20px', fontWeight: 700, paddingTop: WHEEL_H / 2 - 4, flexShrink: 0 }}>:</div>

      <Wheel
        values={range(60)}
        selected={value.m}
        onChange={m => onChange({ ...value, m })}
        label="MIN"
      />

      <div style={{ color: 'var(--muted)', fontSize: '20px', fontWeight: 700, paddingTop: WHEEL_H / 2 - 4, flexShrink: 0 }}>:</div>

      <Wheel
        values={range(60)}
        selected={value.s}
        onChange={s => onChange({ ...value, s })}
        label="SEC"
      />
    </div>
  )
}

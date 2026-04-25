/**
 * CityPicker — typeahead city input backed by Open-Meteo geocoding.
 * Type 2+ characters, pick a result, parent receives
 * `{ city, country, lat, lng }` in a single callback. Free text also
 * supported: blur with no selection just commits the raw text and clears
 * lat/lng so downstream geocode backfill can retry later.
 */
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { searchCities } from '@/lib/geocode'
import type { CitySuggestion } from '@/lib/geocode'
import { normalizeCityName } from '@/lib/cityNormalize'

type Props = {
  city: string
  country: string
  onSelect: (next: { city: string; country: string; lat?: number; lng?: number }) => void
  placeholder?: string
  inputStyle?: CSSProperties
  /** Force-disable the dropdown (e.g. when the user hasn't focused yet). */
  disabled?: boolean
}

export function CityPicker({ city, country, onSelect, placeholder = 'e.g. Leh', inputStyle, disabled }: Props) {
  const [query, setQuery]       = useState(city || '')
  const [results, setResults]   = useState<CitySuggestion[]>([])
  const [open, setOpen]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const wrapRef     = useRef<HTMLDivElement>(null)

  // Keep input synced if parent city changes (e.g. form reset / external update)
  useEffect(() => {
    setQuery(city || '')
  }, [city])

  // Debounced search
  useEffect(() => {
    if (disabled) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
    if (q.length < 2 || q === city) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const hits = await searchCities(q, 8)
      setResults(hits)
      setLoading(false)
      setHighlight(-1)
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, city, disabled])

  // Close dropdown on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function commitSuggestion(s: CitySuggestion) {
    // Open-Meteo sometimes returns admin labels like "Dubai Emirate" or
    // "Mumbai Suburban" instead of the city itself — normalize before
    // storing so the CITIES pill doesn't fragment by alias.
    const normalized = normalizeCityName(s.name)
    setQuery(normalized)
    setOpen(false)
    setResults([])
    onSelect({ city: normalized, country: s.country, lat: s.lat, lng: s.lng })
  }

  function commitFreeText(value: string) {
    const normalized = normalizeCityName(value)
    if (normalized && normalized !== city) {
      // Preserve existing country if user is only editing city; clear
      // lat/lng because the old coord may not match the new text.
      onSelect({ city: normalized, country, lat: undefined, lng: undefined })
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) {
      if (e.key === 'Enter') commitFreeText(query)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const idx = highlight >= 0 ? highlight : 0
      commitSuggestion(results[idx])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const baseInput: CSSProperties = {
    width: '100%',
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: '6px',
    color: 'var(--white)',
    fontSize: '14px',
    padding: '0.6rem 0.75rem',
    fontFamily: 'var(--body)',
    boxSizing: 'border-box' as const,
    height: '40px',
    lineHeight: 1.4,
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => { setTimeout(() => commitFreeText(query), 150) }}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        style={{ ...baseInput, ...(inputStyle || {}) }}
      />
      {open && (results.length > 0 || loading) && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0, right: 0,
            background: 'var(--surface2)',
            border: '1px solid var(--border2)',
            borderRadius: '8px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
            zIndex: 50,
            maxHeight: '240px',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch' as any,
          }}
        >
          {loading && results.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--muted)' }}>
              Searching…
            </div>
          )}
          {results.map((r, i) => {
            const secondary = [r.admin1, r.country].filter(Boolean).join(', ')
            const isHi = i === highlight
            return (
              <button
                key={`${r.name}-${r.lat}-${r.lng}-${i}`}
                type="button"
                role="option"
                aria-selected={isHi}
                onMouseDown={e => { e.preventDefault(); commitSuggestion(r) }}
                onMouseEnter={() => setHighlight(i)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '2px',
                  width: '100%',
                  padding: '8px 12px',
                  background: isHi ? 'rgba(var(--orange-ch),0.15)' : 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: 'var(--white)',
                  fontFamily: 'var(--body)',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '14px' }}>{r.name}</span>
                {secondary && (
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{secondary}</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

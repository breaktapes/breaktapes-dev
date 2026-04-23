/**
 * RaceShareCard — 1200×630 canvas "passport card" export for sharing a race result.
 *
 * Canvas note: fillStyle cannot resolve CSS custom properties (var(--orange)).
 * All colours are hardcoded hex values from the BREAKTAPES design system.
 */
import { useRef, useState, useEffect } from 'react'
import type { Race } from '@/types'
import { fmtDateDDMM } from '@/lib/utils'

// ── Design tokens (canvas-safe, no CSS vars) ──────────────────────────────────
const C = {
  bg:       '#0D0D0D',
  surface:  '#141414',
  border:   'rgba(245,245,245,0.06)',
  orange:   '#E84E1B',
  white:    '#F5F5F5',
  muted:    'rgba(245,245,245,0.35)',
  gold:     '#FFD770',
  silver:   '#C8D4DC',
  bronze:   '#CD8C5A',
}

const MEDAL_COLORS: Record<string, string> = {
  gold:     C.gold,
  silver:   C.silver,
  bronze:   C.bronze,
  finisher: C.orange,
}

function countryToFlag(country: string): string {
  const map: Record<string, string> = {
    'USA': '🇺🇸', 'United States': '🇺🇸',
    'UK': '🇬🇧', 'United Kingdom': '🇬🇧',
    'Germany': '🇩🇪', 'France': '🇫🇷', 'Australia': '🇦🇺',
    'Japan': '🇯🇵', 'Canada': '🇨🇦', 'South Africa': '🇿🇦',
    'Netherlands': '🇳🇱', 'Spain': '🇪🇸', 'Italy': '🇮🇹',
    'Brazil': '🇧🇷', 'Kenya': '🇰🇪', 'Ethiopia': '🇪🇹',
    'New Zealand': '🇳🇿', 'Sweden': '🇸🇪', 'Norway': '🇳🇴',
    'Denmark': '🇩🇰', 'Switzerland': '🇨🇭', 'Austria': '🇦🇹',
    'Ireland': '🇮🇪', 'India': '🇮🇳', 'China': '🇨🇳',
    'Mexico': '🇲🇽', 'Argentina': '🇦🇷', 'Portugal': '🇵🇹',
    'Poland': '🇵🇱', 'Czech Republic': '🇨🇿', 'Belgium': '🇧🇪',
    'Singapore': '🇸🇬', 'Hong Kong': '🇭🇰', 'UAE': '🇦🇪',
  }
  return map[country] ?? ''
}

function drawCard(canvas: HTMLCanvasElement, race: Race, athleteName: string) {
  const W = 1200, H = 630
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Background
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, W, H)

  // Surface panel (centre column)
  ctx.fillStyle = C.surface
  ctx.beginPath()
  ctx.roundRect(40, 40, W - 80, H - 80, 16)
  ctx.fill()

  // Accent bar (left edge)
  ctx.fillStyle = C.orange
  ctx.beginPath()
  ctx.roundRect(40, 40, 6, H - 80, [16, 0, 0, 16])
  ctx.fill()

  // BREAKTAPES wordmark (top-right)
  ctx.fillStyle = C.muted
  ctx.font = '700 20px "Barlow Condensed", "Arial Narrow", sans-serif'
  ctx.letterSpacing = '0.12em'
  ctx.textAlign = 'right'
  ctx.fillText('BREAKTAPES', W - 70, 84)

  // Athlete name
  ctx.fillStyle = C.white
  ctx.font = '900 52px "Barlow Condensed", "Arial Narrow", sans-serif'
  ctx.textAlign = 'left'
  ctx.letterSpacing = '0.06em'
  ctx.fillText(athleteName.toUpperCase(), 80, 170)

  // Race name
  const raceName = race.name ?? 'Race'
  ctx.fillStyle = C.orange
  ctx.font = '800 40px "Barlow Condensed", "Arial Narrow", sans-serif'
  ctx.letterSpacing = '0.04em'

  // Truncate if too wide
  let displayName = raceName.toUpperCase()
  while (ctx.measureText(displayName).width > W - 200 && displayName.length > 4) {
    displayName = displayName.slice(0, -4) + '…'
  }
  ctx.fillText(displayName, 80, 230)

  // Location + date row
  const flag = countryToFlag(race.country ?? '')
  const locationParts = [flag, race.city, race.country].filter(Boolean).join(' · ')
  ctx.fillStyle = C.muted
  ctx.font = '500 24px "Barlow", Arial, sans-serif'
  ctx.letterSpacing = '0'
  ctx.fillText(locationParts + (race.date ? '  ·  ' + fmtDateDDMM(race.date) : ''), 80, 282)

  // Divider
  ctx.strokeStyle = C.border
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(80, 310)
  ctx.lineTo(W - 80, 310)
  ctx.stroke()

  // Finish time (big)
  if (race.time) {
    ctx.fillStyle = C.white
    ctx.font = '900 96px "Barlow Condensed", "Arial Narrow", sans-serif'
    ctx.letterSpacing = '0.02em'
    ctx.textAlign = 'left'
    ctx.fillText(race.time, 80, 430)

    ctx.fillStyle = C.muted
    ctx.font = '600 20px "Barlow", Arial, sans-serif'
    ctx.letterSpacing = '0'
    ctx.fillText('FINISH TIME', 80, 460)
  }

  // Distance + sport pill — use friendly labels for known distances
  const _KM_LABELS: Record<string, string> = {
    '226': 'IRONMAN', '113': '70.3', '51.5': 'Olympic', '25.75': 'Sprint',
    '42.195': 'Marathon', '42.2': 'Marathon', '21.1': 'Half Marathon',
    '10': '10K', '5': '5K',
  }
  const rawDist = race.distance ?? ''
  const distLabel = rawDist
    ? (_KM_LABELS[rawDist] ?? (isNaN(parseFloat(rawDist)) ? rawDist : `${rawDist} KM`))
    : ''
  if (distLabel) {
    ctx.fillStyle = C.surface
    ctx.fillStyle = 'rgba(245,245,245,0.06)'
    const pillX = race.time ? 400 : 80
    const pillW = ctx.measureText(distLabel).width + 40
    ctx.beginPath()
    ctx.roundRect(pillX, 388, pillW, 40, 8)
    ctx.fill()
    ctx.fillStyle = C.white
    ctx.font = '800 22px "Barlow Condensed", "Arial Narrow", sans-serif'
    ctx.letterSpacing = '0.06em'
    ctx.textAlign = 'left'
    ctx.fillText(distLabel, pillX + 20, 415)
  }

  // Placing
  if (race.placing) {
    ctx.fillStyle = C.muted
    ctx.font = '600 22px "Barlow", Arial, sans-serif'
    ctx.letterSpacing = '0'
    ctx.textAlign = 'left'
    ctx.fillText(race.placing, race.time ? 400 : 80, 470)
  }

  // Medal badge (top-right of the panel)
  if (race.medal) {
    const medalColor = MEDAL_COLORS[race.medal] ?? C.orange
    const medalLabel = race.medal.toUpperCase()
    ctx.font = '900 18px "Barlow Condensed", "Arial Narrow", sans-serif'
    ctx.letterSpacing = '0.1em'
    const mw = ctx.measureText(medalLabel).width + 28
    const mx = W - 80 - mw
    const my = H - 80 - 52

    ctx.fillStyle = `${medalColor}22`
    ctx.strokeStyle = medalColor
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.roundRect(mx, my, mw, 36, 6)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = medalColor
    ctx.textAlign = 'center'
    ctx.fillText(medalLabel, mx + mw / 2, my + 25)
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  race: Race
  athleteName: string
  onClose: () => void
}

export function RaceShareCard({ race, athleteName, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawn, setDrawn] = useState(false)
  const [copying, setCopying] = useState(false)

  // Auto-generate card on open — no extra tap required
  useEffect(() => {
    if (canvasRef.current) {
      drawCard(canvasRef.current, race, athleteName)
      setDrawn(true)
    }
  }, [])

  function draw() {
    if (!canvasRef.current) return
    drawCard(canvasRef.current, race, athleteName)
    setDrawn(true)
  }

  function download() {
    if (!canvasRef.current) return
    const link = document.createElement('a')
    link.download = `${race.name ?? 'race'}-breaktapes.png`.replace(/\s+/g, '-').toLowerCase()
    link.href = canvasRef.current.toDataURL('image/png')
    link.click()
  }

  async function copyToClipboard() {
    if (!canvasRef.current) return
    setCopying(true)
    try {
      await new Promise<void>((resolve, reject) => {
        canvasRef.current!.toBlob(async (blob) => {
          try {
            if (!blob) throw new Error('Canvas toBlob failed')
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
            resolve()
          } catch (e) {
            reject(e)
          }
        }, 'image/png')
      })
    } catch {
      // Clipboard API not supported — fall back to download
      download()
    } finally {
      setCopying(false)
    }
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 900,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '1rem',
    gap: '1rem',
  }

  const btnBase: React.CSSProperties = {
    padding: '0.7rem 1.5rem',
    borderRadius: '4px',
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '13px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    border: 'none',
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ maxWidth: '100%', width: '600px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }} onClick={e => e.stopPropagation()}>
        {/* Preview canvas (scaled to fit screen) */}
        <canvas
          ref={canvasRef}
          style={{ width: '100%', borderRadius: '8px', display: drawn ? 'block' : 'none' }}
          aria-label="Race share card preview"
        />

        {!drawn && (
          <div style={{ background: '#141414', borderRadius: '8px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button style={{ ...btnBase, background: 'var(--orange)', color: 'var(--black)' }} onClick={draw}>
              Generate Card
            </button>
          </div>
        )}

        {drawn && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              style={{ ...btnBase, background: 'var(--orange)', color: 'var(--black)', flex: 1 }}
              onClick={download}
            >
              Download PNG
            </button>
            <button
              style={{ ...btnBase, background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--white)', flex: 1 }}
              onClick={copyToClipboard}
              disabled={copying}
            >
              {copying ? 'Copying…' : 'Copy Image'}
            </button>
          </div>
        )}

        <button
          style={{ ...btnBase, background: 'transparent', border: '1px solid var(--border2)', color: 'var(--muted)' }}
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  )
}

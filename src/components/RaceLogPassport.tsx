/**
 * RaceLogPassport — Athlete Dossier canvas export (Option B design).
 *
 * Supports 5 export ratios: 16:9, 9:16, 4:3, 3:4, 1:1
 * Supports year filter: All Time + per-year
 * Export: Web Share API (gallery save) → download fallback
 *
 * Canvas rule: fillStyle cannot resolve CSS custom properties.
 * Colours are read from CSS custom properties at draw time so all 9 themes render correctly.
 */
import { useRef, useState, useCallback } from 'react'
import type { Race, Athlete } from '@/types'

// ── Runtime CSS var reader ─────────────────────────────────────────────────────
function readCssPalette() {
  const cs = getComputedStyle(document.documentElement)
  const get = (v: string) => cs.getPropertyValue(v).trim()
  const orangeCh = get('--orange-ch') || '232, 78, 27'
  const greenCh  = get('--green-ch')  || '0, 255, 136'
  const goldCh   = get('--gold-ch')   || '200, 150, 60'
  return {
    bg:          get('--black')   || '#050505',
    orange:      get('--orange')  || '#E84E1B',
    orangeDark:  `rgba(${orangeCh},0.6)`,
    orangeDim:   `rgba(${orangeCh},0.12)`,
    orangeFaint: `rgba(${orangeCh},0.18)`,
    gold:        get('--gold')    || '#C8963C',
    green:       get('--green')   || '#00FF88',
    purple:      '#7C3AED',
    white:       get('--white')   || '#E8E0D5',
    muted:       get('--muted')   || 'rgba(232,224,213,0.35)',
    muted2:      get('--muted2')  || 'rgba(232,224,213,0.20)',
    cell:        'rgba(255,255,255,0.03)',
    cellBorder:  'rgba(255,255,255,0.07)',
    divider:     'rgba(255,255,255,0.06)',
    headerGrad0: `rgba(${orangeCh},0.15)`,
    // raw channel strings for inline rgba() calls
    orangeCh, greenCh, goldCh,
  }
}

// ── Ratio definitions ─────────────────────────────────────────────────────────
const RATIOS: { label: string; W: number; H: number }[] = [
  { label: '16:9', W: 1200, H: 675 },
  { label: '9:16', W: 675,  H: 1200 },
  { label: '4:3',  W: 1200, H: 900 },
  { label: '3:4',  W: 900,  H: 1200 },
  { label: '1:1',  W: 1080, H: 1080 },
]

// ── Utilities ─────────────────────────────────────────────────────────────────
const FLAG_MAP: Record<string, string> = {
  'USA': '🇺🇸', 'United States': '🇺🇸', 'UK': '🇬🇧', 'United Kingdom': '🇬🇧',
  'Germany': '🇩🇪', 'France': '🇫🇷', 'Australia': '🇦🇺', 'Japan': '🇯🇵',
  'Canada': '🇨🇦', 'South Africa': '🇿🇦', 'Netherlands': '🇳🇱', 'Spain': '🇪🇸',
  'Italy': '🇮🇹', 'Brazil': '🇧🇷', 'Kenya': '🇰🇪', 'Ethiopia': '🇪🇹',
  'New Zealand': '🇳🇿', 'Sweden': '🇸🇪', 'Norway': '🇳🇴', 'Denmark': '🇩🇰',
  'Switzerland': '🇨🇭', 'Austria': '🇦🇹', 'Ireland': '🇮🇪', 'India': '🇮🇳',
  'China': '🇨🇳', 'Mexico': '🇲🇽', 'Argentina': '🇦🇷', 'Portugal': '🇵🇹',
  'Poland': '🇵🇱', 'Belgium': '🇧🇪', 'Singapore': '🇸🇬', 'UAE': '🇦🇪',
  'United Arab Emirates': '🇦🇪', 'Bahrain': '🇧🇭', 'Oman': '🇴🇲',
  'Saudi Arabia': '🇸🇦', 'Qatar': '🇶🇦', 'Kuwait': '🇰🇼', 'Jordan': '🇯🇴',
}

function countryToFlag(c: string): string { return FLAG_MAP[c] ?? '' }

function timeToSecs(t: string): number {
  const p = t.split(':').map(Number)
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2]
  if (p.length === 2) return p[0] * 60 + p[1]
  return Infinity
}

function getYears(races: Race[]): string[] {
  const years = new Set(races.map(r => r.date?.slice(0, 4)).filter(Boolean) as string[])
  return [...years].sort((a, b) => Number(b) - Number(a))
}

function getBestPB(races: Race[]): { time: string; dist: string; race: string } | null {
  const PRIO = ['Marathon', 'Half Marathon', '70.3 / Half Ironman', 'Ironman / Full', '10K', '5K']
  for (const dist of PRIO) {
    const r = races
      .filter(r => r.distance === dist && r.time)
      .sort((a, b) => timeToSecs(a.time!) - timeToSecs(b.time!))[0]
    if (r) return { time: r.time!, dist: r.distance, race: r.name }
  }
  const best = races
    .filter(r => r.time)
    .sort((a, b) => timeToSecs(a.time!) - timeToSecs(b.time!))[0]
  return best ? { time: best.time!, dist: best.distance, race: best.name } : null
}

function getSports(races: Race[]): string[] {
  const s = new Set(races.map(r => r.sport).filter(Boolean))
  const out = []
  if (s.has('running')) out.push('Runner')
  if (s.has('triathlon')) out.push('Triathlete')
  if (s.has('cycling')) out.push('Cyclist')
  if (s.has('hyrox')) out.push('Hyrox')
  if (s.has('swim')) out.push('Swimmer')
  return out.slice(0, 2)
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 2 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}

// ── Canvas drawing ────────────────────────────────────────────────────────────
interface DrawOpts {
  races: Race[]
  athlete?: Athlete
  year: string
  W: number
  H: number
}

function drawDossier(canvas: HTMLCanvasElement, opts: DrawOpts) {
  const { races, athlete, year, W, H } = opts
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const D = readCssPalette()
  const { orangeCh } = D

  const name = [athlete?.firstName, athlete?.lastName].filter(Boolean).join(' ') || 'Athlete'
  const initials = [athlete?.firstName?.[0], athlete?.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?'
  const location = [athlete?.city, athlete?.country].filter(Boolean).join(', ')
  const raceCount = races.length
  const countryCount = new Set(races.map(r => r.country).filter(Boolean)).size
  const medalCount = races.filter(r => r.medal && r.medal !== 'none').length
  const kmTotal = Math.round(races.reduce((s, r) => {
    const n = parseFloat(r.distance) || 0
    return s + n
  }, 0))
  const pb = getBestPB(races)
  const sports = getSports(races)
  const flags = [...new Set(races.map(r => r.country).filter(Boolean))]
    .map(countryToFlag).filter(Boolean).slice(0, 16)
  const recentRaces = [...races].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)
  const yearLabel = year === 'all' ? 'All Time' : year

  const isVertical = H > W
  const s = W / 1200  // scale factor (base width = 1200px)

  // ── Background ──
  ctx.fillStyle = D.bg
  ctx.fillRect(0, 0, W, H)

  // Subtle orange vignette top-left
  const vg = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.6)
  vg.addColorStop(0, `rgba(${orangeCh},0.08)`)
  vg.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, W, H)

  // ── CLASSIFIED stamp (top-right, diagonal) ──
  ctx.save()
  const stampX = isVertical ? W * 0.75 : W * 0.82
  const stampY = isVertical ? H * 0.06 : H * 0.12
  ctx.translate(stampX, stampY)
  ctx.rotate(0.26) // ~15deg
  ctx.font = `900 ${Math.round(13 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
  ctx.letterSpacing = `${Math.round(4 * s)}px`
  ctx.fillStyle = `rgba(${orangeCh},0.16)`
  ctx.strokeStyle = `rgba(${orangeCh},0.16)`
  ctx.lineWidth = 2 * s
  const stampW = ctx.measureText('CLASSIFIED').width + 20 * s
  const stampH = 24 * s
  ctx.strokeRect(-10 * s, -stampH * 0.75, stampW, stampH)
  ctx.fillText('CLASSIFIED', 0, 0)
  ctx.restore()

  // ── Header band ──
  const headerH = Math.round(isVertical ? 70 * s : 60 * s)
  const hg = ctx.createLinearGradient(0, 0, W * 0.6, 0)
  hg.addColorStop(0, D.headerGrad0)
  hg.addColorStop(1, `rgba(${orangeCh},0)`)
  ctx.fillStyle = hg
  ctx.fillRect(0, 0, W, headerH)

  ctx.strokeStyle = `rgba(${orangeCh},0.14)`
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, headerH); ctx.lineTo(W, headerH); ctx.stroke()

  // Left accent bar
  const ag = ctx.createLinearGradient(0, 0, 0, headerH)
  ag.addColorStop(0, D.orange); ag.addColorStop(1, D.orangeDark)
  ctx.fillStyle = ag
  ctx.fillRect(0, 0, 4 * s, headerH)

  // Header text
  ctx.fillStyle = `rgba(${orangeCh},0.7)`
  ctx.font = `600 ${Math.round(7 * s)}px "Geist Mono", "Courier New", monospace`
  ctx.letterSpacing = `${Math.round(3 * s)}px`
  ctx.textAlign = 'left'
  ctx.fillText('BREAKTAPES ATHLETIC INTELLIGENCE', 16 * s, 22 * s)

  ctx.fillStyle = D.white
  ctx.font = `900 ${Math.round(20 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
  ctx.letterSpacing = `${Math.round(2 * s)}px`
  ctx.fillText('ATHLETE DOSSIER', 16 * s, headerH - 14 * s)

  // Year label top-right
  ctx.fillStyle = `rgba(${orangeCh},0.5)`
  ctx.font = `700 ${Math.round(8 * s)}px "Geist Mono", "Courier New", monospace`
  ctx.letterSpacing = `${Math.round(2 * s)}px`
  ctx.textAlign = 'right'
  ctx.fillText(yearLabel.toUpperCase(), W - 16 * s, 28 * s)

  const pad = 16 * s
  const bodyY = headerH + pad
  const bodyH = H - headerH - pad * 2.5

  if (!isVertical) {
    // ── HORIZONTAL LAYOUT (16:9, 4:3, 1:1) ──
    const leftW = Math.round(W * 0.42)
    const rightX = leftW + pad
    const rightW = W - rightX - pad

    // ── Left column ──
    let ly = bodyY

    // ID block
    const avatarSize = Math.round(48 * s)
    const ag2 = ctx.createLinearGradient(pad, ly, pad + avatarSize, ly + avatarSize)
    ag2.addColorStop(0, D.orange); ag2.addColorStop(1, D.orangeDark)
    ctx.fillStyle = ag2
    roundRect(ctx, pad, ly, avatarSize, avatarSize, 8 * s)
    ctx.fill()

    // Avatar glow
    ctx.shadowColor = `rgba(${orangeCh},0.4)`
    ctx.shadowBlur = 16 * s
    ctx.fillStyle = ag2
    roundRect(ctx, pad, ly, avatarSize, avatarSize, 8 * s)
    ctx.fill()
    ctx.shadowBlur = 0

    ctx.fillStyle = '#FFFFFF'
    ctx.font = `900 ${Math.round(18 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
    ctx.letterSpacing = '0px'
    ctx.textAlign = 'center'
    ctx.fillText(initials, pad + avatarSize / 2, ly + avatarSize * 0.68)

    const nameX = pad + avatarSize + 10 * s
    ctx.textAlign = 'left'
    ctx.fillStyle = D.white
    ctx.font = `900 ${Math.round(15 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
    ctx.letterSpacing = `${Math.round(1.5 * s)}px`
    ctx.fillText(truncateText(ctx, name.toUpperCase(), leftW - nameX - pad), nameX, ly + 16 * s)

    ctx.fillStyle = `rgba(${orangeCh},0.7)`
    ctx.font = `500 ${Math.round(7.5 * s)}px "Geist Mono", "Courier New", monospace`
    ctx.letterSpacing = '0px'
    const idCode = `ID: BT-${raceCount}-${initials}${location ? ' · ' + location : ''}`
    ctx.fillText(truncateText(ctx, idCode, leftW - nameX - pad), nameX, ly + 30 * s)

    // Sport tags
    let tagX = nameX
    const tagY = ly + 44 * s
    for (const sport of sports) {
      ctx.font = `800 ${Math.round(7 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
      ctx.letterSpacing = `${Math.round(1.5 * s)}px`
      const tw = ctx.measureText(sport.toUpperCase()).width + 10 * s
      const tagColor = sport === 'Triathlete' ? D.purple : D.orange
      ctx.strokeStyle = tagColor.replace(')', ', 0.35)').replace('rgb', 'rgba')
      if (tagColor === D.orange) {
        ctx.strokeStyle = `rgba(${orangeCh},0.35)`
      } else {
        ctx.strokeStyle = 'rgba(124,58,237,0.35)'
      }
      ctx.lineWidth = 1
      roundRect(ctx, tagX, tagY - 10 * s, tw, 14 * s, 2 * s)
      ctx.stroke()
      ctx.fillStyle = tagColor
      ctx.fillText(sport.toUpperCase(), tagX + 5 * s, tagY)
      tagX += tw + 5 * s
    }

    ly += avatarSize + 14 * s

    // Divider
    ctx.strokeStyle = D.divider
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(pad, ly); ctx.lineTo(leftW - pad * 0.5, ly); ctx.stroke()
    ly += 10 * s

    // Intel grid (2×2)
    const gridW = leftW - pad * 1.5
    const cellW = (gridW - 6 * s) / 2
    const cellH = Math.round(Math.min(56 * s, bodyH * 0.17))
    const intelCells = [
      { label: 'Missions complete', val: String(raceCount), color: D.orange },
      { label: 'Territories entered', val: String(countryCount), color: D.gold },
      { label: 'Citations earned', val: String(medalCount), color: D.green },
      { label: `Distance covered`, val: `${kmTotal.toLocaleString()} km`, color: D.white },
    ]
    intelCells.forEach((c, i) => {
      const cx = pad + (i % 2) * (cellW + 6 * s)
      const cy = ly + Math.floor(i / 2) * (cellH + 6 * s)
      ctx.fillStyle = D.cell
      roundRect(ctx, cx, cy, cellW, cellH, 6 * s); ctx.fill()
      ctx.strokeStyle = D.cellBorder; ctx.lineWidth = 1
      roundRect(ctx, cx, cy, cellW, cellH, 6 * s); ctx.stroke()

      ctx.fillStyle = D.muted2
      ctx.font = `500 ${Math.round(6.5 * s)}px "Geist Mono", "Courier New", monospace`
      ctx.letterSpacing = `${Math.round(1.5 * s)}px`
      ctx.textAlign = 'left'
      ctx.fillText(c.label.toUpperCase(), cx + 8 * s, cy + 14 * s)

      ctx.fillStyle = c.color
      const valFontSize = c.val.length > 6 ? Math.round(16 * s) : Math.round(22 * s)
      ctx.font = `900 ${valFontSize}px "Barlow Condensed", "Arial Narrow", sans-serif`
      ctx.letterSpacing = '-1px'
      ctx.fillText(truncateText(ctx, c.val, cellW - 12 * s), cx + 8 * s, cy + cellH - 10 * s)
    })
    ly += cellH * 2 + 6 * s * 3 + 4 * s

    // Best recorded time panel (striped)
    if (pb) {
      const pbH = Math.round(52 * s)
      // Striped bg
      for (let x = pad; x < leftW - pad * 0.5; x += 8 * s) {
        ctx.fillStyle = `rgba(${orangeCh},0.04)`
        ctx.fillRect(x, ly, 2 * s, pbH)
      }
      ctx.strokeStyle = `rgba(${orangeCh},0.18)`; ctx.lineWidth = 1
      roundRect(ctx, pad, ly, leftW - pad * 1.5, pbH, 6 * s); ctx.stroke()

      ctx.fillStyle = `rgba(${orangeCh},0.5)`
      ctx.font = `600 ${Math.round(6.5 * s)}px "Geist Mono", "Courier New", monospace`
      ctx.letterSpacing = `${Math.round(2 * s)}px`
      ctx.textAlign = 'left'
      ctx.fillText('BEST RECORDED TIME', pad + 8 * s, ly + 14 * s)

      ctx.fillStyle = D.gold
      ctx.font = `900 ${Math.round(24 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
      ctx.letterSpacing = '-1px'
      ctx.fillText(pb.time, pad + 8 * s, ly + pbH - 10 * s)

      ctx.fillStyle = D.muted
      ctx.font = `500 ${Math.round(9 * s)}px "Barlow", Arial, sans-serif`
      ctx.letterSpacing = '0px'
      const pbLabel = `${pb.dist} · ${pb.race.replace(/\s+\d{4}$/, '').substring(0, 22)}`
      ctx.fillText(truncateText(ctx, pbLabel, leftW - pad * 1.5 - 100 * s), pad + 120 * s, ly + pbH - 10 * s)
      ly += pbH + 10 * s
    }

    // Field operations (flags)
    if (flags.length > 0) {
      ctx.fillStyle = D.muted2
      ctx.font = `500 ${Math.round(6.5 * s)}px "Geist Mono", "Courier New", monospace`
      ctx.letterSpacing = `${Math.round(2 * s)}px`
      ctx.textAlign = 'left'
      ctx.fillText('FIELD OPERATIONS', pad, ly + 10 * s)
      ly += 16 * s

      ctx.font = `${Math.round(14 * s)}px serif`
      ctx.letterSpacing = `${Math.round(3 * s)}px`
      const maxFlagsW = leftW - pad * 2
      let fx = pad
      const fExtra = flags.length > 8 ? flags.length - 8 : 0
      flags.slice(0, 8).forEach(f => {
        if (fx + 18 * s > pad + maxFlagsW) return
        ctx.fillText(f, fx, ly + 14 * s)
        fx += 18 * s
      })
      if (fExtra > 0) {
        ctx.fillStyle = D.muted
        ctx.font = `500 ${Math.round(8 * s)}px "Geist Mono", monospace`
        ctx.letterSpacing = '0px'
        ctx.fillText(`+${fExtra}`, fx, ly + 12 * s)
      }
    }

    // ── Right column: Mission Log ──
    let ry = bodyY

    ctx.fillStyle = `rgba(${orangeCh},0.5)`
    ctx.font = `600 ${Math.round(7 * s)}px "Geist Mono", "Courier New", monospace`
    ctx.letterSpacing = `${Math.round(3 * s)}px`
    ctx.textAlign = 'left'
    ctx.fillText('MISSION LOG', rightX, ry + 10 * s)
    ry += 20 * s

    ctx.strokeStyle = D.divider; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(rightX, ry); ctx.lineTo(W - pad, ry); ctx.stroke()
    ry += 8 * s

    const rowH = Math.round((bodyH - 32 * s) / Math.min(recentRaces.length, 10))
    const maxRows = Math.floor((H - ry - pad * 2) / Math.max(rowH, 22 * s))

    recentRaces.slice(0, maxRows).forEach((r, i) => {
      const rx = rightX
      const rw = rightW
      const ryRow = ry + i * Math.max(rowH, 22 * s)

      // Alternating subtle bg
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.015)'
        ctx.fillRect(rx, ryRow, rw, Math.max(rowH, 22 * s))
      }

      const flag = countryToFlag(r.country)
      const yr = r.date?.slice(0, 4) ?? ''
      const raceName = r.name.replace(/\s+\d{4}$/, '').substring(0, 32)

      ctx.fillStyle = `rgba(${orangeCh},0.4)`
      ctx.font = `500 ${Math.round(7 * s)}px "Geist Mono", monospace`
      ctx.letterSpacing = '0px'
      ctx.textAlign = 'left'
      ctx.fillText(yr, rx, ryRow + 14 * s)

      ctx.fillStyle = D.muted
      ctx.font = `600 ${Math.round(9 * s)}px "Barlow", Arial, sans-serif`
      ctx.fillText(`${flag} `, rx + 28 * s, ryRow + 14 * s)

      ctx.fillStyle = D.white
      ctx.font = `700 ${Math.round(10 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
      ctx.letterSpacing = `${Math.round(0.5 * s)}px`
      ctx.fillText(truncateText(ctx, raceName, rw - 150 * s), rx + 44 * s, ryRow + 14 * s)

      if (r.time) {
        ctx.fillStyle = D.orange
        ctx.font = `800 ${Math.round(10 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
        ctx.letterSpacing = '0px'
        ctx.textAlign = 'right'
        ctx.fillText(r.time, W - pad, ryRow + 14 * s)
      }

      // Bottom divider
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(rx, ryRow + Math.max(rowH, 22 * s) - 1)
      ctx.lineTo(W - pad, ryRow + Math.max(rowH, 22 * s) - 1)
      ctx.stroke()
    })

  } else {
    // ── VERTICAL LAYOUT (9:16, 3:4) ──
    let vy = bodyY

    // ID block (horizontal)
    const avatarSize = Math.round(44 * s)
    const ag2 = ctx.createLinearGradient(pad, vy, pad + avatarSize, vy + avatarSize)
    ag2.addColorStop(0, D.orange); ag2.addColorStop(1, D.orangeDark)
    ctx.fillStyle = ag2
    roundRect(ctx, pad, vy, avatarSize, avatarSize, 7 * s); ctx.fill()
    ctx.fillStyle = '#FFF'
    ctx.font = `900 ${Math.round(16 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
    ctx.letterSpacing = '0px'; ctx.textAlign = 'center'
    ctx.fillText(initials, pad + avatarSize / 2, vy + avatarSize * 0.68)

    const nameX = pad + avatarSize + 10 * s
    ctx.textAlign = 'left'
    ctx.fillStyle = D.white
    ctx.font = `900 ${Math.round(16 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
    ctx.letterSpacing = `${Math.round(1 * s)}px`
    ctx.fillText(truncateText(ctx, name.toUpperCase(), W - nameX - pad), nameX, vy + 16 * s)

    ctx.fillStyle = `rgba(${orangeCh},0.7)`
    ctx.font = `500 ${Math.round(7 * s)}px "Geist Mono", monospace`
    ctx.letterSpacing = '0px'
    ctx.fillText(truncateText(ctx, `ID: BT-${raceCount}-${initials}${location ? ' · ' + location : ''}`, W - nameX - pad), nameX, vy + 30 * s)

    vy += avatarSize + 14 * s

    // Intel strip (4-across)
    const intelCells = [
      { label: 'Missions', val: String(raceCount), color: D.orange },
      { label: 'Countries', val: String(countryCount), color: D.gold },
      { label: 'Citations', val: String(medalCount), color: D.green },
      { label: 'KM', val: kmTotal >= 1000 ? `${(kmTotal/1000).toFixed(1)}K` : String(kmTotal), color: D.white },
    ]
    const stripCellW = (W - pad * 2 - 6 * s * 3) / 4
    const stripCellH = Math.round(52 * s)
    intelCells.forEach((c, i) => {
      const cx = pad + i * (stripCellW + 6 * s)
      ctx.fillStyle = D.cell
      roundRect(ctx, cx, vy, stripCellW, stripCellH, 5 * s); ctx.fill()
      ctx.strokeStyle = D.cellBorder; ctx.lineWidth = 1
      roundRect(ctx, cx, vy, stripCellW, stripCellH, 5 * s); ctx.stroke()
      ctx.fillStyle = D.muted2
      ctx.font = `500 ${Math.round(5.5 * s)}px "Geist Mono", monospace`
      ctx.letterSpacing = `${Math.round(1 * s)}px`; ctx.textAlign = 'left'
      ctx.fillText(c.label.toUpperCase(), cx + 6 * s, vy + 12 * s)
      ctx.fillStyle = c.color
      ctx.font = `900 ${Math.round(18 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
      ctx.letterSpacing = '-1px'
      ctx.fillText(truncateText(ctx, c.val, stripCellW - 8 * s), cx + 6 * s, vy + stripCellH - 10 * s)
    })
    vy += stripCellH + 10 * s

    // Best time panel
    if (pb) {
      const pbH = Math.round(44 * s)
      for (let x = pad; x < W - pad; x += 8 * s) {
        ctx.fillStyle = `rgba(${orangeCh},0.04)`; ctx.fillRect(x, vy, 2 * s, pbH)
      }
      ctx.strokeStyle = `rgba(${orangeCh},0.18)`; ctx.lineWidth = 1
      roundRect(ctx, pad, vy, W - pad * 2, pbH, 5 * s); ctx.stroke()
      ctx.fillStyle = `rgba(${orangeCh},0.5)`
      ctx.font = `600 ${Math.round(6 * s)}px "Geist Mono", monospace`
      ctx.letterSpacing = `${Math.round(2 * s)}px`; ctx.textAlign = 'left'
      ctx.fillText('BEST RECORDED TIME', pad + 8 * s, vy + 13 * s)
      ctx.fillStyle = D.gold
      ctx.font = `900 ${Math.round(20 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
      ctx.letterSpacing = '-1px'
      ctx.fillText(pb.time, pad + 8 * s, vy + pbH - 9 * s)
      ctx.fillStyle = D.muted
      ctx.font = `500 ${Math.round(8 * s)}px "Barlow", Arial, sans-serif`
      ctx.letterSpacing = '0px'
      const pbLabel = `${pb.dist} · ${pb.race.replace(/\s+\d{4}$/, '').substring(0, 28)}`
      ctx.fillText(truncateText(ctx, pbLabel, W - pad * 2 - 120 * s), pad + 105 * s, vy + pbH - 9 * s)
      vy += pbH + 10 * s
    }

    // Mission log
    ctx.fillStyle = `rgba(${orangeCh},0.5)`
    ctx.font = `600 ${Math.round(6.5 * s)}px "Geist Mono", monospace`
    ctx.letterSpacing = `${Math.round(2.5 * s)}px`; ctx.textAlign = 'left'
    ctx.fillText('MISSION LOG', pad, vy + 10 * s)
    vy += 18 * s

    ctx.strokeStyle = D.divider; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(pad, vy); ctx.lineTo(W - pad, vy); ctx.stroke()
    vy += 6 * s

    const rowH = Math.round(20 * s)
    const maxRows = Math.floor((H - vy - pad * 2) / rowH)
    recentRaces.slice(0, Math.min(maxRows, 12)).forEach((r, i) => {
      const ryRow = vy + i * rowH
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.015)'
        ctx.fillRect(pad, ryRow, W - pad * 2, rowH)
      }
      const flag = countryToFlag(r.country)
      const yr = r.date?.slice(0, 4) ?? ''
      ctx.fillStyle = `rgba(${orangeCh},0.4)`
      ctx.font = `500 ${Math.round(6.5 * s)}px "Geist Mono", monospace`
      ctx.letterSpacing = '0px'; ctx.textAlign = 'left'
      ctx.fillText(yr, pad, ryRow + 13 * s)
      ctx.fillStyle = D.muted
      ctx.font = `600 ${Math.round(8 * s)}px "Barlow", Arial, sans-serif`
      ctx.fillText(`${flag} `, pad + 26 * s, ryRow + 13 * s)
      ctx.fillStyle = D.white
      ctx.font = `700 ${Math.round(9 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
      ctx.letterSpacing = `${Math.round(0.3 * s)}px`
      const raceName = r.name.replace(/\s+\d{4}$/, '').substring(0, 36)
      ctx.fillText(truncateText(ctx, raceName, W - pad * 2 - 140 * s), pad + 42 * s, ryRow + 13 * s)
      if (r.time) {
        ctx.fillStyle = D.orange
        ctx.font = `800 ${Math.round(9 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
        ctx.letterSpacing = '0px'; ctx.textAlign = 'right'
        ctx.fillText(r.time, W - pad, ryRow + 13 * s)
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(pad, ryRow + rowH - 1); ctx.lineTo(W - pad, ryRow + rowH - 1); ctx.stroke()
    })

    // Flags at bottom
    const fY = H - 28 * s
    if (flags.length > 0) {
      ctx.font = `${Math.round(12 * s)}px serif`
      ctx.letterSpacing = `${Math.round(3 * s)}px`; ctx.textAlign = 'left'
      let fx = pad
      flags.slice(0, 14).forEach(f => { ctx.fillText(f, fx, fY); fx += 16 * s })
    }
  }

  // ── Footer watermark ──
  ctx.fillStyle = `rgba(${orangeCh},0.25)`
  ctx.font = `600 ${Math.round(9 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
  ctx.letterSpacing = `${Math.round(1.5 * s)}px`
  ctx.textAlign = 'right'
  ctx.fillText('APP.BREAKTAPES.COM', W - pad, H - 10 * s)
}

// roundRect polyfill
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  races: Race[]
  athlete?: Athlete
  onClose: () => void
}

export function RaceLogPassport({ races, athlete, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [year, setYear] = useState<string>('all')
  const [ratio, setRatio] = useState<string>('16:9')
  const [drawn, setDrawn] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Read theme channel vars for JSX inline styles (CSS vars resolve at render time)
  const orangeCh = getComputedStyle(document.documentElement).getPropertyValue('--orange-ch').trim() || '232, 78, 27'

  const years = getYears(races)
  const currentRatio = RATIOS.find(r => r.label === ratio)!

  const filteredRaces = year === 'all' ? races : races.filter(r => r.date?.startsWith(year))

  const redraw = useCallback(() => {
    if (!canvasRef.current) return
    drawDossier(canvasRef.current, {
      races: filteredRaces,
      athlete,
      year,
      W: currentRatio.W,
      H: currentRatio.H,
    })
    setDrawn(true)
  }, [filteredRaces, athlete, year, currentRatio])

  // Auto-draw when year/ratio changes if already drawn
  const handleYearChange = (y: string) => {
    setYear(y)
    setDrawn(false)
  }
  const handleRatioChange = (r: string) => {
    setRatio(r)
    setDrawn(false)
  }

  async function exportImage() {
    if (!canvasRef.current || !drawn) return
    setExporting(true)
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvasRef.current!.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png')
      })
      const file = new File([blob], `breaktapes-dossier-${year}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My Athlete Dossier', text: 'My race career on BREAKTAPES' })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = file.name; a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') console.error('[RaceLogPassport] export error', e)
    } finally {
      setExporting(false)
    }
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 900,
    background: 'rgba(0,0,0,0.92)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '1rem', gap: '0.75rem', overflowY: 'auto',
  }
  const pill = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: '999px', cursor: 'pointer', border: 'none',
    fontFamily: 'var(--headline)', fontWeight: 800, fontSize: '11px',
    letterSpacing: '0.08em', textTransform: 'uppercase',
    background: active ? `rgba(${orangeCh},0.15)` : 'rgba(255,255,255,0.04)',
    color: active ? 'var(--orange)' : 'var(--muted)',
    borderWidth: 1, borderStyle: 'solid',
    borderColor: active ? `rgba(${orangeCh},0.4)` : 'var(--border2)',
  })
  const btn = (primary: boolean): React.CSSProperties => ({
    flex: 1, padding: '0.65rem', border: 'none', borderRadius: '6px', cursor: 'pointer',
    fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '12px',
    letterSpacing: '0.1em', textTransform: 'uppercase',
    background: primary ? 'var(--orange)' : 'var(--surface2)',
    color: primary ? '#000' : 'var(--muted)',
    borderWidth: 1, borderStyle: 'solid',
    borderColor: primary ? 'transparent' : 'var(--border2)',
  })

  return (
    <div style={overlay} onClick={onClose}>
      <div
        style={{ width: '100%', maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '10px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '13px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--orange)' }}>
            Athlete Dossier
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>✕</button>
        </div>

        {/* Year filter */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button style={pill(year === 'all')} onClick={() => handleYearChange('all')}>All Time</button>
          {years.map(y => (
            <button key={y} style={pill(year === y)} onClick={() => handleYearChange(y)}>{y}</button>
          ))}
        </div>

        {/* Ratio selector */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {RATIOS.map(r => (
            <button key={r.label} style={{ ...pill(ratio === r.label), borderRadius: '6px' }} onClick={() => handleRatioChange(r.label)}>
              {r.label}
            </button>
          ))}
        </div>

        {/* Canvas preview */}
        <div style={{
          background: 'var(--black)', borderRadius: '10px',
          border: `1px solid rgba(${orangeCh},0.15)`,
          overflow: 'hidden', position: 'relative',
          aspectRatio: `${currentRatio.W} / ${currentRatio.H}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <canvas
            ref={canvasRef}
            style={{
              width: '100%', height: '100%', objectFit: 'contain',
              display: drawn ? 'block' : 'none',
            }}
            aria-label="Athlete dossier preview"
          />
          {!drawn && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: `rgba(${orangeCh},0.5)` }}>
                {filteredRaces.length === 0 ? 'No races to display' : `${filteredRaces.length} mission${filteredRaces.length === 1 ? '' : 's'} · ${currentRatio.label}`}
              </div>
              {filteredRaces.length > 0 && (
                <button
                  onClick={redraw}
                  style={{ padding: '10px 24px', background: 'transparent', border: `1px solid rgba(${orangeCh},0.35)`, borderRadius: '6px', color: 'var(--orange)', fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}
                >
                  Generate Dossier
                </button>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {drawn && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={btn(true)} onClick={exportImage} disabled={exporting}>
              {exporting ? 'Exporting…' : '↑ Declassify & Share'}
            </button>
            <button style={btn(false)} onClick={redraw}>Regenerate</button>
          </div>
        )}

        {drawn && (
          <div style={{ fontFamily: 'var(--mono)', fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted2)', textAlign: 'center' }}>
            {currentRatio.W} × {currentRatio.H}px · {year === 'all' ? 'All Time' : year} · {filteredRaces.length} races
          </div>
        )}
      </div>
    </div>
  )
}

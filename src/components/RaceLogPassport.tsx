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
import { useRef, useState, useCallback, useEffect } from 'react'
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

// Normalize a distance label or numeric km string into a stable key so
// "Marathon" / "42.2" / "42.195" all collide into the same PB bucket.
function normDistKey(d: string): string {
  if (!d) return ''
  const lower = d.toLowerCase().trim()
  if (lower === 'marathon') return 'marathon'
  if (lower === 'half marathon') return 'half'
  if (lower === '70.3' || lower === 'half ironman') return '70.3'
  if (lower === 'ironman' || lower === 'full distance') return 'ironman'
  if (lower === 'olympic') return 'olympic'
  if (lower === 'sprint') return 'sprint'
  if (lower === '5k') return '5k'
  if (lower === '10k') return '10k'
  if (lower === '10 mile' || lower === '10 miles' || lower === '10mi') return '10mile'
  const km = parseFloat(d)
  if (!isNaN(km)) {
    if (km >= 42.0 && km <= 42.3) return 'marathon'
    if (km >= 21.0 && km <= 21.2) return 'half'
    if (km >= 112.9 && km <= 113.1) return '70.3'
    if (km >= 225.9 && km <= 226.1) return 'ironman'
    if (km === 51.5) return 'olympic'
    if (km === 25.75) return 'sprint'
    if (km >= 16.0 && km <= 16.2) return '10mile'
    if (km === 5) return '5k'
    if (km === 10) return '10k'
    return `${km}`
  }
  return lower
}

const DIST_LABELS: Record<string, string> = {
  marathon: 'MARATHON',
  half: 'HALF MARATHON',
  '70.3': '70.3',
  ironman: 'IRONMAN',
  olympic: 'OLYMPIC',
  sprint: 'SPRINT',
  '5k': '5K',
  '10k': '10K',
  '10mile': '10 MILE',
}

const PB_PRIORITY = ['5k', '10k', '10mile', 'half', 'marathon', 'sprint', 'olympic', '70.3', 'ironman']

/**
 * Build the per-distance PB list shown in "BEST RECORDED TIMES".
 *
 * `allRaces`  — every race the user has logged (used to compute lifetime
 *               PB for each distance).
 * `yearFilter` — 'all' or a YYYY string. When a specific year is chosen
 *               we only return distances whose lifetime PB was set in
 *               THAT year — i.e. the dossier celebrates lifetime PBs the
 *               user broke during the chosen year, not just the best
 *               in-year time at each distance.
 */
function buildPBList(
  allRaces: Race[],
  yearFilter: string,
): { key: string; label: string; time: string; race: string; priority?: string }[] {
  const pb: Record<string, Race> = {}
  for (const r of allRaces) {
    if (!r.time || !r.distance) continue
    if (r.outcome && r.outcome !== 'Finished') continue
    const secs = timeToSecs(r.time)
    if (!isFinite(secs)) continue
    const key = normDistKey(r.distance)
    if (!key) continue
    if (!pb[key] || timeToSecs(pb[key].time!) > secs) pb[key] = r
  }
  // Filter to PBs broken in the chosen year (when not 'all').
  const filtered: Record<string, Race> =
    yearFilter === 'all'
      ? pb
      : Object.fromEntries(
          Object.entries(pb).filter(([, r]) => r.date?.startsWith(yearFilter)),
        )
  // Sort by priority then by remaining keys
  const ordered = [
    ...PB_PRIORITY.filter(k => filtered[k]),
    ...Object.keys(filtered).filter(k => !PB_PRIORITY.includes(k)),
  ]
  return ordered.map(key => ({
    key,
    label: DIST_LABELS[key] || key.toUpperCase(),
    time: filtered[key].time!,
    race: filtered[key].name,
    priority: filtered[key].priority,
  }))
}

function buildPBIdSet(races: Race[]): Set<string> {
  const pb: Record<string, Race> = {}
  for (const r of races) {
    if (!r.time || !r.distance || !r.id) continue
    if (r.outcome && r.outcome !== 'Finished') continue
    const secs = timeToSecs(r.time)
    if (!isFinite(secs)) continue
    const key = normDistKey(r.distance)
    if (!key) continue
    if (!pb[key] || timeToSecs(pb[key].time!) > secs) pb[key] = r
  }
  return new Set(Object.values(pb).map(r => r.id))
}

function distanceSubtitle(r: Race): string {
  const key = normDistKey(r.distance)
  const label = DIST_LABELS[key]
  if (label) return label
  // Numeric distance — append unit
  const km = parseFloat(r.distance)
  if (!isNaN(km)) return `${km} KM`
  return r.distance.toUpperCase()
}

const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

// Split YYYY-MM-DD into ["DD MMM", "YYYY"] for the two-line date column.
function dateParts(d: string | undefined): [string, string] {
  if (!d) return ['', '']
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return [String(d), '']
  const mon = MONTH_ABBR[parseInt(m[2], 10) - 1] ?? m[2]
  return [`${m[3]} ${mon}`, m[1]]
}

// Normalize any time string to HH:MM:SS with leading zeros.
function fmtHHMMSS(t: string): string {
  if (!t) return t
  const parts = t.split(':')
  if (parts.length === 2) parts.unshift('0')
  return parts.slice(0, 3).map(p => String(parseInt(p, 10) || 0).padStart(2, '0')).join(':')
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
  races: Race[]          // year-filtered (or full when year='all')
  allRaces: Race[]       // unfiltered — needed to compute lifetime PBs
  athlete?: Athlete
  year: string
  W: number
  H: number
  avatarImg?: HTMLImageElement | null
}

function drawDossier(canvas: HTMLCanvasElement, opts: DrawOpts) {
  const { races, allRaces, athlete, year, W, H, avatarImg } = opts
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
  // Lifetime PBs computed across ALL races; filter to year when chosen.
  // Same set of race IDs used to highlight gold rows in the Mission Log
  // — a row is only "PB" if it set the lifetime record at its distance.
  const pbList = buildPBList(allRaces, year)
  const pbIds = buildPBIdSet(allRaces)
  const sports = getSports(races)
  const flags = [...new Set(races.map(r => r.country).filter(Boolean))]
    .map(countryToFlag).filter(Boolean).slice(0, 16)
  // No source-side cap — downstream `maxRows` (computed from canvas
  // height ÷ row height) is what limits visible rows. Capping at 10
  // here was hiding races on All Time for users with deeper histories.
  const recentRaces = [...races].sort((a, b) => b.date.localeCompare(a.date))
  const yearLabel = year === 'all' ? 'All Time' : year

  const isVertical = H > W
  // Vertical formats (9:16, 3:4) have narrow width — use a smaller divisor so fonts
  // stay readable. Horizontal base stays at 1200px.
  const s = isVertical ? W / 700 : W / 1200

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
  const stampX = isVertical ? W * 0.72 : W * 0.80
  const stampY = isVertical ? H * 0.06 : H * 0.13
  ctx.translate(stampX, stampY)
  ctx.rotate(0.26) // ~15deg
  ctx.font = `900 ${Math.round(16 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
  ctx.letterSpacing = `${Math.round(4 * s)}px`
  ctx.fillStyle = `rgba(${orangeCh},0.16)`
  ctx.strokeStyle = `rgba(${orangeCh},0.16)`
  ctx.lineWidth = 2 * s
  const stampW = ctx.measureText('CLASSIFIED').width + 20 * s
  const stampH = 28 * s
  ctx.strokeRect(-10 * s, -stampH * 0.75, stampW, stampH)
  ctx.fillText('CLASSIFIED', 0, 0)
  ctx.restore()

  // ── Header band ──
  const headerH = Math.round(isVertical ? 84 * s : 76 * s)
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
  ctx.font = `600 ${Math.round(11 * s)}px "Geist Mono", "Courier New", monospace`
  ctx.letterSpacing = `${Math.round(3 * s)}px`
  ctx.textAlign = 'left'
  ctx.fillText('BREAKTAPES ATHLETIC INTELLIGENCE', 16 * s, 26 * s)

  ctx.fillStyle = D.white
  ctx.font = `900 ${Math.round(28 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
  ctx.letterSpacing = `${Math.round(2 * s)}px`
  ctx.fillText('ATHLETE DOSSIER', 16 * s, headerH - 16 * s)

  // Year label top-right
  ctx.fillStyle = `rgba(${orangeCh},0.65)`
  ctx.font = `700 ${Math.round(12 * s)}px "Geist Mono", "Courier New", monospace`
  ctx.letterSpacing = `${Math.round(2 * s)}px`
  ctx.textAlign = 'right'
  ctx.fillText(yearLabel.toUpperCase(), W - 16 * s, 32 * s)

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

    // ID block — photo (Clerk imageUrl) if loaded, else initials monogram
    const avatarSize = Math.round(72 * s)
    if (avatarImg && avatarImg.complete && avatarImg.naturalWidth > 0) {
      // Glow ring behind photo
      ctx.save()
      ctx.shadowColor = `rgba(${orangeCh},0.4)`
      ctx.shadowBlur = 18 * s
      ctx.fillStyle = D.orange
      roundRect(ctx, pad, ly, avatarSize, avatarSize, 12 * s); ctx.fill()
      ctx.restore()
      // Clip + draw photo
      ctx.save()
      roundRect(ctx, pad, ly, avatarSize, avatarSize, 12 * s); ctx.clip()
      ctx.drawImage(avatarImg, pad, ly, avatarSize, avatarSize)
      ctx.restore()
      // Border ring
      ctx.strokeStyle = `rgba(${orangeCh},0.5)`; ctx.lineWidth = 2 * s
      roundRect(ctx, pad, ly, avatarSize, avatarSize, 12 * s); ctx.stroke()
    } else {
      const ag2 = ctx.createLinearGradient(pad, ly, pad + avatarSize, ly + avatarSize)
      ag2.addColorStop(0, D.orange); ag2.addColorStop(1, D.orangeDark)
      ctx.fillStyle = ag2
      roundRect(ctx, pad, ly, avatarSize, avatarSize, 12 * s); ctx.fill()
      ctx.shadowColor = `rgba(${orangeCh},0.4)`
      ctx.shadowBlur = 18 * s
      ctx.fillStyle = ag2
      roundRect(ctx, pad, ly, avatarSize, avatarSize, 12 * s); ctx.fill()
      ctx.shadowBlur = 0
      ctx.fillStyle = '#FFFFFF'
      ctx.font = `900 ${Math.round(30 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
      ctx.letterSpacing = '0px'
      ctx.textAlign = 'center'
      ctx.fillText(initials, pad + avatarSize / 2, ly + avatarSize * 0.68)
    }

    const nameX = pad + avatarSize + 14 * s
    ctx.textAlign = 'left'
    ctx.fillStyle = D.white
    ctx.font = `900 ${Math.round(22 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
    ctx.letterSpacing = `${Math.round(1.5 * s)}px`
    ctx.fillText(truncateText(ctx, name.toUpperCase(), leftW - nameX - pad), nameX, ly + 22 * s)

    ctx.fillStyle = `rgba(${orangeCh},0.7)`
    ctx.font = `500 ${Math.round(12 * s)}px "Geist Mono", "Courier New", monospace`
    ctx.letterSpacing = '0px'
    const idCode = `ID: BT-${raceCount}-${initials}${location ? ' · ' + location : ''}`
    ctx.fillText(truncateText(ctx, idCode, leftW - nameX - pad), nameX, ly + 40 * s)

    if (athlete?.username) {
      ctx.fillStyle = `rgba(${orangeCh},0.65)`
      ctx.font = `600 ${Math.round(11 * s)}px "Geist Mono", "Courier New", monospace`
      ctx.letterSpacing = '0px'
      ctx.fillText(`@${athlete.username}`, nameX, ly + 56 * s)
    }

    // Sport tags
    let tagX = nameX
    const tagY = ly + 60 * s
    for (const sport of sports) {
      ctx.font = `800 ${Math.round(11 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
      ctx.letterSpacing = `${Math.round(1.5 * s)}px`
      const tw = ctx.measureText(sport.toUpperCase()).width + 14 * s
      const tagColor = sport === 'Triathlete' ? D.purple : D.orange
      if (tagColor === D.orange) {
        ctx.strokeStyle = `rgba(${orangeCh},0.35)`
      } else {
        ctx.strokeStyle = 'rgba(124,58,237,0.35)'
      }
      ctx.lineWidth = 1
      roundRect(ctx, tagX, tagY - 14 * s, tw, 20 * s, 3 * s)
      ctx.stroke()
      ctx.fillStyle = tagColor
      ctx.fillText(sport.toUpperCase(), tagX + 7 * s, tagY)
      tagX += tw + 6 * s
    }

    ly += avatarSize + 18 * s

    // Divider
    ctx.strokeStyle = D.divider
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(pad, ly); ctx.lineTo(leftW - pad * 0.5, ly); ctx.stroke()
    ly += 10 * s

    // Intel grid (2×2)
    const gridW = leftW - pad * 1.5
    const cellW = (gridW - 8 * s) / 2
    const cellH = Math.round(Math.min(76 * s, bodyH * 0.20))
    const intelCells = [
      { label: 'Missions complete', val: String(raceCount), color: D.orange },
      { label: 'Territories entered', val: String(countryCount), color: D.gold },
      { label: 'Citations earned', val: String(medalCount), color: D.green },
      { label: `Distance covered`, val: `${kmTotal.toLocaleString()} km`, color: D.white },
    ]
    intelCells.forEach((c, i) => {
      const cx = pad + (i % 2) * (cellW + 8 * s)
      const cy = ly + Math.floor(i / 2) * (cellH + 8 * s)
      ctx.fillStyle = D.cell
      roundRect(ctx, cx, cy, cellW, cellH, 8 * s); ctx.fill()
      ctx.strokeStyle = D.cellBorder; ctx.lineWidth = 1
      roundRect(ctx, cx, cy, cellW, cellH, 8 * s); ctx.stroke()

      ctx.fillStyle = D.muted
      ctx.font = `500 ${Math.round(11 * s)}px "Geist Mono", "Courier New", monospace`
      ctx.letterSpacing = `${Math.round(1.5 * s)}px`
      ctx.textAlign = 'left'
      ctx.fillText(c.label.toUpperCase(), cx + 12 * s, cy + 22 * s)

      ctx.fillStyle = c.color
      const valFontSize = c.val.length > 6 ? Math.round(24 * s) : Math.round(34 * s)
      ctx.font = `900 ${valFontSize}px "Barlow Condensed", "Arial Narrow", sans-serif`
      ctx.letterSpacing = '-1px'
      ctx.fillText(truncateText(ctx, c.val, cellW - 16 * s), cx + 12 * s, cy + cellH - 14 * s)
    })
    ly += cellH * 2 + 8 * s * 2 + 8 * s

    // Best recorded times — show every distance the user has a PB at,
    // not just the single fastest. Stacked rows: distance label · time.
    if (pbList.length > 0) {
      const headerRow = 28 * s
      const rowOuter = 36 * s
      const rowsToShow = Math.min(pbList.length, 5)
      const blockH = Math.round(headerRow + rowOuter * rowsToShow + 14 * s)
      // Striped background
      for (let x = pad; x < leftW - pad * 0.5; x += 8 * s) {
        ctx.fillStyle = `rgba(${orangeCh},0.04)`
        ctx.fillRect(x, ly, 2 * s, blockH)
      }
      ctx.strokeStyle = `rgba(${orangeCh},0.18)`; ctx.lineWidth = 1
      roundRect(ctx, pad, ly, leftW - pad * 1.5, blockH, 8 * s); ctx.stroke()

      ctx.fillStyle = `rgba(${orangeCh},0.6)`
      ctx.font = `600 ${Math.round(12 * s)}px "Geist Mono", "Courier New", monospace`
      ctx.letterSpacing = `${Math.round(2 * s)}px`
      ctx.textAlign = 'left'
      ctx.fillText('BEST RECORDED TIMES', pad + 14 * s, ly + 22 * s)

      const pbRightEdge = pad + leftW - pad * 1.5 - 10 * s
      const priBadgeW = 22 * s
      pbList.slice(0, rowsToShow).forEach((p, i) => {
        const rowY = ly + headerRow + rowOuter * i + 8 * s
        // Distance label (left)
        ctx.fillStyle = D.white
        ctx.globalAlpha = 0.78
        ctx.font = `700 ${Math.round(15 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
        ctx.letterSpacing = `${Math.round(1.5 * s)}px`
        ctx.textAlign = 'left'
        ctx.fillText(p.label, pad + 14 * s, rowY + 18 * s)
        ctx.globalAlpha = 1
        // Priority badge (far right, fixed column)
        if (p.priority) {
          const priColor = p.priority === 'A' ? D.orange : p.priority === 'B' ? D.green : D.muted
          ctx.fillStyle = priColor
          ctx.font = `800 ${Math.round(13 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
          ctx.letterSpacing = '0px'
          ctx.textAlign = 'right'
          ctx.fillText(p.priority, pbRightEdge, rowY + 18 * s)
        }
        // Time (right-aligned, gold, consistent column)
        ctx.fillStyle = D.gold
        ctx.font = `900 ${Math.round(22 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
        ctx.letterSpacing = '-0.5px'
        ctx.textAlign = 'right'
        ctx.fillText(fmtHHMMSS(p.time), pbRightEdge - priBadgeW, rowY + 20 * s)
      })
      ctx.textAlign = 'left'
      ly += blockH + 14 * s
    }

    // Field operations (flags)
    if (flags.length > 0) {
      ctx.fillStyle = D.muted2
      ctx.font = `500 ${Math.round(11 * s)}px "Geist Mono", "Courier New", monospace`
      ctx.letterSpacing = `${Math.round(2 * s)}px`
      ctx.textAlign = 'left'
      ctx.fillText('FIELD OPERATIONS', pad, ly + 14 * s)
      ly += 24 * s

      ctx.font = `${Math.round(20 * s)}px serif`
      ctx.letterSpacing = `${Math.round(3 * s)}px`
      const maxFlagsW = leftW - pad * 2
      let fx = pad
      const fExtra = flags.length > 8 ? flags.length - 8 : 0
      flags.slice(0, 8).forEach(f => {
        if (fx + 26 * s > pad + maxFlagsW) return
        ctx.fillText(f, fx, ly + 20 * s)
        fx += 26 * s
      })
      if (fExtra > 0) {
        ctx.fillStyle = D.muted
        ctx.font = `500 ${Math.round(12 * s)}px "Geist Mono", monospace`
        ctx.letterSpacing = '0px'
        ctx.fillText(`+${fExtra}`, fx, ly + 18 * s)
      }
    }

    // ── Right column: Mission Log ──
    let ry = bodyY

    ctx.fillStyle = `rgba(${orangeCh},0.65)`
    ctx.font = `600 ${Math.round(12 * s)}px "Geist Mono", "Courier New", monospace`
    ctx.letterSpacing = `${Math.round(3 * s)}px`
    ctx.textAlign = 'left'
    ctx.fillText('MISSION LOG', rightX, ry + 14 * s)
    ry += 28 * s

    ctx.strokeStyle = D.divider; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(rightX, ry); ctx.lineTo(W - pad, ry); ctx.stroke()
    ry += 10 * s

    // Two-line rows so distance can sit under race name. Bumped row height
    // to 48 * s (was 32) to fit the larger glyphs and second line.
    const minRowH = 48 * s
    const rowH = Math.round(Math.max((bodyH - 48 * s) / Math.max(recentRaces.length, 1), minRowH))
    const maxRows = Math.floor((H - ry - pad * 2) / rowH)

    recentRaces.slice(0, maxRows).forEach((r, i) => {
      const rx = rightX
      const rw = rightW
      const ryRow = ry + i * rowH
      const isPB = pbIds.has(r.id)
      const nameY = ryRow + rowH * 0.42
      const subY  = ryRow + rowH * 0.78

      // Alternating subtle bg + faint gold tint for PB rows
      if (isPB) {
        ctx.fillStyle = `rgba(${D.goldCh ?? '200, 150, 60'},0.06)`
        ctx.fillRect(rx, ryRow, rw, rowH)
      } else if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.015)'
        ctx.fillRect(rx, ryRow, rw, rowH)
      }

      const flag = countryToFlag(r.country)
      const [dDM, dY] = dateParts(r.date)
      const raceName = r.name.replace(/\s+\d{4}$/, '').substring(0, 36)
      const flagMidY = (nameY + subY) / 2 + 6 * s

      // Date column (left, mono, 2-line stack: "DD MMM" / "YYYY")
      ctx.fillStyle = `rgba(${orangeCh},0.75)`
      ctx.font = `500 ${Math.round(13 * s)}px "Geist Mono", monospace`
      ctx.letterSpacing = '0px'
      ctx.textAlign = 'left'
      ctx.fillText(dDM, rx, nameY)
      ctx.fillStyle = `rgba(${orangeCh},0.55)`
      ctx.font = `500 ${Math.round(11 * s)}px "Geist Mono", monospace`
      ctx.fillText(dY, rx, subY)

      // Flag — larger, vertically centered between name and distance lines
      ctx.fillStyle = D.white
      ctx.font = `${Math.round(22 * s)}px "Barlow", Arial, sans-serif`
      ctx.letterSpacing = '0px'
      ctx.fillText(`${flag} `, rx + 86 * s, flagMidY)

      // Race name — line 1
      ctx.fillStyle = D.white
      ctx.font = `700 ${Math.round(18 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
      ctx.letterSpacing = `${Math.round(0.5 * s)}px`
      ctx.fillText(truncateText(ctx, raceName, rw - 250 * s), rx + 116 * s, nameY)

      // Distance subtitle — line 2 (with PB badge tag if applicable)
      const distLabel = distanceSubtitle(r)
      ctx.fillStyle = isPB ? D.gold : `rgba(${orangeCh},0.7)`
      ctx.font = `600 ${Math.round(11 * s)}px "Geist Mono", monospace`
      ctx.letterSpacing = `${Math.round(1.5 * s)}px`
      ctx.fillText(isPB ? `${distLabel}  ·  PB` : distLabel, rx + 116 * s, subY)

      if (r.time) {
        // Priority badge — right of time
        if (r.priority) {
          const priColor = r.priority === 'A' ? D.orange : r.priority === 'B' ? D.green : D.muted
          ctx.fillStyle = priColor
          ctx.font = `800 ${Math.round(13 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
          ctx.letterSpacing = '0px'
          ctx.textAlign = 'right'
          ctx.fillText(r.priority, W - pad, subY)
        }
        ctx.fillStyle = isPB ? D.gold : D.white
        ctx.globalAlpha = isPB ? 1 : 0.9
        ctx.font = `800 ${Math.round(18 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
        ctx.letterSpacing = '0px'
        ctx.textAlign = 'right'
        ctx.fillText(fmtHHMMSS(r.time), W - pad - (r.priority ? 20 * s : 0), nameY)
        ctx.globalAlpha = 1
      }

      // Bottom divider
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(rx, ryRow + rowH - 1)
      ctx.lineTo(W - pad, ryRow + rowH - 1)
      ctx.stroke()
    })

  } else {
    // ── VERTICAL LAYOUT (9:16, 3:4) ──
    let vy = bodyY

    // ID block (horizontal) — photo or monogram
    const avatarSize = Math.round(72 * s)
    if (avatarImg && avatarImg.complete && avatarImg.naturalWidth > 0) {
      ctx.save()
      roundRect(ctx, pad, vy, avatarSize, avatarSize, 11 * s); ctx.clip()
      ctx.drawImage(avatarImg, pad, vy, avatarSize, avatarSize)
      ctx.restore()
      ctx.strokeStyle = `rgba(${orangeCh},0.5)`; ctx.lineWidth = 2 * s
      roundRect(ctx, pad, vy, avatarSize, avatarSize, 11 * s); ctx.stroke()
    } else {
      const ag2 = ctx.createLinearGradient(pad, vy, pad + avatarSize, vy + avatarSize)
      ag2.addColorStop(0, D.orange); ag2.addColorStop(1, D.orangeDark)
      ctx.fillStyle = ag2
      roundRect(ctx, pad, vy, avatarSize, avatarSize, 11 * s); ctx.fill()
      ctx.fillStyle = '#FFF'
      ctx.font = `900 ${Math.round(28 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
      ctx.letterSpacing = '0px'; ctx.textAlign = 'center'
      ctx.fillText(initials, pad + avatarSize / 2, vy + avatarSize * 0.68)
    }

    const nameX = pad + avatarSize + 14 * s
    ctx.textAlign = 'left'
    ctx.fillStyle = D.white
    ctx.font = `900 ${Math.round(24 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
    ctx.letterSpacing = `${Math.round(1 * s)}px`
    ctx.fillText(truncateText(ctx, name.toUpperCase(), W - nameX - pad), nameX, vy + 26 * s)

    ctx.fillStyle = `rgba(${orangeCh},0.7)`
    ctx.font = `500 ${Math.round(12 * s)}px "Geist Mono", monospace`
    ctx.letterSpacing = '0px'
    ctx.fillText(truncateText(ctx, `ID: BT-${raceCount}-${initials}${location ? ' · ' + location : ''}`, W - nameX - pad), nameX, vy + 46 * s)

    if (athlete?.username) {
      ctx.fillStyle = `rgba(${orangeCh},0.65)`
      ctx.font = `600 ${Math.round(11 * s)}px "Geist Mono", monospace`
      ctx.letterSpacing = '0px'
      ctx.fillText(`@${athlete.username}`, nameX, vy + 62 * s)
    }

    vy += avatarSize + 18 * s

    // Intel strip (4-across)
    const intelCells = [
      { label: 'Missions', val: String(raceCount), color: D.orange },
      { label: 'Countries', val: String(countryCount), color: D.gold },
      { label: 'Citations', val: String(medalCount), color: D.green },
      { label: 'KM', val: kmTotal >= 1000 ? `${(kmTotal/1000).toFixed(1)}K` : String(kmTotal), color: D.white },
    ]
    const stripCellW = (W - pad * 2 - 8 * s * 3) / 4
    const stripCellH = Math.round(72 * s)
    intelCells.forEach((c, i) => {
      const cx = pad + i * (stripCellW + 8 * s)
      ctx.fillStyle = D.cell
      roundRect(ctx, cx, vy, stripCellW, stripCellH, 7 * s); ctx.fill()
      ctx.strokeStyle = D.cellBorder; ctx.lineWidth = 1
      roundRect(ctx, cx, vy, stripCellW, stripCellH, 7 * s); ctx.stroke()
      ctx.fillStyle = D.muted
      ctx.font = `500 ${Math.round(11 * s)}px "Geist Mono", monospace`
      ctx.letterSpacing = `${Math.round(1 * s)}px`; ctx.textAlign = 'left'
      ctx.fillText(c.label.toUpperCase(), cx + 10 * s, vy + 22 * s)
      ctx.fillStyle = c.color
      ctx.font = `900 ${Math.round(28 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
      ctx.letterSpacing = '-1px'
      ctx.fillText(truncateText(ctx, c.val, stripCellW - 14 * s), cx + 10 * s, vy + stripCellH - 14 * s)
    })
    vy += stripCellH + 14 * s

    // Best recorded times — distance · time per row
    if (pbList.length > 0) {
      const headerRow = 28 * s
      const rowOuter = 32 * s
      const rowsToShow = Math.min(pbList.length, 4)
      const blockH = Math.round(headerRow + rowOuter * rowsToShow + 14 * s)
      for (let x = pad; x < W - pad; x += 8 * s) {
        ctx.fillStyle = `rgba(${orangeCh},0.04)`; ctx.fillRect(x, vy, 2 * s, blockH)
      }
      ctx.strokeStyle = `rgba(${orangeCh},0.18)`; ctx.lineWidth = 1
      roundRect(ctx, pad, vy, W - pad * 2, blockH, 7 * s); ctx.stroke()
      ctx.fillStyle = `rgba(${orangeCh},0.6)`
      ctx.font = `600 ${Math.round(12 * s)}px "Geist Mono", monospace`
      ctx.letterSpacing = `${Math.round(2 * s)}px`; ctx.textAlign = 'left'
      ctx.fillText('BEST RECORDED TIMES', pad + 12 * s, vy + 22 * s)

      const vPriW = 22 * s
      pbList.slice(0, rowsToShow).forEach((p, i) => {
        const rowY = vy + headerRow + rowOuter * i + 6 * s
        ctx.fillStyle = D.white
        ctx.globalAlpha = 0.78
        ctx.font = `700 ${Math.round(14 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
        ctx.letterSpacing = `${Math.round(1.5 * s)}px`
        ctx.textAlign = 'left'
        ctx.fillText(p.label, pad + 14 * s, rowY + 18 * s)
        ctx.globalAlpha = 1
        // Priority badge (far right)
        if (p.priority) {
          const priColor = p.priority === 'A' ? D.orange : p.priority === 'B' ? D.green : D.muted
          ctx.fillStyle = priColor
          ctx.font = `800 ${Math.round(13 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
          ctx.letterSpacing = '0px'
          ctx.textAlign = 'right'
          ctx.fillText(p.priority, W - pad - 14 * s, rowY + 18 * s)
        }
        ctx.fillStyle = D.gold
        ctx.font = `900 ${Math.round(20 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
        ctx.letterSpacing = '-0.5px'
        ctx.textAlign = 'right'
        ctx.fillText(fmtHHMMSS(p.time), W - pad - 14 * s - (p.priority ? vPriW : 0), rowY + 20 * s)
      })
      ctx.textAlign = 'left'
      vy += blockH + 14 * s
    }

    // Mission log
    ctx.fillStyle = `rgba(${orangeCh},0.65)`
    ctx.font = `600 ${Math.round(12 * s)}px "Geist Mono", monospace`
    ctx.letterSpacing = `${Math.round(2.5 * s)}px`; ctx.textAlign = 'left'
    ctx.fillText('MISSION LOG', pad, vy + 14 * s)
    vy += 26 * s

    ctx.strokeStyle = D.divider; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(pad, vy); ctx.lineTo(W - pad, vy); ctx.stroke()
    vy += 8 * s

    const rowH = Math.round(46 * s)
    const flagsReserve = flags.length > 0 ? 44 * s : 0
    const maxRows = Math.floor((H - vy - pad * 2 - flagsReserve) / rowH)
    recentRaces.slice(0, maxRows).forEach((r, i) => {
      const ryRow = vy + i * rowH
      const isPB = pbIds.has(r.id)
      const nameY = ryRow + rowH * 0.42
      const subY  = ryRow + rowH * 0.78
      if (isPB) {
        ctx.fillStyle = `rgba(${D.goldCh ?? '200, 150, 60'},0.06)`
        ctx.fillRect(pad, ryRow, W - pad * 2, rowH)
      } else if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.015)'
        ctx.fillRect(pad, ryRow, W - pad * 2, rowH)
      }
      const flag = countryToFlag(r.country)
      const [dDM, dY] = dateParts(r.date)
      const flagMidY = (nameY + subY) / 2 + 6 * s
      // Date column (left, 2-line stack DD MMM / YYYY)
      ctx.fillStyle = `rgba(${orangeCh},0.75)`
      ctx.font = `500 ${Math.round(13 * s)}px "Geist Mono", monospace`
      ctx.letterSpacing = '0px'; ctx.textAlign = 'left'
      ctx.fillText(dDM, pad, nameY)
      ctx.fillStyle = `rgba(${orangeCh},0.55)`
      ctx.font = `500 ${Math.round(11 * s)}px "Geist Mono", monospace`
      ctx.fillText(dY, pad, subY)
      // Flag — larger, centered between name and distance lines
      ctx.fillStyle = D.white
      ctx.font = `${Math.round(21 * s)}px "Barlow", Arial, sans-serif`
      ctx.letterSpacing = '0px'
      ctx.fillText(`${flag} `, pad + 86 * s, flagMidY)
      ctx.fillStyle = D.white
      ctx.font = `700 ${Math.round(17 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
      ctx.letterSpacing = `${Math.round(0.3 * s)}px`
      const raceName = r.name.replace(/\s+\d{4}$/, '').substring(0, 36)
      ctx.fillText(truncateText(ctx, raceName, W - pad * 2 - 250 * s), pad + 116 * s, nameY)
      // Distance subtitle / PB tag
      const distLabel = distanceSubtitle(r)
      ctx.fillStyle = isPB ? D.gold : `rgba(${orangeCh},0.7)`
      ctx.font = `600 ${Math.round(11 * s)}px "Geist Mono", monospace`
      ctx.letterSpacing = `${Math.round(1.5 * s)}px`
      ctx.fillText(isPB ? `${distLabel}  ·  PB` : distLabel, pad + 116 * s, subY)
      if (r.time) {
        if (r.priority) {
          const priColor = r.priority === 'A' ? D.orange : r.priority === 'B' ? D.green : D.muted
          ctx.fillStyle = priColor
          ctx.font = `800 ${Math.round(13 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
          ctx.letterSpacing = '0px'; ctx.textAlign = 'right'
          ctx.fillText(r.priority, W - pad, subY)
        }
        ctx.fillStyle = isPB ? D.gold : D.white
        ctx.globalAlpha = isPB ? 1 : 0.9
        ctx.font = `800 ${Math.round(17 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
        ctx.letterSpacing = '0px'; ctx.textAlign = 'right'
        ctx.fillText(fmtHHMMSS(r.time), W - pad - (r.priority ? 20 * s : 0), nameY)
        ctx.globalAlpha = 1
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(pad, ryRow + rowH - 1); ctx.lineTo(W - pad, ryRow + rowH - 1); ctx.stroke()
    })

    // Flags at bottom
    const fY = H - 32 * s
    if (flags.length > 0) {
      ctx.font = `${Math.round(18 * s)}px serif`
      ctx.letterSpacing = `${Math.round(3 * s)}px`; ctx.textAlign = 'left'
      let fx = pad
      flags.slice(0, 14).forEach(f => { ctx.fillText(f, fx, fY); fx += 24 * s })
    }
  }

  // ── Footer watermark ──
  ctx.fillStyle = `rgba(${orangeCh},0.32)`
  ctx.font = `600 ${Math.round(12 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`
  ctx.letterSpacing = `${Math.round(1.5 * s)}px`
  ctx.textAlign = 'right'
  ctx.fillText('APP.BREAKTAPES.COM', W - pad, H - 14 * s)
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
  initialYear?: string
  avatarUrl?: string | null
}

export function RaceLogPassport({ races, athlete, onClose, initialYear = 'all', avatarUrl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [year, setYear] = useState<string>(initialYear)
  const [ratio, setRatio] = useState<string>('16:9')
  const [drawn, setDrawn] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [avatarImg, setAvatarImg] = useState<HTMLImageElement | null>(null)

  // Read theme channel vars for JSX inline styles (CSS vars resolve at render time)
  const orangeCh = getComputedStyle(document.documentElement).getPropertyValue('--orange-ch').trim() || '232, 78, 27'

  // Pre-load avatar image. Clerk's CDN serves with permissive CORS so
  // crossOrigin='anonymous' lets us draw it onto the canvas without
  // tainting it (which would block toBlob() at export time).
  useEffect(() => {
    if (!avatarUrl) { setAvatarImg(null); return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setAvatarImg(img)
    img.onerror = () => setAvatarImg(null)
    img.src = avatarUrl
    return () => { img.onload = null; img.onerror = null }
  }, [avatarUrl])

  const years = getYears(races)
  const currentRatio = RATIOS.find(r => r.label === ratio)!

  const filteredRaces = year === 'all' ? races : races.filter(r => r.date?.startsWith(year))

  const redraw = useCallback(() => {
    if (!canvasRef.current) return
    drawDossier(canvasRef.current, {
      races: filteredRaces,
      allRaces: races,
      athlete,
      year,
      W: currentRatio.W,
      H: currentRatio.H,
      avatarImg,
    })
    setDrawn(true)
  }, [filteredRaces, races, athlete, year, currentRatio, avatarImg])

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

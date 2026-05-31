// ── Race priority labels ──────────────────────────────────────────────────────

export const RACE_PRIORITY_OPTIONS = [
  { value: '',  label: '— Unset —' },
  { value: 'A', label: 'A Race — Goal Race' },
  { value: 'B', label: 'B Race — Training' },
  { value: 'C', label: 'C Race — Fun / Pacing' },
] as const

/** Short display label for a priority letter, e.g. 'A' → 'A Race — Goal Race' */
export function racePriorityLabel(p: string | undefined): string {
  const found = RACE_PRIORITY_OPTIONS.find(o => o.value === p)
  return found ? found.label : ''
}

/**
 * Convert any date string the app stores ("YYYY-MM-DD") into the canonical
 * display format DD-MM-YYYY. Pass-through for empty / unparseable input.
 *
 * Use this anywhere the user sees a date as plain text. Date inputs and
 * internal comparisons MUST stay in YYYY-MM-DD.
 */
const _MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const _MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']

export function fmtDateDDMM(d: string | undefined | null): string {
  if (!d) return ''
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return String(d)
  const mon = _MONTHS[parseInt(m[2], 10) - 1] ?? m[2]
  return `${m[3]} ${mon} ${m[1]}`
}

function ordinalSuffix(n: number): string {
  const s = ['th','st','nd','rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

/** "27th February 2026" — full ordinal date for display in widgets */
export function fmtDateOrdinal(d: string | undefined | null): string {
  if (!d) return ''
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return String(d)
  const day = parseInt(m[3], 10)
  const mon = _MONTHS_FULL[parseInt(m[2], 10) - 1] ?? m[2]
  return `${ordinalSuffix(day)} ${mon} ${m[1]}`
}

const SPONSOR_RE = /\b(tcs|bmo|bmw|virgin money|adnoc|asics|zurich|bank of america)\b/g

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(SPONSOR_RE, '')
    .replace(/\d{4}/g, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function bigrams(s: string): Set<string> {
  const set = new Set<string>()
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
  return set
}

export function similarity(a: string, b: string): number {
  const ba = bigrams(a), bb = bigrams(b)
  let shared = 0
  ba.forEach(bg => { if (bb.has(bg)) shared++ })
  return (2 * shared) / (ba.size + bb.size) || 0
}

// ── Distance display label ────────────────────────────────────────────────────

/**
 * Convert any stored race.distance value (text label OR numeric km string)
 * to a human-readable display label.  Single source of truth used app-wide.
 */
export function distLabel(d: string | undefined, sport?: string): string {
  if (!d) return ''
  const lower = d.toLowerCase().trim()
  if (lower === 'marathon' || lower === 'full marathon') return 'Marathon'
  if (lower === 'half marathon' || lower === 'half') return 'Half Marathon'
  if (lower === 'ironman' || lower === 'full ironman' || lower === 'full distance') return 'IRONMAN'
  if (lower === '70.3' || lower === 'half ironman' || lower === 'ironman 70.3' || lower === 'middle distance') return '70.3 / Middle Distance'
  if (lower === 'olympic' || lower === 'olympic triathlon') return 'Olympic'
  if (lower === 'sprint' || lower === 'sprint triathlon') return 'Sprint'
  if (lower === '1k' || lower === '1km') return '1K'
  if (lower === '2k' || lower === '2km') return '2K'
  if (lower === '3k' || lower === '3km') return '3K'
  if (lower === '4k' || lower === '4km') return '4K'
  if (lower === '5k' || lower === '5km') return '5K'
  if (lower === '10k' || lower === '10km') return '10K'
  if (lower === '10 mile' || lower === '10 miles' || lower === '10mi') return '10 Mile'
  if (lower === 'ultra' || lower === 'ultramarathon') return 'Ultra'
  if (lower === 'pto t100' || lower === 'pto 100' || lower === 't100') return 'PTO 100'
  if (lower === 'hyrox') return 'HYROX'
  const n = parseFloat(d)
  if (isNaN(n)) return d
  const s = (sport ?? '').toLowerCase()
  const isTri = s.includes('tri') || s.includes('iron')
  // Triathlon-specific numeric distances — ONLY when the sport is a triathlon.
  // Otherwise a 50km or 100km RUN matches "Olympic" / "PTO 100" by km range and
  // gets mislabelled as a tri distance instead of an ultra.
  if (isTri) {
    if (n >= 220 && n <= 230) return 'IRONMAN / Full Distance'
    if (n >= 108 && n <= 116) return '70.3 / Middle Distance'
    if (n >= 99.5 && n <= 100.5) return 'PTO 100'
    if (n >= 50 && n <= 53) return 'Olympic'
    if (n >= 24 && n <= 27) return 'Sprint'
    if (n >= 12.5 && n <= 13.5) return 'Super Sprint'
  }
  // Standard running road distances (unambiguous across sports)
  if (n >= 42.0 && n <= 42.3) return 'Marathon'
  if (n >= 21.0 && n <= 21.2) return 'Half Marathon'
  if (n >= 16.0 && n <= 16.2) return '10 Mile'
  if (n >= 10 && n <= 10.1) return '10K'
  if (n >= 5 && n <= 5.1) return '5K'
  if (n > 42.3) {
    // Only label as Ultra for running — triathlon/cycling/swim custom distances are not ultra runs
    const isEndurance = isTri || s === 'cycling' || s === 'swimming'
    if (!isEndurance) return 'Ultra'
    return `${n} km`
  }
  // Short distances: show as "3K", "1K" etc (whole km values)
  if (n >= 1 && n < 5 && Number.isInteger(n)) return `${n}K`
  return `${n} km`
}

// ── Distance resolution ───────────────────────────────────────────────────────

const DIST_KM: Record<string, number> = {
  '5k': 5, '5km': 5,
  '10k': 10, '10km': 10,
  '10 mile': 16.09,
  'half marathon': 21.1, 'half': 21.1,
  'marathon': 42.2,
  '50k': 50, '50km': 50,
  '50 mile': 80.47,
  '100k': 100, '100km': 100,
  '100 mile': 160.93,
  'sprint triathlon': 25.75,
  'olympic triathlon': 51.5,
  'half iron': 113, '70.3': 113, 'ironman 70.3': 113,
  'full iron': 226, 'ironman': 226,
}

/** Map a distance label or numeric string to km number. Returns null for non-numeric labels (HYROX categories, etc.). */
export function resolveDistKm(dist: string): number | null {
  if (!dist) return null
  const mapped = DIST_KM[dist.toLowerCase()]
  if (mapped != null) return mapped
  const n = parseFloat(dist)
  return isNaN(n) ? null : n
}

/**
 * Resolve an arbitrary stored race.distance value to a sport-specific
 * preset. Tries (in order):
 *   1. exact value match  ("42.2" → "42.2")
 *   2. label match        ("Marathon" → "42.2", case-insensitive)
 *   3. km equivalence     ("Marathon" → 42.2 → preset whose value parses to 42.2)
 * Returns null if nothing matches — caller should treat as "Custom..." and
 * keep the raw string as the custom-distance text. Without this layered
 * resolution, races stored with label-style distances (legacy data, race
 * imports, AI parses) silently flip to Custom in the edit modal and leak
 * "Marathon" / "Half Marathon" into the numeric custom-km text field.
 */
export function findSportDistMatch(
  raw: string,
  presets: { label: string; value: string }[],
): string | null {
  if (!raw) return null
  const lc = raw.trim().toLowerCase()
  // Exact value match (current canonical form)
  const direct = presets.find(p => p.value === raw)
  if (direct) return direct.value
  // Label match (covers "Marathon", "Half Marathon", etc.)
  const labelMatch = presets.find(p => p.label.toLowerCase() === lc)
  if (labelMatch) return labelMatch.value
  // Km equivalence — collapses any numeric-equivalent label
  // ("Marathon"/"42.195"/"42.2" all map to 42.2 → preset value "42.2")
  const km = resolveDistKm(raw)
  if (km != null) {
    const numMatch = presets.find(p => {
      const v = parseFloat(p.value)
      return !isNaN(v) && Math.abs(v - km) < 0.05
    })
    if (numMatch) return numMatch.value
  }
  return null
}

// ── Catalog dedup check ───────────────────────────────────────────────────────

interface CatalogRow { name: string; city?: string; year?: number }
interface RaceRow    { name: string; city?: string; date: string }

/** True if this race is already well-represented in the catalog (Dice > 0.8 on name + matching year + city). */
export function isAlreadyInCatalog(race: RaceRow, catalog: CatalogRow[]): boolean {
  // Split date string to avoid new Date() UTC midnight parse bug in UTC- timezones
  const raceYear = Number(race.date.split('-')[0])
  const raceNorm = normalizeName(race.name)
  return catalog.some(c =>
    c.year === raceYear &&
    (c.city ?? '').toLowerCase() === (race.city ?? '').toLowerCase() &&
    similarity(normalizeName(c.name), raceNorm) > 0.8
  )
}

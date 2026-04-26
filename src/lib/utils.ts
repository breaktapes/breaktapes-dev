const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

/**
 * Convert any date string the app stores ("YYYY-MM-DD") into the canonical
 * display format "DD Mon YYYY" (e.g. "26 Apr 2026"). Pass-through for empty
 * or unparseable input.
 *
 * Use this anywhere the user sees a date as plain text. Date inputs and
 * internal comparisons MUST stay in YYYY-MM-DD.
 */
export function fmtDateDDMM(d: string | undefined | null): string {
  if (!d) return ''
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return String(d)
  const mon = MONTHS[parseInt(m[2], 10) - 1] ?? m[2]
  return `${m[3]} ${mon} ${m[1]}`
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
export function distLabel(d: string | undefined): string {
  if (!d) return ''
  const lower = d.toLowerCase().trim()
  if (lower === 'marathon' || lower === 'full marathon') return 'Marathon'
  if (lower === 'half marathon' || lower === 'half') return 'Half Marathon'
  if (lower === 'ironman' || lower === 'full ironman' || lower === 'full distance') return 'IRONMAN'
  if (lower === '70.3' || lower === 'half ironman' || lower === 'ironman 70.3' || lower === 'middle distance') return '70.3'
  if (lower === 'olympic' || lower === 'olympic triathlon') return 'Olympic'
  if (lower === 'sprint' || lower === 'sprint triathlon') return 'Sprint'
  if (lower === '5k' || lower === '5km') return '5K'
  if (lower === '10k' || lower === '10km') return '10K'
  if (lower === '10 mile' || lower === '10 miles' || lower === '10mi') return '10 Mile'
  if (lower === 'ultra' || lower === 'ultramarathon') return 'Ultra'
  if (lower === 'hyrox') return 'HYROX'
  const n = parseFloat(d)
  if (isNaN(n)) return d
  if (n >= 225.9 && n <= 226.1) return 'IRONMAN'
  if (n >= 112.9 && n <= 113.1) return '70.3'
  if (n >= 51.4 && n <= 51.6) return 'Olympic'
  if (n >= 25.7 && n <= 25.8) return 'Sprint'
  if (n >= 42.0 && n <= 42.3) return 'Marathon'
  if (n >= 21.0 && n <= 21.2) return 'Half Marathon'
  if (n >= 16.0 && n <= 16.2) return '10 Mile'
  if (n >= 10 && n <= 10.1) return '10K'
  if (n >= 5 && n <= 5.1) return '5K'
  if (n > 42.3) return 'Ultra'
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

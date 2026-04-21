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

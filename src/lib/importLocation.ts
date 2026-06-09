/**
 * Shared race-import location helpers.
 *
 * `lookupCatalogLocation` finds a race row in the global catalog by normalized
 * name (case-insensitive, year suffix stripped) + year. `extractCityFromName`
 * is the name-extraction fallback used when no catalog row matches.
 *
 * Used by RaceImportModal (autofill on import) and useCityBackfill (one-shot
 * retroactive backfill of races logged before PR #505).
 */
import type { CatalogRace } from '@/hooks/useRaceCatalog'

/** Lowercased, year-stripped, whitespace-collapsed for catalog matching. */
export function normalizeRaceName(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/\b(20\d{2})\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Catalog lookup by normalized name + year. Falls back to any-year match when
 * the exact-year row is missing. Returns null when no row matches at all.
 */
export function lookupCatalogLocation(
  name: string,
  year: number | undefined,
  catalog: CatalogRace[],
): { city: string; country: string } | null {
  if (!name || !catalog.length) return null
  const target = normalizeRaceName(name)
  let match = year != null
    ? catalog.find(c => c.year === year && normalizeRaceName(c.name) === target)
    : undefined
  if (!match) match = catalog.find(c => normalizeRaceName(c.name) === target)
  if (!match) return null
  return { city: match.city || '', country: match.country || '' }
}

/**
 * Name-extraction fallback. Strips year, distance words, and known sponsor
 * prefixes; whatever remains becomes the city when it's at least 2 chars and
 * contains a 3-letter alpha run. Heuristic — empty when the input is a pure
 * sponsor+distance name (e.g. "Skechers Performance Run Race 7").
 */
export function extractCityFromName(name: string): string {
  const cleaned = (name ?? '')
    .replace(/\b(20\d{2})\b/g, ' ')
    .replace(/\b(half\s+marathon|full\s+marathon|marathon|ultra(?:\s+marathon)?|10\s*mile|10\s*k|5\s*k|ironman|iron\s+man|70\.3|middle\s+distance|sprint|olympic|triathlon|tri|hyrox)\b/gi, ' ')
    .replace(/\b(adnoc|tata|au|hsbc|nn|asics|virgin|tcs|skechers|garmin|standard\s+chartered)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.length >= 2 && /[A-Za-z]{3,}/.test(cleaned) ? cleaned : ''
}

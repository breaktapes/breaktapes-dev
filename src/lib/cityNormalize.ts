/**
 * Canonicalize a city string before storing it on a Race.
 *
 * Open-Meteo (and other geocoders) sometimes return the administrative
 * label rather than the city name itself — e.g. picking "Dubai" can
 * yield "Dubai Emirate", picking "Bangkok" can yield "Bangkok Province".
 * Older imports (UltraSignup / MarathonView / manual entry pre-CityPicker)
 * also let users type these admin-tagged names directly.
 *
 * The result: the same physical city ends up under two different strings
 * in the user's race list, splitting the CITIES pill count, breaking
 * geocoding (the admin name often has no coords), and de-duping logic.
 *
 * `normalizeCityName` returns the canonical city name. Pure / sync.
 */

const ALIAS: Record<string, string> = {
  // United Arab Emirates emirates → city
  'dubai emirate': 'Dubai',
  'abu dhabi emirate': 'Abu Dhabi',
  'sharjah emirate': 'Sharjah',
  'ajman emirate': 'Ajman',
  'fujairah emirate': 'Fujairah',
  'umm al quwain emirate': 'Umm Al Quwain',
  'umm al-quwain emirate': 'Umm Al Quwain',
  'ras al khaimah emirate': 'Ras Al Khaimah',
  'ras al-khaimah emirate': 'Ras Al Khaimah',
  // Common admin-tagged labels worldwide
  'mumbai suburban': 'Mumbai',
  'mumbai city': 'Mumbai',
  'new delhi': 'Delhi',
  'tokyo prefecture': 'Tokyo',
  'tokyo metropolis': 'Tokyo',
  'beijing municipality': 'Beijing',
  'shanghai municipality': 'Shanghai',
  'bangkok metropolis': 'Bangkok',
  'seoul special city': 'Seoul',
  'singapore city': 'Singapore',
  'kuala lumpur federal territory': 'Kuala Lumpur',
  'jakarta special capital region': 'Jakarta',
  'metro manila': 'Manila',
  'mexico city federal district': 'Mexico City',
  'distrito federal': 'Mexico City',
  'washington d.c.': 'Washington',
  'washington, d.c.': 'Washington',
}

const SUFFIX_RE = /\s+(emirate|emirates|city of|metropolitan area|metropolitan|metropolis|prefecture|municipality|special city|federal district|federal territory|special capital region|county|district|province|governorate)$/i

const PREFIX_RE = /^(city of|greater)\s+/i

export function normalizeCityName(city: string | undefined | null): string {
  if (!city) return ''
  const trimmed = String(city).trim().replace(/\s+/g, ' ')
  if (!trimmed) return ''
  const lower = trimmed.toLowerCase()
  if (ALIAS[lower]) return ALIAS[lower]
  // Strip canonical-form admin suffixes
  const noSuffix = trimmed.replace(SUFFIX_RE, '').trim()
  if (noSuffix && noSuffix.toLowerCase() !== lower) return noSuffix
  // Strip "City of" / "Greater" prefixes
  const noPrefix = trimmed.replace(PREFIX_RE, '').trim()
  if (noPrefix && noPrefix.toLowerCase() !== lower) return noPrefix
  return trimmed
}

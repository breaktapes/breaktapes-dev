/**
 * Lightweight geocoder — Open-Meteo public API, no key required.
 * Results are cached in localStorage under `bt_geocode_cache` so the same
 * city is never looked up twice across sessions.
 */

export type CitySuggestion = {
  name: string          // city name, e.g. "Leh"
  country: string       // full name, e.g. "India"
  countryCode?: string  // ISO-2, e.g. "IN"
  admin1?: string       // state / region, e.g. "Ladakh"
  admin2?: string       // district, e.g. "Leh"
  lat: number
  lng: number
  population?: number
}

type GeocodeResult = { lat: number; lng: number } | null

const CACHE_KEY = 'bt_geocode_cache'

type Cache = Record<string, GeocodeResult>

function readCache(): Cache {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeCache(cache: Cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Quota exceeded or private-mode — silently drop
  }
}

function key(city: string, country?: string) {
  return `${city.trim().toLowerCase()}|${(country || '').trim().toLowerCase()}`
}

/**
 * Typeahead city search — returns up to `limit` matches ordered by population
 * descending (Open-Meteo's default). Useful for letting users disambiguate
 * e.g. "Leh, Ladakh, India" vs any other match.
 *
 * Results are NOT cached per-query (queries change with every keystroke) but
 * the top result for each final selected city gets warmed into the
 * `bt_geocode_cache` used by `geocodeCity` as a side-effect of rendering.
 */
export async function searchCities(query: string, limit = 8): Promise<CitySuggestion[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=${limit}&language=en&format=json`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    const results = Array.isArray(data?.results) ? data.results : []
    return results.map((r: any): CitySuggestion => ({
      name: String(r.name ?? ''),
      country: String(r.country ?? ''),
      countryCode: r.country_code ? String(r.country_code) : undefined,
      admin1: r.admin1 ? String(r.admin1) : undefined,
      admin2: r.admin2 ? String(r.admin2) : undefined,
      lat: Number(r.latitude),
      lng: Number(r.longitude),
      population: r.population ? Number(r.population) : undefined,
    }))
  } catch {
    return []
  }
}

export async function geocodeCity(city: string, country?: string): Promise<GeocodeResult> {
  if (!city?.trim()) return null
  const cache = readCache()
  const k = key(city, country)
  if (k in cache) return cache[k]

  try {
    const q = country ? `${city}, ${country}` : city
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const loc = data?.results?.[0]
    const result: GeocodeResult = loc
      ? { lat: Number(loc.latitude), lng: Number(loc.longitude) }
      : null
    cache[k] = result
    writeCache(cache)
    return result
  } catch {
    return null
  }
}

/**
 * Lightweight geocoder — Open-Meteo public API, no key required.
 * Results are cached in localStorage under `bt_geocode_cache` so the same
 * city is never looked up twice across sessions.
 */

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

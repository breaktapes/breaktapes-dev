/**
 * useCityBackfill — one-shot retroactive backfill of missing city/country on
 * existing races (logged before PR #505 import autofill). Runs once per device
 * after the catalog loads. Three-stage fill:
 *
 *   1. race_catalog lookup by normalized name + year
 *   2. extractCityFromName heuristic (strip year/distance/sponsor words)
 *   3. sporthive name-search → match by normalized name + date → use event city
 *      (only when athlete.firstName + lastName are set; one HTTP call total)
 *
 * Sync happens via the normal `updateRace` path — no schema changes, no RPCs.
 * Guarded by a versioned localStorage flag (`bt_city_backfill_v2`) so it fires
 * once per device. Bump the flag when adding new strategies to re-run.
 */
import { useEffect, useRef } from 'react'
import { useRaceCatalog } from '@/hooks/useRaceCatalog'
import { useRaceStore } from '@/stores/useRaceStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { lookupCatalogLocation, extractCityFromName, normalizeRaceName } from '@/lib/importLocation'
import { posthog } from '@/lib/posthog'

const FLAG_KEY = 'bt_city_backfill_v2'
const HEALTH_PROXY = 'https://health.breaktapes.com'

interface SportHiveResult {
  raceName?: string
  date?: string
  city?: string
  country?: string
}

export function useCityBackfill(enabled: boolean) {
  const { data: catalog = [], isLoading } = useRaceCatalog()
  const races         = useRaceStore(s => s.races)
  const upcomingRaces = useRaceStore(s => s.upcomingRaces)
  const updateRace    = useRaceStore(s => s.updateRace)
  const athlete       = useAthleteStore(s => s.athlete)
  const ran           = useRef(false)

  useEffect(() => {
    if (!enabled) return
    if (ran.current) return
    if (isLoading) return
    if (!catalog.length) return
    try {
      if (localStorage.getItem(FLAG_KEY) === '1') { ran.current = true; return }
    } catch { return }

    ran.current = true

    const all = [...races, ...upcomingRaces]
    if (!all.length) {
      try { localStorage.setItem(FLAG_KEY, '1') } catch {}
      return
    }

    // Track first-pass results so we can do the sporthive fetch only for what
    // remains blank, then patch in one shot.
    type Pending = {
      id: string
      origCity: string
      origCountry: string
      city: string
      country: string
    }
    const pending: Pending[] = []
    let fromCatalog = 0
    let fromHeuristic = 0

    for (const r of all) {
      const origCity    = (r.city    ?? '').trim()
      const origCountry = (r.country ?? '').trim()
      if (origCity && origCountry) continue

      let nextCity    = origCity
      let nextCountry = origCountry
      let usedCatalog = false

      const year = r.date ? Number(r.date.slice(0, 4)) || undefined : undefined
      const cat  = lookupCatalogLocation(r.name ?? '', year, catalog)
      if (cat) {
        if (!nextCity    && cat.city)    { nextCity    = cat.city;    usedCatalog = true }
        if (!nextCountry && cat.country) { nextCountry = cat.country; usedCatalog = true }
      }
      if (!nextCity) {
        const heur = extractCityFromName(r.name ?? '')
        if (heur) { nextCity = heur; fromHeuristic++ }
      }
      if (usedCatalog) fromCatalog++

      pending.push({ id: r.id, origCity, origCountry, city: nextCity, country: nextCountry })
    }

    // Stage 3 — sporthive fallback for whatever's still missing a city.
    // Single call (search by full name), match by normalized name + date,
    // override only when there's a clean date+name hit so we don't mis-match
    // generic names like "10K" / "Sprint Tri".
    async function sporthiveBackfill(): Promise<number> {
      const stillMissing = pending.filter(p => !p.city || !p.country)
      const first = (athlete?.firstName ?? '').trim()
      const last  = (athlete?.lastName  ?? '').trim()
      if (!stillMissing.length || (!first && !last)) return 0
      const name = `${first} ${last}`.trim()
      try {
        const res = await fetch(`${HEALTH_PROXY}/import/sporthive`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
          signal: AbortSignal.timeout(15000),
        })
        if (!res.ok) return 0
        const payload = await res.json() as { results?: SportHiveResult[] }
        const results = Array.isArray(payload.results) ? payload.results : []
        if (!results.length) return 0
        // Build index keyed by name+date so the same finisher across multiple
        // races still matches the correct one.
        const idx = new Map<string, SportHiveResult>()
        for (const sr of results) {
          const k = `${normalizeRaceName(sr.raceName ?? '')}|${(sr.date ?? '').slice(0, 10)}`
          if (!idx.has(k)) idx.set(k, sr)
        }
        let n = 0
        for (const p of pending) {
          const r = all.find(x => x.id === p.id)
          if (!r) continue
          const k = `${normalizeRaceName(r.name ?? '')}|${(r.date ?? '').slice(0, 10)}`
          const hit = idx.get(k)
          if (!hit) continue
          if (!p.city    && hit.city)    { p.city    = hit.city;    n++ }
          if (!p.country && hit.country) { p.country = hit.country }
        }
        return n
      } catch {
        return 0
      }
    }

    // Apply all patches (catalog + heuristic + sporthive) in one async pass.
    void (async () => {
      const fromSporthive = await sporthiveBackfill()

      for (const p of pending) {
        const cityChanged    = p.city    !== p.origCity
        const countryChanged = p.country !== p.origCountry
        if (!cityChanged && !countryChanged) continue
        updateRace(p.id, {
          ...(cityChanged    ? { city:    p.city    } : {}),
          ...(countryChanged ? { country: p.country } : {}),
        })
      }

      if (fromCatalog + fromHeuristic + fromSporthive > 0) {
        posthog.capture('city backfill completed', {
          from_catalog:    fromCatalog,
          from_heuristic:  fromHeuristic,
          from_sporthive:  fromSporthive,
          total_races:     all.length,
        })
      }
      try { localStorage.setItem(FLAG_KEY, '1') } catch {}
    })()
  }, [enabled, isLoading, catalog, races, upcomingRaces, updateRace, athlete])
}

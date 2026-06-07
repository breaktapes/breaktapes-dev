/**
 * useCityBackfill — one-shot retroactive backfill of missing city/country on
 * existing races (logged before PR #505 import autofill). Runs once per device
 * after the catalog loads. Loops `races + upcomingRaces`, calls `updateRace`
 * silently for every race with an empty city. Sync to Supabase happens via the
 * normal store path.
 *
 * Guarded with a localStorage flag (`bt_city_backfill_v1 = '1'`) so it only
 * fires once per device. Re-running it would be a no-op anyway — empty
 * cities only ever get filled, never cleared — but we want zero overhead on
 * boot after the first pass.
 */
import { useEffect, useRef } from 'react'
import { useRaceCatalog } from '@/hooks/useRaceCatalog'
import { useRaceStore } from '@/stores/useRaceStore'
import { lookupCatalogLocation, extractCityFromName } from '@/lib/importLocation'
import { posthog } from '@/lib/posthog'

const FLAG_KEY = 'bt_city_backfill_v1'

export function useCityBackfill(enabled: boolean) {
  const { data: catalog = [], isLoading } = useRaceCatalog()
  const races         = useRaceStore(s => s.races)
  const upcomingRaces = useRaceStore(s => s.upcomingRaces)
  const updateRace    = useRaceStore(s => s.updateRace)
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

    let fromCatalog = 0
    let fromHeuristic = 0
    for (const r of all) {
      const cityMissing    = !(r.city ?? '').trim()
      const countryMissing = !(r.country ?? '').trim()
      if (!cityMissing && !countryMissing) continue

      let nextCity    = r.city ?? ''
      let nextCountry = r.country ?? ''
      let usedCatalog = false

      if (cityMissing || countryMissing) {
        const year = r.date ? Number(r.date.slice(0, 4)) || undefined : undefined
        const cat  = lookupCatalogLocation(r.name ?? '', year, catalog)
        if (cat) {
          if (cityMissing    && cat.city)    { nextCity    = cat.city;    usedCatalog = true }
          if (countryMissing && cat.country) { nextCountry = cat.country; usedCatalog = true }
        }
      }
      if (!nextCity) {
        const heur = extractCityFromName(r.name ?? '')
        if (heur) { nextCity = heur; fromHeuristic++ }
      }
      if (usedCatalog) fromCatalog++

      // Only patch if something actually changed — avoids triggering an
      // unnecessary syncStateToSupabase on every race in the array.
      if (nextCity !== (r.city ?? '') || nextCountry !== (r.country ?? '')) {
        updateRace(r.id, {
          ...(nextCity    !== (r.city    ?? '') ? { city:    nextCity    } : {}),
          ...(nextCountry !== (r.country ?? '') ? { country: nextCountry } : {}),
        })
      }
    }

    if (fromCatalog + fromHeuristic > 0) {
      posthog.capture('city backfill completed', {
        from_catalog:   fromCatalog,
        from_heuristic: fromHeuristic,
        total_races:    all.length,
      })
    }
    try { localStorage.setItem(FLAG_KEY, '1') } catch {}
  }, [enabled, isLoading, catalog, races, upcomingRaces, updateRace])
}

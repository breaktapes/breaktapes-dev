import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface CatalogRace {
  id: number
  name: string
  aliases: string[]
  city: string
  country: string
  year?: number
  month?: number
  day?: number
  dist_km?: number      // actual DB column name
  dist?: string         // text label e.g. "Marathon", "Half Marathon", "10KM"
  type?: string         // actual DB column name (run/tri/cycle/swim/hyrox)
  discipline?: string
  surface?: string
  elevation_profile?: string
  course_summary?: string
  priority?: string        // 'A' | 'B' | 'C'
}

const COLS = 'id, name, aliases, city, country, year, month, day, dist_km, dist, type, discipline, surface, elevation_profile, course_summary'
// Supabase PostgREST max-rows is 1,000 per request regardless of range size.
// Fetch 10 pages of 1,000 in parallel to cover the full ~8,284-row catalog.
const PAGE = 1000
const TOTAL_PAGES = 10

/**
 * Loads the global race catalog (~8,284 rows) from Supabase.
 * Supabase REST hard-limits each request to 1,000 rows.
 * Fetches 10 pages of 1,000 in parallel so no race is missed.
 * staleTime: 1hr — catalog changes infrequently.
 */
export function useRaceCatalog() {
  return useQuery({
    queryKey: ['race-catalog'],
    queryFn: async () => {
      const pages = await Promise.all(
        Array.from({ length: TOTAL_PAGES }, (_, i) =>
          supabase
            .from('race_catalog')
            .select(COLS)
            .order('name')
            .range(i * PAGE, (i + 1) * PAGE - 1)
        )
      )
      for (const p of pages) {
        if (p.error) throw p.error
      }
      return pages
        .flatMap(p => p.data ?? [])
        .map(r => ({
          ...r,
          dist_km: r.dist_km != null ? Number(r.dist_km) : undefined,
        })) as CatalogRace[]
    },
    staleTime: 60 * 60 * 1000,
    retry: 1,
  })
}

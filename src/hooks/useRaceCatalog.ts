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
}

const COLS = 'id, name, aliases, city, country, year, month, day, dist_km, dist, type, discipline, surface, elevation_profile, course_summary'
const PAGE = 5000

/**
 * Loads the global race catalog (~8,284 rows) from Supabase.
 * Supabase REST default limit is 1,000 rows — we must paginate to get all rows.
 * Fetches in parallel pages of 5,000 rows each.
 * staleTime: 1hr — catalog changes infrequently, refetching on every nav costs ~200ms.
 */
export function useRaceCatalog() {
  return useQuery({
    queryKey: ['race-catalog'],
    queryFn: async () => {
      // Fetch two pages in parallel to cover 10,000 rows (catalog is ~8,284)
      const [p1, p2] = await Promise.all([
        supabase.from('race_catalog').select(COLS).order('name').range(0, PAGE - 1),
        supabase.from('race_catalog').select(COLS).order('name').range(PAGE, PAGE * 2 - 1),
      ])
      if (p1.error) throw p1.error
      if (p2.error) throw p2.error
      return [...(p1.data ?? []), ...(p2.data ?? [])] as CatalogRace[]
    },
    staleTime: 60 * 60 * 1000,
    retry: 1,
  })
}

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface CatalogRace {
  id: number
  name: string
  city: string
  country: string
  month?: number
  day?: number
  distance?: string
  sport?: string
  priority?: 'A' | 'B' | 'C'
}

/**
 * Loads the global race catalog (~8,284 rows) from Supabase.
 * staleTime: 1hr — catalog changes infrequently, refetching on every nav costs ~200ms.
 * Replaces loadRaceCatalog() from index.html.
 */
export function useRaceCatalog() {
  return useQuery({
    queryKey: ['race-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('race_catalog')
        .select('id, name, city, country, month, day, distance, sport, priority')
        .order('name')

      if (error) throw error
      return (data ?? []) as CatalogRace[]
    },
    staleTime: 60 * 60 * 1000,  // 1hr — 8,284 rows, avoid refetch on every tab switch
    retry: 1,
  })
}

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/useAuthStore'
import { useRaceStore } from '@/stores/useRaceStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
import type { Race, Athlete, SeasonPlan } from '@/types'

interface RemoteState {
  races?: Race[]
  upcoming_races?: Race[]
  athlete?: Athlete
  season_plans?: SeasonPlan[]
  next_race?: Race | null
}

/**
 * Fetches and applies remote state from Supabase user_state table.
 * staleTime: 0 — always refetch on mount, user's remote state must be fresh.
 * Replaces syncRemoteState() + applyRemoteState() from index.html.
 */
export function useSyncState() {
  const authUser = useAuthStore(s => s.authUser)
  const setRaces = useRaceStore(s => s.setRaces)
  const setUpcomingRaces = useRaceStore(s => s.setUpcomingRaces)
  const promoteNextRace = useRaceStore(s => s.promoteNextRace)
  const setAthlete = useAthleteStore(s => s.setAthlete)
  const setSeasonPlans = useAthleteStore(s => s.setSeasonPlans)

  return useQuery({
    queryKey: ['sync-state', authUser?.id],
    queryFn: async () => {
      if (!authUser) return null

      const { data, error } = await supabase
        .from('user_state')
        .select('state_json')
        .eq('user_id', authUser.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error  // PGRST116 = no rows
      if (!data) return null

      const remote: RemoteState = data.state_json ?? {}

      // Apply remote state to stores (mirrors applyRemoteState() from index.html)
      if (Array.isArray(remote.races)) setRaces(remote.races)
      if (Array.isArray(remote.upcoming_races)) {
        setUpcomingRaces(remote.upcoming_races)
      }
      // Regression fix (Session 13): if nextRace is null/past, auto-promote
      promoteNextRace()

      if (remote.athlete) setAthlete(remote.athlete)
      if (Array.isArray(remote.season_plans)) setSeasonPlans(remote.season_plans)

      return remote
    },
    enabled: !!authUser,
    staleTime: 0,  // always refetch on mount — remote state must be fresh
    retry: 1,
  })
}

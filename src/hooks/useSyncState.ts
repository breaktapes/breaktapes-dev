import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/useAuthStore'
import { useRaceStore } from '@/stores/useRaceStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
import type { Race, Athlete, SeasonPlan } from '@/types'

interface RemoteState {
  races?: Race[]
  upcoming_races?: Race[]
  wishlist_races?: Race[]
  athlete?: Athlete
  season_plans?: SeasonPlan[]
  next_race?: Race | null
}

/**
 * Fetches and applies remote state from Supabase user_state table.
 * staleTime: 0 — always refetch on mount, user's remote state must be fresh.
 * Replaces syncRemoteState() + applyRemoteState() from index.html.
 *
 * Pairs with `useUserStateRealtime` below so concurrent edits on a second
 * device push down to this device within a few hundred ms — eliminates
 * the last-write-wins window where one device would clobber the other.
 */
export function useSyncState() {
  const authUser = useAuthStore(s => s.authUser)
  const setRaces = useRaceStore(s => s.setRaces)
  const setUpcomingRaces = useRaceStore(s => s.setUpcomingRaces)
  const setWishlistRaces = useRaceStore(s => s.setWishlistRaces)
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

      // Apply remote state to stores. setX setters intentionally do NOT
      // call syncStateToSupabase, so applying remote state never echoes
      // back to the server.
      if (Array.isArray(remote.races)) setRaces(remote.races)
      if (Array.isArray(remote.upcoming_races)) setUpcomingRaces(remote.upcoming_races)
      if (Array.isArray(remote.wishlist_races)) setWishlistRaces(remote.wishlist_races)
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

/**
 * Subscribes to row-level changes on the current user's `user_state` row.
 * On any INSERT / UPDATE / DELETE event from another tab or device, we
 * invalidate the sync-state query so `useSyncState` re-pulls and re-
 * applies the canonical server state to local stores.
 *
 * Requires `user_state` to be added to the `supabase_realtime`
 * publication (see migration `20260425120000_user_state_realtime.sql`).
 *
 * Self-echo handling: a write triggered by this device also fires here.
 * Re-pulling the same data is idempotent — Zustand setters are noop on
 * unchanged content references? They aren't (always set), so there's a
 * small re-render. Acceptable for the cross-device freshness it buys.
 */
export function useUserStateRealtime() {
  const authUser = useAuthStore(s => s.authUser)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!authUser) return
    const channel = supabase
      .channel(`user_state:${authUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_state',
          filter: `user_id=eq.${authUser.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['sync-state', authUser.id] })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [authUser, queryClient])
}

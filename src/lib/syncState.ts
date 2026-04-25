/**
 * Single entry point for writing the user's full app state to Supabase.
 *
 * Snapshots BOTH the race store and the athlete store in one go, then
 * does a read-merge-write upsert against `user_state`. Earlier inline
 * versions of this helper lived in useRaceStore and only synced races +
 * upcoming + nextRace, so wishlistRaces / seasonPlans were localStorage-
 * only and disappeared between devices. Centralising here means every
 * mutation action — race, wishlist, or season plan — pushes the same
 * complete payload, and there is one place to add a new persisted slice.
 */
import { supabase, hasClerkToken } from '@/lib/supabase'
import { useAuthStore } from '@/stores/useAuthStore'
import { useRaceStore } from '@/stores/useRaceStore'
import { useAthleteStore } from '@/stores/useAthleteStore'

export async function syncStateToSupabase() {
  const authUser = useAuthStore.getState().authUser
  if (!authUser) return
  // RLS would silently reject an unauthenticated upsert — better to skip
  // and let the next mutation re-fire once the JWT is installed.
  if (!hasClerkToken()) return

  const { races, upcomingRaces, wishlistRaces, nextRace } = useRaceStore.getState()
  const { athlete, seasonPlans } = useAthleteStore.getState()

  try {
    const { data: existing } = await supabase
      .from('user_state')
      .select('state_json')
      .eq('user_id', authUser.id)
      .single()

    const current = (existing?.state_json as Record<string, unknown>) ?? {}

    await supabase.from('user_state').upsert(
      {
        user_id: authUser.id,
        state_json: {
          ...current,
          races,
          upcoming_races: upcomingRaces,
          wishlist_races: wishlistRaces,
          next_race: nextRace,
          season_plans: seasonPlans,
          athlete,
        },
      },
      { onConflict: 'user_id' },
    )
  } catch {
    // fire-and-forget — UI never blocks on sync. Realtime + next-mutation
    // retry will reconcile on the eventual successful round trip.
  }
}

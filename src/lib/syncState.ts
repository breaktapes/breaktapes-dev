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
 *
 * Always writes `username` + `is_public` columns alongside `state_json`
 * so the public-profile Worker can find and gate rows correctly. Without
 * those two columns set, the worker's `WHERE username=? AND is_public=true`
 * query never matches and the SSR profile 404s.
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

  const { races, upcomingRaces, wishlistRaces, nextRace, focusRaceId } = useRaceStore.getState()
  const { athlete, seasonPlans } = useAthleteStore.getState()

  try {
    // .maybeSingle() returns null + no error when zero rows match — vs
    // .single() which historically returned a PGRST116 error. Keeps the
    // read-merge-write path robust on first sync.
    const { data: existing, error: readErr } = await supabase
      .from('user_state')
      .select('state_json')
      .eq('user_id', authUser.id)
      .maybeSingle()

    if (readErr) {
      // Surface read failures so they don't silently mask write failures
      // on the second device. Write still attempts below.
      console.warn('[syncState] read existing failed', readErr)
    }

    const current = (existing?.state_json as Record<string, unknown> | null) ?? {}

    const { error: writeErr } = await supabase.from('user_state').upsert(
      {
        user_id: authUser.id,
        // Mirror username + is_public as columns so the public-profile
        // Worker (anon SELECT) can filter without parsing JSON. Default
        // is_public to false until the user explicitly toggles it; never
        // accidentally publish private data.
        username: athlete?.username ?? null,
        is_public: athlete?.isPublic ?? false,
        state_json: {
          ...current,
          races,
          upcoming_races: upcomingRaces,
          wishlist_races: wishlistRaces,
          next_race: nextRace,
          focus_race_id: focusRaceId,
          season_plans: seasonPlans,
          athlete,
        },
      },
      { onConflict: 'user_id' },
    )

    if (writeErr) {
      console.warn('[syncState] upsert failed', writeErr)
    }
  } catch (e) {
    // fire-and-forget — UI never blocks on sync. Realtime + next-mutation
    // retry will reconcile on the eventual successful round trip.
    console.warn('[syncState] unexpected error', e)
  }
}

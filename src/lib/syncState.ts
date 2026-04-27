/**
 * Single entry point for writing the user's full app state to Supabase.
 *
 * Uses the /api/sync Worker endpoint (service role key, bypasses RLS) instead
 * of writing through the Supabase client directly. This removes the dependency
 * on the Clerk-Supabase JWT template being configured — the Worker decodes the
 * Clerk session token to identify the user, then writes with the service role.
 *
 * Fallback: if the Worker endpoint fails (e.g. SUPABASE_SERVICE_ROLE_KEY not
 * set), falls back to the old direct Supabase client path so dev environments
 * still work without the secret configured.
 */
import { supabase, getClerkToken } from '@/lib/supabase'
import { useAuthStore } from '@/stores/useAuthStore'
import { useRaceStore } from '@/stores/useRaceStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { APP_URL } from '@/env'

export async function syncStateToSupabase() {
  const authUser = useAuthStore.getState().authUser
  if (!authUser) return

  const token = getClerkToken()

  const { races, upcomingRaces, wishlistRaces, nextRace, focusRaceId } = useRaceStore.getState()
  const { athlete, seasonPlans } = useAthleteStore.getState()

  const stateJson = {
    races,
    upcoming_races: upcomingRaces,
    wishlist_races: wishlistRaces,
    next_race: nextRace,
    focus_race_id: focusRaceId,
    season_plans: seasonPlans,
    athlete,
  }

  // Primary path: POST to /api/sync on the Cloudflare Worker.
  // The Worker writes with the service role key, bypassing RLS entirely.
  // This works regardless of whether the Clerk-Supabase JWT template is set up.
  if (token) {
    try {
      const syncUrl = `${APP_URL}/api/sync`
      const res = await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username:   athlete?.username   ?? null,
          is_public:  athlete?.isPublic   ?? false,
          state_json: stateJson,
        }),
      })
      if (res.ok) return  // success — done
      console.warn('[syncState] Worker sync failed', res.status, await res.text().catch(() => ''))
    } catch (e) {
      console.warn('[syncState] Worker sync error', e)
    }
  }

  // Fallback: direct Supabase client (works in dev / when service role key absent).
  // This path is subject to the Clerk-Supabase JWT template requirement but
  // keeps local dev functional without needing the Worker secret.
  try {
    const { error: writeErr } = await supabase.from('user_state').upsert(
      {
        user_id:    authUser.id,
        username:   athlete?.username   ?? null,
        is_public:  athlete?.isPublic   ?? false,
        state_json: stateJson,
      },
      { onConflict: 'user_id' },
    )
    if (writeErr) console.warn('[syncState] fallback upsert failed', writeErr)
  } catch (e) {
    console.warn('[syncState] fallback unexpected error', e)
  }
}

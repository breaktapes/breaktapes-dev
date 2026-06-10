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

// ── Write gate: never write to the server before the initial remote pull has
// been applied to local state. ──────────────────────────────────────────────
//
// Root cause of a cross-device data-loss bug: on a fresh device / cleared
// cache / new browser / incognito, the local Zustand stores start empty. Two
// mount-time paths fire syncStateToSupabase() before the remote pull
// (useSyncState) hydrates local — the bootstrap backfill in AuthGate, and the
// Clerk username/photo sync (updateAthlete → sync). Because the write is a
// FULL state_json replace, an empty local state overwrites the user's entire
// server row (races, profile, public flag) before they ever see their data.
//
// This gate blocks every write until markRemotePullComplete() is called by
// useSyncState once the pull has settled. Writes attempted before then are
// coalesced into a single pending flush that runs right after the pull applies
// — so the flushed write carries the real (merged) data, not empty state.
let _pullComplete = false
let _pendingSync = false
let _debounceTimer: ReturnType<typeof setTimeout> | null = null
const SYNC_DEBOUNCE_MS = 600

/** Called by useSyncState once the initial remote pull has been applied. */
export function markRemotePullComplete() {
  if (_pullComplete) return
  _pullComplete = true
  if (_pendingSync) {
    _pendingSync = false
    void syncStateToSupabase()
  }
}

/** Read-only gate check — lets feature code (e.g. the onboarding tour) defer
 *  decisions that depend on remote state having landed. */
export function isRemotePullComplete(): boolean {
  return _pullComplete
}

/** Re-arm the gate on sign-out so the next user re-gates before their pull. */
export function resetRemotePullGate() {
  _pullComplete = false
  _pendingSync = false
  if (_debounceTimer) { clearTimeout(_debounceTimer); _debounceTimer = null }
}

export function syncStateToSupabase(): void {
  const { authUser } = useAuthStore.getState()
  if (!authUser) return

  // Block writes until the first remote pull has hydrated local state.
  // Coalesce any attempts into a single deferred flush (see markRemotePullComplete).
  if (!_pullComplete) {
    _pendingSync = true
    return
  }

  // Debounce: coalesce rapid successive mutations into a single write.
  // Prevents concurrent server writes from multiple fast user actions (e.g.
  // editing priority, then goal time, then notes in quick succession).
  if (_debounceTimer) clearTimeout(_debounceTimer)
  _debounceTimer = setTimeout(() => {
    _debounceTimer = null
    void _doSync()
  }, SYNC_DEBOUNCE_MS)
}

async function _doSync() {
  const { authUser, setSyncStatus } = useAuthStore.getState()
  if (!authUser) return

  setSyncStatus('syncing')
  const token = getClerkToken()

  const { races, upcomingRaces, wishlistRaces, nextRace, focusRaceId, deletedRaceIds } = useRaceStore.getState()
  const { athlete, seasonPlans, goals, injuries } = useAthleteStore.getState()

  const stateJson = {
    races,
    upcoming_races: upcomingRaces,
    wishlist_races: wishlistRaces,
    next_race: nextRace,
    focus_race_id: focusRaceId,
    deleted_race_ids: deletedRaceIds,
    season_plans: seasonPlans,
    goals,
    athlete,
    injuries,
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
          // Retention: email (from Clerk via authUser) + opt-in feed the
          // reminder/digest cron. Default opt-in ON; user controls it in Settings.
          email:        authUser.email ?? null,
          email_opt_in: athlete?.emailOptIn ?? true,
          state_json: stateJson,
        }),
      })
      if (res.ok) {
        setSyncStatus('ok')
        return
      }
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
    if (writeErr) {
      console.warn('[syncState] fallback upsert failed', writeErr)
      setSyncStatus('error')
    } else {
      setSyncStatus('ok')
    }
  } catch (e) {
    console.warn('[syncState] fallback unexpected error', e)
    setSyncStatus('error')
  }
}

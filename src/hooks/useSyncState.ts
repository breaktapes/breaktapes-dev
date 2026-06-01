import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, getClerkToken } from '@/lib/supabase'
import { useAuthStore } from '@/stores/useAuthStore'
import { useRaceStore } from '@/stores/useRaceStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { APP_URL, IS_STAGING } from '@/env'
import { markRemotePullComplete } from '@/lib/syncState'
import { mergeRaceLists, mergeTombstones, type Tomb } from '@/lib/mergeRaces'
import type { Race, Athlete, SeasonPlan } from '@/types'

const PROD_URL = 'https://app.breaktapes.com'

interface RemoteState {
  races?: Race[]
  upcoming_races?: Race[]
  wishlist_races?: Race[]
  athlete?: Athlete
  season_plans?: SeasonPlan[]
  next_race?: Race | null
  focus_race_id?: string | null
  deleted_race_ids?: Tomb[]
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
  const setFocusRaceId = useRaceStore(s => s.setFocusRaceId)
  const setDeletedRaceIds = useRaceStore(s => s.setDeletedRaceIds)
  const setAthlete = useAthleteStore(s => s.setAthlete)
  const setSeasonPlans = useAthleteStore(s => s.setSeasonPlans)

  // Cross-device merge (see src/lib/mergeRaces.ts, unit-tested):
  //  - last-write-wins by updatedAt → EDITS propagate, ties prefer local
  //  - tombstones (deleted_race_ids) → DELETES propagate
  //  - empty/stale remote can never wipe local (union of ids, local wins ties)
  // Replaces the old union-only merge that never reflected remote edits/deletes.
  function applyRemoteSafe(remote: RemoteState) {
    const { races: localRaces, upcomingRaces: localUpcoming, deletedRaceIds: localTombs } = useRaceStore.getState()

    // Merge + persist tombstones so a delete made on another device sticks here
    // and re-propagates outward on the next sync.
    const tombs = mergeTombstones(localTombs ?? [], remote.deleted_race_ids ?? [], Date.now())
    setDeletedRaceIds(tombs)

    const mergedRaces = Array.isArray(remote.races)
      ? mergeRaceLists(localRaces, remote.races, tombs)
      : mergeRaceLists(localRaces, [], tombs)
    let mergedUpcoming = Array.isArray(remote.upcoming_races)
      ? mergeRaceLists(localUpcoming, remote.upcoming_races, tombs)
      : mergeRaceLists(localUpcoming, [], tombs)
    // Past wins for a moved race: an id that now lives in `races` (moved from
    // upcoming) must not be re-added to upcoming from a stale remote snapshot.
    const pastIds = new Set(mergedRaces.map(r => r.id))
    mergedUpcoming = mergedUpcoming.filter(u => !pastIds.has(u.id))

    setRaces(mergedRaces)
    setUpcomingRaces(mergedUpcoming)

    if (Array.isArray(remote.wishlist_races)) setWishlistRaces(remote.wishlist_races)
    promoteNextRace()
    if ('focus_race_id' in remote) {
      // Don't let a stale/empty remote snapshot wipe a focus race the user just
      // pinned locally (focusRaceId has no union-merge guard like races do).
      // Adopt the remote pin only when it's set, or when we have none locally.
      const remoteFocus = remote.focus_race_id ?? null
      const { focusRaceId: localFocus } = useRaceStore.getState()
      if (remoteFocus || !localFocus) setFocusRaceId(remoteFocus)
    }
    // Last-write-wins for athlete (was a blind replace → a stale remote profile
    // clobbered a fresh local edit). Keep local unless remote is strictly newer.
    if (remote.athlete) {
      const localAthlete = useAthleteStore.getState().athlete
      const lu = localAthlete?.updatedAt ?? 0
      const ru = remote.athlete.updatedAt ?? 0
      if (!localAthlete || ru > lu) setAthlete(remote.athlete)
    }
    if (Array.isArray(remote.season_plans)) setSeasonPlans(remote.season_plans)

    // Null out a focus/next pointer that no longer resolves after the merge
    // (e.g. the focused race was deleted on another device).
    const finalIds = new Set([...mergedRaces, ...mergedUpcoming].map(r => r.id))
    const { focusRaceId: f } = useRaceStore.getState()
    if (f && !finalIds.has(f)) setFocusRaceId(null)
  }

  const query = useQuery({
    queryKey: ['sync-state', authUser?.id],
    queryFn: async () => {
      if (!authUser) return null

      // Primary path: Worker GET /api/state (service role key, bypasses RLS).
      // Works without Clerk-Supabase JWT template — same pattern as /api/sync writes.
      const token = getClerkToken()
      if (token) {
        try {
          const res = await fetch(`${APP_URL}/api/state`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (res.ok) {
            const json = await res.json()
            if (json?.state_json) {
              const remote: RemoteState = json.state_json
              applyRemoteSafe(remote)
              return remote
            }
            // No staging row yet — bootstrap from prod on first login.
            // Reads prod state (read-only), writes it into staging Supabase.
            // Flag prevents re-seeding on subsequent logins so staging data
            // stays independent after the initial copy.
            if (IS_STAGING) {
              const bootstrapKey = `bt_staging_bootstrapped_${authUser.id}`
              if (!localStorage.getItem(bootstrapKey)) {
                try {
                  const prodRes = await fetch(`${PROD_URL}/api/state`, {
                    headers: { Authorization: `Bearer ${token}` },
                  })
                  if (prodRes.ok) {
                    const prodJson = await prodRes.json()
                    if (prodJson?.state_json) {
                      // Seed staging Supabase with prod state
                      await fetch(`${APP_URL}/api/sync`, {
                        method: 'POST',
                        headers: {
                          Authorization: `Bearer ${token}`,
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ state_json: prodJson.state_json }),
                      })
                      localStorage.setItem(bootstrapKey, '1')
                      const remote: RemoteState = prodJson.state_json
                      applyRemoteSafe(remote)
                      return remote
                    }
                  }
                } catch {
                  // bootstrap failed silently — user sees empty state, not an error
                }
              }
            }
            return null  // no row yet — new user
          }
        } catch {
          // fall through to direct Supabase
        }
      }

      // Fallback: direct Supabase (works if Clerk-Supabase JWT template is configured)
      const { data, error } = await supabase
        .from('user_state')
        .select('state_json')
        .eq('user_id', authUser.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error  // PGRST116 = no rows
      if (!data) return null

      const remote: RemoteState = data.state_json ?? {}
      applyRemoteSafe(remote)
      return remote
    },
    enabled: !!authUser,
    staleTime: 0,  // always refetch on mount — remote state must be fresh
    retry: 1,
  })

  // Open the write gate once the pull settles successfully (data row OR a
  // confirmed no-row null). Until this fires, syncStateToSupabase() defers
  // every write so an empty fresh-device state can't overwrite the server.
  useEffect(() => {
    if (query.isSuccess) markRemotePullComplete()
  }, [query.isSuccess])

  // Offline / persistent-error fallback: don't block writes forever if the pull
  // never succeeds. After 8s open the gate — BUT only if the pull is no longer
  // in flight (errored/settled). Opening it while a slow cold-start pull is still
  // pending would let an empty local state overwrite the server (the exact
  // data-loss class the gate exists to prevent).
  useEffect(() => {
    if (!authUser) return
    const t = setTimeout(() => {
      if (!query.isLoading && !query.isFetching) markRemotePullComplete()
    }, 8000)
    return () => clearTimeout(t)
  }, [authUser, query.isLoading, query.isFetching])

  return query
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

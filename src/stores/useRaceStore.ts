import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Race } from '@/types'
import { syncStateToSupabase } from '@/lib/syncState'
import type { Tomb } from '@/lib/mergeRaces'
import { posthog } from '@/lib/posthog'

/** Mark a race as locally edited now — drives cross-device last-write-wins. */
function stamp(r: Race): Race {
  return { ...r, updatedAt: Date.now() }
}

export interface RaceState {
  races: Race[]
  upcomingRaces: Race[]
  wishlistRaces: Race[]
  nextRace: Race | null
  focusRaceId: string | null
  // IDs deleted in this session — prevents realtime re-adding them before sync completes
  _pendingDeleteIds: string[]
  // Tombstones for genuinely deleted races — synced so deletes propagate across devices
  deletedRaceIds: Tomb[]
  setDeletedRaceIds: (tombs: Tomb[]) => void
  addRace: (race: Race) => void
  addUpcomingRace: (race: Race) => void
  autoMoveExpiredUpcoming: () => void
  dismissExpiredRace: (id: string) => void
  removeUpcomingRace: (id: string) => void
  updateRace: (id: string, patch: Partial<Race>) => void
  deleteRace: (id: string) => void
  setRaces: (races: Race[]) => void
  setUpcomingRaces: (races: Race[]) => void
  setWishlistRaces: (races: Race[]) => void
  promoteNextRace: () => void
  setFocusRaceId: (id: string | null) => void
  pinFocusRace: (id: string | null) => void
  addToWishlist: (race: Race) => void
  removeFromWishlist: (id: string) => void
  moveToUpcoming: (id: string) => void
}

// All mutation actions push the FULL state via syncStateToSupabase.
// Setters used by remote-pull paths (setRaces, setUpcomingRaces,
// setWishlistRaces) intentionally do NOT call sync — that would echo
// remote state back to the server and overwrite concurrent edits.

/** Returns YYYY-MM-DD in local time (not UTC). */
function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function findNextRace(upcoming: Race[]): Race | null {
  // INVARIANT: `nextRace` is ALWAYS the soonest future race by date.
  // Priority (A/B/C) is a planning tag, not a scheduling override — a
  // distant A-Race must never take precedence over an imminent B/C race.
  // Any code that wants the user's manually-pinned race should read
  // `focusRaceId` via `selectFocusRace`, not `nextRace`.
  const today = localToday()
  const future = upcoming
    .filter(r => r.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
  return future[0] ?? null
}

export const useRaceStore = create<RaceState>()(
  persist(
    (set, get) => ({
      races: [],
      upcomingRaces: [],
      wishlistRaces: [],
      nextRace: null,
      focusRaceId: null,
      _pendingDeleteIds: [],
      deletedRaceIds: [],

      // Silent setter for the remote-pull path (does not echo back to the server).
      setDeletedRaceIds: (deletedRaceIds) => set({ deletedRaceIds }),

      addRace: (race) => {
        set(s => ({ races: [...s.races, stamp(race)] }))
        void syncStateToSupabase()
        posthog.capture('race_logged', {
          sport: race.sport,
          distance: race.distance,
          has_time: !!race.time,
          has_placing: !!race.placing,
        })
      },

      addUpcomingRace: (race) => {
        set(s => ({ upcomingRaces: [...s.upcomingRaces, stamp(race)] }))
        get().promoteNextRace()
        void syncStateToSupabase()
        posthog.capture('race_planned', {
          sport: race.sport,
          distance: race.distance,
        })
      },

      autoMoveExpiredUpcoming: () => {
        const today = localToday()
        const { upcomingRaces, races, deletedRaceIds } = get()
        const expired = upcomingRaces.filter(r => r.date < today)
        if (expired.length === 0) return
        // Moved, not deleted — stamp so the past copy wins over a stale remote
        // upcoming copy of the same id (cross-list dedup in the pull keeps past).
        // Clear any tombstone for a moved id: a move means "this race is alive",
        // so it must beat a stale delete from another device (else the result is lost).
        const movedIds = new Set(expired.map(r => r.id))
        set({
          races: [...races, ...expired.map(stamp)],
          upcomingRaces: upcomingRaces.filter(r => r.date >= today),
          deletedRaceIds: deletedRaceIds.filter(t => !movedIds.has(t.id)),
        })
        get().promoteNextRace()
        void syncStateToSupabase()
      },

      // Remove an upcoming race entirely (no move to past — e.g. replaced by an alternative)
      removeUpcomingRace: (id) => {
        const { upcomingRaces, _pendingDeleteIds, deletedRaceIds } = get()
        set({
          upcomingRaces: upcomingRaces.filter(r => r.id !== id),
          focusRaceId: get().focusRaceId === id ? null : get().focusRaceId,
          _pendingDeleteIds: [..._pendingDeleteIds, id],
          deletedRaceIds: [...deletedRaceIds, { id, at: Date.now() }],
        })
        get().promoteNextRace()
        void syncStateToSupabase()
      },

      // Move a single expired upcoming race to past without requiring a result
      dismissExpiredRace: (id) => {
        const { upcomingRaces, races, _pendingDeleteIds, deletedRaceIds } = get()
        const race = upcomingRaces.find(r => r.id === id)
        if (!race) return
        const newUpcoming = upcomingRaces.filter(r => r.id !== id)
        // Moved to past (same id), NOT deleted — stamp, and clear any stale
        // tombstone for this id so a delete from another device can't kill the
        // race the user just moved + is about to log a result for.
        set({
          races: [...races, stamp(race)],
          upcomingRaces: newUpcoming,
          focusRaceId: get().focusRaceId === id ? null : get().focusRaceId,
          _pendingDeleteIds: [..._pendingDeleteIds, id],
          deletedRaceIds: deletedRaceIds.filter(t => t.id !== id),
        })
        get().promoteNextRace()
        void syncStateToSupabase()
      },

      updateRace: (id, patch) => {
        const now = Date.now()
        set(s => ({
          races: s.races.map(r => r.id === id ? { ...r, ...patch, updatedAt: now } : r),
          upcomingRaces: s.upcomingRaces.map(r => r.id === id ? { ...r, ...patch, updatedAt: now } : r),
          // Keep nextRace in sync — otherwise goal time / priority edits don't surface in dashboard widgets
          nextRace: s.nextRace?.id === id ? { ...s.nextRace, ...patch, updatedAt: now } : s.nextRace,
        }))
        void syncStateToSupabase()
      },

      deleteRace: (id) => {
        const isPast = get().races.some(r => r.id === id)
        set(s => {
          const newUpcoming = s.upcomingRaces.filter(r => r.id !== id)
          const newNextRace = s.nextRace?.id === id ? findNextRace(newUpcoming) : s.nextRace
          return {
            races: s.races.filter(r => r.id !== id),
            upcomingRaces: newUpcoming,
            nextRace: newNextRace,
            focusRaceId: s.focusRaceId === id ? null : s.focusRaceId,
            _pendingDeleteIds: [...s._pendingDeleteIds, id],
            // Tombstone so the delete propagates to other devices.
            deletedRaceIds: [...s.deletedRaceIds, { id, at: Date.now() }],
          }
        })
        void syncStateToSupabase()
        posthog.capture('race_deleted', { type: isPast ? 'past' : 'upcoming' })
      },

      setFocusRaceId: (id) => set({ focusRaceId: id }),

      // User-action variant — pins/unpins focus race AND pushes state to
      // Supabase so the pin crosses devices. The plain `setFocusRaceId`
      // setter stays silent so the remote-pull path doesn't echo back.
      pinFocusRace: (id) => {
        set({ focusRaceId: id })
        void syncStateToSupabase()
      },

      setRaces: (races) => set({ races }),

      setWishlistRaces: (wishlistRaces) => set({ wishlistRaces }),

      setUpcomingRaces: (upcomingRaces) => {
        set({ upcomingRaces })
        // Auto-promote nextRace from upcoming (regression fix: Session 13)
        get().promoteNextRace()
      },

      promoteNextRace: () => {
        // Always recompute against the current upcomingRaces list. Earlier
        // versions short-circuited when `nextRace` already pointed at any
        // future date, which meant a newly-added nearer race (or a change
        // to an existing race's date) never bumped the pointer and the
        // Dashboard "NEXT RACE" briefing drifted out of sync.
        const { upcomingRaces } = get()
        set({ nextRace: findNextRace(upcomingRaces) })
      },

      addToWishlist: (race) => {
        set(s => ({
          wishlistRaces: s.wishlistRaces.some(r => r.id === race.id)
            ? s.wishlistRaces
            : [...s.wishlistRaces, race],
        }))
        void syncStateToSupabase()
      },

      removeFromWishlist: (id) => {
        set(s => ({ wishlistRaces: s.wishlistRaces.filter(r => r.id !== id) }))
        void syncStateToSupabase()
      },

      moveToUpcoming: (id) => {
        const { wishlistRaces } = get()
        const race = wishlistRaces.find(r => r.id === id)
        if (!race) return
        set(s => ({ wishlistRaces: s.wishlistRaces.filter(r => r.id !== id) }))
        // addUpcomingRace already triggers sync — covers both slices in one upsert.
        get().addUpcomingRace(race)
      },
    }),
    {
      name: 'fl2_races',  // must match existing localStorage key
      partialize: (s) => ({
        races: s.races,
        upcomingRaces: s.upcomingRaces,
        wishlistRaces: s.wishlistRaces,
        nextRace: s.nextRace,
        focusRaceId: s.focusRaceId,
        deletedRaceIds: s.deletedRaceIds,  // tombstones persist so deletes survive reloads + propagate
        // _pendingDeleteIds intentionally excluded — session-only, not persisted
      }),
      // Migrate old SPA format: raw array stored directly, not wrapped in {state:{...}}
      onRehydrateStorage: () => (state) => {
        if (!state) return

        // Migrate V1 SPA format: raw array stored directly (no Zustand wrapper)
        if (state.races.length === 0) {
          try {
            const raw = localStorage.getItem('fl2_races')
            if (raw) {
              const parsed = JSON.parse(raw)
              if (Array.isArray(parsed) && parsed.length > 0) {
                state.setRaces(parsed)
              }
            }
          } catch {}
        }

        // Migrate V1 upcoming races (stored separately as fl2_upcoming)
        if (state.upcomingRaces.length === 0) {
          try {
            const raw = localStorage.getItem('fl2_upcoming')
            if (raw) {
              const parsed = JSON.parse(raw)
              if (Array.isArray(parsed) && parsed.length > 0) {
                state.setUpcomingRaces(parsed)
              }
            }
          } catch {}
        }

        // Migrate V1 wishlist (stored separately as fl2_wishlist)
        if (state.wishlistRaces.length === 0) {
          try {
            const raw = localStorage.getItem('fl2_wishlist')
            if (raw) {
              const parsed = JSON.parse(raw)
              if (Array.isArray(parsed) && parsed.length > 0) {
                state.setWishlistRaces(parsed)
              }
            }
          } catch {}
        }

        // Migrate V1 focus race ID (stored as plain string, not JSON)
        if (!state.focusRaceId) {
          try {
            const raw = localStorage.getItem('fl2_focus_race_id')
            if (raw) state.setFocusRaceId(raw)
          } catch {}
        }

        // Promote nextRace on load (expired races stay in upcoming until user logs result)
        state.promoteNextRace()
      },
    }
  ),
)

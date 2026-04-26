import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Race } from '@/types'
import { syncStateToSupabase } from '@/lib/syncState'

export interface RaceState {
  races: Race[]
  upcomingRaces: Race[]
  wishlistRaces: Race[]
  nextRace: Race | null
  focusRaceId: string | null
  addRace: (race: Race) => void
  addUpcomingRace: (race: Race) => void
  autoMoveExpiredUpcoming: () => void
  dismissExpiredRace: (id: string) => void
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

      addRace: (race) => {
        set(s => ({ races: [...s.races, race] }))
        void syncStateToSupabase()
      },

      addUpcomingRace: (race) => {
        set(s => ({ upcomingRaces: [...s.upcomingRaces, race] }))
        get().promoteNextRace()
        void syncStateToSupabase()
      },

      autoMoveExpiredUpcoming: () => {
        const today = localToday()
        const { upcomingRaces, races } = get()
        const expired = upcomingRaces.filter(r => r.date < today)
        if (expired.length === 0) return
        set({
          races: [...races, ...expired],
          upcomingRaces: upcomingRaces.filter(r => r.date >= today),
        })
        get().promoteNextRace()
        void syncStateToSupabase()
      },

      // Move a single expired upcoming race to past without requiring a result
      dismissExpiredRace: (id) => {
        const { upcomingRaces, races } = get()
        const race = upcomingRaces.find(r => r.id === id)
        if (!race) return
        const newUpcoming = upcomingRaces.filter(r => r.id !== id)
        set({
          races: [...races, race],
          upcomingRaces: newUpcoming,
          focusRaceId: get().focusRaceId === id ? null : get().focusRaceId,
        })
        get().promoteNextRace()
        void syncStateToSupabase()
      },

      updateRace: (id, patch) => {
        set(s => ({
          races: s.races.map(r => r.id === id ? { ...r, ...patch } : r),
          upcomingRaces: s.upcomingRaces.map(r => r.id === id ? { ...r, ...patch } : r),
          // Keep nextRace in sync — otherwise goal time / priority edits don't surface in dashboard widgets
          nextRace: s.nextRace?.id === id ? { ...s.nextRace, ...patch } : s.nextRace,
        }))
        void syncStateToSupabase()
      },

      deleteRace: (id) => {
        set(s => {
          const newUpcoming = s.upcomingRaces.filter(r => r.id !== id)
          const newNextRace = s.nextRace?.id === id ? findNextRace(newUpcoming) : s.nextRace
          return {
            races: s.races.filter(r => r.id !== id),
            upcomingRaces: newUpcoming,
            nextRace: newNextRace,
            focusRaceId: s.focusRaceId === id ? null : s.focusRaceId,
          }
        })
        void syncStateToSupabase()
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

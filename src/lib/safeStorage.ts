/**
 * Quota-safe localStorage wrapper for Zustand persist.
 *
 * Background: race/medal photos used to be embedded as base64 data URLs inside
 * each race object, which lives in the persisted `fl2_races` blob. A photo-heavy
 * history pushes that blob past the ~5 MB localStorage quota. The DEFAULT Zustand
 * storage lets `setItem`'s `QuotaExceededError` propagate — so any mutation
 * (pinFocusRace, addUpcomingRace, updateRace…) re-serializes the whole store and
 * throws straight out of a React event handler, crashing the tab (the 48 prod
 * "QuotaExceededError: The quota has been exceeded." reports).
 *
 * This storage swallows the write error instead of throwing. The app keeps
 * running off in-memory state; the boot-time `migrateEmbeddedPhotos()` pass frees
 * the quota for real by moving base64 → Storage URLs and writing back a tiny blob.
 * Swallowing is safe because the canonical copy is the synced Supabase row, not
 * localStorage — localStorage is a cache, and a failed cache write is recoverable.
 */
import { createJSONStorage, type StateStorage } from 'zustand/middleware'

const guarded: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch (e) {
      // QuotaExceededError (or private-mode write block). Never throw — a rejected
      // cache write must not crash the event handler that triggered it.
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn(`[safeStorage] setItem("${name}") failed — quota likely exceeded`, e)
      }
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch {
      /* ignore */
    }
  },
}

/** Drop-in replacement for the default Zustand persist storage. */
export const safeStorage = createJSONStorage(() => guarded)

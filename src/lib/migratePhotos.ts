/**
 * One-time bulk migration of embedded base64 race/medal photos → Storage URLs.
 *
 * Existing users accumulated base64 data URLs inside each race object, bloating
 * the persisted `fl2_races` blob past the ~5 MB localStorage quota. Past that
 * point every persist write throws `QuotaExceededError` and crashes the tab.
 *
 * The lazy-on-save migration in ViewEditRaceModal CANNOT dig these users out:
 * saving one race rewrites the whole still-over-quota blob, so the write throws
 * before the strip can land. This pass strips EVERY base64 photo in memory first,
 * then writes back ONCE — the final blob is tiny (URLs are ~100 bytes), so the
 * single setItem succeeds and the quota is freed for good.
 *
 * Requires a Clerk token (uploadPhotoIfNeeded returns the data URL unchanged
 * without one). Idempotent and retry-safe: it no-ops once no base64 remains, and
 * re-runs on the next boot if uploads failed (Worker down / offline).
 */
import type { Race } from '@/types'
import { useRaceStore } from '@/stores/useRaceStore'
import { uploadPhotoIfNeeded, uploadPhotosIfNeeded } from '@/lib/uploadPhoto'
import { syncStateToSupabase } from '@/lib/syncState'

const isDataUrl = (v: unknown): v is string =>
  typeof v === 'string' && v.startsWith('data:image/')

/** True if the race still carries any embedded base64 photo. */
function hasBase64(r: Race): boolean {
  return isDataUrl(r.medalPhoto) || (Array.isArray(r.photos) && r.photos.some(isDataUrl))
}

let inflight: Promise<void> | null = null

/**
 * Upload every embedded base64 photo to Storage and replace it with the URL.
 * Coalesces concurrent calls; safe to call on every boot.
 */
export function migrateEmbeddedPhotos(): Promise<void> {
  if (inflight) return inflight

  inflight = (async () => {
    const { races, setRaces } = useRaceStore.getState()
    if (!races.some(hasBase64)) return  // nothing to do — fast path

    const updated = await Promise.all(
      races.map(async (r) => {
        if (!hasBase64(r)) return r
        const [medalPhoto, photos] = await Promise.all([
          uploadPhotoIfNeeded(r.medalPhoto),
          uploadPhotosIfNeeded(r.photos),
        ])
        return { ...r, medalPhoto, photos }
      }),
    )

    // Only write back if something actually changed (at least one base64 became a
    // URL). setRaces is the silent setter — no sync echo — and triggers exactly
    // one persist write of the now-small blob.
    const changed = updated.some((r, i) => r !== races[i])
    if (!changed) return
    setRaces(updated)

    // Clean the server copy too so state_json drops the base64 (debounced).
    // Skip if any base64 survived (Worker was down) — don't push a still-huge blob.
    if (!updated.some(hasBase64)) void syncStateToSupabase()
  })().finally(() => {
    // Release the guard so a later boot can retry if uploads failed this time.
    inflight = null
  })

  return inflight
}

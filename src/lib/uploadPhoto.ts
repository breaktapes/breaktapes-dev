/**
 * Race / medal photo upload.
 *
 * Photos used to be stored as base64 data URLs inside each race object, which
 * lives in the synced `state_json` blob AND in localStorage. Every save then
 * re-serialized the whole photo-laden state synchronously (main-thread freeze)
 * and re-uploaded it — slow saves and ~5 MB localStorage-quota tab crashes.
 *
 * These helpers push a base64 data URL to Supabase Storage via the Worker
 * (service role) and return the public URL. State then holds a short URL, not
 * megabytes of base64. They are also the lazy-migration path: existing races
 * with embedded base64 get converted on their next save.
 *
 * Failure is non-fatal: if the upload fails (offline, Worker down), the original
 * data URL is returned unchanged so the photo is never lost — it just stays
 * embedded until the next successful save.
 */
import { APP_URL } from '@/env'
import { getClerkToken } from '@/lib/supabase'

/** True for a base64 image data URL (needs uploading); false for an https URL or empty. */
function isDataUrl(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.startsWith('data:image/')
}

/**
 * Upload a single photo if it's a base64 data URL; pass through https URLs and
 * empty values untouched. Never throws — returns the original value on failure.
 */
export async function uploadPhotoIfNeeded(value: string | undefined): Promise<string | undefined> {
  if (!isDataUrl(value)) return value
  const token = getClerkToken()
  if (!token) return value  // not signed in — keep base64, migrate later
  try {
    const res = await fetch(`${APP_URL}/api/upload-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ data_url: value }),
    })
    if (!res.ok) return value
    const json = await res.json()
    return typeof json?.url === 'string' ? json.url : value
  } catch {
    return value
  }
}

/**
 * Upload every base64 photo in a list, preserving order and pass-through URLs.
 * Runs uploads in parallel. Never throws — failed items keep their data URL.
 */
export async function uploadPhotosIfNeeded(values: string[] | undefined): Promise<string[] | undefined> {
  if (!values || values.length === 0) return values
  return Promise.all(values.map(uploadPhotoIfNeeded)) as Promise<string[]>
}

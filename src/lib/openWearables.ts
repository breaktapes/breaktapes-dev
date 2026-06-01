/**
 * Open Wearables client — all calls go through health-proxy to keep OW_API_KEY server-side.
 * The proxy injects the key and the OW_BASE_URL; the frontend only sees health.breaktapes.com.
 */

const HEALTH_PROXY = 'https://health.breaktapes.com'

export type OWProvider =
  | 'garmin' | 'whoop' | 'strava' | 'polar' | 'suunto' | 'fitbit' | 'ultrahuman'

export interface OWConnection {
  provider: OWProvider
  connected: boolean
  last_sync?: string | null
}

export interface OWWorkout {
  id: string
  provider: OWProvider
  sport_type: string            // 'running' | 'cycling' | 'swimming' | 'triathlon' | ...
  started_at: string            // ISO 8601
  duration_seconds: number
  distance_meters: number | null
  average_heart_rate: number | null
  name: string | null
}

export interface OWRecovery {
  date: string                  // YYYY-MM-DD
  hrv_rmssd: number | null      // ms
  resting_heart_rate: number | null  // bpm
  recovery_score: number | null      // 0-100 (WHOOP/Suunto/Oura native score, else null)
  spo2: number | null           // %
}

export interface OWActivitySummary {
  date: string
  steps: number | null
  energy_kcal: number | null
  distance_meters: number | null
}

// ── Internal fetch helper ─────────────────────────────────────────────────────

async function owFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${HEALTH_PROXY}/ow${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> ?? {}),
    },
  })
}

// ── User management ───────────────────────────────────────────────────────────

/**
 * Create (or retrieve) an OW user for this Breaktapes user.
 * Idempotent — OW deduplicates on external_user_id.
 * Returns the OW user ID to store in the athlete profile.
 */
export async function ensureOWUser(clerkUserId: string, email: string): Promise<string> {
  const res = await owFetch('/user', {
    method: 'POST',
    body: JSON.stringify({ clerk_user_id: clerkUserId, email }),
  })
  if (!res.ok) throw new Error(`OW user create failed: ${res.status}`)
  const data = await res.json()
  return data.id as string
}

// ── Provider connections ──────────────────────────────────────────────────────

/**
 * Get OAuth authorization URL for a provider.
 * The user is redirected there; OW handles the callback and token storage.
 * After authorization, OW redirects the user to `redirectUri`.
 */
export async function getOAuthUrl(
  owUserId: string,
  provider: OWProvider,
  redirectUri: string,
): Promise<string> {
  const params = new URLSearchParams({ ow_user_id: owUserId, provider, redirect_uri: redirectUri })
  const res = await owFetch(`/connect?${params}`)
  if (!res.ok) throw new Error(`OW connect failed: ${res.status}`)
  const data = await res.json()
  return data.authorization_url as string
}

/** List all providers and their connection status for a user. */
export async function getConnections(owUserId: string): Promise<OWConnection[]> {
  const res = await owFetch(`/connections?ow_user_id=${owUserId}`)
  if (!res.ok) return []
  const data = await res.json().catch(() => ([]))
  // health-proxy wraps as { connections: [...] }; tolerate a bare array too.
  const list = Array.isArray(data) ? data : (data.connections ?? [])
  return Array.isArray(list) ? list : []
}

/** Disconnect a provider — revokes OW's stored tokens. */
export async function disconnectProvider(owUserId: string, provider: OWProvider): Promise<void> {
  await owFetch(`/disconnect`, {
    method: 'POST',
    body: JSON.stringify({ ow_user_id: owUserId, provider }),
  })
}

// ── Data fetching ─────────────────────────────────────────────────────────────

/**
 * Fetch normalized workouts across ALL connected providers.
 * Returns most-recent-first.
 */
export async function fetchOWWorkouts(owUserId: string, days = 60): Promise<OWWorkout[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const params = new URLSearchParams({ ow_user_id: owUserId, since, limit: '200' })
  const res = await owFetch(`/workouts?${params}`)
  if (!res.ok) return []
  const data = await res.json().catch(() => ([]))
  const list = Array.isArray(data) ? data : (data.workouts ?? [])
  return (Array.isArray(list) ? list : []) as OWWorkout[]
}

/**
 * Fetch daily recovery metrics (HRV, resting HR, recovery score).
 * Works with Garmin, WHOOP, Suunto, Oura.
 */
export async function fetchOWRecovery(owUserId: string, days = 14): Promise<OWRecovery[]> {
  const params = new URLSearchParams({ ow_user_id: owUserId, days: String(days) })
  const res = await owFetch(`/recovery?${params}`)
  if (!res.ok) return []
  const data = await res.json().catch(() => ([]))
  const list = Array.isArray(data) ? data : (data.recovery ?? [])
  return (Array.isArray(list) ? list : []) as OWRecovery[]
}

/**
 * Fetch daily activity summaries (steps, calories, distance).
 */
export async function fetchOWActivity(owUserId: string, days = 14): Promise<OWActivitySummary[]> {
  const params = new URLSearchParams({ ow_user_id: owUserId, days: String(days) })
  const res = await owFetch(`/activity?${params}`)
  if (!res.ok) return []
  const data = await res.json().catch(() => ([]))
  const list = Array.isArray(data) ? data : (data.activity ?? [])
  return (Array.isArray(list) ? list : []) as OWActivitySummary[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Compute 7-day average HRV from recovery records. Returns null if no data. */
export function avgHRV(records: OWRecovery[], days = 7): number | null {
  if (!Array.isArray(records)) return null
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
  const vals = records
    .filter(r => r.date >= cutoff && r.hrv_rmssd !== null)
    .map(r => r.hrv_rmssd as number)
  if (vals.length === 0) return null
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}

/** Latest recovery score (0-100). Returns null if no data. */
export function latestRecoveryScore(records: OWRecovery[]): number | null {
  if (!Array.isArray(records) || records.length === 0) return null
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date))
  return sorted[0]?.recovery_score ?? null
}

/** Human-readable provider name for UI labels. */
export function owProviderLabel(provider: OWProvider): string {
  return {
    garmin: 'Garmin', whoop: 'WHOOP', strava: 'Strava',
    polar: 'Polar', suunto: 'Suunto', fitbit: 'Fitbit', ultrahuman: 'Ultrahuman',
  }[provider] ?? provider
}

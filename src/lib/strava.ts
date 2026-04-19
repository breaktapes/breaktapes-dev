import { useWearableStore } from '@/stores/useWearableStore'
import { saveWearableToken } from '@/lib/wearableUtils'
import { STRAVA_CLIENT_ID } from '@/env'
import type { WearableToken, Race } from '@/types'

export { STRAVA_CLIENT_ID }

const HEALTH_PROXY = 'https://health.breaktapes.com'

// ─── Activity types ───────────────────────────────────────────────────────────

export interface StravaActivity {
  id: number
  name: string
  type: string
  workout_type: number   // 1=race run, 11=race ride
  start_date_local: string
  elapsed_time: number
  distance: number       // metres
  location_city?: string
  location_country?: string
}

// ─── Strava API fetch helper ──────────────────────────────────────────────────

/** Refresh strava token if needed, then fetch activities. Returns [] on error. */
export async function fetchStravaActivities(limit = 100): Promise<StravaActivity[]> {
  const token = useWearableStore.getState().stravaToken
  if (!token?.access_token) return []

  // Refresh if within 60s of expiry
  let accessToken = token.access_token
  if (token.expires_at && Date.now() / 1000 > token.expires_at - 60) {
    if (!token.refresh_token) return []
    try {
      const res = await fetch(`${HEALTH_PROXY}/strava/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: token.refresh_token }),
      })
      if (!res.ok) return []
      const data = await res.json()
      const refreshed: WearableToken = {
        provider: 'strava',
        access_token: data.access_token,
        refresh_token: data.refresh_token ?? token.refresh_token,
        expires_at: data.expires_at,
      }
      await saveWearableToken(refreshed)
      useWearableStore.getState().setToken('strava', refreshed)
      accessToken = refreshed.access_token
    } catch {
      return []
    }
  }

  try {
    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=${limit}&page=1`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

// ─── Race import helpers ──────────────────────────────────────────────────────

const DIST_LABELS_RUN  = ['5KM','10KM','10 Mile','Half Marathon','Marathon','50KM','50 Mile','100KM','100 Mile']
const DIST_KM_RUN      = [5, 10, 16.1, 21.1, 42.2, 50, 80.5, 100, 161]
const DIST_LABELS_CYCLE = ['Gran Fondo','Century','Randonneuring','Time Trial','Track Cycling']
const DIST_KM_CYCLE     = [120, 160.9, 200, 40, 50]
const DIST_LABELS_SWIM  = ['1KM','3KM','5KM','10KM','15KM','25KM']
const DIST_KM_SWIM      = [1, 3, 5, 10, 15, 25]
const DIST_LABELS_TRI   = ['Sprint','Olympic','Middle Distance','Full Distance']
const DIST_KM_TRI       = [20.4, 51.5, 113, 226]

function closestDistLabel(type: string, km: number): string {
  let labels: string[]
  let dists: number[]
  if (type === 'cycle') { labels = DIST_LABELS_CYCLE; dists = DIST_KM_CYCLE }
  else if (type === 'swim') { labels = DIST_LABELS_SWIM; dists = DIST_KM_SWIM }
  else if (type === 'tri') { labels = DIST_LABELS_TRI; dists = DIST_KM_TRI }
  else { labels = DIST_LABELS_RUN; dists = DIST_KM_RUN }
  let bestIdx = 0; let bestDiff = Infinity
  dists.forEach((d, i) => { const diff = Math.abs(d - km); if (diff < bestDiff) { bestDiff = diff; bestIdx = i } })
  return labels[bestIdx] ?? `${km}KM`
}

function stravaTypeToRaceType(stravaType: string): Race['sport'] {
  const t = stravaType.toLowerCase()
  if (t.includes('swim') || t.includes('openwater')) return 'swim'
  if (t.includes('ride') || t.includes('cycling')) return 'cycle'
  if (t.includes('triathlon')) return 'tri'
  return 'run'
}

/**
 * Convert Strava activities flagged as races (workout_type 1 or 11) into Race objects.
 * Skips any activity that already has a matching strava_id in existingRaces.
 */
export function stravaActivitiesToRaces(
  activities: StravaActivity[],
  existingRaces: Pick<Race, 'strava_id'>[],
): Omit<Race, 'id'>[] {
  const existingIds = new Set(existingRaces.map(r => r.strava_id).filter(Boolean))
  const today = new Date().toISOString().split('T')[0]
  const imported: Omit<Race, 'id'>[] = []

  for (const a of activities) {
    if (a.workout_type !== 1 && a.workout_type !== 11) continue
    if (existingIds.has(a.id)) continue
    const dateStr = (a.start_date_local ?? '').slice(0, 10)
    if (!dateStr || dateStr > today) continue  // skip future / missing date

    const sport = stravaTypeToRaceType(a.type)
    const distKm = Math.round((a.distance ?? 0) / 100) / 10
    const distance = closestDistLabel(sport, distKm)
    const elapsed = a.elapsed_time ?? 0
    const h = Math.floor(elapsed / 3600)
    const m = Math.floor((elapsed % 3600) / 60)
    const s = elapsed % 60
    const time = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`

    imported.push({
      strava_id: a.id,
      name: a.name,
      sport,
      distance,
      time,
      city: a.location_city ?? '',
      country: a.location_country ?? '',
      date: dateStr,
      placing: '',
      medal: 'finisher',
    })
  }

  return imported
}

export function startStravaOAuth() {
  const nonce = crypto.randomUUID()
  const state = `strava:${nonce}`
  sessionStorage.setItem('oauth_state', state)
  const redirectUri = `${window.location.origin}/train`
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'read,activity:read_all',
    state,
  })
  window.location.href = `https://www.strava.com/oauth/authorize?${params}`
}

export async function handleStravaCallback(code: string, returnedState: string): Promise<void> {
  const expectedState = sessionStorage.getItem('oauth_state')
  sessionStorage.removeItem('oauth_state')
  if (!expectedState || expectedState !== returnedState) {
    throw new Error('OAuth state mismatch — possible CSRF attack')
  }
  const res = await fetch(`${HEALTH_PROXY}/strava/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  if (!res.ok) throw new Error('Strava token exchange failed')
  const tokenData = await res.json()
  const token: WearableToken = {
    provider: 'strava',
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: tokenData.expires_at,
  }
  await saveWearableToken(token)
  useWearableStore.getState().setToken('strava', token)
}

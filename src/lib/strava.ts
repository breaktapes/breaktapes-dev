import { supabase } from '@/lib/supabase'
import { useWearableStore } from '@/stores/useWearableStore'
import { STRAVA_CLIENT_ID } from '@/env'
import type { WearableToken } from '@/types'

export { STRAVA_CLIENT_ID }

const HEALTH_PROXY = 'https://health.breaktapes.com'

export function startStravaOAuth() {
  const redirectUri = `${window.location.origin}/train`
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'read,activity:read_all',
    state: 'strava',
  })
  window.location.href = `https://www.strava.com/oauth/authorize?${params}`
}

export async function handleStravaCallback(code: string): Promise<void> {
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

async function saveWearableToken(token: WearableToken) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('wearable_tokens').upsert({
    user_id: user.id,
    provider: token.provider,
    access_token: token.access_token,
    refresh_token: token.refresh_token ?? null,
    expires_at: token.expires_at ?? null,
  }, { onConflict: 'user_id,provider' })
}

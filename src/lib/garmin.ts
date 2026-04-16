import { supabase } from '@/lib/supabase'
import { useWearableStore } from '@/stores/useWearableStore'
import { GARMIN_CLIENT_ID } from '@/env'
import type { WearableToken } from '@/types'

export { GARMIN_CLIENT_ID }

const HEALTH_PROXY = 'https://health.breaktapes.com'

async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const array = new Uint8Array(64)
  crypto.getRandomValues(array)
  // Base64url-encode without padding
  const verifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
  const encoder = new TextEncoder()
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(verifier))
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
  return { verifier, challenge }
}

export async function startGarminOAuth(): Promise<void> {
  const { verifier, challenge } = await generatePKCE()
  sessionStorage.setItem('garmin_pkce_verifier', verifier)
  const redirectUri = `${window.location.origin}/train`
  const params = new URLSearchParams({
    client_id: GARMIN_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'activity:read',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: 'garmin',
  })
  window.location.href = `https://connect.garmin.com/oauthConfirm?${params}`
}

export async function handleGarminCallback(code: string): Promise<void> {
  const verifier = sessionStorage.getItem('garmin_pkce_verifier')
  sessionStorage.removeItem('garmin_pkce_verifier')
  if (!verifier) throw new Error('PKCE verifier missing')
  const redirectUri = `${window.location.origin}/train`
  const res = await fetch(`${HEALTH_PROXY}/garmin/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: redirectUri, code_verifier: verifier }),
  })
  if (!res.ok) throw new Error('Garmin token exchange failed')
  const tokenData = await res.json()
  const token: WearableToken = {
    provider: 'garmin',
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: tokenData.expires_in
      ? Math.floor(Date.now() / 1000) + tokenData.expires_in
      : undefined,
  }
  await saveWearableToken(token)
  useWearableStore.getState().setToken('garmin', token)
}

export async function fetchGarminActivities(limit = 20): Promise<unknown[]> {
  const token = useWearableStore.getState().garminToken
  if (!token) return []
  const end = Math.floor(Date.now() / 1000)
  const start = end - 90 * 24 * 3600
  const res = await fetch(
    `https://apis.garmin.com/wellness-api/rest/activities?uploadStartTimeInSeconds=${start}&uploadEndTimeInSeconds=${end}&limit=${limit}`,
    { headers: { Authorization: `Bearer ${token.access_token}` } },
  )
  if (!res.ok) return []
  return await res.json()
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

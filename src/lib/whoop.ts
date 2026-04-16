import { supabase } from '@/lib/supabase'
import { useWearableStore } from '@/stores/useWearableStore'
import type { WearableToken } from '@/types'

// Fill in via Cloudflare Worker secret / wrangler secret put WHOOP_CLIENT_ID
export const WHOOP_CLIENT_ID = ''
export const WHOOP_SCOPES = 'read:workout read:recovery read:body_measurement offline'

const HEALTH_PROXY = 'https://health.breaktapes.com'

export function startWhoopOAuth() {
  const redirectUri = `${window.location.origin}/train`
  const params = new URLSearchParams({
    client_id: WHOOP_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: WHOOP_SCOPES,
    state: 'whoop',
  })
  window.location.href = `https://api.prod.whoop.com/oauth/oauth2/auth?${params}`
}

export async function handleWhoopCallback(code: string): Promise<void> {
  const redirectUri = `${window.location.origin}/train`
  const res = await fetch(`${HEALTH_PROXY}/whoop/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
  })
  if (!res.ok) throw new Error('WHOOP token exchange failed')
  const tokenData = await res.json()
  const token: WearableToken = {
    provider: 'whoop',
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: tokenData.expires_in ? Math.floor(Date.now() / 1000) + tokenData.expires_in : undefined,
  }
  await saveWearableToken(token)
  useWearableStore.getState().setToken('whoop', token)
  scheduleWhoopRefresh(token)
}

export async function refreshWhoopToken(): Promise<void> {
  const token = useWearableStore.getState().whoopToken
  if (!token?.refresh_token) {
    useWearableStore.getState().clearToken('whoop')
    return
  }
  try {
    const res = await fetch(`${HEALTH_PROXY}/whoop/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: token.refresh_token }),
    })
    if (!res.ok) throw new Error('WHOOP refresh failed')
    const tokenData = await res.json()
    const newToken: WearableToken = {
      provider: 'whoop',
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? token.refresh_token,
      expires_at: tokenData.expires_in ? Math.floor(Date.now() / 1000) + tokenData.expires_in : undefined,
    }
    await saveWearableToken(newToken)
    useWearableStore.getState().setToken('whoop', newToken)
    scheduleWhoopRefresh(newToken)
  } catch {
    useWearableStore.getState().clearToken('whoop')
  }
}

function scheduleWhoopRefresh(token: WearableToken) {
  if (!token.expires_at) return
  const msUntilRefresh = token.expires_at * 1000 - Date.now() - 60_000
  if (msUntilRefresh > 0) {
    setTimeout(refreshWhoopToken, msUntilRefresh)
  }
}

export async function fetchWhoopActivities(limit = 20): Promise<unknown[]> {
  const token = useWearableStore.getState().whoopToken
  if (!token) return []
  const res = await fetch(`https://api.prod.whoop.com/developer/v1/activity/workout?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.records ?? []
}

export async function fetchWhoopRecovery(limit = 20): Promise<unknown[]> {
  const token = useWearableStore.getState().whoopToken
  if (!token) return []
  const res = await fetch(`https://api.prod.whoop.com/developer/v1/recovery?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.records ?? []
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

import { supabase } from '@/lib/supabase'
import type { WearableToken } from '@/types'

/**
 * Upsert a wearable token for the authenticated user.
 * Shared across all wearable provider libs — single source of truth.
 */
export async function saveWearableToken(token: WearableToken): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('wearable_tokens').upsert({
    user_id: user.id,
    provider: token.provider,
    access_token: token.access_token,
    refresh_token: token.refresh_token ?? null,
    expires_at: token.expires_at ?? null,
    profile: token.profile ?? null,
  }, { onConflict: 'user_id,provider' })
}

/**
 * Delete a wearable token from Supabase.
 * Must be called before clearing from Zustand store on disconnect.
 */
export async function removeWearableToken(provider: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('wearable_tokens').delete()
    .eq('user_id', user.id)
    .eq('provider', provider)
}

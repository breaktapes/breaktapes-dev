import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/useAuthStore'
import type { WearableToken } from '@/types'

// The app authenticates with Clerk, not Supabase Auth — supabase.auth.getUser()
// always returns null here. The Clerk user id lives in the auth store (same id
// the read path in useWearableTokens.ts queries by). RLS on wearable_tokens
// gates rows by auth.jwt()->>'sub', which the supabase client carries via the
// injected Clerk JWT.
function clerkUserId(): string | null {
  return useAuthStore.getState().authUser?.id ?? null
}

/**
 * Upsert a wearable token for the authenticated user.
 * Shared across all wearable provider libs — single source of truth.
 */
export async function saveWearableToken(token: WearableToken): Promise<void> {
  const userId = clerkUserId()
  if (!userId) return
  await supabase.from('wearable_tokens').upsert({
    user_id: userId,
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
  const userId = clerkUserId()
  if (!userId) return
  await supabase.from('wearable_tokens').delete()
    .eq('user_id', userId)
    .eq('provider', provider)
}

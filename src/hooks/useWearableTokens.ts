import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/useAuthStore'
import { useWearableStore } from '@/stores/useWearableStore'
import type { WearableToken } from '@/types'

/**
 * Loads wearable OAuth tokens for the current user from Supabase.
 * staleTime: 5min — tokens rotate but not every second.
 * Replaces loadWearableTokens() from index.html.
 */
export function useWearableTokens() {
  const authUser = useAuthStore(s => s.authUser)
  const setToken = useWearableStore(s => s.setToken)

  return useQuery({
    queryKey: ['wearable-tokens', authUser?.id],
    queryFn: async () => {
      if (!authUser) return []

      const { data, error } = await supabase
        .from('wearable_tokens')
        .select('provider, access_token, refresh_token, expires_at')
        .eq('user_id', authUser.id)

      if (error) throw error

      const tokens = (data ?? []) as WearableToken[]
      // Sync into Zustand store
      for (const token of tokens) {
        setToken(token.provider, token)
      }
      return tokens
    },
    enabled: !!authUser,
    staleTime: 5 * 60 * 1000,  // 5min — tokens rotate but not per-second
    retry: 1,
  })
}

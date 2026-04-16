import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/useAuthStore'

/**
 * Initialises auth once and subscribes to Supabase auth state changes.
 * staleTime: Infinity — managed by the Supabase listener, not polling.
 */
export function useAuth() {
  const queryClient = useQueryClient()
  const setAuthUser = useAuthStore(s => s.setAuthUser)
  const setAuthSession = useAuthStore(s => s.setAuthSession)

  const query = useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      return data.session
    },
    staleTime: Infinity,  // auth state managed by listener, not refetch
    retry: 0,
  })

  // Sync query result into Zustand store
  useEffect(() => {
    const session = query.data ?? null
    setAuthUser(session?.user ?? null)
    setAuthSession(session)
  }, [query.data, setAuthUser, setAuthSession])

  // Subscribe to auth state changes (sign-in / sign-out / token refresh)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null)
      setAuthSession(session)
      // Invalidate so any component using useAuth() re-reads
      queryClient.setQueryData(['auth'], session)
    })
    return () => subscription.unsubscribe()
  }, [queryClient, setAuthUser, setAuthSession])

  return query
}

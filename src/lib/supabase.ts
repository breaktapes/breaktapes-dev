import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/env'

// Clerk JWT token — updated by AuthGate whenever Clerk auth state changes.
// Injected into every Supabase request so RLS policies read the Clerk user ID
// from the JWT `sub` claim via auth.jwt() ->> 'sub'.
let _clerkToken: string | null = null

export function setClerkToken(token: string | null) {
  _clerkToken = token
}

/** Returns true once a Clerk JWT has been installed into the Supabase client. */
export function hasClerkToken(): boolean {
  return _clerkToken !== null
}

/** Returns the raw Clerk JWT (for use in Worker sync endpoint). */
export function getClerkToken(): string | null {
  return _clerkToken
}

export const supabase = createClient(
  SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_ANON_KEY || 'placeholder-key',
  {
    global: {
      fetch: async (url: RequestInfo | URL, opts: RequestInit = {}) => {
        const headers = new Headers(opts.headers)
        if (_clerkToken) {
          headers.set('Authorization', `Bearer ${_clerkToken}`)
        }
        return fetch(url, { ...opts, headers })
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
)

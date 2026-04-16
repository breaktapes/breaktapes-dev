import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import { IS_STAGING } from '@/env'

export interface AuthState {
  authUser: User | null
  authSession: Session | null
  proAccessGranted: boolean
  setAuthUser: (user: User | null) => void
  setAuthSession: (session: Session | null) => void
  setProAccess: (granted: boolean) => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  authUser: null,
  authSession: null,
  proAccessGranted: IS_STAGING,   // all users get pro access on staging (dev.breaktapes.com)
  setAuthUser: (authUser) => set({ authUser }),
  setAuthSession: (authSession) => set({ authSession }),
  setProAccess: (proAccessGranted) => set({ proAccessGranted }),
}))

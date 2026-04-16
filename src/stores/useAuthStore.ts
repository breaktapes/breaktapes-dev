import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'

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
  proAccessGranted: false,
  setAuthUser: (authUser) => set({ authUser }),
  setAuthSession: (authSession) => set({ authSession }),
  setProAccess: (proAccessGranted) => set({ proAccessGranted }),
}))

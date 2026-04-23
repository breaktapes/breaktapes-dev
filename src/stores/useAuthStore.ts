import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'

export interface AuthState {
  authUser: User | null
  authSession: Session | null
  setAuthUser: (user: User | null) => void
  setAuthSession: (session: Session | null) => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  authUser: null,
  authSession: null,
  setAuthUser: (authUser) => set({ authUser }),
  setAuthSession: (authSession) => set({ authSession }),
}))

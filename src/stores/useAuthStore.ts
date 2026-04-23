import { create } from 'zustand'

// Minimal auth user shape — populated from Clerk's useUser() hook.
// id is the Clerk user ID (e.g. "user_2abc...").
export interface AuthUser {
  id: string
  email?: string | null
}

export interface AuthState {
  authUser: AuthUser | null
  proAccessGranted: boolean
  setAuthUser: (user: AuthUser | null) => void
  setProAccess: (granted: boolean) => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  authUser: null,
  proAccessGranted: false,
  setAuthUser: (authUser) => set({ authUser }),
  setProAccess: (proAccessGranted) => set({ proAccessGranted }),
}))

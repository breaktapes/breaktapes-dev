import { create } from 'zustand'

// Minimal auth user shape — populated from Clerk's useUser() hook.
// id is the Clerk user ID (e.g. "user_2abc...").
export interface AuthUser {
  id: string
  email?: string | null
}

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error'

export interface AuthState {
  authUser: AuthUser | null
  proAccessGranted: boolean
  syncStatus: SyncStatus
  lastSyncAt: number | null
  setAuthUser: (user: AuthUser | null) => void
  setProAccess: (granted: boolean) => void
  setSyncStatus: (status: SyncStatus) => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  authUser: null,
  proAccessGranted: false,
  syncStatus: 'idle',
  lastSyncAt: null,
  setAuthUser: (authUser) => set({ authUser }),
  setProAccess: (proAccessGranted) => set({ proAccessGranted }),
  // Stamp lastSyncAt only on a successful sync; preserve the prior timestamp on
  // 'syncing'/'error'/'idle' so "last synced 2m ago" UI doesn't reset mid-sync.
  setSyncStatus: (syncStatus) => set(s => ({ syncStatus, lastSyncAt: syncStatus === 'ok' ? Date.now() : s.lastSyncAt })),
}))

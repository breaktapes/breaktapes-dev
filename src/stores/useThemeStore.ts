import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ThemeId } from '@/types'
import { THEMES } from '@/types'
import { useAuthStore } from './useAuthStore'

interface ThemeState {
  theme: ThemeId
  setTheme: (id: ThemeId) => boolean  // returns false if pro-gated
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'carbon',
      setTheme: (id: ThemeId) => {
        const themeDef = THEMES.find(t => t.id === id)
        if (themeDef?.comingSoon) return false
        if (themeDef?.pro && !useAuthStore.getState().proAccessGranted) return false
        set({ theme: id })
        return true
      },
    }),
    { name: 'bt_theme' },  // must match existing localStorage key
  ),
)

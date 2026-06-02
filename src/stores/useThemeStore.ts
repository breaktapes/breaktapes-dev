import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ThemeId } from '@/types'
import { THEMES } from '@/types'
interface ThemeState {
  theme: ThemeId
  // Transient (never persisted): force the default Carbon+Chrome look on the
  // marketing landing + logged-out login screen, ignoring the user's saved
  // theme. The saved theme is untouched and returns inside the signed-in app.
  forceDefault: boolean
  setTheme: (id: ThemeId) => boolean
  setForceDefault: (v: boolean) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'carbon',
      forceDefault: false,
      setTheme: (id: ThemeId) => {
        const themeDef = THEMES.find(t => t.id === id)
        if (themeDef?.comingSoon) return false
        set({ theme: id })
        return true
      },
      setForceDefault: (v: boolean) => set({ forceDefault: v }),
    }),
    {
      name: 'bt_theme',  // must match existing localStorage key
      partialize: (s) => ({ theme: s.theme }),  // never persist forceDefault
    },
  ),
)

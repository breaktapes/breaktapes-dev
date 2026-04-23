import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ThemeId } from '@/types'
import { THEMES } from '@/types'
interface ThemeState {
  theme: ThemeId
  setTheme: (id: ThemeId) => boolean
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'carbon',
      setTheme: (id: ThemeId) => {
        const themeDef = THEMES.find(t => t.id === id)
        if (themeDef?.comingSoon) return false
        set({ theme: id })
        return true
      },
    }),
    { name: 'bt_theme' },  // must match existing localStorage key
  ),
)

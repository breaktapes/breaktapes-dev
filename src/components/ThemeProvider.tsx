import { useEffect } from 'react'
import { useThemeStore } from '@/stores/useThemeStore'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore(s => s.theme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'carbon' || !theme) {
      delete root.dataset.theme
    } else {
      root.dataset.theme = theme
    }
  }, [theme])

  return <>{children}</>
}

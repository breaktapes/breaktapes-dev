import { useEffect } from 'react'
import { useThemeStore } from '@/stores/useThemeStore'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore(s => s.theme)
  const forceDefault = useThemeStore(s => s.forceDefault)

  useEffect(() => {
    const root = document.documentElement
    // On the marketing landing + logged-out login screen, force Carbon+Chrome
    // (default) regardless of the user's saved theme.
    const effective = forceDefault ? 'carbon' : theme
    if (effective === 'carbon' || !effective) {
      delete root.dataset.theme
    } else {
      root.dataset.theme = effective
    }
  }, [theme, forceDefault])

  return <>{children}</>
}

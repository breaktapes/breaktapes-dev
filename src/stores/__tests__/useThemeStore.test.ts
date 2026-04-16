import { describe, it, expect, beforeEach } from 'vitest'
import { useThemeStore } from '../useThemeStore'
import { useAuthStore } from '../useAuthStore'

beforeEach(() => {
  useThemeStore.setState({ theme: 'carbon' })
  useAuthStore.setState({ authUser: null, authSession: null, proAccessGranted: false })
  // Reset data-theme attribute
  if (document?.documentElement?.dataset) {
    delete document.documentElement.dataset['theme']
  }
})

describe('useThemeStore — free themes', () => {
  it('carbon (default) is set without pro access', () => {
    const ok = useThemeStore.getState().setTheme('carbon')
    expect(ok).toBe(true)
    expect(useThemeStore.getState().theme).toBe('carbon')
  })

  it('light mode is free', () => {
    const ok = useThemeStore.getState().setTheme('light')
    expect(ok).toBe(true)
    expect(useThemeStore.getState().theme).toBe('light')
  })
})

describe('useThemeStore — pro gate', () => {
  it('deep-space is blocked for non-pro user', () => {
    const ok = useThemeStore.getState().setTheme('deep-space')
    expect(ok).toBe(false)
    expect(useThemeStore.getState().theme).toBe('carbon')  // unchanged
  })

  it('race-night is blocked for non-pro user', () => {
    const ok = useThemeStore.getState().setTheme('race-night')
    expect(ok).toBe(false)
  })

  it('deep-space is allowed for pro user', () => {
    useAuthStore.setState({ proAccessGranted: true })
    const ok = useThemeStore.getState().setTheme('deep-space')
    expect(ok).toBe(true)
    expect(useThemeStore.getState().theme).toBe('deep-space')
  })

  it('all 7 pro themes are blocked without access', () => {
    const proThemes = ['deep-space', 'race-night', 'obsidian', 'acid-track', 'titanium', 'ember', 'polar-circuit'] as const
    for (const id of proThemes) {
      useThemeStore.setState({ theme: 'carbon' })
      const ok = useThemeStore.getState().setTheme(id)
      expect(ok).toBe(false)
      expect(useThemeStore.getState().theme).toBe('carbon')
    }
  })
})

describe('useThemeStore — ThemeProvider applies data-theme', () => {
  it('persists under bt_theme key', () => {
    useThemeStore.getState().setTheme('light')
    const stored = JSON.parse(window.localStorage.getItem('bt_theme') ?? '{}')
    expect(stored?.state?.theme).toBe('light')
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { useThemeStore } from '../useThemeStore'

beforeEach(() => {
  useThemeStore.setState({ theme: 'carbon' })
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

describe('useThemeStore — comingSoon gate', () => {
  it('deep-space is free', () => {
    const ok = useThemeStore.getState().setTheme('deep-space')
    expect(ok).toBe(true)
    expect(useThemeStore.getState().theme).toBe('deep-space')
  })

  it('race-night is free', () => {
    const ok = useThemeStore.getState().setTheme('race-night')
    expect(ok).toBe(true)
    expect(useThemeStore.getState().theme).toBe('race-night')
  })

  it('obsidian is free', () => {
    const ok = useThemeStore.getState().setTheme('obsidian')
    expect(ok).toBe(true)
    expect(useThemeStore.getState().theme).toBe('obsidian')
  })

  // V4 §10b: acid-track / ember / polar-circuit are no longer comingSoon —
  // they ship as Pro themes. Pro gating happens in Settings UI, not the store.
  it('acid-track is settable (Pro, no longer comingSoon)', () => {
    const ok = useThemeStore.getState().setTheme('acid-track')
    expect(ok).toBe(true)
    expect(useThemeStore.getState().theme).toBe('acid-track')
  })

  it('ember is settable (Pro, no longer comingSoon)', () => {
    const ok = useThemeStore.getState().setTheme('ember')
    expect(ok).toBe(true)
  })

  it('polar-circuit is settable (Pro, no longer comingSoon)', () => {
    const ok = useThemeStore.getState().setTheme('polar-circuit')
    expect(ok).toBe(true)
  })
})

describe('useThemeStore — ThemeProvider applies data-theme', () => {
  it('persists under bt_theme key', () => {
    useThemeStore.getState().setTheme('light')
    const stored = JSON.parse(window.localStorage.getItem('bt_theme') ?? '{}')
    expect(stored?.state?.theme).toBe('light')
  })
})

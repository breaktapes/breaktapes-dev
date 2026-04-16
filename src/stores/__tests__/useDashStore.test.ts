import { describe, it, expect, beforeEach } from 'vitest'
import { useDashStore } from '../useDashStore'
import type { DashZoneCollapse } from '@/types'

beforeEach(() => {
  useDashStore.setState({
    widgets: [
      { id: 'athlete-briefing', label: 'Athlete Briefing', icon: '🏃', zone: 'now',      enabled: true  },
      { id: 'race-forecast',    label: 'Race Day Forecast', icon: '🌤', zone: 'now',      enabled: true  },
      { id: 'recent-races',     label: 'Recent Races',      icon: '🏁', zone: 'recently', enabled: true  },
      { id: 'training-streak',  label: 'Training Streak',   icon: '🔥', zone: 'trending', enabled: false },
    ],
    zoneCollapse: { now: false, recently: false, trending: true, context: true },
  })
})

// ---- getDashZoneCollapse -----------------------------------------------

describe('useDashStore — getDashZoneCollapse', () => {
  it('returns default when state is untouched', () => {
    const state = useDashStore.getState().getDashZoneCollapse()
    expect(state.now).toBe(false)       // expanded
    expect(state.recently).toBe(false)  // expanded
    expect(state.trending).toBe(true)   // collapsed
    expect(state.context).toBe(true)    // collapsed
  })

  it('returns default when zoneCollapse is an array (corrupt guard)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useDashStore.setState({ zoneCollapse: [] as any })
    const state = useDashStore.getState().getDashZoneCollapse()
    expect(state.now).toBe(false)
    expect(state.recently).toBe(false)
  })

  it('returns default when zoneCollapse is null', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useDashStore.setState({ zoneCollapse: null as any })
    const state = useDashStore.getState().getDashZoneCollapse()
    expect(state.now).toBe(false)
  })
})

// ---- saveDashZoneCollapse -----------------------------------------------

describe('useDashStore — saveDashZoneCollapse', () => {
  it('persists collapse state', () => {
    const newState: DashZoneCollapse = { now: true, recently: true, trending: false, context: false }
    useDashStore.getState().saveDashZoneCollapse(newState)
    expect(useDashStore.getState().getDashZoneCollapse()).toEqual(newState)
  })

  it('individual zone toggle via setZoneCollapse', () => {
    useDashStore.getState().setZoneCollapse('now', true)
    expect(useDashStore.getState().getDashZoneCollapse().now).toBe(true)
    expect(useDashStore.getState().getDashZoneCollapse().recently).toBe(false)  // unchanged
  })
})

// ---- getDashLayout -----------------------------------------------

describe('useDashStore — getDashLayout', () => {
  it('returns widget array', () => {
    const layout = useDashStore.getState().getDashLayout()
    expect(Array.isArray(layout)).toBe(true)
    expect(layout.length).toBeGreaterThan(0)
  })

  it('each widget has id, enabled, zone', () => {
    const layout = useDashStore.getState().getDashLayout()
    for (const w of layout) {
      expect(typeof w.id).toBe('string')
      expect(typeof w.enabled).toBe('boolean')
      expect(['now', 'recently', 'trending', 'context']).toContain(w.zone)
    }
  })

  it('returns default when widgets is empty (migration guard)', () => {
    useDashStore.setState({ widgets: [] })
    const layout = useDashStore.getState().getDashLayout()
    // falls back to DEFAULT_WIDGETS which has entries
    expect(layout.length).toBeGreaterThan(0)
  })

  it('setWidgetEnabled toggles enabled flag', () => {
    useDashStore.getState().setWidgetEnabled('training-streak', true)
    const w = useDashStore.getState().getDashLayout().find(x => x.id === 'training-streak')
    expect(w?.enabled).toBe(true)
  })

  it('persists under fl2_dash_layout key', () => {
    useDashStore.getState().setWidgetEnabled('recent-races', false)
    const stored = JSON.parse(window.localStorage.getItem('fl2_dash_layout') ?? '{}')
    const widgets = stored?.state?.widgets ?? []
    const w = widgets.find((x: { id: string }) => x.id === 'recent-races')
    expect(w?.enabled).toBe(false)
  })
})

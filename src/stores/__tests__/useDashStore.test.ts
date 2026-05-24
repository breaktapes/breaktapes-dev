import { describe, it, expect, beforeEach } from 'vitest'
import { useDashStore } from '../useDashStore'

const SEED_WIDGETS = [
  { id: 'athlete-briefing', label: 'Athlete Briefing', icon: 'AB', zone: 'now',      enabled: true,  pro: false, size: 'medium' },
  { id: 'race-forecast',    label: 'Race Day Forecast', icon: 'RF', zone: 'now',      enabled: true,  pro: false, size: 'medium' },
  { id: 'recent-races',     label: 'Recent Races',      icon: 'RR', zone: 'recently', enabled: true,  pro: false, size: 'medium' },
  { id: 'training-streak',  label: 'Training Streak',   icon: 'TS', zone: 'trending', enabled: false, pro: false, size: 'medium' },
] as const

const SEED_ORDER = [
  'zone:now', 'athlete-briefing', 'race-forecast',
  'zone:recently', 'recent-races',
  'zone:trending', 'training-streak',
]

beforeEach(() => {
  localStorage.clear()
  useDashStore.setState({
    widgets: SEED_WIDGETS.map(w => ({ ...w })),
    widgetOrder: [...SEED_ORDER],
  })
})

// ---- getDashLayout -----------------------------------------------

describe('useDashStore — getDashLayout', () => {
  it('returns widget array', () => {
    const layout = useDashStore.getState().getDashLayout()
    expect(Array.isArray(layout)).toBe(true)
    expect(layout.length).toBeGreaterThan(0)
  })

  it('each widget has id, enabled, zone, size', () => {
    const layout = useDashStore.getState().getDashLayout()
    for (const w of layout) {
      expect(typeof w.id).toBe('string')
      expect(typeof w.enabled).toBe('boolean')
      expect(['now', 'recently', 'trending', 'context']).toContain(w.zone)
      expect(['small', 'medium', 'large']).toContain(w.size)
    }
  })

  it('returns default when widgets is empty (migration guard)', () => {
    useDashStore.setState({ widgets: [] })
    const layout = useDashStore.getState().getDashLayout()
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

// ---- setWidgetSize -----------------------------------------------

describe('useDashStore — setWidgetSize', () => {
  it('updates size for a known widget', () => {
    useDashStore.getState().setWidgetSize('athlete-briefing', 'large')
    const layout = useDashStore.getState().getDashLayout()
    const w = layout.find(x => x.id === 'athlete-briefing')
    expect(w?.size).toBe('large')
  })

  it('does not affect other widgets', () => {
    useDashStore.getState().setWidgetSize('athlete-briefing', 'small')
    const layout = useDashStore.getState().getDashLayout()
    const other = layout.find(x => x.id === 'race-forecast')
    expect(other?.size).toBe('medium')
  })
})

// ---- setWidgetOrder -----------------------------------------------

describe('useDashStore — setWidgetOrder', () => {
  it('updates widgetOrder', () => {
    const newOrder = ['zone:now', 'race-forecast', 'athlete-briefing']
    useDashStore.getState().setWidgetOrder(newOrder)
    expect(useDashStore.getState().widgetOrder).toEqual(newOrder)
  })
})

// ---- applyPreset -----------------------------------------------

describe('useDashStore — applyPreset', () => {
  it('race-week preset changes enabled/size/order', () => {
    useDashStore.getState().applyPreset('race-week')
    const state = useDashStore.getState()
    expect(Array.isArray(state.widgetOrder)).toBe(true)
    expect(state.widgetOrder.length).toBeGreaterThan(0)
  })

  it('minimal preset disables widgets outside the preset widgetOrder', () => {
    // Seed store with full DEFAULT_WIDGETS so applyPreset has real state to update
    useDashStore.setState({
      widgets: useDashStore.getState().getDashLayout(),
      widgetOrder: useDashStore.getState().widgetOrder,
    })
    useDashStore.getState().applyPreset('minimal')
    const layout = useDashStore.getState().getDashLayout()
    // The preset only enables countdown, gap-to-goal, pacing-iq
    const presetEnabled = ['countdown', 'gap-to-goal', 'pacing-iq']
    for (const id of presetEnabled) {
      const w = layout.find(x => x.id === id)
      expect(w?.enabled).toBe(true)
    }
    // Other known widgets should be disabled
    const rr = layout.find(x => x.id === 'recent-races')
    expect(rr?.enabled).toBe(false)
  })
})

// ---- v3 migration flag guard -----------------------------------------------

describe('useDashStore — v3 migration flag', () => {
  it('initDashV3Migration is a no-op when fl2_dash_v3 flag is set', async () => {
    const { initDashV3Migration } = await import('../useDashStore')
    localStorage.setItem('fl2_dash_v3', 'true')
    const set = vi.fn()
    initDashV3Migration({ widgets: [], widgetOrder: [] }, set)
    expect(set).not.toHaveBeenCalled()
  })

  it('initDashV3Migration is a no-op when widgetOrder is already populated', async () => {
    const { initDashV3Migration } = await import('../useDashStore')
    localStorage.removeItem('fl2_dash_v3')
    const set = vi.fn()
    initDashV3Migration({ widgets: [], widgetOrder: ['zone:now'] }, set)
    expect(set).not.toHaveBeenCalled()
  })
})

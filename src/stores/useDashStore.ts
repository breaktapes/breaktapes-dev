import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DashWidget, WidgetSize } from '@/types'

// Default widget configuration — zones: now, recently, trending, context
const DEFAULT_WIDGETS: DashWidget[] = [
  // NOW — RACE CONTEXT
  { id: 'stats-strip',       label: 'Career Stats',             icon: '',    zone: 'now',      enabled: true,  pro: false, size: 'medium' },
  { id: 'countdown',         label: 'Next Race Countdown',      icon: 'CD',  zone: 'now',      enabled: true,  pro: false, size: 'large'  },
  { id: 'race-readiness',    label: 'Race Readiness',           icon: 'RDY', zone: 'now',      enabled: true,  pro: false, size: 'medium' },
  { id: 'gap-to-goal',       label: 'Gap To Goal',              icon: 'GTG', zone: 'now',      enabled: true,  pro: false, size: 'medium' },
  { id: 'course-fit',        label: 'Course Fit Score',         icon: 'FIT', zone: 'now',      enabled: true,  pro: false, size: 'medium' },
  { id: 'pb-probability',    label: 'PB Probability',           icon: 'PBP', zone: 'now',      enabled: true,  pro: false, size: 'medium' },
  { id: 'on-this-day',       label: 'On This Day',              icon: 'OTD', zone: 'now',      enabled: true,  pro: false, size: 'small'  },
  { id: 'goal-pace',         label: 'Goal Pace Breakdown',      icon: 'PCE', zone: 'now',      enabled: true,  pro: false, size: 'medium' },
  // RECENTLY — YOUR RACING
  { id: 'recent-races',      label: 'Recent Races',             icon: 'RC',  zone: 'recently', enabled: true,  pro: false, size: 'small'  },
  { id: 'personal-bests',    label: 'Personal Bests',           icon: 'PB',  zone: 'recently', enabled: true,  pro: false, size: 'large'  },
  { id: 'riegel-predictor',  label: 'Race Predictor',           icon: 'RGL', zone: 'recently', enabled: true,  pro: false, size: 'small'  },
  // CONSISTENCY — BUILD
  { id: 'season-planner',    label: 'Season Planner',           icon: 'SP',  zone: 'trending', enabled: true,  pro: false, size: 'medium' },
  // PATTERNS — ANALYSIS
  { id: 'boston-qual',       label: 'Boston Qualifier',         icon: 'BQ',  zone: 'context',  enabled: true,  pro: false, size: 'medium' },
  { id: 'pacing-iq',         label: 'Pacing IQ',                icon: 'IQ',  zone: 'context',  enabled: true,  pro: false, size: 'medium' },
  { id: 'career-momentum',   label: 'Career Momentum',          icon: 'MOM', zone: 'context',  enabled: true,  pro: false, size: 'medium' },
  { id: 'age-grade',         label: 'Age-Grade Score',          icon: 'AG%', zone: 'context',  enabled: true,  pro: false, size: 'medium' },
  { id: 'race-dna',          label: 'Race DNA',                 icon: 'DNA', zone: 'context',  enabled: true,  pro: false, size: 'medium' },
  { id: 'pressure-performer',label: 'Pressure Performer',       icon: 'PRS', zone: 'context',  enabled: true,  pro: false, size: 'medium' },
  { id: 'travel-load',       label: 'Travel Load',              icon: 'TRV', zone: 'context',  enabled: true,  pro: false, size: 'medium' },
  { id: 'pattern-scan',      label: 'Pattern Scan',             icon: 'PTN', zone: 'context',  enabled: true,  pro: false, size: 'medium' },
  { id: 'distance-milestones',label: 'Distance Milestones',     icon: 'MI',  zone: 'context',  enabled: true,  pro: false, size: 'medium' },
  { id: 'course-repeats',    label: 'Course Repeats',           icon: 'RPT', zone: 'context',  enabled: true,  pro: false, size: 'medium' },
  // DISABLED — available to enable
  { id: 'race-comparer',     label: 'Race Comparer',            icon: 'CMP', zone: 'context',  enabled: false, pro: false, size: 'medium' },
  { id: 'what-to-race-next', label: 'What To Race Next',        icon: 'WTR', zone: 'context',  enabled: false, pro: false, size: 'medium' },
]

// Fixed-size widgets — no size picker shown in customize modal
export const FIXED_SIZE_WIDGETS = new Set(['countdown', 'stats-strip'])

// Which sizes each widget supports
export const WIDGET_SIZES: Record<string, WidgetSize[]> = {
  // Fixed (no resize)
  'countdown':           ['large'],
  'stats-strip':         ['medium'],
  // small + medium + large
  'race-readiness':      ['small', 'medium', 'large'],
  'gap-to-goal':         ['small', 'medium', 'large'],
  'course-fit':          ['small', 'medium'],
  'personal-bests':      ['small', 'medium', 'large'],
  'riegel-predictor':    ['small', 'medium'],
  'boston-qual':         ['small', 'medium', 'large'],
  'age-grade':           ['small', 'medium', 'large'],
  'race-dna':            ['small', 'medium', 'large'],
  'pattern-scan':        ['small', 'medium', 'large'],
  'goal-pace':           ['small', 'medium', 'large'],
  'distance-milestones': ['small', 'medium', 'large'],
  'course-repeats':      ['small', 'medium', 'large'],
  'recent-races':        ['small', 'medium'],
  'what-to-race-next':   ['small', 'medium', 'large'],
  // small + medium only
  'pb-probability':      ['small', 'medium'],
  'on-this-day':         ['small', 'medium'],
  'pacing-iq':           ['small', 'medium'],
  'career-momentum':     ['small', 'medium'],
  'pressure-performer':  ['small', 'medium'],
  'travel-load':         ['small', 'medium'],
  // medium + large only
  'season-planner':      ['medium', 'large'],
  // medium only
  'race-comparer':       ['medium'],
}

export function getWidgetSizes(id: string): WidgetSize[] {
  return WIDGET_SIZES[id] ?? ['medium']
}

// Hardcoded presets
const PRESETS: Record<string, { widgetOrder: string[]; sizes: Partial<Record<string, WidgetSize>> }> = {
  'race-week': {
    widgetOrder: ['zone:now', 'countdown', 'gap-to-goal', 'pb-probability', 'race-readiness'],
    sizes: { countdown: 'large', 'gap-to-goal': 'medium', 'pb-probability': 'small', 'race-readiness': 'medium' },
  },
  'off-season': {
    widgetOrder: ['zone:recently', 'recent-races', 'personal-bests', 'zone:context', 'career-momentum', 'age-grade', 'race-dna', 'pattern-scan'],
    sizes: { 'recent-races': 'medium', 'personal-bests': 'large', 'career-momentum': 'small', 'age-grade': 'small', 'race-dna': 'medium', 'pattern-scan': 'large' },
  },
  'minimal': {
    widgetOrder: ['zone:now', 'countdown', 'gap-to-goal', 'pacing-iq'],
    sizes: { countdown: 'large', 'gap-to-goal': 'small', 'pacing-iq': 'small' },
  },
}

// Build the default widget order from zone-grouped DEFAULT_WIDGETS
export function buildDefaultWidgetOrder(): string[] {
  const zones: Array<'now' | 'recently' | 'trending' | 'context'> = ['now', 'recently', 'trending', 'context']
  const order: string[] = []
  for (const zone of zones) {
    order.push(`zone:${zone}`)
    DEFAULT_WIDGETS.filter(w => w.zone === zone).forEach(w => order.push(w.id))
  }
  return order
}

// Set of IDs that were removed — used to purge stale persisted data
const REMOVED_WIDGET_IDS = new Set([
  'race-forecast', 'race-prediction', 'weather-fit', 'race-stack',
  'why-prd', 'why-faded', 'break-tape', 'streak-risk', 'race-density',
  'race-gap-analysis', 'adaptive-goals', 'why-result', 'advanced-race-dna',
  'coach-activity', 'equiv-perf', 'story-mode', 'recovery-intel',
  'surface-profile', 'best-conditions', 'weather-impact', 'upcoming-density',
  'vdot-score',
])

// Migration v3: run once outside getDashLayout — call from store create() or App useEffect
export function initDashV3Migration(
  stored: { widgets: DashWidget[]; widgetOrder: string[] },
  set: (state: Partial<{ widgets: DashWidget[]; widgetOrder: string[] }>) => void,
) {
  if (typeof window === 'undefined') return
  if (localStorage.getItem('fl2_dash_v3') === 'true') return
  // Only run if widgetOrder is absent/empty (first time after upgrade)
  if (stored.widgetOrder && stored.widgetOrder.length > 0) {
    localStorage.setItem('fl2_dash_v3', 'true')
    return
  }

  const defaultIds = new Set(DEFAULT_WIDGETS.map(w => w.id))

  const migratedWidgets: DashWidget[] = (stored.widgets ?? [])
    .filter(w => defaultIds.has(w.id))
    .map(w => ({ ...w, size: w.size ?? 'medium' }))

  const widgetOrder = buildDefaultWidgetOrder()
  set({ widgets: migratedWidgets, widgetOrder })
  localStorage.setItem('fl2_dash_v3', 'true')
}

export interface DashState {
  widgets: DashWidget[]
  widgetOrder: string[]
  /** Pure read — computes merged layout WITHOUT touching state. Safe to call in render/useMemo. */
  getDashLayout: () => DashWidget[]
  /** Write — purges removed IDs, adds new defaults, clamps sizes. Call from useEffect on mount only. */
  initDashLayout: () => void
  setWidgetEnabled: (id: string, enabled: boolean) => void
  setWidgetSize: (id: string, size: WidgetSize) => void
  setWidgetOrder: (newOrder: string[]) => void
  applyPreset: (presetId: 'race-week' | 'off-season' | 'minimal') => void
  enableAllWidgets: () => void
}

export const useDashStore = create<DashState>()(
  persist(
    (set, get) => ({
      widgets: DEFAULT_WIDGETS,
      widgetOrder: buildDefaultWidgetOrder(),

      // Pure read — safe to call in render/useMemo. Never calls set().
      getDashLayout: () => {
        const { widgets, widgetOrder } = get()
        if (!Array.isArray(widgets) || widgets.length === 0 || typeof widgets[0] !== 'object') {
          return DEFAULT_WIDGETS
        }
        const activeWidgets = widgets.filter((w: DashWidget) => !REMOVED_WIDGET_IDS.has(w.id))
        const storedIds = new Set(activeWidgets.map((w: DashWidget) => w.id))
        const newDefaults = DEFAULT_WIDGETS.filter(w => !storedIds.has(w.id))
        const base = newDefaults.length > 0 ? [...activeWidgets, ...newDefaults] : activeWidgets
        const clamped = base.map((w: DashWidget) => {
          const withSize = { ...w, size: w.size ?? 'medium' } as DashWidget
          const allowed = WIDGET_SIZES[w.id]
          if (allowed && !allowed.includes(withSize.size)) {
            return { ...withSize, size: allowed[0] }
          }
          return withSize
        })
        // Suppress widgetOrder warning — reads only
        void widgetOrder
        return clamped
      },

      // Write — purges removed IDs, merges new defaults, clamps sizes. Call from useEffect on mount only.
      initDashLayout: () => {
        const { widgets, widgetOrder } = get()
        if (!Array.isArray(widgets) || widgets.length === 0 || typeof widgets[0] !== 'object') {
          set({ widgets: DEFAULT_WIDGETS, widgetOrder: buildDefaultWidgetOrder() })
          return
        }
        const activeWidgets = widgets.filter((w: DashWidget) => !REMOVED_WIDGET_IDS.has(w.id))
        const storedIds = new Set(activeWidgets.map((w: DashWidget) => w.id))
        const newDefaults = DEFAULT_WIDGETS.filter(w => !storedIds.has(w.id))
        const base = newDefaults.length > 0 ? [...activeWidgets, ...newDefaults] : activeWidgets
        const clamped = base.map((w: DashWidget) => {
          const withSize = { ...w, size: w.size ?? 'medium' } as DashWidget
          const allowed = WIDGET_SIZES[w.id]
          if (allowed && !allowed.includes(withSize.size)) {
            return { ...withSize, size: allowed[0] }
          }
          return withSize
        })
        let currentOrder = Array.isArray(widgetOrder) && widgetOrder.length > 0
          ? widgetOrder.filter((id: string) => !REMOVED_WIDGET_IDS.has(id))
          : buildDefaultWidgetOrder()
        if (newDefaults.length > 0) {
          const updatedOrder = [...currentOrder]
          for (const w of newDefaults) {
            const zoneHeader = `zone:${w.zone}`
            const headerIdx = updatedOrder.indexOf(zoneHeader)
            const insertBefore = updatedOrder.findIndex((id, i) => i > headerIdx && id.startsWith('zone:'))
            if (insertBefore === -1) updatedOrder.push(w.id)
            else updatedOrder.splice(insertBefore, 0, w.id)
          }
          currentOrder = updatedOrder
        }
        const orderChanged = currentOrder.length !== widgetOrder?.length ||
          currentOrder.some((id, i) => id !== widgetOrder?.[i])
        const widgetsChanged = clamped.length !== widgets.length ||
          clamped.some((w, i) => w.id !== widgets[i]?.id || w.size !== widgets[i]?.size)
        if (widgetsChanged || orderChanged) {
          set({ widgets: clamped, widgetOrder: currentOrder })
        }
      },

      setWidgetEnabled: (id, enabled) =>
        set(s => {
          const exists = s.widgets.some(w => w.id === id)
          if (exists) {
            return { widgets: s.widgets.map(w => w.id === id ? { ...w, enabled } : w) }
          }
          const def = DEFAULT_WIDGETS.find(w => w.id === id)
          if (!def) return {}
          const order = [...s.widgetOrder]
          if (!order.includes(id)) {
            const zoneHeader = `zone:${def.zone}`
            if (!order.includes(zoneHeader)) order.push(zoneHeader)
            const headerIdx = order.indexOf(zoneHeader)
            const nextZone = order.findIndex((oid, i) => i > headerIdx && oid.startsWith('zone:'))
            if (nextZone === -1) order.push(id)
            else order.splice(nextZone, 0, id)
          }
          return { widgets: [...s.widgets, { ...def, enabled }], widgetOrder: order }
        }),

      setWidgetSize: (id, size) =>
        set(s => ({
          widgets: s.widgets.map(w => w.id === id ? { ...w, size } : w),
        })),

      setWidgetOrder: (newOrder) => set({ widgetOrder: newOrder }),

      applyPreset: (presetId) =>
        set(s => {
          const preset = PRESETS[presetId]
          if (!preset) return {}
          const presetWidgetIds = new Set(
            preset.widgetOrder.filter(id => !id.startsWith('zone:'))
          )
          const updatedWidgets = s.widgets.map(w => {
            if (presetWidgetIds.has(w.id)) {
              return { ...w, enabled: true, size: preset.sizes[w.id] ?? 'medium' }
            }
            return { ...w, enabled: false, size: 'medium' as WidgetSize }
          })
          return { widgets: updatedWidgets, widgetOrder: preset.widgetOrder }
        }),

      enableAllWidgets: () =>
        set(s => {
          const allIds = new Set(DEFAULT_WIDGETS.map(w => w.id))
          const storedIds = new Set(s.widgets.map(w => w.id))
          const newDefaults = DEFAULT_WIDGETS.filter(w => !storedIds.has(w.id))
          const updatedWidgets = [
            ...s.widgets.map(w => ({ ...w, enabled: true })),
            ...newDefaults.map(w => ({ ...w, enabled: true })),
          ].filter(w => allIds.has(w.id))
          const widgetOrder = buildDefaultWidgetOrder()
          return { widgets: updatedWidgets, widgetOrder }
        }),
    }),
    { name: 'fl2_dash_layout' },
  ),
)

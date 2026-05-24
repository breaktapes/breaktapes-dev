import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DashWidget, WidgetSize } from '@/types'

// Default widget configuration — zones: now, recently, trending, context
const DEFAULT_WIDGETS: DashWidget[] = [
  // NOW — RACE CONTEXT
  { id: 'stats-strip',      label: 'Career Stats',              icon: 'STS', zone: 'now',      enabled: true,  pro: false, size: 'medium' },
  { id: 'countdown',        label: 'Next Race Countdown',       icon: 'CD',  zone: 'now',      enabled: true,  pro: false, size: 'large'  },
  { id: 'race-forecast',    label: 'Race Day Forecast',         icon: 'WX',  zone: 'now',      enabled: false, pro: false, size: 'medium' },
  { id: 'race-prediction',  label: 'Race Prediction',           icon: 'PRD', zone: 'now',      enabled: false, pro: false, size: 'medium' },
  { id: 'race-readiness',   label: 'Race Readiness Score',      icon: 'RDY', zone: 'now',      enabled: true,  pro: false, size: 'medium' },
  { id: 'gap-to-goal',      label: 'Gap To Goal',               icon: 'GTG', zone: 'now',      enabled: true,  pro: false, size: 'medium' },
  { id: 'course-fit',       label: 'Course Fit Score',          icon: 'FIT', zone: 'now',      enabled: true,  pro: false, size: 'medium' },
  { id: 'pb-probability',   label: 'PB Probability',            icon: 'PBP', zone: 'now',      enabled: true,  pro: false, size: 'medium' },
  { id: 'weather-fit',      label: 'Weather Fit Score',         icon: 'WX',  zone: 'now',      enabled: false, pro: false, size: 'medium' },
  { id: 'race-stack',       label: 'Race Stack Planner',        icon: 'STK', zone: 'now',      enabled: false, pro: false, size: 'medium' },
  { id: 'on-this-day',      label: 'On This Day',               icon: 'OTD', zone: 'now',      enabled: true,  pro: false, size: 'medium' },
  // RECENTLY — YOUR RACING
  { id: 'recent-races',     label: 'Recent Races',              icon: 'RC',  zone: 'recently', enabled: true,  pro: false, size: 'small'  },
  { id: 'personal-bests',   label: 'Personal Bests',            icon: 'PB',  zone: 'recently', enabled: true,  pro: false, size: 'small'  },
  { id: 'why-prd',          label: "Why You PR'd",              icon: 'PR',  zone: 'recently', enabled: false, pro: false, size: 'small'  },
  { id: 'why-faded',        label: 'Why You Faded',             icon: 'FD',  zone: 'recently', enabled: false, pro: false, size: 'small'  },
  { id: 'break-tape',       label: 'Break Tape Moments',        icon: 'BT',  zone: 'recently', enabled: false, pro: false, size: 'small'  },
  // CONSISTENCY — BUILD
  { id: 'season-planner',   label: 'Season Planner',            icon: 'SP',  zone: 'trending', enabled: true,  pro: false, size: 'medium' },
  { id: 'recovery-intel',   label: 'Recovery Intelligence',     icon: 'REC', zone: 'trending', enabled: true,  pro: false, size: 'medium' },
  { id: 'race-density',     label: 'Race Density',              icon: 'DNS', zone: 'trending', enabled: true,  pro: false, size: 'medium' },
  { id: 'streak-risk',      label: 'Streak Risk',               icon: 'STR', zone: 'trending', enabled: true,  pro: false, size: 'medium' },
  { id: 'race-gap-analysis',label: 'Race Gap / Recovery',       icon: 'GAP', zone: 'trending', enabled: false, pro: false, size: 'medium' },
  { id: 'adaptive-goals',   label: 'Adaptive Goals',            icon: 'AG',  zone: 'trending', enabled: false, pro: false, size: 'medium' },
  // PATTERNS — ANALYSIS
  { id: 'boston-qual',      label: 'Boston Qualifier',          icon: 'BQ',  zone: 'context',  enabled: true,  pro: false, size: 'medium' },
  { id: 'pacing-iq',        label: 'Pacing IQ',                 icon: 'IQ',  zone: 'context',  enabled: true,  pro: false, size: 'medium' },
  { id: 'career-momentum',  label: 'Career Momentum',           icon: 'MOM', zone: 'context',  enabled: true,  pro: false, size: 'medium' },
  { id: 'age-grade',        label: 'Age-Grade Score',           icon: 'AG%', zone: 'context',  enabled: true,  pro: false, size: 'medium' },
  { id: 'race-dna',         label: 'Race DNA',                  icon: 'DNA', zone: 'context',  enabled: true,  pro: false, size: 'medium' },
  { id: 'surface-profile',  label: 'Surface Profile',           icon: 'SRF', zone: 'context',  enabled: true,  pro: false, size: 'medium' },
  { id: 'pressure-performer',label: 'Pressure Performer',       icon: 'PRS', zone: 'context',  enabled: true,  pro: false, size: 'medium' },
  { id: 'travel-load',      label: 'Travel Load',               icon: 'TRV', zone: 'context',  enabled: true,  pro: false, size: 'medium' },
  { id: 'best-conditions',  label: 'Best Conditions',           icon: 'BCS', zone: 'context',  enabled: true,  pro: false, size: 'medium' },
  { id: 'pattern-scan',     label: 'Pattern Scan',              icon: 'PTN', zone: 'context',  enabled: true,  pro: false, size: 'medium' },
  { id: 'why-result',       label: 'Why Result',                icon: 'WHY', zone: 'context',  enabled: false, pro: false, size: 'medium' },
  { id: 'advanced-race-dna',label: 'Advanced Race DNA',         icon: 'DNA', zone: 'context',  enabled: false, pro: false, size: 'medium' },
  { id: 'race-comparer',    label: 'Race Comparer',             icon: 'CMP', zone: 'context',  enabled: false, pro: false, size: 'medium' },
  { id: 'what-to-race-next',label: 'What To Race Next',         icon: 'WTR', zone: 'context',  enabled: false, pro: false, size: 'medium' },
  { id: 'story-mode',       label: 'Story Mode',                icon: 'STY', zone: 'recently', enabled: true,  pro: false, size: 'small'  },
  { id: 'coach-activity',   label: 'Coach Activity',            icon: 'CCH', zone: 'context',  enabled: false, pro: false, size: 'medium' },
  // Day 2 formula widgets
  { id: 'riegel-predictor', label: 'Race Predictor (Riegel)',   icon: 'RGL', zone: 'recently', enabled: true,  pro: false, size: 'small'  },
  { id: 'vdot-score',       label: 'VDOT Fitness Score',        icon: 'VDT', zone: 'context',  enabled: true,  pro: false, size: 'medium' },
  { id: 'goal-pace',        label: 'Goal Pace Breakdown',       icon: 'PCE', zone: 'now',      enabled: true,  pro: false, size: 'medium' },
  { id: 'weather-impact',   label: 'Weather Impact Score',      icon: 'WX',  zone: 'recently', enabled: true,  pro: false, size: 'small'  },
  { id: 'distance-milestones', label: 'Distance Milestones',    icon: 'MI',  zone: 'context',  enabled: true,  pro: false, size: 'medium' },
  // Day 3 formula widgets
  { id: 'equiv-perf',       label: 'Equivalent Performances',   icon: 'EQV', zone: 'context',  enabled: false, pro: false, size: 'medium' },
  { id: 'upcoming-density', label: 'Race Conflict Checker',     icon: 'CHK', zone: 'trending', enabled: true,  pro: false, size: 'medium' },
  { id: 'course-repeats',   label: 'Course Repeats',            icon: 'RPT', zone: 'context',  enabled: true,  pro: false, size: 'medium' },
]

const STRAVA_PENDING = new Set<string>()

// Which sizes each widget supports
export const WIDGET_SIZES: Record<string, WidgetSize[]> = {
  // large only
  'countdown':           ['large'],
  // medium only (structural)
  'stats-strip':         ['medium'],
  // small + medium + large (17)
  'race-forecast':       ['small', 'medium', 'large'],
  'goal-pace':           ['small', 'medium', 'large'],
  'gap-to-goal':         ['small', 'medium', 'large'],
  'pb-probability':      ['small', 'medium', 'large'],
  'race-readiness':      ['small', 'medium', 'large'],
  'course-fit':          ['small', 'medium', 'large'],
  'boston-qual':         ['small', 'medium', 'large'],
  'pacing-iq':           ['small', 'medium', 'large'],
  'career-momentum':     ['small', 'medium', 'large'],
  'age-grade':           ['small', 'medium', 'large'],
  'vdot-score':          ['small', 'medium', 'large'],
  'recovery-intel':      ['small', 'medium', 'large'],
  'streak-risk':         ['small', 'medium', 'large'],
  'on-this-day':         ['small', 'medium', 'large'],
  'weather-fit':         ['small', 'medium', 'large'],
  'distance-milestones': ['small', 'medium', 'large'],
  'race-prediction':     ['small', 'medium'],
  'race-stack':          ['small', 'medium'],
  // medium + large
  'race-dna':            ['medium', 'large'],
  'pattern-scan':        ['medium', 'large'],
  'season-planner':      ['medium', 'large'],
  'race-density':        ['medium', 'large'],
  'upcoming-density':    ['medium', 'large'],
  'equiv-perf':          ['medium', 'large'],
  'advanced-race-dna':   ['medium', 'large'],
  // small + medium + large (recently zone)
  'recent-races':        ['small', 'medium', 'large'],
  'personal-bests':      ['small', 'medium', 'large'],
  'riegel-predictor':    ['small', 'medium', 'large'],
  'weather-impact':      ['small', 'medium', 'large'],
  // small + medium (recently zone)
  'story-mode':          ['small', 'medium'],
  'why-prd':             ['small', 'medium'],
  'why-faded':           ['small', 'medium'],
  'break-tape':          ['small', 'medium'],
  // medium only
  'why-result':          ['medium'],
  'surface-profile':     ['medium'],
  'pressure-performer':  ['medium'],
  'travel-load':         ['medium'],
  'best-conditions':     ['medium'],
  'race-gap-analysis':   ['medium'],
  'adaptive-goals':      ['medium'],
  'course-repeats':      ['medium'],
  'race-comparer':       ['medium'],
  'what-to-race-next':   ['medium'],
  'coach-activity':      ['medium'],
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
function buildDefaultWidgetOrder(): string[] {
  const zones: Array<'now' | 'recently' | 'trending' | 'context'> = ['now', 'recently', 'trending', 'context']
  const order: string[] = []
  for (const zone of zones) {
    order.push(`zone:${zone}`)
    DEFAULT_WIDGETS.filter(w => w.zone === zone).forEach(w => order.push(w.id))
  }
  return order
}

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

  // Assign size: 'medium' to all existing widgets; filter orphaned IDs
  const migratedWidgets: DashWidget[] = (stored.widgets ?? [])
    .filter(w => defaultIds.has(w.id))
    .map(w => ({ ...w, size: w.size ?? 'medium' }))

  // Build widgetOrder from zone-grouped widgets
  const widgetOrder = buildDefaultWidgetOrder()

  set({ widgets: migratedWidgets, widgetOrder })
  localStorage.setItem('fl2_dash_v3', 'true')
}

export interface DashState {
  widgets: DashWidget[]
  widgetOrder: string[]
  getDashLayout: () => DashWidget[]
  setWidgetEnabled: (id: string, enabled: boolean) => void
  setWidgetSize: (id: string, size: WidgetSize) => void
  setWidgetOrder: (newOrder: string[]) => void
  applyPreset: (presetId: 'race-week' | 'off-season' | 'minimal') => void
}

export const useDashStore = create<DashState>()(
  persist(
    (set, get) => ({
      widgets: DEFAULT_WIDGETS,
      widgetOrder: buildDefaultWidgetOrder(),

      getDashLayout: () => {
        const { widgets, widgetOrder } = get()
        if (!Array.isArray(widgets) || widgets.length === 0 || typeof widgets[0] !== 'object') {
          set({ widgets: DEFAULT_WIDGETS, widgetOrder: buildDefaultWidgetOrder() })
          return DEFAULT_WIDGETS
        }

        const storedIds = new Set(widgets.map((w: DashWidget) => w.id))
        const newDefaults = DEFAULT_WIDGETS.filter(w => !storedIds.has(w.id))

        // Force Strava-pending off; ensure size field present
        const base = newDefaults.length > 0 ? [...widgets, ...newDefaults] : widgets
        const merged = base.map((w: DashWidget) => ({
          ...w,
          size: w.size ?? 'medium',
          enabled: STRAVA_PENDING.has(w.id) ? false : w.enabled,
        }))

        // Insert new widget IDs into widgetOrder immediately before next zone header of their zone
        let currentOrder = Array.isArray(widgetOrder) && widgetOrder.length > 0
          ? widgetOrder
          : buildDefaultWidgetOrder()

        if (newDefaults.length > 0) {
          const updatedOrder = [...currentOrder]
          for (const w of newDefaults) {
            const zoneHeader = `zone:${w.zone}`
            // Find the next zone header after this zone's header
            const headerIdx = updatedOrder.indexOf(zoneHeader)
            const insertBefore = updatedOrder.findIndex((id, i) => i > headerIdx && id.startsWith('zone:'))
            if (insertBefore === -1) {
              updatedOrder.push(w.id)
            } else {
              updatedOrder.splice(insertBefore, 0, w.id)
            }
          }
          currentOrder = updatedOrder
        }

        const changed = merged.some((w: DashWidget, i: number) => w.enabled !== base[i]?.enabled || w.size !== base[i]?.size)
        if (newDefaults.length > 0 || changed || currentOrder !== widgetOrder) {
          set({ widgets: merged, widgetOrder: currentOrder })
        }
        return merged
      },

      setWidgetEnabled: (id, enabled) =>
        set(s => {
          const exists = s.widgets.some(w => w.id === id)
          if (exists) {
            return { widgets: s.widgets.map(w => w.id === id ? { ...w, enabled } : w) }
          }
          const def = DEFAULT_WIDGETS.find(w => w.id === id)
          if (!def) return {}
          // When enabling a new widget, ensure its zone header is in widgetOrder
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
    }),
    { name: 'fl2_dash_layout' },
  ),
)

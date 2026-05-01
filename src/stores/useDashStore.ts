import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DashWidget, DashZoneCollapse } from '@/types'

// Default widget configuration — zones: now, recently, trending, context
const DEFAULT_WIDGETS: DashWidget[] = [
  // NOW — RACE CONTEXT
  { id: 'countdown',        label: 'Next Race Countdown',       icon: 'CD', zone: 'now',      enabled: true,  pro: false },
  { id: 'race-forecast',    label: 'Race Day Forecast',         icon: 'WX', zone: 'now',      enabled: true,  pro: true  },
  { id: 'race-prediction',  label: 'Race Prediction',           icon: 'PRD', zone: 'now',     enabled: false, pro: true  },
  { id: 'race-readiness',   label: 'Race Readiness Score',      icon: 'RDY', zone: 'now',     enabled: true,  pro: false },
  { id: 'gap-to-goal',      label: 'Gap To Goal',               icon: 'GTG', zone: 'now',     enabled: true,  pro: false },
  { id: 'course-fit',       label: 'Course Fit Score',          icon: 'FIT', zone: 'now',     enabled: true,  pro: false },
  { id: 'pb-probability',   label: 'PB Probability',            icon: 'PBP', zone: 'now',     enabled: true,  pro: false },
  { id: 'weather-fit',      label: 'Weather Fit Score',         icon: 'WX', zone: 'now',      enabled: false, pro: true  },
  { id: 'race-stack',       label: 'Race Stack Planner',        icon: 'STK', zone: 'now',     enabled: false, pro: true  },
  { id: 'on-this-day',      label: 'On This Day',               icon: 'OTD', zone: 'now',     enabled: true,  pro: false },
  // RECENTLY — YOUR RACING
  { id: 'recent-races',     label: 'Recent Races',              icon: 'RC', zone: 'recently', enabled: true,  pro: false },
  { id: 'activity-preview', label: 'Activity Feed Preview',     icon: 'ACT', zone: 'recently',enabled: true,  pro: false },
  { id: 'personal-bests',   label: 'Personal Bests',            icon: 'PB', zone: 'recently', enabled: true,  pro: false },
  { id: 'why-prd',          label: "Why You PR'd",              icon: 'PR', zone: 'recently', enabled: false, pro: true  },
  { id: 'why-faded',        label: 'Why You Faded',             icon: 'FD', zone: 'recently', enabled: false, pro: true  },
  { id: 'break-tape',       label: 'Break Tape Moments',        icon: 'BT', zone: 'recently', enabled: false, pro: true  },
  // CONSISTENCY — BUILD
  { id: 'season-planner',   label: 'Season Planner',            icon: 'SP', zone: 'trending', enabled: true,  pro: false },
  { id: 'recovery-intel',   label: 'Recovery Intelligence',     icon: 'REC', zone: 'trending',enabled: true,  pro: false },
  { id: 'race-density',     label: 'Race Density',              icon: 'DNS', zone: 'trending', enabled: true,  pro: false },
  { id: 'streak-risk',      label: 'Streak Risk',               icon: 'STR', zone: 'trending',enabled: true,  pro: false },
  { id: 'training-correl',  label: 'Training Correlation',      icon: 'TRN', zone: 'trending',enabled: true,  pro: true  },
  { id: 'race-gap-analysis',label: 'Race Gap / Recovery',       icon: 'GAP', zone: 'trending',enabled: false, pro: true  },
  { id: 'adaptive-goals',   label: 'Adaptive Goals',            icon: 'AG', zone: 'trending', enabled: false, pro: true  },
  // PATTERNS — ANALYSIS
  { id: 'boston-qual',      label: 'Boston Qualifier',          icon: 'BQ', zone: 'context',  enabled: true,  pro: false },
  { id: 'pacing-iq',        label: 'Pacing IQ',                 icon: 'IQ', zone: 'context',  enabled: true,  pro: false },
  { id: 'career-momentum',  label: 'Career Momentum',           icon: 'MOM', zone: 'context', enabled: true,  pro: false },
  { id: 'age-grade',        label: 'Age-Grade Score',           icon: 'AG%', zone: 'context', enabled: true,  pro: false },
  { id: 'race-dna',         label: 'Race DNA',                  icon: 'DNA', zone: 'context', enabled: true,  pro: false },
  { id: 'surface-profile',  label: 'Surface Profile',           icon: 'SRF', zone: 'context', enabled: true,  pro: false },
  { id: 'pressure-performer',label: 'Pressure Performer',       icon: 'PRS', zone: 'context', enabled: true,  pro: false },
  { id: 'travel-load',      label: 'Travel Load',               icon: 'TRV', zone: 'context', enabled: true,  pro: false },
  { id: 'best-conditions',  label: 'Best Conditions',           icon: 'BCS', zone: 'context', enabled: true,  pro: false },
  { id: 'pattern-scan',     label: 'Pattern Scan',              icon: 'PTN', zone: 'context', enabled: true,  pro: false },
  { id: 'why-result',       label: 'Why Result',                icon: 'WHY', zone: 'context', enabled: false, pro: false },
  { id: 'advanced-race-dna',label: 'Advanced Race DNA',         icon: 'DNA', zone: 'context', enabled: false, pro: true  },
  { id: 'race-comparer',    label: 'Race Comparer',             icon: 'CMP', zone: 'context', enabled: false, pro: true  },
  { id: 'what-to-race-next',label: 'What To Race Next',         icon: 'WTR', zone: 'context', enabled: false, pro: true  },
  { id: 'story-mode',       label: 'Story Mode',                icon: 'STY', zone: 'recently',enabled: true,  pro: false },
  { id: 'coach-activity',   label: 'Coach Activity',            icon: 'CCH', zone: 'context', enabled: false, pro: true  },
  // Day 2 formula widgets
  { id: 'riegel-predictor', label: 'Race Predictor (Riegel)',   icon: 'RGL', zone: 'recently',enabled: true,  pro: false },
  { id: 'vdot-score',       label: 'VDOT Fitness Score',        icon: 'VDT', zone: 'context', enabled: true,  pro: false },
  { id: 'goal-pace',        label: 'Goal Pace Breakdown',       icon: 'PCE', zone: 'now',     enabled: true,  pro: false },
  { id: 'weather-impact',   label: 'Weather Impact Score',      icon: 'WX', zone: 'recently', enabled: true,  pro: false },
  { id: 'distance-milestones', label: 'Distance Milestones',   icon: 'MI', zone: 'context',  enabled: true,  pro: false },
  // Day 3 formula widgets
  { id: 'equiv-perf',       label: 'Equivalent Performances',   icon: 'EQV', zone: 'context', enabled: false, pro: false },
  { id: 'upcoming-density', label: 'Race Conflict Checker',     icon: 'CHK', zone: 'trending',enabled: true,  pro: false },
  { id: 'course-repeats',   label: 'Course Repeats',            icon: 'RPT', zone: 'context', enabled: true,  pro: false },
]

const DEFAULT_ZONE_COLLAPSE: DashZoneCollapse = {
  now:      false,
  recently: false,
  trending: false,
  context:  false,
}

export interface DashState {
  widgets: DashWidget[]
  zoneCollapse: DashZoneCollapse
  getDashLayout: () => DashWidget[]
  getDashZoneCollapse: () => DashZoneCollapse
  setWidgetEnabled: (id: string, enabled: boolean) => void
  reorderWidget: (id: string, direction: 'up' | 'down') => void
  setZoneCollapse: (zone: keyof DashZoneCollapse, collapsed: boolean) => void
  saveDashZoneCollapse: (state: DashZoneCollapse) => void
}

export const useDashStore = create<DashState>()(
  persist(
    (set, get) => ({
      widgets: DEFAULT_WIDGETS,
      zoneCollapse: DEFAULT_ZONE_COLLAPSE,

      getDashLayout: () => {
        const { widgets } = get()
        if (!Array.isArray(widgets) || widgets.length === 0 || typeof widgets[0] !== 'object') {
          // Nothing stored yet — persist defaults so future operations work
          set({ widgets: DEFAULT_WIDGETS })
          return DEFAULT_WIDGETS
        }
        // Merge any new default widgets not yet in the stored list.
        // IMPORTANT: write the merged list back to the store so operations like
        // setWidgetEnabled / reorderWidget find the new widgets in s.widgets.
        const storedIds = new Set(widgets.map((w: DashWidget) => w.id))
        const newDefaults = DEFAULT_WIDGETS.filter(w => !storedIds.has(w.id))
        if (newDefaults.length === 0) return widgets
        const merged = [...widgets, ...newDefaults]
        set({ widgets: merged })
        return merged
      },

      getDashZoneCollapse: () => {
        const { zoneCollapse } = get()
        if (Array.isArray(zoneCollapse) || typeof zoneCollapse !== 'object' || !zoneCollapse) {
          return DEFAULT_ZONE_COLLAPSE
        }
        return { ...DEFAULT_ZONE_COLLAPSE, ...zoneCollapse }
      },

      setWidgetEnabled: (id, enabled) =>
        set(s => {
          const exists = s.widgets.some(w => w.id === id)
          if (exists) {
            return { widgets: s.widgets.map(w => w.id === id ? { ...w, enabled } : w) }
          }
          // Widget not in stored list yet (new default) — add it with the toggled state
          const def = DEFAULT_WIDGETS.find(w => w.id === id)
          if (!def) return {}
          return { widgets: [...s.widgets, { ...def, enabled }] }
        }),

      reorderWidget: (id, direction) =>
        set(s => {
          const arr = [...s.widgets]
          const idx = arr.findIndex(x => x.id === id)
          if (idx === -1) return {}
          const zone = arr[idx].zone
          const zoneIdxs = arr.map((x, i) => x.zone === zone ? i : -1).filter(i => i !== -1)
          const posInZone = zoneIdxs.indexOf(idx)
          if (direction === 'up' && posInZone > 0) {
            const swapIdx = zoneIdxs[posInZone - 1]
            ;[arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]]
          } else if (direction === 'down' && posInZone < zoneIdxs.length - 1) {
            const swapIdx = zoneIdxs[posInZone + 1]
            ;[arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]]
          }
          return { widgets: arr }
        }),

      setZoneCollapse: (zone, collapsed) =>
        set(s => ({
          zoneCollapse: { ...s.zoneCollapse, [zone]: collapsed },
        })),

      saveDashZoneCollapse: (state) => set({ zoneCollapse: state }),
    }),
    { name: 'fl2_dash_layout' },
  ),
)

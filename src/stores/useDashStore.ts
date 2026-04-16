import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DashWidget, DashZoneCollapse } from '@/types'

// Default widget configuration — zones: now, recently, trending, context
const DEFAULT_WIDGETS: DashWidget[] = [
  // NOW — RACE CONTEXT
  { id: 'countdown',       label: 'Next Race Countdown',   icon: '🏁', zone: 'now',      enabled: true,  pro: false },
  { id: 'race-forecast',   label: 'Race Day Forecast',     icon: '🌤', zone: 'now',      enabled: true,  pro: true  },
  { id: 'race-prediction', label: 'Race Prediction',       icon: '🔮', zone: 'now',      enabled: false, pro: true  },
  // RECENTLY — YOUR RACING
  { id: 'recent-races',    label: 'Recent Races',          icon: '🏃', zone: 'recently', enabled: true,  pro: false },
  { id: 'personal-bests',  label: 'Personal Bests',        icon: '⚡', zone: 'recently', enabled: true,  pro: false },
  // CONSISTENCY — BUILD
  { id: 'season-planner',  label: 'Season Planner',        icon: '📅', zone: 'trending', enabled: true,  pro: false },
  { id: 'recovery-intel',  label: 'Recovery Intelligence', icon: '💪', zone: 'trending', enabled: true,  pro: false },
  { id: 'training-correl', label: 'Training Correlation',  icon: '📊', zone: 'trending', enabled: true,  pro: true  },
  // PATTERNS — ANALYSIS
  { id: 'boston-qual',     label: 'Boston Qualifier',      icon: '🏅', zone: 'context',  enabled: true,  pro: false },
  { id: 'pacing-iq',       label: 'Pacing IQ',             icon: '🧠', zone: 'context',  enabled: true,  pro: false },
  { id: 'career-momentum', label: 'Career Momentum',       icon: '⚡', zone: 'context',  enabled: true,  pro: false },
  { id: 'age-grade',       label: 'Age-Grade Score',       icon: '📈', zone: 'context',  enabled: true,  pro: false },
  { id: 'race-dna',        label: 'Race DNA',              icon: '🧬', zone: 'context',  enabled: true,  pro: false },
  { id: 'pattern-scan',    label: 'Pattern Scan',          icon: '🔍', zone: 'context',  enabled: true,  pro: false },
  { id: 'why-result',      label: 'Why Result',            icon: '💡', zone: 'context',  enabled: false, pro: false },
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
          return DEFAULT_WIDGETS
        }
        // Merge any new default widgets not in stored list
        const storedIds = new Set(widgets.map((w: DashWidget) => w.id))
        const newDefaults = DEFAULT_WIDGETS.filter(w => !storedIds.has(w.id))
        return [...widgets, ...newDefaults]
      },

      getDashZoneCollapse: () => {
        const { zoneCollapse } = get()
        if (Array.isArray(zoneCollapse) || typeof zoneCollapse !== 'object' || !zoneCollapse) {
          return DEFAULT_ZONE_COLLAPSE
        }
        return { ...DEFAULT_ZONE_COLLAPSE, ...zoneCollapse }
      },

      setWidgetEnabled: (id, enabled) =>
        set(s => ({
          widgets: s.widgets.map(w => w.id === id ? { ...w, enabled } : w),
        })),

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

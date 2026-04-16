import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DashWidget, DashZoneCollapse } from '@/types'

// Default widget configuration — zone assignments match DASH_WIDGETS in index.html
const DEFAULT_WIDGETS: DashWidget[] = [
  { id: 'athlete-briefing', label: 'Athlete Briefing',    icon: '🏃', zone: 'now',      enabled: true  },
  { id: 'race-forecast',    label: 'Race Day Forecast',   icon: '🌤', zone: 'now',      enabled: true  },
  { id: 'recent-races',     label: 'Recent Races',        icon: '🏁', zone: 'recently', enabled: true  },
  { id: 'medal-wall',       label: 'Medal Wall',          icon: '🥇', zone: 'recently', enabled: true  },
  { id: 'training-streak',  label: 'Training Streak',     icon: '🔥', zone: 'trending', enabled: true  },
  { id: 'pacing-iq',        label: 'Pacing IQ',           icon: '📈', zone: 'trending', enabled: true  },
  { id: 'momentum-score',   label: 'Career Momentum',     icon: '⚡', zone: 'trending', enabled: true  },
  { id: 'race-dna',         label: 'Race DNA',            icon: '🧬', zone: 'context',  enabled: true  },
  { id: 'age-grade',        label: 'Age-Grade Trajectory',icon: '📊', zone: 'context',  enabled: true  },
  { id: 'race-stats',       label: 'Race Stats',          icon: '📋', zone: 'trending', enabled: false },
]

const DEFAULT_ZONE_COLLAPSE: DashZoneCollapse = {
  now:      false,  // expanded by default
  recently: false,  // expanded by default
  trending: true,   // collapsed by default
  context:  true,   // collapsed by default
}

export interface DashState {
  widgets: DashWidget[]
  zoneCollapse: DashZoneCollapse
  getDashLayout: () => DashWidget[]
  getDashZoneCollapse: () => DashZoneCollapse
  setWidgetEnabled: (id: string, enabled: boolean) => void
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
        // Migration: if stored value is not an array of objects with {id, enabled, zone},
        // reset to defaults (matches getDashLayout() migration v2 in index.html)
        if (!Array.isArray(widgets) || widgets.length === 0 || typeof widgets[0] !== 'object') {
          return DEFAULT_WIDGETS
        }
        return widgets
      },

      getDashZoneCollapse: () => {
        const { zoneCollapse } = get()
        if (Array.isArray(zoneCollapse) || typeof zoneCollapse !== 'object' || !zoneCollapse) {
          return DEFAULT_ZONE_COLLAPSE
        }
        return zoneCollapse
      },

      setWidgetEnabled: (id, enabled) =>
        set(s => ({
          widgets: s.widgets.map(w => w.id === id ? { ...w, enabled } : w),
        })),

      setZoneCollapse: (zone, collapsed) =>
        set(s => ({
          zoneCollapse: { ...s.zoneCollapse, [zone]: collapsed },
        })),

      saveDashZoneCollapse: (state) => set({ zoneCollapse: state }),
    }),
    {
      name: 'fl2_dash_layout',  // must match existing localStorage key
      // Also handles fl2_dash_zone_collapse — stored in the same persist key
      // for simplicity; the original used two separate keys but merging is safe
      // since both are only read/written by dash code.
    },
  ),
)

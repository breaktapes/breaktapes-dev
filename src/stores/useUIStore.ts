import { create } from 'zustand'

interface UIState {
  racesSheetExpanded: boolean
  racesViewMode: 'compact' | 'detailed'
  racesYearFilter: string | null
  setRacesSheetExpanded: (v: boolean) => void
  setRacesViewMode: (v: 'compact' | 'detailed') => void
  setRacesYearFilter: (v: string | null) => void
}

// UI state is in-memory only — no persistence
export const useUIStore = create<UIState>()((set) => ({
  racesSheetExpanded: false,
  racesViewMode: 'compact',
  racesYearFilter: null,
  setRacesSheetExpanded: (racesSheetExpanded) => set({ racesSheetExpanded }),
  setRacesViewMode: (racesViewMode) => set({ racesViewMode }),
  setRacesYearFilter: (racesYearFilter) => set({ racesYearFilter }),
}))

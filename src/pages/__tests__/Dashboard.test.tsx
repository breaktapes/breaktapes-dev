/**
 * Dashboard — RTL tests
 *
 * The Dashboard reads directly from Zustand stores. Each test resets stores
 * via `useRaceStore.setState` / `useAthleteStore.setState` before rendering.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Dashboard } from '../Dashboard'
import { useRaceStore } from '@/stores/useRaceStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
import type { Race } from '@/types'

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  )
}

// Use local-time date strings to match how the component computes today/yesterday
function localDateStr(offsetDays: number) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const YESTERDAY = localDateStr(-1)
const FUTURE    = localDateStr(30)

const RACE: Race = {
  id: 'r1',
  name: 'Berlin Marathon',
  date: '2023-09-24',
  city: 'Berlin',
  country: 'DE',
  distance: '42.2',
  sport: 'Running',
  time: '3:55:00',
}

beforeEach(() => {
  useRaceStore.setState({ races: [], nextRace: null, upcomingRaces: [] })
  useAthleteStore.setState({ athlete: null, seasonPlans: [] })
})

// ─── AthleteBriefing states ──────────────────────────────────────────────────

describe('Dashboard — AthleteBriefing (no races)', () => {
  it('shows ADD YOUR FIRST RACE tag when races list is empty', () => {
    renderDashboard()
    expect(screen.getByText('ADD YOUR FIRST RACE')).toBeInTheDocument()
  })

  it('shows athlete name in greeting when athlete has a first name', () => {
    useAthleteStore.setState({ athlete: { firstName: 'Sam' } as any, seasonPlans: [] })
    renderDashboard()
    // Greeting card shows the first name in uppercase
    expect(screen.getByText('SAM')).toBeInTheDocument()
  })

  it('shows "Log First Race" CTA when no races', () => {
    renderDashboard()
    expect(screen.getByText(/Log First Race/i)).toBeInTheDocument()
  })
})

describe('Dashboard — AthleteBriefing (just finished)', () => {
  it('shows JUST RACED tag when a race was yesterday', () => {
    useRaceStore.setState({
      races: [{ ...RACE, date: YESTERDAY }],
      nextRace: null,
      upcomingRaces: [],
    })
    renderDashboard()
    expect(screen.getByText('JUST RACED')).toBeInTheDocument()
  })

  it('shows "Yesterday" label when race was yesterday', () => {
    useRaceStore.setState({
      races: [{ ...RACE, date: YESTERDAY }],
      nextRace: null,
      upcomingRaces: [],
    })
    renderDashboard()
    expect(screen.getByText(/Yesterday/)).toBeInTheDocument()
  })
})

describe('Dashboard — AthleteBriefing (upcoming race)', () => {
  it('shows NEXT RACE section when nextRace is set', () => {
    useRaceStore.setState({
      races: [RACE],
      nextRace: { ...RACE, id: 'upcoming', name: 'Tokyo Marathon', date: FUTURE },
      upcomingRaces: [{ ...RACE, id: 'upcoming', name: 'Tokyo Marathon', date: FUTURE }],
    })
    renderDashboard()
    expect(screen.getAllByText(/NEXT RACE/i).length).toBeGreaterThanOrEqual(1)
    const els = screen.getAllByText(/Tokyo Marathon/i)
    expect(els.length).toBeGreaterThanOrEqual(1)
  })
})

// ─── Stats strip ─────────────────────────────────────────────────────────────

describe('Dashboard — StatsStrip', () => {
  it('renders stat labels', () => {
    renderDashboard()
    // Labels use uppercase text
    expect(screen.getByText('RACES')).toBeInTheDocument()
    expect(screen.getByText('COUNTRIES')).toBeInTheDocument()
    expect(screen.getAllByText(/^(KM|MI)$/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('MEDALS')).toBeInTheDocument()
  })

  it('shows correct race count', () => {
    useRaceStore.setState({ races: [RACE, { ...RACE, id: 'r2' }], nextRace: null, upcomingRaces: [] })
    renderDashboard()
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1)
  })
})

// ─── Recent races ─────────────────────────────────────────────────────────────

describe('Dashboard — RecentRaces', () => {
  it('shows RECENT RACES section header', () => {
    useRaceStore.setState({ races: [RACE], nextRace: null, upcomingRaces: [] })
    renderDashboard()
    // Rendered in both NOW and RECENTLY zones — at least one should exist
    const headers = screen.getAllByText('RECENT RACES')
    expect(headers.length).toBeGreaterThanOrEqual(1)
  })

  it('shows the race name (may appear in multiple zones)', () => {
    useRaceStore.setState({ races: [RACE], nextRace: null, upcomingRaces: [] })
    renderDashboard()
    const els = screen.getAllByText('Berlin Marathon')
    expect(els.length).toBeGreaterThanOrEqual(1)
  })

  it('shows empty state message when no races', () => {
    renderDashboard()
    const emptyStates = screen.getAllByText(/No races (yet|logged yet)/)
    expect(emptyStates.length).toBeGreaterThanOrEqual(1)
  })
})

// ─── NewUserOnboarding ───────────────────────────────────────────────────────

describe('Dashboard — NewUserOnboarding', () => {
  it('shows Import button when no races', () => {
    renderDashboard()
    const importBtn = screen.getByRole('button', { name: /↓ Import/i })
    expect(importBtn).toBeInTheDocument()
  })

  it('does not show NewUserOnboarding when races exist', () => {
    useRaceStore.setState({ races: [RACE], nextRace: null, upcomingRaces: [] })
    renderDashboard()
    // "Log a Race" button in NewUserOnboarding should not be present
    const logBtns = screen.queryAllByText(/^Log a Race$/i)
    expect(logBtns.length).toBe(0)
  })
})

// ─── TriPredictorWidget visibility ───────────────────────────────────────────

describe('Dashboard — TriPredictorWidget visibility', () => {
  it('hides TRIATHLON PREDICTOR widget when user has only running races', () => {
    useRaceStore.setState({ races: [RACE], nextRace: null, upcomingRaces: [] })
    renderDashboard()
    expect(screen.queryByText('TRIATHLON PREDICTOR')).not.toBeInTheDocument()
  })

  it('shows TRIATHLON PREDICTOR widget when user has a past triathlon', () => {
    const triRace: Race = {
      id: 't1', name: 'Olympic Tri', date: '2025-06-01',
      city: '', country: '', distance: '51.5', sport: 'triathlon', outcome: 'Finished',
    }
    useRaceStore.setState({ races: [triRace], nextRace: null, upcomingRaces: [] })
    renderDashboard()
    expect(screen.getByText('TRIATHLON PREDICTOR')).toBeInTheDocument()
  })

  it('shows TRIATHLON PREDICTOR widget when user has an upcoming triathlon', () => {
    const upcomingTri: Race = {
      id: 'u1', name: 'IRONMAN 70.3', date: FUTURE,
      city: '', country: '', distance: '113', sport: 'triathlon', outcome: undefined,
    }
    useRaceStore.setState({ races: [], nextRace: null, upcomingRaces: [upcomingTri] })
    renderDashboard()
    expect(screen.getByText('TRIATHLON PREDICTOR')).toBeInTheDocument()
  })
})

// ─── Zone structure ───────────────────────────────────────────────────────────

describe('Dashboard — zone labels', () => {
  it('renders the four accordion zones', () => {
    renderDashboard()
    expect(screen.getByText('NOW')).toBeInTheDocument()
    expect(screen.getByText('RECENTLY')).toBeInTheDocument()
    expect(screen.getByText('CONSISTENCY')).toBeInTheDocument()
    expect(screen.getByText('PATTERNS')).toBeInTheDocument()
  })
})

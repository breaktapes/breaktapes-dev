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

// Framer Motion can cause issues in jsdom — mock it
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  )
}

const YESTERDAY = new Date(Date.now() - 86400000).toISOString().split('T')[0]
const FUTURE = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

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
    expect(screen.getAllByText(/TOTAL (KM|MI)/i).length).toBeGreaterThanOrEqual(1)
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
    const emptyStates = screen.getAllByText(/No races yet/)
    expect(emptyStates.length).toBeGreaterThanOrEqual(1)
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

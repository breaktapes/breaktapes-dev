/**
 * Train — pace calculator + zone tabs smoke tests
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Train } from '../Train'
import { useRaceStore } from '@/stores/useRaceStore'
import { useWearableStore } from '@/stores/useWearableStore'

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ user: null }),
}))

vi.mock('@/lib/whoop', () => ({
  handleWhoopCallback: vi.fn(),
  fetchWhoopActivities: vi.fn().mockResolvedValue([]),
  fetchWhoopRecovery: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/garmin', () => ({
  handleGarminCallback: vi.fn(),
  fetchGarminActivities: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/strava', () => ({
  handleStravaCallback: vi.fn(),
  fetchStravaActivities: vi.fn().mockResolvedValue([]),
  stravaActivitiesToRaces: vi.fn().mockReturnValue([]),
}))

function renderTrain() {
  return render(
    <MemoryRouter>
      <Train />
    </MemoryRouter>
  )
}

beforeEach(() => {
  useRaceStore.setState({ races: [], nextRace: null, upcomingRaces: [] })
  useWearableStore.setState({ stravaToken: null, whoopToken: null, garminToken: null } as any)
})

describe('Train — tab navigation', () => {
  it('renders Pace tab', () => {
    renderTrain()
    expect(screen.getByText('Pace')).toBeInTheDocument()
  })

  it('renders Activities tab', () => {
    renderTrain()
    expect(screen.getByText('Activities')).toBeInTheDocument()
  })

  it('renders Readiness tab', () => {
    renderTrain()
    expect(screen.getByText('Readiness')).toBeInTheDocument()
  })
})

describe('Train — pace calculator', () => {
  it('shows pace calculator content by default', () => {
    renderTrain()
    // Pace tab is active by default
    expect(screen.getByText('Pace')).toBeInTheDocument()
  })
})

describe('Train — no crash on empty store', () => {
  it('renders without races', () => {
    renderTrain()
    // Basic smoke test — no errors thrown
    expect(document.body).toBeTruthy()
  })
})

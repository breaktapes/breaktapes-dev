/**
 * Train — tools-first pace calculator smoke tests
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Train } from '../Train'
import { useRaceStore } from '@/stores/useRaceStore'
import { useAthleteStore } from '@/stores/useAthleteStore'

function renderTrain() {
  return render(
    <MemoryRouter>
      <Train />
    </MemoryRouter>
  )
}

beforeEach(() => {
  useRaceStore.setState({ races: [], nextRace: null, upcomingRaces: [] })
  useAthleteStore.setState({ athlete: null, seasonPlans: [], goals: { annual: {}, distGoals: [] }, injuries: [] })
})

describe('Train — tab navigation', () => {
  it('renders Pace tab', () => {
    renderTrain()
    expect(screen.getByText('Pace')).toBeInTheDocument()
  })

  it('does not render removed sync tabs', () => {
    renderTrain()
    expect(screen.queryByText('Activities')).not.toBeInTheDocument()
    expect(screen.queryByText('Readiness')).not.toBeInTheDocument()
  })
})

describe('Train — pace calculator', () => {
  it('shows pace calculator content by default', () => {
    renderTrain()
    // Pace tab is active by default
    expect(screen.getByText('Pace')).toBeInTheDocument()
  })

  it('shows the VDOT benchmark section', () => {
    renderTrain()
    expect(screen.getByText('VDOT Benchmark')).toBeInTheDocument()
    expect(screen.getByText('Calculate VDOT')).toBeInTheDocument()
  })

  it('saves the calculated VDOT to athlete state', async () => {
    useRaceStore.setState({
      races: [{
        id: 'race-1',
        name: 'City 10K',
        date: '2026-06-01',
        city: 'Dubai',
        country: 'UAE',
        distance: '10',
        sport: 'running',
        time: '0:45:00',
      }],
      nextRace: null,
      upcomingRaces: [],
    })

    renderTrain()
    fireEvent.click(screen.getByText('Calculate VDOT'))

    await waitFor(() => {
      const athlete = useAthleteStore.getState().athlete
      expect(athlete?.currentVdot).toBeGreaterThan(0)
      expect(athlete?.currentVdotSource).toBe('race')
      expect(athlete?.currentVdotRaceName).toBe('City 10K')
    })
  })
})

describe('Train — no crash on empty store', () => {
  it('renders without races', () => {
    renderTrain()
    // Basic smoke test — no errors thrown
    expect(document.body).toBeTruthy()
  })
})

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
  it('renders Benchmark, Pacing, and Builder tabs', () => {
    renderTrain()
    expect(screen.getByText('Benchmark')).toBeInTheDocument()
    expect(screen.getByText('Pacing')).toBeInTheDocument()
    expect(screen.getByText('Builder')).toBeInTheDocument()
  })

  it('does not render removed sync tabs', () => {
    renderTrain()
    expect(screen.queryByText('Activities')).not.toBeInTheDocument()
    expect(screen.queryByText('Readiness')).not.toBeInTheDocument()
  })
})

describe('Train — pace calculator', () => {
  it('shows benchmark content by default', () => {
    renderTrain()
    expect(screen.getByText('VDOT Benchmark')).toBeInTheDocument()
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

  it('shows a workout suggestion after calculating a benchmark', async () => {
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
    fireEvent.click(screen.getByText('Builder'))

    await waitFor(() => {
      expect(screen.getByText('Workout Generator')).toBeInTheDocument()
      expect(screen.getByText(/Using benchmark: City 10K/i)).toBeInTheDocument()
      expect(screen.getAllByText(/Tempo Session|VO2 Max Session|Recovery Run|Long Run|Goal-Pace Session/i).length).toBeGreaterThan(0)
    })
  })

  it('shows multiple workout variants in Builder', async () => {
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
    fireEvent.click(screen.getByText('Builder'))

    await waitFor(() => {
      expect(screen.getByText('Workout Generator')).toBeInTheDocument()
      expect(screen.getAllByText('Tempo Session').length).toBeGreaterThan(0)
      expect(screen.getByText('Cruise Intervals')).toBeInTheDocument()
    })
  })

  it('saves a workout to athlete state', async () => {
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
    fireEvent.click(screen.getByText('Builder'))

    await waitFor(() => {
      expect(screen.getByText('Save Workout')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Save Workout'))

    await waitFor(() => {
      const athlete = useAthleteStore.getState().athlete
      expect(athlete?.savedWorkouts?.length).toBeGreaterThan(0)
      expect(athlete?.savedWorkouts?.[0]?.title).toBe('Tempo Session')
    })
  })

  it('records workout feedback to athlete state', async () => {
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
    fireEvent.click(screen.getByText('Builder'))

    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Too Hard'))

    await waitFor(() => {
      const athlete = useAthleteStore.getState().athlete
      expect(athlete?.workoutFeedback?.length).toBeGreaterThan(0)
      expect(athlete?.workoutFeedback?.[0]?.feedback).toBe('too-hard')
    })
  })

  it("shows today's recommendation controls in Builder", async () => {
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
      nextRace: {
        id: 'upcoming-1',
        name: 'Half Marathon Tune-Up',
        date: '2026-08-10',
        city: 'Dubai',
        country: 'UAE',
        distance: '21.1',
        sport: 'running',
      },
      upcomingRaces: [],
    } as any)

    renderTrain()
    fireEvent.click(screen.getByText('Calculate VDOT'))
    fireEvent.click(screen.getByText('Builder'))

    await waitFor(() => {
      expect(screen.getByText("Today's Recommendation")).toBeInTheDocument()
      expect(screen.getByText('Day Intent')).toBeInTheDocument()
      expect(screen.getByText('How You Feel')).toBeInTheDocument()
    })
  })

  it('updates Builder when Generate Workout is clicked', async () => {
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
    fireEvent.click(screen.getByText('Builder'))

    await waitFor(() => {
      expect(screen.getByText('Generate Workout')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Long'))
    fireEvent.click(screen.getByText('Generate Workout'))

    await waitFor(() => {
      expect(screen.getByText(/long run|long aerobic run/i)).toBeInTheDocument()
    })
  })

  it('adapts recommendation copy for marathon-focused work', async () => {
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
      nextRace: {
        id: 'upcoming-1',
        name: 'Autumn Marathon',
        date: '2026-09-20',
        city: 'Berlin',
        country: 'Germany',
        distance: '42.2',
        sport: 'running',
      },
      upcomingRaces: [],
    } as any)

    renderTrain()
    fireEvent.click(screen.getByText('Calculate VDOT'))
    fireEvent.click(screen.getByText('Builder'))
    fireEvent.click(screen.getByText('Full'))
    fireEvent.click(screen.getByText('Generate Workout'))

    await waitFor(() => {
      expect(screen.getByText(/Marathon focus/i)).toBeInTheDocument()
    })
  })

  it('softens the recommendation after too-hard feedback', async () => {
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
    useAthleteStore.setState({
      athlete: {
        workoutFeedback: [{
          id: 'wf-1',
          workoutId: 'vo2_3min',
          workoutTitle: 'VO2 Max Session',
          workoutType: 'vo2',
          goalFocus: '10k',
          feedback: 'too-hard',
          recordedAt: '2026-07-22',
        }],
      } as any,
      seasonPlans: [],
      goals: { annual: {}, distGoals: [] },
      injuries: [],
    })

    renderTrain()
    fireEvent.click(screen.getByText('Calculate VDOT'))
    fireEvent.click(screen.getByText('Builder'))

    await waitFor(() => {
      expect(screen.getByText(/last session felt too hard/i)).toBeInTheDocument()
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

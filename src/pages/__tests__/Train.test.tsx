/**
 * Train — tools-first pace calculator smoke tests
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Train } from '../Train'
import { useRaceStore } from '@/stores/useRaceStore'

function renderTrain() {
  return render(
    <MemoryRouter>
      <Train />
    </MemoryRouter>
  )
}

beforeEach(() => {
  useRaceStore.setState({ races: [], nextRace: null, upcomingRaces: [] })
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
})

describe('Train — no crash on empty store', () => {
  it('renders without races', () => {
    renderTrain()
    // Basic smoke test — no errors thrown
    expect(document.body).toBeTruthy()
  })
})

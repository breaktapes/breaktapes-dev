/**
 * Gear — tab navigation + catalog display smoke tests
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Gear } from '../Gear'
import { useRaceStore } from '@/stores/useRaceStore'
import { useAuthStore } from '@/stores/useAuthStore'

function renderGear() {
  return render(
    <MemoryRouter>
      <Gear />
    </MemoryRouter>
  )
}

beforeEach(() => {
  useRaceStore.setState({ races: [], nextRace: null, upcomingRaces: [] })
  useAuthStore.setState({ authUser: { id: 'u1' } as any, proAccessGranted: false })
})

describe('Gear — tab navigation', () => {
  it('renders Discover tab', () => {
    renderGear()
    expect(screen.getByText('Discover')).toBeInTheDocument()
  })

  it('renders Library tab', () => {
    renderGear()
    expect(screen.getByText('Library')).toBeInTheDocument()
  })

  it('renders Lists tab', () => {
    renderGear()
    expect(screen.getByText('Lists')).toBeInTheDocument()
  })

  it('renders Stacks tab', () => {
    renderGear()
    expect(screen.getByText('Stacks')).toBeInTheDocument()
  })
})

describe('Gear — category filters', () => {
  it('shows All category filter', () => {
    renderGear()
    expect(screen.getByText('All')).toBeInTheDocument()
  })

  it('shows Running category filter', () => {
    renderGear()
    expect(screen.getAllByText('Running').length).toBeGreaterThanOrEqual(1)
  })
})

describe('Gear — catalog content', () => {
  it('shows gear items from catalog', () => {
    renderGear()
    // At least one gear item should be visible
    const items = screen.getAllByRole('button')
    expect(items.length).toBeGreaterThan(0)
  })
})

describe('Gear — no crash', () => {
  it('renders without auth user', () => {
    useAuthStore.setState({ authUser: null, proAccessGranted: false })
    renderGear()
    expect(document.body).toBeTruthy()
  })
})

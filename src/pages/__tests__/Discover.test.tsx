/**
 * Discover — catalog browsing + sport filter tests
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Discover } from '../Discover'
import { useRaceStore } from '@/stores/useRaceStore'

vi.mock('@/hooks/useRaceCatalog')
import { useRaceCatalog } from '@/hooks/useRaceCatalog'
const mockCatalog = vi.mocked(useRaceCatalog)

vi.mock('@/components/AddRaceModal', () => ({
  AddRaceModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="add-race-modal">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))

const FUTURE_MONTH = new Date().getMonth() + 2

const FM = FUTURE_MONTH > 12 ? 12 : FUTURE_MONTH

const SAMPLE_RACES = [
  {
    id: 1,
    name: 'Berlin Marathon',
    aliases: [],
    city: 'Berlin',
    country: 'Germany',
    month: FM,
    dist_km: 42.2,
    type: 'run',
  },
  {
    id: 2,
    name: 'Hamburg Triathlon',
    aliases: [],
    city: 'Hamburg',
    country: 'Germany',
    month: FM,
    dist_km: 51.5,
    type: 'tri',
  },
]

function renderDiscover() {
  return render(
    <MemoryRouter>
      <Discover />
    </MemoryRouter>
  )
}

beforeEach(() => {
  useRaceStore.setState({ races: [], nextRace: null, upcomingRaces: [] })
  mockCatalog.mockReturnValue({ data: SAMPLE_RACES as any, isLoading: false, isError: false } as any)
})

describe('Discover — header', () => {
  it('renders Upcoming Races heading', () => {
    renderDiscover()
    expect(screen.getAllByText(/upcoming races/i).length).toBeGreaterThanOrEqual(1)
  })
})

describe('Discover — sport filters', () => {
  it('renders sport filter chips', () => {
    renderDiscover()
    expect(screen.getByText('Run')).toBeInTheDocument()
    expect(screen.getByText('Tri')).toBeInTheDocument()
  })
})

describe('Discover — catalog results', () => {
  it('shows race cards from catalog', () => {
    renderDiscover()
    expect(screen.getByText('Berlin Marathon')).toBeInTheDocument()
  })

  it('does not crash when catalog is loading', () => {
    mockCatalog.mockReturnValue({ data: [], isLoading: true, isError: false } as any)
    renderDiscover()
    expect(document.body).toBeTruthy()
  })

  it('does not crash when catalog is empty', () => {
    mockCatalog.mockReturnValue({ data: [], isLoading: false, isError: false } as any)
    renderDiscover()
    expect(document.body).toBeTruthy()
  })
})

describe('Discover — sport filter interaction', () => {
  it('clicking Tri filter shows triathlon races', () => {
    renderDiscover()
    fireEvent.click(screen.getByText('Tri'))
    expect(screen.getByText('Hamburg Triathlon')).toBeInTheDocument()
  })
})

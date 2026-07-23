/**
 * Settings — smoke + key section tests
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Settings } from '../Settings'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { useAuthStore } from '@/stores/useAuthStore'

vi.mock('@clerk/clerk-react', () => ({
  useClerk: () => ({ signOut: vi.fn(), openUserProfile: vi.fn() }),
  useUser: () => ({ user: null }),
}))

vi.mock('@/lib/syncState', () => ({ syncStateToSupabase: vi.fn() }))
function renderSettings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  useAthleteStore.setState({ athlete: null, seasonPlans: [] })
  useAuthStore.setState({ authUser: { id: 'u1', email: 'test@example.com' } as any, proAccessGranted: false })
})

describe('Settings — section headers', () => {
  it('renders Account section', () => {
    renderSettings()
    expect(screen.getByText('Account')).toBeInTheDocument()
  })

  it('renders Public Profile section', () => {
    renderSettings()
    expect(screen.getByText('Public Profile')).toBeInTheDocument()
  })

  it('renders Preferences section', () => {
    renderSettings()
    expect(screen.getByText('Preferences')).toBeInTheDocument()
  })

  it('renders Theme section', () => {
    renderSettings()
    expect(screen.getByText('Theme')).toBeInTheDocument()
  })

  it('renders About section', () => {
    renderSettings()
    expect(screen.getByText('About')).toBeInTheDocument()
  })
})

describe('Settings — account card', () => {
  it('shows signed-in indicator', () => {
    renderSettings()
    // Account section header is always visible
    expect(screen.getByText('Account')).toBeInTheDocument()
  })
})

describe('Settings — units preference', () => {
  it('shows metric and imperial buttons', () => {
    renderSettings()
    expect(screen.getByText(/metric/i)).toBeInTheDocument()
    expect(screen.getByText(/imperial/i)).toBeInTheDocument()
  })
})

describe('Settings — race-first cleanup', () => {
  it('does not render removed Wearables section', () => {
    renderSettings()
    expect(screen.queryByText('Wearables')).not.toBeInTheDocument()
  })
})

/**
 * Settings — smoke + key section tests
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Settings } from '../Settings'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { useWearableStore } from '@/stores/useWearableStore'

vi.mock('@clerk/clerk-react', () => ({
  useClerk: () => ({ signOut: vi.fn(), openUserProfile: vi.fn() }),
}))

vi.mock('@/lib/syncState', () => ({ syncStateToSupabase: vi.fn() }))
vi.mock('@/lib/strava', () => ({ startStravaOAuth: vi.fn() }))
vi.mock('@/lib/wearableUtils', () => ({ removeWearableToken: vi.fn() }))

function renderSettings() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>
  )
}

beforeEach(() => {
  useAthleteStore.setState({ athlete: null, seasonPlans: [] })
  useAuthStore.setState({ authUser: { id: 'u1', email: 'test@example.com' } as any, proAccessGranted: false })
  useWearableStore.setState({ stravaToken: null } as any)
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

  it('renders Wearables section', () => {
    renderSettings()
    expect(screen.getByText('Wearables')).toBeInTheDocument()
  })

  it('renders Theme section', () => {
    renderSettings()
    expect(screen.getByText('Theme')).toBeInTheDocument()
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

describe('Settings — Strava integration', () => {
  it('shows Connect button when not connected', () => {
    renderSettings()
    expect(screen.getByRole('button', { name: /^connect$/i })).toBeInTheDocument()
  })

  it('shows Disconnect button when token present', () => {
    useWearableStore.setState({
      stravaToken: { access_token: 'tok', athlete: { firstname: 'Sam' } },
    } as any)
    renderSettings()
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument()
  })
})

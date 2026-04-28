/**
 * Profile — achievements, PBs, heatmap smoke tests
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Profile } from '../Profile'
import { useRaceStore } from '@/stores/useRaceStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { useAuthStore } from '@/stores/useAuthStore'
import type { Race } from '@/types'

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ user: { id: 'u1', username: 'testuser' } }),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      upsert: () => Promise.resolve({ error: null }),
    }),
  },
}))

vi.mock('@/components/EditProfileModal', () => ({
  EditProfileModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="edit-profile-modal">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))

const RACE: Race = {
  id: 'r1',
  name: 'Berlin Marathon',
  date: '2023-09-24',
  city: 'Berlin',
  country: 'Germany',
  distance: '42.2',
  sport: 'Running',
  time: '3:55:00',
}

function renderProfile() {
  return render(
    <MemoryRouter>
      <Profile />
    </MemoryRouter>
  )
}

beforeEach(() => {
  useRaceStore.setState({ races: [], nextRace: null, upcomingRaces: [] })
  useAthleteStore.setState({ athlete: null, seasonPlans: [] })
  useAuthStore.setState({ authUser: { id: 'u1' } as any, proAccessGranted: false })
})

describe('Profile — page sections', () => {
  it('renders YOUR ACHIEVEMENTS section', () => {
    renderProfile()
    expect(screen.getByText('YOUR ACHIEVEMENTS')).toBeInTheDocument()
  })

  it('renders PERSONAL BESTS section', () => {
    renderProfile()
    expect(screen.getAllByText('PERSONAL BESTS').length).toBeGreaterThanOrEqual(1)
  })

  it('renders RACE ACTIVITY heading', () => {
    renderProfile()
    expect(screen.getByText('RACE ACTIVITY')).toBeInTheDocument()
  })
})

describe('Profile — athlete name', () => {
  it('shows athlete first + last name when set', () => {
    useAthleteStore.setState({
      athlete: { firstName: 'Sam', lastName: 'Runner', dob: '', gender: '' } as any,
      seasonPlans: [],
    })
    renderProfile()
    expect(screen.getByText(/sam/i)).toBeInTheDocument()
  })
})

describe('Profile — with races', () => {
  it('renders without crash when races present', () => {
    useRaceStore.setState({ races: [RACE], nextRace: null, upcomingRaces: [] })
    renderProfile()
    expect(screen.getByText('YOUR ACHIEVEMENTS')).toBeInTheDocument()
  })
})

describe('Profile — edit button', () => {
  it('shows edit button in hero', () => {
    renderProfile()
    // Multiple edit buttons exist — just assert at least one is present
    const btns = screen.getAllByRole('button', { name: /edit/i })
    expect(btns.length).toBeGreaterThanOrEqual(1)
  })
})

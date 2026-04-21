/**
 * AddRaceModal — catalog autocomplete regression tests
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AddRaceModal } from '../AddRaceModal'
import { useRaceStore } from '@/stores/useRaceStore'
import type { CatalogRace } from '@/hooks/useRaceCatalog'

// Mock framer-motion (causes jsdom issues)
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...p }: any) => <div {...p}>{children}</div>,
    span: ({ children, ...p }: any) => <span {...p}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

// Mock useRaceCatalog so tests control catalog state
vi.mock('@/hooks/useRaceCatalog')
import { useRaceCatalog } from '@/hooks/useRaceCatalog'
const mockUseRaceCatalog = vi.mocked(useRaceCatalog)

const BERLIN: CatalogRace = {
  id: 1,
  name: 'Berlin Marathon',
  aliases: [],
  city: 'Berlin',
  country: 'Germany',
  month: 9,
  day: 22,
  dist_km: 42.2,
  type: 'Running',
}

const C_RACE: CatalogRace = {
  id: 3,
  name: 'Local 5K Fun Run',
  aliases: [],
  city: 'Springfield',
  country: 'United States',
  dist_km: 5,
  type: 'Running',
}

function renderModal(props?: Partial<React.ComponentProps<typeof AddRaceModal>>) {
  return render(
    <MemoryRouter>
      <AddRaceModal onClose={vi.fn()} {...props} />
    </MemoryRouter>
  )
}

const SEARCH_PLACEHOLDER = /Search a race or type your own/i

function typeIntoSearch(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } })
}

beforeEach(() => {
  useRaceStore.setState({ races: [], nextRace: null, upcomingRaces: [] })
  mockUseRaceCatalog.mockReturnValue({ data: [], isLoading: false, isError: false } as any)
})

// ─── Test 1: Search before catalog loads → no crash ───────────────────────────

describe('AddRaceModal — catalog loading state', () => {
  it('does not crash when catalog is loading and user types', async () => {
    mockUseRaceCatalog.mockReturnValue({ data: [], isLoading: true, isError: false } as any)
    renderModal()
    const input = screen.getByPlaceholderText(SEARCH_PLACEHOLDER)
    typeIntoSearch(input, 'Berlin')
    // No error thrown — modal still rendered
    expect(input).toBeInTheDocument()
  })
})

// ─── Test 2: Search after catalog loads → suggestions appear ─────────────────

describe('AddRaceModal — catalog suggestions', () => {
  it('shows suggestion when catalog contains a match', async () => {
    mockUseRaceCatalog.mockReturnValue({ data: [BERLIN], isLoading: false, isError: false } as any)
    renderModal()
    const input = screen.getByPlaceholderText(SEARCH_PLACEHOLDER)
    typeIntoSearch(input, 'berlin')
    await waitFor(() => {
      expect(screen.getByText('Berlin Marathon')).toBeInTheDocument()
    })
  })
})

// ─── Test 3: Select suggestion → name autofills ──────────────────────────────

describe('AddRaceModal — suggestion selection', () => {
  it('autofills name field on suggestion click', async () => {
    mockUseRaceCatalog.mockReturnValue({ data: [BERLIN], isLoading: false, isError: false } as any)
    renderModal()
    const input = screen.getByPlaceholderText(SEARCH_PLACEHOLDER)
    typeIntoSearch(input, 'berlin')
    await waitFor(() => screen.getByText('Berlin Marathon'))
    // Suggestion handler is onMouseDown (prevents blur stealing focus)
    const suggestion = screen.getByText('Berlin Marathon').closest('button')!
    fireEvent.mouseDown(suggestion)
    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe('Berlin Marathon')
    })
  })
})

// ─── Test 4: Unknown race → form still submittable ───────────────────────────

describe('AddRaceModal — unknown race name', () => {
  it('save button is not disabled when no suggestions match', async () => {
    renderModal()
    const input = screen.getByPlaceholderText(SEARCH_PLACEHOLDER)
    typeIntoSearch(input, 'ZZZ Unknown Race XYZ')
    // No catalog matches — suggestions list should not appear
    expect(screen.queryByText('Berlin Marathon')).not.toBeInTheDocument()
    // LOG RACE button exists and is not disabled
    const saveBtn = screen.getByRole('button', { name: /log race/i })
    expect(saveBtn).not.toBeDisabled()
  })
})

// ─── Test 5: C-priority races appear in autocomplete (no filter) ─────────────

describe('AddRaceModal — C-priority catalog entries', () => {
  it('shows C-priority races in suggestions', async () => {
    mockUseRaceCatalog.mockReturnValue({
      data: [C_RACE],
      isLoading: false,
      isError: false,
    } as any)
    renderModal()
    const input = screen.getByPlaceholderText(SEARCH_PLACEHOLDER)
    typeIntoSearch(input, 'local 5k')
    await waitFor(() => {
      expect(screen.getByText('Local 5K Fun Run')).toBeInTheDocument()
    })
  })
})

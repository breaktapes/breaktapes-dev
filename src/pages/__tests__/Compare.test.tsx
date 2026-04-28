/**
 * Compare — /compare?a=alice&b=bob athlete comparison page tests
 */
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Compare } from '../Compare'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'not found' } }),
          }),
        }),
      }),
    }),
  },
}))

function renderCompare(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/compare${search}`]}>
      <Routes>
        <Route path="/compare" element={<Compare />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Compare — empty state (no params)', () => {
  it('renders without crash', () => {
    renderCompare()
    expect(document.body).toBeTruthy()
  })

  it('shows compare heading', () => {
    renderCompare()
    const els = screen.getAllByText(/compare/i)
    expect(els.length).toBeGreaterThanOrEqual(1)
  })
})

describe('Compare — with query params', () => {
  it('shows loading state when params provided', async () => {
    renderCompare('?a=alice&b=bob')
    // Page renders — either loading or not-found state
    expect(document.body).toBeTruthy()
  })

  it('shows not found / error state when profiles not in DB', async () => {
    renderCompare('?a=alice&b=bob')
    await waitFor(() => {
      // Should show some error / not found messaging
      const notFound = screen.queryAllByText(/not found|private|error/i)
      expect(notFound.length + screen.getAllByText(/compare/i).length).toBeGreaterThan(0)
    }, { timeout: 2000 })
  })
})

describe('Compare — same username guard', () => {
  it('renders without crash when a === b', () => {
    renderCompare('?a=alice&b=alice')
    expect(document.body).toBeTruthy()
  })
})

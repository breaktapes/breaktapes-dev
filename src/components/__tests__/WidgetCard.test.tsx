/**
 * WidgetCard — RTL tests
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { WidgetCard, WidgetCardContext, markWidgetDetailDiscovered } from '../WidgetCard'

function renderWithCtx(ui: React.ReactNode, openDetail = vi.fn()) {
  return {
    openDetail,
    ...render(
      <WidgetCardContext.Provider value={{ openDetail, actions: {} }}>
        {ui}
      </WidgetCardContext.Provider>
    ),
  }
}

describe('WidgetCard', () => {
  beforeEach(() => { localStorage.clear() })

  it('fires openDetail on card click with id + preview (children)', () => {
    const { openDetail } = renderWithCtx(
      <WidgetCard id="boston-qual"><span>body</span></WidgetCard>
    )
    fireEvent.click(screen.getByRole('button', { name: /boston qual/i }))
    expect(openDetail).toHaveBeenCalled()
    const call = openDetail.mock.calls[0]
    expect(call[0]).toBe('boston-qual')
    // 2nd arg is preview (React children); 3rd is undefined (no dynamicContext)
    expect(call[1]).toBeTruthy()
    expect(call[2]).toBeUndefined()
  })

  it('passes dynamicContext as 3rd arg to openDetail', () => {
    const ctx = { primaryMetric: { label: 'Gap', value: '4:22' } }
    const { openDetail } = renderWithCtx(
      <WidgetCard id="boston-qual" dynamicContext={ctx}><span>body</span></WidgetCard>
    )
    fireEvent.click(screen.getByRole('button'))
    const call = openDetail.mock.calls[0]
    expect(call[0]).toBe('boston-qual')
    expect(call[2]).toBe(ctx)
  })

  it('does NOT fire openDetail when a nested button is clicked', () => {
    const { openDetail } = renderWithCtx(
      <WidgetCard id="boston-qual">
        <button>Inner CTA</button>
      </WidgetCard>
    )
    fireEvent.click(screen.getByText('Inner CTA'))
    expect(openDetail).not.toHaveBeenCalled()
  })

  it('does NOT fire openDetail when a child with data-no-widget-detail is clicked', () => {
    const { openDetail } = renderWithCtx(
      <WidgetCard id="boston-qual">
        <div data-no-widget-detail data-testid="shielded">shielded</div>
      </WidgetCard>
    )
    fireEvent.click(screen.getByTestId('shielded'))
    expect(openDetail).not.toHaveBeenCalled()
  })

  it('fires openDetail on Enter key', () => {
    const { openDetail } = renderWithCtx(
      <WidgetCard id="boston-qual"><span>body</span></WidgetCard>
    )
    const card = screen.getByRole('button')
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(openDetail).toHaveBeenCalled()
  })

  it('fires openDetail on Space key', () => {
    const { openDetail } = renderWithCtx(
      <WidgetCard id="boston-qual"><span>body</span></WidgetCard>
    )
    const card = screen.getByRole('button')
    fireEvent.keyDown(card, { key: ' ' })
    expect(openDetail).toHaveBeenCalled()
  })

  it('has role=button, tabIndex=0, and aria-label', () => {
    renderWithCtx(
      <WidgetCard id="boston-qual"><span>body</span></WidgetCard>
    )
    const card = screen.getByRole('button')
    expect(card).toHaveAttribute('tabIndex', '0')
    expect(card).toHaveAttribute('aria-label')
  })

  it('shows ⓘ hint when not discovered', () => {
    renderWithCtx(
      <WidgetCard id="boston-qual"><span>body</span></WidgetCard>
    )
    // Hint is a span with "i" — find it as text inside the card
    const card = screen.getByRole('button')
    expect(card.textContent).toContain('i')
  })

  it('hides ⓘ hint after markWidgetDetailDiscovered runs', () => {
    const { rerender } = renderWithCtx(
      <WidgetCard id="boston-qual"><span>unique-body-text</span></WidgetCard>
    )
    markWidgetDetailDiscovered()
    rerender(
      <WidgetCardContext.Provider value={{ openDetail: vi.fn(), actions: {} }}>
        <WidgetCard id="boston-qual"><span>unique-body-text</span></WidgetCard>
      </WidgetCardContext.Provider>
    )
    // After discovered flag set, only the child span remains; no hint "i"
    const card = screen.getByRole('button')
    const kids = Array.from(card.children)
    // Hint span has aria-hidden="true"; find it
    const hint = kids.find(el => el.getAttribute('aria-hidden') === 'true')
    expect(hint).toBeUndefined()
  })

  it('renders as non-interactive div when no context provided', () => {
    render(<WidgetCard id="boston-qual"><span>body</span></WidgetCard>)
    const divs = document.querySelectorAll('[data-widget-id="boston-qual"]')
    expect(divs.length).toBe(1)
    expect(divs[0]).not.toHaveAttribute('role')
    expect(divs[0]).not.toHaveAttribute('tabIndex')
  })
})

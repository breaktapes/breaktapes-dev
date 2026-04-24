/**
 * WidgetDetailModal — RTL tests
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { WidgetDetailModal } from '../WidgetDetailModal'
import type { DashWidget } from '@/types'

const bostonQual: DashWidget = {
  id: 'boston-qual',
  label: 'Boston Qualifier',
  icon: '🏅',
  zone: 'context',
  enabled: true,
  pro: false,
}

const fakePro: DashWidget = {
  id: 'race-forecast',
  label: 'Race Day Forecast',
  icon: '🌤',
  zone: 'now',
  enabled: true,
  pro: true,
}

const unknownWidget: DashWidget = {
  id: 'does-not-exist',
  label: 'Unknown',
  icon: '?',
  zone: 'now',
  enabled: true,
  pro: false,
}

function renderModal(widget: DashWidget, extraProps: Partial<Parameters<typeof WidgetDetailModal>[0]> = {}) {
  const onClose = vi.fn()
  const utils = render(
    <MemoryRouter>
      <WidgetDetailModal widget={widget} onClose={onClose} {...extraProps} />
    </MemoryRouter>
  )
  return { ...utils, onClose }
}

describe('WidgetDetailModal', () => {
  beforeEach(() => { document.body.innerHTML = ''; localStorage.clear() })

  it('renders authored copy for known widget', () => {
    renderModal(bostonQual)
    expect(screen.getByText('BOSTON QUALIFIER')).toBeInTheDocument()
    // Should render all three sections
    expect(screen.getByText(/What it is/i)).toBeInTheDocument()
    expect(screen.getByText(/How to read it/i)).toBeInTheDocument()
    expect(screen.getByText(/How it impacts performance/i)).toBeInTheDocument()
  })

  it('shows PRO pill for pro-gated widget', () => {
    renderModal(fakePro)
    expect(screen.getByText('PRO')).toBeInTheDocument()
  })

  it('renders fallback copy for unknown widget id', () => {
    renderModal(unknownWidget)
    expect(screen.getByText('DOES NOT EXIST')).toBeInTheDocument()
  })

  it('close button fires onClose', () => {
    const { onClose } = renderModal(bostonQual)
    fireEvent.click(screen.getByLabelText(/Close widget detail/i))
    expect(onClose).toHaveBeenCalled()
  })

  it('backdrop click fires onClose', () => {
    const { onClose } = renderModal(bostonQual)
    const overlay = document.querySelector('[role="presentation"]')!
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalled()
  })

  it('sheet click does NOT fire onClose', () => {
    const { onClose } = renderModal(bostonQual)
    const sheet = document.querySelector('[role="dialog"]')!
    fireEvent.click(sheet)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Esc key fires onClose', () => {
    const { onClose } = renderModal(bostonQual)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('body overflow is set to hidden on mount, restored on unmount', () => {
    document.body.style.overflow = 'auto'
    const { unmount } = renderModal(bostonQual)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('auto')
  })

  it('sets fl2_widget_detail_discovered on mount', () => {
    renderModal(bostonQual)
    expect(localStorage.getItem('fl2_widget_detail_discovered')).toBe('1')
  })

  it('renders dynamic primaryMetric when supplied', () => {
    renderModal(bostonQual, {
      dynamicContext: {
        primaryMetric: { label: 'Your gap', value: '4:22 to BQ' },
        comparisons: [{ label: 'Window', value: '2025-2026' }],
      },
    })
    expect(screen.getByText('Your gap')).toBeInTheDocument()
    expect(screen.getByText('4:22 to BQ')).toBeInTheDocument()
    expect(screen.getByText('Window')).toBeInTheDocument()
    expect(screen.getByText('2025-2026')).toBeInTheDocument()
  })

  it('omits dynamic section when no context provided', () => {
    renderModal(bostonQual)
    expect(screen.queryByText('Your gap')).not.toBeInTheDocument()
  })

  it('renders related action buttons', () => {
    renderModal(bostonQual)
    // boston-qual has 'View all marathons' and 'Find next qualifier' as related actions
    expect(screen.getByText(/View all marathons/i)).toBeInTheDocument()
  })

  it('invokes symbolic action on related button click', () => {
    const openAddRace = vi.fn()
    const { onClose } = renderModal({
      id: 'race-readiness',
      label: 'Race Readiness',
      icon: '🟢',
      zone: 'now',
      enabled: true,
    }, {
      actions: { openAddRace },
    })
    // race-readiness has 'Connect a wearable' → /settings. Test the nav action.
    fireEvent.click(screen.getByText(/Connect a wearable/i))
    // Should close modal (navigate happens)
    expect(onClose).toHaveBeenCalled()
  })
})

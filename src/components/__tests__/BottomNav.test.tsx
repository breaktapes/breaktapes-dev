/**
 * BottomNav — RTL tests
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BottomNav } from '../BottomNav'

function renderNav(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BottomNav />
    </MemoryRouter>
  )
}

describe('BottomNav', () => {
  it('renders all 5 tabs', () => {
    renderNav()
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Races')).toBeInTheDocument()
    expect(screen.getByText('Train')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('More')).toBeInTheDocument()
  })

  it('has role="navigation" with accessible label', () => {
    renderNav()
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
  })

  it('marks Home tab active on /', () => {
    renderNav('/')
    const homeLink = screen.getByText('Home').closest('a')!
    expect(homeLink).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark Home active on /races', () => {
    renderNav('/races')
    const homeLink = screen.getByText('Home').closest('a')!
    expect(homeLink).not.toHaveAttribute('aria-current', 'page')
  })

  it('marks Races tab active on /races', () => {
    renderNav('/races')
    const racesLink = screen.getByText('Races').closest('a')!
    expect(racesLink).toHaveAttribute('aria-current', 'page')
  })

  it('marks Train tab active on /train', () => {
    renderNav('/train')
    const trainLink = screen.getByText('Train').closest('a')!
    expect(trainLink).toHaveAttribute('aria-current', 'page')
  })

  it('marks You tab active on /you', () => {
    renderNav('/you')
    const youLink = screen.getByText('You').closest('a')!
    expect(youLink).toHaveAttribute('aria-current', 'page')
  })

  it('marks More tab active on /settings', () => {
    renderNav('/settings')
    const moreLink = screen.getByText('More').closest('a')!
    expect(moreLink).toHaveAttribute('aria-current', 'page')
  })

  it('only one tab is active at a time', () => {
    renderNav('/races')
    const activeLinks = screen.queryAllByRole('link', { current: 'page' })
    expect(activeLinks).toHaveLength(1)
  })

  it('each tab has an href pointing to its route', () => {
    renderNav()
    expect(screen.getByText('Home').closest('a')).toHaveAttribute('href', '/')
    expect(screen.getByText('Races').closest('a')).toHaveAttribute('href', '/races')
    expect(screen.getByText('Train').closest('a')).toHaveAttribute('href', '/train')
    expect(screen.getByText('You').closest('a')).toHaveAttribute('href', '/you')
    expect(screen.getByText('More').closest('a')).toHaveAttribute('href', '/settings')
  })
})

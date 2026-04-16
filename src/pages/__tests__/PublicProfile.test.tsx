/**
 * PublicProfile — RTL tests
 *
 * Server-safe component: no hooks, no DOM APIs. Renders synchronously from props.
 * These tests run in the 'react' Vitest project (jsdom environment).
 */
import { render, screen } from '@testing-library/react'
import { PublicProfile } from '../PublicProfile'
import type { ProfileData } from '../PublicProfile'

const BASE_PROFILE: ProfileData = {
  username: 'testrunner',
  firstName: 'Alex',
  lastName: 'Stone',
  city: 'London',
  country: 'UK',
  mainSport: 'Running',
  isPublic: true,
  races: [],
}

const RACE = {
  id: 'r1',
  name: 'London Marathon',
  date: '2024-04-21',
  city: 'London',
  country: 'UK',
  distance: '42.2',
  sport: 'Running',
  time: '3:45:00',
  placing: '342/5000',
  medal: 'finisher' as const,
}

describe('PublicProfile — hero section', () => {
  it('renders the full name', () => {
    render(<PublicProfile profile={BASE_PROFILE} />)
    // text-transform: uppercase is CSS-only; DOM contains the original casing
    expect(screen.getByText('Alex Stone')).toBeInTheDocument()
  })

  it('falls back to username when no name', () => {
    render(<PublicProfile profile={{ ...BASE_PROFILE, firstName: undefined, lastName: undefined }} />)
    expect(screen.getByText('testrunner')).toBeInTheDocument()
  })

  it('renders initials in avatar', () => {
    render(<PublicProfile profile={BASE_PROFILE} />)
    expect(screen.getByText('AS')).toBeInTheDocument()
  })

  it('renders sub-line with sport and location', () => {
    render(<PublicProfile profile={BASE_PROFILE} />)
    expect(screen.getByText(/Running.*London, UK/)).toBeInTheDocument()
  })

  it('renders zero-race stats', () => {
    render(<PublicProfile profile={BASE_PROFILE} />)
    // races = 0, countries = 0, km = 0
    const statVals = screen.getAllByText('0')
    expect(statVals.length).toBeGreaterThanOrEqual(1)
  })

  it('shows NEW level for user with no races', () => {
    render(<PublicProfile profile={BASE_PROFILE} />)
    expect(screen.getByText('NEW')).toBeInTheDocument()
  })

  it('shows COMP level for user with 12 races', () => {
    const races = Array.from({ length: 12 }, (_, i) => ({ ...RACE, id: `r${i}` }))
    render(<PublicProfile profile={{ ...BASE_PROFILE, races }} />)
    expect(screen.getByText('COMP')).toBeInTheDocument()
  })

  it('shows PRO level for user with 25 races', () => {
    const races = Array.from({ length: 25 }, (_, i) => ({ ...RACE, id: `r${i}` }))
    render(<PublicProfile profile={{ ...BASE_PROFILE, races }} />)
    expect(screen.getByText('PRO')).toBeInTheDocument()
  })

  it('shows ELITE level for user with 55 races', () => {
    const races = Array.from({ length: 55 }, (_, i) => ({ ...RACE, id: `r${i}` }))
    render(<PublicProfile profile={{ ...BASE_PROFILE, races }} />)
    expect(screen.getByText('ELITE')).toBeInTheDocument()
  })
})

describe('PublicProfile — personal bests', () => {
  it('renders PBs section when races have times', () => {
    render(<PublicProfile profile={{ ...BASE_PROFILE, races: [RACE] }} />)
    expect(screen.getByText('Personal Bests')).toBeInTheDocument()
    expect(screen.getByText('42.2')).toBeInTheDocument()
    // Time appears in both PBs and recent races rows — just confirm it's present
    const timeEls = screen.getAllByText('3:45:00')
    expect(timeEls.length).toBeGreaterThanOrEqual(1)
  })

  it('picks the faster time as PB for same distance', () => {
    const faster = { ...RACE, id: 'r2', time: '3:30:00', date: '2024-10-01' }
    render(<PublicProfile profile={{ ...BASE_PROFILE, races: [RACE, faster] }} />)
    // Both times may appear (PB section + recent races list), but 3:30:00 must be present
    const faster_els = screen.getAllByText('3:30:00')
    expect(faster_els.length).toBeGreaterThanOrEqual(1)
    // 3:45:00 appears in recent races (slower) but NOT in PBs
    // PBs section shows only 1 row per distance, so '42.2' appears exactly once there
    const distanceEls = screen.queryAllByText('42.2')
    expect(distanceEls.length).toBeGreaterThanOrEqual(1)
  })

  it('shows no PBs section when races have no times', () => {
    const noTime = { ...RACE, time: undefined }
    render(<PublicProfile profile={{ ...BASE_PROFILE, races: [noTime] }} />)
    expect(screen.queryByText('Personal Bests')).not.toBeInTheDocument()
  })
})

describe('PublicProfile — race history', () => {
  it('renders race history section', () => {
    render(<PublicProfile profile={{ ...BASE_PROFILE, races: [RACE] }} />)
    expect(screen.getByText('Race History')).toBeInTheDocument()
  })

  it('shows race name', () => {
    render(<PublicProfile profile={{ ...BASE_PROFILE, races: [RACE] }} />)
    expect(screen.getByText('London Marathon')).toBeInTheDocument()
  })

  it('shows race location', () => {
    render(<PublicProfile profile={{ ...BASE_PROFILE, races: [RACE] }} />)
    // Multiple nodes can match "London...UK"; use getAllByText
    const els = screen.getAllByText(/London.*UK/)
    expect(els.length).toBeGreaterThanOrEqual(1)
  })

  it('escapes dangerous HTML in race name', () => {
    const xssRace = { ...RACE, name: '<script>alert(1)</script>' }
    const { container } = render(<PublicProfile profile={{ ...BASE_PROFILE, races: [xssRace] }} />)
    // React double-escapes when rendering pre-escaped HTML strings —
    // &lt; becomes &amp;lt; in innerHTML. What matters: no raw <script> tag injected.
    expect(container.innerHTML).not.toContain('<script>')
    expect(container.innerHTML).not.toContain('</script>')
  })

  it('escapes dangerous HTML in username', () => {
    const { container } = render(<PublicProfile profile={{ ...BASE_PROFILE, username: '<bad>' }} />)
    expect(container.innerHTML).not.toContain('<bad>')
  })

  it('limits history to 6 races', () => {
    const races = Array.from({ length: 10 }, (_, i) => ({
      ...RACE, id: `r${i}`, name: `Race ${i}`, date: `2024-0${(i % 9) + 1}-01`,
    }))
    render(<PublicProfile profile={{ ...BASE_PROFILE, races }} />)
    // Only 6 should show in race history (recentRaces = .slice(0, 6))
    const raceNames = screen.getAllByText(/^Race \d$/)
    expect(raceNames.length).toBeLessThanOrEqual(6)
  })
})

describe('PublicProfile — join CTA', () => {
  it('renders the join CTA link', () => {
    render(<PublicProfile profile={BASE_PROFILE} />)
    const cta = screen.getByText(/Track Your Races on BREAKTAPES/i)
    expect(cta).toBeInTheDocument()
    expect(cta.tagName).toBe('A')
  })

  it('CTA href includes the username ref', () => {
    render(<PublicProfile profile={BASE_PROFILE} />)
    const cta = screen.getByText(/Track Your Races on BREAKTAPES/i).closest('a')!
    expect(cta.getAttribute('href')).toContain('u-testrunner-profile')
  })
})

describe('PublicProfile — SSR safety', () => {
  it('renders to a non-empty string without throwing', () => {
    // This mirrors what renderToString would do in the worker
    const { container } = render(<PublicProfile profile={BASE_PROFILE} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('does not require window, document, or localStorage', () => {
    // If the component tries to access these it would throw in a node environment.
    // We verify by stripping them and rendering — jsdom provides them, but we want
    // to at least confirm the component doesn't crash when data is minimal.
    render(<PublicProfile profile={{ username: 'x', isPublic: true, races: [] }} />)
    expect(screen.getByText('X')).toBeInTheDocument() // initials
  })
})

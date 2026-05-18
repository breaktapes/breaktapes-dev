import { useNavigate, useLocation, NavLink } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { useSyncState, useUserStateRealtime } from '@/hooks/useSyncState'

function DataSync() {
  useSyncState()
  useUserStateRealtime()
  return null
}

const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)

const IconHome  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>
const IconRaces = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="16" y2="18"/></svg>
const IconTrain = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,12 6,12 8.5,5 11.5,19 14,12 16,12 17.5,7.5 19,12 22,12"/></svg>
const IconYou   = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="7" r="4"/><path d="M4 21c0-4.418 3.582-8 8-8s8 3.582 8 8"/></svg>

const SIDEBAR_TABS = [
  { to: '/',      label: 'Home',  Icon: IconHome  },
  { to: '/races', label: 'Races', Icon: IconRaces },
  { to: '/train', label: 'Train', Icon: IconTrain },
  { to: '/you',   label: 'You',   Icon: IconYou   },
] as const

function DesktopSidebar() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const onSettings = location.pathname === '/settings'

  return (
    <nav className="app-sidebar" aria-label="Main navigation">
      {/* Wordmark */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--headline)', fontSize: '18px', fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)' }}>
          BREAK<span style={{ color: 'var(--orange)' }}>/</span>TAPES
        </span>
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 0', overflowY: 'auto' }}>
        {SIDEBAR_TABS.map(({ to, label, Icon }) => {
          const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              aria-current={isActive ? 'page' : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 16px',
                textDecoration: 'none',
                color: isActive ? 'var(--orange)' : 'var(--muted)',
                background: isActive ? 'rgba(var(--orange-ch), 0.08)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--orange)' : '2px solid transparent',
                transition: 'all 0.15s ease',
                fontFamily: 'var(--headline)',
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              <Icon />
              {label}
            </NavLink>
          )
        })}
      </div>

      {/* Settings */}
      <div style={{ flexShrink: 0, padding: '12px', borderTop: '1px solid var(--border)' }}>
        <button
          aria-label={onSettings ? 'Close settings' : 'Open settings'}
          onClick={() => onSettings ? navigate(-1) : navigate('/settings')}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            width: '100%', padding: '10px 12px',
            background: onSettings ? 'rgba(var(--orange-ch), 0.08)' : 'transparent',
            border: `1px solid ${onSettings ? 'var(--orange)' : 'var(--border2)'}`,
            borderRadius: '8px',
            color: onSettings ? 'var(--orange)' : 'var(--muted)',
            cursor: 'pointer',
            fontFamily: 'var(--headline)',
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          <IconSettings />
          Settings
        </button>
      </div>
    </nav>
  )
}

export function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const onSettings = location.pathname === '/settings'

  return (
    <div
      className="app-shell"
      style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--black)' }}
    >
      <DataSync />

      {/* Desktop-only sidebar */}
      <DesktopSidebar />

      {/* Mobile-only header */}
      <header
        className="app-header-mobile"
        style={{
          height: 'calc(var(--header-base-height) + var(--safe-top, 0px))',
          paddingTop: 'var(--safe-top, 0px)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--safe-top, 0px) 16px 0',
          borderBottom: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        <span style={{ fontFamily: 'var(--headline)', fontSize: '20px', fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)' }}>
          BREAK<span style={{ color: 'var(--orange)' }}>/</span>TAPES
        </span>
        <button
          aria-label={onSettings ? 'Close settings' : 'Open settings'}
          onClick={() => onSettings ? navigate(-1) : navigate('/settings')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '36px', height: '36px',
            background: 'var(--surface2)',
            border: `1px solid ${onSettings ? 'var(--orange)' : 'var(--border2)'}`,
            borderRadius: '8px',
            color: onSettings ? 'var(--orange)' : 'var(--muted)',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <IconSettings />
        </button>
      </header>

      <main
        className="app-main"
        style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative', WebkitOverflowScrolling: 'touch' as any }}
      >
        {children}
      </main>

      {/* Mobile-only bottom nav */}
      <div className="app-bottom-nav">
        <BottomNav />
      </div>
    </div>
  )
}

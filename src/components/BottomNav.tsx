import { NavLink, useLocation } from 'react-router-dom'

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const IconHome = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"/>
    <path d="M9 21V12h6v9"/>
  </svg>
)

const IconRaces = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <line x1="3" y1="6"  x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="16" y2="18"/>
  </svg>
)

const IconTrain = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="2,12 6,12 8.5,5 11.5,19 14,12 16,12 17.5,7.5 19,12 22,12"/>
  </svg>
)

const IconYou = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="7" r="4"/>
    <path d="M4 21c0-4.418 3.582-8 8-8s8 3.582 8 8"/>
  </svg>
)

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV_TABS = [
  { to: '/',      label: 'Home',  Icon: IconHome  },
  { to: '/races', label: 'Races', Icon: IconRaces },
  { to: '/train', label: 'Train', Icon: IconTrain },
  { to: '/you',   label: 'You',   Icon: IconYou   },
] as const

// ─── Component ────────────────────────────────────────────────────────────────

export function BottomNav() {
  const location = useLocation()

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      style={{
        height: 'calc(var(--bottom-nav-base-height) + var(--safe-bottom))',
        paddingBottom: 'var(--safe-bottom)',
        flexShrink: 0,
        display: 'flex',
        borderTop: '1px solid var(--border2)',
        background: 'linear-gradient(180deg, var(--surface2) 0%, var(--surface) 100%)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 -2px 24px rgba(0,0,0,0.3), inset 0 1px 0 var(--border)',
      }}
    >
      {NAV_TABS.map(({ to, label, Icon }) => {
        const isActive = to === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(to)

        return (
          <NavLink
            key={to}
            to={to}
            aria-current={isActive ? 'page' : undefined}
            style={{
              flex: 1,
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              textDecoration: 'none',
              color: isActive ? 'var(--orange)' : 'var(--muted)',
              minHeight: '44px',
              background: isActive
                ? 'linear-gradient(180deg, rgba(var(--orange-ch), 0.10) 0%, rgba(var(--orange-ch), 0.04) 100%)'
                : 'transparent',
              transition: 'background 0.18s ease',
            }}
          >
            <Icon />
            <span style={{
              fontFamily: 'var(--headline)',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: isActive ? 'var(--orange)' : 'var(--muted)',
              transition: 'color 0.18s',
            }}>
              {label}
            </span>
            {isActive && (
              <span
                style={{
                  position: 'absolute',
                  top: 0, left: '20%', right: '20%',
                  height: '2px',
                  background: 'linear-gradient(135deg, var(--orange) 0%, color-mix(in srgb, var(--orange) 70%, black) 100%)',
                  borderRadius: '0 0 3px 3px',
                  boxShadow: '0 0 10px rgba(var(--orange-ch), 0.6)',
                  animation: 'fadeIn 0.15s ease-out',
                }}
              />
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}

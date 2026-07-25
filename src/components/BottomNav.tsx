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
        padding: '6px 12px calc(6px + var(--safe-bottom))',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, rgba(5,5,5,0.08) 0%, rgba(5,5,5,0.32) 100%)',
        backdropFilter: 'blur(18px)',
      }}
    >
      <div
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '8px',
          padding: '8px',
          borderRadius: '18px',
          border: '1px solid var(--border2)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
          boxShadow: '0 -10px 30px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.04)',
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
              data-tour={`nav-${to === '/' ? 'home' : to.slice(1)}`}
              style={{
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                minHeight: '54px',
                borderRadius: '14px',
                textDecoration: 'none',
                color: isActive ? 'var(--white)' : 'var(--muted)',
                background: isActive
                  ? 'linear-gradient(180deg, rgba(var(--orange-ch), 0.18) 0%, rgba(var(--orange-ch), 0.08) 100%)'
                  : 'transparent',
                boxShadow: isActive
                  ? 'inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 18px rgba(0,0,0,0.22)'
                  : 'none',
                transition: 'background 0.18s ease, color 0.18s ease, transform 0.18s ease',
                transform: isActive ? 'translateY(-1px)' : 'translateY(0)',
              }}
            >
              {isActive && (
                <span
                  style={{
                    position: 'absolute',
                    inset: '0 auto auto 50%',
                    transform: 'translateX(-50%)',
                    width: '30px',
                    height: '3px',
                    borderRadius: '999px',
                    background: 'linear-gradient(90deg, rgba(var(--orange-ch),0.7) 0%, var(--orange) 100%)',
                    boxShadow: '0 0 14px rgba(var(--orange-ch),0.38)',
                  }}
                />
              )}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  color: isActive ? 'var(--orange)' : 'var(--muted)',
                  transition: 'color 0.18s ease',
                }}
              >
                <Icon />
              </span>
              <span style={{
                fontFamily: 'var(--headline)',
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: isActive ? 'var(--white)' : 'var(--muted)',
                transition: 'color 0.18s ease',
              }}>
                {label}
              </span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

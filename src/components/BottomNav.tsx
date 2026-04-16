import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'

const NAV_TABS = [
  { to: '/',          label: 'Home',  icon: '⬜' },
  { to: '/races',     label: 'Races', icon: '🏁' },
  { to: '/train',     label: 'Train', icon: '📈' },
  { to: '/you',       label: 'You',   icon: '👤' },
  { to: '/settings',  label: 'More',  icon: '···' },
] as const

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
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
      }}
    >
      {NAV_TABS.map(tab => {
        const isActive = tab.to === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(tab.to)

        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            aria-current={isActive ? 'page' : undefined}
            style={{
              flex: 1,
              position: 'relative',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '3px',
              textDecoration: 'none',
              color: isActive ? 'var(--orange)' : 'var(--muted)',
              fontSize: '18px',
              minHeight: '44px',  // a11y: 44px touch target
            }}
          >
            <span style={{ fontSize: tab.label === 'More' ? '14px' : '18px' }}>
              {tab.icon}
            </span>
            <span style={{
              fontFamily: 'var(--body)',
              fontSize: '10px',
              fontWeight: isActive ? 600 : 400,
              letterSpacing: '0.02em',
            }}>
              {tab.label}
            </span>
            {isActive && (
              <motion.span
                layoutId="nav-indicator"
                style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0,
                  height: '2px',
                  background: 'var(--orange)',
                  borderRadius: '0 0 2px 2px',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}

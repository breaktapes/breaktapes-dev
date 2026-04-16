import { NavLink } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { useSyncState } from '@/hooks/useSyncState'

function DataSync() {
  useSyncState()
  return null
}

const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      background: 'var(--black)',
    }}>
      <DataSync />

      <header style={{
        height: 'var(--header-base-height)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{
          fontFamily: 'var(--headline)',
          fontSize: '20px',
          fontWeight: 900,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--white)',
        }}>
          BREAK<span style={{ color: 'var(--orange)' }}>/</span>TAPES
        </span>

        <NavLink
          to="/settings"
          aria-label="Settings"
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            background: 'var(--surface2)',
            border: `1px solid ${isActive ? 'var(--orange)' : 'var(--border2)'}`,
            borderRadius: '8px',
            color: isActive ? 'var(--orange)' : 'var(--muted)',
            textDecoration: 'none',
            flexShrink: 0,
          })}
        >
          <IconSettings />
        </NavLink>
      </header>

      <main style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        position: 'relative',
        WebkitOverflowScrolling: 'touch' as any,
      }}>
        {children}
      </main>

      <BottomNav />
    </div>
  )
}

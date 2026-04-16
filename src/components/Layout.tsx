import { BottomNav } from './BottomNav'
import { useSyncState } from '@/hooks/useSyncState'

/** Fires after auth resolves — loads remote state from Supabase into stores. */
function DataSync() {
  useSyncState()
  return null
}

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
        display: 'flex', alignItems: 'center',
        padding: '0 16px',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{
          fontFamily: 'var(--headline)',
          fontSize: '16px', fontWeight: 900,
          letterSpacing: '0.18em', textTransform: 'uppercase',
          color: 'var(--white)',
        }}>
          BREAKTAPES
        </span>
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

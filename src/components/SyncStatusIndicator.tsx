import { useAuthStore } from '@/stores/useAuthStore'

/**
 * Unobtrusive global indicator that surfaces sync failures to the user.
 *
 * Sync write failures were previously silent — `syncStateToSupabase()` flips
 * `useAuthStore.syncStatus` to 'error' but nothing visible told the user their
 * changes hadn't saved (errors are console.warn-swallowed).
 *
 * This is display-only: it renders ONLY when `syncStatus === 'error'` and reads
 * straight from the store. The store flips back to 'syncing'/'ok' on the next
 * sync attempt, which hides it automatically. No retry logic lives here.
 */
export function SyncStatusIndicator() {
  const syncStatus = useAuthStore(s => s.syncStatus)
  if (syncStatus !== 'error') return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 'calc(var(--bottom-nav-base-height, 64px) + var(--safe-bottom, 0px) + 12px)',
        zIndex: 1000,
        maxWidth: 'calc(100vw - 32px)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        background: 'var(--surface2)',
        border: '1px solid rgba(var(--orange-ch), 0.55)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        color: 'var(--white)',
        fontFamily: 'var(--body)',
        fontSize: 'var(--text-compact)',
        fontWeight: 600,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      <span aria-hidden="true" style={{ color: 'var(--orange)' }}>⚠</span>
      Changes not saved — we'll retry
    </div>
  )
}

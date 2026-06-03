import { useEffect, useRef, useState } from 'react'
import { useUser, useAuth, useClerk, SignIn } from '@clerk/clerk-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { setClerkToken, getClerkToken } from '@/lib/supabase'
import { IS_STAGING } from '@/env'
import { posthog } from '@/lib/posthog'
import { Admin } from '@/pages/Admin'

// admin.breaktapes.com runs a self-contained shell: Clerk sign-in → admin
// allowlist check → the dashboard. Deliberately does NOT mount the athlete
// Layout (no bottom nav, no settings header) or the athlete data sync
// (useSyncState), so signing in here never reads or writes athlete state.

const JWT_TEMPLATE = IS_STAGING ? 'supabase-staging' : 'supabase'

// Lighter than AuthGate's useClerkSync: installs the Clerk JWT + sets authUser
// so the /api/admin/* Authorization header + check probe work. Skips the
// athlete identity sync + bootstrap backfill entirely — admin host must never
// touch the user's race/profile row.
function useAdminAuth() {
  const { isLoaded, isSignedIn, user } = useUser()
  const { getToken } = useAuth()
  const setAuthUser = useAuthStore(s => s.setAuthUser)

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn || !user) {
      setAuthUser(null)
      setClerkToken(null)
      posthog.reset()
      return
    }

    let cancelled = false
    const refresh = async () => {
      let t: string | null = null
      try { t = await getToken({ template: JWT_TEMPLATE }) } catch { /* template missing */ }
      if (!t) t = await getToken()
      if (cancelled) return
      setClerkToken(t)
      setAuthUser({ id: user.id, email: user.primaryEmailAddress?.emailAddress ?? null })
      posthog.identify(user.id, { email: user.primaryEmailAddress?.emailAddress ?? undefined, username: user.username ?? undefined })
    }
    refresh()
    const interval = setInterval(refresh, 50_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [isLoaded, isSignedIn, user, getToken, setAuthUser])
}

const clerkAppearance = {
  variables: {
    colorPrimary: '#E84E1B',
    colorBackground: '#141414',
    colorInputBackground: '#1A1A1A',
    colorInputText: '#F5F5F5',
    colorText: '#F5F5F5',
    colorTextSecondary: 'rgba(245,245,245,0.55)',
    colorNeutral: '#F5F5F5',
    fontFamily: 'Barlow, sans-serif',
  },
  elements: {
    card: { background: '#141414', border: '1px solid rgba(245,245,245,0.08)', boxShadow: '0 24px 48px rgba(0,0,0,0.6)' },
    headerTitle: { fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '0.1em' },
    formButtonPrimary: { background: '#E84E1B', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, letterSpacing: '0.1em' },
  },
}

function CenteredSignIn() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--black)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-6)', padding: '24px' }}>
      <span style={{ fontFamily: 'var(--headline)', fontSize: 'var(--text-xl)', fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--white)' }}>
        BREAK<span style={{ color: 'var(--orange)' }}>/</span>TAPES <span style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>ADMIN</span>
      </span>
      <SignIn routing="virtual" appearance={clerkAppearance} />
    </div>
  )
}

function Loading() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--black)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-6)' }}>
      <span style={{ fontFamily: 'var(--headline)', fontSize: 'var(--text-xl)', fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>BREAKTAPES ADMIN</span>
      <div style={{ width: '6px', height: '6px', borderRadius: 'var(--radius-round)', background: 'var(--orange)', animation: 'bt-pulse 1.2s ease-in-out infinite' }} />
    </div>
  )
}

function AdminGate() {
  const { isLoaded, isSignedIn } = useUser()
  const { signOut } = useClerk()
  const authUser = useAuthStore(s => s.authUser)
  const didView = useRef(false)
  // Authorization is decided by the Worker, not a client-side list. We probe
  // /api/admin/check once the Clerk JWT is installed; 200 = allowed, 403 =
  // denied. No admin user IDs are shipped in the bundle.
  const [authz, setAuthz] = useState<'checking' | 'allowed' | 'denied'>('checking')
  useAdminAuth()

  useEffect(() => {
    if (isSignedIn && !didView.current) { didView.current = true; posthog.capture('admin_host_opened') }
  }, [isSignedIn])

  // Probe once the token is installed (authUser flips non-null right after
  // setClerkToken in useAdminAuth, so getClerkToken() is ready by then).
  useEffect(() => {
    if (!isSignedIn || !authUser) return
    let cancelled = false
    ;(async () => {
      try {
        const token = getClerkToken()
        const res = await fetch('/api/admin/check', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        if (!cancelled) setAuthz(res.ok ? 'allowed' : 'denied')
      } catch {
        if (!cancelled) setAuthz('denied')
      }
    })()
    return () => { cancelled = true }
  }, [isSignedIn, authUser])

  if (!isLoaded) return <Loading />
  if (!isSignedIn) return <CenteredSignIn />
  if (authz === 'checking') return <Loading />

  if (authz === 'denied') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'var(--black)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-4)', padding: '24px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--headline)', fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--orange)' }}>403</div>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-lg)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--white)' }}>Not authorised</div>
        <p style={{ color: 'var(--muted)', fontSize: 'var(--text-compact)', maxWidth: '320px', lineHeight: 1.5 }}>This account doesn't have admin access. Sign in with an authorised account.</p>
        <button onClick={() => signOut()} style={{ background: 'var(--surface2)', color: 'var(--white)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-md)', padding: '10px 24px', fontFamily: 'var(--headline)', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', fontSize: 'var(--text-compact)' }}>Sign out</button>
      </div>
    )
  }

  // #root is `overflow:hidden` globally (the athlete app scrolls inside
  // Layout's inner <main>). AdminApp has no Layout, so wrap the dashboard in
  // its own fixed scroll container or the page clips with no scroll on mobile.
  return (
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', background: 'var(--black)' }}>
      <Admin standalone onSignOut={() => signOut()} />
    </div>
  )
}

export function AdminApp() {
  return <AdminGate />
}

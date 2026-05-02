import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser, useAuth, SignIn, SignUp } from '@clerk/clerk-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { setClerkToken } from '@/lib/supabase'
import { syncStateToSupabase } from '@/lib/syncState'
import { IS_STAGING, APP_URL } from '@/env'
import { posthog } from '@/lib/posthog'

type AuthView = 'signin' | 'signup'

// Clerk JWT template name per environment. Production Clerk instance
// holds both templates — one per Supabase project (prod vs staging).
const JWT_TEMPLATE = IS_STAGING ? 'supabase-staging' : 'supabase'

// Keeps Zustand authUser + Supabase JWT in sync with Clerk session.
function useClerkSync() {
  const { isLoaded, isSignedIn, user } = useUser()
  const { getToken } = useAuth()
  const setAuthUser = useAuthStore(s => s.setAuthUser)
  const setProAccess = useAuthStore(s => s.setProAccess)
  const updateAthlete = useAthleteStore(s => s.updateAthlete)
  const didBootstrapSync = useRef(false)

  useEffect(() => {
    if (!isLoaded) return

    if (!isSignedIn || !user) {
      setAuthUser(null)
      setClerkToken(null)
      didBootstrapSync.current = false
      posthog.reset()
      return
    }

    // Sync Clerk username + photo → athlete store so public profile SSR has them.
    // Clerk is the source of truth; athlete store follows.
    const athleteUpdate: Record<string, string> = {}
    if (user.username) athleteUpdate.username = user.username
    if (user.imageUrl) athleteUpdate.imageUrl = user.imageUrl
    if (Object.keys(athleteUpdate).length) updateAthlete(athleteUpdate)

    let cancelled = false

    // Install Clerk JWT BEFORE flipping `authUser`. This is load-bearing:
    // `useSyncState` and every race-store write gate on `authUser`, and
    // Supabase RLS needs the token to authorize the request. If we set
    // authUser first, the race-condition window lets the initial pull hit
    // Supabase unauthenticated — it returns no rows, the query resolves
    // empty, and the second device shows stale/empty state forever until
    // the user manually triggers a write.
    const refresh = async () => {
      try {
        // Try the Supabase-scoped JWT template first; fall back to the raw
        // Clerk session token if the template isn't configured. Both tokens
        // contain sub=user_xxx and iss from Clerk, which is all /api/sync needs.
        // getToken({ template }) throws (not returns null) when template is
        // unconfigured in Clerk. Catch that specifically so the raw session
        // token fallback always runs.
        let t: string | null = null
        try { t = await getToken({ template: JWT_TEMPLATE }) } catch { /* template missing */ }
        if (!t) t = await getToken()
        if (cancelled) return
        setClerkToken(t)
        setAuthUser({
          id: user.id,
          email: user.primaryEmailAddress?.emailAddress ?? null,
        })
        // On staging, grant pro to all users. On prod, check Stripe subscription.
        if (IS_STAGING) {
          setProAccess(true)
        } else {
          // Fetch real pro status from Worker (reads Supabase pro_access column)
          void fetch(`${APP_URL}/api/stripe/status`, {
            headers: { Authorization: `Bearer ${t}` },
          }).then(r => r.json()).then((data: { pro?: boolean }) => {
            setProAccess(data.pro === true)
          }).catch(() => {/* network error — leave proAccess as false */})
        }
        posthog.identify(user.id, {
          email: user.primaryEmailAddress?.emailAddress ?? undefined,
          username: user.username ?? undefined,
          name: user.fullName ?? undefined,
        })

        // Bootstrap sync — fires exactly once per session after the JWT
        // is installed. Backfills the user_state row for users whose
        // localStorage already holds races/athlete data but never managed
        // a successful upsert (anyone who first signed in between the
        // 2026-04-23 truncate and the 2026-04-26 state_json migration).
        // Without this, the row stays missing until the next mutation.
        if (!didBootstrapSync.current) {
          didBootstrapSync.current = true
          void syncStateToSupabase()
        }
      } catch {
        // Leave authUser null on token failure — better to show landing
        // than to fire unauthenticated queries that pollute caches.
      }
    }

    refresh()
    const interval = setInterval(refresh, 50_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [isLoaded, isSignedIn, user, getToken, setAuthUser, setProAccess, updateAthlete])
}

// On dev.breaktapes.com, only users with publicMetadata.staging_access = true
// are allowed in. Grant access from Clerk dashboard → Users → select user →
// Metadata → Public → { "staging_access": true }.
function hasStagingAccess(user: { publicMetadata?: Record<string, unknown> } | null | undefined): boolean {
  if (!IS_STAGING) return true
  return user?.publicMetadata?.staging_access === true
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser()
  const navigate = useNavigate()

  useClerkSync()

  // Detect brand-new signups (Clerk user created < 2 min ago) and route
  // them to the profile onboarding page once. bt_new_user persists so
  // subsequent renders don't keep redirecting.
  useEffect(() => {
    if (!isSignedIn || !user) return

    const createdMs = user.createdAt ? new Date(user.createdAt).getTime() : 0
    const isFreshSignup = createdMs > 0 && Date.now() - createdMs < 120_000
    const hasFlag = localStorage.getItem('bt_new_user')

    if (isFreshSignup && !hasFlag) {
      localStorage.setItem('bt_new_user', '1')
      navigate('/you', { replace: true })
    } else if (hasFlag) {
      navigate('/you', { replace: true })
    }
  }, [isSignedIn, user, navigate])

  if (!isLoaded) return <AuthLoadingScreen />
  if (!isSignedIn) return <LandingScreen />
  if (!hasStagingAccess(user)) return <StagingAccessDenied />
  return <>{children}</>
}

function StagingAccessDenied() {
  const { signOut } = useAuth()
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--black)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '24px', padding: '2rem', textAlign: 'center',
    }}>
      <span style={{
        fontFamily: 'var(--headline)',
        fontSize: '22px', fontWeight: 900,
        letterSpacing: '0.18em', textTransform: 'uppercase',
        color: 'var(--muted)',
      }}>BREAKTAPES</span>
      <h1 style={{
        fontFamily: 'var(--headline)',
        fontSize: 'clamp(28px, 6vw, 48px)', fontWeight: 900,
        textTransform: 'uppercase', letterSpacing: '0.04em',
        color: 'var(--white)', margin: 0,
      }}>Invite Only</h1>
      <p style={{ color: 'var(--muted)', fontSize: '15px', maxWidth: '420px', lineHeight: 1.5 }}>
        dev.breaktapes.com is restricted to beta testers. Use{' '}
        <a href="https://app.breaktapes.com" style={{ color: 'var(--orange)' }}>app.breaktapes.com</a>{' '}
        instead, or request access from the team.
      </p>
      <button
        onClick={() => signOut()}
        style={{
          background: 'transparent', color: 'var(--white)',
          border: '1px solid var(--border2)', borderRadius: '4px',
          padding: '0.8rem 1.25rem', fontFamily: 'var(--headline)',
          fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase',
          cursor: 'pointer', fontSize: '13px',
        }}
      >Sign Out</button>
    </div>
  )
}

function AuthLoadingScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--black)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '24px',
    }}>
      <span style={{
        fontFamily: 'var(--headline)',
        fontSize: '22px',
        fontWeight: 900,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--muted)',
      }}>
        BREAKTAPES
      </span>
      <div style={{
        width: '6px', height: '6px',
        borderRadius: '50%',
        background: 'var(--orange)',
        animation: 'bt-pulse 1.2s ease-in-out infinite',
      }} />
    </div>
  )
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
    borderRadius: '6px',
    fontFamily: 'Barlow, sans-serif',
  },
  elements: {
    card: {
      background: '#141414',
      border: '1px solid rgba(245,245,245,0.08)',
      boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
    },
    headerTitle: {
      fontFamily: 'Barlow Condensed, sans-serif',
      fontWeight: 900,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
    },
    formButtonPrimary: {
      background: '#E84E1B',
      fontFamily: 'Barlow Condensed, sans-serif',
      fontWeight: 900,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
    },
    footerActionLink: { color: '#E84E1B' },
    identityPreviewEditButton: { color: '#E84E1B' },
  },
}

function LandingScreen() {
  const [view, setView] = useState<AuthView | null>(null)

  // Preserve the current URL so protected routes (e.g. /compare?b=username)
  // redirect back correctly after sign-in / sign-up.
  const returnTo = window.location.pathname + window.location.search
  const redirectUrl = returnTo !== '/' ? returnTo : '/'

  return (
    <>
      <div id="landing-screen">
        <div className="landing-wordmark">BREAK<span className="slash">/</span>TAPES</div>
        <div className="landing-headline">
          Your Races.<br /><em>All of Them.</em>
        </div>
        <p className="landing-sub">Log every finish line. Track PRs, medals, and race history in one place.</p>
        <div className="landing-actions">
          <button className="btn-main" onClick={() => setView('signup')}>
            Get Started — It's Free
          </button>
          <button className="landing-sign-in-link" onClick={() => setView('signin')}>
            Already have an account? Sign in
          </button>
        </div>
        <div className="landing-proof">
          <span className="landing-proof-stat"><strong>Race history</strong> · every finish line</span>
          <span className="landing-proof-dot" aria-hidden="true">·</span>
          <span className="landing-proof-stat"><strong>Auto PRs</strong> · all distances</span>
          <span className="landing-proof-dot" aria-hidden="true">·</span>
          <span className="landing-proof-stat"><strong>Medal wall</strong> · photo-first</span>
        </div>
      </div>

      {view && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={e => { if (e.target === e.currentTarget) setView(null) }}
        >
          {view === 'signin' ? (
            <SignIn
              appearance={clerkAppearance}
              signUpUrl="#"
              afterSignInUrl={redirectUrl}
              signUpForceRedirectUrl={redirectUrl}
            />
          ) : (
            <SignUp
              appearance={clerkAppearance}
              signInUrl="#"
              afterSignUpUrl={redirectUrl}
              signInForceRedirectUrl={redirectUrl}
            />
          )}
          <button
            onClick={() => setView(null)}
            style={{
              position: 'fixed', top: '1rem', right: '1rem',
              background: 'transparent',
              border: '1px solid rgba(245,245,245,0.15)',
              color: 'rgba(245,245,245,0.6)',
              borderRadius: '50%',
              width: '36px', height: '36px',
              cursor: 'pointer', fontSize: '18px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}

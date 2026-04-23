import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser, useAuth, SignIn, SignUp } from '@clerk/clerk-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { setClerkToken } from '@/lib/supabase'
import { IS_STAGING } from '@/env'

type AuthView = 'signin' | 'signup'

// Keeps Zustand authUser + Supabase JWT in sync with Clerk session.
function useClerkSync() {
  const { isLoaded, isSignedIn, user } = useUser()
  const { getToken } = useAuth()
  const setAuthUser = useAuthStore(s => s.setAuthUser)
  const setProAccess = useAuthStore(s => s.setProAccess)

  useEffect(() => {
    if (!isLoaded) return

    if (!isSignedIn || !user) {
      setAuthUser(null)
      setClerkToken(null)
      return
    }

    setAuthUser({
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress ?? null,
    })
    setProAccess(IS_STAGING)

    const refresh = () =>
      getToken({ template: 'supabase' }).then(t => setClerkToken(t))

    refresh()
    const interval = setInterval(refresh, 50_000)
    return () => clearInterval(interval)
  }, [isLoaded, isSignedIn, user, getToken, setAuthUser, setProAccess])
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useUser()
  const navigate = useNavigate()

  useClerkSync()

  useEffect(() => {
    if (isSignedIn && localStorage.getItem('bt_new_user')) {
      navigate('/you', { replace: true })
    }
  }, [isSignedIn, navigate])

  if (!isLoaded) return <AuthLoadingScreen />
  if (!isSignedIn) return <LandingScreen />
  return <>{children}</>
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
          <div className="landing-proof-item">
            <div className="landing-proof-icon">🏅</div>
            <div className="landing-proof-title">Medal Wall</div>
            <div className="landing-proof-desc">Photo-first medal display</div>
          </div>
          <div className="landing-proof-item">
            <div className="landing-proof-icon">⚡</div>
            <div className="landing-proof-title">Live PRs</div>
            <div className="landing-proof-desc">Auto-calculated personal bests</div>
          </div>
          <div className="landing-proof-item">
            <div className="landing-proof-icon">🗺️</div>
            <div className="landing-proof-title">Race Map</div>
            <div className="landing-proof-desc">Countries and routes mapped</div>
          </div>
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
              afterSignInUrl="/"
              signUpForceRedirectUrl="/"
            />
          ) : (
            <SignUp
              appearance={clerkAppearance}
              signInUrl="#"
              afterSignUpUrl="/"
              signInForceRedirectUrl="/"
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

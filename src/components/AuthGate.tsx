import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser, useAuth, SignIn, SignUp } from '@clerk/clerk-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { useRaceStore } from '@/stores/useRaceStore'
import { useThemeStore } from '@/stores/useThemeStore'
import { setClerkToken } from '@/lib/supabase'
import { syncStateToSupabase, resetRemotePullGate } from '@/lib/syncState'
import { migrateEmbeddedPhotos } from '@/lib/migratePhotos'
import { IS_STAGING } from '@/env'
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
  const applyClerkIdentity = useAthleteStore(s => s.applyClerkIdentity)
  const didBootstrapSync = useRef(false)
  const didMigratePhotos = useRef(false)

  useEffect(() => {
    if (!isLoaded) return

    if (!isSignedIn || !user) {
      setAuthUser(null)
      setClerkToken(null)
      didBootstrapSync.current = false
      didMigratePhotos.current = false
      // Re-arm the write gate so the next signed-in user defers writes until
      // their own remote pull lands (prevents the previous session's empty
      // state, or a fresh-device empty state, from overwriting their row).
      resetRemotePullGate()
      // Clear all race + athlete data so a subsequent sign-in by a different
      // user doesn't merge the previous user's local races into the new account.
      useRaceStore.getState().clearAll()
      useAthleteStore.getState().clearAll()
      posthog.reset()
      return
    }

    // Sync Clerk username + photo → athlete store so public profile SSR has them.
    // Clerk is the source of truth; athlete store follows.
    // Uses applyClerkIdentity (not updateAthlete) so updatedAt is NOT stamped —
    // a fresh-device athlete created solely from Clerk fields must not beat the
    // remote pull (which carries firstName/lastName/bio/clubs etc.) in the
    // last-write-wins check inside applyRemoteSafe.
    const athleteUpdate: { username?: string; imageUrl?: string } = {}
    if (user.username) athleteUpdate.username = user.username
    if (user.imageUrl) athleteUpdate.imageUrl = user.imageUrl
    if (Object.keys(athleteUpdate).length) applyClerkIdentity(athleteUpdate)

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
        setProAccess(IS_STAGING)
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
        //
        // CRITICAL: only backfill when local state actually has data to push.
        // On a fresh device / cleared cache / incognito / new browser, the
        // stores are empty. Writing empty state here would OVERWRITE the
        // user's server row (full state_json replace) and wipe their entire
        // race history + profile before the remote pull (useSyncState) has a
        // chance to populate local. A backfill of nothing is never correct —
        // if local is empty there is nothing to back up, so skip the write
        // and let the pull hydrate from the server.
        if (!didBootstrapSync.current) {
          didBootstrapSync.current = true
          const { races, upcomingRaces, wishlistRaces } = useRaceStore.getState()
          const { athlete, seasonPlans, goals } = useAthleteStore.getState()
          const hasLocalData =
            races.length > 0 ||
            upcomingRaces.length > 0 ||
            wishlistRaces.length > 0 ||
            seasonPlans.length > 0 ||
            Object.keys(goals?.annual ?? {}).length > 0 ||
            (goals?.distGoals?.length ?? 0) > 0 ||
            !!(athlete && (athlete.firstName || athlete.lastName || athlete.username || athlete.city || athlete.bio))
          if (hasLocalData) void syncStateToSupabase()
        }

        // One-time bulk migration of embedded base64 race/medal photos →
        // Supabase Storage URLs. Fires once per session AFTER the Clerk token is
        // installed (the upload route needs it). This is what frees the bloated
        // ~5 MB `fl2_races` localStorage blob for users who hit QuotaExceededError:
        // it strips every base64 photo in one pass, then writes back a tiny blob.
        // Retry-safe — re-runs next boot if uploads failed (Worker down/offline).
        if (!didMigratePhotos.current) {
          didMigratePhotos.current = true
          void migrateEmbeddedPhotos()
        }
      } catch {
        // Leave authUser null on token failure — better to show landing
        // than to fire unauthenticated queries that pollute caches.
      }
    }

    refresh()
    const interval = setInterval(refresh, 50_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [isLoaded, isSignedIn, user, getToken, setAuthUser, setProAccess, applyClerkIdentity])
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser()
  const navigate = useNavigate()
  // Route a new user to /you onboarding AT MOST ONCE per app session. Without
  // this guard the effect below re-fires on every Clerk token refresh (the
  // `user` object identity changes ~every 50s), and the `hasFlag` branch would
  // yank the user back to /you mid-task — trapping anyone who navigated to the
  // dashboard to log a race before completing their profile.
  const didRouteNewUser = useRef(false)
  const setForceDefault = useThemeStore(s => s.setForceDefault)

  useClerkSync()

  // Force the default Carbon+Chrome theme on the logged-out login + loading
  // screens, ignoring any saved custom theme. The user's theme returns once
  // they're signed in.
  useEffect(() => {
    setForceDefault(!isSignedIn)
  }, [isSignedIn, setForceDefault])

  // Detect brand-new signups (Clerk user created < 2 min ago) and route
  // them to the profile onboarding page once. bt_new_user persists so
  // subsequent renders don't keep redirecting.
  useEffect(() => {
    if (!isSignedIn || !user) return
    if (didRouteNewUser.current) return

    const createdMs = user.createdAt ? new Date(user.createdAt).getTime() : 0
    const isFreshSignup = createdMs > 0 && Date.now() - createdMs < 120_000
    const hasFlag = localStorage.getItem('bt_new_user')

    if (isFreshSignup && !hasFlag) {
      localStorage.setItem('bt_new_user', '1')
      didRouteNewUser.current = true
      navigate('/you', { replace: true })
    } else if (hasFlag) {
      didRouteNewUser.current = true
      navigate('/you', { replace: true })
    }
  }, [isSignedIn, user, navigate])

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
      gap: 'var(--sp-6)',
    }}>
      <span style={{
        fontFamily: 'var(--headline)',
        fontSize: 'var(--text-xl)',
        fontWeight: 900,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--muted)',
      }}>
        BREAKTAPES
      </span>
      <div style={{
        width: '6px', height: '6px',
        borderRadius: 'var(--radius-round)',
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
    borderRadius: 'var(--radius-sm)',
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
  // Auto-open the auth modal when arriving from the marketing site
  // (breaktapes.com Get Started / Sign in → app.breaktapes.com/?auth=signup|signin).
  const [view, setView] = useState<AuthView | null>(() => {
    const a = new URLSearchParams(window.location.search).get('auth')
    return a === 'signup' ? 'signup' : a === 'signin' ? 'signin' : null
  })

  // Preserve the current URL so protected routes (e.g. /compare?b=username)
  // redirect back correctly after sign-in / sign-up.
  const returnTo = window.location.pathname + window.location.search
  const redirectUrl = returnTo !== '/' ? returnTo : '/'

  return (
    <>
      {/* app.breaktapes.com logged-out = simple login screen. The cinematic
          marketing landing lives on breaktapes.com (see App.tsx MarketingLanding). */}
      <div id="login-screen">
        <div className="landing-wordmark">BREAK<span className="slash">/</span>TAPES</div>
        <h1 className="landing-headline">
          Your Races.<br /><em>All of Them.</em>
        </h1>
        <p className="landing-sub">Log every finish line. Track PRs, medals, and race history in one place.</p>
        <div className="login-actions">
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
              routing="virtual"
              appearance={clerkAppearance}
              fallbackRedirectUrl={redirectUrl}
              signUpFallbackRedirectUrl={redirectUrl}
            />
          ) : (
            <SignUp
              routing="virtual"
              appearance={clerkAppearance}
              fallbackRedirectUrl={redirectUrl}
              signInFallbackRedirectUrl={redirectUrl}
            />
          )}
          <button
            onClick={() => setView(null)}
            style={{
              position: 'fixed', top: '1rem', right: '1rem',
              background: 'transparent',
              border: '1px solid rgba(245,245,245,0.15)',
              color: 'rgba(245,245,245,0.6)',
              borderRadius: 'var(--radius-round)',
              width: '36px', height: '36px',
              cursor: 'pointer', fontSize: 'var(--text-md)',
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

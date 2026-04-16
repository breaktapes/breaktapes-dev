import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/useAuthStore'

type AuthState = 'loading' | 'authenticated' | 'unauthenticated'
type AuthMode = 'signin' | 'signup'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>('loading')
  const setAuthUser = useAuthStore(s => s.setAuthUser)
  const setAuthSession = useAuthStore(s => s.setAuthSession)
  const navigate = useNavigate()
  const resolved = useRef(false)

  useEffect(() => {
    // 4-second timeout — show landing on slow Supabase cold-start
    const timeout = setTimeout(() => {
      if (!resolved.current) {
        resolved.current = true
        setAuthState('unauthenticated')
      }
    }, 4000)

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (resolved.current) return
        resolved.current = true
        clearTimeout(timeout)
        if (data.session) {
          setAuthUser(data.session.user)
          setAuthSession(data.session)
          setAuthState('authenticated')
          if (localStorage.getItem('bt_new_user')) navigate('/you', { replace: true })
        } else {
          setAuthState('unauthenticated')
        }
      } catch {
        if (!resolved.current) {
          resolved.current = true
          clearTimeout(timeout)
          setAuthState('unauthenticated')
        }
      }
    }
    init()

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setAuthUser(session.user)
        setAuthSession(session)
        setAuthState('authenticated')
        if (localStorage.getItem('bt_new_user')) navigate('/you', { replace: true })
      } else if (event === 'SIGNED_OUT') {
        setAuthUser(null)
        setAuthSession(null)
        setAuthState('unauthenticated')
        localStorage.removeItem('bt_new_user')
        localStorage.removeItem('bt_modal_shown')
      }
    })

    return () => {
      clearTimeout(timeout)
      listener.subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (authState === 'loading') return <AuthLoadingScreen />
  if (authState === 'unauthenticated') return <LandingScreen />
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

function LandingScreen() {
  const [modalOpen, setModalOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('signin')

  return (
    <>
      <div id="landing-screen">
        <div className="landing-wordmark">BREAK<span className="slash">/</span>TAPES</div>
        <div className="landing-headline">
          Your Races.<br /><em>All of Them.</em>
        </div>
        <p className="landing-sub">Log every finish line. Track PRs, medals, and race history in one place.</p>
        <div className="landing-actions">
          <button className="btn-main" onClick={() => { setAuthMode('signup'); setModalOpen(true) }}>
            Get Started — It's Free
          </button>
          <button className="landing-sign-in-link" onClick={() => { setAuthMode('signin'); setModalOpen(true) }}>
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

      <AuthModal
        open={modalOpen}
        mode={authMode}
        onModeChange={setAuthMode}
        onClose={() => setModalOpen(false)}
      />
    </>
  )
}

interface AuthModalProps {
  open: boolean
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
  onClose: () => void
}

function AuthModal({ open, mode, onModeChange, onClose }: AuthModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!email.trim()) { setError('Drop an email to get started.'); return }
    if (!password) { setError('Need a password to race in.'); return }

    setLoading(true)
    try {
      if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (err) { setError(err.message); return }
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { first_name: firstName, last_name: lastName },
          },
        })
        if (err) { setError(err.message); return }
        if (data.user && !data.session) {
          setError('Check your email to confirm your account.')
          return
        }
        if (data.user) localStorage.setItem('bt_new_user', '1')
      }
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) { setError('Enter your email first.'); return }
    setLoading(true)
    try {
      await supabase.auth.resetPasswordForEmail(email.trim())
      setResetSent(true)
      setError('')
    } catch {
      setError('Could not send reset email.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
    if (e.key === 'Escape') onClose()
  }

  return (
    <div
      className={`auth-modal-overlay${open ? ' open' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="auth-modal" role="dialog" aria-modal="true">
        <div className="auth-modal-drag" />
        <div className="auth-modal-head">
          <h2>{mode === 'signin' ? 'Sign In' : 'Create Account'}</h2>
        </div>
        <div className="auth-modal-body" onKeyDown={handleKeyDown}>
          <div className="auth-switch">
            <button
              className={mode === 'signin' ? 'btn-main' : 'btn-ghost'}
              onClick={() => { onModeChange('signin'); setError(''); setResetSent(false) }}
            >Sign In</button>
            <button
              className={mode === 'signup' ? 'btn-main' : 'btn-ghost'}
              onClick={() => { onModeChange('signup'); setError(''); setResetSent(false) }}
            >Create Account</button>
          </div>

          {mode === 'signup' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div className="fg">
                <label className="fl">First Name</label>
                <input className="fi" placeholder="Alex" value={firstName} onChange={e => setFirstName(e.target.value)} />
              </div>
              <div className="fg">
                <label className="fl">Last Name</label>
                <input className="fi" placeholder="Finisher" value={lastName} onChange={e => setLastName(e.target.value)} />
              </div>
            </div>
          )}

          <div className="fg" style={{ marginBottom: '0.75rem' }}>
            <label className="fl" htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              className={`fi${error && !email.trim() ? ' fi-error' : ''}`}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="fg" style={{ marginBottom: '0.5rem' }}>
            <label className="fl" htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              className={`fi${error && !password ? ' fi-error' : ''}`}
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && (
            <div className="fg-err-msg show" style={{ marginBottom: '0.5rem' }}>{error}</div>
          )}
          {resetSent && (
            <div style={{ fontSize: '12px', color: 'var(--green)', marginBottom: '0.5rem' }}>
              Password reset email sent. Check your inbox.
            </div>
          )}

          {mode === 'signin' && !resetSent && (
            <button className="auth-forgot" onClick={handleForgotPassword} disabled={loading}>
              Forgot password?
            </button>
          )}

          <p className="auth-note">
            {mode === 'signup'
              ? 'Your races stay safe and sync across all your devices.'
              : 'Welcome back. Your race history is waiting.'}
          </p>
        </div>
        <div className="auth-modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-main" onClick={handleSubmit} disabled={loading}>
            {loading ? (mode === 'signin' ? 'Signing In…' : 'Creating…') : (mode === 'signin' ? 'Sign In' : 'Create Account')}
          </button>
        </div>
      </div>
    </div>
  )
}

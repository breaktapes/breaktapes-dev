import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Component, lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { ClerkProvider } from '@clerk/clerk-react'
import { ThemeProvider } from '@/components/ThemeProvider'
import { AuthGate } from '@/components/AuthGate'
import { Layout } from '@/components/Layout'
import { CLERK_PUBLISHABLE_KEY } from '@/env'

// Lazy-loaded pages — each is a separate JS chunk.
// Dashboard loads eagerly (it's the default route, always shown first).
import { Dashboard } from '@/pages/Dashboard'
const Races    = lazy(() => import('@/pages/Races').then(m => ({ default: m.Races })))
const Train    = lazy(() => import('@/pages/Train').then(m => ({ default: m.Train })))
const Profile  = lazy(() => import('@/pages/Profile').then(m => ({ default: m.Profile })))
// const Gear  = lazy(() => import('@/pages/Gear').then(m => ({ default: m.Gear })))  // removed from nav — kept for post-MVP
const Settings = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })))
const Discover = lazy(() => import('@/pages/Discover').then(m => ({ default: m.Discover })))
const Compare  = lazy(() => import('@/pages/Compare').then(m => ({ default: m.Compare })))
const PrivacyPolicy      = lazy(() => import('@/pages/PrivacyPolicy'))
const TermsAndConditions = lazy(() => import('@/pages/TermsAndConditions'))
const Help               = lazy(() => import('@/pages/Help'))

class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Always log to console
    console.error('[RootErrorBoundary]', error, info)
    // Best-effort report — fire and forget, never blocks UI
    try {
      const payload = {
        message: String(error?.message ?? '').slice(0, 500),
        stack:   String(error?.stack   ?? '').slice(0, 2000),
        component_stack: String(info?.componentStack ?? '').slice(0, 2000),
        url:     window.location.href,
        ua:      navigator.userAgent.slice(0, 300),
        ts:      new Date().toISOString(),
        env:     import.meta.env.MODE,
      }
      // Use sendBeacon so it fires even as the page is crashing
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
      navigator.sendBeacon('/api/error-report', blob)
    } catch { /* ignore — reporting must never throw */ }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ position: 'fixed', inset: 0, background: '#0d0d0d', color: '#f5f5f5', fontFamily: 'monospace', padding: '24px', overflowY: 'auto', fontSize: '13px', lineHeight: 1.6 }}>
          <div style={{ color: '#E84E1B', fontWeight: 700, marginBottom: '12px' }}>⚠ App crashed</div>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{(this.state.error as Error).message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'rgba(245,245,245,0.45)', marginTop: '12px', fontSize: '11px' }}>{(this.state.error as Error).stack}</pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: '20px', background: '#E84E1B', color: '#000', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: 700, cursor: 'pointer' }}>Reload</button>
        </div>
      )
    }
    return this.props.children
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

/** Page fade wrapper — opacity 0→1, 150ms, ease-out. No slides. */
function AnimatedRoutes() {
  const location = useLocation()
  return (
    <div
      key={location.pathname}
      style={{ minHeight: '100%', animation: 'fadeIn 0.15s ease-out' }}
    >
      <Suspense fallback={<div style={{ minHeight: '40vh' }} />}>
        <Routes location={location}>
          <Route path="/"         element={<Dashboard />} />
          <Route path="/races"    element={<Races />} />
          <Route path="/train"    element={<Train />} />
          <Route path="/you"      element={<Profile />} />
          {/* <Route path="/gear"  element={<Gear />} /> */}  {/* removed from nav — kept for post-MVP */}
          <Route path="/settings" element={<Settings />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/compare"  element={<Compare />} />
          {/* Backwards compat aliases */}
          <Route path="/pace"    element={<Navigate to="/train" replace />} />
          <Route path="/history" element={<Navigate to="/races" replace />} />
          <Route path="/map"     element={<Navigate to="/races" replace />} />
          {/* Catch-all */}
          <Route path="*"        element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  )
}

export function App() {
  return (
    <RootErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0d0d0d' }} />}>
            <Routes>
              {/* Public pages — no Clerk, no auth gate, no layout chrome */}
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms"   element={<TermsAndConditions />} />
              <Route path="/help"    element={<Help />} />
              {/* All other routes go through Clerk + auth + layout */}
              <Route path="*" element={
                <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
                  <QueryClientProvider client={queryClient}>
                    <AuthGate>
                      <Layout>
                        <AnimatedRoutes />
                      </Layout>
                    </AuthGate>
                  </QueryClientProvider>
                </ClerkProvider>
              } />
            </Routes>
          </Suspense>
        </ThemeProvider>
      </BrowserRouter>
    </RootErrorBoundary>
  )
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { initPostHog } from './lib/posthog'
import './styles/index.css'

initPostHog()

// Global JS error capture → /api/error-report (uses sendBeacon so it fires even during unload)
function reportError(message: string, stack?: string) {
  try {
    const blob = new Blob([JSON.stringify({
      message: String(message).slice(0, 500),
      stack:   String(stack ?? '').slice(0, 2000),
      url:     window.location.href.slice(0, 500),
      env:     import.meta.env.PROD ? 'production' : 'development',
      ts:      new Date().toISOString(),
    })], { type: 'application/json' })
    navigator.sendBeacon('/api/error-report', blob)
  } catch { /* never throw from error handler */ }
}

window.addEventListener('error', (e) => {
  reportError(e.message, e.error?.stack)
})

window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason instanceof Error ? e.reason.message : String(e.reason)
  const stack = e.reason instanceof Error ? e.reason.stack : undefined
  reportError(`Unhandled rejection: ${msg}`, stack)
})

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

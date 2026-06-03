import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DEMO_PERSONAS, DEMO_PERSONA_LIST, type DemoPersonaId } from '@/lib/demoData'
import { DemoShell } from '@/components/DemoShell'
import { Dashboard } from '@/pages/Dashboard'
import { Races } from '@/pages/Races'
import { Profile } from '@/pages/Profile'

/* =====================================================================
   /demo — interactive sandbox for the landing. Renders the REAL app
   pages (Dashboard / Races / Profile) seeded with a persona's data via
   DemoShell. No auth, no persistence pollution (see DemoShell safety note).

   Query params (used when embedded in the marketing landing):
     ?persona=sa-marathoner   pre-select a persona
     ?tab=races               pre-select a tab (dashboard | races | profile)
     ?chrome=0                hide the demo header + bottom nav (embed mode)
   Each embedded <iframe src="/demo?..."> is its own document with its own
   Zustand store, so multiple personas can render side by side with no
   global-store conflict.
   ===================================================================== */

type Tab = 'dashboard' | 'races' | 'profile'

const ICON = {
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" /></svg>,
  races: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>,
  you: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" /></svg>,
}
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Home', icon: ICON.home },
  { id: 'races', label: 'Races', icon: ICON.races },
  { id: 'profile', label: 'You', icon: ICON.you },
]

const isPersona = (v: string | null): v is DemoPersonaId =>
  !!v && Object.prototype.hasOwnProperty.call(DEMO_PERSONAS, v)
const isTab = (v: string | null): v is Tab =>
  v === 'dashboard' || v === 'races' || v === 'profile'

export default function Demo() {
  const [params] = useSearchParams()
  const initialPersona: DemoPersonaId = isPersona(params.get('persona')) ? (params.get('persona') as DemoPersonaId) : 'dubai-everyday'
  const initialTab: Tab = isTab(params.get('tab')) ? (params.get('tab') as Tab) : 'dashboard'
  const chrome = params.get('chrome') !== '0'

  const [pid, setPid] = useState<DemoPersonaId>(initialPersona)
  const [tab, setTab] = useState<Tab>(initialTab)
  const persona = DEMO_PERSONAS[pid]

  // Screenshot helper: ?focus=pbs|medals scrolls a profile section to the top
  // (works across personas of different heights — used for section captures).
  // ?scroll=N is a fixed-offset fallback.
  useEffect(() => {
    const focus = params.get('focus')
    const n = Number(params.get('scroll'))
    if (!focus && !n) return
    const id = window.setTimeout(() => {
      const sc = document.querySelector('.demo-real') as HTMLElement | null
      if (!sc) return
      if (focus) {
        const want = focus === 'pbs' ? 'PERSONAL BESTS' : focus === 'medals' ? 'MEDALS' : ''
        const head = [...sc.querySelectorAll('h1,h2,h3,div,span')]
          .find(e => (e.textContent || '').trim().toUpperCase().startsWith(want) && e.children.length < 4) as HTMLElement | undefined
        if (head) {
          const top = head.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop
          sc.scrollTop = Math.max(0, top - 12)
        }
      } else if (n) {
        sc.scrollTop = n
      }
    }, 900)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When embedded in the marketing landing, the parent drives tab/persona via
  // postMessage so the phone-stage can switch screens without reloading the iframe.
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const d = e.data
      if (!d || d.type !== 'demo-nav') return
      if (isTab(d.tab)) setTab(d.tab)
      if (isPersona(d.persona)) setPid(d.persona)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  return (
    <div className={`demo-root${chrome ? '' : ' demo-embed'}`}>
      {chrome && (
        <header className="demo-top">
          <div className="demo-brand">BREAK<span style={{ color: 'var(--orange)' }}>/</span>TAPES <span className="demo-badge">DEMO</span></div>
          <div className="demo-personas">
            {DEMO_PERSONA_LIST.map(per => (
              <button key={per.id} className={`demo-persona${pid === per.id ? ' on' : ''}`} onClick={() => setPid(per.id)}>{per.label}</button>
            ))}
          </div>
        </header>
      )}

      <DemoShell persona={persona}>
        <main className="demo-body demo-real">
          <Suspense fallback={<div style={{ minHeight: '40vh' }} />}>
            {tab === 'dashboard' && <Dashboard />}
            {tab === 'races' && <Races />}
            {tab === 'profile' && <Profile />}
          </Suspense>
        </main>
      </DemoShell>

      {chrome && (
        <nav className="demo-nav">
          {TABS.map(t => (
            <button key={t.id} className={`demo-nav-btn${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>
              <span className="demo-nav-icon">{t.icon}</span>{t.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}

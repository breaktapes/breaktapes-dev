import { useRef, useEffect, useState, useCallback } from 'react'
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useInView,
  animate,
  type Variants,
} from 'framer-motion'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { posthog } from '@/lib/posthog'
import { DEMO_TESTIMONIALS, DEMO_PERSONA_LIST, type DemoPersonaId } from '@/lib/demoData'

gsap.registerPlugin(ScrollTrigger)

/* =====================================================================
   BREAKTAPES — Production landing (cinematic pitch-deck)
   Phase A: intro loader, hero, floating nav, scroll-progress, audience
   selector, GSAP scrollytelling on the feature showcases.
   Auth is delegated to AuthGate via onSignUp / onSignIn callbacks.
   ===================================================================== */

interface LandingPageProps {
  onSignUp: () => void
  onSignIn: () => void
}

/* ---------- shared motion presets ---------- */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}

const track = (event: string, props?: Record<string, unknown>) => {
  try { posthog.capture(event, props) } catch { /* analytics is best-effort */ }
}

/* Animated count-up number, fires when scrolled into view. */
function Counter({ to, suffix = '', duration = 1.6 }: { to: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-15% 0px' })
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState('0')

  useEffect(() => {
    if (!inView) return
    if (reduce) { setDisplay(to.toLocaleString()); return }
    const controls = animate(0, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: v => setDisplay(Math.round(v).toLocaleString()),
    })
    return () => controls.stop()
  }, [inView, to, duration, reduce])

  return <span ref={ref}>{display}{suffix}</span>
}

/* =====================================================================
   INTRO LOADER — finish-line tape + stopwatch counts up, then snaps.
   ("BREAKTAPES" = breaking the finish tape.)
   ===================================================================== */
function LoaderOverlay({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion()
  const [time, setTime] = useState('0:00.0')
  const [snapped, setSnapped] = useState(false)
  const done = useRef(false)
  // Keep the latest onDone without making it an effect dependency — the effect
  // must run exactly once on mount, not restart whenever the parent re-renders.
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const finish = () => { if (!done.current) { done.current = true; onDoneRef.current() } }
    if (reduce) { finish(); return }
    // Stopwatch races up to a "finish time", then the tape snaps.
    const controls = animate(0, 154, {
      duration: 1.5,
      ease: [0.2, 0.75, 0.2, 1],
      onUpdate: s => {
        const m = Math.floor(s / 60)
        const sec = Math.floor(s % 60)
        const cs = Math.floor((s * 10) % 10)
        setTime(`${m}:${String(sec).padStart(2, '0')}.${cs}`)
      },
      onComplete: () => { setSnapped(true); window.setTimeout(finish, 650) },
    })
    // Safety: never trap the visitor behind the loader.
    const guard = window.setTimeout(finish, 5000)
    return () => { controls.stop(); window.clearTimeout(guard) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSkip = () => { if (!done.current) { done.current = true; onDoneRef.current() } }

  if (reduce) return null

  return (
    <motion.div className="pl-loader" exit={{ y: '-100%' }}
      transition={{ duration: 0.6, ease: [0.7, 0, 0.3, 1] }}
      onClick={handleSkip} role="presentation">
      <div className="pl-loader-inner">
        <div className="pl-loader-clock">{snapped ? '2:34.0' : time}</div>
        <div className="pl-loader-tape-track">
          <motion.div className="pl-loader-tape pl-loader-tape-l"
            animate={snapped ? { x: '-130%', rotate: -6, opacity: 0 } : { x: 0 }}
            transition={{ duration: 0.5, ease: [0.7, 0, 0.3, 1] }}>
            <span>FINISH · BREAK / TAPES · FINISH ·</span>
          </motion.div>
          <motion.div className="pl-loader-tape pl-loader-tape-r"
            animate={snapped ? { x: '130%', rotate: 6, opacity: 0 } : { x: 0 }}
            transition={{ duration: 0.5, ease: [0.7, 0, 0.3, 1] }}>
            <span>· FINISH · BREAK / TAPES · FINISH</span>
          </motion.div>
          <AnimatePresence>
            {snapped && (
              <motion.div className="pl-loader-flash"
                initial={{ opacity: 0.9, scaleY: 0.2 }} animate={{ opacity: 0, scaleY: 2 }}
                transition={{ duration: 0.4 }} />
            )}
          </AnimatePresence>
        </div>
        <div className="pl-loader-word">BREAK<span className="slash">/</span>TAPES</div>
      </div>
    </motion.div>
  )
}

/* =====================================================================
   FLOATING TOP NAV + SCROLL PROGRESS BAR
   ===================================================================== */
function TopChrome({ progress, onSignUp, onSignIn, visible }:
  { progress: number; onSignUp: () => void; onSignIn: () => void; visible: boolean }) {
  return (
    <>
      <div className="pl-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
      <AnimatePresence>
        {visible && (
          <motion.header className="pl-nav"
            initial={{ y: -64, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -64, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
            <div className="pl-nav-word">BREAK<span className="slash">/</span>TAPES</div>
            <div className="pl-nav-actions">
              <button className="pl-nav-ghost" onClick={() => { track('landing_cta_click', { cta: 'nav_signin' }); onSignIn() }}>Sign in</button>
              <button className="pl-nav-cta" onClick={() => { track('landing_cta_click', { cta: 'nav_get_started' }); onSignUp() }}>Get Started</button>
            </div>
          </motion.header>
        )}
      </AnimatePresence>
    </>
  )
}

/* =====================================================================
   PERSONA SELECTOR — "I am a…" — lists the seven demo athletes. The
   selection drives the live interactive sandbox lower down the page.
   ===================================================================== */
function PersonaSelector({ value, onChange }: { value: DemoPersonaId; onChange: (p: DemoPersonaId) => void }) {
  return (
    <motion.section className="pl-audience" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
      <motion.p className="pl-eyebrow" variants={fadeUp}>Make it yours</motion.p>
      <motion.h2 className="pl-audience-title" variants={fadeUp}>I am a…</motion.h2>
      <motion.div className="pl-audience-pills" variants={fadeUp} role="tablist" aria-label="Athlete type">
        {DEMO_PERSONA_LIST.map(p => (
          <button key={p.id} role="tab" aria-selected={value === p.id}
            className={`pl-audience-pill${value === p.id ? ' active' : ''}`}
            onClick={() => { onChange(p.id); track('landing_audience_switch', { audience: p.id }) }}>
            {p.label}
          </button>
        ))}
      </motion.div>
    </motion.section>
  )
}

/* =====================================================================
   DESIGNED APP MOCKUPS  (fake-but-real UI panels in breaktapes tokens)
   ===================================================================== */
const cardSurface: React.CSSProperties = {
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
}

/* ---------- REAL app screenshots ----------
   Static captures of the ACTUAL app (Dashboard / Races map / Personal Bests /
   Medal wall), shot at mobile size. Used as fitted screenshots in the feature
   showcases and the phone-stage — no live iframes (kept only for the sandbox),
   so the page is light and nothing can fail to load. */
const SHOTS = {
  dashboard: '/landing/screen-dashboard.png',
  races: '/landing/screen-races.png',
  pbs: '/landing/screen-pbs.png',
  medals: '/landing/screen-medals.png',
} as const

/** A real app screenshot framed as a device-style card (showcase art). */
function ShowcaseShot({ src, title }: { src: string; title: string }) {
  return (
    <div className="pl-demo-frame"
      style={{ width: '100%', aspectRatio: '10 / 17', maxHeight: 580, borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border2)', background: 'var(--surface)', boxShadow: '0 30px 80px -40px rgba(0,0,0,0.8)' }}>
      <img src={src} alt={title} loading="lazy"
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', display: 'block' }} />
    </div>
  )
}

function DashboardMockup() {
  const d = { tag: 'Next Race · 12 days', race: 'Berlin Marathon', goal: 'Goal 3:15 · 12-week taper on track', races: '42', pr: ['3:21', 'MARATHON PR'] as [string, string] }
  return (
    <div style={{
      width: '100%', maxWidth: 320, padding: 'var(--sp-4)',
      background: 'var(--surface)', border: '1px solid var(--border2)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(var(--orange-ch),0.08)',
    }}>
      <div style={{
        ...cardSurface, padding: 'var(--sp-4)', marginBottom: 'var(--sp-3)',
        background: 'linear-gradient(135deg, rgba(var(--orange-ch),0.16), var(--surface2))',
        borderColor: 'rgba(var(--orange-ch),0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--orange)' }} />
          <span style={{ fontFamily: 'var(--body)', fontSize: 10, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--orange)' }}>{d.tag}</span>
        </div>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 22,
          textTransform: 'uppercase', color: 'var(--white)', lineHeight: 1 }}>{d.race}</div>
        <div style={{ fontFamily: 'var(--body)', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
          {d.goal}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
        {[[d.races, 'RACES'], [d.pr[0], d.pr[1]]].map(([v, l]) => (
          <div key={l} style={{ ...cardSurface, padding: 'var(--sp-3)' }}>
            <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 26, color: 'var(--white)' }}>{v}</div>
            <div style={{ fontFamily: 'var(--body)', fontSize: 9, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'var(--muted)' }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ ...cardSurface, padding: 'var(--sp-3)' }}>
        <div style={{ fontFamily: 'var(--body)', fontSize: 9, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Momentum</div>
        <svg viewBox="0 0 240 48" width="100%" height="36" preserveAspectRatio="none">
          <motion.path
            d="M0 40 L40 34 L80 36 L120 24 L160 26 L200 12 L240 8"
            fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round"
            initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }}
            viewport={{ once: true }} transition={{ duration: 1.4, ease: 'easeInOut' }}
          />
        </svg>
      </div>
    </div>
  )
}




/* Wearables — only WHOOP is production-authorized. Others are "Coming soon". */
function WearablesMockup() {
  const live = 'WHOOP'
  const soon = ['STRAVA', 'GARMIN', 'APPLE HEALTH', 'COROS', 'OURA']
  return (
    <div style={{ width: '100%', maxWidth: 380, display: 'grid', gap: 'var(--sp-3)' }}>
      <motion.div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}
        variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
        <motion.span variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
          style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 12, letterSpacing: '0.08em',
            color: 'var(--white)', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'var(--green-dim)', border: '1px solid rgba(var(--green-ch),0.4)',
            borderRadius: 'var(--radius-pill)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />{live} · Live
        </motion.span>
        {soon.map(b => (
          <motion.span key={b} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
            style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 12, letterSpacing: '0.08em',
              color: 'var(--muted)', padding: '6px 12px', background: 'var(--surface3)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)' }}>
            {b} · Soon
          </motion.span>
        ))}
      </motion.div>
      {[['🏃', 'Morning Run', '12.4 km · 4:52 /km'], ['😴', 'Recovery', '88% · ready to train'], ['🚴', 'Long Ride', '64 km · 1,240 kcal']].map(([icon, name, meta], i) => (
        <motion.div key={name} style={{ ...cardSurface, padding: 'var(--sp-3)', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}
          initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.12 }}>
          <span style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: 'var(--orange-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 14, textTransform: 'uppercase',
              color: 'var(--white)' }}>{name}</div>
            <div style={{ fontFamily: 'var(--body)', fontSize: 11, color: 'var(--muted)' }}>{meta}</div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}


/* =====================================================================
   PHONE-SCROLL STAGE — a pinned device cycles through screens on scroll.
   ===================================================================== */
const STAGE_SCREENS = [
  { key: 'home', title: 'Your dashboard', line: 'Race-day briefing, next-race countdown, and live form — the moment you open the app.', shot: SHOTS.dashboard },
  { key: 'medals', title: 'Your medal wall', line: 'Every medal you’ve earned, photo-first and tier by tier. Gold, silver, bronze, finisher.', shot: SHOTS.medals },
  { key: 'map', title: 'Your race map', line: 'Every finish line you’ve crossed, mapped across the world and connected in order.', shot: SHOTS.races },
  { key: 'analytics', title: 'Your analytics', line: 'Pacing IQ, age-grade and momentum — the numbers behind every result, computed for you.', shot: SHOTS.pbs },
] as const

function PhoneStage({ screen, stageRef }: { screen: number; stageRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <section className="pl-stage" ref={stageRef}>
      <div className="pl-stage-pin">
        <div className="pl-stage-inner">
          <div className="pl-stage-copy">
            <p className="pl-eyebrow">The whole app</p>
            <h2 className="pl-stage-title">{STAGE_SCREENS[screen].title}</h2>
            <p className="pl-stage-line">{STAGE_SCREENS[screen].line}</p>
            <div className="pl-stage-dots" aria-hidden="true">
              {STAGE_SCREENS.map((s, i) => <span key={s.key} className={i === screen ? 'on' : ''} />)}
            </div>
          </div>
          <div className="pl-phone">
            <div className="pl-phone-notch" />
            <div className="pl-phone-screen">
              {STAGE_SCREENS.map((s, i) => (
                <img key={s.key} src={s.shot} alt={s.title} loading="lazy"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
                    objectFit: 'cover', objectPosition: 'top center', display: 'block',
                    opacity: i === screen ? 1 : 0, transition: 'opacity 0.4s ease' }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* =====================================================================
   FEATURE SHOWCASE ROW  (alternating copy + mockup; reveals + GSAP parallax)
   ===================================================================== */
interface ShowcaseProps {
  id: string; eyebrow: string; title: string; desc: string; bullets: string[]
  mockup: React.ReactNode; reverse?: boolean
  depth?: number
}
function FeatureShowcase({ eyebrow, title, desc, bullets, mockup, reverse, depth = 40 }: ShowcaseProps) {
  return (
    <motion.section className={`pl-showcase${reverse ? ' pl-reverse' : ''}`}
      variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-12% 0px' }}>
      <motion.div className="pl-showcase-copy" variants={fadeUp}>
        <p className="pl-eyebrow">{eyebrow}</p>
        <h2 className="pl-showcase-title">{title}</h2>
        <p className="pl-showcase-desc">{desc}</p>
        <ul className="pl-bullets">
          {bullets.map(b => (
            <motion.li key={b} variants={fadeUp}>
              <span className="pl-bullet-dot">▸</span>{b}
            </motion.li>
          ))}
        </ul>
      </motion.div>
      {/* Outer element owns GSAP parallax (y); inner owns the Framer reveal.
          Two libraries must not animate transform on the same node. */}
      <div className="pl-parallax" data-depth={depth}>
        <motion.div className="pl-showcase-art"
          variants={{ hidden: { opacity: 0, scale: 0.92, y: 24 }, show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } } }}>
          {mockup}
        </motion.div>
      </div>
    </motion.section>
  )
}

/* =====================================================================
   HOW IT WORKS — 3 numbered steps + mini-mockups
   ===================================================================== */
function StepMiniSignup() {
  return (
    <div style={{ ...cardSurface, padding: 'var(--sp-3)', width: '100%', maxWidth: 230, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--grad-primary)' }} />
        <span style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 13, color: 'var(--white)' }}>Your Name</span>
      </div>
      {['Email', 'Password'].map(f => (
        <div key={f} style={{ height: 26, borderRadius: 'var(--radius-sm)', background: 'var(--surface3)',
          border: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 8px',
          fontFamily: 'var(--body)', fontSize: 10, color: 'var(--muted2)' }}>{f}</div>
      ))}
      <div style={{ height: 28, borderRadius: 'var(--radius-sm)', background: 'var(--orange)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--headline)', fontWeight: 800,
        fontSize: 11, letterSpacing: '0.08em', color: '#000' }}>CREATE ACCOUNT</div>
    </div>
  )
}
function StepMiniLog() {
  return (
    <div style={{ ...cardSurface, padding: 'var(--sp-3)', width: '100%', maxWidth: 230, display: 'grid', gap: 8 }}>
      <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 12, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: 'var(--orange)' }}>🏁 Log a race</div>
      <div style={{ height: 26, borderRadius: 'var(--radius-sm)', background: 'var(--surface3)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', padding: '0 8px', fontFamily: 'var(--body)', fontSize: 10, color: 'var(--white)' }}>Berlin Marathon</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {['3:21:05', 'Marathon'].map(v => (
          <div key={v} style={{ height: 26, borderRadius: 'var(--radius-sm)', background: 'var(--surface3)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', padding: '0 8px', fontFamily: 'var(--body)', fontSize: 10, color: 'var(--white)' }}>{v}</div>
        ))}
      </div>
    </div>
  )
}
function StepMiniTrack() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, width: '100%', maxWidth: 230 }}>
      {[['42', 'RACES'], ['3:21', 'PR'], ['18', 'MEDALS'], ['HOT', 'FORM']].map(([v, l]) => (
        <div key={l} style={{ ...cardSurface, padding: 'var(--sp-2)' }}>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 18, color: l === 'FORM' ? 'var(--green)' : 'var(--white)' }}>{v}</div>
          <div style={{ fontFamily: 'var(--body)', fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{l}</div>
        </div>
      ))}
    </div>
  )
}
const STEPS = [
  { n: '01', title: 'Sign up', line: 'Create your athlete profile in under a minute. No AI key, no setup — just you.', mock: <StepMiniSignup /> },
  { n: '02', title: 'Log your races', line: 'Add a finish line in seconds — search the catalog or enter it by hand. Times, splits, medals, photos.', mock: <StepMiniLog /> },
  { n: '03', title: 'Track everything', line: 'PRs, medals, history, analytics and your race map all build automatically as you log.', mock: <StepMiniTrack /> },
]
function HowItWorks() {
  return (
    <motion.section className="pl-how" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-10% 0px' }}>
      <motion.p className="pl-eyebrow" variants={fadeUp} style={{ textAlign: 'center' }}>How it works</motion.p>
      <motion.h2 className="pl-how-title" variants={fadeUp}>Up and running in three steps</motion.h2>
      <div className="pl-how-grid">
        {STEPS.map(s => (
          <motion.div className="pl-how-step" key={s.n} variants={fadeUp}>
            <div className="pl-how-num">{s.n}</div>
            <h3 className="pl-how-step-title">{s.title}</h3>
            <p className="pl-how-step-line">{s.line}</p>
            <div className="pl-how-mock">{s.mock}</div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  )
}

/* =====================================================================
   TESTIMONIALS — rotating spotlight. Real persona quotes, one per athlete
   type, sourced from the demo data so they stay in sync.
   ===================================================================== */
const TESTIMONIALS = DEMO_TESTIMONIALS.map(t => ({ quote: t.quote, name: t.name, role: t.meta }))
function Testimonials() {
  const [i, setI] = useState(0)
  const reduce = useReducedMotion()
  useEffect(() => {
    if (reduce) return
    const id = window.setInterval(() => setI(v => (v + 1) % TESTIMONIALS.length), 5200)
    return () => window.clearInterval(id)
  }, [reduce])
  const t = TESTIMONIALS[i]
  const initials = t.name.split(/[ .]+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('')
  return (
    <motion.section className="pl-quotes" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
      <motion.p className="pl-eyebrow" variants={fadeUp}>What athletes say</motion.p>
      <div className="pl-quote-stage">
        <AnimatePresence mode="wait">
          <motion.blockquote className="pl-quote" key={i}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
            <span className="pl-quote-mark">“</span>{t.quote}
            <footer className="pl-quote-author">
              <span className="pl-quote-avatar">{initials}</span>
              <span><strong>{t.name}</strong><br />{t.role}</span>
            </footer>
          </motion.blockquote>
        </AnimatePresence>
      </div>
      <div className="pl-quote-dots">
        {TESTIMONIALS.map((_, idx) => (
          <button key={idx} aria-label={`Testimonial ${idx + 1}`}
            className={idx === i ? 'on' : ''} onClick={() => setI(idx)} />
        ))}
      </div>
    </motion.section>
  )
}

/* =====================================================================
   FAQ — accordion
   ===================================================================== */
const FAQS = [
  { q: 'Is BREAKTAPES free?', a: 'Yes, free to start. Core tracking (races, PRs, medals, history, your race map) is free. A Pro tier with advanced analytics and themes is coming later.' },
  { q: 'Do I need an AI or API key?', a: 'No. BREAKTAPES works fully without any AI key or external setup. Just sign up and start logging.' },
  { q: 'Which wearables can I connect?', a: 'WHOOP is live today. Recovery and workouts sync straight in. Strava, Garmin, Apple Health, COROS and Oura are on the way.' },
  { q: 'Is my data private, and can I export it?', a: 'Your data is yours. Your profile is private by default — you choose what (if anything) to make public — and you can export everything any time.' },
]
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`pl-faq-item${open ? ' open' : ''}`}>
      <button className="pl-faq-q" aria-expanded={open} style={{ textAlign: 'left' }}
        onClick={() => { setOpen(o => !o); if (!open) track('landing_faq_open', { q }) }}>
        <span>{q}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="pl-faq-a" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
            <p style={{ textAlign: 'left' }}>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
function FAQ() {
  return (
    <motion.section className="pl-faq" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
      <motion.p className="pl-eyebrow" variants={fadeUp} style={{ textAlign: 'left' }}>FAQ</motion.p>
      <motion.h2 className="pl-faq-title" variants={fadeUp} style={{ textAlign: 'left' }}>Questions, answered</motion.h2>
      <motion.div className="pl-faq-list" variants={fadeUp}>
        {FAQS.map(f => <FAQItem key={f.q} q={f.q} a={f.a} />)}
      </motion.div>
    </motion.section>
  )
}

/* =====================================================================
   LIVE SANDBOX — embeds /demo in a framed window, lazy-mounted on approach.
   ===================================================================== */
function SandboxSection({ persona }: { persona: DemoPersonaId }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '300px' })
  // The ONLY live app iframe on the page (everything else is a screenshot), so
  // it always loads reliably. Seeded with the persona chosen in the selector.
  return (
    <motion.section className="pl-sandbox" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
      <motion.p className="pl-eyebrow" variants={fadeUp}>Try it yourself</motion.p>
      <motion.h2 className="pl-sandbox-title" variants={fadeUp}>The app, live — no signup</motion.h2>
      <motion.p className="pl-sandbox-sub" variants={fadeUp}>
        Switch between athletes and tap around the dashboard, races, and profile. A real, interactive demo — nothing to install.
      </motion.p>
      <motion.div className="pl-sandbox-window" variants={fadeUp} ref={ref}>
        <div className="pl-sandbox-bar"><i /><i /><i /><span>app.breaktapes.com/demo</span></div>
        {inView && (
          <iframe key={persona} className="pl-sandbox-frame" src={`/demo?persona=${persona}`} title="BREAKTAPES interactive demo" />
        )}
      </motion.div>
      <motion.a className="pl-sandbox-open" href={`/demo?persona=${persona}`} target="_blank" rel="noopener" variants={fadeUp}
        onClick={() => track('landing_demo_fullscreen')}>Open full demo ↗</motion.a>
    </motion.section>
  )
}

/* =====================================================================
   PAGE
   ===================================================================== */
export default function LandingPage({ onSignUp, onSignIn }: LandingPageProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const [loaded, setLoaded] = useState(false)
  const [navVisible, setNavVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const [persona, setPersona] = useState<DemoPersonaId>('sa-marathoner')
  const [screen, setScreen] = useState(0)
  const stageRef = useRef<HTMLDivElement>(null)

  const handleSignUp = useCallback(() => { track('landing_cta_click', { cta: 'get_started' }); onSignUp() }, [onSignUp])
  const handleSignIn = useCallback(() => { track('landing_cta_click', { cta: 'sign_in' }); onSignIn() }, [onSignIn])

  // GSAP scrubbed parallax on mockups; respects reduced-motion.
  useEffect(() => {
    if (reduce || !loaded) return
    const scroller = scrollRef.current
    if (!scroller) return
    const ctx = gsap.context(() => {
      ScrollTrigger.defaults({ scroller })
      gsap.utils.toArray<HTMLElement>('.pl-parallax').forEach(el => {
        const depth = Number(el.dataset.depth || 40)
        gsap.fromTo(el, { y: depth }, {
          y: -depth, ease: 'none',
          scrollTrigger: { trigger: el.closest('.pl-showcase, .pl-hero') as Element, start: 'top bottom', end: 'bottom top', scrub: 0.5 },
        })
      })
    }, scrollRef)
    const t = window.setTimeout(() => ScrollTrigger.refresh(), 120)
    return () => { window.clearTimeout(t); ctx.revert() }
  }, [reduce, loaded])

  // Drive the scroll-progress bar + floating-nav reveal from the container's
  // native scroll. (Framer's useScroll({ container }) doesn't track our fixed,
  // internally-scrolling #landing-screen reliably.)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const max = el.scrollHeight - el.clientHeight
        const p = max > 0 ? el.scrollTop / max : 0
        setProgress(p)
        setNavVisible(p > 0.06)
        // Drive the pinned phone-stage screen index from scroll within its section.
        const stage = stageRef.current
        if (stage) {
          const dur = stage.offsetHeight - el.clientHeight
          const sp = dur > 0 ? (el.scrollTop - stage.offsetTop) / dur : 0
          const idx = Math.max(0, Math.min(STAGE_SCREENS.length - 1, Math.floor(sp * STAGE_SCREENS.length)))
          setScreen(idx)
        }
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => { el.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf) }
  }, [])

  return (
    <div id="landing-screen" ref={scrollRef} className="pl-root">
      <AnimatePresence>
        {!loaded && <LoaderOverlay key="loader" onDone={() => setLoaded(true)} />}
      </AnimatePresence>

      <TopChrome progress={progress} onSignUp={handleSignUp} onSignIn={handleSignIn} visible={navVisible} />

      {/* ---------------- HERO ---------------- */}
      <section className="pl-hero">
        <motion.div className="pl-hero-copy" variants={stagger} initial="hidden" animate={loaded ? 'show' : 'hidden'}>
          <motion.div className="landing-wordmark" variants={fadeUp}>BREAK<span className="slash">/</span>TAPES</motion.div>
          <motion.h1 className="landing-headline" variants={fadeUp}>
            Every Finish Line,<br /><em>Remembered.</em>
          </motion.h1>
          <motion.p className="landing-sub" variants={fadeUp} style={{ maxWidth: 440 }}>
            From start line to medal wall — your whole racing life in one place.
          </motion.p>
          <motion.div className="pl-hero-actions" variants={fadeUp}>
            <button className="btn-main" onClick={handleSignUp}>Get Started — It's Free</button>
            <button className="landing-sign-in-link" onClick={handleSignIn}>Already have an account? Sign in</button>
          </motion.div>
          <motion.div className="landing-proof" variants={fadeUp} style={{ justifyContent: 'flex-start' }}>
            <span className="landing-proof-stat"><strong>Free</strong> · to start</span>
            <span className="landing-proof-dot" aria-hidden="true">·</span>
            <span className="landing-proof-stat"><strong>No AI key</strong> · needed</span>
            <span className="landing-proof-dot" aria-hidden="true">·</span>
            <span className="landing-proof-stat"><strong>Your data</strong> · yours</span>
          </motion.div>
        </motion.div>
        <div className="pl-hero-art pl-parallax" data-depth={30}>
          <motion.div
            initial={{ opacity: 0, y: 40, rotate: -2 }} animate={loaded ? { opacity: 1, y: 0, rotate: -2 } : {}}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}>
            <DashboardMockup />
          </motion.div>
        </div>
        <motion.div className="pl-scroll-hint" initial={{ opacity: 0 }} animate={loaded ? { opacity: 1 } : {}}
          transition={{ delay: 1.2 }} aria-hidden="true">
          <span>Scroll</span>
          <motion.span animate={reduce ? {} : { y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.6 }}>↓</motion.span>
        </motion.div>
      </section>

      {/* ---------------- PERSONA SELECTOR ---------------- */}
      <PersonaSelector value={persona} onChange={setPersona} />

      {/* ---------------- FEATURE SHOWCASES (real app screenshots) ---------------- */}
      <FeatureShowcase
        id="race-history"
        eyebrow="Race History" title="Every finish line, mapped"
        desc={'Your whole racing life on one interactive map. Times, splits, placing, terrain, and the weather you ran through — kept for good.'}
        bullets={['Real world map of every race city', 'Splits, placing & conditions per race', 'Year-by-year history and filters']}
        mockup={<ShowcaseShot src={SHOTS.races} title="Race history — world map" />}
      />
      <FeatureShowcase
        id="auto-prs" reverse
        eyebrow="Auto PRs" title="Personal bests, computed for you"
        desc={'The moment you log a race, BREAKTAPES recomputes your bests across every distance. No spreadsheets, no manual tracking.'}
        bullets={['PRs across 5K → ultra & triathlon', 'Instant recalculation on every log', 'Age-grade & momentum scoring']}
        mockup={<ShowcaseShot src={SHOTS.pbs} title="Personal bests" />}
      />
      <FeatureShowcase
        id="medal-wall"
        eyebrow="Medal Wall" title="Show off the hardware"
        desc={"Every medal you've earned in one place — gold, silver, bronze and finisher, tier by tier."}
        bullets={['Gold, silver, bronze & finisher tiers', 'PB-flagged podium results', 'Every medal, kept for good']}
        mockup={<ShowcaseShot src={SHOTS.medals} title="Medal wall" />}
      />
      <FeatureShowcase
        id="wearables" reverse
        eyebrow="Training & Wearables" title="Your training, side by side"
        desc={'Connect WHOOP today and see the training that built every result, right next to the race. More integrations are on the way.'}
        bullets={['WHOOP live now — recovery & workouts', 'Strava, Garmin, Apple Health coming soon', 'Training load vs race performance']}
        mockup={<WearablesMockup />}
      />

      {/* ---------------- PHONE-SCROLL CENTERPIECE ---------------- */}
      <PhoneStage screen={screen} stageRef={stageRef} />

      {/* ---------------- HOW IT WORKS ---------------- */}
      <HowItWorks />

      {/* ---------------- LIVE SANDBOX ---------------- */}
      <SandboxSection persona={persona} />

      {/* ---------------- STATS BAND ---------------- */}
      <motion.section className="pl-stats" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
        <motion.h2 className="pl-stats-title" variants={fadeUp}>Built for people who actually race</motion.h2>
        <div className="pl-stats-grid">
          {[
            { to: 3000, suffix: '+', label: 'Races in the global race catalog' },
            { to: 40, suffix: '+', label: 'Widgets' },
            { to: 100, suffix: '%', label: 'Yours — export anytime' },
          ].map(s => (
            <motion.div key={s.label} className="pl-stat" variants={fadeUp}>
              <div className="pl-stat-num"><Counter to={s.to} suffix={s.suffix} /></div>
              <div className="pl-stat-label">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ---------------- TESTIMONIALS ---------------- */}
      <Testimonials />

      {/* ---------------- FAQ ---------------- */}
      <FAQ />

      {/* ---------------- FINAL CTA ---------------- */}
      <motion.section className="pl-cta" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
        <motion.h2 className="pl-cta-title" variants={fadeUp}>Start logging your<br /><em>finish lines.</em></motion.h2>
        <motion.p className="pl-cta-sub" variants={fadeUp}>Free to start. Set up your athlete profile in under a minute.</motion.p>
        <motion.div className="pl-cta-actions" variants={fadeUp}>
          <button className="btn-main" onClick={handleSignUp}>Get Started — It's Free</button>
          <button className="landing-sign-in-link" onClick={handleSignIn}>Already have an account? Sign in</button>
        </motion.div>
      </motion.section>

      {/* ---------------- FOOTER ---------------- */}
      <footer className="landing-footer">
        <div className="landing-footer-wordmark">BREAK<span className="slash">/</span>TAPES</div>
        <p className="landing-footer-tag">Log every finish line.</p>
        <nav className="landing-footer-links">
          <a href="/privacy">Privacy</a>
          <span aria-hidden="true">·</span>
          <a href="/terms">Terms</a>
          <span aria-hidden="true">·</span>
          <a href="/help">Help</a>
        </nav>
        <p className="landing-footer-copy">© {new Date().getFullYear()} BREAKTAPES</p>
      </footer>
    </div>
  )
}

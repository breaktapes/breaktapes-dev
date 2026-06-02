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
import { WORLD_MAP_PATH, projectLngLat } from '@/lib/worldMap'
import { DEMO_TESTIMONIALS, DEMO_PERSONA_LIST, DEMO_PERSONAS, type DemoPersonaId } from '@/lib/demoData'
import type { Race } from '@/types'

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

/* ---------- DATA-DRIVEN APP MOCKUPS ----------
   Stylized recreations of the real app screens (race map / personal bests /
   medal wall) computed from each persona's actual race data. Deterministic,
   per-persona, no screenshots — looks like the app, never breaks. */
type ShotScreen = 'predictor' | 'planner' | 'pacing' | 'momentum' | 'dna'

/** Render shell. `framed` → phone device; otherwise a plain rounded rectangle
 *  (edge-to-edge). Content is fluid and fills the screen — never cropped. */
function Shell({ children, pad = true, framed = false }: { children: React.ReactNode; pad?: boolean; framed?: boolean }) {
  if (framed) {
    return (
      <div style={{ width: '100%', maxWidth: 290, margin: '0 auto', aspectRatio: '390 / 844',
        background: 'var(--surface)', border: '8px solid #16181c', borderRadius: 38,
        boxShadow: '0 40px 90px -30px rgba(0,0,0,0.85), inset 0 0 0 1px rgba(255,255,255,0.05)',
        overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
          width: 92, height: 18, background: '#000', borderRadius: 12, zIndex: 5 }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: 30, overflow: 'hidden',
          padding: pad ? '40px 16px 16px' : 0, display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </div>
    )
  }
  return (
    <div style={{ width: '100%', maxWidth: 440, margin: '0 auto', aspectRatio: '430 / 560',
      background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-lg)',
      boxShadow: '0 30px 80px -40px rgba(0,0,0,0.8)', overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden',
        padding: pad ? '18px' : 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}

const DIST_KM: Record<string, number> = { 'IRONMAN': 226, '70.3': 113, 'Olympic': 51.5, 'Sprint': 25.75, 'HYROX': 8, '100 Mile': 160.9, '100K': 100, '50K': 50, 'Ultra': 60, 'Marathon': 42.2, 'Half Marathon': 21.1 }
function distKm(d: string): number { if (DIST_KM[d] != null) return DIST_KM[d]; const n = parseFloat(d); return Number.isNaN(n) ? 0 : n }
function distLabel(d: string): string {
  const n = parseFloat(d)
  if (!Number.isNaN(n) && String(n) === d.trim()) {
    if (Math.abs(n - 42.2) < 0.3) return 'MARATHON'
    if (Math.abs(n - 21.1) < 0.3) return 'HALF MARATHON'
    if (n === 10) return '10K'; if (n === 5) return '5K'
    return `${d} KM`
  }
  return d.toUpperCase()
}
function t2s(t?: string): number { if (!t) return Infinity; const a = t.split(':').map(Number); if (a.some(Number.isNaN)) return Infinity; return a.length === 3 ? a[0]*3600 + a[1]*60 + a[2] : a.length === 2 ? a[0]*60 + a[1] : Infinity }
const MEDAL_RGB: Record<string, [string, string, string]> = {
  gold: ['#FFD770', '#B8860B', 'GOLD'], silver: ['#C8D4DC', '#6A7880', 'SILVER'],
  bronze: ['#CD8C5A', '#7A4420', 'BRONZE'], custom: ['#9B7BE8', '#5A3FA0', 'VIC CLAPHAM'],
  finisher: ['#E8895A', '#A8421A', 'FINISHER'],
}
const sectionLabel: React.CSSProperties = { fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--white)' }

/* ----- Race map mockup ----- */
function MapMockup({ persona, framed = false }: { persona: DemoPersonaId; framed?: boolean }) {
  const races = DEMO_PERSONAS[persona].races.filter(r => r.lat != null && r.lng != null)
  const cities = new Set(races.map(r => r.city)).size
  const countries = new Set(races.map(r => r.country)).size
  const km = Math.round(races.reduce((s, r) => s + distKm(r.distance), 0))
  // Equirectangular x = (lng+180)/360*1000, so the antimeridian (±180°) is a hard
  // seam: a Pacific-spread athlete (Hawaii at x≈69, Australia/NZ at x≈900+) would
  // span ~92% of the map and zoom out to nothing. Split the pins at their largest
  // longitude gap and unwrap the smaller group by +1000 so the cluster is
  // contiguous; the map path is drawn in repeated copies so wrapped pins keep land.
  const raw = races.map(r => projectLngLat(r.lng!, r.lat!))
  let pins = raw
  if (raw.length > 1) {
    const sx = raw.map(p => p[0]).slice().sort((a, b) => a - b)
    let gap = -1, thr: number | null = null
    for (let k = 0; k < sx.length; k++) {
      const cur = sx[k], nxt = k + 1 < sx.length ? sx[k + 1] : sx[0] + 1000
      const g = nxt - cur
      if (g > gap) { gap = g; thr = k + 1 < sx.length ? cur : null }
    }
    if (thr != null) { const t = thr; pins = raw.map(([x, y]) => (x <= t ? [x + 1000, y] as [number, number] : [x, y] as [number, number])) }
  }
  const xs = pins.map(p => p[0]), ys = pins.map(p => p[1])
  let minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  // Minimum span → consistent zoom across personas: a tight 2-city cluster still
  // shows regional context instead of extreme zoom-in. (150 x-units ≈ 54° lng.)
  const cx0 = (minX + maxX) / 2, cy0 = (minY + maxY) / 2
  if (maxX - minX < 150) { minX = cx0 - 75; maxX = cx0 + 75 }
  if (maxY - minY < 110) { minY = cy0 - 55; maxY = cy0 + 55 }
  const spanX = maxX - minX, spanY = maxY - minY
  const padX = spanX * 0.5, padY = spanY * 0.5
  minX -= padX; maxX += padX; minY -= padY; maxY += padY
  // preserveAspectRatio="slice" crops the overflow axis to fill the card. Grow the
  // shorter axis so the box matches the container AR before slicing (else a wide,
  // short box gets blown up into a sliver).
  const targetAR = framed ? 0.52 : 0.86 // map-area width/height (phone vs rectangle)
  let w = maxX - minX, h = maxY - minY
  if (w / h < targetAR) { const nw = h * targetAR, cx = (minX + maxX) / 2; minX = cx - nw / 2; maxX = cx + nw / 2; w = nw }
  else { const nh = w / targetAR, cy = (minY + maxY) / 2; minY = cy - nh / 2; maxY = cy + nh / 2; h = nh }
  // Keep the viewBox inside the drawn map vertically (0..500) so we never show
  // dead space past the poles — that void was what made wide maps look "weird".
  if (h >= 500) { minY = 0; h = 500 } else { minY = Math.max(0, Math.min(minY, 500 - h)) }
  const vb = `${minX} ${minY} ${w} ${h}`
  const pinR = Math.min(spanX * 0.014 + 3, 9) // cap so global personas don't get huge dots
  return (
    <Shell pad={false} framed={framed}>
      <div style={{ flex: 1, position: 'relative', background: 'radial-gradient(ellipse at 50% 40%, #2a3138, #14181c)', overflow: 'hidden' }}>
        <svg viewBox={vb} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0 }}>
          {[-1000, 0, 1000, 2000].map(ox => (
            <path key={ox} d={WORLD_MAP_PATH} transform={`translate(${ox} 0)`} fill="rgba(0,0,0,0.55)" stroke="rgba(232,224,213,0.18)" strokeWidth="0.8" />
          ))}
          {pins.map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={pinR * 1.9} fill="rgba(var(--orange-ch),0.3)" />
              <circle cx={x} cy={y} r={pinR} fill="var(--orange)" stroke="#000" strokeWidth="0.8" />
            </g>
          ))}
        </svg>
        <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(10,10,10,0.85)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-pill)', padding: '5px 11px' }}>
          <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 14, color: 'var(--orange)' }}>{cities}</span>
          <span style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', color: 'var(--white)' }}>CITIES ›</span>
        </div>
      </div>
      <div style={{ padding: '12px 12px 14px', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
          {[[races.length, 'RACES'], [cities, 'CITIES'], [countries, 'COUNTRIES'], [km.toLocaleString(), 'KM']].map(([v, l]) => (
            <div key={l as string} style={{ ...cardSurface, padding: '8px 4px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 15, color: 'var(--white)' }}>{v}</div>
              <div style={{ fontFamily: 'var(--body)', fontSize: 8, letterSpacing: '0.06em', color: 'var(--muted)' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  )
}

/* ----- Personal bests mockup ----- */
function PBMockup({ persona, framed = false }: { persona: DemoPersonaId; framed?: boolean }) {
  const races = DEMO_PERSONAS[persona].races.filter(r => r.time && r.sport === 'running')
  const best = new Map<string, Race>()
  for (const r of races) { const k = distLabel(r.distance); const cur = best.get(k); if (!cur || t2s(r.time) < t2s(cur.time)) best.set(k, r) }
  const top = [...best.values()].sort((a, b) => distKm(b.distance) - distKm(a.distance)).slice(0, 4)
  const hero = [...best.values()].sort((a, b) => t2s(a.time) - t2s(b.time))[0] ?? top[0]
  return (
    <Shell framed={framed}>
      <div style={sectionLabel as React.CSSProperties}>PERSONAL BESTS</div>
      {hero && (
        <div style={{ marginTop: 10, padding: '12px', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--green)', background: 'linear-gradient(120deg, rgba(var(--green-ch),0.1), var(--surface2))' }}>
          <div style={{ fontFamily: 'var(--body)', fontSize: 8, letterSpacing: '0.12em', color: 'var(--muted)' }}>{distLabel(hero.distance)}</div>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 30, color: 'var(--green)', lineHeight: 1 }}>{hero.time}</div>
          <div style={{ fontFamily: 'var(--body)', fontSize: 9, color: 'var(--muted)', marginTop: 3 }}>{hero.name}</div>
        </div>
      )}
      <div style={{ ...sectionLabel, fontSize: 10, marginTop: 16 }}>SIGNATURE DISTANCES</div>
      <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
        {top.map((r, i) => (
          <div key={r.id} style={{ ...cardSurface, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 9, borderColor: i === 0 ? 'rgba(var(--orange-ch),0.4)' : 'var(--border)' }}>
            <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 15, color: i === 0 ? 'var(--orange)' : 'var(--muted)' }}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 11, color: 'var(--white)' }}>{distLabel(r.distance)}</div>
              <div style={{ fontFamily: 'var(--body)', fontSize: 8, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
            </div>
            <span style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 12, color: 'var(--white)' }}>{r.time}</span>
          </div>
        ))}
      </div>
    </Shell>
  )
}

/* ----- Medal wall mockup ----- */
function MedalMockup({ persona, framed = false }: { persona: DemoPersonaId; framed?: boolean }) {
  const races = DEMO_PERSONAS[persona].races
  const counts = { gold: 0, silver: 0, bronze: 0, custom: 0, finisher: 0 } as Record<string, number>
  for (const r of races) { const m = (r.medal || 'finisher'); if (counts[m] != null) counts[m]++ }
  const order = ['custom', 'gold', 'silver', 'bronze', 'finisher'] // custom (rare, e.g. Vic Clapham) leads
  const cards = [...races].filter(r => r.medal).sort((a, b) => order.indexOf(a.medal!) - order.indexOf(b.medal!)).slice(0, 6)
  return (
    <Shell framed={framed}>
      <div style={sectionLabel as React.CSSProperties}>MEDALS</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {order.filter(t => counts[t] > 0).map(t => {
          const [a, , label] = MEDAL_RGB[t]
          return (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 'var(--radius-pill)', border: `1px solid ${a}55`, background: `${a}14` }}>
              <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 13, color: a }}>{counts[t]}</span>
              <span style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 9, letterSpacing: '0.06em', color: 'var(--muted)' }}>{label}</span>
            </span>
          )
        })}
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12, alignContent: 'start' }}>
        {cards.map(r => {
          const [a, b, label] = MEDAL_RGB[r.medal!]
          return (
            <div key={r.id} style={{ padding: '11px 12px', borderRadius: 'var(--radius-md)', border: `1px solid ${a}30`, background: `linear-gradient(155deg, ${b}26, var(--surface2) 70%)`, display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, ${a}, ${b})`, flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 10, letterSpacing: '0.06em', color: a }}>{label}</span>
              </div>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 11, color: 'var(--white)', lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
              <div style={{ fontFamily: 'var(--body)', fontSize: 9, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{distLabel(r.distance)} · {r.time}</div>
            </div>
          )
        })}
      </div>
    </Shell>
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




/* Clean stroke icons (21st.dev / lucide style) — no emoji anywhere. */
function ActIcon({ k }: { k: string }) {
  const c = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (k === 'run') return (<svg {...c}><circle cx="17" cy="5" r="2" /><path d="M14.5 8 11 10l2 3-3 5" /><path d="M8 9.5 11.5 8l3 2.5 3 1" /><path d="m6 21 2.5-3.5" /></svg>)
  if (k === 'bike') return (<svg {...c}><circle cx="6" cy="17" r="3" /><circle cx="18" cy="17" r="3" /><path d="M6 17l4.5-7.5H15l-2-3" /><path d="M12.5 6.5H16" /></svg>)
  if (k === 'swim') return (<svg {...c}><circle cx="17" cy="6.5" r="1.7" /><path d="M5 12l5-3 3.5 2.5" /><path d="M3 17c1.5 0 1.5-1.2 3-1.2s1.5 1.2 3 1.2 1.5-1.2 3-1.2 1.5 1.2 3 1.2 1.5-1.2 3-1.2" /></svg>)
  if (k === 'hyrox') return (<svg {...{ ...c, fill: 'currentColor', stroke: 'none' }}><path d="M13 2 5 13h5l-1 9 9-12h-5l3-8z" /></svg>)
  return (<svg {...c}><path d="M4 8v8M7.5 6v12M16.5 6v12M20 8v8M7.5 12h9" /></svg>)
}
function MiniHeart() { return (<svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block' }}><path d="M12 21s-7-4.6-9.3-8.4C.8 9.3 2.3 6 5.6 6c1.9 0 3.2 1.1 4 2.2.8-1.1 2.1-2.2 4-2.2 3.3 0 4.8 3.3 2.9 6.6C19 16.4 12 21 12 21z" /></svg>) }

/* Wearables — only WHOOP is production-authorized. Others are "Coming soon".
   Rendered as a rectangle mockup to match the other showcases. */
function WearablesMockup() {
  const soon = ['STRAVA', 'GARMIN', 'APPLE', 'COROS', 'OURA']
  const metrics: [string, string, string][] = [
    ['STRAIN', '14.2', 'var(--orange)'],
    ['SLEEP', '7h 48m', 'var(--white)'],
    ['RESTING HR', '46', 'var(--green)'],
  ]
  // Each activity carries avg speed/pace, avg HR and a third effort metric.
  const acts: { k: string; name: string; sub: string; m: [string, string][]; zone: number; accent: string }[] = [
    { k: 'run', name: 'TEMPO RUN', sub: '12.4 km · 52:18', m: [['AVG PACE', '4:52/km'], ['AVG HR', '158'], ['CADENCE', '182']], zone: 0.84, accent: 'var(--orange)' },
    { k: 'bike', name: 'THRESHOLD RIDE', sub: '64.0 km · 2:03:40', m: [['AVG SPEED', '31.2 km/h'], ['AVG HR', '146'], ['AVG POWER', '245 W']], zone: 0.70, accent: 'var(--orange)' },
    { k: 'swim', name: 'OPEN-WATER SWIM', sub: '2.0 km · 38:40', m: [['AVG PACE', '1:55/100m'], ['AVG HR', '132'], ['SWOLF', '38']], zone: 0.52, accent: 'var(--green)' },
    { k: 'hyrox', name: 'HYROX SIM', sub: '58:20 · 8 stations', m: [['AVG SPEED', '11.4 km/h'], ['AVG HR', '164'], ['STRAIN', '12.1']], zone: 0.92, accent: 'var(--green)' },
  ]
  return (
    <Shell>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--green-dim)', border: '1px solid rgba(var(--green-ch),0.45)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
          <span style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 10, letterSpacing: '0.06em', color: 'var(--white)' }}>WHOOP · LIVE</span>
        </span>
        {soon.map(b => (
          <span key={b} style={{ padding: '5px 9px', borderRadius: 'var(--radius-pill)', background: 'var(--surface3)', border: '1px solid var(--border)', fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 9, letterSpacing: '0.05em', color: 'var(--muted)' }}>{b} · SOON</span>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
        <div style={{ ...cardSurface, padding: '12px', background: 'linear-gradient(150deg, rgba(var(--green-ch),0.12), var(--surface2))' }}>
          <div style={{ fontFamily: 'var(--body)', fontSize: 8, letterSpacing: '0.1em', color: 'var(--muted)' }}>RECOVERY</div>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 30, color: 'var(--green)', lineHeight: 1 }}>88<span style={{ fontSize: 15 }}>%</span></div>
          <div style={{ fontFamily: 'var(--body)', fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>Ready to train</div>
        </div>
        <div style={{ ...cardSurface, padding: '12px' }}>
          <div style={{ fontFamily: 'var(--body)', fontSize: 8, letterSpacing: '0.1em', color: 'var(--muted)' }}>TRAINING LOAD</div>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 30, color: 'var(--white)', lineHeight: 1 }}>14.2</div>
          <div style={{ display: 'flex', gap: 3, marginTop: 8, alignItems: 'flex-end', height: 22 }}>
            {[40, 62, 51, 78, 88, 70, 95].map((h, i) => (
              <motion.div key={i} initial={{ height: 0 }} whileInView={{ height: `${h}%` }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.06, ease: 'easeOut' }} style={{ flex: 1, borderRadius: '2px 2px 0 0', background: i === 6 ? 'var(--green)' : 'rgba(var(--orange-ch),0.5)' }} />
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 8 }}>
        {metrics.map(([l, v, c]) => (
          <div key={l} style={{ ...cardSurface, padding: '9px 8px' }}>
            <div style={{ fontFamily: 'var(--body)', fontSize: 7.5, letterSpacing: '0.08em', color: 'var(--muted)' }}>{l}</div>
            <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 17, color: c, lineHeight: 1, marginTop: 3 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ ...sectionLabel, fontSize: 10, marginTop: 14 }}>RECENT ACTIVITY</div>
      <div style={{ display: 'grid', gap: 7, marginTop: 8 }}>
        {acts.map((a, i) => (
          <motion.div key={a.name} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }} style={{ ...cardSurface, padding: '10px 11px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', background: `color-mix(in srgb, ${a.accent} 16%, transparent)`, color: a.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ActIcon k={a.k} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 11, letterSpacing: '0.02em', color: 'var(--white)' }}>{a.name}</div>
                <div style={{ fontFamily: 'var(--body)', fontSize: 8.5, color: 'var(--muted)' }}>{a.sub}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
              {a.m.map(([l, v]) => (
                <div key={l} style={{ flex: 1, background: 'var(--surface3)', borderRadius: 'var(--radius-sm)', padding: '5px 4px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--body)', fontSize: 6.5, letterSpacing: '0.04em', color: 'var(--muted)' }}>{l}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 10.5, color: 'var(--white)', marginTop: 1 }}>
                    {l === 'AVG HR' ? <span style={{ color: '#FF5A3C', display: 'inline-flex' }}><MiniHeart /></span> : null}{v}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ height: 5, borderRadius: 3, background: 'var(--surface3)', overflow: 'hidden', marginTop: 8 }}>
              <motion.div initial={{ width: 0 }} whileInView={{ width: `${a.zone * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.9, delay: 0.1 + i * 0.08, ease: 'easeOut' }} style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, var(--green), var(--orange))' }} />
            </div>
          </motion.div>
        ))}
      </div>
    </Shell>
  )
}


/* =====================================================================
   PHONE-SCROLL STAGE — a pinned device cycles through screens on scroll.
   ===================================================================== */
const STAGE_SCREENS: { key: string; title: string; line: string; screen: ShotScreen }[] = [
  { key: 'predictor', title: 'Your race predictor', line: 'Every PB becomes a forecast. Equivalent times from 5K to marathon, recomputed on every log.', screen: 'predictor' },
  { key: 'planner', title: 'Your season plan', line: 'Your next races on one timeline, with the taper and peak weeks mapped to race day.', screen: 'planner' },
  { key: 'pacing', title: 'Your pacing IQ', line: 'Negative splitter or fader? Your split signature, read from every race you log.', screen: 'pacing' },
  { key: 'momentum', title: 'Your momentum', line: 'A single form score from your recent results, trending up or cooling off at a glance.', screen: 'momentum' },
  { key: 'dna', title: 'Your race DNA', line: 'The conditions you thrive in. Temperature, surface and terrain, distilled from your history.', screen: 'dna' },
]

function s2t(sec: number): string {
  sec = Math.round(sec)
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/* ----- Race predictor (Riegel equivalents from best PB) ----- */
function PredictorMockup({ persona, framed = false }: { persona: DemoPersonaId; framed?: boolean }) {
  const runs = DEMO_PERSONAS[persona].races.filter(r => r.time && r.sport === 'running' && distKm(r.distance) >= 3)
  let ref = runs[0], bestPace = Infinity
  for (const r of runs) { const p = t2s(r.time!) / distKm(r.distance); if (p < bestPace) { bestPace = p; ref = r } }
  const refKm = ref ? distKm(ref.distance) : 10, refSec = ref ? t2s(ref.time!) : 2400
  const rows: [string, number][] = [['5K', 5], ['10K', 10], ['HALF', 21.0975], ['MARATHON', 42.195]]
  return (
    <Shell framed={framed}>
      <div style={sectionLabel}>RACE PREDICTOR</div>
      <div style={{ marginTop: 10, padding: '12px', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--orange)', background: 'linear-gradient(120deg, rgba(var(--orange-ch),0.12), var(--surface2))' }}>
        <div style={{ fontFamily: 'var(--body)', fontSize: 8, letterSpacing: '0.12em', color: 'var(--muted)' }}>FROM YOUR {ref ? distLabel(ref.distance) : '10K'} PB</div>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 26, color: 'var(--orange)', lineHeight: 1 }}>{ref?.time ?? '—'}</div>
        <div style={{ fontFamily: 'var(--body)', fontSize: 9, color: 'var(--muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ref?.name}</div>
      </div>
      <div style={{ ...sectionLabel, fontSize: 10, marginTop: 16 }}>PREDICTED EQUIVALENTS</div>
      <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
        {rows.map(([lbl, d]) => (
          <div key={lbl} style={{ ...cardSurface, padding: '9px 11px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 11, color: 'var(--white)' }}>{lbl}</span>
            <span style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 13, color: 'var(--white)' }}>{s2t(refSec * Math.pow(d / refKm, 1.06))}</span>
          </div>
        ))}
      </div>
    </Shell>
  )
}

/* ----- Season planner (taper timeline + upcoming calendar) ----- */
function PlannerMockup({ persona, framed = false }: { persona: DemoPersonaId; framed?: boolean }) {
  const up = DEMO_PERSONAS[persona].upcoming.slice(0, 3)
  const next = up[0]
  return (
    <Shell framed={framed}>
      <div style={sectionLabel}>SEASON PLANNER</div>
      {next && (
        <div style={{ marginTop: 10, padding: '12px', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--green)', background: 'linear-gradient(120deg, rgba(var(--green-ch),0.1), var(--surface2))' }}>
          <div style={{ fontFamily: 'var(--body)', fontSize: 8, letterSpacing: '0.12em', color: 'var(--muted)' }}>NEXT KEY RACE</div>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 18, color: 'var(--white)', lineHeight: 1.05, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{next.name}</div>
          <div style={{ fontFamily: 'var(--body)', fontSize: 9, color: 'var(--muted)', marginTop: 3 }}>{next.date}{next.goalTime ? ` · goal ${next.goalTime}` : ''}</div>
        </div>
      )}
      <div style={{ ...sectionLabel, fontSize: 10, marginTop: 16 }}>TAPER &amp; PEAK</div>
      <div style={{ display: 'flex', gap: 3, marginTop: 8, height: 30, alignItems: 'flex-end' }}>
        {[42, 52, 60, 68, 76, 84, 92, 99, 86, 66, 50, 36].map((h, i) => (
          <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: '2px 2px 0 0', background: i >= 9 ? 'rgba(var(--green-ch),0.75)' : 'rgba(var(--orange-ch),0.5)' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontFamily: 'var(--body)', fontSize: 7.5, color: 'var(--muted)' }}>BUILD</span>
        <span style={{ fontFamily: 'var(--body)', fontSize: 7.5, color: 'var(--green)' }}>TAPER → RACE</span>
      </div>
      <div style={{ ...sectionLabel, fontSize: 10, marginTop: 14 }}>ON THE CALENDAR</div>
      <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
        {up.map(r => (
          <div key={r.id} style={{ ...cardSurface, padding: '9px 11px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 11, color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
              <div style={{ fontFamily: 'var(--body)', fontSize: 8, color: 'var(--muted)' }}>{distLabel(r.distance)}</div>
            </div>
            <span style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 11, color: 'var(--orange)', flexShrink: 0 }}>{r.date ? r.date.slice(5) : ''}</span>
          </div>
        ))}
      </div>
    </Shell>
  )
}

/* ----- Pacing IQ (split signature) ----- */
function PacingMockup({ persona, framed = false }: { persona: DemoPersonaId; framed?: boolean }) {
  const race = DEMO_PERSONAS[persona].races.find(r => r.splits && r.splits.length >= 4 && r.time)
  const segs = race?.splits?.map(s => t2s(s.split)) ?? [60, 60, 60, 60, 60]
  const half = Math.floor(segs.length / 2)
  const first = segs.slice(0, half).reduce((a, b) => a + b, 0) / Math.max(1, half)
  const second = segs.slice(half).reduce((a, b) => a + b, 0) / Math.max(1, segs.length - half)
  const tag = second < first * 0.98 ? 'NEGATIVE SPLITTER' : second > first * 1.03 ? 'FADER' : 'EVEN PACER'
  const desc = tag === 'NEGATIVE SPLITTER' ? 'You finish faster than you start.' : tag === 'FADER' ? 'You go out hot and hold on.' : 'Metronomic, wire to wire.'
  const max = Math.max(...segs), min = Math.min(...segs)
  return (
    <Shell framed={framed}>
      <div style={sectionLabel}>PACING IQ</div>
      <div style={{ marginTop: 10, padding: '12px', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--green)', background: 'linear-gradient(120deg, rgba(var(--green-ch),0.1), var(--surface2))' }}>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 19, color: 'var(--green)', lineHeight: 1 }}>{tag}</div>
        <div style={{ fontFamily: 'var(--body)', fontSize: 9, color: 'var(--muted)', marginTop: 4 }}>{desc}</div>
      </div>
      <div style={{ ...sectionLabel, fontSize: 10, marginTop: 16 }}>SPLIT SIGNATURE</div>
      <div style={{ display: 'flex', gap: 4, marginTop: 8, height: 60, alignItems: 'flex-end' }}>
        {segs.slice(0, 8).map((s, i) => {
          const h = max === min ? 60 : 30 + 60 * (s - min) / (max - min)
          return <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: '2px 2px 0 0', background: s <= first ? 'var(--green)' : 'rgba(var(--orange-ch),0.6)' }} />
        })}
      </div>
      <div style={{ fontFamily: 'var(--body)', fontSize: 8, color: 'var(--muted)', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{race?.name ?? 'Logged race splits'}</div>
    </Shell>
  )
}

/* ----- Career momentum (form trend) ----- */
function MomentumMockup({ persona, framed = false }: { persona: DemoPersonaId; framed?: boolean }) {
  const runs = DEMO_PERSONAS[persona].races.filter(r => r.time && r.sport === 'running').slice().sort((a, b) => (a.date < b.date ? -1 : 1))
  const perf = runs.slice(-8).map(r => distKm(r.distance) / t2s(r.time!) * 1000)
  const pts = perf.length >= 2 ? perf : [1, 1.1]
  const mn = Math.min(...pts), mx = Math.max(...pts)
  const W = 240, H = 60
  const path = pts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i / (pts.length - 1)) * W} ${H - (mx === mn ? H / 2 : ((v - mn) / (mx - mn)) * (H - 8) + 4)}`).join(' ')
  const rising = pts[pts.length - 1] >= pts[0]
  const score = Math.round(60 + 35 * (mx === mn ? 0.5 : (pts[pts.length - 1] - mn) / (mx - mn)))
  const badge = rising && score >= 85 ? 'HOT' : rising ? 'RISING' : 'STEADY'
  return (
    <Shell framed={framed}>
      <div style={sectionLabel}>CAREER MOMENTUM</div>
      <div style={{ marginTop: 10, padding: '12px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: '3px solid var(--orange)', background: 'linear-gradient(120deg, rgba(var(--orange-ch),0.12), var(--surface2))' }}>
        <div>
          <div style={{ fontFamily: 'var(--body)', fontSize: 8, letterSpacing: '0.12em', color: 'var(--muted)' }}>FORM SCORE</div>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 30, color: 'var(--orange)', lineHeight: 1 }}>{score}</div>
        </div>
        <span style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 11, letterSpacing: '0.06em', color: 'var(--green)', padding: '4px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--green-dim)' }}>▲ {badge}</span>
      </div>
      <div style={{ ...sectionLabel, fontSize: 10, marginTop: 16 }}>FORM TREND</div>
      <div style={{ ...cardSurface, padding: '12px', marginTop: 8 }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="56" preserveAspectRatio="none">
          <path d={path} fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </Shell>
  )
}

/* ----- Race DNA (conditions you thrive in) ----- */
function DNAMockup({ persona, framed = false }: { persona: DemoPersonaId; framed?: boolean }) {
  const races = DEMO_PERSONAS[persona].races
  const buckets: [string, number, string][] = [['COLD', 0, '#5B8DEF'], ['COOL', 0, '#2BD4A0'], ['WARM', 0, '#FFB347'], ['HOT', 0, '#FF5A3C']]
  races.forEach(r => { const t = r.weather?.temp; if (t == null) return; const i = t < 10 ? 0 : t < 18 ? 1 : t < 26 ? 2 : 3; buckets[i][1]++ })
  const maxB = Math.max(1, ...buckets.map(b => b[1]))
  const best = buckets.slice().sort((a, b) => b[1] - a[1])[0]
  const surf: Record<string, number> = {}
  races.forEach(r => { const s = r.surface || 'road'; surf[s] = (surf[s] || 0) + 1 })
  const surfRows = Object.entries(surf).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const surfMax = Math.max(1, ...surfRows.map(s => s[1]))
  return (
    <Shell framed={framed}>
      <div style={sectionLabel}>RACE DNA</div>
      <div style={{ ...sectionLabel, fontSize: 10, marginTop: 12, color: 'var(--muted)' }}>TEMPERATURE FIT</div>
      <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
        {buckets.map(([lbl, n, c]) => (
          <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 9, color: 'var(--muted)', width: 38 }}>{lbl}{lbl === best[0] && best[1] > 0 ? ' ★' : ''}</span>
            <div style={{ flex: 1, height: 10, borderRadius: 5, background: 'var(--surface3)', overflow: 'hidden' }}>
              <div style={{ width: `${(n / maxB) * 100}%`, height: '100%', background: c, borderRadius: 5 }} />
            </div>
            <span style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 9, color: 'var(--white)', width: 14, textAlign: 'right' }}>{n}</span>
          </div>
        ))}
      </div>
      <div style={{ ...sectionLabel, fontSize: 10, marginTop: 14, color: 'var(--muted)' }}>SURFACE SPLIT</div>
      <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
        {surfRows.map(([s, n], i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 9, color: 'var(--muted)', width: 48, textTransform: 'uppercase' }}>{s}</span>
            <div style={{ flex: 1, height: 10, borderRadius: 5, background: 'var(--surface3)', overflow: 'hidden' }}>
              <div style={{ width: `${(n / surfMax) * 100}%`, height: '100%', background: i === 0 ? 'var(--orange)' : 'rgba(var(--orange-ch),0.4)', borderRadius: 5 }} />
            </div>
            <span style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 9, color: 'var(--white)', width: 14, textAlign: 'right' }}>{n}</span>
          </div>
        ))}
      </div>
    </Shell>
  )
}

function stageNode(scr: ShotScreen, persona: DemoPersonaId) {
  if (scr === 'predictor') return <PredictorMockup persona={persona} framed />
  if (scr === 'planner') return <PlannerMockup persona={persona} framed />
  if (scr === 'pacing') return <PacingMockup persona={persona} framed />
  if (scr === 'momentum') return <MomentumMockup persona={persona} framed />
  return <DNAMockup persona={persona} framed />
}

function PhoneStage({ screen, stageRef, persona }: { screen: number; stageRef: React.RefObject<HTMLDivElement | null>; persona: DemoPersonaId }) {
  const s = STAGE_SCREENS[screen]
  return (
    <section className="pl-stage" ref={stageRef}>
      <div className="pl-stage-pin">
        <div className="pl-stage-inner">
          <div className="pl-stage-copy">
            <p className="pl-eyebrow">The whole app</p>
            <h2 className="pl-stage-title">{s.title}</h2>
            <p className="pl-stage-line">{s.line}</p>
            <div className="pl-stage-dots" aria-hidden="true">
              {STAGE_SCREENS.map((st, i) => <span key={st.key} className={i === screen ? 'on' : ''} />)}
            </div>
          </div>
          <div style={{ width: '100%' }}>
            <AnimatePresence mode="wait">
              <motion.div key={s.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                {stageNode(s.screen, persona)}
              </motion.div>
            </AnimatePresence>
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
        textTransform: 'uppercase', color: 'var(--orange)' }}>Log a race</div>
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
  { n: '01', title: 'Sign up', line: 'Create your athlete profile in under a minute. No AI key, no setup. Just you.', mock: <StepMiniSignup /> },
  { n: '02', title: 'Log your races', line: 'Add a finish line in seconds. Search the catalog or enter it by hand. Times, splits, medals, photos.', mock: <StepMiniLog /> },
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
            <span className="pl-quote-mark">“</span>{t.quote}<span className="pl-quote-mark pl-quote-mark-close">”</span>
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
  { q: 'Is my data private, and can I export it?', a: 'Your data is yours. Your profile is private by default. You choose what (if anything) to make public, and you can export everything any time.' },
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
      <motion.p className="pl-eyebrow" variants={fadeUp} style={{ textAlign: 'center' }}>FAQ</motion.p>
      <motion.h2 className="pl-faq-title" variants={fadeUp} style={{ textAlign: 'center' }}>Questions, answered</motion.h2>
      <motion.div className="pl-faq-list" variants={fadeUp}>
        {FAQS.map(f => <FAQItem key={f.q} q={f.q} a={f.a} />)}
      </motion.div>
    </motion.section>
  )
}

/* =====================================================================
   TRY-IT CTA — sends visitors straight into the real app to start logging.
   ===================================================================== */
function TryItCTA({ onSignUp }: { onSignUp: () => void }) {
  return (
    <motion.section className="pl-sandbox" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
      <motion.p className="pl-eyebrow" variants={fadeUp}>Try it yourself</motion.p>
      <motion.h2 className="pl-sandbox-title" variants={fadeUp}>Start logging in under a minute</motion.h2>
      <motion.p className="pl-sandbox-sub" variants={fadeUp}>
        Free to start, no AI key, nothing to install. Create your athlete profile and log your first finish line right now.
      </motion.p>
      <motion.div variants={fadeUp}>
        <button className="btn-main" onClick={onSignUp} style={{ fontSize: 16, padding: '1rem 2.2rem', letterSpacing: '0.08em' }}>Get Started, It's Free</button>
      </motion.div>
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
            From start line to medal wall. Your whole racing life in one place.
          </motion.p>
          <motion.div className="pl-hero-actions" variants={fadeUp}>
            <button className="btn-main" onClick={handleSignUp}>Get Started, It's Free</button>
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
        desc={'Your whole racing life on one interactive map. Times, splits, placing, terrain, and the weather you ran through, kept for good.'}
        bullets={['Real world map of every race city', 'Splits, placing & conditions per race', 'Year-by-year history and filters']}
        mockup={<MapMockup persona={persona} />}
      />
      <FeatureShowcase
        id="auto-prs" reverse
        eyebrow="Auto PRs" title="Personal bests, computed for you"
        desc={'The moment you log a race, BREAKTAPES recomputes your bests across every distance. No spreadsheets, no manual tracking.'}
        bullets={['PRs across 5K → ultra & triathlon', 'Instant recalculation on every log', 'Age-grade & momentum scoring']}
        mockup={<PBMockup persona={persona} />}
      />
      <FeatureShowcase
        id="medal-wall"
        eyebrow="Medal Wall" title="Show off the hardware"
        desc={"Every medal you've earned in one place: gold, silver, bronze, finisher and your own custom medals, tier by tier."}
        bullets={['Gold, silver, bronze, finisher & custom tiers', 'PB-flagged podium results', 'Every medal, kept for good']}
        mockup={<MedalMockup persona={persona} />}
      />
      <FeatureShowcase
        id="wearables" reverse
        eyebrow="Training & Wearables" title="Your training, side by side"
        desc={'Connect WHOOP today and see the training that built every result, right next to the race. More integrations are on the way.'}
        bullets={['WHOOP live now, recovery & workouts', 'Strava, Garmin, Apple Health coming soon', 'Training load vs race performance']}
        mockup={<WearablesMockup />}
      />

      {/* ---------------- PHONE-SCROLL CENTERPIECE ---------------- */}
      <PhoneStage screen={screen} stageRef={stageRef} persona={persona} />

      {/* ---------------- HOW IT WORKS ---------------- */}
      <HowItWorks />

      {/* ---------------- LIVE SANDBOX ---------------- */}
      <TryItCTA onSignUp={handleSignUp} />

      {/* ---------------- STATS BAND ---------------- */}
      <motion.section className="pl-stats" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
        <motion.h2 className="pl-stats-title" variants={fadeUp}>Built for people who actually race</motion.h2>
        <div className="pl-stats-grid">
          {[
            { to: 3000, suffix: '+', label: 'Races in the global race catalog' },
            { to: 40, suffix: '+', label: 'Widgets' },
            { to: 100, suffix: '%', label: 'Yours, export anytime' },
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
          <button className="btn-main" onClick={handleSignUp}>Get Started, It's Free</button>
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

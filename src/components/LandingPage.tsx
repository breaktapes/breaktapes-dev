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

type Audience = 'all' | 'marathoner' | 'triathlete' | 'everyday'

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
   AUDIENCE SELECTOR — "I am a…" (re-themes the page; deep per-audience
   content swap lands in Phase B).
   ===================================================================== */
const AUDIENCES: { id: Audience; label: string }[] = [
  { id: 'all', label: 'Show me everything' },
  { id: 'marathoner', label: 'Marathoner' },
  { id: 'triathlete', label: 'Triathlete' },
  { id: 'everyday', label: 'Everyday runner' },
]

/* ---------- per-audience content (mockups + copy react to the selector) ---------- */
interface HeroData { tag: string; race: string; goal: string; races: string; pr: [string, string] }
const HERO_DATA: Record<Audience, HeroData> = {
  all:        { tag: 'Next Race · 12 days', race: 'Berlin Marathon', goal: 'Goal 3:15 · 12-week taper on track', races: '42', pr: ['3:21', 'MARATHON PR'] },
  marathoner: { tag: 'Next Race · 12 days', race: 'Berlin Marathon', goal: 'Goal 3:15 · 12-week taper on track', races: '42', pr: ['3:21', 'MARATHON PR'] },
  triathlete: { tag: 'Next Race · 26 days', race: 'IRONMAN Nice',    goal: 'Goal 10:30 · bike block peaking',     races: '38', pr: ['10:42', 'IRONMAN PR'] },
  everyday:   { tag: 'Next Race · 9 days',  race: 'City Autumn 10K', goal: 'Goal sub-55 · first sub-55 attempt',  races: '12', pr: ['52:18', '10K PR'] },
}

// PR rows: [label, big, small]
const PR_DATA: Record<Audience, [string, string, string][]> = {
  all:        [['5K', '18', ':42'], ['HALF', '1:24', ':10'], ['MARATHON', '3:21', ':05']],
  marathoner: [['5K', '18', ':42'], ['HALF', '1:24', ':10'], ['MARATHON', '3:21', ':05']],
  triathlete: [['OLYMPIC', '2:14', ':30'], ['70.3', '4:58', ':12'], ['IRONMAN', '10:42', ':05']],
  everyday:   [['5K', '26', ':30'], ['10K', '52', ':18'], ['HALF', '2:05', ':40']],
}

// Real city coordinates (lng, lat) so they project accurately onto the world map.
interface RaceCity { name: string; lng: number; lat: number }
const RACE_CITIES: Record<Audience, RaceCity[]> = {
  all: [
    { name: 'London', lng: -0.13, lat: 51.51 }, { name: 'Berlin', lng: 13.40, lat: 52.52 },
    { name: 'Boston', lng: -71.06, lat: 42.36 }, { name: 'Tokyo', lng: 139.65, lat: 35.68 },
    { name: 'Sydney', lng: 151.21, lat: -33.87 },
  ],
  marathoner: [ // World Marathon Majors
    { name: 'Boston', lng: -71.06, lat: 42.36 }, { name: 'Chicago', lng: -87.63, lat: 41.88 },
    { name: 'London', lng: -0.13, lat: 51.51 }, { name: 'Berlin', lng: 13.40, lat: 52.52 },
    { name: 'Tokyo', lng: 139.65, lat: 35.68 },
  ],
  triathlete: [ // iconic triathlon venues
    { name: 'Kona', lng: -155.99, lat: 19.64 }, { name: 'Nice', lng: 7.27, lat: 43.70 },
    { name: 'Roth', lng: 11.09, lat: 49.14 }, { name: 'Cairns', lng: 145.77, lat: -16.92 },
    { name: 'Taupō', lng: 176.07, lat: -38.69 },
  ],
  everyday: [
    { name: 'London', lng: -0.13, lat: 51.51 }, { name: 'Paris', lng: 2.35, lat: 48.86 },
    { name: 'Amsterdam', lng: 4.90, lat: 52.37 }, { name: 'Berlin', lng: 13.40, lat: 52.52 },
    { name: 'New York', lng: -74.01, lat: 40.71 },
  ],
}

// Per-showcase description override by audience (falls back to the base desc).
const SHOWCASE_DESC: Record<string, Partial<Record<Audience, string>>> = {
  'race-history': {
    marathoner: 'Every marathon and major on one map — splits, placing, and the weather you ran through, kept for good.',
    triathlete: 'Every swim-bike-run venue you’ve raced, mapped and timed — from local olympics to the iconic courses.',
    everyday: 'Every finish line you’ve crossed on one map — from your first 5K to your latest weekend race.',
  },
  'auto-prs': {
    marathoner: 'Log a marathon and your bests recompute across 5K, 10K, half and the full — instantly, no spreadsheet.',
    triathlete: 'Bests across olympic, 70.3 and full — overall and by leg, recalculated the moment you log a race.',
    everyday: 'Every distance counts. Log a parkrun or a 10K and your personal bests update on the spot.',
  },
  'medal-wall': {
    triathlete: 'Every finisher medal and podium from sprint to IRONMAN — laid out the way they deserve.',
    everyday: 'Every medal you’ve earned, photo-first. Your first finisher medal belongs on the wall too.',
  },
  'wearables': {
    triathlete: 'Connect WHOOP today and see swim-bike-run load next to every race result. More integrations on the way.',
    everyday: 'Connect WHOOP and see the training behind every finish. Strava, Garmin & Apple Health are coming.',
  },
}
const descFor = (id: string, a: Audience, base: string) => SHOWCASE_DESC[id]?.[a] ?? base
function AudienceSelector({ value, onChange }: { value: Audience; onChange: (a: Audience) => void }) {
  return (
    <motion.section className="pl-audience" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
      <motion.p className="pl-eyebrow" variants={fadeUp}>Make it yours</motion.p>
      <motion.h2 className="pl-audience-title" variants={fadeUp}>I am a…</motion.h2>
      <motion.div className="pl-audience-pills" variants={fadeUp} role="tablist" aria-label="Athlete type">
        {AUDIENCES.map(a => (
          <button key={a.id} role="tab" aria-selected={value === a.id}
            className={`pl-audience-pill${value === a.id ? ' active' : ''}`}
            onClick={() => { onChange(a.id); track('landing_audience_switch', { audience: a.id }) }}>
            {a.label}
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

function DashboardMockup({ audience = 'all' }: { audience?: Audience }) {
  const d = HERO_DATA[audience]
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

function RaceMapMockup({ audience = 'all' }: { audience?: Audience }) {
  // Sort west→east so the connecting arcs hop between neighbours, not across the map.
  const cities = [...RACE_CITIES[audience]].sort((a, b) => a.lng - b.lng)
  const pts = cities.map(c => ({ name: c.name, p: projectLngLat(c.lng, c.lat) }))
  const arcs: string[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i].p
    const [x2, y2] = pts[i + 1].p
    const dist = Math.hypot(x2 - x1, y2 - y1)
    const cx = (x1 + x2) / 2
    const cy = (y1 + y2) / 2 - dist * 0.22 // lift the control point for a great-circle feel
    arcs.push(`M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`)
  }
  return (
    <div style={{
      width: '100%', maxWidth: 460, aspectRatio: '1000 / 360', padding: 'var(--sp-3)',
      background: 'radial-gradient(ellipse at 50% 45%, var(--surface3), var(--surface))',
      border: '1px solid var(--border2)', borderRadius: 'var(--radius-lg)',
      boxShadow: '0 24px 60px rgba(0,0,0,0.5)', overflow: 'hidden',
    }}>
      {/* viewBox windows the equirectangular 1000×500 space to the inhabited band. */}
      <svg viewBox="0 40 1000 380" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <path d={WORLD_MAP_PATH} fill="rgba(232,224,213,0.10)"
          stroke="rgba(232,224,213,0.28)" strokeWidth="0.9" strokeLinejoin="round" />
        {arcs.map((d, i) => (
          <motion.path key={i} d={d} fill="none" stroke="var(--orange)" strokeWidth="3" strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }} whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true }} transition={{ duration: 1, delay: 0.3 + i * 0.22, ease: 'easeInOut' }} />
        ))}
        {pts.map((c, i) => {
          const [x, y] = c.p
          return (
            <motion.g key={c.name} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
              viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.15 + i * 0.16 }}>
              <circle cx={x} cy={y} r="16" fill="none" stroke="rgba(var(--orange-ch),0.4)" strokeWidth="2">
                <animate attributeName="r" values="9;18;9" dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0;0.7" dur="2.4s" repeatCount="indefinite" />
              </circle>
              <circle cx={x} cy={y} r="8" fill="var(--orange)" stroke="#000" strokeWidth="1.5" />
              <text x={x + 20} y={y + 6} fill="var(--white)" fontSize="20"
                fontFamily="var(--headline)" fontWeight="800" stroke="#000" strokeWidth="0.5"
                paintOrder="stroke">{c.name}</text>
            </motion.g>
          )
        })}
      </svg>
    </div>
  )
}

function PRMockup({ audience = 'all' }: { audience?: Audience }) {
  const prs = PR_DATA[audience]
  return (
    <div style={{ width: '100%', maxWidth: 360, display: 'grid', gap: 'var(--sp-3)' }}>
      {prs.map(([dist, big, small], i) => (
        <motion.div key={dist} style={{
          ...cardSurface, padding: 'var(--sp-4)', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', borderLeft: '3px solid var(--orange)',
          background: 'linear-gradient(90deg, rgba(var(--orange-ch),0.08), var(--surface2))',
        }}
          initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.12 }}>
          <div>
            <div style={{ fontFamily: 'var(--body)', fontSize: 10, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: 'var(--muted)' }}>{dist} · Personal Best</div>
            <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 30, color: 'var(--white)' }}>
              {big}<span style={{ color: 'var(--muted)', fontSize: 20 }}>{small}</span>
            </div>
          </div>
          <span style={{ fontFamily: 'var(--headline)', fontSize: 11, fontWeight: 800,
            letterSpacing: '0.1em', color: 'var(--green)', padding: '4px 8px',
            background: 'var(--green-dim)', borderRadius: 'var(--radius-pill)' }}>PR ▲</span>
        </motion.div>
      ))}
    </div>
  )
}

function MedalWallMockup() {
  const tiers = [
    ['#FFD770', '#B8860B'], ['#C8D4DC', '#6A7880'], ['#CD8C5A', '#7A4420'],
    ['#FFD770', '#B8860B'], ['#CD8C5A', '#7A4420'], ['#C8D4DC', '#6A7880'],
    ['#CD8C5A', '#7A4420'], ['#FFD770', '#B8860B'],
  ]
  return (
    <motion.div style={{
      width: '100%', maxWidth: 360, padding: 'var(--sp-4)', ...cardSurface,
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-3)',
      boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
    }} variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
      {tiers.map(([a, b], i) => (
        <motion.div key={i} variants={{ hidden: { opacity: 0, scale: 0.4 }, show: { opacity: 1, scale: 1 } }}
          whileHover={{ scale: 1.12, rotate: -4 }}
          style={{ aspectRatio: '1', borderRadius: '50%',
            background: `radial-gradient(circle at 35% 30%, ${a}, ${b})`,
            boxShadow: `0 0 14px ${a}55, inset 0 -3px 6px rgba(0,0,0,0.35)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 13, color: 'rgba(0,0,0,0.45)' }}>
          ★
        </motion.div>
      ))}
    </motion.div>
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

/* Analytics screen for the phone-scroll stage — compact bars + sparkline. */
function AnalyticsMockup() {
  const bars = [42, 64, 51, 78, 88, 70, 95]
  return (
    <div style={{ width: '100%', maxWidth: 300, padding: 'var(--sp-4)', ...cardSurface, display: 'grid', gap: 'var(--sp-3)' }}>
      <div>
        <div style={{ fontFamily: 'var(--body)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Form trend</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 70 }}>
          {bars.map((b, i) => (
            <div key={i} style={{ flex: 1, height: `${b}%`, borderRadius: '3px 3px 0 0',
              background: i === bars.length - 1 ? 'var(--green)' : 'rgba(var(--orange-ch),0.55)' }} />
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)' }}>
        {[['72.4', 'AGE GRADE %'], ['HOT', 'MOMENTUM']].map(([v, l]) => (
          <div key={l} style={{ ...cardSurface, padding: 'var(--sp-3)', background: 'var(--surface3)' }}>
            <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 22, color: l === 'MOMENTUM' ? 'var(--green)' : 'var(--white)' }}>{v}</div>
            <div style={{ fontFamily: 'var(--body)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ ...cardSurface, padding: 'var(--sp-3)', background: 'var(--surface3)' }}>
        <div style={{ fontFamily: 'var(--body)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Pacing IQ · Negative splitter</div>
        <svg viewBox="0 0 240 32" width="100%" height="26" preserveAspectRatio="none">
          <path d="M0 24 L48 22 L96 18 L144 14 L192 10 L240 6" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}

/* =====================================================================
   PHONE-SCROLL STAGE — a pinned device cycles through screens on scroll.
   ===================================================================== */
const STAGE_SCREENS = [
  { key: 'home', title: 'Your dashboard', line: 'Race-day briefing, next-race countdown, and live form — the moment you open the app.', render: () => <DashboardMockup /> },
  { key: 'medals', title: 'Your medal wall', line: 'Every medal you’ve earned, photo-first and tier by tier. Tap any one for the story.', render: () => <MedalWallMockup /> },
  { key: 'map', title: 'Your race map', line: 'Every finish line you’ve crossed, mapped across the world and connected in order.', render: () => <RaceMapMockup /> },
  { key: 'analytics', title: 'Your analytics', line: 'Pacing IQ, age-grade and momentum — the numbers behind every result, computed for you.', render: () => <AnalyticsMockup /> },
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
                <motion.div key={s.key} className="pl-phone-slide"
                  animate={{ opacity: i === screen ? 1 : 0, scale: i === screen ? 1 : 0.96 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  style={{ pointerEvents: i === screen ? 'auto' : 'none' }}>
                  {s.render()}
                </motion.div>
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
  mockup: React.ReactNode; reverse?: boolean; audiences: Audience[]; active: Audience
  depth?: number
}
function FeatureShowcase({ eyebrow, title, desc, bullets, mockup, reverse, audiences, active, depth = 40 }: ShowcaseProps) {
  const highlighted = active !== 'all' && audiences.includes(active)
  return (
    <motion.section className={`pl-showcase${reverse ? ' pl-reverse' : ''}${highlighted ? ' pl-highlight' : ''}`}
      variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-12% 0px' }}>
      <motion.div className="pl-showcase-copy" variants={fadeUp}>
        <p className="pl-eyebrow">{eyebrow}{highlighted && <span className="pl-eyebrow-tag"> · for you</span>}</p>
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
   PAGE
   ===================================================================== */
export default function LandingPage({ onSignUp, onSignIn }: LandingPageProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const [loaded, setLoaded] = useState(false)
  const [navVisible, setNavVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const [audience, setAudience] = useState<Audience>('all')
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
            <DashboardMockup audience={audience} />
          </motion.div>
        </div>
        <motion.div className="pl-scroll-hint" initial={{ opacity: 0 }} animate={loaded ? { opacity: 1 } : {}}
          transition={{ delay: 1.2 }} aria-hidden="true">
          <span>Scroll</span>
          <motion.span animate={reduce ? {} : { y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.6 }}>↓</motion.span>
        </motion.div>
      </section>

      {/* ---------------- AUDIENCE SELECTOR ---------------- */}
      <AudienceSelector value={audience} onChange={setAudience} />

      {/* ---------------- FEATURE SHOWCASES ---------------- */}
      <FeatureShowcase
        id="race-history" active={audience} audiences={['marathoner', 'everyday']}
        eyebrow="Race History" title="Every finish line, mapped"
        desc={descFor('race-history', audience, 'Your whole racing life on one interactive map. Times, splits, placing, terrain, and the weather you ran through — kept for good.')}
        bullets={['Real world map of every race city', 'Splits, placing & conditions per race', 'Year-by-year history and filters']}
        mockup={<RaceMapMockup audience={audience} />}
      />
      <FeatureShowcase
        id="auto-prs" reverse active={audience} audiences={['marathoner']}
        eyebrow="Auto PRs" title="Personal bests, computed for you"
        desc={descFor('auto-prs', audience, 'The moment you log a race, BREAKTAPES recomputes your bests across every distance. No spreadsheets, no manual tracking.')}
        bullets={['PRs across 5K → ultra & triathlon', 'Instant recalculation on every log', 'Age-grade & momentum scoring']}
        mockup={<PRMockup audience={audience} />}
      />
      <FeatureShowcase
        id="medal-wall" active={audience} audiences={['everyday']}
        eyebrow="Medal Wall" title="Show off the hardware"
        desc={descFor('medal-wall', audience, "A photo-first wall of every medal you've earned. Gold, silver, bronze, finisher — laid out the way they deserve.")}
        bullets={['Photo-first medal display', 'Tier badges & PR shimmer', 'Community medal photo library']}
        mockup={<MedalWallMockup />}
      />
      <FeatureShowcase
        id="wearables" reverse active={audience} audiences={['triathlete']}
        eyebrow="Training & Wearables" title="Your training, side by side"
        desc={descFor('wearables', audience, 'Connect WHOOP today and see the training that built every result, right next to the race. More integrations are on the way.')}
        bullets={['WHOOP live now — recovery & workouts', 'Strava, Garmin, Apple Health coming soon', 'Training load vs race performance']}
        mockup={<WearablesMockup />}
      />

      {/* ---------------- PHONE-SCROLL CENTERPIECE ---------------- */}
      <PhoneStage screen={screen} stageRef={stageRef} />

      {/* ---------------- STATS BAND ---------------- */}
      <motion.section className="pl-stats" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
        <motion.h2 className="pl-stats-title" variants={fadeUp}>Built for people who actually race</motion.h2>
        <div className="pl-stats-grid">
          {[
            { to: 1068, suffix: '+', label: 'Races in the catalog' },
            { to: 9, suffix: '', label: 'Distance PRs tracked' },
            { to: 24, suffix: '', label: 'Analytics widgets' },
            { to: 100, suffix: '%', label: 'Yours — export anytime' },
          ].map(s => (
            <motion.div key={s.label} className="pl-stat" variants={fadeUp}>
              <div className="pl-stat-num"><Counter to={s.to} suffix={s.suffix} /></div>
              <div className="pl-stat-label">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </motion.section>

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

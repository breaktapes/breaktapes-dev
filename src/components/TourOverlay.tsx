import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { posthog } from '@/lib/posthog'
import { useTourStore } from '@/stores/useTourStore'
import { TOUR_STEPS } from '@/lib/tourSteps'

const SPOT_PAD = 6           // px breathing room around the target
const CARD_W = 320           // card max width
const CARD_GAP = 14          // gap between spotlight and card
const TARGET_POLL_MS = 100   // target lookup retry interval
const TARGET_POLL_MAX = 25   // ~2.5s before giving up and skipping the step

interface SpotRect { top: number; left: number; width: number; height: number }

function measure(el: Element): SpotRect {
  const r = el.getBoundingClientRect()
  return {
    top: r.top - SPOT_PAD,
    left: r.left - SPOT_PAD,
    width: r.width + SPOT_PAD * 2,
    height: r.height + SPOT_PAD * 2,
  }
}

export function TourOverlay() {
  const active = useTourStore(s => s.active)
  const step = useTourStore(s => s.step)
  const nextStep = useTourStore(s => s.nextStep)
  const prevStep = useTourStore(s => s.prevStep)
  const skipTour = useTourStore(s => s.skipTour)
  const skipMissingStep = useTourStore(s => s.skipMissingStep)

  // null = centered card (no target); undefined = still resolving
  const [rect, setRect] = useState<SpotRect | null | undefined>(undefined)
  const targetRef = useRef<Element | null>(null)

  const stepDef = TOUR_STEPS[step]

  // Resolve the target element for the current step; poll briefly (route
  // transitions / lazy renders), then skip the step if it never appears.
  useEffect(() => {
    if (!active || !stepDef) return
    posthog.capture('tour_step_viewed', { step, step_id: stepDef.id })

    if (!stepDef.target) {
      targetRef.current = null
      setRect(null)
      return
    }

    setRect(undefined)
    let tries = 0
    let cancelled = false
    let raf = 0

    const find = () => {
      if (cancelled) return
      const el = document.querySelector(stepDef.target!)
      if (el) {
        targetRef.current = el
        el.scrollIntoView({ block: 'center', behavior: 'auto' })
        // measure after scroll settles
        raf = requestAnimationFrame(() => { if (!cancelled) setRect(measure(el)) })
        return
      }
      tries += 1
      if (tries >= TARGET_POLL_MAX) {
        skipMissingStep()
        return
      }
      window.setTimeout(find, TARGET_POLL_MS)
    }
    find()

    return () => { cancelled = true; cancelAnimationFrame(raf) }
  }, [active, step]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the spotlight glued to the target on resize/scroll/rotation.
  useEffect(() => {
    if (!active) return
    let raf = 0
    const remeasure = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (targetRef.current) setRect(measure(targetRef.current))
      })
    }
    window.addEventListener('resize', remeasure)
    window.addEventListener('orientationchange', remeasure)
    window.addEventListener('scroll', remeasure, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', remeasure)
      window.removeEventListener('orientationchange', remeasure)
      window.removeEventListener('scroll', remeasure, true)
    }
  }, [active])

  // Escape skips the tour.
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') skipTour() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, skipTour])

  if (!active || !stepDef) return null

  const isLast = step === TOUR_STEPS.length - 1
  const vw = window.innerWidth
  const vh = window.innerHeight
  const cardW = Math.min(CARD_W, vw - 32)

  // Card placement: centered when no target; otherwise below the spotlight
  // when there's room, above it when not. Horizontally clamped to viewport.
  let cardStyle: React.CSSProperties
  if (rect === null) {
    cardStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  } else if (rect) {
    const below = rect.top + rect.height + CARD_GAP
    const placeBelow = below + 230 < vh
    const left = Math.min(Math.max(16, rect.left + rect.width / 2 - cardW / 2), vw - cardW - 16)
    cardStyle = placeBelow
      ? { top: below, left }
      : { top: Math.max(16, rect.top - CARD_GAP), left, transform: 'translateY(-100%)' }
  } else {
    return createPortal(<div style={st.backdrop} />, document.body) // resolving target — dim only
  }

  return createPortal(
    <div style={st.root} role="dialog" aria-modal="true" aria-label={`App tour — ${stepDef.title}`}>
      {rect
        ? <div style={{ ...st.spotlight, top: rect.top, left: rect.left, width: rect.width, height: rect.height }} />
        : <div style={st.backdrop} />}

      <div style={{ ...st.card, ...cardStyle, width: cardW }}>
        <div style={st.eyebrow}>App tour · {step + 1}/{TOUR_STEPS.length}</div>
        <div style={st.title}>{stepDef.title}</div>
        <div style={st.body}>{stepDef.body}</div>

        <div style={st.dots}>
          {TOUR_STEPS.map((s, i) => (
            <span key={s.id} style={{ ...st.dot, background: i === step ? 'var(--orange)' : 'var(--muted2)' }} />
          ))}
        </div>

        <div style={st.btnRow}>
          <button style={st.skipBtn} onClick={skipTour}>Skip tour</button>
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            {step > 0 && <button style={st.backBtn} onClick={prevStep}>Back</button>}
            <button style={st.nextBtn} onClick={nextStep}>{isLast ? 'Done' : 'Next'}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

const st: Record<string, React.CSSProperties> = {
  root: {
    position: 'fixed',
    inset: 0,
    zIndex: 3000,
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 3000,
    background: 'rgba(0,0,0,0.78)',
  },
  // The box-shadow cutout: the div itself is transparent over the target,
  // the giant shadow dims everything else. GPU-cheap — no backdrop-filter.
  spotlight: {
    position: 'fixed',
    borderRadius: 'var(--radius-lg)',
    boxShadow: '0 0 0 9999px rgba(0,0,0,0.78), 0 0 24px rgba(var(--orange-ch), 0.45)',
    border: '2px solid var(--orange)',
    pointerEvents: 'none',
    transition: 'top 0.2s ease, left 0.2s ease, width 0.2s ease, height 0.2s ease',
  },
  card: {
    position: 'fixed',
    background: 'var(--surface2)',
    border: '1px solid var(--border2)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--sp-5)',
    boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--sp-3)',
  },
  eyebrow: {
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    fontSize: 'var(--text-xs)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--orange)',
  },
  title: {
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: 'var(--text-lg)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--white)',
    lineHeight: 1.1,
  },
  body: {
    fontFamily: 'var(--body)',
    fontSize: 'var(--text-sm)',
    color: 'var(--muted)',
    lineHeight: 1.5,
  },
  dots: {
    display: 'flex',
    gap: '6px',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    display: 'inline-block',
  },
  btnRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 'var(--sp-3)',
  },
  skipBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--muted)',
    fontFamily: 'var(--body)',
    fontSize: 'var(--text-xs)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    padding: '8px 0',
  },
  backBtn: {
    background: 'transparent',
    border: '1px solid var(--border2)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--white)',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    fontSize: 'var(--text-xs)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    padding: '10px 14px',
  },
  nextBtn: {
    background: 'var(--orange)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    color: 'var(--black)',
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: 'var(--text-xs)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    padding: '10px 18px',
  },
}

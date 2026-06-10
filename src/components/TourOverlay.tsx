import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTourStore } from '@/stores/useTourStore'
import { TOUR_STEPS } from '@/lib/tourSteps'

const SPOT_PAD = 6           // px breathing room around the target
const CARD_W = 320           // card max width
const CARD_EST_H = 230       // approx card height used for above/below placement
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
  const markStepViewed = useTourStore(s => s.markStepViewed)

  // null = centered card (no target); undefined = still resolving
  const [rect, setRect] = useState<SpotRect | null | undefined>(undefined)
  const targetRef = useRef<Element | null>(null)
  const nextBtnRef = useRef<HTMLButtonElement | null>(null)

  const stepDef = TOUR_STEPS[step]

  // Resolve the target element for the current step; poll briefly (route
  // transitions / lazy renders), then skip the step if it never appears.
  useEffect(() => {
    if (!active || !stepDef) return

    if (!stepDef.target) {
      targetRef.current = null
      setRect(null)
      markStepViewed(step) // store dedups Back revisits + StrictMode double-mounts
      return
    }

    targetRef.current = null // don't let scroll remeasure snap to the previous step's target
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
        // capture only once the step actually shows — auto-skipped steps stay out of the funnel
        markStepViewed(step)
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
        if (!targetRef.current) return
        if (!targetRef.current.isConnected) {
          // target unmounted mid-step (e.g. remote sync repopulated races and
          // the GET STARTED card disappeared) — move on instead of measuring
          // a detached node, which returns an all-zero rect
          targetRef.current = null
          skipMissingStep()
          return
        }
        const next = measure(targetRef.current)
        // bail on identical rects — scroll fires every frame and a fresh object
        // would re-render the overlay even when nothing moved
        setRect(prev =>
          prev && prev.top === next.top && prev.left === next.left &&
          prev.width === next.width && prev.height === next.height ? prev : next)
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

  // Move keyboard focus into the dialog on each step so Tab doesn't operate
  // the dimmed app underneath.
  useEffect(() => {
    if (!active) return
    const raf = requestAnimationFrame(() => nextBtnRef.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(raf)
  }, [active, step])

  if (!active || !stepDef) return null

  const isLast = step === TOUR_STEPS.length - 1
  const vw = window.innerWidth
  const vh = window.innerHeight
  const cardW = Math.min(CARD_W, vw - 32)

  // Card placement: below the spotlight when there's room, above when there's
  // room above, centered otherwise (incl. no-target steps and while the target
  // is still resolving — the card with its Skip/Next controls is always
  // reachable; a bare dimmed screen is never shown). Horizontally clamped.
  const CENTERED: React.CSSProperties = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  let cardStyle: React.CSSProperties = CENTERED
  if (rect) {
    const below = rect.top + rect.height + CARD_GAP
    const roomBelow = below + CARD_EST_H < vh
    const roomAbove = rect.top - CARD_GAP - CARD_EST_H >= 16
    const left = Math.min(Math.max(16, rect.left + rect.width / 2 - cardW / 2), vw - cardW - 16)
    if (roomBelow) cardStyle = { top: below, left }
    else if (roomAbove) cardStyle = { top: rect.top - CARD_GAP, left, transform: 'translateY(-100%)' }
    // else: tall target eats the viewport — keep the card centered over it
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
            <button ref={nextBtnRef} style={st.nextBtn} onClick={nextStep}>{isLast ? 'Done' : 'Next'}</button>
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
    // no transition: top/left/width/height animate on the main thread and the
    // 9999px shadow makes every frame a full-viewport repaint (Session 41 lesson)
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
    gap: 'var(--sp-2)',
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
    minHeight: 44,
    padding: 'var(--sp-2) 0',
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
    minHeight: 44,
    padding: 'var(--sp-2) var(--sp-4)',
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
    minHeight: 44,
    padding: 'var(--sp-2) var(--sp-5)',
  },
}

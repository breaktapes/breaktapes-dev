import React, { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { DashWidget } from '@/types'
import { getWidgetContent, type WidgetDynamicContext, type WidgetRelatedAction } from '@/lib/widgetContent'
import { markWidgetDetailDiscovered, type WidgetCardActions } from '@/components/WidgetCard'

interface Props {
  widget: DashWidget
  dynamicContext?: WidgetDynamicContext
  actions?: WidgetCardActions
  onClose: () => void
}

export function WidgetDetailModal({ widget, dynamicContext, actions, onClose }: Props) {
  const navigate = useNavigate()
  const content = useMemo(() => getWidgetContent(widget.id), [widget.id])
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  // Body scroll lock + focus management
  useEffect(() => {
    previousFocus.current = (document.activeElement as HTMLElement) ?? null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    markWidgetDetailDiscovered()
    // next frame to ensure mounted
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 0)
    return () => {
      document.body.style.overflow = prevOverflow
      window.clearTimeout(t)
      if (previousFocus.current) {
        try { previousFocus.current.focus() } catch {}
      }
    }
  }, [])

  // Esc to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleRelated = (a: WidgetRelatedAction) => {
    if (a.to) {
      navigate(a.to)
      onClose()
      return
    }
    if (a.action && actions) {
      const fn = (actions as Record<string, (() => void) | undefined>)[a.action]
      if (typeof fn === 'function') {
        onClose()
        // defer so modal unmount completes before opening next modal
        window.setTimeout(() => fn(), 0)
        return
      }
    }
    onClose()
  }

  return createPortal(
    <div style={st.overlay} onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="widget-detail-title"
        style={st.sheet}
        onClick={e => e.stopPropagation()}
      >
        <div style={st.handle} />

        <div style={st.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <span style={st.icon} aria-hidden="true">{widget.icon}</span>
            <div style={{ minWidth: 0 }}>
              <div style={st.kicker}>WIDGET</div>
              <h2 id="widget-detail-title" style={st.title}>{content.title}</h2>
            </div>
            {widget.pro && (
              <span style={st.proPill}>PRO</span>
            )}
          </div>
          <button
            ref={closeBtnRef}
            style={st.closeBtn}
            onClick={onClose}
            aria-label="Close widget detail"
          >✕</button>
        </div>

        {content.tagline && <p style={st.tagline}>{content.tagline}</p>}

        <div style={st.scrollBody} onTouchMove={e => e.stopPropagation()}>
          <div style={st.body}>
            {dynamicContext?.primaryMetric && (
              <div style={st.metricBlock}>
                <div style={st.metricLabel}>{dynamicContext.primaryMetric.label}</div>
                <div style={{ ...st.metricValue, color: dynamicContext.primaryMetric.color ?? 'var(--orange)' }}>
                  {dynamicContext.primaryMetric.value}
                </div>
                {dynamicContext.comparisons && dynamicContext.comparisons.length > 0 && (
                  <div style={st.comparisons}>
                    {dynamicContext.comparisons.map((c, i) => (
                      <div key={i} style={st.comparisonRow}>
                        <span style={st.comparisonLabel}>{c.label}</span>
                        <span style={st.comparisonValue}>{c.value}</span>
                      </div>
                    ))}
                  </div>
                )}
                {dynamicContext.note && <div style={st.comparisonNote}>{dynamicContext.note}</div>}
              </div>
            )}

            <Section label="What it is">{content.whatItIs}</Section>
            <Section label="How to read it">{content.howToRead}</Section>
            <Section label="How it impacts performance">{content.howItImpactsPerformance}</Section>

            {content.relatedActions && content.relatedActions.length > 0 && (
              <div style={st.actionsBlock}>
                <div style={st.actionsLabel}>Related</div>
                <div style={st.actionsGrid}>
                  {content.relatedActions.map((a, i) => (
                    <button
                      key={i}
                      style={st.actionBtn}
                      onClick={() => handleRelated(a)}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={st.section}>
      <div style={st.sectionLabel}>{label}</div>
      <p style={st.sectionBody}>{children}</p>
    </div>
  )
}

const st = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'flex-end',
  } as React.CSSProperties,

  sheet: {
    width: '100%',
    maxHeight: '92vh',
    background: 'var(--surface2)',
    borderTop: '2px solid var(--orange)',
    borderRadius: '16px 16px 0 0',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  } as React.CSSProperties,

  handle: {
    width: '36px',
    height: '4px',
    background: 'var(--border2)',
    borderRadius: '2px',
    margin: '12px auto 0',
    flexShrink: 0,
  } as React.CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '14px 16px 6px',
    gap: '12px',
    flexShrink: 0,
  } as React.CSSProperties,

  icon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '38px',
    height: '38px',
    background: 'rgba(var(--orange-ch), 0.1)',
    border: '1px solid rgba(var(--orange-ch), 0.25)',
    borderRadius: '10px',
    fontSize: '20px',
    flexShrink: 0,
  } as React.CSSProperties,

  kicker: {
    fontFamily: 'var(--headline)',
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.16em',
    textTransform: 'uppercase' as const,
    color: 'var(--muted)',
    marginBottom: '2px',
  } as React.CSSProperties,

  title: {
    margin: 0,
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '20px',
    letterSpacing: '0.04em',
    color: 'var(--white)',
    lineHeight: 1.1,
  } as React.CSSProperties,

  proPill: {
    fontSize: '9px',
    fontFamily: 'var(--headline)',
    fontWeight: 800,
    letterSpacing: '0.1em',
    color: 'var(--orange)',
    border: '1px solid rgba(var(--orange-ch), 0.5)',
    borderRadius: '100px',
    padding: '3px 8px',
    height: 'fit-content',
    marginTop: '4px',
  } as React.CSSProperties,

  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--muted)',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px 8px',
    lineHeight: 1,
    flexShrink: 0,
  } as React.CSSProperties,

  tagline: {
    margin: '0 16px 8px',
    fontSize: '13px',
    color: 'var(--muted)',
    fontStyle: 'italic',
    lineHeight: 1.5,
  } as React.CSSProperties,

  scrollBody: {
    overflowY: 'auto',
    flex: 1,
    WebkitOverflowScrolling: 'touch' as any,
    overscrollBehavior: 'contain',
  } as React.CSSProperties,

  body: {
    padding: '8px 16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '18px',
    paddingBottom: 'calc(var(--safe-bottom) + 32px)',
  } as React.CSSProperties,

  metricBlock: {
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: '12px',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  } as React.CSSProperties,

  metricLabel: {
    fontFamily: 'var(--headline)',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: 'var(--muted)',
  } as React.CSSProperties,

  metricValue: {
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '28px',
    letterSpacing: '0.02em',
    color: 'var(--orange)',
    lineHeight: 1.05,
  } as React.CSSProperties,

  comparisons: {
    marginTop: '6px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  } as React.CSSProperties,

  comparisonRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: 'var(--white)',
  } as React.CSSProperties,

  comparisonLabel: {
    color: 'var(--muted)',
  } as React.CSSProperties,

  comparisonValue: {
    fontFamily: 'var(--mono, var(--body))',
    fontWeight: 600,
  } as React.CSSProperties,

  comparisonNote: {
    marginTop: '4px',
    fontSize: '12px',
    color: 'var(--muted2)',
    lineHeight: 1.5,
  } as React.CSSProperties,

  section: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  } as React.CSSProperties,

  sectionLabel: {
    fontFamily: 'var(--headline)',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    color: 'var(--orange)',
  } as React.CSSProperties,

  sectionBody: {
    margin: 0,
    fontSize: '14px',
    color: 'var(--white)',
    lineHeight: 1.6,
  } as React.CSSProperties,

  actionsBlock: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    marginTop: '4px',
  } as React.CSSProperties,

  actionsLabel: {
    fontFamily: 'var(--headline)',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    color: 'var(--muted)',
  } as React.CSSProperties,

  actionsGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  } as React.CSSProperties,

  actionBtn: {
    background: 'transparent',
    color: 'var(--orange)',
    border: '1px solid var(--orange)',
    borderRadius: '8px',
    padding: '12px',
    fontFamily: 'var(--headline)',
    fontWeight: 800,
    fontSize: '12px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    textAlign: 'left' as const,
  } as React.CSSProperties,
}

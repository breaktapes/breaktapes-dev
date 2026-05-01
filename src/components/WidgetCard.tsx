import React, { Component, createContext, useContext, useCallback, useEffect, useRef, useState } from 'react'
import type { WidgetDynamicContext } from '@/lib/widgetContent'

class WidgetBoundary extends Component<
  { id: string; children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[Widget:${this.props.id}]`, error, info.componentStack)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Widget error</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.4, wordBreak: 'break-word' }}>{this.state.error.message}</div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ alignSelf: 'flex-start', background: 'none', border: '1px solid var(--border2)', color: 'var(--muted)', borderRadius: '6px', padding: '5px 12px', fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em', cursor: 'pointer' }}
          >
            RETRY
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export interface WidgetCardActions {
  openAddRace?: () => void
  openAddUpcomingRace?: () => void
  openCustomize?: () => void
  openAllUpcoming?: () => void
  openFocusRaceEdit?: () => void
}

export interface WidgetCardContextValue {
  openDetail: (id: string, preview?: React.ReactNode, ctx?: WidgetDynamicContext) => void
  actions: WidgetCardActions
}

export const WidgetCardContext = createContext<WidgetCardContextValue | null>(null)

export function useWidgetCardContext(): WidgetCardContextValue | null {
  return useContext(WidgetCardContext)
}

const DISCOVERED_KEY = 'fl2_widget_detail_discovered'

function readDiscovered(): boolean {
  if (typeof window === 'undefined') return true
  try { return window.localStorage.getItem(DISCOVERED_KEY) === '1' } catch { return true }
}

const listeners = new Set<() => void>()

export function markWidgetDetailDiscovered() {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(DISCOVERED_KEY, '1') } catch {}
  listeners.forEach(fn => fn())
}

function useDiscovered(): boolean {
  const [discovered, setDiscovered] = useState<boolean>(() => readDiscovered())
  useEffect(() => {
    const handler = () => setDiscovered(readDiscovered())
    listeners.add(handler)
    return () => { listeners.delete(handler) }
  }, [])
  return discovered
}

interface WidgetCardProps {
  id: string
  children: React.ReactNode
  dynamicContext?: WidgetDynamicContext
  className?: string
  style?: React.CSSProperties
  hint?: boolean
  ariaLabel?: string
}

export function WidgetCard({
  id,
  children,
  dynamicContext,
  className = 'card-v3 card-orange',
  style,
  hint = true,
  ariaLabel,
}: WidgetCardProps) {
  const ctx = useWidgetCardContext()
  const cardRef = useRef<HTMLDivElement>(null)
  const discovered = useDiscovered()

  const trigger = useCallback(() => {
    if (!ctx) return
    ctx.openDetail(id, children, dynamicContext)
  }, [ctx, id, children, dynamicContext])

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    const interactive = target.closest(
      'button, a, input, select, textarea, [data-no-widget-detail], [role="button"]',
    )
    if (interactive && interactive !== cardRef.current) return
    trigger()
  }, [trigger])

  const handleKey = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== cardRef.current) return
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault()
      trigger()
    }
  }, [trigger])

  const showHint = hint && !discovered && !!ctx

  const composedStyle: React.CSSProperties = {
    position: 'relative',
    cursor: ctx ? 'pointer' : 'default',
    ...style,
  }

  return (
    <div
      ref={cardRef}
      className={className}
      style={composedStyle}
      role={ctx ? 'button' : undefined}
      tabIndex={ctx ? 0 : undefined}
      aria-label={ctx ? (ariaLabel ?? `${id.replace(/-/g, ' ')} — tap for details`) : undefined}
      onClick={ctx ? handleClick : undefined}
      onKeyDown={ctx ? handleKey : undefined}
      data-widget-id={id}
    >
      <WidgetBoundary id={id}>
        {children}
      </WidgetBoundary>
      {showHint && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '10px',
            right: '12px',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            border: '1px solid rgba(var(--orange-ch), 0.55)',
            color: 'rgba(var(--orange-ch), 0.85)',
            fontFamily: 'var(--mono, var(--body))',
            fontSize: '10px',
            fontWeight: 700,
            lineHeight: '14px',
            textAlign: 'center',
            pointerEvents: 'none',
            background: 'rgba(var(--orange-ch), 0.08)',
          }}
        >
          i
        </span>
      )}
    </div>
  )
}

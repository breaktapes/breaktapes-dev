import React, { Component, createContext, useContext, useCallback, useEffect, useRef, useState } from 'react'
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'
import type { WidgetDynamicContext } from '@/lib/widgetContent'
import type { WidgetSize } from '@/types'
import { WIDGET_SIZES } from '@/stores/useDashStore'

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
        <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-xs)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Widget error</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', lineHeight: 1.4, wordBreak: 'break-word' }}>{this.state.error.message}</div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ alignSelf: 'flex-start', background: 'none', border: '1px solid var(--border2)', color: 'var(--muted)', borderRadius: 'var(--radius-sm)', padding: '5px 12px', fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-xs)', letterSpacing: '0.08em', cursor: 'pointer' }}
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
  openAllUpcoming?: () => void
  openFocusRaceEdit?: () => void
}

export interface WidgetCardContextValue {
  openDetail: (id: string, preview?: React.ReactNode, ctx?: WidgetDynamicContext) => void
  actions: WidgetCardActions
  editMode: boolean
  getWidgetSize: (id: string) => WidgetSize
  setWidgetSize: (id: string, size: WidgetSize) => void
  setWidgetEnabled: (id: string, enabled: boolean) => void
}

export const WidgetCardContext = createContext<WidgetCardContextValue | null>(null)

export function useWidgetCardContext(): WidgetCardContextValue | null {
  return useContext(WidgetCardContext)
}

// Drag listeners provided by SortableItem — consumed by ≡ handle in WidgetCard edit bar
export const DragListenersContext = createContext<SyntheticListenerMap | undefined | null>(null)

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
  noDetailPreview?: boolean
}

export function WidgetCard({
  id,
  children,
  dynamicContext,
  className = 'card-v3 card-orange',
  style,
  hint = true,
  ariaLabel,
  noDetailPreview = false,
}: WidgetCardProps) {
  const ctx = useWidgetCardContext()
  const dl  = useContext(DragListenersContext)
  const cardRef = useRef<HTMLDivElement>(null)
  const discovered = useDiscovered()

  const inEditMode = ctx?.editMode ?? false
  const currentSize = ctx?.getWidgetSize(id) ?? 'medium'
  const supportedSizes = WIDGET_SIZES[id] ?? ['medium']

  const trigger = useCallback(() => {
    if (!ctx) return
    ctx.openDetail(id, noDetailPreview ? undefined : children, dynamicContext)
  }, [ctx, id, children, dynamicContext, noDetailPreview])

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (inEditMode) return
    const target = e.target as HTMLElement
    const interactive = target.closest(
      'button, a, input, select, textarea, [data-no-widget-detail], [role="button"]',
    )
    if (interactive && interactive !== cardRef.current) return
    trigger()
  }, [inEditMode, trigger])

  const handleKey = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (inEditMode) return
    if (e.target !== cardRef.current) return
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault()
      trigger()
    }
  }, [inEditMode, trigger])

  const showHint = hint && !discovered && !!ctx && !inEditMode

  const composedStyle: React.CSSProperties = {
    position: 'relative',
    cursor: inEditMode ? 'default' : (ctx ? 'pointer' : 'default'),
    boxShadow: inEditMode ? '0 0 0 1px var(--orange-dim)' : undefined,
    ...style,
  }

  return (
    <div
      ref={cardRef}
      className={className}
      style={composedStyle}
      role={ctx && !inEditMode ? 'button' : undefined}
      tabIndex={ctx && !inEditMode ? 0 : undefined}
      aria-label={ctx && !inEditMode ? (ariaLabel ?? `${id.replace(/-/g, ' ')} — tap for details`) : undefined}
      onClick={ctx ? handleClick : undefined}
      onKeyDown={ctx ? handleKey : undefined}
      data-widget-id={id}
      data-widget-size={currentSize}
      data-edit-mode={inEditMode ? 'true' : 'false'}
    >
      {/* Edit bar — shown in edit mode above widget content */}
      {inEditMode && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-2)',
          padding: '6px var(--sp-3)',
          background: 'var(--surface3)',
          borderBottom: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
          marginBottom: 0,
        }}>
          {/* Drag handle */}
          <span
            {...(dl ?? {})}
            style={{
              color: 'var(--muted2)',
              fontSize: 'var(--text-base)',
              cursor: dl ? 'grab' : 'default',
              padding: '0 var(--sp-1)',
              lineHeight: 1,
              userSelect: 'none',
              touchAction: 'none',
            }}
            aria-label="Drag to reorder"
          >≡</span>

          {/* Size chips — only shown when widget supports multiple sizes */}
          {supportedSizes.length > 1 && (
            <div style={{ display: 'flex', gap: 4 }}>
              {supportedSizes.map(s => {
                const active = currentSize === s
                return (
                  <button
                    key={s}
                    onClick={e => { e.stopPropagation(); ctx?.setWidgetSize(id, s) }}
                    style={{
                      fontFamily: 'var(--headline)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 700,
                      textTransform: 'uppercase' as const,
                      height: 22,
                      padding: '0 7px',
                      borderRadius: 4,
                      border: 'none',
                      cursor: 'pointer',
                      background: active ? 'var(--orange)' : 'var(--surface2)',
                      color: active ? 'var(--white)' : 'var(--muted)',
                      transition: 'background 120ms, color 120ms',
                    }}
                  >
                    {s[0].toUpperCase()}
                  </button>
                )
              })}
            </div>
          )}

          {/* Remove button */}
          <button
            onClick={e => { e.stopPropagation(); ctx?.setWidgetEnabled(id, false) }}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer',
              padding: '0 var(--sp-1)',
              lineHeight: 1,
            }}
            aria-label="Remove widget"
          >✕</button>
        </div>
      )}

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
            borderRadius: 'var(--radius-round)',
            border: '1px solid rgba(var(--orange-ch), 0.55)',
            color: 'rgba(var(--orange-ch), 0.85)',
            fontFamily: 'var(--mono, var(--body))',
            fontSize: 'var(--text-xs)',
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

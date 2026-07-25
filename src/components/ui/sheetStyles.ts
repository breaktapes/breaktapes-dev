import type React from 'react'

export const sharedSheetStyles = {
  sheet: {
    width: '100%',
    maxWidth: '680px',
    maxHeight: '85dvh',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.015) 100%), var(--surface2)',
    borderTop: '2px solid var(--orange)',
    borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
    boxShadow: '0 -16px 40px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.03)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  } as React.CSSProperties,

  handle: {
    width: '40px',
    height: '4px',
    background: 'var(--border2)',
    borderRadius: 'var(--radius-xs)',
    margin: '12px auto 0',
    flexShrink: 0,
  } as React.CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px 0',
    gap: 'var(--sp-3)',
    flexShrink: 0,
  } as React.CSSProperties,

  title: {
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: 'var(--text-xl)',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--white)',
    lineHeight: 1.04,
  } as React.CSSProperties,

  closeBtn: {
    background: 'transparent',
    border: '1px solid var(--border2)',
    color: 'var(--muted)',
    borderRadius: 'var(--radius-md)',
    width: '36px',
    height: '36px',
    cursor: 'pointer',
    lineHeight: 1,
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,

  input: {
    width: '100%',
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--white)',
    fontSize: 'var(--text-compact)',
    padding: '0.72rem 0.85rem',
    fontFamily: 'var(--body)',
    boxSizing: 'border-box' as const,
    minWidth: 0,
    minHeight: '44px',
  } as React.CSSProperties,

  secondaryBtn: {
    background: 'transparent',
    color: 'var(--muted)',
    border: '1px solid var(--border2)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--sp-3)',
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: 'var(--text-compact)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    width: '100%',
  } as React.CSSProperties,
}

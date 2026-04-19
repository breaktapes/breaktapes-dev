// Beta feedback floating pill — staging only, auth-gated.
// Matches V1 feedbackPill + feedbackModal → beta_feedback Supabase table.

import { useState } from 'react'
import { IS_STAGING } from '@/env'
import { useAuthStore } from '@/stores/useAuthStore'
import { supabase } from '@/lib/supabase'
import { useLocation } from 'react-router-dom'

export function BetaFeedback() {
  const authUser = useAuthStore(s => s.authUser)
  const location  = useLocation()
  const [open, setOpen]     = useState(false)
  const [rating, setRating] = useState(0)
  const [text, setText]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [ratingError, setRatingError] = useState(false)

  // Only render on staging for authenticated users
  if (!IS_STAGING || !authUser) return null

  function openModal() {
    setRating(0)
    setText('')
    setRatingError(false)
    setOpen(true)
  }

  async function handleSubmit() {
    if (!rating) { setRatingError(true); return }
    setSubmitting(true)
    try {
      await supabase.from('beta_feedback').insert({
        user_id: authUser.id,
        rating,
        message: text.trim() || null,
        page: location.pathname,
      })
      setOpen(false)
    } catch {
      // silent — toast would need a global toast system; just close
      setOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  const STARS = [1, 2, 3, 4, 5]

  return (
    <>
      {/* Floating pill */}
      <button
        onClick={openModal}
        style={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)',
          right: '14px',
          zIndex: 900,
          background: 'var(--surface2)',
          border: '1px solid var(--border2)',
          borderRadius: '20px',
          color: 'var(--muted)',
          fontFamily: 'var(--headline)',
          fontWeight: 700,
          fontSize: '11px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          padding: '6px 12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
        }}
      >
        <span style={{ fontSize: '12px' }}>✦</span> Beta
      </button>

      {/* Modal */}
      {open && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border2)',
            borderRadius: '16px 16px 0 0',
            padding: '1.5rem 1rem',
            width: '100%',
            maxWidth: '480px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '18px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--white)' }}>
                Beta Feedback
              </h3>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '2px' }}>✕</button>
            </div>

            {/* Star rating */}
            <div>
              <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--headline)', fontWeight: 700 }}>
                How's BREAKTAPES working for you?
              </p>
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  outline: ratingError ? '1px solid var(--orange)' : 'none',
                  borderRadius: '4px',
                  padding: '2px',
                }}
              >
                {STARS.map(n => (
                  <button
                    key={n}
                    onClick={() => { setRating(n); setRatingError(false) }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '28px',
                      padding: '2px',
                      opacity: rating >= n ? 1 : 0.3,
                      transition: 'opacity 0.1s',
                    }}
                  >
                    ⭐
                  </button>
                ))}
              </div>
              {ratingError && <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--orange)' }}>Pick a star rating</p>}
            </div>

            {/* Message */}
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--headline)', fontWeight: 700 }}>
                Message (optional)
              </label>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="What's working? What's broken? What's missing?"
                style={{
                  width: '100%',
                  background: 'var(--surface3)',
                  border: '1px solid var(--border2)',
                  borderRadius: '6px',
                  color: 'var(--white)',
                  fontSize: '14px',
                  padding: '0.6rem 0.75rem',
                  fontFamily: 'var(--body)',
                  boxSizing: 'border-box',
                  minHeight: '80px',
                  resize: 'vertical',
                }}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                background: 'var(--orange)',
                color: 'var(--black)',
                border: 'none',
                borderRadius: '4px',
                padding: '0.8rem',
                fontFamily: 'var(--headline)',
                fontWeight: 900,
                fontSize: '13px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? 'Sending…' : 'Submit Feedback'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

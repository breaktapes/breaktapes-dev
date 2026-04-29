import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

const SUBJECTS = [
  'Account compromised',
  'Privacy / data request',
  'Delete my account / data',
  'Bug report',
  'General enquiry',
]

type Status = 'idle' | 'submitting' | 'success' | 'error'

export default function Help() {
  const navigate = useNavigate()
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus]   = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject) { setErrorMsg('Please select a subject.'); return }
    setErrorMsg('')
    setStatus('submitting')

    try {
      const { error } = await supabase
        .from('contact_submissions')
        .insert({ name: name.trim(), email: email.trim(), subject, message: message.trim() })

      if (error) throw error
      setStatus('success')
    } catch (err) {
      console.error(err)
      setStatus('error')
      setErrorMsg('Something went wrong. Try again in a moment.')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--surface)',
      color: 'var(--white)',
      fontFamily: "'Barlow', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '0 1rem',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}>
        <button
          onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--white)',
            cursor: 'pointer',
            padding: '0.5rem',
            borderRadius: 8,
            fontSize: 14,
            opacity: 0.7,
          }}
        >
          ← Back
        </button>
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 700,
          fontSize: 18,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          Help & Contact
        </span>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '2rem 1.25rem 4rem' }}>
        {status === 'success' ? (
          <SuccessState onBack={() => navigate(-1)} />
        ) : (
          <>
            <div style={{ marginBottom: '2rem' }}>
              <h1 style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 900,
                fontSize: 36,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                margin: 0,
              }}>
                Get in Touch
              </h1>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
                Report an issue, request data deletion, or ask anything about BREAKTAPES.
                We respond within 2 business days.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Field label="Name">
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  style={inputStyle}
                />
              </Field>

              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  style={inputStyle}
                />
              </Field>

              <Field label="Subject">
                <select
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  required
                  style={{ ...inputStyle, color: subject ? 'var(--white)' : 'var(--muted)' }}
                >
                  <option value="" disabled>Select a topic…</option>
                  {SUBJECTS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>

              <Field label="Message">
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Describe your issue or question…"
                  required
                  rows={5}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 120 }}
                />
              </Field>

              {errorMsg && (
                <p style={{ color: '#ff6b6b', fontSize: 13, margin: 0 }}>{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={status === 'submitting'}
                style={{
                  background: 'var(--orange)',
                  color: '#000',
                  border: 'none',
                  borderRadius: 10,
                  padding: '14px 24px',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 800,
                  fontSize: 15,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
                  opacity: status === 'submitting' ? 0.6 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {status === 'submitting' ? 'Sending…' : 'Send Message'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

function SuccessState({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 0' }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        background: 'rgba(0,255,136,0.12)',
        border: '1px solid rgba(0,255,136,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 1.5rem',
        fontSize: 28,
      }}>
        ✓
      </div>
      <h2 style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 900,
        fontSize: 28,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        margin: '0 0 0.75rem',
        color: '#00FF88',
      }}>
        Message Sent
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: 15, lineHeight: 1.7, marginBottom: '2rem' }}>
        We got it. Expect a reply within 2 business days.
      </p>
      <button
        onClick={onBack}
        style={{
          background: 'var(--surface3)',
          border: '1px solid var(--border2)',
          color: 'var(--white)',
          borderRadius: 10,
          padding: '12px 24px',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        Go Back
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'var(--muted)',
        fontFamily: "'Barlow Condensed', sans-serif",
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface2)',
  border: '1px solid var(--border2)',
  borderRadius: 10,
  padding: '12px 14px',
  color: 'var(--white)',
  fontSize: 15,
  fontFamily: "'Barlow', sans-serif",
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
  appearance: 'none',
  WebkitAppearance: 'none',
}

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/useAuthStore'
import { getClerkToken } from '@/lib/supabase'
import { posthog } from '@/lib/posthog'

// Comma-separated Clerk user IDs granted admin access.
// Set VITE_ADMIN_USER_IDS in .env.local / Cloudflare Pages env vars.
const ADMIN_IDS = new Set(
  (import.meta.env.VITE_ADMIN_USER_IDS as string ?? '')
    .split(',').map((s: string) => s.trim()).filter(Boolean)
)

export function isAdminUser(userId: string | undefined): boolean {
  return !!userId && ADMIN_IDS.has(userId)
}

interface Contribution {
  id: number
  name: string
  city: string
  country: string
  sport: string
  dist_label: string | null
  dist_km: number | null
  year: number | null
  event_date: string | null
  contributor_count: number
  contributor_id: string | null
  status: string
  created_at: string
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
}

const st = {
  page: {
    minHeight: '100vh',
    background: 'var(--surface)',
    color: 'var(--white)',
    fontFamily: 'var(--body)',
    padding: '20px 16px 80px',
    maxWidth: '900px',
    margin: '0 auto',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px',
  } as React.CSSProperties,
  backBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--muted)',
    cursor: 'pointer',
    fontSize: '20px',
    padding: '4px 8px',
    lineHeight: 1,
  } as React.CSSProperties,
  title: {
    fontFamily: 'var(--headline)',
    fontSize: '22px',
    fontWeight: 900,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: 'var(--white)',
    margin: 0,
  } as React.CSSProperties,
  badge: {
    fontSize: '11px',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    letterSpacing: '0.08em',
    background: 'rgba(var(--orange-ch),0.15)',
    color: 'var(--orange)',
    border: '1px solid rgba(var(--orange-ch),0.35)',
    borderRadius: '4px',
    padding: '2px 8px',
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,
  card: {
    background: 'var(--surface2)',
    border: '1px solid var(--border2)',
    borderRadius: '12px',
    padding: '14px 16px',
    marginBottom: '10px',
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: '12px',
    alignItems: 'center',
  } as React.CSSProperties,
  raceName: {
    fontFamily: 'var(--headline)',
    fontSize: '15px',
    fontWeight: 800,
    letterSpacing: '0.04em',
    color: 'var(--white)',
  } as React.CSSProperties,
  meta: {
    fontSize: '12px',
    color: 'var(--muted)',
    marginTop: '4px',
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px',
  } as React.CSSProperties,
  pill: {
    background: 'var(--surface3)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '2px 7px',
    fontSize: '11px',
    color: 'var(--muted)',
    fontFamily: 'var(--body)',
  } as React.CSSProperties,
  countPill: {
    background: 'rgba(var(--orange-ch),0.12)',
    border: '1px solid rgba(var(--orange-ch),0.3)',
    borderRadius: '4px',
    padding: '2px 7px',
    fontSize: '11px',
    color: 'var(--orange)',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
  } as React.CSSProperties,
  btnRow: {
    display: 'flex',
    gap: '8px',
  } as React.CSSProperties,
  approveBtn: {
    background: '#00FF88',
    color: '#000',
    border: 'none',
    borderRadius: '7px',
    padding: '8px 14px',
    fontSize: '12px',
    fontFamily: 'var(--headline)',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  rejectBtn: {
    background: 'none',
    color: 'var(--muted)',
    border: '1px solid var(--border2)',
    borderRadius: '7px',
    padding: '8px 14px',
    fontSize: '12px',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  empty: {
    textAlign: 'center' as const,
    padding: '48px 16px',
    color: 'var(--muted)',
    fontSize: '14px',
  } as React.CSSProperties,
  error: {
    background: 'rgba(255,60,60,0.1)',
    border: '1px solid rgba(255,60,60,0.3)',
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '13px',
    color: 'var(--error)',
    marginBottom: '16px',
  } as React.CSSProperties,
  sectionLabel: {
    fontFamily: 'var(--headline)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--muted)',
    marginBottom: '10px',
  } as React.CSSProperties,
}

async function apiRequest(path: string, method = 'GET', body?: object) {
  const token = getClerkToken()
  const res = await fetch(path, {
    method,
    headers: {
      ...CORS_HEADERS,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) throw new Error(`${res.status}: ${await res.text().catch(() => '')}`)
  if (res.status === 204) return null
  return res.json()
}

export function Admin() {
  const navigate = useNavigate()
  const authUser = useAuthStore(s => s.authUser)
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actioning, setActioning] = useState<number | null>(null)
  const [toast, setToast] = useState('')

  const isAdmin = isAdminUser(authUser?.id)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiRequest('/api/admin/contributions')
      setContributions(data ?? [])
    } catch (e: unknown) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    load()
  }, [isAdmin, load])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  async function handleAction(id: number, action: 'approve' | 'reject') {
    setActioning(id)
    try {
      const contribution = contributions.find(c => c.id === id)
      await apiRequest(`/api/admin/contributions/${id}/${action}`, 'POST')
      setContributions(prev => prev.filter(c => c.id !== id))
      showToast(action === 'approve' ? '✓ Added to race catalog' : 'Dismissed')
      posthog.capture('catalog contribution reviewed', {
        action,
        race_name: contribution?.name ?? null,
        race_sport: contribution?.sport ?? null,
        race_country: contribution?.country ?? null,
        contributor_count: contribution?.contributor_count ?? null,
      })
    } catch (e: unknown) {
      setError(String(e))
    } finally {
      setActioning(null)
    }
  }

  if (!authUser) {
    return (
      <div style={st.page}>
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Sign in required.</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div style={st.page}>
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Not authorised.</p>
      </div>
    )
  }

  return (
    <div style={st.page}>
      {toast && (
        <div style={{
          position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: '8px',
          padding: '10px 18px', fontSize: '13px', color: 'var(--white)', zIndex: 2000,
          fontFamily: 'var(--body)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          {toast}
        </div>
      )}

      <div style={st.header}>
        <button style={st.backBtn} onClick={() => navigate(-1)}>←</button>
        <h1 style={st.title}>Admin</h1>
        <span style={st.badge}>Internal</span>
      </div>

      {error && <div style={st.error}>{error}</div>}

      <p style={st.sectionLabel}>
        Pending race catalog submissions — {loading ? '…' : `${contributions.length} pending`}
      </p>

      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Loading…</p>
      ) : contributions.length === 0 ? (
        <div style={st.empty}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>✓</div>
          <div>No pending submissions</div>
        </div>
      ) : (
        contributions.map(c => (
          <div key={c.id} style={st.card}>
            <div>
              <div style={st.raceName}>{c.name}</div>
              <div style={st.meta}>
                <span style={st.pill}>{c.city}, {c.country}</span>
                {c.sport && <span style={st.pill}>{c.sport}</span>}
                {(c.dist_label || c.dist_km) && (
                  <span style={st.pill}>{c.dist_label ?? `${c.dist_km} km`}</span>
                )}
                {c.year && <span style={st.pill}>{c.year}</span>}
                {c.event_date && <span style={st.pill}>{c.event_date}</span>}
                <span style={st.countPill}>
                  {c.contributor_count} {c.contributor_count === 1 ? 'submission' : 'submissions'}
                </span>
              </div>
              <div style={{ ...st.meta, marginTop: '6px', fontSize: '10px', opacity: 0.5 }}>
                #{c.id} · submitted {new Date(c.created_at).toLocaleDateString()}
                {c.contributor_id && ` · ${c.contributor_id.slice(0, 16)}…`}
              </div>
            </div>
            <div style={st.btnRow}>
              <button
                style={st.approveBtn}
                disabled={actioning === c.id}
                onClick={() => handleAction(c.id, 'approve')}
              >
                {actioning === c.id ? '…' : '✓ Add'}
              </button>
              <button
                style={st.rejectBtn}
                disabled={actioning === c.id}
                onClick={() => handleAction(c.id, 'reject')}
              >
                ✕
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

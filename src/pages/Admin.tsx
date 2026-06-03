import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/useAuthStore'
import { getClerkToken } from '@/lib/supabase'
import { posthog } from '@/lib/posthog'

// Authorization lives entirely in the Worker (ADMIN_USER_IDS secret), probed
// via /api/admin/check by AdminApp. No admin user IDs are shipped in the
// client bundle. This page is only rendered after that probe returns 200.

type AdminTab = 'catalog' | 'users' | 'feedback' | 'analytics' | 'errors'

interface Contribution {
  id: number; name: string; city: string; country: string; sport: string
  dist_label: string | null; dist_km: number | null; year: number | null
  event_date: string | null; contributor_count: number; contributor_id: string | null
  status: string; created_at: string
}
interface AdminUser {
  user_id: string; username: string | null; is_public: boolean
  updated_at: string; created_at: string | null; race_count: number
  upcoming_count: number; goal_count: number; sport: string | null; country: string | null
}
interface Feedback {
  id: number; user_id: string; rating: number | null; message: string | null
  page: string | null; created_at: string
}
interface ErrorRow {
  id: string; message: string | null; stack: string | null; url: string | null
  env: string | null; ts: string; created_at: string
}
interface Analytics {
  users:      { total: number; dau: number; wau: number; mau: number }
  feedback:   { count: number; avg_rating: number }
  races:      { total: number; users_with_races: number; avg_per_user: number }
  segments:   { power: number; active: number; dormant: number }
  adoption:   {
    public:    { count: number; pct: number }
    upcoming:  { count: number; pct: number }
    goals:     { count: number; pct: number }
    wearables: { count: number; pct: number }
  }
  recency:    { today: number; week: number; month: number; dormant: number }
  wearables:  [string, number][]
  growth:     [string, number][]
  top_sports: [string, number][]
  top_distances: [string, number][]
  top_countries: [string, number][]
}

const ADMIN_CORS_HEADERS = { 'Content-Type': 'application/json' }

const st = {
  page: {
    minHeight: '100vh',
    background: 'var(--surface)',
    color: 'var(--white)',
    fontFamily: 'var(--body)',
    padding: '20px 16px 80px',
    maxWidth: '960px',
    margin: '0 auto',
  } as React.CSSProperties,
  header: { display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: '20px' } as React.CSSProperties,
  backBtn: { background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 'var(--text-lg)', padding: '4px 8px', lineHeight: 1 } as React.CSSProperties,
  title: { fontFamily: 'var(--headline)', fontSize: 'var(--text-xl)', fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'var(--white)', margin: 0 } as React.CSSProperties,
  badge: { fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.08em', background: 'rgba(var(--orange-ch),0.15)', color: 'var(--orange)', border: '1px solid rgba(var(--orange-ch),0.35)', borderRadius: 'var(--radius-xs)', padding: '2px 8px', textTransform: 'uppercase' as const } as React.CSSProperties,
  tabBar: { display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '0', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' } as React.CSSProperties,
  tab: (active: boolean): React.CSSProperties => ({
    background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
    fontFamily: 'var(--headline)', fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.1em',
    textTransform: 'uppercase', padding: '8px 14px',
    color: active ? 'var(--orange)' : 'var(--muted)',
    borderBottom: active ? '2px solid var(--orange)' : '2px solid transparent',
    marginBottom: '-1px',
    transition: 'color 0.15s',
  }),
  card: { background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: '8px' } as React.CSSProperties,
  cardRow: { background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: '6px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--sp-3)', alignItems: 'center' } as React.CSSProperties,
  raceName: { fontFamily: 'var(--headline)', fontSize: 'var(--text-base)', fontWeight: 800, letterSpacing: '0.04em', color: 'var(--white)' } as React.CSSProperties,
  meta: { fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '4px', display: 'flex', flexWrap: 'wrap' as const, gap: 'var(--sp-2)' } as React.CSSProperties,
  pill: { background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)', padding: '2px 7px', fontSize: 'var(--text-xs)', color: 'var(--muted)' } as React.CSSProperties,
  pillOrange: { background: 'rgba(var(--orange-ch),0.12)', border: '1px solid rgba(var(--orange-ch),0.3)', borderRadius: 'var(--radius-xs)', padding: '2px 7px', fontSize: 'var(--text-xs)', color: 'var(--orange)', fontFamily: 'var(--headline)', fontWeight: 700 } as React.CSSProperties,
  pillGreen: { background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: 'var(--radius-xs)', padding: '2px 7px', fontSize: 'var(--text-xs)', color: '#00FF88', fontFamily: 'var(--headline)', fontWeight: 700 } as React.CSSProperties,
  btnRow: { display: 'flex', gap: 'var(--sp-2)' } as React.CSSProperties,
  approveBtn: { background: '#00FF88', color: '#000', border: 'none', borderRadius: 'var(--radius-sm)', padding: '8px 14px', fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' as const, cursor: 'pointer', whiteSpace: 'nowrap' as const } as React.CSSProperties,
  rejectBtn: { background: 'none', color: 'var(--muted)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '8px 14px', fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, cursor: 'pointer', whiteSpace: 'nowrap' as const } as React.CSSProperties,
  empty: { textAlign: 'center' as const, padding: '48px 16px', color: 'var(--muted)', fontSize: 'var(--text-compact)' } as React.CSSProperties,
  error: { background: 'rgba(255,60,60,0.1)', border: '1px solid rgba(255,60,60,0.3)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 'var(--text-sm)', color: 'var(--error)', marginBottom: '16px' } as React.CSSProperties,
  sectionLabel: { fontFamily: 'var(--headline)', fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--muted)', marginBottom: '10px' } as React.CSSProperties,
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--sp-3)', marginBottom: '24px' } as React.CSSProperties,
  statCard: { background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' } as React.CSSProperties,
  statLabel: { fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--muted)', marginBottom: '6px' } as React.CSSProperties,
  statValue: { fontSize: 'var(--text-2xl)', fontFamily: 'var(--headline)', fontWeight: 900, color: 'var(--orange)', lineHeight: 1 } as React.CSSProperties,
  statSub: { fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '4px' } as React.CSSProperties,
  barLabel: { fontSize: 'var(--text-xs)', color: 'var(--muted)', minWidth: '120px', flexShrink: 0 } as React.CSSProperties,
  bar: (pct: number): React.CSSProperties => ({ height: '6px', borderRadius: '3px', background: `linear-gradient(90deg, var(--orange) ${pct}%, var(--surface3) ${pct}%)`, flex: 1 }),
  barCount: { fontSize: 'var(--text-xs)', color: 'var(--white)', minWidth: '32px', textAlign: 'right' as const },
  toast: { position: 'fixed' as const, bottom: '80px', left: '50%', transform: 'translateX(-50%)', background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-md)', padding: '10px 18px', fontSize: 'var(--text-sm)', color: 'var(--white)', zIndex: 2000, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' } as React.CSSProperties,
}

async function apiReq(path: string, method = 'GET', body?: object) {
  const token = getClerkToken()
  const res = await fetch(path, {
    method,
    headers: { ...ADMIN_CORS_HEADERS, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) throw new Error(`${res.status}: ${await res.text().catch(() => '')}`)
  if (res.status === 204) return null
  return res.json()
}

function fmtTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30)  return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
  posthog.capture('admin_csv_exported', { file: filename, rows: rows.length })
}

const refreshBtnStyle: React.CSSProperties = {
  background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)',
  color: 'var(--muted)', cursor: 'pointer', padding: '6px 12px', fontSize: 'var(--text-xs)',
  fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
}
const exportBtnStyle: React.CSSProperties = { ...refreshBtnStyle, color: 'var(--orange)', borderColor: 'rgba(var(--orange-ch),0.4)' }

function TabActions({ onRefresh, onExport, loading }: { onRefresh: () => void; onExport?: () => void; loading: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'flex-end', marginBottom: '12px' }}>
      {onExport && <button style={exportBtnStyle} onClick={onExport}>↓ Export CSV</button>}
      <button style={refreshBtnStyle} onClick={onRefresh} disabled={loading}>{loading ? '…' : '↻ Refresh'}</button>
    </div>
  )
}

function Stars({ rating }: { rating: number | null }) {
  if (!rating) return <span style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)' }}>No rating</span>
  return (
    <span style={{ color: '#FFD770', fontSize: 'var(--text-sm)', letterSpacing: '1px' }}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  )
}

// ─── Catalog Tab ─────────────────────────────────────────────────────────────
function CatalogTab() {
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actioning, setActioning] = useState<number | null>(null)
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setContributions(await apiReq('/api/admin/contributions') ?? []) }
    catch (e: unknown) { setError(String(e)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 4000) }

  async function handleAction(id: number, action: 'approve' | 'reject') {
    setActioning(id)
    try {
      const c = contributions.find(x => x.id === id)
      await apiReq(`/api/admin/contributions/${id}/${action}`, 'POST')
      setContributions(prev => prev.filter(x => x.id !== id))
      showToast(action === 'approve' ? '✓ Added to race catalog' : 'Dismissed')
      posthog.capture('catalog contribution reviewed', { action, race_name: c?.name ?? null, race_sport: c?.sport ?? null, contributor_count: c?.contributor_count ?? null })
    } catch (e: unknown) { setError(String(e)) }
    finally { setActioning(null) }
  }

  return (
    <>
      {toast && <div style={st.toast}>{toast}</div>}
      <TabActions onRefresh={load} loading={loading} />
      {error && <div style={st.error}>{error}</div>}
      <p style={st.sectionLabel}>Pending race catalog submissions — {loading ? '…' : `${contributions.length} pending`}</p>
      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>Loading…</p>
      ) : contributions.length === 0 ? (
        <div style={st.empty}><div style={{ fontSize: 'var(--text-2xl)', marginBottom: '8px' }}>✓</div><div>No pending submissions</div></div>
      ) : contributions.map(c => (
        <div key={c.id} style={st.cardRow}>
          <div>
            <div style={st.raceName}>{c.name}</div>
            <div style={st.meta}>
              <span style={st.pill}>{c.city}, {c.country}</span>
              {c.sport && <span style={st.pill}>{c.sport}</span>}
              {(c.dist_label || c.dist_km) && <span style={st.pill}>{c.dist_label ?? `${c.dist_km} km`}</span>}
              {c.year && <span style={st.pill}>{c.year}</span>}
              <span style={st.pillOrange}>{c.contributor_count} {c.contributor_count === 1 ? 'submission' : 'submissions'}</span>
              <span style={{ ...st.pill, opacity: 0.5 }}>#{c.id} · {fmtTimeAgo(c.created_at)}</span>
            </div>
          </div>
          <div style={st.btnRow}>
            <button style={st.approveBtn} disabled={actioning === c.id} onClick={() => handleAction(c.id, 'approve')}>{actioning === c.id ? '…' : '✓ Add'}</button>
            <button style={st.rejectBtn}  disabled={actioning === c.id} onClick={() => handleAction(c.id, 'reject')}>✕</button>
          </div>
        </div>
      ))}
    </>
  )
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers]   = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    apiReq('/api/admin/users').then(d => setUsers(d ?? [])).catch(e => setError(String(e))).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  function exportCSV() {
    downloadCSV(`breaktapes-users-${new Date().toISOString().slice(0, 10)}.csv`, users.map(u => ({
      user_id: u.user_id, username: u.username ?? '', country: u.country ?? '', sport: u.sport ?? '',
      races: u.race_count, upcoming: u.upcoming_count, goals: u.goal_count,
      is_public: u.is_public, created_at: u.created_at ?? '', last_seen: u.updated_at,
    })))
  }

  const now = Date.now()
  const dau = users.filter(u => now - new Date(u.updated_at).getTime() < 24*60*60*1000).length
  const wau = users.filter(u => now - new Date(u.updated_at).getTime() < 7*24*60*60*1000).length

  const filtered = search.trim()
    ? users.filter(u => (u.username ?? '').toLowerCase().includes(search.toLowerCase()) || u.user_id.includes(search))
    : users

  return (
    <>
      <TabActions onRefresh={load} onExport={exportCSV} loading={loading} />
      {error && <div style={st.error}>{error}</div>}
      <div style={st.statGrid}>
        <div style={st.statCard}><div style={st.statLabel}>Total Users</div><div style={st.statValue}>{users.length}</div></div>
        <div style={st.statCard}><div style={st.statLabel}>DAU (24h)</div><div style={st.statValue}>{dau}</div><div style={st.statSub}>{users.length ? Math.round(dau / users.length * 100) : 0}% of total</div></div>
        <div style={st.statCard}><div style={st.statLabel}>WAU (7d)</div><div style={st.statValue}>{wau}</div></div>
        <div style={st.statCard}><div style={st.statLabel}>Public Profiles</div><div style={st.statValue}>{users.filter(u => u.is_public).length}</div></div>
      </div>

      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by username or user ID…"
        style={{ width: '100%', boxSizing: 'border-box', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-md)', padding: '10px 14px', color: 'var(--white)', fontSize: 'var(--text-sm)', marginBottom: '12px', fontFamily: 'var(--body)' }}
      />

      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>Loading…</p>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 90px', gap: 'var(--sp-2)', padding: '0 12px 8px', ...st.sectionLabel }}>
            <span>User</span><span style={{ textAlign: 'center' }}>Races</span><span style={{ textAlign: 'center' }}>Upcoming</span><span style={{ textAlign: 'center' }}>Public</span><span style={{ textAlign: 'right' }}>Last seen</span>
          </div>
          {filtered.slice(0, 100).map(u => (
            <div key={u.user_id} style={{ ...st.card, marginBottom: '4px', display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 90px', gap: 'var(--sp-2)', alignItems: 'center', padding: '10px 12px' }}>
              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--white)' }}>{u.username ? `@${u.username}` : <span style={{ color: 'var(--muted)' }}>no username</span>}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '2px' }}>{u.user_id.slice(0, 20)}…{u.sport ? ` · ${u.sport}` : ''}</div>
              </div>
              <div style={{ textAlign: 'center', fontFamily: 'var(--headline)', fontWeight: 700, color: u.race_count > 0 ? 'var(--orange)' : 'var(--muted)' }}>{u.race_count}</div>
              <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>{u.upcoming_count || '—'}</div>
              <div style={{ textAlign: 'center' }}>{u.is_public ? <span style={st.pillGreen}>Public</span> : <span style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)' }}>—</span>}</div>
              <div style={{ textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>{fmtTimeAgo(u.updated_at)}</div>
            </div>
          ))}
          {filtered.length > 100 && <p style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)', textAlign: 'center', marginTop: '8px' }}>Showing 100 of {filtered.length}</p>}
          {filtered.length === 0 && <div style={st.empty}>No users found</div>}
        </div>
      )}
    </>
  )
}

// ─── Feedback Tab ─────────────────────────────────────────────────────────────
function FeedbackTab() {
  const [items, setItems]   = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true); setError('')
    apiReq('/api/admin/feedback').then(d => setItems(d ?? [])).catch(e => setError(String(e))).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  function exportCSV() {
    downloadCSV(`breaktapes-feedback-${new Date().toISOString().slice(0, 10)}.csv`, items.map(i => ({
      id: i.id, user_id: i.user_id, rating: i.rating ?? '', page: i.page ?? '',
      message: i.message ?? '', created_at: i.created_at,
    })))
  }

  const withRating = items.filter(i => i.rating)
  const avgRating  = withRating.length ? (withRating.reduce((s, i) => s + (i.rating ?? 0), 0) / withRating.length).toFixed(1) : '—'
  const withMsg    = items.filter(i => i.message?.trim())

  return (
    <>
      <TabActions onRefresh={load} onExport={exportCSV} loading={loading} />
      {error && <div style={st.error}>{error}</div>}
      <div style={st.statGrid}>
        <div style={st.statCard}><div style={st.statLabel}>Total Feedback</div><div style={st.statValue}>{items.length}</div></div>
        <div style={st.statCard}><div style={st.statLabel}>Avg Rating</div><div style={st.statValue}>{avgRating}</div><div style={st.statSub}>out of 5</div></div>
        <div style={st.statCard}><div style={st.statLabel}>With Message</div><div style={st.statValue}>{withMsg.length}</div></div>
        <div style={{ ...st.statCard, display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
          {[1,2,3,4,5].map(r => (
            <div key={r} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: '#FFD770' }}>{'★'.repeat(r)}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '2px' }}>{items.filter(i => i.rating === r).length}</div>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>Loading…</p>
      ) : items.length === 0 ? (
        <div style={st.empty}>No feedback yet</div>
      ) : items.map(item => (
        <div key={item.id} style={{ ...st.card, cursor: item.message ? 'pointer' : 'default' }} onClick={() => item.message && setExpanded(expanded === item.id ? null : item.id)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--sp-3)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: '6px', flexWrap: 'wrap' }}>
                <Stars rating={item.rating} />
                {item.page && <span style={st.pill}>{item.page}</span>}
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>{fmtTimeAgo(item.created_at)}</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', opacity: 0.5 }}>{item.user_id?.slice(0, 16)}…</span>
              </div>
              {item.message && (
                <div style={{
                  fontSize: 'var(--text-sm)', color: 'var(--white)', lineHeight: 1.5,
                  overflow: expanded === item.id ? 'visible' : 'hidden',
                  display: '-webkit-box', WebkitLineClamp: expanded === item.id ? 'unset' : 2,
                  WebkitBoxOrient: 'vertical' as unknown as undefined,
                }}>
                  {item.message}
                </div>
              )}
              {!item.message && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>No message</div>}
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

function BarList({ label, rows, capitalize }: { label: string; rows: [string, number][]; capitalize?: boolean }) {
  if (!rows.length) return null
  const max = rows[0]?.[1] ?? 1
  return (
    <div style={{ marginBottom: '24px' }}>
      <p style={st.sectionLabel}>{label}</p>
      {rows.map(([name, count]) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: '8px' }}>
          <div style={{ ...st.barLabel, textTransform: capitalize ? 'capitalize' : 'none' }}>{name || 'Unset'}</div>
          <div style={st.bar(Math.round(count / max * 100))} />
          <div style={st.barCount}>{count}</div>
        </div>
      ))}
    </div>
  )
}

function GrowthChart({ data }: { data: [string, number][] }) {
  const max = Math.max(1, ...data.map(d => d[1]))
  const total = data.reduce((s, d) => s + d[1], 0)
  return (
    <div style={{ marginBottom: '24px' }}>
      <p style={st.sectionLabel}>New Signups — Last 30 Days ({total} total)</p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '80px', padding: '0 2px' }}>
        {data.map(([day, count]) => (
          <div key={day} title={`${day}: ${count}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
            <div style={{ height: `${Math.round(count / max * 100)}%`, minHeight: count > 0 ? '3px' : '0', background: count > 0 ? 'var(--orange)' : 'var(--surface3)', borderRadius: '2px 2px 0 0' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '4px' }}>
        <span>{data[0]?.[0].slice(5)}</span><span>{data[data.length - 1]?.[0].slice(5)}</span>
      </div>
    </div>
  )
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────
function AnalyticsTab() {
  const [data, setData]     = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    apiReq('/api/admin/analytics').then(setData).catch(e => setError(String(e))).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  if (loading && !data) return <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>Loading analytics…</p>
  if (error)   return <><TabActions onRefresh={load} loading={loading} /><div style={st.error}>{error}</div></>
  if (!data)   return null

  const seg = data.segments
  const segTotal = Math.max(1, seg.power + seg.active + seg.dormant)
  const rec = data.recency

  return (
    <>
      <TabActions onRefresh={load} loading={loading} />

      <p style={st.sectionLabel}>User Activity</p>
      <div style={st.statGrid}>
        <div style={st.statCard}><div style={st.statLabel}>Total Users</div><div style={st.statValue}>{data.users.total}</div></div>
        <div style={st.statCard}><div style={st.statLabel}>DAU (24h)</div><div style={st.statValue}>{data.users.dau}</div><div style={st.statSub}>{data.users.total ? Math.round(data.users.dau / data.users.total * 100) : 0}% of total</div></div>
        <div style={st.statCard}><div style={st.statLabel}>WAU (7d)</div><div style={st.statValue}>{data.users.wau}</div></div>
        <div style={st.statCard}><div style={st.statLabel}>MAU (30d)</div><div style={st.statValue}>{data.users.mau}</div></div>
      </div>

      <GrowthChart data={data.growth} />

      <p style={st.sectionLabel}>Engagement Segments</p>
      <div style={st.statGrid}>
        <div style={st.statCard}><div style={st.statLabel}>Power (10+ races)</div><div style={{ ...st.statValue, color: '#00FF88' }}>{seg.power}</div><div style={st.statSub}>{Math.round(seg.power / segTotal * 100)}%</div></div>
        <div style={st.statCard}><div style={st.statLabel}>Active (1–9)</div><div style={st.statValue}>{seg.active}</div><div style={st.statSub}>{Math.round(seg.active / segTotal * 100)}%</div></div>
        <div style={st.statCard}><div style={st.statLabel}>Dormant (0 races)</div><div style={{ ...st.statValue, color: 'var(--muted)' }}>{seg.dormant}</div><div style={st.statSub}>{Math.round(seg.dormant / segTotal * 100)}%</div></div>
        <div style={st.statCard}><div style={st.statLabel}>Avg Races / User</div><div style={st.statValue}>{data.races.avg_per_user}</div><div style={st.statSub}>{data.races.total.toLocaleString()} total</div></div>
      </div>

      <p style={st.sectionLabel}>Feature Adoption</p>
      <div style={st.statGrid}>
        <div style={st.statCard}><div style={st.statLabel}>Public Profiles</div><div style={st.statValue}>{data.adoption.public.pct}%</div><div style={st.statSub}>{data.adoption.public.count} users</div></div>
        <div style={st.statCard}><div style={st.statLabel}>Has Upcoming</div><div style={st.statValue}>{data.adoption.upcoming.pct}%</div><div style={st.statSub}>{data.adoption.upcoming.count} users</div></div>
        <div style={st.statCard}><div style={st.statLabel}>Set Goals</div><div style={st.statValue}>{data.adoption.goals.pct}%</div><div style={st.statSub}>{data.adoption.goals.count} users</div></div>
        <div style={st.statCard}><div style={st.statLabel}>Wearable Linked</div><div style={st.statValue}>{data.adoption.wearables.pct}%</div><div style={st.statSub}>{data.adoption.wearables.count} users</div></div>
      </div>

      <p style={st.sectionLabel}>Activity Recency</p>
      <div style={st.statGrid}>
        <div style={st.statCard}><div style={st.statLabel}>Today</div><div style={{ ...st.statValue, color: '#00FF88' }}>{rec.today}</div></div>
        <div style={st.statCard}><div style={st.statLabel}>This Week</div><div style={st.statValue}>{rec.week}</div></div>
        <div style={st.statCard}><div style={st.statLabel}>This Month</div><div style={st.statValue}>{rec.month}</div></div>
        <div style={st.statCard}><div style={st.statLabel}>Dormant (30d+)</div><div style={{ ...st.statValue, color: 'var(--muted)' }}>{rec.dormant}</div></div>
      </div>

      <BarList label="Wearable Connections" rows={data.wearables} capitalize />
      <BarList label="Top Race Countries" rows={data.top_countries} />
      <BarList label="Top Sports" rows={data.top_sports} capitalize />
      <BarList label="Top Distances" rows={data.top_distances} />
    </>
  )
}

// ─── Errors Tab ────────────────────────────────────────────────────────────────
function ErrorsTab() {
  const [errors, setErrors] = useState<ErrorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true); setError('')
    apiReq('/api/admin/errors').then(d => setErrors(d ?? [])).catch(e => setError(String(e))).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  function exportCSV() {
    downloadCSV(`breaktapes-errors-${new Date().toISOString().slice(0, 10)}.csv`, errors.map(e => ({
      id: e.id, message: e.message ?? '', url: e.url ?? '', env: e.env ?? '',
      created_at: e.created_at, stack: e.stack ?? '',
    })))
  }

  return (
    <>
      <TabActions onRefresh={load} onExport={exportCSV} loading={loading} />
      {error && <div style={st.error}>{error}</div>}
      <p style={st.sectionLabel}>{loading ? '…' : `${errors.length} client errors logged`}</p>
      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>Loading…</p>
      ) : errors.length === 0 ? (
        <div style={st.empty}><div style={{ fontSize: 'var(--text-2xl)', marginBottom: '8px' }}>✓</div><div>No errors logged</div></div>
      ) : errors.map(e => (
        <div key={e.id} style={{ ...st.card, cursor: 'pointer' }} onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-3)', marginBottom: '6px' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: '#FF6B6B', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {e.message ?? '(no message)'}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtTimeAgo(e.created_at)}</div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            {e.url && <span style={st.pill}>{e.url.replace(/^https?:\/\/[^/]+/, '')}</span>}
            {e.env && <span style={st.pill}>{e.env}</span>}
          </div>
          {expanded === e.id && e.stack && (
            <pre style={{ marginTop: '10px', fontSize: 'var(--text-xs)', color: 'var(--muted)', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '10px', overflow: 'auto', maxHeight: '200px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {e.stack}
            </pre>
          )}
        </div>
      ))}
    </>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export function Admin({ standalone, onSignOut }: { standalone?: boolean; onSignOut?: () => void } = {}) {
  const navigate  = useNavigate()
  const authUser  = useAuthStore(s => s.authUser)
  const [tab, setTab] = useState<AdminTab>('analytics')

  // Gating is handled upstream by AdminApp's /api/admin/check probe — this
  // page only mounts for an authorized admin. Each tab's data call is also
  // independently authorized server-side.
  useEffect(() => {
    posthog.capture('admin_page_viewed', { tab })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!authUser) return <div style={st.page}><p style={{ color: 'var(--muted)', fontSize: 'var(--text-compact)' }}>Sign in required.</p></div>

  const TABS: { id: AdminTab; label: string }[] = [
    { id: 'analytics', label: 'Analytics' },
    { id: 'users',     label: 'Users'     },
    { id: 'feedback',  label: 'Feedback'  },
    { id: 'errors',    label: 'Errors'    },
    { id: 'catalog',   label: 'Catalog'   },
  ]

  return (
    <div style={st.page}>
      <div style={st.header}>
        {!standalone && <button style={st.backBtn} onClick={() => navigate(-1)}>←</button>}
        <h1 style={st.title}>Admin</h1>
        <span style={st.badge}>Internal</span>
        {standalone && onSignOut && (
          <button style={{ ...st.backBtn, marginLeft: 'auto', fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }} onClick={onSignOut}>Sign out</button>
        )}
      </div>

      <div style={st.tabBar}>
        {TABS.map(t => (
          <button key={t.id} style={st.tab(tab === t.id)} onClick={() => { setTab(t.id); posthog.capture('admin_tab_viewed', { tab: t.id }) }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'analytics' && <AnalyticsTab />}
      {tab === 'users'     && <UsersTab />}
      {tab === 'feedback'  && <FeedbackTab />}
      {tab === 'errors'    && <ErrorsTab />}
      {tab === 'catalog'   && <CatalogTab />}
    </div>
  )
}

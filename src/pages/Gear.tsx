import { useState } from 'react'
import { useAuthStore } from '@/stores/useAuthStore'

const btnMain: React.CSSProperties = {
  background: 'var(--orange)',
  color: 'var(--black)',
  border: 'none',
  borderRadius: '4px',
  padding: '0.8rem 1.25rem',
  fontFamily: 'var(--headline)',
  fontWeight: 900,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontSize: '13px',
}

const btnGhost: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--white)',
  border: '1px solid var(--border2)',
  borderRadius: '4px',
  padding: '0.8rem 1.25rem',
  fontFamily: 'var(--headline)',
  fontWeight: 900,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontSize: '13px',
}

const card: React.CSSProperties = {
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '1rem',
}

type Tab = 'discover' | 'library' | 'lists' | 'stacks'

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: 'discover', label: 'Discover' },
  { id: 'library',  label: 'Library' },
  { id: 'lists',    label: 'Lists' },
  { id: 'stacks',   label: 'Stacks' },
]

const CATEGORIES = ['All', 'Running', 'Tri', 'Cycling', 'Swim']
const SPORTS     = ['All Sports', 'Running', 'Triathlon', 'Cycling', 'Swimming', 'HYROX']

function EmptyState({ title, body, cta, onCta }: {
  title: string
  body: string
  cta?: string
  onCta?: () => void
}) {
  return (
    <div style={{
      ...card,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: '0.75rem',
      padding: '2.5rem 1.5rem',
    }}>
      <p style={{
        margin: 0,
        fontFamily: 'var(--headline)',
        fontWeight: 900,
        fontSize: '15px',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--white)',
      }}>
        {title}
      </p>
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--muted)', maxWidth: '280px', lineHeight: 1.5 }}>
        {body}
      </p>
      {cta && (
        <button style={btnMain} onClick={onCta}>
          {cta}
        </button>
      )}
    </div>
  )
}

function AuthGate() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      gap: '1rem',
      padding: '4rem 1.5rem',
    }}>
      <span style={{ fontSize: '32px', opacity: 0.4 }}>🎒</span>
      <p style={{
        margin: 0,
        fontFamily: 'var(--headline)',
        fontWeight: 900,
        fontSize: '18px',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--white)',
      }}>
        Sign in to build your Gear Bag
      </p>
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--muted)', maxWidth: '280px', lineHeight: 1.5 }}>
        Save gear, create race day kits, and track what works best for you.
      </p>
    </div>
  )
}

export function Gear() {
  const authUser = useAuthStore(s => s.authUser)
  const [activeTab, setActiveTab] = useState<Tab>('discover')
  const [searchQuery, setSearchQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [sport, setSport] = useState('All Sports')

  const tabStyle = (id: Tab): React.CSSProperties => ({
    background: 'none',
    border: 'none',
    borderBottom: activeTab === id ? '2px solid var(--orange)' : '2px solid transparent',
    color: activeTab === id ? 'var(--white)' : 'var(--muted)',
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: 'var(--text-sm)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '0.6rem 0.75rem',
    cursor: 'pointer',
    transition: 'color 0.15s',
    whiteSpace: 'nowrap',
  })

  const selectStyle: React.CSSProperties = {
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: '4px',
    color: 'var(--white)',
    fontSize: 'var(--text-xs)',
    padding: '0.4rem 0.6rem',
    fontFamily: 'var(--body)',
    flex: 1,
  }

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Page heading */}
      <h1 style={{
        fontFamily: 'var(--headline)',
        fontSize: '22px',
        fontWeight: 900,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'var(--white)',
        margin: 0,
      }}>
        Gear
      </h1>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
        gap: '0.25rem',
      }}>
        {TAB_LABELS.map(t => (
          <button key={t.id} style={tabStyle(t.id)} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Auth gate — all tabs */}
      {!authUser ? (
        <AuthGate />
      ) : (
        <>
          {/* ── Discover tab ── */}
          {activeTab === 'discover' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Search row */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Search gear..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border2)',
                    borderRadius: '4px',
                    color: 'var(--white)',
                    fontSize: 'var(--text-sm)',
                    padding: '0.6rem 0.75rem',
                    fontFamily: 'var(--body)',
                  }}
                />
                <button
                  style={{ ...btnMain, padding: '0.6rem 1rem' }}
                  onClick={() => console.log('Search:', searchQuery)}
                >
                  Search
                </button>
              </div>

              {/* Filter row */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  style={selectStyle}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select
                  value={sport}
                  onChange={e => setSport(e.target.value)}
                  style={selectStyle}
                >
                  {SPORTS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Results */}
              <EmptyState
                title="Search for gear"
                body="Search the catalog above to find shoes, wetsuits, watches, nutrition, and more."
              />
            </div>
          )}

          {/* ── Library tab ── */}
          {activeTab === 'library' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{
                margin: 0,
                fontFamily: 'var(--headline)',
                fontWeight: 900,
                fontSize: '15px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--white)',
              }}>
                Your Saved Gear
              </p>
              <EmptyState
                title="No gear saved yet"
                body="Search the catalog to add items to your library."
                cta="Discover Gear"
                onCta={() => setActiveTab('discover')}
              />
            </div>
          )}

          {/* ── Lists tab ── */}
          {activeTab === 'lists' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{
                  margin: 0,
                  fontFamily: 'var(--headline)',
                  fontWeight: 900,
                  fontSize: '15px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--white)',
                }}>
                  Your Gear Lists
                </p>
                <button
                  style={{ ...btnGhost, padding: '0.5rem 0.9rem', fontSize: 'var(--text-xs)' }}
                  onClick={() => console.log('Create list')}
                >
                  + New List
                </button>
              </div>
              <EmptyState
                title="No lists yet"
                body="Create a list to organize your race day kit — shoes, nutrition, gear by distance."
                cta="Create a List"
                onCta={() => console.log('Create list')}
              />
            </div>
          )}

          {/* ── Stacks tab ── */}
          {activeTab === 'stacks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{
                margin: 0,
                fontFamily: 'var(--headline)',
                fontWeight: 900,
                fontSize: '15px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--white)',
              }}>
                Your Race Stacks
              </p>
              <EmptyState
                title="No stacks yet"
                body="A stack links your gear list to a specific race — so you always know what you packed."
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

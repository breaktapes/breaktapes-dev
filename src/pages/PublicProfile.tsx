/**
 * PublicProfile — server-safe presentational component for SSR.
 *
 * CRITICAL constraints (must pass `vitest --environment node`):
 * - NO React Router hooks (useNavigate, useLocation, etc.)
 * - NO useEffect, useState — renders synchronously
 * - NO window, document, localStorage access
 * - Props-only: <PublicProfile profile={data} />
 *
 * Used by worker/index.ts (Hono + react-dom/server.edge) in Phase 8.
 * Currently the worker uses string templates — this component is ready
 * for the switch once @cloudflare/vite-plugin is added.
 */

export interface PublicRace {
  id: string
  name: string
  date: string
  city: string
  country: string
  distance: string
  sport: string
  time?: string
  placing?: string
  medal?: string
}

export interface ProfileData {
  username: string
  firstName?: string
  lastName?: string
  city?: string
  country?: string
  mainSport?: string
  races: PublicRace[]
  isPublic: boolean
}

interface PublicProfileProps {
  profile: ProfileData
}

function escapeHtml(str: string | undefined | null): string {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtDate(d: string): string {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch {
    return d
  }
}

const MEDAL_COLORS: Record<string, string> = {
  gold:     '#FFD770',
  silver:   '#C8D4DC',
  bronze:   '#CD8C5A',
  finisher: '#E84E1B',
}

/** Personal bests: best time per distance */
function buildPBs(races: PublicRace[]): Record<string, PublicRace> {
  const pb: Record<string, PublicRace> = {}
  for (const r of races) {
    if (!r.time || !r.distance) continue
    const existing = pb[r.distance]
    if (!existing || (r.time < existing.time!)) {
      pb[r.distance] = r
    }
  }
  return pb
}

export function PublicProfile({ profile }: PublicProfileProps) {
  const { username, firstName, lastName, city, country, mainSport, races } = profile
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || username
  const sub = [mainSport, city && country ? `${city}, ${country}` : (city || country)].filter(Boolean).join(' · ')
  const levelLabel = races.length >= 50 ? 'ELITE' : races.length >= 20 ? 'PRO' : races.length >= 10 ? 'COMP' : races.length >= 5 ? 'FIT' : 'NEW'
  const pbMap = buildPBs(races)
  const recentRaces = [...races].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)
  const totalKm = Math.round(races.reduce((s, r) => s + parseFloat(r.distance || '0'), 0))
  const countries = new Set(races.map(r => r.country).filter(Boolean)).size

  const styles = {
    page: { fontFamily: "'Barlow', sans-serif", background: '#0D0D0D', color: '#F5F5F5', minHeight: '100vh', padding: '1.5rem 1rem' },
    hero: { background: '#141414', border: '1px solid rgba(245,245,245,0.06)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem' },
    nameRow: { display: 'flex' as const, alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' },
    avatar: { width: '56px', height: '56px', borderRadius: '50%', background: '#1A1A1A', border: '2px solid #E84E1B', display: 'flex' as const, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    avatarText: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '20px', color: '#F5F5F5' },
    name: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '22px', textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#F5F5F5', margin: 0 },
    sub: { fontSize: '13px', color: 'rgba(245,245,245,0.35)', margin: '2px 0 0' },
    level: { fontSize: '9px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, letterSpacing: '0.1em', color: '#E84E1B', background: 'rgba(232,78,27,0.12)', padding: '2px 6px', borderRadius: '4px' },
    statsGrid: { display: 'grid' as const, gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem', marginTop: '1rem' },
    statCell: { textAlign: 'center' as const, background: '#1A1A1A', borderRadius: '8px', padding: '0.5rem' },
    statVal: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '22px', color: '#F5F5F5', display: 'block' },
    statLabel: { fontSize: '9px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(245,245,245,0.35)' },
    section: { marginBottom: '1rem' },
    sectionTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'rgba(245,245,245,0.35)', marginBottom: '0.5rem' },
    raceRow: { display: 'flex' as const, justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0', borderBottom: '1px solid rgba(245,245,245,0.04)' },
    raceName: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: '14px', color: '#F5F5F5' },
    raceMeta: { fontSize: '11px', color: 'rgba(245,245,245,0.35)' },
    raceTime: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '13px', color: '#E84E1B', textAlign: 'right' as const },
    cta: { display: 'block', textAlign: 'center' as const, background: '#E84E1B', color: '#000', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '14px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, padding: '0.85rem', borderRadius: '4px', textDecoration: 'none', marginTop: '1.5rem' },
  }

  const initials = [firstName?.[0], lastName?.[0]].filter(Boolean).join('').toUpperCase() || username[0].toUpperCase()

  return (
    <div style={styles.page}>
      {/* Hero */}
      <div style={styles.hero}>
        <div style={styles.nameRow}>
          <div style={styles.avatar}>
            <span style={styles.avatarText}>{initials}</span>
          </div>
          <div>
            <p style={styles.name}>{escapeHtml(fullName)}</p>
            {sub && <p style={styles.sub}>{escapeHtml(sub)}</p>}
            <span style={styles.level}>{levelLabel}</span>
          </div>
        </div>
        <div style={styles.statsGrid}>
          <div style={styles.statCell}><span style={styles.statVal}>{races.length}</span><span style={styles.statLabel}>Races</span></div>
          <div style={styles.statCell}><span style={styles.statVal}>{countries}</span><span style={styles.statLabel}>Countries</span></div>
          <div style={styles.statCell}><span style={styles.statVal}>{totalKm}</span><span style={styles.statLabel}>km</span></div>
        </div>
      </div>

      {/* Personal Bests — sport-grouped card grid */}
      {Object.keys(pbMap).length > 0 && (() => {
        const RUN_DISTS: [string, string][] = [
          ['5K', '5KM'], ['10K', '10KM'], ['10 Miles', '10 MI'],
          ['Half Marathon', 'HALF'], ['Marathon', 'MARATHON'], ['Ultra', 'ULTRA'],
        ]
        const TRI_DISTS: [string, string][] = [
          ['Olympic', 'OLYMPIC'], ['70.3', '70.3'], ['IRONMAN', 'IRONMAN'],
        ]
        const cardStyle = (accent: string) => ({
          background: '#141414',
          border: '1px solid rgba(245,245,245,0.06)',
          borderLeft: `2px solid ${accent}`,
          borderRadius: '10px',
          padding: '11px 10px 10px',
          minWidth: 0,
        })
        const renderCards = (dists: [string, string][], accent: string) =>
          dists
            .filter(([d]) => pbMap[d])
            .map(([d, label]) => (
              <div key={d} style={cardStyle(accent)}>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'rgba(232,224,213,0.40)', marginBottom: '4px', lineHeight: 1 }}>{label}</div>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: '20px', color: '#E84E1B', lineHeight: 1, letterSpacing: '-0.02em' }}>{escapeHtml(pbMap[d].time)}</div>
              </div>
            ))
        const runCards = renderCards(RUN_DISTS, '#00FF88')
        const triCards = renderCards(TRI_DISTS, '#7C3AED')
        return (
          <div style={styles.section}>
            <p style={styles.sectionTitle}>Personal Bests</p>
            {runCards.length > 0 && (
              <>
                <p style={{ ...styles.sectionTitle, fontSize: '8px', marginBottom: '6px' }}>Running</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '12px' }}>
                  {runCards}
                </div>
              </>
            )}
            {triCards.length > 0 && (
              <>
                <p style={{ ...styles.sectionTitle, fontSize: '8px', marginBottom: '6px' }}>Triathlon</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '4px' }}>
                  {triCards}
                </div>
              </>
            )}
          </div>
        )
      })()}

      {/* Recent Races */}
      {recentRaces.length > 0 && (
        <div style={styles.section}>
          <p style={styles.sectionTitle}>Race History</p>
          <div style={{ background: '#141414', border: '1px solid rgba(245,245,245,0.06)', borderRadius: '12px', padding: '0.75rem 1rem' }}>
            {recentRaces.map(r => (
              <div key={r.id} style={styles.raceRow}>
                <div>
                  <div style={styles.raceName}>{escapeHtml(r.name)}</div>
                  <div style={styles.raceMeta}>{escapeHtml(r.city)}, {escapeHtml(r.country)} · {fmtDate(r.date)}</div>
                </div>
                <div>
                  {r.medal && (
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: MEDAL_COLORS[r.medal] ?? '#E84E1B', display: 'inline-block', marginRight: '6px' }} />
                  )}
                  <span style={styles.raceTime}>{escapeHtml(r.time) || '—'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compare CTA */}
      <a
        href={`/compare?b=${encodeURIComponent(username)}`}
        style={{
          display: 'block',
          textAlign: 'center',
          background: 'var(--surface2)',
          border: '1px solid var(--border2)',
          borderRadius: '10px',
          padding: '12px',
          fontFamily: 'var(--headline)',
          fontWeight: 900,
          fontSize: '12px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--white)',
          textDecoration: 'none',
        }}
      >
        Compare with @{username} →
      </a>

      {/* Join CTA */}
      <a
        href={`//?ref=u-${encodeURIComponent(username)}-profile&join_context=compare-with-${encodeURIComponent(fullName.replace(/\s+/g, '-'))}`}
        style={styles.cta}
      >
        Track Your Races on BREAKTAPES →
      </a>
    </div>
  )
}

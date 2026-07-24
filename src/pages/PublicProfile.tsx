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

const NUMERIC_STYLE: React.CSSProperties = {
  fontFamily: 'var(--num)',
  fontWeight: 600,
  letterSpacing: 'var(--num-track)',
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1, "zero" 1',
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
    page: { fontFamily: "'Barlow', sans-serif", background: 'var(--surface)', color: 'var(--white)', minHeight: '100vh', padding: '1.5rem 1rem' },
    hero: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1rem' },
    nameRow: { display: 'flex' as const, alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' },
    avatar: { width: '56px', height: '56px', borderRadius: 'var(--radius-round)', background: 'var(--surface3)', border: '2px solid var(--orange)', display: 'flex' as const, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    avatarText: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 'var(--text-lg)', color: 'var(--white)' },
    name: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 'var(--text-xl)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--white)', margin: 0 },
    sub: { fontSize: 'var(--text-sm)', color: 'var(--muted)', margin: '2px 0 0' },
    level: { fontSize: 'var(--text-xs)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, letterSpacing: '0.1em', color: 'var(--orange)', background: 'var(--orange-dim)', padding: '2px 6px', borderRadius: 'var(--radius-xs)' },
    statsGrid: { display: 'grid' as const, gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem', marginTop: '1rem' },
    statCell: { textAlign: 'center' as const, background: 'var(--surface3)', borderRadius: 'var(--radius-md)', padding: '0.5rem' },
    statVal: { ...NUMERIC_STYLE, fontSize: 'var(--text-xl)', color: 'var(--white)', display: 'block' },
    statLabel: { fontSize: 'var(--text-xs)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--muted)' },
    section: { marginBottom: '1rem' },
    sectionTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 'var(--text-xs)', letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'var(--muted)', marginBottom: '0.5rem' },
    raceRow: { display: 'flex' as const, justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0', borderBottom: '1px solid var(--border)' },
    raceName: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 'var(--text-compact)', color: 'var(--white)' },
    raceMeta: { fontSize: 'var(--text-xs)', color: 'var(--muted)' },
    raceTime: { ...NUMERIC_STYLE, fontSize: 'var(--text-sm)', color: 'var(--orange)', textAlign: 'right' as const },
    cta: { display: 'block', textAlign: 'center' as const, background: 'var(--orange)', color: 'var(--black)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 'var(--text-compact)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, padding: '0.85rem', borderRadius: 'var(--radius-xs)', textDecoration: 'none', marginTop: '1.5rem' },
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
          ['5K', '5K'], ['10K', '10K'], ['10 Miles', '10 MI'],
          ['Half Marathon', 'HALF'], ['Marathon', 'MARATHON'], ['Ultra', 'ULTRA'],
        ]
        const TRI_DISTS: [string, string][] = [
          ['Olympic', 'OLYMPIC'], ['70.3 / Middle Distance', '70.3 / Middle Distance'], ['IRONMAN', 'IRONMAN'],
        ]
        const cardStyle = (accent: string) => ({
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderLeft: `2px solid ${accent}`,
          borderRadius: 'var(--radius-lg)',
          padding: '11px 10px 10px',
          minWidth: 0,
        })
        const renderCards = (dists: [string, string][], accent: string) =>
          dists
            .filter(([d]) => pbMap[d])
            .map(([d, label]) => (
              <div key={d} style={cardStyle(accent)}>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 'var(--text-xs)', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--muted2)', marginBottom: '4px', lineHeight: 1 }}>{label}</div>
                <div style={{ ...NUMERIC_STYLE, fontSize: 'var(--text-lg)', color: 'var(--orange)', lineHeight: 1 }}>{escapeHtml(pbMap[d].time)}</div>
              </div>
            ))
        const runCards = renderCards(RUN_DISTS, '#00FF88')
        const triCards = renderCards(TRI_DISTS, '#7C3AED')
        return (
          <div style={styles.section}>
            <p style={styles.sectionTitle}>Personal Bests</p>
            {runCards.length > 0 && (
              <>
                <p style={{ ...styles.sectionTitle, marginBottom: '6px' }}>Running</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--sp-2)', marginBottom: '12px' }}>
                  {runCards}
                </div>
              </>
            )}
            {triCards.length > 0 && (
              <>
                <p style={{ ...styles.sectionTitle, marginBottom: '6px' }}>Triathlon</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--sp-2)', marginBottom: '4px' }}>
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
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem' }}>
            {recentRaces.map(r => (
              <div key={r.id} style={styles.raceRow}>
                <div>
                  <div style={styles.raceName}>{escapeHtml(r.name)}</div>
                  <div style={styles.raceMeta}>{escapeHtml(r.city)}, {escapeHtml(r.country)} · {fmtDate(r.date)}</div>
                </div>
                <div>
                  {r.medal && (
                    <div style={{ width: '10px', height: '10px', borderRadius: 'var(--radius-round)', background: MEDAL_COLORS[r.medal] ?? '#E84E1B', display: 'inline-block', marginRight: '6px' }} />
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
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--sp-3)',
          fontFamily: 'var(--headline)',
          fontWeight: 900,
          fontSize: 'var(--text-xs)',
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

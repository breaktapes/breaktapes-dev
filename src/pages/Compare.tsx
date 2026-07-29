/**
 * Athlete Comparison — /compare?a=alice&b=bob
 *
 * Fetches two public profiles from user_state and renders them side by side.
 * Both profiles must be public (is_public = true).
 */
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { APP_URL } from '@/env'
import { resolveDistKm } from '@/lib/utils'
import { sharedSheetStyles } from '@/components/ui/sheetStyles'
import { sharedFormControlStyles } from '@/components/ui/formControlStyles'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PublicRace {
  id: string
  name: string
  date: string
  distance: string
  sport: string
  time?: string
  placing?: string
  city?: string
  country?: string
}

interface AthleteRow {
  username: string
  firstName?: string
  lastName?: string
  city?: string
  country?: string
  mainSport?: string
  races: PublicRace[]
  isPublic: boolean
}

type LoadState = 'idle' | 'loading' | 'ok' | 'error'

const NUMERIC_STYLE: React.CSSProperties = {
  fontFamily: 'var(--num)',
  fontWeight: 600,
  letterSpacing: 'var(--num-track)',
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1, "zero" 1',
}

const PANEL: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%), var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 'calc(var(--radius-lg) + 2px)',
  boxShadow: '0 18px 36px rgba(0,0,0,0.24)',
}

const SOFT_PANEL: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(var(--orange-ch),0.05) 0%, rgba(255,255,255,0) 100%), var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
}

const SECTION_KICKER: React.CSSProperties = {
  fontFamily: 'var(--headline)',
  fontWeight: 800,
  fontSize: 'var(--text-xs)',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseHMS(str: string | undefined): number | null {
  if (!str) return null
  const p = str.trim().split(':').map(Number)
  if (p.some(isNaN)) return null
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2]
  if (p.length === 2) return p[0] * 60 + p[1]
  return null
}

// Label-aware via the shared resolver — a local 6-entry map silently dropped
// Olympic / Sprint / 50K / 100 Mile / "70.3 / Middle Distance" PBs from the
// comparison (they returned 0 and never matched a comparison bucket).
function distToKm(d: string | undefined): number {
  return resolveDistKm(d ?? '') ?? 0
}


function normDist(d: string | undefined): string {
  const km = distToKm(d)
  if (!km) return d?.toLowerCase() ?? ''
  if (km >= 42 && km <= 42.3) return 'marathon'
  if (km >= 21 && km <= 21.2) return 'half'
  if (km >= 113 && km <= 114) return '70.3 / Middle Distance'
  if (km >= 225 && km <= 227) return 'ironman'
  if (km >= 4.9 && km <= 5.1) return '5k'
  if (km >= 9.9 && km <= 10.1) return '10k'
  return `${km}`
}

function bestTime(races: PublicRace[], distNorm: string): string | null {
  let best: number | null = null
  for (const r of races) {
    if (normDist(r.distance) !== distNorm) continue
    const s = parseHMS(r.time)
    if (s != null && (best === null || s < best)) best = s
  }
  if (best === null) return null
  const h = Math.floor(best / 3600)
  const m = Math.floor((best % 3600) / 60)
  const s = Math.round(best % 60)
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

function countCountries(races: PublicRace[]): number {
  return new Set(races.map(r => r.country).filter(Boolean)).size
}

function countDistance(races: PublicRace[], distNorm: string): number {
  return races.filter(r => normDist(r.distance) === distNorm).length
}

// ── Supabase fetch ────────────────────────────────────────────────────────────

async function fetchPublicProfile(username: string): Promise<AthleteRow | 'private' | 'not_found'> {
  // Visibility-filtered RPC (anon can't read raw user_state). Returns null for
  // a private/missing profile, else { username, athlete, races? }. `races` is
  // present only when the owner made the race history public — reads the canonical
  // state_json (the old query read stale legacy races/athlete columns).
  const { data, error } = await supabase.rpc('get_public_card', { p_username: username })
  if (error) return 'not_found'
  if (!data) return 'not_found' // null = no public profile with that username

  const card = data as Record<string, unknown>
  const athlete = (card.athlete as Record<string, unknown>) ?? {}
  const races: PublicRace[] = ((card.races as PublicRace[]) ?? []).filter((r: PublicRace) => r.time)

  return {
    username: card.username as string,
    firstName: athlete.firstName as string | undefined,
    lastName: athlete.lastName as string | undefined,
    city: athlete.city as string | undefined,
    country: athlete.country as string | undefined,
    mainSport: athlete.mainSport as string | undefined,
    races,
    isPublic: true,
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

const COMPARE_DISTS = [
  { label: 'Marathon', norm: 'marathon' },
  { label: 'Half', norm: 'half' },
  { label: '10K', norm: '10k' },
  { label: '5K', norm: '5k' },
  { label: '70.3 / Middle Distance', norm: '70.3 / Middle Distance' },
  { label: 'Ironman', norm: 'ironman' },
]

function StatRow({
  label, a, b, better,
}: { label: string; a: string | number | null; b: string | number | null; better?: 'a' | 'b' | 'tie' | null }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      gap: '0.5rem',
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        ...NUMERIC_STYLE, fontSize: 'var(--text-base)', color: better === 'a' ? 'var(--orange)' : 'var(--white)',
        textAlign: 'right',
      }}>
        {a ?? '—'}
      </div>
      <div style={{
        fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-xs)',
        letterSpacing: '0.12em', textTransform: 'uppercase',
        color: 'var(--muted)', textAlign: 'center', whiteSpace: 'nowrap',
      }}>
        {label}
      </div>
      <div style={{
        ...NUMERIC_STYLE, fontSize: 'var(--text-base)', color: better === 'b' ? 'var(--orange)' : 'var(--white)',
      }}>
        {b ?? '—'}
      </div>
    </div>
  )
}

function SummaryCell({
  label,
  value,
  accent,
}: {
  label: string
  value: string | number
  accent?: boolean
}) {
  return (
    <div style={{
      ...SOFT_PANEL,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      minWidth: 0,
    }}>
      <div style={{
        ...SECTION_KICKER,
        color: accent ? 'var(--orange)' : 'var(--muted)',
        fontSize: 'var(--text-xs)',
      }}>
        {label}
      </div>
      <div style={{
        ...NUMERIC_STYLE,
        fontSize: 'clamp(24px, 6vw, 36px)',
        lineHeight: 0.95,
        color: 'var(--white)',
      }}>
        {value}
      </div>
    </div>
  )
}

function ProfileColumn({ profile }: { profile: AthleteRow | 'private' | 'not_found' | null; }) {
  if (!profile) return <div style={{ flex: 1 }} />

  if (profile === 'private') {
    return (
      <div style={{ ...SOFT_PANEL, flex: 1, padding: '1rem', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--body)', fontSize: 'var(--text-sm)' }}>
        Profile is private
      </div>
    )
  }

  if (profile === 'not_found') {
    return (
      <div style={{ ...SOFT_PANEL, flex: 1, padding: '1rem', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--body)', fontSize: 'var(--text-sm)' }}>
        Athlete not found
      </div>
    )
  }

  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || `@${profile.username}`
  const initials = (profile.firstName?.[0] ?? '') + (profile.lastName?.[0] ?? '') || profile.username[0].toUpperCase()
  const loc = [profile.city, profile.country].filter(Boolean).join(', ')

  return (
    <div style={{ ...SOFT_PANEL, flex: 1, textAlign: 'center', minWidth: 0, padding: '18px 14px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
      <div style={{
        width: '56px', height: '56px', borderRadius: '18px',
        background: 'linear-gradient(135deg, rgba(var(--orange-ch),0.2) 0%, var(--surface3) 100%)', border: '1px solid rgba(var(--orange-ch),0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 2px', fontFamily: 'var(--headline)', fontWeight: 900,
        fontSize: 'var(--text-lg)', color: 'var(--white)',
      }}>
        {initials}
      </div>
      <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-base)', letterSpacing: '0.04em', color: 'var(--white)', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
        {name}
      </div>
      <div style={{ fontFamily: 'var(--body)', fontSize: 'var(--text-xs)', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
        @{profile.username}
      </div>
      {loc && (
        <div style={{ fontFamily: 'var(--body)', fontSize: 'var(--text-xs)', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
          {loc}
        </div>
      )}
      {profile.mainSport && (
        <span style={{
          marginTop: '2px',
          padding: '5px 8px',
          borderRadius: 'var(--radius-pill)',
          background: 'rgba(var(--orange-ch),0.12)',
          border: '1px solid rgba(var(--orange-ch),0.25)',
          fontFamily: 'var(--headline)',
          fontWeight: 800,
          fontSize: 'var(--text-xs)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--orange)',
        }}>
          {profile.mainSport}
        </span>
      )}
    </div>
  )
}

// ── Username search sheet ─────────────────────────────────────────────────────

function SearchSheet({
  placeholder, onSelect, onClose,
}: { placeholder: string; onSelect: (username: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('')

  return createPortal((
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
      zIndex: 1000, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }} onClick={onClose}>
      <div
        style={{ ...sharedSheetStyles.sheet, maxWidth: '100%', maxHeight: 'unset', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', padding: '1.25rem 1rem 2rem' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-3)', marginBottom: '0.75rem' }}>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            {placeholder}
          </div>
          <button onClick={onClose} aria-label="Close" style={sharedSheetStyles.closeBtn}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            autoFocus
            type="text"
            placeholder="@username"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && q.trim()) {
                onSelect(q.trim().replace(/^@/, ''))
                onClose()
              }
            }}
            style={{ ...sharedFormControlStyles.input, flex: 1 }}
          />
          <button
            onClick={() => { if (q.trim()) { onSelect(q.trim().replace(/^@/, '')); onClose() } }}
            style={{
              background: 'var(--orange)', color: 'var(--black)', border: 'none',
              borderRadius: 'var(--radius-md)', padding: '10px 16px',
              fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-xs)',
              letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            Go
          </button>
        </div>
      </div>
    </div>
  ), document.body)
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function Compare() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const myUsername = useAthleteStore(s => s.athlete?.username ?? '')

  // When arriving from a public profile with only ?b=username, auto-fill
  // slot A with the signed-in user's username so they compare against themselves.
  useEffect(() => {
    const b = searchParams.get('b')
    const a = searchParams.get('a')
    if (b && !a && myUsername && myUsername !== b) {
      const params = new URLSearchParams(searchParams)
      params.set('a', myUsername)
      setSearchParams(params, { replace: true })
    }
  }, [myUsername, searchParams, setSearchParams])

  const usernameA = searchParams.get('a') ?? ''
  const usernameB = searchParams.get('b') ?? ''

  const [profileA, setProfileA] = useState<AthleteRow | 'private' | 'not_found' | null>(null)
  const [profileB, setProfileB] = useState<AthleteRow | 'private' | 'not_found' | null>(null)
  const [loadA, setLoadA] = useState<LoadState>('idle')
  const [loadB, setLoadB] = useState<LoadState>('idle')

  const [searchSlot, setSearchSlot] = useState<'a' | 'b' | null>(null)
  const [copied, setCopied] = useState(false)

  const loadProfile = useCallback(async (username: string, slot: 'a' | 'b') => {
    if (!username) return
    const setLoad = slot === 'a' ? setLoadA : setLoadB
    const setProfile = slot === 'a' ? setProfileA : setProfileB
    setLoad('loading')
    try {
      const result = await fetchPublicProfile(username)
      setProfile(result)
      setLoad('ok')
    } catch {
      setProfile('not_found')
      setLoad('error')
    }
  }, [])

  useEffect(() => { if (usernameA) loadProfile(usernameA, 'a') }, [usernameA, loadProfile])
  useEffect(() => { if (usernameB) loadProfile(usernameB, 'b') }, [usernameB, loadProfile])

  function handleSelectUser(slot: 'a' | 'b', username: string) {
    const params = new URLSearchParams(searchParams)
    params.set(slot, username)
    setSearchParams(params)
  }

  function copyLink() {
    const url = `${APP_URL}/compare?a=${encodeURIComponent(usernameA)}&b=${encodeURIComponent(usernameB)}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Derive stats for comparison
  const aIsAthleteRow = profileA !== null && profileA !== 'private' && profileA !== 'not_found'
  const bIsAthleteRow = profileB !== null && profileB !== 'private' && profileB !== 'not_found'

  const rA = aIsAthleteRow ? (profileA as AthleteRow).races : []
  const rB = bIsAthleteRow ? (profileB as AthleteRow).races : []

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      minHeight: '100dvh',
      background: 'linear-gradient(180deg, var(--black) 0%, var(--surface) 100%)',
      paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 24px)',
    }}>
      {/* Back button */}
      <div style={{ padding: '1rem 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: 'none', color: 'var(--muted)',
            fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-xs)',
            letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', padding: 0,
          }}
        >
          ← Back
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          Compare
        </div>
      </div>

      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <section style={{ ...PANEL, position: 'relative', overflow: 'hidden', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'radial-gradient(circle at top left, rgba(var(--orange-ch),0.2), transparent 30%), radial-gradient(circle at bottom right, rgba(255,255,255,0.05), transparent 28%)',
          }} />
          <div style={{ position: 'relative' }}>
            <div style={SECTION_KICKER}>Head To Head</div>
            <h1 style={{
              margin: '6px 0 0',
              fontFamily: 'var(--headline)',
              fontWeight: 900,
              fontSize: 'clamp(30px, 8vw, 42px)',
              lineHeight: 0.92,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--white)',
            }}>
              Compare Athletes
            </h1>
            <p style={{ margin: '10px 0 0', maxWidth: '560px', fontSize: 'var(--text-sm)', color: 'var(--muted)', lineHeight: 1.6 }}>
              Put two public race histories side by side to compare volume, countries raced, and personal bests across the distances that matter.
            </p>
          </div>

          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
            <SummaryCell label="Loaded Athletes" value={[usernameA, usernameB].filter(Boolean).length} accent />
            <SummaryCell label="Shared Distances" value={COMPARE_DISTS.length} />
            <SummaryCell label="Share Ready" value={usernameA && usernameB ? 'YES' : 'NO'} />
          </div>
        </section>

        {/* Athlete headers */}
        <div style={{
          ...PANEL,
          padding: '1rem',
        }}>
          {/* Instructional state — no params yet */}
          {!usernameA && !usernameB && (
            <div style={{ textAlign: 'center', padding: '1rem 0 0.5rem' }}>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--white)', marginBottom: '6px' }}>
                Compare Two Athletes
              </div>
              <div style={{ fontFamily: 'var(--body)', fontSize: 'var(--text-xs)', color: 'var(--muted)', lineHeight: 1.5 }}>
                Search for two athletes below to compare personal bests, race counts, and countries raced.
              </div>
            </div>
          )}
          {/* Same username guard */}
          {usernameA && usernameB && usernameA.toLowerCase() === usernameB.toLowerCase() && (
            <div style={{ ...SOFT_PANEL, textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--body)', fontSize: 'var(--text-sm)', marginBottom: '1rem', padding: '12px 14px' }}>
              Can't compare an athlete to themselves.
            </div>
          )}
          <div style={{ ...SECTION_KICKER, marginBottom: '10px' }}>Matchup</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.5rem', alignItems: 'center' }}>
            {/* Athlete A */}
            <div>
              {loadA === 'loading' ? (
                <div style={{ ...SOFT_PANEL, textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--body)', fontSize: 'var(--text-xs)', padding: '1rem' }}>Loading...</div>
              ) : profileA ? (
                <ProfileColumn profile={profileA} />
              ) : (
                <button
                  onClick={() => setSearchSlot('a')}
                  style={{
                    width: '100%', background: 'linear-gradient(180deg, rgba(var(--orange-ch),0.05) 0%, rgba(255,255,255,0) 100%), var(--surface3)', border: '1px dashed rgba(var(--orange-ch),0.35)',
                    borderRadius: 'var(--radius-lg)', padding: '1.15rem 0.75rem', cursor: 'pointer',
                    fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-xs)',
                    letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)',
                    minHeight: '178px',
                  }}
                >
                  <div style={{ fontSize: '28px', lineHeight: 1, color: 'var(--orange)', marginBottom: '8px' }}>+</div>
                  Athlete A
                </button>
              )}
              {profileA && (
                <button
                  onClick={() => setSearchSlot('a')}
                  style={{
                    display: 'block', margin: '6px auto 0', background: 'none', border: 'none',
                    color: 'var(--muted)', fontFamily: 'var(--body)', fontSize: 'var(--text-xs)',
                    cursor: 'pointer', textDecoration: 'underline',
                  }}
                >
                  Change
                </button>
              )}
            </div>

            {/* VS divider */}
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '18px',
              border: '1px solid rgba(var(--orange-ch),0.3)',
              background: 'linear-gradient(180deg, rgba(var(--orange-ch),0.18) 0%, rgba(var(--orange-ch),0.04) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-lg)',
              color: 'var(--orange)', letterSpacing: '0.08em',
            }}>
              VS
            </div>

            {/* Athlete B */}
            <div>
              {loadB === 'loading' ? (
                <div style={{ ...SOFT_PANEL, textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--body)', fontSize: 'var(--text-xs)', padding: '1rem' }}>Loading...</div>
              ) : profileB ? (
                <ProfileColumn profile={profileB} />
              ) : (
                <button
                  onClick={() => setSearchSlot('b')}
                  style={{
                    width: '100%', background: 'linear-gradient(180deg, rgba(var(--orange-ch),0.05) 0%, rgba(255,255,255,0) 100%), var(--surface3)', border: '1px dashed rgba(var(--orange-ch),0.35)',
                    borderRadius: 'var(--radius-lg)', padding: '1.15rem 0.75rem', cursor: 'pointer',
                    fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-xs)',
                    letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)',
                    minHeight: '178px',
                  }}
                >
                  <div style={{ fontSize: '28px', lineHeight: 1, color: 'var(--orange)', marginBottom: '8px' }}>+</div>
                  Athlete B
                </button>
              )}
              {profileB && (
                <button
                  onClick={() => setSearchSlot('b')}
                  style={{
                    display: 'block', margin: '6px auto 0', background: 'none', border: 'none',
                    color: 'var(--muted)', fontFamily: 'var(--body)', fontSize: 'var(--text-xs)',
                    cursor: 'pointer', textDecoration: 'underline',
                  }}
                >
                  Change
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats comparison — only show when both profiles loaded */}
        {aIsAthleteRow && bIsAthleteRow && (
          <div style={{ ...PANEL, padding: '1rem' }}>
            <div style={{ ...SECTION_KICKER, marginBottom: '0.75rem', textAlign: 'center' }}>
              Stats Board
            </div>

            {/* Overview stats */}
            <StatRow
              label="Races"
              a={rA.length}
              b={rB.length}
              better={rA.length > rB.length ? 'a' : rB.length > rA.length ? 'b' : 'tie'}
            />
            <StatRow
              label="Countries"
              a={countCountries(rA)}
              b={countCountries(rB)}
              better={countCountries(rA) > countCountries(rB) ? 'a' : countCountries(rB) > countCountries(rA) ? 'b' : 'tie'}
            />
            <StatRow
              label="Marathons"
              a={countDistance(rA, 'marathon')}
              b={countDistance(rB, 'marathon')}
              better={null}
            />

            {/* PB rows — grouped by distance, only for distances either athlete has run */}
            {(() => {
              const rows = COMPARE_DISTS.map(d => {
                const tA = bestTime(rA, d.norm)
                const tB = bestTime(rB, d.norm)
                if (!tA && !tB) return null
                const sA = parseHMS(tA ?? undefined)
                const sB = parseHMS(tB ?? undefined)
                const better = sA != null && sB != null
                  ? (sA < sB ? 'a' : sB < sA ? 'b' : 'tie')
                  : null
                return (
                  <StatRow
                    key={d.norm}
                    label={`${d.label} PB`}
                    a={tA}
                    b={tB}
                    better={better as 'a' | 'b' | 'tie' | null}
                  />
                )
              }).filter(Boolean)
              if (rows.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '0.75rem 0', fontFamily: 'var(--body)', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                    No shared distances to compare yet.
                  </div>
                )
              }
              return (
                <>
                  <div style={{ ...SECTION_KICKER, marginTop: '0.75rem', marginBottom: '0.25rem' }}>
                    Personal Bests
                  </div>
                  {rows}
                </>
              )
            })()}
          </div>
        )}

        {/* Share button */}
        {usernameA && usernameB && (
          <button
            onClick={copyLink}
            style={{
              width: '100%', background: copied ? 'rgba(var(--green-ch),0.12)' : 'linear-gradient(180deg, rgba(var(--orange-ch),0.16) 0%, rgba(var(--orange-ch),0.06) 100%), var(--surface2)',
              border: `1px solid ${copied ? 'rgba(var(--green-ch),0.34)' : 'rgba(var(--orange-ch),0.28)'}`, borderRadius: 'var(--radius-lg)',
              padding: 'var(--sp-3)', fontFamily: 'var(--headline)', fontWeight: 900,
              fontSize: 'var(--text-xs)', letterSpacing: '0.1em', textTransform: 'uppercase',
              color: copied ? 'var(--green)' : 'var(--white)', cursor: 'pointer',
              transition: 'all 0.15s', boxShadow: copied ? '0 12px 24px rgba(var(--green-ch),0.1)' : '0 16px 28px rgba(var(--orange-ch),0.08)',
            }}
          >
            {copied ? '✓ Link Copied!' : '↑ Share Comparison'}
          </button>
        )}
      </div>

      {/* Username search sheet */}
      {searchSlot && (
        <SearchSheet
          placeholder={searchSlot === 'a' ? 'Compare with...' : 'Compare against...'}
          onSelect={u => handleSelectUser(searchSlot, u)}
          onClose={() => setSearchSlot(null)}
        />
      )}
    </div>
  )
}

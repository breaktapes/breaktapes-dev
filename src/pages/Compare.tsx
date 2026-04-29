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

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseHMS(str: string | undefined): number | null {
  if (!str) return null
  const p = str.trim().split(':').map(Number)
  if (p.some(isNaN)) return null
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2]
  if (p.length === 2) return p[0] * 60 + p[1]
  return null
}

const DIST_KM: Record<string, number> = {
  marathon: 42.195, 'full marathon': 42.195,
  'half marathon': 21.0975, half: 21.0975,
  ironman: 226, '70.3': 113,
  '5k': 5, '10k': 10,
}

function distToKm(d: string | undefined): number {
  if (!d) return 0
  const n = parseFloat(d)
  if (!isNaN(n)) return n
  return DIST_KM[d.toLowerCase().trim()] ?? 0
}


function normDist(d: string | undefined): string {
  const km = distToKm(d)
  if (!km) return d?.toLowerCase() ?? ''
  if (km >= 42 && km <= 42.3) return 'marathon'
  if (km >= 21 && km <= 21.2) return 'half'
  if (km >= 113 && km <= 114) return '70.3'
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
  const { data, error } = await supabase
    .from('user_state')
    .select('races, athlete, username, is_public')
    .eq('username', username)
    .limit(1)
    .single()

  if (error || !data) return 'not_found'
  if (!data.is_public) return 'private'

  const athlete = data.athlete as Record<string, unknown> ?? {}
  const races: PublicRace[] = (data.races as PublicRace[] ?? []).filter((r: PublicRace) => r.time) // only races with results

  return {
    username: data.username,
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
  { label: '70.3', norm: '70.3' },
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
        fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '16px',
        letterSpacing: '0.02em', color: better === 'a' ? 'var(--orange)' : 'var(--white)',
        textAlign: 'right',
      }}>
        {a ?? '—'}
      </div>
      <div style={{
        fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '9px',
        letterSpacing: '0.12em', textTransform: 'uppercase',
        color: 'var(--muted)', textAlign: 'center', whiteSpace: 'nowrap',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '16px',
        letterSpacing: '0.02em', color: better === 'b' ? 'var(--orange)' : 'var(--white)',
      }}>
        {b ?? '—'}
      </div>
    </div>
  )
}

function ProfileColumn({ profile }: { profile: AthleteRow | 'private' | 'not_found' | null; }) {
  if (!profile) return <div style={{ flex: 1 }} />

  if (profile === 'private') {
    return (
      <div style={{ flex: 1, padding: '1rem', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--body)', fontSize: '13px' }}>
        🔒 Profile is private
      </div>
    )
  }

  if (profile === 'not_found') {
    return (
      <div style={{ flex: 1, padding: '1rem', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--body)', fontSize: '13px' }}>
        Athlete not found
      </div>
    )
  }

  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || `@${profile.username}`
  const initials = (profile.firstName?.[0] ?? '') + (profile.lastName?.[0] ?? '') || profile.username[0].toUpperCase()
  const loc = [profile.city, profile.country].filter(Boolean).join(', ')

  return (
    <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
      <div style={{
        width: '48px', height: '48px', borderRadius: '50%',
        background: 'var(--surface3)', border: '2px solid var(--orange)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 8px', fontFamily: 'var(--headline)', fontWeight: 900,
        fontSize: '18px', color: 'var(--white)',
      }}>
        {initials}
      </div>
      <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '15px', letterSpacing: '0.04em', color: 'var(--white)', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </div>
      <div style={{ fontFamily: 'var(--body)', fontSize: '11px', color: 'var(--muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        @{profile.username}
      </div>
      {loc && (
        <div style={{ fontFamily: 'var(--body)', fontSize: '11px', color: 'var(--muted)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {loc}
        </div>
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
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      zIndex: 1000, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }} onClick={onClose}>
      <div
        style={{ background: 'var(--surface2)', borderRadius: '16px 16px 0 0', padding: '1.25rem 1rem 2rem' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '0.75rem' }}>
          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            {placeholder}
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '18px', cursor: 'pointer', padding: '4px 8px', lineHeight: 1 }}>✕</button>
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
            style={{
              flex: 1, background: 'var(--surface3)', border: '1px solid var(--border2)',
              borderRadius: '8px', padding: '10px 12px',
              fontFamily: 'var(--body)', fontSize: '14px', color: 'var(--white)', outline: 'none',
            }}
          />
          <button
            onClick={() => { if (q.trim()) { onSelect(q.trim().replace(/^@/, '')); onClose() } }}
            style={{
              background: 'var(--orange)', color: 'var(--black)', border: 'none',
              borderRadius: '8px', padding: '10px 16px',
              fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '12px',
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
      minHeight: '100dvh', background: 'var(--surface)',
      paddingBottom: 'env(safe-area-inset-bottom, 16px)',
    }}>
      {/* Back button */}
      <div style={{ padding: '1rem 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: 'none', color: 'var(--muted)',
            fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '12px',
            letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', padding: 0,
          }}
        >
          ← Back
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          Compare
        </div>
      </div>

      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Athlete headers */}
        <div style={{
          background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px',
          padding: '1rem',
        }}>
          {/* Instructional state — no params yet */}
          {!usernameA && !usernameB && (
            <div style={{ textAlign: 'center', padding: '1rem 0 0.5rem' }}>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--white)', marginBottom: '6px' }}>
                Compare Two Athletes
              </div>
              <div style={{ fontFamily: 'var(--body)', fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>
                Search for two athletes below to compare personal bests, race counts, and countries raced.
              </div>
            </div>
          )}
          {/* Same username guard */}
          {usernameA && usernameB && usernameA.toLowerCase() === usernameB.toLowerCase() && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--body)', fontSize: '13px', marginBottom: '1rem' }}>
              Can't compare an athlete to themselves.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.5rem', alignItems: 'center' }}>
            {/* Athlete A */}
            <div>
              {loadA === 'loading' ? (
                <div style={{ textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--body)', fontSize: '12px' }}>Loading...</div>
              ) : profileA ? (
                <ProfileColumn profile={profileA} />
              ) : (
                <button
                  onClick={() => setSearchSlot('a')}
                  style={{
                    width: '100%', background: 'var(--surface3)', border: '1px dashed var(--border2)',
                    borderRadius: '8px', padding: '1rem 0.5rem', cursor: 'pointer',
                    fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '11px',
                    letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)',
                  }}
                >
                  + Athlete A
                </button>
              )}
              {profileA && (
                <button
                  onClick={() => setSearchSlot('a')}
                  style={{
                    display: 'block', margin: '6px auto 0', background: 'none', border: 'none',
                    color: 'var(--muted)', fontFamily: 'var(--body)', fontSize: '11px',
                    cursor: 'pointer', textDecoration: 'underline',
                  }}
                >
                  Change
                </button>
              )}
            </div>

            {/* VS divider */}
            <div style={{
              fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '22px',
              color: 'var(--orange)', letterSpacing: '0.04em',
            }}>
              VS
            </div>

            {/* Athlete B */}
            <div>
              {loadB === 'loading' ? (
                <div style={{ textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--body)', fontSize: '12px' }}>Loading...</div>
              ) : profileB ? (
                <ProfileColumn profile={profileB} />
              ) : (
                <button
                  onClick={() => setSearchSlot('b')}
                  style={{
                    width: '100%', background: 'var(--surface3)', border: '1px dashed var(--border2)',
                    borderRadius: '8px', padding: '1rem 0.5rem', cursor: 'pointer',
                    fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '11px',
                    letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)',
                  }}
                >
                  + Athlete B
                </button>
              )}
              {profileB && (
                <button
                  onClick={() => setSearchSlot('b')}
                  style={{
                    display: 'block', margin: '6px auto 0', background: 'none', border: 'none',
                    color: 'var(--muted)', fontFamily: 'var(--body)', fontSize: '11px',
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
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem' }}>
            <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.75rem', textAlign: 'center' }}>
              Stats
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
                  <div style={{ textAlign: 'center', padding: '0.75rem 0', fontFamily: 'var(--body)', fontSize: '12px', color: 'var(--muted)' }}>
                    No shared distances to compare yet.
                  </div>
                )
              }
              return (
                <>
                  <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: '0.75rem', marginBottom: '0.25rem' }}>
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
              width: '100%', background: copied ? 'var(--surface3)' : 'var(--surface2)',
              border: '1px solid var(--border2)', borderRadius: '10px',
              padding: '12px', fontFamily: 'var(--headline)', fontWeight: 900,
              fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase',
              color: copied ? 'var(--green)' : 'var(--white)', cursor: 'pointer',
              transition: 'all 0.15s',
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

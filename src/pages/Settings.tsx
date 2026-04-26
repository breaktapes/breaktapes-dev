import { useState, useEffect } from 'react'
import { useClerk } from '@clerk/clerk-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { useRaceStore } from '@/stores/useRaceStore'
import { useWearableStore } from '@/stores/useWearableStore'
import { supabase } from '@/lib/supabase'
import { startStravaOAuth } from '@/lib/strava'
import { removeWearableToken } from '@/lib/wearableUtils'
import { THEMES } from '@/types'
import type { ThemeId } from '@/types'
import { APP_URL } from '@/env'

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

const sectionLabel: React.CSSProperties = {
  fontFamily: 'var(--headline)',
  fontWeight: 900,
  fontSize: 'var(--text-xs)',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  marginBottom: '0.75rem',
}

export function Settings() {
  const { signOut, openUserProfile } = useClerk()
  const authUser = useAuthStore(s => s.authUser)
  const athlete = useAthleteStore(s => s.athlete)
  const updateAthlete = useAthleteStore(s => s.updateAthlete)

  const stravaToken = useWearableStore(s => s.stravaToken)
  const clearToken  = useWearableStore(s => s.clearToken)
  const races = useRaceStore(s => s.races)
  const upcomingRaces = useRaceStore(s => s.upcomingRaces)
  const nextRace = useRaceStore(s => s.nextRace)

  const [accountExpanded, setAccountExpanded] = useState(false)

  const [activeTheme, setActiveTheme] = useState<ThemeId>(
    () => (localStorage.getItem('bt_theme') as ThemeId) || 'carbon'
  )

  // Public profile state
  const [isPublic, setIsPublic] = useState(athlete?.isPublic ?? false)

  // Keep local state in sync if athlete loads after mount
  useEffect(() => {
    setIsPublic(athlete?.isPublic ?? false)
  }, [athlete?.isPublic])

  async function togglePublic(val: boolean) {
    if (!athlete || (!athlete.username && val)) return // must have username first
    setIsPublic(val)
    if (!authUser) return
    updateAthlete({ isPublic: val })
    // Read existing state_json, merge in current athlete/race data, then upsert.
    // This ensures the Worker can render the full profile on first enable.
    // .maybeSingle() returns null on 0 rows instead of erroring, so the very
    // first toggle (no row yet) still proceeds to the upsert.
    const { data: existing } = await supabase
      .from('user_state')
      .select('state_json')
      .eq('user_id', authUser.id)
      .maybeSingle()
    const current = (existing?.state_json as Record<string, unknown> | null) ?? {}
    await supabase.from('user_state').upsert({
      user_id: authUser.id,
      username: athlete.username,
      is_public: val,
      state_json: {
        ...current,
        races,
        upcoming_races: upcomingRaces,
        next_race: nextRace,
        athlete: { ...(current.athlete as Record<string, unknown> ?? {}), ...athlete, isPublic: val },
      },
    }, { onConflict: 'user_id' })
  }

  function applyTheme(themeId: ThemeId) {
    document.documentElement.dataset.theme = themeId
    localStorage.setItem('bt_theme', themeId)
    setActiveTheme(themeId)
  }

  async function handleSignOut() {
    localStorage.removeItem('bt_new_user')
    localStorage.removeItem('bt_modal_shown')
    await signOut()
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
        Settings
      </h1>

      {/* ── Auth section ── */}
      <section>
        <p style={sectionLabel}>Account</p>
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          {/* Profile card row — tap to expand */}
          <button
            onClick={() => setAccountExpanded(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              width: '100%', background: 'transparent', border: 'none',
              cursor: 'pointer', padding: '14px 16px', textAlign: 'left',
            }}
          >
            <div style={{
              width: '42px', height: '42px', borderRadius: '50%',
              background: 'var(--orange)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--headline)', fontWeight: 900,
              fontSize: '15px', color: 'var(--black)',
              flexShrink: 0, letterSpacing: '0.04em',
            }}>
              {[athlete?.firstName?.[0], athlete?.lastName?.[0]].filter(Boolean).join('').toUpperCase() ||
               authUser?.email?.[0]?.toUpperCase() || '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                color: 'var(--white)', fontSize: '15px',
                fontWeight: 600, lineHeight: 1.25,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {[athlete?.firstName, athlete?.lastName].filter(Boolean).join(' ') ||
                 authUser?.email || '—'}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '2px' }}>
                {authUser?.email}
              </div>
            </div>
            <svg
              width="12" height="12" viewBox="0 0 12 12" fill="none"
              style={{ flexShrink: 0, opacity: 0.35, transition: 'transform 0.2s', transform: accountExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {accountExpanded && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '8px 12px 12px' }}>
              <button
                onClick={() => { setAccountExpanded(false); openUserProfile() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  width: '100%', background: 'transparent', border: 'none',
                  cursor: 'pointer', padding: '10px 4px', textAlign: 'left',
                  color: 'var(--white)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.6, flexShrink: 0 }}>
                  <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>Manage account</span>
              </button>
              <div style={{ height: '1px', background: 'var(--border)', margin: '0 4px' }} />
              <button
                onClick={() => { setAccountExpanded(false); handleSignOut() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  width: '100%', background: 'transparent', border: 'none',
                  cursor: 'pointer', padding: '10px 4px', textAlign: 'left',
                  color: 'var(--orange)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  <path d="M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Public Profile section ── */}
      <section>
        <p style={sectionLabel}>Public Profile</p>
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '0' }}>

          {/* Public toggle row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0 14px' }}>
            <div>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--white)', fontWeight: 600 }}>Make profile public</p>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
                {athlete?.username ? `${APP_URL}/u/${athlete.username}` : 'Set a username in account settings first'}
              </p>
            </div>
            <button
              onClick={() => togglePublic(!isPublic)}
              disabled={!athlete?.username}
              style={{
                width: '48px', height: '28px',
                borderRadius: '14px',
                border: 'none',
                cursor: athlete?.username ? 'pointer' : 'not-allowed',
                background: isPublic ? 'var(--green)' : 'var(--surface3)',
                position: 'relative',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute',
                top: '3px',
                left: isPublic ? '23px' : '3px',
                width: '22px', height: '22px',
                borderRadius: '50%',
                background: 'var(--black)',
                transition: 'left 0.2s',
              }} />
            </button>
          </div>

          {/* Copy link */}
          {athlete?.isPublic && athlete?.username && (
            <button
              style={{ ...btnGhost, fontSize: '12px', padding: '0.6rem 1rem', marginBottom: '14px' }}
              onClick={() => navigator.clipboard.writeText(`${APP_URL}/u/${athlete.username}`)}
            >
              Copy Profile Link
            </button>
          )}

          {/* Visibility controls — only shown when public */}
          {isPublic && (
            <>
              <div style={{ height: '1px', background: 'var(--border)', marginBottom: '14px' }} />
              <p style={{ margin: '0 0 10px', fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--headline)', fontWeight: 700 }}>
                What to show on your profile
              </p>
              {([
                { key: 'races',     label: 'Race history & finish times', desc: 'All logged races and results' },
                { key: 'pbs',       label: 'Personal bests',              desc: 'Your PR grid per distance' },
                { key: 'medals',    label: 'Medal wall',                  desc: 'Photos and medal collection' },
                { key: 'stats',     label: 'Stats & countries',           desc: 'Race count, distance, countries' },
                { key: 'upcoming',  label: 'Upcoming races',              desc: 'Your race calendar' },
                { key: 'wearables', label: 'Activity feed',               desc: 'Strava & wearable workouts' },
              ] as const).map(({ key, label, desc }, i, arr) => {
                const vis = athlete?.profileVisibility ?? {}
                const defaultOn = key !== 'upcoming' && key !== 'wearables'
                const enabled = vis[key] ?? defaultOn
                return (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                      <div style={{ minWidth: 0, flex: 1, paddingRight: '12px' }}>
                        <p style={{ margin: 0, fontSize: '14px', color: 'var(--white)', fontWeight: 500 }}>{label}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--muted)' }}>{desc}</p>
                      </div>
                      <button
                        onClick={() => updateAthlete({ profileVisibility: { ...vis, [key]: !enabled } })}
                        style={{
                          width: '42px', height: '24px',
                          borderRadius: '12px', border: 'none',
                          cursor: 'pointer',
                          background: enabled ? 'var(--orange)' : 'var(--surface3)',
                          position: 'relative', transition: 'background 0.2s',
                          flexShrink: 0,
                        }}
                      >
                        <span style={{
                          position: 'absolute', top: '3px',
                          left: enabled ? '20px' : '3px',
                          width: '18px', height: '18px',
                          borderRadius: '50%', background: 'var(--black)',
                          transition: 'left 0.2s',
                        }} />
                      </button>
                    </div>
                    {i < arr.length - 1 && <div style={{ height: '1px', background: 'var(--border)' }} />}
                  </div>
                )
              })}
            </>
          )}
        </div>
      </section>

      {/* ── Preferences section ── */}
      <section>
        <p style={sectionLabel}>Preferences</p>
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Units toggle */}
          <div>
            <p style={{ margin: '0 0 10px', fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '13px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--white)' }}>
              Units
            </p>
            <p style={{ margin: '0 0 10px', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
              Distances, paces, and speeds across the app
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {(['metric', 'imperial'] as const).map(u => {
                const active = (athlete?.units ?? 'metric') === u
                return (
                  <button
                    key={u}
                    onClick={() => updateAthlete({ units: u })}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: active ? '2px solid var(--orange)' : '1px solid var(--border2)',
                      background: active ? 'rgba(var(--orange-ch),0.1)' : 'var(--surface3)',
                      cursor: 'pointer',
                      textAlign: 'center' as const,
                    }}
                  >
                    <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase', color: active ? 'var(--orange)' : 'var(--white)' }}>
                      {u === 'metric' ? '🌍 Metric' : '🇺🇸 Imperial'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px' }}>
                      {u === 'metric' ? 'km · min/km' : 'mi · min/mi'}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Theme section ── */}
      <section>
        <p style={sectionLabel}>Theme</p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.5rem',
        }}>
          {THEMES.map(theme => {
            const isActive = activeTheme === theme.id
            return (
              <button
                key={theme.id}
                onClick={() => theme.comingSoon ? undefined : applyTheme(theme.id)}
                disabled={theme.comingSoon}
                style={{
                  height: '80px',
                  background: 'var(--surface2)',
                  border: isActive ? '2px solid var(--orange)' : '1px solid var(--border)',
                  borderRadius: '8px',
                  cursor: theme.comingSoon ? 'default' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '0.5rem',
                  opacity: theme.comingSoon ? 0.45 : 1,
                  position: 'relative',
                }}
              >
                <span style={{
                  fontFamily: 'var(--headline)',
                  fontWeight: 900,
                  fontSize: 'var(--text-xs)',
                  color: isActive ? 'var(--orange)' : 'var(--white)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  lineHeight: 1.2,
                }}>
                  {theme.label}
                </span>
                {theme.comingSoon && (
                  <span style={{
                    fontSize: '9px',
                    fontFamily: 'var(--headline)',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                    background: 'rgba(245,245,245,0.06)',
                    padding: '1px 5px',
                    borderRadius: '3px',
                  }}>
                    SOON
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Wearables section ── */}
      <section>
        <p style={sectionLabel}>Wearables</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

          {/* Strava */}
          <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--white)' }}>Strava</p>
              <p style={{ margin: '3px 0 0', fontSize: 'var(--text-xs)', color: stravaToken ? 'var(--green)' : 'var(--muted)' }}>
                {stravaToken ? '● Connected' : 'Activities & segment data'}
              </p>
            </div>
            {stravaToken ? (
              <button
                style={{ ...btnGhost, padding: '0.5rem 1rem', whiteSpace: 'nowrap', flexShrink: 0, fontSize: '12px' }}
                onClick={async () => { await removeWearableToken('strava'); clearToken('strava') }}
              >Disconnect</button>
            ) : (
              <button
                style={{ ...btnMain, padding: '0.5rem 1rem', whiteSpace: 'nowrap', flexShrink: 0 }}
                onClick={startStravaOAuth}
              >Connect</button>
            )}
          </div>

          {/* Coming soon placeholder */}
          <div style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border2)',
            borderRadius: '12px',
            padding: '32px 24px',
            textAlign: 'center',
          }}>
            <p style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '16px', letterSpacing: '0.08em', color: 'var(--muted)', textTransform: 'uppercase', margin: 0 }}>
              Wearable Integrations
            </p>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '8px', fontFamily: 'var(--body)' }}>
              WHOOP · Garmin · Apple Health — coming soon
            </p>
          </div>

        </div>
      </section>

      {/* ── About section ── */}
      <section>
        <p style={sectionLabel}>About</p>
        <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Version
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 'var(--text-sm)', color: 'var(--white)', fontFamily: 'var(--headline)', fontWeight: 700 }}>
              v1.0.0
            </p>
          </div>
          <a
            href="#"
            style={{
              ...btnGhost,
              textDecoration: 'none',
              display: 'inline-block',
              fontSize: 'var(--text-xs)',
            }}
          >
            GitHub
          </a>
        </div>
      </section>
    </div>
  )
}

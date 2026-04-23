import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/useAuthStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
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

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface3)',
  border: '1px solid var(--border2)',
  borderRadius: '6px',
  color: 'var(--white)',
  fontSize: 'var(--text-sm)',
  padding: '0.6rem 0.75rem',
  fontFamily: 'var(--body)',
  boxSizing: 'border-box',
}

export function Settings() {
  const navigate = useNavigate()
  const authUser = useAuthStore(s => s.authUser)
  const proAccessGranted = useAuthStore(s => s.proAccessGranted)
  const athlete = useAthleteStore(s => s.athlete)
  const updateAthlete = useAthleteStore(s => s.updateAthlete)

  const stravaToken = useWearableStore(s => s.stravaToken)
  const clearToken  = useWearableStore(s => s.clearToken)

  const [activeTheme, setActiveTheme] = useState<ThemeId>(
    () => (localStorage.getItem('bt_theme') as ThemeId) || 'carbon'
  )

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function handleDeleteAccount() {
    if (deleteInput.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('Type DELETE (all caps) to confirm.')
      return
    }
    setDeleting(true)
    setDeleteError('')
    try {
      const { error } = await supabase.rpc('delete_my_account', { confirm_text: 'DELETE' })
      if (error) throw error
      const keysToRemove = ['bt_new_user', 'bt_modal_shown', 'fl2_races', 'fl2_ath',
        'fl2_upcoming', 'fl2_wishlist', 'fl2_season_plans', 'fl2_focus_race_id',
        'fl2_apikey', 'bt_theme', 'fl2_dash_layout', 'fl2_dash_zone_collapse']
      keysToRemove.forEach(k => localStorage.removeItem(k))
      setTimeout(() => window.location.reload(), 500)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete account. Try again.')
      setDeleting(false)
    }
  }

  // Username + public profile state
  const [username, setUsername] = useState(athlete?.username ?? '')
  const [isPublic, setIsPublic] = useState(athlete?.isPublic ?? false)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [usernameSaving, setUsernameSaving] = useState(false)
  const [usernameSaved, setUsernameSaved] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Username lock: locked for 1 year after first set
  const isUsernameLocked = useMemo(() => {
    if (!athlete?.username || !athlete?.usernameSetAt) return false
    const setAt = new Date(athlete.usernameSetAt).getTime()
    return Date.now() - setAt < 365 * 24 * 60 * 60 * 1000
  }, [athlete?.username, athlete?.usernameSetAt])

  const usernameUnlockDate = useMemo(() => {
    if (!athlete?.usernameSetAt) return null
    const d = new Date(new Date(athlete.usernameSetAt).getTime() + 365 * 24 * 60 * 60 * 1000)
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  }, [athlete?.usernameSetAt])

  // Keep local state in sync if athlete loads after mount
  useEffect(() => {
    setUsername(athlete?.username ?? '')
    setIsPublic(athlete?.isPublic ?? false)
  }, [athlete?.username, athlete?.isPublic])

  const RESERVED_USERNAMES = ['admin','api','u','health','og','support','help','breaktapes','www','app','dev','staging','blog','mail','static','assets','worker']

  function validateUsername(v: string): boolean {
    return /^[a-z0-9_]{3,20}$/.test(v)
  }

  function onUsernameChange(v: string) {
    const lower = v.toLowerCase().replace(/[^a-z0-9_]/g, '')
    setUsername(lower)
    setUsernameSaved(false)
    if (!lower) { setUsernameStatus('idle'); return }
    if (!validateUsername(lower)) { setUsernameStatus('invalid'); return }
    if (RESERVED_USERNAMES.includes(lower)) { setUsernameStatus('taken'); return }
    setUsernameStatus('checking')
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('user_state')
        .select('username')
        .eq('username', lower)
        .single()
      // If it matches the current saved username, it's "available" for the user to keep
      if (data && data.username !== athlete?.username) {
        setUsernameStatus('taken')
      } else {
        setUsernameStatus('available')
      }
    }, 400)
  }

  async function saveUsername() {
    if (!authUser || usernameSaving) return
    if (isUsernameLocked) return  // blocked for 1 year
    if (username && !validateUsername(username)) return
    if (usernameStatus === 'checking') return  // async availability check still in flight
    setUsernameSaving(true)
    try {
      const isNewUsername = username && username !== athlete?.username
      const now = new Date().toISOString()
      const patch = {
        username: username || undefined,
        isPublic,
        ...(isNewUsername ? { usernameSetAt: now } : {}),
      }
      updateAthlete(patch)
      const { data: existing } = await supabase
        .from('user_state')
        .select('state_json')
        .eq('user_id', authUser.id)
        .single()
      const current = existing?.state_json ?? {}
      await supabase.from('user_state').upsert({
        user_id: authUser.id,
        username: username || null,
        is_public: isPublic,
        state_json: { ...current, athlete: { ...(current.athlete ?? {}), ...patch } },
      }, { onConflict: 'user_id' })
      setUsernameSaved(true)
      setUsernameStatus('idle')
    } catch {
      // silent — local store is updated
    } finally {
      setUsernameSaving(false)
    }
  }

  async function togglePublic(val: boolean) {
    if (!athlete?.username && val) return // must have username first
    setIsPublic(val)
    if (!authUser) return
    updateAthlete({ isPublic: val })
    await supabase.from('user_state').upsert({
      user_id: authUser.id,
      is_public: val,
    }, { onConflict: 'user_id' })
  }

  function applyTheme(themeId: ThemeId, isPro: boolean) {
    if (isPro && !proAccessGranted) {
      alert('Pro feature — upgrade to unlock this theme.')
      return
    }
    document.documentElement.dataset.theme = themeId
    localStorage.setItem('bt_theme', themeId)
    setActiveTheme(themeId)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
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
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', margin: 0 }}>
            Signed in as{' '}
            <span style={{ color: 'var(--white)', fontWeight: 600 }}>
              {authUser?.email ?? '—'}
            </span>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              style={{ ...btnGhost, width: '100%' }}
              onClick={() => console.log('Change password')}
            >
              Change Password
            </button>
            <button
              style={{ ...btnGhost, width: '100%', color: 'var(--orange)', borderColor: 'var(--orange)' }}
              onClick={handleSignOut}
            >
              Sign Out
            </button>
            {/* Delete account — inline confirmation */}
            {!showDeleteConfirm ? (
              <button
                style={{ ...btnGhost, width: '100%', color: '#ff6b6b', borderColor: 'rgba(255,107,107,0.3)', fontSize: '12px', padding: '0.55rem 1rem' }}
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete Account
              </button>
            ) : (
              <div style={{ border: '1px solid rgba(255,107,107,0.3)', borderRadius: '6px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#ff8e8e', lineHeight: 1.5 }}>
                  This permanently removes your account, races, and all synced data. Type <strong>DELETE</strong> to confirm.
                </p>
                <input
                  style={{ ...inputStyle, borderColor: 'rgba(255,107,107,0.4)' }}
                  value={deleteInput}
                  onChange={e => { setDeleteInput(e.target.value); setDeleteError('') }}
                  placeholder="DELETE"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                />
                {deleteError && (
                  <p style={{ margin: 0, fontSize: '11px', color: '#ff6b6b' }}>{deleteError}</p>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    style={{ ...btnGhost, flex: 1, fontSize: '12px', padding: '0.55rem' }}
                    onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); setDeleteError('') }}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    style={{ ...btnGhost, flex: 1, fontSize: '12px', padding: '0.55rem', color: '#ff6b6b', borderColor: 'rgba(255,107,107,0.4)', background: 'rgba(255,107,107,0.08)' }}
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting…' : 'Delete Permanently'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Profile section ── */}
      <section>
        <p style={sectionLabel}>Profile</p>
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

          {/* Username field */}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px', fontFamily: 'var(--headline)', fontWeight: 700 }}>
              Username
            </label>
            {isUsernameLocked ? (
              /* Locked state — username set, within 1-year window */
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--surface3)',
                  border: '1px solid var(--border2)',
                  borderRadius: '8px',
                  padding: '0.6rem 0.75rem',
                }}>
                  <span style={{ color: 'var(--muted)', fontSize: '14px' }}>@</span>
                  <span style={{ flex: 1, color: 'var(--white)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>{username}</span>
                  <span style={{ fontSize: '14px' }}>🔒</span>
                </div>
                <p style={{ margin: '5px 0 0', fontSize: '11px', color: 'var(--muted)', lineHeight: 1.5 }}>
                  Username is locked until <span style={{ color: 'var(--white)' }}>{usernameUnlockDate}</span>.
                </p>
              </div>
            ) : (
              /* Editable state */
              <div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '14px', pointerEvents: 'none' }}>@</span>
                    <input
                      style={{ ...inputStyle, paddingLeft: '24px' }}
                      value={username}
                      onChange={e => onUsernameChange(e.target.value)}
                      placeholder="yourname"
                      maxLength={20}
                      autoCapitalize="none"
                      autoCorrect="off"
                    />
                  </div>
                  <button
                    style={{
                      ...btnMain,
                      padding: '0 16px',
                      opacity: (usernameStatus === 'taken' || usernameStatus === 'invalid' || usernameSaving) ? 0.5 : 1,
                      flexShrink: 0,
                    }}
                    onClick={saveUsername}
                    disabled={usernameStatus === 'taken' || usernameStatus === 'invalid' || usernameSaving}
                  >
                    {usernameSaving ? '…' : usernameSaved ? '✓' : 'Save'}
                  </button>
                </div>
                {usernameStatus === 'checking' && (
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--muted)' }}>Checking availability…</p>
                )}
                {usernameStatus === 'available' && (
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--green)' }}>✓ Available</p>
                )}
                {usernameStatus === 'taken' && (
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#ff6b6b' }}>Already taken</p>
                )}
                {usernameStatus === 'invalid' && (
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#ff6b6b' }}>3–20 chars, lowercase letters, numbers, underscores only</p>
                )}
                {athlete?.username && !isUsernameLocked && (
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
                    Once saved, your username will be locked for 1 year.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Public profile toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--white)', fontWeight: 600 }}>Public Profile</p>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
                {athlete?.username ? `${APP_URL}/u/${athlete.username}` : 'Set a username first'}
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

          {/* Profile link + copy if public */}
          {athlete?.isPublic && athlete?.username && (
            <button
              style={{ ...btnGhost, fontSize: '12px', padding: '0.6rem 1rem' }}
              onClick={() => {
                navigator.clipboard.writeText(`${APP_URL}/u/${athlete.username}`)
              }}
            >
              Copy Profile Link
            </button>
          )}

          <button style={{ ...btnMain, alignSelf: 'flex-start' }} onClick={() => navigate('/you')}>
            Edit Profile
          </button>
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
            const isLocked = theme.pro && !proAccessGranted
            return (
              <button
                key={theme.id}
                onClick={() => theme.comingSoon ? undefined : applyTheme(theme.id, theme.pro)}
                disabled={theme.comingSoon}
                style={{
                  height: '80px',
                  background: 'var(--surface2)',
                  border: isActive
                    ? '2px solid var(--orange)'
                    : '1px solid var(--border)',
                  borderRadius: '8px',
                  cursor: theme.comingSoon ? 'default' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '0.5rem',
                  opacity: (isLocked || theme.comingSoon) ? 0.45 : 1,
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
                {theme.comingSoon ? (
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
                ) : theme.pro && (
                  <span style={{
                    fontSize: '9px',
                    fontFamily: 'var(--headline)',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--orange)',
                    background: 'rgba(var(--orange-ch),0.12)',
                    padding: '1px 5px',
                    borderRadius: '3px',
                  }}>
                    PRO
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

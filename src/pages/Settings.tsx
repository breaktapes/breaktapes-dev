import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useClerk, useUser } from '@clerk/clerk-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { useRaceStore } from '@/stores/useRaceStore'
import { useWearableStore } from '@/stores/useWearableStore'
import { syncStateToSupabase, resetRemotePullGate } from '@/lib/syncState'
import { getClerkToken } from '@/lib/supabase'
import { THEMES } from '@/types'
import type { ThemeId } from '@/types'
import { useThemeStore } from '@/stores/useThemeStore'
import { APP_URL, APP_VERSION } from '@/env'
import { posthog } from '@/lib/posthog'

const btnGhost: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--white)',
  border: '1px solid var(--border2)',
  borderRadius: 'var(--radius-xs)',
  padding: '0.8rem 1.25rem',
  fontFamily: 'var(--headline)',
  fontWeight: 900,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontSize: 'var(--text-sm)',
}

const card: React.CSSProperties = {
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
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
  const { user: clerkUser } = useUser()
  const authUser = useAuthStore(s => s.authUser)
  const syncStatus = useAuthStore(s => s.syncStatus)
  const hasProAccess = useAuthStore(s => s.proAccessGranted)
  const athlete = useAthleteStore(s => s.athlete)
  const updateAthlete = useAthleteStore(s => s.updateAthlete)

  const [accountExpanded, setAccountExpanded] = useState(false)
  const [copyToast, setCopyToast] = useState(false)
  function showCopyToast() { setCopyToast(true); setTimeout(() => setCopyToast(false), 2500) }

  // Manual "Restore from server" — PULL-ONLY recovery. Re-runs the sync-state
  // query (useSyncState), which fetches /api/state and merges the server copy
  // into local via applyRemoteSafe. It never writes to the server, so it can
  // only ever restore data, never overwrite it. Safety net for the rare case
  // where a client shows empty while the server holds the user's real data.
  const queryClient = useQueryClient()
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  async function handleManualSync() {
    if (!authUser || syncing) return
    setSyncing(true)
    setSyncMsg(null)
    try {
      await queryClient.refetchQueries({ queryKey: ['sync-state', authUser.id] })
      const n = useRaceStore.getState().races.length
      setSyncMsg(
        n > 0
          ? `Restored ${n} race${n === 1 ? '' : 's'} from the server.`
          : 'No saved data found on the server for this account.',
      )
      posthog.capture('manual sync', { races_restored: n })
    } catch {
      setSyncMsg('Sync failed — check your connection and try again.')
    } finally {
      setSyncing(false)
    }
  }

  const activeTheme = useThemeStore(s => s.theme)
  const storeSetTheme = useThemeStore(s => s.setTheme)

  // Public profile state
  const [isPublic, setIsPublic] = useState(athlete?.isPublic ?? false)

  // Keep local state in sync if athlete loads after mount
  useEffect(() => {
    setIsPublic(athlete?.isPublic ?? false)
  }, [athlete?.isPublic])

  async function togglePublic(val: boolean) {
    if (!athlete || (!athlete.username && val)) return // must have username first
    setIsPublic(val)
    // updateAthlete triggers syncStateToSupabase which uses the Worker endpoint
    // (service role key, bypasses RLS). This is the reliable write path.
    updateAthlete({ isPublic: val })
    // Fire an explicit sync so the public-profile Worker sees the change
    // immediately regardless of any debounce in the store.
    await syncStateToSupabase()
    posthog.capture('public profile toggled', { enabled: val })
  }

  // Email reminders + weekly digest — default ON. Writes through updateAthlete
  // (→ state_json) AND the email_opt_in column via the explicit sync so the
  // reminder/digest cron sees the change immediately.
  const emailOptIn = athlete?.emailOptIn ?? true
  async function toggleEmailOptIn(val: boolean) {
    updateAthlete({ emailOptIn: val })
    await syncStateToSupabase()
    posthog.capture('email opt in toggled', { enabled: val })
  }

  function applyTheme(themeId: ThemeId) {
    // V4 §10b — Pro gating. Locked themes ignored on prod; staging unlocks all.
    const theme = THEMES.find(t => t.id === themeId)
    if (theme?.pro && !hasProAccess) {
      posthog.capture('theme locked', { theme_id: themeId })
      return
    }
    storeSetTheme(themeId)
    posthog.capture('theme changed', { theme_id: themeId })
  }

  async function handleSignOut() {
    localStorage.removeItem('bt_new_user')
    localStorage.removeItem('bt_modal_shown')
    // Clear persisted Zustand stores so the next user on this device starts clean.
    // Without this, user B rehydrates user A's full race history from localStorage.
    useRaceStore.persist.clearStorage()
    useAthleteStore.persist.clearStorage()
    useWearableStore.persist.clearStorage()
    useRaceStore.setState({ races: [], upcomingRaces: [], wishlistRaces: [], nextRace: null, focusRaceId: null, deletedRaceIds: [], _pendingDeleteIds: [] })
    useAthleteStore.setState({ athlete: null, seasonPlans: [], goals: { annual: {}, distGoals: [] }, injuries: [] })
    useWearableStore.setState({ stravaToken: null, whoopToken: null, garminToken: null })
    // Re-arm the write gate so the next user's bootstrap sync defers until their remote pull lands.
    resetRemotePullGate()
    await signOut()
  }

  async function handleDeleteData() {
    const ok = window.confirm(
      'Delete all your BreakTapes data? This permanently removes your races, profile, and connected wearables from our servers. Your login account itself is managed separately under "Manage account". This cannot be undone.'
    )
    if (!ok) return
    const token = getClerkToken()
    if (!token) {
      window.alert('Could not verify your session. Please try again.')
      return
    }
    try {
      const res = await fetch(`${APP_URL}/api/delete-account`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`delete failed: ${res.status}`)
      posthog.capture('account data deleted')
      // Clear local stores then sign out — mirrors the sign-out cleanup.
      await handleSignOut()
    } catch {
      window.alert('Something went wrong deleting your data. Please try again.')
    }
  }

  return (
    <>
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Page heading */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{
          fontFamily: 'var(--headline)',
          fontSize: 'var(--text-xl)',
          fontWeight: 900,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--white)',
          margin: 0,
        }}>
          Settings
        </h1>
        {authUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <div style={{
              width: '7px', height: '7px', borderRadius: 'var(--radius-round)',
              background: syncStatus === 'ok' ? '#00FF88'
                : syncStatus === 'error' ? '#FF4444'
                : syncStatus === 'syncing' ? 'var(--orange)'
                : 'var(--muted2)',
              boxShadow: syncStatus === 'ok' ? '0 0 6px rgba(0,255,136,0.5)'
                : syncStatus === 'error' ? '0 0 6px rgba(255,68,68,0.5)'
                : syncStatus === 'syncing' ? '0 0 6px rgba(var(--orange-ch),0.5)'
                : 'none',
              transition: 'background 0.4s, box-shadow 0.4s',
            }} />
            <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--muted)', textTransform: 'uppercase' }}>
              {syncStatus === 'ok' ? 'Synced' : syncStatus === 'error' ? 'Sync failed' : syncStatus === 'syncing' ? 'Syncing…' : 'Not synced'}
            </span>
          </div>
        )}
      </div>

      {/* ── Auth section ── */}
      <section>
        <p style={sectionLabel}>Account</p>
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          {/* Profile card row — tap to expand */}
          <button
            onClick={() => setAccountExpanded(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--sp-4)',
              width: '100%', background: 'transparent', border: 'none',
              cursor: 'pointer', padding: '14px 16px', textAlign: 'left',
            }}
          >
            <div style={{
              width: '42px', height: '42px', borderRadius: 'var(--radius-round)',
              background: 'var(--orange)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--headline)', fontWeight: 900,
              fontSize: 'var(--text-base)', color: 'var(--black)',
              flexShrink: 0, letterSpacing: '0.04em',
            }}>
              {clerkUser?.imageUrl
                ? <img src={clerkUser.imageUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: 'var(--radius-round)', objectFit: 'cover' }} />
                : ([clerkUser?.firstName?.[0], clerkUser?.lastName?.[0]].filter(Boolean).join('').toUpperCase() ||
                   athlete?.firstName?.[0]?.toUpperCase() ||
                   authUser?.email?.[0]?.toUpperCase() || '?')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                color: 'var(--white)', fontSize: 'var(--text-base)',
                fontWeight: 600, lineHeight: 1.25,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {[clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ') ||
                 [athlete?.firstName, athlete?.lastName].filter(Boolean).join(' ') ||
                 authUser?.email || '—'}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)', marginTop: '2px' }}>
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
                  display: 'flex', alignItems: 'center', gap: 'var(--sp-2)',
                  width: '100%', background: 'transparent', border: 'none',
                  cursor: 'pointer', padding: '10px 4px', textAlign: 'left',
                  color: 'var(--white)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.6, flexShrink: 0 }}>
                  <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <span style={{ fontSize: 'var(--text-compact)', fontWeight: 500 }}>Manage account</span>
              </button>
              <div style={{ height: '1px', background: 'var(--border)', margin: '0 4px' }} />
              <button
                onClick={() => { setAccountExpanded(false); handleSignOut() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--sp-2)',
                  width: '100%', background: 'transparent', border: 'none',
                  cursor: 'pointer', padding: '10px 4px', textAlign: 'left',
                  color: 'var(--orange)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  <path d="M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontSize: 'var(--text-compact)', fontWeight: 500 }}>Sign out</span>
              </button>
              <div style={{ height: '1px', background: 'var(--border)', margin: '0 4px' }} />
              <button
                onClick={() => { setAccountExpanded(false); handleDeleteData() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--sp-2)',
                  width: '100%', background: 'transparent', border: 'none',
                  cursor: 'pointer', padding: '10px 4px', textAlign: 'left',
                  color: '#FF4D4D',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M2 4h12M6 4V2.5a1 1 0 011-1h2a1 1 0 011 1V4M5 4l.5 9a1 1 0 001 1h3a1 1 0 001-1L11 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontSize: 'var(--text-compact)', fontWeight: 500 }}>Delete all my data</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Sync / recovery section ── */}
      <section>
        <p style={sectionLabel}>Sync</p>
        <div style={card}>
          <button
            onClick={handleManualSync}
            disabled={syncing || !authUser}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-2)',
              width: '100%', padding: '12px 16px',
              cursor: syncing || !authUser ? 'default' : 'pointer',
              background: 'var(--orange)', color: 'var(--black)', border: 'none',
              borderRadius: 'var(--radius-md)', fontWeight: 700,
              fontSize: 'var(--text-compact)', letterSpacing: '0.02em',
              opacity: syncing || !authUser ? 0.6 : 1,
            }}
          >
            {syncing ? 'Restoring…' : '↓ Restore from server'}
          </button>
          <p style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)', marginTop: '10px', lineHeight: 1.45 }}>
            Re-downloads your races, medals, and profile from the server. Use this if your data looks
            missing. It only pulls from the server — it never overwrites what's saved there.
          </p>
          {syncMsg && (
            <p role="status" aria-live="polite" style={{ color: 'var(--white)', fontSize: 'var(--text-xs)', fontWeight: 600, marginTop: '8px' }}>
              {syncMsg}
            </p>
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
              <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                {athlete?.username ? `${APP_URL}/u/${athlete.username}` : 'Set a username in account settings first'}
              </p>
            </div>
            <button
              onClick={() => togglePublic(!isPublic)}
              disabled={!athlete?.username}
              style={{
                width: '48px', height: '28px',
                borderRadius: 'var(--radius-lg)',
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
                borderRadius: 'var(--radius-round)',
                background: 'var(--black)',
                transition: 'left 0.2s',
              }} />
            </button>
          </div>

          {/* Copy link */}
          {athlete?.isPublic && athlete?.username && (
            <button
              style={{ ...btnGhost, fontSize: 'var(--text-xs)', padding: '0.6rem 1rem', marginBottom: '14px' }}
              onClick={() => navigator.clipboard.writeText(`${APP_URL}/u/${athlete.username}`).then(() => showCopyToast()).catch(() => showCopyToast())}
            >
              Copy Profile Link
            </button>
          )}

          {/* Visibility controls — only shown when public */}
          {isPublic && (
            <>
              <div style={{ height: '1px', background: 'var(--border)', marginBottom: '14px' }} />
              <p style={{ margin: '0 0 10px', fontSize: 'var(--text-xs)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--headline)', fontWeight: 700 }}>
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
                const enabled = vis[key] === true
                return (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                      <div style={{ minWidth: 0, flex: 1, paddingRight: '12px' }}>
                        <p style={{ margin: 0, fontSize: 'var(--text-compact)', color: 'var(--white)', fontWeight: 500 }}>{label}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>{desc}</p>
                      </div>
                      <button
                        onClick={() => updateAthlete({ profileVisibility: { ...vis, [key]: !enabled } })}
                        style={{
                          width: '42px', height: '24px',
                          borderRadius: 'var(--radius-lg)', border: 'none',
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
                          borderRadius: 'var(--radius-round)', background: 'var(--black)',
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
            <p style={{ margin: '0 0 10px', fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-sm)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--white)' }}>
              Units
            </p>
            <p style={{ margin: '0 0 10px', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
              Distances, paces, and speeds across the app
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)' }}>
              {(['metric', 'imperial'] as const).map(u => {
                const active = (athlete?.units ?? 'metric') === u
                return (
                  <button
                    key={u}
                    onClick={() => updateAthlete({ units: u })}
                    style={{
                      padding: 'var(--sp-3)',
                      borderRadius: 'var(--radius-md)',
                      border: active ? '2px solid var(--orange)' : '1px solid var(--border2)',
                      background: active ? 'rgba(var(--orange-ch),0.1)' : 'var(--surface3)',
                      cursor: 'pointer',
                      textAlign: 'center' as const,
                    }}
                  >
                    <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', letterSpacing: '0.08em', textTransform: 'uppercase', color: active ? 'var(--orange)' : 'var(--white)' }}>
                      {u === 'metric' ? 'Metric' : 'Imperial'}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '3px' }}>
                      {u === 'metric' ? 'km · min/km' : 'mi · min/mi'}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Email reminders + weekly digest toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-3)', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <div>
              <p style={{ margin: 0, fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-sm)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--white)' }}>
                Email reminders
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                Race-day reminders &amp; a weekly digest. Unsubscribe anytime.
              </p>
            </div>
            <button
              onClick={() => toggleEmailOptIn(!emailOptIn)}
              aria-label="Toggle email reminders"
              style={{
                width: '48px', height: '28px',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                cursor: 'pointer',
                background: emailOptIn ? 'var(--green)' : 'var(--surface3)',
                position: 'relative',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute',
                top: '3px',
                left: emailOptIn ? '23px' : '3px',
                width: '22px', height: '22px',
                borderRadius: 'var(--radius-round)',
                background: 'var(--black)',
                transition: 'left 0.2s',
              }} />
            </button>
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
            const isLocked = theme.pro && !hasProAccess
            return (
              <button
                key={theme.id}
                onClick={() => isLocked ? undefined : applyTheme(theme.id)}
                disabled={isLocked}
                style={{
                  height: '80px',
                  background: 'var(--surface2)',
                  border: isActive ? '2px solid var(--orange)' : '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--sp-2)',
                  padding: '0.5rem',
                  opacity: isLocked ? 0.55 : 1,
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
                {theme.pro && (
                  <span style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    fontSize: '8px',
                    fontFamily: 'var(--headline)',
                    fontWeight: 800,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#C8963C',
                    background: 'rgba(200,150,60,0.12)',
                    border: '1px solid rgba(200,150,60,0.3)',
                    padding: '1px 5px',
                    borderRadius: 'var(--radius-xs)',
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
        <div style={card}>
          <p style={{ margin: 0, fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-compact)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--white)' }}>Wearable Sync</p>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>Strava, WHOOP, Garmin and more — coming soon</p>
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
              v{APP_VERSION}
            </p>
          </div>
          <a
            href="https://breaktapes.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...btnGhost,
              textDecoration: 'none',
              display: 'inline-block',
              fontSize: 'var(--text-xs)',
            }}
          >
            breaktapes.com
          </a>
        </div>

        {/* Admin lives on admin.breaktapes.com — not surfaced in the athlete app */}

        {/* Legal + Help links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
          <a
            href="/help"
            style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', padding: '14px 16px' }}
          >
            <div>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--white)', fontFamily: 'var(--body)', display: 'block' }}>Help & Contact</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--body)' }}>Report an issue or request data deletion</span>
            </div>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>→</span>
          </a>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <a
              href="/privacy"
              style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', padding: '14px 16px' }}
            >
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--white)', fontFamily: 'var(--body)' }}>Privacy Policy</span>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>→</span>
            </a>
            <a
              href="/terms"
              style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', padding: '14px 16px' }}
            >
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--white)', fontFamily: 'var(--body)' }}>Terms & Conditions</span>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>→</span>
            </a>
          </div>
        </div>
      </section>
    </div>
    {copyToast && createPortal(
      <div style={{
        position: 'fixed', bottom: 'calc(var(--safe-bottom, 0px) + 80px)', left: '50%',
        transform: 'translateX(-50%)', zIndex: 2000,
        background: 'var(--surface3)', border: '1px solid rgba(var(--orange-ch),0.5)',
        color: 'var(--orange)', borderRadius: 'var(--radius-pill)', padding: '10px 20px',
        fontSize: 'var(--text-sm)', fontFamily: 'var(--headline)', fontWeight: 700,
        letterSpacing: '0.06em', whiteSpace: 'nowrap', pointerEvents: 'none',
      }}>
        Link copied ✓
      </div>,
      document.body
    )}
    </>
  )
}

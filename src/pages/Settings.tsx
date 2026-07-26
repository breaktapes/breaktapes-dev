import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
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
import { useTourStore } from '@/stores/useTourStore'

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

const panel: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%), var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 'calc(var(--radius-lg) + 2px)',
  boxShadow: '0 18px 36px rgba(0,0,0,0.24)',
}

const softPanel: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(var(--orange-ch),0.04) 0%, rgba(255,255,255,0) 100%), var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
}

const rowTitle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--headline)',
  fontWeight: 800,
  fontSize: 'var(--text-sm)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--white)',
}

const rowBody: React.CSSProperties = {
  margin: '4px 0 0',
  fontSize: 'var(--text-xs)',
  color: 'var(--muted)',
  lineHeight: 1.55,
}

const themePreviewMap: Record<string, { base: string; glow: string; accent: string }> = {
  light: { base: '#EDE9E0', glow: 'rgba(212,66,26,0.15)', accent: '#D4421A' },
  'deep-space': { base: '#0A0A14', glow: 'rgba(91,110,245,0.22)', accent: '#5B6EF5' },
  'race-night': { base: '#0D0D0D', glow: 'rgba(232,240,0,0.18)', accent: '#E8F000' },
  obsidian: { base: '#080808', glow: 'rgba(184,196,208,0.18)', accent: '#B8C4D0' },
  'acid-track': { base: '#080E08', glow: 'rgba(57,255,20,0.2)', accent: '#39FF14' },
  titanium: { base: '#10141A', glow: 'rgba(143,160,176,0.18)', accent: '#8FA0B0' },
  ember: { base: '#140800', glow: 'rgba(255,140,0,0.2)', accent: '#FF8C00' },
}

function SectionHeader({ title, kicker }: { title: string; kicker?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <p style={{ ...sectionLabel, marginBottom: 0 }}>{title}</p>
      {kicker ? (
        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--muted)', lineHeight: 1.5 }}>
          {kicker}
        </p>
      ) : null}
    </div>
  )
}

function SyncBadge({ syncStatus }: { syncStatus: string | null | undefined }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--sp-2)',
      padding: '7px 10px',
      borderRadius: 'var(--radius-pill)',
      border: '1px solid var(--border)',
      background: 'rgba(255,255,255,0.02)',
      backdropFilter: 'blur(10px)',
    }}>
      <div style={{
        width: '7px',
        height: '7px',
        borderRadius: 'var(--radius-round)',
        background: syncStatus === 'ok' ? '#00FF88'
          : syncStatus === 'error' ? '#FF4444'
          : syncStatus === 'syncing' ? 'var(--orange)'
          : 'var(--muted2)',
        boxShadow: syncStatus === 'ok' ? '0 0 8px rgba(0,255,136,0.5)'
          : syncStatus === 'error' ? '0 0 8px rgba(255,68,68,0.45)'
          : syncStatus === 'syncing' ? '0 0 8px rgba(var(--orange-ch),0.5)'
          : 'none',
      }} />
      <span style={{
        fontSize: 'var(--text-xs)',
        fontFamily: 'var(--headline)',
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: 'var(--muted)',
        textTransform: 'uppercase',
      }}>
        {syncStatus === 'ok' ? 'Synced' : syncStatus === 'error' ? 'Sync failed' : syncStatus === 'syncing' ? 'Syncing…' : 'Not synced'}
      </span>
    </div>
  )
}

function ToggleSwitch({
  checked,
  onClick,
  disabled = false,
  accent = 'var(--orange)',
  offLabel,
  onLabel,
}: {
  checked: boolean
  onClick: () => void
  disabled?: boolean
  accent?: string
  offLabel?: string
  onLabel?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '58px',
        height: '32px',
        borderRadius: '999px',
        border: '1px solid transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? accent : 'var(--surface3)',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position: 'absolute',
        inset: '1px',
        borderRadius: '999px',
        border: '1px solid rgba(255,255,255,0.08)',
      }} />
      <span style={{
        position: 'absolute',
        top: '3px',
        left: checked ? '29px' : '3px',
        width: '24px',
        height: '24px',
        borderRadius: 'var(--radius-round)',
        background: 'var(--black)',
        transition: 'left 0.2s',
        boxShadow: '0 4px 10px rgba(0,0,0,0.35)',
      }} />
      <span style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: checked ? 'flex-start' : 'flex-end',
        padding: '0 9px',
        fontSize: '9px',
        fontFamily: 'var(--headline)',
        fontWeight: 800,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: checked ? '#000' : 'var(--muted)',
      }}>
        {checked ? (onLabel ?? 'On') : (offLabel ?? 'Off')}
      </span>
    </button>
  )
}

function SettingRow({
  title,
  body,
  control,
  divider = false,
}: {
  title: string
  body: React.ReactNode
  control: React.ReactNode
  divider?: boolean
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 'var(--sp-4)',
      padding: '14px 0',
      borderTop: divider ? '1px solid var(--border)' : 'none',
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={rowTitle}>{title}</p>
        <div style={rowBody}>{body}</div>
      </div>
      {control}
    </div>
  )
}

export function Settings() {
  const navigate = useNavigate()
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
    // Tour suppression is per-account (athlete.tourCompletedAt syncs) — don't let
    // user A's local flag hide the tour from user B on a shared device.
    localStorage.removeItem('fl2_tour_state')
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

  const displayName =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ') ||
    [athlete?.firstName, athlete?.lastName].filter(Boolean).join(' ') ||
    authUser?.email ||
    'Athlete'

  const initials =
    [clerkUser?.firstName?.[0], clerkUser?.lastName?.[0]].filter(Boolean).join('').toUpperCase() ||
    athlete?.firstName?.[0]?.toUpperCase() ||
    authUser?.email?.[0]?.toUpperCase() ||
    '?'

  return (
    <>
    <div style={{ padding: '1rem 1rem 6.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Page heading */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--sp-3)' }}>
        <div>
          <p style={{ ...sectionLabel, marginBottom: '6px' }}>Control Center</p>
          <h1 style={{
            fontFamily: 'var(--headline)',
            fontSize: 'clamp(28px, 8vw, 38px)',
            fontWeight: 900,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--white)',
            lineHeight: 0.95,
            margin: 0,
          }}>
            Settings
          </h1>
        </div>
        {authUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <SyncBadge syncStatus={syncStatus} />
            <button
              onClick={handleManualSync}
              disabled={syncing}
              title={syncMsg ?? 'Restore from server (pull-only — never overwrites the server)'}
              aria-label="Restore from server"
              style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                color: 'var(--muted)',
                cursor: syncing ? 'default' : 'pointer',
                opacity: syncing ? 0.5 : 1,
                transition: 'opacity 0.2s, color 0.2s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M13.6 8a5.6 5.6 0 1 1-1.7-4M13.5 2.2V5.4h-3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        ) : null}
      </div>

      <section style={{
        ...panel,
        position: 'relative',
        overflow: 'hidden',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at top right, rgba(var(--orange-ch),0.18), transparent 38%), radial-gradient(circle at bottom left, rgba(255,255,255,0.05), transparent 32%)',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--sp-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', minWidth: 0 }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '18px',
              background: 'linear-gradient(135deg, var(--orange) 0%, rgba(var(--orange-ch),0.55) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--headline)',
              fontWeight: 900,
              fontSize: 'var(--text-lg)',
              color: 'var(--black)',
              flexShrink: 0,
              overflow: 'hidden',
              boxShadow: '0 14px 30px rgba(var(--orange-ch),0.24)',
            }}>
              {clerkUser?.imageUrl
                ? <img src={clerkUser.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ ...sectionLabel, marginBottom: '6px', color: 'rgba(var(--orange-ch),0.9)' }}>Athlete ID</p>
              <div style={{
                fontFamily: 'var(--headline)',
                fontWeight: 900,
                fontSize: 'clamp(20px, 5vw, 28px)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--white)',
                lineHeight: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {displayName}
              </div>
              <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 'var(--text-sm)', lineHeight: 1.45 }}>
                {authUser?.email || 'Signed in athlete'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setAccountExpanded(v => !v)}
            aria-label={accountExpanded ? 'Collapse account controls' : 'Expand account controls'}
            style={{
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '12px',
              border: '1px solid var(--border2)',
              background: 'rgba(255,255,255,0.03)',
              color: 'var(--white)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <svg
              width="12" height="12" viewBox="0 0 12 12" fill="none"
              style={{ opacity: 0.65, transition: 'transform 0.2s', transform: accountExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
          <div style={{ ...softPanel, padding: '14px 16px' }}>
            <div style={{ ...sectionLabel, marginBottom: '4px' }}>Profile State</div>
            <div style={{ ...rowTitle, fontSize: 'var(--text-base)' }}>
              {athlete?.username ? 'Public profile ready' : 'Username still needed'}
            </div>
            <p style={rowBody}>
              {athlete?.username ? `${APP_URL}/u/${athlete.username}` : 'Set a username in account settings first.'}
            </p>
          </div>
          <div style={{ ...softPanel, padding: '14px 16px' }}>
            <div style={{ ...sectionLabel, marginBottom: '4px' }}>App Theme</div>
            <div style={{ ...rowTitle, fontSize: 'var(--text-base)' }}>
              {THEMES.find(theme => theme.id === activeTheme)?.label ?? 'Default'}
            </div>
            <p style={rowBody}>
              {hasProAccess ? 'All themes unlocked in this environment.' : 'Pro themes stay locked outside staging.'}
            </p>
          </div>
        </div>

        {accountExpanded ? (
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              onClick={() => { setAccountExpanded(false); openUserProfile() }}
              style={{
                ...btnGhost,
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255,255,255,0.03)',
                padding: '0.95rem 1rem',
              }}
            >
              Manage Account
            </button>
            <button
              onClick={() => { setAccountExpanded(false); handleSignOut() }}
              style={{
                ...btnGhost,
                borderRadius: 'var(--radius-md)',
                padding: '0.95rem 1rem',
                color: 'var(--orange)',
                borderColor: 'rgba(var(--orange-ch),0.28)',
                background: 'rgba(var(--orange-ch),0.08)',
              }}
            >
              Sign out
            </button>
          </div>
        ) : null}
      </section>

      {/* ── Auth section ── */}
      <section>
        <SectionHeader
          title="Account"
          kicker="Identity, public profile controls, and what other athletes can see."
        />
        <div style={{ ...panel, padding: '0 18px 6px' }}>
          <SettingRow
            title="Make profile public"
            body={athlete?.username ? `${APP_URL}/u/${athlete.username}` : 'Set a username in account settings first'}
            control={(
              <ToggleSwitch
                checked={isPublic}
                onClick={() => togglePublic(!isPublic)}
                disabled={!athlete?.username}
                accent="var(--green)"
              />
            )}
          />

          {athlete?.isPublic && athlete?.username ? (
            <div style={{ padding: '0 0 14px' }}>
              <button
                style={{ ...btnGhost, width: '100%', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)' }}
                onClick={() => navigator.clipboard.writeText(`${APP_URL}/u/${athlete.username}`).then(() => showCopyToast()).catch(() => showCopyToast())}
              >
                Copy Profile Link
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
          ) : null}

          {isPublic ? (
            <>
              <div style={{ height: '1px', background: 'var(--border)', marginBottom: '4px' }} />
              <div style={{ padding: '12px 0 4px' }}>
                <p style={{ ...sectionLabel, marginBottom: '10px' }}>What to show on your profile</p>
                {([
                  { key: 'races',     label: 'Race history & finish times', desc: 'All logged races and results' },
                  { key: 'pbs',       label: 'Personal bests',              desc: 'Your PR grid per distance' },
                  { key: 'medals',    label: 'Medal wall',                  desc: 'Photos and medal collection' },
                  { key: 'stats',     label: 'Stats & countries',           desc: 'Race count, distance, countries' },
                  { key: 'upcoming',  label: 'Upcoming races',              desc: 'Your race calendar' },
                  { key: 'wearables', label: 'Activity feed',               desc: 'Strava & wearable workouts' },
                ] as const).map(({ key, label, desc }, i) => {
                  const vis = athlete?.profileVisibility ?? {}
                  const enabled = vis[key] === true
                  return (
                    <SettingRow
                      key={key}
                      title={label}
                      body={desc}
                      divider={i > 0}
                      control={(
                        <ToggleSwitch
                          checked={enabled}
                          onClick={() => updateAthlete({ profileVisibility: { ...vis, [key]: !enabled } })}
                        />
                      )}
                    />
                  )
                })}
              </div>
            </>
          ) : null}
        </div>
      </section>

      {/* ── Public Profile section ── */}
      <section>
        <SectionHeader
          title="Public Profile"
          kicker="Your shareable athlete card is now treated like a published surface, not a buried toggle."
        />
        <div style={{ ...panel, padding: '18px' }}>
          <div style={{
            ...softPanel,
            padding: '16px',
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: 'var(--sp-4)',
            alignItems: 'center',
          }}>
            <div>
              <p style={{ ...sectionLabel, marginBottom: '6px', color: 'rgba(var(--green-ch),0.88)' }}>Visibility</p>
              <div style={{ ...rowTitle, fontSize: 'var(--text-base)' }}>
                {isPublic ? 'Published to the world' : 'Private to you'}
              </div>
              <p style={rowBody}>
                {isPublic
                  ? 'Your card, stats, and selected sections are shareable from a clean public URL.'
                  : 'Turn this on when you want other athletes to compare, browse, and follow your story.'}
              </p>
            </div>
            <ToggleSwitch
              checked={isPublic}
              onClick={() => togglePublic(!isPublic)}
              disabled={!athlete?.username}
              accent="var(--green)"
              onLabel="Live"
              offLabel="Off"
            />
          </div>
        </div>
      </section>

      {/* ── Preferences section ── */}
      <section>
        <SectionHeader
          title="Preferences"
          kicker="App-wide defaults should feel fast to scan and easy to trust."
        />
        <div style={{ ...panel, padding: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)', marginBottom: '8px' }}>
            {(['metric', 'imperial'] as const).map(u => {
              const active = (athlete?.units ?? 'metric') === u
              return (
                <button
                  key={u}
                  onClick={() => updateAthlete({ units: u })}
                  style={{
                    ...softPanel,
                    padding: '16px 14px',
                    border: active ? '1px solid rgba(var(--orange-ch),0.44)' : '1px solid var(--border)',
                    background: active
                      ? 'linear-gradient(180deg, rgba(var(--orange-ch),0.14) 0%, rgba(var(--orange-ch),0.04) 100%), var(--surface2)'
                      : 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%), var(--surface2)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: active ? '0 10px 20px rgba(var(--orange-ch),0.12)' : 'none',
                  }}
                >
                  <div style={{ ...rowTitle, color: active ? 'var(--orange)' : 'var(--white)' }}>
                    {u === 'metric' ? 'Metric' : 'Imperial'}
                  </div>
                  <div style={{ ...rowBody, marginTop: '6px' }}>
                    {u === 'metric' ? 'km · min/km' : 'mi · min/mi'}
                  </div>
                </button>
              )
            })}
          </div>

          <SettingRow
            title="Email reminders"
            body="Race-day reminders and a weekly digest. Unsubscribe anytime."
            divider
            control={(
              <ToggleSwitch
                checked={emailOptIn}
                onClick={() => toggleEmailOptIn(!emailOptIn)}
                accent="var(--green)"
                onLabel="Send"
                offLabel="Mute"
              />
            )}
          />
        </div>
      </section>

      {/* ── Theme section ── */}
      <section>
        <SectionHeader
          title="Theme"
          kicker="The new theme picker should feel like a curated pack, not a utility grid."
        />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '0.75rem',
        }}>
          {THEMES.map(theme => {
            const isActive = activeTheme === theme.id
            const isLocked = theme.pro && !hasProAccess
            const preview = themePreviewMap[theme.id] ?? { base: '#141414', glow: 'rgba(var(--orange-ch),0.14)', accent: 'var(--orange)' }
            return (
              <button
                key={theme.id}
                onClick={() => isLocked ? undefined : applyTheme(theme.id)}
                disabled={isLocked}
                style={{
                  ...panel,
                  border: isActive ? '1px solid rgba(var(--orange-ch),0.46)' : '1px solid var(--border)',
                  minHeight: '118px',
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  justifyContent: 'space-between',
                  gap: 'var(--sp-3)',
                  padding: '12px',
                  opacity: isLocked ? 0.55 : 1,
                  position: 'relative',
                  textAlign: 'left',
                  overflow: 'hidden',
                  boxShadow: isActive ? '0 14px 26px rgba(var(--orange-ch),0.14)' : panel.boxShadow,
                }}
              >
                <div style={{
                  height: '46px',
                  borderRadius: '12px',
                  background: `
                    radial-gradient(circle at 18% 50%, ${preview.glow}, transparent 34%),
                    radial-gradient(circle at 82% 35%, rgba(255,255,255,0.08), transparent 26%),
                    linear-gradient(135deg, ${preview.base} 0%, rgba(0,0,0,0.35) 100%)
                  `,
                  border: '1px solid rgba(255,255,255,0.06)',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  <span style={{
                    position: 'absolute',
                    left: 10,
                    right: 10,
                    bottom: 10,
                    height: '3px',
                    borderRadius: '999px',
                    background: preview.accent,
                    opacity: 0.85,
                  }} />
                </div>
                <span style={{
                  fontFamily: 'var(--headline)',
                  fontWeight: 900,
                  fontSize: 'var(--text-sm)',
                  color: isActive ? 'var(--orange)' : 'var(--white)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  lineHeight: 1.2,
                }}>
                  {theme.label}
                </span>
                <span style={{
                  fontSize: 'var(--text-xs)',
                  color: isActive ? 'var(--white)' : 'var(--muted)',
                  lineHeight: 1.4,
                }}>
                  {isLocked ? 'Locked to Pro access.' : isActive ? 'Active across the app.' : 'Tap to preview this mood.'}
                </span>
                {theme.pro && (
                  <span style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    fontSize: '9px',
                    fontFamily: 'var(--headline)',
                    fontWeight: 800,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#C8963C',
                    background: 'rgba(200,150,60,0.12)',
                    border: '1px solid rgba(200,150,60,0.3)',
                    padding: '2px 6px',
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

      {/* ── About section ── */}
      <section>
        <SectionHeader
          title="About"
          kicker="Product metadata and support links now get the same card quality as the rest of the shell."
        />
        <div style={{ ...panel, padding: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-3)' }}>
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
              borderRadius: 'var(--radius-md)',
            }}
          >
            breaktapes.com
          </a>
        </div>

        {/* Admin lives on admin.breaktapes.com — not surfaced in the athlete app */}

        {/* Legal + Help links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
          <button
            onClick={() => { navigate('/'); useTourStore.getState().startTour('settings') }}
            style={{ ...panel, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', cursor: 'pointer', width: '100%', textAlign: 'left' }}
          >
            <div>
              <span style={{ ...rowTitle, display: 'block' }}>Take the App Tour</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--body)' }}>A 60-second walkthrough of the dashboard</span>
            </div>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>→</span>
          </button>
          <a
            href="/help"
            style={{ ...panel, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', padding: '16px 18px' }}
          >
            <div>
              <span style={{ ...rowTitle, display: 'block' }}>Help & Contact</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--body)' }}>Report an issue or request data deletion</span>
            </div>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>→</span>
          </a>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <a
              href="/privacy"
              style={{ ...panel, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', padding: '16px 18px' }}
            >
              <span style={{ ...rowTitle, fontFamily: 'var(--body)', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>Privacy Policy</span>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>→</span>
            </a>
            <a
              href="/terms"
              style={{ ...panel, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', padding: '16px 18px' }}
            >
              <span style={{ ...rowTitle, fontFamily: 'var(--body)', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>Terms & Conditions</span>
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

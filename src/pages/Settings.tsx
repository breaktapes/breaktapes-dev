import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/useAuthStore'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { supabase } from '@/lib/supabase'
import { THEMES } from '@/types'
import type { ThemeId } from '@/types'

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
  const navigate = useNavigate()
  const authUser = useAuthStore(s => s.authUser)
  const proAccessGranted = useAuthStore(s => s.proAccessGranted)
  const athlete = useAthleteStore(s => s.athlete)

  const [activeTheme, setActiveTheme] = useState<ThemeId>(
    () => (localStorage.getItem('bt_theme') as ThemeId) || 'carbon'
  )

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
          </div>
        </div>
      </section>

      {/* ── Profile section ── */}
      <section>
        <p style={sectionLabel}>Profile</p>
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {athlete?.username && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Username
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--text-sm)', color: 'var(--white)' }}>
                  @{athlete.username}
                </p>
              </div>
              <div style={{
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--headline)',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: athlete.isPublic ? 'rgba(0,255,136,0.12)' : 'var(--surface3)',
                color: athlete.isPublic ? 'var(--green)' : 'var(--muted)',
              }}>
                {athlete.isPublic ? 'Public' : 'Private'}
              </div>
            </div>
          )}
          <button style={{ ...btnMain, alignSelf: 'flex-start' }} onClick={() => navigate('/you')}>
            Edit Profile
          </button>
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
                onClick={() => applyTheme(theme.id, theme.pro)}
                style={{
                  height: '80px',
                  background: 'var(--surface2)',
                  border: isActive
                    ? '2px solid var(--orange)'
                    : '1px solid var(--border)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '0.5rem',
                  opacity: isLocked ? 0.5 : 1,
                  position: 'relative',
                }}
              >
                {isLocked && (
                  <span style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    fontSize: '10px',
                  }}>
                    🔒
                  </span>
                )}
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
          {[
            { id: 'whoop',  name: 'WHOOP',        desc: 'Recovery, strain & sleep coaching',        status: 'connect' as const },
            { id: 'garmin', name: 'Garmin',        desc: 'GPS activities & performance metrics',     status: 'connect' as const },
            { id: 'coros',  name: 'COROS',         desc: 'Training load & endurance data',           status: 'soon'    as const },
            { id: 'oura',   name: 'Oura',          desc: 'Readiness, sleep & HRV',                  status: 'soon'    as const },
            { id: 'apple',  name: 'Apple Health',  desc: 'Import export.xml from the Health app',   status: 'connect' as const },
          ].map(w => (
            <div
              key={w.id}
              style={{
                ...card,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0,
                  fontFamily: 'var(--headline)',
                  fontWeight: 900,
                  fontSize: '14px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--white)',
                }}>
                  {w.name}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                  {w.desc}
                </p>
              </div>
              {w.status === 'soon' ? (
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '4px',
                  background: 'var(--surface3)',
                  border: '1px solid var(--border)',
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'var(--headline)',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                  whiteSpace: 'nowrap',
                }}>
                  Soon
                </span>
              ) : (
                <button
                  style={{ ...btnMain, padding: '0.5rem 1rem', whiteSpace: 'nowrap', flexShrink: 0 }}
                  onClick={() => console.log(`Connect ${w.name}`)}
                >
                  Connect
                </button>
              )}
            </div>
          ))}
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

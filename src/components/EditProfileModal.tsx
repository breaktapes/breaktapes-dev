import { useState } from 'react'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/useAuthStore'
import type { Athlete } from '@/types'

interface Props {
  onClose: () => void
}

export function EditProfileModal({ onClose }: Props) {
  const athlete = useAthleteStore(s => s.athlete)
  const updateAthlete = useAthleteStore(s => s.updateAthlete)
  const authUser = useAuthStore(s => s.authUser)

  const [firstName, setFirstName] = useState(athlete?.firstName ?? '')
  const [lastName,  setLastName]  = useState(athlete?.lastName ?? '')
  const [city,      setCity]      = useState(athlete?.city ?? '')
  const [country,   setCountry]   = useState(athlete?.country ?? '')
  const [dob,       setDob]       = useState(athlete?.dob ?? '')
  const [gender,    setGender]    = useState(athlete?.gender ?? '')
  const [mainSport, setMainSport] = useState(athlete?.mainSport ?? 'Running')
  const [club,      setClub]      = useState(athlete?.club ?? '')
  const [bio,       setBio]       = useState(athlete?.bio ?? '')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  async function handleSave() {
    if (!firstName.trim()) { setError('First name is required'); return }
    setSaving(true)
    setError('')

    const patch: Partial<Athlete> = {
      firstName: firstName.trim(),
      lastName:  lastName.trim()  || undefined,
      city:      city.trim()      || undefined,
      country:   country.trim()   || undefined,
      dob:       dob              || undefined,
      gender:    gender           || undefined,
      mainSport: mainSport        || undefined,
      club:      club.trim()      || undefined,
      bio:       bio.trim()       || undefined,
    }
    updateAthlete(patch)

    // Persist to Supabase if authenticated
    if (authUser) {
      try {
        const { data: existing } = await supabase
          .from('user_state')
          .select('state_json')
          .eq('user_id', authUser.id)
          .single()

        const current = existing?.state_json ?? {}
        await supabase
          .from('user_state')
          .upsert({
            user_id: authUser.id,
            state_json: { ...current, athlete: { ...(current.athlete ?? {}), ...patch } },
          }, { onConflict: 'user_id' })
      } catch {
        // Local store already updated — remote sync will retry on next load
      }
    }

    setSaving(false)
    onClose()
  }

  return (
    <div style={st.overlay} onClick={onClose}>
      <div style={st.sheet} onClick={e => e.stopPropagation()}>
        <div style={st.handle} />

        <div style={st.header}>
          <span style={st.title}>EDIT PROFILE</span>
          <button style={st.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div style={st.body}>
          {/* Name row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', minWidth: 0 }}>
            <Field label="First Name *">
              <input style={st.input} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane" autoFocus />
            </Field>
            <Field label="Last Name">
              <input style={st.input} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" />
            </Field>
          </div>

          {/* Location */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', minWidth: 0 }}>
            <Field label="City">
              <input style={st.input} value={city} onChange={e => setCity(e.target.value)} placeholder="London" />
            </Field>
            <Field label="Country">
              <input style={st.input} value={country} onChange={e => setCountry(e.target.value)} placeholder="UK" />
            </Field>
          </div>

          {/* DOB + Gender */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', minWidth: 0 }}>
            <Field label="Date of Birth">
              <input type="date" style={st.input} value={dob} onChange={e => setDob(e.target.value)} />
            </Field>
            <Field label="Gender">
              <select style={st.input} value={gender} onChange={e => setGender(e.target.value)}>
                <option value="">—</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="X">Non-binary</option>
              </select>
            </Field>
          </div>

          {/* Main sport */}
          <Field label="Main Sport">
            <select style={st.input} value={mainSport} onChange={e => setMainSport(e.target.value)}>
              {['Running', 'Triathlon', 'Cycling', 'Swimming', 'Trail Running', 'Ultra', 'Duathlon', 'Other'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>

          {/* Club */}
          <Field label="Club / Team">
            <input style={st.input} value={club} onChange={e => setClub(e.target.value)} placeholder="e.g. Berlin Running Club" />
          </Field>

          {/* Bio */}
          <Field label="Bio">
            <textarea
              style={{ ...st.input, minHeight: '72px', resize: 'vertical' }}
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="A few words about you..."
            />
          </Field>

          {error && (
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: '#ff6b6b' }}>{error}</p>
          )}

          <button style={st.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'SAVING…' : 'SAVE PROFILE'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
      <label style={st.fieldLabel}>{label}</label>
      {children}
    </div>
  )
}

const st = {
  overlay: {
    position: 'fixed',
    top: 'calc(var(--header-base-height) + var(--safe-top))',
    left: 0,
    right: 0,
    bottom: 'calc(var(--bottom-nav-base-height) + var(--safe-bottom))',
    background: 'rgba(0,0,0,0.7)',
    zIndex: 950,
    display: 'flex',
    alignItems: 'flex-end',
  } as React.CSSProperties,

  sheet: {
    width: '100%',
    maxHeight: '90vh',
    background: 'var(--surface2)',
    borderTop: '1px solid var(--border2)',
    borderRadius: '16px 16px 0 0',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch' as any,
  } as React.CSSProperties,

  handle: {
    width: '36px',
    height: '4px',
    background: 'var(--border2)',
    borderRadius: '2px',
    margin: '12px auto 0',
    flexShrink: 0,
  } as React.CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 16px 0',
    flexShrink: 0,
  } as React.CSSProperties,

  title: {
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '16px',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--white)',
  } as React.CSSProperties,

  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--muted)',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '4px 8px',
    lineHeight: 1,
  } as React.CSSProperties,

  body: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    paddingBottom: '32px',
  } as React.CSSProperties,

  fieldLabel: {
    fontSize: '11px',
    fontFamily: 'var(--headline)',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
  } as React.CSSProperties,

  input: {
    width: '100%',
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: '6px',
    color: 'var(--white)',
    fontSize: 'var(--text-sm)',
    padding: '0.6rem 0.75rem',
    fontFamily: 'var(--body)',
    boxSizing: 'border-box',
    minWidth: 0,
  } as React.CSSProperties,

  saveBtn: {
    background: 'var(--orange)',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    padding: '14px',
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: '14px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    width: '100%',
    marginTop: '4px',
  } as React.CSSProperties,
}

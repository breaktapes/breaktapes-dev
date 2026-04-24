import { useState, useEffect } from 'react'
import { useAthleteStore } from '@/stores/useAthleteStore'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/useAuthStore'
import { DateInput } from '@/components/DateInput'
import type { Athlete } from '@/types'

interface Props {
  onClose: () => void
}

export function EditProfileModal({ onClose }: Props) {
  const athlete = useAthleteStore(s => s.athlete)
  const updateAthlete = useAthleteStore(s => s.updateAthlete)
  const authUser = useAuthStore(s => s.authUser)

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

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
    // All fields required except Club
    if (!firstName.trim())  { setError('First name is required'); return }
    if (!lastName.trim())   { setError('Last name is required'); return }
    if (!city.trim())       { setError('City is required'); return }
    if (!country.trim())    { setError('Country is required'); return }
    if (!dob)               { setError('Date of birth is required'); return }
    if (!gender)            { setError('Gender is required'); return }
    if (!mainSport)         { setError('Main sport is required'); return }
    if (!bio.trim())        { setError('Bio is required'); return }
    setSaving(true)
    setError('')

    const patch: Partial<Athlete> = {
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      city:      city.trim(),
      country:   country.trim(),
      dob,
      gender,
      mainSport,
      // Club is optional — pass value so user can intentionally clear it; undefined = not touched
      ...(club.trim() !== (athlete?.club ?? '') ? { club: club.trim() || undefined } : {}),
      bio:       bio.trim(),
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
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-modal-title"
        style={st.sheet}
        onClick={e => e.stopPropagation()}
      >
        <div style={st.handle} />

        <div style={st.header}>
          <span id="edit-profile-modal-title" style={st.title}>EDIT PROFILE</span>
          <button style={st.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div style={st.body}>
          {/* Name row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', minWidth: 0 }}>
            <Field label="First Name *">
              <input style={st.input} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane" autoFocus />
            </Field>
            <Field label="Last Name *">
              <input style={st.input} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" />
            </Field>
          </div>

          {/* Location */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', minWidth: 0 }}>
            <Field label="City *">
              <input style={st.input} value={city} onChange={e => setCity(e.target.value)} placeholder="London" />
            </Field>
            <Field label="Country *">
              <input style={st.input} value={country} onChange={e => setCountry(e.target.value)} placeholder="UK" />
            </Field>
          </div>

          {/* DOB + Gender — each on its own row so the date input never overflows */}
          <Field label="Date of Birth *">
            <DateInput value={dob} onChange={setDob} max={new Date().toISOString().split('T')[0]} />
          </Field>
          <Field label="Gender *">
            <select style={st.input} value={gender} onChange={e => setGender(e.target.value)}>
              <option value="">—</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="X">Non-binary</option>
            </select>
          </Field>

          {/* Main sport */}
          <Field label="Main Sport *">
            <select style={st.input} value={mainSport} onChange={e => setMainSport(e.target.value)}>
              {['Running', 'Triathlon', 'Cycling', 'Swimming', 'Trail Running', 'Ultra', 'Duathlon', 'Other'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>

          {/* Club — optional */}
          <Field label="Club / Team">
            <input style={st.input} value={club} onChange={e => setClub(e.target.value)} placeholder="e.g. Berlin Running Club (optional)" />
          </Field>

          {/* Bio */}
          <Field label="Bio *">
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

          <button className="btn-v3 btn-primary-v3" style={st.saveBtn} onClick={handleSave} disabled={saving}>
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
    inset: 0,
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
    overscrollBehavior: 'contain',
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
    paddingBottom: 'calc(var(--safe-bottom) + 32px)',
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
    width: '100%',
    marginTop: '4px',
    padding: '14px',
  } as React.CSSProperties,
}

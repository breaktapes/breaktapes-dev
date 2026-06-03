import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Injury, InjuryBodyPart, InjuryPhase, InjuryType } from '@/types'
import { INJURY_BODY_PARTS, INJURY_PHASES, INJURY_TYPES } from '@/types'
import { useAthleteStore } from '@/stores/useAthleteStore'

interface Props {
  injury?: Injury | null   // null = add mode, Injury = edit mode
  onClose: () => void
}

type Step = 1 | 2 | 3

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function InjuryLogModal({ injury, onClose }: Props) {
  const addInjury    = useAthleteStore(s => s.addInjury)
  const updateInjury = useAthleteStore(s => s.updateInjury)
  const resolveInjury = useAthleteStore(s => s.resolveInjury)
  const deleteInjury = useAthleteStore(s => s.deleteInjury)

  const isEdit = !!injury

  const [step, setStep]           = useState<Step>(1)
  const [bodyPart, setBodyPart]   = useState<InjuryBodyPart>(injury?.bodyPart ?? 'knee')
  const [injuryType, setType]     = useState<InjuryType>(injury?.injuryType ?? 'tendinopathy')
  const [severity, setSeverity]   = useState<'mild'|'moderate'|'severe'>(injury?.severity ?? 'mild')
  const [phase, setPhase]         = useState<InjuryPhase>(injury?.phase ?? 'rest')
  const [startDate, setStart]     = useState(injury?.startDate ?? todayStr())
  const [returnDate, setReturn]   = useState(injury?.returnDate ?? '')
  const [notes, setNotes]         = useState(injury?.notes ?? '')
  const [showDelete, setShowDelete] = useState(false)

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function handleSave() {
    const patch = { bodyPart, injuryType, severity, phase, startDate, returnDate: returnDate || undefined, notes: notes || undefined, resolved: false }
    if (isEdit && injury) {
      updateInjury(injury.id, patch)
    } else {
      addInjury(patch)
    }
    onClose()
  }

  function handleResolve() {
    if (injury) resolveInjury(injury.id)
    onClose()
  }

  function handleDelete() {
    if (injury) deleteInjury(injury.id)
    onClose()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s: Record<string, any> = {
    backdrop: {
      position: 'fixed', inset: 0, zIndex: 900,
      background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    },
    sheet: {
      background: 'var(--surface2)',
      borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
      width: '100%', maxWidth: 480,
      maxHeight: '92dvh',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
      overscrollBehavior: 'contain',
    },
    header: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: 'var(--sp-4) var(--sp-4) 0',
      flexShrink: 0,
    },
    title: {
      fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-xl)',
      letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)',
    },
    close: {
      background: 'none', border: 'none', cursor: 'pointer',
      color: 'var(--muted)', fontSize: 'var(--text-lg)', padding: 'var(--sp-1)',
    },
    steps: {
      display: 'flex', gap: 'var(--sp-1)', padding: '0 var(--sp-4)',
      marginTop: 'var(--sp-3)',
    },
    stepDot: (active: boolean, done: boolean) => ({
      flex: 1, height: 3, borderRadius: 2,
      background: done ? 'var(--orange)' : active ? 'var(--orange)' : 'var(--surface3)',
      opacity: done ? 0.5 : 1,
    }),
    body: { padding: 'var(--sp-4)', flexGrow: 1 },
    label: {
      fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-xs)',
      letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--orange)',
      marginBottom: 'var(--sp-2)', display: 'block',
    },
    grid2: {
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)',
    },
    partBtn: (active: boolean) => ({
      background: active ? 'rgba(var(--orange-ch), 0.15)' : 'var(--surface3)',
      border: `1px solid ${active ? 'var(--orange)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-sm)', padding: 'var(--sp-2) var(--sp-3)',
      color: active ? 'var(--orange)' : 'var(--white)',
      fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-sm)',
      cursor: 'pointer', textAlign: 'left' as const, display: 'flex', gap: 'var(--sp-1)',
    }),
    select: {
      width: '100%', background: 'var(--surface3)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', color: 'var(--white)', padding: 'var(--sp-2) var(--sp-3)',
      fontFamily: 'var(--headline)', fontSize: 'var(--text-sm)', height: 40,
      appearance: 'none' as const, WebkitAppearance: 'none' as const,
    },
    sevRow: { display: 'flex', gap: 'var(--sp-2)' },
    sevBtn: (active: boolean, color: string) => ({
      flex: 1, padding: 'var(--sp-2)', borderRadius: 'var(--radius-sm)',
      border: `1px solid ${active ? color : 'var(--border)'}`,
      background: active ? `${color}22` : 'var(--surface3)',
      color: active ? color : 'var(--muted)',
      fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-xs)',
      letterSpacing: '0.1em', textTransform: 'uppercase' as const, cursor: 'pointer',
    }),
    phaseRow: { display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap' as const },
    phaseBtn: (active: boolean) => ({
      padding: 'var(--sp-1) var(--sp-2)', borderRadius: 'var(--radius-sm)',
      border: `1px solid ${active ? 'var(--orange)' : 'var(--border)'}`,
      background: active ? 'rgba(var(--orange-ch), 0.15)' : 'var(--surface3)',
      color: active ? 'var(--orange)' : 'var(--muted)',
      fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 'var(--text-xs)',
      letterSpacing: '0.08em', textTransform: 'uppercase' as const, cursor: 'pointer',
    }),
    input: {
      width: '100%', background: 'var(--surface3)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', color: 'var(--white)', padding: 'var(--sp-2) var(--sp-3)',
      fontFamily: 'var(--headline)', fontSize: 'var(--text-sm)', height: 40, boxSizing: 'border-box' as const,
      appearance: 'none' as const, WebkitAppearance: 'none' as const, maxWidth: '100%',
    },
    textarea: {
      width: '100%', background: 'var(--surface3)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', color: 'var(--white)', padding: 'var(--sp-2) var(--sp-3)',
      fontFamily: 'var(--body)', fontSize: 'var(--text-sm)', minHeight: 72, resize: 'vertical' as const,
      boxSizing: 'border-box' as const,
    },
    disclaimer: {
      fontSize: 'var(--text-xs)', color: 'var(--muted2)', marginTop: 'var(--sp-3)',
      lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-3)',
    },
    footer: {
      padding: 'var(--sp-3) var(--sp-4)', borderTop: '1px solid var(--border)',
      display: 'flex', gap: 'var(--sp-2)', flexShrink: 0,
    },
    btnPrimary: {
      flex: 1, background: 'var(--orange)', color: '#000', border: 'none',
      borderRadius: 'var(--radius-sm)', padding: 'var(--sp-2) var(--sp-4)',
      fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)',
      letterSpacing: '0.08em', textTransform: 'uppercase' as const, cursor: 'pointer',
    },
    btnGhost: {
      padding: 'var(--sp-2) var(--sp-3)', background: 'none',
      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
      color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700,
      fontSize: 'var(--text-sm)', cursor: 'pointer',
    },
    btnDanger: {
      padding: 'var(--sp-2) var(--sp-3)', background: 'none',
      border: '1px solid rgba(255,80,80,0.4)', borderRadius: 'var(--radius-sm)',
      color: 'rgba(255,80,80,0.8)', fontFamily: 'var(--headline)', fontWeight: 700,
      fontSize: 'var(--text-sm)', cursor: 'pointer',
    },
    divider: { height: 1, background: 'var(--border)', margin: 'var(--sp-4) 0' },
    sp3: { marginBottom: 'var(--sp-3)' },
  }

  const activePhasesForSelector = INJURY_PHASES.filter(p => p.key !== 'resolved')

  const content = (
    <div style={s.backdrop} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={s.sheet}>
        {/* Header */}
        <div style={s.header}>
          <span style={s.title}>{isEdit ? 'Edit injury' : 'Log injury'}</span>
          <button style={s.close} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Step indicators */}
        <div style={s.steps}>
          {[1, 2, 3].map(n => (
            <div key={n} style={s.stepDot(step === n, step > n)} />
          ))}
        </div>

        <div style={s.body}>
          {/* Step 1: Body part */}
          {step === 1 && (
            <>
              <span style={s.label}>Where is the injury?</span>
              <div style={s.grid2}>
                {INJURY_BODY_PARTS.map(p => (
                  <button key={p.key} style={s.partBtn(bodyPart === p.key)} onClick={() => setBodyPart(p.key)}>
                    <span>{p.emoji}</span> {p.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 2: Type + severity */}
          {step === 2 && (
            <>
              <div style={s.sp3}>
                <span style={s.label}>Injury type</span>
                <select style={s.select} value={injuryType} onChange={e => setType(e.target.value as InjuryType)}>
                  {INJURY_TYPES.map(t => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <span style={s.label}>Severity</span>
                <div style={s.sevRow}>
                  {(['mild', 'moderate', 'severe'] as const).map(sv => {
                    const color = sv === 'mild' ? 'var(--green)' : sv === 'moderate' ? '#FFB347' : 'var(--orange)'
                    return (
                      <button key={sv} style={s.sevBtn(severity === sv, color)} onClick={() => setSeverity(sv)}>
                        {sv}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* Step 3: Dates + phase + notes */}
          {step === 3 && (
            <>
              <div style={s.sp3}>
                <span style={s.label}>When did it start?</span>
                <input type="date" style={s.input} value={startDate} onChange={e => setStart(e.target.value)}
                  max={todayStr()} />
              </div>

              <div style={s.sp3}>
                <span style={s.label}>Current phase</span>
                <div style={s.phaseRow}>
                  {activePhasesForSelector.map(p => (
                    <button key={p.key} style={s.phaseBtn(phase === p.key)} onClick={() => setPhase(p.key)}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={s.sp3}>
                <span style={s.label}>Est. return date <span style={{ fontWeight: 400, textTransform: 'none' as const, letterSpacing: 0, color: 'var(--muted)' }}>(optional — your physio's target)</span></span>
                <input type="date" style={s.input} value={returnDate} onChange={e => setReturn(e.target.value)}
                  min={startDate} />
              </div>

              <div>
                <span style={s.label}>Notes <span style={{ fontWeight: 400, textTransform: 'none' as const, letterSpacing: 0, color: 'var(--muted)' }}>(optional)</span></span>
                <textarea style={s.textarea} value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Physio notes, symptoms, what aggravates it..." />
              </div>

              {isEdit && !injury?.resolved && (
                <>
                  <div style={s.divider} />
                  {!showDelete ? (
                    <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                      <button style={s.btnGhost} onClick={handleResolve}>✓ Mark resolved</button>
                      <button style={s.btnDanger} onClick={() => setShowDelete(true)}>Delete</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>Delete this injury log?</span>
                      <button style={s.btnDanger} onClick={handleDelete}>Yes, delete</button>
                      <button style={s.btnGhost} onClick={() => setShowDelete(false)}>Cancel</button>
                    </div>
                  )}
                </>
              )}

              <p style={s.disclaimer}>
                Injury information is for personal tracking only and is not medical advice.
                Always consult a physiotherapist or sports doctor for diagnosis and treatment.
              </p>
            </>
          )}
        </div>

        {/* Footer nav */}
        <div style={s.footer}>
          {step > 1 && (
            <button style={s.btnGhost} onClick={() => setStep(s => (s - 1) as Step)}>Back</button>
          )}
          {step < 3 ? (
            <button style={s.btnPrimary} onClick={() => setStep(s => (s + 1) as Step)}>
              Next →
            </button>
          ) : (
            <button style={s.btnPrimary} onClick={handleSave}>
              {isEdit ? 'Save changes' : 'Log injury'}
            </button>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

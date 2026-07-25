import React, { useMemo, useState } from 'react'
import { posthog } from '@/lib/posthog'
import { useAthleteStore } from '@/stores/useAthleteStore'
import type { Race, SavedWorkout } from '@/types'
import type { PaceZone } from '@/lib/raceFormulas'
import {
  blockPacePreview,
  buildCustomWorkoutNotes,
  createDefaultCustomBlocks,
  makeCustomWorkoutTitle,
  objectiveSubtitle,
  summarizeCustomWorkout,
  type CustomBlockType,
  type CustomBuilderObjective,
  type CustomUnitType,
  type CustomWorkoutBlock,
} from '@/lib/customWorkoutBuilder'

const sectionLabel: React.CSSProperties = {
  fontFamily: 'var(--headline)',
  fontWeight: 900,
  fontSize: 'var(--text-xs)',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  marginBottom: '0.75rem',
}

const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--text-xs)',
  color: 'var(--muted)',
  marginBottom: '6px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontFamily: 'var(--headline)',
  fontWeight: 700,
}

const textInput: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface3)',
  border: '1px solid var(--border2)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--white)',
  fontSize: 'var(--text-base)',
  padding: '0.65rem 0.85rem',
  fontFamily: 'var(--body)',
  boxSizing: 'border-box',
}

const btnMain: React.CSSProperties = {
  background: 'var(--orange)',
  color: 'var(--black)',
  border: 'none',
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
  background: 'var(--surface3)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--sp-3)',
}

const NUMERIC_STYLE: React.CSSProperties = {
  fontFamily: 'var(--num)',
  fontWeight: 600,
  letterSpacing: 'var(--num-track)',
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1, "zero" 1',
}

const OBJECTIVES: Array<{ id: CustomBuilderObjective; label: string }> = [
  { id: 'recovery', label: 'Recovery' },
  { id: 'aerobic', label: 'Aerobic' },
  { id: 'threshold', label: 'Threshold' },
  { id: 'interval', label: 'Interval' },
  { id: 'race-pace', label: 'Race Pace' },
]

const BLOCK_TYPES: Array<{ id: CustomBlockType; label: string }> = [
  { id: 'warmup', label: 'Warm-up' },
  { id: 'easy', label: 'Easy' },
  { id: 'marathon', label: 'Marathon' },
  { id: 'threshold', label: 'Threshold' },
  { id: 'interval', label: 'Interval' },
  { id: 'repetition', label: 'Repetition' },
  { id: 'cooldown', label: 'Cool-down' },
]

const BLOCK_LABELS: Record<CustomBlockType, string> = {
  warmup: 'Warm-up',
  easy: 'Easy',
  marathon: 'Marathon',
  threshold: 'Threshold',
  interval: 'Interval',
  repetition: 'Repetition',
  cooldown: 'Cool-down',
}

const tileCard: React.CSSProperties = {
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: 'var(--sp-3)',
  minHeight: '88px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function CustomWorkoutBuilder({
  activeZones,
  benchmarkLabel,
  nextRace,
  daysToNextRace,
}: {
  activeZones: PaceZone[] | null
  benchmarkLabel?: string | null
  nextRace: Race | null
  daysToNextRace: number | null
}) {
  const athlete = useAthleteStore(s => s.athlete)
  const updateAthlete = useAthleteStore(s => s.updateAthlete)
  const savedWorkouts = athlete?.savedWorkouts ?? []

  const [objective, setObjective] = useState<CustomBuilderObjective>('threshold')
  const [freshness, setFreshness] = useState<'fresh' | 'normal' | 'tired'>('normal')
  const [availableMinutes, setAvailableMinutes] = useState(70)
  const [blocks, setBlocks] = useState<CustomWorkoutBlock[]>(() => createDefaultCustomBlocks())

  const summary = useMemo(() => {
    if (!activeZones) return null
    return summarizeCustomWorkout({
      blocks,
      zones: activeZones,
      objective,
      nextRace,
      daysToRace: daysToNextRace,
      freshness,
    })
  }, [activeZones, blocks, objective, nextRace, daysToNextRace, freshness])

  const customSaved = savedWorkouts.filter(workout => workout.workoutType === 'custom').slice(0, 3)

  function updateBlock(id: string, patch: Partial<CustomWorkoutBlock>) {
    setBlocks(current => current.map(block => block.id === id ? { ...block, ...patch } : block))
  }

  function removeBlock(id: string) {
    setBlocks(current => current.length > 1 ? current.filter(block => block.id !== id) : current)
  }

  function addBlock(blockType: CustomBlockType = 'easy') {
    setBlocks(current => [
      ...current,
      {
        id: crypto.randomUUID(),
        blockType,
        unitType: 'time',
        value: blockType === 'threshold' || blockType === 'interval' ? 6 : 10,
        repeatCount: blockType === 'threshold' || blockType === 'interval' ? 3 : 1,
        recoveryValue: blockType === 'threshold' || blockType === 'interval' ? 2 : 0,
        recoveryUnitType: 'time',
        paceBias: blockType === 'warmup' || blockType === 'easy' || blockType === 'cooldown' ? 30 : 55,
      },
    ])
  }

  function loadSavedWorkout(workout: SavedWorkout) {
    const rebuilt = workout.segments.map(segment => {
      const label = segment.label.toLowerCase()
      let blockType: CustomBlockType = 'easy'
      if (label.includes('warm')) blockType = 'warmup'
      else if (label.includes('cool')) blockType = 'cooldown'
      else if (label.includes('threshold')) blockType = 'threshold'
      else if (label.includes('interval')) blockType = 'interval'
      else if (label.includes('marathon')) blockType = 'marathon'
      else if (label.includes('repetition')) blockType = 'repetition'
        return {
          id: crypto.randomUUID(),
          blockType,
          unitType: 'time' as CustomUnitType,
          value: 10,
          repeatCount: 1,
          recoveryValue: 0,
          recoveryUnitType: 'time' as CustomUnitType,
          paceBias: blockType === 'warmup' || blockType === 'easy' || blockType === 'cooldown' ? 30 : 55,
        }
      })
    if (rebuilt.length) setBlocks(rebuilt)
  }

  function saveCustomWorkout() {
    if (!summary) return
    const title = makeCustomWorkoutTitle(objective)
    const workout: SavedWorkout = {
      id: crypto.randomUUID(),
      workoutId: `custom-${blocks.map(block => block.blockType).join('-')}`,
      title,
      subtitle: objectiveSubtitle(objective, summary),
      rationale: summary.verdict,
      totalMinutes: Math.round(summary.totalMinutes),
      goalFocus: nextRace?.distance ?? 'general',
      workoutType: 'custom',
      benchmarkLabel: benchmarkLabel ?? undefined,
      savedAt: todayStr(),
      segments: summary.savedSegments,
      notes: buildCustomWorkoutNotes(summary),
    }
    updateAthlete({
      savedWorkouts: [workout, ...savedWorkouts.filter(existing => existing.workoutId !== workout.workoutId)].slice(0, 16),
    })
    posthog.capture('custom_workout_saved', {
      objective,
      total_minutes: Math.round(summary.totalMinutes),
      estimated_load: summary.estimatedLoad,
      block_count: blocks.length,
    })
  }

  if (!activeZones) {
    return (
      <div style={card}>
        <p style={sectionLabel}>Custom Builder</p>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--muted)', lineHeight: 1.55 }}>
          Calculate or save a benchmark first so BREAKTAPES can translate your blocks into real paces, load, and coaching insight.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-3)', alignItems: 'flex-start', marginBottom: 'var(--sp-3)' }}>
          <div>
            <p style={sectionLabel}>Custom Builder</p>
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--muted)', lineHeight: 1.5 }}>
              Build your own session block by block. BREAKTAPES will estimate the load, classify the stimulus, and tell you whether the workout is helping or hurting your current race build.
            </p>
          </div>
          <div style={{ ...NUMERIC_STYLE, textAlign: 'right', color: 'var(--orange)', fontSize: 'var(--text-lg)' }}>
            {availableMinutes}m
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <div style={{ ...card, padding: 'var(--sp-3)', background: 'var(--surface2)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.7fr', gap: 'var(--sp-2)' }}>
              <div style={tileCard}>
                <label style={fieldLabel}>Session Objective</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
                  {OBJECTIVES.map(option => (
                    <button
                      key={option.id}
                      onClick={() => setObjective(option.id)}
                      style={{
                        padding: '7px 4px',
                        background: objective === option.id ? 'rgba(var(--orange-ch),0.12)' : 'var(--surface3)',
                        border: `1px solid ${objective === option.id ? 'rgba(var(--orange-ch),0.4)' : 'var(--border2)'}`,
                        borderRadius: 'var(--radius-sm)',
                        color: objective === option.id ? 'var(--orange)' : 'var(--muted)',
                        fontFamily: 'var(--headline)',
                        fontWeight: 700,
                        fontSize: 'var(--text-xs)',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={tileCard}>
                <label style={fieldLabel}>Freshness</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                  {(['fresh', 'normal', 'tired'] as const).map(option => (
                    <button
                      key={option}
                      onClick={() => setFreshness(option)}
                      style={{
                        padding: '7px 4px',
                        background: freshness === option ? 'rgba(var(--orange-ch),0.12)' : 'var(--surface3)',
                        border: `1px solid ${freshness === option ? 'rgba(var(--orange-ch),0.4)' : 'var(--border2)'}`,
                        borderRadius: 'var(--radius-sm)',
                        color: freshness === option ? 'var(--orange)' : 'var(--muted)',
                        fontFamily: 'var(--headline)',
                        fontWeight: 700,
                        fontSize: 'var(--text-xs)',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                      }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <div style={tileCard}>
                <label style={fieldLabel}>Available Time</label>
                <input
                  type="number"
                  min={20}
                  max={180}
                  value={availableMinutes}
                  onChange={e => setAvailableMinutes(Math.max(20, Math.min(180, parseInt(e.target.value, 10) || 20)))}
                  style={textInput}
                />
              </div>
            </div>
          </div>

          <div style={{ ...card, padding: 'var(--sp-3)', background: 'var(--surface2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-2)' }}>
              <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', color: 'var(--white)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Session Blocks
              </div>
              <button onClick={() => addBlock('easy')} style={{ ...btnMain, padding: '0.55rem 0.9rem', fontSize: 'var(--text-xs)' }}>
                Add Block
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {blocks.map(block => (
                <div key={block.id} style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 'var(--sp-3)', minHeight: block.repeatCount > 1 ? '224px' : '184px' }}>
                  {(() => {
                    const pacePreview = blockPacePreview(block, activeZones)
                    return (
                      <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--sp-2)', marginBottom: '10px' }}>
                    <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', color: 'var(--white)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      {BLOCK_LABELS[block.blockType]}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', lineHeight: 1.4, textAlign: 'right' }}>
                      {block.repeatCount > 1
                        ? `${block.repeatCount} x ${block.value} ${block.unitType === 'time' ? 'min' : 'km'}${block.recoveryValue > 0 ? ` • ${block.recoveryValue} ${block.recoveryUnitType === 'time' ? 'min' : 'km'} rec` : ''}`
                        : `${block.value} ${block.unitType === 'time' ? 'min' : 'km'}`}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.8fr 0.72fr 0.72fr', gap: 'var(--sp-2)', alignItems: 'end' }}>
                    <div>
                      <label style={fieldLabel}>Block</label>
                      <select
                        value={block.blockType}
                        onChange={e => updateBlock(block.id, { blockType: e.target.value as CustomBlockType })}
                        style={textInput}
                      >
                        {BLOCK_TYPES.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={fieldLabel}>Unit</label>
                      <select
                        value={block.unitType}
                        onChange={e => updateBlock(block.id, { unitType: e.target.value as CustomUnitType })}
                        style={textInput}
                      >
                        <option value="time">Time</option>
                        <option value="distance">Distance</option>
                      </select>
                    </div>
                    <div>
                      <label style={fieldLabel}>{block.unitType === 'time' ? 'Min' : 'Km'}</label>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={block.value}
                        onChange={e => updateBlock(block.id, { value: Math.max(1, parseFloat(e.target.value) || 1) })}
                        style={textInput}
                      />
                    </div>
                    <div>
                      <label style={fieldLabel}>Reps</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={block.repeatCount}
                        onChange={e => updateBlock(block.id, { repeatCount: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        style={textInput}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', padding: '10px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--sp-2)', marginBottom: '8px' }}>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--headline)', fontWeight: 700 }}>
                        Pace Range
                      </div>
                      <div style={{ ...NUMERIC_STYLE, fontSize: 'var(--text-sm)', color: 'var(--orange)' }}>
                        {pacePreview.target}
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={block.paceBias}
                      onChange={e => updateBlock(block.id, { paceBias: parseInt(e.target.value, 10) || 0 })}
                      style={{ width: '100%', accentColor: 'var(--orange)', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                      <span>{pacePreview.min}</span>
                      <span>{pacePreview.max}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 'var(--sp-2)', marginTop: '10px' }}>
                    {block.repeatCount > 1 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 0.7fr', gap: '4px', flex: 1 }}>
                        <div>
                          <label style={fieldLabel}>Recovery Unit</label>
                          <select
                            value={block.recoveryUnitType}
                            onChange={e => updateBlock(block.id, { recoveryUnitType: e.target.value as CustomUnitType })}
                            style={textInput}
                          >
                            <option value="time">Time</option>
                            <option value="distance">Distance</option>
                          </select>
                        </div>
                        <div>
                          <label style={fieldLabel}>{block.recoveryUnitType === 'time' ? 'Recovery Min' : 'Recovery Km'}</label>
                          <input
                            type="number"
                            min={0}
                            max={20}
                            value={block.recoveryValue}
                            onChange={e => updateBlock(block.id, { recoveryValue: Math.max(0, parseFloat(e.target.value) || 0) })}
                            style={textInput}
                          />
                        </div>
                      </div>
                    ) : <div />}
                    <button
                      onClick={() => removeBlock(block.id)}
                      style={{ ...textInput, cursor: 'pointer', width: 'auto', color: 'var(--muted)', padding: '0.65rem 0.9rem', minWidth: '92px' }}
                    >
                      Remove
                    </button>
                  </div>
                      </>
                    )
                  })()}
                </div>
              ))}
            </div>
          </div>

          {summary && (
            <>
              <div style={{ ...card, background: 'linear-gradient(180deg, rgba(var(--orange-ch),0.06), rgba(255,255,255,0.01)), var(--surface2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-2)', alignItems: 'flex-start', marginBottom: 'var(--sp-2)' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', color: 'var(--orange)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        Live Session View
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '4px', lineHeight: 1.5 }}>
                        {nextRace ? `${nextRace.name} • ${daysToNextRace ?? '—'}d to race` : 'No target race selected'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ ...NUMERIC_STYLE, fontSize: 'var(--text-xl)', color: 'var(--white)' }}>{summary.estimatedLoad}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>est load</div>
                    </div>
                  </div>

                  <div style={{ position: 'relative', display: 'flex', alignItems: 'end', gap: '8px', minHeight: '160px', padding: '18px 16px 16px', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)), #111' }}>
                    {summary.visualSegments.map(segment => (
                      <div
                        key={segment.id}
                        title={`${segment.label} • ${segment.paceLabel}`}
                        style={{
                          flex: segment.width,
                          minWidth: '20px',
                          height: `${segment.height}px`,
                          borderRadius: '16px 16px 8px 8px',
                          background: segment.color,
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'center',
                          paddingBottom: '10px',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 18px rgba(0,0,0,0.18)',
                        }}
                      >
                        <span style={{ ...NUMERIC_STYLE, fontSize: '10px', color: 'rgba(255,255,255,0.9)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                          {segment.shortLabel}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-2)', marginTop: '10px', fontSize: '10px', color: 'var(--muted2)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--headline)', fontWeight: 700 }}>
                    <span>Slower pace</span>
                    <span>Faster pace = taller bar</span>
                  </div>
              </div>

              <div style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-2)' }}>
                  {[
                    ['Total time', `${Math.round(summary.totalMinutes)} min`],
                    ['Est distance', `${summary.totalDistanceKm.toFixed(1)} km`],
                    ['Quality', `${Math.round(summary.qualityMinutes)} min`],
                    ['Easy', `${Math.round(summary.easyMinutes)} min`],
                  ].map(([label, value]) => (
                    <div key={label} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--headline)', fontWeight: 700 }}>{label}</div>
                      <div style={{ ...NUMERIC_STYLE, fontSize: 'var(--text-lg)', color: 'var(--white)', marginTop: '4px' }}>{value}</div>
                    </div>
                  ))}
              </div>

              <div style={{ ...card, background: 'var(--surface2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-2)', alignItems: 'baseline', marginBottom: '8px' }}>
                    <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', color: 'var(--white)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      Coaching Verdict
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: summary.fitLabel === 'High fit' ? 'var(--green)' : 'var(--orange)', fontFamily: 'var(--headline)', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {summary.fitLabel}
                    </div>
                  </div>
                  <p style={{ margin: '0 0 10px', fontSize: 'var(--text-sm)', color: 'var(--white)', lineHeight: 1.55 }}>
                    {summary.verdict}
                  </p>
                  <div style={{ display: 'grid', gap: '6px', marginBottom: summary.suggestions.length ? '10px' : 0 }}>
                    {summary.risks.slice(0, 1).map(risk => (
                      <div key={risk} style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', lineHeight: 1.45 }}>
                        {risk}
                      </div>
                    ))}
                  </div>
                  {summary.suggestions.length > 0 && (
                    <div style={{ paddingTop: '10px', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
                      <div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--headline)', fontWeight: 700, marginBottom: '6px' }}>
                        BREAKTAPES would change
                      </div>
                      {summary.suggestions.slice(0, 2).map(suggestion => (
                        <div key={suggestion} style={{ fontSize: 'var(--text-xs)', color: 'var(--white)', lineHeight: 1.45, marginBottom: '4px' }}>
                          {suggestion}
                        </div>
                      ))}
                      </div>
                      <div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--headline)', fontWeight: 700, marginBottom: '6px' }}>
                          Session Read
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--white)', lineHeight: 1.45 }}>
                          {summary.primaryStimulus} is the main payoff, with {summary.secondaryStimulus.toLowerCase()} as the secondary effect.
                        </div>
                      </div>
                    </div>
                  )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: customSaved.length > 0 ? '0.95fr 1.05fr' : '1fr', gap: 'var(--sp-3)' }}>
                <button onClick={saveCustomWorkout} style={{ ...btnMain, width: '100%', minHeight: '48px' }}>
                  Save Custom Workout
                </button>

                {customSaved.length > 0 && (
                  <div style={{ ...card, background: 'var(--surface2)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--headline)', fontWeight: 700, marginBottom: '8px' }}>
                      Saved Custom Workouts
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {customSaved.map(workout => (
                        <button
                          key={workout.id}
                          onClick={() => loadSavedWorkout(workout)}
                          style={{ ...textInput, textAlign: 'left', cursor: 'pointer', background: 'var(--surface2)' }}
                        >
                          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 'var(--text-sm)', color: 'var(--white)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            {workout.title}
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '4px' }}>
                            {workout.subtitle}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
	            </>
	          )}
        </div>
      </div>
    </div>
  )
}

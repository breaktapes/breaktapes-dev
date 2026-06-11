import { describe, it, expect } from 'vitest'
import { dedupeWorkouts } from '@/lib/dedupeWorkouts'
import type { OWWorkout } from '@/lib/openWearables'

function w(overrides: Partial<OWWorkout>): OWWorkout {
  return {
    id: Math.random().toString(36).slice(2),
    provider: 'strava',
    sport_type: 'running',
    started_at: '2026-06-10T06:00:00Z',
    duration_seconds: 3600,
    distance_meters: 10000,
    average_heart_rate: 150,
    name: 'Morning Run',
    ...overrides,
  }
}

describe('dedupeWorkouts', () => {
  it('passes through unrelated workouts unchanged', () => {
    const a = w({ started_at: '2026-06-10T06:00:00Z' })
    const b = w({ started_at: '2026-06-09T06:00:00Z' })
    const out = dedupeWorkouts([a, b])
    expect(out).toHaveLength(2)
    expect(out[0].sources).toEqual(['strava'])
  })

  it('merges same session from two providers within the start window', () => {
    const strava = w({ provider: 'strava' })
    const whoop = w({
      provider: 'whoop',
      started_at: '2026-06-10T06:02:30Z', // +2.5 min
      duration_seconds: 3550,             // within 10%
      distance_meters: null,
      name: null,
    })
    const out = dedupeWorkouts([strava, whoop])
    expect(out).toHaveLength(1)
    expect(out[0].provider).toBe('strava') // richer record wins
    expect(out[0].sources).toEqual(['strava', 'whoop'])
  })

  it('does not merge workouts more than 5 minutes apart', () => {
    const a = w({ provider: 'strava' })
    const b = w({ provider: 'whoop', started_at: '2026-06-10T06:06:01Z' })
    expect(dedupeWorkouts([a, b])).toHaveLength(2)
  })

  it('does not merge same-start workouts with very different durations', () => {
    const run = w({ provider: 'strava', duration_seconds: 3600 })
    const stretch = w({ provider: 'whoop', duration_seconds: 1200, distance_meters: null })
    expect(dedupeWorkouts([run, stretch])).toHaveLength(2)
  })

  it('folds missing metrics from the duplicate into the base record', () => {
    const strava = w({ provider: 'strava', average_heart_rate: null })
    const whoop = w({ provider: 'whoop', distance_meters: null, name: null, average_heart_rate: 162 })
    const out = dedupeWorkouts([strava, whoop])
    expect(out).toHaveLength(1)
    expect(out[0].average_heart_rate).toBe(162)
    expect(out[0].distance_meters).toBe(10000)
    expect(out[0].name).toBe('Morning Run')
  })

  it('prefers the richer record even when WHOOP comes first', () => {
    const whoop = w({ provider: 'whoop', distance_meters: null, name: null })
    const strava = w({ provider: 'strava' })
    const out = dedupeWorkouts([whoop, strava])
    expect(out[0].provider).toBe('strava')
  })

  it('merges a three-way duplicate (WHOOP push to Strava case)', () => {
    const strava = w({ provider: 'strava' })
    const stravaFromWhoop = w({ provider: 'strava', started_at: '2026-06-10T06:01:00Z', name: 'WHOOP Running' })
    const whoop = w({ provider: 'whoop', started_at: '2026-06-10T06:00:30Z', distance_meters: null, name: null })
    const out = dedupeWorkouts([strava, stravaFromWhoop, whoop])
    expect(out).toHaveLength(1)
    expect(out[0].sources).toEqual(['strava', 'whoop'])
  })

  it('treats missing duration as a match when start times align', () => {
    const a = w({ provider: 'strava' })
    const b = w({ provider: 'whoop', duration_seconds: 0, distance_meters: null })
    expect(dedupeWorkouts([a, b])).toHaveLength(1)
  })

  it('ignores workouts with unparseable start times instead of crashing', () => {
    const a = w({})
    const b = w({ provider: 'whoop', started_at: 'not-a-date' })
    const out = dedupeWorkouts([a, b])
    expect(out).toHaveLength(2)
  })

  it('breaks an equal-richness tie by provider priority (strava over whoop)', () => {
    const whoop = w({ provider: 'whoop' })   // fully rich
    const strava = w({ provider: 'strava' }) // equally rich, listed second
    const out = dedupeWorkouts([whoop, strava])
    expect(out).toHaveLength(1)
    expect(out[0].provider).toBe('strava')
  })

  it('handles unknown providers without crashing and ranks them last', () => {
    const mystery = w({ provider: 'oura' as never })
    const strava = w({ provider: 'strava' })
    const out = dedupeWorkouts([mystery, strava])
    expect(out).toHaveLength(1)
    expect(out[0].provider).toBe('strava')
    expect(out[0].sources).toEqual(['strava', 'oura'])
  })

  it('never merges two clearly different sports at the same start time', () => {
    const ride = w({ provider: 'strava', sport_type: 'cycling' })
    const lift = w({ provider: 'whoop', sport_type: 'weightlifting', distance_meters: null })
    expect(dedupeWorkouts([ride, lift])).toHaveLength(2)
  })

  it('merges when one sport label is unknown or unrecognized', () => {
    const run = w({ provider: 'strava', sport_type: 'running' })
    const mystery = w({ provider: 'whoop', sport_type: 'activity', distance_meters: null, name: null })
    expect(dedupeWorkouts([run, mystery])).toHaveLength(1)
  })

  it('does not chain groups transitively past the start window', () => {
    const a = w({ started_at: '2026-06-10T06:00:00Z' })
    const b = w({ provider: 'whoop', started_at: '2026-06-10T06:04:00Z', distance_meters: null })
    const c = w({ provider: 'garmin', started_at: '2026-06-10T06:08:00Z', name: null })
    const out = dedupeWorkouts([a, b, c])
    // b merges with a (anchor), c is 8min from anchor a — stays separate
    expect(out).toHaveLength(2)
  })

  it('folds duration from a duplicate when the base record has none', () => {
    const strava = w({ provider: 'strava', duration_seconds: 0 })
    const whoop = w({ provider: 'whoop', distance_meters: null, name: null, duration_seconds: 3600 })
    const out = dedupeWorkouts([strava, whoop])
    expect(out).toHaveLength(1)
    expect(out[0].duration_seconds).toBe(3600)
  })

  it('sorts sources by provider priority even when WHOOP arrives first', () => {
    const whoop = w({ provider: 'whoop', distance_meters: null, name: null })
    const strava = w({ provider: 'strava' })
    const out = dedupeWorkouts([whoop, strava])
    expect(out[0].sources).toEqual(['strava', 'whoop'])
  })
})

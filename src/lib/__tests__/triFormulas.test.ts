import { describe, it, expect } from 'vitest'
import type { Race } from '@/types'
import {
  detectTriType, isTriRace, extractTriLegs, predictTriathlon,
  defaultTriTarget, hasTriSplitData, TRI_TYPES, triTypeByKey,
} from '../triFormulas'

const NOW = new Date('2026-06-02T00:00:00').getTime()

function tri(over: Partial<Race> = {}): Race {
  return {
    id: over.id ?? 'r1', name: 'Test Tri', date: '2026-04-01',
    city: '', country: '', distance: '51.5', sport: 'triathlon',
    outcome: 'Finished', ...over,
  }
}

const OLY_SPLITS = [
  { label: 'Swim', split: '0:25:00' },
  { label: 'T1',   split: '0:02:00' },
  { label: 'Bike', split: '1:10:00' },
  { label: 'T2',   split: '0:01:30' },
  { label: 'Run',  split: '0:45:00' },
]

describe('detectTriType', () => {
  it('buckets canonical distances', () => {
    expect(detectTriType(25.75)?.key).toBe('sprint')
    expect(detectTriType(51.5)?.key).toBe('olympic')
    expect(detectTriType(113)?.key).toBe('70.3')
    expect(detectTriType(226)?.key).toBe('ironman')
  })
  it('returns null for non-positive', () => {
    expect(detectTriType(0)).toBeNull()
  })
})

describe('isTriRace', () => {
  it('matches tri and iron sports', () => {
    expect(isTriRace(tri({ sport: 'triathlon' }))).toBe(true)
    expect(isTriRace(tri({ sport: 'IRONMAN' }))).toBe(true)
    expect(isTriRace(tri({ sport: 'running' }))).toBe(false)
  })
})

describe('extractTriLegs', () => {
  it('parses per-segment splits', () => {
    const legs = extractTriLegs(tri({ splits: OLY_SPLITS }))
    expect(legs.swim).toBe(1500)
    expect(legs.t1).toBe(120)
    expect(legs.bike).toBe(4200)
    expect(legs.t2).toBe(90)
    expect(legs.run).toBe(2700)
  })
  it('derives legs from cumulative when no per-segment split', () => {
    const legs = extractTriLegs(tri({ splits: [
      { label: 'Swim', cumulative: '0:25:00' },
      { label: 'Bike', cumulative: '1:35:00' },
      { label: 'Run',  cumulative: '2:20:00' },
    ] }))
    expect(legs.swim).toBe(1500)
    expect(legs.bike).toBe(4200)
    expect(legs.run).toBe(2700)
  })
  it('returns empty for no splits', () => {
    expect(extractTriLegs(tri({ splits: [] }))).toEqual({})
  })
})

describe('predictTriathlon', () => {
  it('returns null with no usable data', () => {
    expect(predictTriathlon([], 'olympic', NOW)).toBeNull()
  })

  it('predicts same-distance from one tri (alpha favors empirical)', () => {
    const pred = predictTriathlon([tri({ splits: OLY_SPLITS })], 'olympic', NOW)
    expect(pred).not.toBeNull()
    // swim+t1+bike+t2+run = 1500+120+4200+90+2700 = 8610s
    expect(pred!.totalSecs).toBeCloseTo(8610, 0)
    expect(pred!.type.key).toBe('olympic')
    expect(pred!.sampleCount).toBe(1)
    expect(pred!.legs.map(l => l.key)).toEqual(['swim', 't1', 'bike', 't2', 'run'])
  })

  it('scales an Olympic input up to a 70.3 target via Riegel', () => {
    const pred = predictTriathlon([tri({ splits: OLY_SPLITS })], '70.3', NOW)!
    // every projected leg should grow vs the Olympic actual
    const swim = pred.legs.find(l => l.key === 'swim')!
    const bike = pred.legs.find(l => l.key === 'bike')!
    const run = pred.legs.find(l => l.key === 'run')!
    expect(swim.secs).toBeGreaterThan(1500)
    expect(bike.secs).toBeGreaterThan(4200)
    expect(run.secs).toBeGreaterThan(2700)
    expect(pred.hasCrossBand).toBe(true)
  })

  it('uses transition defaults when input has no T1/T2', () => {
    const pred = predictTriathlon([tri({ splits: [
      { label: 'Swim', split: '0:25:00' },
      { label: 'Bike', split: '1:10:00' },
      { label: 'Run',  split: '0:45:00' },
    ] })], 'olympic', NOW)!
    const t1 = pred.legs.find(l => l.key === 't1')!
    expect(t1.source).toBe('default')
    expect(t1.secs).toBe(triTypeByKey('olympic').t1Default)
  })

  it('alpha rises with more same-band tris', () => {
    const one = predictTriathlon([tri({ id: 'a', splits: OLY_SPLITS })], 'olympic', NOW)!
    const many = predictTriathlon([
      tri({ id: 'a', date: '2026-05-01', splits: OLY_SPLITS }),
      tri({ id: 'b', date: '2026-03-01', splits: OLY_SPLITS }),
      tri({ id: 'c', date: '2026-01-01', splits: OLY_SPLITS }),
      tri({ id: 'd', date: '2025-11-01', splits: OLY_SPLITS }),
    ], 'olympic', NOW)!
    expect(many.alpha).toBeGreaterThan(one.alpha)
    expect(many.sampleCount).toBe(4)
  })

  it('falls back to running PB when no tri splits exist', () => {
    const run: Race = tri({ id: 'run1', sport: 'running', distance: '10', time: '0:40:00', splits: undefined })
    const pred = predictTriathlon([run], 'olympic', NOW)!
    const runLeg = pred.legs.find(l => l.key === 'run')!
    expect(runLeg.source).toBe('engine')
    expect(runLeg.secs).toBeGreaterThan(0)
    const swimLeg = pred.legs.find(l => l.key === 'swim')!
    expect(swimLeg.time).toBe('—')   // no swim data
  })

  it('confidence band brackets the total', () => {
    const pred = predictTriathlon([tri({ splits: OLY_SPLITS })], 'olympic', NOW)!
    expect(pred.band.lowSecs).toBeLessThan(pred.totalSecs)
    expect(pred.band.highSecs).toBeGreaterThan(pred.totalSecs)
  })

  it('ignores DNF tris', () => {
    expect(predictTriathlon([tri({ outcome: 'DNF', splits: OLY_SPLITS })], 'olympic', NOW)).toBeNull()
  })
})

describe('defaultTriTarget', () => {
  it('prefers the next upcoming triathlon distance', () => {
    const races = [tri({ id: 'p', distance: '226', sport: 'IRONMAN', splits: OLY_SPLITS })]
    const upcoming = [tri({ id: 'u', distance: '113', date: '2026-08-01' })]
    expect(defaultTriTarget(races, upcoming)).toBe('70.3')
  })
  it('falls back to most-raced tri type', () => {
    const races = [
      tri({ id: '1', distance: '25.75' }),
      tri({ id: '2', distance: '25.75' }),
      tri({ id: '3', distance: '51.5' }),
    ]
    expect(defaultTriTarget(races, [])).toBe('sprint')
  })
  it('defaults to olympic with no data', () => {
    expect(defaultTriTarget([], [])).toBe('olympic')
  })
})

describe('hasTriSplitData', () => {
  it('true when a tri has splits', () => {
    expect(hasTriSplitData([tri({ splits: OLY_SPLITS })])).toBe(true)
  })
  it('false for running-only or split-less tris', () => {
    expect(hasTriSplitData([tri({ sport: 'running', splits: OLY_SPLITS })])).toBe(false)
    expect(hasTriSplitData([tri({ splits: [] })])).toBe(false)
  })
})

describe('TRI_TYPES', () => {
  it('has four canonical distances', () => {
    expect(TRI_TYPES.map(t => t.key)).toEqual(['sprint', 'olympic', '70.3', 'ironman'])
  })
})

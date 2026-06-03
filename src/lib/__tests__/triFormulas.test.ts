import { describe, it, expect } from 'vitest'
import type { Race } from '@/types'
import {
  detectTriType, isTriRace, extractTriLegs, predictTriathlon,
  defaultTriTarget, hasTriSplitData, TRI_TYPES, triTypeByKey,
} from '../triFormulas'

function mkRace(over: Partial<Race>): Race {
  return {
    id: over.id ?? 'rx', name: over.name ?? 'Race', date: over.date ?? '2026-04-01',
    city: '', country: '', distance: over.distance ?? '10', sport: over.sport ?? '',
    outcome: over.outcome ?? 'Finished', ...over,
  }
}

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

  it('uses standalone swim race as engine fallback for swim leg', () => {
    const swimRace = mkRace({ id: 'sw1', sport: 'Swimming', distance: '1.5', time: '0:25:00' })
    const pred = predictTriathlon([swimRace], 'olympic', NOW)!
    expect(pred).not.toBeNull()
    const swimLeg = pred.legs.find(l => l.key === 'swim')!
    expect(swimLeg.source).toBe('engine')
    expect(swimLeg.secs).toBeGreaterThan(0)
    expect(swimLeg.time).not.toBe('—')
  })

  it('uses standalone bike race as engine fallback for bike leg', () => {
    const bikeRace = mkRace({ id: 'bk1', sport: 'Cycling', distance: '40', time: '1:10:00' })
    const pred = predictTriathlon([bikeRace], 'olympic', NOW)!
    expect(pred).not.toBeNull()
    const bikeLeg = pred.legs.find(l => l.key === 'bike')!
    expect(bikeLeg.source).toBe('engine')
    expect(bikeLeg.secs).toBeGreaterThan(0)
    expect(bikeLeg.time).not.toBe('—')
  })

  it('uses swim split from a tri race as engine fallback', () => {
    // Tri race with only swim split — no standalone sport=swim race needed
    const triWithSwim = tri({ id: 't2', splits: [{ label: 'Swim', split: '0:25:00' }] })
    const pred = predictTriathlon([triWithSwim], 'olympic', NOW)!
    const swimLeg = pred.legs.find(l => l.key === 'swim')!
    // empirical picks it up first via samples['swim'] — source is empirical
    expect(swimLeg.secs).toBeGreaterThan(0)
    expect(swimLeg.time).not.toBe('—')
  })

  it('uses bike split from a tri race as engine fallback', () => {
    const triWithBike = tri({ id: 't3', splits: [{ label: 'Bike', split: '1:10:00' }] })
    const pred = predictTriathlon([triWithBike], 'olympic', NOW)!
    const bikeLeg = pred.legs.find(l => l.key === 'bike')!
    expect(bikeLeg.secs).toBeGreaterThan(0)
    expect(bikeLeg.time).not.toBe('—')
  })

  it('blends empirical + swim engine when both exist', () => {
    const swimRace = mkRace({ id: 'sw2', sport: 'open water swim', distance: '1.5', time: '0:22:00' })
    const pred = predictTriathlon([tri({ splits: OLY_SPLITS }), swimRace], 'olympic', NOW)!
    const swimLeg = pred.legs.find(l => l.key === 'swim')!
    // alpha > 0 (has a tri with splits), engine also exists → blend
    expect(swimLeg.source).toBe('blend')
  })

  it('blends empirical + bike engine when both exist', () => {
    const bikeRace = mkRace({ id: 'bk3', sport: 'Cycling', distance: '40', time: '1:05:00' })
    const pred = predictTriathlon([tri({ splits: OLY_SPLITS }), bikeRace], 'olympic', NOW)!
    const bikeLeg = pred.legs.find(l => l.key === 'bike')!
    // alpha > 0 (has tri with splits), standalone bike engine exists → blend
    expect(bikeLeg.source).toBe('blend')
  })

  it('basis text lists engine disciplines when no tri splits', () => {
    const swimRace = mkRace({ id: 'sw3', sport: 'Swimming', distance: '1.5', time: '0:25:00' })
    const bikeRace = mkRace({ id: 'bk2', sport: 'Cycling', distance: '40', time: '1:10:00' })
    const runRace  = mkRace({ id: 'rn1', sport: 'Running', distance: '10', time: '0:40:00' })
    const pred = predictTriathlon([swimRace, bikeRace, runRace], 'olympic', NOW)!
    expect(pred.basis).toContain('swim')
    expect(pred.basis).toContain('bike')
    expect(pred.basis).toContain('run')
    expect(pred.basis).toContain('engine estimate')
  })

  it('basis text names tri splits when empirical data exists', () => {
    const pred = predictTriathlon([tri({ splits: OLY_SPLITS })], 'olympic', NOW)!
    expect(pred.basis).toContain('tri')
    expect(pred.basis).toContain('splits')
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

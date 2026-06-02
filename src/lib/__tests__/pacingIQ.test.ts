import { describe, it, expect } from 'vitest'
import { classifyRacePacing, pacingAggregate, PACING_CLASS_META } from '../raceFormulas'
import type { Race } from '@/types'

function mkRace(splits: number[], id = 'r1'): Race {
  return {
    id,
    date: '2025-01-01',
    name: 'Test',
    distance: 'Marathon',
    sport: 'Running',
    outcome: 'Finished',
    splits: splits.map((sec, i) => ({
      label: `${i + 1}`,
      split: `0:${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`,
    })),
  } as Race
}

describe('classifyRacePacing', () => {
  it('returns null for fewer than 4 splits', () => {
    expect(classifyRacePacing(mkRace([300, 305, 310]))).toBeNull()
  })

  it('identifies EVEN STEADY (small δ, low cv)', () => {
    expect(classifyRacePacing(mkRace([300, 301, 300, 302, 301, 300]))).toBe('EVEN STEADY')
  })

  it('identifies CRASH FADER (δ >= 10%)', () => {
    expect(classifyRacePacing(mkRace([280, 285, 290, 320, 340, 360]))).toBe('CRASH FADER')
  })

  it('identifies CRASH FADER when crashSplit threshold exceeded', () => {
    // One split >120% of first-half avg
    expect(classifyRacePacing(mkRace([280, 285, 290, 285, 290, 360]))).toBe('CRASH FADER')
  })

  it('identifies HOT START', () => {
    // First split well below avg (startBurn < 0.92), δ between 5-10% (so CRASH doesn't win)
    expect(classifyRacePacing(mkRace([250, 285, 295, 297, 300, 305]))).toBe('HOT START')
  })

  it('identifies CLASSIC FADER (5% <= δ < 10%)', () => {
    expect(classifyRacePacing(mkRace([290, 292, 295, 310, 312, 315]))).toBe('CLASSIC FADER')
  })

  it('identifies MILD FADER (2% <= δ < 5%)', () => {
    expect(classifyRacePacing(mkRace([295, 297, 298, 304, 306, 308]))).toBe('MILD FADER')
  })

  it('identifies NEGATIVE SPLITTER', () => {
    expect(classifyRacePacing(mkRace([310, 308, 305, 298, 295, 292]))).toBe('NEGATIVE SPLITTER')
  })

  it('skips DNF/DNS races in aggregation', () => {
    const dnf = { ...mkRace([300, 301, 302, 303]), outcome: 'DNF' } as Race
    const fin = mkRace([300, 301, 302, 303])
    const agg = pacingAggregate([dnf, fin])
    expect(agg.total).toBe(1)
  })

  it('skips future-dated races', () => {
    const future = { ...mkRace([300, 301, 302, 303]), date: '2099-12-31' } as Race
    const agg = pacingAggregate([future])
    expect(agg.total).toBe(0)
  })
})

describe('pacingAggregate', () => {
  it('returns null primary when no races qualify', () => {
    const agg = pacingAggregate([])
    expect(agg.primary).toBeNull()
    expect(agg.total).toBe(0)
  })

  it('picks primary persona by highest count', () => {
    const races = [
      mkRace([300, 301, 300, 302, 301, 300], 'a'),
      mkRace([300, 301, 300, 302, 301, 300], 'b'),
      mkRace([280, 285, 290, 320, 340, 360], 'c'),
    ]
    const agg = pacingAggregate(races)
    expect(agg.primary).toBe('EVEN STEADY')
    expect(agg.primaryCount).toBe(2)
  })

  it('only sets secondary when it covers 25%+', () => {
    // 9 EVEN STEADY + 1 CRASH FADER → secondary is 10%, dropped
    const races = [
      ...Array.from({ length: 9 }, (_, i) => mkRace([300, 301, 300, 302, 301, 300], `e${i}`)),
      mkRace([280, 285, 290, 320, 340, 360], 'c'),
    ]
    const agg = pacingAggregate(races)
    expect(agg.primary).toBe('EVEN STEADY')
    expect(agg.secondary).toBeNull()
  })

  it('sets secondary when 25%+ threshold met', () => {
    // 3 EVEN STEADY + 1 CRASH FADER → secondary 25% → kept
    const races = [
      ...Array.from({ length: 3 }, (_, i) => mkRace([300, 301, 300, 302, 301, 300], `e${i}`)),
      mkRace([280, 285, 290, 320, 340, 360], 'c'),
    ]
    const agg = pacingAggregate(races)
    expect(agg.primary).toBe('EVEN STEADY')
    expect(agg.secondary).toBe('CRASH FADER')
  })

  it('coachingNote is non-empty for both empty and populated states', () => {
    expect(pacingAggregate([]).coachingNote.length).toBeGreaterThan(0)
    expect(pacingAggregate([mkRace([300, 301, 300, 302, 301, 300])]).coachingNote.length).toBeGreaterThan(0)
  })
})

describe('PACING_CLASS_META', () => {
  it('exposes meta for all 10 classes', () => {
    const classes = ['EVEN STEADY', 'NEGATIVE SPLITTER', 'NEGATIVE KICKER', 'MILD FADER', 'CLASSIC FADER', 'CRASH FADER', 'HOT START', 'SURGER', 'SLOW BUILDER', 'CONSERVATIVE'] as const
    for (const c of classes) {
      const m = PACING_CLASS_META[c]
      expect(m.label).toBe(c)
      expect(m.color).toMatch(/^#/)
      expect(m.description.length).toBeGreaterThan(0)
      expect(m.prescription.length).toBeGreaterThan(0)
    }
  })
})

import { describe, it, expect } from 'vitest'
import { rankBestMatch, type RankableImport } from '../importRank'

const r = (over: Partial<RankableImport>): RankableImport =>
  ({ source: 'marathonview', raceName: 'Race', ...over })

const none = () => false

describe('rankBestMatch', () => {
  it('returns -1 for empty list', () => {
    expect(rankBestMatch([], { isDuplicate: none })).toBe(-1)
  })

  it('returns -1 when every result is a duplicate', () => {
    const results = [r({ time: '3:00:00' }), r({ placing: '12' })]
    expect(rankBestMatch(results, { isDuplicate: () => true })).toBe(-1)
  })

  it('prefers the richest payload (splits > placing > time)', () => {
    const results = [
      r({ raceName: 'plain' }),
      r({ raceName: 'timed', time: '3:00:00' }),
      r({ raceName: 'rich', splits: [{}, {}], placing: '4' }),
    ]
    expect(rankBestMatch(results, { isDuplicate: none })).toBe(2)
  })

  it('skips a richer duplicate and picks the best remaining', () => {
    const results = [
      r({ raceName: 'dupe-rich', splits: [{}], placing: '1' }),
      r({ raceName: 'keep', time: '4:00:00' }),
    ]
    const isDuplicate = (x: RankableImport) => x.raceName === 'dupe-rich'
    expect(rankBestMatch(results, { isDuplicate })).toBe(1)
  })

  it('breaks score ties toward the most recent date', () => {
    const results = [
      r({ raceName: 'old', time: '3:00:00', date: '2024-05-01' }),
      r({ raceName: 'new', time: '3:00:00', date: '2026-05-01' }),
    ]
    expect(rankBestMatch(results, { isDuplicate: none })).toBe(1)
  })

  it('uses last-name match as a confidence nudge', () => {
    const results = [
      r({ raceName: 'Generic 10K' }),
      r({ raceName: 'Johnson Memorial 10K' }),
    ]
    expect(rankBestMatch(results, { isDuplicate: none, lastName: 'Johnson' })).toBe(1)
  })
})

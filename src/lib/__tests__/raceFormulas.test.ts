import { describe, it, expect } from 'vitest'
import { parseDistKm } from '../raceFormulas'

describe('parseDistKm', () => {
  it('resolves mile-named tri labels to km (regression: "70.3" is miles, not km)', () => {
    expect(parseDistKm('70.3')).toBe(113)
    expect(parseDistKm('140.6')).toBe(226)
    expect(parseDistKm('ironman 70.3')).toBe(113)
    expect(parseDistKm('IM 70.3')).toBe(113)
  })

  it('resolves word labels via the map', () => {
    expect(parseDistKm('IRONMAN')).toBe(226)
    expect(parseDistKm('Olympic')).toBe(51.5)
    expect(parseDistKm('Sprint')).toBe(25.75)
    expect(parseDistKm('Half Ironman')).toBe(113)
    expect(parseDistKm('Marathon')).toBe(42.195)
    expect(parseDistKm('Half Marathon')).toBeCloseTo(21.0975)
    expect(parseDistKm('10 Mile')).toBeCloseTo(16.09)
  })

  it('parses genuine numeric km that are not label collisions', () => {
    expect(parseDistKm('42.2')).toBe(42.2)
    expect(parseDistKm('21.1')).toBe(21.1)
    expect(parseDistKm('100')).toBe(100)
    expect(parseDistKm('5')).toBe(5)
  })

  it('returns 0 for empty/garbage', () => {
    expect(parseDistKm(undefined)).toBe(0)
    expect(parseDistKm('')).toBe(0)
    expect(parseDistKm('abc')).toBe(0)
  })
})

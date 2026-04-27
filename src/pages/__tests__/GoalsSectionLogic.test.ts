/**
 * Unit tests for GoalsSection pure logic extracted from Profile.tsx.
 * Tests saveDist behaviour, GOAL_DISTANCES presets, and clubs init compat.
 */
import { describe, it, expect } from 'vitest'

// ── GOAL_DISTANCES shape (mirrors Profile.tsx constant) ───────────────────────

const GOAL_SPORTS = ['Running', 'Triathlon', 'Cycling', 'Swimming', 'HYROX'] as const

const GOAL_DISTANCES: Record<string, { label: string; value: string }[]> = {
  Running:   [
    { label: '5K',            value: '5' },
    { label: '10K',           value: '10' },
    { label: '10 Mile',       value: '16.09' },
    { label: 'Half Marathon', value: '21.1' },
    { label: 'Marathon',      value: '42.2' },
    { label: '50K',           value: '50' },
    { label: '100K',          value: '100' },
    { label: '100 Mile',      value: '160.93' },
  ],
  Triathlon: [
    { label: 'Sprint',  value: '25.75' },
    { label: 'Olympic', value: '51.5' },
    { label: '70.3',    value: '113' },
    { label: 'IRONMAN', value: '226' },
  ],
  Cycling:   [
    { label: '50K',              value: '50' },
    { label: '100K',             value: '100' },
    { label: 'Century (161km)',  value: '161' },
  ],
  Swimming:  [
    { label: '1K', value: '1' },
    { label: '3K', value: '3' },
    { label: '5K', value: '5' },
    { label: '10K', value: '10' },
  ],
  HYROX:     [
    { label: 'Solo Open',    value: 'Solo Open' },
    { label: 'Solo Pro',     value: 'Solo Pro' },
    { label: 'Doubles Open', value: 'Doubles Open' },
    { label: 'Doubles Pro',  value: 'Doubles Pro' },
  ],
}

// ── saveDist logic (mirrors Profile.tsx saveDist) ─────────────────────────────

interface HMS { h: number; m: number; s: number }

function saveDist(opts: {
  goalSport: string
  goalDist: string
  goalCustomKm: string
  goalCustomUnit: 'km' | 'mi'
  goalHMS: HMS
}): { label: string; targetSecs: number } | null {
  const { goalSport, goalDist, goalCustomKm, goalCustomUnit, goalHMS } = opts
  const secs = goalHMS.h * 3600 + goalHMS.m * 60 + goalHMS.s
  let distVal = goalDist
  if (goalDist === '__custom__') {
    const km = goalCustomUnit === 'mi'
      ? parseFloat(goalCustomKm) * 1.60934
      : parseFloat(goalCustomKm)
    if (!km || isNaN(km)) return null
    distVal = `${Math.round(km * 10) / 10}km`
  }
  if (!distVal || secs <= 0) return null
  const preset = (GOAL_DISTANCES[goalSport] ?? []).find(o => o.value === distVal)
  const label = preset ? preset.label : distVal
  return { label, targetSecs: secs }
}

// ── clubs init compat (mirrors EditProfileModal state init) ───────────────────

function initClubs(athlete: { clubs?: string[]; club?: string }): string[] {
  if (athlete.clubs?.length) return athlete.clubs
  if (athlete.club) return athlete.club.split(/\s*\/\s*/).map(s => s.trim()).filter(Boolean)
  return []
}

// ── clubs save patch ──────────────────────────────────────────────────────────

function buildClubPatch(clubs: string[]): { clubs: string[] | undefined; club: string | undefined } {
  return {
    clubs: clubs.length ? clubs : undefined,
    club:  clubs.length ? clubs.join(' / ') : undefined,
  }
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('GOAL_DISTANCES — static presets', () => {
  it('covers all 5 sports', () => {
    expect(Object.keys(GOAL_DISTANCES)).toEqual(expect.arrayContaining([...GOAL_SPORTS]))
  })

  it('Running distances are in ascending km order', () => {
    const vals = GOAL_DISTANCES.Running.map(o => parseFloat(o.value))
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]).toBeGreaterThan(vals[i - 1])
    }
  })

  it('Triathlon distances are in ascending km order', () => {
    const vals = GOAL_DISTANCES.Triathlon.map(o => parseFloat(o.value))
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]).toBeGreaterThan(vals[i - 1])
    }
  })

  it('non-HYROX labels are not identical to their numeric value strings', () => {
    // Labels should be human-readable (e.g. "Marathon" not "42.2").
    // HYROX distances use matching label/value strings by design (not km-based).
    // "70.3" is the canonical race brand name — also exempt.
    const exemptLabels = new Set(['70.3'])
    for (const [sport, dists] of Object.entries(GOAL_DISTANCES)) {
      if (sport === 'HYROX') continue
      for (const d of dists) {
        if (exemptLabels.has(d.label)) continue
        expect(d.label).not.toBe(d.value)
      }
    }
  })
})

describe('saveDist — preset distance', () => {
  it('returns the preset label for a standard distance', () => {
    const result = saveDist({ goalSport: 'Running', goalDist: '42.2', goalCustomKm: '', goalCustomUnit: 'km', goalHMS: { h: 3, m: 30, s: 0 } })
    expect(result).not.toBeNull()
    expect(result!.label).toBe('Marathon')
    expect(result!.targetSecs).toBe(3 * 3600 + 30 * 60)
  })

  it('returns the preset label for a triathlon distance', () => {
    const result = saveDist({ goalSport: 'Triathlon', goalDist: '113', goalCustomKm: '', goalCustomUnit: 'km', goalHMS: { h: 5, m: 0, s: 0 } })
    expect(result!.label).toBe('70.3')
  })

  it('returns null when secs <= 0', () => {
    const result = saveDist({ goalSport: 'Running', goalDist: '42.2', goalCustomKm: '', goalCustomUnit: 'km', goalHMS: { h: 0, m: 0, s: 0 } })
    expect(result).toBeNull()
  })

  it('returns null when no distance selected', () => {
    const result = saveDist({ goalSport: 'Running', goalDist: '', goalCustomKm: '', goalCustomUnit: 'km', goalHMS: { h: 3, m: 0, s: 0 } })
    expect(result).toBeNull()
  })
})

describe('saveDist — custom distance', () => {
  it('converts km custom distance correctly', () => {
    const result = saveDist({ goalSport: 'Running', goalDist: '__custom__', goalCustomKm: '30', goalCustomUnit: 'km', goalHMS: { h: 2, m: 30, s: 0 } })
    expect(result!.label).toBe('30km')
    expect(result!.targetSecs).toBe(2 * 3600 + 30 * 60)
  })

  it('converts miles to km correctly', () => {
    const result = saveDist({ goalSport: 'Running', goalDist: '__custom__', goalCustomKm: '10', goalCustomUnit: 'mi', goalHMS: { h: 1, m: 20, s: 0 } })
    expect(result).not.toBeNull()
    // 10 miles = 16.1 km (rounded to 1 decimal)
    expect(result!.label).toBe('16.1km')
  })

  it('returns null when custom km is empty', () => {
    const result = saveDist({ goalSport: 'Running', goalDist: '__custom__', goalCustomKm: '', goalCustomUnit: 'km', goalHMS: { h: 2, m: 0, s: 0 } })
    expect(result).toBeNull()
  })

  it('returns null when custom km is 0', () => {
    const result = saveDist({ goalSport: 'Running', goalDist: '__custom__', goalCustomKm: '0', goalCustomUnit: 'km', goalHMS: { h: 2, m: 0, s: 0 } })
    expect(result).toBeNull()
  })
})

describe('clubs init — backward compat', () => {
  it('returns clubs array when athlete.clubs is set', () => {
    expect(initClubs({ clubs: ['London AC', 'Run Club'] })).toEqual(['London AC', 'Run Club'])
  })

  it('splits athlete.club on " / " separator', () => {
    expect(initClubs({ club: 'London AC / Run Club' })).toEqual(['London AC', 'Run Club'])
  })

  it('splits athlete.club on "/" with varied spacing', () => {
    expect(initClubs({ club: 'Club A/Club B' })).toEqual(['Club A', 'Club B'])
  })

  it('prefers clubs array over club string when both present', () => {
    expect(initClubs({ clubs: ['New Club'], club: 'Old Club' })).toEqual(['New Club'])
  })

  it('returns empty array when neither clubs nor club is set', () => {
    expect(initClubs({})).toEqual([])
  })

  it('filters out empty strings from club split', () => {
    expect(initClubs({ club: ' / / ' })).toEqual([])
  })
})

describe('clubs save patch — backward compat', () => {
  it('builds clubs array + slash-joined club string', () => {
    const patch = buildClubPatch(['London AC', 'Run Club'])
    expect(patch.clubs).toEqual(['London AC', 'Run Club'])
    expect(patch.club).toBe('London AC / Run Club')
  })

  it('returns undefined for both when clubs is empty', () => {
    const patch = buildClubPatch([])
    expect(patch.clubs).toBeUndefined()
    expect(patch.club).toBeUndefined()
  })

  it('single club produces no slash in club string', () => {
    const patch = buildClubPatch(['London AC'])
    expect(patch.club).toBe('London AC')
  })
})

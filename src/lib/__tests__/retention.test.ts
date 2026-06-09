import { describe, it, expect } from 'vitest'
// Single source of truth lives with the Worker that runs it.
import {
  daysUntil, isoWeekKey, isMonday, selectReminders, selectDigests,
} from '../../../health-proxy/src/retention.mjs'

type U = {
  user_id: string
  email?: string | null
  email_opt_in?: boolean
  state_json?: { upcoming_races?: Array<{ id: string; name: string; date: string }> }
}
const user = (over: Partial<U>): U => ({ user_id: 'u1', email: 'a@b.com', email_opt_in: true, state_json: { upcoming_races: [] }, ...over })

describe('daysUntil', () => {
  it('counts whole days, null on bad input', () => {
    expect(daysUntil('2026-06-09', '2026-06-12')).toBe(3)
    expect(daysUntil('2026-06-09', '2026-06-09')).toBe(0)
    expect(daysUntil('2026-06-09', '2026-06-01')).toBe(-8)
    expect(daysUntil('2026-06-09', undefined)).toBeNull()
  })
})

describe('isoWeekKey / isMonday', () => {
  it('stamps an ISO week and detects Monday', () => {
    expect(isoWeekKey('2026-06-08')).toMatch(/^2026-W\d{2}$/)
    expect(isMonday('2026-06-08')).toBe(true)   // Mon
    expect(isMonday('2026-06-09')).toBe(false)  // Tue
  })
})

describe('selectReminders', () => {
  const today = '2026-06-09'
  it('selects races within the 3-day window only', () => {
    const users = [user({ state_json: { upcoming_races: [
      { id: 'r1', name: 'Soon', date: '2026-06-11' },   // 2 days — in
      { id: 'r2', name: 'Today', date: '2026-06-09' },  // 0 days — in
      { id: 'r3', name: 'Far', date: '2026-06-20' },    // 11 days — out
      { id: 'r4', name: 'Past', date: '2026-06-01' },   // past — out
    ] } })]
    const due = selectReminders(users, today)
    expect(due.map(d => d.raceId).sort()).toEqual(['r1', 'r2'])
  })

  it('skips opted-out users and users with no email', () => {
    const races = { upcoming_races: [{ id: 'r1', name: 'Soon', date: '2026-06-10' }] }
    const users = [
      user({ user_id: 'opted_out', email_opt_in: false, state_json: races }),
      user({ user_id: 'no_email', email: null, state_json: races }),
      user({ user_id: 'ok', state_json: races }),
    ]
    expect(selectReminders(users, today).map(d => d.userId)).toEqual(['ok'])
  })
})

describe('selectDigests', () => {
  it('returns nothing off-Monday', () => {
    expect(selectDigests([user({})], '2026-06-09')).toEqual([]) // Tue
  })
  it('on Monday, one row per opted-in user with their soonest future race', () => {
    const users = [user({ state_json: { upcoming_races: [
      { id: 'r1', name: 'Later', date: '2026-07-01' },
      { id: 'r2', name: 'Next', date: '2026-06-15' },
    ] } })]
    const digs = selectDigests(users, '2026-06-08') // Mon
    expect(digs).toHaveLength(1)
    expect(digs[0].nextRace?.id).toBe('r2')
    expect(digs[0].kind).toMatch(/^digest_2026-W\d{2}$/)
  })
  it('honours the monday override (for cron that already knows)', () => {
    expect(selectDigests([user({})], '2026-06-09', true)).toHaveLength(1)
    expect(selectDigests([user({})], '2026-06-08', false)).toHaveLength(0)
  })
})

import { describe, it, expect, vi, afterEach } from 'vitest'
import { safeStorage } from '../safeStorage'

describe('safeStorage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('round-trips a value through localStorage', () => {
    safeStorage!.setItem('k', { state: { a: 1 }, version: 0 })
    expect(safeStorage!.getItem('k')).toEqual({ state: { a: 1 }, version: 0 })
    safeStorage!.removeItem('k')
    expect(safeStorage!.getItem('k')).toBeNull()
  })

  it('swallows QuotaExceededError on setItem (never throws)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    })
    // The whole point: a rejected cache write must not crash the caller.
    expect(() => safeStorage!.setItem('big', { state: { x: 'y' }, version: 0 })).not.toThrow()
  })

  it('returns null instead of throwing when getItem fails', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(safeStorage!.getItem('whatever')).toBeNull()
  })
})

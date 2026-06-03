import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock env + token before importing the module under test.
vi.mock('@/env', () => ({ APP_URL: 'https://app.example.com' }))
let _token: string | null = 'tok_123'
vi.mock('@/lib/supabase', () => ({ getClerkToken: () => _token }))

import { uploadPhotoIfNeeded, uploadPhotosIfNeeded } from '../uploadPhoto'

const DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
const HTTPS_URL = 'https://app.example.com/storage/v1/object/public/race-photos/user_1/abc.jpg'

describe('uploadPhotoIfNeeded', () => {
  beforeEach(() => { _token = 'tok_123' })
  afterEach(() => { vi.restoreAllMocks() })

  it('passes through an https URL without calling the network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const out = await uploadPhotoIfNeeded(HTTPS_URL)
    expect(out).toBe(HTTPS_URL)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('passes through undefined', async () => {
    expect(await uploadPhotoIfNeeded(undefined)).toBeUndefined()
  })

  it('uploads a base64 data URL and returns the storage URL', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ url: HTTPS_URL }), { status: 200 }),
    )
    const out = await uploadPhotoIfNeeded(DATA_URL)
    expect(out).toBe(HTTPS_URL)
  })

  it('keeps the base64 (never loses the photo) when the upload fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 502 }))
    expect(await uploadPhotoIfNeeded(DATA_URL)).toBe(DATA_URL)
  })

  it('keeps the base64 when fetch throws (offline)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    expect(await uploadPhotoIfNeeded(DATA_URL)).toBe(DATA_URL)
  })

  it('keeps the base64 when not signed in (no token)', async () => {
    _token = null
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    expect(await uploadPhotoIfNeeded(DATA_URL)).toBe(DATA_URL)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('uploadPhotosIfNeeded', () => {
  beforeEach(() => { _token = 'tok_123' })
  afterEach(() => { vi.restoreAllMocks() })

  it('returns the list unchanged when empty/undefined', async () => {
    expect(await uploadPhotosIfNeeded(undefined)).toBeUndefined()
    expect(await uploadPhotosIfNeeded([])).toEqual([])
  })

  it('uploads only the base64 entries and preserves order + existing URLs', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ url: HTTPS_URL }), { status: 200 }),
    )
    const out = await uploadPhotosIfNeeded([HTTPS_URL, DATA_URL])
    expect(out).toEqual([HTTPS_URL, HTTPS_URL])
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the upload helpers: base64 data URLs become an https URL; everything
// else passes through. Lets us assert the strip without a real network.
const STORAGE_URL = 'https://app.example.com/storage/v1/object/public/race-photos/u/x.jpg'
let uploadOk = true
vi.mock('@/lib/uploadPhoto', () => ({
  uploadPhotoIfNeeded: vi.fn(async (v?: string) =>
    typeof v === 'string' && v.startsWith('data:image/') ? (uploadOk ? STORAGE_URL : v) : v,
  ),
  uploadPhotosIfNeeded: vi.fn(async (vs?: string[]) =>
    !vs ? vs : Promise.all(vs.map((v) =>
      v.startsWith('data:image/') ? (uploadOk ? STORAGE_URL : v) : v,
    )),
  ),
}))

const syncSpy = vi.fn()
vi.mock('@/lib/syncState', () => ({
  syncStateToSupabase: () => syncSpy(),
  resetRemotePullGate: () => {},
}))

import { migrateEmbeddedPhotos } from '../migratePhotos'
import { useRaceStore } from '@/stores/useRaceStore'
import type { Race } from '@/types'

const DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='

function race(over: Partial<Race> = {}): Race {
  return { id: over.id ?? 'r1', name: 'Test', date: '2026-01-01', distance: '5', sport: 'Running', ...over } as Race
}

describe('migrateEmbeddedPhotos', () => {
  beforeEach(() => {
    uploadOk = true
    syncSpy.mockClear()
    useRaceStore.getState().setRaces([])
  })
  afterEach(() => vi.clearAllMocks())

  it('no-ops (and does not sync) when no race holds base64', async () => {
    useRaceStore.getState().setRaces([race({ medalPhoto: STORAGE_URL })])
    await migrateEmbeddedPhotos()
    expect(useRaceStore.getState().races[0].medalPhoto).toBe(STORAGE_URL)
    expect(syncSpy).not.toHaveBeenCalled()
  })

  it('strips base64 medalPhoto + photos to URLs and writes back once', async () => {
    useRaceStore.getState().setRaces([
      race({ id: 'a', medalPhoto: DATA_URL, photos: [DATA_URL, STORAGE_URL] }),
      race({ id: 'b', medalPhoto: STORAGE_URL }),
    ])
    await migrateEmbeddedPhotos()
    const [a, b] = useRaceStore.getState().races
    expect(a.medalPhoto).toBe(STORAGE_URL)
    expect(a.photos).toEqual([STORAGE_URL, STORAGE_URL])
    expect(b.medalPhoto).toBe(STORAGE_URL)  // untouched race unchanged
    expect(syncSpy).toHaveBeenCalledTimes(1)  // clean server copy once
  })

  it('keeps base64 and does NOT sync when uploads fail (Worker down)', async () => {
    uploadOk = false
    useRaceStore.getState().setRaces([race({ medalPhoto: DATA_URL })])
    await migrateEmbeddedPhotos()
    expect(useRaceStore.getState().races[0].medalPhoto).toBe(DATA_URL)  // never lost
    expect(syncSpy).not.toHaveBeenCalled()  // don't push a still-huge blob
  })

  it('is retry-safe: a later call migrates base64 added after a clean run', async () => {
    useRaceStore.getState().setRaces([race({ medalPhoto: STORAGE_URL })])
    await migrateEmbeddedPhotos()
    expect(syncSpy).not.toHaveBeenCalled()
    // New base64 appears (e.g. fresh import); next call should migrate it.
    useRaceStore.getState().setRaces([race({ id: 'c', medalPhoto: DATA_URL })])
    await migrateEmbeddedPhotos()
    expect(useRaceStore.getState().races[0].medalPhoto).toBe(STORAGE_URL)
    expect(syncSpy).toHaveBeenCalledTimes(1)
  })
})

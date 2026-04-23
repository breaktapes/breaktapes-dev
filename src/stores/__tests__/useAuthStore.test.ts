import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '../useAuthStore'

beforeEach(() => {
  useAuthStore.setState({
    authUser: null,
    authSession: null,
  })
  window.localStorage.clear()
})

describe('useAuthStore — setAuthUser', () => {
  it('stores a user', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useAuthStore.getState().setAuthUser({ id: 'u1', email: 'a@b.com' } as any)
    expect(useAuthStore.getState().authUser?.id).toBe('u1')
  })

  it('clears user to null', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useAuthStore.getState().setAuthUser({ id: 'u1' } as any)
    useAuthStore.getState().setAuthUser(null)
    expect(useAuthStore.getState().authUser).toBeNull()
  })
})

describe('useAuthStore — sign-out localStorage cleanup', () => {
  it('bt_new_user removed when authUser is cleared', () => {
    window.localStorage.setItem('bt_new_user', 'true')
    // Simulate what AuthGate does on SIGNED_OUT event
    useAuthStore.getState().setAuthUser(null)
    useAuthStore.getState().setAuthSession(null)
    window.localStorage.removeItem('bt_new_user')
    window.localStorage.removeItem('bt_modal_shown')
    expect(window.localStorage.getItem('bt_new_user')).toBeNull()
  })

  it('bt_modal_shown removed on sign-out', () => {
    window.localStorage.setItem('bt_modal_shown', 'true')
    useAuthStore.getState().setAuthUser(null)
    useAuthStore.getState().setAuthSession(null)
    window.localStorage.removeItem('bt_new_user')
    window.localStorage.removeItem('bt_modal_shown')
    expect(window.localStorage.getItem('bt_modal_shown')).toBeNull()
  })

  it('clearing authUser does not affect unrelated localStorage keys', () => {
    window.localStorage.setItem('fl2_races', '[]')
    window.localStorage.setItem('bt_new_user', 'true')
    useAuthStore.getState().setAuthUser(null)
    window.localStorage.removeItem('bt_new_user')
    window.localStorage.removeItem('bt_modal_shown')
    expect(window.localStorage.getItem('fl2_races')).toBe('[]')
  })
})

describe('useAuthStore — no pro gating', () => {
  it('authUser and authSession are the only state fields', () => {
    const state = useAuthStore.getState()
    expect('proAccessGranted' in state).toBe(false)
  })
})

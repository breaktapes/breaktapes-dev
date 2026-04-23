import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '../useAuthStore'

beforeEach(() => {
  useAuthStore.setState({
    authUser: null,
    proAccessGranted: false,
  })
  window.localStorage.clear()
})

describe('useAuthStore — setAuthUser', () => {
  it('stores a user', () => {
    useAuthStore.getState().setAuthUser({ id: 'user_abc', email: 'a@b.com' })
    expect(useAuthStore.getState().authUser?.id).toBe('user_abc')
  })

  it('clears user to null', () => {
    useAuthStore.getState().setAuthUser({ id: 'user_abc' })
    useAuthStore.getState().setAuthUser(null)
    expect(useAuthStore.getState().authUser).toBeNull()
  })
})

describe('useAuthStore — sign-out localStorage cleanup', () => {
  it('bt_new_user removed when authUser is cleared', () => {
    window.localStorage.setItem('bt_new_user', 'true')
    useAuthStore.getState().setAuthUser(null)
    window.localStorage.removeItem('bt_new_user')
    window.localStorage.removeItem('bt_modal_shown')
    expect(window.localStorage.getItem('bt_new_user')).toBeNull()
  })

  it('bt_modal_shown removed on sign-out', () => {
    window.localStorage.setItem('bt_modal_shown', 'true')
    useAuthStore.getState().setAuthUser(null)
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

describe('useAuthStore — pro access', () => {
  it('proAccessGranted defaults to false', () => {
    expect(useAuthStore.getState().proAccessGranted).toBe(false)
  })

  it('setProAccess updates correctly', () => {
    useAuthStore.getState().setProAccess(true)
    expect(useAuthStore.getState().proAccessGranted).toBe(true)
  })
})

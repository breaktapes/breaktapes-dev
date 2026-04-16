// Vitest setup for React (RTL) tests
import '@testing-library/jest-dom'

// Node.js 22+ ships its own `localStorage` global that overrides jsdom's.
// That version doesn't implement the full Storage spec (missing .clear(), .key() etc).
// Provide a complete in-memory mock so Zustand persist and our tests work correctly.
const makeMockStorage = () => {
  const store: Record<string, string> = {}
  return {
    get length() { return Object.keys(store).length },
    key: (i: number) => Object.keys(store)[i] ?? null,
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = String(v) },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { Object.keys(store).forEach(k => delete store[k]) },
  }
}

const mockStorage = makeMockStorage()

Object.defineProperty(globalThis, 'localStorage', {
  value: mockStorage,
  writable: true,
  configurable: true,
})

beforeEach(() => {
  mockStorage.clear()
})

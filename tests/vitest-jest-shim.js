// Shim: alias jest → vi for legacy test files that use jest.fn(), jest.mock(), etc.
// Also: fix localStorage for Node.js 22+ which ships its own incomplete localStorage
// global that overrides jsdom's (missing .clear(), .key(), etc.).
import { vi } from 'vitest'
globalThis.jest = vi

// In-memory localStorage mock — same approach as src/test-setup.ts
const makeMockStorage = () => {
  const store = {}
  return {
    get length() { return Object.keys(store).length },
    key: (i) => Object.keys(store)[i] ?? null,
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
    clear: () => { Object.keys(store).forEach(k => delete store[k]) },
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: makeMockStorage(),
  writable: true,
  configurable: true,
})

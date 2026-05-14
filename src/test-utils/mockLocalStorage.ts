// In-memory localStorage stub for tests. Use with vi.stubGlobal:
//
//   import { mockLocalStorage } from '../test-utils/mockLocalStorage'
//   beforeEach(() => { vi.stubGlobal('localStorage', mockLocalStorage()) })

export function mockLocalStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => store.has(k) ? store.get(k)! : null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size },
  } as Storage
}

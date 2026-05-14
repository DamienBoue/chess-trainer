// JSON storage helper — exercises edge cases that the persistence layer
// hits repeatedly (missing keys, corrupt blobs, falsy roundtrips).

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadJson, saveJson } from './json'

function mockLocalStorage() {
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

describe('storage/json', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockLocalStorage())
  })

  it('returns fallback when key is missing', () => {
    expect(loadJson('missing', { n: 1 })).toEqual({ n: 1 })
  })

  it('returns parsed value when present', () => {
    saveJson('k', { foo: 'bar' })
    expect(loadJson('k', { foo: 'default' })).toEqual({ foo: 'bar' })
  })

  it('returns fallback when stored blob is malformed', () => {
    localStorage.setItem('bad', '{not json')
    expect(loadJson('bad', { x: 42 })).toEqual({ x: 42 })
  })

  it('roundtrips arrays', () => {
    saveJson('arr', [1, 2, 3])
    expect(loadJson('arr', [])).toEqual([1, 2, 3])
  })

  it('roundtrips null', () => {
    saveJson('n', null)
    expect(loadJson('n', { fallback: true })).toBeNull()
  })

  it('roundtrips false', () => {
    // Edge case: falsy stored values shouldn't trigger the missing-key path.
    saveJson('false', false)
    expect(loadJson('false', true)).toBe(false)
  })
})

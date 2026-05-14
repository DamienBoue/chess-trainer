import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadPlanState, savePlanState, markPlanItemDone, unmarkPlanItem } from './plan'

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

describe('plan storage', () => {
  beforeEach(() => { vi.stubGlobal('localStorage', mockLocalStorage()) })

  it('returns empty state on fresh install', () => {
    const s = loadPlanState('2026-05-14')
    expect(s.date).toBe('2026-05-14')
    expect(s.done).toEqual([])
  })

  it('round-trips a plan state', () => {
    savePlanState({ date: '2026-05-14', done: ['a', 'b'] })
    const s = loadPlanState('2026-05-14')
    expect(s.done).toEqual(['a', 'b'])
  })

  it('resets when the date rolls over', () => {
    savePlanState({ date: '2026-05-14', done: ['a', 'b'] })
    const s = loadPlanState('2026-05-15')
    expect(s.done).toEqual([])
  })

  it('markPlanItemDone adds the id and persists', () => {
    markPlanItemDone('2026-05-14', 'x')
    markPlanItemDone('2026-05-14', 'y')
    expect(loadPlanState('2026-05-14').done).toEqual(['x', 'y'])
  })

  it('markPlanItemDone is idempotent', () => {
    markPlanItemDone('2026-05-14', 'x')
    markPlanItemDone('2026-05-14', 'x')
    expect(loadPlanState('2026-05-14').done).toEqual(['x'])
  })

  it('unmarkPlanItem removes the id', () => {
    markPlanItemDone('2026-05-14', 'x')
    markPlanItemDone('2026-05-14', 'y')
    unmarkPlanItem('2026-05-14', 'x')
    expect(loadPlanState('2026-05-14').done).toEqual(['y'])
  })

  it('unmarkPlanItem on a missing id is a no-op', () => {
    markPlanItemDone('2026-05-14', 'x')
    unmarkPlanItem('2026-05-14', 'never-existed')
    expect(loadPlanState('2026-05-14').done).toEqual(['x'])
  })
})

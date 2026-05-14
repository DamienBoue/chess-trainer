import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  todayString, pickDaily, bumpStreak, decayStreakIfMissed, type DailyState,
} from './daily'
import type { Exercise } from '../analysis/exercises'
import { mockLocalStorage } from '../test-utils/mockLocalStorage'


describe('todayString', () => {
  const fixed = new Date('2026-05-14T12:00:00Z').getTime()
  beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(fixed) })
  afterAll(() => { vi.useRealTimers() })

  it('returns YYYY-MM-DD format', () => {
    // Tolerates timezone — just check format.
    expect(todayString()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('pickDaily', () => {
  function fakeExercises(n: number): Exercise[] {
    return Array.from({ length: n }, (_, i) => ({ id: `ex-${i}` } as unknown as Exercise))
  }

  it('returns null when pool is empty', () => {
    expect(pickDaily([], '2026-05-14')).toBeNull()
  })

  it('is deterministic for a given (date, pool) pair', () => {
    const pool = fakeExercises(10)
    expect(pickDaily(pool, '2026-05-14')?.id).toBe(pickDaily(pool, '2026-05-14')?.id)
  })

  it('changes pick when date changes', () => {
    const pool = fakeExercises(20)
    const a = pickDaily(pool, '2026-05-14')?.id
    const b = pickDaily(pool, '2026-05-15')?.id
    // Probabilistic — could randomly collide. Try 5 days; at least one differs.
    const ids = ['2026-05-14', '2026-05-15', '2026-05-16', '2026-05-17', '2026-05-18']
      .map(d => pickDaily(pool, d)?.id)
    expect(new Set(ids).size).toBeGreaterThan(1)
    void a; void b
  })
})

describe('bumpStreak', () => {
  it('returns 1 when there is no prior state', () => {
    expect(bumpStreak(null, '2026-05-14')).toBe(1)
  })

  it('keeps the current streak when today was already solved', () => {
    const s: DailyState = { date: '2026-05-14', exerciseId: 'x', solved: true, streak: 5, lastSolvedDate: '2026-05-14' }
    expect(bumpStreak(s, '2026-05-14')).toBe(5)
  })

  it('increments when yesterday was solved', () => {
    const s: DailyState = { date: '2026-05-13', exerciseId: 'x', solved: true, streak: 5, lastSolvedDate: '2026-05-13' }
    expect(bumpStreak(s, '2026-05-14')).toBe(6)
  })

  it('resets to 1 after a gap', () => {
    const s: DailyState = { date: '2026-05-10', exerciseId: 'x', solved: true, streak: 5, lastSolvedDate: '2026-05-10' }
    expect(bumpStreak(s, '2026-05-14')).toBe(1)
  })
})

describe('decayStreakIfMissed', () => {
  beforeEach(() => { vi.stubGlobal('localStorage', mockLocalStorage()) })

  it('returns null unchanged when state is null', () => {
    expect(decayStreakIfMissed(null, '2026-05-14')).toBeNull()
  })

  it('keeps streak when solved today', () => {
    const s: DailyState = { date: '2026-05-14', exerciseId: 'x', solved: true, streak: 5, lastSolvedDate: '2026-05-14' }
    expect(decayStreakIfMissed(s, '2026-05-14')?.streak).toBe(5)
  })

  it('keeps streak when last solved was yesterday', () => {
    const s: DailyState = { date: '2026-05-13', exerciseId: 'x', solved: true, streak: 3, lastSolvedDate: '2026-05-13' }
    expect(decayStreakIfMissed(s, '2026-05-14')?.streak).toBe(3)
  })

  it('resets streak to 0 after missing a day', () => {
    const s: DailyState = { date: '2026-05-10', exerciseId: 'x', solved: true, streak: 7, lastSolvedDate: '2026-05-10' }
    expect(decayStreakIfMissed(s, '2026-05-14')?.streak).toBe(0)
  })
})

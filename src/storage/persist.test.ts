// Tests the SM-2 lite algorithm. Exercises every outcome path + the
// invariants (ease 1.3..3.5, monotone attempt count, etc).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  updateProgressAfterAttempt, isDue, progressSummary,
  loadProgress, saveProgress,
  loadRepertoireProgress, saveRepertoireProgress,
  type ExerciseProgress,
} from './persist'
import { mockLocalStorage } from '../test-utils/mockLocalStorage'


describe('updateProgressAfterAttempt', () => {
  const NOW = new Date('2026-05-14T12:00:00Z').getTime()
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW) })
  afterEach(() => { vi.useRealTimers() })

  it('first-ever first-try sets attempts=1, successes=1, schedules in 1 day', () => {
    const p = updateProgressAfterAttempt(undefined, 'first-try')
    expect(p.attempts).toBe(1)
    expect(p.successes).toBe(1)
    expect(p.failures).toBe(0)
    expect(p.lastFirstTry).toBe(true)
    // ease default 2.5 → +0.1 = 2.6. Interval = 1d × (2.6/2.5).
    expect(p.easeFactor).toBeCloseTo(2.6, 5)
    expect(p.nextDueAt - NOW).toBeCloseTo(86400_000 * (2.6 / 2.5), -3)
  })

  it('first-try chain follows the 1→3→7→14→30→60 schedule', () => {
    let p = updateProgressAfterAttempt(undefined, 'first-try')
    const days: number[] = []
    for (let i = 0; i < 6; i++) {
      days.push(Math.round((p.nextDueAt - NOW) / 86400_000))
      vi.setSystemTime(p.nextDueAt)
      p = updateProgressAfterAttempt(p, 'first-try')
    }
    // The schedule shape, accounting for ease drift up to 3.5.
    expect(days[0]).toBe(1)
    expect(days[1]).toBeGreaterThanOrEqual(3)
    expect(days[2]).toBeGreaterThan(days[1])
    expect(days[5]).toBeGreaterThan(days[3])
  })

  it('after-retry counts as a success but does not boost ease', () => {
    const p = updateProgressAfterAttempt(undefined, 'after-retry')
    expect(p.successes).toBe(1)
    expect(p.easeFactor).toBeCloseTo(2.5, 5)
    expect(p.lastFirstTry).toBe(false)
  })

  it('failed counts as a failure, shrinks ease, schedules tomorrow', () => {
    const prev: ExerciseProgress = {
      attempts: 3, successes: 2, failures: 1, lastFirstTry: false,
      lastSeenAt: NOW - 86400_000 * 7, nextDueAt: NOW, easeFactor: 2.7,
    }
    const p = updateProgressAfterAttempt(prev, 'failed')
    expect(p.attempts).toBe(4)
    expect(p.successes).toBe(2)
    expect(p.failures).toBe(2)
    expect(p.easeFactor).toBeCloseTo(2.5, 5)
    expect(p.nextDueAt - NOW).toBe(86400_000)
  })

  it('revealed is treated like failed', () => {
    const p = updateProgressAfterAttempt(undefined, 'revealed')
    expect(p.failures).toBe(1)
    expect(p.successes).toBe(0)
  })

  it('ease is clamped to [1.3, 3.5]', () => {
    let p = { attempts: 0, successes: 0, failures: 0, lastFirstTry: false, lastSeenAt: 0, nextDueAt: 0, easeFactor: 3.45 }
    for (let i = 0; i < 5; i++) p = updateProgressAfterAttempt(p, 'first-try')
    expect(p.easeFactor).toBeLessThanOrEqual(3.5)
    p = { ...p, easeFactor: 1.4 }
    for (let i = 0; i < 5; i++) p = updateProgressAfterAttempt(p, 'failed')
    expect(p.easeFactor).toBeGreaterThanOrEqual(1.3)
  })
})

describe('isDue', () => {
  it('returns true for never-seen items', () => {
    expect(isDue(undefined)).toBe(true)
  })

  it('returns true when nextDueAt <= now', () => {
    const p: ExerciseProgress = { attempts: 1, successes: 1, failures: 0, lastFirstTry: true, lastSeenAt: 0, nextDueAt: 1000, easeFactor: 2.5 }
    expect(isDue(p, 2000)).toBe(true)
  })

  it('returns false when nextDueAt > now', () => {
    const p: ExerciseProgress = { attempts: 1, successes: 1, failures: 0, lastFirstTry: true, lastSeenAt: 0, nextDueAt: 5000, easeFactor: 2.5 }
    expect(isDue(p, 2000)).toBe(false)
  })
})

describe('exercise progress storage', () => {
  beforeEach(() => { vi.stubGlobal('localStorage', mockLocalStorage()) })

  it('returns {} on fresh install', () => {
    expect(loadProgress()).toEqual({})
  })

  it('roundtrips exercise progress', () => {
    const p: ExerciseProgress = { attempts: 1, successes: 1, failures: 0, lastFirstTry: true, lastSeenAt: 0, nextDueAt: 0, easeFactor: 2.5 }
    saveProgress({ exA: p })
    expect(loadProgress()).toEqual({ exA: p })
  })

  it('repertoire progress lives under its own namespace', () => {
    const p: ExerciseProgress = { attempts: 2, successes: 2, failures: 0, lastFirstTry: true, lastSeenAt: 0, nextDueAt: 0, easeFactor: 2.6 }
    saveProgress({ exA: p })
    saveRepertoireProgress({ repA: p })
    expect(loadProgress().exA).toBeTruthy()
    expect(loadProgress().repA).toBeUndefined()
    expect(loadRepertoireProgress().repA).toBeTruthy()
    expect(loadRepertoireProgress().exA).toBeUndefined()
  })
})

describe('progressSummary', () => {
  it('returns zeros on empty input', () => {
    expect(progressSummary({})).toEqual({ totalSeen: 0, totalAttempts: 0, totalSuccesses: 0, accuracy: 0 })
  })

  it('aggregates totals + accuracy', () => {
    const p: Record<string, ExerciseProgress> = {
      a: { attempts: 4, successes: 3, failures: 1, lastFirstTry: true,  lastSeenAt: 0, nextDueAt: 0, easeFactor: 2.5 },
      b: { attempts: 2, successes: 1, failures: 1, lastFirstTry: false, lastSeenAt: 0, nextDueAt: 0, easeFactor: 2.5 },
    }
    const s = progressSummary(p)
    expect(s.totalSeen).toBe(2)
    expect(s.totalAttempts).toBe(6)
    expect(s.totalSuccesses).toBe(4)
    expect(s.accuracy).toBeCloseTo(4 / 6, 4)
  })
})

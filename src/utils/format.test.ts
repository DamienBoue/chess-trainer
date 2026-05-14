import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { daysAgo, formatDate } from './format'

describe('daysAgo', () => {
  const fixed = new Date('2026-05-14T12:00:00Z').getTime()
  beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(fixed) })
  afterAll(() => { vi.useRealTimers() })

  it('returns 0 for an instant in the present', () => {
    expect(daysAgo(fixed / 1000)).toBe(0)
  })

  it('returns whole days for a past date', () => {
    expect(daysAgo(fixed / 1000 - 86400 * 3)).toBe(3)
    expect(daysAgo(fixed / 1000 - 86400 * 30)).toBe(30)
  })

  it('clamps future dates to 0 (never negative)', () => {
    expect(daysAgo(fixed / 1000 + 86400)).toBe(0)
  })
})

describe('formatDate', () => {
  it('returns a non-empty string for a valid epoch', () => {
    const s = formatDate(1700000000)
    expect(s.length).toBeGreaterThan(0)
  })
})

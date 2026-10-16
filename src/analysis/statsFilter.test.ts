import { describe, expect, it } from 'vitest'
import { buildGame } from './__fixtures__'
import { DEFAULT_FILTER, filterAnalyses, matchesFilter, parseFilter, periodStart, timeClassOptions } from './statsFilter'

const DAY = 86_400_000
const NOW = 1_800_000_000_000

describe('periodStart', () => {
  it('goes back the number of days, or nowhere for "Toujours"', () => {
    expect(periodStart('7d', NOW)).toBe(NOW - 7 * DAY)
    expect(periodStart('1y', NOW)).toBe(NOW - 365 * DAY)
    expect(periodStart('all', NOW)).toBeNull()
  })
})

describe('matchesFilter', () => {
  it('keeps the games inside the window and of the time control', () => {
    const f = { period: '30d' as const, timeClass: 'blitz' as const }
    expect(matchesFilter(NOW - 2 * DAY, 'blitz', f, NOW)).toBe(true)
    expect(matchesFilter(NOW - 40 * DAY, 'blitz', f, NOW)).toBe(false)
    expect(matchesFilter(NOW - 2 * DAY, 'rapid', f, NOW)).toBe(false)
    expect(matchesFilter(0, 'rapid', { period: 'all', timeClass: 'all' }, NOW)).toBe(true)
  })

  it('reads analyses end times in seconds', () => {
    const recent = buildGame({ endTime: (NOW - DAY) / 1000, moves: [] })
    const old = buildGame({ endTime: (NOW - 100 * DAY) / 1000, moves: [] })
    expect(filterAnalyses([recent, old], DEFAULT_FILTER, NOW)).toEqual([recent])
  })
})

describe('timeClassOptions', () => {
  it('lists the played time controls, most played first', () => {
    expect(timeClassOptions(['rapid', 'blitz', 'blitz', 'bullet', 'blitz', 'rapid'])).toEqual(['all', 'blitz', 'rapid', 'bullet'])
  })

  it('needs no chips for a single time control', () => {
    expect(timeClassOptions(['blitz', 'blitz'])).toEqual([])
  })
})

describe('parseFilter', () => {
  it('falls back to the last 30 days on missing or bad values', () => {
    expect(parseFilter(null)).toEqual(DEFAULT_FILTER)
    expect(parseFilter('{oops')).toEqual(DEFAULT_FILTER)
    expect(parseFilter('{"period":"5y","timeClass":"blitz"}')).toEqual({ period: '30d', timeClass: 'blitz' })
    expect(parseFilter('{"period":"90d","timeClass":"all"}')).toEqual({ period: '90d', timeClass: 'all' })
  })
})

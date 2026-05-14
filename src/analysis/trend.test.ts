import { describe, expect, it } from 'vitest'
import { computeTrend, trendDirection, type TrendDelta } from './trend'
import type { WeekStats } from './timeline'

function week(games: number, wins: number, draws: number, cpLossSum: number, userMoves: number, blunders: number, weekStart: string): WeekStats {
  return {
    weekStart, games, wins, losses: games - wins - draws, draws,
    userMoves, cpLossSum, blunders, mistakes: 0, inaccuracies: 0,
  } as WeekStats
}

describe('computeTrend', () => {
  it('returns null with no active weeks', () => {
    expect(computeTrend([])).toBeNull()
  })

  it('returns null without a baseline (fewer than 1 recent + 1 baseline active week)', () => {
    expect(computeTrend([week(0, 0, 0, 0, 0, 0, 'wk1')])).toBeNull()
    expect(computeTrend([week(1, 1, 0, 30, 20, 0, 'wk1')])).toBeNull()
  })

  it('treats the last active week as "recent" and the 4 before as baseline', () => {
    const weeks = [
      week(5, 2, 1, 800, 200, 4, 'wk1'),  // baseline ×4 (worse)
      week(5, 2, 1, 800, 200, 4, 'wk2'),
      week(5, 2, 1, 800, 200, 4, 'wk3'),
      week(5, 2, 1, 800, 200, 4, 'wk4'),
      week(5, 4, 1, 100, 200, 0, 'wk5'),  // recent (much better)
    ]
    const t = computeTrend(weeks)!
    expect(t.cpLoss.recent).toBeLessThan(t.cpLoss.baseline)
    expect(t.blundersPerGame.recent).toBeLessThan(t.blundersPerGame.baseline)
    expect(t.winRate.recent).toBeGreaterThan(t.winRate.baseline)
  })

  it('skips empty weeks (the user took a break)', () => {
    const weeks = [
      week(5, 2, 1, 800, 200, 4, 'wk1'),
      week(0, 0, 0, 0,   0,   0, 'wk2'), // break
      week(0, 0, 0, 0,   0,   0, 'wk3'), // break
      week(5, 4, 1, 100, 200, 0, 'wk4'),
    ]
    const t = computeTrend(weeks)!
    expect(t.cpLoss.recentGames).toBe(5)
    expect(t.cpLoss.baselineGames).toBe(5)
  })
})

describe('trendDirection', () => {
  it('returns "flat" for sub-5%-relative deltas', () => {
    const d: TrendDelta = { recent: 100, baseline: 100, delta: 0, lowerIsBetter: true, recentGames: 5, baselineGames: 20 }
    expect(trendDirection(d)).toBe('flat')
  })

  it('returns "flat" when baseline is zero', () => {
    const d: TrendDelta = { recent: 5, baseline: 0, delta: 5, lowerIsBetter: true, recentGames: 5, baselineGames: 0 }
    expect(trendDirection(d)).toBe('flat')
  })

  it('returns "improved" when lowerIsBetter and delta is negative beyond 5%', () => {
    const d: TrendDelta = { recent: 80, baseline: 100, delta: -20, lowerIsBetter: true, recentGames: 5, baselineGames: 20 }
    expect(trendDirection(d)).toBe('improved')
  })

  it('returns "worsened" when lowerIsBetter and delta is positive beyond 5%', () => {
    const d: TrendDelta = { recent: 120, baseline: 100, delta: 20, lowerIsBetter: true, recentGames: 5, baselineGames: 20 }
    expect(trendDirection(d)).toBe('worsened')
  })

  it('inverts when lowerIsBetter is false', () => {
    const winrateUp: TrendDelta   = { recent: 0.6, baseline: 0.4, delta: 0.2,  lowerIsBetter: false, recentGames: 5, baselineGames: 20 }
    const winrateDown: TrendDelta = { recent: 0.3, baseline: 0.5, delta: -0.2, lowerIsBetter: false, recentGames: 5, baselineGames: 20 }
    expect(trendDirection(winrateUp)).toBe('improved')
    expect(trendDirection(winrateDown)).toBe('worsened')
  })
})

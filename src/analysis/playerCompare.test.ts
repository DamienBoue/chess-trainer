import { describe, expect, it } from 'vitest'
import { compareProfiles } from './playerCompare'
import type { ScoutingProfile } from './scouting'

function profile(opts: { username: string; games?: number; recentForm?: Array<'W'|'L'|'D'>; whiteOpenings?: Array<{ name: string; played: number; wins: number }>; blackOpenings?: Array<{ name: string; played: number; wins: number }> }): ScoutingProfile {
  const stat = (xs: typeof opts.whiteOpenings) => (xs ?? []).map(o => ({ ...o, winRate: o.wins / o.played }))
  return {
    username: opts.username,
    games: opts.games ?? 20,
    whiteSide: { games: 10, wins: 5, losses: 3, draws: 2, winRate: 0.6, openings: stat(opts.whiteOpenings)! },
    blackSide: { games: 10, wins: 5, losses: 3, draws: 2, winRate: 0.6, openings: stat(opts.blackOpenings)! },
    timeClassBreakdown: [],
    recentForm: opts.recentForm ?? [],
    worstOpenings: [],
    bestOpenings: [],
  }
}

describe('compareProfiles', () => {
  it('returns 4 opportunity buckets', () => {
    const me  = profile({ username: 'me'  })
    const opp = profile({ username: 'opp' })
    const r = compareProfiles(me, opp)
    expect(Array.isArray(r.meVsOpp.asWhite)).toBe(true)
    expect(Array.isArray(r.meVsOpp.asBlack)).toBe(true)
    expect(Array.isArray(r.oppVsMe.asWhite)).toBe(true)
    expect(Array.isArray(r.oppVsMe.asBlack)).toBe(true)
  })

  it("surfaces opp's weak openings (≥3 games, <55% win rate) when I'm white", () => {
    const me  = profile({ username: 'me' })
    const opp = profile({
      username: 'opp',
      // OPP plays black poorly in the Italian (40% win rate over 5 games)
      blackOpenings: [{ name: 'Italian Game', played: 5, wins: 2 }],
    })
    const r = compareProfiles(me, opp)
    expect(r.meVsOpp.asWhite[0]?.opening).toBe('Italian Game')
  })

  it('ignores openings with too few games', () => {
    const me  = profile({ username: 'me' })
    const opp = profile({
      username: 'opp',
      blackOpenings: [{ name: 'Italian Game', played: 2, wins: 0 }], // < 3 minimum
    })
    expect(compareProfiles(me, opp).meVsOpp.asWhite).toEqual([])
  })

  it("notes weak data when a profile has fewer than 10 games", () => {
    const me  = profile({ username: 'me',  games: 5 })
    const opp = profile({ username: 'opp', games: 5 })
    const r = compareProfiles(me, opp)
    expect(r.notes.length).toBeGreaterThanOrEqual(2)
    expect(r.notes.join(' ')).toContain('peu fiables')
  })

  it('flags a clear form differential (≥4 wins out of 20)', () => {
    const me  = profile({ username: 'me',  recentForm: Array.from({ length: 20 }, () => 'W' as const) })
    const opp = profile({ username: 'opp', recentForm: Array.from({ length: 20 }, () => 'L' as const) })
    const r = compareProfiles(me, opp)
    expect(r.notes.some(n => n.includes('forme récente'))).toBe(true)
  })

  it('caps opportunities at 6', () => {
    const me  = profile({ username: 'me' })
    const manyWeak = Array.from({ length: 12 }, (_, i) => ({ name: `Op ${i}`, played: 4, wins: 1 }))
    const opp = profile({ username: 'opp', blackOpenings: manyWeak })
    const r = compareProfiles(me, opp)
    expect(r.meVsOpp.asWhite.length).toBeLessThanOrEqual(6)
  })
})

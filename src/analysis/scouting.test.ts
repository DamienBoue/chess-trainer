import { describe, expect, it } from 'vitest'
import { scoutingProfile } from './scouting'
import type { ChessComGame } from '../types'

function game(opts: {
  user: string
  asWhite: boolean
  outcome: 'win' | 'resigned' | 'agreed'
  eco?: string
  opening?: string
  tc?: string
  endTime?: number
}): ChessComGame {
  const userResult = opts.outcome
  // The OPPONENT's result is conceptually opposite — we just need any
  // non-conflicting placeholder.
  const oppResult = opts.outcome === 'win' ? 'resigned' : opts.outcome === 'resigned' ? 'win' : 'agreed'
  return {
    url: `g${opts.endTime ?? Math.random()}`,
    pgn: opts.eco
      ? `[ECO "${opts.eco}"]\n[ECOUrl "https://chess.com/openings/${opts.opening ?? 'Some-Game'}"]\n1. e4 1-0`
      : '1. e4 1-0',
    time_control: '600',
    end_time: opts.endTime ?? 1700000000,
    rated: true,
    time_class: opts.tc ?? 'rapid',
    rules: 'chess',
    white: { rating: 1500, result: opts.asWhite ? userResult : oppResult, '@id': '', username: opts.asWhite ? opts.user : 'opp' },
    black: { rating: 1500, result: opts.asWhite ? oppResult : userResult, '@id': '', username: opts.asWhite ? 'opp' : opts.user },
  } as unknown as ChessComGame
}

describe('scoutingProfile', () => {
  it('returns zeroed splits when no games', () => {
    const p = scoutingProfile('alice', [])
    expect(p.games).toBe(0)
    expect(p.whiteSide.games).toBe(0)
    expect(p.blackSide.games).toBe(0)
    expect(p.recentForm).toEqual([])
  })

  it('splits games by color', () => {
    const games = [
      game({ user: 'alice', asWhite: true,  outcome: 'win' }),
      game({ user: 'alice', asWhite: true,  outcome: 'resigned' }),
      game({ user: 'alice', asWhite: false, outcome: 'win' }),
    ]
    const p = scoutingProfile('alice', games)
    expect(p.whiteSide.games).toBe(2)
    expect(p.blackSide.games).toBe(1)
    expect(p.whiteSide.wins).toBe(1)
    expect(p.whiteSide.losses).toBe(1)
  })

  it('builds a per-opening breakdown', () => {
    const games = [
      game({ user: 'alice', asWhite: true, outcome: 'win',      eco: 'C50', opening: 'Italian-Game' }),
      game({ user: 'alice', asWhite: true, outcome: 'win',      eco: 'C50', opening: 'Italian-Game' }),
      game({ user: 'alice', asWhite: true, outcome: 'resigned', eco: 'C50', opening: 'Italian-Game' }),
    ]
    const p = scoutingProfile('alice', games)
    expect(p.whiteSide.openings[0].name).toContain('Italian')
    expect(p.whiteSide.openings[0].played).toBe(3)
  })

  it('caps recent form at 20', () => {
    const games = Array.from({ length: 30 }, (_, i) =>
      game({ user: 'alice', asWhite: true, outcome: 'win', endTime: i }),
    )
    const p = scoutingProfile('alice', games)
    expect(p.recentForm.length).toBe(20)
  })

  it('orders recent form most-recent-first', () => {
    const games = [
      game({ user: 'alice', asWhite: true, outcome: 'win',      endTime: 100 }),
      game({ user: 'alice', asWhite: true, outcome: 'resigned', endTime: 200 }),
    ]
    const p = scoutingProfile('alice', games)
    expect(p.recentForm[0]).toBe('L')
    expect(p.recentForm[1]).toBe('W')
  })

  it('flags worst opening when ≥3 games and low winrate', () => {
    const games = [
      game({ user: 'alice', asWhite: true, outcome: 'resigned', eco: 'C50', opening: 'Italian-Game' }),
      game({ user: 'alice', asWhite: true, outcome: 'resigned', eco: 'C50', opening: 'Italian-Game' }),
      game({ user: 'alice', asWhite: true, outcome: 'resigned', eco: 'C50', opening: 'Italian-Game' }),
    ]
    const p = scoutingProfile('alice', games)
    expect(p.worstOpenings.length).toBeGreaterThan(0)
    expect(p.worstOpenings[0].winRate).toBe(0)
  })
})

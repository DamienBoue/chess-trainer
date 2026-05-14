import { describe, expect, it } from 'vitest'
import { profileFromGames } from './profile'
import type { ChessComGame } from '../types'

function game(opts: { user: string; asWhite: boolean; outcome: 'win' | 'resigned' | 'agreed'; rating?: number; tc?: string }): ChessComGame {
  const userResult = opts.outcome
  const oppResult = opts.outcome === 'win' ? 'resigned' : opts.outcome === 'resigned' ? 'win' : 'agreed'
  return {
    url: 'g', pgn: '1. e4 1-0', time_control: '600', end_time: 1700000000,
    rated: true, time_class: opts.tc ?? 'rapid', rules: 'chess',
    white: { rating: opts.asWhite ? (opts.rating ?? 1500) : 1500, result: opts.asWhite ? userResult : oppResult, '@id': '', username: opts.asWhite ? opts.user : 'opp' },
    black: { rating: opts.asWhite ? 1500 : (opts.rating ?? 1500), result: opts.asWhite ? oppResult : userResult, '@id': '', username: opts.asWhite ? 'opp' : opts.user },
  } as unknown as ChessComGame
}

describe('profileFromGames', () => {
  it('returns zeros on empty input', () => {
    const p = profileFromGames('alice', [])
    expect(p.games).toBe(0)
    expect(p.wins).toBe(0)
    expect(p.winRate).toBe(0)
  })

  it('counts wins/losses/draws correctly', () => {
    const p = profileFromGames('alice', [
      game({ user: 'alice', asWhite: true,  outcome: 'win' }),
      game({ user: 'alice', asWhite: false, outcome: 'win' }),
      game({ user: 'alice', asWhite: true,  outcome: 'resigned' }),
      game({ user: 'alice', asWhite: true,  outcome: 'agreed' }),
    ])
    expect(p.wins).toBe(2)
    expect(p.losses).toBe(1)
    expect(p.draws).toBe(1)
    expect(p.winRate).toBeCloseTo(2.5 / 4, 4)
  })

  it('computes per-color win rates', () => {
    const p = profileFromGames('alice', [
      game({ user: 'alice', asWhite: true,  outcome: 'win' }),
      game({ user: 'alice', asWhite: true,  outcome: 'win' }),
      game({ user: 'alice', asWhite: false, outcome: 'resigned' }),
      game({ user: 'alice', asWhite: false, outcome: 'resigned' }),
    ])
    expect(p.whiteWinRate).toBe(1)
    expect(p.blackWinRate).toBe(0)
  })

  it('averages user rating', () => {
    const p = profileFromGames('alice', [
      game({ user: 'alice', asWhite: true, outcome: 'win', rating: 1500 }),
      game({ user: 'alice', asWhite: true, outcome: 'win', rating: 1700 }),
    ])
    expect(p.avgRating).toBe(1600)
  })

  it('breaks games down by time class', () => {
    const p = profileFromGames('alice', [
      game({ user: 'alice', asWhite: true, outcome: 'win', tc: 'rapid' }),
      game({ user: 'alice', asWhite: true, outcome: 'win', tc: 'blitz' }),
      game({ user: 'alice', asWhite: true, outcome: 'win', tc: 'blitz' }),
    ])
    expect(p.timeClass.rapid).toBe(1)
    expect(p.timeClass.blitz).toBe(2)
  })
})

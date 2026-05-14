// Elo bracket classification + inference from analyzed games. Covers
// the bracketing edge cases (boundary values, no data, mixed ratings)
// and the bracketChange suggestion that drives the Roadmap promotion
// banner.

import { describe, expect, it } from 'vitest'
import {
  BRACKETS, bracketForElo, inferEloFromGames, suggestBracketChange,
} from './elo'
import type { GameAnalysis } from '../types'

function fakeGame(rating: number, endTime: number): GameAnalysis {
  return {
    pgn: '', moves: [], userColor: 'white', result: 'win',
    opponent: 'x', endTime, timeClass: 'rapid', url: `g${endTime}`,
    userRating: rating,
  }
}

describe('bracketForElo', () => {
  it('returns casual when elo is unknown', () => {
    expect(bracketForElo(null).id).toBe('casual')
  })

  it.each([
    [500,  'beginner'],
    [999,  'beginner'],
    [1000, 'casual'],
    [1399, 'casual'],
    [1400, 'club'],
    [1799, 'club'],
    [1800, 'tournament'],
    [2099, 'tournament'],
    [2100, 'expert'],
    [2299, 'expert'],
    [2300, 'master'],
    [3000, 'master'],
  ])('elo %d → bracket %s', (elo, id) => {
    expect(bracketForElo(elo).id).toBe(id)
  })

  it('every bracket id is reachable', () => {
    const reachable = new Set(BRACKETS.map(b => bracketForElo(Math.floor((b.min + b.max) / 2)).id))
    expect(reachable.size).toBe(BRACKETS.length)
  })
})

describe('inferEloFromGames', () => {
  it('returns null when fewer than 3 games have ratings', () => {
    expect(inferEloFromGames([fakeGame(1500, 1), fakeGame(1500, 2)])).toBeNull()
  })

  it('returns the median rating of recent games', () => {
    const games = [
      fakeGame(1200, 1), fakeGame(1300, 2), fakeGame(1400, 3),
      fakeGame(1500, 4), fakeGame(1600, 5),
    ]
    expect(inferEloFromGames(games)).toBe(1400)
  })

  it('only considers the most recent N games', () => {
    // Old games are 800, recent games are 2000. Median should reflect recent.
    const games = [
      ...Array.from({ length: 30 }, (_, i) => fakeGame(800, i)),
      ...Array.from({ length: 20 }, (_, i) => fakeGame(2000, 100 + i)),
    ]
    expect(inferEloFromGames(games, 20)).toBe(2000)
  })

  it('skips games without a userRating', () => {
    const games = [
      fakeGame(1500, 1), fakeGame(1500, 2), fakeGame(1500, 3),
      { ...fakeGame(0, 4), userRating: undefined },
    ]
    expect(inferEloFromGames(games)).toBe(1500)
  })
})

describe('suggestBracketChange', () => {
  it('returns null when declared is missing', () => {
    expect(suggestBracketChange({ declared: null }, [fakeGame(2000, 1), fakeGame(2000, 2), fakeGame(2000, 3)])).toBeNull()
  })

  it('returns null when inferred is too close to declared (same bracket)', () => {
    const games = [fakeGame(1200, 1), fakeGame(1200, 2), fakeGame(1200, 3)]
    expect(suggestBracketChange({ declared: 1300 }, games)).toBeNull()
  })

  it('suggests promotion when inferred jumps a bracket up', () => {
    const games = [fakeGame(1900, 1), fakeGame(1900, 2), fakeGame(1900, 3)]
    const out = suggestBracketChange({ declared: 1500 }, games)
    expect(out?.kind).toBe('promote')
    expect(out?.nextBracket.id).toBe('tournament')
  })

  it('suggests demotion when inferred drops a bracket down', () => {
    const games = [fakeGame(1100, 1), fakeGame(1100, 2), fakeGame(1100, 3)]
    const out = suggestBracketChange({ declared: 1500 }, games)
    expect(out?.kind).toBe('demote')
    expect(out?.nextBracket.id).toBe('casual')
  })
})

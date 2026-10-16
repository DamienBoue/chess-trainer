import { describe, expect, it } from 'vitest'
import { findGameBySlug, gameSlug } from './gameSlug'

describe('game slugs', () => {
  it('identifies games by a short slug', () => {
    const games = [{ url: 'https://www.chess.com/game/live/123456789' }, { url: 'pgn-import://local/42' }]
    expect(gameSlug(games[0].url)).toBe('live-123456789')
    expect(findGameBySlug(games, gameSlug(games[1].url))).toBe(games[1])
    expect(findGameBySlug(games, 'live-1')).toBeUndefined()
  })
})

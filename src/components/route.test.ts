import { describe, expect, it } from 'vitest'
import { findGameBySlug, formatRoute, gameSlug, parseHash, sameScreen } from './route'

describe('routes', () => {
  it('round-trips every screen', () => {
    const routes = [
      { view: 'home' }, { view: 'games' }, { view: 'stats' }, { view: 'exercises' }, { view: 'roadmap' },
      { view: 'reverseDrill' }, { view: 'openingLab' }, { view: 'settings' },
      { view: 'strategy', strategyTab: 'atlas' as const },
      { view: 'book', bookId: 'mon livre/1' },
      { view: 'analysis', gameSlug: 'live-123', ply: 24, tab: 'strategy' as const },
    ]
    for (const r of routes) expect(parseHash(formatRoute(r))).toEqual(expect.objectContaining(r))
  })

  it('writes readable French hashes', () => {
    expect(formatRoute({ view: 'analysis', gameSlug: 'live-123', ply: 24, tab: 'strategy' })).toBe('#/partie/live-123?coup=24&onglet=strategie')
    expect(formatRoute({ view: 'analysis', gameSlug: 'live-123' })).toBe('#/partie/live-123')
    expect(formatRoute({ view: 'strategy', strategyTab: 'trainer' })).toBe('#/strategie/entrainement')
    expect(formatRoute({ view: 'exercises' })).toBe('#/exercices')
  })

  it('routes the hub pages and survives malformed book links', () => {
    expect(formatRoute({ view: 'trainHub' })).toBe('#/entrainement')
    expect(parseHash('#/theorie')).toEqual({ view: 'theoryHub' })
    expect(parseHash('#/progres')).toEqual({ view: 'progressHub' })
    expect(parseHash('#/strategie/entrainement')).toEqual({ view: 'strategy', strategyTab: 'trainer' })
    expect(parseHash('#/livre/%E0%A4%A')).toEqual({ view: 'library' })
  })

  it('leaves non-route hashes alone (shared exercises, empty)', () => {
    expect(parseHash('')).toBeNull()
    expect(parseHash('#share=abc')).toBeNull()
  })

  it('falls back sensibly on unknown or partial routes', () => {
    expect(parseHash('#/')).toEqual({ view: 'home' })
    expect(parseHash('#/nimporte')).toEqual({ view: 'home' })
    expect(parseHash('#/partie')).toEqual({ view: 'games' })
    expect(parseHash('#/strategie/xyz')).toEqual({ view: 'strategy', strategyTab: 'profile' })
    expect(parseHash('#/partie/live-1?coup=abc&onglet=zz')).toEqual({ view: 'analysis', gameSlug: 'live-1', ply: undefined, tab: undefined })
  })

  it('identifies games by a short slug', () => {
    const games = [{ url: 'https://www.chess.com/game/live/123456789' }, { url: 'pgn-import://local/42' }]
    expect(gameSlug(games[0].url)).toBe('live-123456789')
    expect(findGameBySlug(games, gameSlug(games[1].url))).toBe(games[1])
    expect(findGameBySlug(games, 'live-1')).toBeUndefined()
  })

  it('compares screens without the move/tab query', () => {
    expect(sameScreen('#/partie/live-1?coup=3', '#/partie/live-1?coup=9&onglet=coup')).toBe(true)
    expect(sameScreen('#/partie/live-1', '#/partie/live-2')).toBe(false)
  })
})

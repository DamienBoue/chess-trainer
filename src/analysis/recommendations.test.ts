import { describe, expect, it } from 'vitest'
import { buildRecommendations } from './recommendations'
import { buildGame } from './__fixtures__'

function withEarlyBlunder() {
  return buildGame({
    userColor: 'white', ecoCode: 'C50', opening: 'Italian',
    moves: [
      { ply: 5, san: '??', cpLoss: 300, classification: 'blunder', bestMoveSan: 'X' },
    ],
  })
}

describe('buildRecommendations', () => {
  it('returns empty when there are fewer than 3 games', () => {
    expect(buildRecommendations([withEarlyBlunder(), withEarlyBlunder()])).toEqual([])
  })

  it('flags an opening with consistent early blunders', () => {
    const games = [withEarlyBlunder(), withEarlyBlunder(), withEarlyBlunder()]
    const recs = buildRecommendations(games)
    expect(recs.some(r => r.kind === 'opening-early-loss')).toBe(true)
  })

  it('flags a low-winrate opening (≤30% over 4+ games)', () => {
    const losses = Array.from({ length: 5 }, () =>
      buildGame({
        ecoCode: 'C50', opening: 'Italian', result: 'loss',
        moves: [{ ply: 1, san: 'e4', cpLoss: 0, classification: 'best' }],
      }),
    )
    const recs = buildRecommendations(losses)
    expect(recs.some(r => r.kind === 'opening-low-winrate')).toBe(true)
  })

  it('sorts by priority descending', () => {
    const games = Array.from({ length: 5 }, () => withEarlyBlunder())
    const recs = buildRecommendations(games)
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].priority).toBeGreaterThanOrEqual(recs[i].priority)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { buildTimeline } from './timeline'
import { buildGame } from './__fixtures__'

describe('buildTimeline', () => {
  it('returns empty array on empty input', () => {
    expect(buildTimeline([])).toEqual([])
  })

  it('groups games into weekly buckets', () => {
    const monday1 = Math.floor(new Date('2026-05-04T12:00:00Z').getTime() / 1000)
    const tuesday1 = Math.floor(new Date('2026-05-05T12:00:00Z').getTime() / 1000)
    const nextMonday = Math.floor(new Date('2026-05-11T12:00:00Z').getTime() / 1000)
    const games = [
      buildGame({ endTime: monday1,    moves: [{ ply: 1, san: 'e4', cpLoss: 0, classification: 'best' }] }),
      buildGame({ endTime: tuesday1,   moves: [{ ply: 1, san: 'e4', cpLoss: 0, classification: 'best' }] }),
      buildGame({ endTime: nextMonday, moves: [{ ply: 1, san: 'e4', cpLoss: 0, classification: 'best' }] }),
    ]
    const weeks = buildTimeline(games)
    expect(weeks.length).toBe(2)
    expect(weeks[0].games).toBe(2)
    expect(weeks[1].games).toBe(1)
  })

  it('counts user moves and cpLoss per bucket', () => {
    const g = buildGame({
      userColor: 'white',
      moves: [
        { ply: 1, san: 'e4', cpLoss: 0,   classification: 'best' },
        { ply: 3, san: 'Nf3', cpLoss: 20, classification: 'great' },
        { ply: 5, san: '?', cpLoss: 200,  classification: 'mistake', bestMoveSan: 'X' },
      ],
    })
    const w = buildTimeline([g])[0]
    expect(w.userMoves).toBe(3)
    expect(w.cpLossSum).toBe(220)
    expect(w.avgUserCpLoss).toBeCloseTo(220 / 3, 4)
    expect(w.mistakes).toBe(1)
  })

  it('weeks are sorted chronologically', () => {
    const games = [
      buildGame({ endTime: 1700000000 + 86400 * 14, moves: [] }),
      buildGame({ endTime: 1700000000,              moves: [] }),
      buildGame({ endTime: 1700000000 + 86400 * 7,  moves: [] }),
    ]
    const weeks = buildTimeline(games)
    for (let i = 1; i < weeks.length; i++) {
      expect(weeks[i].weekStart).toBeGreaterThan(weeks[i - 1].weekStart)
    }
  })

  it('tracks the last known user rating for the bucket', () => {
    const g = buildGame({ userRating: 1500, moves: [] })
    const w = buildTimeline([g])[0]
    expect(w.rating).toBe(1500)
  })
})

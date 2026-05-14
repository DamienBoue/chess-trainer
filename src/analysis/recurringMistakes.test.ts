import { describe, expect, it } from 'vitest'
import { findRecurringMistakes } from './recurringMistakes'
import { buildGame } from './__fixtures__'

const FEN_A = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'

describe('findRecurringMistakes', () => {
  it('returns empty arrays when there are no qualifying mistakes', () => {
    const out = findRecurringMistakes([])
    expect(out.exact).toEqual([])
    expect(out.byOpening).toEqual([])
  })

  it('ignores mistakes below the MIN_CP_LOSS threshold (100)', () => {
    const g = buildGame({
      userColor: 'white',
      moves: [
        // Mistake with only 50 cp loss → below threshold, ignored.
        { ply: 5, san: 'h3', cpLoss: 50, classification: 'mistake', bestMoveSan: 'Nf3', fenBefore: FEN_A },
        { ply: 7, san: 'h3', cpLoss: 50, classification: 'mistake', bestMoveSan: 'Nf3', fenBefore: FEN_A },
      ],
    })
    const out = findRecurringMistakes([g, g])
    expect(out.exact).toEqual([])
  })

  it('detects same-position recurrence across distinct games', () => {
    const game1 = buildGame({
      url: 'g1', userColor: 'white', ecoCode: 'C50', opening: 'Italian',
      moves: [
        { ply: 9, san: 'Bxh6', cpLoss: 250, classification: 'blunder', bestMoveSan: 'Nf3', fenBefore: FEN_A },
      ],
    })
    const game2 = buildGame({
      url: 'g2', userColor: 'white', ecoCode: 'C50', opening: 'Italian',
      moves: [
        { ply: 9, san: 'Bxh6', cpLoss: 220, classification: 'blunder', bestMoveSan: 'Nf3', fenBefore: FEN_A },
      ],
    })
    const out = findRecurringMistakes([game1, game2])
    expect(out.exact.length).toBe(1)
    expect(out.exact[0].sanPlayed).toBe('Bxh6')
    expect(out.exact[0].occurrences.length).toBe(2)
    expect(out.exact[0].totalCpLost).toBe(470)
  })

  it('ignores recurrence within the same game (needs ≥2 distinct games)', () => {
    const game = buildGame({
      moves: [
        { ply: 5, san: 'h3', cpLoss: 200, classification: 'mistake', bestMoveSan: 'Nf3', fenBefore: FEN_A },
        { ply: 7, san: 'h3', cpLoss: 200, classification: 'mistake', bestMoveSan: 'Nf3', fenBefore: FEN_A },
      ],
    })
    expect(findRecurringMistakes([game]).exact).toEqual([])
  })

  it('opens an opening-shape cluster across different positions', () => {
    const game1 = buildGame({
      url: 'g1', userColor: 'white', ecoCode: 'C50', opening: 'Italian',
      moves: [
        { ply: 5, san: 'h3', cpLoss: 200, classification: 'mistake', bestMoveSan: 'Nf3', fenBefore: FEN_A },
      ],
    })
    const game2 = buildGame({
      url: 'g2', userColor: 'white', ecoCode: 'C50', opening: 'Italian',
      moves: [
        { ply: 7, san: 'h3', cpLoss: 200, classification: 'mistake', bestMoveSan: 'Nf3',
          fenBefore: 'rnbqkb1r/ppp2ppp/3p1n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R b KQkq - 0 4' },
      ],
    })
    const out = findRecurringMistakes([game1, game2])
    expect(out.byOpening.length).toBeGreaterThan(0)
    expect(out.byOpening[0].parentOpening).toBeTruthy()
  })

  it('sorts results by totalCpLost descending', () => {
    const seedPos1 = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3'
    const seedPos2 = 'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3'
    const games = [
      buildGame({ url: 'a', userColor: 'white', moves: [{ ply: 5, san: 'Nf6', cpLoss: 400, classification: 'blunder', bestMoveSan: 'Nc6', fenBefore: seedPos1 }] }),
      buildGame({ url: 'b', userColor: 'white', moves: [{ ply: 5, san: 'Nf6', cpLoss: 400, classification: 'blunder', bestMoveSan: 'Nc6', fenBefore: seedPos1 }] }),
      buildGame({ url: 'c', userColor: 'white', moves: [{ ply: 5, san: 'h3',  cpLoss: 150, classification: 'mistake',  bestMoveSan: 'Nc6', fenBefore: seedPos2 }] }),
      buildGame({ url: 'd', userColor: 'white', moves: [{ ply: 5, san: 'h3',  cpLoss: 150, classification: 'mistake',  bestMoveSan: 'Nc6', fenBefore: seedPos2 }] }),
    ]
    const out = findRecurringMistakes(games)
    expect(out.exact.length).toBe(2)
    expect(out.exact[0].totalCpLost).toBeGreaterThan(out.exact[1].totalCpLost)
  })
})

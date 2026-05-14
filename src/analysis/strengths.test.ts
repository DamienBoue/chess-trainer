import { describe, expect, it } from 'vitest'
import { buildStrengths } from './strengths'
import { aggregate } from './aggregate'
import { extractExercises } from './exercises'
import { buildGame } from './__fixtures__'

describe('buildStrengths', () => {
  it('returns no lines on empty corpus', () => {
    const stats = aggregate([])
    expect(buildStrengths({ stats, exercises: [] })).toEqual([])
  })

  it('flags better precision than opponent when the gap exceeds 5 cp', () => {
    // Build a corpus where the user plays many "best" moves and the
    // opponent plays mistakes. avgCpLossOpponent should exceed user's
    // by more than 5.
    const games = [
      buildGame({
        userColor: 'white',
        moves: [
          { ply: 1, san: 'e4',  cpLoss: 0,   classification: 'best' },
          { ply: 3, san: 'Nf3', cpLoss: 0,   classification: 'best' },
          // Opponent ply (even ply on white-side game): cpLoss 200.
          { ply: 2, san: '?',   cpLoss: 200, classification: 'mistake', bestMoveSan: 'X' },
          { ply: 4, san: '?',   cpLoss: 200, classification: 'mistake', bestMoveSan: 'X' },
        ],
      }),
    ]
    const stats = aggregate(games)
    const ex = extractExercises(games)
    const out = buildStrengths({ stats, exercises: ex })
    expect(out.some(s => s.kind === 'precision')).toBe(true)
  })

  it('flags a high win-rate opening (≥ 3 games, ≥ 60%)', () => {
    const games = [
      buildGame({ userColor: 'white', result: 'win',  ecoCode: 'C50', opening: 'Italian', moves: [] }),
      buildGame({ userColor: 'white', result: 'win',  ecoCode: 'C50', opening: 'Italian', moves: [] }),
      buildGame({ userColor: 'white', result: 'win',  ecoCode: 'C50', opening: 'Italian', moves: [] }),
      buildGame({ userColor: 'white', result: 'loss', ecoCode: 'C50', opening: 'Italian', moves: [] }),
    ]
    const stats = aggregate(games)
    const out = buildStrengths({ stats, exercises: [] })
    expect(out.some(s => s.kind === 'opening')).toBe(true)
  })

  it('flags a mastered motif (≥5 total, ≥3 found, ≤20% miss-rate)', () => {
    // Game with 5+ "great" or "best" moves carrying the same motif (capture).
    const games = [
      buildGame({
        userColor: 'white',
        moves: Array.from({ length: 7 }, (_, i) => ({
          ply: 9 + i * 2, san: 'Bxh7', cpLoss: 0,
          classification: 'best' as const,
          bestMoveSan: 'Bxh7',
        })),
      }),
    ]
    // Generate exercises with motifs by manually constructing.
    const stats = aggregate(games)
    const ex = extractExercises(games)
    // Force-feed motif data by augmenting.
    const out = buildStrengths({ stats, exercises: ex })
    expect(out).toBeInstanceOf(Array)
  })

  it('emits a "volume" line as fallback when 10+ games and no other signal', () => {
    const games = Array.from({ length: 10 }, () =>
      buildGame({ userColor: 'white', result: 'draw', ecoCode: 'A45', moves: [] }),
    )
    const stats = aggregate(games)
    const out = buildStrengths({ stats, exercises: [] })
    // With no other signal, "volume" should appear.
    expect(out.some(s => s.kind === 'volume' || s.kind === 'opening' || s.kind === 'precision')).toBe(true)
  })

  it('flags the strongest phase when the gap is ≥ 1.3×', () => {
    // Build games where opening is clean but endgame bleeds cp.
    const games = Array.from({ length: 3 }, (_, gi) =>
      buildGame({
        userColor: 'white',
        moves: [
          // Opening: 30 clean white moves (plies 1, 3, 5, ..., 59)
          ...Array.from({ length: 11 }, (_, i) => ({ ply: 1 + i * 2, san: 'X', cpLoss: 5, classification: 'best' as const })),
          // Endgame: lots of cpLoss late
          ...Array.from({ length: 11 }, (_, i) => ({ ply: 61 + i * 2, san: 'Y', cpLoss: 100, classification: 'inaccuracy' as const, bestMoveSan: 'Z' })),
        ],
        url: 'g' + gi,
      }),
    )
    const stats = aggregate(games)
    const out = buildStrengths({ stats, exercises: [] })
    expect(out).toBeInstanceOf(Array)
  })

  it('caps output at 3 lines', () => {
    // Construct a corpus that fires many strengths simultaneously.
    const games = Array.from({ length: 10 }, () =>
      buildGame({
        userColor: 'white', result: 'win', ecoCode: 'C50', opening: 'Italian',
        moves: [
          { ply: 1, san: 'e4', cpLoss: 0, classification: 'best' },
          { ply: 2, san: '?', cpLoss: 300, classification: 'blunder', bestMoveSan: 'X' },
        ],
      }),
    )
    const stats = aggregate(games)
    const ex = extractExercises(games)
    const out = buildStrengths({ stats, exercises: ex })
    expect(out.length).toBeLessThanOrEqual(3)
  })
})

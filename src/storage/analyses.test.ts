import { describe, expect, it } from 'vitest'
import type { GameAnalysis } from '../types'
import { migrateMoveMetrics } from './analyses'

const move = (o: Partial<GameAnalysis['moves'][number]>) => ({
  ply: 1, san: 'e4', fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  fenAfter: '', evalBefore: 0, evalAfter: 0, bestMoveSan: 'e4', cpLoss: 0, classification: 'best', ...o,
}) as GameAnalysis['moves'][number]

describe('migrateMoveMetrics', () => {
  it('turns a checkmate saved as lost for the mating side back into a win', () => {
    // Fool's mate by Black, saved before the "mate 0" sign fix: White "winning".
    const mate = move({
      ply: 4, san: 'Qh4#', bestMoveSan: 'Qh4#',
      fenBefore: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2',
      evalBefore: -99999, evalAfter: 100000, cpLoss: 2000, classification: 'blunder',
    })
    const { fixed, dirty } = migrateMoveMetrics({ g: { moves: [mate] } as unknown as GameAnalysis })
    expect(dirty).toBe(true)
    const m = fixed.g.moves[0]
    expect(m.evalAfter).toBe(-100000)
    expect(m.cpLoss).toBe(0)
    expect(m.classification).not.toBe('blunder')
  })

  it('leaves correct mates and ordinary moves alone', () => {
    const mate = move({
      ply: 4, san: 'Qh4#', bestMoveSan: 'Qh4#',
      fenBefore: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2',
      evalBefore: -99999, evalAfter: -100000, cpLoss: 0, classification: 'book',
    })
    const { fixed, dirty } = migrateMoveMetrics({ g: { moves: [move({ classification: 'book' }), mate] } as unknown as GameAnalysis })
    expect(dirty).toBe(false)
    expect(fixed.g.moves[1].evalAfter).toBe(-100000)
  })
})

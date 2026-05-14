import { describe, expect, it } from 'vitest'
import { exportExercisesToPgn } from './lichess'
import type { Exercise } from './exercises'

function ex(opts: Partial<Exercise> & Pick<Exercise, 'id' | 'fen' | 'bestMoveSan'>): Exercise {
  return {
    id: opts.id,
    category: opts.category ?? 'missed',
    fen: opts.fen,
    userColor: opts.userColor ?? 'white',
    sideToMove: opts.sideToMove ?? 'w',
    bestMoveSan: opts.bestMoveSan,
    bestLineSan: opts.bestLineSan,
    playedMoveSan: opts.playedMoveSan ?? '?',
    playedClassification: opts.playedClassification ?? 'blunder',
    cpSwing: opts.cpSwing ?? 0,
    evalBeforeWhite: 0, evalAfterPlayedWhite: 0,
    motifs: opts.motifs ?? [],
    difficulty: opts.difficulty ?? 'medium',
    context: opts.context ?? { gameUrl: '', opponent: 'opp', ply: 1, moveLabel: '1.', endTime: 0 },
  }
}

describe('exportExercisesToPgn', () => {
  it('emits one [Event] tag per exercise', () => {
    const text = exportExercisesToPgn([
      ex({ id: 'a', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', bestMoveSan: 'e5' }),
      ex({ id: 'b', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', bestMoveSan: 'e4' }),
    ], {})
    const events = text.match(/\[Event /g) ?? []
    expect(events.length).toBe(2)
  })

  it('embeds the puzzle FEN as [FEN] tag', () => {
    const text = exportExercisesToPgn([
      ex({ id: 'a', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', bestMoveSan: 'e5' }),
    ], {})
    expect(text).toContain('[FEN "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"]')
  })

  it('includes the best move line when provided', () => {
    const text = exportExercisesToPgn([
      ex({ id: 'a', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
           bestMoveSan: 'e5', bestLineSan: 'e5 Nf3 Nc6' }),
    ], {})
    expect(text).toContain('e5')
  })
})

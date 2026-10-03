// Shared test helpers. Pure-function builders for GameAnalysis,
// ChessComGame, Exercise — saves duplicating 15-30 lines of boilerplate
// across every component / module test.

import { Chess } from 'chess.js'
import { buildGame } from '../analysis/__fixtures__'
import type { ChessComGame, GameAnalysis, MoveAnalysis } from '../types'
import type { Exercise } from '../analysis/exercises'

/** Build a `GameAnalysis` by replaying a SAN sequence on a real
 *  chess.js board — every fenBefore/fenAfter is real, every move
 *  classified "best" with 0 cpLoss unless you override.
 */
export function gameFromSans(opts: {
  url: string
  userColor: 'white' | 'black'
  sans: string[]
  ecoCode?: string
  opening?: string
}): GameAnalysis {
  const c = new Chess()
  const moves = opts.sans.map((san, i) => {
    const fenBefore = c.fen()
    const mv = c.move(san)
    if (!mv) throw new Error('illegal san: ' + san)
    return {
      ply: i + 1, san: mv.san,
      cpLoss: 0, classification: 'best' as const,
      bestMoveSan: mv.san, fenBefore, fenAfter: c.fen(),
    }
  })
  return buildGame({
    userColor: opts.userColor, url: opts.url,
    ecoCode: opts.ecoCode ?? 'C50', opening: opts.opening ?? 'Italian Game',
    moves,
  })
}

/** Build a `GameAnalysis` from a SAN sequence with every move marked
 *  "best" — used in component tests that need a complete analysis but
 *  don't care about move classifications. */
export function fakeAnalysis(sans: string[], opts: Partial<GameAnalysis> = {}): GameAnalysis {
  const c = new Chess()
  const moves: MoveAnalysis[] = sans.map((san, i) => {
    const fenBefore = c.fen()
    const mv = c.move(san)
    if (!mv) throw new Error('illegal san: ' + san)
    return {
      ply: i + 1, san: mv.san,
      fenBefore, fenAfter: c.fen(),
      evalBefore: 0, evalAfter: 0,
      classification: 'best', cpLoss: 0,
    }
  })
  return {
    pgn: '', moves, userColor: 'white', result: 'win',
    opening: 'Italian Game', ecoCode: 'C50',
    opponent: 'bob', opponentRating: 1500, userRating: 1480,
    endTime: 1700000000, timeClass: 'rapid',
    url: 'https://test/g1',
    ...opts,
  }
}

/** Build a minimal `ChessComGame`. */
export function fakeChessComGame(overrides: Partial<ChessComGame> = {}): ChessComGame {
  return {
    url: 'https://test/g1', pgn: '', time_control: '600', end_time: 1700000000,
    rated: true, time_class: 'rapid', rules: 'chess',
    white: { rating: 1480, result: 'win',      '@id': '', username: 'alice' },
    black: { rating: 1500, result: 'resigned', '@id': '', username: 'bob' },
    ...overrides,
  } as unknown as ChessComGame
}

/** Build a minimal Exercise. */
export function fakeExercise(id: string, overrides: Partial<Exercise> = {}): Exercise {
  return {
    id,
    category: 'missed',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    userColor: 'white', sideToMove: 'w',
    bestMoveSan: 'e4', bestLineSan: 'e4',
    playedMoveSan: '??', playedClassification: 'blunder',
    cpSwing: 300, evalBeforeWhite: 0, evalAfterPlayedWhite: -300,
    motifs: [], difficulty: 'medium',
    context: { gameUrl: '', opponent: 'bob', ply: 1, moveLabel: '1.', endTime: 0 },
    ...overrides,
  }
}

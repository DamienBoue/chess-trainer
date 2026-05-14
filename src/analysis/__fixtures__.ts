// Shared fixtures for analysis tests. Builds GameAnalysis objects from
// plain descriptions without going through Stockfish — we just want the
// pure logic to have realistic-looking inputs.

import type { GameAnalysis, MoveAnalysis, MoveClassification } from '../types'

interface MoveSpec {
  ply: number
  san: string
  cpLoss: number
  classification: MoveClassification
  bestMoveSan?: string
  bestLineSan?: string
  fenBefore?: string
  fenAfter?: string
  evalBefore?: number
  evalAfter?: number
}

interface GameSpec {
  url?: string
  userColor?: 'white' | 'black'
  result?: 'win' | 'loss' | 'draw'
  opponent?: string
  opponentRating?: number
  userRating?: number
  endTime?: number
  opening?: string
  ecoCode?: string
  timeClass?: string
  moves: MoveSpec[]
}

let counter = 0

export function buildGame(spec: GameSpec): GameAnalysis {
  counter++
  const url = spec.url ?? `https://test/g${counter}`
  const moves: MoveAnalysis[] = spec.moves.map(m => ({
    ply: m.ply,
    san: m.san,
    fenBefore: m.fenBefore ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    fenAfter:  m.fenAfter  ?? 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    evalBefore: m.evalBefore ?? 0,
    evalAfter:  m.evalAfter  ?? 0,
    bestMoveSan: m.bestMoveSan,
    bestLineSan: m.bestLineSan,
    classification: m.classification,
    cpLoss: m.cpLoss,
  }))
  return {
    pgn: '',
    moves,
    userColor: spec.userColor ?? 'white',
    opening: spec.opening,
    ecoCode: spec.ecoCode,
    result: spec.result ?? 'draw',
    opponent: spec.opponent ?? 'opp',
    opponentRating: spec.opponentRating,
    userRating: spec.userRating,
    endTime: spec.endTime ?? 1700000000 + counter,
    timeClass: spec.timeClass ?? 'rapid',
    url,
  }
}

/** A small, predictable corpus: 4 games with a couple of user blunders
 *  each, mostly Italian Game / Ruy López shapes. */
export function sampleCorpus(): GameAnalysis[] {
  counter = 0
  return [
    buildGame({
      userColor: 'white', result: 'loss', opponent: 'bob', opponentRating: 1500, userRating: 1480,
      ecoCode: 'C50', opening: 'Italian Game',
      moves: [
        { ply: 1, san: 'e4', cpLoss: 0,   classification: 'book' },
        { ply: 2, san: 'e5', cpLoss: 0,   classification: 'book' },
        { ply: 3, san: 'Nf3', cpLoss: 0,  classification: 'book' },
        { ply: 4, san: 'Nc6', cpLoss: 0,  classification: 'book' },
        // User blunder on move 5
        { ply: 9, san: 'Bxh6', cpLoss: 300, classification: 'blunder',
          bestMoveSan: 'Nf3', bestLineSan: 'Nf3 Nc6 Bb5' },
        { ply: 11, san: 'Bg5', cpLoss: 200, classification: 'mistake',
          bestMoveSan: 'O-O',  bestLineSan: 'O-O d6 Re1' },
      ],
    }),
    buildGame({
      userColor: 'white', result: 'win', opponent: 'carol', userRating: 1500,
      ecoCode: 'C60', opening: 'Ruy López',
      moves: [
        { ply: 1, san: 'e4', cpLoss: 0, classification: 'book' },
        { ply: 5, san: 'Bb5', cpLoss: 0, classification: 'best' },
        { ply: 21, san: 'Qxh7+', cpLoss: 5, classification: 'best',
          bestMoveSan: 'Qxh7+', bestLineSan: 'Qxh7+ Kf8 Qh8#' },
      ],
    }),
    buildGame({
      userColor: 'black', result: 'loss', opponent: 'dave', userRating: 1495,
      ecoCode: 'C50', opening: 'Italian Game',
      moves: [
        // Same blunder shape as game 1 — for recurring mistake detection
        { ply: 8, san: 'Bxh3', cpLoss: 300, classification: 'blunder',
          bestMoveSan: 'Nf6', fenBefore: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 3 4' },
      ],
    }),
    buildGame({
      userColor: 'white', result: 'draw', opponent: 'eve', userRating: 1510,
      ecoCode: 'D20', opening: "Queen's Gambit Accepted",
      moves: [
        { ply: 1, san: 'd4', cpLoss: 0, classification: 'book' },
        { ply: 45, san: 'Kf2', cpLoss: 150, classification: 'mistake',
          bestMoveSan: 'Kg2' },
      ],
    }),
  ]
}

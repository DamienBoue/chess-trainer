// Reference positions for the strategy tests, built from real move orders
// so they are always legal.

import { Chess } from 'chess.js'

export function fenAfter(moves: string): string {
  const c = new Chess()
  for (const m of moves.split(/\s+/).filter(Boolean)) c.move(m)
  return c.fen()
}

export const POSITIONS = {
  /** QGD Exchange, White has played Rab1 (minority attack coming). */
  carlsbad: fenAfter('d4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7 e3 c6 Bd3 O-O Qc2 Nbd7 Nf3 Re8 O-O Nf8 Rab1'),
  /** Caro-Kann Exchange: a Carlsbad with colours reversed. */
  caroExchange: fenAfter('e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6 c3 Nf6 Bf4 Bg4 Qb3 Qd7 Nd2 e6'),
  /** Panov: White isolated d4 pawn, Black knight blockading on d5. */
  iqp: fenAfter('e4 c6 d4 d5 exd5 cxd5 c4 Nf6 Nc3 e6 Nf3 Be7 cxd5 Nxd5 Bd3 Nc6 O-O O-O Re1'),
  /** French Advance: locked chains e5-d4 vs e6-d5. */
  french: fenAfter('e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3'),
  /** King's Indian Mar del Plata-like closed centre. */
  kid: fenAfter('d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7 Ne1 Nd7 Nd3 f5'),
  /** Accelerated Dragon, Maroczy Bind. */
  maroczy: fenAfter('e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6 c4 Bg7 Be3 Nf6 Nc3 O-O Be2 d6'),
  /** Najdorf with ...e5: the d5 hole and the backward d6 pawn. */
  najdorf: fenAfter('e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5 Nb3 Be7 O-O O-O'),
  hedgehog: fenAfter('c4 c5 Nf3 Nf6 Nc3 e6 g3 b6 Bg2 Bb7 O-O a6 d4 cxd4 Nxd4 Qc7 e4 d6'),
  /** Dutch Stonewall (Black owns the wall). */
  dutch: fenAfter('d4 f5 c4 Nf6 g3 e6 Bg2 d5 Nf3 c6 O-O Bd6'),
  italian: fenAfter('e4 e5 Nf3 Nc6 Bc4 Bc5'),
  /** Benoni: d5 vs c5-d6. */
  benoni: fenAfter('d4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6 e4 g6 Nf3 Bg7 Be2 O-O O-O'),
  /** Opposite-side castling (Yugoslav-like). */
  oppositeCastling: fenAfter('e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6 O-O-O'),
  /** King and pawns: White's outside passed b-pawn runs. */
  outsidePasser: '8/5pk1/6p1/1P5p/7P/6P1/5PK1/8 w - - 0 40',
  /** Rook endgame: White rook behind its passed a-pawn. */
  tarrasch: '8/5pk1/6p1/P6p/7P/6P1/5PK1/R3r3 w - - 0 45',
} as const

import type { GameAnalysis, MoveAnalysis } from '../types'

/** An analysed game built from SAN moves. `costs` lets a test mark some
 *  plies as engine-judged errors: { [ply]: { cpLoss, best } }. */
export function analysedGame(
  sans: string,
  opts: { userColor?: 'white' | 'black'; costs?: Record<number, { cpLoss: number; best: string }> } = {},
): GameAnalysis {
  const c = new Chess()
  const moves: MoveAnalysis[] = []
  sans.split(/\s+/).filter(Boolean).forEach((san, i) => {
    const fenBefore = c.fen()
    const mv = c.move(san)
    const ply = i + 1
    const cost = opts.costs?.[ply]
    moves.push({
      ply, san: mv.san, fenBefore, fenAfter: c.fen(), evalBefore: 0, evalAfter: 0,
      bestMoveSan: cost?.best ?? mv.san,
      classification: !cost ? 'best' : cost.cpLoss >= 200 ? 'blunder' : cost.cpLoss >= 100 ? 'mistake' : 'inaccuracy',
      cpLoss: cost?.cpLoss ?? 0,
    })
  })
  return {
    pgn: '', moves, userColor: opts.userColor ?? 'white', result: 'draw', opponent: 'opp',
    endTime: 1700000000, timeClass: 'rapid', url: `https://test/${sans.length}`,
  }
}

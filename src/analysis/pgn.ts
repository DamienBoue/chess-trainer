import { Chess } from 'chess.js'
import type { ChessComGame, Color, GameResult } from '../types'

export interface PgnHeader {
  white: string
  black: string
  result: string
  eco?: string
  ecoUrl?: string
  opening?: string
  termination?: string
}

export function parsePgnHeaders(pgn: string): PgnHeader {
  const headers: Record<string, string> = {}
  const re = /\[(\w+)\s+"([^"]*)"\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(pgn))) headers[m[1]] = m[2]
  return {
    white: headers['White'] ?? '',
    black: headers['Black'] ?? '',
    result: headers['Result'] ?? '*',
    eco: headers['ECO'],
    ecoUrl: headers['ECOUrl'],
    opening: headers['ECOUrl']?.split('/').pop()?.replace(/-/g, ' '),
    termination: headers['Termination'],
  }
}

export function getUserSide(game: ChessComGame, username: string): Color {
  return game.white.username.toLowerCase() === username.toLowerCase() ? 'white' : 'black'
}

export function getResultForUser(game: ChessComGame, username: string): GameResult {
  const side = getUserSide(game, username)
  const myResult = side === 'white' ? game.white.result : game.black.result
  if (myResult === 'win') return 'win'
  if (myResult === 'checkmated' || myResult === 'resigned' || myResult === 'timeout' || myResult === 'abandoned') return 'loss'
  return 'draw'
}

export interface PlayedMove {
  san: string
  fenBefore: string
  fenAfter: string
  uci: string
  ply: number
}

// Extracts move list from a PGN. Strips chess.com clock annotations like {[%clk 0:01:23.4]}.
export function extractMoves(pgn: string): PlayedMove[] {
  const chess = new Chess()
  // chess.js can load PGNs; we use it then walk history
  try {
    chess.loadPgn(pgn, { strict: false })
  } catch {
    chess.loadPgn(pgn)
  }
  const history = chess.history({ verbose: true })
  // Replay to capture before/after FENs
  const replay = new Chess()
  const moves: PlayedMove[] = []
  history.forEach((mv, i) => {
    const fenBefore = replay.fen()
    replay.move({ from: mv.from, to: mv.to, promotion: mv.promotion })
    const fenAfter = replay.fen()
    moves.push({
      san: mv.san,
      fenBefore,
      fenAfter,
      uci: mv.from + mv.to + (mv.promotion ?? ''),
      ply: i + 1,
    })
  })
  return moves
}

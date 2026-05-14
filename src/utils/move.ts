// Tiny shared helpers around chess.js moves and SAN strings. Extracted
// from 6+ views that all repeated the same boilerplate.

import { Chess, type Move } from 'chess.js'

/** From a react-chessboard piece + target square, guess the promotion
 *  piece. We always promote to queen (the only ergonomic choice for a
 *  training app — the existing engine already plays optimal under-
 *  promotions when relevant). Returns `undefined` for non-promotion
 *  moves so chess.js doesn't reject them. */
export function autoPromotion(
  piece: { pieceType: string } | undefined,
  targetSquare: string,
): 'q' | undefined {
  if (!piece) return undefined
  if (!piece.pieceType.endsWith('P')) return undefined
  const rank = targetSquare[1]
  return rank === '1' || rank === '8' ? 'q' : undefined
}

/** Apply a react-chessboard drop event to a Chess instance. Returns the
 *  resulting Move or null if the move was illegal / impossible. */
export function tryUserMove(
  chess: Chess,
  args: {
    sourceSquare: string
    targetSquare: string | null
    piece?: { pieceType: string }
  },
): Move | null {
  if (!args.targetSquare) return null
  const promotion = autoPromotion(args.piece, args.targetSquare)
  try {
    return chess.move({
      from: args.sourceSquare,
      to: args.targetSquare,
      promotion,
    }) ?? null
  } catch {
    return null
  }
}

/** Strip Stockfish-style annotations (! ? !! ?! …) from a SAN move. */
export function cleanSan(san: string): string {
  return san.replace(/[!?]+$/, '')
}

/** Tolerant SAN equality: ignores check/mate suffixes and annotations,
 *  used by trainers that compare a played move to an expected one. */
export function sanMatches(played: string, expected: string): boolean {
  const a = cleanSan(played).replace(/[+#]$/, '')
  const b = cleanSan(expected).replace(/[+#]$/, '')
  return a === b
}

/** Truncate a FEN to its first 4 fields (placement + side + castling +
 *  en-passant). Drops the halfmove + fullmove counters so the same
 *  position reached in different games hashes the same. */
export function positionKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ')
}

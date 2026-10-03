// Color-flip / mirror helpers.
//
// A "mirror" of a chess position is the same position with colors swapped
// AND the board flipped upside-down (rank 1 ↔ rank 8). This is the
// classical exercise of training your repertoire on both colors:
//   - You play Italian as White → drill the same structures as Black.
//   - You handle a Caro-Kann as Black → drill it from the White side.
//
// All helpers are pure. They do not validate that the resulting FEN is
// legal — the caller is expected to feed valid input.

const RANK_FLIP: Record<string, string> = {
  '1': '8', '2': '7', '3': '6', '4': '5',
  '5': '4', '6': '3', '7': '2', '8': '1',
}
const CASTLE_ORDER = 'KQkq'

/** Mirror a FEN: flip ranks (1↔8), swap piece colors, swap side-to-move,
 *  swap castling rights, and flip the en-passant rank. */
export function mirrorFen(fen: string): string {
  const parts = fen.trim().split(/\s+/)
  if (parts.length < 4) throw new Error('mirrorFen: invalid FEN (need ≥4 fields): ' + fen)
  const [board, stm, castle, ep, ...rest] = parts

  // Board: reverse rank order, swap case of every piece letter.
  const mirroredBoard = board.split('/').slice().reverse()
    .map(rank => rank.replace(/[A-Za-z]/g, swapCase))
    .join('/')

  const newStm = stm === 'w' ? 'b' : stm === 'b' ? 'w' : stm

  // Castling rights: swap case (KQ ↔ kq), then re-sort in canonical order.
  const newCastle = castle === '-'
    ? '-'
    : castle.split('').map(swapCase)
        .sort((a, b) => CASTLE_ORDER.indexOf(a) - CASTLE_ORDER.indexOf(b))
        .join('') || '-'

  // En passant target square: file stays, rank flips.
  const newEp = ep === '-' ? '-' : ep.length >= 2 && RANK_FLIP[ep[1]] ? ep[0] + RANK_FLIP[ep[1]] : ep

  return [mirroredBoard, newStm, newCastle, newEp, ...rest].join(' ')
}

/** Mirror a single SAN string. Castling notation (O-O / O-O-O) is
 *  color-agnostic so it stays as-is; every rank digit (1..8) is flipped. */
export function mirrorSan(san: string): string {
  // Castling has no rank digits — handled by the no-op replace below.
  return san.replace(/[1-8]/g, d => RANK_FLIP[d])
}

/** Mirror every move in a SAN array. */
export function mirrorMoves(sans: string[]): string[] {
  return sans.map(mirrorSan)
}

function swapCase(c: string): string {
  return c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()
}

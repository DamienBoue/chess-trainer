// French wording helpers shared by insights, plans and game reviews.

import { type PieceType, type Side, FILES, sqName } from './board'

export const PIECE_FR: Record<PieceType, string> = {
  p: 'pion', n: 'cavalier', b: 'fou', r: 'tour', q: 'dame', k: 'roi',
}

/** "le cavalier f3" */
export function pieceRef(type: PieceType, sq: number): string {
  return `${type === 'q' || type === 'r' ? 'la' : 'le'} ${PIECE_FR[type]} ${sqName(sq)}`
}

export function squareList(squares: number[]): string {
  const names = squares.map(sqName)
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`
}

export function fileName(f: number): string {
  return `colonne ${FILES[f]}`
}

export function wingName(w: 'queenside' | 'center' | 'kingside'): string {
  return w === 'queenside' ? 'aile dame' : w === 'kingside' ? 'aile roi' : 'centre'
}

export function sideName(s: Side): string {
  return s === 'w' ? 'les Blancs' : 'les Noirs'
}

export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${n > 1 ? pluralWord : word}`
}

/** Pawn push in readable form: "b4-b5". */
export function pushName(from: number, to: number): string {
  return `${sqName(from)}-${sqName(to)}`
}

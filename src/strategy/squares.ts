// Strong and weak squares.
//
//   * A *hole* of side S is a square S's pawns can never attack again
//     (outside S's pawn attack span). Holes on S's relative ranks 3-5 are
//     where enemy pieces can settle — they are S's *weak squares*.
//   * An *outpost* for side S is an enemy hole on S's relative ranks 4-6
//     that S's pawns protect (or can still protect). A knight there can't
//     be chased by a pawn: Nimzowitsch's "strong square".
//
// Every fact carries a numeric score (relevance for the player) and the
// human-readable reasons behind it, so the UI and the LLM coach can say
// *why* a square matters, not just *that* it does.

import {
  type Board, type PieceType, type Side,
  fileOf, rankOf, relRank, opp, isLightSquare, kingSquare, piecesOf, knightRoute, sqName,
} from './board'
import type { PawnStructure } from './pawns'

export interface KnightRoute {
  from: number
  /** Squares visited, target included. */
  path: number[]
}

export interface SquareFact {
  sq: number
  /** Side that can use the square (outpost owner). */
  owner: Side
  /** Side for which the square is a weakness. */
  weakFor: Side
  /** The owner's pawns defend the square right now. */
  pawnProtected: boolean
  occupant?: { type: PieceType; color: Side }
  score: number
  reasons: string[]
  /** Shortest knight route for the owner, when one of its knights can get there in ≤ 3 moves. */
  route?: KnightRoute
}

export interface ColorComplex {
  side: Side
  color: 'light' | 'dark'
  squares: number[]
}

export interface SquareAnalysis {
  /** Strong squares for each side (in the enemy camp). */
  outposts: Record<Side, SquareFact[]>
  /** Weak squares of each side (in its own camp). */
  weak: Record<Side, SquareFact[]>
  colorComplex: Record<Side, ColorComplex | null>
}

const PIECE_NAME: Record<PieceType, string> = { p: 'pion', n: 'cavalier', b: 'fou', r: 'tour', q: 'dame', k: 'roi' }

function chebyshev(a: number, b: number): number {
  return Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)))
}

function minorChallengers(b: Board, side: Side, sq: number): number {
  // Pieces of `side` that could ever trade off an occupant of `sq`:
  // any knight, or a bishop running on the square's colour.
  return piecesOf(b, side, 'n').length
    + piecesOf(b, side, 'b').filter(s => isLightSquare(s) === isLightSquare(sq)).length
}

function bestKnightRoute(b: Board, side: Side, target: number, ps: PawnStructure, maxDepth = 3): KnightRoute | undefined {
  const enemyPawnAttacks = (side === 'w' ? ps.b : ps.w).attacks
  let best: KnightRoute | undefined
  for (const from of piecesOf(b, side, 'n')) {
    if (from === target) continue
    // Intermediate squares must be empty and safe from enemy pawns.
    const path = knightRoute(from, target, sq => !!b.squares[sq] || enemyPawnAttacks[sq] === 1, maxDepth)
    if (path && (!best || path.length < best.path.length)) best = { from, path }
  }
  return best
}

function analyzeOutposts(b: Board, side: Side, ps: PawnStructure): SquareFact[] {
  const them = opp(side)
  const mine = side === 'w' ? ps.w : ps.b
  const theirs = side === 'w' ? ps.b : ps.w
  const facts: SquareFact[] = []
  for (let sq = 0; sq < 64; sq++) {
    const rr = relRank(side, sq)
    if (rr < 4 || rr > 6) continue
    const f = fileOf(sq)
    if (f === 0 || f === 7) continue                        // rim squares make poor outposts
    if (theirs.attackSpan[sq]) continue                     // an enemy pawn can still kick a piece out
    const occ = b.squares[sq]
    // Pawns can't be outposts, and a square held by the enemy king
    // (endgames) isn't a usable one either.
    if (occ && (occ.type === 'p' || (occ.color === them && occ.type === 'k'))) continue
    const pawnProtected = mine.attacks[sq] === 1
    const protectable = mine.attackSpan[sq] === 1
    if (!pawnProtected && !protectable) continue

    const reasons: string[] = []
    let score = 0
    if (pawnProtected) { score += 3; reasons.push('soutenue par un pion') }
    else { score += 1; reasons.push('un pion peut venir la soutenir') }
    reasons.push('aucun pion adverse ne peut la contester')
    if (f === 3 || f === 4) { score += 2; reasons.push('case centrale') }
    else if (f === 2 || f === 5) score += 1
    if (rr >= 5) score += 1

    let occupant: SquareFact['occupant']
    if (occ) {
      occupant = { type: occ.type, color: occ.color }
      if (occ.color === side && occ.type === 'n') { score += 3; reasons.push('un cavalier l\'occupe déjà') }
      else if (occ.color === side && occ.type === 'b') { score += 1; reasons.push('occupée par un fou') }
    }
    const challengers = minorChallengers(b, them, sq)
    if (challengers === 0) { score += 2; reasons.push('l\'adversaire n\'a plus de pièce mineure pour l\'échanger') }

    let route: KnightRoute | undefined
    if (!occ || occ.color !== side) {
      route = bestKnightRoute(b, side, sq, ps)
      if (route) {
        score += route.path.length <= 2 ? 2 : 1
        reasons.push(`cavalier ${sqName(route.from)} → ${sqName(sq)} en ${route.path.length} coup${route.path.length > 1 ? 's' : ''}`)
      }
    }
    facts.push({ sq, owner: side, weakFor: them, pawnProtected, occupant, score, reasons, route })
  }
  facts.sort((a, b) => b.score - a.score)
  return facts
}

function analyzeWeakSquares(b: Board, side: Side, ps: PawnStructure): SquareFact[] {
  const them = opp(side)
  const mine = side === 'w' ? ps.w : ps.b
  const theirs = side === 'w' ? ps.b : ps.w
  const king = kingSquare(b, side)
  const facts: SquareFact[] = []
  // Squares just in front of our own weak pawns are natural blockade squares.
  const blockadeSquares = new Set<number>()
  for (const p of mine.pawns) {
    if (!(p.isolated || p.backward)) continue
    const front = side === 'w' ? p.sq + 8 : p.sq - 8
    if (front >= 0 && front < 64) blockadeSquares.add(front)
  }
  for (let sq = 0; sq < 64; sq++) {
    const rr = relRank(side, sq)
    if (rr < 3 || rr > 5) continue
    if (mine.attackSpan[sq]) continue
    const occ = b.squares[sq]
    if (occ && occ.type === 'p') continue
    const f = fileOf(sq)
    const reasons: string[] = []
    let score = 0
    const enemyProtects = theirs.attacks[sq] === 1
    if (enemyProtects) { score += 3; reasons.push('l\'adversaire la soutient avec un pion') }
    else if (theirs.attackSpan[sq]) { score += 1 }
    if (f >= 2 && f <= 5) { score += 2; reasons.push('case centrale') }
    if (king >= 0 && chebyshev(king, sq) <= 2) { score += 2; reasons.push('près du roi') }
    if (blockadeSquares.has(sq)) { score += 2; reasons.push('case de blocage devant un pion faible') }
    let occupant: SquareFact['occupant']
    if (occ && occ.color === them) {
      occupant = { type: occ.type, color: occ.color }
      score += occ.type === 'n' ? 3 : occ.type === 'b' ? 2 : 1
      reasons.push(`un ${PIECE_NAME[occ.type]} adverse s'y est installé`)
    }
    if (minorChallengers(b, side, sq) === 0) { score += 1; reasons.push('aucune pièce mineure pour la contester') }
    if (score < 3) continue
    reasons.unshift('aucun de tes pions ne pourra plus la contrôler')
    facts.push({ sq, owner: them, weakFor: side, pawnProtected: enemyProtects, occupant, score, reasons })
  }
  facts.sort((a, b) => b.score - a.score)
  return facts
}

function analyzeColorComplex(b: Board, side: Side, weak: SquareFact[]): ColorComplex | null {
  // A colour complex is weak when the bishop of that colour is gone and
  // several weak squares of that colour cluster (often around the king).
  const bishops = piecesOf(b, side, 'b')
  const hasLight = bishops.some(isLightSquare)
  const hasDark = bishops.some(s => !isLightSquare(s))
  const them = opp(side)
  const enemyBishops = piecesOf(b, them, 'b')
  for (const light of [true, false]) {
    if (light ? hasLight : hasDark) continue
    const enemyCanUse = enemyBishops.some(s => isLightSquare(s) === light) || piecesOf(b, them, 'q').length > 0
    if (!enemyCanUse) continue
    const squares = weak.filter(w => isLightSquare(w.sq) === light).map(w => w.sq)
    if (squares.length >= 3) return { side, color: light ? 'light' : 'dark', squares }
  }
  return null
}

export function analyzeSquares(b: Board, ps: PawnStructure): SquareAnalysis {
  const weakW = analyzeWeakSquares(b, 'w', ps)
  const weakB = analyzeWeakSquares(b, 'b', ps)
  return {
    outposts: { w: analyzeOutposts(b, 'w', ps), b: analyzeOutposts(b, 'b', ps) },
    weak: { w: weakW, b: weakB },
    colorComplex: { w: analyzeColorComplex(b, 'w', weakW), b: analyzeColorComplex(b, 'b', weakB) },
  }
}

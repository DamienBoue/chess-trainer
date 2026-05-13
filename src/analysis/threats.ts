// Threat detector for the anti-blunder reflex drill.
//
// Given a position where it's the user's turn, identify pieces that are
// under-defended — i.e. an opponent piece can capture them and the trade
// loses material. The goal is NOT a full tactical solver; it's the
// "obvious" threats a club player should spot in 5 seconds.

import { Chess, type Color, type Square, type PieceSymbol } from 'chess.js'

const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }

export interface Threat {
  square: Square              // user piece under threat
  pieceType: PieceSymbol
  value: number               // piece value (pawn=1, … queen=9)
  attackers: number
  defenders: number
  delta: number               // approximated material loss if the capture goes through
}

/** Detect under-defended user pieces. The most valuable (highest delta) goes
 *  first. `userColor` is the side to move at this FEN.
 */
export function detectThreats(fen: string, userColor: Color): Threat[] {
  const board = new Chess(fen)
  const opp: Color = userColor === 'w' ? 'b' : 'w'
  const threats: Threat[] = []
  for (let r = 1; r <= 8; r++) {
    for (const f of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const) {
      const sq = `${f}${r}` as Square
      const p = board.get(sq)
      if (!p || p.color !== userColor) continue
      const attackers = board.attackers(sq, opp).length
      if (attackers === 0) continue
      const defenders = board.attackers(sq, userColor).length
      // Estimate material loss assuming optimal exchanges:
      //   * 0 defenders -> we lose the whole piece (value)
      //   * fewer defenders than attackers -> we lose (value - attacker's value)
      //     ignoring sub-trades; a conservative approximation.
      let delta = 0
      if (defenders === 0) {
        delta = VALUE[p.type]
      } else if (attackers > defenders) {
        // The attacker plays the cheapest piece into the trade; we approximate
        // the loss as our piece minus the attacker's value (best case for us).
        const attackerSquares = board.attackers(sq, opp)
        const cheapestAttacker = attackerSquares
          .map(s => VALUE[(board.get(s as Square)?.type ?? 'p') as PieceSymbol])
          .reduce((a, b) => Math.min(a, b), 100)
        delta = VALUE[p.type] - cheapestAttacker
      }
      // We only count it as a real threat when material is actually lost.
      // King "threats" (check) are flagged with delta = 100 below.
      if (p.type === 'k' && attackers > 0) {
        // The king is attacked — it's a check. The user must address it.
        // delta = 100 makes it the top "threat" regardless of material.
        threats.push({ square: sq, pieceType: 'k', value: 100, attackers, defenders, delta: 100 })
      } else if (delta > 0) {
        threats.push({ square: sq, pieceType: p.type, value: VALUE[p.type], attackers, defenders, delta })
      }
    }
  }
  threats.sort((a, b) => b.delta - a.delta)
  return threats
}

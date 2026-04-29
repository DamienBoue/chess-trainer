import { Chess } from 'chess.js'
import type { Square, Color, PieceSymbol } from 'chess.js'
import type { MoveAnalysis } from '../types'

export type MotifTag =
  | 'mate-found' | 'mate-missed'
  | 'fork' | 'fork-royal'
  | 'pin'
  | 'hanging-capture'
  | 'sacrifice'
  | 'capture'

export const MOTIF_LABELS: Record<MotifTag, string> = {
  'mate-found': 'Mat trouvé',
  'mate-missed': 'Mat raté',
  'fork': 'Fourchette',
  'fork-royal': 'Fourchette royale',
  'pin': 'Clouage',
  'hanging-capture': 'Pièce en prise',
  'sacrifice': 'Sacrifice',
  'capture': 'Capture',
}

const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const ALL_SQUARES: Square[] = []
for (let r = 1; r <= 8; r++) for (const f of FILES) ALL_SQUARES.push(`${f}${r}` as Square)

// Squares attacked by the piece sitting on `from` in the given chess instance.
function attacksFrom(chess: Chess, from: Square): Square[] {
  const piece = chess.get(from)
  if (!piece) return []
  const out: Square[] = []
  for (const s of ALL_SQUARES) {
    if (s === from) continue
    if (chess.attackers(s, piece.color).includes(from)) out.push(s)
  }
  return out
}

// Detect a fork: the moving piece, after the move, attacks ≥2 enemy pieces of
// equal-or-greater value (king counts and is flagged separately as 'royal').
function detectFork(chess: Chess, mover: Color, dest: Square): MotifTag | null {
  const piece = chess.get(dest)
  if (!piece) return null
  const myValue = VALUE[piece.type]
  const enemyColor: Color = mover === 'w' ? 'b' : 'w'
  const targets = attacksFrom(chess, dest)
  let kingHit = false
  let valuableHits = 0
  for (const t of targets) {
    const p = chess.get(t)
    if (!p || p.color !== enemyColor) continue
    if (p.type === 'k') { kingHit = true; valuableHits++ }
    else if (VALUE[p.type] >= myValue) valuableHits++
  }
  if (valuableHits >= 2) return kingHit ? 'fork-royal' : 'fork'
  return null
}

// Detect a hanging piece capture: the move captures an enemy piece that was
// not adequately defended (more attackers than defenders OR no defender).
function detectHangingCapture(beforeFen: string, dest: Square, mover: Color): MotifTag | null {
  const before = new Chess(beforeFen)
  const captured = before.get(dest)
  if (!captured) return null
  const enemyColor: Color = mover === 'w' ? 'b' : 'w'
  if (captured.color !== enemyColor) return null
  const defenders = before.attackers(dest, enemyColor).length
  const attackers = before.attackers(dest, mover).length
  // Truly hanging: no defenders, but we still gain something.
  if (defenders === 0) return 'hanging-capture'
  // Or: attackers > defenders in a way that wins material (under-defended).
  if (attackers > defenders && VALUE[captured.type] >= 2) return 'hanging-capture'
  return null
}

// Detect a pin against a more valuable piece behind the target.
// We test "remove this enemy piece — does a more valuable piece behind it
// become attacked by us?". This catches absolute pins and skewer-like patterns.
function detectPin(beforeFen: string, mover: Color): MotifTag | null {
  const before = new Chess(beforeFen)
  const enemyColor: Color = mover === 'w' ? 'b' : 'w'
  const board = before.board()
  for (const row of board) {
    for (const cell of row) {
      if (!cell || cell.color !== enemyColor) continue
      // Try removing the enemy piece and see if a more valuable enemy piece
      // becomes attacked through that line.
      const fen = before.fen()
      const test = new Chess(fen)
      test.remove(cell.square)
      const myValue = VALUE[cell.type]
      // Look for a more valuable enemy piece newly attacked
      for (const r2 of test.board()) for (const c2 of r2) {
        if (!c2 || c2.color !== enemyColor) continue
        if (VALUE[c2.type] <= myValue) continue
        const wasAttacked = before.isAttacked(c2.square, mover)
        const nowAttacked = test.isAttacked(c2.square, mover)
        if (!wasAttacked && nowAttacked) return 'pin'
      }
    }
  }
  return null
}

// Detect a sacrifice: best move is a capture but on a square where we lose
// material in the immediate exchange — yet the engine considers the position
// favourable afterwards (positive eval-after for the mover).
function detectSacrifice(
  beforeFen: string, dest: Square, mover: Color,
  evalAfterMover: number,
): MotifTag | null {
  const before = new Chess(beforeFen)
  const target = before.get(dest)
  if (!target) return null
  // Get the moving piece by reading the fenBefore square the move came from is
  // unknown here; approximate via attackers on dest of mover's color.
  const myAttackers = before.attackers(dest, mover)
  if (myAttackers.length === 0) return null
  const attackerSq = myAttackers[0]
  const attacker = before.get(attackerSq)
  if (!attacker) return null
  const defenders = before.attackers(dest, mover === 'w' ? 'b' : 'w').length
  // We capture worth = target value, then we get recaptured if defenders > 0.
  if (defenders > 0 && VALUE[attacker.type] > VALUE[target.type]) {
    // We're giving up more material than we capture in the immediate exchange.
    if (evalAfterMover >= 100) return 'sacrifice'
  }
  return null
}

export function detectMotifs(move: MoveAnalysis): MotifTag[] {
  const tags: MotifTag[] = []
  const best = move.bestMoveSan ?? ''
  const line = move.bestLineSan ?? ''

  // Mate
  if (best.endsWith('#') || /[#]/.test(line)) {
    if (move.classification === 'mistake' || move.classification === 'blunder') tags.push('mate-missed')
    else tags.push('mate-found')
  }

  // For positional motifs we need to play the best move on the position.
  try {
    const before = new Chess(move.fenBefore)
    const stm = before.turn()
    if (!move.bestMoveSan) return tags
    const mv = before.move(move.bestMoveSan)
    if (mv) {
      const dest = mv.to as Square
      const fork = detectFork(before, stm, dest)
      if (fork) tags.push(fork)

      // Re-derive flags for the immediate move
      if (mv.flags.includes('c') || mv.flags.includes('e')) {
        const hanging = detectHangingCapture(move.fenBefore, dest, stm)
        if (hanging && !tags.includes('hanging-capture')) tags.push(hanging)
      }

      const evalAfterMover = stm === 'w' ? move.evalAfter : -move.evalAfter
      const sac = detectSacrifice(move.fenBefore, dest, stm, evalAfterMover)
      if (sac) tags.push(sac)

      const pin = detectPin(move.fenBefore, stm)
      if (pin) tags.push(pin)
    }
  } catch { /* noop */ }

  // Generic capture marker (kept for back-compat) only if no richer tag covered it.
  if (best.includes('x') && !tags.includes('hanging-capture') && !tags.includes('sacrifice')) {
    tags.push('capture')
  }

  return tags
}

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

// Every helper reads boards built once per move (detectMotifs): building a
// chess.js board parses and validates a FEN, the costly part, and this runs
// on every move of every analysed game.

// Detect a fork: the moving piece, after the move, attacks ≥2 enemy pieces of
// equal-or-greater value (king counts and is flagged separately as 'royal').
function detectFork(after: Chess, mover: Color, dest: Square): MotifTag | null {
  const piece = after.get(dest)
  if (!piece) return null
  const myValue = VALUE[piece.type]
  const enemyColor: Color = mover === 'w' ? 'b' : 'w'
  let kingHit = false
  let valuableHits = 0
  for (const row of after.board()) for (const p of row) {
    if (!p || p.color !== enemyColor || p.square === dest) continue
    if (!after.attackers(p.square, piece.color).includes(dest)) continue
    if (p.type === 'k') { kingHit = true; valuableHits++ }
    else if (VALUE[p.type] >= myValue) valuableHits++
  }
  if (valuableHits >= 2) return kingHit ? 'fork-royal' : 'fork'
  return null
}

// Detect a hanging piece capture: the move captures an enemy piece that was
// not adequately defended (more attackers than defenders OR no defender).
function detectHangingCapture(before: Chess, dest: Square, mover: Color): MotifTag | null {
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
// The question is "remove this enemy piece — does a more valuable piece
// behind it become attacked by us?", which catches absolute pins and
// skewer-like patterns. Only a bishop, rook or queen line can open, so: along
// each of our sliders' lines, the first piece met is an enemy, the next one a
// more valuable enemy that nothing attacks yet.
const LINES: Partial<Record<PieceSymbol, [number, number][]>> = {
  b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  q: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]],
}

function detectPin(before: Chess, mover: Color): MotifTag | null {
  const board = before.board()
  const at = (row: number, col: number) => (row >= 0 && row < 8 && col >= 0 && col < 8 ? board[row][col] : undefined)
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    const slider = board[row][col]
    if (!slider || slider.color !== mover) continue
    for (const [dr, dc] of LINES[slider.type] ?? []) {
      let r = row + dr, c = col + dc
      while (at(r, c) === null) { r += dr; c += dc }
      const front = at(r, c)
      if (!front || front.color === mover) continue
      r += dr; c += dc
      while (at(r, c) === null) { r += dr; c += dc }
      const back = at(r, c)
      if (back && back.color !== mover && VALUE[back.type] > VALUE[front.type] && !before.isAttacked(back.square, mover)) return 'pin'
    }
  }
  return null
}

// Detect a sacrifice: best move is a capture but on a square where we lose
// material in the immediate exchange — yet the engine considers the position
// favourable afterwards (positive eval-after for the mover).
function detectSacrifice(
  before: Chess, dest: Square, mover: Color,
  evalAfterMover: number,
): MotifTag | null {
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

// One result per move object: the exercises, the plan, the stats and the
// drills all ask for the same moves, again after each new analysis.
const cache = new WeakMap<MoveAnalysis, MotifTag[]>()

export function detectMotifs(move: MoveAnalysis): MotifTag[] {
  const known = cache.get(move)
  if (known) return known
  const tags = computeMotifs(move)
  cache.set(move, tags)
  return tags
}

function computeMotifs(move: MoveAnalysis): MotifTag[] {
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
    const after = new Chess(move.fenBefore)
    const stm = after.turn()
    if (!move.bestMoveSan) return tags
    const mv = after.move(move.bestMoveSan)
    if (mv) {
      const dest = mv.to as Square
      const fork = detectFork(after, stm, dest)
      if (fork) tags.push(fork)

      // Back to the position before the move.
      after.undo()
      const before = after

      // Re-derive flags for the immediate move
      if (mv.flags.includes('c') || mv.flags.includes('e')) {
        const hanging = detectHangingCapture(before, dest, stm)
        if (hanging && !tags.includes('hanging-capture')) tags.push(hanging)
      }

      const evalAfterMover = stm === 'w' ? move.evalAfter : -move.evalAfter
      const sac = detectSacrifice(before, dest, stm, evalAfterMover)
      if (sac) tags.push(sac)

      const pin = detectPin(before, stm)
      if (pin) tags.push(pin)
    }
  } catch { /* noop */ }

  // Generic capture marker (kept for back-compat) only if no richer tag covered it.
  if (best.includes('x') && !tags.includes('hanging-capture') && !tags.includes('sacrifice')) {
    tags.push('capture')
  }

  return tags
}

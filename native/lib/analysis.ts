// Analysis helpers shared by the analysis screens.
import { Chess } from 'chess.js'
import type { GameAnalysis } from '@shared/types'
import { reviewGameStrategy, type GameStrategyReview } from '@shared/strategy/game'

const reviews = new WeakMap<GameAnalysis, GameStrategyReview | null>()

/** The game's strategic review, computed once per analysis (null if it fails). */
export function strategyReviewOf(a: GameAnalysis): GameStrategyReview | null {
  if (!reviews.has(a)) {
    try { reviews.set(a, reviewGameStrategy(a)) } catch { reviews.set(a, null) }
  }
  return reviews.get(a) ?? null
}

/** Plies worth stopping at: the player's errors and strategic concessions. */
export function keyMomentsOf(a: GameAnalysis): number[] {
  const userIsWhite = a.userColor === 'white'
  const plies = new Set<number>()
  for (const m of a.moves) {
    if ((m.ply % 2 === 1) !== userIsWhite) continue
    if (m.classification === 'inaccuracy' || m.classification === 'mistake' || m.classification === 'blunder') plies.add(m.ply)
  }
  for (const e of strategyReviewOf(a)?.events ?? []) {
    if ((e.side === 'w') === userIsWhite && e.polarity === 'minus') plies.add(e.focusPly)
  }
  return [...plies].filter(p => p > 0).sort((x, y) => x - y)
}

/** From/to squares of a SAN move in a position, or null. */
export function squaresOf(fen: string, san: string | undefined): { from: string; to: string } | null {
  if (!san) return null
  try {
    const m = new Chess(fen).move(san)
    return m ? { from: m.from, to: m.to } : null
  } catch {
    return null
  }
}

/** "12. Nf3" for a White move, "12... Rc8" for a Black one. */
export function moveLabel(ply: number, san: string): string {
  return `${Math.ceil(ply / 2)}${ply % 2 === 1 ? '.' : '...'} ${san}`
}

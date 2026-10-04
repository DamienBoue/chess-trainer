// "Revoir mes erreurs" — the player's costly moves of one game, replayed
// as exercises from the decision point (Lichess "Learn from your
// mistakes", chess.com "Retry"). Pure: which moves to review, the
// progressive hints, and the verdict on an attempt. The engine call that
// evaluates an alternative move lives in the UI.
//
// Alternatives are judged in winning chances, like Lichess: losing 30 cp
// matters at equality, much less when already +6.

import { Chess } from 'chess.js'
import type { GameAnalysis, MoveAnalysis, MoveClassification } from '../types'
import type { GameEvent } from '../strategy/game'
import { detectMotifs, type MotifTag } from './motifs'
import { sanMatches } from '../utils/move'

export interface RetryPlan {
  title: string
  why: string
  conceptId?: string
}

export interface RetryItem {
  ply: number
  /** Decision position (before the player's move). */
  fen: string
  side: 'w' | 'b'
  playedSan: string
  bestSan: string
  bestLineSan?: string
  bestFrom: string
  bestTo: string
  cpLoss: number
  classification: MoveClassification
  /** Evaluation of the decision position with best play (White's view). */
  evalBest: number
  /** Evaluation after the move actually played (White's view). */
  evalPlayed: number
  /** The recognisable plan the engine's move started, when there was one. */
  plan?: RetryPlan
  /** Progressive hints: the idea first, then which piece to move. */
  hints: string[]
}

export type RetryVerdict = 'best' | 'good' | 'same' | 'wrong'

const MOTIF_HINTS: Partial<Record<MotifTag, string>> = {
  'mate-found': 'Il y a un mat forcé.',
  'mate-missed': 'Il y a un mat forcé.',
  'fork-royal': 'Cherche une fourchette avec échec.',
  fork: 'Cherche une fourchette.',
  sacrifice: 'Un sacrifice fonctionne ici.',
  'hanging-capture': 'Une pièce adverse est mal défendue.',
  capture: 'Il y a une prise intéressante.',
}
// Only motifs tied to the best move itself: the pin detector looks at the
// whole position and would send the player after the wrong idea.
const MOTIF_ORDER: MotifTag[] = ['mate-missed', 'mate-found', 'fork-royal', 'fork', 'sacrifice', 'hanging-capture', 'capture']

const PIECE_FR: Record<string, string> = { p: 'pion', n: 'cavalier', b: 'fou', r: 'tour', q: 'dame', k: 'roi' }

const moverOf = (ply: number): 'w' | 'b' => (ply % 2 === 1 ? 'w' : 'b')

function ideaHint(m: MoveAnalysis, plan?: RetryPlan): string {
  if (plan) return `Indice stratégique : pense au plan « ${plan.title} ».`
  let tags: MotifTag[] = []
  try { tags = detectMotifs(m) } catch { /* no motif */ }
  const tag = MOTIF_ORDER.find(t => tags.includes(t))
  if (tag && MOTIF_HINTS[tag]) return `Indice : ${MOTIF_HINTS[tag]}`
  const best = m.bestMoveSan ?? ''
  if (!best.includes('x') && !best.includes('+')) return 'Indice : un coup calme, sans prise ni échec.'
  return 'Indice : regarde d\'abord les coups forcés (échecs, prises, menaces).'
}

/** The player's mistakes and blunders, plus costly moves where the engine
 *  was starting a recognised plan (strategic misses), in game order. */
export function buildRetryItems(a: GameAnalysis, events: GameEvent[] = []): RetryItem[] {
  const userSide: 'w' | 'b' = a.userColor === 'white' ? 'w' : 'b'
  const missed = new Map<number, GameEvent>()
  for (const e of events) {
    if (e.kind === 'missed-plan' && e.side === userSide) missed.set(e.ply, e)
  }
  const items: RetryItem[] = []
  for (const m of a.moves) {
    if (moverOf(m.ply) !== userSide) continue
    const event = missed.get(m.ply)
    const costly = m.classification === 'mistake' || m.classification === 'blunder'
    if (!costly && !event) continue
    if (!m.bestMoveSan || sanMatches(m.san, m.bestMoveSan)) continue
    let best
    try { best = new Chess(m.fenBefore).move(m.bestMoveSan) } catch { continue }
    const plan: RetryPlan | undefined = event
      ? { title: event.title.replace(/^Plan manqué : /, ''), why: event.detail, conceptId: event.conceptId }
      : undefined
    const piece = PIECE_FR[best.piece] ?? 'pièce'
    items.push({
      ply: m.ply,
      fen: m.fenBefore,
      side: userSide,
      playedSan: m.san,
      bestSan: best.san,
      bestLineSan: m.bestLineSan,
      bestFrom: best.from,
      bestTo: best.to,
      cpLoss: m.cpLoss,
      classification: m.classification,
      evalBest: m.evalBefore,
      evalPlayed: m.evalAfter,
      plan,
      hints: [ideaHint(m, plan), `Joue ${piece === 'dame' || piece === 'tour' ? 'ta' : 'ton'} ${piece} de ${best.from}.`],
    })
  }
  return items
}

/** Lichess winning chances in [-1, 1] from a White-view evaluation. */
export function winningChances(cpWhite: number, side: 'w' | 'b'): number {
  const pov = side === 'w' ? cpWhite : -cpWhite
  const cp = Math.abs(pov) > 50000 ? Math.sign(pov) * 1000 : Math.max(-1000, Math.min(1000, pov))
  return 2 / (1 + Math.exp(-0.00368208 * cp)) - 1
}

/** Tolerance in winning chances for accepting an alternative move. */
export const RETRY_TOLERANCE = 0.05

/** Verdict on an attempt. `evalAfterAttempt` (White's view) is only needed
 *  when the attempt is neither the engine's move nor the game move. */
export function judgeAttempt(item: RetryItem, attemptSan: string, evalAfterAttempt?: number): RetryVerdict | 'pending' {
  if (sanMatches(attemptSan, item.bestSan)) return 'best'
  if (sanMatches(attemptSan, item.playedSan)) return 'same'
  if (evalAfterAttempt === undefined) return 'pending'
  const loss = winningChances(item.evalBest, item.side) - winningChances(evalAfterAttempt, item.side)
  const betterThanGame = winningChances(evalAfterAttempt, item.side) > winningChances(item.evalPlayed, item.side)
  return loss <= RETRY_TOLERANCE && betterThanGame ? 'good' : 'wrong'
}

/** Centipawns lost by an attempt compared with best play (mover's view, clamped). */
export function attemptLossCp(item: RetryItem, evalAfterAttempt: number): number {
  const pov = (cp: number) => {
    const v = item.side === 'w' ? cp : -cp
    return Math.abs(v) > 50000 ? Math.sign(v) * 1000 : Math.max(-1000, Math.min(1000, v))
  }
  return Math.max(0, Math.round(pov(item.evalBest) - pov(evalAfterAttempt)))
}

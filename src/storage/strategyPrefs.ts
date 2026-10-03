// Board overlays of the strategic panel (strong/weak squares, pawn flags,
// plan arrows). Remembered across games so the board looks the same every
// time the player opens an analysis.

import { KEYS } from './keys'
import { loadJson, saveJson } from './json'

export interface StrategyOverlays {
  strong: boolean
  weak: boolean
  pawns: boolean
  plans: boolean
  /** Green arrow of the engine's best move in the displayed position (key A). */
  engineArrow: boolean
}

export const DEFAULT_STRATEGY_OVERLAYS: StrategyOverlays = { strong: true, weak: true, pawns: false, plans: true, engineArrow: true }

export function loadStrategyOverlays(): StrategyOverlays {
  return { ...DEFAULT_STRATEGY_OVERLAYS, ...loadJson<Partial<StrategyOverlays>>(KEYS.strategyOverlays, {}) }
}

export function saveStrategyOverlays(o: StrategyOverlays): void {
  saveJson(KEYS.strategyOverlays, o)
}

export interface TrainerScore {
  answered: number
  correct: number
  byKind: Record<string, { answered: number; correct: number }>
}

export function loadTrainerScore(): TrainerScore {
  return loadJson<TrainerScore>(KEYS.strategyTrainer, { answered: 0, correct: 0, byKind: {} })
}

export function recordTrainerAnswer(kind: string, correct: boolean): TrainerScore {
  const s = loadTrainerScore()
  s.answered++
  if (correct) s.correct++
  const k = s.byKind[kind] ?? { answered: 0, correct: 0 }
  k.answered++
  if (correct) k.correct++
  s.byKind[kind] = k
  saveJson(KEYS.strategyTrainer, s)
  return s
}

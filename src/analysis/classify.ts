import type { MoveClassification } from '../types'

// Centipawn-loss thresholds for move classification (from the mover's perspective).
// Tuned loosely to match Lichess/Chess.com conventions.
export function classifyByCpLoss(cpLoss: number, isBest: boolean, isBookMove: boolean): MoveClassification {
  if (isBookMove) return 'book'
  if (isBest || cpLoss <= 10) return 'best'
  if (cpLoss <= 25) return 'great'
  if (cpLoss <= 60) return 'good'
  if (cpLoss <= 120) return 'inaccuracy'
  if (cpLoss <= 250) return 'mistake'
  return 'blunder'
}

export const CLASSIFICATION_COLORS: Record<MoveClassification, string> = {
  best: '#5fa052',
  great: '#5fa052',
  good: '#a8c074',
  inaccuracy: '#e6c34d',
  mistake: '#e08e3c',
  blunder: '#d04a4a',
  book: '#7c8492',
}

export const CLASSIFICATION_LABELS: Record<MoveClassification, string> = {
  best: 'Meilleur',
  great: 'Excellent',
  good: 'Bon',
  inaccuracy: 'Inexactitude',
  mistake: 'Erreur',
  blunder: 'Gaffe',
  book: 'Théorie',
}

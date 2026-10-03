// Compact plain-text rendering of strategic reports, used to ground the
// LLM coach: the model gets the heuristic reading as context and is asked
// to explain (and, if needed, correct) it — instead of guessing the
// structure from a FEN, which LLMs do poorly.

import { type Side, SIDE_LABEL, opp } from './board'
import type { GameStrategyReview } from './game'
import type { StrategicReport } from './report'

const PHASE_FR = { opening: 'ouverture', middlegame: 'milieu de jeu', endgame: 'finale' } as const

export function describePosition(r: StrategicReport, focus: Side): string {
  const lines: string[] = []
  lines.push(`Phase : ${PHASE_FR[r.phase]}. ${r.center.label}.`)
  if (r.structures.length) {
    lines.push(`Structure(s) reconnue(s) : ${r.structures.map(m => `${m.pattern.name} (camp A = ${SIDE_LABEL[m.sideA]})`).join(' ; ')}.`)
  }
  for (const side of [focus, opp(focus)]) {
    const mine = r.insights.filter(i => i.side === side)
    const plus = mine.filter(i => i.polarity === 'plus').slice(0, 4).map(i => i.title)
    const minus = mine.filter(i => i.polarity === 'minus').slice(0, 4).map(i => i.title)
    lines.push(`${SIDE_LABEL[side]} — atouts : ${plus.join(', ') || 'rien de marquant'} ; faiblesses : ${minus.join(', ') || 'rien de marquant'}.`)
    const plans = r.plans[side].slice(0, 3).map(p => p.timing ? `${p.title} [${p.timing.verdict === 'now' ? 'jouable' : 'à préparer'}]` : p.title)
    if (plans.length) lines.push(`${SIDE_LABEL[side]} — plans heuristiques : ${plans.join(' ; ')}.`)
  }
  return lines.join('\n')
}

export function describeGameReview(review: GameStrategyReview, userSide: Side): string {
  const lines: string[] = []
  if (review.mainStructure) lines.push(`Structure dominante : ${review.mainStructure.name} (${review.mainStructure.plies} demi-coups).`)
  const mine = review.events
    .filter(e => e.side === userSide && e.polarity === 'minus')
    .sort((a, b) => b.cpLoss - a.cpLoss)
    .slice(0, 4)
  if (mine.length) {
    lines.push('Moments stratégiques du joueur :')
    for (const e of mine) lines.push(`- demi-coup ${e.ply} : ${e.title}${e.cpLoss >= 50 ? ` (−${e.cpLoss} cp)` : ''}`)
  }
  return lines.join('\n')
}

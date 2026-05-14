// Positive-reinforcement counterpart to deriveInsights().
//
// We surface up to 3 concrete strengths the user actually demonstrates
// in their analysed games. Avoid generic praise — every line should
// quote a number or a name so it's credible.

import type { AggregateStats } from './aggregate'
import { computeMotifRadar } from './motifRadar'
import { MOTIF_LABELS } from './motifs'
import type { Exercise } from './exercises'

export interface Strength {
  text: string
  /** Tag a metric category for icons / styling. */
  kind: 'precision' | 'motif' | 'opening' | 'phase' | 'volume'
}

interface BuildOptions {
  stats: AggregateStats
  exercises: Exercise[]
}

export function buildStrengths({ stats, exercises }: BuildOptions): Strength[] {
  const out: Strength[] = []
  if (stats.gamesAnalyzed === 0) return out

  // 1. Precision vs opponent
  if (stats.avgCpLossUser < stats.avgCpLossOpponent - 5) {
    const margin = (stats.avgCpLossOpponent - stats.avgCpLossUser).toFixed(0)
    out.push({
      kind: 'precision',
      text: `Tu joues ${margin} cp/coup plus précisément que tes adversaires en moyenne.`,
    })
  }

  // 2. Best-performing opening (≥3 games, win rate ≥ 60%)
  const bestOpening = stats.openingGroups.find(o => o.played >= 3 && o.wins / o.played >= 0.6)
  if (bestOpening) {
    out.push({
      kind: 'opening',
      text: `Bon score avec ${bestOpening.name} (${bestOpening.wins}/${bestOpening.played}, ${Math.round(100 * bestOpening.wins / bestOpening.played)}%).`,
    })
  }

  // 3. Mastered motif: high "found" count, low miss rate, on a meaningful sample.
  const radar = computeMotifRadar(exercises)
  const masteredMotif = radar.find(m => m.total >= 5 && m.missRate <= 0.2 && m.found >= 3)
  if (masteredMotif) {
    out.push({
      kind: 'motif',
      text: `Tu repères ${MOTIF_LABELS[masteredMotif.motif].toLowerCase()}: ${masteredMotif.found} trouvé${masteredMotif.found > 1 ? 's' : ''} sur ${masteredMotif.total}.`,
    })
  }

  // 4. Best phase (when there's a real gap)
  const phases = ['opening', 'middlegame', 'endgame'] as const
  const active = phases.filter(p => stats.phases[p].userMoves >= 20)
  if (active.length >= 2) {
    const best = active.reduce((a, b) =>
      stats.phases[a].avgCpLoss < stats.phases[b].avgCpLoss ? a : b)
    const worst = active.reduce((a, b) =>
      stats.phases[a].avgCpLoss > stats.phases[b].avgCpLoss ? a : b)
    const ratio = stats.phases[best].avgCpLoss > 0
      ? stats.phases[worst].avgCpLoss / stats.phases[best].avgCpLoss
      : 0
    if (ratio >= 1.3) {
      const phaseName: Record<typeof best, string> = {
        opening: 'l\'ouverture', middlegame: 'le milieu de jeu', endgame: 'la finale',
      }
      out.push({
        kind: 'phase',
        text: `Tu es le plus solide dans ${phaseName[best]} (${stats.phases[best].avgCpLoss.toFixed(0)} cp/coup).`,
      })
    }
  }

  // 5. Volume milestone — only when nothing else applies
  if (out.length === 0 && stats.gamesAnalyzed >= 10) {
    out.push({
      kind: 'volume',
      text: `${stats.gamesAnalyzed} parties analysées — tu as le matériau pour des recommandations fiables.`,
    })
  }

  return out.slice(0, 3)
}

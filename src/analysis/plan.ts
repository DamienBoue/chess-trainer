// Daily training plan: a curated 10-15 min session that synthesises every
// training signal we already compute (SRS dues, repertoire SRS dues, top
// recurring mistake, top repertoire hole, daily puzzle).
//
// The plan is deterministic for a given (date, data) pair so reloading the
// page doesn't shuffle the items. Completion state is tracked per-id in
// localStorage so the user can see progress through the session.

import type { GameAnalysis } from '../types'
import type { ExerciseProgress } from '../storage/persist'
import { isDue } from '../storage/persist'
import { extractExercises } from './exercises'
import { buildRepertoire, enumerateDrillCards, findRepertoireHoles, type RepertoireHole } from './repertoire'
import { findRecurringMistakes, type RecurringMistake } from './recurringMistakes'

export type PlanItemKind =
  | 'daily'
  | 'srs-exercises'
  | 'srs-repertoire'
  | 'recurring'
  | 'hole'

export interface PlanItem {
  id: string
  kind: PlanItemKind
  title: string
  subtitle: string
  estMinutes: number
  /** Used by the UI to deep-link to the relevant view. */
  target: 'daily' | 'exercises' | 'repertoire' | 'stats'
  /** Optional context — top recurring mistake / hole shown inline. */
  recurring?: RecurringMistake
  hole?: RepertoireHole
}

interface BuildPlanOptions {
  dailyDone: boolean
  /** Default budgets (the UI shows them, the user does as much as they want). */
  maxSrsExercises?: number
  maxSrsRepertoire?: number
}

export function buildPlan(
  analyses: GameAnalysis[],
  progress: Record<string, ExerciseProgress>,
  repProgress: Record<string, ExerciseProgress>,
  opts: BuildPlanOptions,
): PlanItem[] {
  const items: PlanItem[] = []
  const { dailyDone, maxSrsExercises = 5, maxSrsRepertoire = 5 } = opts

  // 1. Daily puzzle (if not solved today)
  const exercises = extractExercises(analyses)
  if (exercises.length > 0 && !dailyDone) {
    items.push({
      id: 'daily',
      kind: 'daily',
      title: 'Puzzle quotidien',
      subtitle: 'Un puzzle déterministe pour entretenir la série.',
      estMinutes: 2,
      target: 'daily',
    })
  }

  // 2. SRS exercises due
  const dueExercises = exercises.filter(e => isDue(progress[e.id])).length
  if (dueExercises > 0) {
    const n = Math.min(dueExercises, maxSrsExercises)
    items.push({
      id: 'srs-exercises',
      kind: 'srs-exercises',
      title: `Exercices SRS · ${n}${dueExercises > n ? `/${dueExercises}` : ''}`,
      subtitle: dueExercises > n
        ? `${dueExercises} positions sont dues, fais-en ${n} pour aujourd'hui.`
        : `${dueExercises} position${dueExercises > 1 ? 's' : ''} ressortie${dueExercises > 1 ? 's' : ''} par SM-2.`,
      estMinutes: Math.max(2, Math.min(8, n)),
      target: 'exercises',
    })
  }

  // 3. Repertoire drill cards due
  const roots = buildRepertoire(analyses)
  const drillCards = enumerateDrillCards(roots)
  const dueRep = drillCards.filter(c => isDue(repProgress[c.id])).length
  if (dueRep > 0) {
    const n = Math.min(dueRep, maxSrsRepertoire)
    items.push({
      id: 'srs-repertoire',
      kind: 'srs-repertoire',
      title: `Répertoire SRS · ${n}${dueRep > n ? `/${dueRep}` : ''}`,
      subtitle: dueRep > n
        ? `${dueRep} cartes de répertoire à réviser, fais-en ${n}.`
        : `${dueRep} carte${dueRep > 1 ? 's' : ''} de répertoire à réviser.`,
      estMinutes: Math.max(2, Math.min(8, n)),
      target: 'repertoire',
    })
  }

  // 4. Top recurring mistake to study
  const recurring = findRecurringMistakes(analyses)
  const topMistake = recurring.exact[0] ?? recurring.byOpening[0] ?? null
  if (topMistake) {
    items.push({
      id: `recurring:${topMistake.id}`,
      kind: 'recurring',
      title: 'Erreur récurrente du moment',
      subtitle: `${topMistake.sanPlayed} joué ${topMistake.occurrences.length} fois${
        topMistake.bestSan && topMistake.bestSan !== topMistake.sanPlayed
          ? ` — engine voulait ${topMistake.bestSan}`
          : ''
      }.`,
      estMinutes: 2,
      target: 'stats',
      recurring: topMistake,
    })
  }

  // 5. Top repertoire hole
  const holes = findRepertoireHoles(roots)
  const topHole = holes[0]
  if (topHole) {
    const topChoice = topHole.choices[0]
    items.push({
      id: `hole:${topHole.fenBefore}`,
      kind: 'hole',
      title: 'Trou du répertoire',
      subtitle: topChoice
        ? `Après ${topHole.oppPrev}, tu as essayé ${topHole.choices.length} coups différents — top ${topChoice.san} (${Math.round(topChoice.share * 100)}%).`
        : `Position vue ${topHole.visits} fois sans coup dominant.`,
      estMinutes: 3,
      target: 'repertoire',
      hole: topHole,
    })
  }

  return items
}

export function totalMinutes(items: PlanItem[]): number {
  return items.reduce((s, it) => s + it.estMinutes, 0)
}

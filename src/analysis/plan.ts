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
import { computeMotifRadar } from './motifRadar'
import { MOTIF_LABELS, type MotifTag } from './motifs'
import { buildRepertoire, enumerateDrillCards, findRepertoireHoles, type RepertoireHole } from './repertoire'
import { findRecurringMistakes, type RecurringMistake } from './recurringMistakes'
import { aggregate, PHASE_LABELS, type Phase } from './aggregate'
import type { SkillBracket } from '../skill/elo'

export type PlanItemKind =
  | 'daily'
  | 'srs-exercises'
  | 'srs-repertoire'
  | 'motif-drill'
  | 'phase-focus'
  | 'recurring'
  | 'hole'
  | 'strategy'

export interface PlanItem {
  id: string
  kind: PlanItemKind
  title: string
  subtitle: string
  estMinutes: number
  /** Higher = more important. Used to order items adaptively per bracket. */
  priority: number
  /** Used by the UI to deep-link to the relevant view. */
  target: 'daily' | 'exercises' | 'repertoire' | 'stats' | 'strategy'
  /** When set, the exercises view should pre-select this motif. */
  motif?: MotifTag
  /** Optional context — top recurring mistake / hole shown inline. */
  recurring?: RecurringMistake
  hole?: RepertoireHole
  phase?: Phase
  /** Optional pointer to a concept-library entry that contextualises the item. */
  conceptId?: string
}

interface BuildPlanOptions {
  dailyDone: boolean
  /** Default budgets (the UI shows them, the user does as much as they want). */
  maxSrsExercises?: number
  maxSrsRepertoire?: number
  /** Used to bias the plan ordering toward what matters at this level. */
  bracket?: SkillBracket
  /** Today's exercise session (analysis/dailyQueue.ts): when given, the
   *  exercises step is that session instead of every due exercise. */
  exercisesToday?: { remaining: number; total: number }
}

/** What the plan reads from the games: the costly part, computed once a
 *  day (the app stores it), then assembled with the live progress. */
export interface PlanInputs {
  analysed: number
  exercises: number
  /** The most missed motif, when the signal is strong enough. */
  worstMotif: { motif: MotifTag; missed: number; total: number; missRate: number } | null
  topMistake: RecurringMistake | null
  topHole: RepertoireHole | null
  /** The phase markedly worse than the others. */
  phaseFocus: { worst: Phase; best: Phase; worstCp: number; bestCp: number } | null
  /** Ids of the repertoire drill cards (their due state is live). */
  drillCards: string[]
}

export function planInputs(analyses: GameAnalysis[], exercises = extractExercises(analyses)): PlanInputs {
  const radar = computeMotifRadar(exercises)
  const worst = radar.find(m => m.missed >= 3 && m.missRate >= 0.5)
  const recurring = findRecurringMistakes(analyses)
  const roots = buildRepertoire(analyses)

  let phaseFocus: PlanInputs['phaseFocus'] = null
  if (analyses.length >= 5) {
    const stats = aggregate(analyses)
    const phases: Phase[] = ['opening', 'middlegame', 'endgame']
    const active = phases.filter(p => stats.phases[p].userMoves >= 20)
    if (active.length >= 2) {
      const worstPhase = active.reduce((a, b) => stats.phases[a].avgCpLoss > stats.phases[b].avgCpLoss ? a : b)
      const bestPhase = active.reduce((a, b) => stats.phases[a].avgCpLoss < stats.phases[b].avgCpLoss ? a : b)
      const ratio = stats.phases[bestPhase].avgCpLoss > 0
        ? stats.phases[worstPhase].avgCpLoss / stats.phases[bestPhase].avgCpLoss
        : 0
      if (ratio >= 1.5) {
        phaseFocus = { worst: worstPhase, best: bestPhase, worstCp: stats.phases[worstPhase].avgCpLoss, bestCp: stats.phases[bestPhase].avgCpLoss }
      }
    }
  }

  return {
    analysed: analyses.length,
    exercises: exercises.length,
    worstMotif: worst ? { motif: worst.motif, missed: worst.missed, total: worst.total, missRate: worst.missRate } : null,
    topMistake: recurring.exact[0] ?? recurring.byOpening[0] ?? null,
    topHole: findRepertoireHoles(roots)[0] ?? null,
    phaseFocus,
    drillCards: enumerateDrillCards(roots).map(c => c.id),
  }
}

export function buildPlan(
  analyses: GameAnalysis[],
  progress: Record<string, ExerciseProgress>,
  repProgress: Record<string, ExerciseProgress>,
  opts: BuildPlanOptions,
): PlanItem[] {
  const exercises = extractExercises(analyses)
  const dueExercises = opts.exercisesToday ? 0 : exercises.filter(e => isDue(progress[e.id])).length
  return assemblePlan(planInputs(analyses, exercises), repProgress, { ...opts, dueExercises })
}

/** The plan from its stored inputs and the live progress: cheap, at render. */
export function assemblePlan(
  inputs: PlanInputs,
  repProgress: Record<string, ExerciseProgress>,
  opts: BuildPlanOptions & { dueExercises?: number },
): PlanItem[] {
  const items: PlanItem[] = []
  const { dailyDone, maxSrsExercises = 5, maxSrsRepertoire = 5, bracket, exercisesToday, dueExercises = 0 } = opts

  // 1. Daily puzzle (if not solved today)
  if (inputs.exercises > 0 && !dailyDone) {
    items.push({
      id: 'daily',
      kind: 'daily',
      title: 'Puzzle quotidien',
      subtitle: 'Un puzzle déterministe pour entretenir la série.',
      estMinutes: 2,
      priority: 80,
      target: 'daily',
    })
  }

  // 2. Exercises: today's session when there is one, else the SRS due ones.
  if (exercisesToday) {
    const { remaining, total } = exercisesToday
    if (remaining > 0) {
      items.push({
        id: 'srs-exercises',
        kind: 'srs-exercises',
        title: `Exercices du jour · ${remaining}${total > remaining ? `/${total}` : ''}`,
        subtitle: `Tes erreurs récentes et tes révisions : ${total - remaining} faite${total - remaining > 1 ? 's' : ''} sur ${total}.`,
        estMinutes: Math.max(2, Math.min(15, Math.round(remaining * 0.7))),
        priority: 100,
        target: 'exercises',
      })
    }
  }
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
      priority: 100,         // SRS overdue is always the highest signal
      target: 'exercises',
    })
  }

  // 3. Repertoire drill cards due
  const dueRep = inputs.drillCards.filter(id => isDue(repProgress[id])).length
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
      priority: 70,
      target: 'repertoire',
    })
  }

  // 4. Motif drill — the most missed motif if signal is strong enough.
  const worstMotif = inputs.worstMotif
  if (worstMotif) {
    items.push({
      id: `motif:${worstMotif.motif}`,
      kind: 'motif-drill',
      title: `Drill : ${MOTIF_LABELS[worstMotif.motif]}`,
      subtitle: `${worstMotif.missed} raté${worstMotif.missed > 1 ? 's' : ''} sur ${worstMotif.total} — ${Math.round(worstMotif.missRate * 100)}% d'erreurs sur ce motif.`,
      estMinutes: 4,
      priority: bracketBoost(bracket, 'tactics', 90),
      target: 'exercises',
      motif: worstMotif.motif,
    })
  }

  // 5. Top recurring mistake to study
  const topMistake = inputs.topMistake
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
      priority: 60,
      target: 'stats',
      recurring: topMistake,
      conceptId: 'checks-captures-threats',
    })
  }

  // 6. Top repertoire hole (less urgent at low Elo)
  const topHole = inputs.topHole
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
      priority: bracketBoost(bracket, 'opening', 50),
      target: 'repertoire',
      hole: topHole,
      conceptId: 'prophylaxis',
    })
  }

  // 7. Phase focus — when one phase's avg cpLoss is markedly worse than
  // the others (≥ 1.5×) and we have a meaningful sample, surface it.
  const focus = inputs.phaseFocus
  if (focus) {
    const { worst, best } = focus
    items.push({
      id: `phase:${worst}`,
      kind: 'phase-focus',
      title: `Travaille tes ${PHASE_LABELS[worst].toLowerCase()}s`,
      subtitle: `${focus.worstCp.toFixed(0)} cp/coup en ${PHASE_LABELS[worst].toLowerCase()} vs ${focus.bestCp.toFixed(0)} en ${PHASE_LABELS[best].toLowerCase()}. Ouvre les stats pour voir le détail.`,
      estMinutes: 3,
      priority: 65,
      target: 'stats',
      phase: worst,
      conceptId: worst === 'endgame' ? 'rook-endgame' : worst === 'opening' ? 'pawn-structure' : 'silmans-imbalances',
    })
  }

  // Positional reading: strategy drills built from the player's own games.
  if (inputs.analysed >= 3) {
    items.push({
      id: 'strategy',
      kind: 'strategy',
      title: 'Lecture de position',
      subtitle: 'Quel plan ? Quelle case forte ? Quelle structure ? Des positions tirées de tes parties.',
      estMinutes: 5,
      priority: bracketBoost(bracket, 'strategy', 55),
      target: 'strategy',
      conceptId: 'pawn-structure',
    })
  }

  return items.sort((a, b) => b.priority - a.priority)
}

// Adjust a base priority based on what the bracket cares about most.
// Beginners need tactics > everything; experts want opening prep more.
function bracketBoost(bracket: SkillBracket | undefined, area: 'tactics' | 'opening' | 'strategy', base: number): number {
  if (!bracket) return base
  // Strategy pays off once tactics are reasonably safe (club level and up).
  const boosts: Record<SkillBracket['id'], { tactics: number; opening: number; strategy: number }> = {
    beginner:   { tactics: +30, opening: -20, strategy: -20 },
    casual:     { tactics: +20, opening: -10, strategy: -10 },
    club:       { tactics: +10, opening:   0, strategy: +5 },
    tournament: { tactics:   0, opening: +10, strategy: +15 },
    expert:     { tactics: -10, opening: +20, strategy: +20 },
    master:     { tactics: -20, opening: +30, strategy: +20 },
  }
  return base + boosts[bracket.id][area]
}

export function totalMinutes(items: PlanItem[]): number {
  return items.reduce((s, it) => s + it.estMinutes, 0)
}

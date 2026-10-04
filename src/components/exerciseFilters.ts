// Filter model of the Exercises view: option lists, labels and the one-line
// summary shown on the collapsed "Filtres" button on phones. Kept out of
// ExercisesView.tsx so it stays unit-testable (component files may only
// export components).

import {
  type Difficulty,
  type ExerciseCategory,
  type MotifTag,
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  MOTIF_LABELS,
} from '../analysis/exercises'

export type StatusFilter = 'all' | 'due' | 'solved' | 'unseen'
export type CategoryFilter = 'all' | ExerciseCategory
export type DifficultyFilter = 'all' | Difficulty
export type MotifFilter = 'all' | MotifTag

const STATUS_LABELS: Record<StatusFilter, string> = {
  due: 'À réviser',
  unseen: 'Jamais vus',
  solved: 'Déjà réussis',
  all: 'Tous',
}

/** Status chips, in display order. */
export const STATUS_OPTIONS: ReadonlyArray<{ value: StatusFilter; label: string }> =
  (['due', 'unseen', 'solved', 'all'] as const).map(value => ({ value, label: STATUS_LABELS[value] }))

export const CATEGORY_KEYS: readonly ExerciseCategory[] = ['missed', 'punishment', 'defense']
export const DIFFICULTY_KEYS: readonly Difficulty[] = ['easy', 'medium', 'hard']

/** Number of exercises behind each chip (over the whole pool, independent of
 *  the other filters). `all` is shared by the three rows. */
export type FilterCounts = Record<
  'all' | 'due' | 'solved' | 'unseen' | ExerciseCategory | Difficulty,
  number
>

export interface FilterSelection {
  status: StatusFilter
  category: CategoryFilter
  difficulty: DifficultyFilter
  motif: MotifFilter
}

/** "À réviser · Toutes catégories · Toutes difficultés", plus the motif when
 *  one is active. */
export function filtersSummary({ status, category, difficulty, motif }: FilterSelection): string {
  const parts = [
    status === 'all' ? 'Tous statuts' : STATUS_LABELS[status],
    category === 'all' ? 'Toutes catégories' : CATEGORY_LABELS[category],
    difficulty === 'all' ? 'Toutes difficultés' : DIFFICULTY_LABELS[difficulty],
  ]
  if (motif !== 'all') parts.push(`Motif : ${MOTIF_LABELS[motif]}`)
  return parts.join(' · ')
}

/** "0 exercice", "1 exercice", "14 exercices" (French: 0 is singular). */
export function exerciseCountLabel(n: number): string {
  return `${n} exercice${n > 1 ? 's' : ''}`
}

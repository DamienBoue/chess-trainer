import { describe, expect, it } from 'vitest'
import {
  CATEGORY_KEYS,
  DIFFICULTY_KEYS,
  STATUS_OPTIONS,
  exerciseCountLabel,
  filtersSummary,
} from './exerciseFilters'

describe('filtersSummary', () => {
  it('lists status, category and difficulty with their "all" wording', () => {
    expect(filtersSummary({ status: 'due', category: 'all', difficulty: 'all', motif: 'all' }))
      .toBe('À réviser · Toutes catégories · Toutes difficultés')
  })

  it('names the chosen values', () => {
    expect(filtersSummary({ status: 'solved', category: 'punishment', difficulty: 'hard', motif: 'all' }))
      .toBe('Déjà réussis · Punition trouvée · Difficile')
    expect(filtersSummary({ status: 'unseen', category: 'defense', difficulty: 'easy', motif: 'all' }))
      .toBe('Jamais vus · Défense trouvée · Facile')
  })

  it('says "Tous statuts" when the status is not filtered', () => {
    expect(filtersSummary({ status: 'all', category: 'missed', difficulty: 'medium', motif: 'all' }))
      .toBe('Tous statuts · Coup raté · Moyen')
  })

  it('appends the motif only when one is active', () => {
    expect(filtersSummary({ status: 'due', category: 'all', difficulty: 'all', motif: 'pin' }))
      .toBe('À réviser · Toutes catégories · Toutes difficultés · Motif : Clouage')
  })
})

describe('exerciseCountLabel', () => {
  it('uses the French singular for 0 and 1', () => {
    expect(exerciseCountLabel(0)).toBe('0 exercice')
    expect(exerciseCountLabel(1)).toBe('1 exercice')
    expect(exerciseCountLabel(2)).toBe('2 exercices')
    expect(exerciseCountLabel(14)).toBe('14 exercices')
  })
})

describe('option lists', () => {
  it('keeps the status chips in display order, with "Tous" last', () => {
    expect(STATUS_OPTIONS.map(o => o.value)).toEqual(['due', 'unseen', 'solved', 'all'])
    expect(STATUS_OPTIONS.map(o => o.label)).toEqual(['À réviser', 'Jamais vus', 'Déjà réussis', 'Tous'])
  })

  it('covers every category and difficulty', () => {
    expect([...CATEGORY_KEYS]).toEqual(['missed', 'punishment', 'defense'])
    expect([...DIFFICULTY_KEYS]).toEqual(['easy', 'medium', 'hard'])
  })
})

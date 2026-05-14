import { describe, expect, it } from 'vitest'
import {
  findConcept, conceptsByCategory, allConcepts, searchConcepts, conceptForMotif,
  pickDailyConcept,
} from './lookup'

describe('findConcept', () => {
  it('finds by id', () => {
    expect(findConcept('fork')?.title).toBe('Fourchette')
  })

  it('finds by title (case-insensitive)', () => {
    expect(findConcept('FOURCHETTE')?.id).toBe('fork')
  })

  it('finds by alias', () => {
    expect(findConcept('IQP')?.id).toBe('isolated-queen-pawn')
    expect(findConcept('pin')?.id).toBe('pin')
  })

  it('returns undefined for unknown', () => {
    expect(findConcept('never-existed')).toBeUndefined()
  })
})

describe('conceptsByCategory', () => {
  it('returns only matching concepts', () => {
    const tactics = conceptsByCategory('tactics')
    expect(tactics.length).toBeGreaterThan(0)
    for (const c of tactics) expect(c.category).toBe('tactics')
  })
})

describe('allConcepts', () => {
  it('returns the full catalog', () => {
    expect(allConcepts().length).toBeGreaterThan(20)
  })
})

describe('searchConcepts', () => {
  it('returns everything for an empty query', () => {
    expect(searchConcepts('').length).toBe(allConcepts().length)
  })

  it('exact title match ranks first', () => {
    const out = searchConcepts('Fourchette')
    expect(out[0].id).toBe('fork')
  })

  it('substring match works', () => {
    const out = searchConcepts('isolé')
    expect(out.some(c => c.id === 'isolated-queen-pawn')).toBe(true)
  })

  it('alias substring works', () => {
    expect(searchConcepts('vancura')[0].id).toBe('vancura')
  })
})

describe('conceptForMotif', () => {
  it('maps fork → fork concept', () => {
    expect(conceptForMotif('fork')?.id).toBe('fork')
  })

  it('maps pin → pin concept', () => {
    expect(conceptForMotif('pin')?.id).toBe('pin')
  })

  it('returns undefined for an unknown motif', () => {
    expect(conceptForMotif('capture')).toBeUndefined()
  })
})

describe('pickDailyConcept', () => {
  it('is deterministic for the same date', () => {
    expect(pickDailyConcept('2026-05-14').id).toBe(pickDailyConcept('2026-05-14').id)
  })

  it('returns a real concept (not null/undefined)', () => {
    const c = pickDailyConcept('2026-05-14')
    expect(c.title.length).toBeGreaterThan(0)
    expect(findConcept(c.id)).toBeTruthy()
  })

  it('covers different concepts across a week', () => {
    const ids = ['2026-05-14', '2026-05-15', '2026-05-16', '2026-05-17',
                 '2026-05-18', '2026-05-19', '2026-05-20']
      .map(d => pickDailyConcept(d).id)
    expect(new Set(ids).size).toBeGreaterThan(1)
  })
})

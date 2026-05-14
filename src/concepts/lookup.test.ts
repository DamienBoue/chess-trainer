import { describe, expect, it } from 'vitest'
import {
  findConcept, conceptsByCategory, allConcepts, searchConcepts, conceptForMotif,
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

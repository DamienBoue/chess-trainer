import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import CritiquesPanel from './CritiquesPanel'
import type { RepertoireCritique } from '../analysis/repertoire'

afterEach(cleanup)

function crit(overrides: Partial<RepertoireCritique> = {}): RepertoireCritique {
  return {
    parent: 'Italian Game',
    color: 'white',
    san: 'h3',
    oppPrev: '<start>',
    count: 5,
    total: 5,
    avgCpLoss: 80,
    winRate: 0.2,
    fenBefore: '',
    reason: 'both',
    ply: 5,
    ...overrides,
  }
}

describe('CritiquesPanel', () => {
  it('shows the friendly empty state when there are no critiques', () => {
    render(<CritiquesPanel critiques={[]} />)
    expect(screen.getByText(/Aucun mauvais réflexe détecté/i)).toBeTruthy()
  })

  it('renders the opening name + played SAN for each critique', () => {
    render(<CritiquesPanel critiques={[crit()]} />)
    expect(screen.getByText('Italian Game')).toBeTruthy()
    expect(screen.getByText('h3')).toBeTruthy()
  })

  it('shows a coloured reason badge', () => {
    render(<CritiquesPanel critiques={[
      crit({ reason: 'high-cploss' }),
      crit({ reason: 'low-winrate', san: 'h4' }),
      crit({ reason: 'both', san: 'h5' }),
    ]} />)
    expect(screen.getByText('Imprécis')).toBeTruthy()
    expect(screen.getByText('Mauvais score')).toBeTruthy()
    expect(screen.getByText('Imprécis + mauvais score')).toBeTruthy()
  })

  it('shows the Stockfish suggestion when present', () => {
    render(<CritiquesPanel critiques={[crit({ engineSuggestion: { san: 'Nf3', count: 3 } })]} />)
    expect(screen.getByText('Nf3')).toBeTruthy()
  })

  it('caps the rendered list at 12 critiques', () => {
    const many = Array.from({ length: 20 }, (_, i) => crit({ san: `m${i}` }))
    render(<CritiquesPanel critiques={many} />)
    // Each critique has exactly one "Imprécis + mauvais score" badge.
    const badges = screen.queryAllByText('Imprécis + mauvais score')
    expect(badges.length).toBeLessThanOrEqual(12)
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ConceptsView from './ConceptsView'

afterEach(cleanup)

describe('ConceptsView', () => {
  it('renders the catalogue heading + counts', () => {
    render(<ConceptsView />)
    expect(screen.getByText('Bibliothèque de concepts')).toBeTruthy()
  })

  it('shows every category as a filter chip + "Toutes"', () => {
    render(<ConceptsView />)
    expect(screen.getByText('Toutes')).toBeTruthy()
    for (const label of ['Tactique', 'Finale', 'Structure', 'Ouverture', 'Stratégie', 'Mental']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
  })

  it('filters the cards by category', () => {
    render(<ConceptsView />)
    // The filter chip is a rounded-full button containing "Tactique" —
    // pick it specifically (cards also contain the label).
    const tacticsChip = screen.getAllByRole('button').find(
      b => b.textContent === 'Tactique' && b.className.includes('rounded-full'),
    )!
    fireEvent.click(tacticsChip)
    // After filtering: no Italian Game card. Many Fourchette-prefixed
    // buttons exist (the main card + the royal variant), so just
    // assert no opening cards remain.
    expect(screen.queryByRole('button', { name: /Partie italienne/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Caro-Kann/i })).toBeNull()
  })

  it('searches by alias', () => {
    render(<ConceptsView />)
    const search = screen.getByPlaceholderText(/Chercher/i)
    fireEvent.change(search, { target: { value: 'IQP' } })
    expect(screen.queryByRole('button', { name: /Pion dame isolé/i })).toBeTruthy()
  })

  it('shows an empty message for a no-match query', () => {
    render(<ConceptsView />)
    const search = screen.getByPlaceholderText(/Chercher/i)
    fireEvent.change(search, { target: { value: 'xxxxxxxxxxxxxxx' } })
    expect(screen.getByText('Aucun résultat.')).toBeTruthy()
  })
})

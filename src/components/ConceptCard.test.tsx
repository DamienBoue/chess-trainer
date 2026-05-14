import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ConceptCard from './ConceptCard'
import { findConcept } from '../concepts/lookup'

afterEach(cleanup)

describe('ConceptCard', () => {
  it('renders the title and short definition', () => {
    const fork = findConcept('fork')!
    render(<ConceptCard concept={fork} />)
    expect(screen.getByText('Fourchette')).toBeTruthy()
    expect(screen.getByText(fork.shortDef)).toBeTruthy()
  })

  it('renders the detail paragraph when present', () => {
    const fork = findConcept('fork')!
    render(<ConceptCard concept={fork} />)
    expect(fork.detail).toBeTruthy()
    expect(screen.getByText(fork.detail!)).toBeTruthy()
  })

  it('renders position cards with an "Ouvrir l\'échiquier" button', () => {
    const fork = findConcept('fork')!
    render(<ConceptCard concept={fork} />)
    expect(fork.positions?.length).toBeGreaterThan(0)
    expect(screen.getByText(/Ouvrir l'échiquier/i)).toBeTruthy()
  })

  it('renders external links', () => {
    const fork = findConcept('fork')!
    render(<ConceptCard concept={fork} />)
    expect(fork.links?.length).toBeGreaterThan(0)
    const wikiLink = fork.links!.find(l => l.kind === 'wikipedia')
    if (wikiLink) {
      const a = screen.getByText(wikiLink.label).closest('a')
      expect(a?.getAttribute('href')).toBe(wikiLink.url)
      expect(a?.getAttribute('target')).toBe('_blank')
    }
  })

  it('renders related concept chips and triggers onOpenRelated on click', () => {
    const fork = findConcept('fork')!
    const onOpenRelated = vi.fn()
    render(<ConceptCard concept={fork} onOpenRelated={onOpenRelated} />)
    // fork is related to 'pin' → there should be a "Clouage" chip.
    const pinChip = screen.getByText('Clouage')
    fireEvent.click(pinChip)
    expect(onOpenRelated).toHaveBeenCalledWith('pin')
  })

  it('omits sections that aren\'t present', () => {
    // 'fork-royal' has aliases + related but no positions, no detail, no links.
    const royal = findConcept('fork-royal')!
    expect(royal.positions ?? []).toEqual([])
    render(<ConceptCard concept={royal} />)
    // Detail header not shown.
    expect(screen.queryByText('Positions à explorer')).toBeNull()
    expect(screen.queryByText(/Pour aller plus loin/i)).toBeNull()
  })
})

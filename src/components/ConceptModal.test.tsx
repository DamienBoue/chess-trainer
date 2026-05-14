import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import ConceptModal, { openConcept } from './ConceptModal'

afterEach(cleanup)

describe('ConceptModal', () => {
  it('renders nothing by default', () => {
    const { container } = render(<ConceptModal />)
    expect(container.firstChild).toBeNull()
  })

  it('opens when the concept:open event fires with a known id', () => {
    render(<ConceptModal />)
    act(() => openConcept('fork'))
    expect(screen.getByText('Fourchette')).toBeTruthy()
  })

  it('opens by alias too', () => {
    render(<ConceptModal />)
    act(() => openConcept('IQP'))
    expect(screen.getByText('Pion dame isolé (IQP)')).toBeTruthy()
  })

  it('stays closed for an unknown id', () => {
    const { container } = render(<ConceptModal />)
    act(() => openConcept('never-existed'))
    expect(container.firstChild).toBeNull()
  })

  it('closes on Escape', () => {
    render(<ConceptModal />)
    act(() => openConcept('fork'))
    expect(screen.queryByText('Fourchette')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText('Fourchette')).toBeNull()
  })

  it('closes when the backdrop is clicked', () => {
    render(<ConceptModal />)
    act(() => openConcept('fork'))
    // The backdrop is the outermost fixed container; the inner panel
    // stops propagation. Click on the close button is simpler.
    fireEvent.click(screen.getByLabelText('Fermer'))
    expect(screen.queryByText('Fourchette')).toBeNull()
  })

  it('navigates to a related concept when a related chip is clicked', () => {
    render(<ConceptModal />)
    act(() => openConcept('fork'))
    expect(screen.getByText('Fourchette')).toBeTruthy()
    // "Fourchette royale" is a related concept of "fork".
    fireEvent.click(screen.getByText('Fourchette royale'))
    expect(screen.getByText(/Fourchette royale/i)).toBeTruthy()
  })
})

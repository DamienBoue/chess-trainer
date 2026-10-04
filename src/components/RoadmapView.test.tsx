import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import RoadmapView from './RoadmapView'
import { buildGame } from '../analysis/__fixtures__'
import { mockLocalStorage } from '../test-utils/mockLocalStorage'

const navigate = vi.fn()

beforeEach(() => {
  vi.stubGlobal('localStorage', mockLocalStorage())
  navigate.mockReset()
})
afterEach(cleanup)

describe('RoadmapView', () => {
  it('renders the bracket ladder and current bracket info', () => {
    render(<RoadmapView analyses={[]} onNavigate={navigate} />)
    expect(screen.getByRole('heading', { name: 'Mon niveau' })).toBeTruthy()
    // Default bracket (no Elo declared, no analyses) is "casual" → "Joueur loisir".
    expect(screen.getAllByText('Joueur loisir').length).toBeGreaterThan(0)
  })

  it('renders every bracket button in the ladder', () => {
    render(<RoadmapView analyses={[]} onNavigate={navigate} />)
    for (const label of ['Débutant', 'Joueur loisir', 'Club', 'Tournoi', 'Expert', 'Maître']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
  })

  it('previews another bracket on click and shows the "Aperçu" chip', () => {
    render(<RoadmapView analyses={[]} onNavigate={navigate} />)
    fireEvent.click(screen.getByTitle(/Club · 1400-1799/))
    expect(screen.getByText('Aperçu')).toBeTruthy()
    expect(screen.getByText(/Revenir à ton palier/)).toBeTruthy()
  })

  it('renders module checklist rows with their titles', () => {
    render(<RoadmapView analyses={[]} onNavigate={navigate} />)
    // Casual modules include "Tactiques à deux coups…"
    expect(screen.getByText(/Tactiques à deux coups/)).toBeTruthy()
  })

  it('updates declared Elo when the input changes', () => {
    render(<RoadmapView analyses={[]} onNavigate={navigate} />)
    const input = screen.getByPlaceholderText(/1200/) as HTMLInputElement
    fireEvent.change(input, { target: { value: '1850' } })
    // After bumping, bracket should switch to "Tournoi".
    expect(screen.getAllByText('Tournoi').length).toBeGreaterThan(0)
  })

  it('invokes onNavigate when a module surface action is clicked', () => {
    render(<RoadmapView analyses={[]} onNavigate={navigate} />)
    // Casual has "Tactiques à deux coups…" → surface 'exercises' →
    // button labelled "Exercices →".
    const tactiquesRow = screen.getByText(/Tactiques à deux coups/).closest('div')!
        .closest('.bg-\\[var\\(--color-panel\\)\\]')
    // Easier: find the first "Exercices →" button.
    fireEvent.click(screen.getAllByText('Exercices →')[0])
    expect(navigate).toHaveBeenCalledWith('exercises')
    void tactiquesRow
  })

  it('embedded=true drops the page-level title', () => {
    render(<RoadmapView analyses={[]} onNavigate={navigate} embedded />)
    expect(screen.queryByRole('heading', { name: 'Mon niveau' })).toBeNull()
  })
})

describe('RoadmapView follows the real bracket', () => {
  const modulesHeading = (label: string) => screen.getByRole('heading', { name: `Modules · ${label}` })
  const declaredEloInput = () => screen.getByPlaceholderText(/1200/)
  // inferEloFromGames needs at least 3 rated games to infer anything.
  const gamesRatedAt = (rating: number) => [1, 2, 3].map(() => buildGame({ userRating: rating, moves: [] }))

  it('switches to the new bracket when the declared Elo crosses a boundary', () => {
    render(<RoadmapView analyses={[]} onNavigate={navigate} />)
    expect(modulesHeading('Joueur loisir')).toBeTruthy()

    fireEvent.change(declaredEloInput(), { target: { value: '1850' } })

    expect(modulesHeading('Tournoi')).toBeTruthy()
    expect(screen.getByText(/Préparer 5-6 coups d'écart/)).toBeTruthy()
    expect(screen.queryByText(/Tactiques à deux coups/)).toBeNull()
    expect(screen.queryByText('Aperçu')).toBeNull()
    expect(screen.queryByText(/Revenir à ton palier/)).toBeNull()
  })

  it('switches to the new bracket when new analyses move the inferred Elo', () => {
    const { rerender } = render(<RoadmapView analyses={gamesRatedAt(1200)} onNavigate={navigate} />)
    expect(modulesHeading('Joueur loisir')).toBeTruthy()

    rerender(<RoadmapView analyses={gamesRatedAt(1600)} onNavigate={navigate} />)

    expect(modulesHeading('Club')).toBeTruthy()
    expect(screen.queryByText('Aperçu')).toBeNull()
  })

  it('keeps a deliberate preview of another bracket when the real bracket changes', () => {
    render(<RoadmapView analyses={[]} onNavigate={navigate} />)
    fireEvent.click(screen.getByTitle(/Club · 1400-1799/))

    fireEvent.change(declaredEloInput(), { target: { value: '1850' } })

    expect(modulesHeading('Club')).toBeTruthy()
    expect(screen.getByText('Aperçu')).toBeTruthy()
    // The way back now leads to the new real bracket.
    fireEvent.click(screen.getByText('← Revenir à ton palier (Tournoi)'))
    expect(modulesHeading('Tournoi')).toBeTruthy()
    expect(screen.queryByText('Aperçu')).toBeNull()
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ExercisesView from './ExercisesView'
import { buildGame, sampleCorpus } from '../analysis/__fixtures__'

// TrainingBoard requires real DOM measurement (react-chessboard).
vi.mock('./TrainingBoard', () => ({
  default: () => <div data-testid="training-board" />,
}))
vi.mock('../audio/sounds', () => ({
  playForMove: () => {}, playSuccess: () => {}, playWrong: () => {},
}))

afterEach(cleanup)

describe('ExercisesView', () => {
  it('shows the empty state when no analyses exist', () => {
    render(
      <ExercisesView
        analyses={[]}
        progress={{}}
        onAttempt={() => {}}
      />,
    )
    expect(screen.getByText(/Pas encore d'exercices/)).toBeTruthy()
  })

  it("exposes a CTA that fires onGoToGames in the empty state", () => {
    const go = vi.fn()
    render(
      <ExercisesView
        analyses={[]}
        progress={{}}
        onAttempt={() => {}}
        onGoToGames={go}
      />,
    )
    fireEvent.click(screen.getByText(/Voir mes parties/))
    expect(go).toHaveBeenCalled()
  })

  it('shows the "no key move detected" state when analyses produce 0 exercises', () => {
    // All moves are book/best with 0 cpLoss → no exercise extracted.
    const games = [
      buildGame({
        userColor: 'white', opponent: 'bob',
        moves: [
          { ply: 1, san: 'e4', cpLoss: 0, classification: 'book' },
          { ply: 3, san: 'Nf3', cpLoss: 0, classification: 'best' },
        ],
      }),
    ]
    render(
      <ExercisesView
        analyses={games}
        progress={{}}
        onAttempt={() => {}}
      />,
    )
    expect(screen.getByText(/Aucun coup-clé détecté/)).toBeTruthy()
  })

  it('renders the heading and the filter pills when exercises exist', () => {
    render(
      <ExercisesView
        analyses={sampleCorpus()}
        progress={{}}
        onAttempt={() => {}}
      />,
    )
    expect(screen.getByText('Exercices')).toBeTruthy()
    expect(screen.getByText(/À réviser/)).toBeTruthy()
    expect(screen.getByText(/Jamais vus/)).toBeTruthy()
    expect(screen.getByText(/Toutes catégories/)).toBeTruthy()
    expect(screen.getByText(/Difficulté/)).toBeTruthy()
  })

  it('switches the category filter on click', () => {
    render(
      <ExercisesView
        analyses={sampleCorpus()}
        progress={{}}
        onAttempt={() => {}}
      />,
    )
    const all = screen.getByText(/Toutes catégories/)
    // The pill becomes a different style when active. We just verify clicking
    // it doesn't crash and that the heading is still there.
    fireEvent.click(all)
    expect(screen.getByText('Exercices')).toBeTruthy()
  })

  it('export button is disabled when the filtered list is empty', () => {
    // Build analyses with a blunder, then filter to "Déjà réussis" with no
    // progress — should produce 0 filtered exercises.
    render(
      <ExercisesView
        analyses={sampleCorpus()}
        progress={{}}
        onAttempt={() => {}}
      />,
    )
    fireEvent.click(screen.getByText(/Déjà réussis/))
    const exportBtn = screen.getByText(/Export Lichess/) as HTMLButtonElement
    expect(exportBtn.disabled).toBe(true)
  })
})

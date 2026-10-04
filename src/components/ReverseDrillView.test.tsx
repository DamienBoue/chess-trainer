import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ReverseDrillView from './ReverseDrillView'
import { gameFromSans } from '../test-utils/fixtures'

// TrainingBoard needs measured DOM — stub it.
vi.mock('./TrainingBoard', () => ({
  default: () => <div data-testid="training-board" />,
}))

afterEach(cleanup)

describe('ReverseDrillView', () => {
  it('shows the empty state when no analyses exist', () => {
    render(<ReverseDrillView analyses={[]} />)
    expect(screen.getByText(/Tu n'as pas encore de parties analysées/)).toBeTruthy()
    // The page keeps its menu label as title, even when empty.
    expect(screen.getByRole('heading', { name: 'Ouvertures en miroir' })).toBeTruthy()
  })

  it('the empty-state CTA fires onGoToGames', () => {
    const go = vi.fn()
    render(<ReverseDrillView analyses={[]} onGoToGames={go} />)
    fireEvent.click(screen.getByText(/Voir mes parties/))
    expect(go).toHaveBeenCalled()
  })

  it("shows a 'no mirror line yet' state when no opening has ≥2 games", () => {
    // 1 game — buildRepertoire roots are filtered out (need ≥2).
    const games = [
      gameFromSans({ url: 'g1', userColor: 'white', sans: ['e4', 'e5', 'Nf3'] }),
    ]
    render(<ReverseDrillView analyses={games} />)
    expect(screen.getByText(/au moins 2 parties dans une même ouverture/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Ouvertures en miroir' })).toBeTruthy()
  })

  it('renders the heading and the line list when mirror lines exist', () => {
    const games = [
      gameFromSans({ url: 'g1', userColor: 'white', sans: ['e4', 'e5', 'Nf3', 'Nc6'] }),
      gameFromSans({ url: 'g2', userColor: 'white', sans: ['e4', 'e5', 'Nf3', 'Nc6'] }),
    ]
    render(<ReverseDrillView analyses={games} />)
    expect(screen.getByRole('heading', { name: 'Ouvertures en miroir' })).toBeTruthy()
    expect(screen.queryByText(/drill/i)).toBeNull()
    // The button list contains at least one root.
    expect(screen.getByText(/Lignes mémorisées disponibles/)).toBeTruthy()
  })

  it('starting a line shows the training board and step counter', () => {
    const games = [
      gameFromSans({ url: 'g1', userColor: 'white', sans: ['e4', 'e5', 'Nf3', 'Nc6'] }),
      gameFromSans({ url: 'g2', userColor: 'white', sans: ['e4', 'e5', 'Nf3', 'Nc6'] }),
    ]
    render(<ReverseDrillView analyses={games} />)
    // Click the first root button (rendered by the chip list).
    const buttons = screen.getAllByRole('button')
    // The starting-position button is the first button in the chips list.
    // Click the second button (first is potentially the EmptyState CTA if absent — here it's a chip).
    fireEvent.click(buttons[0])
    expect(screen.getByTestId('training-board')).toBeTruthy()
    expect(screen.getByText(/coup 1\/\d+/)).toBeTruthy()
  })
})

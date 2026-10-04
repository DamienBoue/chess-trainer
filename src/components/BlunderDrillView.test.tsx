import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import BlunderDrillView from './BlunderDrillView'
import { buildGame } from '../analysis/__fixtures__'

// The board measures its squares, which jsdom can't do.
vi.mock('./TrainingBoard', () => ({
  default: () => <div data-testid="board" />,
}))

afterEach(cleanup)

// White's queen on d4 is attacked by the e5 pawn and defended by nobody: a
// threat the drill can ask about.
const HANGING_QUEEN = 'rnbqkbnr/pppp1ppp/8/4p3/3QP3/8/PPPP1PPP/RNB1KBNR w KQkq - 0 3'

function gameWithBlunder() {
  return buildGame({
    userColor: 'white',
    moves: [
      { ply: 1, san: 'Qd4', cpLoss: 400, classification: 'blunder', bestMoveSan: 'Nf3', fenBefore: HANGING_QUEEN },
    ],
  })
}

/** The page title is the menu label, and it must be there whatever the state. */
function expectPageTitle() {
  expect(screen.getByRole('heading', { name: 'Réflexe anti-gaffe' })).toBeTruthy()
}

describe('BlunderDrillView', () => {
  it('keeps its title on the empty state, which speaks French', () => {
    const onExit = vi.fn()
    render(<BlunderDrillView analyses={[]} onExit={onExit} />)
    expectPageTitle()
    expect(screen.getByText('Pas encore de gaffes détectées')).toBeTruthy()
    expect(screen.queryByText(/blunder/i)).toBeNull()
    fireEvent.click(screen.getByText('← Retour'))
    expect(onExit).toHaveBeenCalled()
  })

  it('shows its title above a running puzzle', () => {
    render(<BlunderDrillView analyses={[gameWithBlunder()]} onExit={() => {}} />)
    expectPageTitle()
    expect(screen.getByText('Quelle est la menace ?')).toBeTruthy()
    expect(screen.getByTestId('board')).toBeTruthy()
  })

  it('keeps its title on the end-of-session screen', () => {
    render(<BlunderDrillView analyses={[gameWithBlunder()]} onExit={() => {}} />)
    fireEvent.click(screen.getByText('Aucune menace'))
    fireEvent.click(screen.getByText(/^Suivant/))
    expectPageTitle()
    expect(screen.getByText('Session terminée')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Rejouer' })).toBeTruthy()
  })
})

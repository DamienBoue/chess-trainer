import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import CalcDepthView from './CalcDepthView'
import { buildGame } from '../analysis/__fixtures__'

// The board measures its squares, which jsdom can't do.
vi.mock('./TrainingBoard', () => ({
  default: () => <div data-testid="board" />,
}))

afterEach(cleanup)

/** One user blunder from the starting position, with a 4-ply engine line. */
function gameWithLine() {
  return buildGame({
    userColor: 'white',
    moves: [
      { ply: 1, san: 'a3', cpLoss: 400, classification: 'blunder', bestMoveSan: 'e4', bestLineSan: 'e4 e5 Nf3 Nc6' },
    ],
  })
}

/** The page title is the menu label, and it must be there whatever the state. */
function expectPageTitle() {
  expect(screen.getByRole('heading', { name: 'Calcul de séquence' })).toBeTruthy()
}

describe('CalcDepthView', () => {
  it('has a title on the empty state, which speaks French', () => {
    const onExit = vi.fn()
    render(<CalcDepthView analyses={[]} onExit={onExit} />)
    expectPageTitle()
    expect(screen.getByText('Pas encore de séquence à calculer')).toBeTruthy()
    expect(screen.queryByText(/blunder|engine/i)).toBeNull()
    fireEvent.click(screen.getByText('← Retour'))
    expect(onExit).toHaveBeenCalled()
  })

  it('shows its title above a running puzzle', () => {
    render(<CalcDepthView analyses={[gameWithLine()]} onExit={() => {}} />)
    expectPageTitle()
    expect(screen.getByText('Calcul en tête')).toBeTruthy()
  })

  it('keeps its title through a result and on the end-of-session screen', () => {
    render(<CalcDepthView analyses={[gameWithLine()]} onExit={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText(/Rxh2/), { target: { value: '1.e4 e5 2.Nf3 Nc6' } })
    fireEvent.click(screen.getByRole('button', { name: /Vérifier/ }))
    expectPageTitle()
    expect(screen.getByText('✓ Calcul parfait !')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Voir le bilan' }))
    expectPageTitle()
    expect(screen.getByText('Session terminée')).toBeTruthy()
  })
})

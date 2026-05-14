import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import StatsView from './StatsView'
import { buildGame } from '../analysis/__fixtures__'

afterEach(cleanup)

function corpus() {
  return [
    buildGame({
      userColor: 'white', result: 'loss', opponent: 'bob',
      ecoCode: 'C50', opening: 'Italian Game',
      moves: [
        { ply: 1, san: 'e4', cpLoss: 0, classification: 'book' },
        { ply: 9, san: 'Bxh6', cpLoss: 300, classification: 'blunder', bestMoveSan: 'Nf3' },
      ],
    }),
    buildGame({
      userColor: 'white', result: 'win', opponent: 'carol',
      ecoCode: 'C60', opening: 'Ruy López',
      moves: [{ ply: 1, san: 'e4', cpLoss: 0, classification: 'book' }],
    }),
  ]
}

describe('StatsView', () => {
  it('renders the heading with the number of games', () => {
    render(<StatsView analyses={corpus()} />)
    expect(screen.getByText(/Bilan \(2/i)).toBeTruthy()
  })

  it('shows the empty state when no analyses exist', () => {
    render(<StatsView analyses={[]} />)
    expect(screen.getByText(/Pas encore de stats/i)).toBeTruthy()
  })

  it('shows the 3 tab labels: Aperçu / Faiblesses / Ouvertures', () => {
    render(<StatsView analyses={corpus()} />)
    expect(screen.getByText('Aperçu')).toBeTruthy()
    expect(screen.getByText('Faiblesses')).toBeTruthy()
    expect(screen.getByText('Ouvertures')).toBeTruthy()
  })

  it('Aperçu tab shows "Précision moyenne"', () => {
    render(<StatsView analyses={corpus()} />)
    expect(screen.getByText('Précision moyenne')).toBeTruthy()
  })

  it('switches to Faiblesses tab', () => {
    render(<StatsView analyses={corpus()} />)
    fireEvent.click(screen.getByText('Faiblesses'))
    // The "Distribution de tes coups" panel is on Faiblesses.
    expect(screen.getByText('Distribution de tes coups')).toBeTruthy()
  })

  it('switches to Ouvertures tab and lists Italian Game', () => {
    render(<StatsView analyses={corpus()} />)
    fireEvent.click(screen.getByText('Ouvertures'))
    expect(screen.getByText('Ouvertures jouées')).toBeTruthy()
    expect(screen.getByText(/Italian Game/i)).toBeTruthy()
  })
})

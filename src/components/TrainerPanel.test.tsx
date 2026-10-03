import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import TrainerPanel from './TrainerPanel'
import { buildRepertoire } from '../analysis/repertoire'
import { gameFromSans } from '../test-utils/fixtures'

afterEach(cleanup)

describe('TrainerPanel', () => {
  it('shows the no-data message when no root has ≥2 games', () => {
    render(<TrainerPanel roots={[]} />)
    expect(screen.getByText(/Pas assez de répétitions/i)).toBeTruthy()
  })

  it('lists every trainable root as a button', () => {
    const games = [
      gameFromSans({ url: 'g1', userColor: 'white', sans: ['e4', 'e5', 'Nf3'] }),
      gameFromSans({ url: 'g2', userColor: 'white', sans: ['e4', 'e5', 'Nf3'] }),
    ]
    const roots = buildRepertoire(games)
    render(<TrainerPanel roots={roots} />)
    // At least one node references the opening label.
    expect(screen.getAllByText(/Italian Game/).length).toBeGreaterThan(0)
    // "Habitudes" and "Améliorer" mode toggles also present.
    expect(screen.getAllByText('Habitudes').length).toBeGreaterThan(0)
    expect(screen.getByText('Améliorer')).toBeTruthy()
  })

  it('switches between Habitudes and Améliorer modes', () => {
    const games = [
      gameFromSans({ url: 'g1', userColor: 'white', sans: ['e4', 'e5', 'Nf3'] }),
      gameFromSans({ url: 'g2', userColor: 'white', sans: ['e4', 'e5', 'Nf3'] }),
    ]
    const roots = buildRepertoire(games)
    render(<TrainerPanel roots={roots} />)
    // Default text mentions "Habitudes".
    expect(screen.getByText(/coup-le-plus-joué/i)).toBeTruthy()
    fireEvent.click(screen.getByText('Améliorer'))
    expect(screen.getByText(/coup que Stockfish recommandait/i)).toBeTruthy()
  })

  it('starts a session when a trainable button is clicked', () => {
    const games = [
      gameFromSans({ url: 'g1', userColor: 'white', sans: ['e4', 'e5', 'Nf3'] }),
      gameFromSans({ url: 'g2', userColor: 'white', sans: ['e4', 'e5', 'Nf3'] }),
    ]
    const roots = buildRepertoire(games)
    render(<TrainerPanel roots={roots} />)
    // Click the opening button — it's the one whose text contains "Italian Game".
    const buttons = screen.getAllByRole('button')
    const italianBtn = buttons.find(b => b.textContent?.includes('Italian Game') && b.textContent?.includes('(2)'))!
    fireEvent.click(italianBtn)
    // The trainer board renders the opening line label.
    expect(screen.getByText(/coup 1/)).toBeTruthy()
    // And the Indice button.
    expect(screen.getByText('Indice')).toBeTruthy()
  })
})

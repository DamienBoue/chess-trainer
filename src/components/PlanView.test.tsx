import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import PlanView from './PlanView'
import { buildGame } from '../analysis/__fixtures__'
import { mockLocalStorage } from '../test-utils/mockLocalStorage'

const navigate = vi.fn()

beforeEach(() => {
  vi.stubGlobal('localStorage', mockLocalStorage())
  navigate.mockReset()
})
afterEach(cleanup)

describe('PlanView empty state', () => {
  it('shows the 3-step onboarding when there are no analyses', () => {
    render(<PlanView analyses={[]} progress={{}} username="alice" onNavigate={navigate} />)
    expect(screen.getByText(/Démarrer en 3 étapes/i)).toBeTruthy()
    expect(screen.getByText(/Voir mes parties/i)).toBeTruthy()
  })

  it('clicking the empty-state CTA navigates to games', () => {
    render(<PlanView analyses={[]} progress={{}} username="alice" onNavigate={navigate} />)
    fireEvent.click(screen.getByText(/Voir mes parties/i))
    expect(navigate).toHaveBeenCalledWith('games')
  })
})

describe('PlanView with data', () => {
  function corpus() {
    // Enough games to seed at least one recurring-mistake plan item.
    const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'
    return [
      buildGame({ url: 'a', userColor: 'white', moves: [{ ply: 9, san: 'Bxh6', cpLoss: 300, classification: 'blunder', bestMoveSan: 'Nf3', fenBefore: FEN }] }),
      buildGame({ url: 'b', userColor: 'white', moves: [{ ply: 9, san: 'Bxh6', cpLoss: 300, classification: 'blunder', bestMoveSan: 'Nf3', fenBefore: FEN }] }),
    ]
  }

  it('renders the user greeting + bracket badge', () => {
    render(<PlanView analyses={corpus()} progress={{}} username="alice" onNavigate={navigate} />)
    expect(screen.getByText(/Bonjour @alice/i)).toBeTruthy()
  })

  it('shows the two tabs Aujourd\'hui / Mon niveau', () => {
    render(<PlanView analyses={corpus()} progress={{}} username="alice" onNavigate={navigate} />)
    expect(screen.getByText("Aujourd'hui")).toBeTruthy()
    expect(screen.getByText('Mon niveau')).toBeTruthy()
  })

  it('switches to the Mon niveau tab when clicked', () => {
    render(<PlanView analyses={corpus()} progress={{}} username="alice" onNavigate={navigate} />)
    fireEvent.click(screen.getByText('Mon niveau'))
    // RoadmapView's "Ton niveau" section appears.
    expect(screen.getAllByText('Joueur loisir').length).toBeGreaterThan(0)
  })

  it('renders the plan items list with at least one item', () => {
    render(<PlanView analyses={corpus()} progress={{}} username="alice" onNavigate={navigate} />)
    expect(screen.getAllByText(/Faire|Revoir/).length).toBeGreaterThan(0)
  })
})

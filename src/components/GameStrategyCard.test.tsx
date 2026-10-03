import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import GameStrategyCard from './GameStrategyCard'
import { analysedGame } from '../strategy/__fixtures__'

afterEach(cleanup)

const QGD = 'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7 e3 c6 Bd3 O-O Qc2 Nbd7 Nf3 Re8 O-O Nf8 Rab1 Ne4'
const NAJDORF = 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5 Nb3 Be7 O-O O-O a4 Be6'

describe('GameStrategyCard', () => {
  it('shows the dominant structure, timeline and lessons', () => {
    render(<GameStrategyCard analysis={analysedGame(QGD, { userColor: 'black' })} currentPly={0} onJump={() => {}} />)
    expect(screen.getByText('Bilan stratégique')).toBeTruthy()
    expect(screen.getAllByText(/Structure Carlsbad/).length).toBeGreaterThan(0)
    expect(screen.getByText('Leçons à retenir')).toBeTruthy()
  })

  it('jumps to the decision point of a missed plan', () => {
    const onJump = vi.fn()
    render(<GameStrategyCard analysis={analysedGame(NAJDORF, { costs: { 17: { cpLoss: 90, best: 'Nd5' } } })} currentPly={0} onJump={onJump} />)
    fireEvent.click(screen.getByText(/Plan manqué/))
    expect(onJump).toHaveBeenCalledWith(16)
    expect(screen.getAllByText(/le moteur jouait Nd5/).length).toBe(2) // lesson + expanded detail
  })

  it('filters moments by side', () => {
    render(<GameStrategyCard analysis={analysedGame('e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6', { userColor: 'white' })} currentPly={0} onJump={() => {}} />)
    expect(screen.getByText('Paire de fous cédée')).toBeTruthy()
    expect(screen.queryByText(/Pions doublés/)).toBeNull()
    fireEvent.click(screen.getByText('Adversaire'))
    expect(screen.getByText(/Pions doublés/)).toBeTruthy()
  })
})

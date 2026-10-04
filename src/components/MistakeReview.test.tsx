import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import MistakeReview from './MistakeReview'
import type { StockfishEngine } from '../engine/stockfish'
import { analysedGame } from '../strategy/__fixtures__'
import { buildGame } from '../analysis/__fixtures__'
import { mockLocalStorage } from '../test-utils/mockLocalStorage'

type DropArgs = { sourceSquare: string; targetSquare: string | null; piece: { pieceType: string } }
let board: { position: string; onPieceDrop?: (a: DropArgs) => boolean } = { position: '' }

// react-chessboard measures squares, which jsdom can't do: keep the props.
vi.mock('./TrainingBoard', () => ({
  default: (props: { position: string; onPieceDrop?: (a: DropArgs) => boolean }) => {
    board = props
    return <div data-testid="board">{props.position}</div>
  },
}))
const sounds = vi.hoisted(() => ({ playSuccess: vi.fn(), playWrong: vi.fn() }))
vi.mock('../audio/sounds', () => sounds)

beforeEach(() => {
  vi.stubGlobal('localStorage', mockLocalStorage())
  sounds.playSuccess.mockClear()
  sounds.playWrong.mockClear()
})
afterEach(cleanup)

const NAJDORF = 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5 Nb3 Be7 O-O O-O a4 Be6'
const game = () => analysedGame(NAJDORF, {
  costs: { 15: { cpLoss: 150, best: 'a4' }, 17: { cpLoss: 90, best: 'Nd5' } },
})

// Like Stockfish, the stub scores for the side to move: after the player's
// attempt, that is the opponent.
function engineReturning(scoreCp: number) {
  return {
    evaluate: vi.fn(async () => ({ scoreCp, pvUci: [], depth: 12, isMate: false })),
  } as unknown as StockfishEngine
}

function drop(from: string, to: string, piece = 'wP') {
  let accepted = false
  act(() => { accepted = board.onPieceDrop!({ sourceSquare: from, targetSquare: to, piece: { pieceType: piece } }) })
  return accepted
}

describe('MistakeReview', () => {
  it('replays the first mistake from the decision point', () => {
    render(<MistakeReview analysis={game()} engine={engineReturning(0)} onExit={() => {}} />)
    expect(screen.getByText(/· 1 \/ 2/)).toBeTruthy()
    expect(screen.getByText(/tu as joué/)).toBeTruthy()
    expect(board.position).toBe(game().moves[14].fenBefore)
  })

  it('accepts the engine move without asking the engine', () => {
    const engine = engineReturning(0)
    render(<MistakeReview analysis={game()} engine={engine} onExit={() => {}} />)
    expect(drop('a2', 'a4')).toBe(true)
    expect(screen.getByText(/Exactement le coup du moteur/)).toBeTruthy()
    expect(engine.evaluate).not.toHaveBeenCalled()
  })

  it('rejects illegal drops', () => {
    render(<MistakeReview analysis={game()} engine={engineReturning(0)} onExit={() => {}} />)
    expect(drop('a2', 'a6')).toBe(false)
  })

  it('lets the engine judge an alternative, at full strength', async () => {
    // Black to move after h3, and Black is 0.15 worse: White holds.
    const engine = engineReturning(-15)
    render(<MistakeReview analysis={game()} engine={engine} onExit={() => {}} />)
    drop('h2', 'h3')
    expect(screen.getByText(/Le moteur vérifie h3/)).toBeTruthy()
    expect(await screen.findByText(/tient la position/)).toBeTruthy()
    // No strength cap: the bot mode's Elo never applies to a judgement.
    expect(engine.evaluate).toHaveBeenCalledWith(expect.any(String), 12, 600)
  })

  it('reads the engine score from the side to move when the player has Black', async () => {
    const black = analysedGame(NAJDORF, { userColor: 'black', costs: { 16: { cpLoss: 150, best: 'Be6' } } })
    render(<MistakeReview analysis={black} engine={engineReturning(-40)} onExit={() => {}} />)
    expect(board.position).toBe(black.moves[15].fenBefore)
    // White to move after ...h6, and White is 0.4 worse: a good alternative for Black.
    drop('h7', 'h6', 'bP')
    expect(await screen.findByText(/tient la position/)).toBeTruthy()
  })

  it('a worse move can be retried, then the solution revealed with its explanation', async () => {
    // Black to move after h3, and 3 pawns up: the attempt is worse than the game.
    render(<MistakeReview analysis={game()} engine={engineReturning(300)} onExit={() => {}} />)
    fireEvent.click(screen.getByText('Passer'))
    expect(screen.getByText(/· 2 \/ 2/)).toBeTruthy()
    drop('h2', 'h3')
    expect(await screen.findByText(/n'est pas mieux/)).toBeTruthy()
    fireEvent.click(screen.getByText('↻ Réessayer'))
    expect(board.position).toBe(game().moves[16].fenBefore)
    fireEvent.click(screen.getByText(/💡 Indice/))
    expect(screen.getByText(/pense au plan/)).toBeTruthy()
    fireEvent.click(screen.getByText('Voir la solution'))
    expect(screen.getByText(/Solution :/)).toBeTruthy()
    expect(screen.getByText(/Plan : .*d5/)).toBeTruthy()
    // Explained once: the strategic notes below don't repeat the missed plan.
    expect(screen.queryByText(/Plan manqué/)).toBeNull()
  })

  it('ends with a summary and can start over', () => {
    const onExit = vi.fn()
    render(<MistakeReview analysis={game()} engine={engineReturning(0)} onExit={onExit} />)
    drop('a2', 'a4')
    fireEvent.click(screen.getByText('Suivant →'))
    drop('c3', 'd5', 'wN')
    fireEvent.click(screen.getByText('Voir le bilan →'))
    expect(screen.getByText('Revue terminée')).toBeTruthy()
    expect(screen.getByText(/trouvées du premier coup/)).toBeTruthy()
    fireEvent.click(screen.getByText('← Retour à l\'analyse'))
    expect(onExit).toHaveBeenCalled()
  })

  it('ignores an engine verdict arriving after leaving the review', async () => {
    let release!: (r: unknown) => void
    const engine = { evaluate: vi.fn(() => new Promise(r => { release = r })) } as unknown as StockfishEngine
    const { unmount } = render(<MistakeReview analysis={game()} engine={engine} onExit={() => {}} />)
    drop('h2', 'h3')
    unmount()
    release({ scoreCp: 0, pvUci: [], depth: 12, isMate: false })
    await new Promise(r => setTimeout(r, 0))
    expect(sounds.playSuccess).not.toHaveBeenCalled()
    expect(sounds.playWrong).not.toHaveBeenCalled()
  })

  it('lets the engine\'s under-promotion be played (no promotion picker)', () => {
    const promo = buildGame({
      url: 'promo', userColor: 'white',
      moves: [{ ply: 61, san: 'b8=Q', bestMoveSan: 'b8=R', classification: 'blunder', cpLoss: 900, evalBefore: 900, evalAfter: 0,
        fenBefore: '7k/1P6/8/8/8/8/8/K7 w - - 0 31' }],
    })
    render(<MistakeReview analysis={promo} engine={engineReturning(0)} onExit={() => {}} />)
    drop('b7', 'b8')
    expect(screen.getByText(/Exactement le coup du moteur/)).toBeTruthy()
  })

  it('explains when there is nothing to review', () => {
    render(<MistakeReview analysis={analysedGame('e4 e5 Nf3')} engine={engineReturning(0)} onExit={() => {}} />)
    expect(screen.getByText(/Aucune erreur à revoir/)).toBeTruthy()
  })
})

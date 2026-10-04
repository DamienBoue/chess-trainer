import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import AnalysisView from './AnalysisView'
import type { StockfishEngine } from '../engine/stockfish'
import type { GameAnalysis } from '../types'
import { fakeAnalysis, fakeChessComGame as fakeGame } from '../test-utils/fixtures'
import { analysedGame } from '../strategy/__fixtures__'

// react-chessboard measures squares, which jsdom can't do: keep the position.
vi.mock('./TrainingBoard', () => ({
  default: (props: { position: string }) => <div data-testid="board" data-position={props.position} />,
}))

// The engine run behind a game that isn't analysed yet: pending until a test settles it.
const analyze = vi.hoisted(() => ({ run: vi.fn() }))
vi.mock('../analysis/analyze', async importOriginal => ({
  ...(await importOriginal<typeof import('../analysis/analyze')>()),
  analyzeGame: (...args: unknown[]) => analyze.run(...args),
}))

beforeEach(() => {
  analyze.run.mockReset()
  analyze.run.mockReturnValue(new Promise(() => {}))
})
afterEach(cleanup)

// A stub engine that never gets called because existingAnalysis is set.
const stubEngine = {} as StockfishEngine

type ViewProps = ComponentProps<typeof AnalysisView>

function renderView(analysis: GameAnalysis, extra: Partial<ViewProps> = {}) {
  return render(
    <AnalysisView
      engine={stubEngine}
      username="alice"
      game={fakeGame()}
      existingAnalysis={analysis}
      allAnalyses={[]}
      onAnalysisComplete={() => {}}
      onBack={() => {}}
      {...extra}
    />,
  )
}

describe('AnalysisView (existing analysis)', () => {
  it('renders the back button and exports button', () => {
    const onBack = vi.fn()
    render(
      <AnalysisView
        engine={stubEngine}
        username="alice"
        game={fakeGame()}
        existingAnalysis={fakeAnalysis(['e4', 'e5', 'Nf3'])}
        allAnalyses={[]}
        onAnalysisComplete={() => {}}
        onBack={onBack}
      />,
    )
    expect(screen.getByText(/Retour aux parties/i)).toBeTruthy()
    expect(screen.getByText(/Export PGN annoté/i)).toBeTruthy()
  })

  it('Retour button calls onBack', () => {
    const onBack = vi.fn()
    render(
      <AnalysisView
        engine={stubEngine}
        username="alice"
        game={fakeGame()}
        existingAnalysis={fakeAnalysis(['e4'])}
        allAnalyses={[]}
        onAnalysisComplete={() => {}}
        onBack={onBack}
      />,
    )
    fireEvent.click(screen.getByText(/Retour aux parties/i))
    expect(onBack).toHaveBeenCalled()
  })

  it('renders the Summary, Overview and Évaluation sections', () => {
    render(
      <AnalysisView
        engine={stubEngine}
        username="alice"
        game={fakeGame()}
        existingAnalysis={fakeAnalysis(['e4', 'e5', 'Nf3', 'Nc6'])}
        allAnalyses={[]}
        onAnalysisComplete={() => {}}
        onBack={() => {}}
      />,
    )
    expect(screen.getByText('Résumé')).toBeTruthy()
    expect(screen.getByText("Vue d'ensemble")).toBeTruthy()
    expect(screen.getByText('Évaluation')).toBeTruthy()
    expect(screen.getByText('Liste des coups')).toBeTruthy()
  })

  it('shows the opponent + opening in overview', () => {
    render(
      <AnalysisView
        engine={stubEngine}
        username="alice"
        game={fakeGame()}
        existingAnalysis={fakeAnalysis(['e4', 'e5'])}
        allAnalyses={[]}
        onAnalysisComplete={() => {}}
        onBack={() => {}}
      />,
    )
    expect(screen.getAllByText(/bob/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Italian Game/).length).toBeGreaterThan(0)
  })
})

describe('AnalysisView (loading)', () => {
  it('shows the "Analyse en cours" copy when no existing analysis', () => {
    // existingAnalysis = null triggers the analysis effect. The engine stub
    // doesn't actually do anything; the loading copy is rendered before
    // any data arrives.
    render(
      <AnalysisView
        engine={stubEngine}
        username="alice"
        game={fakeGame()}
        existingAnalysis={null}
        allAnalyses={[]}
        onAnalysisComplete={() => {}}
        onBack={() => {}}
      />,
    )
    expect(screen.getByText(/Analyse en cours/i)).toBeTruthy()
  })
})

// ---- Phones --------------------------------------------------------------
// jsdom has no media queries: these check what the markup does on its own
// (the bar, the shared state) and which phone / desktop classes it carries.

const NAJDORF = 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5 Nb3 Be7 O-O O-O a4 Be6'
/** White's 8th (ply 15) and 9th (ply 17) moves are errors: two moves to review. */
const costed = () => analysedGame(NAJDORF, { costs: { 15: { cpLoss: 150, best: 'a4' }, 17: { cpLoss: 90, best: 'Nd5' } } })

const BAR = { name: 'Navigation dans la partie' }
const bar = () => within(screen.getByRole('group', BAR))
const barButton = (name: string) => bar().getByRole('button', { name }) as HTMLButtonElement
const boardAt = () => screen.getByTestId('board').getAttribute('data-position')
/** The ply the board shows (0 = start position): FENs are unique along a game. */
const plyShown = (a: GameAnalysis) => a.moves.findIndex(m => m.fenAfter === boardAt()) + 1

describe('AnalysisView (phone move bar)', () => {
  afterEach(() => { vi.useRealTimers() })

  it('steps through the game from the bar: the label and the board follow', () => {
    const a = fakeAnalysis(['e4', 'e5', 'Nf3', 'Nc6'])
    renderView(a)
    expect(bar().getByText('Départ')).toBeTruthy()
    expect(plyShown(a)).toBe(0)
    const steps: [button: string, label: string, ply: number][] = [
      ['Coup suivant', '1. e4', 1],
      ['Coup suivant', '1... e5', 2],
      ['Coup suivant', '2. Nf3', 3],
      ['Coup précédent', '1... e5', 2],
      ['Fin', '2... Nc6', 4],
      ['Début', 'Départ', 0],
    ]
    for (const [button, label, ply] of steps) {
      fireEvent.click(barButton(button))
      expect(bar().getByText(label)).toBeTruthy()
      expect(plyShown(a)).toBe(ply)
    }
  })

  it('shares its state with the keyboard shortcuts', () => {
    const a = fakeAnalysis(['e4', 'e5', 'Nf3'])
    renderView(a)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(bar().getByText('1... e5')).toBeTruthy()
    fireEvent.click(barButton('Coup suivant'))
    expect(bar().getByText('2. Nf3')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Home' })
    expect(bar().getByText('Départ')).toBeTruthy()
  })

  it('disables what cannot move at either end of the game', () => {
    const a = fakeAnalysis(['e4', 'e5'])
    renderView(a)
    const disabled = () => ['Début', 'Coup précédent', 'Coup suivant', 'Fin'].filter(name => barButton(name).disabled)
    expect(disabled()).toEqual(['Début', 'Coup précédent'])
    fireEvent.click(barButton('Fin'))
    expect(disabled()).toEqual(['Coup suivant', 'Fin'])
  })

  it('moves one ply per tap and scrubs through the game while ▶ is held', () => {
    vi.useFakeTimers()
    const a = fakeAnalysis(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'])
    renderView(a)
    const next = barButton('Coup suivant')
    const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })

    // A tap, with the pointer events a finger brings: exactly one ply.
    fireEvent.pointerDown(next)
    fireEvent.pointerUp(next)
    fireEvent.click(next, { detail: 1 })
    tick(2000)
    expect(plyShown(a)).toBe(1)

    // Held: nothing for 350 ms, then a ply every 110 ms.
    fireEvent.pointerDown(next)
    tick(349)
    expect(plyShown(a)).toBe(1)
    tick(1 + 110 * 2)
    expect(plyShown(a)).toBe(4)
    fireEvent.pointerUp(next)
    fireEvent.click(next, { detail: 1 }) // the click that closes the press
    tick(2000)
    expect(plyShown(a)).toBe(4)

    // Held to the end of the game: it stops there and the button gives up.
    fireEvent.pointerDown(next)
    for (let i = 0; i < 12; i++) tick(110)
    expect(plyShown(a)).toBe(6)
    expect(next.disabled).toBe(true)
  })

  it('jumps to the next key moment, like the key-moment card does', () => {
    const a = costed()
    renderView(a)
    const card = screen.getByText('Moment clé suivant →') as HTMLButtonElement
    const trail = (jump: () => HTMLButtonElement) => {
      const plies: number[] = []
      for (let button = jump(); !button.disabled; button = jump()) {
        fireEvent.click(button)
        plies.push(plyShown(a))
      }
      return plies
    }
    const expected = trail(() => card)
    // Your two errors are key moments, in game order (the strategic review may add others).
    expect(expected).toEqual([...expected].sort((x, y) => x - y))
    expect(expected).toContain(15)
    expect(expected).toContain(17)

    fireEvent.click(barButton('Début'))
    expect(card.disabled).toBe(false)
    expect(barButton('Moment clé suivant').disabled).toBe(false)
    expect(trail(() => barButton('Moment clé suivant'))).toEqual(expected)
    // Both are out of moments after the last one.
    expect(barButton('Moment clé suivant').disabled).toBe(true)
    expect(card.disabled).toBe(true)
  })

  it('disables the key-moment jump when the game has none', () => {
    renderView(fakeAnalysis(['e4', 'e5', 'Nf3']))
    expect(barButton('Moment clé suivant').disabled).toBe(true)
  })

  it('says it when the board shows the engine line rather than the game, and a step goes back to the game', () => {
    const a = fakeAnalysis(['e4', 'e5', 'Nf3'])
    a.moves[0] = { ...a.moves[0], bestMoveSan: 'd4', bestLineSan: 'd4 d5 c4', cpLoss: 40 }
    renderView(a, { initialPly: 1, initialTab: 'move' })
    expect(bar().getByText('1. e4')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'd5' })) // a chip of the engine line
    expect(bar().getByText('Aperçu moteur')).toBeTruthy()
    // The board left the game: it shows neither the start position nor any position after a move.
    expect(boardAt()).not.toBe(a.moves[0].fenBefore)
    expect(a.moves.map(m => m.fenAfter)).not.toContain(boardAt())
    fireEvent.click(barButton('Coup suivant'))
    expect(bar().getByText('1... e5')).toBeTruthy()
    expect(plyShown(a)).toBe(2)
  })

  it('is not shown while "Revoir mes erreurs" runs, and comes back with the review\'s exit', () => {
    const a = costed()
    const { container } = renderView(a)
    const page = container.firstElementChild!
    expect(page.className).toContain('max-sm:pb-') // room under the page for the bar
    expect(screen.getByRole('group', BAR)).toBeTruthy()

    fireEvent.click(screen.getByText(/Revoir mes erreurs/))
    expect(screen.queryByRole('group', BAR)).toBeNull()
    expect(page.className).not.toContain('max-sm:pb-')

    fireEvent.click(screen.getByText('Quitter')) // leaves at the position of the first mistake
    expect(bar().getByText('7... Be7')).toBeTruthy()
    expect(plyShown(a)).toBe(14)
    expect(page.className).toContain('max-sm:pb-')
  })
})

describe('AnalysisView (straight into the review)', () => {
  it('opens on "Revoir mes erreurs" when asked, and its exit lands on the analysis', () => {
    renderView(costed(), { initialReviewing: true })
    expect(screen.getByText('Quitter')).toBeTruthy()
    expect(screen.queryByRole('group', BAR)).toBeNull()
    fireEvent.click(screen.getByText('Quitter'))
    expect(screen.getByRole('group', BAR)).toBeTruthy()
  })
})

describe('AnalysisView (phone layout)', () => {
  it('hides the small inline arrows on phones, keeping the board flip and the engine arrow toggle', () => {
    renderView(fakeAnalysis(['e4', 'e5']))
    const board = within(screen.getByRole('region', { name: 'Échiquier' }))
    for (const name of ['Début', 'Coup précédent', 'Coup suivant', 'Fin']) {
      expect(board.getByRole('button', { name }).className).toContain('max-sm:hidden')
    }
    expect(board.getByRole('button', { name: "Retourner l'échiquier" }).className).not.toContain('max-sm:hidden')
    expect(board.getByText('➚ moteur').className).not.toContain('max-sm:hidden')
  })

  it('leaves the way up to the top bar on phones, and keeps the title and the export', () => {
    renderView(fakeAnalysis(['e4', 'e5']))
    expect(screen.getByText(/Retour aux parties/).className).toContain('max-sm:hidden')
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('bob')
    expect(screen.getByText(/Export PGN annoté/).className).not.toContain('max-sm:hidden')
  })

  it('orders the phone column board, tabs, graph, key-moment card, move list', () => {
    renderView(fakeAnalysis(['e4', 'e5', 'Nf3']))
    const orderOf = (el: Element) => Number(/max-sm:order-(\d+)/.exec(el.closest('[class*="max-sm:order-"]')!.className)![1])
    const blocks: [string, Element][] = [
      ['graph', screen.getByText('Évaluation')],
      ['move list', screen.getByText('Liste des coups')],
      ['tab content', screen.getByRole('tabpanel')],
      ['board', screen.getByTestId('board')],
      ['key moment', screen.getByText('Moment clé suivant →')],
      ['tabs', screen.getByRole('tablist')],
    ]
    // The CSS order, then the document order for blocks sharing an order (tabs and their content).
    const onPhone = blocks
      .sort(([, a], [, b]) => orderOf(a) - orderOf(b) || (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
      .map(([name]) => name)
    expect(onPhone).toEqual(['board', 'tabs', 'tab content', 'graph', 'key moment', 'move list'])
  })

  it('keeps the two desktop columns: board and graph on the left, key moment, move list and tabs on the right', () => {
    renderView(fakeAnalysis(['e4', 'e5', 'Nf3']))
    const leftSection = screen.getByRole('region', { name: 'Échiquier' })
    const rightSection = screen.getByRole('region', { name: 'Analyse' })
    const left = within(leftSection)
    const right = within(rightSection)
    expect(left.getByTestId('board')).toBeTruthy()
    expect(left.getByText('Évaluation')).toBeTruthy()
    expect(right.getByText('Moment clé suivant →')).toBeTruthy()
    expect(right.getByText('Liste des coups')).toBeTruthy()
    expect(right.getByRole('tablist')).toBeTruthy()
    expect(right.getByRole('tabpanel')).toBeTruthy()
    // Sticky board column; on phones both sections turn transparent so their blocks can be ordered.
    expect(leftSection.className).toContain('lg:sticky')
    expect(leftSection.className).toContain('max-sm:contents')
    expect(rightSection.className).toContain('max-sm:contents')
  })
})

describe('AnalysisView (initial ply)', () => {
  const sans = ['e4', 'e5', 'Nf3']
  const view = (initialPly: number, extra: Partial<ViewProps> = {}) =>
    renderView(fakeAnalysis(sans), { initialPly, initialTab: 'review', ...extra })

  it('opens a deep link on the move it names', () => {
    view(2)
    expect(bar().getByText('1... e5')).toBeTruthy()
  })

  it('clamps a deep link past the end of the game (?coup=999) to the last move', () => {
    const a = fakeAnalysis(sans)
    const onRouteState = vi.fn()
    renderView(a, { initialPly: 999, initialTab: 'review', onRouteState })
    expect(bar().getByText('2. Nf3')).toBeTruthy()
    expect(plyShown(a)).toBe(3)
    expect(barButton('Coup suivant').disabled).toBe(true)
    // The URL never sees the impossible ply.
    expect(onRouteState).toHaveBeenLastCalledWith({ ply: 3, tab: 'review' })
    expect(onRouteState).not.toHaveBeenCalledWith(expect.objectContaining({ ply: 999 }))
    // And one tap back is one ply back, not 996 to go.
    fireEvent.click(barButton('Coup précédent'))
    expect(bar().getByText('1... e5')).toBeTruthy()
  })

  it.each([-5, Number.NaN, -0.4])('lands on the start position for a ply of %s', ply => {
    view(ply)
    expect(bar().getByText('Départ')).toBeTruthy()
  })

  it('clamps once the analysis is known when the game was still being analysed', async () => {
    const a = fakeAnalysis(sans)
    analyze.run.mockResolvedValue(a)
    const onRouteState = vi.fn()
    render(
      <AnalysisView
        engine={stubEngine}
        username="alice"
        game={fakeGame()}
        existingAnalysis={null}
        allAnalyses={[]}
        onAnalysisComplete={() => {}}
        onBack={() => {}}
        initialPly={999}
        initialTab="review"
        onRouteState={onRouteState}
      />,
    )
    expect(screen.getByText(/Analyse en cours/i)).toBeTruthy()
    expect(await screen.findByRole('group', BAR)).toBeTruthy()
    expect(bar().getByText('2. Nf3')).toBeTruthy()
    expect(plyShown(a)).toBe(3)
    expect(onRouteState).toHaveBeenLastCalledWith({ ply: 3, tab: 'review' })
  })
})

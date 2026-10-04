import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import RepertoireView from './RepertoireView'
import { gameFromSans } from '../test-utils/fixtures'
import { mockLocalStorage } from '../test-utils/mockLocalStorage'

// The board measures its squares, which jsdom can't do.
vi.mock('./TrainingBoard', () => ({
  default: () => <div data-testid="board" />,
}))

beforeEach(() => { vi.stubGlobal('localStorage', mockLocalStorage()) })
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const MAIN_LINE = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O']

/** Three games of the same opening: a main line (twice, ending with a castle)
 *  and, from the first move, an alternative. Stockfish prefers another move
 *  than Bc4 in the first game. */
function corpus() {
  const first = gameFromSans({ url: 'g1', userColor: 'white', sans: MAIN_LINE })
  first.moves[4] = { ...first.moves[4], bestMoveSan: 'd4', cpLoss: 40 }
  return [
    first,
    gameFromSans({ url: 'g2', userColor: 'white', sans: MAIN_LINE }),
    gameFromSans({ url: 'g3', userColor: 'white', sans: ['d4', 'd5', 'c4'] }),
  ]
}

describe('RepertoireView', () => {
  it('is titled like its menu entry, with the Labo d\'ouvertures badge next to it', () => {
    const onOpenLab = vi.fn()
    render(<RepertoireView analyses={corpus()} onOpenLab={onOpenLab} />)
    // The badge sits beside the heading, not inside it: the title is exactly the menu label.
    expect(screen.getByRole('heading', { name: 'Mon répertoire' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: "🔬 Labo d'ouvertures" }))
    expect(onOpenLab).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/Opening Lab/)).toBeNull()
  })

  it('names its tabs in French', () => {
    render(<RepertoireView analyses={corpus()} />)
    for (const label of ['Lignes', "S'entraîner", 'SRS', 'Explorer']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
    expect(screen.queryByText('Trainer')).toBeNull()
  })

  it('makes every item of a main-line row wrap as a whole (a phone is 390px wide)', () => {
    render(<RepertoireView analyses={corpus()} />)
    // The castle is one of the rows: "O-O" must never break into "O-" / "O".
    expect(screen.getByText('O-O')).toBeTruthy()
    const costs = screen.getAllByText(/^⌀ \d+ cp$/)
    expect(costs.length).toBeGreaterThanOrEqual(4)
    for (const cost of costs) {
      const items = cost.parentElement!
      expect(items.className).toContain('flex-wrap')
      expect(items.children.length).toBeGreaterThanOrEqual(4)
      for (const item of Array.from(items.children)) {
        expect(item.className).toContain('whitespace-nowrap')
      }
    }
    // The Stockfish hint and the alternatives link are units of the row too.
    const hint = screen.getByText('⚠ SF préfère d4')
    expect(hint.className).toContain('whitespace-nowrap')
    expect(screen.getByText(/1 alternative$/).className).toContain('whitespace-nowrap')
  })

  it('wraps the alternatives of an opened row as whole items too', () => {
    render(<RepertoireView analyses={corpus()} />)
    fireEvent.click(screen.getByText(/1 alternative$/))
    const alternative = screen.getByText('d4', { selector: 'span.font-mono' })
    const items = alternative.parentElement!
    expect(items.className).toContain('flex-wrap')
    for (const item of Array.from(items.children)) {
      expect(item.className).toContain('whitespace-nowrap')
    }
  })
})

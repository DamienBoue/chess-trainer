import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import EvalGraph from './EvalGraph'
import { CLASSIFICATION_COLORS } from '../analysis/classify'
import type { MoveAnalysis } from '../types'

afterEach(cleanup)

/** `n` unremarkable plies ("best", 0 cp, level eval) named m1, m2…, with
 *  some plies overridden. The graph never reads the FENs. */
function line(n: number, overrides: Record<number, Partial<MoveAnalysis>> = {}): MoveAnalysis[] {
  return Array.from({ length: n }, (_, i): MoveAnalysis => ({
    ply: i + 1, san: `m${i + 1}`,
    fenBefore: '', fenAfter: '',
    evalBefore: 0, evalAfter: 0,
    classification: 'best', cpLoss: 0,
    ...overrides[i + 1],
  }))
}

// White's moves are the odd plies. Every non-error class appears, then
// White errs four times (2 inaccuracies, a mistake, a blunder) and Black
// twice (an inaccuracy, a blunder).
const GAME = line(14, {
  1: { classification: 'book' },
  2: { classification: 'book' },
  3: { classification: 'great', cpLoss: 15 },
  4: { classification: 'good', cpLoss: 40 },
  5: { san: 'Nc3', classification: 'inaccuracy', cpLoss: 80, evalAfter: -40 },
  6: { san: 'Nd4', classification: 'inaccuracy', cpLoss: 70, evalAfter: 30 },
  7: { san: 'Bd3', classification: 'inaccuracy', cpLoss: 95, evalAfter: -65 },
  9: { san: 'Qe2', classification: 'mistake', cpLoss: 180, evalAfter: -245 },
  11: { san: 'Kf1', classification: 'blunder', cpLoss: 450, evalAfter: -695 },
  12: { san: 'Qg4', classification: 'blunder', cpLoss: 700, evalAfter: 5 },
})

function draw(props: Partial<ComponentProps<typeof EvalGraph>> = {}) {
  return render(
    <EvalGraph moves={GAME} currentPly={0} userColor="white" onClickPly={() => {}} {...props} />,
  )
}

/** The visible dot whose tooltip reads `tooltip`. */
function dotOf(tooltip: string): Element {
  const dot = screen.getByText(tooltip).parentElement?.querySelector('circle[data-side]')
  if (!dot) throw new Error(`no dot for "${tooltip}"`)
  return dot
}

describe('EvalGraph', () => {
  it('renders nothing without moves', () => {
    const { container } = draw({ moves: [] })
    expect(container.firstChild).toBeNull()
  })

  it("dots the player's errors big and opaque, the opponent's small and dimmed", () => {
    const { container } = draw()
    const user = Array.from(container.querySelectorAll('circle[data-side="user"]'))
    const opponent = Array.from(container.querySelectorAll('circle[data-side="opponent"]'))
    expect(user).toHaveLength(4)
    expect(opponent).toHaveLength(2)
    for (const dot of user) {
      expect(dot.getAttribute('r')).toBe('3.5')
      expect(dot.getAttribute('opacity')).toBe('1')
    }
    for (const dot of opponent) {
      expect(dot.getAttribute('r')).toBe('2.5')
      expect(dot.getAttribute('opacity')).toBe('0.5')
    }
  })

  it('swaps the sizes when the player has Black', () => {
    const { container } = draw({ userColor: 'black' })
    expect(container.querySelectorAll('circle[data-side="user"]')).toHaveLength(2)
    expect(container.querySelectorAll('circle[data-side="opponent"]')).toHaveLength(4)
  })

  it('colours each dot by its classification', () => {
    draw()
    expect(dotOf('3. Nc3 ?! — Inexactitude (−80 cp)').getAttribute('fill')).toBe(CLASSIFICATION_COLORS.inaccuracy)
    expect(dotOf('5. Qe2 ? — Erreur (−180 cp)').getAttribute('fill')).toBe(CLASSIFICATION_COLORS.mistake)
    expect(dotOf('6. Kf1 ?? — Gaffe (−450 cp)').getAttribute('fill')).toBe(CLASSIFICATION_COLORS.blunder)
  })

  it('leaves book, best, great and good moves unmarked', () => {
    // GAME's first four plies, then a "best" one.
    const { container } = draw({ moves: [...GAME.slice(0, 4), ...line(5).slice(4)] })
    expect(container.querySelectorAll('circle[data-side]')).toHaveLength(0)
    expect(container.querySelectorAll('title')).toHaveLength(0)
  })

  it('explains each dot in a tooltip: move number, SAN, glyph, label and cp loss', () => {
    // The player has Black: 12... Rc8 is theirs, 12. Qd2 the opponent's.
    draw({
      userColor: 'black',
      moves: line(24, {
        23: { san: 'Qd2', classification: 'inaccuracy', cpLoss: 75 },
        24: { san: 'Rc8', classification: 'blunder', cpLoss: 320 },
      }),
    })
    expect(screen.getByText('12... Rc8 ?? — Gaffe (−320 cp)')).toBeTruthy()
    expect(screen.getByText("12. Qd2 ?! — Inexactitude de l'adversaire (−75 cp)")).toBeTruthy()
  })

  it('seeks to the move of a clicked dot, without a second seek from the background', () => {
    const onClickPly = vi.fn()
    draw({ onClickPly })
    fireEvent.click(dotOf('6. Kf1 ?? — Gaffe (−450 cp)'))
    expect(onClickPly).toHaveBeenCalledTimes(1)
    expect(onClickPly).toHaveBeenCalledWith(11)
    fireEvent.click(dotOf("6... Qg4 ?? — Gaffe de l'adversaire (−700 cp)"))
    expect(onClickPly).toHaveBeenLastCalledWith(12)
  })

  it('seeks to the nearest move on a click on the background', () => {
    const onClickPly = vi.fn()
    draw({ onClickPly, moves: line(10) })
    const svg = screen.getByRole('img')
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 600, bottom: 120, width: 600, height: 120, x: 0, y: 0, toJSON: () => ({}),
    })
    // 10 moves over 592 units: move 5's point sits at x = 270.4.
    fireEvent.click(svg, { clientX: 268 })
    expect(onClickPly).toHaveBeenLastCalledWith(5)
    fireEvent.click(svg, { clientX: 290 })
    expect(onClickPly).toHaveBeenLastCalledWith(5)
    fireEvent.click(svg, { clientX: 600 })
    expect(onClickPly).toHaveBeenLastCalledWith(10)
    fireEvent.click(svg, { clientX: 2 })
    expect(onClickPly).toHaveBeenLastCalledWith(0)
  })

  it('maps clicks through the letterbox when the element is wider than the drawing', () => {
    const onClickPly = vi.fn()
    draw({ onClickPly, moves: line(10) })
    const svg = screen.getByRole('img')
    // 1000 × 128 px: the 600 × 120 drawing is scaled by 128/120 and centred
    // (180 px bands on each side). Move 9's point sits at x = 507.2.
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 1000, bottom: 128, width: 1000, height: 128, x: 0, y: 0, toJSON: () => ({}),
    })
    fireEvent.click(svg, { clientX: 180 + 507.2 * 128 / 120 })
    expect(onClickPly).toHaveBeenLastCalledWith(9)
  })

  it('ticks each valid key moment once along the top edge, with a tooltip', () => {
    const { container } = draw({ keyMoments: [9, 5, 9, 0, 99] })
    const ticks = Array.from(container.querySelectorAll('[data-key-moment]'))
    expect(ticks.map(t => t.getAttribute('data-key-moment'))).toEqual(['5', '9'])
    expect(screen.getByText('Moment clé — 3. Nc3')).toBeTruthy()
    expect(screen.getByText('Moment clé — 5. Qe2')).toBeTruthy()
  })

  it('seeks to a clicked key moment', () => {
    const onClickPly = vi.fn()
    const { container } = draw({ onClickPly, keyMoments: [4, 8] })
    const ticks = Array.from(container.querySelectorAll('[data-key-moment]'))
    fireEvent.click(ticks[1])
    expect(onClickPly).toHaveBeenCalledTimes(1)
    expect(onClickPly).toHaveBeenCalledWith(8)
  })

  it('brightens the tick of the current move', () => {
    const { container } = draw({ keyMoments: [4, 8], currentPly: 8 })
    const ticks = Array.from(container.querySelectorAll('[data-key-moment]'))
    expect(ticks.map(t => t.getAttribute('opacity'))).toEqual(['0.6', '1'])
  })

  it('draws no tick without key moments', () => {
    const { container } = draw()
    expect(container.querySelectorAll('[data-key-moment]')).toHaveLength(0)
  })

  it("sums up the player's own errors in its accessible name", () => {
    draw()
    expect(screen.getByRole('img', {
      name: "Courbe d'évaluation : 1 gaffe, 1 erreur, 2 inexactitudes de ta part",
    })).toBeTruthy()
    cleanup()
    draw({ userColor: 'black' })
    expect(screen.getByRole('img', {
      name: "Courbe d'évaluation : 1 gaffe, 0 erreur, 1 inexactitude de ta part",
    })).toBeTruthy()
  })
})

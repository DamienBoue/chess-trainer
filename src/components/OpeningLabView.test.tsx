import { Chess } from 'chess.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import OpeningLabView from './OpeningLabView'
import { buildGame } from '../analysis/__fixtures__'
import { mockLocalStorage } from '../test-utils/mockLocalStorage'

beforeEach(() => {
  vi.stubGlobal('localStorage', mockLocalStorage())
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function gameFromSans(opts: { url: string; userColor: 'white' | 'black'; sans: string[]; ecoCode?: string; opening?: string }) {
  const c = new Chess()
  const moves = opts.sans.map((san, i) => {
    const fenBefore = c.fen()
    const mv = c.move(san)
    if (!mv) throw new Error('illegal san: ' + san)
    return {
      ply: i + 1, san: mv.san,
      cpLoss: 0, classification: 'best' as const,
      bestMoveSan: mv.san, fenBefore, fenAfter: c.fen(),
    }
  })
  return buildGame({
    userColor: opts.userColor, url: opts.url,
    ecoCode: opts.ecoCode ?? 'C50', opening: opts.opening ?? 'Italian Game',
    moves,
  })
}

describe('OpeningLabView', () => {
  it('shows the empty state when there are no analyses', () => {
    render(<OpeningLabView analyses={[]} />)
    expect(screen.getByText(/Pas encore de répertoire/i)).toBeTruthy()
  })

  it('renders the page header + opening picker buttons when data exists', () => {
    const games = [
      gameFromSans({ url: 'g1', userColor: 'white', sans: ['e4', 'e5', 'Nf3'] }),
      gameFromSans({ url: 'g2', userColor: 'white', sans: ['e4', 'e5', 'Nf3'] }),
    ]
    // Stub fetch so it returns "API unavailable".
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })))
    render(<OpeningLabView analyses={games} />)
    expect(screen.getByText(/Lab d'ouverture/i)).toBeTruthy()
    expect(screen.getByText(/Italian Game/)).toBeTruthy()
    expect(screen.getByText(/Ta ligne la plus jouée/i)).toBeTruthy()
  })

  it('shows the "API indisponible" hint when the explorer 401s', async () => {
    const games = [
      gameFromSans({ url: 'g1', userColor: 'white', sans: ['e4', 'e5', 'Nf3'] }),
      gameFromSans({ url: 'g2', userColor: 'white', sans: ['e4', 'e5', 'Nf3'] }),
    ]
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })))
    render(<OpeningLabView analyses={games} />)
    await waitFor(() => {
      expect(screen.getAllByText(/API indisponible/i).length).toBeGreaterThan(0)
    }, { timeout: 1000 })
  })

  it('renders master rows when the explorer responds 200', async () => {
    const games = [
      gameFromSans({ url: 'g1', userColor: 'white', sans: ['e4', 'e5', 'Nf3'] }),
      gameFromSans({ url: 'g2', userColor: 'white', sans: ['e4', 'e5', 'Nf3'] }),
    ]
    const payload = {
      white: 100, draws: 50, black: 30,
      moves: [
        { uci: 'e2e4', san: 'e4', white: 70, draws: 30, black: 20, averageRating: 2400 },
        { uci: 'd2d4', san: 'd4', white: 30, draws: 20, black: 10, averageRating: 2350 },
      ],
    }
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } }),
    ))
    render(<OpeningLabView analyses={games} />)
    await waitFor(() => {
      expect(screen.getAllByText('d4').length).toBeGreaterThan(0)
    }, { timeout: 1000 })
  })

  it('clicking onBack invokes the callback', () => {
    const back = vi.fn()
    const games = [
      gameFromSans({ url: 'g1', userColor: 'white', sans: ['e4', 'e5', 'Nf3'] }),
      gameFromSans({ url: 'g2', userColor: 'white', sans: ['e4', 'e5', 'Nf3'] }),
    ]
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })))
    render(<OpeningLabView analyses={games} onBack={back} />)
    fireEvent.click(screen.getByText(/Retour/))
    expect(back).toHaveBeenCalled()
  })
})

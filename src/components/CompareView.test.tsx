import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import CompareView from './CompareView'
import { fakeChessComGame } from '../test-utils/fixtures'
import { getRecentGames } from '../api/chesscom'

vi.mock('../api/chesscom', () => ({ getRecentGames: vi.fn() }))

// alice (1480) beats bob (1500) with the white pieces.
const games = [fakeChessComGame()]

beforeEach(() => {
  vi.mocked(getRecentGames).mockResolvedValue(games)
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('CompareView', () => {
  it('is titled "Comparer avec un ami", like its menu entry', () => {
    render(<CompareView username="alice" games={games} />)
    expect(screen.getByRole('heading', { name: 'Comparer avec un ami' })).toBeTruthy()
    expect(screen.queryByText(/autre joueur/)).toBeNull()
  })

  it('speaks French in the profile cards, and keeps % on the rate deltas only', async () => {
    render(<CompareView username="alice" games={games} />)
    fireEvent.change(screen.getByPlaceholderText('ex: hikaru'), { target: { value: 'bob' } })
    fireEvent.click(screen.getByRole('button', { name: 'Comparer' }))

    const table = within(await waitFor(() => screen.getByRole('table')))
    // Rate rows end with %, the Elo rows do not.
    const rate = table.getByText('Taux de victoire').closest('tr')!
    expect(within(rate).getByText('+100%')).toBeTruthy()
    const elo = table.getByText('Elo moyen').closest('tr')!
    expect(within(elo).getByText('-20')).toBeTruthy()
    for (const label of ['Taux avec les Blancs', 'Taux avec les Noirs']) {
      expect(table.getByText(label)).toBeTruthy()
    }
    expect(screen.queryByText(/Win rate|WR /)).toBeNull()
  })
})

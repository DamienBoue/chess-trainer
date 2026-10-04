import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import ScoutingView from './ScoutingView'
import { fakeChessComGame } from '../test-utils/fixtures'
import { getRecentGames } from '../api/chesscom'
import { fetchExplorer } from '../api/lichess'

vi.mock('../api/chesscom', () => ({ getRecentGames: vi.fn() }))
vi.mock('../api/lichess', () => ({ fetchExplorer: vi.fn() }))
// The board measures its squares, which jsdom can't do.
vi.mock('./TrainingBoard', () => ({
  default: () => <div data-testid="board" />,
}))

const white = (result: string) => ({ rating: 1500, result, '@id': '', username: 'alice' })
const black = (result: string) => ({ rating: 1500, result, '@id': '', username: 'bob' })

// alice's games, newest first: a win in rapid, a loss in blitz, a draw by correspondence.
const games = [
  fakeChessComGame({ url: 'g1', end_time: 1700000300, time_class: 'rapid', white: white('win'), black: black('resigned') }),
  fakeChessComGame({ url: 'g2', end_time: 1700000200, time_class: 'blitz', white: white('resigned'), black: black('win') }),
  fakeChessComGame({ url: 'g3', end_time: 1700000100, time_class: 'daily', white: white('agreed'), black: black('agreed') }),
]

beforeEach(() => {
  vi.mocked(getRecentGames).mockResolvedValue(games)
  vi.mocked(fetchExplorer).mockResolvedValue(null)
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ScoutingView', () => {
  it('is titled "Préparer un adversaire", like its menu entry', () => {
    render(<ScoutingView />)
    expect(screen.getByRole('heading', { name: 'Préparer un adversaire' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Préparer' })).toBeTruthy()
    expect(screen.queryByText(/scout/i)).toBeNull()
  })

  it('shows the recent form as V / D / N and names the time controls in French', async () => {
    render(<ScoutingView />)
    fireEvent.change(screen.getByPlaceholderText('ex: hikaru'), { target: { value: 'alice' } })
    fireEvent.click(screen.getByRole('button', { name: 'Préparer' }))

    const card = (await waitFor(() => screen.getByText(/Forme récente/))).closest('div')!
    // Same letters as the "1V / 1D / 1N" record, not W / L / D (where "D" would be a draw).
    expect(within(card).getAllByText(/^[VDN]$/).map(e => e.textContent)).toEqual(['V', 'D', 'N'])
    expect(screen.getByText('Rapide')).toBeTruthy()
    expect(screen.getByText('Blitz')).toBeTruthy()
    expect(screen.getByText('Correspondance')).toBeTruthy()
    expect(screen.getByText('Elo moyen adv.')).toBeTruthy()
    // The Lichess explorer panel settles on its "unreachable" message.
    await waitFor(() => expect(screen.getByText(/Lichess injoignable/)).toBeTruthy())
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import PlayersView from './PlayersView'
import { listPlayers } from '../players/storage'

// IndexedDB isn't available under jsdom.
vi.mock('../players/storage', () => ({
  listPlayers: vi.fn(async () => []),
  savePlayer: vi.fn(),
  deletePlayer: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('PlayersView', () => {
  it('is titled "Joueurs (PGN)", like its menu entry, and mentions OTB games in the subtitle', async () => {
    render(<PlayersView />)
    expect(screen.getByRole('heading', { name: 'Joueurs (PGN)' })).toBeTruthy()
    expect(screen.getByText(/parties OTB/)).toBeTruthy()
    // Wait for the stored profiles, so no update lands after the test.
    await waitFor(() => expect(screen.getByText("D'où télécharger des PGN ?")).toBeTruthy())
    expect(vi.mocked(listPlayers)).toHaveBeenCalled()
  })
})

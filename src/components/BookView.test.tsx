import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import BookView from './BookView'
import type { Book, BookProgress } from '../library/types'

// TrainingBoard renders react-chessboard which needs a measured DOM.
// We stub it so the rest of the panel renders.
vi.mock('./TrainingBoard', () => ({
  default: () => <div data-testid="training-board" />,
}))
vi.mock('../audio/sounds', () => ({
  playForMove: () => {}, playSuccess: () => {}, playWrong: () => {},
}))
vi.mock('../api/lichess', () => ({
  fetchTablebase: async () => null,
  tableCategoryLabel: () => '',
  classifyTableMove: () => null,
}))

const mockGetBook = vi.fn()
const mockGetProgress = vi.fn()
const mockRecordOutcome = vi.fn()
vi.mock('../library/storage', () => ({
  getBook: (id: string) => mockGetBook(id),
  getProgress: (id: string) => mockGetProgress(id),
  recordOutcome: (...args: unknown[]) => mockRecordOutcome(...args),
}))

function aBook(): Book {
  return {
    id: 'silman',
    title: 'Reassess Your Chess',
    source: 'pdf',
    importedAt: '2026-01-01T00:00:00Z',
    exercises: [
      {
        id: 'ex-0001', n: 1,
        // Side-to-move is white; e4 is legal.
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        side: 'w', moves: ['e4', 'e5'], firstMoveSan: 'e4',
        chapter: 'Chapitre 1',
      },
    ],
  }
}
function emptyProgress(): BookProgress {
  return { bookId: 'silman', byExercise: {} }
}

beforeEach(() => {
  mockGetBook.mockReset()
  mockGetProgress.mockReset()
  mockRecordOutcome.mockReset()
})
afterEach(cleanup)

describe('BookView', () => {
  it('shows the skeleton while data loads', () => {
    // Never-resolving promise → stays in loading state.
    mockGetBook.mockReturnValue(new Promise(() => {}))
    mockGetProgress.mockReturnValue(new Promise(() => {}))
    const { container } = render(<BookView bookId="silman" onBack={() => {}} />)
    // Skeleton renders animated boxes — match the shimmer arbitrary class.
    expect(container.querySelector('[class*="animate-"]')).toBeTruthy()
  })

  it('shows the error state when the book is not found', async () => {
    mockGetBook.mockResolvedValue(undefined)
    mockGetProgress.mockResolvedValue(emptyProgress())
    render(<BookView bookId="missing" onBack={() => {}} />)
    expect(await screen.findByText(/Livre introuvable/)).toBeTruthy()
    expect(screen.getByText(/missing/)).toBeTruthy()
  })

  it('back button on the error state calls onBack', async () => {
    mockGetBook.mockResolvedValue(undefined)
    mockGetProgress.mockResolvedValue(emptyProgress())
    const onBack = vi.fn()
    render(<BookView bookId="missing" onBack={onBack} />)
    await screen.findByText(/Livre introuvable/)
    fireEvent.click(screen.getByText(/Bibliothèque/))
    expect(onBack).toHaveBeenCalled()
  })

  it('renders the browse mode once the book has loaded', async () => {
    mockGetBook.mockResolvedValue(aBook())
    mockGetProgress.mockResolvedValue(emptyProgress())
    render(<BookView bookId="silman" onBack={() => {}} />)
    expect(await screen.findByTestId('training-board')).toBeTruthy()
    // The book title appears somewhere in the UI.
    await waitFor(() => {
      expect(screen.getByText(/Reassess Your Chess/)).toBeTruthy()
    })
  })

  it('exposes a Rush mode entry point', async () => {
    mockGetBook.mockResolvedValue(aBook())
    mockGetProgress.mockResolvedValue(emptyProgress())
    render(<BookView bookId="silman" onBack={() => {}} />)
    await screen.findByTestId('training-board')
    // The Rush button reads "Rush" — clicking it switches subMode.
    expect(screen.getByText(/Rush/i)).toBeTruthy()
  })
})

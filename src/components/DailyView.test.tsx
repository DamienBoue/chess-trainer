import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import DailyView from './DailyView'
import { mockLocalStorage } from '../test-utils/mockLocalStorage'
import { fakeExercise as fakeExerciseBase } from '../test-utils/fixtures'

beforeEach(() => {
  vi.stubGlobal('localStorage', mockLocalStorage())
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function fakeExercise(id: string, bestMoveSan = 'e4') {
  return fakeExerciseBase(id, { bestMoveSan, bestLineSan: bestMoveSan })
}

describe('DailyView', () => {
  it('shows the empty state when no exercises exist', () => {
    const back = vi.fn()
    render(<DailyView exercises={[]} onGoToGames={back} />)
    expect(screen.getByText(/Pas encore de puzzle quotidien/i)).toBeTruthy()
  })

  it('renders the day puzzle when exercises exist', () => {
    render(<DailyView exercises={[fakeExercise('a')]} />)
    expect(screen.getByText('Puzzle du jour')).toBeTruthy()
    // Streak chip with 🔥.
    expect(screen.getByText(/Série : 0 jour/i)).toBeTruthy()
  })

  it('shows the "Voir la solution" fallback button before solving', () => {
    render(<DailyView exercises={[fakeExercise('a')]} />)
    expect(screen.getByText(/Voir la solution/i)).toBeTruthy()
  })

  it('shows the date string in the header', () => {
    render(<DailyView exercises={[fakeExercise('a')]} />)
    expect(screen.getByText(/20\d{2}-\d{2}-\d{2}/)).toBeTruthy()
  })

  it('renders a category badge for the picked exercise', () => {
    render(<DailyView exercises={[fakeExercise('a')]} />)
    expect(screen.getByText(/Coup raté/i)).toBeTruthy()
  })

  void fireEvent  // imported for future board-interaction tests
})

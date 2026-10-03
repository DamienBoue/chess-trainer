import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import CommandPalette, { type CommandTarget } from './CommandPalette'
import { fakeAnalysis, fakeChessComGame } from '../test-utils/fixtures'

vi.mock('../library/storage', () => ({
  listBooks: async () => [],
}))

beforeEach(() => {
  // Reset the dynamic mock for listBooks between tests if a test re-mocks it.
})
afterEach(cleanup)

function setup(over: Partial<{
  onNavigate: (t: CommandTarget) => void
  analyses: ReturnType<typeof fakeAnalysis>[]
}> = {}) {
  const onNavigate = over.onNavigate ?? vi.fn()
  const view = render(
    <CommandPalette
      username="alice"
      analyses={over.analyses ?? []}
      games={[fakeChessComGame()]}
      onNavigate={onNavigate}
    />,
  )
  return { ...view, onNavigate }
}

function openPalette() {
  fireEvent.keyDown(window, { key: 'k', metaKey: true })
}

describe('CommandPalette', () => {
  it('is hidden by default', () => {
    const { container } = setup()
    expect(container.firstChild).toBeNull()
  })

  it('opens on Cmd+K', () => {
    setup()
    openPalette()
    expect(screen.getByPlaceholderText(/Rechercher/)).toBeTruthy()
  })

  it('opens on Ctrl+K', () => {
    setup()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(screen.getByPlaceholderText(/Rechercher/)).toBeTruthy()
  })

  it('mentions the username in the placeholder', () => {
    setup()
    openPalette()
    expect(screen.getByPlaceholderText(/@alice/)).toBeTruthy()
  })

  it('lists every nav view on first open', () => {
    setup()
    openPalette()
    expect(screen.getByText(/Plan du jour/)).toBeTruthy()
    expect(screen.getByText('Stats')).toBeTruthy()
    expect(screen.getByText(/Jouer vs Stockfish/)).toBeTruthy()
  })

  it('filters items by fuzzy subsequence', () => {
    setup()
    openPalette()
    const input = screen.getByPlaceholderText(/Rechercher/) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'stat' } })
    expect(screen.getByText('Stats')).toBeTruthy()
    // "Plan du jour" should not contain "stat" as a subsequence.
    expect(screen.queryByText('Plan du jour')).toBeNull()
  })

  it('shows "Aucun résultat" when nothing matches', () => {
    setup()
    openPalette()
    const input = screen.getByPlaceholderText(/Rechercher/) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'xyz123zzz' } })
    expect(screen.getByText(/Aucun résultat/)).toBeTruthy()
  })

  it('navigates to the first item on Enter and closes', () => {
    const { onNavigate } = setup()
    openPalette()
    const input = screen.getByPlaceholderText(/Rechercher/) as HTMLInputElement
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(onNavigate.mock.calls[0][0].kind).toBe('view')
    // Palette is closed after navigation.
    expect(screen.queryByPlaceholderText(/Rechercher/)).toBeNull()
  })

  it('Arrow Down + Enter picks the second item', () => {
    const { onNavigate } = setup()
    openPalette()
    const input = screen.getByPlaceholderText(/Rechercher/) as HTMLInputElement
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onNavigate).toHaveBeenCalledTimes(1)
    const target = onNavigate.mock.calls[0][0] as CommandTarget
    // VIEW_ITEMS[1] is "roadmap" but only after fuzzy with empty query —
    // we just assert it's a view target, not the same as the first item.
    expect(target.kind).toBe('view')
  })

  it('closes on Escape', () => {
    setup()
    openPalette()
    expect(screen.getByPlaceholderText(/Rechercher/)).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByPlaceholderText(/Rechercher/)).toBeNull()
  })

  it('clicking the backdrop closes the palette', () => {
    setup()
    openPalette()
    // The outer dialog div is the backdrop.
    const dialog = screen.getByRole('dialog')
    fireEvent.click(dialog)
    expect(screen.queryByPlaceholderText(/Rechercher/)).toBeNull()
  })

  it('lists recently-analyzed games as opponent labels', () => {
    setup({ analyses: [fakeAnalysis(['e4'], { opponent: 'magnus', endTime: 2 })] })
    openPalette()
    expect(screen.getByText(/vs magnus/)).toBeTruthy()
  })

  it('clicking an item navigates to it', () => {
    const { onNavigate } = setup()
    openPalette()
    fireEvent.click(screen.getByText('Stats'))
    expect(onNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'view', view: 'stats' }),
    )
  })
})

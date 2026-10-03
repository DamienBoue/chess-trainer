import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import KeyboardShortcutsModal, { openShortcutsHelp } from './KeyboardShortcutsModal'

afterEach(cleanup)

describe('KeyboardShortcutsModal', () => {
  it('is hidden by default', () => {
    const { container } = render(<KeyboardShortcutsModal />)
    expect(container.firstChild).toBeNull()
  })

  it('opens on ? keypress', () => {
    render(<KeyboardShortcutsModal />)
    fireEvent.keyDown(window, { key: '?' })
    expect(screen.getByText('Raccourcis clavier')).toBeTruthy()
  })

  it('closes on Escape', () => {
    render(<KeyboardShortcutsModal />)
    fireEvent.keyDown(window, { key: '?' })
    expect(screen.getByText('Raccourcis clavier')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText('Raccourcis clavier')).toBeNull()
  })

  it('? again closes the modal (toggle)', () => {
    render(<KeyboardShortcutsModal />)
    fireEvent.keyDown(window, { key: '?' })
    fireEvent.keyDown(window, { key: '?' })
    expect(screen.queryByText('Raccourcis clavier')).toBeNull()
  })

  it('ignores ? while typing in an input', () => {
    render(
      <>
        <input data-testid="text" />
        <KeyboardShortcutsModal />
      </>,
    )
    const input = screen.getByTestId('text')
    fireEvent.keyDown(input, { key: '?' })
    expect(screen.queryByText('Raccourcis clavier')).toBeNull()
  })

  it('ignores ? while typing in a textarea', () => {
    render(
      <>
        <textarea data-testid="ta" />
        <KeyboardShortcutsModal />
      </>,
    )
    const ta = screen.getByTestId('ta')
    fireEvent.keyDown(ta, { key: '?' })
    expect(screen.queryByText('Raccourcis clavier')).toBeNull()
  })

  it('opens via the open-shortcuts event (programmatic opener)', async () => {
    render(<KeyboardShortcutsModal />)
    openShortcutsHelp()
    expect(await screen.findByText('Raccourcis clavier')).toBeTruthy()
  })

  it('lists each section heading', () => {
    render(<KeyboardShortcutsModal />)
    fireEvent.keyDown(window, { key: '?' })
    expect(screen.getByText('Global')).toBeTruthy()
    expect(screen.getByText(/Analyse \/ Lecture de partie/)).toBeTruthy()
    expect(screen.getByText(/Exercices & drills/)).toBeTruthy()
    expect(screen.getByText(/Trainer de calcul/)).toBeTruthy()
  })

  it('closes on backdrop click', () => {
    render(<KeyboardShortcutsModal />)
    fireEvent.keyDown(window, { key: '?' })
    const dialog = screen.getByRole('dialog')
    fireEvent.click(dialog)
    expect(screen.queryByText('Raccourcis clavier')).toBeNull()
  })

  it('inner panel click does NOT close the modal', () => {
    render(<KeyboardShortcutsModal />)
    fireEvent.keyDown(window, { key: '?' })
    fireEvent.click(screen.getByText('Raccourcis clavier'))
    expect(screen.getByText('Raccourcis clavier')).toBeTruthy()
  })

  it('the × button closes the modal', () => {
    render(<KeyboardShortcutsModal />)
    fireEvent.keyDown(window, { key: '?' })
    fireEvent.click(screen.getByLabelText('Fermer'))
    expect(screen.queryByText('Raccourcis clavier')).toBeNull()
  })
})

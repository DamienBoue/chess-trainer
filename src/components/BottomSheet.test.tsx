import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import BottomSheet from './BottomSheet'

afterEach(cleanup)

describe('BottomSheet', () => {
  it('is a modal dialog that takes the focus and closes on Escape before the page sees it', () => {
    const onClose = vi.fn()
    const pageKeys = vi.fn()
    window.addEventListener('keydown', pageKeys)
    render(<BottomSheet title="Filtrer mes parties" onClose={onClose}><button>Tout</button></BottomSheet>)
    const dialog = screen.getByRole('dialog', { name: 'Filtrer mes parties' })
    expect(document.activeElement).toBe(dialog)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(pageKeys).not.toHaveBeenCalled()
    window.removeEventListener('keydown', pageKeys)
  })

  it('closes from the backdrop or ×, not from a tap inside', () => {
    const onClose = vi.fn()
    render(<BottomSheet title="Compte" onClose={onClose}><button>Préférences</button></BottomSheet>)
    fireEvent.click(screen.getByText('Préférences'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('Fermer'))
    fireEvent.click(screen.getByRole('dialog').parentElement!)
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

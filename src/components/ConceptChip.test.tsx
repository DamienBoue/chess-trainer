import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import ConceptChip from './ConceptChip'

afterEach(cleanup)

describe('ConceptChip', () => {
  it('shows the concept title next to 📖 by default', () => {
    render(<ConceptChip id="fork" />)
    expect(screen.getByRole('button').textContent).toContain('Fourchette')
    expect(screen.getByRole('button').textContent).toContain('📖')
  })

  it('renders icon-only when iconOnly=true', () => {
    render(<ConceptChip id="fork" iconOnly />)
    expect(screen.getByRole('button').textContent).toContain('📖')
    expect(screen.getByRole('button').textContent).not.toContain('Fourchette')
  })

  it('respects a custom label', () => {
    render(<ConceptChip id="fork" label="?" />)
    expect(screen.getByRole('button').textContent).toBe('?')
  })

  it('renders nothing for an unknown concept', () => {
    const { container } = render(<ConceptChip id="never-existed" />)
    expect(container.firstChild).toBeNull()
  })

  it('dispatches a concept:open event when clicked', () => {
    const handler = vi.fn()
    window.addEventListener('concept:open', handler)
    render(<ConceptChip id="fork" />)
    fireEvent.click(screen.getByRole('button'))
    expect(handler).toHaveBeenCalled()
    const ev = handler.mock.calls[0][0] as CustomEvent<{ id: string }>
    expect(ev.detail.id).toBe('fork')
    window.removeEventListener('concept:open', handler)
  })

  it('shows the hover preview after a delay, hides on leave', async () => {
    render(<ConceptChip id="fork" />)
    fireEvent.mouseEnter(screen.getByRole('button'))
    // Tooltip not yet shown — within the delay window.
    expect(screen.queryByRole('tooltip')).toBeNull()
    await waitFor(() => {
      expect(screen.getByRole('tooltip').textContent).toContain('attaque simultanément')
    }, { timeout: 800 })
    fireEvent.mouseLeave(screen.getByRole('button'))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})

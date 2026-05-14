import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ChecklistRow from './ChecklistRow'

afterEach(cleanup)

describe('ChecklistRow', () => {
  it('renders the body and shows an empty toggle when not done', () => {
    render(<ChecklistRow done={false} onToggle={() => {}}>hello</ChecklistRow>)
    expect(screen.getByText('hello')).toBeTruthy()
    expect(screen.getByLabelText('Marquer fait')).toBeTruthy()
  })

  it('shows a check mark when done', () => {
    render(<ChecklistRow done onToggle={() => {}}>x</ChecklistRow>)
    expect(screen.getByLabelText('Marquer non fait').textContent).toContain('✓')
  })

  it('fires onToggle on click', () => {
    const toggle = vi.fn()
    render(<ChecklistRow done={false} onToggle={toggle}>x</ChecklistRow>)
    fireEvent.click(screen.getByLabelText('Marquer fait'))
    expect(toggle).toHaveBeenCalled()
  })

  it('blocks the toggle when toggleLocked', () => {
    const toggle = vi.fn()
    render(<ChecklistRow done={false} onToggle={toggle} toggleLocked>x</ChecklistRow>)
    const btn = screen.getByLabelText('Marquer fait') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.title).toMatch(/automatiquement/)
  })

  it('renders the action slot', () => {
    render(
      <ChecklistRow done={false} onToggle={() => {}} action={<button>Go</button>}>
        body
      </ChecklistRow>,
    )
    expect(screen.getByText('Go')).toBeTruthy()
  })
})

import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useFocusOnOpen } from './useFocusOnOpen'

afterEach(cleanup)

function Harness({ open, onClose }: { open: boolean; onClose?: () => void }) {
  const ref = useFocusOnOpen<HTMLDivElement>(open)
  if (!open) return <button data-testid="trigger">trigger</button>
  return (
    <div ref={ref} role="dialog">
      <button data-testid="first">first</button>
      <button data-testid="close" onClick={onClose}>close</button>
    </div>
  )
}

describe('useFocusOnOpen', () => {
  it('focuses the first focusable element when open flips true', async () => {
    const { rerender } = render(<Harness open={false} />)
    const trigger = screen.getByTestId('trigger')
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    rerender(<Harness open={true} />)
    // useEffect + rAF tick — flush both.
    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(() => resolve(null)))
    })
    expect(document.activeElement).toBe(screen.getByTestId('first'))
  })

  it('returns focus to the previously-focused element on close', async () => {
    // Reuses a single tree across open/close so the hook actually sees a
    // state transition (the previous test reset the DOM each time).
    function Modal() {
      const [open, setOpen] = useState(false)
      const ref = useFocusOnOpen<HTMLDivElement>(open)
      return (
        <>
          <button data-testid="trigger" onClick={() => setOpen(true)}>open</button>
          {open && (
            <div ref={ref} role="dialog">
              <button data-testid="close" onClick={() => setOpen(false)}>close</button>
            </div>
          )}
        </>
      )
    }
    render(<Modal />)
    const trigger = screen.getByTestId('trigger')
    trigger.focus()
    fireEvent.click(trigger)
    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(() => resolve(null)))
    })
    expect(document.activeElement).toBe(screen.getByTestId('close'))
    fireEvent.click(screen.getByTestId('close'))
    expect(document.activeElement).toBe(screen.getByTestId('trigger'))
  })

  it('falls back to the container itself when nothing focusable is inside', async () => {
    function Empty() {
      const ref = useFocusOnOpen<HTMLDivElement>(true)
      return <div ref={ref} role="dialog" tabIndex={-1} data-testid="empty-dialog">no buttons</div>
    }
    render(<Empty />)
    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(() => resolve(null)))
    })
    expect(document.activeElement).toBe(screen.getByTestId('empty-dialog'))
  })

  void fireEvent  // keep the import even though we don't use it directly
})

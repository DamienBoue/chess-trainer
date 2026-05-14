import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Tooltip from './Tooltip'

afterEach(cleanup)

describe('Tooltip', () => {
  it('shows nothing initially', () => {
    render(<Tooltip content="hint"><button>trigger</button></Tooltip>)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('shows the tooltip after a hover delay', async () => {
    render(<Tooltip content="hint"><button>trigger</button></Tooltip>)
    fireEvent.mouseEnter(screen.getByText('trigger').parentElement!)
    await waitFor(() => expect(screen.getByRole('tooltip').textContent).toBe('hint'), { timeout: 600 })
  })

  it('hides on mouse leave', async () => {
    render(<Tooltip content="hint"><button>trigger</button></Tooltip>)
    const wrap = screen.getByText('trigger').parentElement!
    fireEvent.mouseEnter(wrap)
    await waitFor(() => expect(screen.getByRole('tooltip')).toBeTruthy(), { timeout: 600 })
    fireEvent.mouseLeave(wrap)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('also reacts to focus / blur', async () => {
    render(<Tooltip content="hint"><button>trigger</button></Tooltip>)
    const wrap = screen.getByText('trigger').parentElement!
    fireEvent.focus(wrap)
    await waitFor(() => expect(screen.getByRole('tooltip')).toBeTruthy(), { timeout: 600 })
    fireEvent.blur(wrap)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})

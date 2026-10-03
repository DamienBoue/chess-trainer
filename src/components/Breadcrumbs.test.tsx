import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import Breadcrumbs from './Breadcrumbs'

afterEach(cleanup)

describe('Breadcrumbs', () => {
  it('renders nothing when there is only one crumb', () => {
    const { container } = render(<Breadcrumbs crumbs={[{ label: 'Home' }]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when crumbs is empty', () => {
    const { container } = render(<Breadcrumbs crumbs={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the trail when there are ≥2 crumbs', () => {
    render(<Breadcrumbs crumbs={[{ label: 'Library' }, { label: 'Silman' }]} />)
    expect(screen.getByText('Library')).toBeTruthy()
    expect(screen.getByText('Silman')).toBeTruthy()
  })

  it('exposes the navigation landmark with a French label', () => {
    render(<Breadcrumbs crumbs={[{ label: 'A' }, { label: 'B' }]} />)
    expect(screen.getByLabelText("Fil d'Ariane")).toBeTruthy()
  })

  it('non-terminal crumbs with onClick render as buttons', () => {
    const onClick = vi.fn()
    render(
      <Breadcrumbs
        crumbs={[
          { label: 'Library', onClick },
          { label: 'Silman' },
        ]}
      />,
    )
    const btn = screen.getByText('Library')
    expect(btn.tagName).toBe('BUTTON')
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('the last crumb is never a button, even if onClick is provided', () => {
    const onClick = vi.fn()
    render(
      <Breadcrumbs
        crumbs={[
          { label: 'Library' },
          { label: 'Silman', onClick },
        ]}
      />,
    )
    const last = screen.getByText('Silman')
    expect(last.tagName).not.toBe('BUTTON')
    fireEvent.click(last)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('crumbs without onClick render as plain spans', () => {
    render(
      <Breadcrumbs
        crumbs={[
          { label: 'Library' },
          { label: 'Silman' },
        ]}
      />,
    )
    expect(screen.getByText('Library').tagName).toBe('SPAN')
  })

  it('inserts a › separator between crumbs but not after the last one', () => {
    render(
      <Breadcrumbs
        crumbs={[
          { label: 'A' }, { label: 'B' }, { label: 'C' },
        ]}
      />,
    )
    const seps = screen.getAllByText('›')
    expect(seps.length).toBe(2)
  })
})

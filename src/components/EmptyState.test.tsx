import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import EmptyState from './EmptyState'

afterEach(cleanup)

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="Pas de données" description="Charge une partie d'abord." />)
    expect(screen.getByText('Pas de données')).toBeTruthy()
    expect(screen.getByText("Charge une partie d'abord.")).toBeTruthy()
  })

  it('renders the optional icon', () => {
    render(<EmptyState icon="📋" title="X" />)
    expect(screen.getByText('📋')).toBeTruthy()
  })

  it('renders a numbered list of steps', () => {
    render(<EmptyState title="X" steps={['Étape 1', 'Étape 2', 'Étape 3']} />)
    expect(screen.getByText('Étape 1')).toBeTruthy()
    expect(screen.getByText('Étape 3')).toBeTruthy()
  })

  it('renders the CTA button and triggers its handler', () => {
    const click = vi.fn()
    render(<EmptyState title="X" cta={{ label: 'Commencer', onClick: click }} />)
    fireEvent.click(screen.getByText('Commencer'))
    expect(click).toHaveBeenCalled()
  })

  it('renders both primary + secondary CTAs', () => {
    const a = vi.fn(); const b = vi.fn()
    render(<EmptyState title="X"
      cta={{ label: 'Primary', onClick: a }}
      secondaryCta={{ label: 'Secondary', onClick: b }}
    />)
    fireEvent.click(screen.getByText('Secondary'))
    expect(b).toHaveBeenCalled()
    expect(a).not.toHaveBeenCalled()
  })

  it('renders children when provided', () => {
    render(<EmptyState title="X"><div data-testid="custom">inline content</div></EmptyState>)
    expect(screen.getByTestId('custom')).toBeTruthy()
  })
})

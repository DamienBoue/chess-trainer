import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import Onboarding from './Onboarding'
import { mockLocalStorage } from '../test-utils/mockLocalStorage'
import { KEYS } from '../storage/keys'

beforeEach(() => {
  vi.stubGlobal('localStorage', mockLocalStorage())
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Onboarding', () => {
  it('shows the first step on a fresh install', () => {
    render(<Onboarding />)
    expect(screen.getByText(/Bienvenue/)).toBeTruthy()
    expect(screen.getByText(/Étape 1/)).toBeTruthy()
  })

  it('advances to the next step on Suivant click', () => {
    render(<Onboarding />)
    fireEvent.click(screen.getByText(/Suivant/))
    expect(screen.getByText(/Étape 2/)).toBeTruthy()
  })

  it('goes back on Précédent click', () => {
    render(<Onboarding />)
    fireEvent.click(screen.getByText(/Suivant/))
    fireEvent.click(screen.getByText(/Précédent/))
    expect(screen.getByText(/Étape 1/)).toBeTruthy()
  })

  it('persists "done" when the user clicks Passer', () => {
    render(<Onboarding />)
    fireEvent.click(screen.getByText('Passer'))
    expect(localStorage.getItem(KEYS.onboardingDone)).toBe('1')
  })

  it('does not render when the user already saw the tour', () => {
    localStorage.setItem(KEYS.onboardingDone, '1')
    const { container } = render(<Onboarding />)
    expect(container.firstChild).toBeNull()
  })

  it('the last step CTA reads "Démarrer" and finishes the tour', () => {
    render(<Onboarding />)
    // Click Suivant N-1 times to reach the last step.
    const total = 6  // matches STEPS.length
    for (let i = 0; i < total - 1; i++) {
      fireEvent.click(screen.getByText(/Suivant/))
    }
    expect(screen.getByText('Démarrer')).toBeTruthy()
    fireEvent.click(screen.getByText('Démarrer'))
    expect(localStorage.getItem(KEYS.onboardingDone)).toBe('1')
  })

  it('responds to arrow keys', () => {
    render(<Onboarding />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText(/Étape 2/)).toBeTruthy()
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText(/Étape 1/)).toBeTruthy()
  })

  it('closes on Escape', () => {
    const { container } = render(<Onboarding />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(container.firstChild).toBeNull()
    expect(localStorage.getItem(KEYS.onboardingDone)).toBe('1')
  })
})

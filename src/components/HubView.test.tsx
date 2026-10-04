import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import HubView from './HubView'
import { hubGroup } from './navModel'

afterEach(cleanup)

describe('HubView', () => {
  it('puts the due exercises first and opens a tool from its card', () => {
    const onNavigate = vi.fn()
    render(<HubView group={hubGroup('trainHub')!} counts={{ analyses: 9, exercises: 20, due: 4 }} onNavigate={onNavigate} />)
    expect(screen.getByText('À faire maintenant')).toBeTruthy()
    expect(screen.getByText('4 exercices à revoir aujourd\'hui')).toBeTruthy()
    expect(screen.getByText('4 à revoir')).toBeTruthy()
    fireEvent.click(screen.getByText('Calcul de séquence'))
    expect(onNavigate).toHaveBeenCalledWith({ view: 'calc' })
  })

  it('explains what an unavailable tool needs instead of hiding it', () => {
    const onNavigate = vi.fn()
    render(<HubView group={hubGroup('theoryHub')!} counts={{ analyses: 1, exercises: 0, due: 0 }} onNavigate={onNavigate} />)
    expect(screen.queryByText('À faire maintenant')).toBeNull()
    const card = screen.getByText('Mon répertoire').closest('button')!
    expect(card.disabled).toBe(true)
    expect(card.textContent).toMatch(/Analyse au moins 3 parties \(1\/3\)/)
    fireEvent.click(screen.getByText('Concepts'))
    expect(onNavigate).toHaveBeenCalledWith({ view: 'concepts' })
  })
})

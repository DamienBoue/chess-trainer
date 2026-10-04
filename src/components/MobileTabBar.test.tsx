import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import MobileTabBar from './MobileTabBar'

afterEach(cleanup)

const counts = { analyses: 4, exercises: 7, due: 3 }

describe('MobileTabBar', () => {
  it('shows the five parts with the due badge on Entraînement', () => {
    render(<MobileTabBar view="home" strategyTab="profile" counts={counts} onNavigate={() => {}} />)
    for (const label of ['Aujourd\'hui', 'Parties', 'Entraînement', 'Théorie', 'Progrès']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
    expect(screen.getByRole('button', { name: 'Entraînement (3 à revoir)' })).toBeTruthy()
    expect(screen.getByText('Aujourd\'hui').closest('button')!.getAttribute('aria-current')).toBe('page')
  })

  it('opens a part on its hub page, never a menu', () => {
    const onNavigate = vi.fn()
    render(<MobileTabBar view="home" strategyTab="profile" counts={counts} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('Parties'))
    expect(onNavigate).toHaveBeenLastCalledWith({ view: 'games' })
    fireEvent.click(screen.getByText('Théorie'))
    expect(onNavigate).toHaveBeenLastCalledWith({ view: 'theoryHub' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('lights the part of the current tool, the hub included', () => {
    const { rerender } = render(<MobileTabBar view="exercises" strategyTab="profile" counts={counts} onNavigate={() => {}} />)
    const current = () => screen.getAllByRole('button').filter(b => b.getAttribute('aria-current') === 'page').map(b => b.textContent)
    expect(current()).toEqual(['Entraînement3'])
    rerender(<MobileTabBar view="strategy" strategyTab="atlas" counts={counts} onNavigate={() => {}} />)
    expect(current()).toEqual(['Théorie'])
    rerender(<MobileTabBar view="progressHub" strategyTab="atlas" counts={counts} onNavigate={() => {}} />)
    expect(current()).toEqual(['Progrès'])
    rerender(<MobileTabBar view="analysis" strategyTab="atlas" counts={counts} onNavigate={() => {}} />)
    expect(current()).toEqual(['Parties'])
  })
})

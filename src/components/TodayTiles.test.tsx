import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import TodayTiles from './TodayTiles'
import { buildGame } from '../analysis/__fixtures__'

afterEach(cleanup)

describe('TodayTiles', () => {
  it('makes each whole card a button', () => {
    const onOpenGame = vi.fn()
    const onNavigate = vi.fn()
    const game = buildGame({ url: 'last', userColor: 'white', moves: [{ ply: 1, san: 'e4', classification: 'blunder', cpLoss: 300 }] })
    render(<TodayTiles analyses={[game]} progress={{}} onOpenGame={onOpenGame} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('Dernière partie'))
    // The last game has a blunder: straight into the guided review.
    expect(screen.getByText('Revoir mes erreurs →')).toBeTruthy()
    expect(onOpenGame).toHaveBeenCalledWith('last', { review: true })
    fireEvent.click(screen.getByText('À réviser'))
    expect(onNavigate).toHaveBeenCalledWith('exercises')
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })
})

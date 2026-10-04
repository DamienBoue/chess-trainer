import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import StrategyView from './StrategyView'
import { analysedGame } from '../strategy/__fixtures__'
import { mockLocalStorage } from '../test-utils/mockLocalStorage'

// react-chessboard measures squares, which jsdom can't do.
vi.mock('./TrainingBoard', () => ({
  default: ({ position }: { position: string }) => <div data-testid="board">{position}</div>,
}))

beforeEach(() => { vi.stubGlobal('localStorage', mockLocalStorage()) })
afterEach(cleanup)

const QGD = 'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7 e3 c6 Bd3 O-O Qc2 Nbd7 Nf3 Re8 O-O Nf8 Rab1 Ne4'
const NAJDORF = 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5 Nb3 Be7 O-O O-O a4 Be6'

const TITLES = ['Profil stratégique', 'Entraîneur stratégique', 'Structures de pions']

/** The page titles currently on screen (each one is the label of a menu entry). */
function shownTitles() {
  return TITLES.filter(t => screen.queryByRole('heading', { name: t }) !== null)
}

describe('StrategyView', () => {
  it('opens on the atlas when there is no analysed game', () => {
    render(<StrategyView analyses={[]} onOpenGame={() => {}} />)
    expect(shownTitles()).toEqual(['Structures de pions'])
    expect(screen.getAllByText('Pion dame isolé (IQP)').length).toBeGreaterThan(0)
    expect(screen.getByText(/Plans des Blancs/)).toBeTruthy()
  })

  it('shows the title of the current tab, and only that one', () => {
    const { rerender } = render(<StrategyView analyses={[]} onOpenGame={() => {}} tab="profile" />)
    expect(shownTitles()).toEqual(['Profil stratégique'])
    rerender(<StrategyView analyses={[]} onOpenGame={() => {}} tab="trainer" />)
    expect(shownTitles()).toEqual(['Entraîneur stratégique'])
    rerender(<StrategyView analyses={[]} onOpenGame={() => {}} tab="atlas" />)
    expect(shownTitles()).toEqual(['Structures de pions'])
    // The old hub title is gone: each page is named by its menu entry.
    expect(screen.queryByRole('heading', { name: 'Stratégie' })).toBeNull()
  })

  it('renders no tab strip: the three pages are reached from the menu', () => {
    const { rerender } = render(<StrategyView analyses={[]} onOpenGame={() => {}} tab="profile" />)
    for (const tab of ['profile', 'trainer', 'atlas'] as const) {
      rerender(<StrategyView analyses={[]} onOpenGame={() => {}} tab={tab} />)
      expect(screen.queryByRole('tablist')).toBeNull()
      expect(screen.queryAllByRole('tab')).toHaveLength(0)
      for (const old of ['Mon profil', "S'entraîner", 'Structures']) {
        expect(screen.queryByRole('button', { name: old })).toBeNull()
      }
    }
  })

  it('gives each page its own one-line description', () => {
    const { rerender } = render(<StrategyView analyses={[]} onOpenGame={() => {}} tab="profile" />)
    expect(screen.getByText(/tes plans manqués/)).toBeTruthy()
    rerender(<StrategyView analyses={[]} onOpenGame={() => {}} tab="trainer" />)
    expect(screen.getByText(/Quel plan \? Quelle case forte/)).toBeTruthy()
    rerender(<StrategyView analyses={[]} onOpenGame={() => {}} tab="atlas" />)
    expect(screen.getByText(/leurs plans types et leurs cases clés/)).toBeTruthy()
  })

  it('points the empty profile to the atlas, through the tab callback', () => {
    const onTabChange = vi.fn()
    render(<StrategyView analyses={[]} onOpenGame={() => {}} tab="profile" onTabChange={onTabChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'structures de pions' }))
    expect(onTabChange).toHaveBeenCalledWith('atlas')
  })

  it('switches the atlas to the other side\'s plans', () => {
    render(<StrategyView analyses={[]} onOpenGame={() => {}} />)
    fireEvent.click(screen.getAllByText('Structure Carlsbad')[0])
    fireEvent.click(screen.getByText('Plans des Noirs'))
    expect(screen.getByText(/les Noirs sont le camp à la majorité aile dame/)).toBeTruthy()
  })

  it('builds the profile from the games and links back to them', async () => {
    const games = [
      { ...analysedGame(QGD, { userColor: 'white' }), url: 'g1', result: 'loss' as const },
      { ...analysedGame(NAJDORF, { costs: { 17: { cpLoss: 90, best: 'Nd5' } } }), url: 'g2', result: 'loss' as const },
    ]
    const onOpenGame = vi.fn()
    render(<StrategyView analyses={games} onOpenGame={onOpenGame} />)
    expect(await screen.findByText('Tes structures')).toBeTruthy()
    expect(screen.getAllByText('Structure Carlsbad').length).toBeGreaterThan(0)
    fireEvent.click(await screen.findByText(/vs opp · coup 9/))
    expect(onOpenGame).toHaveBeenCalledWith('g2', 16)
  })

  it('opens a structure of the profile in the atlas, and offers the way back', async () => {
    const games = [
      { ...analysedGame(QGD, { userColor: 'white' }), url: 'g1', result: 'loss' as const },
      { ...analysedGame(NAJDORF, { costs: { 17: { cpLoss: 90, best: 'Nd5' } } }), url: 'g2', result: 'loss' as const },
    ]
    const onTabChange = vi.fn()
    render(<StrategyView analyses={games} onOpenGame={() => {}} onTabChange={onTabChange} />)
    expect(shownTitles()).toEqual(['Profil stratégique'])
    await screen.findByText('Tes structures')
    fireEvent.click(screen.getAllByRole('button', { name: 'Structure Carlsbad' })[0])
    expect(onTabChange).toHaveBeenLastCalledWith('atlas')
    expect(shownTitles()).toEqual(['Structures de pions'])
    expect(screen.getByRole('heading', { name: 'Structure Carlsbad' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Retour au profil stratégique/ }))
    expect(onTabChange).toHaveBeenLastCalledWith('profile')
    expect(shownTitles()).toEqual(['Profil stratégique'])
  })

  it('drops the way back once the atlas is left: its own menu entry opens it fresh', async () => {
    const games = [
      { ...analysedGame(QGD, { userColor: 'white' }), url: 'g1', result: 'loss' as const },
    ]
    const props = { analyses: games, onOpenGame: () => {} }
    // The app drives the tab: it follows `onTabChange` with its own state.
    const { rerender } = render(<StrategyView {...props} tab="profile" onTabChange={() => {}} />)
    await screen.findByText('Tes structures')
    fireEvent.click(screen.getAllByRole('button', { name: 'Structure Carlsbad' })[0])
    rerender(<StrategyView {...props} tab="atlas" onTabChange={() => {}} />)
    expect(screen.getByRole('button', { name: /Retour au profil stratégique/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Structure Carlsbad' })).toBeTruthy()

    rerender(<StrategyView {...props} tab="trainer" onTabChange={() => {}} />)
    rerender(<StrategyView {...props} tab="atlas" onTabChange={() => {}} />)
    expect(shownTitles()).toEqual(['Structures de pions'])
    expect(screen.queryByRole('button', { name: /Retour au profil stratégique/ })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Pion dame isolé (IQP)' })).toBeTruthy()
  })

  it('runs a trainer question and records the answer', async () => {
    const onOpenGame = vi.fn()
    render(<StrategyView analyses={[]} onOpenGame={onOpenGame} tab="trainer" />)
    expect(await screen.findByText(/Question 1\//)).toBeTruthy()
    const choices = screen.getAllByRole('button').filter(b => b.className.includes('w-full text-left text-sm px-3'))
    fireEvent.click(choices[0])
    expect(screen.getByText(/Bien vu|Pas tout à fait/)).toBeTruthy()
    fireEvent.click(screen.getByText('Suivant →'))
    expect(screen.getByText(/Question 2\//)).toBeTruthy()
  })
})

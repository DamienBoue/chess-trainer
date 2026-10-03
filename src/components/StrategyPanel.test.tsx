import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import StrategyPanel from './StrategyPanel'
import { buildStrategyOverlay, EMPTY_OVERLAY } from './strategyBoard'
import { analyzePosition } from '../strategy/report'
import { POSITIONS } from '../strategy/__fixtures__'
import { DEFAULT_STRATEGY_OVERLAYS } from '../storage/strategyPrefs'
import { mockLocalStorage } from '../test-utils/mockLocalStorage'

beforeEach(() => { vi.stubGlobal('localStorage', mockLocalStorage()) })
afterEach(cleanup)

describe('StrategyPanel', () => {
  it('shows structure, centre and plans for the user', () => {
    render(<StrategyPanel fen={POSITIONS.najdorf} userColor="white" onOverlay={() => {}} />)
    expect(screen.getByText('Lecture stratégique')).toBeTruthy()
    expect(screen.getAllByText(/Trou d5/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Plans pour toi/)).toBeTruthy()
    expect(screen.getByText(/Installe un cavalier en d5/)).toBeTruthy()
    expect(screen.getByText(/Ce que cherche l'adversaire/)).toBeTruthy()
  })

  it('switches to the opponent\'s point of view', () => {
    render(<StrategyPanel fen={POSITIONS.najdorf} userColor="white" onOverlay={() => {}} />)
    fireEvent.click(screen.getByText(/Adversaire \(Noirs\)/))
    expect(screen.getByText(/Plans pour l'adversaire/)).toBeTruthy()
    expect(screen.getByText('Ses faiblesses')).toBeTruthy()
    expect(screen.getByText(/Pion arriéré en d6/)).toBeTruthy()
  })

  it('cross-checks the engine move with the plans', () => {
    render(<StrategyPanel fen={POSITIONS.najdorf} userColor="white" engineBestSan="Nd5" playedSan="a4" onOverlay={() => {}} />)
    expect(screen.getByText(/Le moteur joue ici/)).toBeTruthy()
    expect(screen.getByText(/dans l'esprit du plan « Installe un cavalier en d5 »/)).toBeTruthy()
    expect(screen.getByText('✓ moteur')).toBeTruthy()
    expect(screen.getByText(/ne suit aucun des plans détectés/)).toBeTruthy()
  })

  it('pushes board overlays and clears them on unmount', () => {
    const onOverlay = vi.fn()
    const { unmount } = render(<StrategyPanel fen={POSITIONS.najdorf} userColor="white" onOverlay={onOverlay} />)
    const last = onOverlay.mock.calls.at(-1)![0]
    expect(Object.keys(last.squareStyles)).toContain('d5')
    unmount()
    expect(onOverlay.mock.calls.at(-1)![0]).toEqual(EMPTY_OVERLAY)
  })

  it('remembers overlay toggles', () => {
    render(<StrategyPanel fen={POSITIONS.najdorf} userColor="white" onOverlay={() => {}} />)
    fireEvent.click(screen.getByText('Cases fortes'))
    cleanup()
    render(<StrategyPanel fen={POSITIONS.najdorf} userColor="white" onOverlay={() => {}} />)
    expect(screen.getByText('Cases fortes').closest('button')!.getAttribute('aria-pressed')).toBe('false')
  })

  it('renders nothing for an invalid FEN', () => {
    const { container } = render(<StrategyPanel fen="not a fen" userColor="white" onOverlay={() => {}} />)
    expect(container.textContent).toBe('')
  })
})

describe('buildStrategyOverlay', () => {
  it('tints strong and weak squares and draws the plan arrows', () => {
    const r = analyzePosition(POSITIONS.najdorf)
    const plan = r.plans.w.find(p => p.kind === 'outpost')!
    const o = buildStrategyOverlay(r, 'w', DEFAULT_STRATEGY_OVERLAYS, plan, null)
    expect(o.squareStyles.d5.boxShadow).toContain('inset')
    expect(o.arrows.at(-1)?.endSquare).toBe('d5')
  })

  it('respects disabled overlays and shows the opponent\'s plan in violet', () => {
    const r = analyzePosition(POSITIONS.najdorf)
    const none = { strong: false, weak: false, pawns: false, plans: false, engineArrow: false }
    expect(buildStrategyOverlay(r, 'w', none, r.plans.w[0], null)).toEqual(EMPTY_OVERLAY)
    const theirs = r.plans.b.find(p => p.arrows.length > 0)
    if (theirs) {
      const o = buildStrategyOverlay(r, 'w', { ...none, plans: true }, theirs, null)
      expect(o.arrows[0].color).toContain('167, 139, 250')
    }
  })

  it('rings focused squares', () => {
    const r = analyzePosition(POSITIONS.najdorf)
    const none = { strong: false, weak: false, pawns: false, plans: false, engineArrow: false }
    const o = buildStrategyOverlay(r, 'w', none, null, [43])
    expect(Object.keys(o.squareStyles)).toEqual(['d6'])
  })
})

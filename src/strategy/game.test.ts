import { describe, expect, it } from 'vitest'
import { reviewGameStrategy } from './game'
import { analysedGame } from './__fixtures__'
import { sqName } from './board'

const RUY_EXCHANGE = 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4 exd4 Nxd4 c5 Nb3 Qxd1 Rxd1'
const PANOV = 'e4 c6 d4 d5 exd5 cxd5 c4 Nf6 Nc3 e6 Nf3 Be7 cxd5 Nxd5 Bd3 Nc6 O-O O-O Re1'
const NAJDORF = 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5 Nb3 Be7 O-O O-O a4 Be6'
const QGD_EXCHANGE = 'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7 e3 c6 Bd3 O-O Qc2 Nbd7 Nf3 Re8 O-O Nf8 Rab1 Ne4'

describe('reviewGameStrategy', () => {
  it('Exchange Ruy Lopez: White gives up the bishop pair, Black gets doubled c-pawns', () => {
    const r = reviewGameStrategy(analysedGame(RUY_EXCHANGE))
    const pair = r.events.find(e => e.kind === 'bishop-pair')!
    expect(pair.side).toBe('w')
    expect(pair.ply).toBe(7)
    const doubled = r.events.find(e => e.kind === 'doubled')!
    expect(doubled.side).toBe('b')
    expect(doubled.squares.map(sqName).sort()).toEqual(['c6', 'c7'])
    // Not judged costly by the engine → informative, not a mistake.
    expect(doubled.polarity).toBe('info')
  })

  it('Panov: the isolated d4 pawn appears with cxd5', () => {
    const r = reviewGameStrategy(analysedGame(PANOV))
    const iso = r.events.find(e => e.kind === 'isolated' && e.side === 'w')!
    expect(iso.ply).toBe(13)
    expect(iso.squares.map(sqName)).toEqual(['d4'])
    expect(r.structures.some(s => s.id === 'iqp' && s.sideA === 'w')).toBe(true)
  })

  it('flags a missed outpost plan when the engine wanted Nd5 and the move cost value', () => {
    const r = reviewGameStrategy(analysedGame(NAJDORF, { costs: { 17: { cpLoss: 90, best: 'Nd5' } } }))
    const missed = r.events.find(e => e.kind === 'missed-plan')!
    expect(missed.ply).toBe(17)
    expect(missed.title).toContain('d5')
    expect(missed.focusPly).toBe(16)
    expect(r.lessons[0]).toContain('Nd5')
  })

  it('does not flag cheap moves as missed plans', () => {
    const r = reviewGameStrategy(analysedGame(NAJDORF, { costs: { 17: { cpLoss: 20, best: 'Nd5' } } }))
    expect(r.events.some(e => e.kind === 'missed-plan')).toBe(false)
  })

  it('tracks the Carlsbad structure over time and names it as the main structure', () => {
    const r = reviewGameStrategy(analysedGame(QGD_EXCHANGE, { userColor: 'black' }))
    const seg = r.structures.find(s => s.id === 'carlsbad')!
    expect(seg.fromPly).toBe(12)
    expect(seg.toPly).toBe(22)
    expect(r.mainStructure).toMatchObject({ id: 'carlsbad', userRole: 'B' })
    expect(r.centers.length).toBeGreaterThan(0)
    expect(r.lessons.some(l => l.includes('Carlsbad'))).toBe(true)
  })

  it('handles an empty game', () => {
    expect(reviewGameStrategy({ ...analysedGame('e4'), moves: [] }).events).toEqual([])
  })
})

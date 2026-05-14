import { describe, expect, it } from 'vitest'
import { detectThreats } from './threats'

describe('detectThreats', () => {
  it('returns no threats in the starting position (everything defended)', () => {
    expect(detectThreats('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'w')).toEqual([])
  })

  it('flags a hanging piece (0 defenders)', () => {
    // White rook on e4, undefended, attacked by black bishop on a8 (via b7-a8 diagonal — not).
    // Cleaner setup: black rook on e8 looking down at a hanging white rook on e4.
    const t = detectThreats('4r3/8/8/8/4R3/8/8/4K2k w - - 0 1', 'w')
    const rookThreat = t.find(x => x.pieceType === 'r' && x.square === 'e4')
    expect(rookThreat).toBeTruthy()
    expect(rookThreat?.defenders).toBe(0)
    expect(rookThreat?.delta).toBe(5)
  })

  it('returns king-in-check as the top threat (delta=100)', () => {
    // White king e1 in check from black rook on e8.
    const t = detectThreats('4r3/8/8/8/8/8/8/4K2k w - - 0 1', 'w')
    expect(t[0].pieceType).toBe('k')
    expect(t[0].delta).toBe(100)
  })

  it('ignores defended pieces under equal attack', () => {
    // White knight on c3 attacked by black bishop f6 + defended by white pawn b2.
    const t = detectThreats('rnbqkbnr/ppp2ppp/4pn2/3p4/8/2N5/PP1PPPPP/R1BQKBNR w KQkq - 0 1', 'w')
    expect(t.find(x => x.square === 'c3')).toBeUndefined()
  })

  it('sorts threats by delta descending', () => {
    // Mix of small and big hanging pieces. Pawns must not be on rank 1/8.
    const t = detectThreats('q3rk2/8/8/8/8/3P4/8/2B1R1BK w - - 0 1', 'w')
    for (let i = 1; i < t.length; i++) {
      expect(t[i - 1].delta).toBeGreaterThanOrEqual(t[i].delta)
    }
  })
})

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

  it('estimates loss = value − cheapest attacker when attackers > defenders', () => {
    // White rook on e4. Defenders: white knight on c5 (defends e4? no: knight on c5
    // covers d7, e6, d3, b3, a4, a6, e4? — yes Nc5 attacks e4 via the knight L).
    // Actually knight c5 attacks: a4, a6, b3, b7, d3, d7, e4, e6 → defends e4. ✓
    // Attackers on e4: black rook a4 (file? no, rank 4 — a4..h4), bishop a8 (diagonal a8-h1 → e4 yes).
    // 2 attackers (rook + bishop), 1 defender (knight). attackers > defenders.
    // Cheapest attacker = bishop (3), our rook = 5. delta = 5 - 3 = 2.
    const t = detectThreats('b7/8/8/2N5/r3R3/8/8/4K2k w - - 0 1', 'w')
    const rook = t.find(x => x.square === 'e4')
    expect(rook).toBeTruthy()
    expect(rook?.attackers).toBeGreaterThan(rook?.defenders ?? 0)
    expect(rook?.delta).toBe(2)
  })

  it('does NOT flag a piece when delta is 0 (equal trade, no king check)', () => {
    // Two same-value pieces trading evenly: defender as cheap as attacker.
    // Rook on e4, attacker rook a4, defender rook e1: 1 vs 1 attackers→ doesn't trigger.
    const t = detectThreats('r3k3/8/8/8/r3R3/8/8/4R2K w - - 0 1', 'w')
    expect(t.find(x => x.square === 'e4')).toBeUndefined()
  })

  it('flags only the user\'s pieces, never the opponent\'s hanging pieces', () => {
    // Black hanging rook on h7; we ask from white's POV.
    const t = detectThreats('4k3/7r/8/8/8/8/8/4K3 w - - 0 1', 'w')
    expect(t.find(x => x.square === 'h7')).toBeUndefined()
  })

  it('works when the user is Black', () => {
    // Black rook on e5 hangs, attacked by a white rook on e1, no defender.
    const t = detectThreats('4k3/8/8/4r3/8/8/8/4R2K b - - 0 1', 'b')
    const rook = t.find(x => x.square === 'e5')
    expect(rook).toBeTruthy()
    expect(rook?.defenders).toBe(0)
    expect(rook?.delta).toBe(5)
  })
})

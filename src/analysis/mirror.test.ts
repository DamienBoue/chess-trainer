import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { mirrorFen, mirrorMoves, mirrorSan } from './mirror'

describe('mirrorFen', () => {
  it('is an involution on the starting position', () => {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    // Color-flip starting position = starting position with stm flipped.
    // Then mirroring again returns the exact start.
    expect(mirrorFen(mirrorFen(start))).toBe(start)
  })

  it('swaps side-to-move', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    expect(mirrorFen(fen).split(' ')[1]).toBe('b')
  })

  it('preserves a legal FEN (parseable by chess.js)', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1'
    const m = mirrorFen(fen)
    expect(() => new Chess(m)).not.toThrow()
  })

  it('flips ranks (1↔8) and swaps piece case', () => {
    // After 1.e4 e5: position has white pawn on e4, black pawn on e5.
    // After mirror: black pawn on e5 (was e4) becomes white on e4? Wait.
    // Standard "mirror" puts the white pieces on the top. Let's check.
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
    const m = mirrorFen(fen)
    // After mirror, side-to-move is black.
    expect(m.split(' ')[1]).toBe('b')
    // Mirroring twice returns the original.
    expect(mirrorFen(m)).toBe(fen)
  })

  it('swaps castling rights case and re-sorts in KQkq order', () => {
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w Kq - 0 1'
    // K (white kingside) swaps to k (black kingside).
    // q (black queenside) swaps to Q (white queenside).
    // Sorted in KQkq order: "Qk".
    const m = mirrorFen(fen)
    expect(m.split(' ')[2]).toBe('Qk')
  })

  it('handles missing castling rights', () => {
    const fen = '8/8/8/8/8/8/8/8 w - - 0 1'
    expect(mirrorFen(fen).split(' ')[2]).toBe('-')
  })

  it('flips the en-passant rank but keeps the file', () => {
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2'
    expect(mirrorFen(fen).split(' ')[3]).toBe('e3')
  })

  it('passes en-passant "-" through unchanged', () => {
    const fen = '8/8/8/8/8/8/8/8 w KQkq - 0 1'
    expect(mirrorFen(fen).split(' ')[3]).toBe('-')
  })

  it('preserves halfmove and fullmove counters', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 7 42'
    const m = mirrorFen(fen)
    expect(m.split(' ').slice(4)).toEqual(['7', '42'])
  })

  it('throws on a malformed FEN with fewer than 4 fields', () => {
    expect(() => mirrorFen('rnbqkbnr/...')).toThrow()
  })

  it('mirrors a known asymmetric position correctly', () => {
    // White king on e1, black king on e8, white pawn on h2.
    const fen = '4k3/8/8/8/8/8/7P/4K3 w - - 0 1'
    const m = mirrorFen(fen)
    // After mirror: black king on e8 (flipped to e1 → board top), white king on e1 (flipped → e8).
    // White pawn on h2 → black pawn on h7.
    // Side-to-move flips to black.
    expect(m).toBe('4k3/7p/8/8/8/8/8/4K3 b - - 0 1')
  })
})

describe('mirrorSan', () => {
  it('flips ranks: e4 → e5', () => {
    expect(mirrorSan('e4')).toBe('e5')
  })

  it('flips Knight ranks: Nf3 → Nf6', () => {
    expect(mirrorSan('Nf3')).toBe('Nf6')
  })

  it('flips capture ranks: exd5 → exd4', () => {
    expect(mirrorSan('exd5')).toBe('exd4')
  })

  it('flips promotion ranks: e8=Q → e1=Q', () => {
    expect(mirrorSan('e8=Q')).toBe('e1=Q')
  })

  it('preserves castling notation: O-O', () => {
    expect(mirrorSan('O-O')).toBe('O-O')
  })

  it('preserves long castling notation: O-O-O', () => {
    expect(mirrorSan('O-O-O')).toBe('O-O-O')
  })

  it('preserves check + mate markers: Qxh7+ → Qxh2+', () => {
    expect(mirrorSan('Qxh7+')).toBe('Qxh2+')
    expect(mirrorSan('Qh7#')).toBe('Qh2#')
  })

  it('flips disambiguation digits: R1e1 → R8e8', () => {
    expect(mirrorSan('R1e1')).toBe('R8e8')
  })

  it('preserves file disambiguation: Nbd2 → Nbd7', () => {
    expect(mirrorSan('Nbd2')).toBe('Nbd7')
  })
})

describe('mirrorMoves', () => {
  it('mirrors every move in a sequence', () => {
    expect(mirrorMoves(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']))
      .toEqual(['e5', 'e4', 'Nf6', 'Nc3', 'Bc5', 'Bc4'])
  })

  it('produces a SAN sequence that chess.js can replay from the mirrored start', () => {
    // 1.e4 e5 2.Nf3 Nc6 3.Bc4 — Italian.
    const sans = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']
    const mirrored = mirrorMoves(sans)
    const c = new Chess(mirrorFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'))
    for (const m of mirrored) {
      expect(() => c.move(m)).not.toThrow()
    }
    expect(mirrored).toEqual(['e5', 'e4', 'Nf6', 'Nc3', 'Bc5'])
  })
})

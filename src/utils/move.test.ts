import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { autoPromotion, tryUserMove, cleanSan, sanMatches, positionKey } from './move'

describe('autoPromotion', () => {
  it('returns undefined when piece is missing', () => {
    expect(autoPromotion(undefined, 'e8')).toBeUndefined()
  })

  it('returns undefined for non-pawns', () => {
    expect(autoPromotion({ pieceType: 'wN' }, 'e8')).toBeUndefined()
    expect(autoPromotion({ pieceType: 'bQ' }, 'e1')).toBeUndefined()
  })

  it('returns "q" for a pawn reaching rank 1 or 8', () => {
    expect(autoPromotion({ pieceType: 'wP' }, 'e8')).toBe('q')
    expect(autoPromotion({ pieceType: 'bP' }, 'e1')).toBe('q')
  })

  it('returns undefined for a pawn moving to a middle rank', () => {
    expect(autoPromotion({ pieceType: 'wP' }, 'e4')).toBeUndefined()
  })
})

describe('tryUserMove', () => {
  it('applies a legal move and returns the Move object', () => {
    const c = new Chess()
    const mv = tryUserMove(c, { sourceSquare: 'e2', targetSquare: 'e4' })
    expect(mv?.san).toBe('e4')
    // After 1.e4 it's Black to move; the position should reflect that.
    expect(c.fen().startsWith('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b')).toBe(true)
  })

  it('returns null on illegal move', () => {
    const c = new Chess()
    expect(tryUserMove(c, { sourceSquare: 'e2', targetSquare: 'e5' })).toBeNull()
  })

  it('returns null when target square is null', () => {
    const c = new Chess()
    expect(tryUserMove(c, { sourceSquare: 'e2', targetSquare: null })).toBeNull()
  })

  it('handles promotion automatically when pawn reaches last rank', () => {
    // Legal setup: white K e1, black K e8 area would be illegal vis-à-vis
    // the promoting pawn; put black king far away.
    const c = new Chess('8/4P3/8/8/8/8/8/4K2k w - - 0 1')
    const mv = tryUserMove(c, { sourceSquare: 'e7', targetSquare: 'e8', piece: { pieceType: 'wP' } })
    expect(mv?.san).toMatch(/^e8=Q/)
  })
})

describe('cleanSan', () => {
  it('strips trailing annotation marks', () => {
    expect(cleanSan('Nf3!')).toBe('Nf3')
    expect(cleanSan('Qxh7!!')).toBe('Qxh7')
    expect(cleanSan('Bg5?!')).toBe('Bg5')
    expect(cleanSan('e4')).toBe('e4')
  })

  it('keeps check/mate suffixes', () => {
    expect(cleanSan('Qh5+')).toBe('Qh5+')
    expect(cleanSan('Qh5#')).toBe('Qh5#')
  })
})

describe('sanMatches', () => {
  it('matches identical SAN', () => {
    expect(sanMatches('Nf3', 'Nf3')).toBe(true)
  })

  it('ignores annotation marks', () => {
    expect(sanMatches('Nf3!', 'Nf3')).toBe(true)
    expect(sanMatches('Nf3', 'Nf3!?')).toBe(true)
  })

  it('ignores check/mate suffixes', () => {
    expect(sanMatches('Qh5+', 'Qh5')).toBe(true)
    expect(sanMatches('Qh5#', 'Qh5')).toBe(true)
  })

  it('does not match different moves', () => {
    expect(sanMatches('Nf3', 'Nc3')).toBe(false)
  })
})

describe('positionKey', () => {
  it('strips halfmove + fullmove counters', () => {
    const fen1 = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const fen2 = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 42 99'
    expect(positionKey(fen1)).toBe(positionKey(fen2))
  })

  it('preserves placement / side / castling / en-passant', () => {
    const key = positionKey('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1')
    expect(key).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3')
  })
})

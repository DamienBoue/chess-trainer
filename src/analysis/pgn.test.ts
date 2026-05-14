import { describe, expect, it } from 'vitest'
import { parsePgnHeaders, extractMoves, getUserSide, getResultForUser } from './pgn'
import type { ChessComGame } from '../types'

const SAMPLE_PGN = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2024.01.15"]
[White "alice"]
[Black "bob"]
[Result "1-0"]
[ECO "C50"]
[ECOUrl "https://www.chess.com/openings/Italian-Game"]
[Termination "alice won by resignation"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. d3 Nf6 1-0`

const SAMPLE_GAME = {
  url: 'https://chess.com/game/x',
  pgn: SAMPLE_PGN,
  time_control: '600',
  end_time: 1700000000,
  rated: true,
  time_class: 'rapid',
  rules: 'chess',
  white: { rating: 1500, result: 'win',      '@id': '', username: 'alice' },
  black: { rating: 1480, result: 'resigned', '@id': '', username: 'bob' },
} as unknown as ChessComGame

describe('parsePgnHeaders', () => {
  it('reads the basic 7 tags', () => {
    const h = parsePgnHeaders(SAMPLE_PGN)
    expect(h.white).toBe('alice')
    expect(h.black).toBe('bob')
    expect(h.result).toBe('1-0')
    expect(h.eco).toBe('C50')
    expect(h.termination).toContain('resignation')
  })

  it('derives a readable opening from ECOUrl', () => {
    const h = parsePgnHeaders(SAMPLE_PGN)
    expect(h.opening).toBe('Italian Game')
  })

  it('returns empty strings + undefined for a header-less PGN', () => {
    const h = parsePgnHeaders('1. e4 e5 *')
    expect(h.white).toBe('')
    expect(h.result).toBe('*')
    expect(h.eco).toBeUndefined()
  })
})

describe('getUserSide', () => {
  it('matches white username (case-insensitive)', () => {
    expect(getUserSide(SAMPLE_GAME, 'ALICE')).toBe('white')
  })

  it('matches black username', () => {
    expect(getUserSide(SAMPLE_GAME, 'bob')).toBe('black')
  })

  it('defaults to black for unknown usernames', () => {
    expect(getUserSide(SAMPLE_GAME, 'charlie')).toBe('black')
  })
})

describe('getResultForUser', () => {
  it('returns win for the winning side', () => {
    expect(getResultForUser(SAMPLE_GAME, 'alice')).toBe('win')
  })

  it('returns loss for the side that resigned/timed-out/etc', () => {
    expect(getResultForUser(SAMPLE_GAME, 'bob')).toBe('loss')
  })

  it('returns draw for neutral outcomes', () => {
    const drawn = {
      ...SAMPLE_GAME,
      white: { ...SAMPLE_GAME.white, result: 'agreed' },
      black: { ...SAMPLE_GAME.black, result: 'agreed' },
    } as unknown as ChessComGame
    expect(getResultForUser(drawn, 'alice')).toBe('draw')
  })
})

describe('extractMoves', () => {
  it('returns one entry per played move with consistent before/after FENs', () => {
    const moves = extractMoves(SAMPLE_PGN)
    expect(moves.length).toBe(8)
    expect(moves[0].san).toBe('e4')
    expect(moves[0].fenBefore).toMatch(/^rnbqkbnr\/pppppppp\/.*w/)
    expect(moves[0].fenAfter).not.toBe(moves[0].fenBefore)
    // Chained: each move's fenBefore equals previous move's fenAfter.
    for (let i = 1; i < moves.length; i++) {
      expect(moves[i].fenBefore).toBe(moves[i - 1].fenAfter)
    }
  })

  it('numbers plies starting at 1', () => {
    const moves = extractMoves(SAMPLE_PGN)
    expect(moves[0].ply).toBe(1)
    expect(moves[1].ply).toBe(2)
    expect(moves.at(-1)?.ply).toBe(moves.length)
  })

  it('produces a UCI string for each move', () => {
    const moves = extractMoves(SAMPLE_PGN)
    expect(moves[0].uci).toBe('e2e4')
    expect(moves[2].uci).toBe('g1f3')
  })
})

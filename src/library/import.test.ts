// Tests the book validator + audits every bundled book json file.
// Catches: illegal positions, opponent-in-check FENs, illegal curated
// moves — the exact class of bugs that shipped in the Finales pack
// before this test existed.

import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { validateBookJson } from './import'

const BOOKS_DIR = join(process.cwd(), 'public', 'books')

function listBundledBookFiles(): string[] {
  if (!existsSync(BOOKS_DIR)) return []
  return readdirSync(BOOKS_DIR).filter(f => f.endsWith('.book.json'))
}

describe('validateBookJson', () => {
  it('rejects an empty object', () => {
    expect(() => validateBookJson({})).toThrow()
  })

  it('rejects when exercises is missing', () => {
    expect(() => validateBookJson({ title: 'x' })).toThrow()
  })

  it('strips exercises with illegal opponent-in-check positions', () => {
    // FEN: white to move, but the BLACK king on d7 is attacked by the
    // white rook on d1. Should be filtered.
    const raw = {
      title: 'illegal-pos',
      exercises: [
        { id: 'good', fen: '8/4k3/8/8/8/8/r3P1K1/3R4 w - - 0 1', firstMoveSan: 'Kg3' },
        { id: 'bad',  fen: '8/3k4/8/8/8/8/r3P1K1/3R4 w - - 0 1', firstMoveSan: 'Kg3' },
      ],
    }
    const book = validateBookJson(raw)
    expect(book.exercises.map(e => e.id)).toEqual(['good'])
  })

  it('strips exercises whose firstMoveSan is not a legal move', () => {
    const raw = {
      title: 'illegal-move',
      exercises: [
        { id: 'good',   fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', firstMoveSan: 'e4' },
        { id: 'no-uci', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', firstMoveSan: 'e9' },
      ],
    }
    const book = validateBookJson(raw)
    expect(book.exercises.map(e => e.id)).toEqual(['good'])
  })

  it('throws when nothing legal remains', () => {
    expect(() =>
      validateBookJson({
        title: 'all-bad',
        exercises: [{ id: 'x', fen: '8/3k4/8/8/8/8/r3P1K1/3R4 w - - 0 1', firstMoveSan: 'Kg3' }],
      }),
    ).toThrow()
  })
})

// Audit every bundled book to catch regressions where the JSON itself
// contains broken exercises. Loads the file via fs (we're in node).
describe('bundled books', () => {
  const files = listBundledBookFiles()

  if (files.length === 0) {
    it.skip('no bundled book json files found', () => {})
    return
  }

  for (const file of files) {
    describe(file, () => {
      const raw = JSON.parse(readFileSync(join(BOOKS_DIR, file), 'utf8')) as {
        exercises?: Array<{ id?: string; fen: string; firstMoveSan?: string; moves?: string[] }>
      }
      const exercises = raw.exercises ?? []

      it('has at least one exercise', () => {
        expect(exercises.length).toBeGreaterThan(0)
      })

      it('every FEN parses with chess.js', () => {
        for (const e of exercises) {
          expect(() => new Chess(e.fen), `${e.id ?? '<no id>'} bad fen: ${e.fen}`).not.toThrow()
        }
      })

      it('no exercise starts with the opponent in check (illegal position)', () => {
        for (const e of exercises) {
          const parts = e.fen.split(' ')
          parts[1] = parts[1] === 'w' ? 'b' : 'w'
          let opponentInCheck = false
          try {
            const swapped = new Chess(parts.join(' '))
            opponentInCheck = swapped.inCheck()
          } catch { /* swapped is malformed; primary FEN test will catch it */ }
          expect(
            opponentInCheck,
            `${e.id ?? '<no id>'} starts with the opponent (side NOT to move) in check — illegal position`,
          ).toBe(false)
        }
      })

      it('firstMoveSan (when set) is a legal move from the FEN', () => {
        for (const e of exercises) {
          const san = e.firstMoveSan ?? e.moves?.[0]
          if (!san) continue
          const c = new Chess(e.fen)
          expect(
            () => c.move(san),
            `${e.id ?? '<no id>'} firstMoveSan '${san}' is illegal from FEN ${e.fen}`,
          ).not.toThrow()
        }
      })
    })
  }
})

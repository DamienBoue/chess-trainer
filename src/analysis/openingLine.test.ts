import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { mostPlayedLine } from './openingLine'
import { buildRepertoire } from './repertoire'
import { buildGame } from './__fixtures__'

function gameFromSans(opts: { url: string; userColor: 'white' | 'black'; sans: string[] }) {
  const c = new Chess()
  const moves = opts.sans.map((san, i) => {
    const fenBefore = c.fen()
    const mv = c.move(san)
    if (!mv) throw new Error('illegal san: ' + san)
    return {
      ply: i + 1, san: mv.san,
      cpLoss: 0, classification: 'best' as const,
      bestMoveSan: mv.san, fenBefore, fenAfter: c.fen(),
    }
  })
  return buildGame({
    userColor: opts.userColor, url: opts.url,
    ecoCode: 'C50', opening: 'Italian',
    moves,
  })
}

describe('mostPlayedLine', () => {
  it('returns an empty array on a root with no children', () => {
    const games = [gameFromSans({ url: 'g1', userColor: 'white', sans: ['e4'] })]
    const roots = buildRepertoire(games, { minGamesPerRoot: 1 })
    // Force a manually constructed empty children root by clearing.
    roots[0].children.clear()
    expect(mostPlayedLine(roots[0])).toEqual([])
  })

  it('walks the most-played sequence ply by ply', () => {
    // 3 games with e4-e5-Nf3, 1 game with e4-c5 (sicilian). The most-played
    // user line for white should be e4 then Nf3.
    const games = [
      gameFromSans({ url: 'g1', userColor: 'white', sans: ['e4', 'e5', 'Nf3'] }),
      gameFromSans({ url: 'g2', userColor: 'white', sans: ['e4', 'e5', 'Nf3'] }),
      gameFromSans({ url: 'g3', userColor: 'white', sans: ['e4', 'e5', 'Nf3'] }),
      gameFromSans({ url: 'g4', userColor: 'white', sans: ['e4', 'c5', 'Nf3'] }),
    ]
    const roots = buildRepertoire(games)
    const line = mostPlayedLine(roots[0], { maxPlies: 4 })
    expect(line.length).toBeGreaterThan(0)
    expect(line[0].userSan).toBe('e4')
    expect(line[0].oppPrev).toBe('<start>')
    if (line[1]) {
      // After 3 games with e5 vs 1 with c5, the line continues with the
      // user's most-played response to e5 (Nf3 in 3/3 games).
      expect(line[1].userSan).toBe('Nf3')
    }
  })

  it('respects maxPlies', () => {
    const games = Array.from({ length: 4 }, (_, i) =>
      gameFromSans({ url: `g${i}`, userColor: 'white', sans: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'd3'] }),
    )
    const roots = buildRepertoire(games)
    const line = mostPlayedLine(roots[0], { maxPlies: 2 })
    expect(line.length).toBeLessThanOrEqual(2)
  })

  it('every step has a parseable FEN before/after', () => {
    const games = Array.from({ length: 3 }, (_, i) =>
      gameFromSans({ url: `g${i}`, userColor: 'white', sans: ['e4', 'e5', 'Nf3'] }),
    )
    const roots = buildRepertoire(games)
    const line = mostPlayedLine(roots[0], { maxPlies: 4 })
    for (const step of line) {
      expect(() => new Chess(step.fenBefore)).not.toThrow()
      expect(() => new Chess(step.fenAfter)).not.toThrow()
    }
  })
})

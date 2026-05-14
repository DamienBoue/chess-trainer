// Catalogue integrity. Anything that would crash the concepts view at
// runtime should fail this test instead.

import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { CONCEPTS } from './catalog'

describe('concepts catalog', () => {
  it('has unique ids', () => {
    const ids = CONCEPTS.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every concept has a non-empty title and shortDef', () => {
    for (const c of CONCEPTS) {
      expect(c.title.trim().length, `concept ${c.id} has empty title`).toBeGreaterThan(0)
      expect(c.shortDef.trim().length, `concept ${c.id} has empty shortDef`).toBeGreaterThan(0)
    }
  })

  it('every position FEN parses with chess.js', () => {
    for (const c of CONCEPTS) {
      for (const p of c.positions ?? []) {
        expect(() => new Chess(p.fen), `${c.id}: bad FEN ${p.fen}`).not.toThrow()
      }
    }
  })

  it('every position bestSan (when set) is a legal move from the FEN', () => {
    for (const c of CONCEPTS) {
      for (const p of c.positions ?? []) {
        if (!p.bestSan) continue
        const game = new Chess(p.fen)
        expect(() => game.move(p.bestSan!), `${c.id}: illegal bestSan ${p.bestSan} from ${p.fen}`).not.toThrow()
      }
    }
  })

  it('every related id points to an existing concept', () => {
    const ids = new Set(CONCEPTS.map(c => c.id))
    for (const c of CONCEPTS) {
      for (const r of c.related ?? []) {
        expect(ids.has(r), `${c.id} references missing concept '${r}'`).toBe(true)
      }
    }
  })

  it('every link URL starts with https://', () => {
    for (const c of CONCEPTS) {
      for (const l of c.links ?? []) {
        expect(l.url.startsWith('https://'), `${c.id}: link "${l.label}" is not https`).toBe(true)
      }
    }
  })

  it('aliases are unique across concepts (no two concepts share an alias)', () => {
    const seen = new Map<string, string>()
    for (const c of CONCEPTS) {
      for (const a of [c.title.toLowerCase(), ...(c.aliases ?? []).map(x => x.toLowerCase())]) {
        const prev = seen.get(a)
        if (prev && prev !== c.id) {
          throw new Error(`alias '${a}' is used by both ${prev} and ${c.id}`)
        }
        seen.set(a, c.id)
      }
    }
  })

  it('covers every motif tag from detectMotifs at least once via aliases', () => {
    // Lets the radar always offer a "learn more" link.
    // Verified by lookup.test.ts conceptForMotif coverage; here we just
    // assert the canonical motif concepts are present.
    const ids = new Set(CONCEPTS.map(c => c.id))
    for (const mustHave of ['fork', 'pin', 'sacrifice', 'back-rank-mate']) {
      expect(ids.has(mustHave), `missing motif-anchor concept '${mustHave}'`).toBe(true)
    }
  })
})

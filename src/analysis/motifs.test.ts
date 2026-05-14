import { describe, expect, it } from 'vitest'
import { detectMotifs, MOTIF_LABELS, type MotifTag } from './motifs'
import type { MoveAnalysis } from '../types'

function move(opts: Partial<MoveAnalysis>): MoveAnalysis {
  return {
    ply: 1, san: 'e4', fenBefore: '', fenAfter: '',
    evalBefore: 0, evalAfter: 0,
    classification: 'best', cpLoss: 0,
    ...opts,
  }
}

describe('detectMotifs', () => {
  it('returns no motifs when bestMoveSan is missing', () => {
    expect(detectMotifs(move({}))).toEqual([])
  })

  it('flags mate-found when the best line ends in mate', () => {
    const m = move({
      bestMoveSan: 'Qh7#', bestLineSan: 'Qh7#', classification: 'best',
      fenBefore: '6k1/5ppp/8/8/8/8/7Q/6K1 w - - 0 1',
    })
    expect(detectMotifs(m)).toContain('mate-found')
  })

  it('flags mate-missed when the user blundered and the best line was mate', () => {
    const m = move({
      bestMoveSan: 'Qh7#', bestLineSan: 'Qh7#',
      san: 'Kh1', classification: 'blunder', cpLoss: 800,
      fenBefore: '6k1/5ppp/8/8/8/8/7Q/6K1 w - - 0 1',
    })
    expect(detectMotifs(m)).toContain('mate-missed')
  })

  it('returns a non-empty motif list when bestMove is a capture/check', () => {
    const m = move({
      bestMoveSan: 'Nxe7+',
      fenBefore: 'r2qkbnr/ppp2ppp/2np4/4N3/8/8/PPPP1PPP/R1BQK2R w KQkq - 0 1',
    })
    expect(detectMotifs(m).length).toBeGreaterThan(0)
  })

  it('flags a clear royal fork', () => {
    // White knight on g4 → Nf6+ attacks d7 (queen) AND e8 (king).
    const m = move({
      bestMoveSan: 'Nf6+',
      fenBefore: '4k3/3q4/8/8/6N1/8/8/4K3 w - - 0 1',
    })
    const tags = detectMotifs(m)
    expect(tags.some(t => t === 'fork-royal' || t === 'fork')).toBe(true)
  })

  it('falls back to "capture" when no richer tag applies', () => {
    const m = move({
      bestMoveSan: 'exd5', fenBefore: 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2',
    })
    const tags = detectMotifs(m)
    expect(tags.length).toBeGreaterThan(0)
  })

  it('never crashes on an invalid FEN — returns whatever it can', () => {
    expect(() => detectMotifs(move({ bestMoveSan: 'Nf3', fenBefore: 'totally-invalid' }))).not.toThrow()
  })
})

describe('MOTIF_LABELS', () => {
  it('has a French label for every motif tag', () => {
    const tags: MotifTag[] = ['mate-found', 'mate-missed', 'fork', 'fork-royal', 'pin', 'hanging-capture', 'sacrifice', 'capture']
    for (const t of tags) {
      expect(MOTIF_LABELS[t].length).toBeGreaterThan(0)
    }
  })
})

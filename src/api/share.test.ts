import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exerciseToShareUrl, readSharedFromHash, clearShareHash } from './share'
import type { Exercise } from '../analysis/exercises'

function mockLocation(hash: string) {
  const loc = {
    origin: 'https://example.test',
    pathname: '/chess-trainer/',
    hash,
    href: 'https://example.test/chess-trainer/' + hash,
    search: '',
  }
  vi.stubGlobal('location', loc)
  vi.stubGlobal('window', { location: loc, history: { replaceState: vi.fn() } })
  vi.stubGlobal('history', { replaceState: vi.fn() })
}

const sample: Exercise = {
  id: 'g#3-missed',
  category: 'missed',
  fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
  userColor: 'white',
  sideToMove: 'w',
  bestMoveSan: 'Nf3',
  bestLineSan: 'Nf3 Nc6 Bb5',
  playedMoveSan: 'Qh5',
  playedClassification: 'mistake',
  cpSwing: 300,
  evalBeforeWhite: 20,
  evalAfterPlayedWhite: -280,
  motifs: ['pin'],
  difficulty: 'medium',
  context: {
    gameUrl: 'https://chess.com/game/x',
    opponent: 'bob',
    ply: 5,
    moveLabel: '3.',
    endTime: 1700000000,
    opening: 'C50',
  },
}

describe('exerciseToShareUrl', () => {
  beforeEach(() => mockLocation(''))

  it('produces a #share?… URL containing the fen', () => {
    const url = exerciseToShareUrl(sample)
    expect(url.startsWith('https://example.test/chess-trainer/#share?')).toBe(true)
    expect(url).toContain('fen=')
    expect(url).toContain('best=Nf3')
    expect(url).toContain('color=white')
    expect(url).toContain('cat=missed')
  })

  it('encodes spaces in the FEN', () => {
    const url = exerciseToShareUrl(sample)
    // Spaces in FEN should appear URL-encoded.
    expect(url).not.toMatch(/fen=[^&]* /)
  })

  it('skips optional fields when missing', () => {
    const minimal = { ...sample, bestLineSan: undefined, context: { ...sample.context, opening: undefined } }
    const url = exerciseToShareUrl(minimal)
    expect(url).not.toContain('line=')
    expect(url).not.toContain('open=')
  })
})

describe('readSharedFromHash', () => {
  it('returns null without a share hash', () => {
    mockLocation('')
    expect(readSharedFromHash()).toBeNull()
  })

  it('returns null when fen or best is missing', () => {
    mockLocation('#share?best=Nf3')
    expect(readSharedFromHash()).toBeNull()
    mockLocation('#share?fen=8/8/8/8/8/8/8/8%20w%20-%20-%200%201')
    expect(readSharedFromHash()).toBeNull()
  })

  it('round-trips a shared exercise', () => {
    mockLocation('')
    const url = exerciseToShareUrl(sample)
    const hash = url.slice(url.indexOf('#'))
    mockLocation(hash)
    const decoded = readSharedFromHash()
    expect(decoded?.fen).toBe(sample.fen)
    expect(decoded?.bestMoveSan).toBe('Nf3')
    expect(decoded?.bestLineSan).toBe('Nf3 Nc6 Bb5')
    expect(decoded?.category).toBe('missed')
    expect(decoded?.userColor).toBe('white')
  })

  it('infers sideToMove from FEN', () => {
    mockLocation('#share?fen=' + encodeURIComponent('8/8/8/8/8/8/8/4K2k b - - 0 1') + '&best=Kxh1')
    const e = readSharedFromHash()
    expect(e?.sideToMove).toBe('b')
  })
})

describe('clearShareHash', () => {
  it('replaces the location when the hash is a share', () => {
    mockLocation('#share?fen=abc&best=Nf3')
    clearShareHash()
    expect(history.replaceState).toHaveBeenCalled()
  })

  it('does nothing when the hash is not a share', () => {
    mockLocation('#other')
    clearShareHash()
    expect(history.replaceState).not.toHaveBeenCalled()
  })
})

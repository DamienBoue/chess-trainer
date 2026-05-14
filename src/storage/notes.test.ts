import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadNotes, getNote, setNote, listNotesWithFen } from './notes'
import { mockLocalStorage } from '../test-utils/mockLocalStorage'


const FEN_A = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
// Same position, different move counters → must share key:
const FEN_A_REWOUND = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 99 50'
const FEN_B = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1'

describe('notes storage', () => {
  beforeEach(() => { vi.stubGlobal('localStorage', mockLocalStorage()) })

  it('returns empty store on a fresh install', () => {
    expect(loadNotes()).toEqual({})
  })

  it('round-trips a note', () => {
    setNote(FEN_A, 'careful, white pushes e5 next')
    expect(getNote(FEN_A)?.text).toBe('careful, white pushes e5 next')
  })

  it('shares notes across equivalent positions (different move counters)', () => {
    setNote(FEN_A, 'shared')
    expect(getNote(FEN_A_REWOUND)?.text).toBe('shared')
  })

  it('separates notes for different positions', () => {
    setNote(FEN_A, 'on A')
    setNote(FEN_B, 'on B')
    expect(getNote(FEN_A)?.text).toBe('on A')
    expect(getNote(FEN_B)?.text).toBe('on B')
  })

  it('clears the note when text is empty', () => {
    setNote(FEN_A, 'temp')
    setNote(FEN_A, '   ')
    expect(getNote(FEN_A)).toBeUndefined()
  })

  it('trims whitespace', () => {
    setNote(FEN_A, '   trimmed   ')
    expect(getNote(FEN_A)?.text).toBe('trimmed')
  })

  it('listNotesWithFen returns most-recently-updated first', () => {
    setNote(FEN_A, 'first')
    // Force a slightly later timestamp.
    const real = Date.now
    vi.spyOn(Date, 'now').mockReturnValue(real() + 1000)
    setNote(FEN_B, 'second')
    const list = listNotesWithFen()
    expect(list[0].note.text).toBe('second')
    expect(list[1].note.text).toBe('first')
    vi.restoreAllMocks()
  })

  it('stores an updatedAt timestamp', () => {
    const before = Date.now()
    setNote(FEN_A, 'hello')
    const note = getNote(FEN_A)!
    expect(note.updatedAt).toBeGreaterThanOrEqual(before)
  })
})

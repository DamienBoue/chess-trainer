import { beforeEach, describe, expect, it, vi } from 'vitest'
import { inMemoryRepos, localRepos } from './repos'
import { mockLocalStorage } from '../test-utils/mockLocalStorage'

describe('inMemoryRepos', () => {
  it('progress.load returns an empty record by default', () => {
    expect(inMemoryRepos().progress.load()).toEqual({})
  })

  it('progress.save round-trips and isolates from the input reference', () => {
    const r = inMemoryRepos()
    const a = { foo: { attempts: 1, successes: 1, failures: 0, lastFirstTry: true, lastSeenAt: 0, nextDueAt: 0, easeFactor: 2.5 } }
    r.progress.save(a)
    a.foo.attempts = 99  // mutate the caller's object
    expect(r.progress.load().foo.attempts).toBe(1)  // unaffected
  })

  it('plan.load resets stale state when the date changes', () => {
    const r = inMemoryRepos({ plan: { date: '2025-01-01', done: ['x'] } })
    expect(r.plan.load('2025-01-02')).toEqual({ date: '2025-01-02', done: [] })
  })

  it('plan.load returns stored state when the date matches', () => {
    const r = inMemoryRepos({ plan: { date: '2025-01-01', done: ['x'] } })
    expect(r.plan.load('2025-01-01')).toEqual({ date: '2025-01-01', done: ['x'] })
  })

  it('plan.save persists', () => {
    const r = inMemoryRepos()
    r.plan.save({ date: '2025-01-01', done: ['a', 'b'] })
    expect(r.plan.load('2025-01-01').done).toEqual(['a', 'b'])
  })

  it('notes.set stores by truncated FEN key (ignores move counters)', () => {
    const r = inMemoryRepos()
    r.notes.set('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'hello')
    // Different move counters, same position key → same note.
    expect(r.notes.get('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 5 12')?.text).toBe('hello')
  })

  it('notes.set with empty/whitespace text removes the note', () => {
    const r = inMemoryRepos()
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    r.notes.set(fen, 'note')
    expect(r.notes.get(fen)).toBeTruthy()
    r.notes.set(fen, '   ')
    expect(r.notes.get(fen)).toBeUndefined()
  })

  it('notes.load is a snapshot — mutating it does not change repo state', () => {
    const r = inMemoryRepos()
    r.notes.set('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'x')
    const snap = r.notes.load()
    delete snap['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq']
    expect(Object.keys(r.notes.load()).length).toBe(1)
  })

  it('daily.load defaults to null', () => {
    expect(inMemoryRepos().daily.load()).toBeNull()
  })

  it('daily.save round-trips', () => {
    const r = inMemoryRepos()
    const state = { date: '2025-01-01', exerciseId: 'a', solved: true, streak: 3, lastSolvedDate: '2025-01-01' }
    r.daily.save(state)
    expect(r.daily.load()).toEqual(state)
  })
})

describe('localRepos', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockLocalStorage())
    vi.stubGlobal('window', { dispatchEvent: vi.fn() })
    vi.stubGlobal('CustomEvent', class { constructor(public type: string, public init?: object) {} })
  })

  it('progress port wires up loadProgress / saveProgress', () => {
    const repos = localRepos()
    expect(repos.progress.load()).toEqual({})
    const data = { ex1: { attempts: 1, successes: 1, failures: 0, lastFirstTry: true, lastSeenAt: 0, nextDueAt: 0, easeFactor: 2.5 } }
    repos.progress.save(data)
    expect(repos.progress.load()).toEqual(data)
  })

  it('plan port resets the state when the date changes', () => {
    const repos = localRepos()
    repos.plan.save({ date: '2025-01-01', done: ['x'] })
    // Querying for a later date yields a fresh empty state.
    expect(repos.plan.load('2025-01-02')).toEqual({ date: '2025-01-02', done: [] })
  })

  it('notes port round-trips and respects truncated FEN keys', () => {
    const repos = localRepos()
    repos.notes.set('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'opening')
    expect(repos.notes.get('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')?.text).toBe('opening')
  })

  it('daily port returns null when never saved', () => {
    expect(localRepos().daily.load()).toBeNull()
  })
})

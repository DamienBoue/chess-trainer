import { describe, expect, it } from 'vitest'
import type { GameAnalysis } from '../types'
import type { ExerciseProgress } from '../storage/persist'
import { KEYS } from '../storage/keys'
import {
  EMPTY_SYNC_STATE, hashOf, mergeProgress, mergeSession, syncOnce,
  type LocalStore, type RemoteRow, type RemoteStore, type SyncState,
} from './engine'

const p = (lastSeenAt: number, attempts = 1): ExerciseProgress =>
  ({ attempts, successes: 1, failures: 0, lastFirstTry: true, lastSeenAt, nextDueAt: lastSeenAt + 1, easeFactor: 2.5 })
const analysis = (url: string) => ({ url, moves: [] }) as unknown as GameAnalysis

/** A fake Supabase: rows with a server clock. */
class FakeRemote implements RemoteStore {
  analyses = new Map<string, RemoteRow<GameAnalysis>>()
  documents = new Map<string, RemoteRow<unknown>>()
  clock = 0
  private stamp = () => `2026-10-16T10:00:${String(this.clock++).padStart(2, '0')}Z`
  async pullAnalyses(since: string | null) { return [...this.analyses.values()].filter(r => since === null || r.updatedAt > since) }
  async pushAnalyses(rows: { id: string; data: GameAnalysis }[]) { for (const r of rows) this.analyses.set(r.id, { ...r, updatedAt: this.stamp() }) }
  async pullDocuments(since: string | null) { return [...this.documents.values()].filter(r => since === null || r.updatedAt > since) }
  async pushDocuments(rows: { id: string; data: unknown }[]) { for (const r of rows) this.documents.set(r.id, { ...r, updatedAt: this.stamp() }) }
}

/** A device: its analyses and documents. */
class Device implements LocalStore {
  games: Record<string, GameAnalysis>
  docs: Record<string, unknown>
  constructor(games: Record<string, GameAnalysis> = {}, docs: Record<string, unknown> = {}) {
    this.games = games
    this.docs = docs
  }
  state: SyncState = EMPTY_SYNC_STATE
  analysisIds() { return Object.keys(this.games) }
  async loadAnalyses(ids: string[]) { return ids.flatMap(id => this.games[id] ?? []) }
  addAnalyses(list: GameAnalysis[]) { for (const a of list) this.games[a.url] = a }
  document(key: string) { return this.docs[key] }
  setDocument(key: string, value: unknown) { this.docs[key] = value }
  async sync(remote: RemoteStore) { const r = await syncOnce(remote, this, this.state); this.state = r.state; return r }
}

describe('sync between devices', () => {
  it('shares analyses and merges exercise progress exercise by exercise', async () => {
    const remote = new FakeRemote()
    const phone = new Device({ g1: analysis('g1') }, { [KEYS.exerciseProgress]: { a: p(100), b: p(300) } })
    const pc = new Device({ g2: analysis('g2') }, { [KEYS.exerciseProgress]: { a: p(200), c: p(50) } })

    expect((await phone.sync(remote)).pushedAnalyses).toBe(1)
    const pcFirst = await pc.sync(remote)
    expect(pcFirst.pulledAnalyses).toBe(1)
    expect(Object.keys(pc.games).sort()).toEqual(['g1', 'g2'])
    // The PC's attempt on "a" is the latest: it wins; "b" and "c" are kept.
    expect(pc.docs[KEYS.exerciseProgress]).toEqual({ a: p(200), b: p(300), c: p(50) })

    const phoneBack = await phone.sync(remote)
    expect(phoneBack.pulledAnalyses).toBe(1)
    expect(phone.docs[KEYS.exerciseProgress]).toEqual({ a: p(200), b: p(300), c: p(50) })
    // Nothing new: a second round moves nothing.
    const quiet = await phone.sync(remote)
    expect(quiet).toMatchObject({ pulledAnalyses: 0, pushedAnalyses: 0, changedDocuments: [] })
  })

  it('lets a local change win over the remote copy for plain documents, and takes remote ones otherwise', async () => {
    const remote = new FakeRemote()
    const phone = new Device({}, { [KEYS.elo]: { declared: 1500 } })
    const pc = new Device()
    await phone.sync(remote)
    await pc.sync(remote)
    expect(pc.docs[KEYS.elo]).toEqual({ declared: 1500 })
    pc.docs[KEYS.elo] = { declared: 1600 }  // changed on the PC
    await pc.sync(remote)
    await phone.sync(remote)
    expect(phone.docs[KEYS.elo]).toEqual({ declared: 1600 })
    expect(phone.state.hashes[KEYS.elo]).toBe(hashOf({ declared: 1600 }))
  })

  it('keeps the latest day session, and both lists on the same day', () => {
    expect(mergeSession({ date: '2026-10-16', ids: ['a'] }, { date: '2026-10-15', ids: ['z'] })).toEqual({ date: '2026-10-16', ids: ['a'] })
    expect(mergeSession({ date: '2026-10-16', ids: ['a', 'b'] }, { date: '2026-10-16', ids: ['b', 'c'] })).toEqual({ date: '2026-10-16', ids: ['a', 'b', 'c'] })
    expect(mergeProgress(undefined, { a: p(1) })).toEqual({ a: p(1) })
    expect(mergeProgress({ a: p(5, 2) }, { a: p(5, 3) })).toEqual({ a: p(5, 3) })
  })
})

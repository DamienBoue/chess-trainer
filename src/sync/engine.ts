// Sharing a player's data between devices (phone, PC) through a remote
// store (Supabase in the app, see supabase/migrations/). Offline first: each
// device keeps working on its own storage, and a sync pulls what changed
// remotely since the last one, then pushes what is new locally.
//
// - Analyses: one remote row per game; a device adds the ones it lacks.
// - Documents (the small stores: progress, the day's session, level…): the
//   SRS progress maps merge exercise by exercise (the latest attempt wins),
//   the day's session keeps the latest day (the same day: both lists), the
//   rest is last-writer-wins — a local change since the last sync wins over
//   the remote copy.

import type { GameAnalysis } from '../types'
import type { ExerciseProgress } from '../storage/persist'
import type { DailySession } from '../analysis/dailyQueue'
import { KEYS } from '../storage/keys'

export interface RemoteRow<T> {
  id: string
  data: T
  /** Server time (ISO): rows changed after a cursor are pulled again. */
  updatedAt: string
}

export interface RemoteStore {
  pullAnalyses(since: string | null): Promise<RemoteRow<GameAnalysis>[]>
  pushAnalyses(rows: { id: string; data: GameAnalysis }[]): Promise<void>
  pullDocuments(since: string | null): Promise<RemoteRow<unknown>[]>
  pushDocuments(rows: { id: string; data: unknown }[]): Promise<void>
}

export interface LocalStore {
  /** Urls of the analyses on this device. */
  analysisIds(): string[]
  /** These analyses, read from the device (only the ones to push). */
  loadAnalyses(ids: string[]): Promise<GameAnalysis[]>
  addAnalyses(list: GameAnalysis[]): void
  /** undefined when the device has no value for this key. */
  document(key: string): unknown
  setDocument(key: string, value: unknown): void
}

export interface SyncState {
  analysesCursor: string | null
  documentsCursor: string | null
  /** Analyses known to be on the server (pushed or pulled). */
  remoteAnalyses: string[]
  /** Hash of each document as of the last sync (local changes since). */
  hashes: Record<string, number>
}

export const EMPTY_SYNC_STATE: SyncState = { analysesCursor: null, documentsCursor: null, remoteAnalyses: [], hashes: {} }

type Merge = 'progress' | 'session' | 'latest'

/** The documents shared between devices, and how two copies merge. */
export const SYNCED_DOCUMENTS: { key: string; merge: Merge }[] = [
  { key: KEYS.username, merge: 'latest' },
  { key: KEYS.exerciseProgress, merge: 'progress' },
  { key: KEYS.repertoireProgress, merge: 'progress' },
  { key: KEYS.dailyExercises, merge: 'session' },
  { key: KEYS.daily, merge: 'latest' },
  { key: KEYS.elo, merge: 'latest' },
  { key: KEYS.roadmapProgress, merge: 'latest' },
  { key: KEYS.strategyTrainer, merge: 'latest' },
]

/** Per exercise, the copy with the latest attempt. */
export function mergeProgress(
  a: Record<string, ExerciseProgress> | undefined,
  b: Record<string, ExerciseProgress> | undefined,
): Record<string, ExerciseProgress> {
  const out: Record<string, ExerciseProgress> = { ...(a ?? {}) }
  for (const [id, p] of Object.entries(b ?? {})) {
    const mine = out[id]
    if (!mine || p.lastSeenAt > mine.lastSeenAt || (p.lastSeenAt === mine.lastSeenAt && p.attempts > mine.attempts)) out[id] = p
  }
  return out
}

/** The latest day's session; the same day on both devices: both lists. */
export function mergeSession(a: DailySession | undefined, b: DailySession | undefined): DailySession | undefined {
  if (!a || !b) return a ?? b
  if (a.date !== b.date) return a.date > b.date ? a : b
  return { date: a.date, ids: [...a.ids, ...b.ids.filter(id => !a.ids.includes(id))] }
}

/** Cheap, stable hash of a JSON value (detects local changes). */
export function hashOf(value: unknown): number {
  const s = JSON.stringify(value) ?? ''
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) | 0
  return h
}

const maxCursor = (cursor: string | null, rows: { updatedAt: string }[]) =>
  rows.reduce<string | null>((m, r) => (m === null || r.updatedAt > m ? r.updatedAt : m), cursor)

export interface SyncResult {
  state: SyncState
  /** Analyses added to this device. */
  pulledAnalyses: number
  pushedAnalyses: number
  /** Document keys whose local value changed. */
  changedDocuments: string[]
}

/** Analyses are pushed in batches: each one weighs tens of kilobytes. */
const PUSH_BATCH = 25

export async function syncOnce(remote: RemoteStore, local: LocalStore, state: SyncState): Promise<SyncResult> {
  const onServer = new Set(state.remoteAnalyses)

  // Analyses: pull the new remote ones, then push the local ones the server lacks.
  const pulled = await remote.pullAnalyses(state.analysesCursor)
  const mine = new Set(local.analysisIds())
  const toAdd = pulled.filter(r => !mine.has(r.id)).map(r => r.data)
  if (toAdd.length > 0) local.addAnalyses(toAdd)
  for (const r of pulled) onServer.add(r.id)
  const toPush = [...mine].filter(id => !onServer.has(id))
  for (let i = 0; i < toPush.length; i += PUSH_BATCH) {
    const batch = await local.loadAnalyses(toPush.slice(i, i + PUSH_BATCH))
    await remote.pushAnalyses(batch.map(a => ({ id: a.url, data: a })))
    for (const a of batch) onServer.add(a.url)
  }

  // Documents.
  const remoteDocs = await remote.pullDocuments(state.documentsCursor)
  const byId = new Map(remoteDocs.map(r => [r.id, r.data]))
  const hashes = { ...state.hashes }
  const pushDocs: { id: string; data: unknown }[] = []
  const changedDocuments: string[] = []
  for (const { key, merge } of SYNCED_DOCUMENTS) {
    const localValue = local.document(key)
    const localChanged = localValue !== undefined && hashOf(localValue) !== hashes[key]
    const hasRemote = byId.has(key)
    const remoteValue = byId.get(key)
    let final = localValue
    if (hasRemote && merge === 'progress') {
      final = mergeProgress(localValue as Record<string, ExerciseProgress>, remoteValue as Record<string, ExerciseProgress>)
    } else if (hasRemote && merge === 'session') {
      final = mergeSession(localValue as DailySession, remoteValue as DailySession)
    } else if (hasRemote && !localChanged) {
      final = remoteValue
    }
    if (final === undefined) continue
    if (hashOf(final) !== hashOf(localValue)) {
      local.setDocument(key, final)
      changedDocuments.push(key)
    }
    if (!hasRemote ? localChanged : hashOf(final) !== hashOf(remoteValue)) pushDocs.push({ id: key, data: final })
    hashes[key] = hashOf(final)
  }
  if (pushDocs.length > 0) await remote.pushDocuments(pushDocs)

  return {
    state: {
      analysesCursor: maxCursor(state.analysesCursor, pulled),
      documentsCursor: maxCursor(state.documentsCursor, remoteDocs),
      remoteAnalyses: [...onServer],
      hashes,
    },
    pulledAnalyses: toAdd.length,
    pushedAnalyses: toPush.length,
    changedDocuments,
  }
}

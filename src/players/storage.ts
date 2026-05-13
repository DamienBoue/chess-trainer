// IndexedDB layer for "player profiles": collections of games belonging to
// a single named player (typically pro / FIDE OTB games imported from PGN).
//
// We keep this storage distinct from the Library (books) — different shape,
// different lifecycle — but it lives in the same database for simplicity.

import type { ChessComGame } from '../types'

const DB_NAME = 'chess-trainer-library'   // shared with library/storage.ts
const DB_VERSION = 2
const PLAYERS_STORE = 'players'

export interface PlayerProfile {
  id: string                // slug from name
  name: string
  source: 'pgn' | 'twic' | 'lichess-broadcast'
  importedAt: string
  games: ChessComGame[]
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('books'))    db.createObjectStore('books',    { keyPath: 'id' })
      if (!db.objectStoreNames.contains('progress')) db.createObjectStore('progress', { keyPath: 'bookId' })
      if (!db.objectStoreNames.contains(PLAYERS_STORE)) db.createObjectStore(PLAYERS_STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(PLAYERS_STORE, mode)
    const s = t.objectStore(PLAYERS_STORE)
    const req = run(s)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }))
}

export async function listPlayers(): Promise<PlayerProfile[]> {
  const all = await tx<PlayerProfile[]>('readonly', s => s.getAll())
  return [...all].sort((a, b) => (b.importedAt ?? '').localeCompare(a.importedAt ?? ''))
}

export async function getPlayer(id: string): Promise<PlayerProfile | undefined> {
  return tx<PlayerProfile | undefined>('readonly', s => s.get(id))
}

export async function savePlayer(p: PlayerProfile): Promise<void> {
  await tx('readwrite', s => s.put(p))
}

export async function deletePlayer(id: string): Promise<void> {
  await tx('readwrite', s => s.delete(id))
}

export function slugifyPlayer(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'player'
}

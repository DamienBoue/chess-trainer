// IndexedDB-backed local storage for the imported-books library.
//
// Two object stores:
//   - books    : keyed by book.id, holds Book objects (exercises + metadata)
//   - progress : keyed by bookId, holds BookProgress objects
//
// The data is per-browser and never leaves the device. A future cloud-sync
// can replace this layer without touching the consumers.

import type { Book, BookProgress, ExerciseOutcome, ExerciseProgress } from './types'

const DB_NAME = 'chess-trainer-library'
const DB_VERSION = 1
const BOOKS_STORE = 'books'
const PROGRESS_STORE = 'progress'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(BOOKS_STORE)) {
        db.createObjectStore(BOOKS_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(PROGRESS_STORE)) {
        db.createObjectStore(PROGRESS_STORE, { keyPath: 'bookId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode)
    const s = t.objectStore(store)
    const req = run(s)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }))
}

// ---------- Books ----------------------------------------------------------

export async function listBooks(): Promise<Book[]> {
  const books = await tx<Book[]>(BOOKS_STORE, 'readonly', s => s.getAll())
  // Most-recently-imported first.
  return [...books].sort((a, b) => (b.importedAt ?? '').localeCompare(a.importedAt ?? ''))
}

export async function getBook(id: string): Promise<Book | undefined> {
  return tx<Book | undefined>(BOOKS_STORE, 'readonly', s => s.get(id))
}

export async function saveBook(book: Book): Promise<void> {
  await tx(BOOKS_STORE, 'readwrite', s => s.put(book))
}

export async function deleteBook(id: string): Promise<void> {
  await tx(BOOKS_STORE, 'readwrite', s => s.delete(id))
  await tx(PROGRESS_STORE, 'readwrite', s => s.delete(id))
}

// ---------- Progress -------------------------------------------------------

export async function getProgress(bookId: string): Promise<BookProgress> {
  const found = await tx<BookProgress | undefined>(PROGRESS_STORE, 'readonly', s => s.get(bookId))
  return found ?? { bookId, byExercise: {} }
}

export async function saveProgress(p: BookProgress): Promise<void> {
  await tx(PROGRESS_STORE, 'readwrite', s => s.put(p))
}

// Convenience: record a single attempt result. Returns the updated progress
// so callers can reflect the new state immediately.
export async function recordOutcome(
  bookId: string, exerciseId: string, outcome: ExerciseOutcome,
): Promise<BookProgress> {
  const p = await getProgress(bookId)
  const prev = p.byExercise[exerciseId]
  const next: ExerciseProgress = {
    outcome: prev?.outcome === 'solved' ? 'solved' : outcome,  // solved is sticky
    attempts: (prev?.attempts ?? 0) + 1,
    successes: (prev?.successes ?? 0) + (outcome === 'solved' ? 1 : 0),
    lastSeenAt: Date.now(),
  }
  p.byExercise[exerciseId] = next
  await saveProgress(p)
  return p
}

export async function setLastReached(bookId: string, n: number): Promise<void> {
  const p = await getProgress(bookId)
  p.lastReachedN = n
  await saveProgress(p)
}

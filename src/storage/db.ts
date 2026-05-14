// Shared IndexedDB opener. Single source of truth for the schema so that
// multiple consumer modules (library, players, games, analyses…) cannot
// fight over different DB_VERSION values.

const DB_NAME = 'chess-trainer-library'
const DB_VERSION = 3

let dbPromise: Promise<IDBDatabase> | null = null

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      // Books (library) — keyPath: id
      if (!db.objectStoreNames.contains('books'))    db.createObjectStore('books',    { keyPath: 'id' })
      // Per-book exercise progress — keyPath: bookId
      if (!db.objectStoreNames.contains('progress')) db.createObjectStore('progress', { keyPath: 'bookId' })
      // PGN player profiles — keyPath: id
      if (!db.objectStoreNames.contains('players'))  db.createObjectStore('players',  { keyPath: 'id' })
      // chess.com game lists per username — keyPath: username
      if (!db.objectStoreNames.contains('games'))    db.createObjectStore('games',    { keyPath: 'username' })
      // Stockfish analyses per username — keyPath: username
      if (!db.objectStoreNames.contains('analyses')) db.createObjectStore('analyses', { keyPath: 'username' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

/** Generic transaction helper used by all storage modules. */
export function dbTx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode)
    const s = t.objectStore(store)
    const req = run(s)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }))
}

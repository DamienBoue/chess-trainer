// Shared IndexedDB opener. Single source of truth for the schema so that
// multiple consumer modules (library, players, games, analyses…) cannot
// fight over different DB_VERSION values.

const DB_NAME = 'chess-trainer-library'
const DB_VERSION = 4

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
      // v4, written piece by piece instead of one record per user — keyPath:
      // key, "<user>|<month or url or name>" (see keyRange).
      if (!db.objectStoreNames.contains('gameMonths'))    db.createObjectStore('gameMonths',    { keyPath: 'key' })
      if (!db.objectStoreNames.contains('analysisItems')) db.createObjectStore('analysisItems', { keyPath: 'key' })
      if (!db.objectStoreNames.contains('derived'))       db.createObjectStore('derived',       { keyPath: 'key' })
    }
    req.onsuccess = () => {
      // A newer version opened elsewhere (another tab, after an update):
      // let it upgrade instead of blocking it.
      req.result.onversionchange = () => { req.result.close(); dbPromise = null }
      resolve(req.result)
    }
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

/** Every record whose key starts with `prefix` ("<user>|"). */
export function dbGetAllByPrefix<T extends { key: string }>(store: string, prefix: string): Promise<T[]> {
  return dbTx<T[]>(store, 'readonly', s => s.getAll(IDBKeyRange.bound(prefix, prefix + '\uffff')))
}

/** Writes several records in one transaction. */
export function dbPutMany(store: string, values: unknown[]): Promise<void> {
  if (values.length === 0) return Promise.resolve()
  return openDb().then(db => new Promise<void>((resolve, reject) => {
    const t = db.transaction(store, 'readwrite')
    const s = t.objectStore(store)
    for (const v of values) s.put(v)
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  }))
}

/** Deletes several records in one transaction. */
export function dbDeleteMany(store: string, keys: string[]): Promise<void> {
  if (keys.length === 0) return Promise.resolve()
  return openDb().then(db => new Promise<void>((resolve, reject) => {
    const t = db.transaction(store, 'readwrite')
    const s = t.objectStore(store)
    for (const k of keys) s.delete(k)
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  }))
}

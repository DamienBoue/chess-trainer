// Phones: no IndexedDB in React Native. The same dbTx API over localStorage
// (backed by SQLite through expo-sqlite's polyfill, installed at startup),
// one JSON document per record plus a key list per store. Only the request
// methods the storage modules use are provided: get, put, delete, getAll.

const KEY_PATHS: Record<string, string> = {
  books: 'id',
  progress: 'bookId',
  players: 'id',
  games: 'username',
  analyses: 'username',
}

const recordKey = (store: string, key: IDBValidKey) => `idb:${store}:${String(key)}`
const indexKey = (store: string) => `idb:${store}:__keys`

function keysOf(store: string): string[] {
  try { return JSON.parse(localStorage.getItem(indexKey(store)) ?? '[]') as string[] } catch { return [] }
}

function read(store: string, key: IDBValidKey): unknown {
  const raw = localStorage.getItem(recordKey(store, key))
  return raw === null ? undefined : JSON.parse(raw)
}

// A request that has already succeeded: dbTx reads its result right away.
function done<T>(result: T): IDBRequest<T> {
  return { result, error: null } as unknown as IDBRequest<T>
}

function objectStore(store: string): IDBObjectStore {
  const keyPath = KEY_PATHS[store]
  if (!keyPath) throw new Error(`Unknown store ${store}`)
  return {
    get: (key: IDBValidKey) => done(read(store, key)),
    getAll: () => done(keysOf(store).map(k => read(store, k)).filter(v => v !== undefined)),
    put: (value: Record<string, unknown>) => {
      const key = String(value[keyPath])
      localStorage.setItem(recordKey(store, key), JSON.stringify(value))
      const keys = keysOf(store)
      if (!keys.includes(key)) localStorage.setItem(indexKey(store), JSON.stringify([...keys, key]))
      return done(key)
    },
    delete: (key: IDBValidKey) => {
      localStorage.removeItem(recordKey(store, key))
      localStorage.setItem(indexKey(store), JSON.stringify(keysOf(store).filter(k => k !== String(key))))
      return done(undefined)
    },
  } as unknown as IDBObjectStore
}

export function openDb(): Promise<IDBDatabase> {
  return Promise.reject(new Error('IndexedDB is not available on this device'))
}

/** Same contract as the web dbTx: run one request on a store. */
export function dbTx<T>(
  store: string,
  _mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  try {
    return Promise.resolve(run(objectStore(store)).result)
  } catch (e) {
    return Promise.reject(e)
  }
}

// Export / import all training state (localStorage + IndexedDB) as one
// JSON blob. Lets the user back up their data or move it to a new device
// without a server.

import { openDb } from './db'

const SCHEMA_VERSION = 1
const IDB_STORES = ['books', 'progress', 'players', 'games', 'analyses'] as const
type IdbStore = typeof IDB_STORES[number]

// Anything outside these prefixes is left alone on import (so unrelated
// localStorage entries from other apps on the same origin aren't touched).
const LS_PREFIXES = ['chess.', 'woodpecker.', 'sf.']

export interface ExportedData {
  schemaVersion: number
  exportedAt: string                       // ISO timestamp
  localStorage: Record<string, string>
  indexedDB: Record<IdbStore, unknown[]>
}

export async function exportAll(): Promise<ExportedData> {
  // localStorage: all entries matching our prefixes.
  const ls: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key) continue
    if (!LS_PREFIXES.some(p => key.startsWith(p))) continue
    const v = localStorage.getItem(key)
    if (v !== null) ls[key] = v
  }
  // IDB: dump every store.
  const db = await openDb()
  const idb = {} as Record<IdbStore, unknown[]>
  await Promise.all(IDB_STORES.map(store => new Promise<void>((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll()
    req.onsuccess = () => { idb[store] = req.result; resolve() }
    req.onerror = () => reject(req.error)
  })))

  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    localStorage: ls,
    indexedDB: idb,
  }
}

export async function importAll(data: ExportedData, opts: { merge: boolean }): Promise<void> {
  if (!data || typeof data !== 'object' || data.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Format inconnu (schema ${data?.schemaVersion ?? '?'}, attendu ${SCHEMA_VERSION})`)
  }

  // localStorage
  if (!opts.merge) {
    // Wipe our prefixes first so we don't keep stale keys.
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && LS_PREFIXES.some(p => k.startsWith(p))) toRemove.push(k)
    }
    toRemove.forEach(k => localStorage.removeItem(k))
  }
  for (const [k, v] of Object.entries(data.localStorage ?? {})) {
    localStorage.setItem(k, v)
  }

  // IndexedDB
  const db = await openDb()
  await Promise.all(IDB_STORES.map(store => new Promise<void>((resolve, reject) => {
    const t = db.transaction(store, 'readwrite')
    const s = t.objectStore(store)
    const rows = (data.indexedDB?.[store] ?? []) as unknown[]
    if (!opts.merge) s.clear()
    rows.forEach(r => s.put(r))
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })))
}

export function downloadJson(data: ExportedData, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function readJsonFile(file: File): Promise<ExportedData> {
  const text = await file.text()
  return JSON.parse(text) as ExportedData
}

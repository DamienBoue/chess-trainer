// What the app derives from the games and analyses (exercise index, stats
// rows…), stored so that it is computed once and then only for what is new.
// One record per user and name ("<user>|digest").

import { dbTx } from './db'

const STORE = 'derived'

interface DerivedRecord<T> { key: string; value: T }

const keyOf = (username: string, name: string) => `${username.toLowerCase()}|${name}`

export async function loadDerived<T>(username: string, name: string): Promise<T | undefined> {
  if (!username) return undefined
  const r = await dbTx<DerivedRecord<T> | undefined>(STORE, 'readonly', s => s.get(keyOf(username, name)))
  return r?.value
}

export async function saveDerived<T>(username: string, name: string, value: T): Promise<void> {
  if (!username) return
  await dbTx(STORE, 'readwrite', s => s.put({ key: keyOf(username, name), value }))
}

export async function clearDerived(username: string, name: string): Promise<void> {
  if (!username) return
  await dbTx(STORE, 'readwrite', s => s.delete(keyOf(username, name)))
}

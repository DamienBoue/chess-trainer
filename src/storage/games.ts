// chess.com game list per username, backed by IndexedDB.
//
// Migrates lazily from localStorage so existing users keep their cache.
// The old localStorage key (`chess.games.<user>.v1`) is removed after a
// successful migration to free the quota.

import type { ChessComGame } from '../types'
import { dbTx } from './db'

const STORE = 'games'
const LEGACY_KEY = (username: string) => `chess.games.${username.toLowerCase()}.v1`

interface GamesRecord { username: string; games: ChessComGame[] }

export async function loadGames(username: string): Promise<ChessComGame[]> {
  if (!username) return []
  const key = username.toLowerCase()
  const fromIdb = await dbTx<GamesRecord | undefined>(STORE, 'readonly', s => s.get(key))
  if (fromIdb) return fromIdb.games
  // Lazy migration: pull from localStorage if present, then promote to IDB.
  try {
    const raw = localStorage.getItem(LEGACY_KEY(username))
    if (raw) {
      const games = JSON.parse(raw) as ChessComGame[]
      await saveGames(username, games)
      localStorage.removeItem(LEGACY_KEY(username))
      return games
    }
  } catch (e) {
    console.warn('[storage] legacy games migration failed:', e)
  }
  return []
}

export async function saveGames(username: string, games: ChessComGame[]): Promise<void> {
  if (!username) return
  await dbTx(STORE, 'readwrite', s => s.put({ username: username.toLowerCase(), games }))
}

export async function clearGames(username: string): Promise<void> {
  if (!username) return
  await dbTx(STORE, 'readwrite', s => s.delete(username.toLowerCase()))
}

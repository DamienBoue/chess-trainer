// IndexedDB layer for "player profiles": collections of games belonging to
// a single named player (typically pro / FIDE OTB games imported from PGN).
//
// We keep this storage distinct from the Library (books) — different shape,
// different lifecycle — but it lives in the same database for simplicity.

import type { ChessComGame } from '../types'
import { dbTx } from '../storage/db'

const PLAYERS_STORE = 'players'

export interface PlayerProfile {
  id: string                // slug from name
  name: string
  source: 'pgn' | 'twic' | 'lichess-broadcast'
  importedAt: string
  games: ChessComGame[]
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return dbTx(PLAYERS_STORE, mode, run)
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

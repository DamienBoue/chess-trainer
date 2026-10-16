// chess.com games per username, one record per month ("<user>|2024-05").
//
// New games only rewrite their month: a sync touches one record, a month
// of the history download one record, never the whole list (tens of MB
// with a full history). A small summary (newest game, count) lives in
// localStorage so that a sync needs no read of the games at all.
//
// Each month also gets its rows (analysis/results GameRow: opponent,
// result, ratings, opening…), stored apart: the games list and the stats
// read those, never the PGNs.
//
// Older layouts migrate on first read: one record per user (IndexedDB
// v3), and before it a localStorage key.

import type { ChessComGame } from '../types'
import { toRow, type GameRow } from '../analysis/results'
import { dbDeleteMany, dbGetAllByPrefix, dbPutMany, dbTx } from './db'

const STORE = 'gameMonths'
const ROWS_STORE = 'derived'
const LEGACY_STORE = 'games'
const LEGACY_KEY = (username: string) => `chess.games.${username.toLowerCase()}.v1`
const META_KEY = (username: string) => `chess.games.meta.${username.toLowerCase()}`

interface MonthRecord { key: string; username: string; month: string; games: ChessComGame[] }
interface RowsRecord { key: string; value: GameRow[] }
interface LegacyRecord { username: string; games: ChessComGame[] }

export interface GamesMeta {
  /** end_time (s) of the newest stored game, 0 when none. */
  newest: number
  count: number
}

const userOf = (username: string) => username.toLowerCase()
const prefix = (username: string) => `${userOf(username)}|`
const rowsPrefix = (username: string) => `${userOf(username)}|rows|`

/** UTC month of a game's end, "2024-05". */
export function monthOf(game: ChessComGame): string {
  return new Date(game.end_time * 1000).toISOString().slice(0, 7)
}

export function loadGamesMeta(username: string): GamesMeta {
  try {
    const v = JSON.parse(localStorage.getItem(META_KEY(username)) ?? 'null') as GamesMeta | null
    if (v && typeof v.newest === 'number' && typeof v.count === 'number') return v
  } catch { /* rebuilt below */ }
  return { newest: 0, count: 0 }
}

function saveGamesMeta(username: string, meta: GamesMeta) {
  localStorage.setItem(META_KEY(username), JSON.stringify(meta))
}

let migrated = new Set<string>()

/** Moves an older layout to the monthly records (once). */
export function ensureGamesMigrated(username: string): Promise<void> {
  return username ? migrate(username) : Promise.resolve()
}

async function migrate(username: string): Promise<void> {
  const user = userOf(username)
  if (migrated.has(user)) return
  migrated.add(user)
  let games: ChessComGame[] | null = null
  const old = await dbTx<LegacyRecord | undefined>(LEGACY_STORE, 'readonly', s => s.get(user))
  if (old) games = old.games
  else {
    try {
      const raw = localStorage.getItem(LEGACY_KEY(username))
      if (raw) games = JSON.parse(raw) as ChessComGame[]
    } catch (e) {
      console.warn('[storage] legacy games migration failed:', e)
    }
  }
  if (!games) return
  await addGames(username, games)
  if (old) await dbTx(LEGACY_STORE, 'readwrite', s => s.delete(user))
  localStorage.removeItem(LEGACY_KEY(username))
}

/** Every stored game, newest first. */
export async function loadGames(username: string): Promise<ChessComGame[]> {
  if (!username) return []
  await migrate(username)
  const months = await dbGetAllByPrefix<MonthRecord>(STORE, prefix(username))
  return months.flatMap(m => m.games).sort((a, b) => b.end_time - a.end_time)
}

// One write at a time: the sync and the history download may touch the
// same month (read, merge, write).
let writes: Promise<unknown> = Promise.resolve()

/** Adds games (a stored game is replaced by the incoming copy), rewriting
 *  only their months. Returns the games that were not stored yet. */
export function addGames(username: string, games: ChessComGame[]): Promise<ChessComGame[]> {
  const run = () => addGamesNow(username, games)
  const next = writes.then(run, run)
  writes = next.catch(() => undefined)
  return next
}

async function addGamesNow(username: string, games: ChessComGame[]): Promise<ChessComGame[]> {
  if (!username || games.length === 0) return []
  const user = userOf(username)
  const byMonth = new Map<string, ChessComGame[]>()
  for (const g of games) {
    const m = monthOf(g)
    const list = byMonth.get(m) ?? []
    list.push(g)
    byMonth.set(m, list)
  }
  const added: ChessComGame[] = []
  const records: MonthRecord[] = []
  const rows: RowsRecord[] = []
  for (const [month, incoming] of byMonth) {
    const key = `${user}|${month}`
    const rec = await dbTx<MonthRecord | undefined>(STORE, 'readonly', s => s.get(key))
    const byUrl = new Map((rec?.games ?? []).map(g => [g.url, g]))
    for (const g of incoming) {
      if (!byUrl.has(g.url)) added.push(g)
      byUrl.set(g.url, g)
    }
    const merged = [...byUrl.values()].sort((a, b) => b.end_time - a.end_time)
    records.push({ key, username: user, month, games: merged })
    rows.push({ key: `${rowsPrefix(username)}${month}`, value: merged.flatMap(g => toRow(g, username) ?? []) })
  }
  await dbPutMany(STORE, records)
  await dbPutMany(ROWS_STORE, rows)
  const meta = loadGamesMeta(username)
  saveGamesMeta(username, {
    newest: Math.max(meta.newest, ...games.map(g => g.end_time)),
    count: meta.count + added.length,
  })
  return added
}

/** The rows of every stored game (variants included), newest first. */
export async function loadGameRows(username: string): Promise<GameRow[]> {
  if (!username) return []
  await migrate(username)
  const months = await dbGetAllByPrefix<RowsRecord>(ROWS_STORE, rowsPrefix(username))
  return months.flatMap(m => m.value).sort((a, b) => b.end - a.end)
}

/** One stored game, found in its month. */
export async function loadGame(username: string, url: string, endTime: number): Promise<ChessComGame | undefined> {
  const month = new Date(endTime * 1000).toISOString().slice(0, 7)
  const rec = await dbTx<MonthRecord | undefined>(STORE, 'readonly', s => s.get(`${userOf(username)}|${month}`))
  return rec?.games.find(g => g.url === url)
}

export async function clearGames(username: string): Promise<void> {
  if (!username) return
  const months = await dbGetAllByPrefix<MonthRecord>(STORE, prefix(username))
  await dbDeleteMany(STORE, months.map(m => m.key))
  const rows = await dbGetAllByPrefix<RowsRecord>(ROWS_STORE, rowsPrefix(username))
  await dbDeleteMany(ROWS_STORE, rows.map(r => r.key))
  await dbTx(LEGACY_STORE, 'readwrite', s => s.delete(userOf(username)))
  localStorage.removeItem(META_KEY(username))
}

/** Tests: forget which users were migrated. */
export function resetGamesMigration() {
  migrated = new Set()
}

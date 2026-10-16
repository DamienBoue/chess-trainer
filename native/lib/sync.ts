// New chess.com games since the last one we have: at launch, when the app
// comes back to the foreground, and from the background task (phones).
import type { ChessComGame } from '@shared/types'
import { getGamesSince, getRecentGames } from '@shared/api/chesscom'
import { loadGames, saveGames } from '@shared/storage/persist'

const LAST_SYNC_KEY = 'chess.sync.last'

/** Merges the games played since the newest known one into the store.
 *  `known`: the games the app already holds in memory, which then saves them
 *  itself; without it (background task) they are read from the store. */
export async function syncNewGames(username: string, known?: ChessComGame[]): Promise<{ games: ChessComGame[]; added: ChessComGame[] }> {
  const stored = known ?? await loadGames(username)
  const newest = stored.reduce((m, g) => Math.max(m, g.end_time), 0)
  const fetched = newest > 0 ? await getGamesSince(username, newest) : await getRecentGames(username)
  const urls = new Set(stored.map(g => g.url))
  const added = fetched.filter(g => !urls.has(g.url))
  const games = added.length > 0 ? [...added, ...stored].sort((a, b) => b.end_time - a.end_time) : stored
  if (added.length > 0 && !known) await saveGames(username, games)
  localStorage.setItem(LAST_SYNC_KEY, String(Date.now()))
  return { games, added }
}

/** When the games were last checked (ms), or 0. */
export function lastSyncAt(): number {
  return Number(localStorage.getItem(LAST_SYNC_KEY) ?? 0)
}

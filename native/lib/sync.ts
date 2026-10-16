// New chess.com games since the last one we have: at launch, when the app
// comes back to the foreground, and from the background task (phones).
import type { ChessComGame } from '@shared/types'
import { getGamesSince, getRecentGames } from '@shared/api/chesscom'
import { loadGames, saveGames } from '@shared/storage/persist'

const LAST_SYNC_KEY = 'chess.sync.last'

/** Merges the games played since the newest stored one into the store. */
export async function syncNewGames(username: string): Promise<{ games: ChessComGame[]; added: ChessComGame[] }> {
  const stored = await loadGames(username)
  const newest = stored.reduce((m, g) => Math.max(m, g.end_time), 0)
  const fetched = newest > 0 ? await getGamesSince(username, newest) : await getRecentGames(username)
  const known = new Set(stored.map(g => g.url))
  const added = fetched.filter(g => !known.has(g.url))
  const games = [...added, ...stored].sort((a, b) => b.end_time - a.end_time)
  if (added.length > 0) await saveGames(username, games)
  localStorage.setItem(LAST_SYNC_KEY, String(Date.now()))
  return { games, added }
}

/** When the games were last checked (ms), or 0. */
export function lastSyncAt(): number {
  return Number(localStorage.getItem(LAST_SYNC_KEY) ?? 0)
}

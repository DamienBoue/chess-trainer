// New chess.com games since the last one we have: at launch, when the app
// comes back to the foreground, and from the background task (phones).
import type { ChessComGame } from '@shared/types'
import { getGamesSince, getRecentGames } from '@shared/api/chesscom'
import { addGames, ensureGamesMigrated, loadGamesMeta } from '@shared/storage/games'

const LAST_SYNC_KEY = 'chess.sync.last'

/** Stores the games played since the newest stored one; returns them.
 *  Reads no stored game: the newest one's date is kept apart. */
export async function syncNewGames(username: string): Promise<{ added: ChessComGame[] }> {
  await ensureGamesMigrated(username)
  const { newest } = loadGamesMeta(username)
  const fetched = newest > 0 ? await getGamesSince(username, newest) : await getRecentGames(username)
  const added = await addGames(username, fetched)
  localStorage.setItem(LAST_SYNC_KEY, String(Date.now()))
  return { added }
}

/** When the games were last checked (ms), or 0. */
export function lastSyncAt(): number {
  return Number(localStorage.getItem(LAST_SYNC_KEY) ?? 0)
}

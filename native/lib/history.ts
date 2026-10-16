// The whole chess.com history: every monthly archive, newest first, merged
// month by month. Resumable: a finished month is never fetched again (the
// current one is, it is still being played).
import type { ChessComGame } from '@shared/types'
import { archiveMonth, getArchive, getArchives } from '@shared/api/chesscom'

const doneKey = (username: string) => `chess.history.done.${username.toLowerCase()}`
const totalKey = (username: string) => `chess.history.months.${username.toLowerCase()}`

export interface HistoryStatus {
  /** Months already downloaded, out of `total` (0 = never looked). */
  done: number
  total: number
}

export function loadHistoryStatus(username: string): HistoryStatus {
  let done: string[] = []
  try { done = JSON.parse(localStorage.getItem(doneKey(username)) ?? '[]') } catch { /* none */ }
  return { done: done.length, total: Number(localStorage.getItem(totalKey(username)) ?? 0) }
}

/** Every month not downloaded yet, newest first; `onMonth` gets its games. */
export async function downloadHistory(
  username: string,
  onMonth: (games: ChessComGame[], status: HistoryStatus) => Promise<void>,
  signal?: AbortSignal,
): Promise<void> {
  const archives = await getArchives(username)
  const current = archiveMonth(archives[archives.length - 1] ?? '')
  let done: string[] = []
  try { done = JSON.parse(localStorage.getItem(doneKey(username)) ?? '[]') } catch { /* none */ }
  const finished = new Set(done)
  localStorage.setItem(totalKey(username), String(archives.length))
  for (const url of [...archives].reverse()) {
    if (signal?.aborted) return
    const month = archiveMonth(url)
    if (month && finished.has(month)) continue
    const games = await getArchive(url)
    // Stored first: a month counts as done once its games are saved.
    const doneAfter = finished.size + (month && month !== current && !finished.has(month) ? 1 : 0) + (month === current ? 1 : 0)
    await onMonth(games, { done: doneAfter, total: archives.length })
    if (month && month !== current) {
      finished.add(month)
      localStorage.setItem(doneKey(username), JSON.stringify([...finished]))
    }
  }
}

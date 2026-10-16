import type { ArchivesListResponse, ArchiveResponse, ChessComGame } from '../types'

const BASE = 'https://api.chess.com/pub'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error(`Chess.com API error ${res.status} on ${url}`)
  return res.json() as Promise<T>
}

export async function getArchives(username: string): Promise<string[]> {
  const data = await fetchJson<ArchivesListResponse>(
    `${BASE}/player/${encodeURIComponent(username.toLowerCase())}/games/archives`,
  )
  return data.archives
}

export async function getArchive(archiveUrl: string): Promise<ChessComGame[]> {
  const data = await fetchJson<ArchiveResponse>(archiveUrl)
  return data.games
}

export async function getRecentGames(username: string, max = 30): Promise<ChessComGame[]> {
  const archives = await getArchives(username)
  if (archives.length === 0) return []
  const games: ChessComGame[] = []
  for (let i = archives.length - 1; i >= 0 && games.length < max; i--) {
    const monthGames = await getArchive(archives[i])
    for (let j = monthGames.length - 1; j >= 0 && games.length < max; j--) {
      games.push(monthGames[j])
    }
  }
  return games
}

/** Games finished after `since` (unix seconds), newest first. chess.com
 *  archives are monthly: only the months since then are fetched. */
export async function getGamesSince(username: string, since: number, max = 100): Promise<ChessComGame[]> {
  const archives = await getArchives(username)
  const d = new Date(since * 1000)
  const sinceMonth = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  const games: ChessComGame[] = []
  for (let i = archives.length - 1; i >= 0 && games.length < max; i--) {
    const month = archives[i].match(/(\d{4}\/\d{2})$/)?.[1]
    if (month && month < sinceMonth) break
    const monthGames = await getArchive(archives[i])
    for (let j = monthGames.length - 1; j >= 0 && games.length < max; j--) {
      if (monthGames[j].end_time > since) games.push(monthGames[j])
    }
  }
  return games
}

export async function getProfile(username: string): Promise<{ avatar?: string; name?: string; url: string }> {
  return fetchJson(`${BASE}/player/${encodeURIComponent(username.toLowerCase())}`)
}

/** "2026/10" for an archive URL (…/games/2026/10), or null. */
export function archiveMonth(url: string): string | null {
  return url.match(/(\d{4}\/\d{2})$/)?.[1] ?? null
}

/** Both lists, each game once (the incoming copy wins), newest first. */
export function mergeGames(existing: ChessComGame[], incoming: ChessComGame[]): ChessComGame[] {
  const byUrl = new Map(existing.map(g => [g.url, g]))
  for (const g of incoming) byUrl.set(g.url, g)
  return [...byUrl.values()].sort((a, b) => b.end_time - a.end_time)
}

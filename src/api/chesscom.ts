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

export async function getProfile(username: string): Promise<{ avatar?: string; name?: string; url: string }> {
  return fetchJson(`${BASE}/player/${encodeURIComponent(username.toLowerCase())}`)
}

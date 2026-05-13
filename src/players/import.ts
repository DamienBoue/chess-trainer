// Bulk PGN import: split a file containing N games into individual game PGNs
// then group them by player name (the side the user designates).
//
// Output is one or more PlayerProfile candidates, one per name seen as the
// chosen side. This is robust to TWIC-style downloads where a single file
// contains a whole tournament with many players.

import type { ChessComGame } from '../types'
import { importPgnAsChessComGame } from '../api/pgn-import'
import { parsePgnHeaders } from '../analysis/pgn'
import { slugifyPlayer, type PlayerProfile } from './storage'

/** Split a multi-game PGN blob into individual game strings.
 *  PGNs separate games by `[Event "..."]` headers; we scan for that anchor
 *  starting at column 0, optionally with a preceding result line / blank.
 */
export function splitPgn(text: string): string[] {
  const games: string[] = []
  // Normalise CRLF -> LF first.
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  let buf: string[] = []
  for (const line of lines) {
    if (/^\[Event\s+"/.test(line) && buf.length > 0) {
      games.push(buf.join('\n').trim())
      buf = []
    }
    buf.push(line)
  }
  if (buf.length > 0) {
    const flushed = buf.join('\n').trim()
    if (flushed) games.push(flushed)
  }
  return games.filter(g => g.length > 0)
}

/** Group split PGNs into per-player profiles.
 *
 *  By default we extract BOTH players from each game (so a Carlsen-Caruana
 *  game contributes one entry to "Carlsen" and one to "Caruana"). The caller
 *  filters later.
 *
 *  Returns a map name -> ChessComGame[]. Names are kept verbatim from the
 *  PGN header (e.g. "Carlsen, Magnus").
 */
export function groupByPlayer(pgns: string[]): Map<string, ChessComGame[]> {
  const out = new Map<string, ChessComGame[]>()
  for (const pgn of pgns) {
    const headers = parsePgnHeaders(pgn)
    const white = headers.white?.trim()
    const black = headers.black?.trim()
    if (white && white !== '?') {
      const gw = importPgnAsChessComGame(pgn, 'white', white)
      addTo(out, white, gw)
    }
    if (black && black !== '?') {
      const gb = importPgnAsChessComGame(pgn, 'black', black)
      addTo(out, black, gb)
    }
  }
  return out
}

function addTo(map: Map<string, ChessComGame[]>, name: string, game: ChessComGame): void {
  const list = map.get(name) ?? []
  list.push(game)
  map.set(name, list)
}

/** Build PlayerProfile records ready for IndexedDB from a bulk PGN file.
 *  Filters out names with too few games (default ≥minGames). */
export function buildPlayerProfiles(text: string, minGames = 3): PlayerProfile[] {
  const pgns = splitPgn(text)
  const grouped = groupByPlayer(pgns)
  const now = new Date().toISOString()
  const profiles: PlayerProfile[] = []
  for (const [name, games] of grouped) {
    if (games.length < minGames) continue
    profiles.push({
      id: slugifyPlayer(name),
      name,
      source: 'pgn',
      importedAt: now,
      games,
    })
  }
  // Most games first — popular players land at the top of the picker.
  profiles.sort((a, b) => b.games.length - a.games.length)
  return profiles
}

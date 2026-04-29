import type { ChessComGame } from '../types'
import { parsePgnHeaders } from '../analysis/pgn'

// Convert a raw PGN into the ChessComGame shape the rest of the app expects.
// `userColor` tells us which side the user played; if undefined, we try to match
// the saved chess.com username against the PGN headers.
export function importPgnAsChessComGame(
  pgn: string,
  userColor: 'white' | 'black' | 'auto',
  username: string,
): ChessComGame {
  const headers = parsePgnHeaders(pgn)
  const result = headers.result // "1-0", "0-1", "1/2-1/2", or "*"

  let whiteResult = 'agreed'
  let blackResult = 'agreed'
  if (result === '1-0') { whiteResult = 'win'; blackResult = 'checkmated' }
  else if (result === '0-1') { whiteResult = 'checkmated'; blackResult = 'win' }
  else if (result === '1/2-1/2') { whiteResult = 'agreed'; blackResult = 'agreed' }

  // Resolve user color: if 'auto', match username to a header.
  let resolvedColor = userColor
  if (userColor === 'auto') {
    const u = username.toLowerCase().trim()
    if (headers.white.toLowerCase() === u) resolvedColor = 'white'
    else if (headers.black.toLowerCase() === u) resolvedColor = 'black'
    else resolvedColor = 'white'
  }

  // Synthetic stable URL based on a content hash, so re-importing the same PGN
  // doesn't duplicate the entry in the games list.
  const url = `pgn://imported/${stableHash(pgn)}`

  // Use the username field on the side the user played as so analyzeGame can
  // pick the right color downstream.
  const whiteUsername = resolvedColor === 'white' ? username : (headers.white || 'White')
  const blackUsername = resolvedColor === 'black' ? username : (headers.black || 'Black')

  return {
    url,
    pgn,
    time_control: '-',
    end_time: Date.now() / 1000 | 0,
    rated: false,
    time_class: 'pgn',
    rules: 'chess',
    eco: headers.eco,
    white: {
      '@id': '',
      username: whiteUsername,
      rating: 0,
      result: whiteResult,
    },
    black: {
      '@id': '',
      username: blackUsername,
      rating: 0,
      result: blackResult,
    },
  }
}

function stableHash(s: string): string {
  // 32-bit FNV-1a hash, base36-encoded. Good enough for de-duplication.
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return h.toString(36)
}

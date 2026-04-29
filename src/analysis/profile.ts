import type { ChessComGame } from '../types'
import { parsePgnHeaders } from './pgn'
import { getParentOpening } from './openings'

export interface ProfileStats {
  username: string
  games: number
  wins: number
  losses: number
  draws: number
  winRate: number               // includes draws as 0.5
  avgRating: number             // user's rating averaged
  avgOppRating: number
  topOpenings: Array<{ name: string; played: number }>
  whiteWinRate: number
  blackWinRate: number
  timeClass: Record<string, number>
}

const LOSS_RESULTS = new Set(['checkmated', 'resigned', 'timeout', 'abandoned'])

export function profileFromGames(username: string, games: ChessComGame[]): ProfileStats {
  let wins = 0, losses = 0, draws = 0
  let ratingSum = 0, oppRatingSum = 0, ratingN = 0
  let whiteW = 0, whiteN = 0, blackW = 0, blackN = 0
  const openings = new Map<string, number>()
  const timeClass: Record<string, number> = {}

  const u = username.toLowerCase()
  for (const g of games) {
    const isWhite = g.white.username.toLowerCase() === u
    const my = isWhite ? g.white : g.black
    const opp = isWhite ? g.black : g.white

    let outcome: 'w' | 'l' | 'd' = 'd'
    if (my.result === 'win') outcome = 'w'
    else if (LOSS_RESULTS.has(my.result)) outcome = 'l'

    if (outcome === 'w') wins++
    else if (outcome === 'l') losses++
    else draws++

    if (isWhite) {
      whiteN++
      if (outcome === 'w') whiteW++
      else if (outcome === 'd') whiteW += 0.5
    } else {
      blackN++
      if (outcome === 'w') blackW++
      else if (outcome === 'd') blackW += 0.5
    }

    if (my.rating) { ratingSum += my.rating; ratingN++ }
    if (opp.rating) { oppRatingSum += opp.rating }

    const headers = parsePgnHeaders(g.pgn)
    const parent = getParentOpening(headers.eco, headers.opening)
    openings.set(parent, (openings.get(parent) ?? 0) + 1)

    timeClass[g.time_class] = (timeClass[g.time_class] ?? 0) + 1
  }
  const total = games.length || 1
  return {
    username,
    games: games.length,
    wins, losses, draws,
    winRate: (wins + 0.5 * draws) / total,
    avgRating: ratingN ? ratingSum / ratingN : 0,
    avgOppRating: ratingN ? oppRatingSum / ratingN : 0,
    topOpenings: Array.from(openings.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, played]) => ({ name, played })),
    whiteWinRate: whiteN ? whiteW / whiteN : 0,
    blackWinRate: blackN ? blackW / blackN : 0,
    timeClass,
  }
}

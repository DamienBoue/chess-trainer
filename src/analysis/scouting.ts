// Richer profile aimed at preparing for a specific opponent: per-color
// opening breakdown, win rates, time-control affinity, recent form.

import type { ChessComGame } from '../types'
import { parsePgnHeaders } from './pgn'
import { getParentOpening } from './openings'

const LOSS_RESULTS = new Set(['checkmated', 'resigned', 'timeout', 'abandoned'])

export interface OpeningStat {
  name: string
  played: number
  wins: number          // 1 per win, 0.5 per draw
  winRate: number
}

export interface ColorSplit {
  games: number
  wins: number
  losses: number
  draws: number
  winRate: number
  openings: OpeningStat[]   // sorted by played desc
}

export interface ScoutingProfile {
  username: string
  games: number
  whiteSide: ColorSplit
  blackSide: ColorSplit
  timeClassBreakdown: Array<{ tc: string; games: number; winRate: number }>
  recentForm: Array<'W' | 'L' | 'D'>   // most-recent-first, max 20
  worstOpenings: OpeningStat[]         // openings with ≥3 games and low winrate
  bestOpenings: OpeningStat[]          // openings with ≥3 games and high winrate
}

function outcomeOf(myResult: string): 'w' | 'l' | 'd' {
  if (myResult === 'win') return 'w'
  if (LOSS_RESULTS.has(myResult)) return 'l'
  return 'd'
}

function buildColorSplit(records: Array<{ outcome: 'w'|'l'|'d'; opening: string }>): ColorSplit {
  let wins = 0, losses = 0, draws = 0
  const openings = new Map<string, { played: number; winPoints: number }>()
  for (const r of records) {
    if (r.outcome === 'w') wins++
    else if (r.outcome === 'l') losses++
    else draws++
    const entry = openings.get(r.opening) ?? { played: 0, winPoints: 0 }
    entry.played++
    entry.winPoints += r.outcome === 'w' ? 1 : r.outcome === 'd' ? 0.5 : 0
    openings.set(r.opening, entry)
  }
  const total = records.length
  const list: OpeningStat[] = Array.from(openings.entries())
    .map(([name, v]) => ({
      name,
      played: v.played,
      wins: v.winPoints,
      winRate: v.played > 0 ? v.winPoints / v.played : 0,
    }))
    .sort((a, b) => b.played - a.played)
  return {
    games: total,
    wins, losses, draws,
    winRate: total > 0 ? (wins + 0.5 * draws) / total : 0,
    openings: list,
  }
}

export function scoutingProfile(username: string, games: ChessComGame[]): ScoutingProfile {
  const u = username.toLowerCase()
  const whiteRecords: Array<{ outcome: 'w'|'l'|'d'; opening: string }> = []
  const blackRecords: Array<{ outcome: 'w'|'l'|'d'; opening: string }> = []
  const tcAgg = new Map<string, { games: number; winPoints: number }>()
  const recentSorted = [...games].sort((a, b) => b.end_time - a.end_time)
  const form: Array<'W' | 'L' | 'D'> = []

  for (const g of games) {
    const isWhite = g.white.username.toLowerCase() === u
    const my = isWhite ? g.white : g.black
    const outcome = outcomeOf(my.result)
    const headers = parsePgnHeaders(g.pgn)
    const parent = getParentOpening(headers.eco, headers.opening)
    ;(isWhite ? whiteRecords : blackRecords).push({ outcome, opening: parent })

    const tc = g.time_class || 'unknown'
    const e = tcAgg.get(tc) ?? { games: 0, winPoints: 0 }
    e.games++
    e.winPoints += outcome === 'w' ? 1 : outcome === 'd' ? 0.5 : 0
    tcAgg.set(tc, e)
  }

  for (const g of recentSorted) {
    if (form.length >= 20) break
    const isWhite = g.white.username.toLowerCase() === u
    const my = isWhite ? g.white : g.black
    const outcome = outcomeOf(my.result)
    form.push(outcome === 'w' ? 'W' : outcome === 'l' ? 'L' : 'D')
  }

  const white = buildColorSplit(whiteRecords)
  const black = buildColorSplit(blackRecords)

  // Cross-color opening list for best / worst (≥3 games threshold so winrate
  // isn't dominated by single-game anecdotes).
  const allOpenings = new Map<string, OpeningStat>()
  for (const o of [...white.openings, ...black.openings]) {
    const cur = allOpenings.get(o.name)
    if (cur) {
      const played = cur.played + o.played
      const wins = cur.wins + o.wins
      allOpenings.set(o.name, { name: o.name, played, wins, winRate: wins / played })
    } else {
      allOpenings.set(o.name, { ...o })
    }
  }
  const eligible = Array.from(allOpenings.values()).filter(o => o.played >= 3)
  const worstOpenings = [...eligible].sort((a, b) => a.winRate - b.winRate).slice(0, 5)
  const bestOpenings = [...eligible].sort((a, b) => b.winRate - a.winRate).slice(0, 5)

  return {
    username,
    games: games.length,
    whiteSide: white,
    blackSide: black,
    timeClassBreakdown: Array.from(tcAgg.entries())
      .map(([tc, v]) => ({ tc, games: v.games, winRate: v.games > 0 ? v.winPoints / v.games : 0 }))
      .sort((a, b) => b.games - a.games),
    recentForm: form,
    worstOpenings,
    bestOpenings,
  }
}

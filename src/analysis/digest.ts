// What one analysed game contributes, computed once when it is analysed:
// its exercises, its precision, its result. The app keeps these digests in
// an index it stores (storage/derived) and updates game by game, so that
// neither the launch nor a new analysis goes through every analysis again.

import type { Color, GameAnalysis, GameResult } from '../types'
import { extractExercises, type Exercise } from './exercises'

/** Bump when a digest's content changes (exercise rules, new fields): the
 *  index is then rebuilt once from the analyses. */
export const DIGEST_VERSION = 1

export interface GameDigest {
  url: string
  /** Unix seconds. */
  endTime: number
  /** Identity of the analysis: a game analysed again gets a new one. */
  stamp: string
  timeClass: string
  result: GameResult
  userColor: Color
  opponent: string
  opening?: string
  userRating?: number
  userMoves: number
  /** Sum of the user's centipawn losses. */
  userCpLoss: number
  /** The user's mistakes and blunders. */
  userErrors: number
  exercises: Exercise[]
}

export interface DigestIndex {
  version: number
  games: Record<string, GameDigest>
}

export const emptyIndex = (): DigestIndex => ({ version: DIGEST_VERSION, games: {} })

export function stampOf(a: GameAnalysis): string {
  let cp = 0
  for (const m of a.moves) cp += m.cpLoss
  return `${a.moves.length}:${cp}`
}

export function digestOf(a: GameAnalysis): GameDigest {
  const userIsWhite = a.userColor === 'white'
  let userMoves = 0, userCpLoss = 0, userErrors = 0
  for (const m of a.moves) {
    if ((m.ply % 2 === 1) !== userIsWhite) continue
    userMoves++
    userCpLoss += m.cpLoss
    if (m.classification === 'blunder' || m.classification === 'mistake') userErrors++
  }
  return {
    url: a.url,
    endTime: a.endTime,
    stamp: stampOf(a),
    timeClass: a.timeClass,
    result: a.result,
    userColor: a.userColor,
    opponent: a.opponent,
    opening: a.opening,
    userRating: a.userRating,
    userMoves,
    userCpLoss,
    userErrors,
    exercises: extractExercises([a]),
  }
}

/** The index with these analyses added (or replaced when analysed again);
 *  the same object when none of them is new. */
export function withAnalyses(index: DigestIndex, list: GameAnalysis[]): DigestIndex {
  let games: Record<string, GameDigest> | null = null
  for (const a of list) {
    const known = (games ?? index.games)[a.url]
    if (known && known.stamp === stampOf(a)) continue
    games ??= { ...index.games }
    games[a.url] = digestOf(a)
  }
  return games ? { version: index.version, games } : index
}

/** Every exercise, in extractExercises' order: the most recent game first,
 *  then the costliest mistake. */
export function indexExercises(index: DigestIndex): Exercise[] {
  return Object.values(index.games)
    .flatMap(d => d.exercises)
    .sort((a, b) => b.context.endTime - a.context.endTime || b.cpSwing - a.cpSwing)
}

/** Changes whenever a game is added or analysed again. */
export function indexStamp(index: DigestIndex): string {
  let h = 0
  const urls = Object.keys(index.games).sort()
  for (const url of urls) {
    const s = url + index.games[url].stamp
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return `${index.version}:${urls.length}:${h}`
}

/** The home screen's line and card. */
export interface HomeSummary {
  analysed: number
  avgCpLossUser: number
  last: { url: string; opponent: string; result: GameResult; userErrors: number } | null
  /** The latest games' ratings, to infer the Elo (skill/elo). */
  ratings: { endTime: number; userRating?: number }[]
}

export function homeSummary(index: DigestIndex): HomeSummary {
  const list = Object.values(index.games).sort((a, b) => b.endTime - a.endTime)
  let moves = 0, cp = 0
  for (const d of list) { moves += d.userMoves; cp += d.userCpLoss }
  const last = list[0]
  return {
    analysed: list.length,
    avgCpLossUser: moves ? cp / moves : 0,
    last: last ? { url: last.url, opponent: last.opponent, result: last.result, userErrors: last.userErrors } : null,
    ratings: list.slice(0, 20).map(d => ({ endTime: d.endTime, userRating: d.userRating })),
  }
}

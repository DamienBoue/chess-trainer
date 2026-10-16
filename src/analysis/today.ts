// What the home screen and the day's exercises need, stored so that the app
// opens on it without reading the games or analyses again:
// - home: the summary line and the last game (from the digest index, see
//   ./digest), refreshed whenever a game is analysed;
// - plan: the plan's costly inputs (./plan), worked out again only when the
//   analyses changed;
// - day: what is current today and the session's exercises, worked out once
//   a day (or after new analyses) from the recent games only.
// Everything that moves during the day (the progress, the repertoire
// reviews, the puzzle solved) is applied at render, cheaply.

import type { GameAnalysis } from '../types'
import type { Exercise } from './exercises'
import type { ExerciseProgress } from '../storage/persist'
import { isDue } from '../storage/persist'
import { emptyIndex, homeSummary, indexStamp, type DigestIndex, type HomeSummary } from './digest'
import type { PlanInputs } from './plan'
import {
  currentIdsOf, isCurrent, recencyOf, resolveDailySession, sessionProgress,
  type DailySession, type Recency,
} from './dailyQueue'

/** Bump when the stored shape changes: the cache is then rebuilt. */
export const TODAY_VERSION = 1

export interface DayFacts {
  /** Local date (YYYY-MM-DD). */
  date: string
  /** The digest index it was worked out from (digest.indexStamp). */
  basedOn: string
  /** Exercises current by their game or position (dailyQueue.isCurrent). */
  currentIds: string[]
  /** Unix seconds: solved exercises from older games retire. */
  retireBefore: number
  /** The session's exercises, playable before the whole pool is loaded. */
  sessionExercises: Exercise[]
}

export interface TodayCache {
  version: number
  home: HomeSummary
  /** Exercises in the pool. */
  exercises: number
  plan: { basedOn: string; inputs: PlanInputs } | null
  day: DayFacts | null
}

export function emptyToday(): TodayCache {
  return { version: TODAY_VERSION, home: homeSummary(emptyIndex()), exercises: 0, plan: null, day: null }
}

/** The day's facts and session, from the analyses of the recent games
 *  (dailyQueue.recentGameUrls). A session already picked today is kept. */
export function computeDay(args: {
  index: DigestIndex
  exercises: Exercise[]
  recent: GameAnalysis[]
  progress: Record<string, ExerciseProgress>
  stored: DailySession | null
  today: string
  now: number
}): { day: DayFacts; session: DailySession } {
  const { index, exercises, recent, progress, stored, today, now } = args
  const recency = recencyOf(recent, now)
  const session = resolveDailySession(stored, exercises, progress, recency, today, now)
  const inSession = new Set(session.ids)
  return {
    session,
    day: {
      date: today,
      basedOn: indexStamp(index),
      currentIds: currentIdsOf(exercises, recency),
      retireBefore: recency.retireBefore,
      sessionExercises: exercises.filter(e => inSession.has(e.id)),
    },
  }
}

/** The stored day as dailyQueue's Recency. */
export function recencyOfDay(day: DayFacts): Recency {
  return { games: new Set(), positions: new Set(), retireBefore: day.retireBefore, ids: new Set(day.currentIds) }
}

/** Today's exercise session, as the screens show it. */
export interface DailyExercises {
  /** The day isn't worked out yet (first launch of the day). */
  preparing: boolean
  /** Ids in play order; `remaining` are the ones not attempted today. */
  ids: string[]
  remaining: string[]
  done: number
  total: number
  /** Current exercises due but not in today's session. */
  reserve: number
  /** Every current exercise that is due (today's remaining + the reserve). */
  currentDue: string[]
  /** Exercises no longer current (old mistakes), out of every count. */
  archived: number
}

const NONE = { ids: [], remaining: [], done: 0, total: 0, reserve: 0, currentDue: [], archived: 0 }

/** `pool`: every exercise, when loaded (the reserve and archive counts
 *  need it; empty, they read 0). */
export function dailyState(
  day: DayFacts | null,
  session: DailySession | null,
  pool: Exercise[],
  progress: Record<string, ExerciseProgress>,
  today: string,
  startOfDay: number,
): DailyExercises {
  if (!day || day.date !== today || !session || session.date !== today) return { preparing: true, ...NONE }
  const sp = sessionProgress(session, progress, startOfDay)
  const recency = recencyOfDay(day)
  const inSession = new Set(session.ids)
  let reserve = 0
  let archived = 0
  const currentDue: string[] = []
  for (const e of pool) {
    if (!isCurrent(e, recency, progress)) { archived++; continue }
    if (!isDue(progress[e.id])) continue
    currentDue.push(e.id)
    if (!inSession.has(e.id)) reserve++
  }
  return { preparing: false, ids: session.ids, remaining: sp.remaining, done: sp.done, total: sp.total, reserve, currentDue, archived }
}

/** What has to be worked out again, and why. */
export function staleParts(cache: TodayCache, index: DigestIndex, today: string): { day: boolean; plan: boolean } {
  const stamp = indexStamp(index)
  return {
    day: !cache.day || cache.day.date !== today || cache.day.basedOn !== stamp,
    plan: !cache.plan || cache.plan.basedOn !== stamp,
  }
}

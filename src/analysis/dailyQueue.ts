// The day's exercises: a session you can finish, as in Chessable's daily
// goal. A pool of a thousand due exercises discourages; twenty well chosen,
// current ones motivate.
// - Current only: new exercises come from your recent games (the last 30
//   days, at least your 20 last games). An older mistake comes back only if
//   you still reach its position in a recent game (the same opening line,
//   the same trap): one you would no longer make is archived.
// - Reviews first: exercises you already met that SM-2 brings back, the most
//   overdue first — except old ones you already solved (over 6 months),
//   retired like Chessable's mastered moves.
// - Then new ones, the most recent game first, the costliest mistake first,
//   two per game before a third from any (one bad game doesn't fill the
//   day), one per position.
// The selection is frozen for the day: solving an exercise doesn't pull
// another in. The rest waits in reserve.

import type { GameAnalysis } from '../types'
import type { Exercise } from './exercises'
import { isDue, type ExerciseProgress } from '../storage/persist'

const DAY_S = 86400
/** Games of the last 30 days are recent… */
export const RECENT_DAYS = 30
/** …and so are your last 20 games, however old. */
export const RECENT_GAMES = 20
/** Solved mistakes older than this retire. */
export const RETIRE_DAYS = 182
export const DAILY_EXERCISES = 20
export const NEW_PER_GAME = 2
/** "Encore" adds this many once the session is done. */
export const DAILY_EXTRA = 10

export interface DailySession {
  /** Local date (YYYY-MM-DD) the session belongs to. */
  date: string
  /** Exercise ids, in the order to play them. */
  ids: string[]
}

const positionKey = (fen: string) => fen.split(' ').slice(0, 4).join(' ')

/** What "recent" means for this player: the games, and the positions they
 *  reached (an old mistake is current again when its position comes back). */
export interface Recency {
  games: Set<string>
  positions: Set<string>
  /** Unix seconds: solved exercises from games before this retire. */
  retireBefore: number
}

export function recencyOf(analyses: GameAnalysis[], nowMs: number): Recency {
  const nowS = nowMs / 1000
  const byDate = [...analyses].sort((a, b) => b.endTime - a.endTime)
  const recent = byDate.filter((a, i) => i < RECENT_GAMES || a.endTime >= nowS - RECENT_DAYS * DAY_S)
  const positions = new Set<string>()
  for (const a of recent) for (const m of a.moves) positions.add(positionKey(m.fenBefore))
  return { games: new Set(recent.map(a => a.url)), positions, retireBefore: nowS - RETIRE_DAYS * DAY_S }
}

/** Is this exercise still worth playing? (see the header) */
export function isCurrent(e: Exercise, recency: Recency, progress: Record<string, ExerciseProgress>): boolean {
  const p = progress[e.id]
  if (p) return !(p.successes > 0 && e.context.endTime < recency.retireBefore)
  return recency.games.has(e.context.gameUrl) || recency.positions.has(positionKey(e.fen))
}

/** The next exercises to work on, best first, skipping `exclude`. */
export function pickDailyExercises(
  exercises: Exercise[],
  progress: Record<string, ExerciseProgress>,
  recency: Recency,
  now: number,
  limit: number = DAILY_EXERCISES,
  exclude: ReadonlySet<string> = new Set(),
): string[] {
  const current = exercises.filter(e => isCurrent(e, recency, progress))
  const reviews = current
    .filter(e => progress[e.id] && isDue(progress[e.id], now))
    .sort((a, b) => progress[a.id].nextDueAt - progress[b.id].nextDueAt)

  // New ones, game by game from the most recent, the costliest first.
  const byGame = new Map<string, Exercise[]>()
  for (const e of current) {
    if (progress[e.id]) continue
    const list = byGame.get(e.context.gameUrl) ?? []
    list.push(e)
    byGame.set(e.context.gameUrl, list)
  }
  const games = [...byGame.values()]
    .sort((a, b) => b[0].context.endTime - a[0].context.endTime)
    .map(list => [...list].sort((a, b) => b.cpSwing - a.cpSwing))
  // Two per game first, to spread the day over several games; then the
  // rest, so that a player with few recent games still gets a session.
  const fresh = [...games.flatMap(l => l.slice(0, NEW_PER_GAME)), ...games.flatMap(l => l.slice(NEW_PER_GAME))]

  const out: string[] = []
  const seen = new Set<string>()
  for (const e of [...reviews, ...fresh]) {
    if (out.length >= limit) break
    if (exclude.has(e.id) || seen.has(positionKey(e.fen))) continue
    seen.add(positionKey(e.fen))
    out.push(e.id)
  }
  return out
}

/** Today's session: the stored one if it is today's (minus exercises that
 *  no longer exist), else a new pick. An empty session is picked again:
 *  the games may have been analysed since. */
export function resolveDailySession(
  stored: DailySession | null,
  exercises: Exercise[],
  progress: Record<string, ExerciseProgress>,
  recency: Recency,
  today: string,
  now: number,
): DailySession {
  if (stored && stored.date === today) {
    const known = new Set(exercises.map(e => e.id))
    const ids = stored.ids.filter(id => known.has(id))
    if (ids.length > 0) return ids.length === stored.ids.length ? stored : { date: today, ids }
  }
  return { date: today, ids: pickDailyExercises(exercises, progress, recency, now) }
}

/** The "encore" button: more exercises in today's session. */
export function extendDailySession(
  session: DailySession,
  exercises: Exercise[],
  progress: Record<string, ExerciseProgress>,
  recency: Recency,
  now: number,
  n: number = DAILY_EXTRA,
): DailySession {
  const more = pickDailyExercises(exercises, progress, recency, now, n, new Set(session.ids))
  return { date: session.date, ids: [...session.ids, ...more] }
}

/** Where the session stands: done = attempted since the start of the day. */
export function sessionProgress(
  session: DailySession,
  progress: Record<string, ExerciseProgress>,
  startOfDay: number,
): { total: number; done: number; remaining: string[] } {
  const remaining = session.ids.filter(id => !(progress[id] && progress[id].lastSeenAt >= startOfDay))
  return { total: session.ids.length, done: session.ids.length - remaining.length, remaining }
}

// The stored side of @shared/analysis/today: the cache the home screen opens
// on (localStorage, read synchronously at launch), and the two jobs that
// refresh it — the day (recent games only, once a day) and the plan (every
// analysis, only after new ones). Also used by the background task.
import type { GameAnalysis } from '@shared/types'
import type { DailySession } from '@shared/analysis/dailyQueue'
import { recentGameUrls } from '@shared/analysis/dailyQueue'
import { DIGEST_VERSION, emptyIndex, indexExercises, withAnalyses, type DigestIndex } from '@shared/analysis/digest'
import { planInputs, type PlanInputs } from '@shared/analysis/plan'
import { computeDay, TODAY_VERSION, type DayFacts, type TodayCache } from '@shared/analysis/today'
import { loadAnalyses, loadAnalysesOf, type ExerciseProgress } from '@shared/storage/persist'
import { loadDerived, saveDerived } from '@shared/storage/derived'

const cacheKey = (username: string) => `chess.today.${username.toLowerCase()}`

export function loadTodayCache(username: string): TodayCache | null {
  if (!username) return null
  try {
    const v = JSON.parse(localStorage.getItem(cacheKey(username)) ?? 'null') as TodayCache | null
    return v && v.version === TODAY_VERSION ? v : null
  } catch {
    return null
  }
}

export function saveTodayCache(username: string, cache: TodayCache): void {
  try { localStorage.setItem(cacheKey(username), JSON.stringify(cache)) } catch { /* rebuilt next time */ }
}

/** The stored digest index, when it matches the current rules. */
export async function loadIndex(username: string): Promise<DigestIndex | null> {
  const v = await loadDerived<DigestIndex>(username, 'digest')
  return v && v.version === DIGEST_VERSION ? v : null
}

export function saveIndex(username: string, index: DigestIndex): Promise<void> {
  return saveDerived(username, 'digest', index)
}

const pause = () => new Promise(r => setTimeout(r, 0))

/** The index from every analysis, a few games at a time so that the app
 *  stays responsive (first launch after an update of the rules). */
export async function buildIndex(analyses: GameAnalysis[]): Promise<DigestIndex> {
  let index = emptyIndex()
  for (let i = 0; i < analyses.length; i += 10) {
    index = withAnalyses(index, analyses.slice(i, i + 10))
    await pause()
  }
  return index
}

/** Today's facts and session: reads the recent games' analyses only. */
export async function workOutDay(
  username: string,
  index: DigestIndex,
  progress: Record<string, ExerciseProgress>,
  stored: DailySession | null,
  today: string,
  now: number,
): Promise<{ day: DayFacts; session: DailySession }> {
  const urls = recentGameUrls(Object.values(index.games), now)
  const recent = await loadAnalysesOf(username, urls)
  return computeDay({ index, exercises: indexExercises(index), recent, progress, stored, today, now })
}

/** The plan's inputs: reads every analysis (unless given). */
export async function workOutPlan(
  username: string,
  index: DigestIndex,
  analyses?: Record<string, GameAnalysis> | null,
): Promise<PlanInputs> {
  const all = analyses ?? await loadAnalyses(username)
  await pause()
  return planInputs(Object.values(all), indexExercises(index))
}

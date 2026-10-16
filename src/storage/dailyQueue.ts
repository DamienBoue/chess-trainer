// Today's exercise session (see analysis/dailyQueue.ts), kept so that it
// stays the same all day.
import { KEYS } from './keys'
import { loadJson, saveJson } from './json'
import type { DailySession } from '../analysis/dailyQueue'

export function loadDailySession(): DailySession | null {
  return loadJson<DailySession | null>(KEYS.dailyExercises, null)
}

export function saveDailySession(session: DailySession): void {
  saveJson(KEYS.dailyExercises, session)
}
